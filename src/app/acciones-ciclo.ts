'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { escribirSeguimiento, type OrdenSeguimiento } from '@/lib/ciclo-vida-seguimiento-db';
import { ErrorSeguimiento, PUNTOS_PRUEBA_FINAL } from '@/lib/ciclo-vida-seguimiento';
import { sql } from '@/lib/db';
import { esErrorConcurrencia, transaccionConControl } from '@/lib/control-escritura';
import { avisosDeEntrega } from '@/lib/ciclo-vida';
import { fichaConAlmacen } from '@/app/salas/[id]/datos-ficha';
import { exigirEdicion } from '@/lib/sesion-servidor';

const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

/** Una escritura nueva exige técnico activo y con el rol del hecho. */
async function tecnicoValido(tecnicoId: string, rol: string): Promise<boolean> {
  const [f] = await sql<Array<{ ok: boolean }>>`
    select exists (
      select 1 from tecnicos t
      join tecnico_roles r on r.tecnico_id = t.id
      where t.id = ${tecnicoId} and t.activo and r.rol = ${rol}
    ) as ok`;
  return Boolean(f?.ok);
}

async function ejecutarSeguimiento(autor: Awaited<ReturnType<typeof exigirEdicion>>, orden: OrdenSeguimiento, devolverEstado = false): Promise<{ error: string | null }> {
  try {
    await escribirSeguimiento(sql, autor, orden, async () => {
      const ficha = await fichaConAlmacen(orden.salaId);
      if (!ficha) throw new ErrorSeguimiento('La sala no existe.');
      return avisosDeEntrega(ficha.puntosMontaje);
    });
  } catch (error) {
    if (esErrorConcurrencia(error) && devolverEstado) return {error:error.message};
    if (error instanceof ErrorSeguimiento) {
      if (devolverEstado) return { error: error.message };
      redirect(`/salas/${orden.salaId}?seguimiento_error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
  if (devolverEstado) return { error: null };
  redirect(`/salas/${orden.salaId}`);
}

type EstadoFormularioPrueba = { error: string | null };

export async function guardarPruebaConEstado(_anterior: EstadoFormularioPrueba, datos: FormData) {
  const autor = await exigirEdicion('salas');
  const salaId = texto(datos.get('sala_id'));
  const operacion = texto(datos.get('operacion'));
  if (!salaId || (operacion !== 'checklist' && operacion !== 'prueba_final')) return { error: 'Operación no válida.' };
  const puntos = PUNTOS_PRUEBA_FINAL.map(({ clave }) => ({ clave,
    resultado: texto(datos.get(`resultado_${clave}`)) ?? 'pendiente', nota: texto(datos.get(`nota_${clave}`)) ?? '' }));
  return ejecutarSeguimiento(autor, { operacion, salaId, puntos,
    version: Number(datos.get('version')), fecha: texto(datos.get('fecha')) ?? '', tecnicoId: texto(datos.get('tecnico_id')) }, true);
}

export async function registrarHitoSala(datos: FormData) {
  const autor = await exigirEdicion('salas');
  const salaId = texto(datos.get('sala_id'));
  const tipo = texto(datos.get('tipo'));
  if (!salaId || (tipo !== 'instalacion' && tipo !== 'entrega')) throw new Error('Hito no válido.');
  await ejecutarSeguimiento(autor, { operacion: tipo, salaId, fecha: texto(datos.get('fecha')) ?? '',
    tecnicoId: texto(datos.get('tecnico_id')), nota: texto(datos.get('notas')) ?? '', acepta: texto(datos.get('acepta')) ?? '' });
}

export async function borrarHitoSala(datos: FormData) {
  const autor = await exigirEdicion('salas');
  const salaId = texto(datos.get('sala_id'));
  if (!salaId) throw new Error('Falta sala.');
  await ejecutarSeguimiento(autor, { operacion: 'borrar_hito', salaId, hitoId: texto(datos.get('id')) ?? '', nota: texto(datos.get('notas')) ?? '' });
}

export async function guardarSeguimientoSala(datos: FormData) {
  const autor = await exigirEdicion('salas');
  const salaId = texto(datos.get('sala_id'));
  const operacion = texto(datos.get('operacion'));
  if (!salaId || !['plan', 'checklist', 'prueba_final', 'reabrir_prueba'].includes(operacion ?? '')) throw new Error('Operación no válida.');
  const puntos = PUNTOS_PRUEBA_FINAL.map(({ clave }) => ({ clave,
    resultado: texto(datos.get(`resultado_${clave}`)) ?? 'pendiente', nota: texto(datos.get(`nota_${clave}`)) ?? '' }));
  await ejecutarSeguimiento(autor, { operacion: operacion as OrdenSeguimiento['operacion'], salaId,
    version: Number(datos.get('version')), fecha: texto(datos.get('fecha')) ?? '',
    tecnicoId: texto(datos.get('tecnico_id')), nota: texto(datos.get('notas')) ?? '', puntos });
}

export async function registrarHitoProyecto(datos: FormData) {
  await exigirEdicion('proyectos');
  const proyectoId = texto(datos.get('proyecto_id'));
  const tipo = texto(datos.get('tipo'));
  if (!proyectoId || !tipo || !['inicio', 'cierre'].includes(tipo)) return;
  const notas = texto(datos.get('notas'));

  const tecnicoId = texto(datos.get('tecnico_id'));
  if (!tecnicoId || !(await tecnicoValido(tecnicoId, 'inicio'))) return;

  await transaccionConControl(sql, async (tx) => {
    // Mismo orden de cerrojos que las acciones que escriben en el plano
    // (`enLaSalaBloqueada`, en `acciones.ts`): PRIMERO las filas de `salas`,
    // después lo demás. Cerrar una obra convierte todas sus salas en solo
    // lectura, así que es una escritura sobre ellas aunque no las modifique.
    //
    // Sin este cerrojo, cerrar la obra y guardar un equipo a la vez se cruzan:
    // la acción de la sala comprueba el cierre, el cierre entra, y la acción
    // escribe después sobre una obra ya cerrada. Cogiendo la misma fila y en el
    // mismo orden, o el cierre va delante y la otra lo ve, o va detrás y espera.
    // Y como las dos empiezan por `salas`, no hay ciclo que provoque un abrazo
    // mortal.
    await tx`
      select s.id from salas s
      join localizaciones l on l.id = s.localizacion_id
      where l.proyecto_id = ${proyectoId}
      order by s.id
      for update of s`;

    if (tipo === 'cierre') {
      // No se cierra lo que no se inició, y cerrar con salas sin entregar es
      // una decisión consciente: nota obligatoria. Se comprueba DENTRO de la
      // transacción, con las salas ya bloqueadas: leerlo fuera dejaba una
      // ventana para que entrara una entrega entre la cuenta y el cierre.
      const [estado] = await tx<Array<{ iniciado: boolean; sin_entregar: number }>>`
        select exists (select 1 from hitos_proyecto h
                       where h.proyecto_id = ${proyectoId} and h.tipo = 'inicio') as iniciado,
               (select count(*)
                from salas s
                join localizaciones l on l.id = s.localizacion_id
                where l.proyecto_id = ${proyectoId}
                  and not exists (select 1 from hitos_sala hs
                                  where hs.sala_id = s.id and hs.tipo = 'entrega')) as sin_entregar
        `;
      if (!estado?.iniciado) return;
      if (Number(estado.sin_entregar) > 0 && !notas) return;
    }

    await tx`
      insert into hitos_proyecto (proyecto_id, tipo, tecnico_id, fecha, notas)
      values (${proyectoId}, ${tipo}, ${tecnicoId},
              ${texto(datos.get('fecha')) ?? tx`current_date`},
              ${notas})
      on conflict (proyecto_id, tipo) do nothing`;
  });
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
  revalidatePath('/salas/[id]', 'layout');
}

export async function borrarHitoProyecto(datos: FormData) {
  await exigirEdicion('proyectos');
  const proyectoId = texto(datos.get('proyecto_id'));
  const id = texto(datos.get('id'));
  if (!proyectoId || !id) return;
  // El inicio no se borra mientras exista el cierre: quedaría una obra
  // cerrada que nunca empezó. Reabrir es borrar primero el cierre.
  const [hito] = await sql<Array<{ tipo: string; hay_cierre: boolean }>>`
    select h.tipo,
           exists (select 1 from hitos_proyecto c
                   where c.proyecto_id = ${proyectoId} and c.tipo = 'cierre') as hay_cierre
    from hitos_proyecto h
    where h.id = ${id} and h.proyecto_id = ${proyectoId}`;
  if (!hito) return;
  if (hito.tipo === 'inicio' && hito.hay_cierre) return;
  await sql`
    delete from hitos_proyecto where id = ${id} and proyecto_id = ${proyectoId}`;
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
  revalidatePath('/salas/[id]', 'layout');
}

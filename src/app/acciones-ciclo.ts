'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { avisosDeEntrega } from '@/lib/ciclo-vida';
import { fichaConAlmacen } from '@/app/salas/[id]/datos-ficha';
import { exigirEdicion } from '@/lib/sesion-servidor';

const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

/**
 * Un proyecto cerrado es de solo lectura para su estructura. Reabrirlo es
 * borrar el cierre desde su portada, y eso deja rastro.
 */
async function proyectoCerradoDeSala(salaId: string): Promise<boolean> {
  const [f] = await sql<Array<{ cerrado: boolean }>>`
    select exists (
      select 1 from hitos_proyecto h
      join localizaciones l on l.proyecto_id = h.proyecto_id
      join salas s on s.localizacion_id = l.id
      where s.id = ${salaId} and h.tipo = 'cierre'
    ) as cerrado`;
  return Boolean(f?.cerrado);
}

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

/**
 * Escritura de los hitos de P1. Un hito no se edita: si se registró mal, se
 * borra y se registra de nuevo, como un movimiento de almacén. El `unique`
 * del esquema garantiza un hito de cada tipo, así que el registro repetido
 * no duplica: no hace nada y el que estaba se queda.
 *
 * Las invariantes se comprueban aquí, no solo en el formulario: el `required`
 * del navegador se salta con un POST manipulado o una pantalla vieja.
 */
export async function registrarHitoSala(datos: FormData) {
  await exigirEdicion('salas');
  const salaId = texto(datos.get('sala_id'));
  const tipo = texto(datos.get('tipo'));
  if (!salaId || !tipo || !['instalacion', 'entrega'].includes(tipo)) return;
  const notas = texto(datos.get('notas'));

  // Quién lo hizo es el dato que P1 vino a registrar: sin técnico válido no
  // hay hito nuevo. Los históricos con técnico borrado siguen siendo válidos.
  const tecnicoId = texto(datos.get('tecnico_id'));
  if (!tecnicoId || !(await tecnicoValido(tecnicoId, 'instalacion'))) return;
  if (await proyectoCerradoDeSala(salaId)) return;

  if (tipo === 'entrega' && !notas) {
    // La entrega con bloqueos del semáforo exige nota: decisión consciente.
    // Se recalcula aquí con el mismo `revisarMontaje` que pinta la ficha,
    // porque el `required` del formulario es solo del navegador.
    const ficha = await fichaConAlmacen(salaId);
    if (!ficha || avisosDeEntrega(ficha.puntosMontaje).exigeNota) return;
  }

  await sql`
    insert into hitos_sala (sala_id, tipo, tecnico_id, fecha, notas)
    values (${salaId}, ${tipo}, ${tecnicoId},
            ${texto(datos.get('fecha')) ?? sql`current_date`},
            ${notas})
    on conflict (sala_id, tipo) do nothing`;
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
}

export async function borrarHitoSala(datos: FormData) {
  await exigirEdicion('salas');
  const salaId = texto(datos.get('sala_id'));
  const id = texto(datos.get('id'));
  if (!salaId || !id) return;
  // Con la obra cerrada la entrega de una sala no se toca: primero se
  // reabre el proyecto borrando su cierre.
  if (await proyectoCerradoDeSala(salaId)) return;
  // El hito se borra solo si es de esta sala: un formulario alterado no puede
  // borrar el de otra.
  await sql`delete from hitos_sala where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
}

export async function registrarHitoProyecto(datos: FormData) {
  await exigirEdicion('proyectos');
  const proyectoId = texto(datos.get('proyecto_id'));
  const tipo = texto(datos.get('tipo'));
  if (!proyectoId || !tipo || !['inicio', 'cierre'].includes(tipo)) return;
  const notas = texto(datos.get('notas'));

  const tecnicoId = texto(datos.get('tecnico_id'));
  if (!tecnicoId || !(await tecnicoValido(tecnicoId, 'inicio'))) return;

  await sql.begin(async (tx) => {
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

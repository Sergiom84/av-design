'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { avisosDeEntrega } from '@/lib/ciclo-vida';
import { fichaConAlmacen } from '@/app/salas/[id]/datos-ficha';

const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

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
  const salaId = texto(datos.get('sala_id'));
  const tipo = texto(datos.get('tipo'));
  if (!salaId || !tipo || !['instalacion', 'entrega'].includes(tipo)) return;
  const notas = texto(datos.get('notas'));

  if (tipo === 'entrega' && !notas) {
    // La entrega con bloqueos del semáforo exige nota: decisión consciente.
    // Se recalcula aquí con el mismo `revisarMontaje` que pinta la ficha,
    // porque el `required` del formulario es solo del navegador.
    const ficha = await fichaConAlmacen(salaId);
    if (!ficha || avisosDeEntrega(ficha.puntosMontaje).exigeNota) return;
  }

  await sql`
    insert into hitos_sala (sala_id, tipo, tecnico_id, fecha, notas)
    values (${salaId}, ${tipo},
            ${texto(datos.get('tecnico_id'))},
            ${texto(datos.get('fecha')) ?? sql`current_date`},
            ${notas})
    on conflict (sala_id, tipo) do nothing`;
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
}

export async function borrarHitoSala(datos: FormData) {
  const salaId = texto(datos.get('sala_id'));
  const id = texto(datos.get('id'));
  if (!salaId || !id) return;
  // El hito se borra solo si es de esta sala: un formulario alterado no puede
  // borrar el de otra.
  await sql`delete from hitos_sala where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
}

export async function registrarHitoProyecto(datos: FormData) {
  const proyectoId = texto(datos.get('proyecto_id'));
  const tipo = texto(datos.get('tipo'));
  if (!proyectoId || !tipo || !['inicio', 'cierre'].includes(tipo)) return;
  const notas = texto(datos.get('notas'));

  if (tipo === 'cierre') {
    // No se cierra lo que no se inició, y cerrar con salas sin entregar es
    // una decisión consciente: nota obligatoria.
    const [estado] = await sql<Array<{ iniciado: boolean; sin_entregar: number }>>`
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

  await sql`
    insert into hitos_proyecto (proyecto_id, tipo, tecnico_id, fecha, notas)
    values (${proyectoId}, ${tipo},
            ${texto(datos.get('tecnico_id'))},
            ${texto(datos.get('fecha')) ?? sql`current_date`},
            ${notas})
    on conflict (proyecto_id, tipo) do nothing`;
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
  revalidatePath('/salas/[id]', 'layout');
}

export async function borrarHitoProyecto(datos: FormData) {
  const proyectoId = texto(datos.get('proyecto_id'));
  const id = texto(datos.get('id'));
  if (!proyectoId || !id) return;
  await sql`
    delete from hitos_proyecto where id = ${id} and proyecto_id = ${proyectoId}`;
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
  revalidatePath('/salas/[id]', 'layout');
}

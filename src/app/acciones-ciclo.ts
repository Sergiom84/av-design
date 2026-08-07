'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';

const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

/**
 * Escritura de los hitos de P1. Un hito no se edita: si se registró mal, se
 * borra y se registra de nuevo, como un movimiento de almacén. El `unique`
 * del esquema garantiza un hito de cada tipo, así que el registro repetido
 * no duplica: no hace nada y el que estaba se queda.
 */
export async function registrarHitoSala(datos: FormData) {
  const salaId = texto(datos.get('sala_id'));
  const tipo = texto(datos.get('tipo'));
  if (!salaId || !tipo) return;
  await sql`
    insert into hitos_sala (sala_id, tipo, tecnico_id, fecha, notas)
    values (${salaId}, ${tipo},
            ${texto(datos.get('tecnico_id'))},
            ${texto(datos.get('fecha')) ?? sql`current_date`},
            ${texto(datos.get('notas'))})
    on conflict (sala_id, tipo) do nothing`;
  revalidatePath(`/salas/${salaId}`, 'layout');
  revalidatePath('/proyectos');
}

export async function borrarHitoSala(datos: FormData) {
  const salaId = texto(datos.get('sala_id'));
  const id = texto(datos.get('id'));
  if (!salaId || !id) return;
  await sql`delete from hitos_sala where id = ${id}`;
  revalidatePath(`/salas/${salaId}`, 'layout');
  revalidatePath('/proyectos');
}

export async function registrarHitoProyecto(datos: FormData) {
  const proyectoId = texto(datos.get('proyecto_id'));
  const tipo = texto(datos.get('tipo'));
  if (!proyectoId || !tipo) return;
  await sql`
    insert into hitos_proyecto (proyecto_id, tipo, tecnico_id, fecha, notas)
    values (${proyectoId}, ${tipo},
            ${texto(datos.get('tecnico_id'))},
            ${texto(datos.get('fecha')) ?? sql`current_date`},
            ${texto(datos.get('notas'))})
    on conflict (proyecto_id, tipo) do nothing`;
  revalidatePath('/proyectos');
  revalidatePath(`/proyectos/${proyectoId}`);
}

export async function borrarHitoProyecto(datos: FormData) {
  const proyectoId = texto(datos.get('proyecto_id'));
  const id = texto(datos.get('id'));
  if (!proyectoId || !id) return;
  await sql`delete from hitos_proyecto where id = ${id}`;
  revalidatePath('/proyectos');
  revalidatePath(`/proyectos/${proyectoId}`);
}

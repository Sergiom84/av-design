'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { sedeId } from '@/lib/sedes';
import { LOCALIZACION_SIN_ASIGNAR } from '@/lib/datos-proyectos';

const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

/**
 * La obra. Nace con la localización "Sin asignar", como en XTEN-AV: así una
 * sala puede entrar al proyecto sin haber decidido todavía en qué edificio o
 * planta acaba. Si el nombre ya existe, se reutiliza el proyecto en vez de
 * fallar delante del usuario.
 */
export async function crearProyecto(datos: FormData) {
  const nombre = texto(datos.get('nombre'));
  if (!nombre) return;
  const sede = await sedeId(texto(datos.get('sede')));

  await sql.begin(async (tx) => {
    const [p] = await tx<Array<{ id: string }>>`
      insert into proyectos (nombre, codigo, sede_id, notas)
      values (${nombre}, ${texto(datos.get('codigo'))}, ${sede},
              ${texto(datos.get('notas'))})
      on conflict (nombre) do update set nombre = excluded.nombre
      returning id`;
    await tx`
      insert into localizaciones (proyecto_id, nombre)
      values (${p.id}, ${LOCALIZACION_SIN_ASIGNAR})
      on conflict (proyecto_id, nombre) do nothing`;
  });

  revalidatePath('/proyectos');
  redirect('/proyectos');
}

export async function crearLocalizacion(datos: FormData) {
  const proyectoId = texto(datos.get('proyecto_id'));
  const nombre = texto(datos.get('nombre'));
  if (!proyectoId || !nombre) return;
  await sql`
    insert into localizaciones (proyecto_id, nombre)
    values (${proyectoId}, ${nombre})
    on conflict (proyecto_id, nombre) do nothing`;
  revalidatePath('/proyectos');
}

export async function renombrarLocalizacion(datos: FormData) {
  const id = texto(datos.get('id'));
  const nombre = texto(datos.get('nombre'));
  if (!id || !nombre) return;
  await sql`update localizaciones set nombre = ${nombre} where id = ${id}`;
  revalidatePath('/proyectos');
  revalidatePath('/salas');
}

/**
 * Borrar la obra no borra sus salas: caen a "sin proyecto" (set null en el
 * esquema) y siguen viviendo en /salas. Lo que sí arrastra son las
 * localizaciones, que sin proyecto no significan nada.
 */
export async function borrarProyecto(datos: FormData) {
  const id = texto(datos.get('id'));
  if (!id) return;
  await sql`delete from proyectos where id = ${id}`;
  revalidatePath('/proyectos');
  revalidatePath('/salas');
  redirect('/proyectos');
}

/** Adopta una sala de antes de la jerarquía (o la mueve de localización). */
export async function asignarSalaALocalizacion(datos: FormData) {
  const salaId = texto(datos.get('sala_id'));
  if (!salaId) return;
  await sql`
    update salas set localizacion_id = ${texto(datos.get('localizacion_id'))}
    where id = ${salaId}`;
  revalidatePath('/proyectos');
  revalidatePath('/salas');
  revalidatePath(`/salas/${salaId}`);
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { LOCALIZACION_SIN_ASIGNAR } from '@/lib/datos-proyectos';

const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

/** Un proyecto cerrado es de solo lectura para su estructura. */
async function proyectoCerrado(proyectoId: string): Promise<boolean> {
  const [f] = await sql<Array<{ cerrado: boolean }>>`
    select exists (select 1 from hitos_proyecto h
                   where h.proyecto_id = ${proyectoId} and h.tipo = 'cierre') as cerrado`;
  return Boolean(f?.cerrado);
}

/**
 * La obra. Nace con la localización "Sin asignar", como en XTEN-AV: así una
 * sala puede entrar al proyecto sin haber decidido todavía en qué edificio o
 * planta acaba. Si el nombre ya existe, se reutiliza el proyecto en vez de
 * fallar delante del usuario.
 */
export async function crearProyecto(datos: FormData) {
  const nombre = texto(datos.get('nombre'));
  if (!nombre) return;

  const proyectoId = await sql.begin(async (tx) => {
    // La sede se resuelve dentro de la transacción: si el alta falla no queda
    // una sede huérfana recién creada.
    const nombreSede = texto(datos.get('sede'));
    const sede = nombreSede
      ? (
          await tx<Array<{ id: string }>>`
            insert into sedes (nombre) values (${nombreSede})
            on conflict (nombre) do update set nombre = excluded.nombre
            returning id`
        )[0].id
      : null;

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

    // Quién inicia la obra es un hecho del proyecto, no de cada sala: se
    // registra una vez aquí, no veinte veces en veinte altas de sala.
    const tecnicoInicio = texto(datos.get('tecnico_inicio_id'));
    if (tecnicoInicio) {
      // Solo un técnico activo con rol de inicio puede firmar el hito; un
      // POST manipulado con otro id no registra nada.
      const [valido] = await tx<Array<{ ok: boolean }>>`
        select exists (
          select 1 from tecnicos t
          join tecnico_roles r on r.tecnico_id = t.id
          where t.id = ${tecnicoInicio} and t.activo and r.rol = 'inicio'
        ) as ok`;
      if (valido?.ok) {
        await tx`
          insert into hitos_proyecto (proyecto_id, tipo, tecnico_id)
          values (${p.id}, 'inicio', ${tecnicoInicio})
          on conflict (proyecto_id, tipo) do nothing`;
      }
    }

    return p.id;
  });

  revalidatePath('/proyectos');
  // A la portada recién creada: lo siguiente es añadir localizaciones y salas.
  redirect(`/proyectos/${proyectoId}`);
}

export async function crearLocalizacion(datos: FormData) {
  const proyectoId = texto(datos.get('proyecto_id'));
  const nombre = texto(datos.get('nombre'));
  if (!proyectoId || !nombre) return;
  if (await proyectoCerrado(proyectoId)) return;
  await sql`
    insert into localizaciones (proyecto_id, nombre)
    values (${proyectoId}, ${nombre})
    on conflict (proyecto_id, nombre) do nothing`;
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
}

export async function renombrarLocalizacion(datos: FormData) {
  const id = texto(datos.get('id'));
  const nombre = texto(datos.get('nombre'));
  if (!id || !nombre) return;
  await sql`update localizaciones set nombre = ${nombre} where id = ${id}`;
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
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

/**
 * Adopta una sala de antes de la jerarquía (o la mueve de localización). La
 * sala arrastra la sede de su nueva obra: una sala de Madrid adoptada por un
 * proyecto de Barcelona no puede seguir diciendo Madrid. Al soltarla del
 * proyecto conserva la sede que tenía, que sigue siendo verdad.
 */
export async function asignarSalaALocalizacion(datos: FormData) {
  const salaId = texto(datos.get('sala_id'));
  if (!salaId) return;
  const localizacionId = texto(datos.get('localizacion_id'));
  if (localizacionId) {
    const [loc] = await sql<Array<{ proyecto_id: string }>>`
      select proyecto_id from localizaciones where id = ${localizacionId}`;
    if (!loc || (await proyectoCerrado(loc.proyecto_id))) return;
    await sql`
      update salas set
        localizacion_id = ${localizacionId},
        sede_id = (select p.sede_id from localizaciones l
                   join proyectos p on p.id = l.proyecto_id
                   where l.id = ${localizacionId})
      where id = ${salaId}`;
  } else {
    await sql`update salas set localizacion_id = null where id = ${salaId}`;
  }
  revalidatePath('/proyectos');
  revalidatePath('/proyectos/[id]', 'page');
  revalidatePath('/salas');
  revalidatePath('/salas/[id]', 'layout');
}

import 'server-only';
import { sql } from '@/lib/db';
import { esUuid } from '@/lib/uuid';

type Fila = Record<string, unknown>;
const s = (v: unknown): string | null => (v == null ? null : String(v));

import { LOCALIZACION_SIN_ASIGNAR } from '@/lib/nombres-proyecto';
export { LOCALIZACION_SIN_ASIGNAR };

export interface ProyectoResumen {
  id: string;
  nombre: string;
  codigo: string | null;
  sede: string | null;
  n_localizaciones: number;
  n_salas: number;
  estado: 'sin_iniciar' | 'en_curso' | 'cerrado';
}

export interface LocalizacionDeProyecto {
  id: string;
  nombre: string;
}

/** Lo que necesita el alta de sala: proyectos con sus localizaciones. */
export interface ProyectoConLocalizaciones {
  id: string;
  nombre: string;
  sede: string | null;
  localizaciones: LocalizacionDeProyecto[];
}

export async function listarProyectos(): Promise<ProyectoResumen[]> {
  try {
    return await listarProyectosConEstado();
  } catch (e) {
    // 42P01: el código llegó antes que la migración de hitos. Se degrada a
    // "sin iniciar" y la página lo avisa; cualquier otro error se propaga.
    if ((e as { code?: string }).code !== '42P01') throw e;
    const filas = await sql<Fila[]>`
      select p.id, p.nombre, p.codigo, sd.nombre as sede,
        (select count(*) from localizaciones l where l.proyecto_id = p.id) as n_localizaciones,
        (select count(*) from salas sa
          join localizaciones l on l.id = sa.localizacion_id
          where l.proyecto_id = p.id) as n_salas
      from proyectos p
      left join sedes sd on sd.id = p.sede_id
      order by p.creado_en desc`;
    return filas.map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      codigo: s(f.codigo),
      sede: s(f.sede),
      n_localizaciones: Number(f.n_localizaciones ?? 0),
      n_salas: Number(f.n_salas ?? 0),
      estado: 'sin_iniciar' as const,
    }));
  }
}

async function listarProyectosConEstado(): Promise<ProyectoResumen[]> {
  const filas = await sql<Fila[]>`
    select p.id, p.nombre, p.codigo, sd.nombre as sede,
      (select count(*) from localizaciones l where l.proyecto_id = p.id) as n_localizaciones,
      (select count(*) from salas sa
        join localizaciones l on l.id = sa.localizacion_id
        where l.proyecto_id = p.id) as n_salas,
      exists (select 1 from hitos_proyecto h
              where h.proyecto_id = p.id and h.tipo = 'inicio') as iniciado,
      exists (select 1 from hitos_proyecto h
              where h.proyecto_id = p.id and h.tipo = 'cierre') as cerrado
    from proyectos p
    left join sedes sd on sd.id = p.sede_id
    order by p.creado_en desc`;
  return filas.map((f) => ({
    id: String(f.id),
    nombre: String(f.nombre),
    codigo: s(f.codigo),
    sede: s(f.sede),
    n_localizaciones: Number(f.n_localizaciones ?? 0),
    n_salas: Number(f.n_salas ?? 0),
    estado: f.cerrado ? 'cerrado' : f.iniciado ? 'en_curso' : 'sin_iniciar',
  }));
}

/** Las salas de antes de la jerarquía de obra. Legado válido, no error. */
export async function contarSalasSinProyecto(): Promise<number> {
  const [f] = await sql<Fila[]>`
    select count(*) as n from salas where localizacion_id is null`;
  return Number(f?.n ?? 0);
}

export interface ProyectoCompleto {
  id: string;
  nombre: string;
  codigo: string | null;
  sede: string | null;
  notas: string | null;
  localizaciones: LocalizacionDeProyecto[];
  salas: import('@/lib/proyecto').SalaDePortada[];
  pedidos: Array<{
    id: string;
    referencia: string | null;
    proveedor: string | null;
    estado: string;
  }>;
}

/** La portada: el proyecto con sus localizaciones, salas y pedidos. */
export async function obtenerProyecto(id: string): Promise<ProyectoCompleto | null> {
  if (!esUuid(id)) return null;
  const [fila] = await sql<Fila[]>`
    select p.id, p.nombre, p.codigo, p.notas, sd.nombre as sede
    from proyectos p
    left join sedes sd on sd.id = p.sede_id
    where p.id = ${id}`;
  if (!fila) return null;

  // El estado de cada sala en la portada es ligero a propósito: medidas,
  // tiradas e hitos, agregables en una consulta. El semáforo completo de
  // `revisarMontaje()` se mira en la ficha; rehacerlo aquí serían catorce
  // consultas por sala. Si la migración de hitos aún no llegó (42P01), los
  // hitos degradan a falso y la página lo avisa.
  const consultaSalas = async (conHitos: boolean) => sql<Fila[]>`
      select s.id, s.nombre, s.codigo, s.localizacion_id,
             s.largo_m, s.ancho_m, s.alto_m,
             (select count(*) from conexiones c where c.sala_id = s.id) as n_conexiones,
             ${
               conHitos
                 ? sql`exists (select 1 from hitos_sala h
                     where h.sala_id = s.id and h.tipo = 'instalacion') as instalada,
             exists (select 1 from hitos_sala h
                     where h.sala_id = s.id and h.tipo = 'entrega') as entregada`
                 : sql`false as instalada, false as entregada`
             }
      from salas s
      join localizaciones l on l.id = s.localizacion_id
      where l.proyecto_id = ${id}
      order by s.nombre`;

  const [localizaciones, salas, pedidos] = await Promise.all([
    sql<Fila[]>`
      select id, nombre from localizaciones where proyecto_id = ${id}`,
    consultaSalas(true).catch((e) => {
      if ((e as { code?: string }).code !== '42P01') throw e;
      return consultaSalas(false);
    }),
    sql<Fila[]>`
      select pe.id, pe.referencia, pe.estado, pr.nombre as proveedor
      from pedidos pe
      left join proveedores pr on pr.id = pe.proveedor_id
      where pe.proyecto_id = ${id}
      order by pe.creado_en desc`,
  ]);

  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    codigo: s(fila.codigo),
    sede: s(fila.sede),
    notas: s(fila.notas),
    localizaciones: localizaciones.map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
    })),
    salas: salas.map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      codigo: s(f.codigo),
      localizacion_id: s(f.localizacion_id),
      largo_m: Number(f.largo_m ?? 0),
      ancho_m: Number(f.ancho_m ?? 0),
      alto_m: Number(f.alto_m ?? 0),
      n_conexiones: Number(f.n_conexiones ?? 0),
      instalada: Boolean(f.instalada),
      entregada: Boolean(f.entregada),
    })),
    pedidos: pedidos.map((f) => ({
      id: String(f.id),
      referencia: s(f.referencia),
      proveedor: s(f.proveedor),
      estado: String(f.estado),
    })),
  };
}

/** Salas sin proyecto, para adoptarlas desde la portada. */
export async function listarSalasSinProyecto(): Promise<
  Array<{ id: string; nombre: string; codigo: string | null; sede: string | null }>
> {
  const filas = await sql<Fila[]>`
    select s.id, s.nombre, s.codigo, sd.nombre as sede
    from salas s
    left join sedes sd on sd.id = s.sede_id
    where s.localizacion_id is null
    order by s.nombre`;
  return filas.map((f) => ({
    id: String(f.id),
    nombre: String(f.nombre),
    codigo: s(f.codigo),
    sede: s(f.sede),
  }));
}

/**
 * Solo para el alta de sala: una obra cerrada no admite salas nuevas, así que
 * no tiene sentido ofrecerla en el desplegable. Si la migración de hitos aún
 * no llegó (42P01), degrada a la lista sin filtrar en vez de romper el alta.
 */
export async function listarProyectosConLocalizaciones(): Promise<
  ProyectoConLocalizaciones[]
> {
  const consulta = async (conCierre: boolean) => sql<Fila[]>`
    select p.id, p.nombre, sd.nombre as sede,
           l.id as localizacion_id, l.nombre as localizacion
    from proyectos p
    left join sedes sd on sd.id = p.sede_id
    left join localizaciones l on l.proyecto_id = p.id
    ${
      conCierre
        ? sql`where not exists (
            select 1 from hitos_proyecto h where h.proyecto_id = p.id and h.tipo = 'cierre'
          )`
        : sql``
    }
    order by p.creado_en desc, l.nombre = ${LOCALIZACION_SIN_ASIGNAR}, l.nombre`;

  const filas = await consulta(true).catch((e) => {
    if ((e as { code?: string }).code !== '42P01') throw e;
    return consulta(false);
  });

  const porId = new Map<string, ProyectoConLocalizaciones>();
  for (const f of filas) {
    const id = String(f.id);
    let p = porId.get(id);
    if (!p) {
      p = { id, nombre: String(f.nombre), sede: s(f.sede), localizaciones: [] };
      porId.set(id, p);
    }
    if (f.localizacion_id) {
      p.localizaciones.push({
        id: String(f.localizacion_id),
        nombre: String(f.localizacion),
      });
    }
  }
  return [...porId.values()];
}

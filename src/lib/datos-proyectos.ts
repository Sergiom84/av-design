import 'server-only';
import { sql } from '@/lib/db';

type Fila = Record<string, unknown>;
const s = (v: unknown): string | null => (v == null ? null : String(v));

/** El nombre de la localización que crea sola cada proyecto al nacer. */
export const LOCALIZACION_SIN_ASIGNAR = 'Sin asignar';

export interface ProyectoResumen {
  id: string;
  nombre: string;
  codigo: string | null;
  sede: string | null;
  n_localizaciones: number;
  n_salas: number;
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
  }));
}

/** Las salas de antes de la jerarquía de obra. Legado válido, no error. */
export async function contarSalasSinProyecto(): Promise<number> {
  const [f] = await sql<Fila[]>`
    select count(*) as n from salas where localizacion_id is null`;
  return Number(f?.n ?? 0);
}

export async function listarProyectosConLocalizaciones(): Promise<
  ProyectoConLocalizaciones[]
> {
  const filas = await sql<Fila[]>`
    select p.id, p.nombre, sd.nombre as sede,
           l.id as localizacion_id, l.nombre as localizacion
    from proyectos p
    left join sedes sd on sd.id = p.sede_id
    left join localizaciones l on l.proyecto_id = p.id
    order by p.creado_en desc, l.nombre = ${LOCALIZACION_SIN_ASIGNAR}, l.nombre`;

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

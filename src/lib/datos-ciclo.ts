import 'server-only';
import { sql } from '@/lib/db';
import type {
  HitoProyecto,
  HitoSala,
  Recepcion,
  Tecnico,
  TecnicoRol,
} from '@/lib/ciclo-vida';

type Fila = Record<string, unknown>;
const s = (v: unknown): string | null => (v == null ? null : String(v));
// postgres.js devuelve `date` como Date de JS; en el dominio la fecha es
// `aaaa-mm-dd`, que es como se apunta en obra.
const fecha = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

/**
 * Lecturas de P1. Degradan con elegancia SOLO si la tabla aún no existe
 * (42P01: un despliegue que llegó antes que su migración). Cualquier otro
 * fallo de base de datos se propaga: presentarlo como "sin hitos" sería
 * mentir.
 */
async function oVacio<T>(consulta: () => Promise<T[]>): Promise<T[]> {
  try {
    return await consulta();
  } catch (e) {
    if ((e as { code?: string }).code === '42P01') return [];
    throw e;
  }
}

/** Para que la página avise cuando el despliegue llegó antes que la migración. */
export async function tablasDeCicloListas(): Promise<boolean> {
  const [f] = await sql<Fila[]>`
    select to_regclass('public.hitos_proyecto') is not null
       and to_regclass('public.hitos_sala') is not null
       and to_regclass('public.tecnicos') is not null as ok`;
  return Boolean(f?.ok);
}

export async function listarTecnicosConRoles(): Promise<{
  tecnicos: Tecnico[];
  roles: TecnicoRol[];
}> {
  const [tecnicos, roles] = await Promise.all([
    oVacio(async () =>
      (await sql<Fila[]>`select id, nombre, activo from tecnicos order by nombre`).map(
        (f) => ({
          id: String(f.id),
          nombre: String(f.nombre),
          activo: Boolean(f.activo),
        }),
      ),
    ),
    oVacio(async () =>
      (await sql<Fila[]>`select tecnico_id, rol from tecnico_roles`).map((f) => ({
        tecnico_id: String(f.tecnico_id),
        rol: String(f.rol) as TecnicoRol['rol'],
      })),
    ),
  ]);
  return { tecnicos, roles };
}

const aHito = (f: Fila) => ({
  id: String(f.id),
  tipo: String(f.tipo),
  tecnico_id: s(f.tecnico_id),
  tecnico: s(f.tecnico),
  fecha: fecha(f.fecha),
  notas: s(f.notas),
});

export async function hitosDeProyecto(proyectoId: string): Promise<HitoProyecto[]> {
  return oVacio(async () =>
    (
      await sql<Fila[]>`
        select h.*, t.nombre as tecnico
        from hitos_proyecto h
        left join tecnicos t on t.id = h.tecnico_id
        where h.proyecto_id = ${proyectoId}
        order by h.fecha, h.creado_en`
    ).map((f) => ({
      ...aHito(f),
      proyecto_id: String(f.proyecto_id),
      tipo: String(f.tipo) as HitoProyecto['tipo'],
    })),
  );
}

export async function hitosDeSala(salaId: string): Promise<HitoSala[]> {
  return oVacio(async () =>
    (
      await sql<Fila[]>`
        select h.*, t.nombre as tecnico
        from hitos_sala h
        left join tecnicos t on t.id = h.tecnico_id
        where h.sala_id = ${salaId}
        order by h.fecha, h.creado_en`
    ).map((f) => ({
      ...aHito(f),
      sala_id: String(f.sala_id),
      tipo: String(f.tipo) as HitoSala['tipo'],
    })),
  );
}

/**
 * Las recepciones que abastecieron a la sala, derivadas de los movimientos de
 * entrada de la recepción de pedidos. Nunca se teclean: son el rastro real.
 *
 * Límite conocido: el movimiento arrastra la sala que originó el pedido, así
 * que un pedido de proyecto repartido entre varias salas solo aparece en la
 * que lo pidió. Atribuir la recepción al reparto real exigiría cruzar las
 * reservas, y eso es otro módulo.
 */
export async function recepcionesDeSala(salaId: string): Promise<Recepcion[]> {
  return oVacio(async () =>
    (
      await sql<Fila[]>`
        select min(m.id::text) as id, m.motivo, m.quien,
               m.creado_en::date as fecha
        from movimientos m
        where m.sala_id = ${salaId}
          and m.tipo = 'entrada'
          and m.motivo like 'Recepción de pedido%'
        group by m.motivo, m.quien, m.creado_en::date
        order by fecha`
    ).map((f) => ({
      pedido_id: String(f.id),
      referencia: s(f.motivo)?.replace('Recepción de pedido · ', '') ?? null,
      fecha: fecha(f.fecha),
      quien: s(f.quien),
    })),
  );
}

/** El ciclo entero de una sala en una llamada: lo que pinta la tarjeta. */
export async function cicloDeSala(salaId: string, proyectoId: string | null) {
  const [hitosSala, hitosProyecto, recepciones] = await Promise.all([
    hitosDeSala(salaId),
    proyectoId ? hitosDeProyecto(proyectoId) : Promise.resolve([]),
    recepcionesDeSala(salaId),
  ]);
  return { hitosSala, hitosProyecto, recepciones };
}

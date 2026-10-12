import 'server-only';
import { sql } from '@/lib/db';
import type { SeguimientoInstalacion } from './ciclo-vida-seguimiento';
import { puntosFinales } from './ciclo-vida-seguimiento';
import { resumirComprasCiclo } from './ciclo-vida-compras';
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
  const [hitosSala, hitosProyecto, recepciones, compras] = await Promise.all([
    hitosDeSala(salaId),
    proyectoId ? hitosDeProyecto(proyectoId) : Promise.resolve([]),
    recepcionesDeSala(salaId),
    comprasDeSala(salaId),
  ]);
  return { hitosSala, hitosProyecto, recepciones, compras };
}

export async function comprasDeSala(salaId: string) {
  const [tabla] = await sql`select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedido_lineas' and column_name = 'comprado_en')
    and exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'movimientos' and column_name = 'pedido_linea_id') as ok`;
  if (!tabla.ok) return resumirComprasCiclo([], false);
  const filas = await sql`select l.id, p.id as pedido_id, p.referencia, a.modelo as articulo, a.unidad,
      l.cantidad, l.cantidad_recibida, l.comprado_en,
      coalesce((select sum(m.cantidad) from movimientos m where m.pedido_linea_id = l.id
        and m.articulo_id = l.articulo_id and m.tipo = 'entrada'), 0) as recibida_trazada
    from pedidos p join pedido_lineas l on l.pedido_id = p.id join articulos a on a.id = l.articulo_id
    where p.sala_id = ${salaId} order by p.creado_en, l.id`;
  return resumirComprasCiclo(filas.map((l) => ({ id: String(l.id), pedido_id: String(l.pedido_id),
    referencia: s(l.referencia) ?? 'Pedido sin referencia', articulo: String(l.articulo), unidad: String(l.unidad),
    cantidad: Number(l.cantidad), cantidad_recibida: Number(l.cantidad_recibida), recibida_trazada: Number(l.recibida_trazada),
    comprado_en: l.comprado_en ? fecha(l.comprado_en) : null })));
}

/** No confundir una migración pendiente con una instalación sin seguimiento. */
export async function seguimientoDeSala(salaId: string): Promise<SeguimientoInstalacion> {
  const [tablas] = await sql`select to_regclass('seguimiento_instalacion_sala') is not null
    and to_regclass('prueba_final_sala') is not null and to_regclass('auditoria_instalacion_sala') is not null as ok`;
  if (!tablas.ok) return { disponible: false, plan: null, prueba: null, auditoria: [] };
  const [planes, pruebas, auditoria] = await Promise.all([
    sql`select * from seguimiento_instalacion_sala where sala_id = ${salaId}`,
    sql`select p.*, t.nombre as tecnico from prueba_final_sala p left join tecnicos t on t.id = p.tecnico_id where p.sala_id = ${salaId}`,
    sql`select * from auditoria_instalacion_sala where sala_id = ${salaId} order by registrado_en desc, id`,
  ]);
  const p = planes[0]; const f = pruebas[0];
  return { disponible: true,
    plan: p ? { fecha_prevista: p.fecha_prevista ? fecha(p.fecha_prevista) : null, instalador_id: s(p.instalador_id), nota: String(p.nota), version: Number(p.version) } : null,
    prueba: f ? { puntos: puntosFinales(f.puntos), version: Number(f.version), fecha: f.fecha ? fecha(f.fecha) : null,
      tecnico_id: s(f.tecnico_id), tecnico: s(f.tecnico) } : null,
    auditoria: auditoria.map((a) => ({ id: String(a.id), operacion: String(a.operacion), autor: String(a.autor),
      registrado_en: a.registrado_en instanceof Date ? a.registrado_en.toISOString() : String(a.registrado_en), datos: a.datos })),
  };
}

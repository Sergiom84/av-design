import 'server-only';
import { sql } from './db';
import { puntosDeUnaVisita, resumirVisita, type ResumenVisita } from './checkin';
import type { EstadoPunto, PuntoRevision, Revision } from './tipos';

/**
 * Lectura y escritura del check-in de sala.
 *
 * Va aparte de `datos.ts` y de `datos-almacen.ts` por lo mismo que los
 * componentes van en carpetas: el check-in es un bloque entero y meterlo en
 * otro módulo lo convertiría en un cajón de sastre.
 *
 * A diferencia del almacén, aquí sí se escribe estado directo: una visita es un
 * papel que se rellena, no un saldo que se deriva. La cautela es otra —una
 * visita cerrada no se toca— y se aplica en las propias consultas con
 * `and not cerrada`, no en la interfaz: un formulario reenviado desde una
 * pestaña vieja no puede reescribir una foto de aquel día.
 */

type Fila = Record<string, unknown>;

const s = (v: unknown): string | null => (v == null ? null : String(v));
const fecha = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : s(v);

function aRevision(f: Fila): Revision {
  return {
    id: String(f.id),
    sala_id: String(f.sala_id),
    sala: s(f.sala),
    nombre: String(f.nombre),
    cerrada: f.cerrada === true,
    quien: s(f.quien),
    notas: s(f.notas),
    creado_en: fecha(f.creado_en) ?? '',
    cerrado_en: fecha(f.cerrado_en),
  };
}

function aPunto(f: Fila): PuntoRevision {
  return {
    id: String(f.id),
    revision_id: String(f.revision_id),
    clave: String(f.clave),
    bloque: String(f.bloque),
    titulo: String(f.titulo),
    estado: String(f.estado) as EstadoPunto,
    valor: s(f.valor),
    notas: s(f.notas),
    orden: Number(f.orden),
  };
}

export interface RevisionConResumen extends Revision {
  resumen: ResumenVisita;
}

/**
 * Todas las visitas, la más reciente primero.
 *
 * El resumen se cuenta en SQL y no trayendo los puntos: la lista enseña
 * cuántos van y cuántas incidencias hay, y con veintitantos puntos por visita
 * traerlos todos para contarlos sería traer la aplicación entera.
 */
export async function listarRevisiones(): Promise<RevisionConResumen[]> {
  const filas = await sql<Fila[]>`
    select r.*, s.nombre as sala,
           count(p.id)                                              as total,
           count(p.id) filter (where p.estado = 'pendiente')         as pendientes,
           count(p.id) filter (where p.estado = 'conforme')          as conformes,
           count(p.id) filter (where p.estado = 'incidencia')        as incidencias,
           count(p.id) filter (where p.estado = 'no_aplica')         as no_aplica
    from revisiones r
    left join salas s on s.id = r.sala_id
    left join revision_puntos p on p.revision_id = r.id
    group by r.id, s.nombre
    order by r.creado_en desc`;

  return filas.map((f) => {
    const total = Number(f.total);
    const pendientes = Number(f.pendientes);
    return {
      ...aRevision(f),
      resumen: {
        total,
        pendientes,
        conformes: Number(f.conformes),
        incidencias: Number(f.incidencias),
        no_aplica: Number(f.no_aplica),
        completa: total > 0 && pendientes === 0,
      },
    };
  });
}

/** Las visitas de una sala, para enchufarlas a su ficha. */
export async function revisionesDeSala(salaId: string): Promise<RevisionConResumen[]> {
  const todas = await listarRevisiones();
  return todas.filter((r) => r.sala_id === salaId);
}

export interface VisitaCompleta {
  revision: Revision;
  puntos: PuntoRevision[];
  resumen: ResumenVisita;
}

export async function obtenerRevision(id: string): Promise<VisitaCompleta | null> {
  const [fila] = await sql<Fila[]>`
    select r.*, s.nombre as sala
    from revisiones r
    left join salas s on s.id = r.sala_id
    where r.id = ${id}`;
  if (!fila) return null;

  const puntos = (
    await sql<Fila[]>`
      select * from revision_puntos where revision_id = ${id} order by orden`
  ).map(aPunto);

  return { revision: aRevision(fila), puntos, resumen: resumirVisita(puntos) };
}

/**
 * Abrir una visita: la cabecera y sus puntos, en la misma transacción.
 *
 * Una visita sin puntos no se puede cerrar nunca (ver `puedeCerrarse`), así que
 * no puede quedar a medias. Devuelve el id para saltar directamente a ella:
 * quien la abre está en la puerta de la sala.
 */
export async function crearRevision(datos: {
  salaId: string;
  nombre?: string | null;
  quien?: string | null;
}): Promise<string | null> {
  return sql.begin(async (tx) => {
    const [sala] = await tx<Array<{ nombre: string }>>`
      select nombre from salas where id = ${datos.salaId}`;
    if (!sala) return null;

    const hoy = new Date().toLocaleDateString('es-ES');
    const [revision] = await tx<Array<{ id: string }>>`
      insert into revisiones (sala_id, nombre, quien)
      values (${datos.salaId},
              ${datos.nombre?.trim() || `Check-in · ${sala.nombre} · ${hoy}`},
              ${datos.quien ?? null})
      returning id`;

    for (const p of puntosDeUnaVisita()) {
      await tx`
        insert into revision_puntos (revision_id, clave, bloque, titulo, orden)
        values (${revision.id}, ${p.clave}, ${p.bloque}, ${p.titulo}, ${p.orden})
        on conflict (revision_id, clave) do nothing`;
    }
    return revision.id;
  });
}

/**
 * Marcar un punto: estado, lo medido y la nota, de una vez.
 *
 * Los tres van juntos a propósito. En la sala se escribe la medida y se pulsa
 * el estado en el mismo gesto; guardarlos por separado obligaría a dos toques
 * y el segundo no se daría.
 *
 * `valor` y `notas` solo se pisan cuando vienen: marcar un punto desde una
 * pantalla que no llevaba el hueco de la medida no puede borrar la medida.
 */
export async function marcarPunto(datos: {
  id: string;
  estado: EstadoPunto;
  valor?: string | null;
  notas?: string | null;
}): Promise<void> {
  if (datos.valor === undefined && datos.notas === undefined) {
    await sql`
      update revision_puntos p set estado = ${datos.estado}::estado_punto
      from revisiones r
      where p.id = ${datos.id} and r.id = p.revision_id and not r.cerrada`;
    return;
  }

  await sql`
    update revision_puntos p set
      estado = ${datos.estado}::estado_punto,
      valor  = ${datos.valor === undefined ? null : datos.valor},
      notas  = ${datos.notas === undefined ? null : datos.notas}
    from revisiones r
    where p.id = ${datos.id} and r.id = p.revision_id and not r.cerrada`;
}

/** Devolver un punto a «sin mirar»: se marcó de carrerilla y no era. */
export async function desmarcarPunto(id: string): Promise<void> {
  await sql`
    update revision_puntos p set estado = 'pendiente'
    from revisiones r
    where p.id = ${id} and r.id = p.revision_id and not r.cerrada`;
}

/** La cabecera: quién fue y qué pasó en general. */
export async function guardarCabecera(datos: {
  id: string;
  nombre?: string | null;
  quien?: string | null;
  notas?: string | null;
}): Promise<void> {
  await sql`
    update revisiones set
      nombre = coalesce(${datos.nombre ?? null}, nombre),
      quien  = ${datos.quien ?? null},
      notas  = ${datos.notas ?? null}
    where id = ${datos.id} and not cerrada`;
}

/**
 * Cerrar la visita. La condición la decide `puedeCerrarse()`, que es lógica
 * pura y está probada, pero el `not exists` de aquí es el que manda: entre
 * pintar la pantalla y pulsar el botón cabe otro que haya despendientado un
 * punto. Devuelve si se cerró de verdad.
 */
export async function cerrarRevision(id: string): Promise<boolean> {
  const filas = await sql<Fila[]>`
    update revisiones set cerrada = true, cerrado_en = now()
    where id = ${id}
      and not cerrada
      and exists (select 1 from revision_puntos where revision_id = ${id})
      and not exists (
        select 1 from revision_puntos
        where revision_id = ${id} and estado = 'pendiente')
    returning id`;
  return filas.length > 0;
}

export async function borrarRevision(id: string): Promise<void> {
  // Los puntos caen solos: `revision_puntos` va con `on delete cascade`.
  await sql`delete from revisiones where id = ${id}`;
}

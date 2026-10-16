import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { conLecturaConsistente, sql } from '../db';
import { listarArticulos, obtenerArticulo, obtenerParametros, obtenerSala } from '../datos';
import { obtenerDatosPlanoSala } from '../datos-plano';
import { disponibilidadDeArticulos, reservasDeSala } from '../datos-almacen';
import { calcularConexion, type ResultadoCable } from '../calculo-cable';
import { construirTablaCables } from '../cable-schedule';
import type { SalaExportada, SnapshotExportacion } from './modelo';
import { materialBomDeSala } from '../datos-material-bom';
import { referenciaRevisionDiseno } from '../revisiones-diseno-repositorio';
import { obtenerAnotacionesSala } from '../datos-anotaciones';

/** Error de alcance que puede mostrarse sin detalles internos de la base. */
export class ErrorSeleccionDocumentos extends Error {}

export async function cargarSnapshot(salaIds: string[], proyectoId?: string): Promise<SnapshotExportacion> {
  if (salaIds.length !== 1 && !proyectoId) {
    throw new ErrorSeleccionDocumentos('Selecciona una obra para exportar varias salas.');
  }
  return conLecturaConsistente(() => cargarSnapshotEnLectura(salaIds, proyectoId, true));
}

/**
 * Lector interno para informes cuyo ámbito ya ha resuelto el servidor. Debe
 * ejecutarse dentro de conLecturaConsistente, sin abrir una segunda transacción.
 * Una selección de varias obras no se atribuye a una de ellas. El tercer
 * argumento conserva exclusivamente la inferencia histórica de la API E1.
 */
export async function cargarSnapshotEnLectura(
  salaIds: string[], proyectoId?: string, inferirProyectoUnico = false,
): Promise<SnapshotExportacion> {
  const completas = [];
  for (const id of salaIds) {
    const sala = await obtenerSala(id);
    const plano = await obtenerDatosPlanoSala(id);
    if (!sala || !plano) throw new ErrorSeleccionDocumentos('Una sala seleccionada ya no existe.');
    if (proyectoId && sala.sala.proyecto_id !== proyectoId) {
      throw new ErrorSeleccionDocumentos('La selección contiene una sala ajena a esta obra.');
    }
    const materialBom = await materialBomDeSala(id);
    const revisionDiseno = await referenciaRevisionDiseno(id, sql);
    const anotacionesDiseno = await obtenerAnotacionesSala(id);
    completas.push({ ...sala, puertas: plano.puertas, materialBom, revisionDiseno, anotacionesDiseno });
  }
  const proyectoReal = proyectoId ?? (inferirProyectoUnico && completas.length === 1 ? completas[0].sala.proyecto_id : null);
  const [filaProyecto] = proyectoReal ? await sql<Array<{id:string;nombre:string;codigo:string|null}>>`
    select id, nombre, codigo from proyectos where id = ${proyectoReal}` : [];
  if (proyectoId && !filaProyecto) throw new ErrorSeleccionDocumentos('La obra seleccionada ya no existe.');
  const articulos = await listarArticulos();
  const ids = [...new Set(completas.flatMap(s => [
    ...s.equipos.map(e => e.articulo_id), ...s.conexiones.map(c => c.articulo_cable_id),
    ...s.materialBom.map(m => m.articulo_id),
  ]).filter((id): id is string => Boolean(id)))];
  for (const id of ids) {
    if (!articulos.some(a => a.id === id)) {
      const a = await obtenerArticulo(id);
      if (a) articulos.push(a);
    }
  }
  // Solo referencias usadas; el navegador recibe únicamente estado y enlaces.
  const usados = articulos.filter(a => ids.includes(a.id));
  const parametros = await obtenerParametros();
  const disponibilidad = [...(await disponibilidadDeArticulos(ids)).values()];
  const porId = new Map(usados.map(a => [a.id, a]));
  const salas: SalaExportada[] = [];
  for (const completa of completas) {
    const { sala, equipos, conexiones, puertos, tomas } = completa;
    const equiposPorId = new Map(equipos.map(e => [e.id, e]));
    const resultadosCable = !sala.largo_m || !sala.ancho_m || !sala.alto_m ? [] : conexiones
      .map(c => calcularConexion(c, sala, equiposPorId, porId, parametros))
      .filter((r): r is ResultadoCable => r !== null);
    const reservas = (await reservasDeSala(sala.id)).filter(r => r.estado === 'activa')
      .map(r => ({ articulo_id: r.articulo_id, cantidad: r.cantidad }));
    const posiciones = await sql<Array<{id:string;esquema_x:number;esquema_y:number}>>`
      select id, esquema_x, esquema_y from sala_equipos where sala_id = ${sala.id}
      and esquema_x is not null and esquema_y is not null`;
    salas.push({ ...completa, resultadosCable, reservas,
      posicionesEsquema: Object.fromEntries(posiciones.map(e => [e.id, {x:Number(e.esquema_x),y:Number(e.esquema_y)}])),
      filasCable: construirTablaCables({ conexiones, equipos: equiposPorId,
        tomas: new Map(tomas.map(t => [t.id,t])), puertos: new Map(puertos.map(p => [p.id,p])),
        articulos: porId, resultados: new Map(resultadosCable.map(r => [r.conexion_id,r])) }),
    });
  }
  const datos = { proyecto: filaProyecto ?? null, salas, articulos: usados, parametros, disponibilidad };
  const hash = createHash('sha256').update(JSON.stringify(datos)).digest('hex').slice(0, 12);
  return { ...datos, creadoEn: new Date().toISOString(), revision: `DOC-${hash}-${randomUUID().slice(0, 8)}` };
}

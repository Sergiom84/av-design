import type postgres from 'postgres';
import { createHash, randomUUID } from 'node:crypto';
import { ErrorImportacion, type EntradaImportacion, type InformeFilaImportacion, type InformeReversion, type LoteImportacion, type PreviewImportacion, type SeleccionFila, type SqlImportacion, type DestinoImportacion } from './modelo';
import { leerArchivoImportacion, numeroImportado } from './parser';
import { claveLiteral } from './parser';
import { revisarFilas, validarEntrada, type ArticuloParaImportacion } from './revision';
import { elegirCosteVigente, fechaLimiteVigencia, type OfertaParaElegir } from './coste';

type Tx = postgres.TransactionSql<Record<string, unknown>>;
type JsonFila = Record<string, unknown>;
const TABLAS = ['articulos', 'precios', 'sala_material_bom', 'proveedores'] as const;
type Tabla = typeof TABLAS[number];
interface Cambio { id: string; orden: number; tabla: Tabla; fila_id: string; antes: JsonFila | null; despues: JsonFila; estado: string }

async function articulosParaRevision(sql: SqlImportacion): Promise<ArticuloParaImportacion[]> {
  const filas = await sql`select id, referencia, referencia_fabricante, marca, modelo, categoria, tipo,
    unidad, activo, revision, coste, coste_orientativo from articulos order by id`;
  return filas.map(f => ({ ...f, revision: Number(f.revision), coste: f.coste == null ? null : Number(f.coste) })) as ArticuloParaImportacion[];
}

export async function previsualizarImportacion(sql: SqlImportacion, entrada: EntradaImportacion): Promise<PreviewImportacion> {
  validarEntrada(entrada.destino, entrada.origen, entrada.salaId);
  const archivo = await leerArchivoImportacion(entrada.archivo);
  if (entrada.destino === 'bom') await comprobarSala(sql, entrada.salaId!, false);
  const articulos = await articulosParaRevision(sql);
  const filas = revisarFilas(entrada.destino, archivo.filas, articulos);
  let parametrosPrecio: PreviewImportacion['parametrosPrecio'];
  if (entrada.destino === 'precios') {
    const [parametros] = await sql`select current_date::text as hoy,
      coalesce((select max(valor) from parametros where clave = 'vigencia_precio_meses'), 18)::int as meses,
      coalesce((select max(valor) from parametros where clave = 'tipo_cambio_usd_eur'), 1) as cambio`;
    parametrosPrecio = { fechaCalculo: String(parametros.hoy), vigenciaMeses: Number(parametros.meses), tipoCambioUsdEur: Number(parametros.cambio) };
    const presupuestos = [...new Set(filas.map(f => f.datos.presupuesto).filter(Boolean))];
    const existentes = presupuestos.length ? await sql`select articulo_id, presupuesto from precios where presupuesto in ${sql(presupuestos)}` : [];
    for (const fila of filas) {
      if (fila.candidatos.length === 1 && existentes.some(p => p.articulo_id === fila.candidatos[0].id && p.presupuesto === fila.datos.presupuesto)) {
        fila.errores.push('Ya existe esta oferta para el artículo; usa una referencia de presupuesto nueva. Se conserva la anterior.');
        fila.estado = 'rechazada';
      }
    }
    const ids = [...new Set(filas.flatMap(f => f.candidatos.map(c => c.id)))];
    const limite = fechaLimiteVigencia(parametrosPrecio.fechaCalculo, parametrosPrecio.vigenciaMeses);
    for (const fila of filas.filter(f => !f.errores.length)) {
      const d = fila.datos;
      const unitario = Math.round(numeroImportado(d.precio_compra)! / numeroImportado(d.unidades_por_compra)! * 10000) / 10000;
      const euros = unitario * (d.moneda === 'EUR' ? 1 : parametrosPrecio.tipoCambioUsdEur);
      fila.avisos.push(`Precio normalizado: ${euros.toFixed(4)} EUR/${d.unidad}. Oferta ${d.fecha >= limite ? 'vigente' : 'caducada'} al ${parametrosPrecio.fechaCalculo}; límite de vigencia ${limite}.`);
    }
    if (ids.length) {
      const ofertas = await sql`select articulo_id, precio, moneda, origen, fecha from precios where articulo_id in ${sql(ids)}`;
      for (const fila of filas.filter(f => !f.errores.length && f.candidatos.length === 1)) {
        const id = fila.candidatos[0].id;
        const a = articulos.find(a => a.id === id)!;
        const anteriores: OfertaParaElegir[] = ofertas.filter(p => p.articulo_id === id).map(p => ({ precio: Number(p.precio),
          moneda: String(p.moneda), origen: String(p.origen), fecha: p.fecha instanceof Date ? p.fecha.toISOString().slice(0, 10) : p.fecha ? String(p.fecha) : null }));
        const d = fila.datos;
        const propuesta = elegirCosteVigente([...anteriores, { precio: Math.round(numeroImportado(d.precio_compra)! / numeroImportado(d.unidades_por_compra)! * 10000) / 10000,
          moneda: d.moneda, origen: d.origen, fecha: d.fecha }], { hoy: String(parametros.hoy), vigenciaMeses: Number(parametros.meses), usdEur: Number(parametros.cambio) });
        const coste = propuesta?.coste ?? a.coste; const orientativo = propuesta?.orientativo ?? a.coste_orientativo;
        fila.avisos.push(`Coste elegido al añadir esta fila: ${coste == null ? 'ausente' : `${coste} EUR${orientativo ? ' orientativo' : ' final'}`}${coste === a.coste && orientativo === a.coste_orientativo ? ' (no cambia)' : ' (cambia)'}. Vigencia ${parametros.meses} meses; cambio USD/EUR ${parametros.cambio}.`);
      }
    }
  }
  const { filas: _filas, ...metadata } = archivo;
  void _filas;
  const datos = { destino: entrada.destino, salaId: entrada.salaId ?? null, origen: entrada.origen.trim(), archivo: metadata, filas,
    ...(parametrosPrecio ? { parametrosPrecio } : {}) };
  return { ...datos, previewHash: createHash('sha256').update(JSON.stringify(datos)).digest('hex'),
    resumen: { filas: filas.length, altas: filas.filter(f => f.estado === 'alta').length,
      coincidencias: filas.filter(f => f.estado === 'coincidencia').length,
      ambiguas: filas.filter(f => f.estado === 'ambigua').length,
      rechazadas: filas.filter(f => f.estado === 'rechazada').length,
      noEncontradas: filas.filter(f => f.estado === 'no_encontrada').length } };
}

export interface OpcionesConfirmacion { previewHash?: string; fallarDespuesDeFila?: number }
export async function confirmarImportacion(
  sql: SqlImportacion, entrada: EntradaImportacion, seleccion: SeleccionFila[], usuarioId: string,
  opciones: OpcionesConfirmacion = {},
): Promise<LoteImportacion> {
  comprobarUsuario(usuarioId);
  if (!Array.isArray(seleccion) || !seleccion.length || seleccion.length > 500) throw new ErrorImportacion('Elige al menos una fila, máximo 500.');
  if (new Set(seleccion.map(f => f.fila)).size !== seleccion.length || seleccion.some(f => !Number.isInteger(f.fila))) throw new ErrorImportacion('La selección contiene filas repetidas o inválidas.');
  return sql.begin(async tx => {
    // Un solo orden de bloqueo en confirmaciones y reversión. Sala antes de sus
    // hijos; catálogo en orden estable. Se revalida la revisión con el lock cogido.
    if (entrada.destino === 'bom') await comprobarSala(tx as unknown as SqlImportacion, entrada.salaId!, true);
    if (entrada.destino === 'precios') await tx`select clave from parametros
      where clave in ('vigencia_precio_meses', 'tipo_cambio_usd_eur') order by clave for share`;
    if (entrada.destino === 'catalogo') await tx`lock table articulos in share row exclusive mode`;
    await tx`select id from articulos order by id for update`;
    const preview = await previsualizarImportacion(tx as unknown as SqlImportacion, entrada);
    if (opciones.previewHash && opciones.previewHash !== preview.previewHash) throw new ErrorImportacion('El archivo o el catálogo cambió desde la revisión. Vuelve a previsualizar.', 409);
    const porFila = new Map(preview.filas.map(f => [f.fila, f]));
    const articuloIds = new Set<string>();
    const clavesSeleccionadas = new Set<string>();
    for (const elegida of seleccion) {
      const fila = porFila.get(elegida.fila);
      if (!fila) throw new ErrorImportacion('La selección contiene una fila inexistente.');
      if (fila.errores.length) throw new ErrorImportacion(`Fila ${fila.fila}: ${fila.errores.join(' ')}`);
      if (elegida.crear) {
        if (entrada.destino !== 'catalogo' || fila.candidatos.length || elegida.articuloId) throw new ErrorImportacion(`Fila ${fila.fila}: el alta sólo sirve para una referencia nueva de catálogo.`);
        const clave = `${claveLiteral(fila.datos.marca)}|${claveLiteral(fila.datos.modelo)}|${claveLiteral(fila.datos.categoria)}`;
        if (clavesSeleccionadas.has(clave)) throw new ErrorImportacion('Dos filas seleccionadas crearían la misma referencia. Elige una.');
        clavesSeleccionadas.add(clave);
      } else if (!elegida.articuloId) throw new ErrorImportacion(`Fila ${fila.fila}: elige explícitamente la referencia exacta.`);
      else {
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(elegida.articuloId)) throw new ErrorImportacion('Identificador de artículo inválido.');
        const [a] = await tx`select id, unidad, activo, revision from articulos where id = ${elegida.articuloId}`;
        if (!a || !a.activo || a.unidad !== fila.datos.unidad) throw new ErrorImportacion(`Fila ${fila.fila}: referencia inexistente, desactivada o unidad incompatible.`);
        if (elegida.revisionArticulo !== undefined && Number(a.revision) !== elegida.revisionArticulo) throw new ErrorImportacion(`Fila ${fila.fila}: referencia modificada desde la revisión.`, 409);
        if (fila.candidatos.length && !fila.candidatos.some(c => c.id === elegida.articuloId)) throw new ErrorImportacion(`Fila ${fila.fila}: elige uno de los candidatos exactos de la revisión.`);
        if (entrada.destino !== 'precios' && articuloIds.has(elegida.articuloId)) throw new ErrorImportacion('Dos filas seleccionadas corresponden a la misma referencia. Elige una.');
        if (entrada.destino === 'precios') {
          const clave = `${elegida.articuloId}|${fila.datos.presupuesto}`;
          if (clavesSeleccionadas.has(clave)) throw new ErrorImportacion('Dos filas seleccionadas corresponden a la misma oferta. Elige una.');
          clavesSeleccionadas.add(clave);
        }
        articuloIds.add(elegida.articuloId);
      }
    }
    const id = randomUUID();
    await tx`insert into importacion_lotes (id, destino, sala_id, usuario_id, origen, archivo_nombre, archivo_sha256, archivo, filas, informe)
      values (${id}, ${entrada.destino}, ${entrada.salaId ?? null}, ${usuarioId}, ${entrada.origen.trim()},
      ${preview.archivo.nombre}, ${preview.archivo.sha256}, ${Buffer.from(entrada.archivo.bytes)}, ${tx.json(preview.filas as unknown as postgres.JSONValue)}, ${tx.json([])})`;
    const informe: InformeFilaImportacion[] = preview.filas.map(f => ({ fila: f.fila,
      estado: f.errores.length ? 'rechazada' : 'omitida', articuloId: null,
      mensaje: f.errores.join(' ') || 'No seleccionada.' }));
    let orden = 0; let aplicadas = 0;
    const costesAntes = new Map<string, JsonFila>();
    for (const elegida of seleccion) {
      const fila = porFila.get(elegida.fila)!; const d = fila.datos;
      let articuloId = elegida.articuloId ?? null;
      if (entrada.destino === 'catalogo') {
        const antes = articuloId ? await fotoFila(tx, 'articulos', articuloId) : null;
        if (elegida.crear) {
          const [a] = await tx`insert into articulos (referencia, tipo, categoria, marca, modelo, unidad, descripcion, observaciones, fuente)
            values (${d.referencia || null}, ${d.tipo}::tipo_articulo, ${d.categoria}, ${d.marca || null}, ${d.modelo},
              ${d.unidad}::unidad_medida, ${d.descripcion || null}, ${d.observaciones || null}, 'app') returning id`;
          articuloId = String(a.id);
        } else {
          const cambios: Record<string, unknown> = { fuente: 'app' };
          if ('descripcion' in d) cambios.descripcion = d.descripcion || null;
          if ('observaciones' in d) cambios.observaciones = d.observaciones || null;
          await tx`update articulos set ${tx(cambios)} where id = ${articuloId!}`;
        }
        await registrarCambio(tx, id, orden++, 'articulos', articuloId!, antes);
      } else if (entrada.destino === 'bom') {
        const [material] = await tx`insert into sala_material_bom (sala_id, articulo_id, cantidad, unidad, nota, lote_id)
          values (${entrada.salaId!}, ${articuloId!}, ${numeroImportado(d.cantidad)!}, ${d.unidad}::unidad_medida,
          ${d.nota || null}, ${id}) returning id`;
        await registrarCambio(tx, id, orden++, 'sala_material_bom', String(material.id), null);
      } else {
        if (!costesAntes.has(articuloId!)) costesAntes.set(articuloId!, (await fotoFila(tx, 'articulos', articuloId!))!);
        const [proveedor] = await tx`insert into proveedores (nombre) values (${d.proveedor}) on conflict (nombre) do nothing returning id`;
        if (proveedor) await registrarCambio(tx, id, orden++, 'proveedores', String(proveedor.id), null);
        const existente = proveedor ? [proveedor] : await tx`select id from proveedores where nombre = ${d.proveedor}`;
        const unidades = numeroImportado(d.unidades_por_compra)!;
        const precio = numeroImportado(d.precio_compra)!;
        const [oferta] = await tx`insert into precios (articulo_id, proveedor_id, presupuesto, fecha, referencia,
          precio, precio_compra, unidades_por_compra, cantidad, notas, origen, moneda, fuente, unidad_compra, lote_id)
          values (${articuloId!}, ${existente[0].id}, ${d.presupuesto}, ${d.fecha}::date, ${d.referencia || null},
          ${Math.round(precio / unidades * 10000) / 10000}, ${precio}, ${unidades}, ${numeroImportado(d.cantidad)},
          ${d.notas || null}, ${d.origen}, ${d.moneda}, 'app', ${d.unidad_compra}, ${id}) returning id`;
        await registrarCambio(tx, id, orden++, 'precios', String(oferta.id), null);
      }
      const registro = informe.find(f => f.fila === fila.fila)!;
      registro.estado = entrada.destino === 'catalogo' && !elegida.crear ? 'cambio' : 'alta';
      registro.articuloId = articuloId;
      registro.mensaje = entrada.destino === 'bom' ? 'Partida añadida a la BOM sin posición ni conexiones.' : entrada.destino === 'precios' ? 'Oferta nueva guardada; anteriores conservadas.' : elegida.crear ? 'Referencia nueva de catálogo.' : 'Campos descriptivos revisados; fuente app.';
      aplicadas++;
      // Hook inyectable únicamente desde caller local, nunca se lee del archivo.
      if (opciones.fallarDespuesDeFila === aplicadas) throw new ErrorImportacion('Fallo sintético a mitad del lote.');
    }
    if (entrada.destino === 'precios') {
      await recalcularCosteElegido(tx, [...costesAntes.keys()]);
      for (const [articuloId, antes] of costesAntes) {
        const despues = (await fotoFila(tx, 'articulos', articuloId))!;
        await registrarCambio(tx, id, orden++, 'articulos', articuloId, antes);
        const texto = ` Coste elegido: ${antes.coste == null ? 'ausente' : `${antes.coste} EUR`} → ${despues.coste == null ? 'ausente' : `${despues.coste} EUR${despues.coste_orientativo ? ' orientativo' : ' final'}`}.`;
        for (const f of informe.filter(f => f.articuloId === articuloId && f.estado === 'alta')) f.mensaje += texto;
      }
    }
    await tx`update importacion_lotes set informe = ${tx.json(informe as unknown as postgres.JSONValue)} where id = ${id}`;
    return (await obtenerLote(tx as unknown as SqlImportacion, id, usuarioId))!;
  }) as Promise<LoteImportacion>;
}

/** Mismo selector del seed: final vigente antes que orientativo, EUR/USD parametrizados. */
export async function recalcularCosteElegido(tx: Tx, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await tx`with cambio as (select coalesce(max(valor), 1) as usd_eur from parametros where clave = 'tipo_cambio_usd_eur'),
    vigencia as (select coalesce(max(valor), 18)::int as meses from parametros where clave = 'vigencia_precio_meses'),
    en_euros as (select p.articulo_id, p.origen, p.precio * case when p.moneda = 'EUR' then 1 else c.usd_eur end as precio_eur
      from precios p, cambio c, vigencia v where p.articulo_id in ${tx(ids)}
      and (p.fecha is null or p.fecha >= current_date - make_interval(months => v.meses))),
    mejor as (select articulo_id, min(precio_eur) filter (where origen = 'final') as final,
      min(precio_eur) filter (where origen = 'orientativo') as orientativo from en_euros group by articulo_id)
    update articulos a set coste = round(coalesce(m.final, m.orientativo), 4), coste_orientativo = (m.final is null)
    from mejor m where m.articulo_id = a.id and coalesce(m.final, m.orientativo) is not null`;
}

export async function revertirLote(sql: SqlImportacion, id: string, usuarioId: string): Promise<LoteImportacion> {
  comprobarUsuario(usuarioId);
  comprobarLoteId(id);
  return sql.begin(async tx => {
    const [lote] = await tx`select * from importacion_lotes where id = ${id} and usuario_id = ${usuarioId} for update`;
    if (!lote) throw new ErrorImportacion('Lote no encontrado.', 404);
    if (lote.estado !== 'confirmado') throw new ErrorImportacion('Este lote ya tiene una reversión registrada.', 409);
    if (lote.destino === 'bom') await comprobarSala(tx as unknown as SqlImportacion, String(lote.sala_id), true);
    await tx`select id from articulos order by id for update`;
    const cambios = await tx<Cambio[]>`select * from importacion_cambios where lote_id = ${id} order by orden desc for update`;
    const reversion: InformeReversion[] = [];
    const costesConservados = new Set<string>();
    for (const cambio of cambios) {
      if (!TABLAS.includes(cambio.tabla)) throw new ErrorImportacion('Tabla de cambio no permitida.');
      const actual = await fotoFila(tx, cambio.tabla, cambio.fila_id, true);
      let motivo: string | null = null;
      if (!actual || !jsonIgual(actual, cambio.despues)) motivo = 'La fila fue modificada o retirada después del lote; se conserva el trabajo posterior.';
      if (cambio.tabla === 'precios' && actual && costesConservados.has(String(actual.articulo_id))) motivo = 'La referencia tiene cambios posteriores de coste/catálogo; se conserva también la oferta para no invalidar esa decisión.';
      if (!motivo && cambio.antes === null && (cambio.tabla === 'articulos' || cambio.tabla === 'proveedores') && await tieneDependencias(tx, cambio.tabla, cambio.fila_id)) motivo = 'La referencia o proveedor ya se utiliza en otro trabajo; no se borra por cascada.';
      if (!motivo && cambio.tabla === 'sala_material_bom' && actual && await materialComprometidoDespues(tx, actual, lote)) motivo = 'Hay reservas, pedidos, carga o movimientos posteriores para este material; se conserva la necesidad que los originó.';
      if (motivo) {
        if (cambio.tabla === 'articulos' && lote.destino === 'precios') costesConservados.add(cambio.fila_id);
        await tx`update importacion_cambios set estado = 'conservado', motivo = ${motivo} where id = ${cambio.id}`;
        reversion.push({ cambioId: cambio.id, tabla: cambio.tabla, filaId: cambio.fila_id, estado: 'conservado', motivo });
        continue;
      }
      if (cambio.antes === null) await tx.unsafe(`delete from "${cambio.tabla}" where id = $1`, [cambio.fila_id]);
      else if (cambio.tabla === 'articulos') {
        const a = cambio.antes;
        await tx`update articulos set descripcion = ${a.descripcion as string | null}, observaciones = ${a.observaciones as string | null},
          fuente = ${a.fuente as string}, coste = ${a.coste as number | null}, coste_orientativo = ${a.coste_orientativo as boolean}
          where id = ${cambio.fila_id}`;
      } else throw new ErrorImportacion('Reversión de modificación no admitida.');
      const motivoOk = cambio.antes === null ? 'Alta retirada sin dependencias ni ediciones posteriores.' : 'Valores anteriores restaurados; la revisión conserva el rastro del cambio.';
      await tx`update importacion_cambios set estado = 'revertido', motivo = ${motivoOk} where id = ${cambio.id}`;
      reversion.push({ cambioId: cambio.id, tabla: cambio.tabla, filaId: cambio.fila_id, estado: 'revertido', motivo: motivoOk });
    }
    const estado = reversion.some(c => c.estado === 'conservado') ? 'reversion_parcial' : 'revertido';
    await tx`update importacion_lotes set estado = ${estado}, reversion = ${tx.json(reversion as unknown as postgres.JSONValue)}, revertido_en = now() where id = ${id}`;
    return (await obtenerLote(tx as unknown as SqlImportacion, id, usuarioId))!;
  }) as Promise<LoteImportacion>;
}

export async function listarLotes(sql: SqlImportacion, usuarioId: string, destino?: DestinoImportacion): Promise<LoteImportacion[]> {
  comprobarUsuario(usuarioId);
  const filas = await sql`select id, destino, sala_id, usuario_id, origen, archivo_nombre, archivo_sha256,
    estado, creado_en, revertido_en, informe, reversion, octet_length(archivo) as archivo_bytes from importacion_lotes
    where usuario_id = ${usuarioId} and (${destino ?? null}::text is null or destino = ${destino ?? null}) order by creado_en desc limit 30`;
  return filas.map(aLote);
}
export async function obtenerLote(sql: SqlImportacion, id: string, usuarioId: string): Promise<LoteImportacion | null> {
  comprobarUsuario(usuarioId);
  comprobarLoteId(id);
  const [fila] = await sql`select id, destino, sala_id, usuario_id, origen, archivo_nombre, archivo_sha256,
    estado, creado_en, revertido_en, informe, reversion, octet_length(archivo) as archivo_bytes
    from importacion_lotes where id = ${id} and usuario_id = ${usuarioId}`;
  return fila ? aLote(fila) : null;
}
export async function obtenerArchivoLote(sql: SqlImportacion, id: string, usuarioId: string): Promise<{ nombre: string; bytes: Uint8Array } | null> {
  comprobarUsuario(usuarioId);
  comprobarLoteId(id);
  const [fila] = await sql`select archivo_nombre, archivo, archivo_sha256 from importacion_lotes where id = ${id} and usuario_id = ${usuarioId}`;
  if (!fila) return null;
  const bytes = new Uint8Array(fila.archivo as Uint8Array);
  if (createHash('sha256').update(bytes).digest('hex') !== fila.archivo_sha256) throw new ErrorImportacion('El hash del archivo almacenado no coincide.', 500);
  return { nombre: String(fila.archivo_nombre), bytes };
}

async function registrarCambio(tx: Tx, loteId: string, orden: number, tabla: Tabla, id: string, antes: JsonFila | null): Promise<void> {
  const despues = await fotoFila(tx, tabla, id);
  if (!despues) throw new ErrorImportacion('No se pudo verificar una fila escrita.');
  await tx`insert into importacion_cambios (lote_id, orden, tabla, fila_id, antes, despues)
    values (${loteId}, ${orden}, ${tabla}, ${id}, ${antes == null ? null : tx.json(antes as postgres.JSONValue)}, ${tx.json(despues as postgres.JSONValue)})`;
}
async function fotoFila(tx: Tx, tabla: Tabla, id: string, bloquear = false): Promise<JsonFila | null> {
  const [fila] = await tx.unsafe(`select to_jsonb(t) as fila from "${tabla}" t where id = $1${bloquear ? ' for update' : ''}`, [id]);
  return fila ? fila.fila as JsonFila : null;
}
async function comprobarSala(sql: SqlImportacion, salaId: string, bloquear: boolean): Promise<void> {
  const [sala] = bloquear ? await sql`select id, localizacion_id from salas where id = ${salaId} for update` : await sql`select id, localizacion_id from salas where id = ${salaId}`;
  if (!sala) throw new ErrorImportacion('La sala no existe.', 404);
  const [cierre] = await sql`select exists (select 1 from hitos_proyecto h join localizaciones l on l.proyecto_id = h.proyecto_id
    where l.id = ${sala.localizacion_id} and h.tipo = 'cierre') as cerrado`;
  if (cierre.cerrado) throw new ErrorImportacion('La obra está cerrada; su BOM es de sólo lectura.', 409);
}
async function tieneDependencias(tx: Tx, destino: 'articulos' | 'proveedores', filaId: string): Promise<boolean> {
  const claves = await tx`select c.conrelid::regclass::text as tabla, a.attname as columna
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = ${destino}::regclass`;
  for (const clave of claves) {
    const tabla = String(clave.tabla); const columna = String(clave.columna);
    if (!/^[a-z_]+$/u.test(tabla) || !/^[a-z_]+$/u.test(columna)) throw new ErrorImportacion('Dependencia de catálogo no reconocida.');
    const [fila] = await tx.unsafe(`select exists (select 1 from "${tabla}" where "${columna}" = $1) as usado`, [filaId]);
    if (fila.usado) return true;
  }
  return false;
}
async function materialComprometidoDespues(tx: Tx, material: JsonFila, lote: Record<string, unknown>): Promise<boolean> {
  const [fila] = await tx`select (
    exists (select 1 from reservas r where r.sala_id = ${String(material.sala_id)} and r.articulo_id = ${String(material.articulo_id)}
      and r.estado <> 'liberada' and greatest(r.creado_en, r.actualizado_en) >= ${lote.creado_en as Date})
    or exists (select 1 from pedido_lineas pl join pedidos p on p.id = pl.pedido_id
      left join salas s on s.id = ${String(material.sala_id)} left join localizaciones l on l.id = s.localizacion_id
      where pl.articulo_id = ${String(material.articulo_id)} and (p.sala_id = s.id or p.proyecto_id = l.proyecto_id)
      and greatest(p.creado_en, p.actualizado_en) >= ${lote.creado_en as Date})
    or exists (select 1 from carga_lineas cl join cargas c on c.id = cl.carga_id
      where c.sala_id = ${String(material.sala_id)} and cl.articulo_id = ${String(material.articulo_id)}
      and greatest(c.creado_en, c.actualizado_en) >= ${lote.creado_en as Date})
    or exists (select 1 from movimientos m where m.sala_id = ${String(material.sala_id)} and m.articulo_id = ${String(material.articulo_id)}
      and m.creado_en >= ${lote.creado_en as Date})
    ) as comprometido`;
  return Boolean(fila.comprometido);
}
function comprobarUsuario(id: string): void {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id)) throw new ErrorImportacion('Usuario de lote inválido.');
}
function comprobarLoteId(id: string): void {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id)) throw new ErrorImportacion('Lote no encontrado.', 404);
}
function aLote(f: Record<string, unknown>): LoteImportacion {
  return { id: String(f.id), destino: f.destino as DestinoImportacion, salaId: f.sala_id ? String(f.sala_id) : null,
    usuarioId: String(f.usuario_id), origen: String(f.origen), archivoNombre: String(f.archivo_nombre),
    archivoSha256: String(f.archivo_sha256), archivoBytes: Number(f.archivo_bytes), estado: f.estado as LoteImportacion['estado'],
    creadoEn: f.creado_en instanceof Date ? f.creado_en.toISOString() : String(f.creado_en),
    revertidoEn: f.revertido_en instanceof Date ? f.revertido_en.toISOString() : f.revertido_en ? String(f.revertido_en) : null,
    informe: f.informe as InformeFilaImportacion[], reversion: f.reversion as InformeReversion[] };
}
function jsonIgual(a: unknown, b: unknown): boolean {
  const ordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenar) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordenar(v)])) : v;
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}

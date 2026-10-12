/** Inventario de solo lectura. node scripts/informe-cobertura-catalogo.mjs [--json|--csv]
 * Normalización y precedencias de scripts/generar-seed.mjs: equipos agrupados,
 * cables, altas desde precios finales y puertos válidos. Nunca ejecuta el seed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { require as tsRequire } from 'tsx/cjs/api';
import { normalizarMarca, normalizarModelo, normalizarSeccion, normalizarTexto, claveModelo } from './normalizacion.mjs';

const { esquemaDatoTecnico } = tsRequire('../src/lib/ficha-tecnica.ts', import.meta.url);

const argumentos = process.argv.slice(2);
if (argumentos.length > 1 || argumentos.some((a) => !['--json', '--csv'].includes(a))) {
  throw new Error('Uso: node scripts/informe-cobertura-catalogo.mjs [--json|--csv]');
}
const huellas = {};
function leer(fichero, opcional = false) {
  const ruta = fileURLToPath(new URL(`../data/${fichero}`, import.meta.url));
  if (opcional && !existsSync(ruta)) return [];
  const bruto = readFileSync(ruta, 'utf8');
  huellas[`data/${fichero}`] = createHash('sha256').update(bruto).digest('hex');
  const lineas = bruto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const cabecera = lineas[0].split(';').map((c) => c.trim());
  return lineas.slice(1).map((linea, i) => {
    const celdas = linea.split(';');
    return { ...Object.fromEntries(cabecera.map((c, j) => [c, (celdas[j] ?? '').trim()])),
      procedencia: `data/${fichero}:fila-datos-${i + 1}` };
  });
}
const clave = (r) => `${normalizarMarca(r.marca) ?? ''}|${claveModelo(r.marca, r.modelo)}`;
const urls = (r) => [...new Set(Object.values(r).flatMap((v) => String(v).match(/https?:\/\/[^\s;]+/g) ?? []))];
const filas = leer('catalogo-equipos.csv');
const grupos = new Map();
for (const r of filas.filter((r) => r.modelo && r.modelo !== 'N/A')) {
  const k = clave(r), lista = grupos.get(k) ?? [];
  lista.push({ ...r, marca: normalizarMarca(r.marca), modelo: normalizarModelo(r.marca, r.modelo),
    categoria: normalizarSeccion(r.categoria), unidades_instaladas: Number(r.unidades_instaladas) || 0 });
  grupos.set(k, lista);
}
const catalogo = new Map();
for (const [k, lista] of grupos) {
  const orden = [...lista].sort((a, b) => b.unidades_instaladas - a.unidades_instaladas || a.modelo.localeCompare(b.modelo));
  const r = orden[0];
  catalogo.set(k, { clave: k, marca: r.marca, modelo: r.modelo, categoria: r.categoria, tipo: 'equipo',
    uso: lista.reduce((s, e) => s + e.unidades_instaladas, 0) || null,
    procedencia: lista.map((e) => e.procedencia), fuentes_existentes: lista.flatMap(urls), puertos: [] });
}
const cantidadEquipos = catalogo.size;
const cables = leer('catalogo-cable.csv');
let colisionesCable = 0;
for (const r of cables) {
  const k = clave(r);
  if (catalogo.has(k)) colisionesCable++;
  catalogo.set(k, { clave: k, marca: normalizarMarca(r.marca), modelo: normalizarTexto(r.modelo),
    categoria: normalizarSeccion(r.categoria), tipo: r.tipo, uso: null,
    procedencia: [r.procedencia], fuentes_existentes: urls(r), puertos: [] });
}
const cantidadAntesPrecios = catalogo.size;
let altasPrecios = 0;
const preciosOrientativosSinArticulo = [];
for (const [fichero, origen] of [['precios.csv', 'final'], ['precios-orientativos.csv', 'orientativo'], ['precios-cisco.csv', 'orientativo']]) {
  for (const r of leer(fichero, true)) {
    if (!r.modelo || !r.precio_compra) continue;
    const k = clave(r);
    if (!catalogo.has(k) && origen === 'orientativo') {
      preciosOrientativosSinArticulo.push({ clave: k, procedencia: r.procedencia });
      continue;
    }
    if (!catalogo.has(k)) {
      catalogo.set(k, { clave: k, marca: normalizarMarca(r.marca), modelo: normalizarModelo(r.marca, r.modelo),
        categoria: normalizarSeccion(r.categoria), tipo: r.tipo || 'equipo', uso: null,
        procedencia: [], fuentes_existentes: [], puertos: [] });
      altasPrecios++;
    }
    const articulo = catalogo.get(k);
    articulo.procedencia.push(r.procedencia);
    articulo.fuentes_existentes.push(...urls(r));
  }
}
const senales = new Set(['hdmi', 'red', 'usb', 'audio_linea', 'audio_altavoz', 'microfono', 'alimentacion', 'control', 'otro']);
const sentidos = new Set(['entrada', 'salida', 'bidireccional', 'control']);
const vistos = new Set(), descartados = [];
const filasPuertos = leer('puertos.csv', true);
for (const r of filasPuertos) {
  if (!r.modelo || !r.nombre) continue;
  const k = clave(r), articulo = catalogo.get(k);
  const sentido = (r.sentido || '').toLowerCase(), senal = (r.senal || '').toLowerCase();
  const claveFila = `${k}|${r.nombre.toUpperCase()}`;
  const motivo = !articulo ? 'sin articulo' : !sentidos.has(sentido) || !senales.has(senal) ? 'sentido o senal invalido' : vistos.has(claveFila) ? 'duplicado' : null;
  if (motivo) { descartados.push({ procedencia: r.procedencia, motivo }); continue; }
  vistos.add(claveFila);
  articulo.puertos.push({ nombre: r.nombre, total: Math.max(1, Math.round(Number(String(r.total || '1').replace(',', '.')) || 1)),
    sentido, senal, conector: r.conector || null, notas: r.notas || null, procedencia: r.procedencia });
  articulo.procedencia.push(r.procedencia);
  articulo.fuentes_existentes.push(...urls(r));
}
const filasHechos = leer('fichas-tecnicas.csv', true);
const hechosPorArticulo = new Map(), hechosSinArticulo = [], hechosInvalidos = [];
const clavesHechos = new Set();
for (const r of filasHechos) {
  const k = clave(r), identidad = `${k}|${r.clave}`;
  try {
    if (clavesHechos.has(identidad)) throw new Error('Clave de hecho duplicada');
    clavesHechos.add(identidad);
    const hecho = esquemaDatoTecnico.parse({ clave: r.clave, concepto: r.concepto, tipo: r.tipo, estado: r.estado,
      valor: JSON.parse(r.valor_json), fuente: 'csv', fuente_url: r.fuente_url || null,
      documento: r.documento || null, apartado: r.apartado || null, consultado_en: r.consultado_en || null });
    const documentado = { ...hecho, procedencia: r.procedencia, puerto_nombre: r.puerto_nombre || null,
      puerto_fuente: r.puerto_fuente || null };
    const articulo = catalogo.get(k);
    if (!articulo) {
      hechosSinArticulo.push({ referencia: k, ...documentado });
      continue;
    }
    const anteriores = hechosPorArticulo.get(k) ?? [];
    anteriores.push(documentado);
    hechosPorArticulo.set(k, anteriores);
    articulo.procedencia.push(r.procedencia);
    if (hecho.fuente_url) articulo.fuentes_existentes.push(hecho.fuente_url);
  } catch (error) {
    hechosInvalidos.push({ referencia: k, clave: r.clave, procedencia: r.procedencia, error: error.message });
  }
}
const referencias = [...catalogo.values()].map((r) => {
  const hechos = hechosPorArticulo.get(r.clave) ?? [];
  const documentados = hechos.filter((h) => h.estado !== 'sin_documentar');
  return { ...r,
  algun_puerto: r.puertos.length > 0,
  hechos, hechos_documentados: documentados.length,
  hechos_verificados: hechos.filter((h) => h.estado === 'verificado').length,
  hechos_parciales: hechos.filter((h) => h.estado === 'parcial').length,
  hechos_sin_documentar: hechos.filter((h) => h.estado === 'sin_documentar').length,
  algun_hecho_documentado: documentados.length > 0,
  ficha: r.puertos.length || documentados.length ? 'parcial' : 'sin documentar',
  perfil_validado: false,
  grupos_puerto: r.puertos.length,
  bocas: r.puertos.reduce((s, p) => s + p.total, 0),
  fuentes_existentes: [...new Set(r.fuentes_existentes)],
  };
}).sort((a, b) => (b.uso ?? 0) - (a.uso ?? 0) || a.clave.localeCompare(b.clave));
const informe = { version: 2, alcance: 'CSV locales; no consulta Postgres ni certifica fichas completas',
  resumen: { filas_equipos: filas.length, equipos_normalizados: cantidadEquipos,
    filas_cables: cables.length, colisiones_cables: colisionesCable, referencias_antes_precios: cantidadAntesPrecios,
    altas_precios_finales: altasPrecios, referencias_totales: referencias.length,
    referencias_con_puerto: referencias.filter((r) => r.algun_puerto).length,
    filas_puertos: filasPuertos.length, grupos_puerto_validos: vistos.size,
    filas_hechos: filasHechos.length, hechos_vinculados: referencias.reduce((s, r) => s + r.hechos.length, 0),
    hechos_sin_articulo: hechosSinArticulo.length, hechos_invalidos: hechosInvalidos.length,
    referencias_con_hechos_documentados: referencias.filter((r) => r.algun_hecho_documentado).length,
    fichas_completas_acreditadas: 0 },
  huellas, descartados, hechos_sin_articulo: hechosSinArticulo, hechos_invalidos: hechosInvalidos,
  precios_orientativos_sin_articulo: preciosOrientativosSinArticulo, referencias };
if (hechosInvalidos.length) {
  process.exitCode = 1;
  console.error(`${hechosInvalidos.length} hechos inválidos. Consulte hechos_invalidos en --json.`);
}
if (!argumentos.includes('--csv')) console.log(JSON.stringify(informe, null, 2));
else {
  if (hechosSinArticulo.length) console.error(`${hechosSinArticulo.length} hechos pendientes de artículo: ${[...new Set(hechosSinArticulo.map((h) => h.referencia))].join(', ')}. Detalle en --json.`);
  const columnas = ['clave', 'marca', 'modelo', 'categoria', 'tipo', 'uso', 'algun_puerto', 'algun_hecho_documentado', 'hechos_documentados', 'hechos_verificados', 'hechos_parciales', 'hechos_sin_documentar', 'conceptos_hechos', 'ficha', 'perfil_validado', 'grupos_puerto', 'bocas', 'procedencia', 'fuentes_existentes'];
  const celda = (v) => `"${String(Array.isArray(v) ? v.join(' | ') : v ?? '').replaceAll('"', '""')}"`;
  console.log(columnas.join(';'));
  for (const r of referencias) console.log(columnas.map((c) => celda(c === 'conceptos_hechos'
    ? r.hechos.map((h) => `${h.clave}: ${h.concepto} (${h.estado})`) : r[c])).join(';'));
}

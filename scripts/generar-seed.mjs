/**
 * Genera db/seed.sql a partir de los CSV de data/.
 *
 *   node scripts/generar-seed.mjs
 *
 * Los CSV son la fuente editable: se abren en Excel, se corrigen y se vuelve a
 * ejecutar este script. Nunca se edita el seed.sql a mano.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = (f) => join(raiz, 'data', f);

// --------------------------------------------------------------------------
// utilidades
// --------------------------------------------------------------------------
function leerCsv(ruta, sep = ';') {
  const texto = readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  const cabecera = lineas[0].split(sep).map((c) => c.trim());
  return lineas.slice(1).map((linea) => {
    const celdas = linea.split(sep);
    return Object.fromEntries(cabecera.map((c, i) => [c, (celdas[i] ?? '').trim()]));
  });
}

const txt = (v) => (v === '' || v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => {
  if (v === '' || v == null) return 'null';
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? String(n) : 'null';
};
const arr = (v) => {
  if (!v) return 'null';
  const partes = v.split('|').map((x) => Number(x.replace(',', '.'))).filter(Number.isFinite);
  return partes.length ? `array[${partes.join(',')}]::numeric[]` : 'null';
};

/** Normaliza acentos y espacios para agrupar categorías escritas de varias formas. */
function normalizarCategoria(s) {
  return String(s || 'SIN CATEGORIA')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const SENALES = new Set([
  'hdmi', 'red', 'usb', 'audio_linea', 'audio_altavoz',
  'microfono', 'alimentacion', 'control', 'otro',
]);

// --------------------------------------------------------------------------
// 1 · equipos, desde el inventario real
// --------------------------------------------------------------------------
const equipos = leerCsv(data('catalogo-equipos.csv'))
  .filter((r) => r.modelo && r.modelo !== 'N/A')
  .map((r) => ({
    tipo: 'equipo',
    categoria: normalizarCategoria(r.categoria),
    marca: r.marca || null,
    modelo: r.modelo,
    unidad: 'ud',
    unidades_instaladas: Number(r.unidades_instaladas) || null,
  }));

// La misma marca+modelo puede venir con la categoría escrita de dos formas.
const equiposUnicos = new Map();
for (const e of equipos) {
  const clave = `${e.marca ?? ''}|${e.modelo}|${e.categoria}`;
  const previo = equiposUnicos.get(clave);
  if (previo) previo.unidades_instaladas += e.unidades_instaladas ?? 0;
  else equiposUnicos.set(clave, { ...e });
}

// --------------------------------------------------------------------------
// 2 · cable y consumibles, catálogo base editable
// --------------------------------------------------------------------------
const cables = leerCsv(data('catalogo-cable.csv')).map((r) => ({
  tipo: r.tipo,
  categoria: normalizarCategoria(r.categoria),
  marca: r.marca || null,
  modelo: r.modelo,
  descripcion: r.descripcion || null,
  unidad: r.unidad === 'm' ? 'm' : 'ud',
  senal: SENALES.has(r.senal) ? r.senal : null,
  conector_a: r.conector_a || null,
  conector_b: r.conector_b || null,
  longitudes: r.longitudes_comerciales_m || '',
  bobina_m: r.bobina_m || '',
  diametro_mm: r.diametro_mm || '',
  coste: r.coste || '',
  proveedor: r.proveedor || null,
  plazo_dias: r.plazo_dias || '',
  stock_minimo: r.stock_minimo || '',
}));

// --------------------------------------------------------------------------
// 3 · plantillas de sala, desde el inventario real
// --------------------------------------------------------------------------
const filasPlantilla = leerCsv(data('plantillas-salas.csv'));
const plantillas = new Map();
for (const r of filasPlantilla) {
  const aforo = r.aforo && r.aforo !== 'None' ? Number(r.aforo) : null;
  const nombre = aforo ? `${r.tipologia} · aforo ${aforo}` : `${r.tipologia}`;
  if (!plantillas.has(nombre)) {
    plantillas.set(nombre, {
      nombre,
      tipologia: r.tipologia,
      aforo,
      n_salas_reales: Number(r.n_salas_reales) || null,
      lineas: [],
    });
  }
  plantillas.get(nombre).lineas.push({
    categoria: normalizarCategoria(r.categoria_equipo),
    cantidad: Math.max(1, Math.round(Number(String(r.cantidad_media).replace(',', '.')) || 1)),
    // por debajo de 0,8 de media el equipo no está en todas las salas
    opcional: Number(String(r.cantidad_media).replace(',', '.')) < 0.8,
    modelo_texto: r.modelo_dominante || null,
  });
}

// --------------------------------------------------------------------------
// 4 · volcado
// --------------------------------------------------------------------------
const sql = [];
sql.push('-- Generado por scripts/generar-seed.mjs. No editar a mano.');
sql.push('-- Fuente: data/catalogo-equipos.csv, data/catalogo-cable.csv, data/plantillas-salas.csv');
sql.push('begin;');
sql.push('');

sql.push('-- Parámetros de cálculo de cable (criterio del departamento AV)');
const parametros = [
  ['holgura_pantalla', 0.35, 'm', 'Holgura en el extremo que acaba en pantalla (rango 0,20–0,50)'],
  ['holgura_proyector', 0.1, 'm', 'Holgura en el extremo que acaba en proyector'],
  ['holgura_rack', 1.0, 'm', 'Holgura en el extremo que acaba en rack'],
  ['holgura_caja_conexiones', 0.5, 'm', 'Holgura en caja de conexiones de mesa'],
  ['holgura_mesa', 0.5, 'm', 'Holgura en toma de mesa'],
  ['holgura_techo', 0.3, 'm', 'Holgura en altavoz o micrófono de techo'],
  ['holgura_pared', 0.3, 'm', 'Holgura en toma o placa de pared'],
  ['margen', 0, 'tanto por uno', 'Margen de seguridad sobre el total. 0 = ninguno'],
  ['cables_por_canalizacion', 3, 'ud', 'El previsto más un RJ45 y un HDMI de reserva'],
  ['ocupacion_maxima_canaleta', 0.4, 'tanto por uno', 'Ocupación máxima admitida en canaleta'],
];
sql.push('insert into parametros (clave, valor, unidad, descripcion) values');
sql.push(
  parametros
    .map(([c, v, u, d]) => `  (${txt(c)}, ${v}, ${txt(u)}, ${txt(d)})`)
    .join(',\n') +
    '\non conflict (clave) do update set valor = excluded.valor, descripcion = excluded.descripcion;',
);
sql.push('');

sql.push(`-- Catálogo: ${equiposUnicos.size} equipos del inventario real`);
sql.push(
  'insert into articulos (tipo, categoria, marca, modelo, unidad, unidades_instaladas) values',
);
sql.push(
  [...equiposUnicos.values()]
    .map(
      (e) =>
        `  ('equipo', ${txt(e.categoria)}, ${txt(e.marca)}, ${txt(e.modelo)}, 'ud', ${num(e.unidades_instaladas)})`,
    )
    .join(',\n') +
    "\non conflict (coalesce(marca, ''), modelo, categoria) do update set unidades_instaladas = excluded.unidades_instaladas;",
);
sql.push('');

sql.push(`-- Catálogo: ${cables.length} referencias de cable y consumible (base editable)`);
sql.push(
  'insert into articulos (tipo, categoria, marca, modelo, descripcion, unidad, senal, ' +
    'conector_a, conector_b, longitudes_comerciales_m, bobina_m, diametro_mm, coste, plazo_dias, stock_minimo) values',
);
sql.push(
  cables
    .map(
      (c) =>
        `  (${txt(c.tipo)}, ${txt(c.categoria)}, ${txt(c.marca)}, ${txt(c.modelo)}, ${txt(c.descripcion)}, ` +
        `${txt(c.unidad)}, ${c.senal ? txt(c.senal) : 'null'}, ${txt(c.conector_a)}, ${txt(c.conector_b)}, ` +
        `${arr(c.longitudes)}, ${num(c.bobina_m)}, ${num(c.diametro_mm)}, ${num(c.coste)}, ` +
        `${num(c.plazo_dias)}, ${num(c.stock_minimo)})`,
    )
    .join(',\n') +
    "\non conflict (coalesce(marca, ''), modelo, categoria) do update set " +
    'descripcion = excluded.descripcion, longitudes_comerciales_m = excluded.longitudes_comerciales_m, ' +
    'bobina_m = excluded.bobina_m, diametro_mm = excluded.diametro_mm;',
);
sql.push('');

sql.push(`-- Plantillas de sala: ${plantillas.size} deducidas del inventario`);
for (const p of plantillas.values()) {
  sql.push(
    `insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ` +
      `(${txt(p.nombre)}, ${txt(p.tipologia)}, ${p.aforo ?? 'null'}, ${p.n_salas_reales ?? 'null'}, ` +
      `${txt('Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.')}) ` +
      `on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;`,
  );
  for (const l of p.lineas) {
    sql.push(
      `insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional) ` +
        `select id, ${txt(l.categoria)}, ${txt(l.modelo_texto)}, ${l.cantidad}, ${l.opcional} ` +
        `from plantillas_sala where nombre = ${txt(p.nombre)} ` +
        // Solo siembra si la plantilla está vacía: así no se pisan las
        // ediciones que haya hecho el departamento desde la aplicación.
        `and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = plantillas_sala.id);`,
    );
  }
  sql.push('');
}

sql.push('-- Enlaza cada línea de plantilla con el artículo del catálogo cuando el modelo coincide');
sql.push(`update plantilla_articulos pa
set articulo_id = a.id
from articulos a
where pa.articulo_id is null
  and pa.modelo_texto is not null
  and upper(trim(coalesce(a.marca,'') || ' ' || a.modelo)) = upper(trim(pa.modelo_texto));`);
sql.push('');
sql.push('commit;');

const salida = join(raiz, 'db', 'seed.sql');
if (!existsSync(join(raiz, 'db'))) {
  throw new Error('Falta la carpeta db/');
}
writeFileSync(salida, sql.join('\n') + '\n', 'utf8');

console.log(`seed.sql generado`);
console.log(`  equipos      ${equiposUnicos.size}`);
console.log(`  cable/consum ${cables.length}`);
console.log(`  plantillas   ${plantillas.size}`);

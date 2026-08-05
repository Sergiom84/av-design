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
import {
  claveModelo,
  normalizarMarca,
  normalizarModelo,
  normalizarSeccion,
  normalizarTexto,
} from './normalizacion.mjs';

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
    categoria: normalizarSeccion(r.categoria),
    marca: normalizarMarca(r.marca),
    modelo: normalizarModelo(r.marca, r.modelo),
    clave: claveModelo(r.marca, r.modelo),
    unidad: 'ud',
    unidades_instaladas: Number(r.unidades_instaladas) || 0,
  }));

// El inventario escribe la misma cosa de varias formas. Se funden por marca y
// modelo (ver scripts/normalizacion.mjs) y se queda la sección del que más
// unidades tiene, sumando el total.
const porClave = new Map();
for (const e of equipos) {
  const clave = `${e.marca ?? ''}|${e.clave}`;
  const lista = porClave.get(clave) ?? [];
  lista.push(e);
  porClave.set(clave, lista);
}

const equiposUnicos = new Map();
for (const [clave, lista] of porClave) {
  const orden = [...lista].sort(
    (a, b) => b.unidades_instaladas - a.unidades_instaladas ||
      a.modelo.localeCompare(b.modelo),
  );
  equiposUnicos.set(clave, {
    ...orden[0],
    unidades_instaladas:
      orden.reduce((s, e) => s + e.unidades_instaladas, 0) || null,
  });
}

// --------------------------------------------------------------------------
// 2 · cable y consumibles, catálogo base editable
// --------------------------------------------------------------------------
const cables = leerCsv(data('catalogo-cable.csv')).map((r) => ({
  tipo: r.tipo,
  categoria: normalizarSeccion(r.categoria),
  marca: normalizarMarca(r.marca),
  modelo: normalizarTexto(r.modelo),
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
// 2 bis · precios ofertados
//
// Los presupuestos de los proveedores traen la misma referencia a precios
// distintos, así que no se puede escribir un único coste y olvidarse. Cada
// línea de cada presupuesto se guarda en `precios`; el catálogo se queda con
// el mejor precio conocido. Lo que ya está en el catálogo se enlaza por marca
// y modelo normalizados; lo que no, entra como referencia nueva.
// --------------------------------------------------------------------------
const catalogoPorClave = new Map();
for (const e of equiposUnicos.values()) {
  catalogoPorClave.set(`${e.marca ?? ''}|${e.clave}`, {
    marca: e.marca,
    modelo: e.modelo,
    categoria: e.categoria,
  });
}
for (const c of cables) {
  catalogoPorClave.set(`${c.marca ?? ''}|${claveModelo(c.marca, c.modelo)}`, {
    marca: c.marca,
    modelo: c.modelo,
    categoria: c.categoria,
  });
}

// Lo que ya existía antes de mirar los presupuestos. Sirve para no contar como
// "enlazado con el catálogo" lo que ha creado el propio fichero de precios dos
// líneas más arriba.
const clavesPrevias = new Set(catalogoPorClave.keys());

// Dos fuentes distintas y no intercambiables: las ofertas reales de proveedor
// y los precios de referencia buscados por internet. Los segundos sirven para
// dimensionar mientras no hay oferta, pero no son lo que os cuesta.
const fuentesPrecio = [
  { fichero: 'precios.csv', origen: 'final' },
  { fichero: 'precios-orientativos.csv', origen: 'orientativo' },
];

const filasPrecio = fuentesPrecio.flatMap(({ fichero, origen }) =>
  existsSync(data(fichero))
    ? leerCsv(data(fichero)).map((r) => ({ ...r, __origen: origen }))
    : [],
);

const articulosNuevos = new Map();
const precios = [];
const informePrecios = { enlazados: [], nuevos: [], revisar: [], sinArticulo: [] };

for (const r of filasPrecio) {
  if (!r.modelo || !r.precio_compra) continue;

  const marca = normalizarMarca(r.marca);
  const modelo = normalizarModelo(r.marca, r.modelo);
  const clave = `${marca ?? ''}|${claveModelo(r.marca, r.modelo)}`;

  let articulo = catalogoPorClave.get(clave);

  // Un precio orientativo nunca da de alta una referencia: si no está en el
  // catálogo, se avisa y no se carga.
  if (!articulo && r.__origen === 'orientativo') {
    informePrecios.sinArticulo.push(`${marca ?? ''} ${modelo}`.trim());
    continue;
  }

  if (!articulo) {
    articulo = {
      marca,
      modelo,
      categoria: normalizarSeccion(r.categoria),
      tipo: r.tipo || 'equipo',
      descripcion: r.descripcion || null,
      unidad: r.unidad === 'm' ? 'm' : 'ud',
      senal: SENALES.has(r.senal) ? r.senal : null,
      conector_a: r.conector_a || null,
      conector_b: r.conector_b || null,
      longitudes: r.longitud_m || '',
      bobina_m: r.bobina_m || '',
      referencia: r.referencia || null,
    };
    catalogoPorClave.set(clave, articulo);
    articulosNuevos.set(clave, articulo);
    informePrecios.nuevos.push({ ...articulo, presupuesto: r.presupuesto });
  } else if (clavesPrevias.has(clave)) {
    const nombre = `${articulo.marca ?? ''} ${articulo.modelo}`.trim();
    if (!informePrecios.enlazados.some((e) => e.catalogo === nombre)) {
      informePrecios.enlazados.push({
        escrito: `${r.marca} ${r.modelo}`.trim(),
        catalogo: nombre,
        categoria: articulo.categoria,
        referencia: r.referencia || null,
      });
    }
  }

  const unidadesPorCompra = Number(String(r.unidades_por_compra || '1').replace(',', '.')) || 1;
  const precioCompra = Number(String(r.precio_compra).replace(',', '.'));

  precios.push({
    marca: articulo.marca,
    modelo: articulo.modelo,
    categoria: articulo.categoria,
    presupuesto: r.presupuesto,
    origen: r.__origen,
    moneda: r.moneda || 'EUR',
    proveedor: r.proveedor || null,
    fecha: r.fecha || null,
    referencia: r.referencia || null,
    precio: Math.round((precioCompra / unidadesPorCompra) * 10000) / 10000,
    precio_compra: precioCompra,
    unidades_por_compra: unidadesPorCompra,
    cantidad: r.cantidad || '',
    notas: r.revisar || null,
  });

  if (r.revisar) {
    informePrecios.revisar.push({
      referencia: `${r.marca} ${r.modelo}`.trim(),
      presupuesto: r.presupuesto,
      motivo: r.revisar,
    });
  }
}

const proveedoresPrecios = [...new Set(precios.map((p) => p.proveedor).filter(Boolean))];

// --------------------------------------------------------------------------
// 2 ter · puertos de cada artículo
//
// Un puerto es un conector físico del equipo: el Room Navigator tiene un
// LAN PoE, una matriz tiene HDMI IN 1..4 y HDMI OUT 1..2. Es lo que permite
// decir de qué salida a qué entrada va un cable.
//
// El CSV es la fuente y puede no existir todavía: la siembra funciona igual
// sin él. Se cruza contra el catálogo por marca y modelo normalizados, igual
// que los precios. La columna `categoria` del CSV es informativa y NO se usa
// para casar: un mismo modelo está en una única sección del catálogo y es esa
// la que manda. Si el artículo no existe, no se da de alta: se avisa y se
// salta, porque un puerto no describe un producto entero.
// --------------------------------------------------------------------------
const SENTIDOS = new Set(['entrada', 'salida', 'bidireccional', 'control']);

const hayCsvPuertos = existsSync(data('puertos.csv'));
const filasPuerto = hayCsvPuertos ? leerCsv(data('puertos.csv')) : [];

const puertos = [];
const informePuertos = { sinArticulo: [], invalidos: [], duplicados: [] };
const vistosPuerto = new Set();

for (const r of filasPuerto) {
  if (!r.modelo || !r.nombre) continue;

  const marca = normalizarMarca(r.marca);
  const modelo = normalizarModelo(r.marca, r.modelo);
  const clave = `${marca ?? ''}|${claveModelo(r.marca, r.modelo)}`;
  const rotulo = `${marca ?? ''} ${modelo} · ${r.nombre}`.trim();

  const articulo = catalogoPorClave.get(clave);
  if (!articulo) {
    informePuertos.sinArticulo.push(rotulo);
    continue;
  }

  const sentido = (r.sentido || '').toLowerCase();
  const senal = (r.senal || '').toLowerCase();
  if (!SENTIDOS.has(sentido)) {
    informePuertos.invalidos.push(`${rotulo}: sentido '${r.sentido}' no válido`);
    continue;
  }
  if (!SENALES.has(senal)) {
    informePuertos.invalidos.push(`${rotulo}: señal '${r.senal}' no válida`);
    continue;
  }

  // La tabla tiene unique (articulo_id, nombre): dos filas del CSV con el
  // mismo puerto del mismo artículo se quedarían en una sin avisar.
  const claveFila = `${clave}|${r.nombre.toUpperCase()}`;
  if (vistosPuerto.has(claveFila)) {
    informePuertos.duplicados.push(rotulo);
    continue;
  }
  vistosPuerto.add(claveFila);

  puertos.push({
    marca: articulo.marca,
    modelo: articulo.modelo,
    categoria: articulo.categoria,
    nombre: r.nombre,
    total: Math.max(1, Math.round(Number(String(r.total || '1').replace(',', '.')) || 1)),
    sentido,
    senal,
    conector: r.conector || null,
    orden: r.orden === '' || r.orden == null ? '' : r.orden,
    notas: r.notas || null,
  });
}

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
  // "CISCO CISCO ROOM NAVIGATOR" del inventario -> "CISCO ROOM NAVIGATOR",
  // que es como queda el artículo en el catálogo ya limpio.
  const dominante = r.modelo_dominante || '';
  const corte = dominante.indexOf(' ');
  const marcaDom = corte > 0 ? dominante.slice(0, corte) : '';
  const modeloDom = corte > 0 ? dominante.slice(corte + 1) : dominante;
  const textoDominante = dominante
    ? [normalizarMarca(marcaDom), normalizarModelo(marcaDom, modeloDom)]
        .filter(Boolean)
        .join(' ')
        .trim()
    : null;

  plantillas.get(nombre).lineas.push({
    categoria: normalizarSeccion(r.categoria_equipo),
    cantidad: Math.max(1, Math.round(Number(String(r.cantidad_media).replace(',', '.')) || 1)),
    // por debajo de 0,8 de media el equipo no está en todas las salas
    opcional: Number(String(r.cantidad_media).replace(',', '.')) < 0.8,
    modelo_texto: textoDominante,
  });
}

// --------------------------------------------------------------------------
// 4 · volcado
// --------------------------------------------------------------------------
const sql = [];
sql.push('-- Generado por scripts/generar-seed.mjs. No editar a mano.');
sql.push(
  '-- Fuente: data/catalogo-equipos.csv, data/catalogo-cable.csv, data/plantillas-salas.csv' +
    (hayCsvPuertos ? ', data/puertos.csv' : ''),
);
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
  ['vigencia_precio_meses', 18, 'meses', 'Antigüedad máxima de un presupuesto para que su precio cuente como coste'],
  ['tipo_cambio_usd_eur', 0.867, 'EUR por USD', 'Para convertir precios de referencia en dólares. Agosto de 2026'],
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

if (precios.length) {
  sql.push(
    `-- Precios: ${precios.length} líneas de ${new Set(precios.map((p) => p.presupuesto)).size} ` +
      `presupuestos, ${articulosNuevos.size} referencias nuevas`,
  );

  if (proveedoresPrecios.length) {
    sql.push('insert into proveedores (nombre) values');
    sql.push(
      proveedoresPrecios.map((n) => `  (${txt(n)})`).join(',\n') +
        '\non conflict (nombre) do nothing;',
    );
    sql.push('');
  }

  if (articulosNuevos.size) {
    sql.push(
      'insert into articulos (tipo, categoria, marca, modelo, descripcion, unidad, senal, ' +
        'conector_a, conector_b, longitudes_comerciales_m, bobina_m, referencia_fabricante) values',
    );
    sql.push(
      [...articulosNuevos.values()]
        .map(
          (a) =>
            `  (${txt(a.tipo)}, ${txt(a.categoria)}, ${txt(a.marca)}, ${txt(a.modelo)}, ` +
            `${txt(a.descripcion)}, ${txt(a.unidad)}, ${a.senal ? txt(a.senal) : 'null'}, ` +
            `${txt(a.conector_a)}, ${txt(a.conector_b)}, ${arr(a.longitudes)}, ` +
            `${num(a.bobina_m)}, ${txt(a.referencia)})`,
        )
        .join(',\n') +
        "\non conflict (coalesce(marca, ''), modelo, categoria) do update set " +
        'descripcion = coalesce(articulos.descripcion, excluded.descripcion), ' +
        'referencia_fabricante = coalesce(articulos.referencia_fabricante, excluded.referencia_fabricante);',
    );
    sql.push('');
  }

  // Se regenera solo la parte que viene de los CSV. Sin este borrado,
  // renombrar un presupuesto o quitar una línea dejaría filas huérfanas,
  // porque la siembra solo inserta y actualiza. Lo escrito desde la
  // aplicación lleva fuente = 'app' y no se toca.
  sql.push('-- Los CSV mandan sobre lo suyo. Lo escrito desde la app no se toca.');
  sql.push("delete from precios where fuente = 'csv';");
  sql.push('');

  // Una sentencia por línea: el fichero es generado, así que se prefiere que
  // se pueda leer y depurar antes que que sea corto.
  // txt('') devuelve el literal `null`, que aquí no vale: el cable genérico no
  // tiene marca y hay que compararlo contra la cadena vacía, no contra null.
  const donde = (p) =>
    `coalesce(marca, '') = ${p.marca ? txt(p.marca) : "''"} and modelo = ${txt(p.modelo)} ` +
    `and categoria = ${txt(p.categoria)}`;

  for (const p of precios) {
    sql.push(
      `insert into precios (articulo_id, proveedor_id, presupuesto, origen, fuente, moneda, ` +
        `fecha, referencia, precio, precio_compra, unidades_por_compra, cantidad, notas)\n` +
        `select a.id, ${p.proveedor ? `(select id from proveedores where nombre = ${txt(p.proveedor)})` : 'null'}, ` +
        `${txt(p.presupuesto)}, ${txt(p.origen)}, 'csv', ${txt(p.moneda)}, ` +
        `${p.fecha ? `${txt(p.fecha)}::date` : 'null'}, ${txt(p.referencia)}, ` +
        `${p.precio}, ${p.precio_compra}, ` +
        `${p.unidades_por_compra}, ${num(p.cantidad)}, ${txt(p.notas)}\n` +
        `from articulos a where ${donde(p)}\n` +
        `on conflict (presupuesto, articulo_id) do update set ` +
        `origen = excluded.origen, fuente = excluded.fuente, moneda = excluded.moneda, ` +
        `fecha = excluded.fecha, precio = excluded.precio, precio_compra = excluded.precio_compra, ` +
        `unidades_por_compra = excluded.unidades_por_compra, cantidad = excluded.cantidad, ` +
        `notas = excluded.notas\n` +
        // Sin esta condición, un presupuesto del CSV que se llamase igual que uno
        // escrito desde la aplicación lo pisaría por la puerta de atrás, saltándose
        // el borrado que solo alcanza a fuente = 'csv'.
        `where precios.fuente = 'csv';`,
    );
  }
  sql.push('');

  // El precio más bajo a secas no vale: una oferta puede ser de una factura
  // vieja. Solo cuentan los presupuestos sin fecha y los que siguen dentro de
  // la vigencia, que se edita en /parametros.
  // Manda la oferta real. Si no hay ninguna vigente se usa el precio de
  // referencia, convertido a euros, y el artículo queda marcado como
  // orientativo para que nadie pida material con ese número.
  sql.push('-- Coste del catálogo: la mejor oferta vigente; si no hay, la mejor referencia');
  sql.push(`with cambio as (
  select coalesce(max(valor), 1) as usd_eur
  from parametros where clave = 'tipo_cambio_usd_eur'
),
vigencia as (
  select coalesce(max(valor), 18)::int as meses
  from parametros where clave = 'vigencia_precio_meses'
),
en_euros as (
  select p.articulo_id, p.origen,
         p.precio * case when p.moneda = 'EUR' then 1 else c.usd_eur end as precio_eur
  from precios p, cambio c, vigencia v
  where p.fecha is null
     or p.fecha >= current_date - make_interval(months => v.meses)
),
mejor as (
  select articulo_id,
         min(precio_eur) filter (where origen = 'final')       as final,
         min(precio_eur) filter (where origen = 'orientativo')  as orientativo
  from en_euros group by articulo_id
)
update articulos a
set coste = round(coalesce(m.final, m.orientativo), 4),
    coste_orientativo = (m.final is null)
from mejor m
where m.articulo_id = a.id
  and coalesce(m.final, m.orientativo) is not null;`);
  sql.push('');

  sql.push('-- Referencia del fabricante: la del presupuesto más reciente que la traiga');
  sql.push(`update articulos a
set referencia_fabricante = c.referencia
from (
  select distinct on (articulo_id) articulo_id, referencia
  from precios where referencia is not null
  order by articulo_id, fecha desc nulls last
) c
where c.articulo_id = a.id and a.referencia_fabricante is null;`);
  sql.push('');
}

// Puertos. Solo se toca la tabla si el CSV existe: mientras no exista, la
// siembra pasa de largo y no borra nada de lo que se haya dado de alta a mano.
if (hayCsvPuertos) {
  const articulosConPuertos = new Set(
    puertos.map((p) => `${p.marca ?? ''}|${p.modelo}|${p.categoria}`),
  );
  sql.push(
    `-- Puertos: ${puertos.length} de ${articulosConPuertos.size} artículos (data/puertos.csv)`,
  );

  // Mismo criterio que en precios: los CSV mandan sobre lo suyo y su parte se
  // regenera entera, para que quitar una fila del CSV no deje un puerto
  // huérfano. Lo escrito desde la aplicación lleva fuente = 'app' y no se toca.
  sql.push('-- El CSV manda sobre lo suyo. Lo escrito desde la app no se toca.');
  sql.push("delete from puertos where fuente = 'csv';");
  sql.push('');

  // txt('') devuelve el literal `null`, que aquí no vale: un artículo sin
  // marca hay que compararlo contra la cadena vacía, no contra null.
  const dondeArticulo = (p) =>
    `coalesce(marca, '') = ${p.marca ? txt(p.marca) : "''"} and modelo = ${txt(p.modelo)} ` +
    `and categoria = ${txt(p.categoria)}`;

  for (const p of puertos) {
    sql.push(
      `insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)\n` +
        `select a.id, ${txt(p.nombre)}, ${p.total}, ${txt(p.sentido)}::sentido_puerto, ` +
        `${txt(p.senal)}::senal, ${txt(p.conector)}, ${num(p.orden)}, ${txt(p.notas)}, 'csv'\n` +
        `from articulos a where ${dondeArticulo(p)}\n` +
        // Después del borrado de arriba, el único choque posible es contra un
        // puerto dado de alta desde la aplicación. Ese manda: alguien lo miró
        // en el equipo real. El CSV se aparta y no lo pisa.
        `on conflict (articulo_id, nombre) do nothing;`,
    );
  }
  sql.push('');
}

sql.push(`-- Plantillas de sala: ${plantillas.size} deducidas del inventario`);
for (const p of plantillas.values()) {
  sql.push(
    `insert into plantillas_sala (nombre, tipologia, aforo, n_salas_reales, notas) values ` +
      `(${txt(p.nombre)}, ${txt(p.tipologia)}, ${p.aforo ?? 'null'}, ${p.n_salas_reales ?? 'null'}, ` +
      `${txt('Deducida del inventario 2026. Faltan las medidas: rellenar largo, ancho y alto.')}) ` +
      `on conflict (nombre) do update set n_salas_reales = excluded.n_salas_reales;`,
  );
  // Todas las líneas en una sola sentencia: si fueran una por una, la primera
  // dejaría de cumplirse la condición de "plantilla vacía" y el resto no
  // entraría. Así se siembra entera o no se siembra.
  if (p.lineas.length) {
    const valores = p.lineas
      .map(
        (l) =>
          `(${txt(l.categoria)}, ${txt(l.modelo_texto)}, ${l.cantidad}::numeric, ${l.opcional})`,
      )
      .join(', ');
    sql.push(
      `insert into plantilla_articulos (plantilla_id, categoria, modelo_texto, cantidad, opcional)
` +
        `select ps.id, v.categoria, v.modelo_texto, v.cantidad, v.opcional
` +
        `from plantillas_sala ps
` +
        `cross join (values ${valores}) as v(categoria, modelo_texto, cantidad, opcional)
` +
        `where ps.nombre = ${txt(p.nombre)}
` +
        // Solo siembra si la plantilla está vacía: así no se pisan las
        // ediciones que haya hecho el departamento desde la aplicación.
        `  and not exists (select 1 from plantilla_articulos pa where pa.plantilla_id = ps.id);`,
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
if (hayCsvPuertos) console.log(`  puertos      ${puertos.length}`);

if (precios.length) {
  const presupuestos = new Set(precios.map((p) => p.presupuesto));
  console.log(`  precios      ${precios.length} de ${presupuestos.size} presupuestos`);
  console.log(`    enlazados con el catálogo   ${informePrecios.enlazados.length}`);
  console.log(`    referencias nuevas          ${articulosNuevos.size}`);

  if (informePrecios.enlazados.length) {
    console.log('\n  Enlazados con una referencia que ya estaba en el catálogo:');
    for (const e of informePrecios.enlazados) {
      const ref = e.referencia && e.referencia.toUpperCase() !== e.catalogo.split(' ').at(-1)
        ? `  <- ${e.referencia}`
        : '';
      console.log(`    ${e.catalogo} · ${e.categoria}${ref}`);
    }
  }

  if (informePrecios.revisar.length) {
    console.log('\n  Para revisar a mano:');
    for (const r of informePrecios.revisar) {
      console.log(`    ${r.referencia} (${r.presupuesto}): ${r.motivo}`);
    }
  }

  const orientativos = precios.filter((p) => p.origen === 'orientativo');
  if (orientativos.length) {
    console.log(
      `\n  ${orientativos.length} precios orientativos (no cuentan para el coste del catálogo):`,
    );
    for (const p of orientativos) {
      console.log(
        `    ${`${p.marca ?? ''} ${p.modelo}`.trim()}: ${p.precio.toFixed(2)} ${p.moneda}`,
      );
    }
  }
  if (informePrecios.sinArticulo.length) {
    console.log('\n  Orientativos descartados por no estar en el catálogo:');
    for (const n of informePrecios.sinArticulo) console.log(`    ${n}`);
  }

  // Misma referencia a más de un precio: es lo que permite comparar ofertas.
  // Solo entre ofertas reales y en la misma moneda; comparar un presupuesto en
  // euros con un precio de lista americano no dice nada.
  const porArticulo = new Map();
  for (const p of precios) {
    if (p.origen !== 'final') continue;
    const k = `${p.marca ?? ''} ${p.modelo}`.trim();
    porArticulo.set(k, [...(porArticulo.get(k) ?? []), p]);
  }
  const conVarios = [...porArticulo.entries()].filter(([, l]) => l.length > 1);
  if (conVarios.length) {
    console.log('\n  Misma referencia a varios precios:');
    for (const [nombre, lista] of conVarios) {
      const orden = [...lista].sort((a, b) => a.precio - b.precio);
      const dif = ((orden.at(-1).precio / orden[0].precio - 1) * 100).toFixed(0);
      console.log(
        `    ${nombre}: ${orden.map((p) => `${p.precio.toFixed(2)} €`).join(' / ')}  (+${dif} %)`,
      );
    }
  }

  if (!proveedoresPrecios.length) {
    console.log('\n  Ningún presupuesto tiene proveedor: rellenar la columna en data/precios.csv');
  }
}

// --------------------------------------------------------------------------
// Informe de puertos
//
// Sin puertos no se puede dibujar el esquema ni sacar la tabla de cables, así
// que lo que interesa ver de un vistazo es la cobertura: cuánto catálogo está
// ya listo para conectar y cuánto no.
// --------------------------------------------------------------------------
if (!hayCsvPuertos) {
  console.log('\n  Sin data/puertos.csv: la tabla de puertos no se toca.');
} else {
  const conPuertos = new Set(
    puertos.map((p) => `${p.marca ?? ''}|${p.modelo}|${p.categoria}`),
  );
  const totalCatalogo = catalogoPorClave.size;
  const cobertura = totalCatalogo
    ? ((conPuertos.size / totalCatalogo) * 100).toFixed(1)
    : '0';

  console.log(`\n  Puertos: ${puertos.length} líneas de ${conPuertos.size} artículos`);
  console.log(
    `    con puertos en el CSV      ${conPuertos.size} de ${totalCatalogo} del catálogo (${cobertura} %)`,
  );
  console.log(`    sin puertos todavía        ${totalCatalogo - conPuertos.size}`);

  if (informePuertos.sinArticulo.length) {
    console.log('\n  Descartados por no estar en el catálogo (no se dan de alta):');
    for (const n of informePuertos.sinArticulo) console.log(`    ${n}`);
  }
  if (informePuertos.invalidos.length) {
    console.log('\n  Descartados por sentido o señal no válidos:');
    for (const n of informePuertos.invalidos) console.log(`    ${n}`);
  }
  if (informePuertos.duplicados.length) {
    console.log('\n  Descartados por repetir nombre de puerto en el mismo artículo:');
    for (const n of informePuertos.duplicados) console.log(`    ${n}`);
  }
  console.log(
    '\n  Los puertos dados de alta desde la aplicación no salen aquí y la siembra no los toca.',
  );
}

/**
 * Gate G1 de E2: ejecutar el generador REAL, copiado sin modificar, con fuentes
 * exclusivamente sintéticas. No consulta ni escribe ninguna base de datos.
 *
 *   node scripts/preparar-seed-importacion.mjs
 *
 * QA aplica preparacion.sql y db/seed.sql únicamente en su esquema aislado
 * e2_seed_prueba, después de verificar host/puerto/base/usuario/search_path.
 * Nunca ejecuta npm run seed ni toca data/ o db/seed.sql de este checkout.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, 'output/e2-importacion/gates/seed-prueba');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = numero => `e2f00000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
const ids = {
  cableApp: uuid(1), cableCsv: uuid(2), equipoApp: uuid(3), equipoCsv: uuid(4), proveedor: uuid(5),
  precioAppConflicto: uuid(6), precioAppAnterior: uuid(7), precioCsvRetirado: uuid(8),
  puertoApp: uuid(10), puertoCsvRetirado: uuid(11),
};

const modelos = { cableApp: 'CABLEAPP', cableCsv: 'CABLECSV', equipoApp: 'EQUIPOAPP', equipoCsv: 'EQUIPOCSV' };
const presupuestos = {
  conflictoApp: 'E2SEED-CONFLICTO-APP', appAnterior: 'E2SEED-APP-ANTERIOR', csvRetirado: 'E2SEED-CSV-RETIRADO',
  csvNuevo: 'E2SEED-CSV-NUEVO', csvSobreApp: 'E2SEED-CSV-SOBRE-CATALOGO-APP',
};
const cabeceraPrecios = ['marca', 'modelo', 'categoria', 'tipo', 'unidad', 'presupuesto', 'proveedor', 'fecha',
  'referencia', 'precio_compra', 'unidades_por_compra', 'cantidad', 'moneda', 'descripcion', 'revisar'];

const datos = {
  'catalogo-equipos.csv': {
    cabecera: ['marca', 'modelo', 'categoria', 'unidades_instaladas'],
    filas: [['E2SEED', modelos.equipoApp, 'E2SEED EQUIPO', '999'], ['E2SEED', modelos.equipoCsv, 'E2SEED EQUIPO', '222']],
  },
  'catalogo-cable.csv': {
    cabecera: ['tipo', 'categoria', 'marca', 'modelo', 'descripcion', 'unidad', 'senal', 'conector_a', 'conector_b',
      'longitudes_comerciales_m', 'bobina_m', 'diametro_mm', 'coste', 'proveedor', 'plazo_dias', 'stock_minimo'],
    filas: [
      ['cable', 'E2SEED CABLE', 'E2SEED', modelos.cableApp, 'CSV intenta pisar descripción APP', 'm', 'red', 'RJ45 CSV', 'RJ45 CSV', '9|10', '999', '99', '999', '', '99', '99'],
      ['cable', 'E2SEED CABLE', 'E2SEED', modelos.cableCsv, 'CSV regenerada versión 2', 'm', 'red', 'RJ45 CSV', 'RJ45 CSV', '3|4', '100', '6', '20', '', '7', '3'],
    ],
  },
  'plantillas-salas.csv': {
    cabecera: ['tipologia', 'aforo', 'n_salas_reales', 'categoria_equipo', 'cantidad_media', 'modelo_dominante'], filas: [],
  },
  'precios.csv': {
    cabecera: cabeceraPrecios,
    filas: [
      ['E2SEED', modelos.cableApp, 'E2SEED CABLE', 'cable', 'm', presupuestos.conflictoApp, 'E2SEED PROVEEDOR', '', 'CSV-INTENTO-APP', '999', '1', '1', 'EUR', '', 'Conflicto contra oferta APP: no sobrescribir'],
      ['E2SEED', modelos.cableApp, 'E2SEED CABLE', 'cable', 'm', presupuestos.csvSobreApp, 'E2SEED PROVEEDOR', '', '', '1', '1', '1', 'EUR', '', 'Oferta CSV nueva no cambia el coste manual del catálogo APP'],
      ['E2SEED', modelos.cableCsv, 'E2SEED CABLE', 'cable', 'm', presupuestos.csvNuevo, 'E2SEED PROVEEDOR', '', 'CSV-EXACTA', '200', '100', '1', 'EUR', '', 'Bobina: 200 EUR entre 100 m = 2 EUR por metro'],
    ],
  },
  'precios-orientativos.csv': { cabecera: cabeceraPrecios, filas: [] },
  'puertos.csv': {
    cabecera: ['marca', 'modelo', 'categoria', 'nombre', 'total', 'sentido', 'senal', 'conector', 'orden', 'notas'],
    filas: [
      ['E2SEED', modelos.cableApp, 'E2SEED CABLE', 'LAN APP', '9', 'bidireccional', 'red', 'RJ45 CSV', '9', 'CSV intenta pisar el puerto APP'],
      ['E2SEED', modelos.cableCsv, 'E2SEED CABLE', 'LAN CSV NUEVO', '2', 'bidireccional', 'red', 'RJ45', '1', 'Puerto CSV regenerado'],
    ],
  },
};

/** Todos los valores son sintéticos y compatibles con el CSV simple del generador original. */
function csvSintetico({ cabecera, filas }) {
  for (const fila of filas) {
    assert.equal(fila.length, cabecera.length);
    for (const celda of fila) assert.ok(!/[;\r\n]/u.test(celda), 'Celda sintética incompatible con el generador real.');
  }
  return `${[cabecera, ...filas].map(f => f.join(';')).join('\n')}\n`;
}

async function fotosProtegidas() {
  const archivos = ['db/seed.sql', 'scripts/generar-seed.mjs', 'scripts/normalizacion.mjs',
    ...(await readdir(join(raiz, 'data'))).filter(f => f.endsWith('.csv')).map(f => `data/${f}`)];
  const fotos = {};
  for (const archivo of archivos) fotos[archivo] = hash(await readFile(join(raiz, archivo)));
  return fotos;
}

export async function prepararSeedImportacion() {
  const antes = await fotosProtegidas();
  await Promise.all(['scripts', 'data', 'db'].map(carpeta => mkdir(join(salida, carpeta), { recursive: true })));
  for (const nombre of ['generar-seed.mjs', 'normalizacion.mjs']) {
    await copyFile(join(raiz, 'scripts', nombre), join(salida, 'scripts', nombre));
    assert.equal(hash(await readFile(join(salida, 'scripts', nombre))), antes[`scripts/${nombre}`]);
  }
  // No se copia data/ del proyecto: las únicas fuentes de esta carpeta son las
  // seis tablas sintéticas de arriba, identificadas una a una en el manifiesto.
  const existentes = await readdir(join(salida, 'data'));
  assert.deepEqual(existentes.filter(f => !(f in datos)), [], 'La carpeta de prueba contiene una fuente no autorizada.');
  for (const [nombre, contenido] of Object.entries(datos)) await writeFile(join(salida, 'data', nombre), csvSintetico(contenido));
  const proceso = spawnSync(process.execPath, [join(salida, 'scripts/generar-seed.mjs')], {
    cwd: salida, encoding: 'utf8', env: { ...process.env, DATABASE_URL: '', IMPORTACION_DATABASE_URL: '' },
  });
  await writeFile(join(salida, 'generador.log'), `${proceso.stdout ?? ''}${proceso.stderr ?? ''}`);
  assert.equal(proceso.status, 0, `El generador copiado falló: ${proceso.stderr}`);
  const generada = await readFile(join(salida, 'db/seed.sql'), 'utf8');
  assert.ok(generada.startsWith('-- Generado por scripts/generar-seed.mjs. No editar a mano.'));
  assert.ok(generada.includes("where articulos.fuente = 'csv'"));
  assert.ok(generada.includes("delete from precios where fuente = 'csv'"));
  assert.ok(generada.includes("delete from puertos where fuente = 'csv'"));
  const preparacion = `-- PRUEBA E2SEED, exclusivamente en el esquema QA e2_seed_prueba.
-- El verificador comprueba destino y search_path antes de aplicar este archivo.
insert into proveedores (id, nombre) values ('${ids.proveedor}', 'E2SEED PROVEEDOR');
insert into articulos (id, marca, modelo, categoria, tipo, unidad, descripcion, observaciones, bobina_m, diametro_mm,
  longitudes_comerciales_m, coste, coste_orientativo, referencia_fabricante, unidades_instaladas, fuente) values
  ('${ids.cableApp}', 'E2SEED', '${modelos.cableApp}', 'E2SEED CABLE', 'cable', 'm', 'APP original conservada', 'Nota APP conservada', 305, 8, array[1,2]::numeric[], 42, false, 'APP-EXACTA', null, 'app'),
  ('${ids.cableCsv}', 'E2SEED', '${modelos.cableCsv}', 'E2SEED CABLE', 'cable', 'm', 'CSV anterior versión 1', null, 50, 4, array[1]::numeric[], 9, false, null, null, 'csv'),
  ('${ids.equipoApp}', 'E2SEED', '${modelos.equipoApp}', 'E2SEED EQUIPO', 'equipo', 'ud', 'Equipo APP conservado', null, null, null, null, 77, true, null, 10, 'app'),
  ('${ids.equipoCsv}', 'E2SEED', '${modelos.equipoCsv}', 'E2SEED EQUIPO', 'equipo', 'ud', 'Equipo CSV anterior', null, null, null, null, null, false, null, 11, 'csv');
insert into precios (id, articulo_id, proveedor_id, presupuesto, precio, precio_compra, unidades_por_compra, cantidad, referencia, notas, origen, moneda, fuente) values
  ('${ids.precioAppConflicto}', '${ids.cableApp}', '${ids.proveedor}', '${presupuestos.conflictoApp}', 8, 8, 1, 3, 'APP-OFERTA', 'Oferta APP conservada byte por byte', 'final', 'EUR', 'app'),
  ('${ids.precioAppAnterior}', '${ids.cableCsv}', '${ids.proveedor}', '${presupuestos.appAnterior}', 8, 800, 100, 1, null, 'Oferta APP anterior conservada', 'final', 'EUR', 'app'),
  ('${ids.precioCsvRetirado}', '${ids.cableCsv}', '${ids.proveedor}', '${presupuestos.csvRetirado}', 9, 9, 1, 1, null, 'Esta oferta CSV debe desaparecer', 'final', 'EUR', 'csv');
insert into puertos (id, articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente) values
  ('${ids.puertoApp}', '${ids.cableApp}', 'LAN APP', 1, 'entrada', 'red', 'RJ45 APP', 1, 'Puerto APP conservado byte por byte', 'app'),
  ('${ids.puertoCsvRetirado}', '${ids.cableCsv}', 'LAN CSV ANTIGUO', 1, 'entrada', 'red', 'RJ45 ANTIGUO', 1, 'Este puerto CSV debe desaparecer', 'csv');
`;
  await writeFile(join(salida, 'preparacion.sql'), preparacion);
  const despues = await fotosProtegidas();
  assert.deepEqual(despues, antes, 'La preparación ha cambiado una fuente real protegida.');
  const manifiesto = {
    fixture: 'PRUEBA-IMPORT-01 / E2SEED', esquema: 'e2_seed_prueba', sinConexionBD: true,
    generadorOriginalSinModificar: true, carpeta: salida, ids, marca: 'E2SEED', modelos,
    categorias: { cable: 'E2SEED CABLE', equipo: 'E2SEED EQUIPO' }, presupuestos,
    protegidoAntes: antes, protegidoDespues: despues,
    archivos: {},
    esperado: {
      catalogoAppIdsIntactos: [ids.cableApp, ids.equipoApp], preciosAppIdsIntactos: [ids.precioAppConflicto, ids.precioAppAnterior],
      puertosAppIdsIntactos: [ids.puertoApp],
      cableCsv: { id: ids.cableCsv, descripcion: 'CSV regenerada versión 2', bobina_m: 100, diametro_mm: 6,
        longitudes_comerciales_m: [3, 4], coste: 2, coste_orientativo: false, referencia_fabricante: 'CSV-EXACTA', fuente: 'csv' },
      equipoCsv: { id: ids.equipoCsv, unidades_instaladas: 222, fuente: 'csv' },
      preciosCsvEliminados: [ids.precioCsvRetirado], puertosCsvEliminados: [ids.puertoCsvRetirado],
      preciosCsvNuevos: [
        { articulo_id: ids.cableApp, presupuesto: presupuestos.csvSobreApp, precio: 1, precio_compra: 1, unidades_por_compra: 1, fuente: 'csv' },
        { articulo_id: ids.cableCsv, presupuesto: presupuestos.csvNuevo, precio: 2, precio_compra: 200, unidades_por_compra: 100, fuente: 'csv' },
      ],
      puertosCsvNuevos: [{ articulo_id: ids.cableCsv, nombre: 'LAN CSV NUEVO', total: 2, fuente: 'csv' }],
      referenciasTotales: 4, preciosTotales: 4, puertosTotales: 2,
    },
  };
  for (const nombre of ['scripts/generar-seed.mjs', 'scripts/normalizacion.mjs', 'preparacion.sql', 'db/seed.sql',
    ...Object.keys(datos).map(f => `data/${f}`)]) {
    manifiesto.archivos[nombre] = hash(await readFile(join(salida, nombre)));
  }
  await writeFile(join(salida, 'manifest.json'), `${JSON.stringify(manifiesto, null, 2)}\n`);
  console.log(`Fixture E2SEED preparada sin BD: ${salida}`);
  console.log(`Generador original SHA-256: ${antes['scripts/generar-seed.mjs']}`);
  console.log(`SQL sintético SHA-256: ${manifiesto.archivos['db/seed.sql']}`);
  console.log('Fuentes reales data/ y db/seed.sql conservadas; aplicar sólo por QA con destino y esquema comprobados.');
  return manifiesto;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepararSeedImportacion();

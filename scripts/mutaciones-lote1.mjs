/**
 * Ejecuta las mutaciones del Lote 1 y registra qué prueba cae con cada una.
 *
 *   node scripts/mutaciones-lote1.mjs
 *
 * No estima: rompe el código a propósito, ejecuta la suite que corresponde y
 * apunta el nombre de las pruebas que fallan. La PRIMERA de la lista es la
 * prueba primaria —la que afirma justo el contrato mutado— y el resto son
 * fallos en cascada, casi siempre porque el rechazo que no llegó dejó la sala
 * en otro estado o subió la versión.
 *
 * Cada mutación restaura el fichero al terminar, pase lo que pase.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MUTACIONES = [
  {
    nombre: 'Quitar el backfill de roles de la migración',
    fichero: 'db/migraciones/2026-08-rol-mobiliario.sql',
    de: "update catalogo_mobiliario set rol = 'asiento'\n where clave = 'silla' and rol is distinct from 'asiento';",
    a: '-- mutado: sin backfill',
    suite: 'npm run test:migracion',
    primaria: 'la migración se aplica sobre la versión anterior sin abortar',
  },
  {
    nombre: 'Quitar la postcondición de fuente única',
    fichero: 'src/app/acciones-diagrama.ts',
    de: "if (Number(estado.asientos) > 0 && estado.sillas_modo !== 'manuales') {\n      throw new GuardadoRechazado(fallo('sillas'));\n    }",
    a: '// mutado: sin postcondición',
    suite: 'npm run test:diagrama',
    primaria: 'un asiento que no apaga el aforo se rechaza: serían dos fuentes vivas',
  },
  {
    nombre: 'No anclar las sillas derivadas a la sala',
    fichero: 'src/lib/croquis.ts',
    de: '? anclarSillasEnLaSala(sillasAlrededor(mesa, sala.aforo), rectSala)',
    a: '? sillasAlrededor(mesa, sala.aforo)',
    suite: 'npm test',
    primaria: 'mesa pegada a la pared izquierda',
  },
  {
    nombre: 'Permitir superar el límite conjunto de altas',
    fichero: 'src/lib/plano-editor.ts',
    de: 'if (derivadas.length > MAXIMO_AFORO_MATERIALIZABLE) {',
    a: 'if (false) {',
    suite: 'npm test',
    primaria: 'un aforo por encima del límite no materializa ni inventa identificadores',
  },
  {
    nombre: 'Quitar la guarda de diagrama_iniciado_en',
    fichero: 'src/app/acciones-diagrama.ts',
    de: 'if (sala.diagrama_iniciado_en) {',
    a: 'if (false) {',
    suite: 'npm run test:diagrama',
    primaria: 'una sala que ya eligió Desde cero no acepta una plantilla, aunque esté vacía',
  },
  {
    nombre: 'Permitir Mesa principal desde plantilla · ruta Diagrama',
    fichero: 'src/app/acciones-diagrama.ts',
    de: "where pm.plantilla_id = ${plantillaId} and c.rol = 'mesa_principal'",
    a: 'where pm.plantilla_id = ${plantillaId} and false',
    suite: 'npm run test:diagrama',
    primaria: 'una plantilla con una mesa principal como mueble se rechaza entera',
  },
  {
    nombre: 'Permitir Mesa principal desde plantilla · ruta crearSala',
    fichero: 'src/app/acciones.ts',
    de: "where pm.plantilla_id = ${plantillaId} and c.rol = 'mesa_principal'",
    a: 'where pm.plantilla_id = ${plantillaId} and false',
    suite: 'npm run test:plantillas',
    primaria: 'una plantilla con una mesa principal como mueble no crea sala: daría dos mesas',
  },
  {
    nombre: 'Cualquier mueble apaga el aforo · ruta Diagrama',
    fichero: 'src/app/acciones-diagrama.ts',
    de: "where m.sala_id = ${salaId} and c.rol = 'asiento'",
    a: 'where m.sala_id = ${salaId}',
    suite: 'npm run test:diagrama',
    primaria: 'y el aforo sigue repartiendo las sillas: una mesa auxiliar no las sustituye',
  },
  {
    nombre: 'Cualquier mueble apaga el aforo · ruta crearSala',
    fichero: 'src/app/acciones.ts',
    de: "where m.sala_id = ${sala.id} and c.rol = 'asiento'",
    a: 'where m.sala_id = ${sala.id}',
    suite: 'npm run test:plantillas',
    primaria: 'y el aforo sigue repartiendo sus sillas: una mesa auxiliar no las sustituye',
  },
];

/** Los nombres de las pruebas que fallan, en el orden en que las imprime la suite. */
function caidas(salida, suite) {
  if (suite === 'npm test') {
    return [...salida.matchAll(/^ {2}✖ (.+?) \(\d/gm)].map((m) => m[1]);
  }
  return [...salida.matchAll(/^FALLO (.+)$/gm)].map((m) => m[1]);
}

/**
 * Escribe reintentando: en Windows el vigilante de ficheros del servidor de
 * desarrollo puede tener el fichero abierto un instante y el primer intento
 * falla con UNKNOWN. Sin esto, una mutación se cae por el sistema operativo y
 * no por lo que se está midiendo.
 */
function escribirConReintento(ruta, contenido, intentos = 20) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      writeFileSync(ruta, contenido);
      return;
    } catch (e) {
      if (i === intentos - 1) throw e;
      execSync('node -e "setTimeout(()=>{},150)"');
    }
  }
}

const filas = [];

for (const m of MUTACIONES) {
  const original = readFileSync(m.fichero, 'utf8');
  if (!original.includes(m.de)) {
    console.error(`\n### ${m.nombre}\n  PATRÓN NO ENCONTRADO en ${m.fichero}`);
    filas.push({ ...m, error: 'patrón no encontrado' });
    continue;
  }
  escribirConReintento(m.fichero, original.replace(m.de, m.a));
  let salida = '';
  try {
    salida = execSync(m.suite, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    salida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  } finally {
    escribirConReintento(m.fichero, original);
  }

  const lista = caidas(salida, m.suite);
  const primariaCae = lista.includes(m.primaria);
  filas.push({ ...m, lista, primariaCae });

  console.log(`\n### ${m.nombre}`);
  console.log(`  suite: ${m.suite}  ·  caen ${lista.length}`);
  console.log(`  primaria: ${primariaCae ? 'CAE' : 'NO CAE ← revisar'} · «${m.primaria}»`);
  const cascada = lista.filter((n) => n !== m.primaria);
  console.log(
    cascada.length ? `  cascada (${cascada.length}): ${cascada.join(' | ')}` : '  cascada: ninguna',
  );
}

console.log('\n\n==== resumen ====');
for (const f of filas) {
  const cascada = (f.lista ?? []).filter((n) => n !== f.primaria).length;
  console.log(
    `${f.primariaCae ? 'OK   ' : 'FALLO'} ${f.nombre} · primaria ${f.primariaCae ? 'cae' : 'NO cae'} · cascada ${cascada}`,
  );
}
const todas = filas.every((f) => f.primariaCae);
console.log(todas ? '\nTodas las mutaciones caen por su prueba primaria.' : '\nHay mutaciones sin prueba primaria.');
if (!todas) process.exit(1);

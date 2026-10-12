/**
 * `scripts/bloques-schema.mjs` es hoy la comprobación de equivalencia
 * bloque/migración de cinco runners SQL y el recorte de «esquema anterior a X»
 * de cuatro. Normalizar el fin de línea para comparar es justo el tipo de
 * arreglo que puede acabar comparando dos cadenas vacías sin que nadie lo note,
 * así que aquí se comprueba lo contrario: que sigue fallando cuando debe.
 *
 * Lógica pura sobre el `db/schema.sql` real: no escribe ficheros ni toca ninguna
 * base, así que entra en `npm test` por el glob `scripts/*.test.mjs`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { esquemaAnteriorA, exigirBloqueEquivalente } from './bloques-schema.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const esquema = readFileSync(join(raiz, 'db/schema.sql'), 'utf8');
const migracion = readFileSync(join(raiz, 'db/migraciones/2026-09-reserva-kits.sql'), 'utf8');
const BLOQUE = 'RESERVA KITS B2B';
const RUTA = 'db/migraciones/2026-09-reserva-kits.sql';

const DECLARACION = {
  'ROSETAS CONEXIONES L2B': false,
  'TIRADAS DOCUMENTALES L2B': false,
  'SUMINISTROS KIT L3A': false,
  'ATRIBUCIONES SUMINISTRO L3B': false,
  'RECEPCION KITS B2A': false,
  'RESERVA KITS B2B': true,
  'CARGA KITS B2C': true,
  'ETIQUETAS CABLE GENERADAS': false,
  'REVISION DISENO L5': false,
  'CABLES SUMINISTRADOS L3C': false,
};

// Una línea real del bloque, alterada en su contenido y no en su fin de línea.
const ANCLA = 'if new.disponible_previo<1 then';
const ALTERADA = 'if new.disponible_previo<99 then';

test('El ancla causal sigue existiendo en los dos ficheros', () => {
  assert.equal(esquema.split(ANCLA).length, 2);
  assert.equal(migracion.split(ANCLA).length, 2);
});

test('Mismo SQL con fines de línea distintos es equivalente', () => {
  exigirBloqueEquivalente(esquema, migracion, BLOQUE, RUTA);
  exigirBloqueEquivalente(esquema.replaceAll('\r\n', '\n'), migracion, BLOQUE, RUTA);
});

test('Una línea alterada en el esquema deja de ser equivalente', () => {
  assert.throws(
    () => exigirBloqueEquivalente(esquema.replace(ANCLA, ALTERADA), migracion, BLOQUE, RUTA),
    /no son equivalentes/,
  );
});

test('Una línea alterada en la migración deja de ser equivalente', () => {
  assert.throws(
    () => exigirBloqueEquivalente(esquema, migracion.replace(ANCLA, ALTERADA), BLOQUE, RUTA),
    /no son equivalentes/,
  );
});

test('El bloque ausente falla en vez de comparar dos vacíos', () => {
  const sinBloque = (texto) => texto.replace(/-- BEGIN RESERVA KITS B2B[\s\S]*?-- END RESERVA KITS B2B/, '');
  assert.throws(() => exigirBloqueEquivalente(sinBloque(esquema), migracion, BLOQUE, RUTA), /Falta el bloque/);
  assert.throws(() => exigirBloqueEquivalente(esquema, sinBloque(migracion), BLOQUE, RUTA), /Falta el bloque/);
  // El defecto que esto cierra: ausente en los dos lados también falla.
  assert.throws(() => exigirBloqueEquivalente(sinBloque(esquema), sinBloque(migracion), BLOQUE, RUTA), /Falta el bloque/);
});

test('La clasificación real de bloques recorta el esquema anterior', () => {
  const previo = esquemaAnteriorA(esquema, BLOQUE, DECLARACION);
  assert.doesNotMatch(previo, /-- BEGIN RESERVA KITS B2B/);
  assert.doesNotMatch(previo, /-- BEGIN CARGA KITS B2C/);
  assert.match(previo, /-- BEGIN SUMINISTROS KIT L3A/);
  assert.match(previo, /-- BEGIN ETIQUETAS CABLE GENERADAS/);
});

test('Un bloque nuevo sin clasificar detiene el recorte', () => {
  const conNuevo = esquema.replace(
    '-- BEGIN ETIQUETAS CABLE GENERADAS',
    '-- BEGIN BLOQUE NUEVO SIN CLASIFICAR\ncreate table if not exists qa_bloque_nuevo(id uuid primary key);\n-- END BLOQUE NUEVO SIN CLASIFICAR\n-- BEGIN ETIQUETAS CABLE GENERADAS',
  );
  assert.throws(() => esquemaAnteriorA(conNuevo, BLOQUE, DECLARACION), /sin clasificar/);
});

test('Una dependencia real declarada como independiente falla', () => {
  assert.throws(
    () => esquemaAnteriorA(esquema, BLOQUE, { ...DECLARACION, 'CARGA KITS B2C': false }),
    /no coincide con la declarada/,
  );
});

test('Un bloque independiente declarado como dependiente falla', () => {
  assert.throws(
    () => esquemaAnteriorA(esquema, BLOQUE, { ...DECLARACION, 'ETIQUETAS CABLE GENERADAS': true }),
    /no coincide con la declarada/,
  );
});

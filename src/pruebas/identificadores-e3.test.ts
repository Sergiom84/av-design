import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PREFIJO_CABLE } from '../lib/tipos';

test('la migración que congela etiquetas replica deliberadamente los prefijos canónicos', () => {
  const sql = readFileSync(new URL('../../db/migraciones/2026-10-e3-revisiones.sql', import.meta.url), 'utf8');
  const casos = [...sql.matchAll(/when '([a-z_]+)' then '([A-Z]+)'/g)];
  for (const [senal, prefijo] of Object.entries(PREFIJO_CABLE)) {
    if (senal === 'otro') {
      assert.equal((sql.match(new RegExp(`else '${prefijo}' end`, 'g')) ?? []).length, 2);
    } else {
      const apariciones = casos.filter(([, clave]) => clave === senal);
      assert.equal(apariciones.length, 2, `Backfill y altas deben cubrir ${senal}`);
      for (const [, , valor] of apariciones) assert.equal(valor, prefijo);
    }
  }
});

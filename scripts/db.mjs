/**
 * Aplica un fichero .sql contra DATABASE_URL.
 *
 *   node scripts/db.mjs db/schema.sql
 *   node scripts/db.mjs db/seed.sql
 */

import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';
import postgres from 'postgres';

const fichero = argv[2];
if (!fichero) {
  console.error('Uso: node scripts/db.mjs <fichero.sql>');
  exit(1);
}

const url =
  process.env.DATABASE_URL ??
  'postgres://av_design:av_design_local@localhost:5433/av_design';

const sql = postgres(url, {
  max: 1,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
});

try {
  await sql.unsafe(readFileSync(fichero, 'utf8'));
  console.log(`aplicado ${fichero}`);
} catch (e) {
  console.error(`error aplicando ${fichero}:`);
  console.error(e.message);
  exit(1);
} finally {
  await sql.end();
}

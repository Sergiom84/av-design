/** Gate estructural exclusivo de la nueva base sintética REA09. Sin runtime acreditado. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, fotografiarRevisiones, crearIdentidadesConsultas, idConsulta } from './rea09-fixture.mjs';

const url = process.env.REA09_DATABASE_URL;
if (!url) throw new Error('REA09_DATABASE_URL explícita obligatoria.');
const sql = await conectarRevisiones(url);
const salida = resolve('output/rea-integracion/rea09/esquema');
await mkdir(salida, { recursive: true });
const checks: string[] = [];
const ok = (mensaje: string) => { checks.push(mensaje); console.log(`OK ${mensaje}`); };
const migracion = await readFile('db/migraciones/2026-10-rea09-consultas.sql', 'utf8');
const rollback = await readFile('db/migraciones/rollback/2026-10-rea09-consultas.sql', 'utf8');
const ejecutarRollback = async () => {
  const c = await sql.reserve();
  try { await c.unsafe(rollback); }
  finally { await c.unsafe('rollback'); c.release(); }
};
const propias = ['consultas_conversaciones', 'consultas_turnos', 'consultas_contenidos'];
const sinConsultas = (foto: Awaited<ReturnType<typeof fotografiarRevisiones>>) =>
  foto.tablas.filter(f => !propias.includes(f.tabla));
try {
  const antes = await fotografiarRevisiones(sql);
  assert.ok(!antes.tablas.some(t => propias.includes(t.tabla)), 'No repetir sobre esquema ya aplicado; conserva la evidencia.');
  await writeFile(resolve(salida, 'base-antes.json'), JSON.stringify(antes, null, 2));
  await sql.unsafe(migracion);
  const conTablas = await fotografiarRevisiones(sql);
  assert.equal(conTablas.tablas.length, antes.tablas.length + 3);
  assert.deepEqual(sinConsultas(conTablas), antes.tablas);
  await ejecutarRollback();
  assert.deepEqual(await fotografiarRevisiones(sql), antes);
  ok('Migración aditiva y rollback vacío restituyen exactamente las tablas y filas iniciales.');
  await sql.unsafe(migracion);
  await sql.unsafe(migracion);
  assert.deepEqual(sinConsultas(await fotografiarRevisiones(sql)), antes.tablas);
  ok('Reaplicación idempotente sin alterar tablas previas.');
  await crearIdentidadesConsultas(sql);
  const base = await fotografiarRevisiones(sql);
  const conversacion = idConsulta(100), turno = idConsulta(101), clave = idConsulta(102);
  assert.equal((await sql`select id from consultas_conversaciones where id=${conversacion}`).length, 0);
  await sql`insert into consultas_conversaciones(id,propietario_id,ambito,caduca_en)
    values(${conversacion},${idConsulta(1)},${sql.json({ tipo: 'catalogo' })},now()+30*interval '1 day')`;
  await assert.rejects(sql.begin(async tx => {
    await tx`insert into consultas_turnos(id,conversacion_id,propietario_id,numero,clave_peticion,entrada_sha256,intent,motor,acl_fuentes,observado_en,captura_sha256)
      values(${turno},${conversacion},${idConsulta(2)},1,${clave},${'a'.repeat(64)},'catalogo','local-1',${tx.json({ version: 1, fuentes: [] })},now(),${'b'.repeat(64)})`;
  }), /foreign key|llave foránea/i);
  await sql.begin(async tx => {
    await tx`insert into consultas_turnos(id,conversacion_id,propietario_id,numero,clave_peticion,entrada_sha256,intent,motor,acl_fuentes,observado_en,captura_sha256)
      values(${turno},${conversacion},${idConsulta(1)},1,${clave},${'a'.repeat(64)},'catalogo','local-1',${tx.json({ version: 1, fuentes: [] })},now(),${'b'.repeat(64)})`;
    await tx`insert into consultas_contenidos(turno_id,pregunta,respuesta) values(${turno},'PRUEBA-REA09 catálogo',${tx.json({ versionModelo: 1, hechos: [] })})`;
    await tx`update consultas_conversaciones set version=1 where id=${conversacion} and version=0`;
  });
  await assert.rejects(sql.begin(async tx => {
    await tx`update consultas_turnos set intent='medidas' where id=${turno}`;
  }), /no se sobrescribe/);
  await assert.rejects(sql.begin(async tx => {
    await tx`update consultas_contenidos set pregunta='Otra pregunta' where turno_id=${turno}`;
  }), /no se sobrescribe/);
  await assert.rejects(sql.begin(async tx => {
    await tx`update consultas_conversaciones set propietario_id=${idConsulta(2)},version=2 where id=${conversacion}`;
  }), /conserva propietario/);
  await assert.rejects(sql.begin(async tx => {
    await tx`update consultas_conversaciones set ambito=${tx.json({ tipo: 'sala', id: idConsulta(200) })},version=2 where id=${conversacion}`;
  }), /conserva propietario/);
  await assert.rejects(sql.begin(async tx => {
    await tx`update consultas_conversaciones set version=1 where id=${conversacion}`;
  }), /avanza una versión/);
  await sql`update consultas_conversaciones set version=2,retencion_dias=7,caduca_en=creado_en+7*interval '1 day' where id=${conversacion} and version=1`;
  ok('FK de propietario, historial inmutable, identidad/ámbito fijos y avance CAS de retención.');
  const historia = await fotografiarRevisiones(sql);
  await writeFile(resolve(salida, 'historia-sintetica.json'), JSON.stringify(historia, null, 2));
  await assert.rejects(ejecutarRollback(), /historia REA09/);
  assert.deepEqual(await fotografiarRevisiones(sql), historia);
  ok('Rollback con historia rechazado sin modificar ninguna tabla ni fila.');
  await sql`delete from consultas_conversaciones where id=${conversacion} and propietario_id=${idConsulta(1)} and version=2`;
  for (const tabla of propias) {
    const [{ n }] = await sql.unsafe(`select count(*)::int n from ${tabla}`);
    assert.equal(n, 0);
  }
  const final = await fotografiarRevisiones(sql);
  assert.deepEqual(sinConsultas(final), sinConsultas(base));
  await writeFile(resolve(salida, 'base-final.json'), JSON.stringify(final, null, 2));
  ok('Purga de la conversación sintética propia elimina sólo su contenido; hechos físicos e identidades permanecen idénticos.');
  await writeFile(resolve(salida, 'resultado.json'), JSON.stringify({ checks, tablasAntes: antes.tablas.length,
    tablasFinales: final.tablas.length, limite: 'Sólo SQL estructural en5562; sin servicio, ACL de aplicación, voz, HTTP ni UI acreditados.' }, null, 2));
} finally { await sql.end(); }

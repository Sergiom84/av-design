/** Núcleos E2 reales, sólo base sintética5553 y transacciones revertidas. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { conectarImportacion, fotografiarImportacion, FIXTURE_IMPORTACION as f } from './rea10-puente-e2-fixture.mjs';
import type { EntradaImportacion } from '../src/lib/importacion/modelo';
const { confirmarImportacionEnTransaccion, previsualizarImportacion, revisarSeleccionImportacion, revertirLoteEnTransaccion } = await import('../src/lib/importacion/index');
const { crearLocalizacionEnTransaccion, crearSalaMinimaEnTransaccion } = await import('../src/lib/jerarquia-transaccional');

const salida = resolve('output/rea-integracion/rea10/puente-e2');
await mkdir(salida, { recursive: true });
const url = process.env.REA01_REGRESIONES_DATABASE_URL;
assert.ok(url, 'URL sintética explícita obligatoria.');
const sql = await conectarImportacion(url);
const consultas: string[] = [];
const espia = postgres(url, { max: 1, ssl: false, onnotice: () => {}, debug: (_id, consulta) => consultas.push(consulta) });
const entrada = (salaId: string): EntradaImportacion => ({ destino: 'bom', salaId,
  origen: 'PRUEBA-REA10-PUENTE-E2', archivo: { nombre: 'bom-derivada-sintetica.csv',
    bytes: new TextEncoder().encode('referencia;unidad;cantidad\nE2-QB65R;ud;3\n') } });
const comprobaciones: string[] = [];
try {
  const antes = await fotografiarImportacion(sql);
  await writeFile(resolve(salida, 'antes.json'), JSON.stringify(antes, null, 2));
  const preview = await previsualizarImportacion(espia, entrada(f.sala));
  assert.equal(preview.filas[0].candidatos[0].id, f.pantalla);
  await previsualizarImportacion(espia, { ...entrada(f.sala), destino: 'catalogo', salaId: undefined });
  assert.ok(consultas.length >= 3);
  assert.equal(consultas.some(c => /\b(coste|coste_orientativo|precios|moneda|tarifas|clave_hash)\b/iu.test(c)), false);
  comprobaciones.push('Preview BOM/catálogo real sin SQL de dinero ni escrituras.');

  const fallo = new Error('ROLLBACK SINTETICO REA10');
  const aplicar = async (tx: postgres.TransactionSql<Record<string, unknown>>, salaId: string) => {
    const e = entrada(salaId);
    const p = await previsualizarImportacion(tx, e);
    const seleccion = [{ fila: p.filas[0].fila, articuloId: f.pantalla,
      revisionArticulo: p.filas[0].candidatos[0].revision }];
    const revisada = await revisarSeleccionImportacion(tx, e, seleccion);
    return confirmarImportacionEnTransaccion(tx, e, seleccion, f.admin, { previewHash: revisada.previewHash });
  };
  await assert.rejects(sql.begin(async tx => {
    const [pid] = await tx`select pg_backend_pid() as pid`;
    const localizacionNueva = await crearLocalizacionEnTransaccion(tx, f.proyecto, 'PRUEBA-REA10-PUENTE ' + randomUUID());
    const salaNueva = await crearSalaMinimaEnTransaccion(tx, { proyectoId: f.proyecto, localizacionId: localizacionNueva,
      nombre: 'PRUEBA-REA10-PUENTE nueva', codigo: null, medidas: { largo_m: null, ancho_m: null, alto_m: null },
      procedencia: 'Fuente sintética puente E2', aceptarHomonimo: false });
    const [sala] = await tx`select sede_id,largo_m,ancho_m,alto_m,notas from salas where id=${salaNueva}`;
    assert.equal(sala.sede_id,f.sede); assert.equal(Number(sala.largo_m),0);
    assert.match(String(sala.notas), /pendiente de comprobación física/u);
    const lote = await aplicar(tx, f.sala);
    const [primera] = await tx`select cantidad::text as cantidad from sala_material_bom where lote_id=${lote.id}`;
    assert.equal(primera.cantidad, '3.00');
    const e = entrada(salaNueva);
    const p = await previsualizarImportacion(tx, e);
    const s = [{ fila: p.filas[0].fila, articuloId: f.pantalla, revisionArticulo: p.filas[0].candidatos[0].revision }];
    const revisada = await revisarSeleccionImportacion(tx, e, s);
    const [pidFinal] = await tx`select pg_backend_pid() as pid`;
    assert.equal(pidFinal.pid, pid.pid);
    await confirmarImportacionEnTransaccion(tx, e, s, f.admin,
      { previewHash: revisada.previewHash, fallarDespuesDeFila: 1 });
  }), /Fallo sintético a mitad del lote/u);
  assert.deepEqual(await fotografiarImportacion(sql), antes);
  comprobaciones.push('Fallo de segunda BOM revierte primera BOM, ambos lotes y sala nueva en una sola transacción.');

  await assert.rejects(sql.begin(async tx => {
    const lote = await aplicar(tx, f.sala);
    const revertido = await revertirLoteEnTransaccion(tx, lote.id, f.admin);
    assert.equal(revertido.estado, 'revertido');
    const [{ n }] = await tx`select count(*)::int as n from sala_material_bom where lote_id=${lote.id}`;
    assert.equal(n, 0);
    throw fallo;
  }), e => e === fallo);
  const despues = await fotografiarImportacion(sql);
  assert.deepEqual(despues, antes);
  comprobaciones.push('Reversión real E2 usa la misma transacción; rollback exterior conserva todas las tablas.');
  await writeFile(resolve(salida, 'despues.json'), JSON.stringify(despues, null, 2));
  await writeFile(resolve(salida, 'spy-tecnico.json'), JSON.stringify(consultas, null, 2));
  await writeFile(resolve(salida, 'resultado.json'), JSON.stringify({ comprobaciones,
    consultasTecnicas: consultas.length, base: 'av_design_rea01_regresiones',
    shaAntes: antes.sha256, shaDespues: despues.sha256, tablas: antes.tablas.length }, null, 2));
  console.log(JSON.stringify({ resultado: 'OK', comprobaciones: comprobaciones.length, tablasIdenticas: antes.tablas.length }));
} finally {
  await espia.end();
  await sql.end();
}

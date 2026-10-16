/** Gate REA01 B: exclusivo 5552, IDs propios; no usa .env.local ni datos reales. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { conectarRevisiones, comprobarUrlRevisiones, FIXTURE_REVISIONES as f } from './rea01-fixture.mjs';
import type { EntradaImportacion, SeleccionFila, SqlImportacion } from '../src/lib/importacion/modelo';

const salida = resolve('output/rea-integracion/rea01/b'); await mkdir(salida, { recursive: true });
const url = process.env.REA_DATABASE_URL;
if (!url) throw new Error('REA_DATABASE_URL explícita obligatoria.');
for (const texto of [url.replace('5552', '5550'), url.replace('5552', '5551'), `${url}?sslmode=require`]) assert.throws(() => comprobarUrlRevisiones(texto));
const sql = await conectarRevisiones(url);
const db = sql as unknown as SqlImportacion;
const { previsualizarImportacion, revisarSeleccionImportacion, confirmarImportacion, obtenerArchivoLote, obtenerLote, revertirLote, serializarCanonico } = createRequire(import.meta.url)('../src/lib/importacion/index.ts') as typeof import('../src/lib/importacion/index');
const id = (n: number) => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const salaId = id(9000);
const checks: string[] = []; const ok = (m: string) => { checks.push(m); console.log(`OK ${m}`); };
const fuente = (texto: string): EntradaImportacion => ({ destino: 'bom', salaId, origen: 'PRUEBA-REA01-B · lista sintética', archivo: { nombre: 'PRUEBA-REA01-B.csv', bytes: new TextEncoder().encode(texto) } });
const entrada = fuente('referencia;unidad;cantidad\nREA01-B-ORIG;ud;3\nREA01-B-DESCONOCIDO;m;12,75\nREA01-B-AMB;ud;2');
const elecciones: SeleccionFila[] = [
  { fila: 2, articuloId: id(2), alternativa: { articuloOriginalId: id(1), tipoOrigen: 'equipo', fuenteTipo: 'catalogo', motivo: 'Disponibilidad del modelo alternativo' } },
  { fila: 3, articuloId: id(3), alternativa: { articuloOriginalId: null, tipoOrigen: 'cable', fuenteTipo: 'confirmado_por_usuario', motivo: 'Cable identificado por el técnico' } },
];
const foto = async () => {
  const r: Record<string, unknown> = {};
  for (const tabla of ['importacion_lotes', 'importacion_cambios', 'sala_material_bom', 'movimientos', 'reservas', 'pedidos', 'pedido_lineas', 'cargas', 'carga_lineas', 'hitos_sala', 'hitos_proyecto', 'revisiones_diseno', 'sala_equipos', 'conexiones', 'conexion_bocas', 'sala_mobiliario', 'tomas_red']) {
    r[tabla] = await sql.unsafe(`select to_jsonb(t) as dato from "${tabla}" t order by to_jsonb(t)::text`);
  }
  r.sala = await sql`select to_jsonb(s) as dato from salas s where id=${salaId}`;
  r.articulos = await sql`select to_jsonb(a) as dato from articulos a where id::text like 'b1000000-%' order by id`;
  return r;
};
const revisar = async (s = elecciones, e = entrada) => revisarSeleccionImportacion(db, e, s);
const rechazar = async (operacion: () => Promise<unknown>, patron: RegExp) => {
  const antes = await foto(); await assert.rejects(operacion(), patron); assert.deepEqual(await foto(), antes);
};
try {
  await sql.begin(async tx => {
    await tx`insert into salas(id,nombre,codigo,sede_id,localizacion_id,largo_m,ancho_m,alto_m) values
      (${salaId},'PRUEBA-REA01-B · alternativas BOM','PRUEBA-REA01-B',${f.sede},${f.localizacion},6,4,3) on conflict(id) do nothing`;
    const refs = [[1,'ORIG','equipo','ud',true],[2,'ALTERNATIVO','equipo','ud',true],[3,'CABLE','cable','m',true],
      [4,'OTRO-TIPO','consumible','ud',true],[5,'INACTIVO','equipo','ud',false],[6,'AMB-1','equipo','ud',true],[7,'AMB-2','equipo','ud',true]] as const;
    for (const [n, ref, tipo, unidad, activo] of refs) await tx`insert into articulos(id,referencia,referencia_fabricante,tipo,categoria,marca,modelo,unidad,activo,fuente)
      values(${id(n)},${`REA01-B-${ref}`},${n === 6 || n === 7 ? 'REA01-B-AMB' : null},${tipo}::tipo_articulo,'PRUEBA','REA01-B',${`Modelo ${ref}`},${unidad}::unidad_medida,${activo},'app') on conflict(id) do nothing`;
  });
  const inicial = await foto(); await writeFile(resolve(salida, 'bd-inicial.json'), JSON.stringify(inicial, null, 2));
  const base = await previsualizarImportacion(db, entrada); const vista = await revisar();
  assert.deepEqual(await foto(), inicial); assert.ok(vista.seleccionRevisada); assert.notEqual(vista.previewHash, base.previewHash);
  assert.deepEqual(vista.seleccionRevisada.map(d => [d.cantidad,d.unidad,d.destino.id]), [[3,'ud',id(2)],[12.75,'m',id(3)]]);
  const seleccion = vista.seleccionRevisada.map(d => d.seleccion);
  assert.equal((await revisar([...elecciones].reverse())).previewHash, vista.previewHash);
  ok('segunda revisión sin escrituras; hash canónico, originales, tipos, revisiones y 3 ud / 12,75 m');
  await rechazar(() => confirmarImportacion(db, entrada, seleccion, f.admin), /revisa|revisión/i);
  await rechazar(() => confirmarImportacion(db, entrada, seleccion, f.admin, { previewHash: base.previewHash }), /cambi|revisi/i);
  await rechazar(() => confirmarImportacion(db, entrada, seleccion.map(s => ({ ...s, revisionArticulo: undefined })), f.admin, { previewHash: vista.previewHash }), /revisi/i);
  await rechazar(() => confirmarImportacion(db, entrada, [{ ...seleccion[0], alternativa: { ...seleccion[0].alternativa!, motivo: 'Otro motivo' } }, seleccion[1]], f.admin, { previewHash: vista.previewHash }), /cambi/i);
  await rechazar(() => confirmarImportacion(db, { ...entrada, origen: 'Otra fuente' }, seleccion, f.admin, { previewHash: vista.previewHash }), /cambi/i);
  await rechazar(() => confirmarImportacion(db, fuente('referencia;unidad;cantidad\nREA01-B-ORIG;ud;4\nREA01-B-DESCONOCIDO;m;12,75\nREA01-B-AMB;ud;2'), seleccion, f.admin, { previewHash: vista.previewHash }), /cambi/i);
  await rechazar(() => confirmarImportacion(db, entrada, [{ ...seleccion[0], cantidad: 99 } as SeleccionFila], f.admin, { previewHash: vista.previewHash }), /selecci/i);
  for (const destino of [id(3),id(4),id(5)]) await rechazar(() => revisar([{ ...elecciones[0], articuloId: destino }]), /tipo|unidad|activ/i);
  await rechazar(() => revisar([{ fila: 4, articuloId: id(2), alternativa: { ...elecciones[0].alternativa!, articuloOriginalId: null } }]), /original/i);
  await rechazar(() => revisar([{ ...elecciones[0], alternativa: { ...elecciones[0].alternativa!, motivo: '' } }]), /selecci|motivo/i);
  await rechazar(() => revisar(elecciones, fuente('referencia;unidad;cantidad\nREA01-B-ORIG;ud;-1')), /rechazada/i);
  for (const destino of ['precios', 'catalogo'] as const) await rechazar(() => confirmarImportacion(db, { ...entrada, destino, salaId: undefined }, elecciones, f.admin), /BOM/i);
  await rechazar(() => confirmarImportacion(db, { ...entrada, salaId: f.cerrada }, seleccion, f.admin, { previewHash: vista.previewHash }), /cerrada/i);
  ok('servicio directo rechaza hash base/ausente, revisión ausente, contexto/motivo/cantidad adulterados, tipo/unidad/inactivo y origen ambiguo sin lote parcial');
  await sql`update articulos set modelo='ABA temporal B' where id=${id(2)}`;
  await sql`update articulos set modelo='Modelo ALTERNATIVO' where id=${id(2)}`;
  await rechazar(() => confirmarImportacion(db, entrada, seleccion, f.admin, { previewHash: vista.previewHash }), /revisi|modific/i);
  ok('ABA de catálogo: mismo modelo restaurado rechaza la revisión anterior');
  const revisada = await revisar(); const finales = revisada.seleccionRevisada!.map(d => d.seleccion);
  await rechazar(() => confirmarImportacion(db, entrada, finales, f.admin, { previewHash: revisada.previewHash, fallarDespuesDeFila: 1 }), /sintético/i);
  const antesConfirmar = await foto();
  const lote = await confirmarImportacion(db, entrada, finales, f.admin, { previewHash: revisada.previewHash });
  const partidas = await sql`select articulo_id,cantidad::float as cantidad,unidad from sala_material_bom where lote_id=${lote.id} order by articulo_id`;
  assert.deepEqual(partidas.map(p => [p.articulo_id,p.cantidad,p.unidad]), [[id(2),3,'ud'],[id(3),12.75,'m']]);
  assert.equal(lote.informe[0].alternativa?.autorId, f.admin); assert.equal(lote.informe[0].alternativa?.previewHash, revisada.previewHash);
  assert.equal(lote.informe[0].alternativa?.original?.id, id(1)); assert.equal(lote.informe[1].alternativa?.fuenteTipo, 'confirmado_por_usuario');
  const archivo = await obtenerArchivoLote(db,lote.id,f.admin); assert.ok(archivo); assert.deepEqual(archivo.bytes,entrada.archivo.bytes);
  assert.equal(await obtenerLote(db,lote.id,f.lectura),null); assert.equal(await obtenerArchivoLote(db,lote.id,f.lectura),null);
  const despuesConfirmar = await foto();
  for (const tabla of ['movimientos','reservas','pedidos','pedido_lineas','cargas','carga_lineas','hitos_sala','hitos_proyecto','revisiones_diseno','sala_equipos','conexiones','conexion_bocas','sala_mobiliario','tomas_red','articulos']) assert.deepEqual(despuesConfirmar[tabla],antesConfirmar[tabla]);
  const limpio = await revertirLote(db,lote.id,f.admin); assert.equal(limpio.estado,'revertido'); assert.deepEqual(limpio.informe,lote.informe);
  ok('rollback intermedio total; commit sólo partidas elegidas, fuente idéntica, autor/hash/traza duraderos, propiedad y reversión limpia');
  const ambigua = await revisar([{ fila: 4, articuloId: id(2), alternativa: { ...elecciones[0].alternativa!, articuloOriginalId: id(6) } }]);
  const loteAmbiguo = await confirmarImportacion(db, entrada, ambigua.seleccionRevisada!.map(d=>d.seleccion), f.admin, { previewHash: ambigua.previewHash });
  assert.equal(loteAmbiguo.informe[2].alternativa?.original?.id, id(6));
  assert.equal((await revertirLote(db,loteAmbiguo.id,f.admin)).estado,'revertido');
  ok('origen ambiguo explícito confirmado y trazado; fila corrupta, motivo vacío y alternativas catálogo/precios rechazados');
  const nueva = await revisar(); const comprometido = await confirmarImportacion(db,entrada,nueva.seleccionRevisada!.map(d=>d.seleccion),f.admin,{previewHash:nueva.previewHash});
  const [reserva] = await sql`insert into reservas(sala_id,articulo_id,cantidad,notas) values(${salaId},${id(2)},1,'PRUEBA-REA01-B · compromiso posterior') returning id`;
  const reservasAntes = await sql`select to_jsonb(r) as dato from reservas r where id=${reserva.id}`;
  const parcial = await revertirLote(db,comprometido.id,f.admin); assert.equal(parcial.estado,'reversion_parcial');
  assert.ok(parcial.reversion.some(r=>r.estado==='conservado')); assert.deepEqual(parcial.informe,comprometido.informe);
  assert.deepEqual(await sql`select to_jsonb(r) as dato from reservas r where id=${reserva.id}`,reservasAntes);
  ok('reversión conserva material comprometido y reserva posterior; no pierde la evidencia de la alternativa');
  const final = await foto();
  await writeFile(resolve(salida,'bd-final.json'),JSON.stringify(final,null,2));
  await writeFile(resolve(salida,'gate.json'),JSON.stringify({salaId,checks,lotes:[lote,limpio,comprometido,parcial],preview:revisada,huellaFinal:createHash('sha256').update(serializarCanonico(final)).digest('hex')},null,2));
} finally { await sql.end(); }

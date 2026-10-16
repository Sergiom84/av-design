/** Gate de autor del puente10→09. Sólo añade datos propios a la base sintética5565. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import Module from 'node:module';
import { resolve } from 'node:path';
import postgres from 'postgres';
import PDFDocument from 'pdfkit';
import { FIXTURE_DOCUMENTOS as f } from './documentos-fixture.mjs';
import type { FuenteConsulta, RespuestaConsulta } from '../src/lib/consultas/modelo';
import type { Candidato } from '../src/lib/requisitos/modelo';

const URL_PERMITIDA = 'postgres://av_design_rea10_puente:av_design_rea10_puente_local@127.0.0.1:5565/av_design_rea10_puente_prueba';
assert.equal(process.env.REA10_CONSULTAS_DATABASE_URL, URL_PERMITIDA, 'URL explícita5565 obligatoria; no .env, schema, reset ni otras bases.');
const url = new URL(process.env.REA10_CONSULTAS_DATABASE_URL!);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '5565');
assert.equal(url.pathname, '/av_design_rea10_puente_prueba'); assert.equal(url.username, 'av_design_rea10_puente');
assert.equal(url.search + url.hash, '');
const fecha = new Date().toISOString().replace(/[:.]/g, '-'), run = randomUUID();
const salida = resolve('output/rea-integracion/rea10/integracion-consultas-20261016', `sql-${fecha}-${run.slice(0, 8)}`);
await mkdir(salida, { recursive: false });
const log = await open(resolve(salida, 'ejecucion.log'), 'wx', 0o600);
const guardar = (nombre: string, dato: unknown) => writeFile(resolve(salida, nombre), JSON.stringify(dato, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const registrar = async (mensaje: string) => { console.log(mensaje); await log.write(mensaje + '\n'); };
const m = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }, previo = m._load;
m._load = (id, ...args) => id === 'server-only' ? {} : previo.call(Module, id, ...args);
const { RepositorioRequisitos } = await import('../src/lib/requisitos/repositorio');
const { PlanesRequisitos } = await import('../src/lib/requisitos/planes');
const { RepositorioConsultas } = await import('../src/lib/consultas/repositorio');
const { ErrorConsulta } = await import('../src/lib/consultas/modelo');
const { hashConsulta } = await import('../src/lib/consultas/lectores');
const { leerFuenteRequisito } = await import('../src/lib/requisitos/consulta');
const { hash, hashBytes } = await import('../src/lib/requisitos/modelo');
const { identidad } = await import('../src/lib/requisitos/fuentes');
const { guardarArchivoTecnico } = await import('../src/lib/catalogo-tecnico-repositorio');
const { validarArchivoTecnicoCompleto } = await import('../src/lib/catalogo-tecnico');
const { cifrarClave } = await import('../src/lib/contrasena');

interface Sentencia { orden: number; sql: string; parametros: unknown[] }
const traza: Sentencia[] = [];
const db = postgres(URL_PERMITIDA, { max: 5, ssl: false, onnotice: () => {} });
const espia = postgres(URL_PERMITIDA, { max: 5, ssl: false, onnotice: () => {}, debug(_conexion, sql, parametros) {
  traza.push({ orden: traza.length, sql: sql.replace(/\s+/g, ' ').trim(), parametros: Array.from(parametros) });
} });
const repo10 = new RepositorioRequisitos(db), planes = new PlanesRequisitos(db, 'rea10-consultas-secreto-sintetico-exclusivo-2026');
const repo09 = new RepositorioConsultas(espia);
const usuario = randomUUID(), otro = randomUUID(), salaPropia = randomUUID();
const ids: Record<string, unknown> = { run, usuario, otro, salaPropia, proyecto: f.proyecto, localizacion: f.localizacion };
const resultados: Array<{ caso: string; estado: 'OK' | 'ROJO'; evidencia?: unknown; error?: unknown }> = [];
type FilasBase = Record<string, string[]>;
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function fotografiar() {
  return db.begin('isolation level repeatable read read only', async tx => {
    const tablas = await tx`select tablename from pg_tables where schemaname='public' order by tablename`;
    const filas: FilasBase = {}, fotos = [];
    for (const { tablename } of tablas) {
      assert.match(String(tablename), /^[a-z_]+$/);
      filas[tablename] = (await tx.unsafe(`select to_jsonb(t)::text as fila from "${tablename}" t order by to_jsonb(t)::text`)).map(r => String(r.fila));
      fotos.push({ tabla: tablename, filas: filas[tablename].length, sha256: sha(filas[tablename]) });
    }
    return { base: url.pathname.slice(1), sha256: sha(fotos), tablas: fotos, filas };
  });
}
function trozo(desde: number) { return traza.slice(desde); }
function selectContenido(t: Sentencia) { return /^select\b/i.test(t.sql) && /\bconsultas_contenidos\b/i.test(t.sql); }
function selectFragmentos(t: Sentencia) { return /^select\b/i.test(t.sql) && /(?:e\.resultado|\bresultado\s+from\s+requisitos_extracciones)/i.test(t.sql); }
function selectPrivado(t: Sentencia) { return selectContenido(t) || selectFragmentos(t) || /^select\b/i.test(t.sql) && /\brequisitos_contenidos\b/i.test(t.sql); }
function autorizo(t: Sentencia, documentoId: string) { return /^select id,proyecto_id,autor_id,version,tipo,sha256,estado,origen_ref,creado_en from requisitos_documentos /i.test(t.sql) && t.parametros.includes(documentoId); }
function antesPrivado(sentencias: Sentencia[], documentos: string[]) {
  const primero = sentencias.findIndex(selectPrivado);
  assert(primero >= 0, 'Debe existir una lectura privada para verificar su orden.');
  for (const id of documentos) assert(sentencias.slice(0, primero).some(t => autorizo(t, id)), `Falta autorización previa de ${id}.`);
}
async function rechaza(fn: () => Promise<unknown>, status: number) {
  await assert.rejects(fn, (e: unknown) => e instanceof ErrorConsulta && e.status === status);
}
async function caso(nombre: string, fn: () => Promise<unknown>) {
  try { const evidencia = await fn(); resultados.push({ caso: nombre, estado: 'OK', evidencia }); await registrar('OK ' + nombre); }
  catch (e) {
    const error = e instanceof Error ? { nombre: e.name, mensaje: e.message, pila: e.stack } : String(e);
    resultados.push({ caso: nombre, estado: 'ROJO', error }); await registrar('ROJO ' + nombre + ': ' + (e instanceof Error ? e.message : String(e)));
  }
}
const ambito = { tipo: 'obra' as const, id: f.proyecto, salaIds: [salaPropia] };
const pregunta = '¿Qué dice este documento?';
async function conversacion() { return repo09.crear(usuario, { ambito, retencionDias: 7 }); }
function seleccionar(d: { documentoId: string; extraccionId: string; candidato: Candidato }) {
  return { tipo: 'documento_requisitos' as const, id: d.documentoId, extraccionId: d.extraccionId, candidatoIds: [d.candidato.id] };
}
async function revisar(extraccionId: string, candidato: Candidato) {
  const p = await planes.crear(usuario, { extraccionId, destino: 'areas_bom' });
  const editado = await planes.editar(usuario, p.id, { version: 0, decisiones: { versionModelo: 1, destino: 'areas_bom',
    areas: [{ candidatoId: candidato.id, camposRevisados: ['accion', 'nombre', 'codigo', 'localizacion', 'medidas', 'aceptarHomonimo'],
      motivo: 'Revisión humana sintética: vincular texto a sala existente sin confirmar negocio.', accion: 'vincular', salaId: salaPropia,
      nombre: 'Referencia sintética revisada', codigo: null, localizacion: { id: f.localizacion, nombreNuevo: null },
      medidas: { largo_m: null, ancho_m: null, alto_m: null }, aceptarHomonimo: false }], material: [], excluidos: [] } });
  assert.equal(editado.version, 1); return p.id;
}
async function crearFuente(etiqueta: string, revisada = true) {
  const texto = `Sala: ${etiqueta} ${run}\nModelo: NO-SELECCIONAR-${etiqueta}\nTexto libre fuera de candidatos: ${run}\n`;
  const bytes = Buffer.from(texto), d = await repo10.registrarArchivo(usuario, f.proyecto,
    { nombre: `${etiqueta}.txt`, mime: 'text/plain', tamano: bytes.length, procedencia: 'TXT sintético exclusivo del gate09-10', fechaFuente: null, url: null }, bytes);
  const x = await repo10.extraer(usuario, d.id, { modo: 'local' });
  const candidato = x.resultado.candidatos.find(c => c.original.sala)!; assert(candidato);
  const planId = revisada ? await revisar(x.extraccionId, candidato) : null;
  return { documentoId: d.id, sha256: d.sha256, extraccionId: x.extraccionId, candidato, planId, texto, bytes: bytes.length };
}
async function preguntar(d: Parameters<typeof seleccionar>[0]) {
  const c = await conversacion(), entrada = { pregunta, version: 0, clavePeticion: randomUUID(), fuente: seleccionar(d) };
  const t = await repo09.preguntar(usuario, c.id, entrada); return { c, t, entrada };
}
let antes: Awaited<ReturnType<typeof fotografiar>> | undefined;
try {
  // Es la primera consulta de cada conexión; ningún INSERT/UPDATE/DELETE antes de estas identidades reales.
  for (const [nombre, conexion] of [['datos', db], ['espia', espia]] as const) {
    const [real] = await conexion`select current_database() as base,current_user as usuario,inet_server_addr()::text as host,inet_server_port() as puerto`;
    assert.equal(real.base, 'av_design_rea10_puente_prueba'); assert.equal(real.usuario, 'av_design_rea10_puente');
    assert.equal(Number(real.puerto), 5432); assert(real.host && !['0.0.0.0', '::'].includes(real.host));
    await guardar(`identidad-${nombre}.json`, { ...real, clienteHost: url.hostname, clientePuerto: Number(url.port) });
  }
  antes = await fotografiar(); assert.equal(antes.tablas.length, 104); await guardar('bd-antes.json', antes);
  assert((await db`select id from usuarios where id=${f.admin}`).length === 1, 'Fixture documental existente requerida.');
  await db`insert into usuarios(id,usuario,nombre,rol,clave_hash,activo,debe_cambiar_clave) values
    (${usuario},${'rea10-consultas-' + run},'PRUEBA gate09-10 propietario','admin',${await cifrarClave('Sintetico09-10-sin-login!')},true,false),
    (${otro},${'rea10-consultas-b-' + run},'PRUEBA gate09-10 adversario','lectura','SINTETICO-SIN-LOGIN',true,false)`;
  await db`insert into salas(id,nombre,codigo,localizacion_id,sede_id,largo_m,ancho_m,alto_m)
    values(${salaPropia},${'PRUEBA gate09-10 ' + run},${'REA10-' + run.slice(0, 8)},${f.localizacion},${f.sede},6,4,3)`;

  const fuenteA = await crearFuente('fuente-A', false); ids.fuenteA = fuenteA;
  await caso('01-candidato-no-revisado-409-antes-fragmentos', async () => {
    const c = await conversacion(), inicio = traza.length;
    await rechaza(() => repo09.preguntar(usuario, c.id, { pregunta, version: 0, clavePeticion: randomUUID(), fuente: seleccionar(fuenteA) }), 409);
    assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
    assert.equal((await db`select id from consultas_turnos where conversacion_id=${c.id}`).length, 0);
    return { conversacionId: c.id, SQLprivado: 0 };
  });
  fuenteA.planId = await revisar(fuenteA.extraccionId, fuenteA.candidato);
  await caso('02-plan-humano-solo-vincular-sin-negocio', async () => {
    const p = await planes.obtener(usuario, fuenteA.planId!);
    assert.equal(p.estado, 'borrador'); assert.equal(p.version, 1);
    const [a] = await db`select count(*)::int as n from requisitos_aplicaciones where plan_id=${fuenteA.planId}`; assert.equal(a.n, 0);
    for (const tabla of ['sala_equipos', 'sala_material_bom', 'importacion_lotes', 'localizaciones', 'articulos', 'precios']) {
      const filas = (await db.unsafe(`select to_jsonb(t)::text as fila from "${tabla}" t order by to_jsonb(t)::text`)).map(r => String(r.fila));
      assert.deepEqual(filas, antes!.filas[tabla], tabla + ' conserva negocio previo');
    }
    return { planId: p.id, version: p.version, estado: p.estado, aplicaciones: a.n };
  });
  await caso('03-sin-seleccion-no-hay-fragmentos-ni-documento-entero', async () => {
    const inicio = traza.length;
    const directo = await leerFuenteRequisito(espia, usuario, fuenteA.documentoId, { proyectoId: f.proyecto, texto: true });
    assert.equal(directo.hechos.length, 0); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
    const c = await conversacion(), t = await repo09.preguntar(usuario, c.id, { pregunta: '¿Qué documentos puedo abrir?', version: 0, clavePeticion: randomUUID() });
    assert.equal(t.respuesta.hechos.length, 0); assert(t.respuesta.citas.some(ci => ci.fuente.id === fuenteA.documentoId));
    assert(!JSON.stringify(t.respuesta).includes(fuenteA.candidato.fragmento));
    return { conversacionId: c.id, turnoId: t.id, hechos: t.respuesta.hechos.length };
  });
  const inicioA = traza.length, consultaA = await preguntar(fuenteA); ids.consultaA = consultaA;
  await caso('04-consulta09-real-seleccion-ancla-exacta', async () => {
    const { t } = consultaA; assert.equal(t.respuesta.intent, 'documentos'); assert.equal(t.respuesta.hechos.length, 1);
    const h = t.respuesta.hechos[0]; assert.equal(h.valor, fuenteA.candidato.fragmento);
    assert.deepEqual(h.anclaDocumento, fuenteA.candidato.ancla); assert.equal(h.anclaDocumento?.pagina, null); assert.equal(h.anclaDocumento?.linea, 1);
    assert.equal(h.anclaDocumento?.sha256, hash(fuenteA.candidato.fragmento)); assert.equal(h.anclaDocumento?.metodo, 'literal_estructurado');
    assert.equal(h.campo, `extraccion:${fuenteA.extraccionId}.candidato:${fuenteA.candidato.id}`);
    assert(!JSON.stringify(t.respuesta).includes('NO-SELECCIONAR')); assert(!JSON.stringify(t.respuesta).includes('Texto libre fuera de candidatos'));
    const ci = t.respuesta.citas[0]; assert.equal(ci.fuente.tipo, 'documento_requisitos'); assert.deepEqual(ci.fuente.candidatoIds, [fuenteA.candidato.id]);
    assert.deepEqual(ci.fuente.anclasDocumento, [fuenteA.candidato.ancla]); assert.equal(ci.fuente.extraccionId, fuenteA.extraccionId);
    antesPrivado(trozo(inicioA), [fuenteA.documentoId]);
    const sentencias = trozo(inicioA).filter(selectFragmentos); assert(sentencias.length);
    assert(sentencias.every(s => /jsonb_array_elements\(e\.resultado->'candidatos'\)/.test(s.sql) && /c\.valor->>'id'=any\(/.test(s.sql)));
    return { turnoId: t.id, ancla: h.anclaDocumento, SQLfragmentos: sentencias.length };
  });
  await caso('05-historial-y-reintento-misma-clave-CAS-actual', async () => {
    const inicio = traza.length, h = await repo09.obtenerTurno(usuario, consultaA.c.id, consultaA.t.id);
    assert(!h.bloqueado && 'respuesta' in h); assert.deepEqual(h.respuesta, consultaA.t.respuesta); assert.equal(h.historica, false);
    const sentencias = trozo(inicio); antesPrivado(sentencias, [fuenteA.documentoId]); assert(sentencias.some(selectContenido));
    const reintento = await repo09.preguntar(usuario, consultaA.c.id, { ...consultaA.entrada, version: 0 });
    assert.equal(reintento.id, consultaA.t.id); assert.equal(reintento.reintentado, true); assert.equal(reintento.version, consultaA.t.version);
    assert.equal((await db`select id from consultas_turnos where conversacion_id=${consultaA.c.id}`).length, 1);
    await rechaza(() => repo09.preguntar(usuario, consultaA.c.id, { ...consultaA.entrada, pregunta: pregunta + ' distinta' }), 409);
    await rechaza(() => repo09.preguntar(usuario, consultaA.c.id, { ...consultaA.entrada, clavePeticion: randomUUID(), version: 0 }), 409);
    return { mismoTurno: reintento.id, versionActual: reintento.version, unTurno: true };
  });
  await caso('06-otra-identidad404-antes-contenido', async () => {
    const inicio = traza.length; await rechaza(() => repo09.obtenerTurno(otro, consultaA.c.id, consultaA.t.id), 404);
    assert.equal(trozo(inicio).filter(selectPrivado).length, 0); return { SQLprivado: 0 };
  });
  await caso('07-nueva-extraccion-fuente-accesible-marca-historica', async () => {
    const x = await repo10.extraer(usuario, fuenteA.documentoId, { modo: 'manual', pagina: null, texto: 'Sala: NUEVO-TEXTO-NO-RECONSTRUIR', motivo: 'Nueva extracción sintética deliberada' });
    const h = await repo09.obtenerTurno(usuario, consultaA.c.id, consultaA.t.id);
    assert(!h.bloqueado && 'respuesta' in h); assert.equal(h.historica, true); assert.deepEqual(h.respuesta, consultaA.t.respuesta);
    assert(!JSON.stringify(h).includes('NUEVO-TEXTO-NO-RECONSTRUIR')); return { nuevaExtraccion: x.extraccionId, historica: h.historica };
  });

  const fuenteB = await crearFuente('fuente-B'), fuenteRetirar = await crearFuente('fuente-retirar');
  const consultaB = await preguntar(fuenteB), consultaRetirar = await preguntar(fuenteRetirar);
  ids.fuenteB = fuenteB; ids.fuenteRetirar = fuenteRetirar; ids.consultaB = consultaB; ids.consultaRetirar = consultaRetirar;
  // Única preparación manual09: dos proyecciones reales en un turno propio para probar la barrera multifuente.
  const multi = await conversacion(), turnoMulti = randomUUID();
  const respuestaMulti: RespuestaConsulta = { ...consultaA.t.respuesta,
    hechos: [...consultaA.t.respuesta.hechos, ...consultaB.t.respuesta.hechos], citas: [...consultaA.t.respuesta.citas, ...consultaB.t.respuesta.citas],
    enlaces: [...consultaA.t.respuesta.enlaces, ...consultaB.t.respuesta.enlaces] };
  const fuentesMulti: FuenteConsulta[] = respuestaMulti.citas.map(ci => ci.fuente);
  const aclMulti = { versionModelo: 1, intent: 'documentos', ambito, secciones: ['proyectos', 'salas'], fuentes: fuentesMulti };
  await db.begin(async tx => {
    await tx`insert into consultas_turnos(id,conversacion_id,propietario_id,numero,clave_peticion,entrada_sha256,intent,motor,acl_fuentes,observado_en,captura_sha256)
      values(${turnoMulti},${multi.id},${usuario},1,${randomUUID()},${hashConsulta({ fixture: run })},'documentos','local-1',${tx.json(aclMulti as postgres.JSONValue)},${respuestaMulti.observadoEn},${hashConsulta({ respuesta: respuestaMulti, acl: aclMulti })})`;
    await tx`insert into consultas_contenidos(turno_id,pregunta,respuesta) values(${turnoMulti},'Fixture sintética: dos fuentes reales seleccionadas.',${tx.json(respuestaMulti as unknown as postgres.JSONValue)})`;
    await tx`update consultas_conversaciones set version=version+1 where id=${multi.id} and propietario_id=${usuario}`;
  });
  ids.multifuente = { conversacionId: multi.id, turnoId: turnoMulti, origen: 'Fixture manual09, dos capturas auténticas; no representa selección pública múltiple.' };
  await caso('08-todas-las-cabeceras-antes-de-fragmentos-y-contenido', async () => {
    const inicio = traza.length, h = await repo09.obtenerTurno(usuario, multi.id, turnoMulti);
    assert(!h.bloqueado && 'respuesta' in h); assert.equal(h.respuesta.hechos.length, 2);
    const s = trozo(inicio); antesPrivado(s, [fuenteA.documentoId, fuenteB.documentoId]);
    assert(s.some(selectFragmentos) && s.some(selectContenido)); return { fuentes: fuentesMulti.map(f => f.id), SQL: s.length };
  });

  const pdf = await new Promise<Buffer>((res, rej) => { const p = new PDFDocument(), trozos: Buffer[] = []; p.on('data', b => trozos.push(b)); p.on('end', () => res(Buffer.concat(trozos))); p.on('error', rej); p.text('Sala: Referencia E2 sintética\nModelo: NO-SELECCIONAR-E2'); p.end(); });
  const [articulo] = await db`insert into articulos(tipo,categoria,marca,modelo,unidad,fuente) values('equipo','Pantalla',${'REA10-' + run},'REFERENCIA-PDF','ud','app') returning id`;
  const archivo = await validarArchivoTecnicoCompleto(pdf, 'application/pdf', 'ficha-sintetica.pdf', 'ficha');
  const archivoId = await guardarArchivoTecnico(db, { ...await identidad(db, usuario), debeCambiarClave: false }, articulo.id,
    { marca: 'REA10-' + run, modelo: 'REFERENCIA-PDF', origen: 'PDF sintético de gate09-10', url: 'https://example.invalid/rea10', fecha: '2026-10-16' }, archivo);
  const [origen] = await db`select revision_fuente from articulos_archivos_tecnicos where id=${archivoId}`;
  const ref = await repo10.registrarReferencia(usuario, { proyectoId: f.proyecto, procedencia: 'Referencia sintética E2 deliberada',
    referencia: { tipo: 'ficha_e2', articuloId: articulo.id, archivoId, sha256: hashBytes(pdf), revisionFuente: String(origen.revision_fuente) } });
  const extraccionE2 = await repo10.extraer(usuario, ref.id, { modo: 'local' }), candidatoE2 = extraccionE2.resultado.candidatos.find(c => c.original.sala)!;
  await revisar(extraccionE2.extraccionId, candidatoE2);
  const seleccionE2 = { documentoId: ref.id, extraccionId: extraccionE2.extraccionId, candidato: candidatoE2 }, consultaE2 = await preguntar(seleccionE2);
  ids.E2 = { articuloId: articulo.id, archivoId, documentoId: ref.id, consulta: consultaE2 };
  await caso('09-referenciaE2-pagina-hash-metodo-sin-copia-bytea', async () => {
    assert.equal(candidatoE2.ancla.pagina, 1); assert.equal(candidatoE2.ancla.linea, null);
    assert.equal(candidatoE2.ancla.sha256, hash(candidatoE2.fragmento)); assert.equal(candidatoE2.ancla.metodo, 'literal_estructurado');
    assert.deepEqual(consultaE2.t.respuesta.hechos[0].anclaDocumento, candidatoE2.ancla);
    const [c] = await db`select bytes is null as sin_copia from requisitos_contenidos where documento_id=${ref.id}`; assert.equal(c.sin_copia, true);
    return { ancla: candidatoE2.ancla, copiaBytes: false };
  });
  await caso('10-origenE2-cambiado-bloquea-antes-texto-historial', async () => {
    await db`update articulos_archivos_tecnicos set origen=origen where id=${archivoId}`;
    const inicio = traza.length, h = await repo09.obtenerTurno(usuario, consultaE2.c.id, consultaE2.t.id);
    assert.equal(h.bloqueado, true); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
    assert(!JSON.stringify(h).includes(candidatoE2.fragmento)); return { SQLprivado: 0, bloqueado: h.bloqueado };
  });
  await caso('11-origenE2-retirado-bloquea-antes-texto-historial', async () => {
    await db`delete from articulos_archivos_tecnicos where id=${archivoId} and articulo_id=${articulo.id}`;
    const inicio = traza.length, h = await repo09.obtenerTurno(usuario, consultaE2.c.id, consultaE2.t.id);
    assert.equal(h.bloqueado, true); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
    assert.equal((await db`select estado from requisitos_documentos where id=${ref.id}`)[0].estado, 'activo');
    return { referencia10Conservada: true, SQLprivado: 0 };
  });

  await db`update usuarios set rol='lectura' where id=${usuario}`;
  await db`insert into usuario_permisos(usuario_id,seccion,acceso) values(${usuario},'proyectos','editar'),(${usuario},'salas','editar'),(${usuario},'catalogo','editar')`;
  await caso('12-ACL-compras-retirada-bloquea-antes-de-contenido', async () => {
    await db`insert into usuario_permisos(usuario_id,seccion,acceso) values(${usuario},'compras','oculto')`;
    try {
      const inicio = traza.length, h = await repo09.obtenerTurno(usuario, consultaB.c.id, consultaB.t.id);
      assert.equal(h.bloqueado, true); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
      const inicioRetry = traza.length; await rechaza(() => repo09.preguntar(usuario, consultaB.c.id, consultaB.entrada), 403);
      assert.equal(trozo(inicioRetry).filter(selectPrivado).length, 0);
      return { SQLprivado: 0, reintentoReautoriza: true };
    } finally { await db`delete from usuario_permisos where usuario_id=${usuario} and seccion='compras'`; }
  });
  await caso('13-revocacion-despues-captura-rechaza-escritura-sin-turno', async () => {
    const c = await conversacion(); let barrera = false;
    const carrera = new RepositorioConsultas(espia, { despuesCaptura: async () => {
      barrera = true; await db`insert into usuario_permisos(usuario_id,seccion,acceso) values(${usuario},'compras','oculto')`;
    } });
    try {
      await rechaza(() => carrera.preguntar(usuario, c.id, { pregunta, version: 0, clavePeticion: randomUUID(), fuente: seleccionar(fuenteB) }), 403);
      assert.equal(barrera, true); assert.equal((await db`select id from consultas_turnos where conversacion_id=${c.id}`).length, 0);
      assert.equal((await db`select version from consultas_conversaciones where id=${c.id}`)[0].version, 0);
      return { conversacionId: c.id, nuevosTurnos: 0, version: 0, barrera: 'despuesCaptura09' };
    } finally { await db`delete from usuario_permisos where usuario_id=${usuario} and seccion='compras'`; }
  });
  await caso('14-cambio-obra409-sin-fragmentos-ni-historial', async () => {
    await db`update salas set localizacion_id=${f.localizacionAjena} where id=${salaPropia}`;
    try {
      const inicio = traza.length, h = await repo09.obtenerTurno(usuario, consultaB.c.id, consultaB.t.id);
      assert.equal(h.bloqueado, true); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
      const c = await repo09.crear(usuario, { ambito: { tipo: 'sala', id: salaPropia } });
      const desde = traza.length; await rechaza(() => repo09.preguntar(usuario, c.id, { pregunta, version: 0, clavePeticion: randomUUID(), fuente: seleccionar(fuenteB) }), 409);
      assert.equal(trozo(desde).filter(selectPrivado).length, 0); return { SQLprivado: 0, statusNuevaConsulta: 409 };
    } finally { await db`update salas set localizacion_id=${f.localizacion} where id=${salaPropia}`; }
  });
  await caso('15-retirar-una-fuente-bloquea-turno-multifuente-completo', async () => {
    await repo10.retirar(usuario, fuenteB.documentoId, { version: 0, accion: 'retirar', motivo: 'Retirada sintética del segundo origen del turno', confirmarHash: fuenteB.sha256 });
    const inicio = traza.length, h = await repo09.obtenerTurno(usuario, multi.id, turnoMulti);
    assert.equal(h.bloqueado, true); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
    assert(!('pregunta' in h) && !('respuesta' in h));
    assert(!JSON.stringify(h).includes(fuenteA.candidato.fragmento)); return { SQLprivado: 0, bloqueado: h.bloqueado, todosLosTextosOcultos: true };
  });
  await caso('16-retirada-propia-bloquea-turno-y-reintento-sin-contenido', async () => {
    await repo10.retirar(usuario, fuenteRetirar.documentoId, { version: 0, accion: 'retirar', motivo: 'Retirada explícita sintética', confirmarHash: fuenteRetirar.sha256 });
    const inicio = traza.length, h = await repo09.obtenerTurno(usuario, consultaRetirar.c.id, consultaRetirar.t.id);
    assert.equal(h.bloqueado, true); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
    const desde = traza.length; await rechaza(() => repo09.preguntar(usuario, consultaRetirar.c.id, consultaRetirar.entrada), 409);
    assert.equal(trozo(desde).filter(selectPrivado).length, 0); return { SQLprivado: 0, statusReintento: 409 };
  });
  await caso('17-purga10-texto-bytea-planes-sin-reconstruccion09', async () => {
    await repo10.retirar(usuario, fuenteRetirar.documentoId, { version: 1, accion: 'purgar', motivo: 'Purga sintética tras retirada', confirmarHash: fuenteRetirar.sha256 });
    const [d] = await db`select id,estado,version,sha256,retirada,purga from requisitos_documentos where id=${fuenteRetirar.documentoId}`;
    assert.equal(d.estado, 'purgado'); assert.equal(d.version, 2); assert.equal(d.sha256, fuenteRetirar.sha256);
    assert.equal(d.purga.autorId, usuario); assert.equal(d.retirada.diff.bytes, fuenteRetirar.bytes);
    const [contenido] = await db`select metadatos,bytes from requisitos_contenidos where documento_id=${fuenteRetirar.documentoId}`;
    assert.equal(contenido.metadatos, null); assert.equal(contenido.bytes, null);
    const xs = await db`select id,resultado from requisitos_extracciones where documento_id=${fuenteRetirar.documentoId}`;
    assert(xs.length); assert(xs.every(x => x.resultado === null));
    const ps = await db`select p.id,p.decisiones,p.estado from requisitos_planes p join requisitos_extracciones x on x.id=p.extraccion_id where x.documento_id=${fuenteRetirar.documentoId}`;
    assert(ps.length); assert(ps.every(p => p.decisiones === null && p.estado === 'purgado'));
    const inicio = traza.length, h = await repo09.obtenerTurno(usuario, consultaRetirar.c.id, consultaRetirar.t.id);
    assert.equal(h.bloqueado, true); assert.equal(trozo(inicio).filter(selectPrivado).length, 0);
    const desde = traza.length; await rechaza(() => repo09.preguntar(usuario, consultaRetirar.c.id, consultaRetirar.entrada), 409);
    assert.equal(trozo(desde).filter(selectPrivado).length, 0);
    assert(!JSON.stringify(h).includes(fuenteRetirar.candidato.fragmento));
    return { documentoId: d.id, tombstone: d.estado, extraccionesPurgadas: xs.length, planesPurgados: ps.length, SQLprivado: 0 };
  });
  await caso('19-fixture-ui-activa-sin-pregunta-automatica', async () => {
    const fuente = await crearFuente('fuente-ui');
    const ui = { documentoId: fuente.documentoId, extraccionId: fuente.extraccionId, candidatoId: fuente.candidato.id,
      proyectoId: f.proyecto, salaId: salaPropia, localizacionId: f.localizacion, usuarioId: usuario,
      usuario: 'rea10-consultas-' + run, planId: fuente.planId, versionDocumento: 0,
      sha256: fuente.sha256, estado: 'activo', plan: 'borrador revisado sin aplicar', conversacionId: null,
      href: `/proyectos/${f.proyecto}/requisitos?documento=${fuente.documentoId}` };
    await guardar('fixture-ui.json', ui); ids.ui = ui;
    return { documentoId: fuente.documentoId, usuarioId: usuario, conversacion: null, planRevisadoSinAplicar: true };
  });
} catch (e) {
  resultados.push({ caso: 'PRECONDICION-O-PREPARACION', estado: 'ROJO', error: e instanceof Error ? { mensaje: e.message, pila: e.stack } : String(e) });
  await registrar('ROJO PRECONDICION-O-PREPARACION ' + (e instanceof Error ? e.message : String(e)));
} finally {
  if (antes) {
    await caso('18-fotos104-todas-las-filas-previas-preservadas', async () => {
      const despues = await fotografiar(); await guardar('bd-despues.json', despues); assert.equal(despues.tablas.length, 104);
      let filasPreservadas = 0;
      for (const [tabla, filas] of Object.entries(antes!.filas)) {
        const finales = new Set(despues.filas[tabla]); for (const fila of filas) assert(finales.has(fila), `Fila previa cambiada o borrada en ${tabla}: ${sha(fila)}`);
        filasPreservadas += filas.length;
      }
      const cambiadas = despues.tablas.filter(t => t.sha256 !== antes!.tablas.find(a => a.tabla === t.tabla)?.sha256).map(t => t.tabla);
      const permitidas = new Set(['usuarios', 'usuario_permisos', 'salas', 'articulos', 'articulos_archivos_tecnicos', 'consultas_conversaciones', 'consultas_turnos', 'consultas_contenidos', 'requisitos_documentos', 'requisitos_contenidos', 'requisitos_extracciones', 'requisitos_planes']);
      assert(cambiadas.every(t => permitidas.has(t)), 'Sólo nuevas filas propias en las tablas declaradas.');
      return { tablas: despues.tablas.length, filasPreviasPreservadas: filasPreservadas, tablasIdenticas: 104 - cambiadas.length, tablasConAdicionesPropias: cambiadas, shaAntes: antes!.sha256, shaDespues: despues.sha256 };
    });
  }
  await guardar('sql-spy.json', traza); await guardar('fixture-propio.json', ids);
  await guardar('resultado.json', { resultado: resultados.every(r => r.estado === 'OK') ? 'OK' : 'ROJO', salida, resultados, limitaciones: ['Gate de autor10; no revisión independiente ni nueva ronda10.', 'Turno multifuente es fixture09 propia construida de dos capturas auténticas; entrada pública elige una fuente.', 'Sin prueba de UI en este gate SQL.'], comando: 'REA10_CONSULTAS_DATABASE_URL=<URL sintética5565 explícita> node --import tsx scripts/verificar-rea10-consultas.mts' });
  await registrar(`Resultado ${resultados.every(r => r.estado === 'OK') ? 'OK' : 'ROJO'}: ${resultados.filter(r => r.estado === 'OK').length}/${resultados.length}; ${salida}`);
  await Promise.all([db.end(), espia.end()]); await log.close();
  if (resultados.some(r => r.estado === 'ROJO')) process.exitCode = 1;
}

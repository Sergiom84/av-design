import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import Module, { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import postgres from 'postgres';
import ts from 'typescript';

// Mutaciones en memoria: nunca se revierte ni escribe el árbol compartido.
if (process.argv.includes('--mutaciones')) {
  let total = 0;
  for (const mutacion of ['', 'sin-idempotencia', 'sin-lock-borrado', 'sin-cierre', 'sin-sesion-real']) {
    const fixture = 'qa_compras_' + randomUUID().replaceAll('-', '');
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verificar-compras-integrales.mts'], {
      encoding: 'utf8', timeout: 60000, env: { ...process.env, COMPRAS_MUTACION: mutacion, COMPRAS_FIXTURE: fixture },
    });
    // Si un proceso muere antes de finally, el supervisor elimina exclusivamente SU fixture.
    const supervisor = postgres('postgres://av_design:av_design_local@127.0.0.1:5433/postgres', { onnotice() {} });
    try { await supervisor.unsafe('drop database if exists "' + fixture + '" with (force)'); }
    finally { await supervisor.end(); }
    const salida = (r.stdout ?? '') + (r.stderr ?? '');
    console.log(salida);
    assert.ok(salida.includes('FIXTURE ELIMINADO'), 'El proceso debe limpiar su base efímera');
    const cuenta = salida.match(/RESULTADO pruebas=(\d+) fallos=(\d+)/);
    assert.ok(cuenta, 'Debe ejecutar pruebas, no fallar al cargar');
    assert.ok(!/TypeError|SyntaxError|MODULE_NOT_FOUND/.test(salida), 'Un fallo de infraestructura no acredita causalidad');
    console.log('CAUSAL', mutacion || 'base', cuenta[0]);
    if (!mutacion) total = Number(cuenta[1]);
    assert.ok(total >= 18); assert.equal(Number(cuenta[1]), total);
    if (mutacion) { assert.notEqual(r.status, 0); assert.ok(Number(cuenta[2]) > 0); }
    else { assert.equal(r.status, 0); assert.equal(Number(cuenta[2]), 0); }
  }
  process.exit(0);
}
const nombre = process.env.COMPRAS_FIXTURE ?? 'qa_compras_' + randomUUID().replaceAll('-', '');
assert.match(nombre, /^qa_compras_[a-f0-9]{32}$/);
const base = 'postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin = postgres(base + 'postgres', { onnotice() {} });
await admin.unsafe('create database "' + nombre + '"');
const sql = postgres(base + nombre, { max: 8, onnotice() {} });
process.env.DATABASE_URL = base + nombre;
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.SESION_SECRETO = 'fixture-compras-secreto-local-suficientemente-largo';
let cookie: string | undefined;
const cargador = Module as unknown as { _load: (r: string, ...args: unknown[]) => unknown };
const original = cargador._load;
const mutacion = process.env.COMPRAS_MUTACION ?? '';
let mutada = false, exportado: unknown;
cargador._load = (r, ...args) => {
  if (r === 'server-only') return {};
  if (r === 'next/headers') return { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) };
  if (r === 'next/cache') return { revalidatePath() {} };
  if (r === 'next/navigation') return { redirect: (url: string) => { throw new Error('REDIRECT ' + url); } };
  const objetivo = mutacion === 'sin-lock-borrado' ? 'acciones-almacen' : 'operaciones-compras';
  if (mutacion && r.replaceAll('\\', '/').includes(objetivo)) {
    if (mutada) return exportado;
    const ruta = resolve(objetivo === 'acciones-almacen' ? 'src/app/acciones-almacen.ts' : 'src/lib/operaciones-compras.ts');
    let fuente = readFileSync(ruta, 'utf8').replaceAll('\r\n','\n');
    const cambios: Record<string, [string, string]> = {
      'sin-idempotencia': ['  exigirAutorCompra(entrada.autor);', '  entrada = { ...entrada, recepcionId: globalThis.crypto.randomUUID() };\n  exigirAutorCompra(entrada.autor);'],
      'sin-lock-borrado': ['    await bloquearPedidoCompra(tx, pedidoId);\n    await tx`delete from pedidos p', '    await tx`delete from pedidos p'],
      'sin-cierre': ['if (cierres.length) throw', 'if (false && cierres.length) throw'],
      'sin-sesion-real': ['if (autor.ficticio) throw', 'if (false && autor.ficticio) throw'],
    };
    const [antes, despues] = cambios[mutacion];
    assert.equal(fuente.split(antes).length, 2, 'Mutación causal única: ' + mutacion);
    fuente = fuente.replace(antes, despues);
    const modulo = new Module(ruta);
    const interno = modulo as unknown as { paths: string[]; _compile: (s: string, f: string) => void };
    interno.paths = [resolve('node_modules')];
    interno._compile(ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, ruta);
    mutada = true; exportado = modulo.exports; return exportado;
  }
  return original.call(Module, r, ...args);
};
let pruebas = 0, fallos = 0;
async function prueba(titulo: string, ejecutar: () => Promise<void>) {
  pruebas++;
  try { await ejecutar(); console.log('OK', titulo); }
  catch (error) { fallos++; console.error('FALLO', titulo, error); }
}
try {
  const instalacion=await sql.reserve();
  try{await instalacion.unsafe(readFileSync('db/schema.sql', 'utf8'));}finally{instalacion.release();}
  await sql.unsafe(readFileSync('db/migraciones/2026-09-trazabilidad-compras.sql', 'utf8'));
  const cargar = createRequire(import.meta.url);
  const acciones = cargar('../src/app/acciones-almacen') as typeof import('../src/app/acciones-almacen');
  const { comprarLineas, recibirCompra } = cargar('../src/lib/operaciones-compras') as typeof import('../src/lib/operaciones-compras');
  const { firmarSesion } = await import('../src/lib/sesion');
  const autor = { id: randomUUID(), nombre: 'QA Comprador', ficticio: false };
  await sql`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave)
    values(${autor.id},'qa_compras',${autor.nombre},'admin','fixture-sin-password',false)`;
  cookie = await firmarSesion(process.env.SESION_SECRETO, Date.now() + 3600000, autor.id);
  const cookieReal = cookie;
  const [a] = await sql`insert into articulos(modelo,tipo,categoria,unidad) values('QA HDMI','equipo','QA','ud') returning id`;
  const [u] = await sql`insert into ubicaciones(nombre) values('QA Almacén') returning id`;
  async function pedido(cantidad = 10, salaId: string | null = null, proyectoId: string | null = null) {
    const [p] = await sql`insert into pedidos(sala_id,proyecto_id) values(${salaId},${proyectoId}) returning id`;
    const [l] = await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad) values(${p.id},${a.id},${cantidad}) returning id`;
    return { pedidoId: String(p.id), lineaId: String(l.id), cantidad: 2, ubicacionId: String(u.id), autor, recepcionId: randomUUID() };
  }
  async function obra(conSala = true) {
    const [p] = await sql`insert into proyectos(nombre) values(${randomUUID()}) returning id`;
    const [l] = await sql`insert into localizaciones(proyecto_id,nombre) values(${p.id},'QA') returning id`;
    const [s] = conSala ? await sql`insert into salas(nombre,localizacion_id) values('QA',${l.id}) returning id` : [];
    return { proyectoId: String(p.id), salaId: s ? String(s.id) : null };
  }
  function form(e: Awaited<ReturnType<typeof pedido>>) {
    const f = new FormData();
    for (const [k,v] of Object.entries({ id:e.lineaId, pedido_id:e.pedidoId, sala_id:'', cantidad:String(e.cantidad),
      ubicacion_id:e.ubicacionId, recepcion_id:e.recepcionId, estado:'pedido', precio:'12', oferta:'Oferta QA' })) f.set(k,v);
    return f;
  }
  async function ejecutar(p: Promise<unknown>) {
    try { await p; } catch(e) { if (!(e instanceof Error && /^REDIRECT \/(?:compras|salas)(?:\/[^?]+)?$/.test(e.message))) throw e; }
  }
  async function estado(e: Awaited<ReturnType<typeof pedido>>) {
    const [r] = await sql`select cantidad_recibida, comprado_por, comprado_en from pedido_lineas where id=${e.lineaId}`;
    const [m] = await sql`select coalesce(sum(cantidad),0) as stock, count(*)::int as n from movimientos where pedido_linea_id=${e.lineaId}`;
    return { recibida: Number(r?.cantidad_recibida), stock: Number(m.stock), movimientos: m.n, autor:r?.comprado_por, fecha:r?.comprado_en };
  }
  const escrituras = (e: Awaited<ReturnType<typeof pedido>>, salaId: string) => {
    const linea=form(e), cabecera=form(e); cabecera.set('id',e.pedidoId); cabecera.set('sala_id',salaId);
    return [
      ()=>acciones.crearPedidoDesdeFalta(cabecera), ()=>acciones.cambiarEstadoPedido(cabecera),
      ()=>acciones.guardarPedido(cabecera), ()=>acciones.recibirLineaPedido(linea),
      ()=>acciones.recibirPedidoCompleto(cabecera), ()=>acciones.registrarOfertaLinea(linea),
      ()=>acciones.borrarLineaPedido(linea), ()=>acciones.borrarPedido(cabecera),
    ];
  };
  await prueba('sin compra, exceso y línea ajena no escriben ni consumen token', async()=>{
    const e=await pedido(), otro=await pedido();
    await assert.rejects(recibirCompra(sql,e),/Primero registra/);
    await assert.rejects(comprarLineas(sql,otro.pedidoId,autor,e.lineaId),/no pertenece/);
    await comprarLineas(sql,e.pedidoId,autor);
    await assert.rejects(recibirCompra(sql,{...e,pedidoId:otro.pedidoId}),/no pertenece/);
    await assert.rejects(recibirCompra(sql,{...e,cantidad:11}),/supera/);
    assert.equal((await estado(e)).stock,0);
    assert.equal((await sql`select id from recepciones_compra where id=${e.recepcionId}`).length,0);
  });
  await prueba('compra conserva autor y fecha al repetirse, sin exigir precio', async()=>{
    const e=await pedido(); await comprarLineas(sql,e.pedidoId,autor);
    await comprarLineas(sql,e.pedidoId,{...autor,nombre:'Otro'});
    const r=await estado(e); assert.equal(r.autor,autor.nombre); assert.ok(r.fecha);
  });
  await prueba('token obligatorio y válido en helper y ambas acciones', async()=>{
    const e=await pedido(); await comprarLineas(sql,e.pedidoId,autor);
    for(const token of ['', 'invalido']) {
      await assert.rejects(recibirCompra(sql,{...e,recepcionId:token}),/identificador/);
      const f=form(e);f.set('recepcion_id',token);
      await assert.rejects(acciones.recibirLineaPedido(f),/identificador/);
      f.set('id',e.pedidoId);await assert.rejects(acciones.recibirPedidoCompleto(f),/identificador/);
    }
    assert.equal((await estado(e)).stock,0);
  });
  await prueba('dos parciales idénticas concurrentes y reenvío suman una sola entrada', async()=>{
    const e=await pedido();await comprarLineas(sql,e.pedidoId,autor);
    await Promise.all([recibirCompra(sql,e),recibirCompra(sql,e)]);await recibirCompra(sql,e);
    const r=await estado(e);assert.equal(r.recibida,2);assert.equal(r.stock,2);assert.equal(r.movimientos,1);
  });
  await prueba('nuevo token permite nueva parcial; cambio de datos con token usado se rechaza',async()=>{
    const e=await pedido();await comprarLineas(sql,e.pedidoId,autor);await recibirCompra(sql,e);
    await assert.rejects(recibirCompra(sql,{...e,cantidad:3}),/otros datos/);
    const otro=await pedido();await comprarLineas(sql,otro.pedidoId,autor);
    await assert.rejects(recibirCompra(sql,{...otro,recepcionId:e.recepcionId}),/otros datos/);
    await recibirCompra(sql,{...e,recepcionId:randomUUID()});assert.equal((await estado(e)).stock,4);
  });
  await prueba('tokens distintos concurrentes no superan lo pendiente',async()=>{
    const e=await pedido(3);await comprarLineas(sql,e.pedidoId,autor);
    const r=await Promise.allSettled([recibirCompra(sql,e),recibirCompra(sql,{...e,recepcionId:randomUUID()})]);
    assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal((await estado(e)).stock,2);
  });
  await prueba('recepción completa repetida conserva un movimiento por línea',async()=>{
    const e=await pedido(4);await comprarLineas(sql,e.pedidoId,autor);
    const completa={...e,lineaId:undefined,cantidad:undefined};
    await Promise.all([recibirCompra(sql,completa),recibirCompra(sql,completa)]);
    assert.equal((await estado(e)).stock,4);assert.equal((await estado(e)).movimientos,1);
    const [p]=await sql`select estado from pedidos where id=${e.pedidoId}`;assert.equal(p.estado,'recibido');
  });
  await prueba('fallo de movimiento revierte cantidades y token; mismo token puede reintentarse',async()=>{
    const e=await pedido();await comprarLineas(sql,e.pedidoId,autor);
    await sql.unsafe("create function fallo_compra() returns trigger language plpgsql as $$ begin raise exception 'fallo fixture'; end $$; create trigger fallo_compra before insert on movimientos for each row execute function fallo_compra()");
    try{await assert.rejects(recibirCompra(sql,e),/fallo fixture/);}finally{await sql.unsafe('drop trigger fallo_compra on movimientos');}
    assert.equal((await estado(e)).recibida,0);assert.equal((await estado(e)).stock,0);
    assert.equal((await sql`select id from recepciones_compra where id=${e.recepcionId}`).length,0);
    await recibirCompra(sql,e);assert.equal((await estado(e)).stock,2);
  });
  await prueba('borrado concurrente agota, reintenta tras compra y conserva pedido y línea',async()=>{
    const e=await pedido();let soltar!:()=>void, listo!:()=>void;
    const barrera=new Promise<void>(r=>soltar=r), inicio=new Promise<void>(r=>listo=r);
    const compra=comprarLineas({begin: (fn: (tx: postgres.TransactionSql)=>Promise<void>)=>sql.begin(async tx=>{await fn(tx);listo();await barrera;})} as postgres.Sql,e.pedidoId,autor);
    await inicio;
    const f=form(e);f.set('id',e.pedidoId);
    try{await assert.rejects(ejecutar(acciones.borrarPedido(f)),/Hay otra operación en curso/);}
    finally{soltar();await compra;}
    await ejecutar(acciones.borrarPedido(f));
    assert.equal((await sql`select id from pedidos where id=${e.pedidoId}`).length,1);
    assert.equal((await estado(e)).autor,autor.nombre);
  });
  await prueba('obra cerrada rechaza las ocho escrituras de pedidos',async()=>{
    const o=await obra(), e=await pedido(10,o.salaId,o.proyectoId);
    await sql`insert into hitos_proyecto(proyecto_id,tipo) values(${o.proyectoId},'cierre')`;
    for(const escribir of escrituras(e,o.salaId!)) await assert.rejects(escribir(),/cerrado/);
    assert.equal((await estado(e)).fecha,null);assert.equal((await estado(e)).stock,0);
  });
  await prueba('pedido de proyecto sin sala también respeta cierre',async()=>{
    const o=await obra(false),e=await pedido(10,null,o.proyectoId);
    await sql`insert into hitos_proyecto(proyecto_id,tipo) values(${o.proyectoId},'cierre')`;
    await assert.rejects(comprarLineas(sql,e.pedidoId,autor),/cerrado/);
  });
  await prueba('cierre concurrente de sala precede a compra y se observa al reintentar',async()=>{
    const o=await obra(),e=await pedido(10,o.salaId,o.proyectoId),c=await sql.reserve();
    try{
      await c`begin`;await c`select tomar_control_escritura_kit()`;await c`select id from salas where id=${o.salaId} for update`;
      await assert.rejects(comprarLineas(sql,e.pedidoId,autor),/Hay otra operación en curso/);
      await c`insert into hitos_proyecto(proyecto_id,tipo) values(${o.proyectoId},'cierre')`;
      await c`commit`;await assert.rejects(comprarLineas(sql,e.pedidoId,autor),/cerrado/);
    }finally{await c`rollback`;c.release();}
    assert.equal((await estado(e)).fecha,null);
  });
  await prueba('cierre concurrente de proyecto vacío rechaza compra tras reintento completo',async()=>{
    const o=await obra(false),e=await pedido(10,null,o.proyectoId),c=await sql.reserve();
    try{
      await c`begin`;await c`insert into hitos_proyecto(proyecto_id,tipo) values(${o.proyectoId},'cierre')`;
      await assert.rejects(comprarLineas(sql,e.pedidoId,autor),/Hay otra operación en curso/);
      await c`commit`;await assert.rejects(comprarLineas(sql,e.pedidoId,autor),/cerrado/);
    }finally{await c`rollback`;c.release();}
  });
  await prueba('sesión ficticia rechazada en las ocho acciones y los helpers',async()=>{
    const e=await pedido(),o=await obra();const secreto=process.env.SESION_SECRETO;
    delete process.env.SESION_SECRETO;
    try{
      for(const escribir of escrituras(e,o.salaId!)) await assert.rejects(escribir(),/usuario real/);
      await assert.rejects(comprarLineas(sql,e.pedidoId,{...autor,ficticio:true}),/usuario real/);
      await assert.rejects(recibirCompra(sql,{...e,autor:{...autor,ficticio:true}}),/usuario real/);
    }finally{process.env.SESION_SECRETO=secreto;}
    assert.equal((await estado(e)).fecha,null);
  });
  await prueba('sesión ausente, firma falsa y lectura no escriben',async()=>{
    const e=await pedido(),o=await obra();
    try{
      for(const valor of [undefined,cookieReal+'falsa']) {
        cookie=valor;for(const escribir of escrituras(e,o.salaId!))await assert.rejects(escribir(),/No hay sesión/);
      }
      cookie=cookieReal;await sql`update usuarios set rol='lectura' where id=${autor.id}`;
      for(const escribir of escrituras(e,o.salaId!))await assert.rejects(escribir(),/Sin permiso/);
    }finally{cookie=cookieReal;await sql`update usuarios set rol='admin' where id=${autor.id}`;}
  });
  await prueba('acciones reales propagan token y autor de sesión',async()=>{
    const e=await pedido(),f=form(e),cabecera=form(e);cabecera.set('id',e.pedidoId);
    await acciones.cambiarEstadoPedido(cabecera);
    await acciones.recibirLineaPedido(f);await acciones.recibirLineaPedido(f);
    assert.equal((await estado(e)).stock,2);
    cabecera.set('recepcion_id',randomUUID());await acciones.recibirPedidoCompleto(cabecera);await acciones.recibirPedidoCompleto(cabecera);
    assert.equal((await estado(e)).stock,10);
    const filas=await sql`select quien,recepcion_compra_id from movimientos where pedido_linea_id=${e.lineaId}`;
    assert.equal(filas.length,2);assert.ok(filas.every(m=>m.quien===autor.nombre && m.recepcion_compra_id));
  });
  await prueba('migración repetida conserva históricos y no compra líneas nuevas',async()=>{
    const e=await pedido();await sql`update pedidos set estado='pedido' where id=${e.pedidoId}`;
    await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values(${a.id},${u.id},'entrada',1)`;
    await sql.unsafe(readFileSync('db/migraciones/2026-09-trazabilidad-compras.sql','utf8'));
    assert.equal((await estado(e)).fecha,null);
    const [m]=await sql`select recepcion_compra_id from movimientos where pedido_linea_id is null`;assert.equal(m.recepcion_compra_id,null);
  });
  await prueba('oferta y borrado no afectan línea ajena; borrar borrador propio funciona',async()=>{
    const e=await pedido(),otro=await pedido(),f=form(e);f.set('pedido_id',otro.pedidoId);
    await acciones.registrarOfertaLinea(f);await acciones.borrarLineaPedido(f);
    const [l]=await sql`select precio_unitario from pedido_lineas where id=${e.lineaId}`;assert.equal(l.precio_unitario,null);
    const cabecera=form(otro);cabecera.set('id',otro.pedidoId);await ejecutar(acciones.borrarPedido(cabecera));
    assert.equal((await sql`select id from pedidos where id=${otro.pedidoId}`).length,0);
  });
  await prueba('necesidad de HDMI de 5 m llega a pedido y sobrevive a oferta final',async()=>{
    const o=await obra();
    await sql`update salas set largo_m=6,ancho_m=4,alto_m=3 where id=${o.salaId}`;
    const [cable]=await sql`insert into articulos(modelo,tipo,categoria,unidad,senal,longitudes_comerciales_m)
      values('HDMI fixture','cable','QA','ud','hdmi',array[5,10]) returning id`;
    const [equipo]=await sql`insert into articulos(modelo,tipo,categoria,unidad) values ('Equipo HDMI fixture','equipo','QA','ud') returning id`;
    await sql`insert into movimientos(articulo_id,ubicacion_id,tipo,cantidad) values (${equipo.id},${u.id},'entrada',2)`;
    const [puerto]=await sql`insert into puertos(articulo_id,nombre,sentido,senal,total) values (${equipo.id},'HDMI QA','bidireccional','hdmi',1) returning id`;
    const [origen]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${o.salaId},${equipo.id},'Origen') returning id`;
    const [destino]=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values(${o.salaId},${equipo.id},'Destino') returning id`;
    await sql.begin(async tx=>{
      const [c]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,articulo_cable_id,senal,longitud_manual_m)
        values(${o.salaId},${origen.id},${destino.id},${puerto.id},${puerto.id},${cable.id},'hdmi',4) returning id`;
      await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${c.id},'origen',${origen.id},${puerto.id},1),(${c.id},'destino',${destino.id},${puerto.id},1)`;
    });
    const { faltaParaSala }=cargar('../src/lib/datos-almacen') as typeof import('../src/lib/datos-almacen');
    const falta=await faltaParaSala(o.salaId!);
    assert.ok(falta); assert.match(falta.necesidad.find(n=>n.articulo_id===cable.id)!.detalle.join('\n'),/5 m/);
    const f=new FormData();f.set('sala_id',o.salaId!);await ejecutar(acciones.crearPedidoDesdeFalta(f));
    const [l]=await sql`select l.* from pedido_lineas l join pedidos p on p.id=l.pedido_id
      where p.sala_id=${o.salaId} and l.articulo_id=${cable.id}`;
    assert.ok(l);assert.match(l.notas,/5 m/);assert.equal(Number(l.cantidad),1);
    const oferta=new FormData();for(const [k,v] of Object.entries({id:String(l.id),pedido_id:String(l.pedido_id),precio:'12',oferta:'Presupuesto QA'}))oferta.set(k,v);
    await acciones.registrarOfertaLinea(oferta);
    const [actual]=await sql`select notas from pedido_lineas where id=${l.id}`;
    assert.match(actual.notas,/5 m/);assert.match(actual.notas,/Oferta final: Presupuesto QA/);
    // La misma necesidad ya está cubierta: no crea otro pedido al reenviar.
    await ejecutar(acciones.crearPedidoDesdeFalta(f));
    const lineas=await sql`select l.id from pedido_lineas l join pedidos p on p.id=l.pedido_id where p.sala_id=${o.salaId}`;
    assert.equal(lineas.length,1);
  });
  await prueba('guardar almacén y ETA persiste; cabecera refleja selección y compra terminada',async()=>{
    const e=await pedido(),f=form(e);f.set('id',e.pedidoId);f.set('ubicacion_prevista_id',e.ubicacionId);f.set('entrega_prevista','2026-09-15');
    await acciones.guardarPedido(f);
    const { obtenerPedido, listarUbicaciones }=cargar('../src/lib/datos-almacen') as typeof import('../src/lib/datos-almacen');
    const completo=await obtenerPedido(e.pedidoId);assert.ok(completo);
    assert.equal(completo.pedido.ubicacion_prevista_id,e.ubicacionId);assert.equal(completo.pedido.entrega_prevista,'2026-09-15');
    await comprarLineas(sql,e.pedidoId,autor);
    const comprado=await obtenerPedido(e.pedidoId);assert.ok(comprado);
    const { CabeceraPedido, LineasPedido }=cargar('../src/components/compras/detalle-pedido') as typeof import('../src/components/compras/detalle-pedido');
    const { renderToStaticMarkup }=await import('react-dom/server');
    const { JSDOM }=await import('jsdom');
    const ubicaciones=await listarUbicaciones();
    const cabecera=CabeceraPedido({pedido:comprado.pedido,ubicaciones,tienePreciosOrientativos:false,
      compraPendiente:comprado.lineas.some(l=>!l.comprado_en)});
    const dom=new JSDOM(renderToStaticMarkup(cabecera));
    assert.equal(dom.window.document.querySelector('select[name="ubicacion_prevista_id"] option[selected]')?.getAttribute('value'),e.ubicacionId);
    const boton=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent?.includes('Registrar compra'));
    assert.ok(boton);assert.equal(boton.disabled,true);dom.window.close();
    const tabla=new JSDOM(renderToStaticMarkup(LineasPedido({pedido:comprado.pedido,lineas:comprado.lineas,ubicaciones})));
    const tokens=[...tabla.window.document.querySelectorAll('input[name="recepcion_id"]')].map(n=>n.getAttribute('value'));
    assert.equal(tokens.length,2);assert.equal(new Set(tokens).size,2);
    assert.ok(tokens.every(t=>/^[\da-f-]{36}$/.test(t??'')));tabla.window.close();
  });
  if(mutacion)assert.ok(mutada,'La mutación debe haber sido aplicada');
  console.log('RESULTADO pruebas='+pruebas+' fallos='+fallos);
  process.exitCode=fallos?1:0;
} finally {
  cargador._load=original;
  if(global.__sql)await global.__sql.end({timeout:1});
  await sql.end({timeout:1});
  await admin.unsafe('drop database "'+nombre+'" with (force)');
  await admin.end();console.log('FIXTURE ELIMINADO',nombre);
}

import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres, {type Sql, type TransactionSql} from 'postgres';
import { instanciarSuministro } from '../src/lib/suministros-db';
import { proyectarSuministros } from '../src/lib/suministros';

// Derivado del reproductor independiente; la pausa también envuelve la TX real.
// Solo se pausa la entrega del resultado real de equipos; no se alteran sus filas.
const modo=process.argv[2]??'sala',punto=process.argv[3]??'equipos';
assert.ok(['sala','ficha','logistica'].includes(modo));assert.ok(['equipos','suministros','componentes'].includes(punto));
const patron=punto==='equipos'?'select * from sala_equipos where sala_id =':punto==='suministros'?'from sala_suministros where sala_id=':'from sala_componentes_suministro where sala_id=';
const nombre = 'qa_lectura_kit_' + randomUUID().replaceAll('-', '');
const base = 'postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin = postgres(base + 'postgres', { max: 1, onnotice() {} });
let sql: ReturnType<typeof postgres> | undefined, otra: ReturnType<typeof postgres> | undefined;
let creada = false, liberar = () => {}, lectura: Promise<unknown> | undefined;
const modulo = Module as unknown as { _load: (request: string, ...resto: unknown[]) => unknown };
const cargar = modulo._load;
try {
  await admin.unsafe(`create database "${nombre}"`); creada = true;
  console.log('BASE_PROPIA', nombre);
  sql = postgres(base + nombre, { max: 1, onnotice() {} });
  otra = postgres(base + nombre, { max: 1, onnotice() {} });
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  const [sala] = await sql`insert into salas(nombre) values ('Carrera lector L3A') returning id`;
  const [kit] = await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA','Kit QA lectura') returning id`;
  const [c] = await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values (${kit.id},'QA-LECTOR',1,'documentada','Documento QA') returning id`;
  for (let i = 1; i <= 3; i++) {
    const [a] = await sql`insert into articulos(tipo,categoria,modelo) values ('equipo','QA',${'Componente lectura ' + i}) returning id`;
    await sql`insert into articulo_composicion_lineas(composicion_id,clave,articulo_componente_id,identidad,rol,cantidad,inclusion,fuente) values (${c.id},${String(i)},${a.id},${'Pieza ' + i},'equipo',1,'incluido','Documento QA')`;
  }
  await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
  process.env.DATABASE_URL = base + nombre;
  let avisar = () => {}, interceptada = false;
  const pausada = new Promise<void>(r => { avisar = r; });
  const continuar = new Promise<void>(r => { liberar = r; });
  const envolver = (cliente: Sql | TransactionSql): Sql | TransactionSql => new Proxy(cliente, {
    get(target, propiedad) {
      if(propiedad==='begin')return (opciones:string,cuerpo:(tx:TransactionSql)=>Promise<unknown>)=>{
        const begin=Reflect.get(target,'begin') as (opciones:string,cuerpo:(tx:TransactionSql)=>Promise<unknown>)=>Promise<unknown>;
        return begin.call(target,opciones,(tx)=>cuerpo(envolver(tx) as TransactionSql));
      };
      return Reflect.get(target,propiedad);
    },
    apply(target, self, args) {
      const partes = args[0];
      const texto = Array.isArray(partes) && 'raw' in partes ? partes.join('') : '';
      if (!interceptada && texto.includes(patron)) {
        interceptada = true;
        return (async () => {
          const filas = await Reflect.apply(target, self, args);
          console.log('FILAS_LEIDAS_ANTES', punto, filas.length);
          avisar(); await continuar; return filas;
        })();
      }
      return Reflect.apply(target, self, args);
    },
  });
  // Usa el punto de inyección que db.ts ofrece para reutilizar conexiones.
  (globalThis as typeof globalThis & { __sql?: ReturnType<typeof postgres> }).__sql = envolver(sql) as Sql;
  modulo._load = (request, ...resto) => request === 'server-only' ? {} : cargar.call(Module, request, ...resto);
  const { obtenerSala } = await import('../src/lib/datos');
  const { fichaDeSala, fichaConAlmacen } = await import('../src/app/salas/[id]/datos-ficha');
  const leer=modo==='sala'?obtenerSala:modo==='ficha'?fichaDeSala:fichaConAlmacen;
  const promesaLogistica=modo==='logistica'?fichaConAlmacen(sala.id):null;
  const promesa = promesaLogistica??leer(sala.id);
  lectura = promesa; promesa.catch(() => {});
  await Promise.race([pausada, promesa.then(() => { throw new Error('Lector termino sin alcanzar pausa'); })]);
  await instanciarSuministro(otra, sala.id, c.id);
  const [confirmado] = await otra`select
    (select count(*)::int from sala_suministros where sala_id=${sala.id}) kits,
    (select count(*)::int from sala_equipos where sala_id=${sala.id}) equipos,
    (select count(*)::int from sala_componentes_suministro where sala_id=${sala.id}) vinculos`;
  console.log('BD_CONFIRMADA_ANTES_DE_REANUDAR', JSON.stringify(confirmado));
  liberar();
  const resultado = await promesa;
  assert.ok(resultado);
  const resumir=(r:NonNullable<Awaited<ReturnType<typeof leer>>>)=>{
    const p='suministros' in r?proyectarSuministros(r.equipos,r.suministros):r.suministro;
    return {equipos:r.equipos.length,kits:p.necesidades.filter(l=>l.suministro_id).length,
      vinculos:p.componentes.length,necesidad:p.necesidades.reduce((n,l)=>n+l.cantidad,0)};
  };
  const fresco = await leer(sala.id); assert.ok(fresco);
  const observado = resumir(resultado);
  if(promesaLogistica){const datos=await promesaLogistica;assert.ok(datos?.falta);assert.deepEqual(datos.falta.necesidad,datos.necesidad,'Logistica y ficha deben usar la misma revision del montaje');}
  console.log('LECTOR_REAL_INTERCALADO', JSON.stringify(observado));
  console.log('LECTOR_REAL_FRESCO', modo, JSON.stringify(resumir(fresco)));
  assert.deepEqual(confirmado, { kits: 1, equipos: 3, vinculos: 3 });
  assert.deepEqual(observado,{equipos:0,kits:0,vinculos:0,necesidad:0},'El lector pausado conserva su revision anterior completa');
  assert.deepEqual(resumir(fresco),{equipos:3,kits:1,vinculos:3,necesidad:1},'La lectura nueva ve el alta completa');
} finally {
  liberar(); if (lectura) await lectura.catch(() => {});
  modulo._load = cargar;
  delete (globalThis as typeof globalThis & { __sql?: ReturnType<typeof postgres> }).__sql;
  if (otra) await otra.end(); if (sql) await sql.end();
  if (creada) { await admin.unsafe(`drop database "${nombre}"`); console.log('ELIMINADA', nombre); }
  await admin.end();
}

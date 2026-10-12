/** Persistencia L1B, solo fixtures PostgreSQL locales y copias propias. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, cpSync, mkdirSync, mkdtempSync, symlinkSync, unlinkSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import postgres from 'postgres';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
assert.ok(args.every(x=>['--plan','--sin-guardas','--sin-validacion-csv'].includes(x)),'Opciones: --plan, --sin-guardas, --sin-validacion-csv');
console.log('Destino fijo 127.0.0.1:5433; solo qa_fichas_tecnicas_<UUID> propias, sin .env/DATABASE_URL.');
if(args.includes('--plan'))process.exit(0);
const leer=f=>readFileSync(join(raiz,f),'utf8');
const schema=leer('db/schema.sql');const migracion=leer('db/migraciones/2026-09-fichas-tecnicas.sql');
const migracionRosetas=leer('db/migraciones/2026-09-rosetas-conexiones.sql');
const migracionDocumentales=leer('db/migraciones/2026-09-tiradas-documentales.sql');
const csv=leer('data/fichas-tecnicas.csv');
const opts={host:'127.0.0.1',port:5433,username:'av_design',password:'av_design_local',max:1,onnotice:()=>{}};
function mutar(s){
  if(!args.includes('--sin-guardas'))return s;
  const fk='foreign key(puerto_id,articulo_id) references puertos(id,articulo_id) on delete restrict,';
  const check='constraint dato_tecnico_valor_tipado check(valor_dato_tecnico_valido(tipo,valor))';
  assert.ok(s.includes(fk)&&s.includes(check),'Mutación encuentra ambas guardas');
  return s.replace(fk,'').replace(check,'constraint dato_tecnico_valor_tipado check(true)');
}
async function fixture(fn,anterior=false){
  const sombra=mkdtempSync(join(tmpdir(),'av-fichas-tecnicas-'));const nombre='qa_fichas_tecnicas_'+randomUUID().replaceAll('-','');
  const admin=postgres({...opts,database:'postgres'});let creada=false;let sql;
  try{
    cpSync(join(raiz,'data'),join(sombra,'data'),{recursive:true});mkdirSync(join(sombra,'scripts'));mkdirSync(join(sombra,'db'));mkdirSync(join(sombra,'src/lib'),{recursive:true});
    for(const f of ['generar-seed.mjs','normalizacion.mjs','sql-sincronizar-puertos.mjs','sql-datos-tecnicos.mts','sql-tiradas-documentales.mjs','sql-composiciones.mjs'])cpSync(join(raiz,'scripts',f),join(sombra,'scripts',f));
    for(const f of ['ficha-tecnica.ts','tipos.ts'])cpSync(join(raiz,'src/lib',f),join(sombra,'src/lib',f));
    if(args.includes('--sin-validacion-csv')){
      const cambios=[['scripts/generar-seed.mjs',"indice > 0 && linea.trim() && linea.split(';').length !== cabecera.length","false"],
        ['scripts/sql-datos-tecnicos.mts',"puertoFuente === 'csv' && !puertos.some", "false && !puertos.some"],
        ['src/lib/ficha-tecnica.ts',' || Number(valor.slice(0, 4)) < 1','']];
      for(const [f,buscar,reemplazo] of cambios){const ruta=join(sombra,f);const original=readFileSync(ruta,'utf8');assert.ok(original.includes(buscar));writeFileSync(ruta,original.replace(buscar,reemplazo));}
    }
    symlinkSync(join(raiz,'node_modules'),join(sombra,'node_modules'),'junction');
    const generar=(texto=csv)=>{writeFileSync(join(sombra,'data/fichas-tecnicas.csv'),texto);const r=spawnSync(process.execPath,[join(sombra,'scripts/generar-seed.mjs')],{encoding:'utf8'});return {status:r.status,salida:(r.stdout??'')+(r.stderr??''),bytes:existsSync(join(sombra,'db/seed.sql'))?readFileSync(join(sombra,'db/seed.sql')):null};};
    const aplicar=async(texto=csv)=>{const r=generar(texto);assert.equal(r.status,0,r.salida);try{await sql.unsafe(r.bytes.toString());}catch(e){await sql`rollback`;throw e;}};
    await admin.unsafe(`create database "${nombre}"`);creada=true;sql=postgres({...opts,database:nombre});
    await sql.unsafe(anterior?execFileSync('git',['show','f38baa805a1868b7cad55bb97064386e9b5f8555:db/schema.sql'],{cwd:raiz,encoding:'utf8'}):mutar(schema));
    const [historico]=await sql`insert into articulos(tipo,categoria,modelo,descripcion) values ('equipo','QA','Histórico B','No perder') returning id`;
    const antes=Array.from(await sql`select * from articulos where id=${historico.id}`);
    let conexionHistorica;
    if(anterior){
      const [p]=await sql`insert into puertos(articulo_id,nombre,total,sentido,senal,fuente) values (${historico.id},'Boca histórica',1,'bidireccional','red','app') returning id`;
      const [s]=await sql`insert into salas(nombre) values ('Sala histórica B') returning id`;
      const e=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${s.id},${historico.id},'Histórico origen'),(${s.id},${historico.id},'Histórico destino') returning id`;
      [conexionHistorica]=await sql`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id) values (${s.id},${e[0].id},${e[1].id},${p.id},${p.id}) returning *`;
    }
    await sql.unsafe(mutar(migracion));await sql.unsafe(mutar(migracion));
    // El cable histórico nace bajo f38 real; L2B lo reconoce sin inventar bocas.
    if(anterior){await sql.unsafe(migracionRosetas);await sql.unsafe(migracionDocumentales);}
    assert.deepEqual(Array.from(await sql`select * from articulos where id=${historico.id}`),antes,'Migración/repetición preserva artículo previo');
    await sql.unsafe(readFileSync(join(raiz,'db/migraciones/2026-09-suministros-kit.sql'),'utf8'));
    await aplicar();
    const [a]=await sql`select id from articulos where marca='CISCO' and modelo='CODEC EQ'`;
    const snapshot=async()=>{const tablas=await sql`select tablename from pg_tables where schemaname='public' order by tablename`;assert.ok(tablas.length);const r={};for(const {tablename:t}of tablas)r[t]=Array.from(await sql.unsafe(`select to_jsonb(x)::text v from "${t}" x order by to_jsonb(x)::text`),x=>x.v);return r;};
    await fn({sql,a,generar,aplicar,snapshot,sombra});
    if(conexionHistorica){
      const [actual]=await sql`select * from conexiones where id=${conexionHistorica.id}`;
      const {detalle_extremos,...camposHistoricos}=actual;
      assert.equal(detalle_extremos,'legacy','La migración no inventa bocas históricas');
      assert.deepEqual(camposHistoricos,conexionHistorica,'Migración y seeds conservan todos los campos históricos y sus referencias de puerto');
      assert.equal((await sql`select count(*)::int n from conexion_bocas where conexion_id=${conexionHistorica.id}`)[0].n,0);
    }
  }finally{if(sql){await sql`rollback`;await sql.end();}if(creada){await admin.unsafe(`drop database "${nombre}"`);console.log('FIXTURE ELIMINADO',nombre);}await admin.end();const destino=resolve(sombra);assert.ok(destino.startsWith(resolve(tmpdir())+sep)&&destino.includes('av-fichas-tecnicas-'));if(existsSync(join(sombra,'node_modules')))unlinkSync(join(sombra,'node_modules'));rmSync(destino,{recursive:true,force:true});}
}
for(const anterior of [false,true])await test(`${anterior?'Upgrade poblado':'Instalación limpia'}: hechos CSV, identidad estable y repetición`,()=>fixture(async({sql,aplicar})=>{
  const antes=Array.from(await sql`select * from articulo_datos_tecnicos order by id`);
  const esperados=csv.split(/\r?\n/).filter(l=>l.trim()).length-1;assert.ok(esperados>0);assert.equal(antes.length,esperados);
  assert.deepEqual(Array.from(await sql`select categoria from articulos where marca='CISCO' and modelo='TABLE MICROPHONE PRO'`),[{categoria:'MICRÓFONO'}]);
  assert.equal((await sql`select count(*)::int n from articulo_datos_tecnicos where estado='sin_documentar' and valor is not null`)[0].n,0);
  await aplicar();assert.deepEqual(Array.from(await sql`select * from articulo_datos_tecnicos order by id`),antes);
  await sql.unsafe(mutar(migracion));assert.deepEqual(Array.from(await sql`select * from articulo_datos_tecnicos order by id`),antes,'Segunda migración sobre hechos preserva todo');
},anterior));
await test('App prevalece y una retirada conserva UUID como desconocido SQL NULL',()=>fixture(async({sql,a,aplicar})=>{
  const [d]=await sql`update articulo_datos_tecnicos set fuente='app',valor='{"captacion":"integrada"}'::jsonb where articulo_id=${a.id} and clave='microfonia' returning *`;
  await aplicar();assert.deepEqual((await sql`select * from articulo_datos_tecnicos where id=${d.id}`)[0],d);
  const [otro]=await sql`select id from articulo_datos_tecnicos where fuente='csv' limit 1`;
  await aplicar(csv.split(/\r?\n/)[0]+'\n');
  assert.deepEqual((await sql`select * from articulo_datos_tecnicos where id=${d.id}`)[0],d);
  assert.deepEqual(Array.from(await sql`select id,estado,valor from articulo_datos_tecnicos where id=${otro.id}`),[{id:otro.id,estado:'sin_documentar',valor:null}]);
}));
await test('Guardas SQL rechazan tipos JSON inválidos y documentan los seis contratos',()=>fixture(async({sql,a})=>{
  const buenos=[['microfonia',{captacion:'externa'}],['alimentacion',{descripcion:'Adaptador'}],['poe',{rol:'pse',vatios:null,estandar:null,compartido:true}],['suministro',{referencia:'Cable',cantidad:1,longitud_m:null,longitud_aplica:true,incluido:null}],['puerto',{nombre:'LAN',total:1,sentido:'bidireccional',senal:'red',conector:null}],['restriccion',{texto:'Dato'}]];
  for(const [tipo,valor] of buenos){
    await sql`insert into articulo_datos_tecnicos(articulo_id,clave,concepto,tipo,estado,valor,fuente_url,documento,apartado,consultado_en,fuente) values (${a.id},${'qa-'+tipo},${'Concepto QA '+tipo},${tipo},'parcial',${sql.json(valor)},'https://example.com/fuente','Documento','Página 1','2026-09-08','app')`;
    await assert.rejects(sql`update articulo_datos_tecnicos set valor='{}'::jsonb where articulo_id=${a.id} and clave=${'qa-'+tipo}`,{code:'23514'});
    await assert.rejects(sql`update articulo_datos_tecnicos set valor=${sql.json({...valor,extra:true})} where articulo_id=${a.id} and clave=${'qa-'+tipo}`,{code:'23514'});
  }
  for(const valor of [{rol:'pse',vatios:-1,estandar:null,compartido:true},{rol:'pse',vatios:'90',estandar:null,compartido:true},{rol:'otro',vatios:1,estandar:null,compartido:true}])await assert.rejects(sql`update articulo_datos_tecnicos set valor=${sql.json(valor)} where articulo_id=${a.id} and clave='qa-poe'`,{code:'23514'});
  for(const valor of [{referencia:'x',cantidad:1.5,longitud_m:1,longitud_aplica:true,incluido:true},{referencia:'x',cantidad:1,longitud_m:0,longitud_aplica:true,incluido:true},{referencia:'x',cantidad:1,longitud_m:11,longitud_aplica:false,incluido:true}])await assert.rejects(sql`update articulo_datos_tecnicos set valor=${sql.json(valor)} where articulo_id=${a.id} and clave='qa-suministro'`,{code:'23514'});
}));
await test('Procedencia, estado y fuente inválidos se rechazan sin perder la fila',()=>fixture(async({sql,a})=>{
  const [d]=await sql`select * from articulo_datos_tecnicos where articulo_id=${a.id} and clave='microfonia'`;
  for(const fuente of ['http://example.com','https://usuario:clave@example.com','javascript:alert(1)','',
    'https://:bad','https://example.com:abc','https://[bad','https://example.com:65536','HTTPS://example.com:65536','https://999.999.999.999'])await assert.rejects(sql`update articulo_datos_tecnicos set fuente_url=${fuente} where id=${d.id}`,{code:'23514'});
  await assert.rejects(sql`update articulo_datos_tecnicos set fuente_url=null where id=${d.id}`,{code:'23514'});
  await assert.rejects(sql`update articulo_datos_tecnicos set documento=' ' where id=${d.id}`,{code:'23514'});
  await assert.rejects(sql`update articulo_datos_tecnicos set consultado_en='infinity' where id=${d.id}`,{code:'23514'});
  await assert.rejects(sql`update articulo_datos_tecnicos set fuente='otra' where id=${d.id}`,{code:'23514'});
  await assert.rejects(sql`update articulo_datos_tecnicos set estado='sin_documentar' where id=${d.id}`,{code:'23514'});
  await assert.rejects(sql`update articulo_datos_tecnicos set estado='sin_documentar',valor='null'::jsonb where id=${d.id}`,{code:'23514'});
  assert.deepEqual((await sql`select * from articulo_datos_tecnicos where id=${d.id}`)[0],d);
}));
await test('FK compuesta impide puerto de otro artículo y conserva referencia propia',()=>fixture(async({sql,a})=>{
  const [d]=await sql`select * from articulo_datos_tecnicos where articulo_id=${a.id} and puerto_id is not null limit 1`;
  const [otro]=await sql`select id from puertos where articulo_id<>${a.id} limit 1`;
  await assert.rejects(sql`update articulo_datos_tecnicos set puerto_id=${otro.id} where id=${d.id}`,{code:'23503'});
  assert.deepEqual((await sql`select * from articulo_datos_tecnicos where id=${d.id}`)[0],d);
}));
await test('CSV inválido conserva bytes y fuente SQL sin resolver revierte todo el seed',()=>fixture(async({sql,generar,snapshot})=>{
  const bueno=generar();assert.equal(bueno.status,0,bueno.salida);
  const cabecera=csv.split(/\r?\n/)[0];
  for(const texto of ['', 'archivo_incorrecto\n',cabecera+';clave\n',cabecera.replace(';tipo','')+'\n',
    ...['http://www.cisco.com','https://:bad','https://example.com:abc','https://[bad','https://[::1]'].map(url=>csv.replace('https://www.cisco.com',url)),
    csv.replace('2026-09-08','0000-01-01')]){
    const r=generar(texto);assert.notEqual(r.status,0);assert.deepEqual(r.bytes,bueno.bytes);
  }
  const mal=bueno.bytes.toString().replace(/(-- BEGIN FICHAS TECNICAS[\s\S]*)/,s=>s.replaceAll("'HDMI outputs'","'PUERTO QA INEXISTENTE'"));
  assert.notEqual(mal,bueno.bytes.toString());const antes=await snapshot();
  await assert.rejects(sql.unsafe(mal),e=>e.code==='23514'&&e.message.includes('Ficha técnica: artículo o puerto sin resolver'));
  await sql`rollback`;assert.deepEqual(await snapshot(),antes);
}));
for(const caso of ['columnas','puerto'])await test(`${caso}: entrada inválida conserva seed byte a byte`,()=>fixture(async({generar})=>{
  const bueno=generar();assert.equal(bueno.status,0,bueno.salida);
  const lineas=csv.trimEnd().split(/\r?\n/);const h=lineas[0].split(';');
  const indice=lineas.findIndex(l=>l.startsWith('CISCO;CODEC EQ;puerto-hdmi-salidas;'));assert.ok(indice>0);
  const cambiar=(fn)=>{const copia=[...lineas];copia[indice]=fn(copia[indice].split(';')).join(';');return copia.join('\n')+'\n';};
  const casos=caso==='columnas'?[cambiar(c=>c.slice(0,-2)),cambiar(c=>[...c,'sobra'])]:[
    cambiar(c=>{c[h.indexOf('puerto_nombre')]='PUERTO NO EXISTENTE';return c;}),
    cambiar(c=>{c[h.indexOf('puerto_fuente')]='';return c;})];
  for(const texto of casos){const r=generar(texto);assert.notEqual(r.status,0);assert.match(r.salida,/columnas incorrecto|puerto CSV no resuelto|puerto_fuente explícita/);assert.deepEqual(r.bytes,bueno.bytes);}
}));
await test('Puerto app explícito se resuelve solo en BD y nunca confunde una fila CSV',()=>fixture(async({sql,a,aplicar,generar,snapshot})=>{
  const lineas=csv.trimEnd().split(/\r?\n/);const h=lineas[0].split(';');
  const cambiar=(nombre)=>lineas.map((l,i)=>{if(!i||!l.startsWith('CISCO;CODEC EQ;puerto-hdmi-salidas;'))return l;const c=l.split(';');c[h.indexOf('puerto_nombre')]=nombre;c[h.indexOf('puerto_fuente')]='app';return c.join(';');}).join('\n')+'\n';
  const soloCsv=cambiar('HDMI outputs');assert.equal(generar(soloCsv).status,0);
  const antes=await snapshot();await assert.rejects(aplicar(soloCsv),e=>e.code==='23514'&&e.message.includes('artículo o puerto sin resolver'));assert.deepEqual(await snapshot(),antes);
  const [p]=await sql`insert into puertos(articulo_id,nombre,total,sentido,senal,fuente) values (${a.id},'Boca solo app QA',1,'salida','hdmi','app') returning *`;
  await aplicar(cambiar(p.nombre));assert.equal((await sql`select puerto_id from articulo_datos_tecnicos where articulo_id=${a.id} and clave='puerto-hdmi-salidas'`)[0].puerto_id,p.id);
  assert.deepEqual((await sql`select * from puertos where id=${p.id}`)[0],p);
}));
await test('Upgrade B ronda1 conserva app/procedencia/valor y añade solo metadatos desconocidos',()=>fixture(async({sql,a})=>{
  // Solo en fixture propio: reconstruir la tabla desde el artefacto histórico congelado.
  await sql`drop table articulo_datos_tecnicos`;
  await sql.unsafe(leer('scripts/fixtures/fichas-tecnicas-ronda1.sql'));
  const [p]=await sql`select id from puertos where articulo_id=${a.id} limit 1`;
  await sql`insert into articulo_datos_tecnicos(articulo_id,clave,tipo,estado,valor,fuente_url,documento,apartado,consultado_en,puerto_id,fuente)
    values (${a.id},'app-cable','suministro','parcial','{"referencia":"Cable histórico real","cantidad":1,"longitud_m":11,"incluido":true}',
    'https://example.com/manual','Manual histórico','Página 2','2026-09-07',${p.id},'app'),
    (${a.id},'legacy-sin-documentar','restriccion','sin_documentar',null,null,null,null,null,null,'csv')`;
  const antes=Array.from(await sql`select * from articulo_datos_tecnicos order by clave`);
  await sql.unsafe(mutar(migracion));const despues=Array.from(await sql`select * from articulo_datos_tecnicos order by clave`);
  assert.deepEqual(despues,antes.map(d=>({...d,concepto:d.tipo==='suministro'?d.valor.referencia:d.clave,valor:d.valor?{...d.valor,longitud_aplica:null}:null})));
  await sql.unsafe(mutar(migracion));assert.deepEqual(Array.from(await sql`select * from articulo_datos_tecnicos order by clave`),despues);
}));
await test('Retirada de puerto con ficha vigente o retirada exige resolución, diagnóstico y rollback',()=>fixture(async({sql,a,sombra,aplicar,generar,snapshot})=>{
  const [d]=await sql`select * from articulo_datos_tecnicos where articulo_id=${a.id} and clave='puerto-hdmi-salidas'`;
  assert.ok(d.puerto_id);
  const ruta=join(sombra,'data/puertos.csv');const original=readFileSync(ruta,'utf8');
  const retirado=original.split(/\r?\n/).filter(l=>!l.startsWith('CISCO;CODEC EQ;VIDEOCONFERENCIA;HDMI outputs;')).join('\n');
  assert.notEqual(retirado,original);
  const sinFuente=csv.split(/\r?\n/).filter(l=>!l.startsWith('CISCO;CODEC EQ;puerto-hdmi-salidas;')).join('\n');
  for(const fuenteRetirada of [false,true]){
    if(fuenteRetirada){writeFileSync(ruta,original);await aplicar(sinFuente);assert.deepEqual(Array.from(await sql`select estado,valor,puerto_id from articulo_datos_tecnicos where id=${d.id}`),[{estado:'sin_documentar',valor:null,puerto_id:d.puerto_id}]);}
    writeFileSync(ruta,retirado);const antes=await snapshot();
    if(fuenteRetirada){
      await assert.rejects(aplicar(sinFuente),e=>e.code==='23514'&&e.detail.includes('ficha_tecnica')&&e.detail.includes(d.id)&&e.detail.includes(d.clave));
    }else{
      const antesBytes=readFileSync(join(sombra,'db/seed.sql'));const rechazo=generar(csv);
      assert.notEqual(rechazo.status,0);assert.match(rechazo.salida,/puerto CSV no resuelto/);assert.deepEqual(rechazo.bytes,antesBytes);
    }
    assert.deepEqual(await snapshot(),antes);
  }
}));

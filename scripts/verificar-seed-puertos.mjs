/** QA serial de sincronización: copia propia, CSV sintético y bases locales desechables. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import postgres from 'postgres';
import { leerTiradasDocumentales, sqlTiradasDocumentales } from './sql-tiradas-documentales.mjs';

const raiz = fileURLToPath(new URL('../',import.meta.url));
const opciones=process.argv.slice(2);
assert.ok(opciones.every(x=>['--plan','--sin-arreglo','--sin-validacion-csv'].includes(x)),'Opciones: --plan, --sin-arreglo, --sin-validacion-csv');
console.log('Destino fijo 127.0.0.1:5433; solo qa_seed_puertos_<UUID> propias. No usa .env ni DATABASE_URL.');
if(opciones.includes('--plan')) process.exit(0);
const sinArreglo=opciones.includes('--sin-arreglo');
const esquema=readFileSync(join(raiz,'db/schema.sql'),'utf8');
// Esquema real preservado en L0, antes de fichas, etiquetas y rosetas.
const historicoL0=readFileSync(join(raiz,'scripts/fixtures/schema-plan40-l0.sql'),'utf8');
assert.equal(createHash('sha256').update(historicoL0).digest('hex'),'74b945eb844ffaaa44a742181d9563119a6aac3f113dc903c69ce03fb73511ed');
const migracionFichas=readFileSync(join(raiz,'db/migraciones/2026-09-fichas-tecnicas.sql'),'utf8');
const migracionEtiquetas=readFileSync(join(raiz,'db/migraciones/2026-09-etiquetas-cable.sql'),'utf8');
const migracionRosetas=readFileSync(join(raiz,'db/migraciones/2026-09-rosetas-conexiones.sql'),'utf8');
const migracionDocumentales=readFileSync(join(raiz,'db/migraciones/2026-09-tiradas-documentales.sql'),'utf8');
const bloqueDocumentales=sqlTiradasDocumentales(leerTiradasDocumentales(readFileSync(join(raiz,'data/plantillas-tiradas.csv'),'utf8')));
const originalCsv=readFileSync(join(raiz,'data/puertos.csv'),'utf8');
const huella=()=>createHash('sha256').update(readFileSync(join(raiz,'scripts/generar-seed.mjs'))).digest('hex');
const huellaInicial=huella();
const configuracion={host:'127.0.0.1',port:5433,username:'av_design',password:'av_design_local',max:1,onnotice:()=>{}};

async function fixture(ejecutar,conHistorica=false) {
  const sombra=mkdtempSync(join(tmpdir(),'av-seed-puertos-'));
  const nombre=`qa_seed_puertos_${randomUUID().replaceAll('-','')}`;
  const admin=postgres({...configuracion,database:'postgres'});
  let creada=false;
  let sql;
  try {
    cpSync(join(raiz,'data'),join(sombra,'data'),{recursive:true});
    mkdirSync(join(sombra,'scripts'));mkdirSync(join(sombra,'db'));
    for(const f of ['generar-seed.mjs','normalizacion.mjs','sql-sincronizar-puertos.mjs','sql-datos-tecnicos.mts','sql-tiradas-documentales.mjs','sql-composiciones.mjs']) cpSync(join(raiz,'scripts',f),join(sombra,'scripts',f));
    mkdirSync(join(sombra,'src/lib'),{recursive:true});
    for(const f of ['ficha-tecnica.ts','tipos.ts']) cpSync(join(raiz,'src/lib',f),join(sombra,'src/lib',f));
    symlinkSync(join(raiz,'node_modules'),join(sombra,'node_modules'),'junction');
    // Unidad A aísla puertos. Las FK/fuentes de fichas tienen su matriz B propia.
    const fichas=join(sombra,'data/fichas-tecnicas.csv');
    if(existsSync(fichas)) writeFileSync(fichas,readFileSync(fichas,'utf8').split(/\r?\n/)[0]+'\n');
    const generar=(csv=originalCsv)=>{
      writeFileSync(join(sombra,'data/puertos.csv'),csv);
      const r=spawnSync(process.execPath,[join(sombra,'scripts/generar-seed.mjs')],{encoding:'utf8'});
      return {estado:r.status,salida:(r.stdout??'')+(r.stderr??''),sql:readFileSync(join(sombra,'db/seed.sql'),'utf8'),bytes:readFileSync(join(sombra,'db/seed.sql'))};
    };
    const inicial=generar();assert.equal(inicial.estado,0,inicial.salida);
    await admin.unsafe(`create database "${nombre}"`);creada=true;
    sql=postgres({...configuracion,database:nombre});
    if(conHistorica){await sql.unsafe(historicoL0);await sql.unsafe(migracionFichas);await sql.unsafe(migracionEtiquetas);}
    else await sql.unsafe(esquema);
    await sql.unsafe(readFileSync(join(raiz,'db/migraciones/2026-09-suministros-kit.sql'),'utf8'));
    // Preparar el legado antes de instalar L2B. El seed completo se aplica tras migrarlo.
    assert.ok(inicial.sql.includes(bloqueDocumentales));
    await sql.unsafe(conHistorica?inicial.sql.replace(bloqueDocumentales,''):inicial.sql);
    if(opciones.includes('--sin-validacion-csv')) {
      const archivo=join(sombra,'scripts/generar-seed.mjs');
      const fuente=readFileSync(archivo,'utf8');
      const cabecera=/if \(hayCsvPuertos\) \{\s+const primeraLinea[\s\S]*?\n\}\nconst filasPuerto/;
      const rango='Number.isSafeInteger(valor) && valor >= -2147483648 && valor <= 2147483647';
      assert.match(fuente,cabecera);assert.ok(fuente.includes(rango));
      writeFileSync(archivo,fuente.replace(cabecera,'const filasPuerto').replace(rango,'Number.isInteger(valor)'));
    }
    if(sinArreglo) {
      // Mutación causal en la COPIA: estrategia previa delete/reinsert, conservando carga y resto del seed.
      const archivo=join(sombra,'scripts/sql-sincronizar-puertos.mjs');
      const fuente=readFileSync(archivo,'utf8');
      const patron=/-- Serializar altas[\s\S]*?-- END SINCRONIZACION PUERTOS/;
      assert.match(fuente,patron);
      writeFileSync(archivo,fuente.replace(patron,`delete from puertos where fuente='csv';
insert into puertos(articulo_id,nombre,total,sentido,senal,conector,orden,notas,fuente)
select articulo_id,nombre,total,sentido,senal,conector,orden,notas,'csv' from seed_puertos
on conflict(articulo_id,nombre) do nothing;
-- END SINCRONIZACION PUERTOS`));
    }
    const [p]=await sql`select p.* from puertos p join articulos a on a.id=p.articulo_id where a.marca='CISCO' and a.modelo='CODEC EQ' and p.nombre='HDMI outputs'`;
    assert.ok(p,'El seed debe haber encontrado Codec EQ HDMI outputs');
    let historica;
    if(conHistorica){
      const [s]=await sql`insert into salas(nombre) values ('Sala QA puertos') returning id`;
      const e=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${s.id},${p.articulo_id},'Origen QA'),(${s.id},${p.articulo_id},'Destino QA') returning id`;
      const [c]=await sql`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal) values (${s.id},${e[0].id},${e[1].id},${p.id},${p.id},'hdmi') returning id`;
      historica={s,e,c};
      await sql.unsafe(migracionRosetas);
      await sql.unsafe(migracionDocumentales);
      await sql.unsafe(inicial.sql);
      assert.equal((await sql`select detalle_extremos from conexiones where id=${c.id}`)[0].detalle_extremos,'legacy');
    }
    const editarCsv=(cambio)=>{
      const lineas=originalCsv.trimEnd().split(/\r?\n/);const cabecera=lineas[0].split(';');
      let encontradas=0;
      const filas=lineas.slice(1).flatMap(l=>{
        const r=Object.fromEntries(l.split(';').map((v,i)=>[cabecera[i],v]));
        if(r.marca==='CISCO'&&r.modelo==='CODEC EQ'&&r.nombre==='HDMI outputs') {encontradas++;const nueva=cambio(r);return nueva?[cabecera.map(k=>nueva[k]).join(';')]:[];}
        return [l];
      });assert.equal(encontradas,1);
      return [lineas[0],...filas].join('\n')+'\n';
    };
    const aplicar=async(csv=originalCsv)=>{const r=generar(csv);assert.equal(r.estado,0,r.salida);try{await sql.unsafe(r.sql);}catch(e){await sql`rollback`;throw e;}};
    const referencias=async(fisicas=false)=>{
      if(!fisicas){assert.ok(historica,'El legado se crea en el esquema histórico antes de migrar');return historica;}
      const [s]=await sql`insert into salas(nombre) values ('Sala QA puertos') returning id`;
      const e=await sql`insert into sala_equipos(sala_id,articulo_id,nombre) values (${s.id},${p.articulo_id},'Origen QA'),(${s.id},${p.articulo_id},'Destino QA') returning id`;
      const c=await sql.begin(async tx=>{
        const [fila]=await tx`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,senal) values (${s.id},${e[0].id},${e[1].id},${p.id},${p.id},'hdmi') returning id`;
        await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${fila.id},'origen',${e[0].id},${p.id},3),(${fila.id},'destino',${e[1].id},${p.id},1)`;
        return fila;
      });
      return {s,e,c};
    };
    const plantilla=async()=>{
      const [t]=await sql`insert into plantillas_sala(nombre,tipologia) values ('Plantilla QA puertos','QA') returning id`;
      const e=await sql`insert into plantilla_articulos(plantilla_id,articulo_id,categoria,cantidad) values (${t.id},${p.articulo_id},'QA A',1),(${t.id},${p.articulo_id},'QA B',1) returning id`;
      const c=await sql.begin(async tx=>{
        const [fila]=await tx`insert into plantilla_conexiones(plantilla_id,origen_linea_id,destino_linea_id) values (${t.id},${e[0].id},${e[1].id}) returning id`;
        await tx`insert into plantilla_conexion_bocas(plantilla_conexion_id,lado,linea_id,puerto_id,ordinal) values (${fila.id},'origen',${e[0].id},${p.id},3),(${fila.id},'destino',${e[1].id},${p.id},1)`;
        return fila;
      });
      return c;
    };
    const snapshot=async()=>{
      const tablas=await sql`select tablename from pg_tables where schemaname='public' order by tablename`;
      assert.ok(tablas.length>0);
      const resultado={};
      for(const {tablename} of tablas) resultado[tablename]=Array.from(await sql.unsafe(`select to_jsonb(t)::text as fila from "${tablename}" t order by to_jsonb(t)::text`),r=>r.fila);
      return resultado;
    };
    await ejecutar({sql,p,generar,aplicar,editarCsv,referencias,plantilla,snapshot,nombre});
  } finally {
    if(sql){await sql`rollback`;await sql.end();}
    if(creada){await admin.unsafe(`drop database "${nombre}"`);console.log(`FIXTURE ELIMINADO ${nombre}`);}
    await admin.end();
    const destino=resolve(sombra);
    assert.ok(destino.startsWith(resolve(tmpdir())+sep)&&destino.includes('av-seed-puertos-'));
    if(existsSync(join(sombra,'node_modules')))unlinkSync(join(sombra,'node_modules'));
    rmSync(destino,{recursive:true,force:true});
    assert.equal(huella(),huellaInicial,'El generador compartido permanece intacto');
  }
}

await test('Resembrar conserva UUID y puertos legacy',()=>fixture(async({sql,p,referencias,aplicar})=>{
  const {c}=await referencias();await aplicar();
  assert.equal((await sql`select id from puertos where articulo_id=${p.articulo_id} and nombre=${p.nombre}`)[0].id,p.id);
  assert.deepEqual(Array.from(await sql`select puerto_origen_id,puerto_destino_id from conexiones where id=${c.id}`),[{puerto_origen_id:p.id,puerto_destino_id:p.id}]);
},true));
await test('Resembrar conserva bocas de sala y plantilla, orden e identidad de cable',()=>fixture(async({sql,referencias,plantilla,aplicar})=>{
  const {c}=await referencias(true);const pc=await plantilla();
  const estado=async()=>{
    const conexiones=Array.from(await sql`select * from conexiones where id=${c.id}`);
    const etiquetas=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',
      "import {readFileSync} from 'node:fs'; import {identificadoresDeCable} from './src/lib/cable-schedule.ts'; console.log(JSON.stringify([...identificadoresDeCable(JSON.parse(readFileSync(0,'utf8')))]));"],{cwd:raiz,encoding:'utf8',input:JSON.stringify(conexiones)});
    assert.equal(etiquetas.status,0,etiquetas.stderr);
    const etiquetasLeidas=JSON.parse(etiquetas.stdout);
    assert.equal(conexiones.length,1);
    assert.equal(etiquetasLeidas.length,1);
    assert.equal(conexiones[0].etiqueta_cable,'HD-1000','La conexión confirmada tiene una brida persistida');
    assert.deepEqual(etiquetasLeidas,[[c.id,conexiones[0].etiqueta_cable]],'La lectura conserva la brida, no un estado provisional');
    return {c:conexiones,etiquetas:etiquetasLeidas,b:Array.from(await sql`select * from conexion_bocas where conexion_id=${c.id} order by lado`),p:Array.from(await sql`select * from plantilla_conexion_bocas where plantilla_conexion_id=${pc.id} order by lado`)};
  };
  const antes=await estado();await aplicar();assert.deepEqual(await estado(),antes);
}));
await test('Nota y ampliación actualizan CSV sin cambiar identidad; fuente app prevalece incluso en choque',()=>fixture(async({sql,p,editarCsv,aplicar})=>{
  await aplicar(editarCsv(r=>({...r,total:'4',notas:'Nota QA actualizada'})));
  assert.deepEqual(Array.from(await sql`select id,total,notas from puertos where id=${p.id}`),[{id:p.id,total:4,notas:'Nota QA actualizada'}]);
  await sql`update puertos set fuente='app',total=7,notas='Dato físico app' where id=${p.id}`;
  const [extra]=await sql`insert into puertos(articulo_id,nombre,total,sentido,senal,fuente) values (${p.articulo_id},'SOLO APP',2,'entrada','hdmi','app') returning id`;
  const antes=Array.from(await sql`select * from puertos where id in (${p.id},${extra.id}) order by id`);
  await aplicar();assert.deepEqual(Array.from(await sql`select * from puertos where id in (${p.id},${extra.id}) order by id`),antes);
}));
for(const [nombre,fisicas,conPlantilla,retiro] of [
  ['Retirada legacy',false,false,true],['Reducción legacy desconocida',false,false,false],
  ['Retirada física sala y plantilla',true,true,true],['Reducción ordinal ocupado sala y plantilla',true,true,false],
]) await test(`${nombre}: enumera afectados y revierte todo el seed`,()=>fixture(async({p,referencias,plantilla,snapshot,aplicar,editarCsv})=>{
  const {c}=await referencias(fisicas);const pc=conPlantilla?await plantilla():null;
  const antes=await snapshot();
  await assert.rejects(aplicar(editarCsv(r=>retiro?null:{...r,total:'2'})),e=>{
    assert.equal(e.code,'23514');assert.match(e.message,/CSV de puertos incompatible/);
    assert.ok(e.detail.includes(p.id)&&e.detail.includes(p.nombre)&&e.detail.includes(c.id)&&e.detail.includes('Sala QA puertos'));
    assert.ok(e.detail.includes(fisicas?'ordinal 3':'ordinal desconocido'));
    if(pc)assert.ok(e.detail.includes(pc.id)&&e.detail.includes('Plantilla QA puertos'));
    console.log('RECHAZO ESPERADO',e.detail);return true;
  });assert.deepEqual(await snapshot(),antes);
},!fisicas));
await test('Retirada sin uso elimina solo la fila retirada',()=>fixture(async({sql,p,aplicar,editarCsv})=>{
  const antes=Array.from(await sql`select id from puertos where id<>${p.id} order by id`);
  await aplicar(editarCsv(()=>null));assert.equal((await sql`select count(*)::int n from puertos where id=${p.id}`)[0].n,0);
  assert.deepEqual(Array.from(await sql`select id from puertos order by id`),antes);
}));
await test('Artículo CSV inexistente aborta generación y conserva archivo previo',()=>fixture(async({generar,editarCsv})=>{
  const bueno=generar();const malo=generar(editarCsv(r=>({...r,modelo:'MODELO QA INEXISTENTE'})));
  assert.notEqual(malo.estado,0);assert.match(malo.salida,/sinArticulo/);assert.equal(malo.sql,bueno.sql,'El seed anterior no se sobrescribe');
}));
await test('Cabeceras inválidas nunca sobrescriben el seed previo, incluso sin filas',()=>fixture(async({generar})=>{
  const cabecera=originalCsv.split(/\r?\n/)[0];
  const buena=generar();assert.equal(buena.estado,0);
  const casos=[['incorrecta','archivo_incorrecto\n'],['vacía',''],['solo blancos',' \n'],
    ['falta columna',cabecera.split(';').filter(c=>c!=='total').join(';')+'\n'],
    ['duplicada',cabecera+';total\n'],['columna vacía',cabecera+';\n']];
  for(const [nombre,csv] of casos){const r=generar(csv);assert.notEqual(r.estado,0,nombre);assert.match(r.salida,/Cabecera de puertos inválida/);assert.deepEqual(r.bytes,buena.bytes,`Preserva bytes: ${nombre}`);console.log(`RECHAZO CABECERA ${nombre}: bytes conservados`);}
}));
await test('Total y orden respetan int32, rechazando cada valor inválido sin sobrescribir bytes',()=>fixture(async({generar,editarCsv,sql,aplicar,p})=>{
  const buena=generar();assert.equal(buena.estado,0);
  const casos=[...['','0','-1','1.5','NaN','Infinity','2147483648','9007199254740992'].map(v=>['total',v]),
    ...['-2147483649','2147483648','1.5','NaN','Infinity','9007199254740992'].map(v=>['orden',v])];
  for(const [campo,valor] of casos){const r=generar(editarCsv(f=>({...f,[campo]:valor})));assert.notEqual(r.estado,0,`${campo}=${valor}`);assert.match(r.salida,/total u orden inválido/);assert.deepEqual(r.bytes,buena.bytes,`Preserva bytes: ${campo}=${valor}`);console.log(`RECHAZO INT32 ${campo}=${valor}: bytes conservados`);}
  for(const [total,orden] of [['1','-2147483648'],['2147483647','2147483647'],['1','0'],['1','']]) {
    await aplicar(editarCsv(f=>({...f,total,orden})));
    assert.deepEqual(Array.from(await sql`select total,orden from puertos where id=${p.id}`),[{total:Number(total),orden:orden===''?null:Number(orden)}]);
  }
}));
await test('Cabecera válida sin filas es retirada explícita; respeta app y guardas de uso',()=>fixture(async({sql,p,generar,aplicar,referencias,snapshot})=>{
  const vacio=originalCsv.split(/\r?\n/)[0]+'\n';assert.equal(generar(vacio).estado,0);
  await referencias();const antes=await snapshot();
  await assert.rejects(aplicar(vacio),e=>e.code==='23514'&&e.detail.includes(p.id));assert.deepEqual(await snapshot(),antes);
  await sql`delete from conexiones`;const [app]=await sql`insert into puertos(articulo_id,nombre,total,sentido,senal,fuente) values (${p.articulo_id},'SOLO APP VACIO',1,'entrada','hdmi','app') returning id`;
  await aplicar(vacio);assert.deepEqual(Array.from(await sql`select id,fuente from puertos`),[{id:app.id,fuente:'app'}]);
},true));
await test('Resolución SQL inexistente aborta toda la transacción con diagnóstico',()=>fixture(async({sql,p,generar,snapshot})=>{
  const generado=generar();assert.equal(generado.estado,0,generado.salida);
  const bloque=generado.sql.match(/-- BEGIN SINCRONIZACION PUERTOS[\s\S]*?-- END SINCRONIZACION PUERTOS/)?.[0];assert.ok(bloque);
  assert.ok(bloque.includes("'CODEC EQ'"));
  const inexistente=bloque.replaceAll("'CODEC EQ'","'MODELO QA NO RESUELTO'");
  const antes=await snapshot();await assert.rejects(sql.begin(async tx=>{
    await tx`update articulos set descripcion='Marcador que debe revertirse' where id=${p.articulo_id}`;
    await tx.unsafe(inexistente);
  }),e=>e.code==='23514'&&e.message.includes('artículo inexistente o ambiguo')&&e.detail.includes('MODELO QA NO RESUELTO'));
  assert.deepEqual(await snapshot(),antes);
}));
await test('Alta concurrente que obtiene primero el puerto impide reducción incompatible',()=>fixture(async({sql,p,referencias,generar,editarCsv,nombre})=>{
  const {c,e}=await referencias();
  const otra=postgres({...configuracion,database:nombre});
  const seed=postgres({...configuracion,database:nombre});
  let liberar;const continuar=new Promise(r=>{liberar=r;});let preparada;const listo=new Promise(r=>{preparada=r;});
  const alta=otra.begin(async tx=>{
    await tx`select id from puertos where id=${p.id} for update`;
    await tx`update conexiones set detalle_extremos='completo' where id=${c.id}`;
    await tx`insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values (${c.id},'origen',${e[0].id},${p.id},3),(${c.id},'destino',${e[1].id},${p.id},1)`;
    preparada();await continuar;
  });
  try {
    await listo;const pid=(await seed`select pg_backend_pid() as pid`)[0].pid;
    const r=generar(editarCsv(r=>({...r,total:'2'})));assert.equal(r.estado,0,r.salida);
    const trabajo=seed.unsafe(r.sql).then(()=>null,e=>e);
    const limite=Date.now()+5000;let bloqueada=false;
    while(Date.now()<limite){bloqueada=(await sql`select wait_event_type from pg_stat_activity where pid=${pid}`)[0]?.wait_event_type==='Lock';if(bloqueada)break;await new Promise(r=>setTimeout(r,20));}
    assert.ok(bloqueada,'El seed espera un lock real, no un sleep supuesto');
    liberar();await alta;const error=await trabajo;assert.equal(error?.code,'23514');assert.match(error?.message,/CSV de puertos incompatible/);assert.ok(error.detail.includes(c.id));
    await seed`rollback`;assert.equal((await sql`select total from puertos where id=${p.id}`)[0].total,3);
  } finally {liberar();await alta;await otra.end();await seed`rollback`;await seed.end();}
},true));

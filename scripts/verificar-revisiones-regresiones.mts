import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID,createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type postgres from 'postgres';
import type { SqlDiseno } from '../src/lib/revisiones-diseno-repositorio';
import { conectarRevisiones,fotografiarRevisiones,FIXTURE_REVISIONES as f,SALIDA_REVISIONES } from './revisiones-fixture.mjs';
const url=process.env.REVISIONES_DATABASE_URL;if(!url)throw new Error('REVISIONES_DATABASE_URL explícita obligatoria.');
const sql=await conectarRevisiones(url);process.env.DATABASE_URL=url;
type Loader={_load:(request:string,...resto:unknown[])=>unknown};const m=Module as unknown as Loader;const original=m._load;m._load=(request,...resto)=>request==='server-only'?{}:original.call(Module,request,...resto);
const r=await import('../src/lib/revisiones-diseno-repositorio');
const carpeta=resolve(SALIDA_REVISIONES,`regresiones-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(carpeta,{recursive:true});const checks:string[]=[];const ok=(s:string)=>{checks.push(s);console.log(`OK ${s}`);};
const foto=async(etiqueta:string)=>{const d=await fotografiarRevisiones(sql);await writeFile(resolve(carpeta,`bd-${etiqueta}.json`),JSON.stringify(d,null,2));return d;};
try {
  const antes=await foto('antes');
  const cancelacion=new Error('Terminar transacción sintética sin conservar fixtures adicionales.');
  await assert.rejects(sql.begin('isolation level serializable',async tx=>{
    // Todo caso adicional es invisible fuera de esta transacción y acaba en rollback.
    const c=new Proxy(tx,{get(destino,propiedad){if(propiedad==='begin')return(...args:unknown[])=>destino.savepoint(args.at(-1) as (tx:postgres.TransactionSql<Record<string,unknown>>)=>Promise<unknown>);return Reflect.get(destino,propiedad);}}) as unknown as SqlDiseno;
    const sala=randomUUID(),equipoA=randomUUID(),equipoB=randomUUID(),material=randomUUID();
    await tx`insert into salas(id,nombre,largo_m,ancho_m,alto_m,diagrama_iniciado_en) values(${sala},'PRUEBA-REV-01 · REGRESIONES TRANSITORIAS',8,6,3,now())`;
    await tx`insert into sala_equipos(id,sala_id,articulo_id,nombre,x_m,y_m,z_m,posicion_confirmada) values(${equipoA},${sala},${f.codec},'Origen ausente',0,0,0,false),(${equipoB},${sala},${f.pantalla},'Destino confirmado',4,2,1,true)`;
    await tx`insert into sala_material_bom(id,sala_id,articulo_id,cantidad,unidad,nota) values(${material},${sala},${f.microfono},2,'ud','BOM libre sintética')`;
    const base=await r.leerDiseno(c,sala);const rev=await r.crearRevisionDiseno(c,sala,'BOM anterior',f.admin,base.base);
    await tx`update sala_equipos set nombre='ABA presentación' where id=${equipoA}`;await tx`update sala_equipos set nombre='Origen ausente' where id=${equipoA}`;
    const referenciaAba=await r.referenciaRevisionDiseno(sala,c);assert.equal(referenciaAba.hash,rev.hash);assert.equal(referenciaAba.estado,'borrador');assert.equal(referenciaAba.antecedente?.id,rev.id);ok('Entregable no atribuye edición ABA posterior a autor y fecha de una revisión anterior');
    await tx`update sala_material_bom set cantidad=3 where id=${material}`;
    const reserva=randomUUID();await tx`insert into reservas(id,sala_id,articulo_id,cantidad) values(${reserva},${sala},${f.microfono},1)`;
    const comprometido=await r.leerDiseno(c,sala);await assert.rejects(r.restaurarRevisionDiseno(c,sala,rev.id,f.admin,comprometido.base),/reservas.*pedidos/i);assert.deepEqual((await r.leerDiseno(c,sala)).base,comprometido.base);ok('Restauración BOM comprometida se rechaza íntegra; reserva y necesidad intactas');
    await tx`delete from reservas where id=${reserva}`;
    const lote=randomUUID();const bytes=Buffer.from('PRUEBA BOM ATRIBUIDA');const sha=createHash('sha256').update(bytes).digest('hex');
    await tx`insert into importacion_lotes(id,destino,sala_id,usuario_id,origen,archivo_nombre,archivo_sha256,archivo,filas,informe) values(${lote},'bom',${sala},${f.admin},'Sintético E3','bom.csv',${sha},${bytes},'[]'::jsonb,'[]'::jsonb)`;
    await tx`update sala_material_bom set lote_id=${lote} where id=${material}`;
    const atribuido=await r.leerDiseno(c,sala);const revisionAtribuida=await r.crearRevisionDiseno(c,sala,'BOM atribuida',f.admin,atribuido.base);
    await tx`update sala_material_bom set cantidad=4 where id=${material}`;
    const posterior=await r.leerDiseno(c,sala);await assert.rejects(r.restaurarRevisionDiseno(c,sala,revisionAtribuida.id,f.admin,posterior.base),/importación/);assert.deepEqual((await r.leerDiseno(c,sala)).base,posterior.base);ok('BOM importada conserva atribución y edición posterior; rollback de restauración');
    const n1=randomUUID(),n2=randomUUID();
    const [c1]=await tx`insert into conexiones(id,sala_id,origen_id,destino_id,senal) values(${n1},${sala},${equipoA},${equipoB},'hdmi') returning identificador_cable`;
    await tx`delete from conexiones where id=${n1}`;
    const [c2]=await tx`insert into conexiones(id,sala_id,origen_id,destino_id,senal) values(${n2},${sala},${equipoA},${equipoB},'hdmi') returning identificador_cable`;
    assert.equal(c1.identificador_cable,'HD-1000');assert.equal(c2.identificador_cable,'HD-1001');await assert.rejects(tx.savepoint(s=>s`update conexiones set identificador_cable='HD-9999' where id=${n2}`),/inmutable/);ok('Código persistido no se reutiliza tras borrar y su modificación se rechaza');
    const [articulo]=await tx`select marca,modelo from articulos where id=${f.codec}`;
    await tx`insert into articulos_tecnicos(articulo_id,marca,modelo,ancho,unidad,origen,url,fecha,verificado_por) values(${f.codec},${articulo.marca},${articulo.modelo},100,'mm','PRUEBA posterior','https://example.test/fixture','2026-10-14',${f.admin}) on conflict(articulo_id) do update set ancho=100,unidad='mm'`;
    const conTecnica=await r.leerDiseno(c,sala);assert.equal(conTecnica.snapshot.datos.equipos.find(e=>e.id===equipoA)?.dimensiones_tecnicas,null);
    const copia=await r.duplicarSalaDiseno(c,sala,'PRUEBA-REV-01 · Ausencia heredada',null,f.admin,conTecnica.base);
    const [ausencia]=await tx`select dimensiones_tecnicas='null'::jsonb explicita,posicion_confirmada,x_m,y_m,z_m from sala_equipos where sala_id=${copia.salaId} and nombre='Origen ausente'`;
    assert.equal(ausencia.explicita,true);assert.equal(ausencia.posicion_confirmada,false);assert.equal(Number(ausencia.x_m),0);const copiada=await r.leerDiseno(c,copia.salaId);assert.ok(copiada.snapshot.datos.material.every(m=>m.lote_id===null));ok('Copia conserva ausencia técnica JSONnull tras catálogo posterior y BOM sin lote');
    const invalidos=await tx`select count(*)::int n from revisiones_diseno where sala_id=${sala}`;assert.ok(invalidos[0].n>=3);
    throw cancelacion;
  }),error=>error===cancelacion);
  assert.equal((await foto('despues-regresiones')).sha256,antes.sha256);ok('Fixtures transitorias regresión revierten todas las tablas públicas exactamente');
  // Rollback estructural vacío en esquema exclusivo; nunca retira tablas públicas.
  const reserva=await sql.reserve();const esquema=`e3_rollback_prueba_${Date.now()}`;
  try {
    await reserva.unsafe(`create schema ${esquema}`);await reserva.unsafe(`set search_path to ${esquema}, public`);
    for(const tabla of ['usuarios','salas','conexiones','sala_equipos','sala_mobiliario','puertas','tomas_red','conexion_bocas','conexion_puntos_paso','sala_material_bom'])await reserva.unsafe(`create table ${tabla}(like public.${tabla} including defaults)`);
    await reserva.unsafe('alter table salas add primary key(id); alter table usuarios add primary key(id); alter table conexiones add primary key(id)');
    await reserva.unsafe('alter table salas drop column origen_revision_id,drop column origen_sala_id,drop column medidas_heredadas,drop column mapa_ids_origen,drop column diseno_version; alter table conexiones drop column identificador_cable');
    await reserva.unsafe(await readFile('db/migraciones/2026-10-e3-revisiones.sql','utf8'));
    await reserva.unsafe(await readFile('db/migraciones/2026-10-e3-anotaciones.sql','utf8'));
    await reserva.unsafe(await readFile('db/migraciones/rollback/2026-10-e3.sql','utf8'));
    const [estructuras]=await reserva`select to_regclass(${`${esquema}.revisiones_diseno`}) historial,to_regclass(${`${esquema}.anotaciones_sala`}) notas,
      exists(select 1 from information_schema.columns where table_schema=${esquema} and table_name='salas' and column_name='diseno_version') version`;
    assert.equal(estructuras.historial,null);assert.equal(estructuras.notas,null);assert.equal(estructuras.version,false);ok('Migración y rollback vacío completos en esquema aislado; no queda trigger roto');
  }finally{await reserva.unsafe('rollback');await reserva.unsafe('set search_path to public');await reserva.unsafe(`drop schema if exists ${esquema} cascade`);reserva.release();}
  assert.equal((await foto('despues-rollback-estructural')).sha256,antes.sha256);ok('Rollback en esquema aislado mantiene hash íntegro de todas las tablas públicas');
  await writeFile(resolve(carpeta,'resultados.json'),JSON.stringify({checks},null,2));console.log(`Resultado ${checks.length} gates: ${carpeta}`);
}finally{m._load=original;await sql.end();}

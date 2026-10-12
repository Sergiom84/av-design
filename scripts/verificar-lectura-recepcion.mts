import assert from 'node:assert/strict';
import Module from 'node:module';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import postgres,{type Sql,type TransactionSql} from 'postgres';
import {instanciarSuministro} from '../src/lib/suministros-db';
import {atribuirRegistroExistente} from '../src/lib/atribuciones-suministro-db';
import {recibirCompra} from '../src/lib/operaciones-compras';

const punto=process.argv[2]??'cabecera';
assert.ok(['cabecera','lineas'].includes(punto));
const mutante=process.argv[3]==='--read-committed';
assert.ok(process.argv.length<4||mutante);
const nombre='qa_lectura_recepcion_'+randomUUID().replaceAll('-','');
const base='postgres://av_design:av_design_local@127.0.0.1:5433/';
const admin=postgres(base+'postgres',{max:1,onnotice(){}});
let sql:Sql|undefined,otra:Sql|undefined,creada=false,liberar=()=>{},lectura:Promise<unknown>|undefined;
const modulo=Module as unknown as {_load:(request:string,...resto:unknown[])=>unknown};
const cargar=modulo._load;
try {
 await admin.unsafe(`create database "${nombre}"`);creada=true;console.log('BASE_PROPIA',nombre);
 sql=postgres(base+nombre,{max:1,onnotice(){}});otra=postgres(base+nombre,{max:1,onnotice(){}});
 await sql.unsafe(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const [s]=await sql`insert into salas(nombre) values('Sala lectura recepción') returning id`;
 const [art]=await sql`insert into articulos(tipo,categoria,modelo) values('equipo','QA','Kit lector') returning id`;
 const [c]=await sql`insert into articulo_composiciones(articulo_kit_id,sku,version,estado_documental,fuente) values(${art.id},'QA',1,'parcial','QA') returning id`;
 await sql`insert into articulo_composicion_lineas(composicion_id,clave,identidad,rol,cantidad,inclusion,fuente) values(${c.id},'pendiente','Pendiente','equipo',1,'por_determinar','QA')`;
 await sql`update articulo_composiciones set publicada=true where id=${c.id}`;
 const [p]=await sql`insert into pedidos(sala_id,estado) values(${s.id},'pedido') returning id`;
 const [l]=await sql`insert into pedido_lineas(pedido_id,articulo_id,cantidad,comprado_en,comprado_por) values(${p.id},${art.id},2,current_date,'QA') returning id`;
 const [u]=await sql`insert into ubicaciones(nombre) values('QA') returning id`;
 const [usuario]=await sql`insert into usuarios(usuario,nombre,rol,clave_hash) values('qa.lector','Receptor QA','admin','ensayo sin login') returning id`;
 const a=await instanciarSuministro(sql,s.id,c.id),b=await instanciarSuministro(sql,s.id,c.id);
 await atribuirRegistroExistente(sql,{tipo:'pedido',registroId:l.id,atribuciones:[a,b].map(suministroId=>({suministroId,cantidad:1,recibido:0}))});
 let avisar=()=>{},interceptada=false;
 const pausada=new Promise<void>(r=>avisar=r),continuar=new Promise<void>(r=>liberar=r);
 const patron=punto==='cabecera'?'from pedidos p':'from pedido_lineas l';
 const envolver=(cliente:Sql|TransactionSql):Sql|TransactionSql=>new Proxy(cliente,{
  get(target,propiedad){
   if(propiedad==='begin')return (opciones:string,cuerpo:(tx:TransactionSql)=>Promise<unknown>)=>{
    const begin=Reflect.get(target,'begin') as (opciones:string,cuerpo:(tx:TransactionSql)=>Promise<unknown>)=>Promise<unknown>;
    return begin.call(target,mutante?opciones.replace('repeatable read','read committed'):opciones,tx=>cuerpo(envolver(tx) as TransactionSql));
   };
   return Reflect.get(target,propiedad);
  },
  apply(target,self,args){
   const partes=args[0],texto=Array.isArray(partes)&&'raw'in partes?partes.join(''):'';
   if(!interceptada&&texto.includes(patron)){interceptada=true;return(async()=>{const filas=await Reflect.apply(target,self,args);avisar();await continuar;return filas;})();}
   return Reflect.apply(target,self,args);
  },
 });
 process.env.DATABASE_URL=base+nombre;
 (globalThis as typeof globalThis&{__sql?:Sql}).__sql=envolver(sql) as Sql;
 modulo._load=(request,...resto)=>request==='server-only'?{}:cargar.call(Module,request,...resto);
 const {obtenerPedido}=await import('../src/lib/datos-almacen');
 const promesa=obtenerPedido(p.id);lectura=promesa;promesa.catch(()=>{});
 await Promise.race([pausada,promesa.then(()=>{throw new Error('Lector no alcanzó la pausa');})]);
 await recibirCompra(otra,{pedidoId:p.id,lineaId:l.id,cantidad:1,ubicacionId:u.id,autor:{id:usuario.id,nombre:'Receptor QA',ficticio:false},recepcionId:randomUUID()});
 assert.equal(Number((await otra`select cantidad_recibida from pedido_lineas where id=${l.id}`)[0].cantidad_recibida),1);
 liberar();const antes=await promesa,despues=await obtenerPedido(p.id);assert.ok(antes&&despues);
 // Proyección real de la ficha, no consultas sustitutas del lector.
 const resumen=(d:typeof antes)=>({estado:d.pedido.estado,recibido:d.lineas[0].cantidad_recibida,reparto:d.recepcion.filas.map(f=>f.recibido),sobrante:d.recepcion.sinAtribuir});
 console.log(JSON.stringify({punto,mutante,antes:resumen(antes),despues:resumen(despues)}));
 assert.deepEqual(resumen(antes),{estado:'pedido',recibido:0,reparto:[0,0],sobrante:[]});
 assert.deepEqual(resumen(despues),{estado:'recibido_parcial',recibido:1,reparto:[1,0],sobrante:[]});
} finally {
 liberar();if(lectura)await lectura.catch(()=>{});modulo._load=cargar;
 delete(globalThis as typeof globalThis&{__sql?:Sql}).__sql;
 if(otra)await otra.end();if(sql)await sql.end();
 if(creada){await admin.unsafe(`drop database "${nombre}" with(force)`);console.log('ELIMINADA',nombre);}await admin.end();
}

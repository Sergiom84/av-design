import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RepositorioTiempos } from '../src/lib/tiempos/repositorio';
import type { ConexionTiempos } from '../src/lib/tiempos/autorizacion';
import { ErrorTiempo } from '../src/lib/tiempos/modelo';
import { conectarRevisiones, URL_REA_PRUEBA, idTR, SALIDA_TIEMPOS, fixtureTiempos, fotoTiempos } from './rea05-tiempos-fixture.mjs';

if(process.env.REA_DATABASE_URL!==URL_REA_PRUEBA) throw new Error('Destino REA05 explícito obligatorio.');
const c=await conectarRevisiones(process.env.REA_DATABASE_URL);
const salida: { nombre: string; resultado: string }[]=[];
const consultas: string[]=[];
function espiar(conexion: ConexionTiempos): ConexionTiempos {
  return new Proxy(conexion,{apply(target,that,args){consultas.push(Array.isArray(args[0])?args[0].join('$'):String(args[0]));return Reflect.apply(target,that,args);},get(target,p){if(p==='begin')return (...args: unknown[])=>{const fn=args.pop() as (tx:ConexionTiempos)=>unknown;return (target.begin as (...v:unknown[])=>unknown)(...args,(tx:ConexionTiempos)=>fn(espiar(tx)));};return Reflect.get(target,p);}});
}
const repo=new RepositorioTiempos(espiar(c)), admin=idTR(1), trabajador=idTR(2), gestor=idTR(3), tarea=idTR(311);
async function caso(nombre:string,f:()=>Promise<void>){await f();salida.push({nombre,resultado:'aprobado'});console.log('OK '+nombre);}
async function rechaza(f:()=>Promise<unknown>,codigo:string){await assert.rejects(f,e=>e instanceof ErrorTiempo && e.codigo===codigo);}
try{
  await fixtureTiempos(c);
  const antes=await fotoTiempos(c,'antes-sql');
  const [{n}]=await c`select count(*)::int n from tiempo_registros where tecnico_id=${idTR(102)}`;
  const dia=new Date(Date.UTC(2022,0,1+Number(n)*7)).toISOString().slice(0,10);
  const intervalo=(inicio='09:00',fin='10:00')=>({inicio:{fecha:dia,hora:inicio},fin:{fecha:dia,hora:fin}});
  const alta=(inicio='09:00',fin='10:00',tareaId=tarea)=>({tareaId,...intervalo(inicio,fin),notas:'Parte de prueba con datos propios',clavePeticion:randomUUID()});
  let creado: Awaited<ReturnType<RepositorioTiempos['crear']>>, corregido: Awaited<ReturnType<RepositorioTiempos['crear']>>;
  await caso('vínculo único, ausente, ambiguo y lectura sin escritura',async()=>{
    assert.equal((await repo.identidad(trabajador)).puedeRegistrar,true);
    for(const u of [idTR(5),idTR(6),idTR(7)]){assert.equal((await repo.identidad(u)).aviso,'VINCULO_TECNICO_NO_RESUELTO');await rechaza(()=>repo.crear(u,alta()),'VINCULO_TECNICO_NO_RESUELTO');}
    await rechaza(()=>repo.crear(idTR(4),alta()),'PERMISO_DENEGADO');
    await rechaza(()=>repo.crear(idTR(8),alta()),'PERMISO_DENEGADO');await rechaza(()=>repo.crear(idTR(9),alta()),'SESION_REQUERIDA');
    assert(!JSON.stringify(await repo.identidad(idTR(6))).includes(idTR(7)));
  });
  await caso('registro propio real, titular técnico y autor separados',async()=>{
    const b=alta();creado=await repo.crear(trabajador,b);assert.equal(creado.minutos,60);
    const repetido=await repo.crear(trabajador,b);assert.equal(repetido.actualId,creado.actualId);assert.equal(repetido.repetida,true);
    await rechaza(()=>repo.crear(trabajador,{...b,notas:'distinto'}),'IDEMPOTENCIA_CONFLICTO');
    const [r]=await c`select titular_usuario_id,tecnico_id from tiempo_registros where id=${creado.id}`;
    assert.equal(r.titular_usuario_id,trabajador);assert.equal(r.tecnico_id,idTR(102));
    const [v]=await c`select autor_usuario_id from tiempo_versiones where id=${creado.actualId}`;assert.equal(v.autor_usuario_id,trabajador);
  });
  await caso('vacíos, segundos, futuro, duración y payload ajeno no escriben',async()=>{
    const [{n:prev}]=await c`select count(*)::int n from tiempo_versiones`;
    for(const b of [{...alta(),inicio:{fecha:'',hora:''}},alta('10:00','09:00'),{...alta(),fin:{fecha:'2099-01-01',hora:'10:00'}},{...alta(),inicio:{fecha:dia,hora:'09:00:01'}},{...alta(),fin:{fecha:'2026-10-15',hora:'10:00'}},{...alta(),titularUsuarioId:idTR(7)}])await assert.rejects(()=>repo.crear(trabajador,b));
    const [{n:despues}]=await c`select count(*)::int n from tiempo_versiones`;assert.equal(despues,prev);
  });
  await caso('solapamiento transversal bloqueado, contigüidad y otro técnico admitidos',async()=>{
    await rechaza(()=>repo.crear(trabajador,alta('09:30','10:30',idTR(321))),'SOLAPAMIENTO_REAL');
    await repo.crear(trabajador,alta('10:00','11:00',idTR(321)));
    await repo.crear(gestor,{...alta(),tecnicoId:idTR(103),motivo:'Trabajo paralelo de otro técnico'},idTR(201));
  });
  await caso('CAS corrección y una rama, reintento previo al CAS, anulación y restauración',async()=>{
    const correccion={numeroActual:creado.numeroActual,actualId:creado.actualId,clavePeticion:randomUUID(),...intervalo('08:30','09:30'),notas:'Corregido',motivo:'Hora real corregida'};
    corregido=await repo.corregir(trabajador,creado.id,correccion);assert.equal(corregido.numeroActual,2);
    assert.equal((await repo.corregir(trabajador,creado.id,correccion)).actualId,corregido.actualId);
    await rechaza(()=>repo.corregir(trabajador,creado.id,{...correccion,clavePeticion:randomUUID()}),'VERSION_CONFLICTO');
    const anulado=await repo.anular(trabajador,creado.id,{numeroActual:corregido.numeroActual,actualId:corregido.actualId,clavePeticion:randomUUID(),motivo:'Anular para verificar historia'});
    const restaurado=await repo.restaurar(trabajador,creado.id,{numeroActual:anulado.numeroActual,actualId:anulado.actualId,versionId:creado.actualId,clavePeticion:randomUUID(),motivo:'Restaurar intervalo revisado'});
    assert.equal(restaurado.numeroActual,4);const h=await repo.historial(trabajador,creado.id);assert.equal(h.versiones.length,4);assert.equal(h.versiones.at(-1)?.id,creado.actualId);
  });
  await caso('titular congelado y revocación actual en historial, mutaciones e idempotencia',async()=>{
    await c`update usuarios set tecnico_id=${idTR(105)} where id=${trabajador}`;
    await c`update usuarios set tecnico_id=${idTR(102)} where id=${idTR(5)}`;
    try{assert.equal((await repo.historial(trabajador,creado.id)).versiones.length,4);await rechaza(()=>repo.historial(idTR(5),creado.id),'NO_ENCONTRADO');const actualId=(await repo.registro(trabajador,creado.id)).actualId; await rechaza(()=>repo.anular(trabajador,creado.id,{numeroActual:4,actualId,clavePeticion:randomUUID(),motivo:'Ya no enlazado'}),'VINCULO_TECNICO_NO_RESUELTO');}
    finally{await c`update usuarios set tecnico_id=${idTR(102)} where id=${trabajador}`;await c`update usuarios set tecnico_id=null where id=${idTR(5)}`;}
    await c`update usuario_permisos set acceso='oculto' where usuario_id=${trabajador} and seccion='salas'`;
    try{await rechaza(()=>repo.historial(trabajador,creado.id),'NO_ENCONTRADO');const lista=await repo.listar(trabajador,{desde:dia,hasta:dia,pagina:1});assert(!lista.partes.some(p=>p.id===creado.id));}
    finally{await c`update usuario_permisos set acceso='ver' where usuario_id=${trabajador} and seccion='salas'`;}
  });
  await caso('gestor histórico: tarea y plan cerrados, motivo, inactivo sin alta pero corrección',async()=>{
    const [prev]=await c`select estado from plan_tareas where id=${idTR(331)}`;
    const [plan]=await c`select archivado_en from planes where id=${idTR(233)}`;
    await c`update plan_tareas set estado='anulada' where id=${idTR(331)}`;await c`update planes set archivado_en=now() where id=${idTR(233)}`;
    try{
      await rechaza(()=>repo.crear(trabajador,alta('12:00','13:00',idTR(331))),'CONTEXTO_CERRADO');
      const b={...alta('12:00','13:00',idTR(331)),tecnicoId:idTR(102),motivo:'Hecho atrasado sobre plan archivado'};
      const r=await repo.crear(gestor,b,idTR(203));
      await c`update tecnicos set activo=false where id=${idTR(102)}`;
      try{await rechaza(()=>repo.crear(gestor,{...b,clavePeticion:randomUUID()},idTR(203)),'TECNICO_INACTIVO');await repo.anular(gestor,r.id,{actualId:r.actualId,numeroActual:r.numeroActual,clavePeticion:randomUUID(),motivo:'Corrección histórica con técnico inactivo'},true);}
      finally{await c`update tecnicos set activo=true where id=${idTR(102)}`;}
    }finally{await c`update plan_tareas set estado=${prev.estado} where id=${idTR(331)}`;await c`update planes set archivado_en=${plan.archivado_en} where id=${idTR(233)}`;}
  });
  await caso('dos conexiones serializan mismo técnico entre obras después de esperar',async()=>{
    const reserva=await c.reserve();await reserva`begin`;await reserva`select id from tecnicos where id=${idTR(102)} for update`;
    const a=repo.crear(trabajador,alta('14:00','15:00',tarea));const b=repo.crear(trabajador,alta('14:30','15:30',idTR(321)));
    await new Promise(r=>setTimeout(r,100));await reserva`commit`;reserva.release();
    const r=await Promise.allSettled([a,b]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert(r.some(x=>x.status==='rejected'&&x.reason instanceof ErrorTiempo&&x.reason.codigo==='SOLAPAMIENTO_REAL'));
  });
  await caso('versiones y operaciones inmutables incluso SQL directo',async()=>{
    await assert.rejects(()=>c`update tiempo_versiones set notas='pisado' where id=${creado.actualId}`);
    await assert.rejects(()=>c`delete from tiempo_registros where id=${creado.id}`);
  });
  await caso('resumen completo separado por medianoches Madrid',async()=>{
    const siguiente=new Date(Date.parse(dia)+86400000).toISOString().slice(0,10);
    await repo.crear(trabajador,{tareaId:tarea,inicio:{fecha:dia,hora:'23:30'},fin:{fecha:siguiente,hora:'00:30'},notas:'Cruza medianoche',clavePeticion:randomUUID()});
    const lista=await repo.listar(trabajador,{desde:dia,hasta:siguiente,pagina:1});assert.equal(lista.dias.find(d=>d.fecha===siguiente)?.minutos,30);assert(lista.minutos>=240);
  });
  await caso('51 partes: páginas de50 y1, sin perder minutos del resumen',async()=>{
    const [{n}]=await c`select count(*)::int n from tiempo_registros where tecnico_id=${idTR(101)}`;
    const fecha=new Date(Date.UTC(2021,0,1+Number(n))).toISOString().slice(0,10);
    for(let i=0;i<51;i++){
      const hora=(m:number)=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
      await repo.crear(admin,{tareaId:idTR(313),inicio:{fecha,hora:hora(13*60+i*2)},fin:{fecha,hora:hora(13*60+i*2+1)},clavePeticion:randomUUID()});
    }
    const p1=await repo.listar(admin,{desde:fecha,hasta:fecha,pagina:1}),p2=await repo.listar(admin,{desde:fecha,hasta:fecha,pagina:2});
    assert.equal(p1.partes.length,50);assert.equal(p2.partes.length,1);assert(p1.hayMas);assert(!p2.hayMas);assert.equal(p1.minutos,51);assert.equal(p2.minutos,51);assert(!p1.partes.some(p=>p.id===p2.partes[0].id));
  });
  await caso('dos correcciones reales de la misma cabecera sólo crean una rama',async()=>{
    const p=await repo.registro(trabajador,creado.id),cas={numeroActual:p.numeroActual,actualId:p.actualId,motivo:'Edición concurrente',notas:'Una sola rama'};
    const rs=await Promise.allSettled([repo.corregir(trabajador,p.id,{...cas,...intervalo('07:30','08:30'),clavePeticion:randomUUID()}),repo.corregir(trabajador,p.id,{...cas,...intervalo('08:00','09:00'),clavePeticion:randomUUID()})]);
    assert.equal(rs.filter(r=>r.status==='fulfilled').length,1);assert(rs.some(r=>r.status==='rejected'&&r.reason instanceof ErrorTiempo&&r.reason.codigo==='VERSION_CONFLICTO'));
    assert.equal((await repo.historial(trabajador,p.id)).versiones.length,5);
  });
  await caso('reclasificación relacionada en ambos sentidos y con ACL actual',async()=>{
    const p=await repo.registro(trabajador,creado.id);
    await repo.anular(trabajador,p.id,{numeroActual:p.numeroActual,actualId:p.actualId,motivo:'Error de tarea, corregir con identidad inmutable',clavePeticion:randomUUID()});
    const r=await repo.crear(trabajador,{...alta('16:00','17:00',idTR(312)),relacionadoId:p.id,motivo:'Nueva tarea correcta relacionada'});
    assert.equal((await repo.registro(trabajador,p.id)).tareaId,tarea);
    assert.equal((await repo.relacionados(trabajador,p.id)).partes[0].id,r.id);
    assert.equal((await repo.relacionados(trabajador,r.id)).partes[0].id,p.id);
    await rechaza(()=>repo.relacionados(idTR(4),p.id),'NO_ENCONTRADO');
  });
  await caso('cero consultas financieras desde cada camino de tiempos',async()=>{
    assert.equal(consultas.filter(q=>/\b(coste_|tarifa|precio_hora|clave_hash)\w*/i.test(q)).length,0);
  });
  const despues=await fotoTiempos(c,'despues-sql');
  // QA cambia identidades y estados deliberadamente para probar revocaciones; el
  // dominio físico y E3/04 deben permanecer byte a byte iguales salvo timestamps
  // de las dos tareas/planes QA modificados para ejercitar contexto cerrado.
  const qaEstados=new Set(['usuarios','usuario_permisos','tecnicos','planes','plan_tareas']);
  const tiempos=new Set(['tiempo_registros','tiempo_versiones','tiempo_operaciones']);
  const diferencias=antes.tablas.filter(t=>!tiempos.has(t.tabla)&&!qaEstados.has(t.tabla)&&JSON.stringify(t)!==JSON.stringify(despues.tablas.find(d=>d.tabla===t.tabla)));
  assert.deepEqual(diferencias,[]);
  await writeFile(resolve(SALIDA_TIEMPOS,'sql-resultados.json'),JSON.stringify({fecha:new Date().toISOString(),casos:salida,consultas:consultas.length,financieras:0,preservacion:{tablasFisicasSinCambios:true,excepcionesQA:[...qaEstados]},shaConsultas:createHash('sha256').update(consultas.join('\n')).digest('hex')},null,2));
  await writeFile(resolve(SALIDA_TIEMPOS,'consultas-operativas.log'),consultas.join('\n'));
}finally{await c.end();}

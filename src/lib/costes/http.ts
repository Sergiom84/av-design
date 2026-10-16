import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql, hayConfiguracion } from '../db';
import { sesionActual } from '../sesion-servidor';
import { mismoOrigen } from '../catalogo-tecnico';
import { ErrorImporte } from '../importes';
import { ErrorIntervaloReal } from '../tiempos/fechas';
import { RepositorioCostes } from './repositorio';
import { corteSchema, entrada, uuid, LIMITES_COSTES, ErrorCoste } from './modelo';
export function errorSeguroCostes(e:unknown):ErrorCoste {
  if(e instanceof ErrorCoste)return e;
  if(e instanceof z.ZodError||e instanceof ErrorImporte)return new ErrorCoste('ENTRADA_INVALIDA','Comprueba los campos y decimales de costes.');
  if(e instanceof ErrorIntervaloReal)return new ErrorCoste(e.codigo,e.message,e.status);
  if(['23505','40001','40P01'].includes((e as {code?:string})?.code??''))return new ErrorCoste('CONFLICTO_CONCURRENCIA','Otra operación cambió estos registros. Revisa de nuevo.',409);
  return new ErrorCoste('SERVICIO_NO_DISPONIBLE','No se pudo completar la operación de costes. Reintenta conservando tu edición.',503);
}
const responder=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function cuerpo(req:Request) {
  if(!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')??''))throw new ErrorCoste('ENTRADA_INVALIDA','La petición debe ser JSON.');
  if(Number(req.headers.get('content-length'))>LIMITES_COSTES.cuerpo)throw new ErrorCoste('LIMITE_EXCEDIDO','Máximo 64 KiB por petición.',413);
  const lector=req.body?.getReader();if(!lector)throw new ErrorCoste('ENTRADA_INVALIDA','Falta el cuerpo JSON.');
  let total=0;const partes:Uint8Array[]=[];
  try {while(true){const r=await lector.read();if(r.done)break;total+=r.value.byteLength;if(total>LIMITES_COSTES.cuerpo){await lector.cancel();throw new ErrorCoste('LIMITE_EXCEDIDO','Máximo 64 KiB por petición.',413);}partes.push(r.value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(partes)));}
  catch(e){if(e instanceof ErrorCoste)throw e;throw new ErrorCoste('ENTRADA_INVALIDA','El cuerpo JSON no es válido.');}finally{lector.releaseLock();}
}
export async function atenderCostes(req:Request,ruta:string,params:Record<string,string>={}) {
  const solicitudId=randomUUID();
  try {
    if(!hayConfiguracion())throw new ErrorCoste('SERVICIO_NO_DISPONIBLE','La base de datos no está configurada.',503);
    const sesion=await sesionActual();if(!sesion)throw new ErrorCoste('SESION_REQUERIDA','Inicia sesión.',401);
    if(sesion.ficticio||sesion.debeCambiarClave)throw new ErrorCoste('PERMISO_DENEGADO','Usa una identidad real con contraseña definitiva.',403);
    if(req.method!=='GET'&&!mismoOrigen(req))throw new ErrorCoste('ORIGEN_DENEGADO','La petición debe proceder de esta aplicación.',403);
    for(const v of Object.values(params))entrada(uuid,v);
    const repo=new RepositorioCostes(sql),u=sesion.id;await repo.identidad(u);
    const url=new URL(req.url),q=url.searchParams.get('q')??'',p=Number(url.searchParams.get('pagina')??1);
    if(!Number.isInteger(p)||p<1||p>100000||q.length>120)throw new ErrorCoste('ENTRADA_INVALIDA','Consulta inválida.');
    const proyecto=params.proyectoId??url.searchParams.get('proyectoId')??'',id=params.id??params.serieId;
    const desde=url.searchParams.get('desde')??'',hasta=url.searchParams.get('hasta')??'';
    const env=(datos:unknown,status=200)=>responder({solicitudId,...(datos&&typeof datos==='object'&&!Array.isArray(datos)?datos:{resultado:datos})},status);
    if(ruta==='tecnicos'&&req.method==='GET')return env(await repo.tecnicos(u,q));
    if(ruta==='tarifas'&&req.method==='GET'){const t=url.searchParams.get('tecnicoId')??undefined;if(t)entrada(uuid,t);return env(await repo.listarTarifas(u,t,p));}
    if(ruta==='tarifas'&&req.method==='POST')return env(await repo.guardarTarifa(u,await cuerpo(req)),201);
    if(ruta==='tarifa'&&req.method==='GET')return env(await repo.historialTarifa(u,id,p));
    if(ruta==='tarifa'&&req.method==='POST'){const b=await cuerpo(req);if(!b||typeof b!=='object')throw new ErrorCoste('ENTRADA_INVALIDA','Faltan campos.');return env(await repo.guardarTarifa(u,{...b,serieId:id}),201);}
    if(ruta==='tarifa-preparar'&&req.method==='POST')return env(await repo.prepararTarifa(u,await cuerpo(req)));
    if(ruta==='laboral-historial'&&req.method==='GET')return env(await repo.historialLaboral(u,id,p));
    if(ruta==='laboral-anular'&&req.method==='POST')return env(await repo.anularLaboral(u,id,await cuerpo(req)),201);
    if(ruta==='laboral-preparar'&&req.method==='POST')return env(await repo.prepararLaboral(u,await cuerpo(req)));
    if(ruta==='laboral-confirmar'&&req.method==='POST')return env(await repo.confirmarLaboral(u,await cuerpo(req)),201);
    if(ruta==='laboral-partes'&&req.method==='GET'){entrada(uuid,proyecto);return env(await repo.listarPartes(u,proyecto,desde,hasta,p));}
    if(ruta==='material-candidatos'&&req.method==='GET'){entrada(uuid,proyecto);return env(await repo.candidatosMaterial(u,proyecto,desde,hasta,p,q,url.searchParams.get('todos')==='1'));}
    if(ruta==='material-preparar'&&req.method==='POST')return env(await repo.prepararMaterial(u,await cuerpo(req)));
    if(ruta==='material-confirmar'&&req.method==='POST')return env(await repo.confirmarMaterial(u,await cuerpo(req)),201);
    if(ruta==='material-apunte'&&req.method==='GET')return env(await repo.historialMaterial(u,id,p));
    if(ruta==='material-apunte'&&req.method==='POST'){const b=await cuerpo(req);if(!b?.seleccion?.apuntes?.every((a:{apunteId?:string})=>a.apunteId===id))throw new ErrorCoste('ENTRADA_INVALIDA','El apunte no coincide con la dirección.');return env(await repo.confirmarMaterial(u,b),201);}
    if(ruta==='corte-preparar'&&req.method==='POST')return env(await repo.prepararCorte(u,await cuerpo(req)));
    if(ruta==='corte-confirmar'&&req.method==='POST')return env(await repo.confirmarCorte(u,await cuerpo(req)),201);
    if(ruta==='corte'&&req.method==='GET')return env(await repo.leerCorte(u,id));
    if(ruta==='proyecto'&&req.method==='GET'){entrada(uuid,proyecto);return env(url.searchParams.get('modo')==='metadatos'?await repo.metadatos(u,proyecto):url.searchParams.get('modo')==='cortes'?await repo.listarCortes(u,proyecto,p,entrada(corteSchema.shape.tipo.optional(),url.searchParams.get('tipoCorte')??undefined)):await repo.resumen(u,{proyectoId:proyecto,salas:{modo:'todas'},tareas:null,desde,hasta,componentes:['laboral','material']}));}
    throw new ErrorCoste('NO_ENCONTRADO','Operación no disponible.',404);
  } catch(e) {const error=errorSeguroCostes(e);return responder({solicitudId,error:error.message,codigo:error.codigo},error.status);}
}

import { ErrorResultado,LIMITES_RESULTADOS,validar,uuid } from './modelo';
import { ServicioResultados } from './servicio';
import { ErrorCoste } from '../costes/modelo';
import { ErrorSeguimiento } from '../seguimiento-propuestas/modelo';
import { ErrorPropuesta } from '../propuestas/modelo';
export function respuestaResultado(v:unknown,status=200){return Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export function errorResultado(e:unknown){if(e instanceof ErrorResultado||e instanceof ErrorCoste||e instanceof ErrorSeguimiento||e instanceof ErrorPropuesta)return {message:e.message,status:e.status};if(['23505','40001','40P01'].includes((e as {code?:string})?.code??''))return {message:'Otra operación cambió las fuentes. Conserva tu selección y prepara de nuevo.',status:409};return {message:'No se pudo completar el resultado. Se conserva el historial.',status:503};}
export async function cuerpoResultado(req:Request){if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')??''))throw new ErrorResultado('Se necesita application/json.');const lector=req.body?.getReader();if(!lector)throw new ErrorResultado('Falta el cuerpo JSON.');const partes:Uint8Array[]=[];let bytes=0;try{while(true){const r=await lector.read();if(r.done)break;bytes+=r.value.length;if(bytes>LIMITES_RESULTADOS.cuerpo){await lector.cancel();throw new ErrorResultado('La solicitud supera 64 KiB.',413);}partes.push(r.value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(partes)));}catch(e){if(e instanceof ErrorResultado)throw e;throw new ErrorResultado('JSON inválido.');}finally{lector.releaseLock();}}
export async function atenderResultado(req:Request,ruta:'preparar'|'raiz'|'detalle',id?:string){try{
 const {sql,hayConfiguracion}=await import('../db'),{sesionActual}=await import('../sesion-servidor');
 if(!hayConfiguracion())throw new ErrorResultado('Base de datos sin configurar.',503);const sesion=await sesionActual();if(!sesion)throw new ErrorResultado('Inicia sesión.',401);if(sesion.ficticio||sesion.debeCambiarClave)throw new ErrorResultado('Se necesita una identidad real con contraseña definitiva.',403);
 if(req.method!=='GET'&&req.headers.get('origin')!==new URL(req.url).origin)throw new ErrorResultado('Origen no permitido.',403);
 const servicio=new ServicioResultados(sql);await servicio.autorizar(sesion.id,req.method!=='GET');const url=new URL(req.url);
 const permitidas=ruta==='raiz'&&req.method==='GET'?['proyecto','propuesta','revision','corte','propuestasDesde','resultadosDesde']:[];for(const k of url.searchParams.keys())if(!permitidas.includes(k)||url.searchParams.getAll(k).length!==1)throw new ErrorResultado('Filtro desconocido o duplicado.');
 if(ruta==='detalle'&&req.method==='GET'&&id)return respuestaResultado(await servicio.leer(sesion.id,validar(uuid,id)));
 if(ruta==='preparar'&&req.method==='POST')return respuestaResultado(await servicio.preparar(sesion.id,await cuerpoResultado(req)));
 if(ruta==='raiz'&&req.method==='POST')return respuestaResultado(await servicio.guardar(sesion.id,await cuerpoResultado(req)),201);
 if(ruta==='raiz'&&req.method==='GET'){const p=url.searchParams.get('proyecto');if(!p)throw new ErrorResultado('Selecciona una obra.');for(const k of ['propuesta','revision','corte','propuestasDesde','resultadosDesde'])if(url.searchParams.has(k))validar(uuid,url.searchParams.get(k));return respuestaResultado(await servicio.opciones(sesion.id,p,url.searchParams.get('propuesta')??undefined,url.searchParams.get('revision')??undefined,url.searchParams.get('corte')??undefined,{propuestasDesde:url.searchParams.get('propuestasDesde')??undefined,resultadosDesde:url.searchParams.get('resultadosDesde')??undefined}));}
 throw new ErrorResultado('Operación no disponible.',404);
 }catch(e){const error=errorResultado(e);return respuestaResultado({error:error.message},error.status);}}

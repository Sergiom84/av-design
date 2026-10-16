import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ErrorCoste, type ConexionCostes } from './modelo';
export function canonico(valor:unknown):string {
  if(valor===null||typeof valor!=='object') return JSON.stringify(valor);
  if(Array.isArray(valor)) return '['+valor.map(canonico).join(',')+']';
  const v=valor as Record<string,unknown>;
  return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonico(v[k])).join(',')+'}';
}
export const sha256=(v:unknown)=>createHash('sha256').update(canonico(v)).digest('hex');
export function firmarRevision(secreto:string,usuario:string,tipo:string,hash:string,ahora=Date.now()) {
  if(secreto.length<24) throw new ErrorCoste('SERVICIO_NO_DISPONIBLE','Falta la configuración segura de costes.',503);
  const cuerpo=Buffer.from(JSON.stringify({v:1,u:usuario,t:tipo,h:hash,exp:ahora+600000})).toString('base64url');
  return cuerpo+'.'+createHmac('sha256',secreto).update(cuerpo).digest('base64url');
}
export function comprobarRevision(secreto:string,token:string,usuario:string,tipo:string,hash:string,ahora=Date.now()) {
  try {
    const [cuerpo,firma,...extra]=token.split('.');
    if(!cuerpo||!firma||extra.length) throw new Error();
    const esperada=createHmac('sha256',secreto).update(cuerpo).digest();
    const recibida=Buffer.from(firma,'base64url');
    if(recibida.length!==esperada.length||!timingSafeEqual(recibida,esperada)) throw new Error();
    const p=JSON.parse(Buffer.from(cuerpo,'base64url').toString('utf8'));
    if(p.v!==1||p.u!==usuario||p.t!==tipo||p.h!==hash||!Number.isFinite(p.exp)||p.exp<=ahora||p.exp>ahora+600000) throw new Error();
  } catch { throw new ErrorCoste('FUENTE_CAMBIADA','La revisión ha cambiado o caducado. Prepara de nuevo y conserva tu selección.',409); }
}
export async function bloquearPeticion(c:ConexionCostes,autorId:string,clave:string) {
  await c`select pg_advisory_xact_lock(hashtextextended(${autorId+':'+clave},0))`;
}
export async function operacionPrevia(c:ConexionCostes,autorId:string,clave:string,hash:string) {
  const [r]=await c`select hash_peticion,resultado from coste_operaciones where autor_id=${autorId} and clave_peticion=${clave}`;
  if(r&&r.hash_peticion!==hash) throw new ErrorCoste('CLAVE_REUTILIZADA','La clave de petición ya corresponde a otros datos.',409);
  return r?.resultado as Record<string,unknown>|undefined;
}
export async function registrarOperacion(c:ConexionCostes,autorId:string,clave:string,hash:string,tipo:string,resultado:unknown) {
  await c`insert into coste_operaciones(autor_id,clave_peticion,hash_peticion,tipo,resultado) values(${autorId},${clave},${hash},${tipo},${c.json(JSON.parse(JSON.stringify(resultado)))})`;
}
export const iso=(v:unknown)=>v instanceof Date?v.toISOString():String(v);

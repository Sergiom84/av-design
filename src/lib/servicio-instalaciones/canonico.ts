import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ErrorServicio } from './modelo';
export function canonico(v: unknown): string {
  if(v instanceof Date) return JSON.stringify(v.toISOString());
  if(v===null||typeof v!=='object') return JSON.stringify(v);
  if(Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  return `{${Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${canonico(v)}`).join(',')}}`;
}
export const hash = (v:unknown)=>createHash('sha256').update(canonico(v)).digest('hex');
export const serialNormalizado = (v:string|null)=>v?.trim() ? v.trim().normalize('NFC').toLocaleUpperCase('es-ES') : null;
export const serialLiteral = (v:string|null)=>v?.trim() ? v : null;
export function firmar(v:unknown, secreto:string) { const p=Buffer.from(canonico(v)).toString('base64url'); return `${p}.${createHmac('sha256',secreto).update(p).digest('base64url')}`; }
export function verificar(token:string,secreto:string,usuarioId:string,ahora:Date,soloFirma=false): Record<string,unknown> {
  if(!secreto||!token||token.length>64000) throw new ErrorServicio('Preview no válido.',409);
  const [p,f,...resto]=token.split('.'), firma=createHmac('sha256',secreto).update(p??'').digest('base64url');
  if(resto.length||!f||f.length!==firma.length||!timingSafeEqual(Buffer.from(f),Buffer.from(firma)))throw new ErrorServicio('Preview no válido.',409);
  let v:Record<string,unknown>; try{v=JSON.parse(Buffer.from(p,'base64url').toString());}catch{throw new ErrorServicio('Preview no válido.',409);}
  if(v.usuarioId!==usuarioId||typeof v.expira!=='number'||!soloFirma&&(v.expira<+ahora||v.expira>+ahora+600000))throw new ErrorServicio('Preview caducado o de otra persona. Revísalo de nuevo.',409);
  return v;
}

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { COOKIE_SESION, firmarSesion } from '@/lib/sesion';

const entorno={...process.env};
after(()=>{for(const k of ['NODE_ENV','SESION_SECRETO']){if(entorno[k]===undefined)delete process.env[k];else process.env[k]=entorno[k];}});
const secreto='prueba-middleware-sintetica';
describe('la puerta API conserva errores JSON y las páginas redirigen',()=>{
  it('toda ruta API sin cookie válida recibe401 sin cache ni redirect',async()=>{
    Object.assign(process.env,{NODE_ENV:'development',SESION_SECRETO:secreto});
    for(const ruta of ['/api','/api/plantillas','/api/plantillas/a','/api/catalogo','/api/documentos','/api/importacion']){
      for(const cookie of [undefined,'manipulada',await firmarSesion(secreto,Date.now()-1000,'usuario')]){
        const r=await middleware(new NextRequest(`http://localhost${ruta}`,{headers:cookie?{cookie:`${COOKIE_SESION}=${cookie}`}:{}}));
        assert.equal(r.status,401);assert.deepEqual(await r.json(),{error:'Sin sesión.'});assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('location'),null);
      }
    }
    const pagina=await middleware(new NextRequest('http://localhost/salas'));assert.equal(pagina.status,307);assert.match(pagina.headers.get('location')!,/\/entrar/);
  });
  it('producción sin secreto devuelve503 genérico JSON para APIs',async()=>{
    Object.assign(process.env,{NODE_ENV:'production',SESION_SECRETO:''});
    const r=await middleware(new NextRequest('http://localhost/api/plantillas'));
    assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'Servicio no disponible.'});assert.equal(r.headers.get('cache-control'),'no-store');
  });
  it('desarrollo abierto y cookie firmada vigente siguen pasando',async()=>{
    Object.assign(process.env,{NODE_ENV:'development',SESION_SECRETO:''});assert.equal((await middleware(new NextRequest('http://localhost/api/plantillas'))).status,200);
    process.env.SESION_SECRETO=secreto;
    const cookie=await firmarSesion(secreto,Date.now()+60_000,'usuario');
    const r=await middleware(new NextRequest('http://localhost/api/plantillas',{headers:{cookie:`${COOKIE_SESION}=${cookie}`}}));assert.equal(r.status,200);
  });
});

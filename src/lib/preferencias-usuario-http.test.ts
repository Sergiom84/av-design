import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import { ErrorPreferencias } from './preferencias-usuario';
let falloSesion=false,configurada=true,yo:unknown={id:'persona',ficticio:false,debeCambiarClave:false},falloRepositorio=false;
const cargador=Module as unknown as {_load:(s:string,p?:{filename?:string},...r:unknown[])=>unknown};const original=cargador._load;
const dobles:Record<string,unknown>={
 'server-only':{},
 './db':{hayConfiguracion:()=>configurada},
 './sesion-servidor':{sesionActual:async()=>{if(falloSesion)throw new Error('SQL privado contraseña');return yo;}},
 '@/lib/db':{sql:{}},
 '@/lib/preferencias-usuario-repositorio':{leerPreferencias:async()=>{if(falloRepositorio)throw new Error('SQL privado contraseña');return {grupo:'catalogo',version:0,valor:{marcas:[],q:''}};},cambiarPreferencias:async()=>({version:1}),consultarCatalogoPreferido:async()=>({resultados:[]})},
};
let api:typeof import('../app/api/preferencias/route'),http:typeof import('./preferencias-usuario-http');
try{cargador._load=(s,p,...r)=>((p?.filename?.includes('preferencias-usuario-http')||p?.filename?.includes('/api/preferencias/'))&&s in dobles)?dobles[s]:original.call(Module,s,p,...r);
const req=createRequire(import.meta.url);http=req('./preferencias-usuario-http.ts');api=req('../app/api/preferencias/route.ts');}finally{cargador._load=original;}
const solicitud=(body:string,origin='https://av.example',headers:Record<string,string>={})=>new Request('https://av.example/api/preferencias',{method:'PUT',headers:{'content-type':'application/json',origin,...headers},body});
describe('HTTP preferencias: límite, errores seguros y contrato estricto',()=>{
 it('incluye sesión y repositorio dentro de frontera503 no-store',async()=>{
   for(const donde of ['sesion','repositorio']){falloSesion=donde==='sesion';falloRepositorio=donde==='repositorio';const r=await api.GET(new Request('https://av.example/api/preferencias?grupo=catalogo'));assert.equal(r.status,503);assert.match(r.headers.get('cache-control')??'',/no-store/);assert(!JSON.stringify(await r.json()).includes('privado'));}falloSesion=false;falloRepositorio=false;
 });
 it('no disfraza faltaBD o sesión/provisional/ficticio como éxito',async()=>{
   configurada=false;assert.equal((await api.GET(new Request('https://av.example/api/preferencias?grupo=catalogo'))).status,503);configurada=true;
   for(const [valor,status]of [[null,401],[{ficticio:true},403],[{debeCambiarClave:true},403]]as const){yo=valor;assert.equal((await api.GET(new Request('https://av.example/api/preferencias?grupo=catalogo'))).status,status);}yo={id:'persona',ficticio:false,debeCambiarClave:false};
 });
 it('rechaza origen ajeno y JSON desconocido/identidad falsificada',async()=>{
   assert.equal((await api.PUT(solicitud('{}','https://ajeno.invalid'))).status,403);
   for(const body of ['{',JSON.stringify({grupo:'catalogo',version:0,valor:{marcas:[]},usuario_id:'otra'}),JSON.stringify({grupo:'panel',version:0,valor:{ocultas:['inventada']}})])assert.equal((await api.PUT(solicitud(body))).status,400);
 });
 it('limita Content-Length y bytes recibidos antes del parseo',async()=>{
   for(const r of [solicitud('{}','https://av.example',{'content-length':'9000'}),solicitud(' '.repeat(8193))])await assert.rejects(()=>http.entradaPreferencias(r),(e:unknown)=>e instanceof ErrorPreferencias&&e.status===413);
 });
 it('exige grupo único y sólo devuelve grupo pedido',async()=>{
   for(const q of ['','?grupo=otro','?grupo=panel&grupo=catalogo','?grupo=panel&usuario_id=otro'])assert.equal((await api.GET(new Request(`https://av.example/api/preferencias${q}`))).status,400);
   const r=await api.GET(new Request('https://av.example/api/preferencias?grupo=catalogo'));assert.equal(r.status,200);assert(!('panel'in await r.json()));
 });
});

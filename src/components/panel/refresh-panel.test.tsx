import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import Module,{createRequire} from 'node:module';
import { act } from 'react';
import { montar,pulsar } from '@/pruebas/dom';
import type { DatosPanel } from '@/lib/panel-repositorio';
import type { PreferenciasPanel } from '@/lib/preferencias-usuario';
let datos:DatosPanel;
const usuario={id:'identidad-panel-estable',ficticio:false};
const cargador=Module as unknown as {_load:(s:string,...r:unknown[])=>unknown};const original=cargador._load;
let Panel:typeof import('../../app/page').default;
try{
 cargador._load=(s,...r)=>s==='next/navigation'?{useRouter:()=>({refresh:()=>{}})}:s==='@/lib/db'?{hayConfiguracion:()=>true,sql:{}}:s==='@/lib/sesion-servidor'?{exigirSeccion:async()=>usuario}:s==='@/lib/panel-repositorio'?{leerPanel:async()=>structuredClone(datos)}:s==='@/components/panel/resumen-panel'?{ResumenPanel:()=>null}:original.call(Module,s,...r);
 Panel=createRequire(import.meta.url)('../../app/page.tsx').default;
}finally{cargador._load=original;}
function reiniciar(){datos={version:0,preferencias:{orden:['salas','cargas'],ocultas:[]},opciones:[{clave:'salas',etiqueta:'Salas',seccion:'salas',href:'/salas'},{clave:'cargas',etiqueta:'Cargas abiertas',seccion:'carga',href:'/carga'}],tarjetas:[],avisos:[]};}
function casilla(c:HTMLElement,nombre:string){const etiqueta=[...c.querySelectorAll('label')].find(l=>l.textContent?.trim()===nombre);assert(etiqueta);return etiqueta.querySelector('input')as HTMLInputElement;}
async function enviar(c:HTMLElement){await act(async()=>{c.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
describe('Panel real: reconciliación del RSC con el borrador montado',()=>{
 for(const metodo of ['PUT','DELETE']as const)it(`${metodo}: el RSC posterior al200 conserva la edición siguiente, el status y la versión CAS`,async()=>{
  reiniciar();const originalFetch=global.fetch;const versiones:number[]=[];
  global.fetch=async(_u,o)=>{const cuerpo=JSON.parse(String(o?.body));versiones.push(cuerpo.version);assert.equal(cuerpo.version,datos.version);datos={...datos,version:datos.version+1,preferencias:o?.method==='DELETE'?{orden:['salas','cargas'],ocultas:[]}:cuerpo.valor};return Response.json({grupo:'panel',version:datos.version,valor:datos.preferencias,opciones:datos.opciones});};
  const m=await montar(await Panel());
  try{
   if(metodo==='PUT')await enviar(m.contenedor);else await pulsar([...m.contenedor.querySelectorAll('button')].find(b=>b.textContent==='Restablecer Panel')!);
   const mensaje=metodo==='PUT'?'Preferencias guardadas.':'Preferencias restablecidas.';
   assert.equal(m.contenedor.querySelector('[role=status]')?.textContent,mensaje);
   await pulsar(casilla(m.contenedor,'Cargas abiertas'));assert.equal(casilla(m.contenedor,'Cargas abiertas').checked,false);
   // Llega ahora el árbol RSC que router.refresh solicitó tras el200.
   await m.repintar(await Panel());
   assert.equal(casilla(m.contenedor,'Cargas abiertas').checked,false,'No perder el cambio iniciado después del200.');
   assert.equal(m.contenedor.querySelector('[role=status]')?.textContent,mensaje,'No borrar el anuncio accesible.');
   await enviar(m.contenedor);assert.deepEqual(versiones,[0,1]);assert(datos.preferencias.ocultas.includes('cargas'));
  }finally{await m.desmontar();global.fetch=originalFetch;}
 });
 it('el RSC actualiza opciones ACL sin imponer sus valores ni avanzar el CAS local',async()=>{
  reiniciar();const originalFetch=global.fetch;let enviado:{version:number;valor:PreferenciasPanel}|undefined;
  global.fetch=async(_u,o)=>{enviado=JSON.parse(String(o?.body));return Response.json({error:'Las preferencias cambiaron en otra pestaña.'},{status:409});};
  const m=await montar(await Panel());
  try{
   await pulsar(casilla(m.contenedor,'Salas'));
   datos={...datos,version:9,preferencias:{orden:['salas'],ocultas:[]},opciones:datos.opciones.filter(o=>o.clave==='salas')};
   await m.repintar(await Panel());
   assert(!m.contenedor.textContent?.includes('Cargas abiertas'),'Las opciones retiradas no siguen en la configuración.');
   assert.equal(casilla(m.contenedor,'Salas').checked,false,'Conservar el borrador permitido.');
   await enviar(m.contenedor);assert.deepEqual(enviado,{grupo:'panel',version:0,valor:{orden:['salas'],ocultas:['salas']}});
   assert.equal(casilla(m.contenedor,'Salas').checked,false,'El409 no adopta la versión ajena.');
  }finally{await m.desmontar();global.fetch=originalFetch;}
 });
 it('una comparación ya abierta retira también las opciones revocadas al llegar el RSC',async()=>{
  reiniciar();const originalFetch=global.fetch;let enviado:{version:number;valor:PreferenciasPanel}|undefined;
  global.fetch=async(_u,o)=>{
   if(o?.method==='GET')return Response.json({grupo:'panel',version:datos.version,valor:datos.preferencias,opciones:datos.opciones});
   enviado=JSON.parse(String(o?.body));
   return Response.json({grupo:'panel',version:1,valor:enviado!.valor,opciones:datos.opciones});
  };
  const m=await montar(await Panel());
  try{
   await pulsar([...m.contenedor.querySelectorAll('button')].find(b=>b.textContent==='Recargar y comparar')!);
   assert.match(m.contenedor.querySelector('ol.list-decimal')?.textContent??'',/Cargas abiertas/);
   await pulsar(casilla(m.contenedor,'Salas'));
   datos={...datos,opciones:datos.opciones.filter(o=>o.clave==='salas')};
   await m.repintar(await Panel());
   assert(!m.contenedor.textContent?.includes('Cargas abiertas'),'La comparación debe aplicar la misma ACL vigente que el formulario.');
   assert.equal(casilla(m.contenedor,'Salas').checked,false,'La retirada no borra la edición autorizada.');
   await pulsar([...m.contenedor.querySelectorAll('button')].find(b=>b.textContent==='Usar versión del servidor')!);
   assert.equal(casilla(m.contenedor,'Salas').checked,true,'Sólo la adopción explícita cambia la edición.');
   await enviar(m.contenedor);
   assert.deepEqual(enviado,{grupo:'panel',version:0,valor:{orden:['salas'],ocultas:[]}});
  }finally{await m.desmontar();global.fetch=originalFetch;}
 });
});

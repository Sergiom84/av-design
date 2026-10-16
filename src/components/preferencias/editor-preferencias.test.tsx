import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import Module,{createRequire} from 'node:module';
import { act,createElement } from 'react';
import { montar,pulsar,escribir,esperar } from '@/pruebas/dom';
import type { EstadoPreferencias } from './editor-preferencias';
const cargador=Module as unknown as {_load:(s:string,...resto:unknown[])=>unknown};const original=cargador._load;
let Editor:typeof import('./editor-preferencias').EditorPreferencias;
try{cargador._load=(s,...r)=>s==='next/navigation'?{useRouter:()=>({refresh:()=>{}})}:original.call(Module,s,...r);Editor=createRequire(import.meta.url)('./editor-preferencias.tsx').EditorPreferencias;}finally{cargador._load=original;}
const boton=(c:HTMLElement,texto:string)=>{const b=[...c.querySelectorAll('button')].find(b=>b.textContent===texto);assert(b);return b;};
const responder=(valor:unknown,status=200)=>Promise.resolve(Response.json(valor,{status}));
async function enviar(c:HTMLElement){await act(async()=>{c.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
describe('Editor REA02 montado',()=>{
 it('ordena por botones y sólo envía las opciones autorizadas',async()=>{
  const guardar=global.fetch;let cuerpo:Record<string,unknown>={};const inicial:EstadoPreferencias={grupo:'panel',version:3,valor:{orden:['salas','reservas'],ocultas:[]},opciones:[{clave:'salas',etiqueta:'Salas'},{clave:'reservas',etiqueta:'Reservas activas'}]};
  global.fetch=async(_u,o)=>{cuerpo=JSON.parse(String(o?.body));return Response.json({...inicial,version:4,valor:cuerpo.valor});};
  const m=await montar(createElement(Editor,{grupo:'panel',inicial}));
  try{assert(!m.contenedor.textContent?.includes('Pedidos'));await pulsar(m.contenedor.querySelector('[aria-label="Subir Reservas activas"]')as HTMLButtonElement);await enviar(m.contenedor);assert.deepEqual(cuerpo,{grupo:'panel',version:3,valor:{orden:['reservas','salas'],ocultas:[]}});assert.match(m.contenedor.textContent??'',/Preferencias guardadas/);}finally{await m.desmontar();global.fetch=guardar;}
 });
 it('un409 conserva edición; comparar no la sustituye hasta elección explícita',async()=>{
  const guardar=global.fetch;const inicial:EstadoPreferencias={grupo:'catalogo',version:0,valor:{marcas:[],q:'inicial'}};
  global.fetch=async(_u,o)=>o?.method==='PUT'?Response.json({error:'Las preferencias cambiaron en otra pestaña.'},{status:409}):Response.json({...inicial,version:1,valor:{marcas:['Servidor'],q:'servidor'}});
  const m=await montar(createElement(Editor,{grupo:'catalogo',inicial}));
  try{const q=m.contenedor.querySelector('input[aria-label="Buscar en referencias preferidas"]')as HTMLInputElement;await escribir(q,'edición local');await enviar(m.contenedor);assert.equal(q.value,'edición local');assert.match(m.contenedor.textContent??'',/otra pestaña/);await pulsar(boton(m.contenedor,'Recargar y comparar'));assert.equal(q.value,'edición local');assert.match(m.contenedor.textContent??'',/Búsqueda del servidor/);assert.match(m.contenedor.textContent??'',/Marcas del servidor/);assert.equal(m.contenedor.querySelector('pre'),null);await pulsar(boton(m.contenedor,'Usar versión del servidor'));assert.equal(q.value,'servidor');}finally{await m.desmontar();global.fetch=guardar;}
 });
 it('unGET inicial tardío no pisa el formulario recuperado y editado',async()=>{
  const guardar=global.fetch;let resolver:(r:Response)=>void=()=>{};const antigua=new Promise<Response>(r=>resolver=r);let n=0;
  global.fetch=()=>++n===1?antigua:responder({grupo:'catalogo',version:2,valor:{marcas:[],q:'reciente'}});
  const m=await montar(createElement(Editor,{grupo:'catalogo'}));
  try{await esperar(1);await pulsar(boton(m.contenedor,'Recargar y comparar'));await pulsar(boton(m.contenedor,'Usar versión del servidor'));const q=m.contenedor.querySelector('input[aria-label="Buscar en referencias preferidas"]')as HTMLInputElement;await escribir(q,'mi edición');await act(async()=>{resolver(Response.json({grupo:'catalogo',version:0,valor:{marcas:[],q:'antigua'}}));await Promise.resolve();});assert.equal(q.value,'mi edición');}finally{await m.desmontar();global.fetch=guardar;}
 });
});

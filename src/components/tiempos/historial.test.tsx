import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { act, createElement } from 'react';
import { montar, pulsar } from '@/pruebas/dom';
import { HistorialTiempo } from './historial';
import type { ParteTiempo } from '@/lib/tiempos/modelo';
const parte: ParteTiempo = { id:'d5150000-0000-4000-8000-000000009001',tareaId:'tarea',tarea:'Tarea propia',proyectoId:'obra',proyecto:'Obra propia',salaId:null,sala:null,tecnicoId:'tecnico',tecnico:'Técnico propio',tecnicoActivo:true,relacionadoId:null,numeroActual:1,actualId:'v1',puedeEscribir:true,version:{id:'v1',numero:1,antecedenteId:null,accion:'registro',inicioUtc:'2026-10-14T07:00:00.000Z',finUtc:'2026-10-14T08:00:00.000Z',minutos:60,entradaLocal:{inicio:{fecha:'2026-10-14',hora:'09:00'},fin:{fecha:'2026-10-14',hora:'10:00'}},notas:'Original',motivo:null,autorNombre:'Autor',creadoEn:'2026-10-14T08:00:00Z'} };
const campo=(c:HTMLElement,n:string)=>c.querySelector(`textarea[aria-label="${n}"]`) as HTMLTextAreaElement;
async function texto(c:HTMLTextAreaElement,v:string){await act(async()=>{Object.getOwnPropertyDescriptor(c.ownerDocument.defaultView!.HTMLTextAreaElement.prototype,'value')!.set!.call(c,v);c.dispatchEvent(new Event('input',{bubbles:true}));});}
const boton=(c:HTMLElement,n:string)=>{const b=[...c.querySelectorAll('button')].find(b=>b.textContent===n);assert(b);return b;};
async function enviar(c:HTMLElement){await act(async()=>{c.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
describe('partes montados conservan edición y retiran contexto',()=>{
 it('409 conserva borrador; comparación requiere adopción explícita',async()=>{
  const original=global.fetch;
  global.fetch=async(_u,o)=>o?.method==='PATCH'?Response.json({error:'Cambió el parte',codigo:'VERSION_CONFLICTO'},{status:409}):Response.json({registro:{...parte,numeroActual:2,actualId:'v2',version:{...parte.version,notas:'Servidor'}}});
  const m=await montar(createElement(HistorialTiempo,{parte,cerrar:()=>{},alGuardar:async()=>{}}));
  try{await texto(campo(m.contenedor,'Corregir notas del parte'),'Borrador');await texto(campo(m.contenedor,'Motivo de corrección o anulación'),'Motivo');await enviar(m.contenedor);assert.equal(campo(m.contenedor,'Corregir notas del parte').value,'Borrador');await pulsar(boton(m.contenedor,'Recargar parte y comparar'));assert.equal(campo(m.contenedor,'Corregir notas del parte').value,'Borrador');await pulsar(boton(m.contenedor,'Adoptar versión guardada'));assert.equal(campo(m.contenedor,'Corregir notas del parte').value,'Servidor');}
  finally{await m.desmontar();global.fetch=original;}
 });
 it('respuesta de guardado tardía y props equivalentes no pisan una edición posterior',async()=>{
  const original=global.fetch;let liberar!:(v:Response)=>void;const pendiente=new Promise<Response>(r=>liberar=r);
  global.fetch=async(_u,o)=>o?.method==='PATCH'?pendiente:Response.json({registro:{...parte,numeroActual:2,actualId:'v2',version:{...parte.version,notas:'Enviado'}}});
  const props={parte,cerrar:()=>{},alGuardar:async()=>{}};const m=await montar(createElement(HistorialTiempo,props));
  try{await texto(campo(m.contenedor,'Corregir notas del parte'),'Enviado');await texto(campo(m.contenedor,'Motivo de corrección o anulación'),'Motivo');await enviar(m.contenedor);await texto(campo(m.contenedor,'Corregir notas del parte'),'Edición posterior');await act(async()=>{liberar(Response.json({id:parte.id,actualId:'v2',numeroActual:2}));await pendiente;});assert.equal(campo(m.contenedor,'Corregir notas del parte').value,'Edición posterior');await m.repintar(createElement(HistorialTiempo,{...props,parte:{...parte}}));assert.equal(campo(m.contenedor,'Corregir notas del parte').value,'Edición posterior');assert.match(m.contenedor.textContent??'',/edición posterior/);}
  finally{await m.desmontar();global.fetch=original;}
 });
 it('404 de ACL retira nombres e historial guardado y permite comprobar acceso',async()=>{
  const original=global.fetch;global.fetch=async()=>Response.json({error:'No disponible',codigo:'NO_ENCONTRADO'},{status:404});const m=await montar(createElement(HistorialTiempo,{parte,cerrar:()=>{},alGuardar:async()=>{}}));
  try{await pulsar(boton(m.contenedor,'Consultar historial del parte'));assert(!m.contenedor.textContent?.includes('Tarea propia'));assert(!m.contenedor.textContent?.includes('Obra propia'));assert(boton(m.contenedor,'Comprobar acceso actual'));}
  finally{await m.desmontar();global.fetch=original;}
 });
});

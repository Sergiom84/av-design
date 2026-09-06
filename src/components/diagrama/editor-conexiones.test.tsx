import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { montar, pulsar, esperar } from '@/pruebas/dom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { EditorConexiones } from './editor-conexiones';
import type { Sala, EquipoEnSala, Conexion } from '@/lib/tipos';
import type { EntradaGuardarEditorConexiones } from '@/lib/editor-conexiones';

test('las conexiones históricas sin puertos se seleccionan y editan individualmente', async () => {
 const sala = { id: 's1', ruta_por_defecto: 'falso_techo' } as Sala;
 const equipos: EquipoEnSala[] = ['e1','e2','e3'].map(id => ({id,sala_id:'s1',articulo_id:id,nombre:id,cantidad:1,extremo:'mesa',posicion:{x_m:0,y_m:0,z_m:0},posicion_confirmada:false,rotacion_grados:0}));
 const conexiones: Conexion[] = ['c1','c2'].map((id,i)=>({id,sala_id:'s1',origen_id:'e1',destino_id:`e${i+2}`,articulo_cable_id:null,senal:'hdmi',ruta:null,longitud_manual_m:null,notas:null}));
 const recibidas: EntradaGuardarEditorConexiones[]=[];
 const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as unknown as AppRouterInstance;
 const m = await montar(createElement(AppRouterContext.Provider,{value:router}, createElement(EditorConexiones,{sala,version:1,conexiones,equipos,puertos:[],articulos:[],cerrado:false,guardar:async entrada=>{recibidas.push(entrada);return {ok:true,version:2,ids:{}}}})));
 try{
  const selector=m.contenedor.querySelector<HTMLSelectElement>('[aria-label="Seleccionar conexión"]')!;
  assert.equal(selector.options.length,3);
  await act(async()=>{selector.value='c2'; selector.dispatchEvent(new (m.ventana as Window & typeof globalThis).Event('change',{bubbles:true}));});
  const boton=(texto:string)=>[...m.contenedor.querySelectorAll('button')].find(b=>b.textContent===texto)!;
  await pulsar(boton('Quitar conexión')); await pulsar(boton('Guardar borrador')); await esperar();
  assert.equal(recibidas.length,1); assert.deepEqual(recibidas[0].bajas,['c2']); assert.deepEqual(recibidas[0].cambios,[]);
 }finally{await m.desmontar()}
});

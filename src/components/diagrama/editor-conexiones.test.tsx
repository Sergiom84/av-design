import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { montar, pulsar, esperar } from '@/pruebas/dom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { EditorConexiones } from './editor-conexiones';
import type { Sala, EquipoEnSala, Conexion } from '@/lib/tipos';
import type { EntradaGuardarEditorConexiones } from '@/lib/editor-conexiones';
import { rosetaEnsayo } from './roseta.fixture';
import { PARAMETROS_POR_DEFECTO, type Puerto } from '@/lib/tipos';

test('las conexiones históricas sin puertos se seleccionan y editan individualmente', async () => {
 const sala = { id: 's1', ruta_por_defecto: 'falso_techo' } as Sala;
 const equipos: EquipoEnSala[] = ['e1','e2','e3'].map(id => ({id,sala_id:'s1',articulo_id:id,nombre:id,cantidad:1,extremo:'mesa',posicion:{x_m:0,y_m:0,z_m:0},posicion_confirmada:false,rotacion_grados:0}));
 const conexiones: Conexion[] = ['c1','c2'].map((id,i)=>({id,detalle:{estado:'legacy'},etiqueta_cable:'HD-'+(1000+i),sala_id:'s1',origen_id:'e1',destino_id:`e${i+2}`,articulo_cable_id:null,senal:'hdmi',ruta:null,longitud_manual_m:null,notas:null}));
 const recibidas: EntradaGuardarEditorConexiones[]=[];
 const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as unknown as AppRouterInstance;
 const m = await montar(createElement(AppRouterContext.Provider,{value:router}, createElement(EditorConexiones,{sala,version:1,conexiones,equipos,puertos:[],tomas:[],articulos:[],cerrado:false,guardar:async entrada=>{recibidas.push(entrada);return {ok:true,version:2,ids:{},etiquetas:{c1:'HD-1000'}}}})));
 try{
  const selector=m.contenedor.querySelector<HTMLSelectElement>('[aria-label="Seleccionar conexión"]')!;
  assert.equal(selector.options.length,3);
  await act(async()=>{selector.value='c2'; selector.dispatchEvent(new (m.ventana as Window & typeof globalThis).Event('change',{bubbles:true}));});
  const boton=(texto:string)=>[...m.contenedor.querySelectorAll('button')].find(b=>b.textContent===texto)!;
  await pulsar(boton('Quitar conexión')); await pulsar(boton('Guardar borrador')); await esperar();
  assert.equal(recibidas.length,1); assert.deepEqual(recibidas[0].bajas,['c2']); assert.deepEqual(recibidas[0].cambios,[]);
 }finally{await m.desmontar()}
});

test('inspector identifica la roseta y mantiene visible la causa de cálculo pendiente', async () => {
 const sala: Sala = { id:'s1', sede_id:null, localizacion_id:null, codigo:null, nombre:'Ensayo', tipologia:null,
  aforo:null, plantilla_id:null, largo_m:6, ancho_m:4, alto_m:3, alto_falso_techo_m:2.7, alto_canaleta_m:0.3,
  alto_suelo_tecnico_m:0, ruta_por_defecto:'directo', notas:null, mesa_largo_m:null, mesa_ancho_m:null,
  mesa_alto_cm:null, mesa_x_m:null, mesa_y_m:null, mesa_rotacion_grados:0, diagrama_version:1, sillas_modo:'derivadas' };
 const equipos: EquipoEnSala[] = [{id:'e1',sala_id:'s1',articulo_id:'a1',nombre:'Codec',cantidad:1,extremo:'mesa',posicion:{x_m:1,y_m:1,z_m:1},posicion_confirmada:true,rotacion_grados:0}];
 const puertos: Puerto[] = [{id:'p1',articulo_id:'a1',nombre:'LAN',total:2,sentido:'bidireccional',senal:'red',conector:'RJ45',orden:1,notas:null,fuente:'app'}];
 const conexiones: Conexion[] = [{id:'c1',etiqueta_cable:'RED-1000',sala_id:'s1',origen_id:'e1',destino_id:null,
  puerto_origen_id:'p1',puerto_origen_ordinal:2,puerto_destino_id:null,puerto_destino_ordinal:null,
  detalle:{estado:'completo',origen:{tipo:'equipo',equipo_id:'e1',puerto_id:'p1',ordinal:2},destino:{tipo:'roseta',toma_boca_id:'r2'}},
  articulo_cable_id:null,senal:'red',ruta:null,longitud_manual_m:null,notas:null}];
 const recibidas: EntradaGuardarEditorConexiones[]=[];
 const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as unknown as AppRouterInstance;
 const m = await montar(createElement(AppRouterContext.Provider,{value:router}, createElement(EditorConexiones,{sala,version:1,conexiones,equipos,puertos,tomas:[rosetaEnsayo],parametros:PARAMETROS_POR_DEFECTO,articulos:[],cerrado:false,guardar:async entrada=>{recibidas.push(entrada);return {ok:true,version:2,ids:{},etiquetas:{c1:'RED-1000'}}}})));
 try {
  assert.match(m.contenedor.textContent!, /posición completa de R-12/);
  assert.match(m.contenedor.textContent!, /holgura de roseta/);
  assert.equal(m.contenedor.querySelector('[aria-label="Longitud del cable"]')?.textContent, 'Longitud pendiente de cálculo');
  assert.doesNotMatch(m.contenedor.textContent!, /Sin medidas para calcular/);
  const destino=m.contenedor.querySelector<HTMLSelectElement>('[aria-label="Destino y boca"]')!;
  assert.equal(destino.value,'roseta|r2');
  assert.match(destino.selectedOptions[0].textContent!,/R-12.*Boca 2/);
  await act(async()=>{destino.value='roseta|r1';destino.dispatchEvent(new (m.ventana as Window & typeof globalThis).Event('change',{bubbles:true}));});
  await pulsar([...m.contenedor.querySelectorAll('button')].find(b=>b.textContent==='Guardar borrador')!); await esperar();
  assert.deepEqual(recibidas[0].cambios[0].destino,{tipo:'roseta',toma_boca_id:'r1'});
  assert.equal('longitud_manual_m' in recibidas[0].cambios[0],false);
 } finally {await m.desmontar();}
});

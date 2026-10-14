import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { generarPaquete, leerArchivo, leerPaquete } from './paquete';
import { PARAMETROS_POR_DEFECTO } from '../tipos';
import type { SalaExportada, SnapshotExportacion } from './modelo';

function sala(id:string):SalaExportada {
  return {sala:{id,nombre:'Sala áéíóú',codigo:'MISMO-CODIGO',sede_id:null,localizacion_id:null,
    tipologia:null,aforo:null,plantilla_id:null,largo_m:6,ancho_m:4,alto_m:3,
    alto_falso_techo_m:null,alto_canaleta_m:null,alto_suelo_tecnico_m:null,ruta_por_defecto:'directo',
    notas:null,mesa_largo_m:null,mesa_ancho_m:null,mesa_alto_cm:null,mesa_x_m:null,mesa_y_m:null,
    mesa_rotacion_grados:0,sillas_modo:'derivadas',diagrama_version:0},
    equipos:[],muebles:[],puertas:[],conexiones:[],tomas:[],puertos:[],resultadosCable:[],filasCable:[],reservas:[],posicionesEsquema:{}};
}
const snapshot:SnapshotExportacion={revision:'DOC-regresion-paquete',creadoEn:'2026-10-13T12:00:00.000Z',
  proyecto:{id:'obra',nombre:'Prueba',codigo:null},salas:[sala('e1000000-0000-4000-8000-000000000010'),sala('e1000000-0000-4000-8000-000000000011')],
  articulos:[],parametros:PARAMETROS_POR_DEFECTO,disponibilidad:[]};
const opciones={papel:'A4',orientacion:'horizontal',escala:50} as const;
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

it('dos salas con código y prefijo de UUID iguales conservan todos los archivos y hashes',async()=>{
  const m=await generarPaquete(snapshot,['cables-csv'],opciones,'usuario',()=>{});
  assert.equal(m.archivos.length,2);
  assert.equal(new Set(m.archivos.map(a=>a.nombre)).size,2);
  const bytes=await leerArchivo(m.id,'paquete.zip',m);
  assert.ok(bytes);
  const zip=unzipSync(bytes);
  assert.equal(Object.keys(zip).length,3);
  assert.deepEqual(JSON.parse(strFromU8(zip['manifiesto.json'])),m);
  for(const a of m.archivos)assert.equal(sha(zip[a.nombre]),a.sha256);
  const segunda=await leerArchivo(m.id,'paquete.zip',m);
  assert.ok(segunda);assert.equal(sha(segunda),sha(bytes));
  assert.equal(await leerPaquete(m.id,'otra-persona'),null);
  assert.equal(await leerArchivo(m.id,'../propietario.json',m),null);
});

it('fallo PDF mantiene archivos válidos y no reemplaza el paquete completo anterior',async()=>{
  const completo=await generarPaquete(snapshot,['cables-csv'],opciones,'usuario',()=>{});
  const antes=await leerArchivo(completo.id,'paquete.zip',completo);assert.ok(antes);
  const parcial=await generarPaquete(snapshot,['plano','cables-csv'],opciones,'usuario',()=>{},async()=>{throw new Error('Fallo simulado');});
  assert.equal(parcial.archivos.filter(a=>a.estado==='error').length,2);
  assert.equal(parcial.archivos.filter(a=>a.estado==='correcto').length,2);
  const bytes=await leerArchivo(parcial.id,'paquete.zip',parcial);assert.ok(bytes);
  assert.equal(Object.keys(unzipSync(bytes)).length,3);
  const despues=await leerArchivo(completo.id,'paquete.zip',completo);assert.ok(despues);
  assert.equal(sha(despues),sha(antes));
});

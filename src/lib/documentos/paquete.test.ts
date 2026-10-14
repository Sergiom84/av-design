import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { generarPaquete, leerArchivo, leerPaquete, type EventoPaquete } from './paquete';
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

it('progreso secuencial cuenta errores y correctos y termina con la misma revisión',async()=>{
  const eventos:EventoPaquete[]=[];
  const m=await generarPaquete(snapshot,['plano','cables-csv'],opciones,'usuario',evento=>eventos.push(evento),
    async()=>{throw new Error('Fallo simulado');});
  assert.deepEqual(eventos.map(e=>e.tipo),['inicio','documento','documento','documento','documento','fin']);
  const inicio=eventos[0];assert.equal(inicio.tipo,'inicio');
  if(inicio.tipo==='inicio')assert.deepEqual({id:inicio.paquete,revision:inicio.revision},{id:m.id,revision:m.revision});
  const documentos=eventos.filter(e=>e.tipo==='documento');
  assert.deepEqual(documentos.map(e=>[e.completados,e.total,e.archivo.estado]),
    [[1,4,'error'],[2,4,'error'],[3,4,'correcto'],[4,4,'correcto']]);
  assert.deepEqual(eventos.at(-1),{tipo:'fin',manifiesto:m});
  for(const a of m.archivos){
    const archivo=await leerArchivo(m.id,a.nombre,m);
    if(a.estado==='error')assert.equal(archivo,null);
    else {assert.ok(archivo);assert.equal(sha(archivo),a.sha256);assert.equal(archivo.length,a.bytes);}
  }
});

it('límite de 50 MB identifica el documento fallido y conserva los siguientes documentos',async()=>{
  const m=await generarPaquete({...snapshot,salas:snapshot.salas.slice(0,1)},['plano','cables-csv'],opciones,
    'usuario',()=>{},async()=>new Uint8Array(50*1024*1024+1));
  assert.equal(m.archivos[0].estado,'error');assert.match(m.archivos[0].error!,/50 MB/);
  assert.equal(m.archivos[1].estado,'correcto');
  const zip=await leerArchivo(m.id,'paquete.zip',m);assert.ok(zip);
  assert.deepEqual(Object.keys(unzipSync(zip)).sort(),['manifiesto.json',m.archivos[1].nombre].sort());
});

it('no mezcla manifiestos de otro paquete y caduca también el acceso directo al archivo',async(t)=>{
  const m=await generarPaquete(snapshot,['cables-csv'],opciones,'usuario',()=>{});
  assert.equal(await leerArchivo(m.id,'paquete.zip',{...m,id:'e1000000-0000-4000-8000-000000000099'}),null);
  assert.equal(await leerArchivo(m.id,'paquete.zip',{...m,caducaEn:'fecha-invalida'}),null);
  t.mock.method(Date,'now',()=>Date.parse(m.caducaEn));
  assert.equal(await leerArchivo(m.id,'paquete.zip',m),null);
  assert.equal(await leerPaquete(m.id,'usuario'),null);
});

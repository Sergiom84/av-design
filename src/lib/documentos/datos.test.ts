import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { PARAMETROS_POR_DEFECTO, type Articulo, type Sala } from '../tipos';

const salaId='e1000000-0000-4000-8000-000000000010';
const proyectoId='e1000000-0000-4000-8000-000000000001';
const articuloId='e1000000-0000-4000-8000-000000000020';
const sala:Sala={id:salaId,nombre:'Sala legado',codigo:'PRUEBA-DOC-01',sede_id:null,localizacion_id:null,
  proyecto_id:null,tipologia:null,aforo:null,plantilla_id:null,largo_m:6,ancho_m:4,alto_m:3,
  alto_falso_techo_m:null,alto_canaleta_m:null,alto_suelo_tecnico_m:null,ruta_por_defecto:'directo',
  notas:null,mesa_largo_m:null,mesa_ancho_m:null,mesa_alto_cm:null,mesa_x_m:null,mesa_y_m:null,
  mesa_rotacion_grados:0,sillas_modo:'derivadas',diagrama_version:7};
const articulo={id:articuloId,modelo:'Conector',tipo:'consumible',unidad:'ud'} as Articulo;
let partidasInstaladas=false;
let salaExiste=true;
let obraDeSala:string|null=null;
let proyectoExiste=true;
let lectura=false;
const consultas:string[]=[];
const exigirLectura=()=>assert.equal(lectura,true,'Todos los lectores deben usar el contexto consistente.');
const datosSala=()=>({sala:{...sala,proyecto_id:obraDeSala},equipos:[],muebles:[],conexiones:[],tomas:[],puertos:[]});

// Se sustituyen sólo los lectores de datos de este módulo. No abre conexiones,
// no usa DATABASE_URL y no exige instalar E2 para verificar la compatibilidad.
const dobles:Record<string,unknown>={
  'server-only':{},
  '../db':{
    conLecturaConsistente:async(leer:()=>Promise<unknown>)=>{
      assert.equal(lectura,false);lectura=true;
      try{return await leer();}finally{lectura=false;}
    },
    sql:async(textos:TemplateStringsArray)=>{
      exigirLectura();const consulta=textos.join('?');consultas.push(consulta);
      if(consulta.includes('to_regclass'))return [{existe:partidasInstaladas}];
      if(consulta.includes('from proyectos'))return proyectoExiste?[{id:proyectoId,nombre:'Obra',codigo:'PRUEBA-DOC-OBRA'}]:[];
      if(consulta.includes('from sala_equipos'))return [];
      throw new Error(`Consulta inesperada: ${consulta}`);
    },
  },
  '../datos':{
    obtenerSala:async()=>{exigirLectura();return salaExiste?datosSala():null;},
    listarArticulos:async()=>{exigirLectura();return [];},
    obtenerArticulo:async(id:string)=>{exigirLectura();assert.equal(id,articuloId);return articulo;},
    obtenerParametros:async()=>{exigirLectura();return PARAMETROS_POR_DEFECTO;},
  },
  '../datos-plano':{obtenerDatosPlanoSala:async()=>{exigirLectura();return salaExiste?{puertas:[]}:null;}},
  '../datos-almacen':{
    disponibilidadDeArticulos:async(ids:string[])=>{exigirLectura();return new Map(ids.map(id=>[id,{articulo_id:id,existencias:3,reservado:1,disponible:2}]));},
    reservasDeSala:async()=>{exigirLectura();return [];},
  },
  '../datos-material-bom':{materialBomDeSala:async()=>{
    exigirLectura();assert.equal(partidasInstaladas,true,'E1 sin E2 nunca debe consultar sus partidas.');
    return [{articulo_id:articuloId,descripcion:'Conector manual',unidad:'ud',cantidad:2,nota:null}];
  }},
};
type Cargador={_load:(request:string,parent?:{filename?:string},...resto:unknown[])=>unknown};
const cargador=Module as unknown as Cargador;
const original=cargador._load;
let modulo:typeof import('./datos');
try{
  cargador._load=(request,parent,...resto)=>parent?.filename?.endsWith('/documentos/datos.ts')&&request in dobles
    ?dobles[request]:original.call(Module,request,parent,...resto);
  modulo=createRequire(import.meta.url)('./datos.ts') as typeof import('./datos');
}finally{cargador._load=original;}

describe('lectura coherente compatible con E1 y partidas existentes',()=>{
  it('sala legado exporta sin obra ni tabla de E2, y cada generación distingue la revisión',async()=>{
    const uno=await modulo.cargarSnapshot([salaId]);
    const dos=await modulo.cargarSnapshot([salaId]);
    assert.equal(uno.proyecto,null);assert.equal(uno.salas[0].sala.proyecto_id,null);
    assert.deepEqual(uno.salas[0].materialBom,[]);assert.deepEqual(uno.articulos,[]);
    assert.deepEqual(uno.salas,dos.salas);assert.notEqual(uno.revision,dos.revision);
    assert.equal(consultas.filter(q=>q.includes('to_regclass')).length,2);
    assert.equal(lectura,false);
  });
  it('si E2 ya existe conserva las partidas manuales y los artículos necesarios',async()=>{
    partidasInstaladas=true;
    try{
      const snapshot=await modulo.cargarSnapshot([salaId]);
      assert.deepEqual(snapshot.salas[0].materialBom,[{articulo_id:articuloId,descripcion:'Conector manual',unidad:'ud',cantidad:2,nota:null}]);
      assert.deepEqual(snapshot.articulos,[articulo]);
      assert.equal(snapshot.disponibilidad[0].articulo_id,articuloId);
    }finally{partidasInstaladas=false;}
  });
  it('comprueba salas y obra dentro del contexto y rechaza alcance ajeno',async()=>{
    await assert.rejects(modulo.cargarSnapshot([salaId],proyectoId),{name:'Error',message:/ajena/});
    obraDeSala=proyectoId;
    try{
      const snapshot=await modulo.cargarSnapshot([salaId],proyectoId);
      assert.equal(snapshot.proyecto?.codigo,'PRUEBA-DOC-OBRA');
      proyectoExiste=false;
      await assert.rejects(modulo.cargarSnapshot([salaId],proyectoId),modulo.ErrorSeleccionDocumentos);
    }finally{obraDeSala=null;proyectoExiste=true;}
    salaExiste=false;
    try{await assert.rejects(modulo.cargarSnapshot([salaId]),modulo.ErrorSeleccionDocumentos);}
    finally{salaExiste=true;}
    await assert.rejects(modulo.cargarSnapshot([salaId,salaId]),modulo.ErrorSeleccionDocumentos);
    assert.equal(lectura,false);
  });
});

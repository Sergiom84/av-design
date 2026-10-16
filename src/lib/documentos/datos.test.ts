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

let salaExiste=true;
let obraDeSala:string|null=null;
let proyectoExiste=true;
let lectura=false;
const consultas:string[]=[];
const exigirLectura=()=>assert.equal(lectura,true,'Todos los lectores deben usar el contexto consistente.');
const datosSala=()=>({sala:{...sala,proyecto_id:obraDeSala},equipos:[],muebles:[],conexiones:[],tomas:[],puertos:[]});

// Se sustituyen sólo los lectores de este módulo. No abre conexiones ni usa
// DATABASE_URL; verifica también que E2/E3 comparten el contexto consistente.
const dobles:Record<string,unknown>={
  'server-only':{},
  '../revisiones-diseno-repositorio':{referenciaRevisionDiseno:async()=>{exigirLectura();return {estado:'borrador',hash:'f'.repeat(64)};}},
  '../datos-anotaciones':{obtenerAnotacionesSala:async()=>{exigirLectura();return [{id:'nota',texto:'Nota E3',ancla_tipo:'sala'}];}},
  '../db':{
    conLecturaConsistente:async(leer:()=>Promise<unknown>)=>{
      assert.equal(lectura,false);lectura=true;
      try{return await leer();}finally{lectura=false;}
    },
    sql:async(textos:TemplateStringsArray)=>{
      exigirLectura();const consulta=textos.join('?');consultas.push(consulta);
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
    exigirLectura();
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

describe('snapshot E1 conserva material E2 e identidad y notas E3 en una lectura',()=>{
  it('una sala legado conserva los datos vigentes y distingue cada generación',async()=>{
    const uno=await modulo.cargarSnapshot([salaId]);
    const dos=await modulo.cargarSnapshot([salaId]);
    assert.equal(uno.proyecto,null);assert.equal(uno.salas[0].sala.proyecto_id,null);
    assert.equal(uno.salas[0].materialBom?.[0].articulo_id,articuloId);
    assert.equal(uno.salas[0].revisionDiseno?.hash,'f'.repeat(64));
    assert.equal(uno.salas[0].anotacionesDiseno?.[0].texto,'Nota E3');
    assert.deepEqual(uno.articulos,[articulo]);
    assert.deepEqual(uno.salas,dos.salas);assert.notEqual(uno.revision,dos.revision);
    assert.equal(lectura,false);
  });
  it('clasifica las selecciones inválidas sin convertir fallos internos en errores de entrada',async()=>{
    const comprobar=async(promesa:Promise<unknown>)=>{
      await assert.rejects(promesa,(error:unknown)=>{
        assert.ok(error instanceof Error);
        assert.equal(error.constructor.name,'ErrorSeleccionDocumentos');return true;
      });
    };
    await comprobar(modulo.cargarSnapshot([salaId],proyectoId));
    obraDeSala=proyectoId;
    try{
      const snapshot=await modulo.cargarSnapshot([salaId],proyectoId);
      assert.equal(snapshot.proyecto?.codigo,'PRUEBA-DOC-OBRA');
      proyectoExiste=false;
      await comprobar(modulo.cargarSnapshot([salaId],proyectoId));
    }finally{obraDeSala=null;proyectoExiste=true;}
    salaExiste=false;
    try{await comprobar(modulo.cargarSnapshot([salaId]));}finally{salaExiste=true;}
    await comprobar(modulo.cargarSnapshot([salaId,salaId]));
    assert.equal(lectura,false);
  });
  it('reutiliza exactamente E2/E3 en la lectura del informe sin anidar transacciones ni atribuir otra obra',async()=>{
    const conLectura = (dobles['../db'] as {
      conLecturaConsistente: <T>(leer: () => Promise<T>) => Promise<T>;
    }).conLecturaConsistente;
    obraDeSala=proyectoId;
    try {
      const publica=await modulo.cargarSnapshot([salaId]);
      const interna=await conLectura(()=>modulo.cargarSnapshotEnLectura([salaId]));
      assert.equal(publica.proyecto?.id,proyectoId);
      assert.equal(interna.proyecto,null);
      for (const campo of ['salas','articulos','parametros','disponibilidad'] as const) {
        assert.deepEqual(interna[campo],publica[campo]);
      }
      const explicita=await conLectura(()=>modulo.cargarSnapshotEnLectura([salaId],proyectoId));
      assert.deepEqual(explicita.proyecto,publica.proyecto);
      const varias=await conLectura(()=>modulo.cargarSnapshotEnLectura([salaId,salaId]));
      assert.equal(varias.salas.length,2);
      assert.equal(varias.proyecto,null);
    } finally { obraDeSala=null; }
    assert.equal(lectura,false);
  });
});

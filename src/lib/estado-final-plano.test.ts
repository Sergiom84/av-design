import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import { coordenadasFueraDeSala,type PatchPlano } from './plano-editor';
import { estadoFinalCoordenadas,type CoordenadasPersistidas } from './estado-final-plano';
const medidas={largo_m:3,ancho_m:4,alto_m:3};
const vacio=():CoordenadasPersistidas=>({sala:{mesa_x_m:null,mesa_y_m:null},equipos:[],mobiliario:[],tomas:[]});
const patch=()=>({sala:null,equipos:[],equipos_alta:[],mobiliario_alta:[],mobiliario_cambio:[],mobiliario_baja:[],tomas:[]} as unknown as PatchPlano);
const punto={id:'p',x_m:5.5,y_m:1,z_m:1,posicion_confirmada:true};
describe('la geometría juzga persistido más patch, nunca sólo cambios',()=>{
  for(const tipo of ['equipos','mobiliario','tomas'] as const)it(`detecta ${tipo} persistido omitido del patch`,()=>{
    const estado=vacio();estado[tipo]=[punto];
    assert.equal(coordenadasFueraDeSala(estadoFinalCoordenadas(estado,patch()),medidas).length,1);
    assert.equal(estado[tipo][0].x_m,5.5);
  });
  it('superpone movimientos y bajas antes de validar sin mutar lo persistido',()=>{
    const estado=vacio();estado.equipos=[punto];estado.mobiliario=[{...punto,id:'m'}];estado.tomas=[{...punto,id:'t'}];
    const p=patch();p.equipos=[{...punto,x_m:2,rotacion_grados:0}];p.mobiliario_baja=['m'];p.tomas=[{id:'t',x_m:2,y_m:1,z_m:1}];
    assert.deepEqual(coordenadasFueraDeSala(estadoFinalCoordenadas(estado,p),medidas),[]);
    assert.equal(estado.equipos[0].x_m,5.5);assert.equal(estado.mobiliario.length,1);
  });
  it('incluye altas, conserva ausencias y no confunde cero confirmado con estimado',()=>{
    const estado=vacio();estado.equipos=[{...punto,posicion_confirmada:false}];estado.mobiliario=[{id:'m',x_m:null,y_m:null,z_m:null,posicion_confirmada:false}];estado.tomas=[{id:'t',x_m:null,y_m:null,z_m:null}];
    assert.deepEqual(coordenadasFueraDeSala(estadoFinalCoordenadas(estado,patch()),medidas),[]);
    const p=patch();p.equipos_alta=[{...punto,articulo_id:'art',rotacion_grados:0,extremo:'pared'}];
    assert.equal(coordenadasFueraDeSala(estadoFinalCoordenadas(estado,p),medidas).length,1);
    p.equipos_alta[0].x_m=0;assert.deepEqual(coordenadasFueraDeSala(estadoFinalCoordenadas(estado,p),medidas),[]);
  });
  it('usa el centro de mesa persistido cuando sala:null y el nuevo cuando cambia',()=>{
    const estado=vacio();estado.sala={mesa_x_m:5,mesa_y_m:1};
    assert.equal(coordenadasFueraDeSala(estadoFinalCoordenadas(estado,patch()),medidas).length,1);
    const p=patch();p.sala={mesa_x_m:2,mesa_y_m:1} as PatchPlano['sala'];
    assert.deepEqual(coordenadasFueraDeSala(estadoFinalCoordenadas(estado,p),medidas),[]);
  });
});

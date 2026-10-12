import assert from 'node:assert/strict';
import {test} from 'node:test';
import {latiguilloAsignableATirada, pendientesDeTiradas, proyectarSuministros, sumaCompraCable, type ContextoSuministros} from './suministros';
import {necesidadDeSala} from './compras';

test('Proyección conserva físicos y excluye solo los vinculados, nunca por nombre o modelo',()=>{
  const equipos=[{id:'incluido',articulo_id:'camara',nombre:'Cámara',cantidad:1},
    {id:'libre',articulo_id:'camara',nombre:'Cámara',cantidad:2},
    {id:'legacy',articulo_id:'kit',nombre:'Kit histórico',cantidad:3}];
  const contexto:ContextoSuministros={suministros:[{id:'suministro',sala_id:'sala',articulo_id:'kit',composicion_id:'c',estado:'activo',
    snapshot:{sku:'SKU',version:1,estado_documental:'documentada',fuente:'Ficha',lineas:[]}}],
    componentes:[{equipo_id:'incluido',suministro_id:'suministro',linea_id:'l',ordinal:1}]};
  const p=proyectarSuministros(equipos,contexto);
  assert.equal(p.fisicos,equipos);
  const necesidades=necesidadDeSala(p.necesidades,[],new Map());
  assert.equal(necesidades.find(l=>l.articulo_id==='camara')?.cantidad,2);
  assert.equal(necesidades.find(l=>l.articulo_id==='kit')?.cantidad,4);
  assert.deepEqual(necesidades.find(l=>l.articulo_id==='kit')?.suministros,['suministro']);
});
test('Sin suministros el histórico mantiene exactamente su necesidad y no bloquea logística',()=>{
  const equipos=[{id:'equipo',articulo_id:'a',nombre:'Histórico',cantidad:8}];
  const p=proyectarSuministros(equipos,{suministros:[],componentes:[]});
  assert.deepEqual(necesidadDeSala(p.necesidades,[],new Map()),necesidadDeSala(equipos,[],new Map()));
  assert.equal(p.bloqueoComercial,null);assert.deepEqual(p.pendientes,[]);
});
test('Mutante que sume incluido duplicaría compra; por_determinar no desaparece de pendientes',()=>{
  assert.equal(sumaCompraCable('incluido'),false);
  assert.equal(sumaCompraCable('por_determinar'),false);
  assert.equal(sumaCompraCable('adicional'),true);
  assert.equal(sumaCompraCable(undefined),true);
  const pendientes=pendientesDeTiradas(
    [{id:'c1',estado_suministro:'por_determinar',cable_suministrado_id:null,etiqueta_cable:'RED-1000'}],
    [],
  );
  assert.ok(pendientes.some((p)=>p.clave==='tirada-pendiente:c1'));
});
test('Unido solo se ofrece si la tirada ya contiene el extremo fijo',()=>{
  const cable={id:'k',suministro_id:'s',sala_id:'sala',linea_id:null,ordinal:1,tipo:'unido' as const,
    propietario_equipo_id:'micro',puerto_fijo_id:'p',ordinal_fijo:1,articulo_cable_id:null,longitud_utilizable_m:11,snapshot:{}};
  const completa={id:'c',cable_suministrado_id:null as string|null,detalle:{estado:'completo' as const,
    origen:{tipo:'equipo' as const,equipo_id:'micro',puerto_id:'p',ordinal:1},
    destino:{tipo:'equipo' as const,equipo_id:'sw',puerto_id:'q',ordinal:1}}};
  assert.equal(latiguilloAsignableATirada(cable,completa,new Set()),true);
  assert.equal(latiguilloAsignableATirada(cable,{...completa,detalle:{estado:'completo',
    origen:{tipo:'equipo',equipo_id:'otro',puerto_id:'p',ordinal:1},destino:completa.detalle.destino}},new Set()),false);
  assert.equal(latiguilloAsignableATirada(cable,completa,new Set(['k'])),false);
});

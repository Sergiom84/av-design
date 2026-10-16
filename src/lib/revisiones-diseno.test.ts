import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import { readFileSync } from 'node:fs';
import { compararDisenos, serializarDiseno, sentidoComparacionRevisiones, TABLAS_DISENO, type SnapshotDiseno } from './revisiones-diseno';
import { PREFIJO_CABLE } from './tipos';
const vacio=():SnapshotDiseno=>({formato:1,salaId:'sala',sala:{nombre:'Sala',codigo:null,largo_m:8,ancho_m:6,alto_m:3,ruta_por_defecto:'directo'},datos:Object.fromEntries(TABLAS_DISENO.map(g=>[g,[]])) as unknown as SnapshotDiseno['datos'],contexto:{articulos:[],puertos:[],parametros:[],mobiliario:[]}});
describe('historial de diseño y alternativas',()=>{
  it('serializa claves estables y mantiene ausencias distintas de cero',()=>{
    assert.equal(serializarDiseno({b:null,a:1}),serializarDiseno({a:1,b:null}));assert.notEqual(serializarDiseno({x:null}),serializarDiseno({x:0}));
  });
  it('separa posición visual de XYZ, y conserva sus unidades',()=>{
    const a=vacio();a.datos.equipos=[{id:'e',nombre:'Matriz',cantidad:1,x_m:2,y_m:3,z_m:1,esquema_x:0,esquema_y:0}];const b=structuredClone(a);b.datos.equipos[0].esquema_x=500;
    assert.deepEqual(compararDisenos(a,b).cambios.map(c=>[c.grupo,c.campos]),[['presentacion',['esquema_x']]]);
    b.datos.equipos[0].x_m=4;assert.ok(compararDisenos(a,b).cambios.some(c=>c.grupo==='equipos'&&c.campos.includes('x_m')));
  });
  it('muestra altas, bajas, bocas, rutas, medidas y notas',()=>{
    const a=vacio();a.datos.equipos=[{id:'a',nombre:'Retirado'}];a.datos.bocas=[{conexion_id:'c',lado:'origen',ordinal:1}];const b=vacio();b.sala.alto_m=4;b.datos.equipos=[{id:'b',nombre:'Añadido'}];b.datos.puntos=[{id:'p',conexion_id:'c',x_m:2,y_m:3,z_m:1}];b.datos.anotaciones=[{id:'n',texto:'Nota',ancla_tipo:'visual',x:0,y:0}];
    const diff=compararDisenos(a,b);assert.ok(diff.cambios.some(c=>c.grupo==='medidas'));assert.ok(diff.cambios.some(c=>c.id==='a'&&c.estado==='retirado'));assert.ok(diff.cambios.some(c=>c.id==='b'&&c.estado==='añadido'));assert.ok(diff.cambios.some(c=>c.grupo==='bocas'));assert.ok(diff.cambios.some(c=>c.grupo==='puntos'));assert.ok(diff.cambios.some(c=>c.grupo==='anotaciones'));
  });
  it('compara identidades de copias sin llamar añadido a todo su montaje',()=>{
    const a=vacio();a.datos.equipos=[{id:'original',sala_id:'sala',nombre:'Equipo',cantidad:1,dimensiones_tecnicas:null,posicion_confirmada:false,rotacion_grados:90}];const b=structuredClone(a);b.salaId='copia';b.sala.nombre='Alternativa';b.datos.equipos[0].id='nuevo';b.datos.equipos[0].sala_id='copia';
    assert.equal(compararDisenos(a,b,{nuevo:'original'}).cambios.length,0);
  });
  it('los literales constructor y __proto__ no se convierten en identidades',()=>{
    const a=vacio();a.datos.anotaciones=[{id:'nota',texto:'constructor',ancla_tipo:'visual',x:0,y:0}];a.datos.equipos=[{id:'e',nombre:'__proto__'}];assert.equal(compararDisenos(a,structuredClone(a)).cambios.length,0);
  });
  it('ambos órdenes de selección comparan anterior a posterior, con altas y cantidades correctas',()=>{
    const a=vacio();a.datos.equipos=[{id:'e',articulo_id:'articulo',nombre:'Pantalla',cantidad:1}];a.contexto.articulos=[{id:'articulo',modelo:'Pantalla',unidad:'ud'}];
    const b=structuredClone(a);b.datos.equipos[0].cantidad=2;b.datos.anotaciones=[{id:'nota',texto:'Añadida',ancla_tipo:'sala'}];
    const anterior={id:'r1',numero:1};const posterior={id:'r2',numero:2};
    for(const seleccion of [[anterior,posterior],[posterior,anterior]]){
      const sentido=sentidoComparacionRevisiones(seleccion)!;assert.equal(sentido.anterior.id,'r1');assert.equal(sentido.posterior.id,'r2');
      const snapshots={r1:a,r2:b};const diff=compararDisenos(snapshots[sentido.anterior.id as keyof typeof snapshots],snapshots[sentido.posterior.id as keyof typeof snapshots]);
      assert.ok(diff.cambios.some(c=>c.grupo==='anotaciones'&&c.estado==='añadido'));assert.equal(diff.material[0].antes,1);assert.equal(diff.material[0].despues,2);
    }
  });
  it('el contexto de muebles se compara sin cambiar dimensiones congeladas de instancia',()=>{
    const a=vacio();a.contexto.mobiliario=[{id:'cat',nombre:'Silla anterior',largo_m_defecto:0.5}];a.datos.muebles=[{id:'inst',mobiliario_id:'cat',largo_m:0.5}];const b=structuredClone(a);b.contexto.mobiliario[0].nombre='Silla posterior';b.contexto.mobiliario[0].largo_m_defecto=0.7;
    const diff=compararDisenos(a,b);assert.equal(diff.cambios.length,1);assert.equal(diff.cambios[0].grupo,'catalogo_mobiliario');assert.deepEqual(diff.cambios[0].campos,['nombre','largo_m_defecto']);assert.equal(b.datos.muebles[0].largo_m,0.5);
  });
  it('material usa equipos, BOM y cable físico de la fórmula existente',()=>{
    const a=vacio();a.contexto.articulos=[{id:'e',tipo:'equipo',modelo:'Equipo',unidad:'ud'},{id:'cable',tipo:'cable',modelo:'Cable',unidad:'m',longitudes_comerciales_m:null,bobina_m:100}];
    a.datos.equipos=[{id:'e1',articulo_id:'e',nombre:'1',cantidad:1,extremo:'pared',x_m:0,y_m:0,z_m:1},{id:'e2',articulo_id:'e',nombre:'2',cantidad:1,extremo:'pared',x_m:4,y_m:0,z_m:1}];
    a.datos.conexiones=[{id:'c',origen_id:'e1',destino_id:'e2',articulo_cable_id:'cable',senal:'hdmi',ruta:'directo',longitud_manual_m:null}];a.datos.material=[{id:'m',articulo_id:'e',cantidad:2,unidad:'ud'}];const b=structuredClone(a);b.datos.equipos[1].x_m=6;
    const diff=compararDisenos(a,b);assert.equal(diff.material.find(m=>m.articuloId==='e')?.antes,4);const cable=diff.material.find(m=>m.articuloId==='cable')!;assert.ok(cable.antes>0);assert.ok(cable.despues>cable.antes);
  });
  it('prefijos SQL persistidos coinciden con la única tabla de dominio',()=>{
    const sql=readFileSync('db/migraciones/2026-10-e3-revisiones.sql','utf8');
    for(const [senal,prefijo] of Object.entries(PREFIJO_CABLE))assert.ok(senal==='otro'?sql.includes(`else '${prefijo}'`):sql.includes(`when '${senal}' then '${prefijo}'`),`${senal} conserva ${prefijo}`);
  });
});

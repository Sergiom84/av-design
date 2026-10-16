import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { cantidadesMaterial,conciliacionCongelada } from './costes/conciliacion';
import type { SnapshotCorte } from './costes/modelo';
describe('Conciliación congelada05',()=>{
 it('conserva escala y residual exactos sin Number',()=>{assert.deepEqual(cantidadesMaterial('10.00','7.00'),{cantidad:'10.00',repartido:'7.00',pendiente:'3.00'});assert.deepEqual(cantidadesMaterial('9999999999.99','9999999999.98'),{cantidad:'9999999999.99',repartido:'9999999999.98',pendiente:'0.01'});});
 it('recupera sólo exclusiones congeladas antiguas y ausencia como null',()=>{const s={seleccion:{pendientes:[{id:'p',tipo:'salida',cantidad:'10.00'}]},cobertura:{},entrada:{exclusionesMaterial:[{movimientoId:'e',motivo:'Revisión histórica'}]}} as unknown as SnapshotCorte;const r=conciliacionCongelada(s);assert.deepEqual(r.cobertura,{candidatos:2,pendientes:1,excluidos:1});assert.equal(r.exclusiones[0].motivo,'Revisión histórica');assert.equal(r.exclusiones[0].cantidad,null);assert.equal(r.exclusiones[0].unidad,null);assert.equal(r.exclusiones[0].detalleCongelado,false);assert.equal(r.pendientes[0].pendiente,null);});
});

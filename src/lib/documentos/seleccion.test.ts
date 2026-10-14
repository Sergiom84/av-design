import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { permisoExportacion, seleccionDocumentos } from './seleccion';
import { resolverPermisos } from '../usuarios';
const sala='e1000000-0000-4000-8000-000000000010';
const entrada={salaIds:[sala],documentos:['plano'],opciones:{papel:'A4',orientacion:'horizontal',escala:50}};
describe('contrato y permisos de exportación',()=>{
  it('rechaza duplicados, demasiadas salas, ids inválidos y selección ajena a obra',()=>{
    assert.equal(seleccionDocumentos.safeParse(entrada).success,true);
    for(const cambio of [{salaIds:[sala,sala]},{salaIds:['abc']},{salaIds:[sala,'e1000000-0000-4000-8000-000000000011']},
      {documentos:['plano','plano']},{documentos:[]},{opciones:{...entrada.opciones,escala:37}},
      {salaIds:Array(21).fill(sala)}, {filtroSenal:'hdmi'}]) {
      assert.equal(seleccionDocumentos.safeParse({...entrada,...cambio}).success,false);
    }
  });
  it('permiso de lectura basta; material y obra requieren sus secciones',()=>{
    assert.equal(permisoExportacion(resolverPermisos('lectura',{}),['plano'],false),true);
    assert.equal(permisoExportacion(resolverPermisos('lectura',{salas:'oculto'}),['plano'],false),false);
    assert.equal(permisoExportacion(resolverPermisos('lectura',{compras:'oculto'}),['bom-xlsx'],false),false);
    assert.equal(permisoExportacion(resolverPermisos('lectura',{proyectos:'oculto'}),['cables-csv'],true),false);
    assert.equal(permisoExportacion(resolverPermisos('lectura',{proyectos:'oculto'}),['cables-csv'],false),true);
  });
});

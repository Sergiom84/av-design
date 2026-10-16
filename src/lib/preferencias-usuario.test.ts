import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarCatalogo, validarPanel, panelAutorizado, TARJETAS_PANEL } from './preferencias-usuario';
import { resolverPermisos } from './usuarios';
describe('Preferencias personales REA-02',()=>{
  it('rechaza identidad, claves extra, duplicados, HTML y consultas ejecutables',()=>{
    for(const v of [{marcas:['Sony'],usuario_id:'otro'},{marcas:['Sony','Sony']},{marcas:['<b>Sony</b>']},{marcas:['Sony'],q:"'; DROP TABLE articulos;--"},{marcas:Array.from({length:11},(_,i)=>`Marca${i}`)},{tipo:'inventado'}]) assert.throws(()=>validarCatalogo(v));
  });
  it('conserva variantes literales y recorta extremos',()=>assert.deepEqual(validarCatalogo({marcas:[' SONY ','Sony'],q:' QB65R-B ',tipo:'equipo'}),{marcas:['SONY','Sony'],q:'QB65R-B',tipo:'equipo'}));
  it('completa orden sin duplicar y permite ocultar todas las permitidas',()=>{
    const p=validarPanel({orden:['salas'],ocultas:TARJETAS_PANEL.map(t=>t.clave)});
    assert.equal(p.orden[0],'salas');assert.equal(p.orden.length,15);
    assert.throws(()=>validarPanel({orden:['salas','salas']}));assert.throws(()=>validarPanel({ocultas:['inventada']}));
  });
  it('filtra opciones y preferencias por ACL actual',()=>{
    const r=panelAutorizado(validarPanel({orden:['equipos','pedidos','salas'],ocultas:['equipos']}),resolverPermisos('lectura',{catalogo:'oculto',plantillas:'oculto',compras:'oculto',carga:'oculto',proyectos:'oculto'}));
    assert.deepEqual(r.orden,['salas','almacen','reservas','seguimiento_propuestas']);assert.deepEqual(r.ocultas,[]);
  });
});

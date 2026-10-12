import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {leerComposiciones} from './sql-composiciones.mjs';
const texto=readFileSync(new URL('../data/composiciones.csv',import.meta.url),'utf8');
test('Fuente kit distingue tres identidades exactas y cableado pendiente sin inventar artículo',()=>{
 const grupos=leerComposiciones(texto);
 const eq=grupos.find(g=>g.sku==='CS-KIT-EQ-K9');
 assert.ok(eq);assert.equal(eq.version,'1');
 assert.equal(eq.lineas.filter(l=>l.inclusion==='incluido'&&l.componente_modelo).length,3);
 assert.equal(eq.lineas.find(l=>l.clave==='cableado').componente_modelo,'');
 assert.equal(eq.lineas.find(l=>l.clave==='cableado').inclusion,'por_determinar');
});
test('Unidad simple del Table Microphone Pro publica cuerpo y cable unido, sin mutar el EQ',()=>{
 const grupos=leerComposiciones(texto);
 const eq=grupos.find(g=>g.sku==='CS-KIT-EQ-K9');
 const micro=grupos.find(g=>g.sku==='CS-MIC-ARRAY-T');
 assert.ok(eq&&micro);assert.equal(micro.version,'1');
 assert.equal(micro.kit_modelo,'TABLE MICROPHONE PRO');
 assert.equal(micro.lineas.find(l=>l.clave==='cuerpo').componente_modelo,'TABLE MICROPHONE PRO');
 const cable=micro.lineas.find(l=>l.clave==='cable-unido');
 assert.equal(cable.componente_modelo,'');assert.equal(cable.rol,'cable');assert.equal(cable.inclusion,'incluido');
});
test('Composición documentada admite latiguillo incluido sin artículo y rechaza otros pendientes',()=>{
 const mutada=texto.replaceAll('CISCO;TABLE MICROPHONE PRO;CS-MIC-ARRAY-T;1;parcial;','CISCO;TABLE MICROPHONE PRO;CS-MIC-ARRAY-T;1;documentada;');
 const micro=leerComposiciones(mutada).find(g=>g.sku==='CS-MIC-ARRAY-T');
 assert.equal(micro.estado_documental,'documentada');
 assert.equal(micro.lineas.find(l=>l.rol==='cable').componente_modelo,'');
 assert.throws(()=>leerComposiciones(texto.replaceAll(';parcial;',';documentada;')),/pendientes/);
});
test('Fuente de composición rechaza cantidad fraccionaria, evidencia ausente, duplicado y falsa completitud',()=>{
 for(const mutada of [texto.replace(';1;incluido;',';1.5;incluido;'),
  texto.replace('https://www.cisco.com',''),texto+texto.split(/\r?\n/)[1]+'\n',texto.replaceAll(';parcial;',';documentada;')]){
  assert.throws(()=>leerComposiciones(mutada));
 }
});

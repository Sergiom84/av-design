import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarConsulta } from './consultas/intenciones';
import { crearConsultaSchema, preguntarConsultaSchema } from './consultas/modelo';

test('preguntas técnicas del contrato27 producen intenciones y bridas literales', () => {
  for (const [pregunta, intent] of [
    ['¿Qué medidas tiene esta sala?', 'medidas'], ['¿Qué equipos hay?', 'equipos'],
    ['¿Qué conecta HD-1000?', 'conexiones'], ['¿Cuántos metros calcula?', 'cables'],
    ['¿Qué material necesita?', 'necesidad'], ['Buscar pantallas de mis marcas', 'catalogo'],
    ['¿Qué documentos puedo abrir?', 'documentos'], ['Preparar informe de estado actual', 'informe'],
  ]) assert.equal(clasificarConsulta(pregunta).intent, intent, pregunta);
  assert.equal(clasificarConsulta('¿Qué conecta HD-1000?').cableId, 'HD-1000');
  assert.equal(clasificarConsulta('¿Qué conecta un cable sin identificar?').cableId, undefined);
});

test('finanzas, acciones y garantías no se convierten en una lectura técnica', () => {
  for (const pregunta of ['precio de los equipos', 'salarios de los técnicos',
    'beneficio de la obra', 'sustituye los equipos', 'elimina todas las conexiones',
    'recomienda material compatible', 'borra la sala', '¿Qué impuesto tiene el material?',
    '¿Cuánto cuestan los equipos?', '¿Cuánto vale el cable?', 'Dame el presupuesto de material',
    'quita el equipo', 'añade una mesa']) {
    assert.equal(clasificarConsulta(pregunta).intent, 'no_disponible', pregunta);
  }
});

test('texto desconocido o instrucciones SQL conservan abstención explícita', () => {
  for (const pregunta of ['', 'lo anterior', 'SELECT * FROM usuarios', '<script>alert(1)</script>'])
    assert.equal(clasificarConsulta(pregunta).intent, 'no_disponible');
});

test('ámbito y entrada estrictos no aceptan permisos, dueño, duplicados ni toda una obra implícita', () => {
  const obra = 'd9000000-0000-4000-8000-000000000001';
  const sala = 'd9000000-0000-4000-8000-000000000002';
  assert.equal(crearConsultaSchema.parse({ ambito: { tipo: 'sala', id: sala } }).retencionDias, 30);
  for (const ambito of [{ tipo: 'obra', id: obra }, { tipo: 'obra', id: obra, salaIds: [] },
    { tipo: 'obra', id: obra, salaIds: [sala, sala] }, { tipo: 'sala', id: sala, permisos: ['compras'] }])
    assert.equal(crearConsultaSchema.safeParse({ ambito }).success, false);
  assert.equal(crearConsultaSchema.safeParse({ ambito: { tipo: 'catalogo' }, retencionDias: 31 }).success, false);
  const entrada = { pregunta: '¿Qué equipos hay?', version: 0, clavePeticion: obra };
  assert.equal(preguntarConsultaSchema.safeParse({ ...entrada, propietarioId: sala }).success, false);
  assert.equal(preguntarConsultaSchema.safeParse({ ...entrada, pregunta: ' '.repeat(2000) }).success, false);
  assert.equal(preguntarConsultaSchema.safeParse({ ...entrada, pregunta: 'a'.repeat(2001) }).success, false);
});

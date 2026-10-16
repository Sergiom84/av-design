import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolverPermisos } from './usuarios';
import { enlaceResultados } from './seguimiento-propuestas/enlaces-resultados';
import type { Conexion, Identidad } from './seguimiento-propuestas/autorizacion';
const ids = { sala: 'ab000000-0000-4000-8000-000000000001', obra: 'ab000000-0000-4000-8000-000000000002',
  propuesta: 'ab000000-0000-4000-8000-000000000003', revision: 'ab000000-0000-4000-8000-000000000004' };
function identidad(rol: 'admin' | 'lectura'): Identidad {
  return { id: 'ab000000-0000-4000-8000-000000000005', nombre: 'PRUEBA', rol, permisos: resolverPermisos(rol) };
}
test('el enlace financiero no lee jerarquía ni expone ruta a una identidad técnica', async () => {
  const sql = (() => { throw new Error('No se debe consultar la jerarquía.'); }) as unknown as Conexion;
  const r = await enlaceResultados(sql, identidad('lectura'), { id: ids.propuesta }, {
    id: ids.revision, ambito_fuente: { tipo: 'sala', id: ids.sala },
  });
  assert.equal(r, null);
});
test('el enlace conserva revisión exacta y legado; no adopta ni consulta costes', async () => {
  let proyectoId: string | null = ids.obra;
  const consultas: string[] = [];
  const sql = (async (plantilla: TemplateStringsArray, ...valores: unknown[]) => {
    consultas.push(plantilla.join('?')); assert.deepEqual(valores, [ids.sala]);
    return [{ proyecto_id: proyectoId }];
  }) as unknown as Conexion;
  const r = { id: ids.revision, ambito_fuente: { tipo: 'sala' as const, id: ids.sala } };
  const actual = await enlaceResultados(sql, identidad('admin'), { id: ids.propuesta }, r);
  assert.equal(actual?.href, `/proyectos/${ids.obra}/resultados?propuesta=${ids.propuesta}&revision=${ids.revision}`);
  proyectoId = null;
  const legado = await enlaceResultados(sql, identidad('admin'), { id: ids.propuesta }, r);
  assert.ok(legado); assert.equal(legado.disponible, false); assert.equal(legado.href, null);
  assert.equal(consultas.length, 2);
  assert(consultas.every(q => !/\b(?:coste_|tarifa|propuesta_valoraciones|insert|update)\b/iu.test(q)));
});

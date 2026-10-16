import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reorganizarDiagrama, type OperacionDiagrama } from './operaciones-diagrama';
import { ANCHO_BLOQUE, bloquesDelLienzo } from './lienzo-conexiones';
import { identificadoresDeCable } from './cable-schedule';
import type { Conexion, EquipoEnSala, Puerto } from './tipos';

const equipos: EquipoEnSala[] = Array.from({ length: 15 }, (_, i) => ({ id: `e${i}`, sala_id: 's', articulo_id: `a${i}`, nombre: i === 0 ? 'Matriz de 24 bocas' : `Equipo ${i}`, cantidad: 1, extremo: 'mesa', posicion: { x_m: i / 2, y_m: 3, z_m: 1 }, posicion_confirmada: i !== 3, rotacion_grados: i * 10 }));
const puertos: Puerto[] = equipos.flatMap((e, i) => ['entrada', 'salida'].map((sentido, j) => ({ id: `p${i}-${j}`, articulo_id: e.articulo_id, nombre: j ? 'OUT' : 'IN', total: 24, sentido: sentido as Puerto['sentido'], senal: 'hdmi', conector: 'HDMI A', orden: j, notas: null, fuente: 'app' })));
const conexiones: Conexion[] = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, sala_id: 's', origen_id: `e${Math.floor(i / 12)}`, destino_id: `e${Math.floor(i / 12) + 1}`, puerto_origen_id: `p${Math.floor(i / 12)}-1`, puerto_origen_ordinal: i % 12 + 1, puerto_destino_id: `p${Math.floor(i / 12) + 1}-0`, puerto_destino_ordinal: i % 12 + 1, articulo_cable_id: null, senal: 'hdmi', ruta: 'falso_techo', longitud_manual_m: 12, notas: null, creado_en: new Date(2026, 0, 1, 0, i).toISOString() }));
const posiciones = Object.fromEntries(equipos.map(e => [e.id, { x: 20, y: 20 }]));

for (const operacion of ['alinear_izquierda', 'alinear_arriba', 'distribuir_horizontal', 'distribuir_vertical', 'ordenar'] as OperacionDiagrama[]) test(`matriz grande: ${operacion} elimina solapamientos y conserva diseño/conexiones/IDs`, () => {
  const antes = JSON.stringify({ equipos, puertos, conexiones, posiciones });
  const idsAntes = identificadoresDeCable(conexiones);
  const despues = reorganizarDiagrama(equipos, puertos, conexiones, posiciones, equipos.map(e => e.id), operacion);
  assert.deepEqual(despues, reorganizarDiagrama(equipos, puertos, conexiones, posiciones, equipos.map(e => e.id), operacion));
  const bloques = bloquesDelLienzo(equipos, puertos, despues);
  assert.equal(bloques.length, 15);
  assert.ok(bloques[0].bocas.filter(b => b.lado === 'izquierda').length === 24);
  for (let i = 0; i < bloques.length; i++) for (const b of bloques.slice(i + 1)) {
    const a = bloques[i];
    assert.ok(a.x + ANCHO_BLOQUE <= b.x || b.x + ANCHO_BLOQUE <= a.x || a.y + a.alto <= b.y || b.y + b.alto <= a.y, `${a.equipo.id} solapa ${b.equipo.id}`);
  }
  assert.equal(JSON.stringify({ equipos, puertos, conexiones, posiciones }), antes);
  assert.deepEqual(identificadoresDeCable(conexiones), idsAntes);
});

test('una selección parcial conserva los bloques no seleccionados; ninguna operación sustituye XYZ', () => {
  const p = reorganizarDiagrama(equipos, puertos, conexiones, posiciones, ['e0', 'e1'], 'distribuir_horizontal');
  assert.deepEqual(p.e2, posiciones.e2);
  assert.deepEqual(equipos[0].posicion, { x_m: 0, y_m: 3, z_m: 1 });
  assert.equal(equipos[3].posicion_confirmada, false);
});

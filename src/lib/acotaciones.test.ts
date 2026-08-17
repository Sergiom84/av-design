import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { construirAcotaciones } from './acotaciones';
import type { EquipoEnSala, PuertaEnSala, Sala, TomaRed } from './tipos';

const sala = { largo_m: 8, ancho_m: 5, alto_m: 3 } as Sala;
const equipo = (confirmado: boolean): EquipoEnSala => ({
  id: confirmado ? 'medido' : 'estimado', sala_id: 's', articulo_id: 'a',
  nombre: confirmado ? 'Pantalla' : 'Rack', cantidad: 1, extremo: 'pared',
  posicion: { x_m: 6, y_m: 2, z_m: 1.4 }, posicion_confirmada: confirmado,
  rotacion_grados: 0,
});
const toma = { id: 't', sala_id: 's', codigo: 'R-01', ubicacion: 'pared', x_m: 1, y_m: 4, z_m: 0.3, notas: null } as TomaRed;
const puerta = { id: 'p', sala_id: 's', pared: 'sur', posicion_m: 2, anchura_m: .9, altura_m: 2.1, orden: 0 } as PuertaEnSala;

describe('acotaciones de sala', () => {
  it('genera las cuatro elevaciones con las medidas efectivas', () => {
    const escena = construirAcotaciones({ sala, equipos: [], tomas: [], puertas: [] });
    assert.deepEqual(escena.elevaciones.map((v) => [v.pared, v.ancho_m, v.alto_m]), [
      ['sur', 8, 3], ['norte', 8, 3], ['oeste', 5, 3], ['este', 5, 3],
    ]);
  });

  it('proyecta x en frontal y y en laterales sin inventar la altura', () => {
    const escena = construirAcotaciones({ sala, equipos: [equipo(true)], tomas: [toma], puertas: [] });
    assert.deepEqual(escena.elevaciones[0].puntos.map((p) => [p.horizontal_m, p.altura_m]), [[6, 1.4], [1, .3]]);
    assert.deepEqual(escena.elevaciones[2].puntos.map((p) => [p.horizontal_m, p.altura_m]), [[2, 1.4], [4, .3]]);
  });

  it('una posición estimada no se presenta como una cota medida', () => {
    const escena = construirAcotaciones({ sala, equipos: [equipo(false)], tomas: [], puertas: [] });
    assert.equal(escena.equiposSinPosicion, 1);
    assert.ok(escena.elevaciones.every((vista) => vista.puntos.length === 0));
  });

  it('cada puerta aparece únicamente en su pared y conserva Sin medir', () => {
    const sinMedir = { ...puerta, id: 'p2', pared: 'norte' as const, anchura_m: null, altura_m: null };
    const escena = construirAcotaciones({ sala, equipos: [], tomas: [], puertas: [puerta, sinMedir] });
    assert.equal(escena.elevaciones.find((v) => v.pared === 'sur')!.puertas[0].anchura_m, .9);
    assert.equal(escena.elevaciones.find((v) => v.pared === 'norte')!.puertas[0].altura_m, null);
    assert.ok(escena.elevaciones.filter((v) => v.puertas.length).length === 2);
  });
});

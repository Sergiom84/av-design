import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUNTOS_PRUEBA_FINAL, puntosFinales, pruebaCompleta, fechaSeguimiento, exigirOrdenFinal, type PuntoFinal } from './ciclo-vida-seguimiento';
const completos = (): PuntoFinal[] => PUNTOS_PRUEBA_FINAL.map(({ clave }) => ({ clave, resultado: 'conforme', nota: '' }));
test('prueba final exige checklist íntegro y sin duplicados', () => {
  assert.throws(() => puntosFinales([]));
  assert.throws(() => puntosFinales([...completos().slice(1), completos()[1]]));
  assert.throws(() => puntosFinales([...completos(), completos()[0]]));
  assert.equal(pruebaCompleta(completos()), true);
});
test('pendientes e incidencias no acreditan completitud', () => {
  for (const resultado of ['pendiente', 'incidencia'] as const) {
    const puntos = completos(); puntos[0] = { ...puntos[0], resultado, nota: 'Falta HDMI' };
    assert.equal(pruebaCompleta(puntos), false);
  }
  assert.equal(pruebaCompleta(completos().map((p) => ({ ...p, resultado: 'no_aplica', nota: 'Sin equipo' }))), false);
});
test('incidencias y no aplica se justifican sin inventar datos', () => {
  for (const resultado of ['incidencia', 'no_aplica'] as const) {
    const puntos = completos(); puntos[0].resultado = resultado;
    assert.throws(() => puntosFinales(puntos));
    puntos[0].nota = 'No hay pantalla';
    assert.equal(puntosFinales(puntos)[0].nota, 'No hay pantalla');
  }
});
test('fechas reales y orden instalación, prueba, entrega', () => {
  for (const fecha of ['2026-02-30', '', '2026-13-01', 'ayer']) assert.throws(() => fechaSeguimiento(fecha));
  assert.equal(fechaSeguimiento('2028-02-29'), '2028-02-29');
  assert.throws(() => exigirOrdenFinal(null, null, '2026-09-08'));
  assert.throws(() => exigirOrdenFinal('2026-09-08', null, '2026-09-07'));
  assert.throws(() => exigirOrdenFinal('2026-09-08', null, '2026-09-08', true));
  assert.throws(() => exigirOrdenFinal('2026-09-07', '2026-09-09', '2026-09-08', true));
  assert.doesNotThrow(() => exigirOrdenFinal('2026-09-08', '2026-09-08', '2026-09-08', true));
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorIntervaloReal, rangoTrabajoMadrid, repartirMinutosMadrid, validarIntervaloReal, type HoraTrabajo } from './tiempos/fechas';

const ahora = new Date('2026-11-01T12:00:00Z');
const hora = (fecha: string, reloj: string, offset?: string): HoraTrabajo => ({ fecha, hora: reloj, ...(offset ? { offset } : {}) });
const intervalo = (inicio: HoraTrabajo, fin: HoraTrabajo) => validarIntervaloReal({ inicio, fin }, ahora);

describe('Tiempos reales: instantes y días civiles de Madrid', () => {
  it('propaga las alternativas de la hora ambigua al dominio de tiempos', () => {
    assert.throws(() => intervalo(hora('2026-10-25', '02:30'), hora('2026-10-25', '04:00')), (error: unknown) => {
      assert.ok(error instanceof ErrorIntervaloReal);
      assert.equal(error.codigo, 'HORA_AMBIGUA');
      assert.equal(error.status, 422);
      assert.deepEqual(error.detalles, { alternativas: [
        { instante: '2026-10-25T00:30:00.000Z', offset: '+02:00' },
        { instante: '2026-10-25T01:30:00.000Z', offset: '+01:00' },
      ] });
      return true;
    });
  });

  it('rechaza gap de primavera y offset incompatible sin inventar minutos', () => {
    for (const [inicio, codigo] of [
      [hora('2026-03-29', '02:30'), 'HORA_INEXISTENTE'],
      [hora('2026-10-15', '09:00', '+01:00'), 'OFFSET_INVALIDO'],
    ] as const) {
      assert.throws(() => intervalo(inicio, hora('2026-10-15', '10:00')), (e: unknown) => e instanceof ErrorIntervaloReal && e.codigo === codigo);
    }
  });

  it('calcula minutos reales entre las dos apariciones de la misma hora', () => {
    const r = intervalo(hora('2026-10-25', '02:30', '+02:00'), hora('2026-10-25', '02:30', '+01:00'));
    assert.equal(r.minutos, 60);
    assert.equal(r.inicioUtc, '2026-10-25T00:30:00.000Z');
    assert.equal(r.finUtc, '2026-10-25T01:30:00.000Z');
    assert.equal(r.zona, 'Europe/Madrid');
  });

  it('acepta un minuto y 24 horas reales; rechaza cero, negativos y 24 horas más un minuto', () => {
    assert.equal(intervalo(hora('2026-10-15', '09:00'), hora('2026-10-15', '09:01')).minutos, 1);
    assert.equal(intervalo(hora('2026-10-15', '09:00'), hora('2026-10-16', '09:00')).minutos, 1440);
    for (const fin of [hora('2026-10-15', '09:00'), hora('2026-10-15', '08:59'), hora('2026-10-16', '09:01')]) {
      assert.throws(() => intervalo(hora('2026-10-15', '09:00'), fin), /posterior/);
    }
  });

  it('el límite de 24 horas se mide por UTC también durante DST', () => {
    assert.equal(intervalo(hora('2026-03-29', '00:00'), hora('2026-03-30', '00:00')).minutos, 1380);
    assert.throws(() => intervalo(hora('2026-10-25', '00:00'), hora('2026-10-26', '00:00')), /24 horas/);
    assert.equal(intervalo(hora('2026-10-25', '01:00'), hora('2026-10-26', '00:00')).minutos, 1440);
  });

  it('usa el reloj recibido: permite igualdad y rechaza el futuro', () => {
    const entrada = { inicio: hora('2026-10-15', '09:00'), fin: hora('2026-10-15', '10:00') };
    assert.equal(validarIntervaloReal(entrada, new Date('2026-10-15T08:00:00Z')).minutos, 60);
    assert.throws(() => validarIntervaloReal(entrada, new Date('2026-10-15T07:59:59Z')), /futuro/);
    assert.throws(() => validarIntervaloReal(entrada, new Date('invalid')), /reloj válido/);
    const r = validarIntervaloReal(entrada, ahora);
    entrada.inicio.hora = '08:00';
    assert.equal(r.entradaLocal.inicio.hora, '09:00');
  });

  it('rechaza fechas vacías o inexistentes y precisión de segundos', () => {
    for (const inicio of [hora('', ''), hora('2026-02-30', '09:00'), hora('2026-10-15', '09:00:30'), null as unknown as HoraTrabajo]) {
      assert.throws(() => intervalo(inicio, hora('2026-10-15', '10:00')), ErrorIntervaloReal);
    }
  });

  it('reparte minutos sin duplicar la medianoche ni perder extremos contiguos', () => {
    const dias = repartirMinutosMadrid('2026-10-15T21:30:00Z', '2026-10-15T22:45:00.000Z');
    assert.deepEqual(dias.map(d => [d.fecha, d.minutos]), [['2026-10-15', 30], ['2026-10-16', 45]]);
    assert.equal(dias[0].finUtc, dias[1].inicioUtc);
    assert.deepEqual(repartirMinutosMadrid('2026-10-15T21:30:00Z', '2026-10-15T22:00:00Z').map(d => [d.fecha, d.minutos]), [['2026-10-15', 30]]);
  });

  it('resumen y rango inclusivo conservan los días DST de 23 y 25 horas', () => {
    for (const [fecha, minutos] of [['2026-03-29', 1380], ['2026-10-25', 1500]] as const) {
      const r = rangoTrabajoMadrid(fecha, fecha);
      const dias = repartirMinutosMadrid(r.inicioUtc, r.finUtcExclusivo);
      assert.deepEqual(dias.map(d => [d.fecha, d.minutos]), [[fecha, minutos]]);
      assert.equal(dias.reduce((total, d) => total + d.minutos, 0), (Date.parse(r.finUtcExclusivo) - Date.parse(r.inicioUtc)) / 60000);
    }
  });

  it('compone 366 días civiles aunque duren una hora más y conserva el año bisiesto', () => {
    for (const [desde, hasta, minutos] of [
      ['2024-10-27', '2025-10-27', 527100],
      ['2025-10-26', '2026-10-26', 527100],
      ['2024-01-01', '2024-12-31', 527040],
    ] as const) {
      const r = rangoTrabajoMadrid(desde, hasta);
      const dias = repartirMinutosMadrid(r.inicioUtc, r.finUtcExclusivo);
      assert.equal(dias.length, 366);
      assert.equal(dias[0].fecha, desde);
      assert.equal(dias.at(-1)?.fecha, hasta);
      assert.equal(dias.reduce((total, d) => total + d.minutos, 0), minutos);
    }
    assert.throws(() => repartirMinutosMadrid('2026-01-01T12:00:00Z', '2027-01-02T11:00:00Z'), ErrorIntervaloReal);
  });

  it('rechaza UTC normalizado de fecha imposible, segundos y rango vacío o excesivo', () => {
    for (const [inicio, fin] of [
      ['2026-02-30T00:00:00Z', '2026-03-03T00:00:00Z'],
      ['2026-10-15T00:00:01Z', '2026-10-15T01:00:00Z'],
      ['2026-10-15T00:00:00Z', '2026-10-15T00:00:00Z'],
      ['2026-01-01T00:00:00Z', '2027-01-03T00:00:00Z'],
    ]) assert.throws(() => repartirMinutosMadrid(inicio, fin), ErrorIntervaloReal);
    assert.throws(() => rangoTrabajoMadrid('2026-10-16', '2026-10-15'), ErrorIntervaloReal);
    assert.throws(() => rangoTrabajoMadrid('2026-01-01', '2027-01-02'), ErrorIntervaloReal);
    assert.throws(() => rangoTrabajoMadrid('2026-02-30', '2026-03-01'), ErrorIntervaloReal);
    assert.equal(rangoTrabajoMadrid('2026-01-01', '2026-12-31').hasta, '2026-12-31');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { transicion, derivarEstado } from './seguimiento-propuestas/estados';
import { ratio, compararRatios, resolverFiltros, rango, crearToken, verificarToken, manifiesto, huellaConjunto } from './seguimiento-propuestas/cohorte';
import { hash, type Evento, type Filtros, type Miembro } from './seguimiento-propuestas/modelo';
import { agregarMonedas } from './seguimiento-propuestas/monedas';
import { calcularValoracion } from './propuestas/valoracion';
import type { LineaFuente, LineaValoracion } from './propuestas/modelo';
const id = randomUUID(), revision = randomUUID(), huella = 'a'.repeat(64), secreto = 'rea07-secreto-sintetico-solo-test-local', ahora = Date.parse('2026-10-15T12:00:00Z');
const filtros: Filtros = { desde: '2026-10-01', hasta: '2026-10-31', observadoEn: new Date(ahora).toISOString(), archivo: 'todas', ambito: { tipo: 'seleccion', ids: [id] }, importes: false };
const miembro: Miembro = { propuestaId: id, revisionId: revision, revisionHash: huella, numeroRevision: 1, titulo: 'Técnica', publicadaEn: new Date(ahora).toISOString(), primeraPublicacionEn: new Date(ahora).toISOString(), publicacionOperacionId: randomUUID(), ultimoEventoId: null, numeroEvento: 0, archivoAlCorte: false, estado: 'borrador' };
function evento(tipo: Evento['tipo'], numero: number, anterior: Evento | null = null): Evento { return { id: randomUUID(), propuestaId: id, revisionId: revision, revisionHash: huella, numero, antecedenteId: anterior?.id ?? null, tipo, decisionRevocadaId: tipo === 'revocar_decision' ? anterior!.id : null, motivo: 'Revisión interna de prueba', referencia: 'Acta local', autorId: randomUUID(), autor: 'Técnica prueba', creadoEn: new Date(ahora).toISOString() }; }
describe('REA07 · decisiones internas por revisión', () => {
    it('estado vacío es Borrador y no hereda hechos', () => assert.equal(derivarEstado([]), 'borrador'));
    it('únicas transiciones emitida/decisión/revocación', () => { const a = evento('emitir', 1), b = evento('aceptar', 2, a), c = evento('revocar_decision', 3, b), d = evento('rechazar', 4, c); assert.equal(derivarEstado([a, b, c, d]), 'rechazada'); });
    it('rechaza decisión sin emisión y ramas directas', () => { for (const e of ['aceptar', 'rechazar', 'revocar_decision'] as const) assert.throws(() => transicion('borrador', e), { status: 409 }); assert.throws(() => transicion('aceptada', 'rechazar'), { status: 409 }); assert.throws(() => transicion('emitida', 'emitir'), { status: 409 }); });
    it('historia exige número, hash, identidad y antecedente exactos', () => { const a = evento('emitir', 1), b = evento('aceptar', 2, a); for (const x of [{ ...b, numero: 3 }, { ...b, antecedenteId: randomUUID() }, { ...b, revisionHash: 'b'.repeat(64) }, { ...b, revisionId: randomUUID() }]) assert.throws(() => derivarEstado([a, x]), { status: 503 }); });
    it('revoca sólo decisión vigente', () => { const a = evento('emitir', 1), b = evento('aceptar', 2, a), c = evento('revocar_decision', 3, b); assert.throws(() => derivarEstado([a, b, { ...c, decisionRevocadaId: a.id }]), { status: 503 }); });
});
describe('REA07 · cohortes y fracciones exactas', () => {
    it('1/3=33.33,0/3=0.00,0/0=null', () => { assert.deepEqual(ratio(1, 3), { numerador: 1, denominador: 3, fraccion: '1/3', porcentaje: '33.33' }); assert.equal(ratio(0, 3).porcentaje, '0.00'); assert.equal(ratio(0, 0).porcentaje, null); });
    it('redondea HALF_UP con enteros', () => { assert.equal(ratio(1, 32).porcentaje, '3.13'); assert.equal(compararRatios(ratio(1, 3), ratio(1, 2)), '-16.67'); assert.equal(compararRatios(ratio(0, 0), ratio(1, 2)), null); });
    it('Madrid incluye días de23 y25horas y frontera exacta', () => { const primavera = rango(resolverFiltros({ ...filtros, desde: '2026-03-29', hasta: '2026-03-29' })), otono = rango(resolverFiltros({ ...filtros, desde: '2026-10-25', hasta: '2026-10-25' })); if (primavera.modo === 'rango' && otono.modo === 'rango') { assert.equal(Date.parse(primavera.hastaUtcExclusivo) - Date.parse(primavera.desdeUtc), 23 * 3600000); assert.equal(Date.parse(otono.hastaUtcExclusivo) - Date.parse(otono.desdeUtc), 25 * 3600000); } });
    it('rechaza rango>366 y fechas imposibles', () => { assert.throws(() => resolverFiltros({ ...filtros, desde: '2025-01-01', hasta: '2026-01-02' })); assert.throws(() => resolverFiltros({ ...filtros, desde: '2026-02-30' })); });
    it('token liga fechas y manifiesto del período comparado, incluso si el principal queda vacío', () => {
        const comparacion = { desde: '2026-09-01', hasta: '2026-09-30', manifiestoHash: hash(manifiesto([miembro])) };
        const token = crearToken({ comparacion, modelo: 1, usuarioId: id, filtros, manifiestoHash: huellaConjunto([], comparacion), permisosHash: huella, creadoEn: ahora }, secreto);
        assert.ok(verificarToken(token, id, filtros, [], huella, secreto, ahora, comparacion));
        for (const cambio of [null, { ...comparacion, desde: '2026-08-01' }, { ...comparacion, hasta: '2026-09-29' }, { ...comparacion, manifiestoHash: hash(manifiesto([{ ...miembro, ultimoEventoId: randomUUID(), numeroEvento: 1 }])) }]) assert.throws(() => verificarToken(token, id, filtros, [], huella, secreto, ahora, cambio), { status: 409 });
        const sinComparacion = crearToken({ comparacion: null, modelo: 1, usuarioId: id, filtros, manifiestoHash: huellaConjunto([], null), permisosHash: huella, creadoEn: ahora }, secreto);
        assert.throws(() => verificarToken(sinComparacion, id, filtros, [], huella, secreto, ahora, comparacion), { status: 409 });
    });
    it('firma conjunto/usuario/filtros/permisos y caduca a10min', () => { const ms = [miembro], token = crearToken({ comparacion: null, modelo: 1, usuarioId: id, filtros, manifiestoHash: hash(manifiesto(ms)), permisosHash: huella, creadoEn: ahora }, secreto); assert.ok(verificarToken(token, id, filtros, ms, huella, secreto, ahora)); assert.throws(() => verificarToken(token, id, filtros, [], huella, secreto, ahora), { status: 409 }); assert.throws(() => verificarToken(token, randomUUID(), filtros, ms, huella, secreto, ahora), { status: 403 }); assert.throws(() => verificarToken(token, id, filtros, ms, 'b'.repeat(64), secreto, ahora), { status: 403 }); assert.throws(() => verificarToken(token, id, filtros, ms, huella, secreto, ahora + 600001), { status: 409 }); assert.throws(() => verificarToken(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), id, filtros, ms, huella, secreto, ahora), { status: 409 }); });
});
describe('REA07 · bases/impuestos/brutos congelados por moneda', () => {
    const l = (clave: string): LineaFuente => ({ clave, articuloId: null, descripcion: clave, cantidad: '1', unidad: 'ud', detalles: [], origen: 'manual', enlace: '' });
    const v = (clave: string, precio: string | null, moneda: 'EUR' | 'USD' = 'EUR'): LineaValoracion => ({ clave, moneda, coste: null, origenCoste: null, regla: 'directo', precio, motivoPrecio: precio === null ? null : 'Fuente documental', porcentaje: null, impuesto: { tipo: 'sin_configurar' } });
    it('EUR100+parcial20=120; USD50 separado, técnica sinimporte', () => { const valores = new Map([[revision, calcularValoracion([l('a'), l('b'), l('c'), l('d')], [v('a', '100'), v('b', '20'), v('c', null), v('d', '50', 'USD')])]]); const r = agregarMonedas([miembro, { ...miembro, propuestaId: randomUUID(), revisionId: randomUUID() }], valores).borrador; assert.equal(r.monedas.EUR.base.subtotalMinor, '12000'); assert.equal(r.monedas.EUR.base.parciales, 1); assert.equal(r.monedas.USD.base.subtotalMinor, '5000'); assert.equal(r.monedas.EUR.impuesto.subtotalMinor, null); assert.equal(r.propuestasSinValoracion, 1); });
    it('cero explícito conocido es distinto de ausencia', () => { const valores = new Map([[revision, calcularValoracion([l('a')], [v('a', '0')])]]), r = agregarMonedas([miembro], valores).borrador; assert.equal(r.monedas.EUR.base.subtotalMinor, '0'); assert.equal(r.monedas.EUR.base.completas, 1); assert.equal(r.monedas.EUR.bruto.subtotalMinor, null); assert.deepEqual(agregarMonedas([], new Map()).aceptada.monedas, {}); });
});

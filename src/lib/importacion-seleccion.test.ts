import { revisarDecisionesBom } from './importacion/revision';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seleccionarCoincidenciasValidas, validarSeleccion, serializarCanonico } from './importacion/seleccion';
import type { PreviewImportacion, FilaImportacion, CandidatoImportacion } from './importacion/modelo';

const id = (n: number) => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const candidato = (n: number, cambios: Partial<CandidatoImportacion> = {}): CandidatoImportacion => ({ id: id(n), etiqueta: `Equipo ${n}`, categoria: 'Pantalla', tipo: 'equipo', unidad: 'ud', activo: true, revision: 1, ...cambios });
const fila = (n: number, c = [candidato(n)]): FilaImportacion => ({ fila: n, datos: { referencia: `REF-${n}`, unidad: 'ud', cantidad: '3' }, candidatos: c, estado: c.length === 1 ? 'coincidencia' : c.length ? 'ambigua' : 'no_encontrada', errores: [], avisos: [] });
const preview = (filas: FilaImportacion[]): PreviewImportacion => ({ filas, destino: 'bom' } as PreviewImportacion);

describe('selección masiva inequívoca', () => {
  it('500 filas selecciona 400 y omite ambiguas, ausencias, errores y todos los duplicados', () => {
    const filas = Array.from({ length: 400 }, (_, i) => fila(i + 1));
    filas.push(...Array.from({ length: 20 }, (_, i) => fila(401 + i, [candidato(501 + i), candidato(601 + i)])));
    filas.push(...Array.from({ length: 20 }, (_, i) => fila(421 + i, [])));
    filas.push(...Array.from({ length: 20 }, (_, i) => ({ ...fila(441 + i), estado: 'rechazada' as const, errores: ['Cantidad inválida'] })));
    filas.push(...Array.from({ length: 40 }, (_, i) => fila(461 + i, [candidato(800 + Math.floor(i / 2))])));
    const r = seleccionarCoincidenciasValidas(preview(filas), {});
    assert.equal(r.agregadas, 400); assert.equal(Object.keys(r.seleccion).length, 400);
    assert.equal(Object.values(r.omitidas).reduce((a, b) => a + b, 0), 100);
  });
  it('no pisa alternativa manual ni añade otra fila para su destino; precios separa presupuestos', () => {
    const actual = { 1: { fila: 1, articuloId: id(2), alternativa: { motivo: 'Sustituir', articuloOriginalId: id(1), tipoOrigen: 'equipo' as const, fuenteTipo: 'catalogo' as const } } };
    const r = seleccionarCoincidenciasValidas(preview([fila(1), fila(2)]), actual);
    assert.deepEqual(r.seleccion, actual); assert.equal(r.agregadas, 0);
    const vista = preview([fila(1), fila(2, [candidato(1)])]); vista.destino = 'precios';
    vista.filas.forEach((f, i) => { f.datos.presupuesto = `OFERTA-${i}`; });
    assert.equal(seleccionarCoincidenciasValidas(vista, {}).agregadas, 2);
  });
  it('la revisión cero del catálogo recién creado es una revisión conocida', () => {
    const r = seleccionarCoincidenciasValidas(preview([fila(1, [candidato(1, { revision: 0 })])]), {});
    assert.equal(r.agregadas, 1); assert.equal(r.seleccion[1].revisionArticulo, 0);
  });
});

describe('decisiones BOM normalizadas', () => {
  it('sustitución exacta conserva original y cantidad y obtiene destino canónico', () => {
    const vista = preview([fila(1)]);
    const r = revisarDecisionesBom(vista, [{ fila: 1, articuloId: id(2), alternativa: { motivo: '  Sustituir por disponibilidad  ', articuloOriginalId: id(1), tipoOrigen: 'equipo', fuenteTipo: 'catalogo' } }], [candidato(1), candidato(2)]);
    assert.equal(r[0].seleccion.alternativa?.motivo, 'Sustituir por disponibilidad');
    assert.equal(r[0].original?.id, id(1)); assert.equal(r[0].destino.id, id(2));
    assert.equal(r[0].seleccion.revisionArticulo, 1); assert.equal(r[0].cantidad, 3);
  });
  it('rechaza tipo/unidad/inactivo, motivo vacío, origen ambiguo y sustitución en precios', () => {
    const alt = { motivo: 'Cambio', articuloOriginalId: id(1), tipoOrigen: 'equipo' as const, fuenteTipo: 'catalogo' as const };
    for (const cambio of [{ tipo: 'consumible' as const }, { unidad: 'm' as const }, { activo: false }]) {
      assert.throws(() => revisarDecisionesBom(preview([fila(1)]), [{ fila: 1, articuloId: id(2), alternativa: alt }], [candidato(1), candidato(2, cambio)]), /tipo|unidad|activ/i);
    }
    assert.throws(() => validarSeleccion([{ fila: 1, articuloId: id(2), alternativa: { ...alt, motivo: '' } }], 'bom'), /selecci|motivo/i);
    assert.throws(() => validarSeleccion([{ fila: 1, articuloId: id(2), alternativa: alt }], 'precios'), /BOM/i);
    assert.throws(() => validarSeleccion([{ fila: 1, articuloId: id(2), cantidad: 8 }], 'bom'), /selecci/i);
    assert.throws(() => revisarDecisionesBom(preview([fila(1, [candidato(1), candidato(3)])]), [{ fila: 1, articuloId: id(2), alternativa: { ...alt, articuloOriginalId: null } }], [candidato(1), candidato(2), candidato(3)]), /original/i);
  });
  it('resolución sin original exige tipo humano si falta en el archivo y revisión obligatoria al confirmar', () => {
    const vista = preview([fila(1, [])]); vista.filas[0].datos = { referencia: 'Desconocido', unidad: 'm', cantidad: '12,75' };
    const s = { fila: 1, articuloId: id(2), alternativa: { motivo: 'Referencia equivalente', articuloOriginalId: null, tipoOrigen: 'cable' as const, fuenteTipo: 'confirmado_por_usuario' as const } };
    const r = revisarDecisionesBom(vista, [s], [candidato(2, { tipo: 'cable', unidad: 'm' })]);
    assert.equal(r[0].cantidad, 12.75); assert.equal(r[0].fuenteTipo, 'confirmado_por_usuario');
    assert.throws(() => revisarDecisionesBom(vista, [s], [candidato(2, { tipo: 'cable', unidad: 'm' })], true), /revisi/i);
    assert.throws(() => revisarDecisionesBom(vista, [{ ...s, revisionArticulo: 1 }], [candidato(2, { tipo: 'cable', unidad: 'm', revision: 3 })], true), /modific|revisi/i);
    assert.equal(serializarCanonico({ b: 2, a: [3] }), serializarCanonico({ a: [3], b: 2 }));
  });
});

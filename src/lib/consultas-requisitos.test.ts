import test from 'node:test';
import assert from 'node:assert/strict';
import { fuenteElegidaSchema, fuenteConsultaSchema, respuestaConsultaSchema } from './consultas/modelo';
const id = 'b1100000-0000-4000-8000-000000000001';
const extraccionId = 'b1100000-0000-4000-8000-000000000002';
const candidatoId = 'b1100000-0000-4000-8000-000000000003';
const seleccion = { tipo: 'documento_requisitos', id, extraccionId, candidatoIds: [candidatoId] };
test('la fuente10 exige una selección explícita acotada sin texto, SQL ni ámbito prestado', () => {
    assert(fuenteElegidaSchema.safeParse(seleccion).success);
    for (const delta of [{ candidatoIds: [] }, { candidatoIds: [candidatoId, candidatoId] }, { candidatoIds: Array(21).fill(candidatoId) }, { extraccionId: undefined }, { fragmento: 'Contenido privado' }, { proyectoId: id }])
        assert(!fuenteElegidaSchema.safeParse({ ...seleccion, ...delta }).success);
    assert(fuenteElegidaSchema.safeParse({ tipo: 'documento_e1', id }).success);
});
test('historial10 conserva anclas cerradas y cita; los metadatos no admiten snippets', () => {
    const ancla = { documentoId: id, extraccionId, pagina: 1, linea: null, inicio: 0, fin: 10, sha256: 'a'.repeat(64), metodo: 'literal_estructurado' };
    const fuente = { ...seleccion, ambito: { tipo: 'obra', id, salaIds: [candidatoId] }, hash: 'b'.repeat(64), secciones: ['proyectos', 'salas', 'compras'], version: 0, anclasDocumento: [ancla] };
    assert(fuenteConsultaSchema.safeParse(fuente).success);
    assert(!fuenteConsultaSchema.safeParse({ ...fuente, anclasDocumento: [{ ...ancla, fragmento: 'Privado' }] }).success);
    const respuesta = { versionModelo: 1, motor: 'local-1', intent: 'documentos', ambito: fuente.ambito, observadoEn: '2026-10-16T00:00:00.000Z', texto: 'Fragmentos seleccionados', hechos: [{ etiqueta: 'Página 1', valor: 'Sala: Alfa', fuenteId: id, campo: `extraccion:${extraccionId}.candidato:${candidatoId}`, anclaDocumento: ancla }], avisos: [], citas: [{ fuente, href: `/proyectos/${id}/requisitos?documento=${id}`, observadoEn: '2026-10-16T00:00:00.000Z' }], enlaces: [] };
    assert(respuestaConsultaSchema.safeParse(respuesta).success);
});

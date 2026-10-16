import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { montar, esperar, pulsar } from '@/pruebas/dom';
import { calcularValoracion } from '@/lib/propuestas/valoracion';
import { prepararRefresco } from '@/lib/propuestas/refresco';
import type { EntradaPropuesta, ModeloPropuesta } from '@/lib/propuestas/modelo';
import { EditorPropuestas } from './editor';

for (const caso of ['revision', 'tardia'] as const) test(`Integridad de valoración: ${caso}`, async () => {
    const id = (n: number) => `c6000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const linea = { clave: 'equipo:estable', articuloId: id(9), descripcion: 'Pantalla', cantidad: '1.00', unidad: 'ud', detalles: [], origen: 'equipo', enlace: '' };
    const entrada: EntradaPropuesta = { ambito: { tipo: 'sala', id: id(1) }, titulo: 'Guardada', fuente: { tipo: 'diseno', revisiones: [{ salaId: id(1), revisionId: id(2) }] }, aceptoHistorica: true, secciones: [], destinatario: null, plantilla: null, incluidas: null, conceptos: [], valoracion: [{ clave: linea.clave, moneda: 'EUR', coste: '100', origenCoste: { tipo: 'manual', motivo: 'Revisado' }, regla: 'margen', precio: null, motivoPrecio: null, porcentaje: '20', impuesto: { tipo: 'no_aplica', motivo: 'Caso sintético' } }] };
    const modelo: ModeloPropuesta = { id: id(3), numero: 1, creadoEn: '2026-10-15T12:00:00.000Z', autorId: id(5), autor: 'Prueba', tecnico: { titulo: entrada.titulo, secciones: [], destinatario: null, plantilla: null, plantillaSnapshot: null, lineas: [linea], excluidas: 0, variables: {} }, fuente: { tipo: 'diseno', leidaEn: '2026-10-15T12:00:00.000Z', etiqueta: 'Diseño', ambito: entrada.ambito, nombre: 'Sala', codigo: null, salas: [{ id: id(1), nombre: 'Sala', codigo: null, disenoVersion: 1, revisionId: id(2), revisionHash: 'a'.repeat(64), revisionNumero: 1 }], lineas: [linea], avisos: [], comprobacion: 'a'.repeat(64) }, valoracion: calcularValoracion([linea], entrada.valoracion!), fuenteHash: 'a'.repeat(64), tecnicoHash: 'b'.repeat(64), sha256: 'c'.repeat(64) };
    let retener = false; let soltar: (() => void) | null = null;
    const contexto = { salas: [{ id: id(1), nombre: 'Sala', codigo: null }], seleccionadas: [], pagina: 0, hayMas: false, revisiones: [{ id: id(2), sala_id: id(1), numero: 1, nombre: 'Diseño' }, { id: id(7), sala_id: id(1), numero: 2, nombre: 'Diseño nuevo' }], puedeEditar: true, puedeValorar: true, puedeVerValoracion: true, puedeCatalogo: true, puedeBom: true, identidad: id(5) };
    const original = globalThis.fetch;
    let aplicada: EntradaPropuesta | null = null;
    globalThis.fetch = async (url, opciones) => {
        const ruta = String(url);
        if (ruta.startsWith('/api/propuestas?')) return Response.json({ contexto, propuestas: [{ id: id(4), titulo: 'Guardada', numero: 1, version: 1, revision_id: modelo.id, archivada_en: null }] });
        if (ruta.endsWith('/revisiones')) return Response.json({ revisiones: [] });
        if (ruta.endsWith('/actualizar-fuente')) {
            const e = JSON.parse(String(opciones?.body)).entrada as EntradaPropuesta;
            const nueva = { ...linea, cantidad: caso === 'revision' ? '2.00' : '1.00' };
            return Response.json({ ...prepararRefresco(e, [linea], [nueva]), modelo: { ...modelo, tecnico: { ...modelo.tecnico, lineas: [nueva] } }, diff: { nuevas: [], retiradas: [], cambiadas: caso === 'revision' ? [nueva] : [] }, fuenteRevisada: 'a'.repeat(64) });
        }
        if (ruta === '/api/propuestas/preparar') {
            aplicada = JSON.parse(String(opciones?.body)).entrada;
            if (retener) await new Promise<void>(r => { soltar = r; });
            return Response.json({ modelo: { ...modelo, id: id(6), numero: 2, tecnico: { ...modelo.tecnico, titulo: aplicada!.titulo } }, previa: {} });
        }
        return Response.json({ cabecera: { version: 1 }, revision: modelo, frescura: { estado: 'actual', motivo: 'Comprobada' } });
    };
    const m = await montar(createElement(EditorPropuestas, { tipo: 'sala', id: id(1) }));
    const boton = (texto: string) => [...m.contenedor.querySelectorAll('button')].find(b => b.textContent === texto)!;
    const coste = () => [...m.contenedor.querySelectorAll('label')].find(l => l.textContent?.startsWith('Coste unitario previsto'))!.querySelector('input')!;
    const pdf = () => [...m.contenedor.querySelectorAll('a')].find(a => a.textContent?.startsWith('Abrir PDF conservado'))!.getAttribute('href');
    try {
        await esperar(10);
        await pulsar(boton('Guardada · revisión 1')); await esperar();
        const conservado = pdf();
        if (caso === 'revision') {
            const revision = [...m.contenedor.querySelectorAll('label')].find(l => l.textContent?.startsWith('Revisión de Sala'))!.querySelector('select')!;
            await act(async () => { revision.value = id(7); revision.dispatchEvent(new m.documento.defaultView!.Event('change', { bubbles: true })); });
            assert.equal(m.contenedor.querySelectorAll('input[inputmode="decimal"]').length > 0, true, 'Cambiar E3 no debe borrar campos monetarios');
            assert.equal(coste().value, '100');
        }
        await pulsar(boton('Actualizar fuente y comparar')); await esperar();
        assert.equal(coste().value, '100');
        assert.equal(boton('Aplicar decisiones y revisar fuente').disabled, true);
        const seleccion = [...m.contenedor.querySelectorAll('label')].find(l => l.textContent?.startsWith('Valoración de Pantalla'))!.querySelector('select')!;
        const elegir = async (valor: string) => { await act(async () => { seleccion.value = valor; seleccion.dispatchEvent(new m.documento.defaultView!.Event('change', { bubbles: true })); }); };
        await elegir('conservar');
        retener = caso === 'tardia';
        await pulsar(boton('Aplicar decisiones y revisar fuente')); await esperar();
        if (caso === 'tardia') {
            assert.equal(typeof soltar, 'function');
            await elegir('vaciar');
            retener = false;
            await act(async () => { (soltar as unknown as () => void)(); }); await esperar();
            assert.equal([...m.contenedor.querySelectorAll('button')].some(b => b.textContent === 'Confirmar revisión y guardar PDF'), false, 'La respuesta anterior no debe crear una confirmación publicable');
            assert.equal(seleccion.value, 'vaciar');
            await pulsar(boton('Aplicar decisiones y revisar fuente')); await esperar();
            assert.equal(coste().value, '');
        } else {
            assert.equal(coste().value, '100');
            assert.equal((aplicada as unknown as EntradaPropuesta).valoracion![0].regla, 'margen');
            assert.equal((aplicada as unknown as EntradaPropuesta).fuente.tipo, 'diseno');
        }
        assert.equal(pdf(), conservado);
    } finally { await m.desmontar(); globalThis.fetch = original; }
});

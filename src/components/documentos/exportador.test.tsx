import React, { act } from 'react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { montar, pulsar, esperar } from '@/pruebas/dom';
import { ExportadorDocumentos } from './exportador';
import type { ManifiestoExportacion } from '@/lib/documentos/modelo';

Object.assign(globalThis, { React });
const salaId = 'e1000000-0000-4000-8000-000000000010';
const viejoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const nuevoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const clave = `av-documentos:${salaId}`;

function manifiesto(id: string, revision: string, parcial = false): ManifiestoExportacion {
  return {
    version: 1, id, revision, creadoEn: '2026-10-14T08:00:00.000Z', caducaEn: '2026-10-14T08:30:00.000Z',
    proyecto: null, salas: [{ id: salaId, nombre: 'Sala', codigo: 'PRUEBA' }],
    opciones: { papel: 'A4', orientacion: 'horizontal', escala: 50 }, documentos: ['plano'],
    archivos: [{ nombre: 'sala-plano.pdf', documento: 'plano', salaId,
      estado: parcial ? 'error' : 'correcto', ...(parcial ? { error: 'Fallo PDF de prueba' } : { bytes: 100, sha256: 'prueba' }) }],
  };
}

/** Orden real: GET al montar, POST termina, después responde el GET pendiente. */
async function conRecuperacionLenta(caso: { parcial?: boolean; caducado?: boolean }) {
  const fetchAnterior = globalThis.fetch;
  const storageAnterior = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const almacen = new Map([[clave, viejoId]]);
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => { almacen.set(k, v); },
    removeItem: (k: string) => { almacen.delete(k); },
  } });
  let responder!: (r: Response) => void;
  globalThis.fetch = async (input, init) => {
    if (String(input) === `/api/documentos/${viejoId}`) return new Promise<Response>(r => { responder = r; });
    if (String(input) === '/api/documentos' && init?.method === 'POST') {
      return new Response(`${JSON.stringify({ tipo: 'fin', manifiesto: manifiesto(nuevoId, 'DOC-NUEVA', caso.parcial) })}\n`);
    }
    throw new Error(`Solicitud inesperada: ${String(input)}`);
  };
  const m = await montar(<ExportadorDocumentos salas={[{ id: salaId, nombre: 'Sala', codigo: 'PRUEBA' }]} puedeBom />);
  try {
    assert.equal(typeof responder, 'function');
    const boton = [...m.contenedor.querySelectorAll('button')].find(b => b.textContent === 'Generar paquete');
    assert.ok(boton);
    await pulsar(boton);
    await esperar();
    assert.ok(m.contenedor.textContent?.includes('DOC-NUEVA'));
    await act(async () => { responder(caso.caducado ? new Response('Caducado', { status: 404 }) : Response.json(manifiesto(viejoId, 'DOC-ANTERIOR'))); });
    await esperar();
    assert.ok(m.contenedor.textContent?.includes('DOC-NUEVA'), 'El GET viejo no sustituye la revisión nueva');
    assert.equal(m.ventana.location.search, `?paquete=${nuevoId}`);
    const enlacesZip = [...m.contenedor.querySelectorAll('a[href*="archivo=paquete.zip"]')];
    assert.ok(enlacesZip[0].getAttribute('href')?.includes(nuevoId));
    if (caso.parcial) {
      assert.ok(m.contenedor.textContent?.includes('Último paquete completo'));
      assert.ok(m.contenedor.textContent?.includes('DOC-ANTERIOR'));
      assert.ok(enlacesZip[1].getAttribute('href')?.includes(viejoId));
      assert.equal(almacen.get(clave), viejoId);
    } else {
      assert.ok(!m.contenedor.textContent?.includes('DOC-ANTERIOR'));
      assert.ok(!m.contenedor.textContent?.includes('ha caducado'));
      assert.equal(almacen.get(clave), nuevoId, 'El GET caducado no borra el identificador del completo nuevo');
    }
  } finally {
    await m.desmontar();
    globalThis.fetch = fetchAnterior;
    if (storageAnterior) Object.defineProperty(globalThis, 'sessionStorage', storageAnterior);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
}

describe('revisión visible y descargas frente a recuperaciones lentas', () => {
  it('el completo nuevo prevalece sobre un GET anterior tardío', () => conRecuperacionLenta({}));
  it('el GET anterior caducado no borra el completo nuevo ni introduce un error', () => conRecuperacionLenta({ caducado: true }));
  it('el parcial nuevo mantiene su revisión y recupera el último completo tardío', () => conRecuperacionLenta({ parcial: true }));
});

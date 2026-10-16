import React, { act } from 'react';
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { montar, esperar, pulsar, escribir } from '@/pruebas/dom';
import { RequisitosObra } from './gestion';
import { EditorPlan } from './plan';
import type { Decisiones, Detalle, Documento, Extraccion, ObraRequisitos, Plan } from './tipos';
import { etiquetaRevision } from './tipos';
Object.assign(globalThis, { React, self: globalThis });
const obra: ObraRequisitos = { id: 'b1000000-0000-4000-8000-000000000001', nombre: 'Obra sintética REA10', salas: [], localizaciones: [{ id: 'b1000000-0000-4000-8000-000000000002', nombre: 'Planta sintética' }] };
function documento(n: number): Documento { return { id: `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`, proyectoId: obra.id, autorId: 'b1000000-0000-4000-8000-000000009999', version: 0, tipo: 'archivo_obra', sha256: 'a'.repeat(64), estado: 'activo', creadoEn: '2026-10-16T09:00:00.000Z', metadatos: { nombre: `Fuente ${n}.pdf`, mime: 'application/pdf', procedencia: 'Fixture propia', tamano: 10, fechaFuente: null, url: null } }; }
const documentos = [documento(10), documento(11)];
function detalle(d: Documento, titulo: string): Detalle { return { documento: d, metadatos: { ...d.metadatos!, nombre: titulo }, extracciones: [], planes: [], aplicaciones: [] }; }
const props = { identidad: 'usuario-real-A', obra, puedeEditar: true, destinos: ['areas_bom'] as const };
const boton = (m: Awaited<ReturnType<typeof montar>>, texto: string) => [...m.contenedor.querySelectorAll('button')].find(b => b.textContent?.includes(texto))!;

it('cambiar de fuente aborta la petición previa e ignora su detalle tardío', async () => {
  const original = globalThis.fetch; const pendientes: Array<{ resolver: (r: Response) => void; signal: AbortSignal | null | undefined }> = [];
  globalThis.fetch = async (url, init) => String(url).includes('?proyectoId=') ? Response.json({ documentos }) : new Promise<Response>(resolver => pendientes.push({ resolver, signal: init?.signal }));
  const m = await montar(<RequisitosObra {...props} destinos={[...props.destinos]} />);
  try {
    await esperar(); await pulsar([...m.contenedor.querySelectorAll('button')].filter(b => b.textContent === 'Abrir fuente')[0]);
    await pulsar([...m.contenedor.querySelectorAll('button')].find(b => b.textContent === 'Abrir fuente')!);
    assert.equal(pendientes.length, 2); assert.equal(pendientes[0].signal?.aborted, true);
    await act(async () => pendientes[1].resolver(Response.json(detalle(documentos[1], 'DETALLE ACTUAL')))); await esperar();
    await act(async () => pendientes[0].resolver(Response.json(detalle(documentos[0], 'DETALLE ANTIGUO PRIVADO')))); await esperar();
    assert.ok(m.contenedor.textContent?.includes('DETALLE ACTUAL')); assert.ok(!m.contenedor.textContent?.includes('DETALLE ANTIGUO PRIVADO'));
  } finally { await m.desmontar(); globalThis.fetch = original; }
});

it('un permiso retirado borra nombres, detalle, texto y formulario privado de la pantalla', async () => {
  const original = globalThis.fetch; let denegar = false;
  globalThis.fetch = async url => String(url).includes('?proyectoId=') ? denegar ? Response.json({ error: 'Sin acceso' }, { status: 403 }) : Response.json({ documentos }) : Response.json(detalle(documentos[0], 'TÍTULO PRIVADO'));
  const m = await montar(<RequisitosObra {...props} destinos={[...props.destinos]} />);
  try {
    await esperar(); await pulsar(boton(m, 'Abrir fuente')); await esperar(); assert.ok(m.contenedor.textContent?.includes('TÍTULO PRIVADO'));
    denegar = true; await pulsar(boton(m, 'Actualizar listado')); await esperar();
    assert.ok(!m.contenedor.textContent?.includes('TÍTULO PRIVADO')); assert.ok(!m.contenedor.textContent?.includes('Fuente 10.pdf'));
    assert.equal(m.contenedor.querySelector('input[type=file]'), null); assert.ok(m.contenedor.textContent?.includes('El acceso ha cambiado'));
  } finally { await m.desmontar(); globalThis.fetch = original; }
});

it('cambiar identidad elimina la selección y una respuesta del usuario anterior no la restaura', async () => {
  const original = globalThis.fetch; let resolver: ((r: Response) => void) | null = null;
  globalThis.fetch = async url => String(url).includes('?proyectoId=') ? Response.json({ documentos }) : new Promise<Response>(r => { resolver = r; });
  const m = await montar(<RequisitosObra {...props} destinos={[...props.destinos]} />);
  try {
    await esperar(); await pulsar(boton(m, 'Abrir fuente'));
    await m.repintar(<RequisitosObra {...props} identidad="usuario-real-B" destinos={[...props.destinos]} />); await esperar();
    await act(async () => resolver!(Response.json(detalle(documentos[0], 'CONTENIDO USUARIO A')))); await esperar();
    assert.ok(!m.contenedor.textContent?.includes('CONTENIDO USUARIO A')); assert.ok(!m.contenedor.textContent?.includes('Fuente seleccionada'));
  } finally { await m.desmontar(); globalThis.fetch = original; }
});

it('un enlace de cita abre sólo su documento después del listado y no extrae ni crea planes automáticamente', async () => {
  const original = globalThis.fetch; const peticiones: Array<{ url: string; metodo: string }> = [];
  globalThis.fetch = async (url, init) => {
    peticiones.push({ url: String(url), metodo: init?.method ?? 'GET' });
    if (String(url).includes('?proyectoId=')) return Response.json({ documentos });
    assert.equal(String(url), `/api/requisitos/${documentos[1].id}`); return Response.json(detalle(documentos[1], 'FUENTE EXACTA DE LA CITA'));
  };
  const m = await montar(<RequisitosObra {...props} destinos={[...props.destinos]} documentoInicial={documentos[1].id} />);
  try {
    await esperar(); assert.ok(m.contenedor.textContent?.includes('FUENTE EXACTA DE LA CITA'));
    assert.deepEqual(peticiones, [{ url: `/api/requisitos?proyectoId=${obra.id}`, metodo: 'GET' }, { url: `/api/requisitos/${documentos[1].id}`, metodo: 'GET' }]);
    assert.ok(!m.contenedor.textContent?.includes('Guardar revisión y preparar preview'));
  } finally { await m.desmontar(); globalThis.fetch = original; }
});

it('dos revalidaciones de la misma fuente publican sólo la respuesta de la petición más reciente', async () => {
  const original = globalThis.fetch; const pendientes: Array<(r: Response) => void> = []; let detalles = 0;
  globalThis.fetch = async url => {
    if (String(url).includes('?proyectoId=')) return Response.json({ documentos });
    if (++detalles === 1) return Response.json(detalle(documentos[0], 'DETALLE INICIAL'));
    return new Promise<Response>(resolver => pendientes.push(resolver));
  };
  const m = await montar(<RequisitosObra {...props} destinos={[...props.destinos]} />);
  try {
    await esperar(); await pulsar(boton(m, 'Abrir fuente')); await esperar();
    await act(async () => { m.ventana.dispatchEvent(new Event('focus')); m.ventana.dispatchEvent(new Event('focus')); });
    assert.equal(pendientes.length, 2);
    await act(async () => pendientes[1](Response.json(detalle(documentos[0], 'REVALIDACIÓN NUEVA')))); await esperar();
    await act(async () => pendientes[0](Response.json(detalle(documentos[0], 'REVALIDACIÓN ANTIGUA')))); await esperar();
    assert.ok(m.contenedor.textContent?.includes('REVALIDACIÓN NUEVA')); assert.ok(!m.contenedor.textContent?.includes('REVALIDACIÓN ANTIGUA'));
  } finally { await m.desmontar(); globalThis.fetch = original; }
});

const candidatoId = 'b1000000-0000-4000-8000-000000000050';
const extraccion: Extraccion = { id: 'b1000000-0000-4000-8000-000000000051', metodo: 'txt_utf8', parser: 'local', parser_version: '1', sha256: 'b'.repeat(64), resultado: { versionModelo: 1, estado: 'con_texto', paginas: [{ numero: null, texto: 'Sala: Alfa' }], avisos: [], candidatos: [{ id: candidatoId, clase: 'area', fragmento: 'Sala: Alfa', original: { sala: 'Alfa' }, ambiguedades: [], ancla: { documentoId: documentos[0].id, extraccionId: 'b1000000-0000-4000-8000-000000000051', pagina: null, linea: 1, inicio: 0, fin: 10, sha256: 'c'.repeat(64), metodo: 'literal_estructurado' } }] } };
const decisiones: Decisiones = { versionModelo: 1, destino: 'areas_bom', areas: [{ candidatoId, accion: 'crear', nombre: 'Alfa revisada', codigo: null, salaId: null, localizacion: { id: obra.localizaciones[0].id, nombreNuevo: null }, medidas: { largo_m: null, ancho_m: null, alto_m: null }, aceptarHomonimo: false, motivo: 'Revisión humana sintética', camposRevisados: ['accion', 'nombre', 'codigo', 'localizacion', 'medidas', 'aceptarHomonimo'] }], material: [], excluidos: [] };
const plan: Plan = { id: 'b1000000-0000-4000-8000-000000000052', extraccion_id: extraccion.id, version: 0, destino: 'areas_bom', estado: 'borrador', decisiones: { datos: decisiones, revisadoPor: 'usuario-real-A' } };

it('preview exige revisión final y abrir una edición invalida inmediatamente la confirmación', async () => {
  let confirmaciones = 0;
  const pedir = async <T,>(url: string): Promise<T> => {
    if (url.endsWith('/preview')) return { token: 'token-sintetico', version: 1, huella: 'd'.repeat(64), diff: { altas: ['Alfa revisada'] } } as T;
    if (url.endsWith('/confirmar')) { confirmaciones++; return { id: 'aplicacion' } as T; }
    return { version: 1 } as T;
  };
  const m = await montar(<EditorPlan plan={plan} extraccion={extraccion} obra={obra} pedir={pedir} actualizar={async () => {}} ocupadoExterior={false} />);
  try {
    await pulsar(boton(m, 'Guardar revisión y preparar preview')); await esperar();
    assert.equal((boton(m, 'Confirmar aplicación') as HTMLButtonElement).disabled, true);
    const revisionFinal = [...m.contenedor.querySelectorAll('label')].find(e => e.textContent === 'He revisado altas, vínculos, omisiones y material adicional')!;
    await pulsar(revisionFinal.querySelector('input')!);
    assert.equal((boton(m, 'Confirmar aplicación') as HTMLButtonElement).disabled, false);
    await pulsar(boton(m, 'Revisar como área')); assert.ok(!m.contenedor.textContent?.includes('Preview antes de aplicar')); assert.equal(confirmaciones, 0);
  } finally { await m.desmontar(); }
});

it('409 y 503 conservan las decisiones locales y la selección revisada', async () => {
  for (const status of [409, 503]) {
    const pedir = async <T,>(): Promise<T> => { throw Object.assign(new Error(`Error sintético ${status}; conserva borrador`), { status }); };
    const m = await montar(<EditorPlan plan={plan} extraccion={extraccion} obra={obra} pedir={pedir} actualizar={async () => {}} ocupadoExterior={false} />);
    try { await pulsar(boton(m, 'Guardar revisión y preparar preview')); await esperar(); assert.ok(m.contenedor.textContent?.includes(`Error sintético ${status}`)); assert.ok(m.contenedor.textContent?.includes('1 candidatos elegidos'));
      await pulsar(boton(m, 'Revisar como área')); assert.equal((m.contenedor.querySelector('input[name=nombre]') as HTMLInputElement).value, 'Alfa revisada');
    } finally { await m.desmontar(); }
  }
});

it('modificar un campo quita su revisión y bloquea volver a incluirlo hasta revisarlo de nuevo', async () => {
  const m = await montar(<EditorPlan plan={plan} extraccion={extraccion} obra={obra} pedir={async <T,>() => ({}) as T} actualizar={async () => {}} ocupadoExterior={false} />);
  try {
    await pulsar(boton(m, 'Revisar como área')); const incluir = boton(m, 'Incluir área revisada') as HTMLButtonElement;
    assert.equal(incluir.disabled, false);
    await escribir(m.contenedor.querySelector('input[name=nombre]')!, 'Alfa con decisión posterior');
    assert.equal(incluir.disabled, true);
    const etiqueta = [...m.contenedor.querySelectorAll('label')].find(e => e.textContent === etiquetaRevision('nombre'))!;
    await pulsar(etiqueta.querySelector('input')!); assert.equal(incluir.disabled, false);
  } finally { await m.desmontar(); }
});

it('excluir sólo cambia el candidato elegido y puede guardarse sin preparar una aplicación vacía', async () => {
  const peticiones: string[] = [];
  const m = await montar(<EditorPlan plan={plan} extraccion={extraccion} obra={obra} pedir={async <T,>(url: string) => { peticiones.push(url); return { version: 1 } as T; }} actualizar={async () => {}} ocupadoExterior={false} />);
  try {
    await pulsar(boton(m, 'Excluir del plan')); assert.ok(m.contenedor.textContent?.includes('Excluido de este plan')); assert.ok(m.contenedor.textContent?.includes('0 candidatos elegidos'));
    await pulsar(boton(m, 'Guardar exclusiones')); await esperar(); assert.deepEqual(peticiones, [`/api/requisitos/planes/${plan.id}`]);
    await pulsar(boton(m, 'Quitar exclusión')); assert.ok(m.contenedor.textContent?.includes('Pendiente, sin seleccionar'));
  } finally { await m.desmontar(); }
});

it('consulta09 requiere elegir fragmentos revisados y editar invalida esa selección', async () => {
  const m = await montar(<EditorPlan plan={plan} extraccion={extraccion} obra={obra} pedir={async <T,>() => ({ version: 1 }) as T} actualizar={async () => {}} ocupadoExterior={false} />);
  try {
    assert.ok(m.contenedor.textContent?.includes('0 de 20 fragmentos elegidos')); assert.equal(m.contenedor.querySelector('a[href*="requisito="]'), null);
    await pulsar(m.contenedor.querySelector('input[data-candidato-consulta]')!);
    const enlace = m.contenedor.querySelector('a[href*="requisito="]')!; const url = new URL(enlace.getAttribute('href')!, 'http://localhost');
    assert.equal(url.searchParams.get('requisito'), documentos[0].id); assert.equal(url.searchParams.get('extraccion'), extraccion.id); assert.equal(url.searchParams.get('candidatos'), candidatoId); assert.equal(url.searchParams.has('salaIds'), false);
    await pulsar(boton(m, 'Revisar como área')); assert.equal(m.contenedor.querySelector('a[href*="requisito="]'), null);
    await pulsar(boton(m, 'Cancelar edición')); assert.ok(m.contenedor.textContent?.includes('0 de 20 fragmentos elegidos'));
  } finally { await m.desmontar(); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { montar, pulsar, esperar, escribir, type Montaje } from '../../pruebas/dom';
import { GestorInformes } from './gestor';
import { Audiencia } from './audiencia';
import { CLAVES, type ConfiguracionInforme, type SnapshotInforme } from '../../lib/informes/modelo';
const id = (n: number) => `e3310000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const configuracion: ConfiguracionInforme = { versionModelo: 1, versionRegistro: 1, clave: 'material_actual', ambito: { tipo: 'sala', id: id(10) }, periodo: { modo: 'actual' }, formatos: ['csv'], audiencia: { usuarios: [], grupos: [] } };
const opciones = [{ tipo: 'sala' as const, id: id(10), nombre: 'Sala anterior' }, { tipo: 'sala' as const, id: id(11), nombre: 'Sala alternativa' }];
const props = { usuarioId: id(1), claves: [...CLAVES], opciones, admin: true };
const definicion = { id: id(20), nombre: 'Definición anterior', version: 0, configuracion, archivada_en: null };
const previa = { hash: 'a'.repeat(64), creadaEn: new Date().toISOString(), ambito: { nombre: 'ÁMBITO ANTERIOR', salas: [{ id: id(10), nombre: 'SALA ANTERIOR', codigo: null }] }, periodo: { modo: 'actual' }, audiencia: [{ usuarioId: id(2), nombre: 'RECEPTOR ANTERIOR', origenes: [{ tipo: 'directo' }] }] };
const ejecucion = { id: id(30), definicion_id: definicion.id, propietario_id: id(1), estado: 'correcta', ocurrencia_utc: new Date().toISOString(), intento_actual: 1, error_codigo: null, error_mensaje: null, caduca_en: new Date(Date.now() + 3600000).toISOString(), revocada_en: null, definicion_snapshot: { ...definicion }, manifiesto: null, snapshot: { definicion: { ...definicion }, observadoEn: new Date().toISOString(), ambito: previa.ambito, periodo: {}, resumen: { importe_necesidad_conocido_eur: 12345 }, columnas: [], filas: [], avisos: [] } as unknown as SnapshotInforme };
const boton = (m: Montaje, texto: string) => { const b = [...m.contenedor.querySelectorAll('button')].find(b => b.textContent === texto); assert.ok(b, texto); return b; };
const texto = (m: Montaje) => m.contenedor.textContent ?? '';
async function enviar(m: Montaje) { await act(async () => { m.contenedor.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); await esperar(); }
interface EstadoServidor {
    estadoEjecucion?: 'fallida' | 'pendiente' | 'correcta';
    paginar?: boolean;
    diferirPagina?: boolean;
    resolverPagina?: (r: Response) => void;
    diferirResultado?: boolean;
    resolverResultado?: (r: Response) => void;
    retirada: boolean;
    config: ConfiguracionInforme;
    diferirPrevia?: boolean;
    resolverPrevia?: (r: Response) => void;
    diferirComparacion?: boolean;
    resolverComparacion?: (r: Response) => void;
    consultas: string[];
}
function servidor(e: EstadoServidor) {
    return async (url: RequestInfo | URL, o?: RequestInit) => {
        const u = String(url);
        e.consultas.push(u);
        const d = { ...definicion, configuracion: e.config };
        const actual = e.estadoEjecucion ? { ...ejecucion, estado: e.estadoEjecucion, snapshot: e.estadoEjecucion === 'correcta' ? ejecucion.snapshot : null } : ejecucion;
        if (u === '/api/informes')
            return Response.json({ definiciones: e.retirada ? [] : [d] });
        if (u === '/api/informes/ejecuciones')
            return Response.json({ ejecuciones: e.retirada ? [] : [actual], ultimosCorrectos: [], cursor: e.paginar ? 'siguiente' : null });
        if (u.startsWith('/api/informes/ejecuciones?cursor='))
            return new Promise<Response>(r => { e.resolverPagina = r; });
        if (u === '/api/informes/runner')
            return Response.json({ estado: 'Sin runner', ultimaPasadaManual: null, cola: { pendientes: 0, en_curso: 0 }, programaciones: [] });
        if (u === '/api/informes/grupos')
            return Response.json({ grupos: [] });
        if (u.endsWith('/programaciones'))
            return Response.json({ programaciones: [] });
        if (u === '/api/informes/vista-previa')
            return e.diferirPrevia ? new Promise<Response>(r => { e.resolverPrevia = r; }) : Response.json(previa);
        if (u === `/api/informes/${d.id}`) {
            if (o?.method === 'PATCH')
                return Response.json({ error: 'Conflicto entre pestañas' }, { status: 409 });
            return e.diferirComparacion ? new Promise<Response>(r => { e.resolverComparacion = r; }) : Response.json({ ...d, nombre: 'COMPARACIÓN ANTERIOR', version: 1 });
        }
        if (u === `/api/informes/ejecuciones/${ejecucion.id}/reintentar` && o?.method === 'POST') {
            e.estadoEjecucion = 'pendiente';
            return Response.json({ id: ejecucion.id }, { status: 202 });
        }
        if (u === `/api/informes/ejecuciones/${ejecucion.id}`)
            return e.diferirResultado ? new Promise<Response>(r => { e.resolverResultado = r; }) : e.retirada ? Response.json({ error: 'Permiso retirado' }, { status: 403 }) : Response.json(actual);
        throw new Error('Ruta no prevista: ' + u);
    };
}
async function preparar(config = configuracion) {
    const e: EstadoServidor = { retirada: false, config, consultas: [] };
    const original = globalThis.fetch;
    globalThis.fetch = servidor(e);
    const m = await montar(createElement(GestorInformes, props));
    await esperar();
    return { e, m, cerrar: async () => { await m.desmontar(); globalThis.fetch = original; } };
}
async function editar(m: Montaje) { await pulsar(boton(m, 'Definición anteriorv0')); await esperar(); }
async function comparar(m: Montaje) { await enviar(m); await pulsar(boton(m, 'Guardar definición revisada')); await esperar(); await pulsar(boton(m, 'Comparar versión guardada')); await esperar(); }
async function seleccionarFallidaYReintentar(m: Montaje, e: EstadoServidor) {
    e.estadoEjecucion = 'fallida';
    await pulsar(boton(m, 'Actualizar estado'));
    await esperar();
    await pulsar(boton(m, 'Definición anterior · fallida'));
    await esperar();
    await pulsar(boton(m, 'Reintentar la misma captura'));
    await esperar();
    assert.ok(m.contenedor.querySelector('[aria-label="Resultado del informe"]')?.textContent?.includes('pendiente'));
}
test('reintentar observa la misma ejecución hasta terminar y detiene las consultas', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        await seleccionarFallidaYReintentar(m, e);
        const consultasAntes = e.consultas.length;
        e.estadoEjecucion = 'correcta';
        await esperar(2200);
        assert.ok(m.contenedor.querySelector('[aria-label="Resultado del informe"]')?.textContent?.includes('correcta'));
        assert.ok(e.consultas.length > consultasAntes);
        const consultasFinales = e.consultas.length;
        await esperar(2200);
        assert.equal(e.consultas.length, consultasFinales);
    } finally { await cerrar(); }
});
test('retirada RSC invalida un GET pendiente del reintento y no recupera su resultado', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        await seleccionarFallidaYReintentar(m, e);
        e.diferirResultado = true;
        await esperar(2100);
        assert.ok(e.resolverResultado);
        const resolverAnterior = e.resolverResultado;
        e.diferirResultado = false;
        e.retirada = true;
        await m.repintar(createElement(GestorInformes, { ...props, claves: ['estado_actual'] }));
        await act(async () => { resolverAnterior(Response.json(ejecucion)); });
        await esperar();
        assert.ok(!m.contenedor.querySelector('[aria-label="Resultado del informe"]'));
        assert.ok(!texto(m).includes('12345'));
    } finally { await cerrar(); }
});
test('RSC retira material inmediatamente y actualizar revalida la selección', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        await pulsar(boton(m, 'Definición anterior · correcta'));
        await esperar();
        assert.ok(texto(m).includes('12345'));
        e.retirada = true;
        await m.repintar(createElement(GestorInformes, { ...props, claves: ['estado_actual', 'estado_hitos'] }));
        assert.ok(!texto(m).includes('12345'));
        await pulsar(boton(m, 'Actualizar estado'));
        await esperar();
        assert.ok(!m.contenedor.querySelector('[aria-label="Resultado del informe"]'));
        assert.ok(e.consultas.filter(u => u === `/api/informes/ejecuciones/${ejecucion.id}`).length >= 2);
    }
    finally {
        await cerrar();
    }
});
test('actualizar elimina resultado seleccionado denegado aun sin un nuevo RSC', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        await pulsar(boton(m, 'Definición anterior · correcta'));
        await esperar();
        assert.ok(texto(m).includes('12345'));
        e.retirada = true;
        await pulsar(boton(m, 'Actualizar estado'));
        await esperar();
        assert.ok(!m.contenedor.querySelector('[aria-label="Resultado del informe"]'));
    }
    finally {
        await cerrar();
    }
});
test('admin true→false retira distribución y comparación y conserva borrador permitido', async () => {
    const c = { ...configuracion, audiencia: { usuarios: [id(2)], grupos: [] } };
    const { m, cerrar } = await preparar(c);
    try {
        await editar(m);
        await comparar(m);
        assert.ok(texto(m).includes('RECEPTOR ANTERIOR'));
        assert.ok(texto(m).includes('COMPARACIÓN ANTERIOR'));
        await m.repintar(createElement(GestorInformes, { ...props, admin: false }));
        await esperar();
        for (const retirado of ['RECEPTOR ANTERIOR', 'COMPARACIÓN ANTERIOR', 'Grupos internos', 'ÁMBITO ANTERIOR'])
            assert.ok(!texto(m).includes(retirado), retirado);
        assert.equal(m.contenedor.querySelector<HTMLInputElement>('input[maxlength="120"]')?.value, definicion.nombre);
        assert.equal(m.contenedor.querySelector<HTMLSelectElement>('[aria-label="Informe"]')?.value, 'material_actual');
    }
    finally {
        await cerrar();
    }
});
test('opciones retiradas limpian previa, ámbito, comparación y definición activa', async () => {
    const { m, cerrar } = await preparar();
    try {
        await editar(m);
        await comparar(m);
        await m.repintar(createElement(GestorInformes, { ...props, opciones: [opciones[1]] }));
        await esperar();
        for (const retirado of ['COMPARACIÓN ANTERIOR', 'RECEPTOR ANTERIOR', 'ÁMBITO ANTERIOR'])
            assert.ok(!texto(m).includes(retirado));
        assert.equal(m.contenedor.querySelector<HTMLSelectElement>('[aria-label="Ámbito"]')?.value, id(11));
        assert.equal(m.contenedor.querySelector<HTMLInputElement>('input[maxlength="120"]')?.value, '');
        assert.ok(texto(m).includes('Nueva definición'));
    }
    finally {
        await cerrar();
    }
});
test('RSC semánticamente idéntico conserva nodo, edición local y revisión CAS', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        await editar(m);
        const campo = m.contenedor.querySelector<HTMLInputElement>('input[maxlength="120"]')!;
        await escribir(campo, 'BORRADOR LOCAL PERMITIDO');
        await comparar(m);
        const consultas = e.consultas.length;
        await m.repintar(createElement(GestorInformes, { ...props, claves: [...props.claves].reverse(), opciones: structuredClone([...opciones].reverse()) }));
        await esperar();
        assert.equal(m.contenedor.querySelector('input[maxlength="120"]'), campo);
        assert.equal(campo.value, 'BORRADOR LOCAL PERMITIDO');
        assert.ok(texto(m).includes('COMPARACIÓN ANTERIOR'));
        assert.ok(texto(m).includes('RECEPTOR ANTERIOR'));
        assert.equal(e.consultas.length, consultas);
    }
    finally {
        await cerrar();
    }
});
for (const cambio of ['claves', 'opciones', 'admin', 'borrador', 'nueva', 'actualizar'] as const)
    test(`respuesta previa tardía no repone contenido tras cambiar ${cambio}`, async () => {
        const { m, e, cerrar } = await preparar();
        try {
            await editar(m);
            e.diferirPrevia = true;
            await enviar(m);
            assert.ok(e.resolverPrevia);
            if (cambio === 'claves')
                await m.repintar(createElement(GestorInformes, { ...props, claves: ['estado_actual'] }));
            if (cambio === 'opciones')
                await m.repintar(createElement(GestorInformes, { ...props, opciones: [opciones[1]] }));
            if (cambio === 'admin')
                await m.repintar(createElement(GestorInformes, { ...props, admin: false }));
            if (cambio === 'borrador')
                await escribir(m.contenedor.querySelector<HTMLInputElement>('input[maxlength="120"]')!, 'Borrador nuevo');
            if (cambio === 'nueva')
                await pulsar(boton(m, 'Nueva definición'));
            if (cambio === 'actualizar') {
                e.retirada = true;
                await pulsar(boton(m, 'Actualizar estado'));
                await esperar();
            }
            await act(async () => { e.resolverPrevia!(Response.json(previa)); });
            await esperar();
            assert.ok(!texto(m).includes('ÁMBITO ANTERIOR'));
            assert.ok(!texto(m).includes('RECEPTOR ANTERIOR'));
            assert.ok(!m.contenedor.querySelector('[aria-label="Selección revisada"]'));
        }
        finally {
            await cerrar();
        }
    });
test('comparación tardía se invalida al perder administración', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        await editar(m);
        await enviar(m);
        await pulsar(boton(m, 'Guardar definición revisada'));
        await esperar();
        e.diferirComparacion = true;
        await pulsar(boton(m, 'Comparar versión guardada'));
        assert.ok(e.resolverComparacion);
        await m.repintar(createElement(GestorInformes, { ...props, admin: false }));
        await act(async () => { e.resolverComparacion!(Response.json({ ...definicion, nombre: 'COMPARACIÓN TARDÍA', version: 1 })); });
        await esperar();
        assert.ok(!texto(m).includes('COMPARACIÓN TARDÍA'));
    }
    finally {
        await cerrar();
    }
});
test('actualización filtrada retira edición activa, comparación y previa', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        await editar(m);
        await comparar(m);
        e.retirada = true;
        await pulsar(boton(m, 'Actualizar estado'));
        await esperar();
        assert.ok(!m.contenedor.querySelector('[aria-label="Comparación de versiones"]'));
        assert.ok(!m.contenedor.querySelector('[aria-label="Selección revisada"]'));
        assert.equal(m.contenedor.querySelector('form h2')?.textContent?.trim(), 'Nueva definición');
    }
    finally {
        await cerrar();
    }
});
test('búsqueda de audiencia tardía no presenta destinatarios de otra configuración', async () => {
    const original = globalThis.fetch;
    const pendientes: ((r: Response) => void)[] = [];
    globalThis.fetch = async () => new Promise<Response>(r => pendientes.push(r));
    const p = { configuracion, admin: true, grupos: [], cambiar: () => { } };
    const m = await montar(createElement(Audiencia, p));
    try {
        await escribir(m.contenedor.querySelector('input[type="search"]')!, 'an');
        await esperar(350);
        assert.equal(pendientes.length, 1);
        await m.repintar(createElement(Audiencia, { ...p, configuracion: { ...configuracion, ambito: { tipo: 'sala', id: id(11) } } }));
        await act(async () => pendientes[0](Response.json({ destinatarios: [{ id: id(2), nombre: 'DESTINATARIO TARDÍO', usuario: 'retirado', apto: true }] })));
        assert.ok(!texto(m).includes('DESTINATARIO TARDÍO'));
        await m.repintar(createElement(Audiencia, { ...p, admin: false }));
        assert.ok(!texto(m).includes('DESTINATARIO TARDÍO'));
    }
    finally {
        await m.desmontar();
        globalThis.fetch = original;
    }
});
test('página tardía de historial no repone filas retiradas por una actualización', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        e.paginar = true;
        await pulsar(boton(m, 'Actualizar estado'));
        await esperar();
        await pulsar(boton(m, 'Ver más ejecuciones'));
        assert.ok(e.resolverPagina);
        e.retirada = true;
        await pulsar(boton(m, 'Actualizar estado'));
        await esperar();
        await act(async () => e.resolverPagina!(Response.json({ ejecuciones: [ejecucion], cursor: null })));
        await esperar();
        assert.ok(!texto(m).includes('Definición anterior'));
    }
    finally {
        await cerrar();
    }
});
test('GET de resultado tardío no repone material tras un RSC restringido', async () => {
    const { m, e, cerrar } = await preparar();
    try {
        e.diferirResultado = true;
        await pulsar(boton(m, 'Definición anterior · correcta'));
        await esperar();
        assert.ok(e.resolverResultado);
        const resolver = e.resolverResultado;
        e.retirada = true;
        e.diferirResultado = false;
        await m.repintar(createElement(GestorInformes, { ...props, claves: ['estado_actual'] }));
        await esperar();
        await act(async () => resolver!(Response.json(ejecucion)));
        await esperar();
        assert.ok(!texto(m).includes('12345'));
        assert.ok(!m.contenedor.querySelector('[aria-label="Resultado del informe"]'));
    }
    finally {
        await cerrar();
    }
});

test('un receptor ordinario conserva el resultado compartido mediante grupo', async () => {
    const original = globalThis.fetch;
    const cfg = { ...configuracion, audiencia: { usuarios: [id(3)], grupos: [{ id: id(40), version: 0 }] } };
    const compartida = structuredClone(ejecucion);
    compartida.definicion_snapshot.configuracion = cfg;
    compartida.snapshot.definicion.configuracion = cfg;
    const e: EstadoServidor = { retirada: false, config: configuracion, consultas: [] };
    const base = servidor(e);
    globalThis.fetch = async (url, o) => String(url) === `/api/informes/ejecuciones/${ejecucion.id}` ? Response.json(compartida) : base(url, o);
    const m = await montar(createElement(GestorInformes, { ...props, usuarioId: id(2), admin: false }));
    try {
        await esperar(); await pulsar(boton(m, 'Definición anterior · correcta')); await esperar();
        assert.ok(texto(m).includes('12345'));
        assert.ok(!m.contenedor.querySelector('[aria-label="Audiencia de la ejecución"]'));
    } finally { await m.desmontar(); globalThis.fetch = original; }
});

import assert from 'node:assert/strict';
import Module from 'node:module';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { conectarRevisiones, URL_REA_PRUEBA, idPropuesta } from './rea06-fixture.mjs';
import { ErrorPropuesta, hash, type EntradaPropuesta, type BasePropuesta } from '../src/lib/propuestas/modelo';
const m = Module as unknown as {
    _load: (r: string, ...a: unknown[]) => unknown;
}, old = m._load;
m._load = (r, ...a) => r === 'server-only' ? {} : old.call(Module, r, ...a);
const { ServicioPropuestas } = await import('../src/lib/propuestas/servicio');
const { leerDiseno, crearRevisionDiseno } = await import('../src/lib/revisiones-diseno-repositorio');
const { obtenerPropuesta, historialPropuesta, descargarPdf } = await import('../src/lib/propuestas/repositorio');
const { guardarPlantilla, leerPlantilla } = await import('../src/lib/propuestas/plantillas');
const { renderizarPdf } = await import('../src/lib/propuestas/pdf');
const base: BasePropuesta = { version: 0, revisionId: null, hash: null };
const c = await conectarRevisiones(URL_REA_PRUEBA), sala = idPropuesta(12), obra = idPropuesta(10), u = idPropuesta(1), tecnico = idPropuesta(3);
const secreto = 'rea06-local-prueba-integracion-secreto-2026', repo = new ServicioPropuestas(c, { secreto });
const salida = 'output/rea-integracion/rea06/gates', resultados: string[] = [];
const es = (status: number) => (e: unknown) => e instanceof ErrorPropuesta && e.status === status;
try {
    const actual = await leerDiseno(c, sala), r = await crearRevisionDiseno(c, sala, 'Fuente fronteras REA06', u, actual.base);
    const e: EntradaPropuesta = { ambito: { tipo: 'sala', id: sala }, titulo: 'Fronteras REA06 ' + randomUUID(), fuente: { tipo: 'diseno', revisiones: [{ salaId: sala, revisionId: r.id }] }, aceptoHistorica: true, secciones: [{ id: randomUUID(), titulo: 'Alcance', texto: '{{sala.nombre}} y {{destinatario.nombre}}' }], destinatario: null, plantilla: null, incluidas: null, conceptos: [], valoracion: null };
    const consultas: string[] = [];
    const espia = postgres(URL_REA_PRUEBA, { max: 3, ssl: false, debug: (_n, q) => { consultas.push(q); } });
    try {
        const [identidad] = await espia `select current_database() base,current_user usuario`;
        assert.equal(identidad.base, 'av_design_rea06_prueba');
        assert.equal(identidad.usuario, 'av_design_rea06');
        consultas.length = 0;
        const spyRepo = new ServicioPropuestas(espia, { secreto });
        await spyRepo.preparar(tecnico, e);
        assert(!consultas.some(q => /\b(?:articulos|precios|parametros|existencias|reservas|imputaciones)\b/i.test(q)));
        assert(!consultas.some(q => /select\s+\*/i.test(q)));
        assert(consultas.some(q => q.includes('jsonb_build_object')));
        await writeFile(`${salida}/spy-tecnico.sql`, consultas.join('\n'));
        consultas.length = 0;
        await spyRepo.preparar(u, { ...e, fuente: { tipo: 'bom' } });
        assert.equal(consultas.filter(q => /^begin /i.test(q)).length, 1);
        assert(consultas.some(q => q.includes('articulos')));
        await writeFile(`${salida}/spy-bom.sql`, consultas.join('\n'));
        resultados.push('ACL antes de fuentes: técnico no consulta dinero/catálogo/parámetros/stock; BOM E1 una transacción real');
    }
    finally {
        await espia.end();
    }
    const previa = await repo.preparar(tecnico, e), p = await repo.publicar(tecnico, e, previa.previa, base, randomUUID());
    let actualP = await obtenerPropuesta(c, u, p.id);
    let b = { version: actualP.cabecera.version, revisionId: actualP.revision.id, hash: actualP.revision.sha256 };
    const igual = await repo.preparar(tecnico, e, p.id, b);
    const sinCambio = await repo.publicar(tecnico, e, igual.previa, b, randomUUID(), p.id);
    assert.equal(sinCambio.sinCambio, true);
    assert.equal(sinCambio.revisionId, p.revisionId);
    const valorada: EntradaPropuesta = { ...e, valoracion: previa.modelo.tecnico.lineas.map(l => ({ clave: l.clave, moneda: 'EUR', coste: null, origenCoste: null, regla: 'directo', precio: '0', motivoPrecio: 'Prueba explícita de cero', porcentaje: null, impuesto: { tipo: 'no_aplica', motivo: 'Cero explícito' } })) };
    const vp = await repo.preparar(u, valorada, p.id, b);
    const vd = await repo.publicar(u, valorada, vp.previa, b, randomUUID(), p.id);
    await assert.rejects(() => obtenerPropuesta(c, tecnico, p.id, p.revisionId), es(403));
    actualP = await obtenerPropuesta(c, u, p.id);
    b = { version: actualP.cabecera.version, revisionId: actualP.revision.id, hash: actualP.revision.sha256 };
    await assert.rejects(() => repo.preparar(tecnico, e, p.id, b), es(403));
    const quitar = await repo.preparar(u, e, p.id, b);
    await repo.publicar(u, e, quitar.previa, b, randomUUID(), p.id);
    assert.equal((await obtenerPropuesta(c, tecnico, p.id)).revision.valoracion, null);
    assert(!(await historialPropuesta(c, tecnico, p.id)).some(x => x.id === vd.revisionId));
    await assert.rejects(() => descargarPdf(c, tecnico, p.id, vd.revisionId), es(403));
    resultados.push('No-op y bandera atómica: al valorar se bloquea toda propuesta; al retirar se protege historia monetaria');
    const pl = await guardarPlantilla(c, tecnico, { nombre: 'Congelada REA06 ' + randomUUID(), secciones: e.secciones, activo: true }), tpl = await leerPlantilla(c, tecnico, pl.id);
    const desde = { ...e, titulo: 'Copia SOW ' + randomUUID(), plantilla: { id: tpl.id, version: tpl.version, hash: tpl.hash }, secciones: tpl.secciones.map(s => ({ ...s, id: randomUUID() })) };
    const pp = await repo.preparar(tecnico, desde);
    const pd = await repo.publicar(tecnico, desde, pp.previa, base, randomUUID());
    await guardarPlantilla(c, tecnico, { nombre: tpl.nombre, secciones: [{ id: randomUUID(), titulo: 'Nuevo', texto: 'Texto posterior' }], activo: true }, tpl.id, tpl.version);
    const guardada = await obtenerPropuesta(c, tecnico, pd.id);
    assert.equal(guardada.revision.tecnico.plantillaSnapshot!.secciones[0].texto, e.secciones[0].texto);
    const bp = { version: guardada.cabecera.version, revisionId: guardada.revision.id, hash: guardada.revision.sha256 };
    await repo.preparar(tecnico, { ...desde, titulo: desde.titulo + ' revisión' }, pd.id, bp);
    resultados.push('SOW copiado conserva snapshot, textos y variables pese a editar la plantilla de origen');
    const cerrar = await repo.preparar(tecnico, e);
    await c `insert into hitos_proyecto(proyecto_id,tipo,fecha,notas) values(${obra},'cierre',current_date,'Cierre exclusivo gate REA06')`;
    try {
        await assert.rejects(() => repo.publicar(tecnico, e, cerrar.previa, base, randomUUID()), es(409));
        await assert.rejects(async () => repo.archivar(tecnico, p.id, (await obtenerPropuesta(c, u, p.id)).cabecera.version, true, 'No permitido', randomUUID()), es(409));
        await obtenerPropuesta(c, tecnico, p.id);
    }
    finally {
        await c `delete from hitos_proyecto where proyecto_id=${obra} and tipo='cierre' and notas='Cierre exclusivo gate REA06'`;
    }
    resultados.push('Cierre después del preview bloquea publicar/archivar y conserva lectura');
    // La cuota se prueba con PDF real y relleno posterior legal, comprimible por TOAST.
    const pm = await repo.preparar(u, e), pdf = await renderizarPdf(pm.modelo), relleno = Buffer.alloc(20971520, 32);
    pdf.contenido.copy(relleno);
    const cuotaRepo = new ServicioPropuestas(c, { secreto, renderizar: async () => ({ contenido: relleno, paginas: pdf.paginas }) });
    let cuotaId: string | null = null, cuotaBase = base;
    for (let i = 0; i < 10; i++) {
        const eq = { ...e, titulo: `Cuota REA06 ${i} ${pm.previa.id}` };
        const pv = await cuotaRepo.preparar(u, eq, cuotaId, cuotaBase);
        const d = await cuotaRepo.publicar(u, eq, pv.previa, cuotaBase, randomUUID(), cuotaId);
        cuotaId = d.id;
        cuotaBase = { version: d.version, revisionId: d.revisionId, hash: d.sha256 };
    }
    const eq = { ...e, titulo: 'Cuota excedida ' + pm.previa.id }, qc = await cuotaRepo.preparar(u, eq, cuotaId, cuotaBase);
    await assert.rejects(() => cuotaRepo.publicar(u, eq, qc.previa, cuotaBase, randomUUID(), cuotaId), es(413));
    const [totales] = await c `select count(*)::int n,sum(a.bytes)::text bytes from propuesta_archivos a join propuesta_revisiones r on r.id=a.revision_id where r.propuesta_id=${cuotaId!}`;
    assert.equal(totales.n, 10);
    assert.equal(totales.bytes, '209715200');
    assert.equal((await descargarPdf(c, u, cuotaId!, cuotaBase.revisionId!)).contenido.length, 20971520);
    resultados.push('Cuota real 200MiB: diez PDF20MiB conservados, undécimo rechazado sin parcial y último reabrible');
    await writeFile(`${salida}/fronteras-resultados.json`, JSON.stringify({ resultados, cuotaId, hashFuente: hash(e.fuente) }, null, 2));
    console.log(resultados.join('\n'));
}
finally {
    await c.end();
}

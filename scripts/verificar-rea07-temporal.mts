import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, URL_REA_PRUEBA, fotografiarRevisiones } from './rea07-fixture.mjs';
import { ServicioSeguimiento } from '../src/lib/seguimiento-propuestas/servicio';
import { ErrorSeguimiento, type Filtros } from '../src/lib/seguimiento-propuestas/modelo';
import { partesMadrid, sumarDias } from '../src/lib/informes/periodos';
const m = Module as unknown as { _load: (request: string, ...args: unknown[]) => unknown }, cargar = m._load; m._load = (req, ...args) => req === 'server-only' ? {} : cargar.call(Module, req, ...args);
const { ServicioPropuestas } = await import('../src/lib/propuestas/servicio');
assert.equal(process.env.REA07_DATABASE_URL, URL_REA_PRUEBA);
const c = await conectarRevisiones(process.env.REA07_DATABASE_URL!), salida = resolve('output/rea-integracion/rea07/seguimiento-runtime'), f = JSON.parse(await readFile(resolve(salida, 'manifest-fixture.json'), 'utf8')), resultados: string[] = [];
const ok = (caso: string) => { resultados.push(caso); console.log('OK', caso); }, servicio = new ServicioSeguimiento(c, { secreto: f.secreto });
try {
    const hoy = partesMadrid(new Date()).fecha, ayer = sumarDias(hoy, -1), fechaPreview = ayer + 'T12:00:00.000Z', pub06 = new ServicioPropuestas(c, { secreto: f.secreto, reloj: () => new Date(fechaPreview) }), e = { ...f.entrada, titulo: 'P-F preview período anterior publicación hoy ' + randomUUID() }, previa = await pub06.preparar(f.admin, e), p = await pub06.publicar(f.admin, e, previa.previa, { version: 0, revisionId: null, hash: null }, randomUUID());
    const filtros: Filtros = { desde: hoy, hasta: hoy, observadoEn: new Date().toISOString(), archivo: 'todas', ambito: { tipo: 'seleccion', ids: [p.id] }, importes: false }, actual = await servicio.embudo(f.admin, filtros, { comparar: { desde: ayer, hasta: ayer } });
    assert.equal(actual.denominador, 1); assert.equal(actual.comparacion!.tasa.denominador, 0); assert.equal(actual.comparacion!.tasa.porcentaje, null); assert.equal(actual.comparacion!.diferenciaPuntosPorcentuales, null); assert.equal(actual.comparacion!.filtros.observadoEn, actual.filtros.observadoEn); assert.notEqual(actual.lista[0].publicadaEn, fechaPreview); assert.equal((await servicio.embudo(f.admin, { ...filtros, desde: ayer, hasta: ayer })).denominador, 0); ok('GWT01/11 preview ayer no pertenece ayer; publicaciónBDhoy, comparación mismo corte sin0falso');
    const antesCierre = await fotografiarRevisiones(c), d = await servicio.detalle(f.admin, f.b.id), hito = randomUUID();
    await c`insert into hitos_proyecto(id,proyecto_id,tipo,fecha,notas) values(${hito},${f.obra},'cierre',${hoy},'Cierre QA07 temporal sintético')`;
    try {
        assert.equal((await servicio.detalle(f.admin, f.b.id)).puedeEditar, false);
        await assert.rejects(() => servicio.registrar(f.admin, { propuestaId: f.b.id, revisionId: d.revision.id, revisionHash: d.revision.hash, versionPropuesta: d.versionPropuesta, versionSeguimiento: d.versionSeguimiento, ultimoEventoId: d.ultimoEventoId, comando: 'emitir', decisionRevocadaId: null, motivo: 'No debe escribir con obra cerrada', referencia: 'Acta cierre sintético', clavePeticion: randomUUID() }), (e: unknown) => e instanceof ErrorSeguimiento && e.status === 409);
    } finally { await c`delete from hitos_proyecto where id=${hito} and proyecto_id=${f.obra} and notas='Cierre QA07 temporal sintético'`; }
    const despuesCierre = await fotografiarRevisiones(c); assert.equal(antesCierre.sha256, despuesCierre.sha256); ok('GWT19 obra cerrada sólo consulta409sin filas y hechos idénticos tras retirar hitoQApropio');
    await writeFile(resolve(salida, 'temporal-resultados.json'), JSON.stringify({ resultados, propuestaFecha: p, fechaPreview, publicadaEn: actual.lista[0].publicadaEn, comparacion: actual.comparacion, antesCierre: antesCierre.sha256, despuesCierre: despuesCierre.sha256 }, null, 2));
} finally { await c.end(); }

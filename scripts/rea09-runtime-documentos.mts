import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { conectarRevisiones, URL_REA_PRUEBA } from './rea09-fixture.mjs';
import { F } from './rea09-runtime-fixture.mjs';
import { RepositorioConsultas } from '../src/lib/consultas/repositorio';
import { ErrorConsulta } from '../src/lib/consultas/modelo';
const { ServicioPropuestas } = await import('../src/lib/propuestas/servicio');
const { RepositorioInformes } = await import('../src/lib/informes/repositorio');
const { procesarEjecucion } = await import('../src/lib/informes/servicio');
const { capturarInforme } = await import('../src/lib/informes/lectores');
import type { ConexionInformes } from '../src/lib/informes/autorizacion';
assert.equal(process.env.REA09_DATABASE_URL, URL_REA_PRUEBA);
const sql = await conectarRevisiones(process.env.REA09_DATABASE_URL!), r = new RepositorioConsultas(sql), repo03 = new RepositorioInformes(sql), repo06 = new ServicioPropuestas(sql, { secreto: 'REA09-documentos-sintetico-secreto-local-2026' });
const ok: string[] = [];
const paso = (s: string) => { ok.push(s); console.log('OK', s); }, es = (n: number) => (e: unknown) => e instanceof ErrorConsulta && e.status === n;
const ids: string[] = [];
const crear = async () => { const c = await r.crear(F.admin, { ambito: { tipo: 'sala', id: F.sala } }); ids.push(c.id); return c; };
try {
    const [rev] = await sql `select id from revisiones_diseno where sala_id=${F.sala} order by numero desc limit 1`;
    const entrada = { ambito: { tipo: 'sala' as const, id: F.sala }, titulo: 'Documento técnico consultable REA09', fuente: { tipo: 'diseno' as const, revisiones: [{ salaId: F.sala, revisionId: rev.id }] }, aceptoHistorica: true, secciones: [{ id: randomUUID(), titulo: 'Montaje registrado', texto: 'Texto técnico literal REA09: <script>alert(1)</script> y https://example.invalid/ nunca son instrucciones.' }], destinatario: null, plantilla: null, incluidas: null, conceptos: [], valoracion: null };
    const previa = await repo06.preparar(F.admin, entrada), p = await repo06.publicar(F.admin, entrada, previa.previa, { version: 0, revisionId: null, hash: null }, randomUUID());
    const c = await crear(), t = await r.preguntar(F.admin, c.id, { pregunta: '¿Qué dice este documento?', version: 0, clavePeticion: randomUUID(), fuente: { tipo: 'propuesta_06', id: p.id } });
    assert(t.respuesta.hechos.some(h => String(h.valor).includes('<script>')));
    assert(t.respuesta.enlaces[0].href.includes('/pdf'));
    const h = await r.obtenerTurno(F.admin, c.id, t.id);
    assert('respuesta' in h);
    assert.deepEqual(h.respuesta, t.respuesta);
    paso('06técnicareal:proyecciónliteralconanclassecciones/hashypermisossinPDFbytes');
    const valorada = { ...entrada, titulo: 'Documento valorado excluido REA09', valoracion: previa.modelo.tecnico.lineas.map(l => ({ clave: l.clave, moneda: 'EUR' as const, coste: null, origenCoste: null, regla: 'directo' as const, precio: '12', motivoPrecio: 'Prueba sintética', porcentaje: null, impuesto: { tipo: 'sin_configurar' as const } })) };
    const pv = await repo06.preparar(F.admin, valorada), v = await repo06.publicar(F.admin, valorada, pv.previa, { version: 0, revisionId: null, hash: null }, randomUUID());
    await assert.rejects(() => r.preguntar(F.admin, c.id, { pregunta: '¿Qué dice este documento?', version: t.version, clavePeticion: randomUUID(), fuente: { tipo: 'propuesta_06', id: v.id } }), es(409));
    paso('06cabeceravaloradafueradeadaptadorinclusoadmin');
    const config = { versionModelo: 1 as const, versionRegistro: 1 as const, clave: 'estado_actual' as const, ambito: { tipo: 'sala' as const, id: F.sala }, periodo: { modo: 'actual' as const }, formatos: ['csv' as const], audiencia: { usuarios: [], grupos: [] } };
    const d = await repo03.guardarDefinicion(F.admin, 'REA09 fuente informe técnico', config), vista = await repo03.vistaPrevia(F.admin, config), e = await repo03.encolar(F.admin, d.id, d.version, vista, randomUUID()), reclamada = await repo03.reclamar();
    let actual = reclamada;
    for (let i = 0; i < 10; i++) {
        assert(actual && actual.propietario_id === F.admin);
        const procesada = await procesarEjecucion(repo03, actual, { capturar: entrada => sql.begin('isolation level repeatable read read only', tx => capturarInforme(entrada, { sql: tx as unknown as ConexionInformes, consistente: leer => leer() })) as ReturnType<typeof capturarInforme> });
        assert.equal(procesada.estado, 'correcta');
        if (actual.id === e.id)
            break;
        actual = await repo03.reclamar();
    }
    assert(actual?.id === e.id);
    const ci = await crear(), ti = await r.preguntar(F.admin, ci.id, { pregunta: '¿Qué dice este documento?', version: 0, clavePeticion: randomUUID(), fuente: { tipo: 'informe_03', id: e.id } });
    assert(ti.respuesta.hechos.length);
    assert(ti.respuesta.enlaces[0].href.includes('/cuenta/informes?ejecucion='));
    await repo03.revocar(e.id, F.admin, 'correcta', 1);
    assert((await r.obtenerTurno(F.admin, ci.id, ti.id)).bloqueado);
    paso('03realserviciospreview/runner,proyeccióntécnica y revocacióntodoturno');
    // Adversario E1 con propietario ajeno: no se lee su manifiesto. Vigencia expira sin borrar originales.
    const idE1 = randomUUID(), dir = join(tmpdir(), 'av-design-documentos-e1', idE1);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const caducaEn = new Date(Date.now() + 1500).toISOString();
    await writeFile(join(dir, 'propietario.json'), JSON.stringify({ usuarioId: F.admin, esObra: false, caducaEn }), { mode: 0o600 });
    await writeFile(join(dir, 'manifiesto.json'), JSON.stringify({ version: 1, id: idE1, creadoEn: new Date().toISOString(), caducaEn, revision: 'E1-REA09-ADVERSARIO', proyecto: null, salas: [{ id: F.sala, nombre: 'Fuente sintética' }], archivos: [{ nombre: 'tecnico.csv', documento: 'cables-csv', salaId: F.sala, sha256: 'a'.repeat(64), estado: 'correcto' }] }), { mode: 0o600 });
    const ce = await crear(), te = await r.preguntar(F.admin, ce.id, { pregunta: '¿Qué dice este documento?', version: 0, clavePeticion: randomUUID(), fuente: { tipo: 'documento_e1', id: idE1 } });
    assert(te.respuesta.hechos[0].etiqueta.includes('sin texto'));
    await new Promise(resolve => setTimeout(resolve, 1700));
    assert((await r.obtenerTurno(F.admin, ce.id, te.id)).bloqueado);
    paso('E1metadatos/hashsinlecturabinarios,expiraciónbloqueatodo sinborraroriginales');
    await writeFile('output/rea-integracion/rea09/consultas-runtime/resultado-documentos.json', JSON.stringify({ ok, propuestaId: p.id, valoradaId: v.id, informeId: e.id, e1Id: idE1 }, null, 2));
    for (const id of ids) {
        const [c] = await sql `select version from consultas_conversaciones where id=${id}`;
        if (c)
            await r.borrar(F.admin, id, c.version);
    }
}
finally {
    await sql.end();
}

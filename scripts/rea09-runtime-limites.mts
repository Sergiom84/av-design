import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { conectarRevisiones, URL_REA_PRUEBA, fotografiarRevisiones } from './rea09-fixture.mjs';
import { F } from './rea09-runtime-fixture.mjs';
import { RepositorioConsultas } from '../src/lib/consultas/repositorio';
import { ErrorConsulta } from '../src/lib/consultas/modelo';
assert.equal(process.env.REA09_DATABASE_URL, URL_REA_PRUEBA);
const sql = await conectarRevisiones(process.env.REA09_DATABASE_URL!), r = new RepositorioConsultas(sql);
const ok: string[] = [];
const paso = (s: string) => { ok.push(s); console.log('OK', s); }, es = (n: number) => (e: unknown) => e instanceof ErrorConsulta && e.status === n;
const propios: string[] = [];
const crear = async () => { const c = await r.crear(F.admin, { ambito: { tipo: 'catalogo' } }); propios.push(c.id); return c; };
const antes = await fotografiarRevisiones(sql), ajenas = (f: typeof antes) => f.tablas.filter(t => !t.tabla.startsWith('consultas_'));
try {
    const c = await crear();
    for (let i = 0; i < 100; i++) {
        const t = await r.preguntar(F.admin, c.id, { pregunta: 'Pregunta desconocida independiente ' + i, version: c.version, clavePeticion: randomUUID() });
        c.version = t.version;
    }
    await assert.rejects(() => r.preguntar(F.admin, c.id, { pregunta: 'Otra pregunta', version: c.version, clavePeticion: randomUUID() }), es(429));
    const p1 = await r.listarTurnos(F.admin, c.id), p2 = await r.listarTurnos(F.admin, c.id, p1.siguiente!);
    assert.equal(p1.turnos.length, 20);
    assert.equal(p2.turnos.length, 20);
    assert.equal(p1.turnos[19].numero, 20);
    assert.equal(p2.turnos[0].numero, 21);
    paso('100turnos/cabecera,101rechazado429,páginas20ordenestablenúmero');
    const [{ id: articulo }] = await sql `insert into articulos(tipo,categoria,marca,modelo,unidad,caracteristicas,fuente) values('equipo','PRUEBA','REA09-LIM','REA09-LIM','ud',${'á'.repeat(140000)},'app') returning id`;
    try {
        const lim = await crear();
        await assert.rejects(() => r.preguntar(F.admin, lim.id, { pregunta: 'Consultar ficha catálogo', fuente: { tipo: 'catalogo', id: articulo }, version: 0, clavePeticion: randomUUID() }), es(413));
        assert.equal((await sql `select count(*)::int n from consultas_turnos where conversacion_id=${lim.id}`)[0].n, 0);
        paso('256KiBUTF8rechazo413antespersistencia,sintruncadoniestadointermedio');
        await sql `update articulos set caracteristicas=${'texto '.repeat(32000)} where id=${articulo}`;
        let rechazado = false, total = 0;
        const quota = await crear();
        for (let i = 0; i < 100; i++) {
            try {
                const t = await r.preguntar(F.admin, quota.id, { pregunta: 'Consultar ficha catálogo ' + i, fuente: { tipo: 'catalogo', id: articulo }, version: quota.version, clavePeticion: randomUUID() });
                quota.version = t.version;
                total++;
            }
            catch (e) {
                assert(es(429)(e));
                rechazado = true;
                break;
            }
        }
        assert(rechazado);
        assert(total > 30 && total < 100);
        paso('10MiBpersona429en' + total + 'turnosbajobloqueopropietario');
    }
    finally {
        await sql `delete from articulos where id=${articulo}`;
    }
    // Conversaciones antiguas sintéticas insertadas con creación pasada, sin modificar el reloj ni triggers.
    const id = randomUUID(), creado = new Date(Date.now() - 8 * 86400000).toISOString();
    await sql `insert into consultas_conversaciones(id,propietario_id,ambito,retencion_dias,creado_en,caduca_en) values(${id},${F.admin},${sql.json({ tipo: 'catalogo' })},7,${creado},${creado}::timestamptz+interval '7 days')`;
    assert(!(await r.listar(F.admin)).conversaciones.some(c => c.id === id));
    await assert.rejects(() => r.listarTurnos(F.admin, id), es(404));
    await assert.rejects(() => r.retener(F.admin, id, 0, 90), es(404));
    assert.equal((await sql `select count(*)::int n from consultas_conversaciones where id=${id}`)[0].n, 1);
    await r.escritura(tx => r.purgar(tx, F.admin));
    assert.equal((await sql `select count(*)::int n from consultas_conversaciones where id=${id}`)[0].n, 0);
    paso('Vencidas404antescontenido,retenciónnorevive;purga7díasporlotespropios');
    for (const id of propios) {
        const [c] = await sql `select version from consultas_conversaciones where id=${id}`;
        if (c)
            await r.borrar(F.admin, id, c.version);
    }
    assert.deepEqual(ajenas(await fotografiarRevisiones(sql)), ajenas(antes));
    paso('93tablasajenasidénticasdespuéscuotas/retención/purga');
    await writeFile('output/rea-integracion/rea09/consultas-runtime/resultado-limites.json', JSON.stringify({ ok }, null, 2));
}
finally {
    await sql.end();
}

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { conectarRevisiones, URL_REA_PRUEBA } from './rea09-fixture.mjs';
import { F } from './rea09-runtime-fixture.mjs';
import { RepositorioConsultas } from '../src/lib/consultas/repositorio';
import { ErrorConsulta } from '../src/lib/consultas/modelo';
assert.equal(process.env.REA09_DATABASE_URL, URL_REA_PRUEBA);
const sql = await conectarRevisiones(process.env.REA09_DATABASE_URL!), r = new RepositorioConsultas(sql);
let soltar!: () => void, retencion!: () => void;
const espera = new Promise<void>(res => soltar = res), retenido = new Promise<void>(res => retencion = res);
const c = await r.crear(F.lector, { ambito: { tipo: 'sala', id: F.sala } });
const bloqueo = sql.begin(async (tx) => { await tx `select pg_advisory_xact_lock(hashtextextended(${`consultas:${F.lector}`},0))`; retencion(); await espera; });
try {
    await retenido;
    const pregunta = r.preguntar(F.lector, c.id, { pregunta: 'Medidas', version: 0, clavePeticion: randomUUID() }).then(v => ({ ok: true, v }), e => ({ ok: false, e }));
    let activos: unknown[] = [];
    for (let i = 0; i < 100; i++) {
        const rows = await sql `select pid,state,wait_event_type,wait_event,query from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event='advisory' and query like 'select pg_advisory_xact_lock%'`;
        if (rows.length) {
            activos = rows;
            break;
        }
        await new Promise(res => setTimeout(res, 20));
    }
    assert(activos.length, 'La escritura debe estar esperando la barreraadvisory real tras la capturaRR');
    await sql `insert into usuario_permisos(usuario_id,seccion,acceso) values(${F.lector},'salas','oculto')`;
    soltar();
    await bloqueo;
    const resultado = await pregunta;
    assert('e' in resultado);assert(!resultado.ok && resultado.e instanceof ErrorConsulta && resultado.e.status === 403);
    assert.equal((await sql `select count(*)::int n from consultas_turnos where conversacion_id=${c.id}`)[0].n, 0);
    await writeFile('output/rea-integracion/rea09/consultas-runtime/resultado-barrera.json', JSON.stringify({ activos, esperado: 403, turnos: 0, estado: 'CapturaRR completada; publicación esperaba lock; ACLretirada por otra conexión antesdelockliberado.' }, null, 2));
    console.log('OK pg_stat_activity confirma espera real; retirada entre captura/persistencia403 sin turno ni respuesta parcial');
}
finally {
    soltar();
    await bloqueo.catch(() => { });
    await sql `delete from usuario_permisos where usuario_id=${F.lector} and seccion='salas'`;
    await r.borrar(F.lector, c.id, 0);
    await sql.end();
}

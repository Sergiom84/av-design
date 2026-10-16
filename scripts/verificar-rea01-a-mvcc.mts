/** Barrera cierre/E3: acciones reales y cerrojos observados, sólo fixture5552. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones } from './rea01-fixture.mjs';

if (!process.env.REA_DATABASE_URL) throw new Error('REA_DATABASE_URL explícita obligatoria.');
const db = await conectarRevisiones(process.env.REA_DATABASE_URL);
process.env.DATABASE_URL = process.env.REA_DATABASE_URL;
process.env.SESION_SECRETO = '';
const mod = Module as unknown as { _load: (r: string, ...args: unknown[]) => unknown }, original = mod._load;
mod._load = (r, ...args) => r === 'server-only' ? {} : r === 'next/cache' ? { revalidatePath: () => {} } : original.call(Module, r, ...args);
const { registrarHitoProyecto } = await import('../src/app/acciones-ciclo');
const e3 = await import('../src/lib/revisiones-diseno-repositorio');
const { errorRevisionDiseno } = await import('../src/lib/revisiones-diseno-http');
const f = JSON.parse(await readFile(resolve('output/rea-integracion/rea01/a/fixture.json'), 'utf8'));
const salida = resolve('output/rea-integracion/rea01/a/barrera-mvcc');
await mkdir(salida, { recursive: true });
const prefijo = `REA01 A MVCC ${Date.now().toString(36)}`;
const tecnico = randomUUID();
const resultados: Array<{ caso: string; ok: true; detalle: unknown }> = [];
const protegidos = ['src/lib/revisiones-diseno-repositorio.ts', 'src/lib/revisiones-diseno.ts', 'src/lib/revisiones-diseno-http.ts', 'src/app/api/salas/[id]/duplicar/route.ts'];
async function hashes() { return Object.fromEntries(await Promise.all(protegidos.map(async p => [p, createHash('sha256').update(await readFile(resolve(p))).digest('hex')]))); }
const fuentesEntrada = await hashes();
const normal = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const formulario = (d: Record<string, unknown>) => { const x = new FormData(); for (const [k, v] of Object.entries(d)) if (v != null) x.set(k, String(v)); return x; };
const hito = (p: string) => formulario({ proyecto_id: p, tipo: 'cierre', tecnico_id: tecnico, fecha: '2026-10-11', notas: 'Cierre MVCC con nota y técnico originales' });
async function acotado<T>(p: Promise<T>): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<never>((_, rechazar) => { reloj = setTimeout(() => rechazar(Error('Operación sin terminar en20s; posible deadlock')), 20000); })]); }
  finally { if (reloj) clearTimeout(reloj); }
}
async function esperarBloqueadoPor(pid: number) {
  for (let n = 0; n < 500; n++) {
    const filas = await db<Array<{ pid: number; query: string; wait_event: string; blockers: number[] }>>`
      select pid, query, wait_event, pg_blocking_pids(pid) blockers from pg_stat_activity
      where ${pid} = any(pg_blocking_pids(pid)) order by pid`;
    if (filas.length) { assert.equal(filas.length, 1); return normal(filas[0]); }
    await new Promise(r => setTimeout(r, 10));
  }
  throw Error('No se observó espera por el cerrojo ' + pid);
}
async function barrera(tabla: 'hitos_proyecto' | 'revisiones_diseno', condicion: string) {
  const nombre = 'rea01_a_mvcc_' + randomUUID().replaceAll('-', '');
  const clave = Number.parseInt(randomUUID().slice(0, 8), 16);
  const conexion = await db.reserve();
  const [{ pid }] = await conexion`select pg_backend_pid() pid`;
  await conexion`select pg_advisory_lock(${clave}::bigint)`;
  await db.unsafe(`create function ${nombre}() returns trigger language plpgsql as $$begin if ${condicion} then perform pg_advisory_xact_lock(${clave}::bigint);end if;return new;end$$`);
  await db.unsafe(`create trigger ${nombre} before insert on ${tabla} for each row execute function ${nombre}()`);
  let liberada = false;
  return {
    pid: Number(pid),
    async liberar() { if (!liberada) { await conexion`select pg_advisory_unlock_all()`; conexion.release(); liberada = true; } },
    async retirar() { await this.liberar(); await db.unsafe(`drop trigger if exists ${nombre} on ${tabla}`); await db.unsafe(`drop function if exists ${nombre}()`); },
  };
}
async function preparar(tipo: 'crear' | 'restaurar' | 'duplicar') {
  const p = randomUUID(), l = randomUUID(), s = randomUUID(), equipo0 = randomUUID(), equipo1 = randomUUID(), conexion = randomUUID();
  await db.begin(async tx => {
    await tx`insert into proyectos(id,nombre) values(${p},${prefijo + ' ' + tipo + ' ' + p})`;
    await tx`insert into localizaciones(id,proyecto_id,nombre) values(${l},${p},'Localización MVCC')`;
    await tx`insert into hitos_proyecto(proyecto_id,tipo) values(${p},'inicio')`;
    await tx`insert into salas(id,nombre,localizacion_id,largo_m,ancho_m,alto_m,mesa_largo_m,mesa_ancho_m,mesa_alto_cm,mesa_x_m,mesa_y_m,sillas_modo,diagrama_iniciado_en,diagrama_origen)
      values(${s},${prefijo + ' ' + tipo},${l},6,4,3,2,1,75,3,2,'manuales',now(),'desde_cero')`;
    await tx`insert into sala_equipos(id,sala_id,articulo_id,nombre,extremo,x_m,y_m,z_m,posicion_confirmada)
      values(${equipo0},${s},${f.articulo},'Equipo cero confirmado','rack',0,0,0,true),
      (${equipo1},${s},${f.articulo},'Equipo destino medido','pared',4,2,1.8,true)`;
    await tx`insert into sala_mobiliario(sala_id,mobiliario_id,nombre,forma,largo_m,ancho_m,x_m,y_m,z_m,posicion_confirmada)
      values(${s},${f.silla},'Asiento medido','rectangulo',.5,.5,1,1,0,true)`;
    await tx`insert into tomas_red(sala_id,codigo,x_m,y_m,z_m) values(${s},'ROSETA-MVCC',1,2,1)`;
    await tx`insert into puertas(sala_id,pared,posicion_m,anchura_m,altura_m,orden) values(${s},'sur',1,.8,2,0)`;
    await tx`insert into conexiones(id,sala_id,origen_id,destino_id,articulo_cable_id,senal,ruta)
      values(${conexion},${s},${equipo0},${equipo1},${f.cable},'hdmi','falso_techo')`;
    await tx`insert into conexion_puntos_paso(conexion_id,orden,x_m,y_m,z_m) values(${conexion},0,1,2,2.5)`;
    await tx`insert into anotaciones_sala(sala_id,texto,ancla_tipo,x,y) values(${s},'Montaje MVCC','visual',0,0)`;
  });
  let objetivo: Awaited<ReturnType<typeof e3.crearRevisionDiseno>> | undefined;
  if (tipo === 'restaurar') {
    objetivo = await e3.crearRevisionDiseno(db, s, 'Montaje objetivo MVCC', f.admin, (await e3.leerDiseno(db, s)).base);
    await db`update sala_equipos set x_m=5.5 where id=${equipo1}`;
  }
  return { p, l, s, equipo0, equipo1, conexion, objetivo, base: (await e3.leerDiseno(db, s)).base };
}
type Fixture = Awaited<ReturnType<typeof preparar>>;
function mutar(tipo: 'crear' | 'restaurar' | 'duplicar', x: Fixture) {
  if (tipo === 'crear') return e3.crearRevisionDiseno(db, x.s, 'Revisión MVCC', f.admin, x.base);
  if (tipo === 'restaurar') return e3.restaurarRevisionDiseno(db, x.s, x.objetivo!.id, f.admin, x.base);
  return e3.duplicarSalaDiseno(db, x.s, prefijo + ' copia ' + randomUUID(), null, f.admin, x.base);
}
async function foto(x: Fixture) {
  const ids = (await db<Array<{ id: string }>>`select id from salas where localizacion_id=${x.l} order by id`).map(s => s.id);
  const datos: Record<string, unknown> = {};
  for (const tabla of ['salas', 'sala_equipos', 'sala_mobiliario', 'tomas_red', 'puertas', 'conexiones', 'anotaciones_sala', 'sala_material_bom', 'correlativos_cable', 'revisiones_diseno']) {
    datos[tabla] = await db.unsafe(`select to_jsonb(t) fila from ${tabla} t where ${tabla === 'salas' ? 'id' : 'sala_id'}=any($1::uuid[]) order by ${tabla === 'correlativos_cable' ? 'sala_id,senal' : 'id'}`, [ids]);
  }
  for (const tabla of ['conexion_puntos_paso', 'conexion_bocas']) {
    datos[tabla] = await db.unsafe(`select to_jsonb(t) fila from ${tabla} t join conexiones c on c.id=t.conexion_id where c.sala_id=any($1::uuid[]) order by t.conexion_id${tabla === 'conexion_bocas' ? ',t.lado' : ',t.id'}`, [ids]);
  }
  datos.disenos = await Promise.all(ids.map(async id => { const actual = await e3.leerDiseno(db, id); return { id, base: actual.base, snapshot: actual.snapshot }; }));
  datos.hitos = await db`select to_jsonb(h) fila from hitos_proyecto h where proyecto_id=${x.p} order by id`;
  return normal(datos);
}
function sinCierreNiTimestamp(foto: Record<string, unknown>) {
  const copia = normal(foto);
  copia.salas = (copia.salas as Array<{ fila: Record<string, unknown> }>).map(({ fila }) => { const resto = { ...fila }; delete resto.actualizado_en; return { fila: resto }; });
  copia.hitos = (copia.hitos as Array<{ fila: Record<string, unknown> }>).filter(f => f.fila.tipo !== 'cierre');
  return copia;
}
function comprobarSoloContexto(antes: Record<string, unknown>, despues: Record<string, unknown>) {
  assert.deepEqual(sinCierreNiTimestamp(despues), sinCierreNiTimestamp(antes));
  const salasAntes = antes.salas as Array<{ fila: Record<string, unknown> }>;
  const salasDespues = despues.salas as Array<{ fila: Record<string, unknown> }>;
  for (const { fila } of salasAntes) assert.notEqual(salasDespues.find(s => s.fila.id === fila.id)!.fila.actualizado_en, fila.actualizado_en);
  const cierres = (despues.hitos as Array<{ fila: Record<string, unknown> }>).filter(f => f.fila.tipo === 'cierre');
  assert.equal(cierres.length, 1);
  assert.equal(cierres[0].fila.tecnico_id, tecnico);
  assert.equal(cierres[0].fila.fecha, '2026-10-11');
  assert.equal(cierres[0].fila.notas, 'Cierre MVCC con nota y técnico originales');
}
async function comprobarRepeticion(x: Fixture) {
  const antes = await foto(x);
  assert.equal(await registrarHitoProyecto(formulario({ proyecto_id: x.p, tipo: 'cierre', tecnico_id: tecnico, fecha: '2026-10-12', notas: 'No se debe sobreescribir' })), undefined);
  const despues = await foto(x);
  assert.deepEqual(despues, antes);
  return { timestampsIdenticos: true, hitoOriginalIdentico: true, sinEscriturasDeDiseno: true };
}
async function caso(nombre: string, fn: () => Promise<unknown>) {
  const detalle = await fn();
  resultados.push({ caso: nombre, ok: true, detalle });
  console.log('OK', nombre, JSON.stringify(detalle));
  await writeFile(resolve(salida, 'matriz-green-results.json'), JSON.stringify({ prefijo, resultados, fuentesEntrada }, null, 2));
}
try {
  await db`insert into tecnicos(id,nombre,fuente) values(${tecnico},${prefijo + ' TEI'},'app')`;
  await db`insert into tecnico_roles(tecnico_id,rol) values(${tecnico},'inicio')`;
  for (const tipo of ['crear', 'restaurar', 'duplicar'] as const) {
    await caso(tipo + '-cierre-gana', async () => {
      const x = await preparar(tipo), antes = await foto(x);
      const b = await barrera('hitos_proyecto', `new.proyecto_id='${x.p}'::uuid and new.tipo='cierre'`);
      let cierre: ReturnType<typeof registrarHitoProyecto> | undefined;
      let operacion: Promise<unknown> | undefined;
      try {
        cierre = registrarHitoProyecto(hito(x.p));
        const cerrando = await esperarBloqueadoPor(b.pid);
        operacion = mutar(tipo, x).then(v => ({ ok: true as const, v }), error => ({ ok: false as const, error }));
        const esperando = await esperarBloqueadoPor(cerrando.pid);
        assert.match(esperando.query, /select id,localizacion_id,sede_id from salas[\s\S]*for update/);
        await b.liberar();
        assert.equal(await acotado(cierre), undefined);
        const r = await acotado(operacion) as { ok: boolean; error: unknown };
        assert.equal(r.ok, false);
        const error = r.error as { code: string; message: string };
        assert.equal(error.code, '40001');
        const http = errorRevisionDiseno(error);
        assert.equal(http.status, 409);
        assert.match(http.headers.get('cache-control')!, /no-store/);
        const mensaje = await http.json();
        assert.equal(mensaje.error, 'El diseño cambió durante la operación. Recarga y compara antes de continuar.');
        const despues = await foto(x);
        comprobarSoloContexto(antes, despues);
        assert.equal((await e3.leerDiseno(db, x.s)).cerrado, true);
        const repeticion = await comprobarRepeticion(x);
        await writeFile(resolve(salida, tipo + '-cierre-gana-fotos.json'), JSON.stringify({ fixture: x, antes, despues, esperando }, null, 2));
        return { sala: x.s, proyecto: x.p, esperaReal: esperando, codigo: error.code, http: http.status, sinCopiasNiRevisionesNiEscrituras: true, hashVersionesXYZIdsYCableIdIdenticos: true, sinDeadlock: true, repeticion };
      } finally { await b.liberar(); await Promise.allSettled([cierre, operacion].filter(Boolean)); await b.retirar(); }
    });
    await caso(tipo + '-E3-gana', async () => {
      const x = await preparar(tipo), antes = await foto(x);
      const bE3 = await barrera('revisiones_diseno', `new.sala_id='${x.s}'::uuid`);
      const bCierre = await barrera('hitos_proyecto', `new.proyecto_id='${x.p}'::uuid and new.tipo='cierre'`);
      let cierre: ReturnType<typeof registrarHitoProyecto> | undefined;
      let operacion: Promise<unknown> | undefined;
      try {
        operacion = mutar(tipo, x);
        const autorE3 = await esperarBloqueadoPor(bE3.pid);
        cierre = registrarHitoProyecto(hito(x.p));
        const esperando = await esperarBloqueadoPor(autorE3.pid);
        assert.match(esperando.query, /select s.id from salas[\s\S]*for update of s/);
        await bE3.liberar();
        const r = await acotado(operacion);
        await esperarBloqueadoPor(bCierre.pid);
        const trasE3 = await foto(x);
        if (tipo === 'crear') {
          assert.equal((trasE3.revisiones_diseno as unknown[]).length, (antes.revisiones_diseno as unknown[]).length + 1);
          assert.deepEqual(trasE3.disenos, antes.disenos);
        }
        if (tipo === 'restaurar') {
          assert.equal((trasE3.revisiones_diseno as unknown[]).length, (antes.revisiones_diseno as unknown[]).length + 2);
          assert.equal((await e3.leerDiseno(db, x.s)).base.hash, x.objetivo!.hash);
          const [equipo] = await db`select x_m from sala_equipos where id=${x.equipo1}`;
          assert.equal(Number(equipo.x_m), 4);
        }
        if (tipo === 'duplicar') {
          const copia = r as Awaited<ReturnType<typeof e3.duplicarSalaDiseno>>;
          assert.equal((trasE3.salas as unknown[]).length, 2);
          assert.equal((trasE3.revisiones_diseno as unknown[]).length, 2);
          const origen = await e3.leerDiseno(db, x.s), clon = await e3.leerDiseno(db, copia.salaId);
          assert.deepEqual(origen.base, x.base);
          assert.equal(clon.snapshot.datos.conexiones[0].identificador_cable, origen.snapshot.datos.conexiones[0].identificador_cable);
          assert.equal(clon.snapshot.datos.equipos.length, 2);
        }
        await bCierre.liberar();
        assert.equal(await acotado(cierre), undefined);
        const despues = await foto(x);
        comprobarSoloContexto(trasE3, despues);
        const repeticion = await comprobarRepeticion(x);
        await writeFile(resolve(salida, tipo + '-E3-gana-fotos.json'), JSON.stringify({ fixture: x, antes, trasE3, despues, esperando }, null, 2));
        return { sala: x.s, proyecto: x.p, esperaReal: esperando, mutacionConfirmada: true, cierrePosteriorSinCambiarDiseno: true, hashVersionesXYZIdsYCableIdIdenticosTrasCierre: true, sinDeadlock: true, repeticion };
      } finally { await bE3.liberar(); await bCierre.liberar(); await Promise.allSettled([cierre, operacion].filter(Boolean)); await bE3.retirar(); await bCierre.retirar(); }
    });
  }
  const fuentesFinal = await hashes();
  assert.deepEqual(fuentesFinal, fuentesEntrada);
  const [{ activa }] = await db`select tgenabled activa from pg_trigger where tgname='e3_revision_inmutable' and tgrelid='revisiones_diseno'::regclass`;
  assert.equal(activa, 'O');
  await writeFile(resolve(salida, 'fuentes-final.json'), JSON.stringify({ fuentesEntrada, fuentesFinal, e3SinEdiciones: true, guardaRevisiones: activa }, null, 2));
  console.log(`${resultados.length}/${resultados.length} carreras reales cierre/E3 aprobadas, más6 repeticiones ON CONFLICT sin timestamps.`);
} finally { await db.end(); await global.__sql?.end(); }

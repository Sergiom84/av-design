/**
 * Regresión del fallo P1: `guardarEquipo`, `ajustarCantidadEquipo` y
 * `borrarEquipo` comprobaban el cierre de la sala que mandaba el formulario
 * (`sala_id`), pero el `update`/`delete` de debajo iba solo por el `id` del
 * equipo. Un `sala_id` suplantado —de una sala abierta, o inventado— dejaba
 * pasar la guarda y escribía igual sobre un equipo de una sala cerrada.
 *
 * No es parte de `npm test`: `npm test` es la lógica pura de `src/lib`
 * (AGENTS.md), y esto necesita Postgres real e importa `src/app/acciones.ts`
 * (código de servidor, no de librería pura). Se ejecuta a mano:
 *
 *   npx tsx scripts/verificar-guarda-equipos.mts
 *
 * Usa la base local de docker-compose (`DATABASE_URL` o el valor por
 * defecto de desarrollo). Crea sus propios datos de prueba (proyecto,
 * localización, dos salas y un equipo) y los borra al terminar, incluso si
 * una comprobación falla. `acciones.ts` importa `server-only`, que solo
 * resuelve dentro del bundler de Next: este script se planta un stub local
 * en `node_modules/server-only` antes de importar y lo retira al acabar.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

process.env.DATABASE_URL ??= 'postgres://av_design:av_design_local@localhost:5433/av_design';

const RUTA_STUB = 'node_modules/server-only';
mkdirSync(RUTA_STUB, { recursive: true });
writeFileSync(`${RUTA_STUB}/package.json`, '{"name":"server-only","main":"index.js"}');
writeFileSync(`${RUTA_STUB}/index.js`, 'module.exports = {};\n');

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });

let ok = true;
const afirmar = (cond: boolean, mensaje: string) => {
  console.log(`${cond ? 'OK   ' : 'FALLO'} ${mensaje}`);
  if (!cond) ok = false;
};

const proyectoId = crypto.randomUUID();
const localizacionId = crypto.randomUUID();
const salaCerradaId = crypto.randomUUID();
const salaSenueloId = crypto.randomUUID();
const equipoId = crypto.randomUUID();

async function limpiar() {
  await sql`delete from sala_equipos where id = ${equipoId}`;
  await sql`delete from salas where id in (${salaCerradaId}, ${salaSenueloId})`;
  await sql`delete from hitos_proyecto where proyecto_id = ${proyectoId}`;
  await sql`delete from localizaciones where id = ${localizacionId}`;
  await sql`delete from proyectos where id = ${proyectoId}`;
}

try {
  await limpiar(); // por si quedó algo de una ejecución anterior interrumpida

  await sql`insert into proyectos (id, nombre) values (${proyectoId}, 'TEST-guarda-equipos')`;
  await sql`insert into localizaciones (id, proyecto_id, nombre) values (${localizacionId}, ${proyectoId}, 'TEST')`;
  await sql`insert into hitos_proyecto (proyecto_id, tipo, fecha) values (${proyectoId}, 'cierre', now())`;
  await sql`insert into salas (id, nombre, localizacion_id, largo_m, ancho_m, alto_m)
            values (${salaCerradaId}, 'TEST sala cerrada', ${localizacionId}, 3, 3, 3)`;
  // Sala señuelo: existe, está abierta (sin proyecto), y es la que se manda
  // como `sala_id` en el ataque en vez de la real.
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m)
            values (${salaSenueloId}, 'TEST sala señuelo abierta', 3, 3, 3)`;
  await sql`insert into sala_equipos (id, sala_id, nombre, cantidad, extremo, x_m, y_m, z_m)
            values (${equipoId}, ${salaCerradaId}, 'TEST equipo', 1, 'pared', 0, 0, 0)`;

  const { guardarEquipo, ajustarCantidadEquipo, borrarEquipo } = await import(
    '../src/app/acciones'
  );

  // Si la guarda fallara, la acción seguiría hasta `revalidatePath`, que
  // fuera de una petición real de Next lanza un error propio (no de
  // permisos). Se traga aquí para poder comprobar el estado de la fila de
  // todas formas: lo que importa es qué quedó escrito, no si Next se quejó.
  const invocar = async (accion: (d: FormData) => Promise<void>, datos: FormData) => {
    try {
      await accion(datos);
    } catch (e) {
      console.log(`  (la acción llegó más allá de la guarda: ${(e as Error).message})`);
    }
  };

  const filaEquipo = async () => {
    const [f] = await sql<Array<{ cantidad: number; nombre: string }>>`
      select cantidad, nombre from sala_equipos where id = ${equipoId}`;
    return f;
  };

  console.log('\n--- ataque: sala_id suplantado (sala señuelo abierta) ---');

  const original = await filaEquipo();

  const fdAjustar = new FormData();
  fdAjustar.set('id', equipoId);
  fdAjustar.set('sala_id', salaSenueloId); // suplantado
  fdAjustar.set('paso', '1');
  await invocar(ajustarCantidadEquipo, fdAjustar);
  const tras1 = await filaEquipo();
  afirmar(
    tras1.cantidad === original.cantidad,
    `ajustarCantidadEquipo con sala_id suplantado: cantidad ${original.cantidad} → ${tras1.cantidad}`,
  );

  const fdGuardar = new FormData();
  fdGuardar.set('id', equipoId);
  fdGuardar.set('sala_id', salaSenueloId); // suplantado
  fdGuardar.set('nombre', 'NOMBRE-COLADO');
  await invocar(guardarEquipo, fdGuardar);
  const tras2 = await filaEquipo();
  afirmar(
    tras2.nombre === original.nombre,
    `guardarEquipo con sala_id suplantado: nombre "${original.nombre}" → "${tras2.nombre}"`,
  );

  const fdBorrar = new FormData();
  fdBorrar.set('id', equipoId);
  fdBorrar.set('sala_id', salaSenueloId); // suplantado
  await invocar(borrarEquipo, fdBorrar);
  const [sigueAhi] = await sql`select id from sala_equipos where id = ${equipoId}`;
  afirmar(Boolean(sigueAhi), 'borrarEquipo con sala_id suplantado: el equipo sigue existiendo');

  console.log('\n--- ataque: sala_id inventado (no existe ninguna sala con ese id) ---');
  const fdInventado = new FormData();
  fdInventado.set('id', equipoId);
  fdInventado.set('sala_id', crypto.randomUUID());
  fdInventado.set('paso', '1');
  await invocar(ajustarCantidadEquipo, fdInventado);
  const tras3 = await filaEquipo();
  afirmar(
    tras3.cantidad === original.cantidad,
    `ajustarCantidadEquipo con sala_id inventado: cantidad ${original.cantidad} → ${tras3.cantidad}`,
  );

  console.log('\n--- control: sala_id real (la misma sala cerrada) sigue bloqueada ---');
  const fdReal = new FormData();
  fdReal.set('id', equipoId);
  fdReal.set('sala_id', salaCerradaId);
  fdReal.set('paso', '1');
  await invocar(ajustarCantidadEquipo, fdReal);
  const tras4 = await filaEquipo();
  afirmar(
    tras4.cantidad === original.cantidad,
    `ajustarCantidadEquipo con sala_id real (cerrada): cantidad ${original.cantidad} → ${tras4.cantidad}`,
  );
} finally {
  await limpiar();
  await sql.end();
  rmSync(RUTA_STUB, { recursive: true, force: true });
}

console.log(ok ? '\nTodo bloqueado como se espera.' : '\nHay un fallo: revisar arriba.');
if (!ok) process.exitCode = 1;

/**
 * La migración del rol de mobiliario, aplicada sobre la versión ANTERIOR.
 *
 *   npm run test:migracion
 *
 * Por qué existe este verificador y no basta con `npm run db:reset`:
 *
 * Un reset parte del esquema y la siembra nuevos, así que el rol llega desde
 * `data/mobiliario.csv` y todo cuadra. La base real no se resetea: se le
 * aplica la migración encima de lo que ya tiene. Si la migración solo AÑADE la
 * columna, los cuatro muebles que ya existen se quedan con `rol = null`, y con
 * el rol nulo la silla deja de ser asiento: el aforo vuelve a repartir sillas
 * junto a las filas reales y cada silla se dibuja dos veces. Que el fallo se
 * corrija «ejecutando después el seed» no es una corrección: es una
 * instrucción que alguien tiene que acordarse de seguir.
 *
 * Qué hace, sobre una base EFÍMERA que se crea y se destruye aquí:
 *
 * 1. Levanta el esquema y la siembra del commit anterior a la migración.
 * 2. Aplica la migración y comprueba los roles INMEDIATAMENTE, sin sembrar.
 * 3. La aplica otra vez y vuelve a comprobar: tiene que ser idempotente.
 * 4. Repite el mismo control sobre un reset limpio con el esquema y la
 *    siembra actuales, para que las dos rutas terminen en el mismo sitio.
 *
 * La base efímera se llama `av_design_mig_<aleatorio>` y se borra siempre.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

/** El commit donde se cerró el mobiliario, sin la columna `rol`. */
const COMMIT_ANTERIOR = 'a415abf';

const URL_BASE =
  process.env.DATABASE_URL ?? 'postgres://av_design:av_design_local@localhost:5433/av_design';

const nombreEfimera = `av_design_mig_${Math.floor(Math.random() * 1e9).toString(36)}`;
const urlEfimera = URL_BASE.replace(/\/[^/?]+(\?|$)/, `/${nombreEfimera}$1`);

let ok = true;
let total = 0;
let pasadas = 0;
const afirmar = (cond: boolean, mensaje: string) => {
  total += 1;
  if (cond) pasadas += 1;
  console.log(`${cond ? 'OK   ' : 'FALLO'} ${mensaje}`);
  if (!cond) ok = false;
};

/** El contenido de un fichero tal y como estaba en el commit anterior. */
const comoEstaba = (ruta: string): string =>
  execFileSync(
    'git',
    ['-C', process.env.AV_DESIGN_RAIZ_GIT ?? process.cwd(), 'show', `${COMMIT_ANTERIOR}:${ruta}`],
    { encoding: 'utf8' },
  );

const administracion = postgres(URL_BASE, { max: 1, ssl: false });

async function aplicar(sql: postgres.Sql, texto: string, etiqueta: string) {
  try {
    await sql.unsafe(texto);
  } catch (e) {
    console.error(`error aplicando ${etiqueta}:`, e instanceof Error ? e.message : e);
    throw e;
  }
}

/**
 * Aplica la migración sin reventar el verificador.
 *
 * La propia migración aborta a propósito cuando el reparto de roles no queda
 * completo, y eso es correcto: mejor no aplicarla que aplicarla a medias. Aquí
 * se recoge para que salga como una comprobación con nombre en vez de como una
 * excepción que corta el resto y no dice qué contrato se rompió.
 */
async function aplicarMigracion(sql: postgres.Sql, etiqueta: string): Promise<boolean> {
  try {
    await sql.unsafe(migracion);
    return true;
  } catch (e) {
    console.log(`     (${etiqueta} abortó: ${e instanceof Error ? e.message : e})`);
    return false;
  }
}

/** Los roles del catálogo, contados por lo que significan. */
async function rolesDe(sql: postgres.Sql) {
  // Si la migración abortó, la columna puede no existir siquiera: se cuenta
  // como cero de todo en vez de romper, para que falle la comprobación que
  // habla de roles y no una consulta.
  try {
    const [f] = await sql<Array<{ asientos: string; mesas: string; nulos: string; total: string }>>`
      select
        count(*) filter (where rol = 'asiento')::text        as asientos,
        count(*) filter (where rol = 'mesa_principal')::text as mesas,
        count(*) filter (where rol is null)::text            as nulos,
        count(*)::text                                       as total
      from catalogo_mobiliario where fuente = 'csv'`;
    return f;
  } catch {
    return { asientos: '0', mesas: '0', nulos: '0', total: '0' };
  }
}

const migracion = readFileSync('db/migraciones/2026-08-rol-mobiliario.sql', 'utf8');

try {
  await administracion.unsafe(`create database ${nombreEfimera}`);
  console.log(`base efímera ${nombreEfimera}\n`);

  // ------------------------------------------------- 1 · la versión anterior
  {
    const sql = postgres(urlEfimera, { max: 1, ssl: false });
    try {
      await aplicar(sql, comoEstaba('db/schema.sql'), 'esquema anterior');
      await aplicar(sql, comoEstaba('db/seed.sql'), 'siembra anterior');

      const [{ existe }] = await sql<Array<{ existe: boolean }>>`
        select exists (
          select 1 from information_schema.columns
          where table_name = 'catalogo_mobiliario' and column_name = 'rol'
        ) as existe`;
      afirmar(!existe, 'la versión anterior no tiene la columna: el punto de partida es el real');

      const [{ cuantos }] = await sql<Array<{ cuantos: string }>>`
        select count(*)::text as cuantos from catalogo_mobiliario`;
      afirmar(Number(cuantos) === 4, 'y tiene sus cuatro muebles sembrados');

      // --------------------------------------- 2 · primera aplicación, sin sembrar
      const primeraOk = await aplicarMigracion(sql, 'migración (primera vez)');
      afirmar(primeraOk, 'la migración se aplica sobre la versión anterior sin abortar');

      const primera = await rolesDe(sql);
      afirmar(
        Number(primera.asientos) === 1,
        'tras migrar hay exactamente un asiento, SIN volver a sembrar',
      );
      afirmar(
        Number(primera.mesas) === 1,
        'y exactamente una mesa principal, SIN volver a sembrar',
      );
      afirmar(
        Number(primera.nulos) === Number(primera.total) - 2,
        'y el resto del mobiliario se queda con rol nulo, sin inventarle papel',
      );

      const [silla] = primeraOk
        ? await sql<Array<{ rol: string | null }>>`
            select rol from catalogo_mobiliario where clave = 'silla'`
        : [];
      afirmar(
        primeraOk && silla?.rol === 'asiento',
        'la silla es asiento por su clave, no por su nombre',
      );

      // ------------------------------------------------- 3 · segunda aplicación
      const segundaOk = primeraOk && (await aplicarMigracion(sql, 'migración (segunda vez)'));
      afirmar(segundaOk, 'y se puede aplicar otra vez');
      const segunda = await rolesDe(sql);
      afirmar(
        segundaOk && JSON.stringify(segunda) === JSON.stringify(primera),
        'aplicarla dos veces deja exactamente lo mismo',
      );

      // Un mueble dado de alta desde la aplicación no se toca: la migración
      // reparte roles por clave canónica, no por parecido.
      await sql`
        insert into catalogo_mobiliario (clave, nombre, categoria, forma, fuente)
        values ('test-armario', 'Armario', 'Almacenaje', 'rectangulo', 'app')`;
      const terceraOk =
        segundaOk && (await aplicarMigracion(sql, 'migración (tercera vez, con mueble ajeno)'));
      const [armario] = terceraOk
        ? await sql<Array<{ rol: string | null }>>`
            select rol from catalogo_mobiliario where clave = 'test-armario'`
        : [];
      afirmar(
        terceraOk && armario?.rol === null,
        'un mueble desconocido no recibe rol ni se transforma',
      );
    } finally {
      await sql.end();
    }
  }

  // ------------------------------------------- 4 · el reset limpio de hoy
  {
    const nombreLimpia = `${nombreEfimera}_hoy`;
    await administracion.unsafe(`create database ${nombreLimpia}`);
    const urlLimpia = URL_BASE.replace(/\/[^/?]+(\?|$)/, `/${nombreLimpia}$1`);
    const sql = postgres(urlLimpia, { max: 1, ssl: false });
    try {
      await aplicar(sql, readFileSync('db/schema.sql', 'utf8'), 'esquema actual');
      await aplicar(sql, readFileSync('db/seed.sql', 'utf8'), 'siembra actual');
      const limpia = await rolesDe(sql);
      afirmar(
        Number(limpia.asientos) === 1 && Number(limpia.mesas) === 1,
        'un reset desde cero termina en el mismo reparto de roles que la migración',
      );
    } finally {
      await sql.end();
      await administracion.unsafe(`drop database if exists ${nombreLimpia} with (force)`);
    }
  }
} finally {
  await administracion.unsafe(`drop database if exists ${nombreEfimera} with (force)`);
  console.log(`\nbase efímera ${nombreEfimera} eliminada`);
  await administracion.end();
}

console.log(`\n${pasadas}/${total} comprobaciones`);
if (!ok) process.exit(1);

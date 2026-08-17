/**
 * Crea (o restablece) el administrador de la aplicación.
 *
 *   npm run usuarios:admin -- --usuario=xe05206 --nombre="Nombre Apellido"
 *
 * Existe porque hay un problema del huevo y la gallina: el alta de usuarios
 * está dentro de la aplicación, y a la aplicación se entra con un usuario. Una
 * base recién migrada no tiene ninguno, así que alguien tiene que poner el
 * primero desde fuera. A partir de ahí, todas las altas se hacen en
 * `/usuarios`, que es donde se ven.
 *
 * También sirve para el día que el administrador se quede fuera: vuelve a
 * ejecutarse sobre el mismo usuario y le pone otra contraseña provisional.
 *
 * La contraseña **no se pasa por argumento**: se teclea cuando el programa la
 * pide. Un argumento se queda en el historial del intérprete de órdenes, en la
 * lista de procesos y, si esto se ejecutara desde un despliegue, en su
 * registro. Se acepta `CLAVE_ADMIN` en el entorno para automatizarlo, y avisa.
 *
 * Contra una base que no sea local hay que teclear su nombre:
 *
 *   npm run usuarios:admin -- --usuario=xe05206 --confirmo=<nombre_de_la_base>
 *
 * Mismo trato que `npm run migrar:sillas`: crear una llave de administrador en
 * producción sin querer es exactamente el accidente que hay que estorbar.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, env, exit } from 'node:process';
import postgres from 'postgres';

import { cifrarClave, motivoClaveInvalida } from '../src/lib/contrasena';
import { normalizarUsuario, usuarioValido } from '../src/lib/usuarios';

function argumento(nombre: string): string | undefined {
  const encontrado = argv.find((a) => a.startsWith(`--${nombre}=`));
  return encontrado?.slice(nombre.length + 3);
}

const URL_BD =
  env.DATABASE_URL ?? 'postgres://av_design:av_design_local@localhost:5433/av_design';

const esLocal = URL_BD.includes('localhost') || URL_BD.includes('127.0.0.1');
const nombreBase = URL_BD.split('/').pop()?.split('?')[0] ?? '';

const usuario = normalizarUsuario(argumento('usuario') ?? '');
const nombre = argumento('nombre') ?? '';
const confirmo = argumento('confirmo');

if (!usuarioValido(usuario)) {
  console.error('Falta --usuario=<codigo>. Letras, números, punto, guion y guion bajo, de 3 a 32.');
  exit(1);
}

if (!esLocal && confirmo !== nombreBase) {
  console.error(
    `La base de destino no es local (${nombreBase}).\n` +
      `Para escribir en ella hay que nombrarla: --confirmo=${nombreBase}`,
  );
  exit(1);
}

const sql = postgres(URL_BD, { max: 1, ssl: esLocal ? false : 'require' });

async function pedirClave(): Promise<string> {
  const delEntorno = env.CLAVE_ADMIN;
  if (delEntorno) {
    console.warn('Aviso: usando CLAVE_ADMIN del entorno. Bórrala del entorno después.');
    return delEntorno;
  }

  const consola = createInterface({ input: stdin, output: stdout });
  try {
    // Sin ocultarla: ocultar la entrada de forma fiable en todos los terminales
    // de Windows no es trivial, y prometer que no se ve cuando sí se ve es peor
    // que decir la verdad. Es provisional y hay que cambiarla al entrar.
    const clave = await consola.question('Contraseña provisional (se verá al teclearla): ');
    return clave.trim();
  } finally {
    consola.close();
  }
}

try {
  const existentes = await sql<{ id: string; nombre: string; rol: string }[]>`
    select id, nombre, rol::text as rol from usuarios where usuario = ${usuario}
  `;
  const existente = existentes[0];

  if (!existente && !nombre) {
    console.error('Es un alta nueva: falta --nombre="Nombre Apellido".');
    exit(1);
  }

  const clave = await pedirClave();
  const motivo = motivoClaveInvalida(clave, usuario);
  if (motivo) {
    console.error(motivo);
    exit(1);
  }

  const hash = await cifrarClave(clave);

  if (existente) {
    await sql`
      update usuarios
         set rol = 'admin',
             activo = true,
             clave_hash = ${hash},
             debe_cambiar_clave = true,
             clave_cambiada_en = null,
             nombre = coalesce(nullif(${nombre}, ''), nombre)
       where id = ${existente.id}
    `;
    console.log(`Administrador ${usuario} restablecido. Tendrá que cambiar la contraseña al entrar.`);
  } else {
    await sql`
      insert into usuarios (usuario, nombre, rol, clave_hash, debe_cambiar_clave)
      values (${usuario}, ${nombre}, 'admin', ${hash}, true)
    `;
    console.log(`Administrador ${usuario} creado. Tendrá que cambiar la contraseña al entrar.`);
  }

  const cuantos = await sql<{ n: string }[]>`
    select count(*)::text as n from usuarios where activo and rol = 'admin'
  `;
  console.log(`Administradores activos: ${cuantos[0]?.n ?? '?'}`);
} catch (e) {
  console.error('No se pudo crear el administrador:');
  console.error(e instanceof Error ? e.message : e);
  exit(1);
} finally {
  await sql.end();
}

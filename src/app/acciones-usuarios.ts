'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { TransactionSql } from 'postgres';

import { sql } from '@/lib/db';
import { cifrarClave, motivoClaveInvalida } from '@/lib/contrasena';
import { exigirAdmin } from '@/lib/sesion-servidor';
import {
  esAcceso,
  esRol,
  esSeccion,
  excepcionesReales,
  IDS_SECCION,
  normalizarUsuario,
  usuarioValido,
  type Acceso,
  type Rol,
  type Seccion,
} from '@/lib/usuarios';

/**
 * El alta y el mantenimiento de usuarios. Solo administrador.
 *
 * Todo lo de aquí puede dejar a alguien fuera de la aplicación, así que hay dos
 * guardas que se repiten y no son adorno:
 *
 * 1. No se puede dejar la aplicación sin administradores activos. Recuperarlo
 *    sería entrar a la base a mano, y quien lo necesita justo entonces es quien
 *    no puede entrar.
 * 2. No se puede uno desactivar ni degradarse a sí mismo. Es el mismo problema
 *    en pequeño, y llega antes.
 */

/*
  Las rutas de aquí se montan en tiempo de ejecución (llevan el identificador o
  un mensaje), así que `typedRoutes` no las puede verificar. Se concentra el
  `as never` en un solo sitio en vez de repetirlo en quince llamadas: los
  enlaces estáticos sí los sigue comprobando el compilador.
*/
function irA(ruta: string): never {
  redirect(ruta as never);
}

const ERROR = (mensaje: string) => `/usuarios?error=${encodeURIComponent(mensaje)}`;

/**
 * Coge todos los administradores activos en un orden único.
 *
 * Cambiar el rol o dar de baja a uno es un cambio del conjunto entero de
 * administradores, no solo de su fila. Sin estos cerrojos, dos peticiones que
 * quitan dos administradores distintos pueden ver ambas que «queda otro» y
 * dejar la aplicación sin nadie que pueda recuperarla. El orden por id evita
 * que dos peticiones que afectan a personas distintas se esperen en cruz.
 */
async function bloquearAdministradores(tx: TransactionSql): Promise<void> {
  await tx`
    select id
      from usuarios
     where activo and rol = 'admin'
     order by id
     for update
  `;
}

/** Dentro de los cerrojos, dice si quitar a esta persona deja cero admins. */
async function esElUltimoAdmin(tx: TransactionSql, id: string): Promise<boolean> {
  const filas = await tx<{ rol: string; activo: boolean }[]>`
    select rol::text as rol, activo from usuarios where id = ${id}
  `;
  const fila = filas[0];
  if (!fila || fila.rol !== 'admin' || !fila.activo) return false;

  const administradores = await tx<{ n: string }[]>`
    select count(*)::text as n from usuarios where activo and rol = 'admin'
  `;
  return Number(administradores[0]?.n ?? 0) === 1;
}

/**
 * Alta.
 *
 * La contraseña provisional la escribe el administrador y la entrega en mano;
 * no se manda ningún correo, porque el departamento no tiene un buzón por
 * técnico al que mandarlo y un correo con una contraseña dentro se queda ahí
 * para siempre. Nace con `debe_cambiar_clave`, así que esa contraseña solo
 * sirve para una cosa: cambiarla.
 */
export async function crearUsuario(datos: FormData) {
  await exigirAdmin();

  const usuario = normalizarUsuario(String(datos.get('usuario') ?? ''));
  const nombre = String(datos.get('nombre') ?? '').trim();
  const rolTexto = String(datos.get('rol') ?? '');
  const clave = String(datos.get('clave') ?? '');
  const tecnicoId = String(datos.get('tecnico_id') ?? '').trim();

  if (!usuarioValido(usuario)) {
    irA(ERROR('El usuario admite letras, números, punto, guion y guion bajo, de 3 a 32.'));
  }
  if (!nombre) irA(ERROR('Falta el nombre.'));
  if (!esRol(rolTexto)) irA(ERROR('Ese rol no existe.'));

  const motivo = motivoClaveInvalida(clave, usuario);
  if (motivo) irA(ERROR(motivo));

  const repetido = await sql<{ id: string }[]>`
    select id from usuarios where usuario = ${usuario}
  `;
  if (repetido.length > 0) irA(ERROR(`Ya existe el usuario ${usuario}.`));

  await sql`
    insert into usuarios (usuario, nombre, rol, clave_hash, tecnico_id, debe_cambiar_clave)
    values (
      ${usuario},
      ${nombre},
      ${rolTexto}::rol_usuario,
      ${await cifrarClave(clave)},
      ${tecnicoId || null},
      true
    )
  `;

  revalidatePath('/usuarios');
  irA(`/usuarios?alta=${encodeURIComponent(usuario)}`);
}

/** Cambia el rol. Con el rol cambian los permisos de fábrica, no las excepciones. */
export async function cambiarRolUsuario(datos: FormData) {
  const yo = await exigirAdmin();

  const id = String(datos.get('id') ?? '');
  const rolTexto = String(datos.get('rol') ?? '');
  if (!esRol(rolTexto)) irA(ERROR('Ese rol no existe.'));
  const rol: Rol = rolTexto;

  if (id === yo.id && rol !== 'admin') {
    irA(ERROR('No puedes quitarte a ti mismo el rol de administrador.'));
  }
  await sql.begin(async (tx) => {
    await bloquearAdministradores(tx);
    if (rol !== 'admin' && (await esElUltimoAdmin(tx, id))) {
      irA(ERROR('Es el único administrador activo. Nombra otro antes de cambiarle el rol.'));
    }

    await tx`update usuarios set rol = ${rol}::rol_usuario where id = ${id}`;

    // Las excepciones se guardan como diferencia contra el rol. Al cambiar de
    // rol, una excepción que antes decía algo distinto puede haber pasado a
    // coincidir con el nuevo defecto: se limpia lo que ya no es excepción para
    // que la ficha no enseñe ajustes a mano que no ajustan nada.
    await limpiarExcepcionesRedundantes(tx, id, rol);
  });

  revalidatePath('/usuarios');
  irA(`/usuarios/${id}`);
}

/** Guarda las excepciones de permiso de una persona. */
export async function guardarPermisosUsuario(datos: FormData) {
  await exigirAdmin();

  const id = String(datos.get('id') ?? '');
  const filas = await sql<{ rol: string }[]>`
    select rol::text as rol from usuarios where id = ${id}
  `;
  const rolTexto = filas[0]?.rol;
  if (!rolTexto || !esRol(rolTexto)) irA(ERROR('Ese usuario no existe.'));
  const rol: Rol = rolTexto;

  if (rol === 'admin') {
    // `resolverPermisos` ya ignora las excepciones de un administrador; se
    // rechaza además aquí para no guardar en la base algo que no se aplica.
    irA(ERROR('Un administrador lo ve todo: no admite excepciones.'));
  }

  const elegido: Partial<Record<Seccion, Acceso>> = {};
  for (const seccion of IDS_SECCION) {
    const valor = String(datos.get(`acceso_${seccion}`) ?? '');
    if (esSeccion(seccion) && esAcceso(valor)) elegido[seccion] = valor;
  }

  const excepciones = excepcionesReales(rol, elegido);

  await sql.begin(async (tx) => {
    await tx`delete from usuario_permisos where usuario_id = ${id}`;
    for (const [seccion, acceso] of Object.entries(excepciones)) {
      await tx`
        insert into usuario_permisos (usuario_id, seccion, acceso)
        values (${id}, ${seccion}, ${acceso})
      `;
    }
  });

  revalidatePath('/usuarios');
  irA(`/usuarios/${id}?hecho=1`);
}

/**
 * El administrador pone una contraseña provisional nueva.
 *
 * No es «recuperar»: el administrador no puede leer la anterior y nadie puede.
 * Se sustituye por una que él entrega en mano y que solo sirve para cambiarla.
 */
export async function restablecerClaveUsuario(datos: FormData) {
  await exigirAdmin();

  const id = String(datos.get('id') ?? '');
  const clave = String(datos.get('clave') ?? '');

  const filas = await sql<{ usuario: string }[]>`
    select usuario from usuarios where id = ${id}
  `;
  const usuario = filas[0]?.usuario;
  if (!usuario) irA(ERROR('Ese usuario no existe.'));

  const motivo = motivoClaveInvalida(clave, usuario);
  if (motivo) irA(ERROR(motivo));

  await sql`
    update usuarios
       set clave_hash = ${await cifrarClave(clave)},
           debe_cambiar_clave = true,
           clave_cambiada_en = null
     where id = ${id}
  `;

  revalidatePath('/usuarios');
  irA(`/usuarios/${id}?restablecida=1`);
}

/**
 * Baja y alta de acceso.
 *
 * No se borra la fila. Un usuario borrado se lleva por delante el rastro de
 * quién entró y cuándo, y la persona puede volver el mes que viene. Se apaga.
 */
export async function cambiarActivoUsuario(datos: FormData) {
  const yo = await exigirAdmin();

  const id = String(datos.get('id') ?? '');
  const activo = String(datos.get('activo') ?? '') === 'si';

  if (!activo) {
    if (id === yo.id) irA(ERROR('No puedes darte de baja a ti mismo.'));
    await sql.begin(async (tx) => {
      await bloquearAdministradores(tx);
      if (await esElUltimoAdmin(tx, id)) {
        irA(ERROR('Es el único administrador activo. Nombra otro antes de darlo de baja.'));
      }
      await tx`update usuarios set activo = false where id = ${id}`;
    });
  } else {
    await sql`update usuarios set activo = true where id = ${id}`;
  }

  revalidatePath('/usuarios');
  irA(`/usuarios/${id}`);
}

/** Nombre y persona enlazada de la lista de técnicos. */
export async function guardarFichaUsuario(datos: FormData) {
  await exigirAdmin();

  const id = String(datos.get('id') ?? '');
  const nombre = String(datos.get('nombre') ?? '').trim();
  const tecnicoId = String(datos.get('tecnico_id') ?? '').trim();

  if (!nombre) irA(ERROR('Falta el nombre.'));

  await sql`
    update usuarios
       set nombre = ${nombre}, tecnico_id = ${tecnicoId || null}
     where id = ${id}
  `;

  revalidatePath('/usuarios');
  irA(`/usuarios/${id}?hecho=1`);
}

async function limpiarExcepcionesRedundantes(
  tx: TransactionSql,
  id: string,
  rol: Rol,
): Promise<void> {
  const filas = await tx<{ seccion: string; acceso: string }[]>`
    select seccion, acceso from usuario_permisos where usuario_id = ${id}
  `;

  const elegido: Partial<Record<Seccion, Acceso>> = {};
  for (const { seccion, acceso } of filas) {
    if (esSeccion(seccion) && esAcceso(acceso)) elegido[seccion] = acceso;
  }

  const utiles = excepcionesReales(rol, elegido);
  const sobran = filas
    .map((f) => f.seccion)
    .filter((s) => !(s in utiles));

  if (sobran.length > 0) {
    await tx`
      delete from usuario_permisos
       where usuario_id = ${id} and seccion in ${tx(sobran)}
    `;
  }
}

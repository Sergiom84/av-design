'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  borrarRevision,
  cerrarRevision,
  crearRevision,
  desmarcarPunto,
  guardarCabecera,
  marcarPunto,
} from '@/lib/datos-checkin';
import type { EstadoPunto } from '@/lib/tipos';

/**
 * Escritura del check-in de sala.
 *
 * Va aparte de `acciones.ts` y de `acciones-almacen.ts` por lo mismo que su
 * módulo de datos: el check-in es un bloque entero.
 *
 * Aquí no hay lógica: se lee el formulario, se llama a `datos-checkin.ts` y se
 * revalida. Quién puede cerrar y qué puntos lleva una visita se decide en
 * `src/lib/checkin.ts`, que es pura y tiene pruebas.
 */

const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

const ESTADOS: readonly EstadoPunto[] = [
  'pendiente',
  'conforme',
  'incidencia',
  'no_aplica',
];

/** Un estado que no reconocemos no se escribe: llega de un formulario. */
function estadoValido(v: FormDataEntryValue | null): EstadoPunto | null {
  const s = texto(v);
  return ESTADOS.includes(s as EstadoPunto) ? (s as EstadoPunto) : null;
}

function refrescarVisita(id: string) {
  revalidatePath(`/checkin/${id}`);
  revalidatePath('/checkin');
}

/** Abrir la visita y saltar a ella: quien la crea está en la puerta de la sala. */
export async function crearVisita(datos: FormData) {
  const salaId = texto(datos.get('sala_id'));
  if (!salaId) return;

  const id = await crearRevision({
    salaId,
    nombre: texto(datos.get('nombre')),
    quien: texto(datos.get('quien')),
  });

  revalidatePath('/checkin');
  revalidatePath(`/salas/${salaId}`, 'layout');
  if (id) redirect(`/checkin/${id}`);
}

/**
 * Marcar un punto. Es lo único que se hace de pie en la sala.
 *
 * El estado viaja en el `value` del propio botón pulsado, así que un solo toque
 * guarda el estado, la medida escrita y la nota. Marcar de nuevo el estado que
 * ya tenía lo devuelve a «sin mirar»: es el deshacer de quien se equivoca de
 * botón con el móvil en una mano.
 */
export async function marcarPuntoVisita(datos: FormData) {
  const id = texto(datos.get('id'));
  const revisionId = texto(datos.get('revision_id'));
  const estado = estadoValido(datos.get('estado'));
  if (!id || !revisionId || !estado) return;

  const pideValor = datos.get('pide_valor') != null;

  if (estado === texto(datos.get('estado_actual'))) {
    await desmarcarPunto(id);
  } else {
    await marcarPunto({
      id,
      estado,
      // Si el punto no pide medida, el formulario no trae hueco y `valor` no se
      // toca. Sin esto, marcar borraría lo que se hubiera escrito antes.
      valor: pideValor ? texto(datos.get('valor')) : undefined,
      notas: texto(datos.get('notas')),
    });
  }

  refrescarVisita(revisionId);
}

export async function guardarCabeceraVisita(datos: FormData) {
  const id = texto(datos.get('id'));
  if (!id) return;
  await guardarCabecera({
    id,
    nombre: texto(datos.get('nombre')),
    quien: texto(datos.get('quien')),
    notas: texto(datos.get('notas')),
  });
  refrescarVisita(id);
}

/**
 * Cerrar la visita. Solo se cierra con todos los puntos mirados; la comprobación
 * está en la propia consulta, no en el botón deshabilitado.
 */
export async function cerrarVisita(datos: FormData) {
  const id = texto(datos.get('id'));
  if (!id) return;
  await cerrarRevision(id);
  refrescarVisita(id);
}

export async function borrarVisita(datos: FormData) {
  const id = texto(datos.get('id'));
  const salaId = texto(datos.get('sala_id'));
  if (!id) return;
  await borrarRevision(id);
  revalidatePath('/checkin');
  if (salaId) revalidatePath(`/salas/${salaId}`, 'layout');
  redirect('/checkin');
}

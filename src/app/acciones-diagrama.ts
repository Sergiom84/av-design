'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { esUuid } from '@/lib/uuid';
import { normalizarGrados } from '@/lib/croquis';
import type { PatchPlano } from '@/lib/plano-editor';

/**
 * El guardado del plano: una acción, una transacción, todo o nada.
 *
 * No se reutilizan `guardarSala`, `guardarEquipo` y `guardarToma` porque un
 * guardado del editor toca la sala, cinco equipos y dos rosetas a la vez, y
 * ocho acciones sueltas no son ocho pasos de lo mismo: son ocho maneras de
 * quedarse a medias. Si falla la sexta, las cinco primeras ya están escritas y
 * el plano queda en un estado que nadie dibujó.
 *
 * Reglas que se comprueban en el servidor, no ocultando controles:
 *
 * - La sala se lee de la base por su id; nada de lo que manda el navegador
 *   decide a qué sala pertenece un equipo.
 * - Una obra cerrada es de solo lectura.
 * - La versión que trae el patch tiene que ser la que hay. Si no, alguien
 *   guardó desde otra pestaña y esto sobrescribiría su trabajo en silencio.
 * - Cada equipo y cada roseta del patch tienen que ser de esta sala. Un id de
 *   otra sala, inventado o repetido tumba el guardado entero.
 */

const numeroPlano = z.number().finite().min(-1000).max(1000);

const esquemaEquipo = z.object({
  id: z.string().refine(esUuid, 'id no es un uuid'),
  x_m: numeroPlano,
  y_m: numeroPlano,
  z_m: numeroPlano,
  posicion_confirmada: z.boolean(),
});

const esquemaToma = z.object({
  id: z.string().refine(esUuid, 'id no es un uuid'),
  x_m: numeroPlano.nullable(),
  y_m: numeroPlano.nullable(),
  z_m: numeroPlano.nullable(),
});

/** Una medida de sala es positiva o cero. Cero = todavía sin medir. */
const medida = z.number().finite().min(0).max(1000);

const esquemaSala = z.object({
  largo_m: medida,
  ancho_m: medida,
  alto_m: medida,
  aforo: z.number().int().min(0).max(10000).nullable(),
  mesa_largo_m: medida.nullable(),
  mesa_ancho_m: medida.nullable(),
  mesa_alto_cm: z.number().finite().min(0).max(500).nullable(),
  mesa_x_m: numeroPlano.nullable(),
  mesa_y_m: numeroPlano.nullable(),
  mesa_rotacion_grados: z.number().finite(),
});

const esquemaPatch = z.object({
  sala_id: z.string().refine(esUuid, 'sala_id no es un uuid'),
  versionEsperada: z.number().int().min(0),
  sala: esquemaSala.nullable(),
  equipos: z.array(esquemaEquipo).max(500),
  tomas: z.array(esquemaToma).max(500),
});

export type ResultadoGuardado =
  | { ok: true; version: number }
  | {
      ok: false;
      motivo: 'invalido' | 'no_existe' | 'cerrado' | 'conflicto' | 'ajeno';
      detalle: string;
    };

const MENSAJE: Record<Exclude<ResultadoGuardado & { ok: false }, never>['motivo'], string> = {
  invalido: 'Hay datos del plano que no se pueden guardar.',
  no_existe: 'La sala ya no existe.',
  cerrado: 'La obra está cerrada: el plano no se toca sin reabrirla.',
  conflicto: 'La sala cambió en otra pestaña.',
  ajeno: 'El plano trae algún elemento que no es de esta sala.',
};

const fallo = (motivo: Exclude<ResultadoGuardado & { ok: false }, never>['motivo']): ResultadoGuardado => ({
  ok: false,
  motivo,
  detalle: MENSAJE[motivo],
});

export async function guardarDiagramaSala(patch: PatchPlano): Promise<ResultadoGuardado> {
  const validado = esquemaPatch.safeParse(patch);
  if (!validado.success) return fallo('invalido');
  const p = validado.data;

  // Un id repetido en la lista dejaría el resultado a merced del orden de los
  // `update`. Se rechaza en vez de aplicar el último y llamarlo guardado.
  //
  // Es cinturón y tirantes: el recuento de pertenencia de más abajo cuenta
  // filas distintas, así que una lista con repetidos nunca cuadra con su
  // longitud y también caería allí. Quitar esta comprobación no hace fallar
  // ninguna prueba, y eso es una propiedad de la comprobación, no un hueco.
  if (new Set(p.equipos.map((e) => e.id)).size !== p.equipos.length) return fallo('ajeno');
  if (new Set(p.tomas.map((t) => t.id)).size !== p.tomas.length) return fallo('ajeno');

  const resultado = await sql.begin(async (tx): Promise<ResultadoGuardado> => {
    // `for update` bloquea la fila hasta el commit: dos guardados simultáneos
    // se ponen en fila y el segundo lee la versión que dejó el primero, así
    // que el conflicto se detecta en vez de colarse entre la lectura y el
    // `update`.
    const [sala] = await tx<Array<{ id: string; diagrama_version: number; localizacion_id: string | null }>>`
      select id, diagrama_version, localizacion_id
      from salas where id = ${p.sala_id}
      for update`;
    if (!sala) return fallo('no_existe');

    // La sala legado (sin localización) nunca casa con el join y sigue
    // editable: mismo criterio que el resto de acciones de sala.
    const [cierre] = await tx<Array<{ cerrado: boolean }>>`
      select exists (
        select 1 from hitos_proyecto h
        join localizaciones l on l.proyecto_id = h.proyecto_id
        where l.id = ${sala.localizacion_id} and h.tipo = 'cierre'
      ) as cerrado`;
    if (cierre?.cerrado) return fallo('cerrado');

    if (Number(sala.diagrama_version) !== p.versionEsperada) return fallo('conflicto');

    // Pertenencia: se cuenta contra la base, no contra lo que dice el patch.
    if (p.equipos.length > 0) {
      const ids = p.equipos.map((e) => e.id);
      const [{ cuantos }] = await tx<Array<{ cuantos: string }>>`
        select count(*)::text as cuantos from sala_equipos
        where sala_id = ${p.sala_id} and id in ${tx(ids)}`;
      if (Number(cuantos) !== ids.length) return fallo('ajeno');
    }
    if (p.tomas.length > 0) {
      const ids = p.tomas.map((t) => t.id);
      const [{ cuantos }] = await tx<Array<{ cuantos: string }>>`
        select count(*)::text as cuantos from tomas_red
        where sala_id = ${p.sala_id} and id in ${tx(ids)}`;
      if (Number(cuantos) !== ids.length) return fallo('ajeno');
    }

    if (p.sala) {
      await tx`
        update salas set
          largo_m              = ${p.sala.largo_m},
          ancho_m              = ${p.sala.ancho_m},
          alto_m               = ${p.sala.alto_m},
          aforo                = ${p.sala.aforo},
          mesa_largo_m         = ${p.sala.mesa_largo_m},
          mesa_ancho_m         = ${p.sala.mesa_ancho_m},
          mesa_alto_cm         = ${p.sala.mesa_alto_cm},
          mesa_x_m             = ${p.sala.mesa_x_m},
          mesa_y_m             = ${p.sala.mesa_y_m},
          mesa_rotacion_grados = ${normalizarGrados(p.sala.mesa_rotacion_grados)}
        where id = ${p.sala_id}`;
    }

    // El `sala_id` del `where` es redundante con el recuento de pertenencia de
    // arriba y no lo tumba ninguna prueba: entre el recuento y el `update`
    // nadie puede mover un equipo de sala, porque no existe forma de hacerlo
    // en la aplicación. Se deja porque cuesta cero y porque el día que exista
    // esa forma, esta línea es la que evita el problema.
    for (const e of p.equipos) {
      await tx`
        update sala_equipos set
          x_m = ${e.x_m}, y_m = ${e.y_m}, z_m = ${e.z_m},
          posicion_confirmada = ${e.posicion_confirmada}
        where id = ${e.id} and sala_id = ${p.sala_id}`;
    }

    for (const t of p.tomas) {
      await tx`
        update tomas_red set
          x_m = ${t.x_m}, y_m = ${t.y_m}, z_m = ${t.z_m}
        where id = ${t.id} and sala_id = ${p.sala_id}`;
    }

    // La versión sube aunque el patch venga vacío: guardar es un hecho, y dos
    // pestañas que guardan "nada" a la vez tienen el mismo derecho a enterarse.
    const [nueva] = await tx<Array<{ diagrama_version: number }>>`
      update salas set diagrama_version = diagrama_version + 1
      where id = ${p.sala_id}
      returning diagrama_version`;

    return { ok: true, version: Number(nueva.diagrama_version) };
  });

  if (resultado.ok) {
    // El plano cambia los metros y el material: se refresca la ficha entera,
    // no solo la pestaña del diagrama.
    revalidatePath('/salas/[id]', 'layout');
    revalidatePath('/salas');
    revalidatePath('/');
  }

  return resultado;
}

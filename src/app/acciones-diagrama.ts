'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { esUuid } from '@/lib/uuid';
import { normalizarGrados } from '@/lib/croquis';
import { coordenadasFueraDeSala, type PatchPlano } from '@/lib/plano-editor';
import { extremoPorCategoria } from '@/lib/tipos';

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
 * - Las coordenadas caen dentro de la sala. Que el número sea finito no basta:
 *   el editor recorta contra la pared, pero el recorte del editor es comodidad
 *   y no una guarda, y una petición hecha a mano no pasa por el editor. Se
 *   valida contra las medidas EFECTIVAS —las del propio patch si las cambia—
 *   y se RECHAZA, no se recorta en silencio: recortar guardaría una posición
 *   que nadie decidió y la daría por medida en el cálculo de cable.
 * - De un alta solo se cree el identificador. El nombre, la categoría y el
 *   extremo de un equipo se releen de `articulos`, y se exige activo y de
 *   tipo equipo: un cable o un consumible no es un equipo del plano, y un
 *   nombre que manda el navegador puede no corresponder con la referencia
 *   que después se va a pedir.
 * - Los ids temporales de las altas los inventa el navegador y no se
 *   escriben: cada alta recibe un uuid del servidor y se devuelve el mapa,
 *   para que el editor pueda seguir trabajando sin recargar.
 */

const numeroPlano = z.number().finite().min(-1000).max(1000);

const esquemaEquipo = z.object({
  id: z.string().refine(esUuid, 'id no es un uuid'),
  x_m: numeroPlano,
  y_m: numeroPlano,
  z_m: numeroPlano,
  posicion_confirmada: z.boolean(),
  rotacion_grados: z.number().finite(),
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

/**
 * Un alta de equipo. Solo el `articulo_id` sale de aquí con vida: el resto
 * se relee del catálogo dentro de la transacción.
 */
const esquemaEquipoAlta = esquemaEquipo.extend({
  articulo_id: z.string().refine(esUuid, 'articulo_id no es un uuid'),
  // Viaja por el tipo del patch pero no se usa: el extremo lo decide el
  // servidor a partir de la categoría del artículo.
  extremo: z.string(),
});

const esquemaMueble = z.object({
  id: z.string().refine(esUuid, 'id no es un uuid'),
  nombre: z.string().trim().min(1).max(120),
  largo_m: medida.nullable(),
  ancho_m: medida.nullable(),
  alto_m: medida.nullable(),
  x_m: numeroPlano.nullable(),
  y_m: numeroPlano.nullable(),
  z_m: numeroPlano.nullable(),
  rotacion_grados: z.number().finite(),
  posicion_confirmada: z.boolean(),
  orden: z.number().int().min(0).max(10000),
});

const esquemaMuebleAlta = esquemaMueble.extend({
  mobiliario_id: z.string().refine(esUuid, 'mobiliario_id no es un uuid').nullable(),
  forma: z.enum(['rectangulo', 'circulo']),
});

const esquemaPatch = z.object({
  sala_id: z.string().refine(esUuid, 'sala_id no es un uuid'),
  versionEsperada: z.number().int().min(0),
  sala: esquemaSala.nullable(),
  equipos: z.array(esquemaEquipo).max(500),
  equipos_alta: z.array(esquemaEquipoAlta).max(200),
  mobiliario_alta: z.array(esquemaMuebleAlta).max(200),
  mobiliario_cambio: z.array(esquemaMueble).max(500),
  mobiliario_baja: z.array(z.string().refine(esUuid, 'id no es un uuid')).max(500),
  tomas: z.array(esquemaToma).max(500),
  inicio_diagrama: z
    .object({
      origen: z.enum(['desde_cero', 'plantilla']),
      plantilla_id: z.string().refine(esUuid, 'plantilla_id no es un uuid').nullable(),
    })
    .nullable(),
  sillas_modo: z.enum(['derivadas', 'manuales']).nullable(),
});

export type ResultadoGuardado =
  | {
      ok: true;
      version: number;
      /**
       * Qué uuid real le tocó a cada id temporal. El editor lo aplica sobre su
       * borrador para poder seguir moviendo lo que acaba de crear sin recargar.
       */
      ids: Record<string, string>;
    }
  | {
      ok: false;
      motivo:
        | 'invalido'
        | 'no_existe'
        | 'cerrado'
        | 'conflicto'
        | 'ajeno'
        | 'fuera'
        | 'catalogo';
      detalle: string;
    };

const MENSAJE: Record<Exclude<ResultadoGuardado & { ok: false }, never>['motivo'], string> = {
  invalido: 'Hay datos del plano que no se pueden guardar.',
  no_existe: 'La sala ya no existe.',
  cerrado: 'La obra está cerrada: el plano no se toca sin reabrirla.',
  conflicto: 'La sala cambió en otra pestaña.',
  ajeno: 'El plano trae algún elemento que no es de esta sala.',
  fuera: 'Hay elementos colocados fuera de la sala.',
  catalogo:
    'Alguna referencia no vale: tiene que ser un equipo activo del catálogo, o un mueble activo.',
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

  // Los ids temporales no se escriben, pero sí tienen que ser distintos entre
  // sí y distintos de los que ya existen: un id repetido en las altas dejaría
  // dos sillas compartiendo entrada en el mapa de vuelta, y el editor movería
  // una creyendo mover la otra.
  const temporales = [...p.equipos_alta, ...p.mobiliario_alta].map((x) => x.id);
  if (new Set(temporales).size !== temporales.length) return fallo('ajeno');

  const persistidos = [
    ...p.equipos.map((e) => e.id),
    ...p.mobiliario_cambio.map((m) => m.id),
    ...p.mobiliario_baja,
  ];
  if (temporales.some((id) => persistidos.includes(id))) return fallo('ajeno');
  if (new Set(p.mobiliario_cambio.map((m) => m.id)).size !== p.mobiliario_cambio.length) {
    return fallo('ajeno');
  }
  if (new Set(p.mobiliario_baja).size !== p.mobiliario_baja.length) return fallo('ajeno');
  // Cambiar y borrar el mismo mueble en el mismo guardado no es una intención,
  // es un borrador roto.
  if (p.mobiliario_cambio.some((m) => p.mobiliario_baja.includes(m.id))) return fallo('ajeno');

  const resultado = await sql.begin(async (tx): Promise<ResultadoGuardado> => {
    // `for update` bloquea la fila hasta el commit: dos guardados simultáneos
    // se ponen en fila y el segundo lee la versión que dejó el primero, así
    // que el conflicto se detecta en vez de colarse entre la lectura y el
    // `update`.
    const [sala] = await tx<
      Array<{
        id: string;
        diagrama_version: number;
        localizacion_id: string | null;
        largo_m: string | null;
        ancho_m: string | null;
        alto_m: string | null;
      }>
    >`
      select id, diagrama_version, localizacion_id, largo_m, ancho_m, alto_m
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

    // Las medidas efectivas: las del patch si las cambia, y si no las que hay
    // en la fila bloqueada. Validar contra las viejas rechazaría el caso
    // normal —medir la sala y colocar el equipo en el mismo guardado— y
    // validar contra las nuevas cuando el patch no las trae dejaría entrar
    // cualquier coordenada mandando `sala: null`.
    const medidas = {
      largo_m: p.sala ? p.sala.largo_m : Number(sala.largo_m ?? 0),
      ancho_m: p.sala ? p.sala.ancho_m : Number(sala.ancho_m ?? 0),
      alto_m: p.sala ? p.sala.alto_m : Number(sala.alto_m ?? 0),
    };
    if (coordenadasFueraDeSala(p, medidas).length > 0) return fallo('fuera');

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

    const mueblesTocados = [...p.mobiliario_cambio.map((m) => m.id), ...p.mobiliario_baja];
    if (mueblesTocados.length > 0) {
      const [{ cuantos }] = await tx<Array<{ cuantos: string }>>`
        select count(*)::text as cuantos from sala_mobiliario
        where sala_id = ${p.sala_id} and id in ${tx(mueblesTocados)}`;
      if (Number(cuantos) !== mueblesTocados.length) return fallo('ajeno');
    }

    // ------------------------------------------------------------ catálogos
    //
    // De un alta se relee TODO menos el identificador. Un `<select>` oculto no
    // es una guarda: la petición se puede escribir a mano, y sin esto un cable
    // o un consumible entraría en el plano como si fuera un equipo.
    const articulos = new Map<
      string,
      { nombre: string; categoria: string }
    >();
    if (p.equipos_alta.length > 0) {
      const ids = [...new Set(p.equipos_alta.map((e) => e.articulo_id))];
      const filas = await tx<Array<{ id: string; marca: string | null; modelo: string; categoria: string }>>`
        select id, marca, modelo, categoria from articulos
        where id in ${tx(ids)} and activo and tipo = 'equipo'`;
      if (filas.length !== ids.length) return fallo('catalogo');
      for (const a of filas) {
        articulos.set(a.id, {
          nombre: `${a.marca ?? ''} ${a.modelo}`.trim(),
          categoria: a.categoria,
        });
      }
    }

    const muebles = new Map<string, { nombre: string; forma: string }>();
    if (p.mobiliario_alta.length > 0) {
      const ids = [...new Set(p.mobiliario_alta.map((m) => m.mobiliario_id).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const filas = await tx<Array<{ id: string; nombre: string; forma: string }>>`
          select id, nombre, forma from catalogo_mobiliario
          where id in ${tx(ids)} and activo`;
        if (filas.length !== ids.length) return fallo('catalogo');
        for (const m of filas) muebles.set(m.id, { nombre: m.nombre, forma: m.forma });
      }
    }

    if (p.inicio_diagrama?.plantilla_id) {
      const [existe] = await tx<Array<{ id: string }>>`
        select id from plantillas_sala where id = ${p.inicio_diagrama.plantilla_id}`;
      if (!existe) return fallo('catalogo');
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
          posicion_confirmada = ${e.posicion_confirmada},
          rotacion_grados = ${normalizarGrados(e.rotacion_grados)}
        where id = ${e.id} and sala_id = ${p.sala_id}`;
    }

    for (const t of p.tomas) {
      await tx`
        update tomas_red set
          x_m = ${t.x_m}, y_m = ${t.y_m}, z_m = ${t.z_m}
        where id = ${t.id} and sala_id = ${p.sala_id}`;
    }

    // ------------------------------------------------------- altas y bajas
    //
    // El id temporal no se escribe: cada alta recibe el uuid que le pone
    // Postgres y se devuelve el mapa. Si el navegador pudiera elegir el
    // identificador podría chocar a propósito con una fila de otra sala.
    const ids: Record<string, string> = {};

    for (const e of p.equipos_alta) {
      const a = articulos.get(e.articulo_id)!;
      const [fila] = await tx<Array<{ id: string }>>`
        insert into sala_equipos
          (sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m,
           posicion_confirmada, rotacion_grados)
        values (${p.sala_id}, ${e.articulo_id}, ${a.nombre}, 1,
                ${extremoPorCategoria(a.categoria)}::extremo_cable,
                ${e.x_m}, ${e.y_m}, ${e.z_m}, ${e.posicion_confirmada},
                ${normalizarGrados(e.rotacion_grados)})
        returning id`;
      ids[e.id] = fila.id;
    }

    for (const m of p.mobiliario_alta) {
      // El nombre y la forma salen del catálogo cuando hay catálogo. Un mueble
      // sin referencia —no debería llegar hoy— conserva lo que trae, que es lo
      // único que hay.
      const cat = m.mobiliario_id ? muebles.get(m.mobiliario_id) : undefined;
      const [fila] = await tx<Array<{ id: string }>>`
        insert into sala_mobiliario
          (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m,
           x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
        values (${p.sala_id}, ${m.mobiliario_id}, ${cat?.nombre ?? m.nombre},
                ${cat?.forma ?? m.forma}, ${m.largo_m}, ${m.ancho_m}, ${m.alto_m},
                ${m.x_m}, ${m.y_m}, ${m.z_m},
                ${normalizarGrados(m.rotacion_grados)}, ${m.posicion_confirmada},
                ${m.orden})
        returning id`;
      ids[m.id] = fila.id;
    }

    for (const m of p.mobiliario_cambio) {
      await tx`
        update sala_mobiliario set
          nombre = ${m.nombre},
          largo_m = ${m.largo_m}, ancho_m = ${m.ancho_m}, alto_m = ${m.alto_m},
          x_m = ${m.x_m}, y_m = ${m.y_m}, z_m = ${m.z_m},
          rotacion_grados = ${normalizarGrados(m.rotacion_grados)},
          posicion_confirmada = ${m.posicion_confirmada},
          orden = ${m.orden},
          actualizado_en = now()
        where id = ${m.id} and sala_id = ${p.sala_id}`;
    }

    if (p.mobiliario_baja.length > 0) {
      // Un mueble no es extremo de ninguna tirada, así que borrarlo no deja
      // conexiones colgando. Por eso sí se puede quitar desde el plano y un
      // equipo persistido no.
      await tx`
        delete from sala_mobiliario
        where sala_id = ${p.sala_id} and id in ${tx(p.mobiliario_baja)}`;
    }

    // ---------------------------------------------- inicio y modo de sillas
    //
    // El inicio se escribe una sola vez: `where diagrama_iniciado_en is null`.
    // Volver a mandarlo no puede reescribir la procedencia de una sala que ya
    // se preparó, ni desde otra pestaña ni desde una petición repetida.
    if (p.inicio_diagrama) {
      await tx`
        update salas set
          diagrama_iniciado_en  = now(),
          diagrama_origen       = ${p.inicio_diagrama.origen},
          diagrama_plantilla_id = ${p.inicio_diagrama.plantilla_id}
        where id = ${p.sala_id} and diagrama_iniciado_en is null`;
    }

    // El paso a `manuales` es de ida: una vez materializadas las sillas,
    // volver a `derivadas` las dibujaría dos veces. Volver atrás es borrar las
    // filas, y eso se hace quitándolas una a una.
    if (p.sillas_modo === 'manuales') {
      await tx`
        update salas set sillas_modo = 'manuales'
        where id = ${p.sala_id} and sillas_modo = 'derivadas'`;
    }

    // La versión sube aunque el patch venga vacío: guardar es un hecho, y dos
    // pestañas que guardan "nada" a la vez tienen el mismo derecho a enterarse.
    const [nueva] = await tx<Array<{ diagrama_version: number }>>`
      update salas set diagrama_version = diagrama_version + 1
      where id = ${p.sala_id}
      returning diagrama_version`;

    return { ok: true, version: Number(nueva.diagrama_version), ids };
  });

  if (resultado.ok) {
    // El plano cambia los metros y el material: se refresca la ficha entera,
    // no solo la pestaña del diagrama.
    revalidarLaFicha();
  }

  return resultado;
}

function revalidarLaFicha() {
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/salas');
  revalidatePath('/');
}

/**
 * Declarar que el plano se prepara desde cero.
 *
 * No borra nada, y eso es exactamente lo que significa: la sala conserva sus
 * medidas, sus equipos, sus tiradas y sus rosetas, y el técnico completará a
 * mano lo que falte. Lo único que cambia es que la pestaña deja de preguntar.
 *
 * Es una acción propia y no un `inicio_diagrama` suelto en el patch porque la
 * tarjeta de origen aparece antes de que haya borrador que guardar.
 */
export async function iniciarDiagramaDesdeCero(
  salaId: string,
  versionEsperada: number,
): Promise<ResultadoGuardado> {
  return guardarDiagramaSala({
    sala_id: salaId,
    versionEsperada,
    sala: null,
    equipos: [],
    equipos_alta: [],
    mobiliario_alta: [],
    mobiliario_cambio: [],
    mobiliario_baja: [],
    tomas: [],
    inicio_diagrama: { origen: 'desde_cero', plantilla_id: null },
    sillas_modo: null,
  });
}

// =====================================================================
// Preparar la sala desde una plantilla
//
// «Desde cero» no necesita acción propia: viaja en `inicio_diagrama` del
// patch normal y no borra nada, porque conservar lo que la sala ya tenga es
// justo lo que significa. Aplicar una plantilla sí la necesita, porque copia
// medidas, mesa, mobiliario, equipos, giros y tiradas de golpe.
//
// Las tres situaciones, y por qué no se tratan igual:
//
// - La sala ya nació de ESA plantilla y sus elementos están copiados. Se
//   reconoce y se marca el diagrama como iniciado. Copiar otra vez daría dos
//   pantallas y dos tiradas donde hay una.
// - La sala está vacía. Se copia todo.
// - La sala tiene equipos o tiradas y se pide OTRA plantilla. Se bloquea. Un
//   «merge» aquí sería inventarse a qué equipo de la sala corresponde cada
//   línea de la plantilla nueva, y equivocarse borra tiradas que alguien
//   midió. Se explica y decide el técnico.
// =====================================================================

export type ResultadoPlantilla =
  | { ok: true; version: number; copiado: boolean }
  | {
      ok: false;
      motivo: 'invalido' | 'no_existe' | 'cerrado' | 'conflicto' | 'catalogo' | 'ocupada';
      detalle: string;
    };

export async function aplicarPlantillaAlDiagrama(
  salaId: string,
  plantillaId: string,
  versionEsperada: number,
): Promise<ResultadoPlantilla> {
  if (!esUuid(salaId) || !esUuid(plantillaId) || !Number.isInteger(versionEsperada)) {
    return { ok: false, motivo: 'invalido', detalle: MENSAJE.invalido };
  }

  const resultado = await sql.begin(async (tx): Promise<ResultadoPlantilla> => {
    const [sala] = await tx<
      Array<{
        id: string;
        diagrama_version: number;
        localizacion_id: string | null;
        plantilla_id: string | null;
        diagrama_plantilla_id: string | null;
      }>
    >`
      select id, diagrama_version, localizacion_id, plantilla_id, diagrama_plantilla_id
      from salas where id = ${salaId}
      for update`;
    if (!sala) return { ok: false, motivo: 'no_existe', detalle: MENSAJE.no_existe };

    const [cierre] = await tx<Array<{ cerrado: boolean }>>`
      select exists (
        select 1 from hitos_proyecto h
        join localizaciones l on l.proyecto_id = h.proyecto_id
        where l.id = ${sala.localizacion_id} and h.tipo = 'cierre'
      ) as cerrado`;
    if (cierre?.cerrado) return { ok: false, motivo: 'cerrado', detalle: MENSAJE.cerrado };

    if (Number(sala.diagrama_version) !== versionEsperada) {
      return { ok: false, motivo: 'conflicto', detalle: MENSAJE.conflicto };
    }

    const [plantilla] = await tx<
      Array<{
        id: string;
        aforo: number | null;
        largo_m: string | null;
        ancho_m: string | null;
        alto_m: string | null;
        alto_falso_techo_m: string | null;
        mesa_largo_m: string | null;
        mesa_ancho_m: string | null;
        mesa_alto_cm: string | null;
        mesa_x_m: string | null;
        mesa_y_m: string | null;
        mesa_rotacion_grados: string | null;
      }>
    >`select * from plantillas_sala where id = ${plantillaId}`;
    if (!plantilla) return { ok: false, motivo: 'catalogo', detalle: MENSAJE.catalogo };

    const [ocupacion] = await tx<Array<{ equipos: string; conexiones: string; muebles: string }>>`
      select
        (select count(*) from sala_equipos    where sala_id = ${salaId})::text as equipos,
        (select count(*) from conexiones      where sala_id = ${salaId})::text as conexiones,
        (select count(*) from sala_mobiliario where sala_id = ${salaId})::text as muebles`;
    const vacia =
      Number(ocupacion.equipos) === 0 &&
      Number(ocupacion.conexiones) === 0 &&
      Number(ocupacion.muebles) === 0;

    // La sala que nació de esta misma plantilla ya la tiene aplicada, se mire
    // por `plantilla_id` (el alta) o por `diagrama_plantilla_id` (una
    // aplicación anterior desde aquí).
    const yaEsSuya =
      sala.plantilla_id === plantillaId || sala.diagrama_plantilla_id === plantillaId;

    if (!vacia && !yaEsSuya) {
      return {
        ok: false,
        motivo: 'ocupada',
        detalle:
          'La sala ya tiene equipos o tiradas. Aplicar otra plantilla borraría trabajo medido, así que no se hace desde aquí.',
      };
    }

    if (vacia) {
      const num = (v: string | null) => (v == null ? null : Number(v));
      await tx`
        update salas set
          plantilla_id         = ${plantillaId},
          largo_m              = ${num(plantilla.largo_m) ?? 0},
          ancho_m              = ${num(plantilla.ancho_m) ?? 0},
          alto_m               = ${num(plantilla.alto_m) ?? 0},
          alto_falso_techo_m   = ${num(plantilla.alto_falso_techo_m)},
          aforo                = coalesce(aforo, ${plantilla.aforo}),
          mesa_largo_m         = ${num(plantilla.mesa_largo_m)},
          mesa_ancho_m         = ${num(plantilla.mesa_ancho_m)},
          mesa_alto_cm         = ${num(plantilla.mesa_alto_cm)},
          mesa_x_m             = ${num(plantilla.mesa_x_m)},
          mesa_y_m             = ${num(plantilla.mesa_y_m)},
          mesa_rotacion_grados = ${normalizarGrados(num(plantilla.mesa_rotacion_grados))}
        where id = ${salaId}`;

      const lineas = await tx<
        Array<{
          id: string;
          articulo_id: string | null;
          categoria: string;
          modelo_texto: string | null;
          cantidad: string;
          extremo: string | null;
          x_m: string | null;
          y_m: string | null;
          z_m: string | null;
          posicion_confirmada: boolean | null;
          rotacion_grados: string | null;
        }>
      >`select id, articulo_id, categoria, modelo_texto, cantidad, extremo,
               x_m, y_m, z_m, posicion_confirmada, rotacion_grados
        from plantilla_articulos
        where plantilla_id = ${plantillaId} and not opcional`;

      const equipoDeLinea = new Map<string, string>();
      for (const l of lineas) {
        // La ausencia se propaga como ausencia: una línea sin colocar da un
        // equipo sin colocar y el croquis lo deduce del extremo.
        const colocada =
          l.posicion_confirmada ??
          (Number(l.x_m ?? 0) !== 0 || Number(l.y_m ?? 0) !== 0 || Number(l.z_m ?? 0) !== 0);
        const [equipo] = await tx<Array<{ id: string }>>`
          insert into sala_equipos
            (sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m,
             posicion_confirmada, rotacion_grados, origen_plantilla_linea_id)
          values (${salaId}, ${l.articulo_id}, ${l.modelo_texto ?? l.categoria},
                  ${Math.max(1, Math.round(Number(l.cantidad) || 1))},
                  ${l.extremo ?? extremoPorCategoria(l.categoria)}::extremo_cable,
                  ${Number(l.x_m ?? 0)}, ${Number(l.y_m ?? 0)}, ${Number(l.z_m ?? 0)},
                  ${colocada}, ${normalizarGrados(Number(l.rotacion_grados ?? 0))}, ${l.id})
          returning id`;
        equipoDeLinea.set(l.id, equipo.id);
      }

      // El mobiliario de la plantilla: colocar la silla una vez sirve para las
      // 144 salas iguales. La ausencia de posición se conserva.
      await tx`
        insert into sala_mobiliario
          (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m,
           x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden,
           origen_plantilla_mobiliario_id)
        select ${salaId}, pm.mobiliario_id, pm.nombre, pm.forma,
               pm.largo_m, pm.ancho_m, pm.alto_m,
               pm.x_m, pm.y_m, pm.z_m, pm.rotacion_grados,
               coalesce(pm.posicion_confirmada, pm.x_m is not null and pm.y_m is not null),
               pm.orden, pm.id
        from plantilla_mobiliario pm
        where pm.plantilla_id = ${plantillaId}`;

      const tiradas = await tx<
        Array<{
          origen_linea_id: string;
          destino_linea_id: string;
          articulo_cable_id: string | null;
          senal: string;
          ruta: string | null;
          notas: string | null;
        }>
      >`select origen_linea_id, destino_linea_id, articulo_cable_id, senal, ruta, notas
        from plantilla_conexiones where plantilla_id = ${plantillaId}
        order by orden, creado_en`;

      // Una tirada cuyo equipo no se heredó —la línea estaba marcada «no en
      // todas»— se salta: insertarla apuntando a nada deja la sala con una
      // tirada rota.
      for (const t of tiradas) {
        const origen = equipoDeLinea.get(t.origen_linea_id);
        const destino = equipoDeLinea.get(t.destino_linea_id);
        if (!origen || !destino) continue;
        await tx`
          insert into conexiones (sala_id, origen_id, destino_id, articulo_cable_id, senal, ruta, notas)
          values (${salaId}, ${origen}, ${destino}, ${t.articulo_cable_id},
                  ${t.senal}::senal, ${t.ruta}::ruta_cable, ${t.notas})`;
      }
    }

    // Se marca iniciado en los dos casos: reconocer una plantilla ya heredada
    // también es contestar a la pregunta, y no volver a hacerla.
    await tx`
      update salas set
        diagrama_iniciado_en  = coalesce(diagrama_iniciado_en, now()),
        diagrama_origen       = 'plantilla',
        diagrama_plantilla_id = ${plantillaId}
      where id = ${salaId}`;

    const [nueva] = await tx<Array<{ diagrama_version: number }>>`
      update salas set diagrama_version = diagrama_version + 1
      where id = ${salaId}
      returning diagrama_version`;

    return { ok: true, version: Number(nueva.diagrama_version), copiado: vacia };
  });

  if (resultado.ok) revalidarLaFicha();
  return resultado;
}

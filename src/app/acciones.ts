'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type postgres from 'postgres';
import { z } from 'zod';
import { esUuid } from '@/lib/uuid';
import type { ExtremoConexion } from '@/lib/tipos';
import { bloquearYValidarExtremos, columnasExtremo, ConexionRechazada, esquemaExtremoConexion, escribirParejaConexion } from '@/lib/escritura-conexiones';
import { copiarInfraestructuraYCables, exigirDisenoCopiable } from '@/lib/copiar-conexiones';
import { sql } from '@/lib/db';
import { esErrorConcurrencia, mensajeErrorSqlNegocio, transaccionConControl } from '@/lib/control-escritura';
import { aplicarEstadoCableEnTx, desasignarCablesDeConexiones } from '@/lib/suministros-db';
import type { EstadoSuministroCable } from '@/lib/suministros';
import { sedeId } from '@/lib/sedes';
import { expandirPatron, MAXIMO_COPIAS } from '@/lib/nombres-serie';
import { coordenadasFueraDeSala, puertasFueraDePared } from '@/lib/plano-editor';
import { extremoPorCategoria, MENSAJE_MESA_EN_PLANTILLA } from '@/lib/tipos';
import { exigirEdicion } from '@/lib/sesion-servidor';

/**
 * Lo que el alta devuelve al formulario. `error` nulo es «no ha pasado nada»:
 * el alta correcta no vuelve, redirige.
 */
export interface EstadoAlta {
  error: string | null;
}

export interface EstadoConexion {
  error: string | null;
}

const numero = (v: FormDataEntryValue | null): number | null => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

// --------------------------------------------------- la versión del plano
//
// La ficha de sala son varias pestañas por ruta, pero el plano es uno solo. La
// pestaña Plano guarda con `salas.diagrama_version` optimista: lee la
// versión, la compara al guardar y avisa si otra pestaña se le adelantó
// (`guardarDiagramaSala`, en `acciones-diagrama.ts`).
//
// Resumen, Equipamiento y Tomas escriben los MISMOS datos con acciones
// sueltas. Mientras no tocaban la versión, editar desde ellas dejaba a una
// pestaña de Diagrama abierta creyendo que su número seguía vigente: guardaba
// y sobrescribía el cambio de la otra superficie sin que saltara el aviso,
// porque el número no se había movido.
//
// Qué sube la versión y qué no: sube lo que el editor de plano ESCRIBE —las
// medidas de la sala, la mesa, el aforo, las coordenadas y el giro de un
// equipo, las de una roseta, y el alta o la baja de cualquiera de los dos—,
// porque es lo único que un guardado del plano puede pisar. No sube lo que se
// dibuja pero el editor nunca guarda (una tirada nueva, la cantidad de un
// equipo) ni lo que no se dibuja (una nota, un pedido): convertir cada alta de
// cable en un conflicto haría perder el borrador del plano por un cambio que
// no lo amenaza.

/** Una transacción de `postgres.js`, que es lo que recibe el callback de `sql.begin`. */
type Transaccion = postgres.TransactionSql<Record<string, unknown>>;

/**
 * Deja constancia de que el plano de la sala cambió.
 *
 * Va SIEMPRE dentro de la misma transacción que la escritura que lo cambió: si
 * la escritura se deshace, la versión no puede haber subido, o la pestaña de
 * Diagrama recibiría un conflicto por un cambio que no llegó a existir.
 */
async function subirVersionDelPlano(tx: Transaccion, salaId: string): Promise<void> {
  await tx`
    update salas set diagrama_version = diagrama_version + 1
    where id = ${salaId}`;
}

/**
 * El orden de bloqueo, que es uno solo para todas las superficies.
 *
 * `guardarDiagramaSala` abre su transacción bloqueando la fila de `salas` con
 * `for update` y toca los equipos después. Estas acciones hacían lo contrario:
 * escribían primero en la tabla hija y actualizaban `salas` al final. Dos
 * transacciones simultáneas —una por cada camino— podían quedarse cada una con
 * el cerrojo que la otra esperaba, y eso es un abrazo mortal: Postgres mata a
 * una de las dos y el técnico ve un error que no puede explicar.
 *
 * Aquí el orden es siempre el mismo, y por eso no hay ciclo posible:
 *
 *   1. abrir transacción;
 *   2. bloquear la fila de la sala (`select ... for update`);
 *   3. comprobar DENTRO de la transacción que la sala existe y que su obra no
 *      está cerrada;
 *   4. escribir las filas hijas;
 *   5. subir `diagrama_version` en la misma transacción;
 *   6. commit.
 *
 * El paso 3 no es una repetición de `proyectoCerradoDeSala()`: comprobar el
 * cierre fuera de la transacción deja una ventana entre la comprobación y la
 * escritura por la que cabe entero el cierre de la obra. Con el cerrojo de la
 * sala cogido antes de mirar, el cierre concurrente —que coge los mismos
 * cerrojos y en el mismo orden— o va delante y esto lo ve, o va detrás y espera.
 *
 * Devuelve `null` si la sala no existe o su obra está cerrada, sin escribir
 * nada. La sala legado (sin localización) nunca casa con el join y sigue
 * editable, mismo criterio que el resto de la aplicación.
 */
async function enLaSalaBloqueada<T>(
  salaId: string,
  cuerpo: (tx: Transaccion) => Promise<T>,
): Promise<T | null> {
  const resultado = await transaccionConControl(sql, async (tx) => {
    const [sala] = await tx<Array<{ id: string; localizacion_id: string | null }>>`
      select id, localizacion_id from salas where id = ${salaId} for update`;
    if (!sala) return null;

    const [cierre] = await tx<Array<{ cerrado: boolean }>>`
      select exists (
        select 1 from hitos_proyecto h
        join localizaciones l on l.proyecto_id = h.proyecto_id
        where l.id = ${sala.localizacion_id} and h.tipo = 'cierre'
      ) as cerrado`;
    if (cierre?.cerrado) return null;

    return await cuerpo(tx);
  });
  return resultado as T | null;
}

/**
 * La posición que trae un formulario de Equipamiento, y si coloca el equipo.
 *
 * Escribir una coordenada es colocar: el técnico que la teclea está midiendo,
 * y el croquis se la saltaba entera —`posicion_confirmada` se quedaba en
 * falso— para seguir dibujando el equipo donde suele ir.
 *
 * La regla es la corta, y tiene que serlo:
 *
 * - Llegan X e Y: el equipo queda colocado, **valgan lo que valgan**. Cero es
 *   una medida. La esquina de la sala es exactamente donde va el rack, y ese
 *   es el caso que dio origen a `posicion_confirmada`: cualquier atajo que
 *   trate el (0,0) como «no medido» reabre el bug por la otra puerta.
 * - No llegan: el equipo sigue —o vuelve a estar— sin colocar, con las
 *   coordenadas a cero. La ausencia se propaga como ausencia.
 * - Media posición no coloca nada, igual que en la roseta: una x sin y no
 *   sitúa ningún símbolo. La z es la altura y por sí sola tampoco.
 *
 * Que «vacío» signifique de verdad «no lo sé» es cosa del formulario, no de
 * aquí: un equipo sin colocar enseña las casillas VACÍAS
 * (`components/sala/equipamiento.tsx`). Mientras proponía ceros de fábrica,
 * ninguna regla de este lado podía distinguir el cero medido del cero que puso
 * el propio formulario.
 */
function posicionDelFormulario(datos: FormData): {
  x_m: number;
  y_m: number;
  z_m: number;
  posicion_confirmada: boolean;
} {
  const x = numero(datos.get('x_m'));
  const y = numero(datos.get('y_m'));
  if (x == null || y == null) {
    return { x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: false };
  }
  return { x_m: x, y_m: y, z_m: numero(datos.get('z_m')) ?? 0, posicion_confirmada: true };
}

// ---------------------------------------------------------------- plantillas
export async function guardarMedidasPlantilla(datos: FormData) {
  await exigirEdicion('plantillas');
  await sql`
    update plantillas_sala set
      largo_m            = ${numero(datos.get('largo_m'))},
      ancho_m            = ${numero(datos.get('ancho_m'))},
      alto_m             = ${numero(datos.get('alto_m'))},
      alto_falso_techo_m = ${numero(datos.get('alto_falso_techo_m'))},
      mesa_largo_m       = ${numero(datos.get('mesa_largo_m'))},
      mesa_ancho_m       = ${numero(datos.get('mesa_ancho_m'))},
      mesa_alto_cm       = ${numero(datos.get('mesa_alto_cm'))},
      ruta_por_defecto   = ${texto(datos.get('ruta_por_defecto')) ?? 'falso_techo'}::ruta_cable
    where id = ${String(datos.get('id'))}`;
  revalidatePath('/plantillas');
  revalidatePath('/');
}

// --------------------------------------------------------------------- salas

/**
 * Rechazo posterior a una escritura, igual que en la ruta de Diagrama.
 *
 * `sql.begin()` hace commit cuando la función RESUELVE. Después de insertar la
 * sala, sus equipos y su mobiliario el único rechazo posible es un `throw`: se
 * lanza, la transacción se deshace entera —ninguna sala de la serie sobrevive—
 * y el mensaje se devuelve fuera.
 */
class AltaRechazada extends Error {
  constructor(readonly detalle: string) {
    super(detalle);
    this.name = 'AltaRechazada';
  }
}

/**
 * Da de alta la sala, con plantilla o sin ella, y tantas copias como se pidan.
 *
 * Dos diferencias deliberadas con el flujo de XTEN-AV (docs/06, apartados 2 y 6):
 *
 * - Las **medidas vienen siempre del formulario**, no de la plantilla. La
 *   plantilla las propone y el formulario las trae rellenas, pero lo que se
 *   guarda es lo que el técnico ha visto y confirmado. Sin medidas no hay
 *   metros, y la sala se crea igual: la falta se avisa, no se bloquea.
 * - **`copias`** es el `Number of Designs` de ellos. Con 144 salas de la misma
 *   tipología es la diferencia entre un clic y ciento cuarenta y cuatro; el
 *   patrón de nombre evita que salgan 144 salas llamadas igual.
 *
 * Lo que sale mal se DEVUELVE, no se calla: el formulario lo pinta con
 * `useActionState`. Un `return` seco dejaba la página igual que antes de
 * pulsar, sin sala y sin explicación.
 */
export async function crearSala(
  _previo: EstadoAlta | null,
  datos: FormData,
): Promise<EstadoAlta> {
  await exigirEdicion('salas');
  const plantillaId = texto(datos.get('plantilla_id'));
  const copias = Math.min(
    MAXIMO_COPIAS,
    Math.max(1, Math.round(numero(datos.get('copias')) ?? 1)),
  );
  const patronNombre = texto(datos.get('nombre')) ?? 'Sala sin nombre';
  const patronCodigo = texto(datos.get('codigo'));

  // Dentro de un proyecto la sala hereda la sede de la obra; fuera, la sede se
  // escribe a mano como siempre. La localización manda sobre el texto libre.
  const localizacionId = texto(datos.get('localizacion_id'));
  let sede: string | null;
  let proyectoId: string | null = null;
  if (localizacionId) {
    const [fila] = await sql<
      Array<{ proyecto_id: string; sede_id: string | null; cerrado: boolean }>
    >`
      select p.id as proyecto_id, p.sede_id,
             exists (select 1 from hitos_proyecto h
                     where h.proyecto_id = p.id and h.tipo = 'cierre') as cerrado
      from localizaciones l
      join proyectos p on p.id = l.proyecto_id
      where l.id = ${localizacionId}`;
    // Terminar en silencio deja el formulario como si no hubiera pasado nada:
    // ni sala, ni error, ni pista. Se dice qué ha fallado.
    if (!fila) {
      return {
        error:
          'La localización elegida ya no existe. Vuelve a abrir la obra y elige una de las suyas.',
      };
    }
    // En una obra cerrada no nacen salas: se reabre borrando el cierre.
    if (fila.cerrado) {
      return {
        error:
          'La obra está cerrada: no nacen salas en ella. Para añadir una se reabre borrando el cierre desde su portada.',
      };
    }
    proyectoId = fila.proyecto_id;
    sede = fila.sede_id;
  } else {
    sede = await sedeId(texto(datos.get('sede')));
  }

  // Dónde va la mesa en esta tipología. No viene del formulario porque no es
  // una medida que se compruebe en obra al dar de alta la sala: es el montaje
  // estándar, y sin copiarlo la sala nueva nacía con la mesa centrada por
  // implícito y perdía la colocación real de la plantilla.
  const [plantilla] = plantillaId
    ? await sql<
        Array<{ mesa_x_m: string | null; mesa_y_m: string | null; mesa_rotacion_grados: string | null }>
      >`select mesa_x_m, mesa_y_m, mesa_rotacion_grados
        from plantillas_sala where id = ${plantillaId}`
    : [];

  const comun = {
    sede_id: sede,
    localizacion_id: localizacionId,
    plantilla_id: plantillaId,
    tipologia: texto(datos.get('tipologia')),
    aforo: numero(datos.get('aforo')),
    largo_m: numero(datos.get('largo_m')) ?? 0,
    ancho_m: numero(datos.get('ancho_m')) ?? 0,
    alto_m: numero(datos.get('alto_m')) ?? 0,
    alto_falso_techo_m: numero(datos.get('alto_falso_techo_m')),
    // La mesa viene de la plantilla y se puede corregir en el alta. Sin ella la
    // sala se crea igual, pero el croquis sale sin mesa ni sillas.
    mesa_largo_m: numero(datos.get('mesa_largo_m')),
    mesa_ancho_m: numero(datos.get('mesa_ancho_m')),
    mesa_alto_cm: numero(datos.get('mesa_alto_cm')),
    mesa_x_m: plantilla?.mesa_x_m == null ? null : Number(plantilla.mesa_x_m),
    mesa_y_m: plantilla?.mesa_y_m == null ? null : Number(plantilla.mesa_y_m),
    mesa_rotacion_grados: Number(plantilla?.mesa_rotacion_grados ?? 0),
    ruta_por_defecto: texto(datos.get('ruta_por_defecto')) ?? 'falso_techo',
  };

  // La mesa principal de una sala es una sola y vive en `salas.mesa_*`. Una
  // fila de `plantilla_mobiliario` cuyo catálogo sea la mesa principal daría
  // una segunda mesa dibujada en cada sala de la serie. Se comprueba aquí,
  // antes de crear nada, y no solo en la ruta de Diagrama: son dos caminos
  // distintos hacia la misma copia, y una regla escrita en uno solo se rompe
  // por el otro sin que nadie se entere.
  //
  // Esto es la cortesía, no la garantía: entre esta consulta y la copia la
  // plantilla puede cambiar. Lo que de verdad cierra el agujero es la
  // postcondición de dentro de la transacción, más abajo.
  if (plantillaId) {
    const [mesaEnPlantilla] = await sql<Array<{ nombre: string }>>`
      select pm.nombre from plantilla_mobiliario pm
      join catalogo_mobiliario c on c.id = pm.mobiliario_id
      where pm.plantilla_id = ${plantillaId} and c.rol = 'mesa_principal'
      limit 1`;
    if (mesaEnPlantilla) return { error: MENSAJE_MESA_EN_PLANTILLA };
  }

  const resultado = await transaccionConControl(sql, async (tx) => {
    if (plantillaId) await exigirDisenoCopiable(tx,'plantilla',plantillaId);
    // El equipamiento estándar de la plantilla se lee una vez y se copia a
    // todas las salas de la serie. Lo marcado como `no en todas` no se hereda.
    const lineas = plantillaId
      ? await tx<
          Array<{
            id: string;
            articulo_id: string | null;
            categoria: string;
            cantidad: string;
            modelo_texto: string | null;
            extremo: string | null;
            x_m: string | null;
            y_m: string | null;
            z_m: string | null;
            posicion_confirmada: boolean | null;
            rotacion_grados: string | null;
          }>
        >`select id, articulo_id, categoria, cantidad, modelo_texto,
                 extremo, x_m, y_m, z_m, posicion_confirmada, rotacion_grados
          from plantilla_articulos
          where plantilla_id = ${plantillaId} and not opcional`
      : [];

    const creadas: string[] = [];

    for (let i = 1; i <= copias; i++) {
      const [sala] = await tx<Array<{ id: string }>>`
        insert into salas ${tx({
          ...comun,
          diagrama_iniciado_en: new Date(),
          diagrama_origen: plantillaId ? 'plantilla' : 'desde_cero',
          diagrama_plantilla_id: plantillaId,
          nombre: expandirPatron(patronNombre, i, copias),
          codigo: patronCodigo ? expandirPatron(patronCodigo, i, copias) : null,
        })}
        returning id`;

      // De qué línea de la plantilla salió cada equipo. Es lo que permite
      // copiar después las tiradas: la tirada de la plantilla apunta a la
      // línea, y aquí se traduce al equipo de esta sala concreta.
      const equipoDeLinea = new Map<string, string>();

      for (const l of lineas) {
        // La ausencia se propaga como ausencia: una línea sin colocar da un
        // equipo sin colocar, y el croquis lo deduce del extremo y lo dibuja
        // discontinuo. Convertirla aquí en un (0,0,0) "confirmado" plantaría
        // los cuatro equipos en la esquina y los daría por medidos.
        const colocada =
          l.posicion_confirmada ??
          (Number(l.x_m ?? 0) !== 0 || Number(l.y_m ?? 0) !== 0 || Number(l.z_m ?? 0) !== 0);

        const [equipo] = await tx<Array<{ id: string }>>`
          insert into sala_equipos
            (sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m,
             posicion_confirmada, rotacion_grados, origen_plantilla_linea_id)
          values (${sala.id}, ${l.articulo_id}, ${l.modelo_texto ?? l.categoria},
                  ${Math.max(1, Math.round(Number(l.cantidad) || 1))},
                  ${l.extremo ?? extremoPorCategoria(l.categoria)}::extremo_cable,
                  ${Number(l.x_m ?? 0)}, ${Number(l.y_m ?? 0)}, ${Number(l.z_m ?? 0)},
                  ${colocada}, ${Number(l.rotacion_grados ?? 0)}, ${l.id})
          returning id`;
        equipoDeLinea.set(l.id, equipo.id);
      }

      // El mobiliario de la plantilla viaja con el equipamiento: la sala nace
      // con sus sillas y sus mesas puestas donde la tipología dice, no vacía.
      if (plantillaId) {
        await tx`
          insert into sala_mobiliario
            (sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m,
             x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden,
             origen_plantilla_mobiliario_id)
          select ${sala.id}, pm.mobiliario_id, pm.nombre, pm.forma,
                 pm.largo_m, pm.ancho_m, pm.alto_m,
                 pm.x_m, pm.y_m, pm.z_m, pm.rotacion_grados,
                 coalesce(pm.posicion_confirmada, pm.x_m is not null and pm.y_m is not null),
                 pm.orden, pm.id
          from plantilla_mobiliario pm
          where pm.plantilla_id = ${plantillaId}`;

        // Las puertas de la plantilla viajan con el resto del montaje. Una
        // puerta sin medir en la plantilla llega sin medir: la ausencia se
        // propaga como ausencia.
        await tx`
          insert into puertas (sala_id, pared, posicion_m, anchura_m, altura_m, orden)
          select ${sala.id}, pp.pared, pp.posicion_m, pp.anchura_m, pp.altura_m, pp.orden
          from puertas pp
          where pp.plantilla_id = ${plantillaId}`;

        // --------------------------------- postcondición: una sola mesa
        //
        // La comprobación previa mira la plantilla ANTES de abrir la
        // transacción. Entre las dos consultas alguien puede añadirle la mesa
        // principal desde otra pestaña, y en READ COMMITTED el
        // `insert ... select` de arriba ve esa fila recién comprometida que la
        // comprobación no vio: la sala nace con dos mesas.
        //
        // Se mira lo REALMENTE copiado, dentro de la misma transacción, y se
        // lanza. Devolver el rechazo aquí dejaría escritas la sala y todas las
        // anteriores de la serie, que es justo lo que se está rechazando.
        const [mesaCopiada] = await tx<Array<{ nombre: string }>>`
          select m.nombre from sala_mobiliario m
          join catalogo_mobiliario c on c.id = m.mobiliario_id
          where m.sala_id = ${sala.id} and c.rol = 'mesa_principal'
          limit 1`;
        if (mesaCopiada) throw new AltaRechazada(MENSAJE_MESA_EN_PLANTILLA);

        // ------------------------- postcondición: nada fuera de las paredes
        //
        // Las medidas del alta son las del FORMULARIO, no las de la plantilla:
        // es una regla deliberada, porque lo que se guarda es lo que el
        // técnico ha comprobado en la sala. Pero las coordenadas sí se copian
        // de la plantilla tal cual, así que una plantilla de 6 m aplicada a
        // una sala corregida a 4 dejaba el equipo al otro lado de la pared: un
        // estado que el editor de plano no deja crear y que el cálculo de
        // cable da por bueno.
        //
        // Se juzga lo REALMENTE copiado y con la misma `coordenadasFueraDeSala`
        // del guardado manual, no con un criterio propio. Y se lanza en vez de
        // devolver, porque aquí ya hay filas escritas y `sql.begin` hace commit
        // de todo lo que resuelva: con veinte copias, o no sobrevive ninguna o
        // sobreviven las de antes del fallo.
        //
        // Dos ausencias no son un fallo, y por eso no se validan:
        //
        // - Una sala sin largo o sin ancho se crea igual —la falta se avisa, no
        //   se bloquea— así que no hay rectángulo contra el que juzgar nada.
        // - Sin alto medido no hay techo del que salirse. Las paredes sí
        //   existen, y se comprueban.
        if (comun.largo_m > 0 && comun.ancho_m > 0) {
          const equiposCopiados = await tx<
            Array<{ id: string; nombre: string; x_m: string; y_m: string; z_m: string; posicion_confirmada: boolean }>
          >`select id, nombre, x_m, y_m, z_m, posicion_confirmada
            from sala_equipos where sala_id = ${sala.id}`;
          const mueblesCopiados = await tx<
            Array<{
              id: string;
              nombre: string;
              x_m: string | null;
              y_m: string | null;
              z_m: string | null;
              posicion_confirmada: boolean;
            }>
          >`select id, nombre, x_m, y_m, z_m, posicion_confirmada
            from sala_mobiliario where sala_id = ${sala.id}`;

          const num = (v: string | null) => (v == null ? null : Number(v));
          const problemas = coordenadasFueraDeSala(
            {
              sala: { mesa_x_m: comun.mesa_x_m, mesa_y_m: comun.mesa_y_m },
              // Un equipo sin colocar no está «en (0,0,0)»: no tiene posición,
              // así que no puede quedarse fuera de ninguna pared. Lo distingue
              // la propia `coordenadasFueraDeSala`, que se salta lo no
              // confirmado.
              equipos: equiposCopiados.map((e) => ({
                id: e.id,
                x_m: Number(e.x_m ?? 0),
                y_m: Number(e.y_m ?? 0),
                z_m: Number(e.z_m ?? 0),
                posicion_confirmada: e.posicion_confirmada,
              })),
              mobiliario_cambio: mueblesCopiados.map((m) => ({
                id: m.id,
                x_m: num(m.x_m),
                y_m: num(m.y_m),
                z_m: num(m.z_m),
                posicion_confirmada: m.posicion_confirmada,
              })),
              tomas: [],
            },
            {
              largo_m: comun.largo_m,
              ancho_m: comun.ancho_m,
              alto_m: comun.alto_m > 0 ? comun.alto_m : Number.POSITIVE_INFINITY,
            },
          );

          // Las puertas copiadas se juzgan con su propia guarda, la misma del
          // guardado manual: un hueco que no cabe en la pared del formulario
          // no se hereda en silencio.
          const puertasCopiadas = await tx<
            Array<{
              id: string;
              pared: string;
              posicion_m: string;
              anchura_m: string | null;
              altura_m: string | null;
            }>
          >`select id, pared, posicion_m, anchura_m, altura_m
            from puertas where sala_id = ${sala.id}`;
          problemas.push(
            ...puertasFueraDePared(
              puertasCopiadas.map((d) => ({
                id: d.id,
                pared: d.pared as 'norte' | 'sur' | 'este' | 'oeste',
                posicion_m: Number(d.posicion_m),
                anchura_m: num(d.anchura_m),
                altura_m: num(d.altura_m),
              })),
              {
                largo_m: comun.largo_m,
                ancho_m: comun.ancho_m,
                alto_m: comun.alto_m > 0 ? comun.alto_m : Number.POSITIVE_INFINITY,
              },
            ),
          );

          if (problemas.length > 0) {
            // El identificador de una fila recién creada no le dice nada a
            // nadie: se nombra el elemento, que es lo que el técnico ve en la
            // plantilla y puede mover.
            const nombres = new Map<string, string>([
              ...equiposCopiados.map((e) => [e.id, e.nombre] as const),
              ...mueblesCopiados.map((m) => [m.id, m.nombre] as const),
            ]);
            const primero =
              [...nombres.entries()].find(([id]) => problemas[0].includes(id))?.[1] ??
              'Un elemento';
            throw new AltaRechazada(
              `La plantilla coloca ${problemas.length === 1 ? 'un elemento' : `${problemas.length} elementos`} fuera de una sala de ${comun.largo_m} × ${comun.ancho_m} m (${primero}). Corrige las medidas del alta o coloca ese elemento en la plantilla.`,
            );
          }
        }

        // Nacer de una plantilla ya contesta a «de dónde sale el plano»: la
        // pestaña Diagrama abre el editor en vez de volver a preguntarlo.
        //
        // El aforo deja de repartir sillas cuando la plantilla trae SILLAS, no
        // cuando trae cualquier mueble: una plantilla con una mesa auxiliar y
        // sin asientos apagaba las ocho del aforo y dejaba la sala con cero
        // sillas. Con las sillas heredadas sí hay que apagarlo, o el croquis
        // dibuja las ocho derivadas MÁS las de la plantilla.
        await tx`
          update salas set
            diagrama_iniciado_en  = now(),
            diagrama_origen       = 'plantilla',
            diagrama_plantilla_id = ${plantillaId},
            sillas_modo = case
              when exists (
                select 1 from sala_mobiliario m
                join catalogo_mobiliario c on c.id = m.mobiliario_id
                where m.sala_id = ${sala.id} and c.rol = 'asiento'
              )
              then 'manuales' else sillas_modo end
          where id = ${sala.id}`;
      }

      if (plantillaId) await copiarInfraestructuraYCables(tx,'plantilla',plantillaId,sala.id,equipoDeLinea);

      creadas.push(sala.id);
    }

    return creadas;
  }).catch((error: unknown) => {
    // El rechazo posterior a una escritura llega aquí con la transacción ya
    // deshecha: no queda ninguna sala de la serie, ni sus equipos, ni su
    // mobiliario.
    if (error instanceof AltaRechazada) return error;
    if (esErrorConcurrencia(error)) return new AltaRechazada(error.message);
    if (error instanceof ConexionRechazada) return new AltaRechazada(error.message);
    throw error;
  });

  if (resultado instanceof AltaRechazada) return { error: resultado.detalle };
  const ids = resultado;

  revalidatePath('/salas');
  revalidatePath('/proyectos');
  revalidatePath('/');
  // Una sala se abre para seguir trabajando en ella; una serie de veinte, no:
  // la serie vuelve al listado, ya filtrado por su obra si la tiene.
  redirect(
    ids.length === 1
      ? `/salas/${ids[0]}`
      : proyectoId
        ? `/salas?proyecto=${proyectoId}`
        : '/salas',
  );
}

/**
 * El camino de vuelta: una sala terminada se convierte en plantilla propia.
 *
 * Así el departamento construye sus plantillas reales —medidas comprobadas en
 * obra y el equipamiento que de verdad se puso— en vez de quedarse con las 16
 * deducidas del inventario.
 *
 * El nombre de la plantilla es único en la base. En vez de fallar delante del
 * usuario, se desambigua con un sufijo: `Sala TP Madrid (2)`.
 */
export async function crearPlantillaDesdeSala(datos: FormData) {
  await exigirEdicion('plantillas');
  const salaId = String(datos.get('sala_id'));
  const nombrePedido = texto(datos.get('nombre'));
  const medida = (v: unknown): number | null => {
    const n = v == null ? 0 : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const plantillaId = await transaccionConControl(sql, async (tx) => {
    // La cabecera y el montaje deben pertenecer a la misma versión de la sala.
    // `guardarDiagramaSala` toma este mismo cerrojo antes de cambiar medidas o
    // puertas: leer aquí dentro y con `for update` hace que la plantilla copie
    // íntegramente el estado anterior o el posterior, nunca una mezcla.
    const [sala] = await tx<Array<Record<string, unknown>>>`
      select * from salas where id = ${salaId} for update`;
    if (!sala) return null;
    await exigirDisenoCopiable(tx,'sala',salaId);

    const base = nombrePedido ?? `${String(sala.nombre)} (plantilla)`;
    let id: string | undefined;
    for (let intento = 1; intento <= 50 && !id; intento++) {
      const nombre = intento === 1 ? base : `${base} (${intento})`;
      const [fila] = await tx<Array<{ id: string }>>`
        insert into plantillas_sala ${tx({
          nombre,
          tipologia: (sala.tipologia as string | null) ?? 'OTRA',
          aforo: (sala.aforo as number | null) ?? null,
          largo_m: medida(sala.largo_m),
          ancho_m: medida(sala.ancho_m),
          alto_m: medida(sala.alto_m),
          alto_falso_techo_m: medida(sala.alto_falso_techo_m),
          // El montaje entero, no solo la lista de material: la mesa con su
          // sitio y su giro, y más abajo las posiciones y las tiradas. Sin
          // esto, guardar una sala terminada como plantilla y volver a crearla
          // daba una sala distinta.
          mesa_largo_m: medida(sala.mesa_largo_m),
          mesa_ancho_m: medida(sala.mesa_ancho_m),
          mesa_alto_cm: medida(sala.mesa_alto_cm),
          mesa_x_m: sala.mesa_x_m == null ? null : Number(sala.mesa_x_m),
          mesa_y_m: sala.mesa_y_m == null ? null : Number(sala.mesa_y_m),
          mesa_rotacion_grados: Number(sala.mesa_rotacion_grados ?? 0),
          ruta_por_defecto: (sala.ruta_por_defecto as string) ?? 'falso_techo',
          notas: `Guardada desde la sala ${String(sala.nombre)}.`,
        })}
        on conflict (nombre) do nothing
        returning id`;
      id = fila?.id;
    }
    if (!id) return null;

    // El equipamiento de la sala pasa a ser el estándar de la plantilla. La
    // sección sale del catálogo cuando el equipo viene de él; si se escribió a
    // mano, no hay de dónde sacarla.
    const equipos = await tx<
      Array<{
        id: string;
        articulo_id: string | null;
        nombre: string;
        cantidad: number;
        categoria: string | null;
        extremo: string;
        x_m: string;
        y_m: string;
        z_m: string;
        posicion_confirmada: boolean;
        rotacion_grados: string | null;
      }>
    >`select e.id, e.articulo_id, e.nombre, e.cantidad, a.categoria,
             e.extremo, e.x_m, e.y_m, e.z_m, e.posicion_confirmada,
             e.rotacion_grados
      from sala_equipos e
      left join articulos a on a.id = e.articulo_id
      where e.sala_id = ${salaId}
      order by e.nombre`;

    // De qué equipo de la sala salió cada línea: es lo que permite copiar
    // después las tiradas, que apuntan a equipos y tienen que acabar
    // apuntando a líneas.
    const lineaDeEquipo = new Map<string, string>();

    for (const e of equipos) {
      // Un equipo sin colocar entra sin coordenadas, no como (0,0,0): la
      // ausencia se propaga como ausencia en los dos sentidos del viaje.
      const [linea] = await tx<Array<{ id: string }>>`
        insert into plantilla_articulos
          (plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional,
           extremo, x_m, y_m, z_m, posicion_confirmada, rotacion_grados)
        values (${id}, ${e.articulo_id}, ${e.categoria ?? 'SIN CATEGORIA'},
                ${e.nombre}, ${Math.max(1, Math.round(Number(e.cantidad) || 1))}, false,
                ${e.extremo}::extremo_cable,
                ${e.posicion_confirmada ? Number(e.x_m) : null},
                ${e.posicion_confirmada ? Number(e.y_m) : null},
                ${e.posicion_confirmada ? Number(e.z_m) : null},
                ${e.posicion_confirmada},
                ${Number(e.rotacion_grados ?? 0)})
        returning id`;
      lineaDeEquipo.set(String(e.id), linea.id);
    }

    // El mobiliario de la sala pasa a ser el mobiliario tipo. Se conserva la
    // ausencia de posición en los dos sentidos del viaje: un mueble sin
    // colocar da una línea sin colocar, y no un (0,0) en la esquina.
    await tx`
      insert into plantilla_mobiliario
        (plantilla_id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m,
         x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden)
      select ${id}, sm.mobiliario_id, sm.nombre, sm.forma,
             sm.largo_m, sm.ancho_m, sm.alto_m,
             case when sm.posicion_confirmada then sm.x_m end,
             case when sm.posicion_confirmada then sm.y_m end,
             case when sm.posicion_confirmada then sm.z_m end,
             sm.rotacion_grados, sm.posicion_confirmada, sm.orden
      from sala_mobiliario sm
      where sm.sala_id = ${salaId}
      order by sm.orden, sm.creado_en`;

    // Las puertas de la sala pasan a ser las puertas tipo. El estado viaja tal
    // cual: una puerta sin medir da una puerta tipo sin medir.
    await tx`
      insert into puertas (plantilla_id, pared, posicion_m, anchura_m, altura_m, orden)
      select ${id}, ps.pared, ps.posicion_m, ps.anchura_m, ps.altura_m, ps.orden
      from puertas ps
      where ps.sala_id = ${salaId}
      order by ps.orden, ps.creado_en`;

    await copiarInfraestructuraYCables(tx,'sala',salaId,id,lineaDeEquipo);

    return id;
  });

  revalidatePath('/plantillas');
  revalidatePath('/');
  if (plantillaId) redirect(`/plantillas#p-${plantillaId}`);
}

export async function guardarSala(datos: FormData) {
  await exigirEdicion('salas');
  const id = String(datos.get('id'));
  // Las medidas, la mesa y el aforo son la mitad del plano: el editor los
  // escribe y el croquis los dibuja. La versión sube en la MISMA sentencia que
  // la escritura, que es la forma más barata de que no puedan separarse.
  await enLaSalaBloqueada(id, async (tx) => {
    // La sede se resuelve DENTRO de la transacción y después del cerrojo,
    // porque `sedeId` escribe: da de alta la sede que no existía. Resolverla
    // antes creaba la sede aunque la escritura de la sala se rechazara —una
    // obra cerrada aceptaba así sedes nuevas a cambio de nada— y además metía
    // una escritura en `sedes` por delante del cerrojo de `salas`.
    const sede = await sedeId(texto(datos.get('sede')), tx);
    await tx`
    update salas set
      diagrama_version     = diagrama_version + 1,
      nombre               = ${texto(datos.get('nombre')) ?? 'Sala sin nombre'},
      sede_id              = ${sede},
      tipologia            = ${texto(datos.get('tipologia'))},
      codigo               = ${texto(datos.get('codigo'))},
      aforo                = ${numero(datos.get('aforo'))},
      largo_m              = ${numero(datos.get('largo_m')) ?? 0},
      ancho_m              = ${numero(datos.get('ancho_m')) ?? 0},
      alto_m               = ${numero(datos.get('alto_m')) ?? 0},
      alto_falso_techo_m   = ${numero(datos.get('alto_falso_techo_m'))},
      alto_canaleta_m      = ${numero(datos.get('alto_canaleta_m'))},
      alto_suelo_tecnico_m = ${numero(datos.get('alto_suelo_tecnico_m'))},
      mesa_largo_m         = ${numero(datos.get('mesa_largo_m'))},
      mesa_ancho_m         = ${numero(datos.get('mesa_ancho_m'))},
      mesa_alto_cm         = ${numero(datos.get('mesa_alto_cm'))},
      ruta_por_defecto     = ${texto(datos.get('ruta_por_defecto')) ?? 'falso_techo'}::ruta_cable,
      notas                = ${texto(datos.get('notas'))}
    where id = ${id}`;
  });
  revalidatePath('/salas/[id]', 'layout');
  revalidatePath('/salas');
}

/**
 * Una obra cerrada es de solo lectura: sus salas no se borran, ni se editan
 * sus medidas ni su equipamiento, sin reabrirla. Ocultar los controles no
 * basta —la petición se puede repetir a mano sin pasar por la interfaz—, así
 * que la guarda vive aquí y la comparten todas las acciones que tocan la
 * sala. Una sala legado sin `localizacion_id` nunca casa con el join y sigue
 * editable: es el mismo criterio que ya usaba `borrarSala`.
 */
async function proyectoCerradoDeSala(salaId: string): Promise<boolean> {
  const [f] = await sql<Array<{ cerrado: boolean }>>`
    select exists (
      select 1 from hitos_proyecto h
      join localizaciones l on l.proyecto_id = h.proyecto_id
      join salas s on s.localizacion_id = l.id
      where s.id = ${salaId} and h.tipo = 'cierre'
    ) as cerrado`;
  return Boolean(f?.cerrado);
}

export async function borrarSala(datos: FormData) {
  await exigirEdicion('salas');
  const id = String(datos.get('id'));
  if (await proyectoCerradoDeSala(id)) return;
  await sql`delete from salas where id = ${id}`;
  revalidatePath('/salas');
  redirect('/salas');
}

// ------------------------------------------------------------------ equipos
export async function anadirEquipo(datos: FormData) {
  await exigirEdicion('salas');
  const salaId = String(datos.get('sala_id'));
  const articuloId = texto(datos.get('articulo_id'));

  let nombre = texto(datos.get('nombre'));
  if (!nombre && articuloId) {
    const [a] = await sql<Array<{ marca: string | null; modelo: string }>>`
      select marca, modelo from articulos where id = ${articuloId}`;
    if (a) nombre = `${a.marca ?? ''} ${a.modelo}`.trim();
  }

  // Un equipo que aparece de la nada es un símbolo más en el plano, y su
  // posición se escribe aquí: la sube. El alta no propone coordenadas, así que
  // lo normal es que nazca sin colocar y el croquis lo deduzca del extremo.
  const posicion = posicionDelFormulario(datos);

  await enLaSalaBloqueada(salaId, async (tx) => {
    await tx`
      insert into sala_equipos (sala_id, articulo_id, nombre, cantidad, extremo,
                                x_m, y_m, z_m, posicion_confirmada, toma_red_id)
      values (${salaId}, ${articuloId}, ${nombre ?? 'Equipo'},
              ${numero(datos.get('cantidad')) ?? 1},
              ${texto(datos.get('extremo')) ?? 'pared'}::extremo_cable,
              ${posicion.x_m}, ${posicion.y_m}, ${posicion.z_m},
              ${posicion.posicion_confirmada},
              ${texto(datos.get('toma_red_id'))})`;
    await subirVersionDelPlano(tx, salaId);
  });
  revalidatePath('/salas/[id]', 'layout');
}

/**
 * La sala real de un equipo, leída de la fila (no del `sala_id` que manda el
 * formulario). Con el `sala_id` del cliente bastaba mandar el de una sala
 * abierta —o inventado— junto al `id` de un equipo de una sala cerrada: la
 * guarda comprobaba el cierre de la sala equivocada y el `update`/`delete`
 * de debajo no llevaba `sala_id` en el `where`, así que igual escribía.
 */
async function salaIdDeEquipo(equipoId: string): Promise<string | null> {
  const [f] = await sql<Array<{ sala_id: string }>>`
    select sala_id from sala_equipos where id = ${equipoId}`;
  return f ? String(f.sala_id) : null;
}

export async function guardarEquipo(datos: FormData) {
  await exigirEdicion('salas');
  const id = String(datos.get('id'));
  const salaId = await salaIdDeEquipo(id);
  if (!salaId) return;
  // Coordenadas y marca de colocado: es lo que el editor de plano escribe y lo
  // que el croquis dibuja, así que esta escritura sube la versión.
  const posicion = posicionDelFormulario(datos);
  await enLaSalaBloqueada(salaId, async (tx) => {
    const escrito = await tx`
      update sala_equipos set
        nombre   = ${texto(datos.get('nombre')) ?? 'Equipo'},
        cantidad = ${Math.max(1, Math.round(numero(datos.get('cantidad')) ?? 1))},
        extremo  = ${texto(datos.get('extremo')) ?? 'pared'}::extremo_cable,
        x_m      = ${posicion.x_m},
        y_m      = ${posicion.y_m},
        z_m      = ${posicion.z_m},
        posicion_confirmada = ${posicion.posicion_confirmada},
        toma_red_id = ${texto(datos.get('toma_red_id'))}
      where id = ${id} and sala_id = ${salaId}`;
    // La fila se leyó antes de coger el cerrojo, así que entre la lectura y el
    // `update` alguien ha podido borrarla desde otra pestaña. Sin escritura no
    // hay plano que haya cambiado: subir la versión ahí sería un incremento
    // fantasma, y tumbaría el borrador de una pestaña abierta por nada.
    if (escrito.count === 0) return;
    await subirVersionDelPlano(tx, salaId);
  });
  revalidatePath('/salas/[id]', 'layout');
}

/**
 * Suma o resta unidades de un equipo sin abrir el formulario completo.
 *
 * No sube la versión del plano: la cantidad no se dibuja. El croquis pinta un
 * símbolo por fila, no por unidad, y el editor no manda cantidades, así que un
 * guardado del plano no puede pisar esto ni al revés. Hacer que subiera
 * convertiría cada pulsación del «+» en un conflicto para una pestaña de
 * Diagrama abierta, y perder un borrador medido por eso sería peor que el
 * problema.
 */
export async function ajustarCantidadEquipo(datos: FormData) {
  await exigirEdicion('salas');
  const id = String(datos.get('id'));
  const salaId = await salaIdDeEquipo(id);
  if (!salaId) return;
  const paso = Number(datos.get('paso')) || 1;
  await enLaSalaBloqueada(salaId, async (tx) => { await tx`
    update sala_equipos
    set cantidad = greatest(1, cantidad + ${paso})
    where id = ${id} and sala_id = ${salaId}`; });
  revalidatePath('/salas/[id]', 'layout');
}

export async function borrarEquipo(datos: FormData) {
  await exigirEdicion('salas');
  const id = String(datos.get('id'));
  const salaId = await salaIdDeEquipo(id);
  if (!salaId) return;
  // Desaparece un símbolo del plano, y con él sus tiradas. Una pestaña de
  // Diagrama abierta lo sigue enseñando y lo sigue moviendo: que se entere.
  await enLaSalaBloqueada(salaId, async (tx) => {
    const borrado = await tx`delete from sala_equipos where id = ${id} and sala_id = ${salaId}`;
    if (borrado.count === 0) return;
    await subirVersionDelPlano(tx, salaId);
  });
  revalidatePath('/salas/[id]', 'layout');
}

// --------------------------------------------------------------- tomas de red
//
// La roseta del edificio: el número de la placa del suelo o de la pared. Es un
// dato de esta sala, no del catálogo. La ubicación se guarda como texto y se
// normaliza a minúsculas aquí para que no acaben conviviendo "Suelo", "suelo" y
// "SUELO", que es exactamente lo que ensució el inventario de partida.

/** La sala real de una toma, leída de la fila, no del `sala_id` del formulario: mismo criterio que `salaIdDeEquipo`. */
async function salaIdDeToma(tomaId: string): Promise<string | null> {
  const [f] = await sql<Array<{ sala_id: string }>>`
    select sala_id from tomas_red where id = ${tomaId}`;
  return f ? String(f.sala_id) : null;
}

export async function anadirToma(datos: FormData) {
  await exigirEdicion('salas');
  const salaId = String(datos.get('sala_id'));
  const codigo = texto(datos.get('codigo'));
  if (!salaId || !codigo) return;

  // La roseta se dibuja en el plano y el editor guarda su sitio: aparece una
  // más y las pestañas abiertas tienen que enterarse.
  await enLaSalaBloqueada(salaId, async (tx) => {
    const alta = await tx<Array<{ id: string }>>`
      insert into tomas_red (sala_id, codigo, ubicacion, x_m, y_m, z_m, notas)
      values (${salaId}, ${codigo},
              ${texto(datos.get('ubicacion'))?.toLowerCase() ?? null},
              ${numero(datos.get('x_m'))},
              ${numero(datos.get('y_m'))},
              ${numero(datos.get('z_m'))},
              ${texto(datos.get('notas'))})
      on conflict (sala_id, codigo) do nothing
      returning id`;
    // El `do nothing` puede no insertar nada: esa roseta ya estaba. Un plano
    // que no ha cambiado no puede subir de versión.
    if (alta.length === 0) return;
    await subirVersionDelPlano(tx, salaId);
  });
  revalidatePath('/salas/[id]', 'layout');
}

export async function guardarToma(datos: FormData) {
  await exigirEdicion('salas');
  const id = String(datos.get('id'));
  const salaId = await salaIdDeToma(id);
  if (!salaId) return;
  // Las coordenadas de la roseta son las mismas que mueve el editor arrastrando
  // su símbolo: esta escritura las puede pisar y la pueden pisar a ella.
  await enLaSalaBloqueada(salaId, async (tx) => {
    const escrito = await tx`
      update tomas_red set
        codigo    = ${texto(datos.get('codigo')) ?? 'sin código'},
        ubicacion = ${texto(datos.get('ubicacion'))?.toLowerCase() ?? null},
        x_m       = ${numero(datos.get('x_m'))},
        y_m       = ${numero(datos.get('y_m'))},
        z_m       = ${numero(datos.get('z_m'))},
        notas     = ${texto(datos.get('notas'))}
      where id = ${id} and sala_id = ${salaId}`;
    if (escrito.count === 0) return;
    await subirVersionDelPlano(tx, salaId);
  });
  revalidatePath('/salas/[id]', 'layout');
}

const esquemaBocasToma = z.array(z.object({
  ordinal:z.number().int().min(1).max(1000), etiqueta:z.string().trim().max(200).nullable(),
  conector:z.string().trim().min(1).max(200),
  senal:z.enum(['hdmi','red','usb','audio_linea','audio_altavoz','microfono','alimentacion','control','otro']),
}).strict()).max(1000);

export type ResultadoBocasToma = {ok:true;version:number}|{ok:false;detalle:string};

export async function guardarBocasToma(datos:FormData):Promise<ResultadoBocasToma> {
  await exigirEdicion('salas');
  const salaId=texto(datos.get('sala_id')),tomaId=texto(datos.get('toma_id'));
  const version=numero(datos.get('versionEsperada'));
  const capacidadTexto=texto(datos.get('capacidad_documentada'));
  const capacidad=capacidadTexto===null?null:Number(capacidadTexto);
  if(!salaId||!tomaId||!esUuid(salaId)||!esUuid(tomaId)||version===null||!Number.isInteger(version)||version<0||
    (capacidad!==null&&(!Number.isInteger(capacidad)||capacidad<1||capacidad>1000))) return {ok:false,detalle:'Revisa la capacidad documentada y la versión de la sala.'};
  let entrada:unknown;
  try{entrada=JSON.parse(String(datos.get('bocas')??'[]'));}catch{return {ok:false,detalle:'Las bocas documentadas no tienen un formato válido.'};}
  const r=esquemaBocasToma.safeParse(entrada);
  if(!r.success||r.data.length!==(capacidad??0)||r.data.some((b,_,t)=>t.filter(x=>x.ordinal===b.ordinal).length!==1||b.ordinal>(capacidad??0)))return {ok:false,detalle:'Documenta exactamente las bocas 1 a N, con señal y conector.'};
  try{
    const resultado=await enLaSalaBloqueada(salaId,async tx=>{
      const [sala]=await tx<Array<{diagrama_version:number}>>`select diagrama_version from salas where id=${salaId}`;
      if(Number(sala.diagrama_version)!==version)return {ok:false as const,detalle:'La sala cambió en otra pestaña. Recarga antes de documentar las bocas.'};
      const [toma]=await tx`select id from tomas_red where id=${tomaId} and sala_id=${salaId} for update`;
      if(!toma)return {ok:false as const,detalle:'La roseta no pertenece a esta sala.'};
      await tx`select id from toma_red_bocas where toma_red_id=${tomaId} order by id for update`;
      await tx`delete from toma_red_bocas where toma_red_id=${tomaId} and ordinal>${capacidad??0}`;
      await tx`update tomas_red set capacidad_documentada=${capacidad},codigo_confirmado=${datos.get('codigo_confirmado')==='on'} where id=${tomaId}`;
      for(const boca of r.data)await tx`insert into toma_red_bocas(toma_red_id,ordinal,etiqueta,conector,senal) values (${tomaId},${boca.ordinal},${boca.etiqueta||null},${boca.conector},${boca.senal}::senal)
        on conflict(toma_red_id,ordinal) do update set etiqueta=excluded.etiqueta,conector=excluded.conector,senal=excluded.senal`;
      const [nueva]=await tx<Array<{diagrama_version:number}>>`update salas set diagrama_version=diagrama_version+1 where id=${salaId} returning diagrama_version`;
      return {ok:true as const,version:Number(nueva.diagrama_version)};
    });
    if(!resultado)return {ok:false,detalle:'La sala no existe o su obra está cerrada.'};
    if(resultado.ok)revalidatePath('/salas/[id]','layout');
    return resultado;
  }catch(error){
    if(esErrorConcurrencia(error))return {ok:false,detalle:error.message};
    if(['23503','23505','23514','40P01','40001'].includes((error as {code?:string}).code??''))return {ok:false,detalle:'No se puede retirar o cambiar una boca ocupada. Revisa sus conexiones.'};
    throw error;
  }
}

/** Los equipos que pinchaban en ella se quedan sin toma, no se borran. */
export async function borrarToma(datos: FormData) {
  await exigirEdicion('salas');
  const id = String(datos.get('id'));
  const salaId = await salaIdDeToma(id);
  if (!salaId) return;
  // Desaparece una roseta del plano. Una pestaña de Diagrama que siga
  // mandándola recibiría «algún elemento no es de esta sala» sin entender por
  // qué; con la versión movida, el aviso dice lo que ha pasado de verdad.
  await enLaSalaBloqueada(salaId, async (tx) => {
    const borrado = await tx`delete from tomas_red where id = ${id} and sala_id = ${salaId}`;
    if (borrado.count === 0) return;
    await subirVersionDelPlano(tx, salaId);
  });
  revalidatePath('/salas/[id]', 'layout');
}

// ---------------------------------------------------------------- conexiones
//
// Las tres suben `diagrama_version`. Plano no escribe estas filas, pero el
// editor visual de `/diagrama` sí: mientras `/cableado` siga vivo, sus acciones
// legacy tienen que invalidar un borrador abierto para que no las pise con una
// versión que ya no representa el mismo esquema de conexiones.

function extremoDelFormulario(datos:FormData,lado:'origen'|'destino',equipoId:string|null):ExtremoConexion {
  const toma=texto(datos.get(`toma_boca_${lado}_id`));
  const [puertoCombinado,ordinalCombinado]=String(datos.get(`boca_${lado}`)??'').split(':');
  const dato=toma?{tipo:'roseta',toma_boca_id:toma}:{tipo:'equipo',equipo_id:equipoId,
    puerto_id:texto(datos.get(`puerto_${lado}_id`))??puertoCombinado,
    ordinal:numero(datos.get(`puerto_${lado}_ordinal`))??Number(ordinalCombinado)};
  const r=esquemaExtremoConexion.safeParse(dato);
  if(!r.success)throw new ConexionRechazada('Elige una boca física de origen y otra de destino.');
  return r.data;
}

async function validarCableFormulario(tx:Transaccion,datos:FormData) {
  const entrada=texto(datos.get('longitud_manual_m')),manual=numero(datos.get('longitud_manual_m'));
  if(entrada!==null&&(manual===null||manual<=0))throw new ConexionRechazada('La longitud manual debe ser un número positivo.');
  const cableId=texto(datos.get('articulo_cable_id'));
  if(cableId){
    if(!esUuid(cableId))throw new ConexionRechazada('El cable no es válido.');
    const [cable]=await tx`select id from articulos where id=${cableId} and activo and tipo='cable' for share`;
    if(!cable)throw new ConexionRechazada('Elige un artículo de cable activo.');
  }
}

function estadoSuministroDelFormulario(datos:FormData):{estado:EstadoSuministroCable;cableId:string|null}|null {
  const bruto=texto(datos.get('estado_suministro'));
  if(bruto==null)return null;
  if(bruto!=='incluido'&&bruto!=='adicional'&&bruto!=='por_determinar')throw new ConexionRechazada('El estado de suministro del cable no es válido.');
  const cableId=texto(datos.get('cable_suministrado_id'));
  if(cableId&&!esUuid(cableId))throw new ConexionRechazada('El latiguillo no es válido.');
  if(bruto==='incluido'&&!cableId)throw new ConexionRechazada('Incluido exige un latiguillo físico de la sala.');
  return {estado:bruto,cableId:bruto==='incluido'?cableId:null};
}

function rechazoConexion(error:unknown):EstadoConexion|null {
  if(esErrorConcurrencia(error))return {error:error.message};
  if(error instanceof ConexionRechazada)return {error:error.message};
  const sql=mensajeErrorSqlNegocio(error);
  if(sql)return {error:sql};
  const codigo=(error as {code?:string}).code;
  if(codigo==='23505')return {error:'Esa boca física ya está ocupada por otra conexión.'};
  if(['23503','23514','22P02','40P01','40001'].includes(codigo??''))return {error:'No se puede guardar esa pareja de bocas. Comprueba pertenencia, ocupación y latiguillo.'};
  return null;
}

export async function anadirConexion(datos:FormData) {
  await exigirEdicion('salas');
  const salaId=texto(datos.get('sala_id'));
  if(!salaId||!esUuid(salaId))throw new ConexionRechazada('La sala no es válida.');
  const origen=extremoDelFormulario(datos,'origen',texto(datos.get('origen_id')));
  const destino=extremoDelFormulario(datos,'destino',texto(datos.get('destino_id')));
  await enLaSalaBloqueada(salaId,async tx=>{
    await validarCableFormulario(tx,datos);
    await bloquearYValidarExtremos(tx,salaId,[origen,destino]);
    const o=columnasExtremo(origen),d=columnasExtremo(destino);
    const [c]=await tx<Array<{id:string}>>`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,articulo_cable_id,senal,ruta,longitud_manual_m)
      values (${salaId},${o.equipo_id},${d.equipo_id},${o.puerto_id},${d.puerto_id},${texto(datos.get('articulo_cable_id'))},${texto(datos.get('senal'))??'otro'}::senal,${texto(datos.get('ruta'))}::ruta_cable,${numero(datos.get('longitud_manual_m'))}) returning id`;
    await escribirParejaConexion(tx,c.id,origen,destino);
    const decision=estadoSuministroDelFormulario(datos);
    if(decision)await aplicarEstadoCableEnTx(tx,c.id,decision.estado,decision.cableId);
    await subirVersionDelPlano(tx,salaId);
  });
  revalidatePath('/salas/[id]','layout');
}

export async function anadirConexionConEstado(_anterior:EstadoConexion,datos:FormData):Promise<EstadoConexion> {
  await exigirEdicion('salas');
  try {await anadirConexion(datos);return {error:null};}
  catch(error){
    const rechazo=rechazoConexion(error);
    if(rechazo)return rechazo;
    throw error;
  }
}

async function salaIdDeConexion(conexionId:string):Promise<string|null> {
  if(!esUuid(conexionId))return null;
  const [c]=await sql<Array<{sala_id:string}>>`select sala_id from conexiones where id=${conexionId}`;
  return c?.sala_id??null;
}

export async function guardarConexion(datos:FormData):Promise<EstadoConexion> {
  await exigirEdicion('salas');
  try {
    const id=String(datos.get('id')),salaId=await salaIdDeConexion(id);
    if(!salaId)throw new ConexionRechazada('La conexión ya no existe.');
    await enLaSalaBloqueada(salaId,async tx=>{
      await validarCableFormulario(tx,datos);
      const [c]=await tx<Array<{origen_id:string|null;destino_id:string|null}>>`select origen_id,destino_id from conexiones where id=${id} and sala_id=${salaId} for update`;
      if(!c)throw new ConexionRechazada('La conexión ya no existe.');
      const origen=extremoDelFormulario(datos,'origen',c.origen_id),destino=extremoDelFormulario(datos,'destino',c.destino_id);
      await bloquearYValidarExtremos(tx,salaId,[origen,destino]);
      await tx`update conexiones set articulo_cable_id=${texto(datos.get('articulo_cable_id'))},senal=${texto(datos.get('senal'))??'otro'}::senal,ruta=${texto(datos.get('ruta'))}::ruta_cable,longitud_manual_m=${numero(datos.get('longitud_manual_m'))} where id=${id}`;
      await escribirParejaConexion(tx,id,origen,destino);
      const decision=estadoSuministroDelFormulario(datos);
      if(decision)await aplicarEstadoCableEnTx(tx,id,decision.estado,decision.cableId);
      await subirVersionDelPlano(tx,salaId);
    });
    revalidatePath('/salas/[id]','layout');
    return {error:null};
  } catch(error) {
    const rechazo=rechazoConexion(error);
    if(rechazo)return rechazo;
    throw error;
  }
}

export type ResultadoConversionToma = {ok:true;id:string;version:number}|{ok:false;detalle:string};

export async function convertirAsignacionToma(datos:FormData):Promise<ResultadoConversionToma> {
  await exigirEdicion('salas');
  const salaId=texto(datos.get('sala_id')),equipoId=texto(datos.get('equipo_id'));
  const version=numero(datos.get('versionEsperada')),puertoId=texto(datos.get('puerto_id')),bocaId=texto(datos.get('toma_boca_id'));
  const ordinal=numero(datos.get('ordinal')),cableId=texto(datos.get('articulo_cable_id'));
  const senal=texto(datos.get('senal'))??'red',ruta=texto(datos.get('ruta')),manual=numero(datos.get('longitud_manual_m'));
  if(!salaId||!equipoId||!puertoId||!bocaId||![salaId,equipoId,puertoId,bocaId].every(esUuid)||(cableId&&!esUuid(cableId))||version===null||!Number.isInteger(version)||version<0||ordinal===null||!Number.isInteger(ordinal)||ordinal<1||
    (texto(datos.get('longitud_manual_m'))!==null&&(manual===null||manual<=0)))return {ok:false,detalle:'Revisa la sala, las bocas y la longitud manual.'};
  try{
    const resultado=await enLaSalaBloqueada(salaId,async tx=>{
      const [sala]=await tx<Array<{diagrama_version:number}>>`select diagrama_version from salas where id=${salaId}`;
      const [equipo]=await tx<Array<{toma_red_id:string|null;toma_red_conexion_id:string|null}>>`select toma_red_id,toma_red_conexion_id from sala_equipos where id=${equipoId} and sala_id=${salaId}`;
      if(!equipo?.toma_red_id)throw new ConexionRechazada('El equipo no tiene una asignación documental a roseta.');
      const [boca]=await tx`select id from toma_red_bocas where id=${bocaId} and toma_red_id=${equipo.toma_red_id}`;
      if(!boca)throw new ConexionRechazada('La boca elegida no corresponde a la roseta asignada.');
      const equivalentes=await tx<Array<{id:string;articulo_cable_id:string|null;senal:string;ruta:string|null;longitud_manual_m:string|null}>>`
        select c.id,c.articulo_cable_id,c.senal,c.ruta,c.longitud_manual_m from conexiones c
        join conexion_bocas e on e.conexion_id=c.id and e.equipo_id=${equipoId} and e.puerto_id=${puertoId} and e.ordinal=${ordinal}
        join conexion_bocas t on t.conexion_id=c.id and t.lado<>e.lado and t.toma_boca_id=${bocaId}
        where c.sala_id=${salaId} order by c.id for update of c`;
      const existente=equivalentes[0];
      const identica=existente&&existente.articulo_cable_id===cableId&&existente.senal===senal&&existente.ruta===ruta&&
        (existente.longitud_manual_m===null?null:Number(existente.longitud_manual_m))===manual;
      if(equipo.toma_red_conexion_id){
        if(!identica||existente.id!==equipo.toma_red_conexion_id)throw new ConexionRechazada('La asignación ya tiene otro cable o recorrido. Edita esa conexión antes de cambiarla.');
        return {ok:true as const,id:existente.id,version:Number(sala.diagrama_version)};
      }
      if(Number(sala.diagrama_version)!==version)throw new ConexionRechazada('La sala cambió en otra pestaña. Recarga antes de convertir la asignación.');
      if(existente&&!identica)throw new ConexionRechazada('Ya existe una conexión entre esas bocas con otro cable o recorrido. Revisa la existente.');
      const origen:ExtremoConexion={tipo:'equipo',equipo_id:equipoId,puerto_id:puertoId,ordinal};
      const destino:ExtremoConexion={tipo:'roseta',toma_boca_id:bocaId};
      await bloquearYValidarExtremos(tx,salaId,[origen,destino]);
      if(cableId&&!(await tx`select id from articulos where id=${cableId} and activo and tipo='cable'`).length)throw new ConexionRechazada('Elige una referencia de cable activa.');
      let id=existente?.id;
      if(!id){
        const [nueva]=await tx<Array<{id:string}>>`insert into conexiones(sala_id,origen_id,puerto_origen_id,articulo_cable_id,senal,ruta,longitud_manual_m) values (${salaId},${equipoId},${puertoId},${cableId},${senal}::senal,${ruta}::ruta_cable,${manual}) returning id`;
        id=nueva.id;await escribirParejaConexion(tx,id,origen,destino);
      }
      await tx`update sala_equipos set toma_red_conexion_id=${id} where id=${equipoId}`;
      const [nueva]=await tx<Array<{diagrama_version:number}>>`update salas set diagrama_version=diagrama_version+1 where id=${salaId} returning diagrama_version`;
      return {ok:true as const,id,version:Number(nueva.diagrama_version)};
    });
    if(!resultado)return {ok:false,detalle:'La sala no existe o su obra está cerrada.'};
    revalidatePath('/salas/[id]','layout');return resultado;
  }catch(error){
    if(esErrorConcurrencia(error))return {ok:false,detalle:error.message};
    if(error instanceof ConexionRechazada)return {ok:false,detalle:error.message};
    if(['23503','23505','23514','22P02','40P01','40001'].includes((error as {code?:string}).code??''))return {ok:false,detalle:'No se puede convertir la asignación: revisa bocas, ocupación y recorrido.'};
    throw error;
  }
}

export async function borrarConexion(datos: FormData): Promise<EstadoConexion> {
  await exigirEdicion('salas');
  try {
    const id = String(datos.get('id'));
    const salaId = await salaIdDeConexion(id);
    if (!salaId) return {error:null};
    await enLaSalaBloqueada(salaId, async (tx) => {
      const [conexion] = await tx<Array<{ id: string }>>`
        select id from conexiones where id = ${id} and sala_id = ${salaId} for update`;
      if (!conexion) return;
      await desasignarCablesDeConexiones(tx, [id]);
      await tx`delete from conexiones where id = ${id}`;
      await subirVersionDelPlano(tx, salaId);
    });
    revalidatePath('/salas/[id]', 'layout');
    return {error:null};
  } catch (error) {
    const rechazo = rechazoConexion(error);
    if (rechazo) return rechazo;
    throw error;
  }
}

// ---------------------------------------------------------------- parámetros
export async function guardarParametros(datos: FormData) {
  await exigirEdicion('parametros');
  const holgura = datos.get('holgura_roseta');
  const holguraVacia = holgura === null || (typeof holgura === 'string' && holgura.trim() === '');
  const valorHolgura = holguraVacia ? null : numero(holgura);
  if (!holguraVacia && (valorHolgura === null || !Number.isFinite(valorHolgura) || valorHolgura < 0)) {
    throw new Error('La holgura de roseta debe ser un número de metros mayor o igual que cero.');
  }
  await sql.begin(async (tx) => {
    for (const [clave, valor] of datos.entries()) {
      if (clave === 'holgura_roseta') continue;
      const v = numero(valor);
      if (v == null) continue;
      await tx`update parametros set valor = ${v} where clave = ${clave}`;
    }
    if (datos.has('holgura_roseta')) {
      if (valorHolgura === null) {
        await tx`delete from parametros where clave = 'holgura_roseta'`;
      } else {
        await tx`insert into parametros (clave, valor, unidad, descripcion)
          values ('holgura_roseta', ${valorHolgura}, 'm', 'Holgura por extremo de roseta')
          on conflict (clave) do update set valor = excluded.valor`;
      }
    }
  });
  revalidatePath('/parametros');
  revalidatePath('/');
}

// ------------------------------------------------------------------ catálogo
export async function guardarPrecioArticulo(datos: FormData) {
  await exigirEdicion('catalogo');
  await sql`
    update articulos set
      coste       = ${numero(datos.get('coste'))},
      bobina_m    = ${numero(datos.get('bobina_m'))},
      diametro_mm = ${numero(datos.get('diametro_mm'))}
    where id = ${String(datos.get('id'))}`;
  revalidatePath('/catalogo');
  revalidatePath('/');
}


// ------------------------------------------- equipamiento de las plantillas
export async function anadirLineaPlantilla(datos: FormData) {
  await exigirEdicion('plantillas');
  const plantillaId = String(datos.get('plantilla_id'));
  const articuloId = texto(datos.get('articulo_id'));
  if (!articuloId) return;

  const [a] = await sql<Array<{ marca: string | null; modelo: string; categoria: string }>>`
    select marca, modelo, categoria from articulos where id = ${articuloId}`;
  if (!a) return;

  await sql`
    insert into plantilla_articulos (plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional)
    values (${plantillaId}, ${articuloId}, ${a.categoria},
            ${`${a.marca ?? ''} ${a.modelo}`.trim()},
            ${Math.max(1, Math.round(numero(datos.get('cantidad')) ?? 1))},
            ${datos.get('opcional') === 'on'})`;
  revalidatePath('/plantillas');
}

/**
 * Todo lo que se le puede hacer a una línea del equipamiento: sumar, restar,
 * guardar y quitar. Lo dice el botón pulsado, en `operacion`.
 *
 * Es una sola acción porque antes eran cuatro formularios por fila, y cada uno
 * repetía en el HTML el identificador de la línea y el de su acción. Con más
 * de cien líneas en `/plantillas` eso pesaba más que el propio contenido.
 */
async function enLaPlantillaDeFilaBloqueada(
  tabla: 'plantilla_articulos' | 'plantilla_conexiones', id: string,
  operar: (tx: postgres.TransactionSql<Record<string, unknown>>) => Promise<void>,
) {
  await sql.begin(async (tx) => {
    const [fila] = await tx<Array<{ plantilla_id: string }>>`select plantilla_id from ${tx(tabla)} where id=${id}`;
    if (!fila) return;
    const [plantilla] = await tx`select id from plantillas_sala where id=${fila.plantilla_id} for update`;
    if (!plantilla) return;
    // Releer tras esperar: la fila puede haber desaparecido durante el bloqueo.
    if (!(await tx`select id from ${tx(tabla)} where id=${id} and plantilla_id=${fila.plantilla_id} for update`).length) return;
    await operar(tx);
  });
}

export async function operarLineaPlantilla(datos: FormData) {
  await exigirEdicion('plantillas');
  const id = String(datos.get('id'));

  await enLaPlantillaDeFilaBloqueada('plantilla_articulos', id, async (tx) => {
  switch (texto(datos.get('operacion'))) {
    case 'mas':
    case 'menos': {
      const paso = datos.get('operacion') === 'mas' ? 1 : -1;
      await tx`
        update plantilla_articulos
        set cantidad = greatest(1, cantidad + ${paso})
        where id = ${id}`;
      break;
    }
    case 'quitar':
      await tx`delete from plantilla_articulos where id = ${id}`;
      break;
    case 'guardar':
      await tx`
        update plantilla_articulos set
          cantidad = ${Math.max(1, Math.round(numero(datos.get('cantidad')) ?? 1))},
          opcional = ${datos.get('opcional') === 'on'},
          extremo  = ${texto(datos.get('extremo'))}::extremo_cable,
          x_m      = ${numero(datos.get('x_m'))},
          y_m      = ${numero(datos.get('y_m'))},
          z_m      = ${numero(datos.get('z_m'))}
        where id = ${id}`;
      break;
    default:
      return;
  }
  });

  revalidatePath('/plantillas');
}

/**
 * Una tirada tipo de la plantilla. Se valida lo mínimo: que los dos extremos
 * existan y no sean el mismo. Lo demás avisa pero no bloquea, igual que en la
 * sala: puede haber un adaptador por medio.
 */
export async function anadirTiradaPlantilla(datos:FormData) {
  await exigirEdicion('plantillas');
  const plantillaId=String(datos.get('plantilla_id'));
  const parsear=(valor:FormDataEntryValue|null):ExtremoConexion=>{
    const partes=String(valor??'').split(':');
    const bruto=partes[0]==='roseta'&&partes.length===2?{tipo:'roseta',toma_boca_id:partes[1]}
      :partes.length===3?{tipo:'equipo',equipo_id:partes[0],puerto_id:partes[1],ordinal:Number(partes[2])}:null;
    const r=esquemaExtremoConexion.safeParse(bruto);
    if(!r.success)throw new ConexionRechazada('Elige las dos bocas físicas de la tirada.');
    return r.data;
  };
  if(!esUuid(plantillaId))throw new ConexionRechazada('La plantilla no es válida.');
  const origen=parsear(datos.get('boca_origen')),destino=parsear(datos.get('boca_destino'));
  const documentalId=texto(datos.get('documental_id')),existenteId=texto(datos.get('conexion_existente_id'));
  if((documentalId&&!esUuid(documentalId))||(existenteId&&!esUuid(existenteId)))throw new ConexionRechazada('La tirada elegida no es válida.');
  await sql.begin(async tx=>{
    const [plantilla]=await tx`select id from plantillas_sala where id=${plantillaId} for update`;
    if(!plantilla)throw new ConexionRechazada('La plantilla ya no existe.');
    if(existenteId&&!(await tx`select id from plantilla_conexiones where id=${existenteId} and plantilla_id=${plantillaId} for update`).length)throw new ConexionRechazada('La conexión elegida pertenece a otra plantilla.');
    if(documentalId){
      const [doc]=await tx<Array<{conexion_resuelta_id:string|null}>>`select conexion_resuelta_id from plantilla_tiradas_documentales where id=${documentalId} and plantilla_id=${plantillaId} for update`;
      if(!doc)throw new ConexionRechazada('La fuente documental pertenece a otra plantilla.');
      if(doc.conexion_resuelta_id&&doc.conexion_resuelta_id!==existenteId)throw new ConexionRechazada('Esta fuente ya está resuelta. Selecciona su tirada para editarla.');
    }
    if(!existenteId&&(await tx`select id from plantilla_conexiones where plantilla_id=${plantillaId} and detalle_extremos='legacy'`).length)throw new ConexionRechazada('Hay tiradas históricas sin bocas. Selecciona explícitamente la que vas a documentar antes de crear otra.');
    await bloquearYValidarExtremos(tx,plantillaId,[origen,destino],true);
    const o=columnasExtremo(origen),d=columnasExtremo(destino);
    let id=existenteId;
    if(!id){
      const [nueva]=await tx<Array<{id:string}>>`insert into plantilla_conexiones(plantilla_id,origen_linea_id,destino_linea_id,senal,ruta,longitud_manual_m) values (${plantillaId},${o.equipo_id},${d.equipo_id},${texto(datos.get('senal'))??'otro'}::senal,${texto(datos.get('ruta'))}::ruta_cable,${numero(datos.get('longitud_manual_m'))}) returning id`;
      id=nueva.id;
    }else{
      await tx`update plantilla_conexiones set senal=${texto(datos.get('senal'))??'otro'}::senal,ruta=${texto(datos.get('ruta'))}::ruta_cable where id=${id}`;
      if(datos.has('longitud_manual_m'))await tx`update plantilla_conexiones set longitud_manual_m=${numero(datos.get('longitud_manual_m'))} where id=${id}`;
    }
    await escribirParejaConexion(tx,id,origen,destino,true);
    if(documentalId)await tx`update plantilla_tiradas_documentales set conexion_resuelta_id=${id} where id=${documentalId}`;
  });
  revalidatePath('/plantillas');
}

export async function quitarTiradaPlantilla(datos: FormData) {
  await exigirEdicion('plantillas');
  const id = String(datos.get('id'));
  await enLaPlantillaDeFilaBloqueada('plantilla_conexiones', id, async (tx) => {
    await tx`delete from plantilla_conexiones where id = ${id}`;
  });
  revalidatePath('/plantillas');
}

// ------------------------------------------------------- ficha de catálogo
function longitudes(v: FormDataEntryValue | null): number[] | null {
  const s = texto(v);
  if (!s) return null;
  const partes = s
    .split(/[,;/|\s]+/)
    .map((x) => Number(x.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return partes.length ? partes : null;
}

async function proveedorId(nombre: string | null, tx: Transaccion): Promise<string | null> {
  if (!nombre) return null;
  const [p] = await tx<Array<{ id: string }>>`
    insert into proveedores (nombre) values (${nombre})
    on conflict (nombre) do update set nombre = excluded.nombre
    returning id`;
  return p.id;
}

export async function guardarArticulo(datos: FormData) {
  await exigirEdicion('catalogo');
  const id = String(datos.get('id'));
  await transaccionConControl(sql, async tx => {
  const idProveedor = await proveedorId(texto(datos.get('proveedor')), tx);

  await tx`
    update articulos set
      marca                    = ${texto(datos.get('marca'))},
      modelo                   = ${texto(datos.get('modelo')) ?? 'Sin modelo'},
      categoria                = ${(texto(datos.get('categoria')) ?? 'SIN CATEGORIA').toUpperCase()},
      descripcion              = ${texto(datos.get('descripcion'))},
      caracteristicas          = ${texto(datos.get('caracteristicas'))},
      observaciones            = ${texto(datos.get('observaciones'))},
      coste                    = ${numero(datos.get('coste'))},
      coste_orientativo        = ${datos.get('coste_orientativo') != null},
      pvp                      = ${numero(datos.get('pvp'))},
      proveedor_id             = ${idProveedor},
      plazo_dias               = ${numero(datos.get('plazo_dias'))},
      stock_minimo             = ${numero(datos.get('stock_minimo'))},
      unidad                   = ${texto(datos.get('unidad')) ?? 'ud'}::unidad_medida,
      senal                    = ${texto(datos.get('senal'))}::senal,
      conector_a               = ${texto(datos.get('conector_a'))},
      conector_b               = ${texto(datos.get('conector_b'))},
      longitudes_comerciales_m = ${longitudes(datos.get('longitudes_comerciales_m'))},
      bobina_m                 = ${numero(datos.get('bobina_m'))},
      diametro_mm              = ${numero(datos.get('diametro_mm'))}
    where id = ${id}`;
  });

  revalidatePath(`/articulo/${id}`);
  revalidatePath('/catalogo');
  revalidatePath('/');
}

export async function crearArticulo(datos: FormData) {
  await exigirEdicion('catalogo');
  const a = await transaccionConControl(sql, async tx => {
  const idProveedor = await proveedorId(texto(datos.get('proveedor')), tx);
  const [nuevo] = await tx<Array<{ id: string }>>`
    insert into articulos ${tx({
      tipo: texto(datos.get('tipo')) ?? 'equipo',
      marca: texto(datos.get('marca')),
      modelo: texto(datos.get('modelo')) ?? 'Sin modelo',
      categoria: (texto(datos.get('categoria')) ?? 'SIN CATEGORIA').toUpperCase(),
      descripcion: texto(datos.get('descripcion')),
      caracteristicas: texto(datos.get('caracteristicas')),
      observaciones: texto(datos.get('observaciones')),
      unidad: texto(datos.get('unidad')) ?? 'ud',
      coste: numero(datos.get('coste')),
      coste_orientativo: datos.get('coste_orientativo') != null,
      pvp: numero(datos.get('pvp')),
      proveedor_id: idProveedor,
    })}
    returning id`;
  return nuevo;
  });

  revalidatePath('/catalogo');
  redirect(`/articulo/${a.id}`);
}

// --------------------------------------------------------------- puertos
//
// Un puerto es un conector físico del equipo. Lo que se da de alta aquí lleva
// `fuente = 'app'`: alguien lo ha mirado en el equipo real, así que la siembra
// no lo toca nunca, aunque data/puertos.csv diga otra cosa.

/** Nombre y sentido son lo mínimo: sin ellos el puerto no dice nada. */
export async function anadirPuerto(datos: FormData) {
  await exigirEdicion('catalogo');
  const articuloId = String(datos.get('articulo_id'));
  const nombre = texto(datos.get('nombre'));
  if (!articuloId || !nombre) return;

  await sql`
    insert into puertos (articulo_id, nombre, total, sentido, senal, conector, orden, notas, fuente)
    values (${articuloId}, ${nombre},
            ${Math.max(1, Math.round(numero(datos.get('total')) ?? 1))},
            ${texto(datos.get('sentido')) ?? 'entrada'}::sentido_puerto,
            ${texto(datos.get('senal')) ?? 'otro'}::senal,
            ${texto(datos.get('conector'))},
            ${numero(datos.get('orden'))},
            ${texto(datos.get('notas'))},
            'app')
    on conflict (articulo_id, nombre) do nothing`;
  revalidatePath(`/articulo/${articuloId}`);
  revalidatePath('/catalogo');
}

export async function guardarPuerto(datos: FormData) {
  await exigirEdicion('catalogo');
  const articuloId = String(datos.get('articulo_id'));
  await sql`
    update puertos set
      nombre   = ${texto(datos.get('nombre')) ?? 'Sin nombre'},
      total    = ${Math.max(1, Math.round(numero(datos.get('total')) ?? 1))},
      sentido  = ${texto(datos.get('sentido')) ?? 'entrada'}::sentido_puerto,
      senal    = ${texto(datos.get('senal')) ?? 'otro'}::senal,
      conector = ${texto(datos.get('conector'))},
      orden    = ${numero(datos.get('orden'))},
      notas    = ${texto(datos.get('notas'))}
    where id = ${String(datos.get('id'))}`;
  revalidatePath(`/articulo/${articuloId}`);
}

export async function borrarPuerto(datos: FormData) {
  await exigirEdicion('catalogo');
  const articuloId = String(datos.get('articulo_id'));
  await sql`delete from puertos where id = ${String(datos.get('id'))}`;
  revalidatePath(`/articulo/${articuloId}`);
  revalidatePath('/catalogo');
}

/** No se borra: se desactiva, para no romper las salas que ya lo usan. */
export async function desactivarArticulo(datos: FormData) {
  await exigirEdicion('catalogo');
  await sql`update articulos set activo = false where id = ${String(datos.get('id'))}`;
  revalidatePath('/catalogo');
  redirect('/catalogo');
}

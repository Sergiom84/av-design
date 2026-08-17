'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type postgres from 'postgres';
import { sql } from '@/lib/db';
import { sedeId } from '@/lib/sedes';
import { expandirPatron, MAXIMO_COPIAS } from '@/lib/nombres-serie';
import { coordenadasFueraDeSala, puertasFueraDePared } from '@/lib/plano-editor';
import { extremoPorCategoria, MENSAJE_MESA_EN_PLANTILLA } from '@/lib/tipos';

/**
 * Lo que el alta devuelve al formulario. `error` nulo es «no ha pasado nada»:
 * el alta correcta no vuelve, redirige.
 */
export interface EstadoAlta {
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
  const resultado = await sql.begin(async (tx) => {
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
    edificio: texto(datos.get('edificio')),
    nivel: texto(datos.get('nivel')),
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

  const resultado = await sql.begin(async (tx) => {
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

    // Las tiradas tipo de la plantilla. Se leen una vez y se copian a cada sala
    // de la serie con los equipos de esa sala.
    const tiradas = plantillaId
      ? await tx<
          Array<{
            origen_linea_id: string;
            destino_linea_id: string;
            articulo_cable_id: string | null;
            senal: string;
            ruta: string | null;
            notas: string | null;
          }>
        >`select origen_linea_id, destino_linea_id, articulo_cable_id,
                 senal, ruta, notas
          from plantilla_conexiones
          where plantilla_id = ${plantillaId}
          order by orden, creado_en`
      : [];

    const creadas: string[] = [];

    for (let i = 1; i <= copias; i++) {
      const [sala] = await tx<Array<{ id: string }>>`
        insert into salas ${tx({
          ...comun,
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

      // Una tirada cuyo equipo no se ha heredado —porque la línea estaba
      // marcada "no en todas"— se salta. Insertarla apuntando a nada sería
      // dejar la sala con una tirada rota.
      for (const t of tiradas) {
        const origen = equipoDeLinea.get(t.origen_linea_id);
        const destino = equipoDeLinea.get(t.destino_linea_id);
        if (!origen || !destino) continue;

        await tx`
          insert into conexiones (sala_id, origen_id, destino_id, articulo_cable_id, senal, ruta, notas)
          values (${sala.id}, ${origen}, ${destino}, ${t.articulo_cable_id},
                  ${t.senal}::senal,
                  ${t.ruta}::ruta_cable,
                  ${t.notas})`;
      }

      creadas.push(sala.id);
    }

    return creadas;
  }).catch((error: unknown) => {
    // El rechazo posterior a una escritura llega aquí con la transacción ya
    // deshecha: no queda ninguna sala de la serie, ni sus equipos, ni su
    // mobiliario.
    if (error instanceof AltaRechazada) return error;
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
  const salaId = String(datos.get('sala_id'));
  const nombrePedido = texto(datos.get('nombre'));
  const medida = (v: unknown): number | null => {
    const n = v == null ? 0 : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const plantillaId = await sql.begin(async (tx) => {
    // La cabecera y el montaje deben pertenecer a la misma versión de la sala.
    // `guardarDiagramaSala` toma este mismo cerrojo antes de cambiar medidas o
    // puertas: leer aquí dentro y con `for update` hace que la plantilla copie
    // íntegramente el estado anterior o el posterior, nunca una mezcla.
    const [sala] = await tx<Array<Record<string, unknown>>>`
      select * from salas where id = ${salaId} for update`;
    if (!sala) return null;

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

    // Las tiradas de la sala pasan a ser las tiradas tipo de la plantilla.
    const conexiones = await tx<
      Array<{
        origen_id: string;
        destino_id: string;
        articulo_cable_id: string | null;
        senal: string;
        ruta: string | null;
        notas: string | null;
      }>
    >`select origen_id, destino_id, articulo_cable_id, senal, ruta, notas
      from conexiones where sala_id = ${salaId} order by creado_en, id`;

    let orden = 0;
    for (const c of conexiones) {
      const origen = lineaDeEquipo.get(String(c.origen_id));
      const destino = lineaDeEquipo.get(String(c.destino_id));
      if (!origen || !destino) continue;
      await tx`
        insert into plantilla_conexiones
          (plantilla_id, origen_linea_id, destino_linea_id, articulo_cable_id, senal, ruta, notas, orden)
        values (${id}, ${origen}, ${destino}, ${c.articulo_cable_id},
                ${c.senal}::senal, ${c.ruta}::ruta_cable, ${c.notas}, ${orden})`;
      orden += 1;
    }

    return id;
  });

  revalidatePath('/plantillas');
  revalidatePath('/');
  if (plantillaId) redirect(`/plantillas#p-${plantillaId}`);
}

export async function guardarSala(datos: FormData) {
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
      edificio             = ${texto(datos.get('edificio'))},
      nivel                = ${texto(datos.get('nivel'))},
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
  const id = String(datos.get('id'));
  if (await proyectoCerradoDeSala(id)) return;
  await sql`delete from salas where id = ${id}`;
  revalidatePath('/salas');
  redirect('/salas');
}

// ------------------------------------------------------------------ equipos
export async function anadirEquipo(datos: FormData) {
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
  const id = String(datos.get('id'));
  const salaId = await salaIdDeEquipo(id);
  if (!salaId || (await proyectoCerradoDeSala(salaId))) return;
  const paso = Number(datos.get('paso')) || 1;
  await sql`
    update sala_equipos
    set cantidad = greatest(1, cantidad + ${paso})
    where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
}

export async function borrarEquipo(datos: FormData) {
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

/** Los equipos que pinchaban en ella se quedan sin toma, no se borran. */
export async function borrarToma(datos: FormData) {
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
// Ninguna de las tres sube `diagrama_version`, y es deliberado. La tirada se
// dibuja en el croquis, pero el editor de plano no la escribe nunca: no viaja
// en el patch, así que ni la pisa ni la pisan. Lo único que cambiaría es que
// detallar un cable en Cableado tumbaría el borrador a medio medir de una
// pestaña de Diagrama abierta, y eso cuesta trabajo real a cambio de nada.

export async function anadirConexion(datos: FormData) {
  const salaId = String(datos.get('sala_id'));
  const origen = String(datos.get('origen_id'));
  const destino = String(datos.get('destino_id'));
  if (!origen || !destino || origen === destino) return;
  if (await proyectoCerradoDeSala(salaId)) return;

  const ruta = texto(datos.get('ruta'));
  await sql`
    insert into conexiones (sala_id, origen_id, destino_id, articulo_cable_id,
                            senal, ruta, longitud_manual_m,
                            puerto_origen_id, puerto_destino_id)
    values (${salaId}, ${origen}, ${destino},
            ${texto(datos.get('articulo_cable_id'))},
            ${texto(datos.get('senal')) ?? 'otro'}::senal,
            ${ruta}::ruta_cable,
            ${numero(datos.get('longitud_manual_m'))},
            ${texto(datos.get('puerto_origen_id'))},
            ${texto(datos.get('puerto_destino_id'))})`;
  revalidatePath('/salas/[id]', 'layout');
}

/** La sala real de una conexión, leída de la fila, no del `sala_id` del formulario: mismo criterio que `salaIdDeEquipo`. */
async function salaIdDeConexion(conexionId: string): Promise<string | null> {
  const [f] = await sql<Array<{ sala_id: string }>>`
    select sala_id from conexiones where id = ${conexionId}`;
  return f ? String(f.sala_id) : null;
}

/**
 * Detallar una conexión que ya existe. Hace falta porque hay tiradas dadas de
 * alta antes de que hubiera catálogo de puertos: se les añaden ahora sin
 * volver a crearlas, que cambiaría su identificador de cable.
 */
export async function guardarConexion(datos: FormData) {
  const id = String(datos.get('id'));
  const salaId = await salaIdDeConexion(id);
  if (!salaId || (await proyectoCerradoDeSala(salaId))) return;
  await sql`
    update conexiones set
      articulo_cable_id = ${texto(datos.get('articulo_cable_id'))},
      senal             = ${texto(datos.get('senal')) ?? 'otro'}::senal,
      ruta              = ${texto(datos.get('ruta'))}::ruta_cable,
      longitud_manual_m = ${numero(datos.get('longitud_manual_m'))},
      puerto_origen_id  = ${texto(datos.get('puerto_origen_id'))},
      puerto_destino_id = ${texto(datos.get('puerto_destino_id'))}
    where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
}

export async function borrarConexion(datos: FormData) {
  const id = String(datos.get('id'));
  const salaId = await salaIdDeConexion(id);
  if (!salaId || (await proyectoCerradoDeSala(salaId))) return;
  await sql`delete from conexiones where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
}

// ---------------------------------------------------------------- parámetros
export async function guardarParametros(datos: FormData) {
  for (const [clave, valor] of datos.entries()) {
    const v = numero(valor);
    if (v == null) continue;
    await sql`update parametros set valor = ${v} where clave = ${clave}`;
  }
  revalidatePath('/parametros');
  revalidatePath('/');
}

// ------------------------------------------------------------------ catálogo
export async function guardarPrecioArticulo(datos: FormData) {
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
export async function operarLineaPlantilla(datos: FormData) {
  const id = String(datos.get('id'));

  switch (texto(datos.get('operacion'))) {
    case 'mas':
    case 'menos': {
      const paso = datos.get('operacion') === 'mas' ? 1 : -1;
      await sql`
        update plantilla_articulos
        set cantidad = greatest(1, cantidad + ${paso})
        where id = ${id}`;
      break;
    }
    case 'quitar':
      await sql`delete from plantilla_articulos where id = ${id}`;
      break;
    case 'guardar':
      await sql`
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

  revalidatePath('/plantillas');
}

/**
 * Una tirada tipo de la plantilla. Se valida lo mínimo: que los dos extremos
 * existan y no sean el mismo. Lo demás avisa pero no bloquea, igual que en la
 * sala: puede haber un adaptador por medio.
 */
export async function anadirTiradaPlantilla(datos: FormData) {
  const plantillaId = String(datos.get('plantilla_id'));
  const origen = texto(datos.get('origen_linea_id'));
  const destino = texto(datos.get('destino_linea_id'));
  if (!origen || !destino || origen === destino) return;

  await sql`
    insert into plantilla_conexiones (plantilla_id, origen_linea_id, destino_linea_id, senal, ruta)
    values (${plantillaId}, ${origen}, ${destino},
            ${texto(datos.get('senal')) ?? 'otro'}::senal,
            ${texto(datos.get('ruta'))}::ruta_cable)`;
  revalidatePath('/plantillas');
}

export async function quitarTiradaPlantilla(datos: FormData) {
  await sql`delete from plantilla_conexiones where id = ${String(datos.get('id'))}`;
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

async function proveedorId(nombre: string | null): Promise<string | null> {
  if (!nombre) return null;
  const [p] = await sql<Array<{ id: string }>>`
    insert into proveedores (nombre) values (${nombre})
    on conflict (nombre) do update set nombre = excluded.nombre
    returning id`;
  return p.id;
}

export async function guardarArticulo(datos: FormData) {
  const id = String(datos.get('id'));
  const idProveedor = await proveedorId(texto(datos.get('proveedor')));

  await sql`
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

  revalidatePath(`/articulo/${id}`);
  revalidatePath('/catalogo');
  revalidatePath('/');
}

export async function crearArticulo(datos: FormData) {
  const idProveedor = await proveedorId(texto(datos.get('proveedor')));
  const [a] = await sql<Array<{ id: string }>>`
    insert into articulos ${sql({
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
  const articuloId = String(datos.get('articulo_id'));
  await sql`delete from puertos where id = ${String(datos.get('id'))}`;
  revalidatePath(`/articulo/${articuloId}`);
  revalidatePath('/catalogo');
}

/** No se borra: se desactiva, para no romper las salas que ya lo usan. */
export async function desactivarArticulo(datos: FormData) {
  await sql`update articulos set activo = false where id = ${String(datos.get('id'))}`;
  revalidatePath('/catalogo');
  redirect('/catalogo');
}

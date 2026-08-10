'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { sedeId } from '@/lib/sedes';
import { expandirPatron, MAXIMO_COPIAS } from '@/lib/nombres-serie';

const numero = (v: FormDataEntryValue | null): number | null => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

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
/** Traduce la categoría del inventario al tipo de extremo, para la holgura. */
function extremoPorCategoria(categoria: string): string {
  const c = categoria.toUpperCase();
  if (c.includes('PANTALLA') || c.includes('MONITOR') || c.includes('VIDEOWALL'))
    return 'pantalla';
  if (c.includes('PROYECTOR')) return 'proyector';
  if (c.includes('CAJA CONEXIONES')) return 'caja_conexiones';
  if (c.includes('ALTAVOZ') || c.includes('CAMARA') || c.includes('CÁMARA'))
    return 'techo';
  if (c.includes('PANEL') || c.includes('MICROFONO') || c.includes('MICRÓFONO'))
    return 'mesa';
  if (
    c.includes('MATRIZ') ||
    c.includes('AMPLIFICADOR') ||
    c.includes('PROCESADOR') ||
    c.includes('SWITCH') ||
    c.includes('CONTROLADORA') ||
    c.includes('DSP')
  )
    return 'rack';
  return 'pared';
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
 */
export async function crearSala(datos: FormData) {
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
    if (!fila) return;
    // En una obra cerrada no nacen salas: se reabre borrando el cierre.
    if (fila.cerrado) return;
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

  const ids = await sql.begin(async (tx) => {
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
          }>
        >`select id, articulo_id, categoria, cantidad, modelo_texto,
                 extremo, x_m, y_m, z_m, posicion_confirmada
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
          insert into sala_equipos (sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m, posicion_confirmada)
          values (${sala.id}, ${l.articulo_id}, ${l.modelo_texto ?? l.categoria},
                  ${Math.max(1, Math.round(Number(l.cantidad) || 1))},
                  ${l.extremo ?? extremoPorCategoria(l.categoria)}::extremo_cable,
                  ${Number(l.x_m ?? 0)}, ${Number(l.y_m ?? 0)}, ${Number(l.z_m ?? 0)},
                  ${colocada})
          returning id`;
        equipoDeLinea.set(l.id, equipo.id);
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
  });

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

  const [sala] = await sql<Array<Record<string, unknown>>>`
    select * from salas where id = ${salaId}`;
  if (!sala) return;

  const base =
    texto(datos.get('nombre')) ?? `${String(sala.nombre)} (plantilla)`;
  const medida = (v: unknown): number | null => {
    const n = v == null ? 0 : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const plantillaId = await sql.begin(async (tx) => {
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
      }>
    >`select e.id, e.articulo_id, e.nombre, e.cantidad, a.categoria,
             e.extremo, e.x_m, e.y_m, e.z_m, e.posicion_confirmada
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
           extremo, x_m, y_m, z_m, posicion_confirmada)
        values (${id}, ${e.articulo_id}, ${e.categoria ?? 'SIN CATEGORIA'},
                ${e.nombre}, ${Math.max(1, Math.round(Number(e.cantidad) || 1))}, false,
                ${e.extremo}::extremo_cable,
                ${e.posicion_confirmada ? Number(e.x_m) : null},
                ${e.posicion_confirmada ? Number(e.y_m) : null},
                ${e.posicion_confirmada ? Number(e.z_m) : null},
                ${e.posicion_confirmada})
        returning id`;
      lineaDeEquipo.set(String(e.id), linea.id);
    }

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
  if (await proyectoCerradoDeSala(id)) return;
  const sede = await sedeId(texto(datos.get('sede')));
  await sql`
    update salas set
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
  if (await proyectoCerradoDeSala(salaId)) return;
  const articuloId = texto(datos.get('articulo_id'));

  let nombre = texto(datos.get('nombre'));
  if (!nombre && articuloId) {
    const [a] = await sql<Array<{ marca: string | null; modelo: string }>>`
      select marca, modelo from articulos where id = ${articuloId}`;
    if (a) nombre = `${a.marca ?? ''} ${a.modelo}`.trim();
  }

  await sql`
    insert into sala_equipos (sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m, toma_red_id)
    values (${salaId}, ${articuloId}, ${nombre ?? 'Equipo'},
            ${numero(datos.get('cantidad')) ?? 1},
            ${texto(datos.get('extremo')) ?? 'pared'}::extremo_cable,
            ${numero(datos.get('x_m')) ?? 0},
            ${numero(datos.get('y_m')) ?? 0},
            ${numero(datos.get('z_m')) ?? 0},
            ${texto(datos.get('toma_red_id'))})`;
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
  if (!salaId || (await proyectoCerradoDeSala(salaId))) return;
  await sql`
    update sala_equipos set
      nombre   = ${texto(datos.get('nombre')) ?? 'Equipo'},
      cantidad = ${Math.max(1, Math.round(numero(datos.get('cantidad')) ?? 1))},
      extremo  = ${texto(datos.get('extremo')) ?? 'pared'}::extremo_cable,
      x_m      = ${numero(datos.get('x_m')) ?? 0},
      y_m      = ${numero(datos.get('y_m')) ?? 0},
      z_m      = ${numero(datos.get('z_m')) ?? 0},
      toma_red_id = ${texto(datos.get('toma_red_id'))}
    where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
}

/** Suma o resta unidades de un equipo sin abrir el formulario completo. */
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
  if (!salaId || (await proyectoCerradoDeSala(salaId))) return;
  await sql`delete from sala_equipos where id = ${id} and sala_id = ${salaId}`;
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
  if (await proyectoCerradoDeSala(salaId)) return;

  await sql`
    insert into tomas_red (sala_id, codigo, ubicacion, x_m, y_m, z_m, notas)
    values (${salaId}, ${codigo},
            ${texto(datos.get('ubicacion'))?.toLowerCase() ?? null},
            ${numero(datos.get('x_m'))},
            ${numero(datos.get('y_m'))},
            ${numero(datos.get('z_m'))},
            ${texto(datos.get('notas'))})
    on conflict (sala_id, codigo) do nothing`;
  revalidatePath('/salas/[id]', 'layout');
}

export async function guardarToma(datos: FormData) {
  const id = String(datos.get('id'));
  const salaId = await salaIdDeToma(id);
  if (!salaId || (await proyectoCerradoDeSala(salaId))) return;
  await sql`
    update tomas_red set
      codigo    = ${texto(datos.get('codigo')) ?? 'sin código'},
      ubicacion = ${texto(datos.get('ubicacion'))?.toLowerCase() ?? null},
      x_m       = ${numero(datos.get('x_m'))},
      y_m       = ${numero(datos.get('y_m'))},
      z_m       = ${numero(datos.get('z_m'))},
      notas     = ${texto(datos.get('notas'))}
    where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
}

/** Los equipos que pinchaban en ella se quedan sin toma, no se borran. */
export async function borrarToma(datos: FormData) {
  const id = String(datos.get('id'));
  const salaId = await salaIdDeToma(id);
  if (!salaId || (await proyectoCerradoDeSala(salaId))) return;
  await sql`delete from tomas_red where id = ${id} and sala_id = ${salaId}`;
  revalidatePath('/salas/[id]', 'layout');
}

// ---------------------------------------------------------------- conexiones
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

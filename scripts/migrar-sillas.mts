/**
 * Materializa las sillas derivadas del aforo como filas de `sala_mobiliario`.
 *
 *   npm run migrar:sillas              → solo informa, no toca nada
 *   npm run migrar:sillas -- --aplicar → escribe
 *
 * Por qué esto es un programa y no una sentencia de `db/schema.sql`:
 *
 * La colocación de las sillas derivadas no es un reparto simple. Elige por qué
 * lados de la mesa se sienta la gente, recorta cada lado contra las paredes de
 * la sala —Liang–Barsky, con la mesa girada cualquier ángulo— y cuenta las que
 * no caben. Eso vive en `repartirSillasEnLaSala()` (`src/lib/croquis.ts`), que
 * es lógica pura con pruebas. Reimplementarlo en plpgsql sería una segunda
 * geometría que se separa de la primera al primer retoque, y el día que se
 * separen el plano de la sala dejaría de coincidir con sus filas.
 *
 * Así que el backfill IMPORTA la geometría en vez de repetirla: las mismas
 * funciones que dibujan el croquis y las mismas que usa el editor cuando el
 * técnico añade una silla a mano (`materializarSillas()`). La silla que escribe
 * este programa cae exactamente donde estaba dibujada.
 *
 * Es un paso manual del despliegue, posterior a aplicar `db/schema.sql` y la
 * migración `db/migraciones/2026-08-fuente-sala-mobiliario.sql`. **Contra
 * producción se ejecuta a mano y con confirmación**: no forma parte de ningún
 * despliegue automático, no se engancha al arranque de la aplicación, ni a
 * `next build`, ni a `npm run db:reset`. Un backfill que se ejecuta solo es un
 * backfill que nadie ha leído. Mismo trato que `npm run catalogo:normalizar`.
 *
 * Contra una base que no sea `localhost`, `--aplicar` no escribe salvo que se
 * teclee el nombre de la base de destino:
 *
 *   npm run migrar:sillas -- --aplicar --confirmo=<nombre_de_la_base>
 *
 * En seco contra una base remota se permite sin ceremonia: leer no rompe nada,
 * y mirar producción antes de decidir es justo lo que hace falta.
 *
 * Sala a sala y entera o nada: si alguna silla no cabe o falta la referencia
 * canónica del catálogo, esa sala se revierte y se queda en `derivadas`. No es
 * un fallo: es el fallback previsto para los datos históricos, que se siguen
 * dibujando como hoy.
 *
 * Deshacerlo, si hiciera falta, es SQL revisado y ejecutado a mano —no una
 * bandera de este comando, porque un borrado masivo detrás de una bandera es
 * justo lo que no se pulsa con cuidado—. Las filas del backfill llevan
 * `fuente = 'backfill'` y las que coloca una persona desde el editor llevan
 * `app`, que es el defecto de la columna. El rollback es exactamente
 * `SQL_ROLLBACK_BACKFILL`, aquí abajo, y no una copia parecida escrita en un
 * comentario: la que se pega en la consola y la que se prueba tienen que ser la
 * misma cadena o lo probado no es lo que se ejecuta.
 */

import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { mesaDeLaSala, repartirSillasEnLaSala } from '../src/lib/croquis';
import { materializarSillas, type BorradorPlano, type MuebleBorrador } from '../src/lib/plano-editor';
import type { MuebleCatalogo, Sala } from '../src/lib/tipos';

/**
 * Deshacer el backfill, entero y sin tocar a quien no lo pidió.
 *
 * Se pega tal cual en `psql` (o se ejecuta con `db.unsafe()`), y es la MISMA
 * cadena que ejecuta `npm run test:backfill-sillas`. Un rollback documentado en
 * un comentario y probado con una copia distinta es un rollback sin probar.
 *
 * Tres cosas que la primera versión hacía mal:
 *
 * 1. **Solo se tocan las salas que pierden filas.** La versión anterior
 *    recorría TODAS las salas en `manuales` y devolvía a `derivadas` cualquiera
 *    que se quedara sin asientos. Una sala que un técnico había pasado a
 *    manuales a mano —y que a lo mejor solo tiene mesas auxiliares, sin ninguna
 *    silla— nunca la tocó el backfill, y aun así el rollback la cambiaba. Por
 *    eso el `delete` va en un CTE con `returning sala_id` y el `update` se
 *    limita a esos identificadores.
 * 2. **Son dos sentencias, no una.** Las ramas de un CTE que modifica datos
 *    comparten el snapshot del comienzo de la sentencia: un `not exists` puesto
 *    en el mismo `update` seguiría VIENDO las filas que el `delete` acaba de
 *    borrar, así que ninguna sala volvería nunca a `derivadas`. Las salas
 *    afectadas se guardan en una tabla temporal y la decisión se toma después,
 *    ya con la base limpia. La transacción las mantiene juntas.
 * 3. **La versión del plano sube en toda sala cuyo dibujo cambie.** Perder ocho
 *    sillas es cambiar el plano, se vuelva a `derivadas` o no. Sin esto, una
 *    pestaña de Diagrama abierta antes del rollback guardaría encima con su
 *    número intacto y volvería a escribir las sillas borradas.
 * 4. **Los cerrojos se cogen en el orden de todos los demás.** Primero las
 *    filas de `salas` con `for update` y después el borrado del mobiliario. El
 *    orden contrario —borrar y luego actualizar `salas`— es el inverso al de
 *    `guardarDiagramaSala`, y dos caminos opuestos sobre las mismas filas se
 *    quedan cada uno con el cerrojo que espera el otro. Las salas se bloquean
 *    `order by id` para que dos rollbacks simultáneos tampoco se crucen.
 *
 * Por eso el conjunto de salas afectadas se calcula ANTES de borrar nada y se
 * guarda en la tabla temporal: hace falta para poder bloquearlas. El borrado se
 * limita después a ese mismo conjunto, así que una sala de backfill que
 * apareciera entre medias no se borra a medias sin cerrojo: se la lleva la
 * siguiente pasada del rollback, que es idempotente.
 *
 * Lo que NO cambia: una sala que conserva algún asiento de otra fuente (`app`,
 * el que colocó una persona) se queda en `manuales`, o el aforo repartiría sus
 * sillas derivadas encima de las que hay puestas.
 *
 * Ejecutarlo dos veces no hace nada la segunda: el `delete` no encuentra filas,
 * la tabla temporal sale vacía y el `update` no toca ninguna sala.
 */
export const SQL_ROLLBACK_BACKFILL = `
begin;

create temporary table rollback_backfill_sillas on commit drop as
  select distinct sala_id from sala_mobiliario where fuente = 'backfill';

select id from salas
 where id in (select sala_id from rollback_backfill_sillas)
 order by id
 for update;

delete from sala_mobiliario
 where fuente = 'backfill'
   and sala_id in (select sala_id from rollback_backfill_sillas);

update salas s
   set sillas_modo = case
         when s.sillas_modo = 'manuales'
          and not exists (select 1 from sala_mobiliario m
                           join catalogo_mobiliario c on c.id = m.mobiliario_id
                          where m.sala_id = s.id and c.rol = 'asiento')
         then 'derivadas' else s.sillas_modo end,
       diagrama_version = s.diagrama_version + 1
 where s.id in (select sala_id from rollback_backfill_sillas);

commit;
`;

/** Una sala que se queda en `derivadas`, con el motivo escrito. */
export interface SalaSaltada {
  id: string;
  nombre: string;
  motivo: string;
}

export interface InformeBackfill {
  /** Cuántas salas hay en modo `derivadas` antes de empezar. */
  enDerivadas: number;
  /** Cuántas se materializan (o se materializarían, en seco). */
  materializadas: number;
  /** Cuántas filas de silla salen en total. */
  filas: number;
  saltadas: SalaSaltada[];
  aplicado: boolean;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** La sala, con lo justo que necesitan la mesa y el reparto de sillas. */
function aSalaGeometrica(f: Record<string, unknown>): Sala {
  return {
    id: String(f.id),
    sede_id: null,
    localizacion_id: null,
    edificio: null,
    nivel: null,
    codigo: null,
    nombre: String(f.nombre),
    tipologia: null,
    aforo: num(f.aforo),
    plantilla_id: null,
    largo_m: Number(f.largo_m ?? 0),
    ancho_m: Number(f.ancho_m ?? 0),
    alto_m: Number(f.alto_m ?? 0),
    alto_falso_techo_m: null,
    alto_canaleta_m: null,
    alto_suelo_tecnico_m: null,
    ruta_por_defecto: 'falso_techo',
    notas: null,
    mesa_largo_m: num(f.mesa_largo_m),
    mesa_ancho_m: num(f.mesa_ancho_m),
    mesa_alto_cm: num(f.mesa_alto_cm),
    mesa_x_m: num(f.mesa_x_m),
    mesa_y_m: num(f.mesa_y_m),
    mesa_rotacion_grados: Number(f.mesa_rotacion_grados ?? 0),
    diagrama_version: Number(f.diagrama_version ?? 0),
    sillas_modo: f.sillas_modo === 'manuales' ? 'manuales' : 'derivadas',
  };
}

function aMuebleBorrador(f: Record<string, unknown>): MuebleBorrador {
  return {
    id: String(f.id),
    mobiliario_id: f.mobiliario_id ? String(f.mobiliario_id) : null,
    nombre: String(f.nombre),
    forma: f.forma === 'circulo' ? 'circulo' : 'rectangulo',
    largo_m: num(f.largo_m),
    ancho_m: num(f.ancho_m),
    alto_m: num(f.alto_m),
    x_m: num(f.x_m),
    y_m: num(f.y_m),
    z_m: num(f.z_m),
    rotacion_grados: Number(f.rotacion_grados ?? 0),
    posicion_confirmada: f.posicion_confirmada === true,
    origen_plantilla_mobiliario_id: f.origen_plantilla_mobiliario_id
      ? String(f.origen_plantilla_mobiliario_id)
      : null,
    orden: Number(f.orden ?? 100),
    es_nuevo: false,
  };
}

type PreparacionMaterializacion =
  | { ok: true; sala: Sala; nuevas: MuebleBorrador[] }
  | { ok: false; sala: Sala; motivo: string };

/**
 * Calcula las filas que corresponden al estado que acaba de leerse.
 *
 * Es pura a propósito: en seco recibe el snapshot informativo y, al aplicar,
 * recibe exclusivamente las filas releídas dentro de la transacción después
 * del `FOR UPDATE`. Así no existe un segundo camino geométrico y tampoco se
 * puede reutilizar por accidente el snapshot anterior al cerrojo.
 */
function prepararMaterializacion(
  filaSala: Record<string, unknown>,
  mobiliario: MuebleBorrador[],
  silla: MuebleCatalogo,
): PreparacionMaterializacion {
  const sala = aSalaGeometrica(filaSala);
  const fallo = (motivo: string): PreparacionMaterializacion => ({ ok: false, sala, motivo });
  const mesa = mesaDeLaSala(sala);
  if (!mesa) return fallo('sin las medidas de la mesa no hay sillas que colocar');
  if (!sala.aforo) return fallo('sin aforo no hay sillas que materializar');
  if (mobiliario.some((m) => m.mobiliario_id === silla.id)) {
    return fallo('ya tiene filas de silla y sigue en derivadas: dos fuentes vivas, se revisa a mano');
  }

  const reparto = repartirSillasEnLaSala(mesa, sala.aforo, {
    largo_m: sala.largo_m,
    ancho_m: sala.ancho_m,
  });
  if (reparto.sinSitio > 0) {
    return fallo(
      `${reparto.sinSitio} ${reparto.sinSitio === 1 ? 'silla del aforo no cabe' : 'sillas del aforo no caben'} alrededor de la mesa dentro de la sala`,
    );
  }
  if (reparto.sillas.length === 0) {
    return fallo('el aforo no coloca ninguna silla alrededor de la mesa');
  }

  const borrador: BorradorPlano = {
    largo_m: sala.largo_m,
    ancho_m: sala.ancho_m,
    alto_m: sala.alto_m,
    aforo: sala.aforo,
    mesa_largo_m: sala.mesa_largo_m,
    mesa_ancho_m: sala.mesa_ancho_m,
    mesa_alto_cm: sala.mesa_alto_cm,
    mesa_x_m: sala.mesa_x_m,
    mesa_y_m: sala.mesa_y_m,
    mesa_rotacion_grados: sala.mesa_rotacion_grados,
    equipos: [],
    mobiliario,
    tomas: [],
    puertas: [],
    sillas_modo: 'derivadas',
    inicio: null,
  };
  const ids = reparto.sillas.map(() => randomUUID());
  const despues = materializarSillas(borrador, reparto.sillas, silla, ids);
  const nuevas = despues.mobiliario.filter((m) => m.es_nuevo);
  if (nuevas.length !== reparto.sillas.length) {
    return fallo(
      `el reparto da ${reparto.sillas.length} sillas y solo ${nuevas.length} caen dentro de la sala`,
    );
  }
  return { ok: true, sala, nuevas };
}

/**
 * La silla del catálogo.
 *
 * Se busca por ROL y no por clave ni por nombre, igual que hace el editor: el
 * rol es lo que dice qué papel juega el mueble, y `data/mobiliario.csv` puede
 * renombrar «Silla» sin dejar de tener asiento. Si hay más de un asiento activo
 * no se elige por corazonada: se devuelve nulo y todas las salas se saltan con
 * el motivo escrito.
 */
export async function asientoCanonico(
  sql: postgres.Sql,
): Promise<{ silla: MuebleCatalogo | null; motivo: string | null }> {
  const filas = await sql<Array<Record<string, unknown>>>`
    select id, clave, nombre, categoria, palabras_clave, forma, rol,
           largo_m_defecto, ancho_m_defecto, alto_m_defecto
      from catalogo_mobiliario
     where activo and rol = 'asiento'
     order by orden, nombre`;

  if (filas.length === 0) {
    return { silla: null, motivo: 'el catálogo no tiene ningún asiento activo' };
  }
  if (filas.length > 1) {
    const claves = filas.map((f) => String(f.clave)).join(', ');
    return { silla: null, motivo: `el catálogo tiene varios asientos activos (${claves})` };
  }

  const f = filas[0];
  return {
    silla: {
      id: String(f.id),
      clave: String(f.clave),
      nombre: String(f.nombre),
      categoria: String(f.categoria),
      palabras_clave: f.palabras_clave == null ? null : String(f.palabras_clave),
      forma: f.forma === 'circulo' ? 'circulo' : 'rectangulo',
      rol: 'asiento',
      largo_m_defecto: num(f.largo_m_defecto),
      ancho_m_defecto: num(f.ancho_m_defecto),
      alto_m_defecto: num(f.alto_m_defecto),
    },
    motivo: null,
  };
}

/**
 * El backfill.
 *
 * En seco recorre lo mismo y calcula lo mismo, pero no abre ninguna
 * transacción de escritura: el informe que sale es el que se va a cumplir.
 */
export async function migrarSillas(
  sql: postgres.Sql,
  { aplicar = false }: { aplicar?: boolean } = {},
): Promise<InformeBackfill> {
  const { silla, motivo: motivoCatalogo } = await asientoCanonico(sql);

  const salas = await sql<Array<Record<string, unknown>>>`
    select id, nombre, aforo, largo_m, ancho_m, alto_m,
           mesa_largo_m, mesa_ancho_m, mesa_alto_cm,
           mesa_x_m, mesa_y_m, mesa_rotacion_grados,
           diagrama_version, sillas_modo
      from salas
     where sillas_modo = 'derivadas'
     order by nombre`;

  const informe: InformeBackfill = {
    enDerivadas: salas.length,
    materializadas: 0,
    filas: 0,
    saltadas: [],
    aplicado: aplicar,
  };

  // Sin referencia canónica no se materializa nada: la silla escrita sin
  // `mobiliario_id` sería un mueble huérfano que nadie puede reconocer.
  if (!silla) {
    for (const f of salas) {
      informe.saltadas.push({
        id: String(f.id),
        nombre: String(f.nombre),
        motivo: `falta la referencia canónica del catálogo: ${motivoCatalogo}`,
      });
    }
    return informe;
  }

  for (const f of salas) {
    const salaInicial = aSalaGeometrica(f);
    const mueblesIniciales = aplicar
      ? []
      : (
          await sql<Array<Record<string, unknown>>>`
            select id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m,
                   x_m, y_m, z_m, rotacion_grados, posicion_confirmada,
                   origen_plantilla_mobiliario_id, orden
              from sala_mobiliario where sala_id = ${salaInicial.id} order by orden, nombre`
        ).map(aMuebleBorrador);

    if (!aplicar) {
      const preparada = prepararMaterializacion(f, mueblesIniciales, silla);
      if (!preparada.ok) {
        informe.saltadas.push({
          id: preparada.sala.id,
          nombre: preparada.sala.nombre,
          motivo: preparada.motivo,
        });
        continue;
      }
      informe.materializadas += 1;
      informe.filas += preparada.nuevas.length;
      continue;
    }

    // Sala a sala y en una sola transacción: las filas y el cambio de modo
    // entran juntos o no entra ninguno. Media sala materializada dibujaría las
    // sillas nuevas y las del aforo a la vez.
    const aplicada = await sql.begin(async (tx) => {
      // ------------------------------------------- el orden de cerrojos
      //
      // PRIMERO la fila de `salas` y después las filas hijas, que es el mismo
      // orden que usa `guardarDiagramaSala` (`acciones-diagrama.ts`) y el que
      // comparten todas las acciones de la ficha (`enLaSalaBloqueada`, en
      // `acciones.ts`). Insertar el mobiliario antes y bloquear la sala al
      // final era el orden CONTRARIO: un backfill y un guardado del plano sobre
      // la misma sala se quedaban cada uno con el cerrojo que esperaba el otro,
      // y Postgres mata a uno de los dos. Un backfill que muere a la mitad de
      // 390 salas es exactamente lo que no puede pasar de madrugada.
      //
      // El cerrojo hace además innecesario releer el modo por sorpresa: entre
      // esta lectura y el commit nadie más puede tocar la sala.
      // No basta con releer `sillas_modo`: medidas, mesa, aforo y mobiliario
      // también pueden haber cambiado mientras este proceso esperaba. Se leen
      // DESPUÉS del cerrojo y la geometría se calcula con este estado, nunca
      // con el snapshot de la consulta inicial que solo enumeró candidatos.
      const [bloqueada] = await tx<Array<Record<string, unknown>>>`
        select id, nombre, aforo, largo_m, ancho_m, alto_m,
               mesa_largo_m, mesa_ancho_m, mesa_alto_cm,
               mesa_x_m, mesa_y_m, mesa_rotacion_grados,
               diagrama_version, sillas_modo
          from salas where id = ${salaInicial.id} for update`;
      if (!bloqueada) {
        throw new Error(`la sala ${salaInicial.nombre} desapareció mientras se migraba`);
      }
      if (bloqueada.sillas_modo !== 'derivadas') {
        throw new Error(`la sala ${salaInicial.nombre} dejó de estar en derivadas mientras se migraba`);
      }

      const mobiliario = (
        await tx<Array<Record<string, unknown>>>`
          select id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m,
                 x_m, y_m, z_m, rotacion_grados, posicion_confirmada,
                 origen_plantilla_mobiliario_id, orden
            from sala_mobiliario where sala_id = ${salaInicial.id} order by orden, nombre`
      ).map(aMuebleBorrador);
      const preparada = prepararMaterializacion(bloqueada, mobiliario, silla);
      if (!preparada.ok) return preparada;

      for (const m of preparada.nuevas) {
        // `fuente = 'backfill'` es lo que hace deshacible esto. El defecto de
        // la columna es `app`, así que la silla que coloque una persona desde
        // el editor no se parece a esta ni aunque se escriba el mismo minuto.
        await tx`
          insert into sala_mobiliario
            (id, sala_id, mobiliario_id, nombre, forma, largo_m, ancho_m, alto_m,
             x_m, y_m, z_m, rotacion_grados, posicion_confirmada, orden, fuente)
          values (${m.id}, ${preparada.sala.id}, ${m.mobiliario_id}, ${m.nombre}, ${m.forma},
                  ${m.largo_m}, ${m.ancho_m}, ${m.alto_m},
                  ${m.x_m}, ${m.y_m}, ${m.z_m}, ${m.rotacion_grados},
                  ${m.posicion_confirmada}, ${m.orden}, 'backfill')`;
      }

      // El `where sillas_modo = 'derivadas'` no es adorno: entre la lectura y
      // la escritura alguien ha podido materializar esta sala desde el editor.
      // Si el modo ya no es el que se leyó, se lanza y la transacción entera se
      // deshace, incluidas las filas de arriba.
      //
      // Y `diagrama_version` sube en la MISMA sentencia que el cambio de modo,
      // por lo mismo que en `acciones.ts`: el backfill cambia el plano —ocho
      // sillas donde antes había ocho círculos derivados— y una pestaña de
      // Diagrama abierta desde antes seguiría creyendo vigente su número. Al
      // guardar mandaría su borrador con `sillas_modo` a manuales y las
      // materializaría OTRA VEZ: dieciséis sillas. Con la versión movida
      // recibe conflicto y decide.
      //
      // No sube en seco (no se llega aquí), ni en las salas saltadas (tampoco),
      // ni en una segunda pasada: la primera las dejó en `manuales`, así que ya
      // no salen de la consulta de `derivadas`.
      const cambio = await tx`
        update salas
           set sillas_modo      = 'manuales',
               diagrama_version = diagrama_version + 1
         where id = ${preparada.sala.id} and sillas_modo = 'derivadas'`;
      if (cambio.count !== 1) {
        throw new Error(`la sala ${preparada.sala.nombre} dejó de estar en derivadas mientras se migraba`);
      }
      return preparada;
    });

    if (!aplicada.ok) {
      informe.saltadas.push({
        id: aplicada.sala.id,
        nombre: aplicada.sala.nombre,
        motivo: aplicada.motivo,
      });
      continue;
    }
    informe.materializadas += 1;
    informe.filas += aplicada.nuevas.length;
  }

  return informe;
}

// ---------------------------------------------------------------------
// La línea de comandos
// ---------------------------------------------------------------------

function imprimir(informe: InformeBackfill, host: string, sugerirAplicar = true) {
  const modo = informe.aplicado ? 'APLICANDO' : 'EN SECO (nada se ha escrito)';
  console.log(`Backfill de sillas · ${modo}`);
  console.log(`Base de datos: ${host}\n`);
  const linea = (etiqueta: string, valor: number) =>
    console.log(`${etiqueta.padEnd(38, ' ')}${valor}`);
  linea('Salas en modo derivadas', informe.enDerivadas);
  linea(
    informe.aplicado ? 'Salas materializadas' : 'Salas que se materializarían',
    informe.materializadas,
  );
  linea(
    informe.aplicado ? 'Filas de silla escritas' : 'Filas de silla que saldrían',
    informe.filas,
  );
  linea('Salas que se quedan en derivadas', informe.saltadas.length);

  if (informe.saltadas.length > 0) {
    // No son fallos: son el fallback previsto para los datos históricos. Se
    // siguen dibujando como hoy, con las sillas repartidas desde el aforo.
    console.log(
      '\nEstas salas siguen con las sillas derivadas del aforo y se dibujan igual que hoy:',
    );
    for (const s of informe.saltadas) console.log(`  · ${s.nombre} — ${s.motivo}`);
  }

  if (sugerirAplicar && !informe.aplicado && informe.materializadas > 0) {
    console.log('\nPara escribirlo: npm run migrar:sillas -- --aplicar');
  }
}

/** El nombre de la base, que es lo que hay que teclear para autorizar. */
export function nombreDeLaBase(url: string): string {
  return url.split('?')[0].split('/').pop() ?? '';
}

/**
 * ¿Es la base de Docker de la máquina de uno?
 *
 * Se compara el HOST, no la cadena entera. Buscar «127.0.0.1» dentro de la
 * dirección da por local `db.127.0.0.1.algo.example`, que no lo es, y ese es
 * justo el nombre que tendría un túnel montado a las prisas. Una dirección que
 * ni siquiera se puede analizar se trata como remota: ante la duda, ceremonia.
 */
export function esBaseLocal(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

/**
 * Contra una base que no es local, escribir exige teclear su nombre.
 *
 * La variable de producción está a un `export` de distancia y el comando es
 * exactamente el mismo que se acaba de ejecutar contra Docker. Un `--si` se
 * teclea por inercia; el nombre de la base de destino, no: hay que mirar a
 * dónde se está apuntando para poder escribirlo.
 *
 * Leer sí se permite sin ceremonia. Poder mirar producción en seco antes de
 * decidir es justo lo que hace falta para decidir.
 */
export function escrituraAutorizada({
  aplicar,
  local,
  base,
  confirmo,
}: {
  aplicar: boolean;
  local: boolean;
  base: string;
  confirmo: string | null;
}): boolean {
  if (!aplicar) return true;
  if (local) return true;
  return confirmo !== null && confirmo === base;
}

const esEjecutable =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecutable) {
  const aplicar = process.argv.includes('--aplicar');
  const confirmo =
    process.argv.find((a) => a.startsWith('--confirmo='))?.slice('--confirmo='.length) ?? null;
  const url =
    process.env.DATABASE_URL ?? 'postgres://av_design:av_design_local@localhost:5433/av_design';
  const local = esBaseLocal(url);
  const base = nombreDeLaBase(url);
  const autorizada = escrituraAutorizada({ aplicar, local, base, confirmo });

  // Fuera de local se exige TLS. Una base remota de pruebas sin TLS tiene que
  // decirlo en su propia dirección; la de producción no lleva eso escrito, y
  // esto no afecta a la puerta de arriba: autorizar y cifrar son dos cosas.
  const sinTls = local || url.includes('sslmode=disable');
  const sql = postgres(url, { max: 1, ssl: sinTls ? false : 'require' });
  try {
    const informe = await migrarSillas(sql, { aplicar: aplicar && autorizada });
    imprimir(informe, url.replace(/:\/\/[^@]*@/, '://'), autorizada);

    if (aplicar && !autorizada) {
      console.log('\nESCRITURA NO AUTORIZADA · no se ha escrito nada.');
      console.log(
        `\n  La base «${base}» no es local, así que ${informe.filas} filas de silla en ${informe.materializadas} salas`,
      );
      console.log('  no se escriben sin decir a dónde van. Para autorizarlo:');
      console.log(`\n    npm run migrar:sillas -- --aplicar --confirmo=${base}\n`);
      console.log('  Es un paso manual, no parte de ningún despliegue automático.');
      if (confirmo !== null) {
        console.log(`\n  (Se recibió --confirmo=${confirmo}, y la base de destino es «${base}».)`);
      }
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

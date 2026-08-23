/**
 * Regresión de las guardas de "proyecto cerrado" en `src/app/acciones.ts`:
 * `guardarSala`, `borrarSala`, `anadirEquipo`, `guardarEquipo`,
 * `ajustarCantidadEquipo`, `borrarEquipo`, `anadirToma`, `guardarToma`,
 * `borrarToma`, `anadirConexion`, `guardarConexion` y `borrarConexion` — el
 * gate P1 completo, no solo el fallo de `sala_id` suplantado que lo motivó.
 * Tomas de red y conexiones se añadieron tras el E2E de cierre de V4
 * (agentes FLUJO y BORDES, hallazgos E2E-FLU-001 y E2E-BOR-001): mismo bug
 * que ya se había corregido en equipos, sin corregir todavía ahí.
 *
 * No es parte de `npm test`: `npm test` es la lógica pura de `src/lib`
 * (AGENTS.md), y esto necesita Postgres real e importa código de servidor.
 * Se ejecuta con:
 *
 *   npm run test:guardas-sala
 *
 * Qué comprueba, por acción:
 * - Proyecto cerrado: la acción no escribe nada. (Negativo.)
 * - Sala legado (sin `localizacion_id`, "legado válido" según AGENTS.md):
 *   la acción SÍ escribe. Sin esto, una guarda rota que devolviera siempre
 *   sin hacer nada pasaría igual la comprobación anterior — es el control
 *   positivo que impide que las acciones se conviertan en no-op permanente.
 * - Para `guardarEquipo`, `ajustarCantidadEquipo` y `borrarEquipo`: un
 *   `sala_id` suplantado (una sala real, abierta, que no es la del equipo)
 *   o inventado (no existe ninguna sala con ese id) no permite tocar un
 *   equipo de la sala cerrada. Es el fallo original: la guarda comprobaba
 *   el cierre de la sala que mandaba el formulario, no la del equipo.
 *
 * Reglas de esta prueba:
 * - No escribe, sobrescribe ni borra `node_modules/server-only`. Sin
 *   `"type": "module"` en `package.json`, `tsx` carga `src/app/acciones.ts`
 *   como CommonJS, así que `import 'server-only'` de `src/lib/db.ts` llega a
 *   `Module._load`, no al grafo ESM. Se intercepta ahí, en memoria, para el
 *   único especificador `'server-only'`: la misma técnica que usan
 *   `proxyquire`/`mock-require` para simular un módulo sin tocar el disco.
 *   Nada se escribe en `node_modules` en ningún momento de esta prueba.
 * - Solo se tolera un error: el `Invariant: static generation store
 *   missing` que lanza `revalidatePath()` de Next fuera de una petición
 *   real, y solo cuando aparece — es la señal de que la acción llegó más
 *   allá de la guarda y escribió. Cualquier otro error hace fallar la
 *   prueba entera (no se traga nada más).
 * - La limpieza (`finally`) borra sus propios datos de prueba aunque una
 *   comprobación falle, y nada más: un proyecto cerrado con su localización
 *   y su sala, una sala legado aparte, y cascada de Postgres para todos los
 *   equipos que se van creando por sub-caso.
 */

import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

process.env.DATABASE_URL ??= 'postgres://av_design:av_design_local@localhost:5433/av_design';

// Intercepta únicamente 'server-only' en el `require()` de CommonJS, en
// memoria, para el ciclo de vida de este proceso. No toca `node_modules`.
type ModuloConLoad = { _load: (request: string, ...resto: unknown[]) => unknown };
const moduloInterno = Module as unknown as ModuloConLoad;
const cargarOriginal = moduloInterno._load;
moduloInterno._load = (request, ...resto) => {
  if (request === 'server-only') return {};
  return cargarOriginal.call(Module, request, ...resto);
};

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });

// Mensaje y código exactos que lanza `revalidate()` de Next fuera de una
// petición real (`node_modules/next/dist/server/web/spec-extension/revalidate.js`):
// `Invariant: static generation store missing in ${expression}`, código E263.
// Se ancla al prefijo y al código, no a un `includes()` genérico, para no
// tragarse por error otra cosa que contenga esas palabras sueltas.
const PREFIJO_SEÑAL_REVALIDATE = 'Invariant: static generation store missing in ';
const CODIGO_SEÑAL_REVALIDATE = 'E263';

let ok = true;
let total = 0;
let pasadas = 0;
const afirmar = (cond: boolean, mensaje: string) => {
  total += 1;
  if (cond) pasadas += 1;
  console.log(`${cond ? 'OK   ' : 'FALLO'} ${mensaje}`);
  if (!cond) ok = false;
};

// ------------------------------------------------------------------ datos

const proyectoId = randomUUID();
const localizacionId = randomUUID();
const salaCerradaId = randomUUID();
const salaLegadoId = randomUUID();
// Filas propias para `borrarSala`: es destructiva, así que no puede compartir
// sala con las comprobaciones de sala_id suplantado de arriba (le borrarían
// el señuelo que necesitan).
const salaCerradaBorrarId = randomUUID();
const salaLegadoBorrarId = randomUUID();
// Obra abierta con su localización: es el único escenario donde el
// formulario de medidas deja de mandar `edificio` y `nivel`, porque la
// planta ya la dice la localización. La obra de arriba está cerrada y no
// sirve: su guarda rechaza la escritura antes de llegar al UPDATE.
const proyectoAbiertoId = randomUUID();
const localizacionAbiertaId = randomUUID();
const salaEnObraId = randomUUID();
const articuloBocasId = randomUUID();
const puertoSalidaId = randomUUID();
const puertoEntradaId = randomUUID();

async function limpiar() {
  // `sala_equipos` tiene `on delete cascade` desde `salas` (db/schema.sql):
  // borrar las salas ya limpia sus equipos, altas incluidas.
  await sql`delete from salas where id in (
    ${salaCerradaId}, ${salaLegadoId}, ${salaCerradaBorrarId}, ${salaLegadoBorrarId},
    ${salaEnObraId}
  )`;
  await sql`delete from hitos_proyecto where proyecto_id = ${proyectoId}`;
  await sql`delete from localizaciones where id in (${localizacionId}, ${localizacionAbiertaId})`;
  await sql`delete from proyectos where id in (${proyectoId}, ${proyectoAbiertoId})`;
  await sql`delete from articulos where id = ${articuloBocasId}`;
}

async function preparar() {
  await limpiar(); // por si quedó algo de una ejecución anterior interrumpida

  await sql`insert into articulos (id, tipo, categoria, modelo) values (${articuloBocasId}, 'equipo', 'TEST', 'TEST BOCAS GUARDA')`;
  await sql`insert into puertos (id, articulo_id, nombre, total, sentido, senal) values
    (${puertoSalidaId}, ${articuloBocasId}, 'OUTPUT', 1, 'salida', 'hdmi'),
    (${puertoEntradaId}, ${articuloBocasId}, 'INPUT', 1, 'entrada', 'hdmi')`;

  await sql`insert into proyectos (id, nombre) values (${proyectoId}, 'TEST-guarda-equipos')`;
  await sql`insert into localizaciones (id, proyecto_id, nombre)
            values (${localizacionId}, ${proyectoId}, 'TEST')`;
  await sql`insert into hitos_proyecto (proyecto_id, tipo, fecha) values (${proyectoId}, 'cierre', now())`;
  await sql`insert into salas (id, nombre, localizacion_id, largo_m, ancho_m, alto_m)
            values (${salaCerradaId}, 'TEST sala cerrada', ${localizacionId}, 3, 3, 3)`;
  // Sala legado: sin localizacion_id, como cualquier sala de antes de la
  // jerarquía Proyecto → Localización → Sala. Sirve de control positivo
  // (sigue editable) y de sala señuelo abierta para los ataques de
  // sala_id suplantado.
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m)
            values (${salaLegadoId}, 'TEST sala legado', 3, 3, 3)`;
  await sql`insert into salas (id, nombre, localizacion_id, largo_m, ancho_m, alto_m)
            values (${salaCerradaBorrarId}, 'TEST sala cerrada (borrar)', ${localizacionId}, 3, 3, 3)`;
  await sql`insert into salas (id, nombre, largo_m, ancho_m, alto_m)
            values (${salaLegadoBorrarId}, 'TEST sala legado (borrar)', 3, 3, 3)`;

  // Sala adoptada por una obra abierta, con el edificio y el nivel que traía
  // de antes de la jerarquía: son el dato que no puede evaporarse al guardar.
  await sql`insert into proyectos (id, nombre) values (${proyectoAbiertoId}, 'TEST-guarda-abierta')`;
  await sql`insert into localizaciones (id, proyecto_id, nombre)
            values (${localizacionAbiertaId}, ${proyectoAbiertoId}, 'TEST Edificio A · Planta 1')`;
  await sql`insert into salas (id, nombre, localizacion_id, edificio, nivel, largo_m, ancho_m, alto_m)
            values (${salaEnObraId}, 'TEST sala en obra', ${localizacionAbiertaId},
                    'ÁFRICA', 'NIVEL 0', 3, 3, 3)`;
}

/**
 * Un equipo nuevo por sub-caso, no una fila compartida: `borrarEquipo`
 * destruye la fila cuando la guarda falla, así que reutilizar el mismo
 * equipo entre sub-casos de ataque encadenaría un falso OK (el segundo
 * ataque "no cambia nada" porque el primero ya lo había borrado, no porque
 * la guarda lo bloqueara). Cada sub-caso parte de un equipo propio.
 */
async function nuevoEquipo(salaId: string, etiqueta: string): Promise<string> {
  const id = randomUUID();
  await sql`
    insert into sala_equipos (id, sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m)
    values (${id}, ${salaId}, ${articuloBocasId}, ${etiqueta}, 1, 'pared', 0, 0, 0)`;
  return id;
}

/** Misma razón que `nuevoEquipo`: una toma propia por sub-caso, no compartida. */
async function nuevaToma(salaId: string, etiqueta: string): Promise<string> {
  const id = randomUUID();
  await sql`
    insert into tomas_red (id, sala_id, codigo) values (${id}, ${salaId}, ${etiqueta})`;
  return id;
}

/**
 * Misma razón que `nuevoEquipo`: una conexión propia por sub-caso. `origen_id`
 * y `destino_id` son `not null` contra `sala_equipos`, así que cada conexión
 * arrastra sus dos equipos propios (no se comparten entre sub-casos).
 */
async function nuevaConexion(salaId: string, etiqueta: string): Promise<string> {
  const origenId = await nuevoEquipo(salaId, `${etiqueta}-origen`);
  const destinoId = await nuevoEquipo(salaId, `${etiqueta}-destino`);
  const id = randomUUID();
  await sql`
    insert into conexiones (id, sala_id, origen_id, destino_id, senal)
    values (${id}, ${salaId}, ${origenId}, ${destinoId}, 'hdmi')`;
  return id;
}

// ---------------------------------------------------------------- ejecución

try {
  await preparar();

  const {
    guardarSala,
    anadirEquipo,
    guardarEquipo,
    ajustarCantidadEquipo,
    borrarEquipo,
    borrarSala,
    anadirToma,
    guardarToma,
    borrarToma,
    anadirConexion,
    guardarConexion,
    borrarConexion,
  } = await import('../src/app/acciones');

  /**
   * Invoca una acción tolerando solo la señal esperada de "llegó más allá
   * de la guarda" (ver cabecera). Cualquier otro error se relanza: hace
   * fallar el script entero, no una sola comprobación silenciosa.
   */
  const invocar = async (accion: (d: FormData) => Promise<void>, datos: FormData) => {
    try {
      await accion(datos);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      const codigo = (e as { ['__NEXT_ERROR_CODE']?: string })?.['__NEXT_ERROR_CODE'];
      const esSeñalEsperada =
        mensaje.startsWith(PREFIJO_SEÑAL_REVALIDATE) && codigo === CODIGO_SEÑAL_REVALIDATE;
      if (!esSeñalEsperada) throw e;
      console.log(`  (la acción llegó más allá de la guarda: ${mensaje})`);
    }
  };

  const filaSala = async (id: string) => {
    const [f] = await sql<
      Array<{
        nombre: string;
        largo_m: string;
        edificio: string | null;
        nivel: string | null;
      }>
    >`select nombre, largo_m, edificio, nivel from salas where id = ${id}`;
    return f;
  };
  const filaEquipo = async (id: string) => {
    const filas = await sql<Array<{ cantidad: number; nombre: string }>>`
      select cantidad, nombre from sala_equipos where id = ${id}`;
    return filas[0] ?? null;
  };
  const contarEquiposDeSala = async (salaId: string) => {
    const [f] = await sql<Array<{ n: string }>>`
      select count(*)::text as n from sala_equipos where sala_id = ${salaId}`;
    return Number(f.n);
  };
  const filaToma = async (id: string) => {
    const filas = await sql<Array<{ codigo: string; notas: string | null }>>`
      select codigo, notas from tomas_red where id = ${id}`;
    return filas[0] ?? null;
  };
  const contarTomasDeSala = async (salaId: string) => {
    const [f] = await sql<Array<{ n: string }>>`
      select count(*)::text as n from tomas_red where sala_id = ${salaId}`;
    return Number(f.n);
  };
  const filaConexion = async (id: string) => {
    const filas = await sql<Array<{ senal: string }>>`
      select senal from conexiones where id = ${id}`;
    return filas[0] ?? null;
  };
  const contarConexionesDeSala = async (salaId: string) => {
    const [f] = await sql<Array<{ n: string }>>`
      select count(*)::text as n from conexiones where sala_id = ${salaId}`;
    return Number(f.n);
  };

  // -------------------------------------------------------------- guardarSala

  console.log('\n=== guardarSala ===');
  {
    const antes = await filaSala(salaCerradaId);
    const fd = new FormData();
    fd.set('id', salaCerradaId);
    fd.set('nombre', 'NOMBRE-COLADO-SALA-CERRADA');
    await invocar(guardarSala, fd);
    const tras = await filaSala(salaCerradaId);
    afirmar(
      tras.nombre === antes.nombre,
      `proyecto cerrado: no escribe (nombre "${antes.nombre}" → "${tras.nombre}")`,
    );
  }
  {
    const antes = await filaSala(salaLegadoId);
    const fd = new FormData();
    fd.set('id', salaLegadoId);
    fd.set('nombre', antes.nombre);
    fd.set('largo_m', '9.99');
    await invocar(guardarSala, fd);
    const tras = await filaSala(salaLegadoId);
    afirmar(
      tras.largo_m === '9.99' && tras.largo_m !== antes.largo_m,
      `sala legado: sí escribe (largo_m "${antes.largo_m}" → "${tras.largo_m}")`,
    );
  }
  // El formulario de medidas de una sala con localización no manda `edificio`
  // ni `nivel` (`components/sala/medidas.tsx`): la planta ya la dice la obra.
  // Esa ausencia no puede leerse como "bórralos", o adoptar una sala legado y
  // volver a guardarla vaciaría en silencio el dato que traía.
  {
    const antes = await filaSala(salaEnObraId);
    const fd = new FormData();
    fd.set('id', salaEnObraId);
    fd.set('nombre', antes.nombre);
    fd.set('largo_m', '7.77');
    await invocar(guardarSala, fd);
    const tras = await filaSala(salaEnObraId);
    afirmar(
      tras.largo_m === '7.77',
      `sala en obra: el guardado se ejecuta (largo_m "${antes.largo_m}" → "${tras.largo_m}")`,
    );
    afirmar(
      tras.edificio === antes.edificio && tras.nivel === antes.nivel,
      `sala en obra: sin los campos, edificio y nivel sobreviven ("${antes.edificio} · ${antes.nivel}" → "${tras.edificio} · ${tras.nivel}")`,
    );
  }
  // Control positivo del mismo par: la sala sin obra sí los manda y sí se
  // escriben. Sin esto, un guardado que ignorara siempre los dos campos
  // pasaría igual la comprobación de arriba.
  {
    const antes = await filaSala(salaLegadoId);
    const fd = new FormData();
    fd.set('id', salaLegadoId);
    fd.set('nombre', antes.nombre);
    fd.set('edificio', 'ÁFRICA');
    fd.set('nivel', 'NIVEL 1');
    await invocar(guardarSala, fd);
    const tras = await filaSala(salaLegadoId);
    afirmar(
      tras.edificio === 'ÁFRICA' && tras.nivel === 'NIVEL 1',
      `sala legado: con los campos, edificio y nivel sí se escriben ("${antes.edificio} · ${antes.nivel}" → "${tras.edificio} · ${tras.nivel}")`,
    );
  }

  // ------------------------------------------------------------- anadirEquipo

  console.log('\n=== anadirEquipo ===');
  {
    const antes = await contarEquiposDeSala(salaCerradaId);
    const fd = new FormData();
    fd.set('sala_id', salaCerradaId);
    fd.set('nombre', 'TEST equipo colado en sala cerrada');
    await invocar(anadirEquipo, fd);
    const tras = await contarEquiposDeSala(salaCerradaId);
    afirmar(tras === antes, `proyecto cerrado: no inserta (equipos ${antes} → ${tras})`);
  }
  {
    const antes = await contarEquiposDeSala(salaLegadoId);
    const fd = new FormData();
    fd.set('sala_id', salaLegadoId);
    fd.set('nombre', 'TEST equipo nuevo en sala legado');
    await invocar(anadirEquipo, fd);
    const tras = await contarEquiposDeSala(salaLegadoId);
    afirmar(tras === antes + 1, `sala legado: sí inserta (equipos ${antes} → ${tras})`);
  }

  // ------------------------------------------------------- guardarEquipo, etc.

  type FilaEquipo = { cantidad: number; nombre: string } | null;

  /**
   * Las cuatro comprobaciones comunes a las tres acciones sobre un equipo
   * ya existente: cerrado, sala_id suplantado, sala_id inventado y legado.
   * Cada una parte de un equipo recién creado (ver `nuevoEquipo`): no
   * comparten fila entre sí.
   */
  async function verificarAccionDeEquipo(opciones: {
    etiqueta: string;
    accion: (d: FormData) => Promise<void>;
    /** Construye el FormData de ataque/control para un equipo y sala_id dados. */
    datos: (equipoId: string, salaId: string) => FormData;
    /** `true` si el estado cambió entre `antes` y `tras`. */
    cambio: (antes: FilaEquipo, tras: FilaEquipo) => boolean;
  }) {
    console.log(`\n=== ${opciones.etiqueta} ===`);

    {
      const id = await nuevoEquipo(salaCerradaId, `${opciones.etiqueta} cerrado real`);
      const antes = await filaEquipo(id);
      await invocar(opciones.accion, opciones.datos(id, salaCerradaId));
      const tras = await filaEquipo(id);
      afirmar(!opciones.cambio(antes, tras), 'proyecto cerrado, sala_id real: no escribe');
    }
    {
      const id = await nuevoEquipo(salaCerradaId, `${opciones.etiqueta} cerrado señuelo`);
      const antes = await filaEquipo(id);
      await invocar(opciones.accion, opciones.datos(id, salaLegadoId));
      const tras = await filaEquipo(id);
      afirmar(
        !opciones.cambio(antes, tras),
        'sala_id suplantado (sala legado abierta): no toca el equipo cerrado',
      );
    }
    {
      const id = await nuevoEquipo(salaCerradaId, `${opciones.etiqueta} cerrado inventado`);
      const antes = await filaEquipo(id);
      await invocar(opciones.accion, opciones.datos(id, randomUUID()));
      const tras = await filaEquipo(id);
      afirmar(!opciones.cambio(antes, tras), 'sala_id inventado: no toca el equipo cerrado');
    }
    {
      const id = await nuevoEquipo(salaLegadoId, `${opciones.etiqueta} legado real`);
      const antes = await filaEquipo(id);
      await invocar(opciones.accion, opciones.datos(id, salaLegadoId));
      const tras = await filaEquipo(id);
      afirmar(opciones.cambio(antes, tras), 'sala legado, sala_id real: sí escribe');
    }
  }

  await verificarAccionDeEquipo({
    etiqueta: 'guardarEquipo',
    accion: guardarEquipo,
    datos: (equipoId, salaId) => {
      const fd = new FormData();
      fd.set('id', equipoId);
      fd.set('sala_id', salaId);
      fd.set('nombre', `NOMBRE-COLADO-${randomUUID()}`);
      return fd;
    },
    cambio: (antes, tras) => antes?.nombre !== tras?.nombre,
  });

  await verificarAccionDeEquipo({
    etiqueta: 'ajustarCantidadEquipo',
    accion: ajustarCantidadEquipo,
    datos: (equipoId, salaId) => {
      const fd = new FormData();
      fd.set('id', equipoId);
      fd.set('sala_id', salaId);
      fd.set('paso', '1');
      return fd;
    },
    cambio: (antes, tras) => antes?.cantidad !== tras?.cantidad,
  });

  await verificarAccionDeEquipo({
    etiqueta: 'borrarEquipo',
    accion: borrarEquipo,
    datos: (equipoId, salaId) => {
      const fd = new FormData();
      fd.set('id', equipoId);
      fd.set('sala_id', salaId);
      return fd;
    },
    // Bloqueado: `tras` sigue igual que `antes`. Bypass: `tras` es null.
    cambio: (antes, tras) => antes != null && tras == null,
  });

  // ---------------------------------------------------------------- anadirToma

  console.log('\n=== anadirToma ===');
  {
    const antes = await contarTomasDeSala(salaCerradaId);
    const fd = new FormData();
    fd.set('sala_id', salaCerradaId);
    fd.set('codigo', `TEST-COLADO-${randomUUID()}`);
    await invocar(anadirToma, fd);
    const tras = await contarTomasDeSala(salaCerradaId);
    afirmar(tras === antes, `proyecto cerrado: no inserta (tomas ${antes} → ${tras})`);
  }
  {
    const antes = await contarTomasDeSala(salaLegadoId);
    const fd = new FormData();
    fd.set('sala_id', salaLegadoId);
    fd.set('codigo', `TEST-NUEVA-${randomUUID()}`);
    await invocar(anadirToma, fd);
    const tras = await contarTomasDeSala(salaLegadoId);
    afirmar(tras === antes + 1, `sala legado: sí inserta (tomas ${antes} → ${tras})`);
  }

  // ------------------------------------------------------- guardarToma, etc.

  type FilaToma = { codigo: string; notas: string | null } | null;

  /** Mismas cuatro comprobaciones que `verificarAccionDeEquipo`, para tomas de red. */
  async function verificarAccionDeToma(opciones: {
    etiqueta: string;
    accion: (d: FormData) => Promise<void>;
    datos: (tomaId: string, salaId: string) => FormData;
    cambio: (antes: FilaToma, tras: FilaToma) => boolean;
  }) {
    console.log(`\n=== ${opciones.etiqueta} ===`);

    {
      const id = await nuevaToma(salaCerradaId, `${opciones.etiqueta}-cerrado-real-${randomUUID()}`);
      const antes = await filaToma(id);
      await invocar(opciones.accion, opciones.datos(id, salaCerradaId));
      const tras = await filaToma(id);
      afirmar(!opciones.cambio(antes, tras), 'proyecto cerrado, sala_id real: no escribe');
    }
    {
      const id = await nuevaToma(salaCerradaId, `${opciones.etiqueta}-cerrado-señuelo-${randomUUID()}`);
      const antes = await filaToma(id);
      await invocar(opciones.accion, opciones.datos(id, salaLegadoId));
      const tras = await filaToma(id);
      afirmar(
        !opciones.cambio(antes, tras),
        'sala_id suplantado (sala legado abierta): no toca la toma cerrada',
      );
    }
    {
      const id = await nuevaToma(salaCerradaId, `${opciones.etiqueta}-cerrado-inventado-${randomUUID()}`);
      const antes = await filaToma(id);
      await invocar(opciones.accion, opciones.datos(id, randomUUID()));
      const tras = await filaToma(id);
      afirmar(!opciones.cambio(antes, tras), 'sala_id inventado: no toca la toma cerrada');
    }
    {
      const id = await nuevaToma(salaLegadoId, `${opciones.etiqueta}-legado-real-${randomUUID()}`);
      const antes = await filaToma(id);
      await invocar(opciones.accion, opciones.datos(id, salaLegadoId));
      const tras = await filaToma(id);
      afirmar(opciones.cambio(antes, tras), 'sala legado, sala_id real: sí escribe');
    }
  }

  await verificarAccionDeToma({
    etiqueta: 'guardarToma',
    accion: guardarToma,
    datos: (tomaId, salaId) => {
      const fd = new FormData();
      fd.set('id', tomaId);
      fd.set('sala_id', salaId);
      fd.set('codigo', `NOMBRE-COLADO-${randomUUID()}`);
      return fd;
    },
    cambio: (antes, tras) => antes?.codigo !== tras?.codigo,
  });

  await verificarAccionDeToma({
    etiqueta: 'borrarToma',
    accion: borrarToma,
    datos: (tomaId, salaId) => {
      const fd = new FormData();
      fd.set('id', tomaId);
      fd.set('sala_id', salaId);
      return fd;
    },
    cambio: (antes, tras) => antes != null && tras == null,
  });

  // ------------------------------------------------------------ anadirConexion

  console.log('\n=== anadirConexion ===');
  {
    const antes = await contarConexionesDeSala(salaCerradaId);
    const origenId = await nuevoEquipo(salaCerradaId, 'anadirConexion-cerrado-origen');
    const destinoId = await nuevoEquipo(salaCerradaId, 'anadirConexion-cerrado-destino');
    const fd = new FormData();
    fd.set('sala_id', salaCerradaId);
    fd.set('origen_id', origenId);
    fd.set('destino_id', destinoId);
    fd.set('puerto_origen_id', puertoSalidaId);
    fd.set('puerto_origen_ordinal', '1');
    fd.set('puerto_destino_id', puertoEntradaId);
    fd.set('puerto_destino_ordinal', '1');
    await invocar(anadirConexion, fd);
    const tras = await contarConexionesDeSala(salaCerradaId);
    afirmar(tras === antes, `proyecto cerrado: no inserta (conexiones ${antes} → ${tras})`);
  }
  {
    const antes = await contarConexionesDeSala(salaLegadoId);
    const origenId = await nuevoEquipo(salaLegadoId, 'anadirConexion-legado-origen');
    const destinoId = await nuevoEquipo(salaLegadoId, 'anadirConexion-legado-destino');
    const fd = new FormData();
    fd.set('sala_id', salaLegadoId);
    fd.set('origen_id', origenId);
    fd.set('destino_id', destinoId);
    fd.set('puerto_origen_id', puertoSalidaId);
    fd.set('puerto_origen_ordinal', '1');
    fd.set('puerto_destino_id', puertoEntradaId);
    fd.set('puerto_destino_ordinal', '1');
    await invocar(anadirConexion, fd);
    const tras = await contarConexionesDeSala(salaLegadoId);
    afirmar(tras === antes + 1, `sala legado: sí inserta (conexiones ${antes} → ${tras})`);
  }

  // ----------------------------------------------------- guardarConexion, etc.

  type FilaConexion = { senal: string } | null;

  /** Mismas cuatro comprobaciones que `verificarAccionDeEquipo`, para conexiones. */
  async function verificarAccionDeConexion(opciones: {
    etiqueta: string;
    accion: (d: FormData) => Promise<void>;
    datos: (conexionId: string, salaId: string) => FormData;
    cambio: (antes: FilaConexion, tras: FilaConexion) => boolean;
  }) {
    console.log(`\n=== ${opciones.etiqueta} ===`);

    {
      const id = await nuevaConexion(salaCerradaId, `${opciones.etiqueta}-cerrado-real`);
      const antes = await filaConexion(id);
      await invocar(opciones.accion, opciones.datos(id, salaCerradaId));
      const tras = await filaConexion(id);
      afirmar(!opciones.cambio(antes, tras), 'proyecto cerrado, sala_id real: no escribe');
    }
    {
      const id = await nuevaConexion(salaCerradaId, `${opciones.etiqueta}-cerrado-señuelo`);
      const antes = await filaConexion(id);
      await invocar(opciones.accion, opciones.datos(id, salaLegadoId));
      const tras = await filaConexion(id);
      afirmar(
        !opciones.cambio(antes, tras),
        'sala_id suplantado (sala legado abierta): no toca la conexión cerrada',
      );
    }
    {
      const id = await nuevaConexion(salaCerradaId, `${opciones.etiqueta}-cerrado-inventado`);
      const antes = await filaConexion(id);
      await invocar(opciones.accion, opciones.datos(id, randomUUID()));
      const tras = await filaConexion(id);
      afirmar(!opciones.cambio(antes, tras), 'sala_id inventado: no toca la conexión cerrada');
    }
    {
      const id = await nuevaConexion(salaLegadoId, `${opciones.etiqueta}-legado-real`);
      const antes = await filaConexion(id);
      await invocar(opciones.accion, opciones.datos(id, salaLegadoId));
      const tras = await filaConexion(id);
      afirmar(opciones.cambio(antes, tras), 'sala legado, sala_id real: sí escribe');
    }
  }

  await verificarAccionDeConexion({
    etiqueta: 'guardarConexion',
    accion: guardarConexion,
    datos: (conexionId, salaId) => {
      const fd = new FormData();
      fd.set('id', conexionId);
      fd.set('sala_id', salaId);
      fd.set('senal', 'red');
      fd.set('puerto_origen_id', puertoSalidaId);
      fd.set('puerto_origen_ordinal', '1');
      fd.set('puerto_destino_id', puertoEntradaId);
      fd.set('puerto_destino_ordinal', '1');
      return fd;
    },
    cambio: (antes, tras) => antes?.senal !== tras?.senal,
  });

  await verificarAccionDeConexion({
    etiqueta: 'borrarConexion',
    accion: borrarConexion,
    datos: (conexionId, salaId) => {
      const fd = new FormData();
      fd.set('id', conexionId);
      fd.set('sala_id', salaId);
      return fd;
    },
    cambio: (antes, tras) => antes != null && tras == null,
  });

  // ------------------------------------------------------------- borrarSala

  console.log('\n=== borrarSala ===');
  const existeSala = async (id: string) => {
    const [f] = await sql<Array<{ n: string }>>`
      select count(*)::text as n from salas where id = ${id}`;
    return Number(f.n) === 1;
  };
  {
    await invocar(borrarSala, (() => {
      const fd = new FormData();
      fd.set('id', salaCerradaBorrarId);
      return fd;
    })());
    afirmar(await existeSala(salaCerradaBorrarId), 'proyecto cerrado: no borra');
  }
  {
    await invocar(borrarSala, (() => {
      const fd = new FormData();
      fd.set('id', salaLegadoBorrarId);
      return fd;
    })());
    afirmar(!(await existeSala(salaLegadoBorrarId)), 'sala legado: sí borra');
  }
} finally {
  await limpiar();
  await sql.end();
}

console.log(`\n${pasadas}/${total} comprobaciones correctas.`);
console.log(ok ? 'Todo se comporta como se espera.' : 'Hay un fallo: revisar arriba.');
if (!ok) process.exitCode = 1;

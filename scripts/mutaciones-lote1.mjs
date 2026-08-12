/**
 * Ejecuta las mutaciones del Lote 1 y registra qué prueba cae con cada una.
 *
 *   node scripts/mutaciones-lote1.mjs
 *
 * No estima: rompe el código a propósito, ejecuta la suite que corresponde y
 * apunta el nombre de las pruebas que fallan. La PRIMERA de la lista es la
 * prueba primaria —la que afirma justo el contrato mutado— y el resto son
 * fallos en cascada, casi siempre porque el rechazo que no llegó dejó la sala
 * en otro estado o subió la versión.
 *
 * Cada mutación restaura el fichero al terminar, pase lo que pase.
 */

import { execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';

// --------------------------------------------------- checkout desechable
//
// Las mutaciones no se aplican en el árbol compartido. El runner toma una
// fotografía del checkout —incluidos los cambios sin commit y los ficheros sin
// seguimiento— y rompe únicamente esa copia. Así, una edición concurrente de
// Claude, Codex o una persona nunca puede ser desplazada a `.ajeno`, perdida de
// su ruta activa ni restaurada a una versión anterior.
//
// `node_modules` se comparte mediante una unión de directorio: copiarlo haría
// la preparación mucho más lenta que las propias pruebas. `.git`, `.next`,
// `output`, `Inicio` y `.tmp` no forman parte de lo que ejecutan estas suites.
const RAIZ_REAL = process.cwd();
const RAIZ_TEMPORAL = mkdtempSync(join(tmpdir(), 'av-design-mutaciones-lote1-'));
const RAIZ_SOMBRA = join(RAIZ_TEMPORAL, 'checkout');
const EXCLUIDOS = new Set(['.git', '.next', '.tmp', 'Inicio', 'node_modules', 'output']);

let sombraLimpia = false;
function limpiarSombra() {
  if (sombraLimpia) return;
  sombraLimpia = true;
  try {
    process.chdir(RAIZ_REAL);
  } finally {
    rmSync(RAIZ_TEMPORAL, { recursive: true, force: true });
  }
}
process.on('exit', limpiarSombra);
for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(senal, () => {
    limpiarSombra();
    process.exit(130);
  });
}

// En Windows, `child.kill('SIGTERM')` puede terminar el proceso sin darle la
// oportunidad de ejecutar sus listeners. Un proceso no puede garantizar su
// propia limpieza si el sistema no le devuelve el control, así que un vigilante
// mínimo y desacoplado observa este PID. Cuando desaparece, borra la sombra.
// En la salida normal encuentra que `limpiarSombra()` ya hizo el trabajo y se
// apaga. No hereda consola ni mantiene vivo al runner.
const codigoVigilante = String.raw`
  const { existsSync, rmSync } = require('node:fs');
  const pid = Number(process.argv[1]);
  const carpeta = process.argv[2];
  const vivo = () => {
    try { process.kill(pid, 0); return true; }
    catch { return false; }
  };
  const reloj = setInterval(() => {
    if (vivo()) return;
    clearInterval(reloj);
    if (existsSync(carpeta)) rmSync(carpeta, { recursive: true, force: true });
  }, 100);
`;
try {
  const vigilante = spawn(
    process.execPath,
    ['-e', codigoVigilante, String(process.pid), RAIZ_TEMPORAL],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );
  vigilante.unref();
} catch (error) {
  limpiarSombra();
  throw error;
}

// La red de limpieza existe ANTES de copiar. Si la copia, la unión de
// `node_modules` o el cambio de directorio falla —o recibe una señal— no queda
// un checkout parcial abandonado en `%TEMP%`. `mkdtempSync` evita además que un
// PID reutilizado choque con la sombra de una ejecución antigua.
try {
  cpSync(RAIZ_REAL, RAIZ_SOMBRA, {
    recursive: true,
    filter(origen) {
      const ruta = relative(RAIZ_REAL, origen);
      if (!ruta) return true;
      return !EXCLUIDOS.has(ruta.split(sep)[0]);
    },
  });
  symlinkSync(join(RAIZ_REAL, 'node_modules'), join(RAIZ_SOMBRA, 'node_modules'), 'junction');
  process.chdir(RAIZ_SOMBRA);
} catch (error) {
  limpiarSombra();
  throw error;
}

console.log(`matriz aislada en ${basename(RAIZ_TEMPORAL)}; el checkout compartido queda en solo lectura\n`);

// Solo lo usa `verificar-aislamiento-mutaciones.mjs`: deja la sombra viva el
// tiempo suficiente para enviar SIGTERM y comprobar que el handler la retira.
// Sin esta pausa explícita `--solo-preflight` termina antes de que una prueba
// externa pueda interrumpirla de forma determinista.
const pausaAislamiento = Number(process.env.AV_DESIGN_PRUEBA_PAUSA_AISLAMIENTO_MS ?? 0);
if (Number.isFinite(pausaAislamiento) && pausaAislamiento > 0) {
  await new Promise((resolve) => setTimeout(resolve, pausaAislamiento));
}

const MUTACIONES = [
  {
    nombre: 'Quitar el backfill de roles de la migración',
    fichero: 'db/migraciones/2026-08-rol-mobiliario.sql',
    de: "update catalogo_mobiliario set rol = 'asiento'\n where clave = 'silla' and rol is distinct from 'asiento';",
    a: '-- mutado: sin backfill',
    suite: 'npm run test:migracion',
    primaria: 'tras migrar hay exactamente un asiento, SIN volver a sembrar',
  },
  {
    nombre: 'Quitar la postcondición de fuente única',
    fichero: 'src/app/acciones-diagrama.ts',
    de: "if (Number(estado.asientos) > 0 && estado.sillas_modo !== 'manuales') {\n      throw new GuardadoRechazado(fallo('sillas'));\n    }",
    a: '// mutado: sin postcondición',
    suite: 'npm run test:diagrama',
    primaria: 'un asiento que no apaga el aforo se rechaza: serían dos fuentes vivas',
  },
  {
    nombre: 'No repartir las sillas derivadas dentro de la sala',
    fichero: 'src/lib/croquis.ts',
    de: '? repartirSillasEnLaSala(mesa, sala.aforo, rectSala)',
    a: '? { sillas: sillasAlrededor(mesa, sala.aforo), sinSitio: 0 }',
    suite: 'npm test',
    primaria: 'mesa pegada a la pared izquierda',
  },
  {
    // El reparto por lados y el «que quepan» son dos contratos distintos: se
    // puede cumplir el segundo apilándolas todas contra la misma coordenada,
    // que es justo lo que hacía la primera versión. Esta mutación deja las
    // sillas dentro de la sala y las amontona, para que caiga la prueba que
    // mide posiciones distintas y no la que mide que estén dentro.
    nombre: 'Amontonar las sillas de un lado en el mismo punto',
    fichero: 'src/lib/croquis.ts',
    de: 'const t = (j + 1) / (cuantas + 1);',
    a: 'const t = 0.5;',
    suite: 'npm test',
    primaria: 'contra la pared izquierda no se apila ninguna silla',
  },
  {
    nombre: 'Permitir superar el límite conjunto de altas',
    fichero: 'src/lib/plano-editor.ts',
    de: 'if (derivadas.length > MAXIMO_AFORO_MATERIALIZABLE) {',
    a: 'if (false) {',
    suite: 'npm test',
    primaria: 'un aforo por encima del límite no materializa ni inventa identificadores',
  },
  {
    nombre: 'Quitar la guarda de diagrama_iniciado_en',
    fichero: 'src/app/acciones-diagrama.ts',
    de: 'if (sala.diagrama_iniciado_en) {',
    a: 'if (false) {',
    suite: 'npm run test:diagrama',
    primaria: 'una sala que ya eligió Desde cero no acepta una plantilla, aunque esté vacía',
  },
  {
    // Se muta SOLO la postcondición, no la comprobación previa. La
    // comprobación previa sigue en pie y sigue cazando la plantilla que ya
    // tenía la mesa antes de empezar, así que lo único que cae es el caso que
    // solo la postcondición puede ver: la fila que aparece a mitad de la copia.
    nombre: 'Quitar la postcondición de una sola mesa · ruta Diagrama',
    fichero: 'src/app/acciones-diagrama.ts',
    de: 'if (mesaCopiada) {',
    a: 'if (false) {',
    suite: 'npm run test:diagrama',
    primaria: 'la mesa principal que aparece después de la comprobación previa se rechaza igual',
  },
  {
    nombre: 'Quitar la postcondición de una sola mesa · ruta crearSala',
    fichero: 'src/app/acciones.ts',
    de: 'if (mesaCopiada) throw new AltaRechazada(MENSAJE_MESA_EN_PLANTILLA);',
    a: '// mutado: sin postcondición',
    suite: 'npm run test:plantillas',
    primaria:
      'la mesa principal que aparece después de la comprobación previa se rechaza igual: no queda ninguna sala de la serie',
  },
  {
    nombre: 'Cualquier mueble apaga el aforo · ruta Diagrama',
    fichero: 'src/app/acciones-diagrama.ts',
    de: "where m.sala_id = ${salaId} and c.rol = 'asiento'",
    a: 'where m.sala_id = ${salaId}',
    suite: 'npm run test:diagrama',
    primaria: 'y el aforo sigue repartiendo las sillas: una mesa auxiliar no las sustituye',
  },
  {
    nombre: 'Cualquier mueble apaga el aforo · ruta crearSala',
    fichero: 'src/app/acciones.ts',
    de: "where m.sala_id = ${sala.id} and c.rol = 'asiento'",
    a: 'where m.sala_id = ${sala.id}',
    suite: 'npm run test:plantillas',
    primaria: 'y el aforo sigue repartiendo sus sillas: una mesa auxiliar no las sustituye',
  },
  // ------------------------------------------------------------------
  // El control de versión entre las seis pestañas de la ficha
  // ------------------------------------------------------------------
  {
    nombre: 'No subir la versión del plano al escribir desde otra pestaña',
    fichero: 'src/app/acciones.ts',
    de: 'update salas set diagrama_version = diagrama_version + 1',
    a: 'update salas set diagrama_version = diagrama_version',
    suite: 'npm run test:concurrencia',
    primaria: 'añadir un equipo desde Equipamiento sube la versión del plano',
  },
  {
    nombre: 'No subir la versión al guardar las medidas desde Resumen',
    fichero: 'src/app/acciones.ts',
    de: '      diagrama_version     = diagrama_version + 1,',
    a: '',
    suite: 'npm run test:concurrencia',
    primaria: 'guardar la sala desde Resumen sube la versión del plano',
  },
  // ------------------------------------------------------------------
  // Colocado y estimado: cero es una medida
  // ------------------------------------------------------------------
  {
    // El atajo que reintrodujo el fallo del rack: tratar (0,0) como si fuera
    // la ausencia de coordenada. La esquina es justo donde va el rack.
    nombre: 'Tratar la esquina (0,0) como ausencia de coordenada',
    fichero: 'src/app/acciones.ts',
    de: '  if (x == null || y == null) {',
    a: '  if (x == null || y == null || (x === 0 && y === 0)) {',
    suite: 'npm run test:concurrencia',
    primaria: 'el rack se coloca en la esquina: cero es una medida, no una ausencia',
  },
  {
    nombre: 'Una coordenada tecleada no coloca el equipo',
    fichero: 'src/app/acciones.ts',
    de: 'posicion_confirmada: true };',
    a: 'posicion_confirmada: false };',
    suite: 'npm run test:concurrencia',
    primaria: 'teclear X e Y en Equipamiento deja el equipo colocado, no estimado',
  },
  {
    nombre: 'Vaciar las casillas deja un (0,0,0) dado por medido',
    fichero: 'src/app/acciones.ts',
    de: '    return { x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: false };',
    a: '    return { x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: true };',
    suite: 'npm run test:concurrencia',
    primaria: 'vaciar las casillas devuelve el equipo a sin colocar',
  },
  {
    nombre: 'El formulario propone la coordenada de un equipo sin colocar',
    fichero: 'src/components/sala/equipamiento.tsx',
    de: "defaultValue={e.posicion_confirmada ? e.posicion[eje] : ''}",
    a: 'defaultValue={e.posicion[eje]}',
    suite: 'npm test',
    primaria: 'un equipo sin colocar enseña las casillas vacías',
  },
  // ------------------------------------------------------------------
  // El alta no copia una plantilla fuera de las medidas corregidas
  // ------------------------------------------------------------------
  {
    nombre: 'No validar lo copiado contra las medidas del formulario',
    fichero: 'src/app/acciones.ts',
    de: '          if (problemas.length > 0) {',
    a: '          if (false) {',
    suite: 'npm run test:plantillas',
    primaria:
      'una plantilla que coloca un equipo fuera de las medidas corregidas no crea ninguna sala de las tres copias',
  },
  // ------------------------------------------------------------------
  // Salir del editor con el borrador a medias
  // ------------------------------------------------------------------
  {
    nombre: 'Escuchar el clic en burbujeo: el enlace navega antes de que llegue',
    fichero: 'src/components/plano-editor/guardia-salida.tsx',
    de: "document.addEventListener('click', alPulsar, true);",
    a: "document.addEventListener('click', alPulsar, false);",
    suite: 'npm test',
    primaria: 'otra pestaña de la ficha no navega: pregunta antes',
  },
  {
    nombre: 'No dejar centinela: el botón atrás sale sin preguntar',
    fichero: 'src/components/plano-editor/guardia-salida.tsx',
    de: 'if (!activo || centinela.current) return;',
    a: 'if (true) return;',
    suite: 'npm test',
    primaria: 'el botón atrás del navegador tampoco se lleva el borrador en silencio',
  },
  {
    nombre: 'Escape no cancela la salida',
    fichero: 'src/components/plano-editor/guardia-salida.tsx',
    de: "if (ev.key === 'Escape') {",
    a: 'if (false) {',
    suite: 'npm test',
    primaria: 'el aviso es un diálogo modal con nombre, se lleva el foco y Escape cancela',
  },
  {
    nombre: 'Pulsar la pestaña activa cuenta como salir',
    fichero: 'src/lib/guardia-salida.ts',
    de: 'if (destino.pathname === actual.pathname && destino.search === actual.search) return null;',
    a: 'if (false) return null;',
    suite: 'npm test',
    primaria: 'el mismo sitio no es salir: la pestaña activa se puede pulsar',
  },
  // ------------------------------------------------------------------
  // Un fallo del listado no es «no hay plantillas»
  // ------------------------------------------------------------------
  {
    // El fallo original, tal cual era: `respuesta.ok ? json : []`. Un 500 salía
    // por la misma puerta que «no hay ninguna plantilla», y ahí `Desde cero`
    // seguía siendo la opción principal de una decisión que se escribe una vez
    // en `salas.diagrama_iniciado_en` y no se vuelve a preguntar.
    //
    // Antes esta mutación solo desactivaba `setSinListado(true)`, y eso no
    // reproducía nada: `leerRespuesta()` seguía lanzando y el combobox seguía
    // enseñando su propio error. Se muta la lectura, que es donde estaba el
    // defecto.
    nombre: 'Un error HTTP del listado de plantillas vuelve a ser una lista vacía',
    fichero: 'src/components/plano-editor/origen-diagrama.tsx',
    de: '        const lista = await leerRespuesta<PlantillaElegible>(respuesta);',
    a: '        const lista = respuesta.ok ? ((await respuesta.json()) as PlantillaElegible[]) : [];',
    suite: 'npm test',
    primaria: 'dice que no se pudo mirar, y no que no haya plantillas',
  },
  {
    nombre: 'El aviso de «no se pudo mirar» deja de encenderse',
    fichero: 'src/components/plano-editor/origen-diagrama.tsx',
    de: 'if (!signal.aborted) setSinListado(true);',
    a: 'if (false) setSinListado(true);',
    suite: 'npm test',
    primaria: 'dice que no se pudo mirar, y no que no haya plantillas',
  },
  {
    nombre: 'Desde cero sigue siendo la opción principal con el listado caído',
    fichero: 'src/components/plano-editor/origen-diagrama.tsx',
    de: "variante={sinListado ? 'secundario' : 'principal'}",
    a: "variante={'principal'}",
    suite: 'npm test',
    primaria: '«Desde cero» deja de ser la opción principal mientras no se pueda mirar',
  },
  // ------------------------------------------------------------------
  // El backfill de sillas
  // ------------------------------------------------------------------
  {
    nombre: 'Materializar sillas que no caben en la sala',
    fichero: 'scripts/migrar-sillas.mts',
    de: 'if (reparto.sinSitio > 0) {',
    a: 'if (reparto.sinSitio > 99) {',
    suite: 'npm run test:backfill-sillas',
    primaria: 'la sala donde no cabe ninguna silla se salta por eso',
  },
  {
    nombre: 'Escribir en producción sin confirmación',
    fichero: 'scripts/migrar-sillas.mts',
    de: '  if (local) return true;',
    a: '  return true;',
    suite: 'npm run test:backfill-sillas',
    primaria: 'contra una base remota no se escribe sin confirmación',
  },
  {
    nombre: 'Cualquier confirmación vale, no hace falta nombrar la base',
    fichero: 'scripts/migrar-sillas.mts',
    de: '  return confirmo !== null && confirmo === base;',
    a: '  return confirmo !== null;',
    suite: 'npm run test:backfill-sillas',
    primaria: 'y una confirmación que se teclea por inercia no vale',
  },
  {
    // El fallo que el propio ejecutor se encontró de frente: `includes` da por
    // local cualquier host que CONTENGA la cadena, y `127.0.0.1.nip.io` es el
    // nombre que tendría un túnel montado a las prisas.
    nombre: 'Dar por local un host que solo CONTIENE 127.0.0.1',
    fichero: 'scripts/migrar-sillas.mts',
    de: "  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';",
    a: "  return url.includes('localhost') || url.includes('127.0.0.1');",
    suite: 'npm run test:backfill-sillas',
    primaria: 'un host que solo CONTIENE 127.0.0.1 no es local: se compara el host, no la cadena',
  },
  {
    nombre: 'El backfill escribe sus filas como si las hubiera puesto una persona',
    fichero: 'scripts/migrar-sillas.mts',
    de: "'backfill')`;",
    a: "'app')`;",
    suite: 'npm run test:backfill-sillas',
    primaria: 'todas las filas que escribe el backfill quedan marcadas fuente = backfill',
  },
  {
    // El backfill cambia el plano: donde había ocho círculos derivados ahora
    // hay ocho filas. Sin mover la versión, una pestaña abierta desde antes
    // guarda con su número intacto y las materializa otra vez.
    nombre: 'El backfill cambia el plano sin subir la versión',
    fichero: 'scripts/migrar-sillas.mts',
    de: "        update salas\n           set sillas_modo      = 'manuales',\n               diagrama_version = diagrama_version + 1\n         where id = ${preparada.sala.id} and sillas_modo = 'derivadas'`;",
    a: "        update salas set sillas_modo = 'manuales'\n         where id = ${preparada.sala.id} and sillas_modo = 'derivadas'`;",
    suite: 'npm run test:backfill-sillas',
    primaria: 'cada sala materializada sube su versión del plano exactamente una vez',
  },
  {
    // El rollback anterior recorría TODAS las salas manuales y devolvía a
    // derivadas cualquiera sin asientos, hubiera pasado por el backfill o no.
    nombre: 'El rollback vuelve a alcanzar a las salas manuales que nunca tocó',
    fichero: 'scripts/migrar-sillas.mts',
    de: ' where s.id in (select sala_id from rollback_backfill_sillas);',
    a: ' where true;',
    suite: 'npm run test:backfill-sillas',
    primaria:
      'una sala manual preexistente y SIN sillas se queda en manuales: el rollback no la había tocado',
  },
  // ------------------------------------------------------------------
  // El orden de cerrojos entre las superficies de la ficha
  // ------------------------------------------------------------------
  {
    // Escribir la tabla hija antes de bloquear la sala es el orden inverso al
    // del guardado del plano, y dos órdenes opuestos sobre las mismas filas son
    // un abrazo mortal esperando a que coincidan. Con esta mutación el equipo se
    // escribe primero y la sala se bloquea al subir la versión: el contendiente
    // llega a esperar con `sala_equipos` ya cogida, que es lo que se detecta.
    nombre: 'Escribir el equipo antes de bloquear la sala',
    fichero: 'src/app/acciones.ts',
    de: '  await enLaSalaBloqueada(salaId, async (tx) => {\n    const escrito = await tx`\n      update sala_equipos set',
    a: '  await sql.begin(async (tx) => {\n    const escrito = await tx`\n      update sala_equipos set',
    suite: 'npm run test:concurrencia',
    primaria:
      'Equipamiento · guardar equipo: espera el cerrojo de la sala SIN haber escrito antes en ninguna tabla hija',
  },
  {
    // La prueba de concurrencia sin barrera común no mide concurrencia: los dos
    // contendientes van cada uno por su lado y pueden ejecutarse en serie.
    nombre: 'Quitar la barrera común a la prueba de concurrencia',
    fichero: 'scripts/verificar-concurrencia.mts',
    de: '        const { pid, soltar, fin } = await tomarBarrera(salaCarreraId);\n\n        // Los dos contendientes se lanzan sin esperar',
    a: '        const { pid, soltar, fin } = await tomarBarrera(salaCroquisId);\n\n        // Los dos contendientes se lanzan sin esperar',
    suite: 'npm run test:concurrencia',
    primaria: 'los dos contendientes esperan a la vez el mismo cerrojo de sala',
  },
  {
    nombre: 'Una superficie heredada deja de subir la versión del plano',
    fichero: 'src/app/acciones.ts',
    de: '    if (alta.length === 0) return;',
    a: '    return;',
    suite: 'npm run test:concurrencia',
    primaria: 'dar de alta una roseta sube la versión del plano',
  },
  // ------------------------------------------------------------------
  // Lo que se relee del catálogo y contra qué medidas se valida
  // ------------------------------------------------------------------
  {
    nombre: 'Un alta del plano ya no exige que la referencia sea un equipo',
    fichero: 'src/app/acciones-diagrama.ts',
    de: "where id in ${tx(ids)} and activo and tipo = 'equipo'",
    a: 'where id in ${tx(ids)} and activo',
    suite: 'npm run test:diagrama',
    primaria: 'un cable no se puede añadir como equipo del plano',
  },
  {
    // Medir la sala y colocar el equipo en el mismo guardado es el caso normal.
    // Validar contra las medidas de la fila —las de antes— lo rechaza.
    nombre: 'Validar lo colocado contra las medidas viejas de la sala',
    fichero: 'src/app/acciones-diagrama.ts',
    de: '      largo_m: p.sala ? p.sala.largo_m : Number(sala.largo_m ?? 0),',
    a: '      largo_m: Number(sala.largo_m ?? 0),',
    suite: 'npm run test:diagrama',
    primaria: 'una coordenada que solo cabe en las medidas NUEVAS del patch entra',
  },
  // ------------------------------------------------------------------
  // El backfill y el rollback cogen los cerrojos como todos los demás
  // ------------------------------------------------------------------
  {
    // El listado inicial solo enumera candidatos. Reutilizar aquí `f` vuelve a
    // materializar medidas, mesa y aforo leídos antes del cerrojo, aunque
    // Diagrama haya ganado la carrera y dejado otra geometría ya confirmada.
    nombre: 'El backfill calcula con la geometría anterior al cerrojo',
    fichero: 'scripts/migrar-sillas.mts',
    de: 'const preparada = prepararMaterializacion(bloqueada, mobiliario, silla);',
    a: 'const preparada = prepararMaterializacion(f, mobiliario, silla);',
    suite: 'npm run test:backfill-sillas',
    primaria:
      'el backfill relee el aforo bajo el lock: quedan dos sillas y no las ocho anteriores',
  },
  {
    nombre: 'El backfill escribe el mobiliario antes de bloquear la sala',
    fichero: 'scripts/migrar-sillas.mts',
    de: '          from salas where id = ${salaInicial.id} for update`;',
    a: '          from salas where id = ${salaInicial.id}`;',
    suite: 'npm run test:backfill-sillas',
    primaria: 'el backfill espera el cerrojo de la sala SIN haber escrito antes en sala_mobiliario',
    evidencia: 'sala_mobiliario',
  },
  {
    nombre: 'El rollback borra el mobiliario antes de bloquear la sala',
    fichero: 'scripts/migrar-sillas.mts',
    de: 'select id from salas\n where id in (select sala_id from rollback_backfill_sillas)\n order by id\n for update;',
    a: '-- mutado: sin bloquear las salas antes de borrar',
    suite: 'npm run test:backfill-sillas',
    primaria: 'el rollback espera el cerrojo de la sala SIN haber borrado antes de sala_mobiliario',
    evidencia: 'sala_mobiliario',
  },
  {
    // El alta de la sede es una ESCRITURA. Fuera de la transacción, una obra
    // cerrada aceptaba sedes nuevas aunque la sala se rechazara entera.
    nombre: 'Resolver la sede antes de abrir la transacción de la sala',
    fichero: 'src/app/acciones.ts',
    de: `  await enLaSalaBloqueada(id, async (tx) => {
    // La sede se resuelve DENTRO de la transacción y después del cerrojo,
    // porque \`sedeId\` escribe: da de alta la sede que no existía. Resolverla
    // antes creaba la sede aunque la escritura de la sala se rechazara —una
    // obra cerrada aceptaba así sedes nuevas a cambio de nada— y además metía
    // una escritura en \`sedes\` por delante del cerrojo de \`salas\`.
    const sede = await sedeId(texto(datos.get('sede')), tx);`,
    a: `  const sede = await sedeId(texto(datos.get('sede')));
  await enLaSalaBloqueada(id, async (tx) => {`,
    suite: 'npm run test:concurrencia',
    primaria:
      'y una sede nueva mandada a una obra cerrada tampoco se crea: el rechazo se lleva la transacción entera',
  },
  {
    nombre: 'Perder el giro del equipo en el viaje sala → plantilla',
    fichero: 'src/app/acciones.ts',
    de: '                ${Number(e.rotacion_grados ?? 0)})\n        returning id`;',
    a: '                ${0})\n        returning id`;',
    suite: 'npm run test:plantillas',
    primaria: 'los equipos vuelven con su extremo, sus coordenadas y su marca de colocado',
  },
];

/** Los nombres de las pruebas que fallan, en el orden en que las imprime la suite. */
function caidas(salida, suite) {
  if (suite === 'npm test') {
    return [...salida.matchAll(/^ {2}✖ (.+?) \(\d/gm)].map((m) => m[1]);
  }
  return [...salida.matchAll(/^FALLO (.+)$/gm)].map((m) => m[1]);
}

/**
 * Escribe reintentando: en Windows el vigilante de ficheros del servidor de
 * desarrollo puede tener el fichero abierto un instante y el primer intento
 * falla con UNKNOWN. Sin esto, una mutación se cae por el sistema operativo y
 * no por lo que se está midiendo.
 */
function escribirConReintento(ruta, contenido, intentos = 20) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      writeFileSync(ruta, contenido);
      return;
    } catch (e) {
      if (i === intentos - 1) throw e;
      execSync('node -e "setTimeout(()=>{},150)"');
    }
  }
}

// ------------------------------------------------- el seguro contra apagones
//
// Un `finally` no se ejecuta si el proceso muere: Ctrl-C, una sesión que se
// cierra o un portátil que se apaga dejan el fichero MUTADO en el árbol. Pasó,
// y lo que se quedó puesto fue justo la mutación que permite escribir en
// producción sin confirmación.
//
// Por eso el original se copia a disco ANTES de mutar y se apunta dónde. Si el
// proceso no llega a borrar esa nota, la siguiente ejecución la encuentra y
// restaura antes de hacer nada. El `finally` sigue estando; esto es la red.

const RESGUARDO = 'scripts/.mutacion-en-curso';
const NOTA = `${RESGUARDO}/estado.json`;
const COPIA = `${RESGUARDO}/original.bak`;

function anotarMutacionEnCurso(fichero, original) {
  mkdirSync(RESGUARDO, { recursive: true });
  writeFileSync(COPIA, original);
  writeFileSync(NOTA, JSON.stringify({ fichero }, null, 2));
}

function olvidarMutacionEnCurso() {
  rmSync(RESGUARDO, { recursive: true, force: true });
}

/** Deshace lo que dejó a medias una ejecución que no llegó a terminar. */
function recuperarDeUnaMuerteAnterior() {
  if (!existsSync(NOTA)) return false;
  const { fichero } = JSON.parse(readFileSync(NOTA, 'utf8'));
  const original = readFileSync(COPIA);
  writeFileSync(fichero, original);
  olvidarMutacionEnCurso();
  console.error(
    `RECUPERADO: una ejecución anterior murió con ${fichero} mutado. Restaurado desde el resguardo.\n`,
  );
  return true;
}

recuperarDeUnaMuerteAnterior();

/**
 * La huella del fichero: el hash de sus BYTES en disco.
 *
 * Antes se comparaba `git diff`, y eso no vale: un fichero sin seguimiento
 * —`guardia-salida.tsx`, `migrar-sillas.mts` y la mitad de lo que se muta
 * aquí— no sale en ningún diff, así que la comparación daba vacío antes y
 * vacío después aunque el fichero se hubiera quedado mutado. El hash del
 * contenido no depende de que Git conozca el fichero.
 */
function huella(fichero) {
  return createHash('sha256').update(readFileSync(fichero)).digest('hex');
}

// ---------------------------------------------------------- preflight
//
// Antes de romper nada: el patrón de cada mutación tiene que existir UNA sola
// vez. Cero veces es una mutación que no prueba nada y se da por probada; dos
// veces es una sustitución que muta un sitio distinto del que dice.
//
// Con `--solo-preflight` no se muta nada: sirve para comprobar que el árbol
// está sano —por ejemplo después de una ejecución interrumpida— sin pagar los
// quince minutos de suites.
{
  let mal = 0;
  for (const m of MUTACIONES) {
    const texto = readFileSync(m.fichero, 'utf8').replace(/\r\n/g, '\n');
    const veces = texto.split(m.de).length - 1;
    // Cero coincidencias es lo que delata una mutación que se quedó puesta: el
    // código sano contiene el patrón exactamente una vez.
    //
    // Buscar en cambio el TEXTO MUTADO no sirve, y da falsos positivos a
    // puñados: casi todas las mutaciones de aquí son recortes del original
    // (`... and c.rol = 'asiento'` → `...`), así que el texto mutado es una
    // subcadena del sano y aparece siempre.
    if (veces !== 1) {
      console.error(
        `PREFLIGHT ${m.nombre}: el patrón aparece ${veces} veces en ${m.fichero}` +
          (veces === 0 ? ' (¿quedó una mutación puesta?)' : ''),
      );
      mal += 1;
    }
  }
  if (mal > 0) {
    console.error(`\n${mal} problemas de integridad. No se ejecuta ninguna mutación.`);
    process.exit(1);
  }
  console.log(`preflight: ${MUTACIONES.length} patrones, todos únicos y sin mutar\n`);
  if (process.argv.includes('--solo-preflight')) process.exit(0);
}

const filas = [];

const argumentoSolo = process.argv.find((arg) => arg.startsWith('--solo-mutacion='));
const nombreSolo = argumentoSolo?.slice('--solo-mutacion='.length) ?? null;
const mutacionesAEjecutar = nombreSolo
  ? MUTACIONES.filter((m) => m.nombre === nombreSolo)
  : MUTACIONES;
if (nombreSolo && mutacionesAEjecutar.length !== 1) {
  console.error(`No existe una única mutación llamada «${nombreSolo}».`);
  process.exit(1);
}

for (const m of mutacionesAEjecutar) {
  // Los patrones se escriben con `\n` y el checkout de Windows tiene CRLF: sin
  // normalizar, toda mutación de más de una línea decía «patrón no encontrado»
  // y la guarda se daba por probada sin haberla roto nunca. Se busca y se
  // sustituye sobre el texto normalizado, y se RESTAURAN los bytes originales
  // al terminar, así que el fichero del repositorio conserva sus finales de
  // línea sea cual sea el checkout.
  const original = readFileSync(m.fichero, 'utf8');
  const huellaAntes = huella(m.fichero);
  const normalizado = original.replace(/\r\n/g, '\n');
  if (!normalizado.includes(m.de)) {
    console.error(`\n### ${m.nombre}\n  PATRÓN NO ENCONTRADO en ${m.fichero}`);
    filas.push({ ...m, error: 'patrón no encontrado' });
    continue;
  }
  const mutado = normalizado.replace(m.de, m.a);
  anotarMutacionEnCurso(m.fichero, original);
  escribirConReintento(m.fichero, mutado);
  const huellaMutado = huella(m.fichero);
  console.log(`mutación preparada en sombra: ${m.nombre}`);
  const pausaTrasMutar = Number(process.env.AV_DESIGN_PRUEBA_PAUSA_TRAS_MUTAR_MS ?? 0);
  if (Number.isFinite(pausaTrasMutar) && pausaTrasMutar > 0) {
    await new Promise((resolve) => setTimeout(resolve, pausaTrasMutar));
  }
  let salida = '';
  let pisado = null;
  try {
    salida = execSync(m.suite, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, AV_DESIGN_RAIZ_GIT: RAIZ_REAL },
    });
  } catch (e) {
    salida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  } finally {
    // Si el fichero en disco ya no es el que se mutó, alguien lo ha tocado
    // mientras corría la suite. Restaurar a secas se llevaría ese trabajo por
    // delante, así que primero se guarda aparte y se dice dónde.
    if (huella(m.fichero) !== huellaMutado) {
      pisado = `${m.fichero}.ajeno`;
      escribirConReintento(pisado, readFileSync(m.fichero));
    }
    escribirConReintento(m.fichero, original);
    olvidarMutacionEnCurso();
  }

  const restaurado = huella(m.fichero) === huellaAntes;
  const lista = caidas(salida, m.suite);
  // No basta con que caiga una prueba con ese nombre: si la mutación declara
  // una evidencia, tiene que aparecer en la salida. Es lo que distingue «cae
  // por el contrato que dice» de «cae por lo que sea».
  const evidenciaOk = m.evidencia == null || new RegExp(m.evidencia).test(salida);
  const primariaCae = lista.includes(m.primaria) && restaurado && evidenciaOk && !pisado;
  filas.push({ ...m, lista, primariaCae, restaurado, evidenciaOk, pisado });

  console.log(`\n### ${m.nombre}`);
  if (pisado) {
    console.error(`  FICHERO TOCADO POR OTRO durante la suite; su versión está en ${pisado}`);
  }
  if (!restaurado) {
    console.error(`  FICHERO NO RESTAURADO: ${m.fichero} no vuelve a su contenido anterior`);
  }
  if (!evidenciaOk) {
    console.error(`  SIN EVIDENCIA: no aparece /${m.evidencia}/ en la salida de la suite`);
  }
  console.log(`  suite: ${m.suite}  ·  caen ${lista.length}`);
  console.log(`  primaria: ${primariaCae ? 'CAE' : 'NO CAE ← revisar'} · «${m.primaria}»`);
  if (!primariaCae && lista.length === 0) {
    console.error(`  salida de diagnóstico:\n${salida.slice(-3000)}`);
  }
  const cascada = lista.filter((n) => n !== m.primaria);
  console.log(
    cascada.length ? `  cascada (${cascada.length}): ${cascada.join(' | ')}` : '  cascada: ninguna',
  );
}

console.log('\n\n==== resumen ====');
for (const f of filas) {
  const cascada = (f.lista ?? []).filter((n) => n !== f.primaria).length;
  console.log(
    `${f.primariaCae ? 'OK   ' : 'FALLO'} ${f.nombre} · primaria ${f.primariaCae ? 'cae' : 'NO cae'} · cascada ${cascada}`,
  );
}
const todas = filas.every((f) => f.primariaCae);
console.log(todas ? '\nTodas las mutaciones caen por su prueba primaria.' : '\nHay mutaciones sin prueba primaria.');
if (!todas) process.exit(1);

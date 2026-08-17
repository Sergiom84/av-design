/**
 * Quién es cada persona y qué puede ver.
 *
 * Hasta ahora la puerta era una clave de departamento: servía para que no
 * entrara quien pasara por la dirección, pero no distinguía a nadie. Con
 * usuarios reales aparecen dos preguntas que antes no existían: qué secciones
 * ve cada uno y cuáles puede tocar.
 *
 * Esto es lógica pura y tiene pruebas. No lee la base de datos, no lee la
 * cookie y no sabe nada de Next: recibe un rol y unas excepciones y devuelve
 * un permiso. Quien lo conecta con la sesión es `sesion-servidor.ts`.
 */

/**
 * Los roles del departamento.
 *
 * `av` desapareció: era el visto bueno de Audiovisuales cuando el flujo se
 * copió de XTEN-AV, y hoy no lo usa nadie. Sigue existiendo en el enum de
 * Postgres porque quitar un valor de un enum obliga a recrear el tipo entero
 * —con todas las columnas que lo referencian— y eso es riesgo real a cambio de
 * nada. Aquí está prohibido, que es donde importa: `esRol()` lo rechaza y
 * ningún alta puede escribirlo.
 */
export const ROLES = ['admin', 'tei', 'tecnico_avanzado', 'tecnico', 'lectura'] as const;

export type Rol = (typeof ROLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  tei: 'TEI (arquitectura)',
  tecnico_avanzado: 'Técnico avanzado',
  tecnico: 'Técnico',
  lectura: 'Solo lectura',
};

export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: 'Todo, más el alta de usuarios y sus permisos.',
  tei: 'Arquitectura: diseña la sala y propone la compra. No mueve almacén.',
  tecnico_avanzado: 'Todo el trabajo de campo, más compras y parámetros.',
  tecnico: 'Instala y monta: salas, check-in, almacén y carga.',
  lectura: 'Consulta. No modifica nada.',
};

export function esRol(valor: string): valor is Rol {
  return (ROLES as readonly string[]).includes(valor);
}

/**
 * Las secciones son las del menú, una por entrada, más `usuarios`.
 *
 * El identificador no es la ruta: la ruta puede cambiar y el permiso guardado
 * en la base no debería cambiar con ella. `ruta` es dónde vive hoy.
 */
export const SECCIONES = [
  { id: 'panel', ruta: '/', etiqueta: 'Panel' },
  { id: 'proyectos', ruta: '/proyectos', etiqueta: 'Proyectos' },
  { id: 'salas', ruta: '/salas', etiqueta: 'Salas' },
  { id: 'plantillas', ruta: '/plantillas', etiqueta: 'Plantillas' },
  { id: 'checkin', ruta: '/checkin', etiqueta: 'Check-in' },
  { id: 'catalogo', ruta: '/catalogo', etiqueta: 'Catálogo' },
  { id: 'almacen', ruta: '/almacen', etiqueta: 'Almacén' },
  { id: 'compras', ruta: '/compras', etiqueta: 'Compras' },
  { id: 'carga', ruta: '/carga', etiqueta: 'Carga' },
  { id: 'parametros', ruta: '/parametros', etiqueta: 'Parámetros' },
  { id: 'usuarios', ruta: '/usuarios', etiqueta: 'Usuarios' },
] as const;

export type Seccion = (typeof SECCIONES)[number]['id'];

export const IDS_SECCION = SECCIONES.map((s) => s.id) as readonly Seccion[];

export function esSeccion(valor: string): valor is Seccion {
  return (IDS_SECCION as readonly string[]).includes(valor);
}

/**
 * Tres estados y no dos. `oculto` no enseña la sección; `ver` la enseña y no
 * deja escribir; `editar` es lo de siempre. Con solo enseñar/ocultar, «este
 * técnico consulta el almacén pero no lo mueve» no se podía expresar.
 */
export const ACCESOS = ['oculto', 'ver', 'editar'] as const;

export type Acceso = (typeof ACCESOS)[number];

export function esAcceso(valor: string): valor is Acceso {
  return (ACCESOS as readonly string[]).includes(valor);
}

const ORDEN: Record<Acceso, number> = { oculto: 0, ver: 1, editar: 2 };

/** `editar` incluye `ver`. Comparar por orden y no por igualdad evita repetirlo. */
export function alcanza(tiene: Acceso, minimo: Acceso): boolean {
  return ORDEN[tiene] >= ORDEN[minimo];
}

export type Permisos = Record<Seccion, Acceso>;

function mapa(
  defecto: Acceso,
  excepciones: Partial<Record<Seccion, Acceso>> = {},
): Permisos {
  const salida = {} as Permisos;
  for (const id of IDS_SECCION) salida[id] = excepciones[id] ?? defecto;
  return salida;
}

/**
 * Lo que trae cada rol de fábrica. Es el punto de partida del alta, no una
 * jaula: el administrador ajusta después lo que haga falta persona a persona.
 *
 * El criterio de los defectos:
 * - `usuarios` solo lo ve el administrador. Quien puede crear usuarios puede
 *   crearse uno con más permisos que los suyos, así que no es una sección más.
 * - TEI diseña y propone compra, pero no mueve existencias ni carga furgonetas.
 * - El técnico hace el trabajo de campo y no toca parámetros ni catálogo:
 *   cambiar una holgura afecta al cálculo de las 390 salas.
 */
export const PERMISOS_POR_ROL: Record<Rol, Permisos> = {
  admin: mapa('editar'),

  tei: mapa('editar', {
    almacen: 'ver',
    carga: 'ver',
    usuarios: 'oculto',
  }),

  tecnico_avanzado: mapa('editar', {
    usuarios: 'oculto',
  }),

  tecnico: mapa('ver', {
    salas: 'editar',
    checkin: 'editar',
    almacen: 'editar',
    carga: 'editar',
    parametros: 'oculto',
    usuarios: 'oculto',
  }),

  lectura: mapa('ver', {
    parametros: 'oculto',
    usuarios: 'oculto',
  }),
};

/**
 * El permiso efectivo: el rol pone el defecto y la excepción por persona lo
 * pisa.
 *
 * El administrador es el único caso que no se puede pisar, y a propósito.
 * Guardar «admin sin acceso a usuarios» deja la aplicación sin nadie que pueda
 * dar permisos, y recuperarlo es entrar a la base a mano. Un control que
 * permite dejarte fuera para siempre no es un control, es una trampa.
 */
export function resolverPermisos(
  rol: Rol,
  excepciones: Partial<Record<Seccion, Acceso>> = {},
): Permisos {
  if (rol === 'admin') return PERMISOS_POR_ROL.admin;

  const base = PERMISOS_POR_ROL[rol];
  const salida = {} as Permisos;
  for (const id of IDS_SECCION) salida[id] = excepciones[id] ?? base[id];
  return salida;
}

/** Solo se guardan las excepciones que de verdad cambian algo respecto al rol. */
export function excepcionesReales(
  rol: Rol,
  elegido: Partial<Record<Seccion, Acceso>>,
): Partial<Record<Seccion, Acceso>> {
  const base = PERMISOS_POR_ROL[rol];
  const salida: Partial<Record<Seccion, Acceso>> = {};
  for (const id of IDS_SECCION) {
    const valor = elegido[id];
    if (valor && valor !== base[id]) salida[id] = valor;
  }
  return salida;
}

export function puede(permisos: Permisos, seccion: Seccion, minimo: Acceso): boolean {
  return alcanza(permisos[seccion], minimo);
}

/**
 * A qué sección pertenece una ruta.
 *
 * Se busca la coincidencia más larga: `/salas` y `/` compiten por `/salas/x`, y
 * gana la específica. `/` solo casa consigo misma, porque si no sería el
 * prefijo de todo.
 */
export function seccionDeRuta(ruta: string): Seccion | null {
  let mejor: Seccion | null = null;
  let largo = -1;

  for (const { id, ruta: base } of SECCIONES) {
    const casa =
      base === '/' ? ruta === '/' : ruta === base || ruta.startsWith(`${base}/`);
    if (casa && base.length > largo) {
      mejor = id;
      largo = base.length;
    }
  }
  return mejor;
}

/**
 * El identificador de acceso, normalizado.
 *
 * Son códigos de empleado (`xe05206`), y quien los teclea en el móvil recibe la
 * primera letra en mayúscula del corrector. Se guarda y se compara en
 * minúsculas para que `XE05206` y `xe05206` sean la misma persona; si no, el
 * duplicado se crea sin que nadie lo vea.
 */
export function normalizarUsuario(valor: string): string {
  return valor.trim().toLowerCase();
}

/**
 * Qué vale como identificador. Sin espacios ni acentos: va en una URL, en un
 * registro y en la cabeza de quien lo dicta por teléfono.
 */
export function usuarioValido(valor: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(valor);
}

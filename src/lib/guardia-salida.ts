/**
 * Qué clic saca de la página y cuál no.
 *
 * El editor del plano mantiene un borrador local y solo escribe al pulsar
 * `Guardar cambios`. `beforeunload` cubre recargar y cerrar la pestaña, pero la
 * ficha de sala son seis pestañas por ruta unidas por `<Link>`: eso es
 * navegación de cliente, sin recarga, y `beforeunload` no se entera. Mover un
 * equipo, pulsar `Resumen` y volver era perder el trabajo sin un solo aviso.
 *
 * Decidir si un clic va a sacar de la página es una lista de casos —otra
 * pestaña, una descarga, otro dominio, un ancla al mismo sitio— y ninguno de
 * ellos necesita un navegador para probarse. Vive aquí por lo mismo que
 * `combobox.ts`: es criterio, no pintado.
 */

/** El ancla sobre la que se ha pulsado, reducida a lo que decide. */
export interface AnclaClicada {
  /** El destino ya resuelto a absoluto, que es lo que da `HTMLAnchorElement.href`. */
  href: string;
  /** `target="_blank"` abre otra pestaña: esta se queda con el borrador. */
  target: string;
  /** Un ancla con `download` descarga un fichero; no navega. */
  descarga: boolean;
}

/** Lo que del clic cambia la decisión. */
export interface ClicDeRaton {
  /** 0 es el botón principal. El del medio abre en otra pestaña. */
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** Si alguien ya lo canceló, no hay navegación que interceptar. */
  defaultPrevented: boolean;
}

/** Un intento de salir del editor con cambios sin guardar. */
export type IntentoSalida =
  /** Se ha pulsado un enlace: una pestaña de la ficha, la barra lateral. */
  | { tipo: 'enlace'; ruta: string }
  /** Se ha pulsado el botón atrás del navegador. */
  | { tipo: 'atras' };

/**
 * La ruta a la que llevaría este clic, o `null` si no saca de aquí.
 *
 * Solo devuelve ruta cuando el clic iba a producir una navegación de cliente
 * dentro de la aplicación, que es el único caso que hay que interceptar:
 *
 * - Otro dominio o un `mailto:` recargan el documento entero, y de eso ya se
 *   encarga `beforeunload`. Interceptarlos aquí sería preguntar dos veces.
 * - Con Ctrl, Cmd, Mayúsculas o Alt, y con el botón del medio, el navegador
 *   abre en otra pestaña o ventana: esta se queda con el borrador intacto.
 * - Un ancla al mismo `pathname` —la propia pestaña activa, o un salto a un
 *   `#fragmento`— no saca del editor.
 */
export function destinoDeSalida(
  ancla: AnclaClicada | null,
  aqui: string,
  clic: ClicDeRaton,
): string | null {
  if (!ancla) return null;
  if (clic.defaultPrevented) return null;
  if (clic.button !== 0) return null;
  if (clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return null;
  if (ancla.descarga) return null;
  if (ancla.target !== '' && ancla.target !== '_self') return null;

  let destino: URL;
  let actual: URL;
  try {
    destino = new URL(ancla.href, aqui);
    actual = new URL(aqui);
  } catch {
    return null;
  }

  if (destino.protocol !== 'http:' && destino.protocol !== 'https:') return null;
  if (destino.origin !== actual.origin) return null;
  if (destino.pathname === actual.pathname && destino.search === actual.search) return null;

  return `${destino.pathname}${destino.search}${destino.hash}`;
}

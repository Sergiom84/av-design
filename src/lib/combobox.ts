/**
 * Los estados de una búsqueda remota, sin React.
 *
 * Vive aquí y no dentro del componente por lo mismo que el cálculo de cable:
 * «cuándo digo que no hay coincidencias y cuándo digo que no he podido
 * buscar» es una decisión, no un detalle de pintado, y se prueba sin
 * navegador.
 *
 * La distinción importa: un fallo de red enseñado como «Sin coincidencias»
 * hace creer al técnico que la referencia no está en el catálogo. Deja de
 * buscarla y la pide por teléfono. El catálogo tiene 948 referencias y ninguna
 * desaparece porque se caiga el servidor.
 */

export type EstadoBusqueda =
  /** Todavía no se ha buscado nada: la lista está cerrada. */
  | { fase: 'inactivo' }
  /** Hay una petición en vuelo. */
  | { fase: 'cargando' }
  /** Contestó el servidor. Cero resultados es una respuesta, no un fallo. */
  | { fase: 'listo'; resultados: number }
  /** No se pudo preguntar, o el servidor contestó con un error. */
  | { fase: 'error' };

export interface TextosBusqueda {
  /** Qué se enseña cuando el servidor contesta con la lista vacía. */
  vacio: string;
  /** Cómo se llama lo que se lista, en singular y en plural. */
  nombreColeccion: [string, string];
}

/**
 * El mensaje que se enseña —y que se anuncia por `aria-live`— para cada
 * estado. Uno solo para los dos, porque quien no ve la lista necesita
 * exactamente la misma información que quien la ve.
 */
export function mensajeDeBusqueda(estado: EstadoBusqueda, textos: TextosBusqueda): string {
  switch (estado.fase) {
    case 'inactivo':
      return '';
    case 'cargando':
      return 'Buscando…';
    case 'error':
      return 'No se ha podido buscar. Comprueba la conexión y reinténtalo.';
    case 'listo':
      if (estado.resultados === 0) return textos.vacio;
      return `${estado.resultados} ${
        estado.resultados === 1 ? textos.nombreColeccion[0] : textos.nombreColeccion[1]
      }`;
  }
}

/** ¿Hay que ofrecer `Reintentar`? Solo el error se reintenta; el vacío no. */
export const permiteReintentar = (estado: EstadoBusqueda): boolean => estado.fase === 'error';

/**
 * ¿Se pueden recorrer resultados con las flechas?
 *
 * Con la lista cargando o en error no hay nada que recorrer, y dejar el
 * recorrido vivo movería el `aria-activedescendant` a una opción que ya no
 * está.
 */
export const hayResultados = (estado: EstadoBusqueda): boolean =>
  estado.fase === 'listo' && estado.resultados > 0;

/**
 * Convierte una respuesta HTTP en lista o en error.
 *
 * Los dos buscadores hacían `respuesta.ok ? await respuesta.json() : []`, y
 * ese `: []` es exactamente el fallo: convierte un 500 en «no hay nada». Aquí
 * un error es un error y sube.
 */
export async function leerRespuesta<T>(respuesta: Response): Promise<T[]> {
  if (!respuesta.ok) {
    throw new Error(`El servidor contestó ${respuesta.status}`);
  }
  return (await respuesta.json()) as T[];
}

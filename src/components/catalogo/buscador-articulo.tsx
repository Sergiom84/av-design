'use client';

import { useCallback, useState } from 'react';
import { ComboboxRemoto, type OpcionCombobox } from './combobox-remoto';
import { leerRespuesta } from '@/lib/combobox';
import type { ArticuloElegible, TipoArticulo } from '@/lib/tipos';

/** La opción que se pinta, más el artículo entero para poder devolverlo. */
type OpcionArticulo = OpcionCombobox & { articulo: ArticuloElegible };

/**
 * Elegir una referencia del catálogo escribiendo.
 *
 * Es el único sitio donde se elige un artículo: plantillas, sala, almacén y la
 * biblioteca del plano lo comparten. Sustituye al desplegable con el catálogo
 * entero, que servía las novecientas referencias en el HTML —y una vez por
 * cada desplegable de la página—; aquí no viaja ninguna hasta que el técnico
 * teclea, y entonces viajan veinte.
 *
 * El teclado, el ARIA, la espera entre teclas y la posición del panel son de
 * `ComboboxRemoto`, el mismo que usa el buscador de mobiliario. Aquí queda
 * solo lo propio del catálogo AV: de dónde salen los resultados y qué se hace
 * con el elegido.
 *
 * En formulario, lo que se envía es el `input` oculto, que solo se rellena
 * eligiendo de la lista: eso hace imposible guardar una referencia parecida a
 * la que se escribió. Con `alElegir` no hay formulario y el identificador se
 * lo queda quien llama.
 */
export function BuscadorArticulo({
  etiqueta,
  nombre = 'articulo_id',
  tipo,
  requerido = false,
  marcador = 'Marca, modelo o sección',
  className = 'w-full sm:w-[22rem]',
  alElegir,
  vaciarAlElegir = false,
}: {
  etiqueta: string;
  nombre?: string;
  /** Limita la búsqueda a equipos, cable o consumible. Sin él, todo el catálogo. */
  tipo?: TipoArticulo;
  requerido?: boolean;
  marcador?: string;
  className?: string;
  /**
   * Qué hacer al elegir, cuando no hay formulario detrás. Lo usa la biblioteca
   * del editor del plano, que da de alta el equipo en el borrador.
   */
  alElegir?: (articulo: ArticuloElegible | null) => void;
  vaciarAlElegir?: boolean;
}) {
  const [elegido, setElegido] = useState('');

  const buscar = useCallback(
    async (consulta: string, signal: AbortSignal): Promise<OpcionArticulo[]> => {
      const parametros = new URLSearchParams({ q: consulta });
      if (tipo) parametros.set('tipo', tipo);
      const respuesta = await fetch(`/api/catalogo?${parametros}`, { signal });
      // Un error del servidor sube y se enseña como error: devolver la
      // lista vacía haría creer que la referencia no está en el catálogo.
      const lista = await leerRespuesta<ArticuloElegible>(respuesta);
      return lista.map((a) => ({
        id: a.id,
        etiqueta: a.etiqueta,
        detalle: a.categoria,
        sufijo: a.unidad === 'm' ? '(m)' : null,
        articulo: a,
      }));
    },
    [tipo],
  );

  return (
    <>
      <input type="hidden" name={nombre} value={elegido} />
      <ComboboxRemoto
        etiqueta={etiqueta}
        marcador={marcador}
        requerido={requerido}
        className={className}
        buscar={buscar}
        vaciarAlElegir={vaciarAlElegir}
        etiquetaLista="Referencias del catálogo"
        nombreColeccion={['referencia', 'referencias']}
        vacio="Sin referencias que coincidan"
        mensajeInvalido="Elige una referencia de la lista."
        alElegir={(o) => {
          setElegido(vaciarAlElegir ? '' : (o?.id ?? ''));
          alElegir?.(o ? (o as OpcionArticulo).articulo : null);
        }}
      />
    </>
  );
}

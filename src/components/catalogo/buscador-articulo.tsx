'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ArticuloElegible, TipoArticulo } from '@/lib/tipos';

/** Lo que se espera desde la última tecla antes de preguntar al servidor. */
const ESPERA_MS = 150;

/**
 * Elegir una referencia del catálogo escribiendo.
 *
 * Es el único sitio donde se elige un artículo: plantillas, sala y almacén lo
 * comparten. Sustituye al desplegable con el catálogo entero, que servía las
 * novecientas referencias en el HTML —y una vez por cada desplegable de la
 * página—; aquí no viaja ninguna hasta que el técnico teclea, y entonces
 * viajan veinte.
 *
 * El formulario necesita el identificador, no el texto, así que el `input`
 * visible no lleva `name`: lo que se envía es el `input` oculto, que solo se
 * rellena eligiendo de la lista. Eso hace imposible guardar una referencia
 * parecida a la que se escribió.
 *
 * La lista se posiciona con `fixed` a propósito: las tarjetas tienen
 * `overflow-x-auto` para que las tablas anchas hagan scroll en móvil, y eso
 * recortaría un panel `absolute`.
 *
 * Trae su propia etiqueta en vez de ir dentro de `Campo`: una `<label>` que
 * envuelve el bloque se lleva también el texto de la lista, y el campo pasa a
 * llamarse "Referencia 8 referencias SAMSUNG QB65R…" para un lector de
 * pantalla. Con `htmlFor` la asociación es exacta.
 */
export function BuscadorArticulo({
  etiqueta,
  nombre = 'articulo_id',
  tipo,
  requerido = false,
  marcador = 'Marca, modelo o sección',
  className = 'w-full sm:w-[22rem]',
}: {
  etiqueta: string;
  nombre?: string;
  /** Limita la búsqueda a equipos, cable o consumible. Sin él, todo el catálogo. */
  tipo?: TipoArticulo;
  requerido?: boolean;
  marcador?: string;
  className?: string;
}) {
  const [texto, setTexto] = useState('');
  const [elegido, setElegido] = useState<ArticuloElegible | null>(null);
  const [resultados, setResultados] = useState<ArticuloElegible[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [caja, setCaja] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const campo = useRef<HTMLInputElement>(null);
  const base = useId();
  const idCampo = `${base}c`;
  const idLista = `${base}l`;

  const medir = useCallback(() => {
    const c = campo.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    setCaja({ top: r.bottom + 2, left: r.left, width: r.width });
  }, []);

  const abrir = useCallback(() => {
    medir();
    setAbierto(true);
  }, [medir]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setActivo(-1);
  }, []);

  // Mientras la lista está abierta sigue al campo: la página puede scrollar
  // por debajo, y el panel `fixed` no se mueve solo.
  useEffect(() => {
    if (!abierto) return;
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [abierto, medir]);

  useEffect(() => {
    if (!abierto) return;
    const control = new AbortController();
    const espera = setTimeout(() => {
      const consulta = new URLSearchParams({ q: texto });
      if (tipo) consulta.set('tipo', tipo);
      fetch(`/api/catalogo?${consulta}`, { signal: control.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((lista: ArticuloElegible[]) => {
          setResultados(lista);
          setActivo(lista.length > 0 ? 0 : -1);
        })
        .catch(() => {
          if (!control.signal.aborted) setResultados([]);
        });
    }, ESPERA_MS);

    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto, tipo, abierto]);

  /**
   * Sin selección el campo es inválido aunque tenga texto: escribir "QB65R" no
   * es haber elegido el QB65R. El navegador lo dice donde toca, en el campo.
   */
  useEffect(() => {
    const c = campo.current;
    if (!c) return;
    c.setCustomValidity(
      requerido && !elegido && texto.trim() !== ''
        ? 'Elige una referencia de la lista.'
        : '',
    );
  }, [requerido, elegido, texto]);

  const elegir = (a: ArticuloElegible) => {
    setElegido(a);
    setTexto(a.etiqueta);
    cerrar();
    campo.current?.focus();
  };

  const limpiar = () => {
    setElegido(null);
    setTexto('');
    setResultados([]);
    campo.current?.focus();
  };

  const teclado = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return abrir();
      if (resultados.length === 0) return;
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setActivo((i) => (i + paso + resultados.length) % resultados.length);
      return;
    }
    if (e.key === 'Enter' && abierto && resultados[activo]) {
      e.preventDefault();
      elegir(resultados[activo]);
      return;
    }
    if (e.key === 'Escape' && abierto) {
      e.preventDefault();
      cerrar();
      return;
    }
    if (e.key === 'Tab') cerrar();
  };

  return (
    <div className={className}>
      <label htmlFor={idCampo} className="t-etiqueta block mb-1">
        {etiqueta}
      </label>
      <input type="hidden" name={nombre} value={elegido?.id ?? ''} />
      <div className="flex items-center gap-1">
        <input
          ref={campo}
          id={idCampo}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          required={requerido}
          placeholder={marcador}
          value={texto}
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={
            abierto && activo >= 0 ? `${idLista}-${activo}` : undefined
          }
          className="flex-1 min-w-0"
          onChange={(e) => {
            setTexto(e.target.value);
            setElegido(null);
            if (!abierto) abrir();
            else medir();
          }}
          onFocus={abrir}
          onBlur={cerrar}
          onKeyDown={teclado}
        />
        {texto !== '' && (
          <button
            type="button"
            onClick={limpiar}
            aria-label="Vaciar la referencia elegida"
            className="border border-linea-fuerte rounded-[2px] px-2 py-1 text-tinta-tenue hover:text-tinta hover:border-tinta"
          >
            ×
          </button>
        )}
      </div>

      {/* `aria-live`: quien navega con lector de pantalla se entera de cuántas hay. */}
      <span className="sr-only" aria-live="polite">
        {abierto
          ? resultados.length === 0
            ? 'Sin referencias que coincidan'
            : `${resultados.length} referencias`
          : ''}
      </span>

      <ul
        id={idLista}
        role="listbox"
        aria-label="Referencias del catálogo"
        hidden={!abierto || caja === null}
        // Se evita que el clic quite el foco al campo: si lo quitara, el panel
        // se cerraría antes de que llegara el clic a la opción.
        onMouseDown={(e) => e.preventDefault()}
        style={
          caja
            ? { top: caja.top, left: caja.left, width: Math.max(caja.width, 240) }
            : undefined
        }
        className="fixed z-50 max-h-64 overflow-y-auto border border-linea-fuerte bg-papel rounded-[2px]"
      >
        {resultados.length === 0 ? (
          <li className="px-2 py-1.5 text-tinta-tenue">Sin referencias que coincidan</li>
        ) : (
          resultados.map((a, i) => (
            <li
              key={a.id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activo}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(a)}
              className={`px-2 py-1.5 cursor-pointer ${
                i === activo ? 'bg-acento-suave' : ''
              }`}
            >
              <span>{a.etiqueta}</span>
              {a.unidad === 'm' && <span className="text-tinta-tenue"> (m)</span>}
              <span className="block text-tinta-tenue">{a.categoria}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

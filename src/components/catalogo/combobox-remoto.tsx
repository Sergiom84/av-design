'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  hayResultados,
  mensajeDeBusqueda,
  permiteReintentar,
  type EstadoBusqueda,
} from '@/lib/combobox';

/** Lo que se espera desde la última tecla antes de preguntar al servidor. */
const ESPERA_MS = 150;

/**
 * Una opción de la lista. Es deliberadamente pobre: el combobox no sabe si
 * está enseñando una referencia del catálogo AV o una silla, solo la pinta.
 */
export interface OpcionCombobox {
  id: string;
  /** La primera línea: `Samsung QB65R`, `Silla`. */
  etiqueta: string;
  /** Segunda línea, en tenue: la sección, las medidas. */
  detalle?: string | null;
  /** Sufijo corto pegado a la etiqueta: `(m)`. */
  sufijo?: string | null;
}

/**
 * El combobox accesible que pregunta al servidor según se teclea.
 *
 * Sale de `BuscadorArticulo`, que era el único que lo tenía. Al aparecer el
 * segundo buscador —el de mobiliario— la alternativa era copiar aquí la
 * espera entre teclas, la cancelación de la petición anterior, el recorrido
 * con flechas, el `aria-activedescendant` y el panel `fixed`. Copiado, el día
 * que se arregle algo se arregla en uno de los dos.
 *
 * Lo que cambia entre usos es de dónde salen los resultados y qué se hace al
 * elegir; eso son dos props. Todo lo demás es idéntico y vive aquí.
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
export function ComboboxRemoto({
  etiqueta,
  buscar,
  alElegir,
  vaciarAlElegir = false,
  requerido = false,
  marcador,
  etiquetaLista,
  nombreColeccion = ['resultado', 'resultados'],
  vacio = 'Sin resultados que coincidan',
  mensajeInvalido = 'Elige una opción de la lista.',
  className = 'w-full sm:w-[22rem]',
}: {
  etiqueta: string;
  /** De dónde salen los resultados. La señal cancela la petición anterior. */
  buscar: (consulta: string, signal: AbortSignal) => Promise<OpcionCombobox[]>;
  /** Qué hacer al elegir. `null` = se ha vaciado la elección. */
  alElegir?: (opcion: OpcionCombobox | null) => void;
  /**
   * Vaciar la caja después de elegir. Lo usa la biblioteca del plano: allí
   * elegir es añadir, y dejar el texto puesto invita a añadir dos veces lo
   * mismo sin darse cuenta.
   */
  vaciarAlElegir?: boolean;
  requerido?: boolean;
  marcador?: string;
  etiquetaLista?: string;
  /** Cómo se llama lo que se lista, en singular y en plural. */
  nombreColeccion?: [string, string];
  vacio?: string;
  mensajeInvalido?: string;
  className?: string;
}) {
  const [texto, setTexto] = useState('');
  const [elegido, setElegido] = useState<OpcionCombobox | null>(null);
  const [resultados, setResultados] = useState<OpcionCombobox[]>([]);
  const [estado, setEstado] = useState<EstadoBusqueda>({ fase: 'inactivo' });
  /** Se incrementa al reintentar: es lo que vuelve a lanzar la búsqueda. */
  const [intento, setIntento] = useState(0);
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
      setEstado({ fase: 'cargando' });
      buscar(texto, control.signal)
        .then((lista) => {
          if (control.signal.aborted) return;
          setResultados(lista);
          setEstado({ fase: 'listo', resultados: lista.length });
          setActivo(lista.length > 0 ? 0 : -1);
        })
        .catch(() => {
          // La cancelación no es un fallo: es la tecla siguiente. Solo se
          // enseña error cuando de verdad no se pudo preguntar, porque decir
          // «no hay coincidencias» cuando no se ha podido mirar hace que se
          // deje de buscar una referencia que sí está.
          if (control.signal.aborted) return;
          setResultados([]);
          setEstado({ fase: 'error' });
          setActivo(-1);
        });
    }, ESPERA_MS);

    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto, abierto, buscar, intento]);

  /**
   * Sin selección el campo es inválido aunque tenga texto: escribir "QB65R" no
   * es haber elegido el QB65R. El navegador lo dice donde toca, en el campo.
   */
  useEffect(() => {
    const c = campo.current;
    if (!c) return;
    c.setCustomValidity(
      requerido && !elegido && texto.trim() !== '' ? mensajeInvalido : '',
    );
  }, [requerido, elegido, texto, mensajeInvalido]);

  const elegir = (o: OpcionCombobox) => {
    if (vaciarAlElegir) {
      setElegido(null);
      setTexto('');
    } else {
      setElegido(o);
      setTexto(o.etiqueta);
    }
    cerrar();
    alElegir?.(o);
    campo.current?.focus();
  };

  const limpiar = () => {
    setElegido(null);
    setTexto('');
    setResultados([]);
    alElegir?.(null);
    campo.current?.focus();
  };

  const reintentar = () => {
    setEstado({ fase: 'cargando' });
    setIntento((n) => n + 1);
    campo.current?.focus();
  };

  const teclado = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return abrir();
      if (!hayResultados(estado)) return;
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
            aria-label={`Vaciar ${etiqueta.toLowerCase()}`}
            // 44 × 44: es un objetivo táctil, y con `px-2 py-1` medía 28.
            className="shrink-0 min-h-11 min-w-11 border border-linea rounded-md text-tinta-tenue hover:text-acento hover:border-acento"
          >
            ×
          </button>
        )}
      </div>

      {/* `aria-live`: quien navega con lector de pantalla se entera de lo
          mismo que quien ve la lista, incluido el fallo. El mensaje sale de
          `src/lib/combobox.ts`, que es donde se prueba. */}
      <span className="sr-only" aria-live="polite">
        {abierto ? mensajeDeBusqueda(estado, { vacio, nombreColeccion }) : ''}
      </span>

      <ul
        id={idLista}
        role="listbox"
        aria-label={etiquetaLista ?? etiqueta}
        hidden={!abierto || caja === null}
        // Se evita que el clic quite el foco al campo: si lo quitara, el panel
        // se cerraría antes de que llegara el clic a la opción.
        onMouseDown={(e) => e.preventDefault()}
        style={
          caja
            ? { top: caja.top, left: caja.left, width: Math.max(caja.width, 240) }
            : undefined
        }
        className="fixed z-50 max-h-64 overflow-y-auto border border-linea bg-superficie rounded-md shadow-lg"
      >
        {!hayResultados(estado) ? (
          <li className="px-2 py-1.5 text-tinta-tenue">
            {mensajeDeBusqueda(estado, { vacio, nombreColeccion })}
            {permiteReintentar(estado) && (
              <button
                type="button"
                onClick={reintentar}
                className="ml-2 min-h-11 px-3 underline text-acento"
              >
                Reintentar
              </button>
            )}
          </li>
        ) : (
          resultados.map((o, i) => (
            <li
              key={o.id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activo}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(o)}
              className={`px-2 py-1.5 cursor-pointer ${
                i === activo ? 'bg-acento-suave' : ''
              }`}
            >
              <span>{o.etiqueta}</span>
              {o.sufijo && <span className="text-tinta-tenue"> {o.sufijo}</span>}
              {o.detalle && <span className="block text-tinta-tenue">{o.detalle}</span>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

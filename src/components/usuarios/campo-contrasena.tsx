'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';

type Props = {
  etiqueta: string;
  ayuda?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>;

/**
 * Campo de contraseña con visibilidad bajo control de quien la escribe.
 *
 * La contraseña nace oculta en todos los flujos. El ojo evita errores al
 * escribirla en móvil, pero no la deja expuesta por defecto ni crea una
 * variante visual distinta en cada formulario.
 */
export function CampoContrasena({ etiqueta, ayuda, className, ...resto }: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const accion = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';

  return (
    <div className="block min-w-0 max-w-full">
      <label htmlFor={id} className="t-etiqueta block mb-1">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          {...resto}
          id={id}
          type={visible ? 'text' : 'password'}
          className={`w-full pr-12${className ? ` ${className}` : ''}`}
        />
        <button
          type="button"
          aria-label={accion}
          aria-pressed={visible}
          title={accion}
          onClick={() => setVisible((anterior) => !anterior)}
          className="absolute inset-y-0 right-0 grid min-h-11 min-w-11 place-items-center rounded-r-md text-tinta-tenue hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acento"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            {visible ? (
              <>
                <path d="m3 3 18 18" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c5 0 8.2 4.2 9 7-0.4 1.3-1.3 3-2.8 4.4" />
                <path d="M6.2 6.2C4.5 7.7 3.5 10 3 12c0.8 2.8 4 7 9 7 1.2 0 2.3-0.2 3.3-0.7" />
              </>
            ) : (
              <>
                <path d="M3 12s3.2-7 9-7 9 7 9 7-3.2 7-9 7-9-7-9-7Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      {ayuda && <span className="block text-tinta-tenue mt-1 text-[0.6875rem]">{ayuda}</span>}
    </div>
  );
}

'use client';

import { useId, useState } from 'react';
import { Boton, Campo } from '@/components/ui';
import { generarClaveProvisional, LARGO_MINIMO } from '@/lib/contrasena';

/**
 * El campo de la contraseña provisional, con un botón que se la inventa.
 *
 * Se genera en el navegador y se enseña en claro a propósito: el administrador
 * tiene que poder leerla para dictarla o escribirla en un papel. Es provisional
 * y el usuario está obligado a cambiarla en su primera entrada, así que su vida
 * útil son los dos minutos que tarda en llegar a su mesa.
 *
 * Lo que no se hace es guardarla en ningún sitio ni mandarla por correo. La
 * base solo ve su huella, y aquí se olvida al recargar.
 */
export function ClaveProvisional({
  nombre = 'clave',
  etiqueta = 'Contraseña provisional',
}: {
  nombre?: string;
  etiqueta?: string;
}) {
  const [valor, setValor] = useState('');
  const id = useId();

  return (
    <div className="space-y-2">
      <Campo
        etiqueta={etiqueta}
        ayuda={`Mínimo ${LARGO_MINIMO} caracteres. Se entrega en mano y la persona la cambia al entrar.`}
      >
        <input
          id={id}
          name={nombre}
          // `text` y no `password`: el administrador la está escribiendo para
          // dictarla, y ocultarla con puntos aquí solo sirve para que la copie mal.
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={LARGO_MINIMO}
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-full font-mono"
        />
      </Campo>
      <Boton
        tipo="button"
        variante="secundario"
        onClick={() => setValor(generarClaveProvisional())}
      >
        Inventar una
      </Boton>
    </div>
  );
}

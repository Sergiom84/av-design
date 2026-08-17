'use client';

import { useState } from 'react';
import { Boton } from '@/components/ui';
import { CampoContrasena } from './campo-contrasena';
import { generarClaveProvisional, LARGO_MINIMO } from '@/lib/contrasena';

/**
 * El campo de la contraseña provisional, con un botón que se la inventa.
 *
 * Se genera en el navegador y nace oculta. El administrador puede verla con el
 * ojo cuando vaya a dictarla o escribirla en un papel. Es provisional y el
 * usuario está obligado a cambiarla en su primera entrada, así que su vida útil
 * son los dos minutos que tarda en llegar a su mesa.
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
  return (
    <div className="space-y-2">
      <CampoContrasena
        etiqueta={etiqueta}
        ayuda={`Mínimo ${LARGO_MINIMO} caracteres. Se entrega en mano y la persona la cambia al entrar.`}
        name={nombre}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        minLength={LARGO_MINIMO}
        required
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="font-mono"
      />
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

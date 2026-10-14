'use client';

import { useState } from 'react';
import { Aviso, Boton } from '@/components/ui';

export function BotonFavorito({ articuloId, inicial }: { articuloId: string; inicial: boolean }) {
  const [favorito, setFavorito] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  async function guardar() {
    setOcupado(true); setMensaje('');
    try {
      const siguiente = !favorito;
      const respuesta = await fetch(`/api/catalogo-favoritos/${articuloId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorito: siguiente }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error ?? 'No se pudo guardar el favorito.');
      setFavorito(siguiente); setMensaje(siguiente ? 'Guardado en tus favoritos personales.' : 'Retirado de tus favoritos personales.');
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo guardar el favorito.'); }
    finally { setOcupado(false); }
  }
  return <div className="flex flex-wrap gap-3 items-center">
    <Boton tipo="button" variante="secundario" aria-pressed={favorito} disabled={ocupado} onClick={() => void guardar()}>
      {favorito ? 'Quitar de mis favoritos' : 'Guardar en mis favoritos'}
    </Boton>
    {mensaje && <span role="status"><Aviso tono="neutro">{mensaje}</Aviso></span>}
  </div>;
}

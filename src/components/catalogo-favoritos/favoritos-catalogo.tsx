'use client';

import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo, Enlace, Tarjeta } from '@/components/ui';
import type { ReferenciaFavorita } from '@/lib/catalogo-favoritos';

export function FavoritosCatalogo() {
  const [referencias, setReferencias] = useState<ReferenciaFavorita[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  async function cargar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const q = String(new FormData(evento.currentTarget).get('q') ?? '');
    setOcupado(true); setMensaje('');
    try {
      const respuesta = await fetch(`/api/catalogo-favoritos?${new URLSearchParams({ q })}`);
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error ?? 'No se pudieron consultar tus favoritos.');
      setReferencias(resultado); setAbierto(true);
      setMensaje(resultado.length ? `${resultado.length} favoritos personales (máximo 20).` : 'No tienes favoritos con ese filtro.');
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudieron consultar tus favoritos.'); }
    finally { setOcupado(false); }
  }
  async function quitar(id: string) {
    setOcupado(true); setMensaje('');
    try {
      const respuesta = await fetch(`/api/catalogo-favoritos/${id}`, { method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorito: false }) });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error ?? 'No se pudo quitar el favorito.');
      setReferencias(actual => actual.filter(r => r.id !== id)); setMensaje('Retirado de tus favoritos personales.');
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo quitar el favorito.'); }
    finally { setOcupado(false); }
  }
  return <Tarjeta titulo="Mis favoritos" pie="Referencias que has guardado. El filtro se aplica sólo a tus favoritos; el catálogo completo sigue accesible.">
    <form onSubmit={evento => void cargar(evento)} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Filtrar mis favoritos"><input name="q" maxLength={200} className="w-full" /></Campo>
      <Boton disabled={ocupado}>{abierto ? 'Filtrar mis favoritos' : 'Ver mis favoritos'}</Boton>
      {abierto && <Boton tipo="button" variante="secundario" onClick={() => { setAbierto(false); setReferencias([]); setMensaje(''); }}>Ocultar favoritos</Boton>}
    </form>
    {mensaje && <div className="mt-3" role="status"><Aviso tono="neutro">{mensaje}</Aviso></div>}
    {abierto && <ul className="divide-y divide-linea-suave mt-3">
      {referencias.map(r => <li key={r.id} className="py-3 flex flex-wrap gap-3 items-center justify-between">
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <Enlace href={`/articulo/${r.id}`}>{r.marca} {r.modelo}</Enlace>
          <p className="text-tinta-tenue">{r.categoria} · {r.motivos.join(' · ')}{!r.activo && ' · Retirado del catálogo'}</p>
        </div>
        <Boton tipo="button" variante="secundario" disabled={ocupado} onClick={() => void quitar(r.id)}>Quitar favorito</Boton>
      </li>)}
    </ul>}
  </Tarjeta>;
}

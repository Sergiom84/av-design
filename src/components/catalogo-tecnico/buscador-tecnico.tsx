'use client';

import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo, Enlace, Tarjeta } from '@/components/ui';
import type { ResultadoTecnico } from '@/lib/catalogo-tecnico-repositorio';

export function BuscadorTecnico() {
  const [resultados, setResultados] = useState<ResultadoTecnico[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const parametros = new URLSearchParams();
    for (const [nombre, valor] of datos) if (String(valor).trim()) parametros.set(nombre, String(valor));
    setOcupado(true); setMensaje('');
    try {
      const respuesta = await fetch(`/api/catalogo-tecnico?${parametros}`);
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? 'No se pudo buscar.');
      setResultados(datos); setMensaje(datos.length ? `${datos.length} referencias verificadas (máximo 20).` : 'No hay referencias verificadas con esos atributos.');
    } catch (error) { setResultados([]); setMensaje(error instanceof Error ? error.message : 'No se pudo buscar.'); }
    finally { setOcupado(false); }
  }
  return <Tarjeta titulo="Buscar por atributos verificados">
    <form onSubmit={evento => void buscar(evento)} className="grid sm:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
      <Campo etiqueta="Marca, modelo o sección"><input name="q" maxLength={200} className="w-full" /></Campo>
      {(['ancho', 'alto', 'fondo'] as const).map(nombre => <Campo key={nombre} etiqueta={`${nombre[0].toUpperCase() + nombre.slice(1)} máximo (mm)`}>
        <input name={`${nombre}_max_mm`} type="number" min="0.000001" step="any" className="w-full num" />
      </Campo>)}
      <Campo etiqueta="Rack exacto (RU)"><input name="ru" type="number" min="0.5" step="any" className="w-full num" /></Campo>
      <Boton disabled={ocupado}>Buscar referencias</Boton>
    </form>
    {mensaje && <div className="mt-4" role="status"><Aviso tono="neutro">{mensaje}</Aviso></div>}
    <ul className="divide-y divide-linea-suave mt-4">
      {resultados.map(r => <li key={r.articulo_id} className="py-3 [overflow-wrap:anywhere]">
        <Enlace href={`/articulo/${r.articulo_id}`}>{r.marca} {r.modelo}</Enlace>
        <p className="text-tinta-tenue">{r.categoria} · {[r.ancho === null ? null : `ancho ${r.ancho} ${r.unidad}`, r.alto === null ? null : `alto ${r.alto} ${r.unidad}`, r.fondo === null ? null : `fondo ${r.fondo} ${r.unidad}`, r.ru === null ? null : `${r.ru} RU`].filter(Boolean).join(' · ') || 'Dimensiones sin verificar'}</p>
        <p className="text-tinta-tenue">Verificado: {r.origen} · {r.fecha} · <a className="enlace" href={r.url} target="_blank" rel="noopener noreferrer">Origen exacto</a></p>
      </li>)}
    </ul>
  </Tarjeta>;
}

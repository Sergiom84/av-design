'use client';
import { useState } from 'react';
import { Boton, Tarjeta } from '@/components/ui';
import { identificadoresDeCable } from '@/lib/cable-schedule';
import type { useEditorConexiones } from './use-editor-conexiones';

export function AnotacionesEditor({ editor: e }: { editor: ReturnType<typeof useEditorConexiones> }) {
  const [texto, setTexto] = useState(''); const [ancla, setAncla] = useState('sala');
  const [x, setX] = useState(40); const [y, setY] = useState(40);
  const ids = identificadoresDeCable(e.borrador);
  function etiqueta(tipo: string, id: string | null) { return tipo === 'equipo' ? e.equipos.find(eq => eq.id === id)?.nombre ?? 'Equipo' : tipo === 'conexion' ? ids.get(id ?? '') ?? 'Conexión' : tipo === 'visual' ? 'Coordenada visual' : 'Sala'; }
  return <Tarjeta titulo="Anotaciones">
    <form className="space-y-3" onSubmit={ev => {
      ev.preventDefault(); const [tipo, id] = ancla.split(':');
      e.anadirAnotacion({ texto, ancla_tipo: tipo as 'sala' | 'equipo' | 'conexion' | 'visual', ancla_id: id ?? null, x: tipo === 'visual' ? x : null, y: tipo === 'visual' ? y : null }); setTexto('');
    }}>
      <fieldset disabled={e.bloqueado || Boolean(e.vistaPrevia)} className="space-y-3">
        <label className="block"><span className="t-etiqueta block mb-1">Texto de anotación</span><textarea aria-label="Texto de anotación" value={texto} onChange={ev => setTexto(ev.target.value)} maxLength={1000} required rows={3} className="w-full" /></label>
        <label className="block"><span className="t-etiqueta block mb-1">Ancla de anotación</span><select className="w-full" aria-label="Ancla de anotación" value={ancla} onChange={ev => setAncla(ev.target.value)}>
          <option value="sala">Sala</option><option value="visual">Coordenada visual</option>
          {e.equipos.map(eq => <option key={eq.id} value={`equipo:${eq.id}`}>Equipo · {eq.nombre}</option>)}
          {e.borrador.map(c => <option key={c.id} value={`conexion:${c.id}`}>Cable · {ids.get(c.id)}</option>)}
        </select></label>
        {ancla === 'visual' && <div className="grid grid-cols-2 gap-2"><label>X visual (px)<input aria-label="X visual de anotación" type="number" min={0} max={100000} required value={x} onChange={ev => setX(Number(ev.target.value))} className="w-full" /></label><label>Y visual (px)<input aria-label="Y visual de anotación" type="number" min={0} max={100000} required value={y} onChange={ev => setY(Number(ev.target.value))} className="w-full" /></label></div>}
        <Boton tipo="submit" variante="secundario" disabled={e.anotaciones.length >= 200 || !texto.trim()}>Añadir anotación</Boton>
      </fieldset>
    </form>
    <ol className="mt-4 space-y-4" aria-label="Anotaciones de diseño">{e.anotaciones.map((a, i) => <li key={a.id} className="border-t border-linea pt-3">
      <label className="block"><span className="block text-xs text-tinta-tenue">{i + 1} · {etiqueta(a.ancla_tipo, a.ancla_id)}{a.ancla_tipo === 'visual' ? ` (${a.x}, ${a.y} px)` : ''}</span><textarea aria-label={`Editar anotación ${i + 1}`} className="mt-2 w-full" value={a.texto} onChange={ev => e.actualizarAnotacion(a.id, ev.target.value)} maxLength={1000} disabled={e.bloqueado || Boolean(e.vistaPrevia)} /></label>
      <div className="flex flex-wrap gap-2"><Boton tipo="button" variante="secundario" disabled={e.bloqueado || Boolean(e.vistaPrevia)} onClick={() => e.quitarAnotacion(a.id)}>Retirar anotación {i + 1}</Boton>
        {(a.ancla_tipo === 'equipo' || a.ancla_tipo === 'conexion') && <Boton tipo="button" variante="secundario" disabled={e.bloqueado || Boolean(e.vistaPrevia)} onClick={() => e.conservarAnotacionEnSala(a.id)}>Conservar anotación {i + 1} en sala</Boton>}</div>
    </li>)}</ol>
  </Tarjeta>;
}

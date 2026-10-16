'use client';

import { useRef, useState } from 'react';
import { claveBoca } from '@/lib/bocas-puerto';
import { identificadoresDeCable } from '@/lib/cable-schedule';
import { ALTO_BOCA, ALTO_CABECERA, ANCHO_BLOQUE, bloquesDelLienzo, ocupacionDeBocas, ordenarExtremos, puntoDeBoca, type PosicionBloque } from '@/lib/lienzo-conexiones';
import type { BocaPuerto, Conexion, EquipoEnSala, Puerto } from '@/lib/tipos';
import { ESTILO_SENAL, simboloPorCategoria } from '@/lib/presentacion-diagrama';
import type { AnotacionDiseno } from '@/lib/anotaciones-diseno';
import { SimboloEquipo } from './leyenda-diseno';

interface Props {
  equipos: EquipoEnSala[]; puertos: Puerto[]; conexiones: Conexion[];
  posiciones: Record<string, PosicionBloque>;
  onMover: (equipoId: string, posicion: PosicionBloque) => void;
  onConectar: (origen: BocaPuerto, destino: BocaPuerto) => void;
  onSeleccionarConexion: (id: string) => void;
  conexionSeleccionada: string | null; bloqueado: boolean;
  seleccionEquipos?: string[];
  onSeleccionarEquipo?: (id: string, seleccionado: boolean) => void;
  categorias?: Map<string, string>;
  anotaciones?: AnotacionDiseno[];
}

const control = 'min-h-11 rounded border border-linea px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-50';

export function LienzoConexiones({ equipos, puertos, conexiones, posiciones, onMover, onConectar, onSeleccionarConexion, conexionSeleccionada, bloqueado, seleccionEquipos = [], onSeleccionarEquipo, categorias, anotaciones = [] }: Props) {
  const [zoom, setZoom] = useState(1);
  const [inicio, setInicio] = useState<BocaPuerto | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [provisional, setProvisional] = useState<Record<string, PosicionBloque>>({});
  const arrastre = useRef<{ id: string; x: number; y: number; posicion: PosicionBloque; actual: PosicionBloque } | null>(null);
  const arrastreBoca = useRef<{ boca: BocaPuerto; x: number; y: number } | null>(null);
  const omitirClic = useRef(0);
  if (bloqueado && inicio) setInicio(null);
  const bloques = bloquesDelLienzo(equipos, puertos, { ...posiciones, ...provisional });
  const ocupadas = ocupacionDeBocas(conexiones, puertos);
  const ids = identificadoresDeCable(conexiones);
  const ancho = Math.max(1000, ...bloques.map((b) => b.x + ANCHO_BLOQUE + 100), ...anotaciones.map(a => (a.x ?? 0) + 260));
  const alto = Math.max(540, ...bloques.map((b) => b.y + b.alto + 80), ...anotaciones.map(a => (a.y ?? 0) + 140));

  function conectar(a: BocaPuerto, b: BocaPuerto) {
    if (bloqueado) return;
    if ([a, b].some((boca) => equipos.find((equipo) => equipo.id === boca.equipo_id)?.cantidad !== 1)) { setMensaje('Desglosa las unidades en Equipamiento antes de conectarlas.'); return; }
    if (a.equipo_id === b.equipo_id) { setMensaje('Elige un puerto de otro equipo.'); return; }
    if (ocupadas.has(claveBoca(a)) || ocupadas.has(claveBoca(b))) { setMensaje('La boca ya está conectada.'); return; }
    onConectar(...ordenarExtremos(a, b, puertos));
    setInicio(null); setMensaje('Conexión añadida al borrador.');
  }
  function elegir(boca: BocaPuerto) {
    if (equipos.find((equipo) => equipo.id === boca.equipo_id)?.cantidad !== 1) { setInicio(null); setMensaje('Desglosa las unidades en Equipamiento antes de conectarlas.'); return; }
    const conexion = ocupadas.get(claveBoca(boca));
    if (conexion) { onSeleccionarConexion(conexion); setMensaje('Boca ocupada: conexión seleccionada.'); return; }
    if (bloqueado) return;
    if (inicio && claveBoca(inicio) === claveBoca(boca)) { setInicio(null); return; }
    if (inicio) conectar(inicio, boca);
    else { setInicio(boca); setMensaje('Elige el puerto del otro equipo. Escape cancela.'); }
  }
  return <section className="min-w-0 space-y-2" aria-label="Lienzo de conexiones" onKeyDown={(e) => {
    if (e.key === 'Escape') { setInicio(null); setMensaje('Conexión cancelada.'); arrastreBoca.current = null; }
  }}>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={control} aria-label="Reducir zoom" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
      <button type="button" className={control} aria-label="Restablecer zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</button>
      <button type="button" className={control} aria-label="Ampliar zoom" disabled={zoom >= 1.5} onClick={() => setZoom((z) => Math.min(1.5, z + 0.25))}>+</button>
      {inicio && <button type="button" className={control} onClick={() => { setInicio(null); setMensaje('Conexión cancelada.'); }}>Cancelar conexión</button>}
      <span className="text-xs text-tinta-tenue">{bloqueado ? 'Solo lectura' : 'Une dos puertos. Mueve los bloques por su cabecera o con las flechas.'}</span>
    </div>
    <p role="status" className="min-h-5 text-xs text-tinta-tenue">{mensaje}</p>
    <div className="relative max-w-full overflow-auto rounded-lg border border-linea bg-fondo focus-visible:outline-2 focus-visible:outline-acento" style={{ height: 600, maxHeight: '70vh' }} tabIndex={0} aria-label="Área desplazable del esquema">
      <div style={{ width: ancho * zoom, height: alto * zoom, position: 'relative' }}>
        <div style={{ width: ancho, height: alto, transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'absolute' }}>
          <svg width={ancho} height={alto} className="absolute inset-0" aria-label="Cables del esquema">
            {[...conexiones].sort((a, b) => Number(a.id === conexionSeleccionada) - Number(b.id === conexionSeleccionada)).map((c) => {
              const origen = puntoDeBoca(bloques, { equipo_id: c.origen_id, puerto_id: c.puerto_origen_id ?? '', ordinal: c.puerto_origen_ordinal ?? 1 });
              const destino = puntoDeBoca(bloques, { equipo_id: c.destino_id, puerto_id: c.puerto_destino_id ?? '', ordinal: c.puerto_destino_ordinal ?? 1 });
              if (!origen || !destino) return null;
              const d = `M ${origen.x} ${origen.y} C ${origen.x + 90} ${origen.y}, ${destino.x - 90} ${destino.y}, ${destino.x} ${destino.y}`;
              const estilo = ESTILO_SENAL[c.senal]; const elegida = conexionSeleccionada === c.id;
              const xEtiqueta = origen.x + 52; const yEtiqueta = origen.y - 8;
              return <g key={c.id}>
                <path d={d} fill="none" stroke={estilo.color} strokeDasharray={estilo.trazo} strokeWidth={elegida ? 4 : 2} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={20} className="cursor-pointer focus-visible:outline-none focus-visible:stroke-acento" role="button" tabIndex={0} aria-label={`Seleccionar cable ${ids.get(c.id)}`} aria-pressed={elegida} onClick={() => onSeleccionarConexion(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionarConexion(c.id); } }}><title>{`${ids.get(c.id)} · ${equipos.find(e => e.id === c.origen_id)?.nombre} → ${equipos.find(e => e.id === c.destino_id)?.nombre}`}</title></path>
                <rect x={xEtiqueta - 46} y={yEtiqueta - 14} width={92} height={20} rx={3} fill="var(--superficie)" stroke={elegida ? 'var(--acento)' : 'var(--linea)'} pointerEvents="none" />
                <text x={xEtiqueta} y={yEtiqueta} textAnchor="middle" fill="var(--tinta)" fontSize={elegida ? 13 : 12} fontWeight={elegida ? 600 : 400} fontFamily="var(--fuente-mono)" pointerEvents="none">{ids.get(c.id)}</text>
              </g>;
            })}
          </svg>
          {bloques.map((bloque) => <div key={bloque.equipo.id} data-equipo={bloque.equipo.id} className={`absolute rounded-lg border bg-superficie shadow-sm ${seleccionEquipos.includes(bloque.equipo.id) ? 'border-acento ring-2 ring-acento' : 'border-linea'}`} style={{ left: bloque.x, top: bloque.y, width: ANCHO_BLOQUE, height: bloque.alto }}>
            {onSeleccionarEquipo && <label className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-acento" aria-label={`Seleccionar equipo ${bloque.etiqueta}`} checked={seleccionEquipos.includes(bloque.equipo.id)} disabled={bloqueado} onChange={ev => onSeleccionarEquipo(bloque.equipo.id, ev.target.checked)} /></label>}
            <button type="button" className="w-full touch-none overflow-hidden rounded-t-lg border-b border-linea bg-superficie-hundida px-4 text-left font-semibold focus-visible:outline-2 focus-visible:outline-acento disabled:cursor-default" style={{ height: ALTO_CABECERA, cursor: bloqueado ? 'default' : 'grab' }} disabled={bloqueado} aria-label={`Mover ${bloque.etiqueta}`} title="Arrastra o usa las flechas (Mayús: 40 px)"
              onPointerDown={(e) => { if (e.button !== 0 || bloqueado) return; e.currentTarget.setPointerCapture(e.pointerId); arrastre.current = { id: bloque.equipo.id, x: e.clientX, y: e.clientY, posicion: { x: bloque.x, y: bloque.y }, actual: { x: bloque.x, y: bloque.y } }; }}
              onPointerMove={(e) => { const a = arrastre.current; if (!a) return; a.actual = { x: Math.max(16, a.posicion.x + (e.clientX - a.x) / zoom), y: Math.max(16, a.posicion.y + (e.clientY - a.y) / zoom) }; setProvisional({ [a.id]: a.actual }); }}
              onPointerUp={() => { const a = arrastre.current; if (a) { if (a.actual.x !== a.posicion.x || a.actual.y !== a.posicion.y) onMover(a.id, a.actual); setProvisional({}); arrastre.current = null; } }}
              onPointerCancel={() => { arrastre.current = null; setProvisional({}); }}
              onKeyDown={(e) => { const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!delta) return; e.preventDefault(); const paso = e.shiftKey ? 40 : 10; onMover(bloque.equipo.id, { x: Math.max(16, bloque.x + delta[0] * paso), y: Math.max(16, bloque.y + delta[1] * paso) }); }}>
              <span className="flex items-center gap-2 pr-7"><SimboloEquipo simbolo={simboloPorCategoria(categorias?.get(bloque.equipo.articulo_id))} /><span className="line-clamp-2">{bloque.etiqueta}</span></span>
              {bloque.equipo.cantidad !== 1 && <span className="block text-xs font-normal text-aviso">{bloque.equipo.cantidad} unidades: desglosar en Equipamiento</span>}
            </button>
            {bloque.bocas.length === 0 && <p className="px-4 py-3 text-xs text-tinta-tenue">Sin puertos en el catálogo</p>}
            {bloque.bocas.map((boca) => {
              const clave = claveBoca(boca); const ocupada = ocupadas.has(clave); const activa = inicio && claveBoca(inicio) === clave;
              return <button key={clave} type="button" data-boca={clave} className={`absolute flex touch-none items-center gap-2 px-2 text-xs focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-acento ${activa ? 'bg-acento-suave text-acento' : 'text-tinta hover:bg-superficie-hundida'}`} style={{ top: ALTO_CABECERA + boca.fila * ALTO_BOCA, [boca.lado === 'izquierda' ? 'left' : 'right']: 0, width: '49%', minHeight: ALTO_BOCA, height: ALTO_BOCA, flexDirection: boca.lado === 'derecha' ? 'row-reverse' : 'row', textAlign: boca.lado === 'derecha' ? 'right' : 'left' }} aria-label={`${bloque.etiqueta}: ${boca.etiqueta}${ocupada ? ', ocupada' : ''}`} aria-pressed={Boolean(activa)} title={`${boca.etiqueta} · ${boca.puerto.conector ?? boca.puerto.senal}`}
                onPointerDown={(e) => { if (e.button === 0) arrastreBoca.current = { boca, x: e.clientX, y: e.clientY }; }}
                onPointerUp={(e) => { const a = arrastreBoca.current; arrastreBoca.current = null; const elemento = e.currentTarget.ownerDocument.elementFromPoint?.(e.clientX, e.clientY)?.closest('[data-boca]'); const claveDestino = elemento?.getAttribute('data-boca') ?? clave; const destino = bloques.flatMap((b) => b.bocas).find((b) => claveBoca(b) === claveDestino); if (a && destino && claveBoca(a.boca) !== claveDestino && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) { conectar(a.boca, destino); omitirClic.current = Date.now() + 350; } }}
                onPointerCancel={() => { arrastreBoca.current = null; }}
                onClick={() => { if (Date.now() < omitirClic.current) { omitirClic.current = 0; return; } elegir(boca); }}>
                <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full border ${ocupada ? 'border-acento bg-acento' : 'border-tinta-tenue bg-superficie'}`} />
                <span className="line-clamp-2 break-words">{boca.etiqueta}</span>
              </button>;
            })}
          </div>)}
          {anotaciones.filter(a => a.ancla_tipo === 'visual').map((a, i) => <div key={a.id} role="note" aria-label={`Anotación visual ${i + 1}`} title={a.texto} className="absolute max-w-64 rounded border border-acento bg-superficie p-2 text-xs shadow-sm" style={{ left: a.x ?? 0, top: a.y ?? 0 }}><span className="font-semibold">Nota {i + 1}</span><p className="line-clamp-3 break-words">{a.texto}</p></div>)}
        </div>
      </div>
    </div>
  </section>;
}

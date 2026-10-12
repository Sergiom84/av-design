'use client';

import { useRef, useState } from 'react';
import { claveExtremo } from '@/lib/extremos-conexion';
import { identificadoresDeCable } from '@/lib/cable-schedule';
import { ALTO_BOCA, ALTO_CABECERA, ANCHO_BLOQUE, bloquesDelLienzo, bloquesRosetasDelLienzo, conexionesSinDibujar, ocupacionDeBocas, ordenarExtremos, puntoDeExtremo, type PosicionBloque } from '@/lib/lienzo-conexiones';
import type { ExtremoConexion, Conexion, EquipoEnSala, Puerto, TomaRed } from '@/lib/tipos';

interface Props {
  equipos: EquipoEnSala[]; puertos: Puerto[]; conexiones: Conexion[];
  tomas: TomaRed[];
  posicionesRosetas: Record<string, PosicionBloque>;
  onMoverRoseta: (tomaId: string, posicion: PosicionBloque) => void;
  posiciones: Record<string, PosicionBloque>;
  onMover: (equipoId: string, posicion: PosicionBloque) => void;
  onConectar: (origen: ExtremoConexion, destino: ExtremoConexion) => void;
  onSeleccionarConexion: (id: string) => void;
  conexionSeleccionada: string | null; bloqueado: boolean;
}

const control = 'min-h-11 rounded border border-linea px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento disabled:opacity-50';

export function LienzoConexiones({ equipos, tomas, puertos, conexiones, posiciones, posicionesRosetas, onMover, onMoverRoseta, onConectar, onSeleccionarConexion, conexionSeleccionada, bloqueado }: Props) {
  const [zoom, setZoom] = useState(1);
  const [inicio, setInicio] = useState<ExtremoConexion | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [provisional, setProvisional] = useState<Record<string, PosicionBloque>>({});
  const arrastre = useRef<{ id: string; x: number; y: number; posicion: PosicionBloque; actual: PosicionBloque } | null>(null);
  const arrastreBoca = useRef<{ boca: ExtremoConexion; x: number; y: number } | null>(null);
  const omitirClic = useRef(0);
  if (bloqueado && inicio) setInicio(null);
  const bloques = bloquesDelLienzo(equipos, puertos, { ...posiciones, ...provisional });
  const rosetas = bloquesRosetasDelLienzo(tomas, { ...posicionesRosetas, ...provisional });
  const mover = (id: string, p: PosicionBloque) => tomas.some((t) => t.id === id) ? onMoverRoseta(id, p) : onMover(id, p);
  const tarjetas: { id: string; etiqueta: string; x: number; y: number; alto: number; cantidad: number; aviso: string | null;
    bocas: { extremo: ExtremoConexion; etiqueta: string; conector: string; fila: number; lado: 'izquierda' | 'derecha' }[] }[] = [
    ...bloques.map((b) => ({ id: b.equipo.id, etiqueta: b.etiqueta, x: b.x, y: b.y, alto: b.alto, cantidad: b.equipo.cantidad,
      aviso: b.bocas.length ? null : 'Sin puertos en el catálogo',
      bocas: b.bocas.map((boca) => ({ extremo: { tipo: 'equipo' as const, equipo_id: boca.equipo_id, puerto_id: boca.puerto_id, ordinal: boca.ordinal },
        etiqueta: boca.etiqueta, conector: boca.puerto.conector ?? boca.puerto.senal, fila: boca.fila, lado: boca.lado })) })),
    ...rosetas.map((b) => ({ id: b.toma.id, etiqueta: b.etiqueta, x: b.x, y: b.y, alto: b.alto, cantidad: 1,
      aviso: b.toma.capacidad_documentada === null ? 'Capacidad sin documentar en Plano' : !b.toma.codigo_confirmado ? 'Código pendiente de confirmar' : null,
      bocas: b.bocas.map(({ boca, fila }) => ({ extremo: { tipo: 'roseta' as const, toma_boca_id: boca.id },
        etiqueta: boca.etiqueta ?? `Boca ${boca.ordinal}`, conector: boca.conector, fila, lado: 'izquierda' as const })) })),
  ];
  const ocupadas = ocupacionDeBocas(conexiones, puertos);
  const ids = identificadoresDeCable(conexiones);
  const sinDibujar = conexionesSinDibujar(bloques, conexiones, rosetas);
  const ancho = Math.max(1000, ...tarjetas.map((b) => b.x + ANCHO_BLOQUE + 100));
  const alto = Math.max(540, ...tarjetas.map((b) => b.y + b.alto + 80));

  function conectar(a: ExtremoConexion, b: ExtremoConexion) {
    if (bloqueado) return;
    if ([a, b].some((boca) => boca.tipo === 'equipo' && equipos.find((equipo) => equipo.id === boca.equipo_id)?.cantidad !== 1)) { setMensaje('Desglosa las unidades en Equipamiento antes de conectarlas.'); return; }
    if (claveExtremo(a) === claveExtremo(b) || (a.tipo === 'equipo' && b.tipo === 'equipo' && a.equipo_id === b.equipo_id)) { setMensaje('Elige una boca de otro extremo.'); return; }
    if (ocupadas.has(claveExtremo(a)) || ocupadas.has(claveExtremo(b))) { setMensaje('La boca ya está conectada.'); return; }
    if (a.tipo === 'equipo' && b.tipo === 'equipo') {
      const [origen, destino] = ordenarExtremos(a, b, puertos);
      onConectar({ tipo: 'equipo', ...origen }, { tipo: 'equipo', ...destino });
    } else onConectar(a, b);
    setInicio(null); setMensaje('Conexión añadida al borrador.');
  }
  function elegir(boca: ExtremoConexion) {
    if (boca.tipo === 'equipo' && equipos.find((equipo) => equipo.id === boca.equipo_id)?.cantidad !== 1) { setInicio(null); setMensaje('Desglosa las unidades en Equipamiento antes de conectarlas.'); return; }
    const conexion = ocupadas.get(claveExtremo(boca));
    if (conexion) { onSeleccionarConexion(conexion); setMensaje('Boca ocupada: conexión seleccionada.'); return; }
    if (bloqueado) return;
    if (inicio && claveExtremo(inicio) === claveExtremo(boca)) { setInicio(null); return; }
    if (inicio) conectar(inicio, boca);
    else { setInicio(boca); setMensaje('Elige la boca del otro extremo. Escape cancela.'); }
  }
  return <section className="min-w-0 space-y-2" aria-label="Lienzo de conexiones" onKeyDown={(e) => {
    if (e.key === 'Escape') { setInicio(null); setMensaje('Conexión cancelada.'); arrastreBoca.current = null; }
  }}>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={control} aria-label="Reducir zoom" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
      <button type="button" className={control} aria-label="Restablecer zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</button>
      <button type="button" className={control} aria-label="Ampliar zoom" disabled={zoom >= 1.5} onClick={() => setZoom((z) => Math.min(1.5, z + 0.25))}>+</button>
      {inicio && <button type="button" className={control} onClick={() => { setInicio(null); setMensaje('Conexión cancelada.'); }}>Cancelar conexión</button>}
      {sinDibujar.length > 0 && <button type="button" className={`${control} text-aviso`} aria-label={`Ver la primera de ${sinDibujar.length} conexiones sin bocas`} onClick={() => { onSeleccionarConexion(sinDibujar[0]); setMensaje('Conexión sin bocas: complétala en el inspector.'); }}>{sinDibujar.length} sin bocas</button>}
      <span className="text-xs text-tinta-tenue">{bloqueado ? 'Solo lectura' : 'Une dos puertos. Mueve los bloques por su cabecera o con las flechas.'}</span>
    </div>
    <p role="status" className="min-h-5 text-xs text-tinta-tenue">{mensaje}</p>
    <div className="relative max-w-full overflow-auto rounded-lg border border-linea bg-fondo focus-visible:outline-2 focus-visible:outline-acento" style={{ height: 600, maxHeight: '70vh' }} tabIndex={0} aria-label="Área desplazable del esquema">
      <div style={{ width: ancho * zoom, height: alto * zoom, position: 'relative' }}>
        <div style={{ width: ancho, height: alto, transform: `scale(${zoom})`, transformOrigin: 'top left', position: 'absolute' }}>
          <svg width={ancho} height={alto} className="absolute inset-0" aria-label="Cables del esquema">
            {conexiones.map((c) => {
              if (c.detalle.estado !== 'completo') return null;
              const origen = puntoDeExtremo(bloques, rosetas, c.detalle.origen);
              const destino = puntoDeExtremo(bloques, rosetas, c.detalle.destino);
              if (!origen || !destino) return null;
              const d = `M ${origen.x} ${origen.y} C ${origen.x + 90} ${origen.y}, ${destino.x - 90} ${destino.y}, ${destino.x} ${destino.y}`;
              return <g key={c.id}>
                <path d={d} fill="none" stroke={conexionSeleccionada === c.id ? 'var(--acento)' : 'var(--tinta-tenue)'} strokeWidth={conexionSeleccionada === c.id ? 3 : 2} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={20} className="cursor-pointer focus-visible:outline-none focus-visible:stroke-acento" role="button" tabIndex={0} aria-label={`Seleccionar cable ${ids.get(c.id)}`} onClick={() => onSeleccionarConexion(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionarConexion(c.id); } }} />
                <text x={(origen.x + destino.x) / 2} y={(origen.y + destino.y) / 2 - 8} textAnchor="middle" fill="var(--tinta)" fontSize={12} fontFamily="var(--fuente-mono)" pointerEvents="none">{ids.get(c.id)}</text>
              </g>;
            })}
          </svg>
          {tarjetas.map((bloque) => <div key={bloque.id} className="absolute rounded-lg border border-linea bg-superficie shadow-sm" style={{ left: bloque.x, top: bloque.y, width: ANCHO_BLOQUE, height: bloque.alto }}>
            <button type="button" className="w-full touch-none overflow-hidden rounded-t-lg border-b border-linea bg-superficie-hundida px-4 text-left font-semibold focus-visible:outline-2 focus-visible:outline-acento disabled:cursor-default" style={{ height: ALTO_CABECERA, cursor: bloqueado ? 'default' : 'grab' }} disabled={bloqueado} aria-label={`Mover ${bloque.etiqueta}`} title="Arrastra o usa las flechas (Mayús: 40 px)"
              onPointerDown={(e) => { if (e.button !== 0 || bloqueado) return; e.currentTarget.setPointerCapture(e.pointerId); arrastre.current = { id: bloque.id, x: e.clientX, y: e.clientY, posicion: { x: bloque.x, y: bloque.y }, actual: { x: bloque.x, y: bloque.y } }; }}
              onPointerMove={(e) => { const a = arrastre.current; if (!a) return; a.actual = { x: Math.max(16, a.posicion.x + (e.clientX - a.x) / zoom), y: Math.max(16, a.posicion.y + (e.clientY - a.y) / zoom) }; setProvisional({ [a.id]: a.actual }); }}
              onPointerUp={() => { const a = arrastre.current; if (a) { if (a.actual.x !== a.posicion.x || a.actual.y !== a.posicion.y) mover(a.id, a.actual); setProvisional({}); arrastre.current = null; } }}
              onPointerCancel={() => { arrastre.current = null; setProvisional({}); }}
              onKeyDown={(e) => { const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!delta) return; e.preventDefault(); const paso = e.shiftKey ? 40 : 10; mover(bloque.id, { x: Math.max(16, bloque.x + delta[0] * paso), y: Math.max(16, bloque.y + delta[1] * paso) }); }}>
              <span className="line-clamp-2">{bloque.etiqueta}</span>
              {bloque.aviso && bloque.bocas.length > 0 && <span className="block text-xs font-normal text-aviso">{bloque.aviso}</span>}
              {bloque.cantidad !== 1 && <span className="block text-xs font-normal text-aviso">{bloque.cantidad} unidades: desglosar en Equipamiento</span>}
            </button>
            {bloque.aviso && bloque.bocas.length === 0 && <p className="px-4 py-1 text-xs text-tinta-tenue">{bloque.aviso}</p>}
            {bloque.bocas.map((boca) => {
              const clave = claveExtremo(boca.extremo); const ocupada = ocupadas.has(clave); const activa = inicio && claveExtremo(inicio) === clave;
              return <button key={clave} type="button" data-boca={clave} className={`absolute flex touch-none items-center gap-2 px-2 text-xs focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-acento ${activa ? 'bg-acento-suave text-acento' : 'text-tinta hover:bg-superficie-hundida'}`} style={{ top: ALTO_CABECERA + boca.fila * ALTO_BOCA, [boca.lado === 'izquierda' ? 'left' : 'right']: 0, width: '49%', minHeight: ALTO_BOCA, height: ALTO_BOCA, flexDirection: boca.lado === 'derecha' ? 'row-reverse' : 'row', textAlign: boca.lado === 'derecha' ? 'right' : 'left' }} aria-label={`${bloque.etiqueta}: ${boca.etiqueta}${ocupada ? ', ocupada' : ''}`} aria-pressed={Boolean(activa)} title={`${boca.etiqueta} · ${boca.conector}`}
                onPointerDown={(e) => { if (e.button === 0) arrastreBoca.current = { boca: boca.extremo, x: e.clientX, y: e.clientY }; }}
                onPointerUp={(e) => { const a = arrastreBoca.current; arrastreBoca.current = null; const elemento = e.currentTarget.ownerDocument.elementFromPoint?.(e.clientX, e.clientY)?.closest('[data-boca]'); const claveDestino = elemento?.getAttribute('data-boca') ?? clave; const destino = tarjetas.flatMap((b) => b.bocas).find((b) => claveExtremo(b.extremo) === claveDestino); if (a && destino && claveExtremo(a.boca) !== claveDestino && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) { conectar(a.boca, destino.extremo); omitirClic.current = Date.now() + 350; } }}
                onPointerCancel={() => { arrastreBoca.current = null; }}
                onClick={() => { if (Date.now() < omitirClic.current) { omitirClic.current = 0; return; } elegir(boca.extremo); }}>
                <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full border ${ocupada ? 'border-acento bg-acento' : 'border-tinta-tenue bg-superficie'}`} />
                <span className="line-clamp-2 break-words">{boca.etiqueta}</span>
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

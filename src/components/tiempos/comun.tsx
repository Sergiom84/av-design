'use client';
import { useEffect, useRef } from 'react';
import type { HoraTrabajo } from '@/lib/tiempos/fechas';
export class FalloTiempo extends Error {
  constructor(mensaje: string, public codigo = 'ERROR', public status = 503, public detalle?: unknown) { super(mensaje); }
}
export async function pedirTiempo<T>(ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const r = await fetch(ruta, { method: metodo, cache: 'no-store', ...(cuerpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }) });
  let b;
  try { b = await r.json(); } catch { throw new FalloTiempo('No se recibió una respuesta válida. Tu edición se conserva.'); }
  if (!r.ok) throw new FalloTiempo(b.error ?? 'No se pudo completar la operación.', b.codigo, r.status, b.detalle);
  return b;
}
/** Cada respuesta conserva el contexto y la edición en que se solicitó. */
export function useVigenciaTiempo() {
  const activa = useRef(true), turno = useRef(0);
  useEffect(() => { activa.current = true; return () => { activa.current = false; }; }, []);
  return { siguiente: () => ++turno.current, vigente: (n: number) => activa.current && n === turno.current, invalidar: () => ++turno.current };
}
export function CampoHoraTrabajo({ valor, cambiar, nombre }: { valor: HoraTrabajo; cambiar: (h: HoraTrabajo) => void; nombre: string }) {
  return <fieldset className="grid gap-3 sm:grid-cols-3"><legend className="font-semibold mb-2">{nombre} · Europe/Madrid</legend>
    <label>Fecha de {nombre.toLowerCase()}<input aria-label={`Fecha de ${nombre.toLowerCase()}`} className="block w-full mt-1" type="date" required value={valor.fecha} onChange={e => cambiar({ ...valor, fecha: e.target.value, offset: undefined })} /></label>
    <label>Hora de {nombre.toLowerCase()}<input aria-label={`Hora de ${nombre.toLowerCase()}`} className="block w-full mt-1" type="time" step="60" required value={valor.hora} onChange={e => cambiar({ ...valor, hora: e.target.value, offset: undefined })} /></label>
    <label>Offset de {nombre.toLowerCase()}<select aria-label={`Offset de ${nombre.toLowerCase()}`} className="block w-full mt-1" value={valor.offset ?? ''} onChange={e => cambiar({ ...valor, offset: e.target.value || undefined })}><option value="">Resolver hora única</option><option value="+02:00">+02:00 · verano</option><option value="+01:00">+01:00 · invierno</option></select></label>
  </fieldset>;
}
export const vacioTrabajo = () => ({ inicio: { fecha: '', hora: '' } as HoraTrabajo, fin: { fecha: '', hora: '' } as HoraTrabajo, notas: '', motivo: '' });
export function ErrorDeTiempo({ error }: { error: Error | null }) {
  return error ? <p role="alert" className="text-alerta mt-3">{error.message}{error instanceof FalloTiempo && error.codigo === 'HORA_AMBIGUA' && ' Elige el offset de verano o invierno en el extremo ambiguo.'}</p> : null;
}

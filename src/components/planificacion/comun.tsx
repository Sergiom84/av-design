'use client';
import { useRef, useState } from 'react';
import { localDesdeInstante } from '@/lib/planificacion/fechas';
import type { CamposTarea, TareaPlan } from '@/lib/planificacion/modelo';
export class FalloPlan extends Error {
    constructor(mensaje: string, public codigo: string, public status: number, public detalle?: {
        hash?: string;
        conflictos?: {
            titulo: string;
            obra: string;
            sala: string | null;
            inicio: string;
            fin: string;
        }[];
        alternativas?: {
            instante: string;
            offset: string;
        }[];
    }) {
        super(mensaje);
    }
}
export async function pedirPlan<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
    const r = await fetch(url, { method, cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    let data;
    try {
        data = await r.json();
    }
    catch {
        throw new FalloPlan('No se recibió una respuesta válida. Conservamos tu edición.', 'RESPUESTA_INVALIDA', r.status);
    }
    if (!r.ok)
        throw new FalloPlan(data.error ?? 'No se pudo completar la operación.', data.codigo ?? 'ERROR', r.status, data.detalle);
    return data as T;
}
export function useOperacionPlan() {
    const [ocupado, setOcupado] = useState(false), [mensaje, setMensaje] = useState(''), [error, setError] = useState<FalloPlan>();
    const bloqueo = useRef(false);
    async function ejecutar<T>(accion: () => Promise<T>, hecho = 'Cambios guardados.'): Promise<T | undefined> {
        if (bloqueo.current)
            return;
        bloqueo.current = true;
        setOcupado(true);
        setError(undefined);
        setMensaje('');
        try {
            const r = await accion();
            setMensaje(hecho);
            return r;
        }
        catch (e) {
            setError(e instanceof FalloPlan ? e : new FalloPlan('Error de red. Conservamos tu edición.', 'RED', 503));
            return undefined;
        }
        finally {
            bloqueo.current = false;
            setOcupado(false);
        }
    }
    return { ocupado, mensaje, error, ejecutar };
}
export function EstadoOperacion({ estado }: {
    estado: ReturnType<typeof useOperacionPlan>;
}) {
    return <>
    {estado.error && <p role="alert" className="mt-3 text-alerta">
      {estado.error.message}
    </p>}
    <p role="status" aria-live="polite" className="mt-3">
      {estado.mensaje}
    </p>
  </>;
}
export const claveNueva = () => crypto.randomUUID();
export const camposVacios: CamposTarea = { titulo: '', descripcion: '', notas: '', duracionEstimadaMin: null, estado: 'borrador', venceFecha: null, intervalo: null };
export function camposDeTarea(t: TareaPlan): CamposTarea {
    return { titulo: t.titulo, descripcion: t.descripcion, notas: t.notas, duracionEstimadaMin: t.duracionEstimadaMin, estado: t.estado, venceFecha: t.venceFecha, intervalo: t.inicio && t.fin ? { inicio: localDesdeInstante(t.inicio), fin: localDesdeInstante(t.fin) } : null };
}
export function CamposDeTarea({ valor, cambiar, prefijo = 'Tarea' }: {
    valor: CamposTarea;
    cambiar: (v: CamposTarea) => void;
    prefijo?: string;
}) {
    return <div className="grid gap-3 sm:grid-cols-2">

    <label className="sm:col-span-2">Título<input aria-label={`${prefijo}: título`} required maxLength={160} className="block w-full mt-1" value={valor.titulo} onChange={e => cambiar({ ...valor, titulo: e.target.value })}/>
    </label>

    <label className="sm:col-span-2">Descripción<textarea aria-label={`${prefijo}: descripción`} maxLength={2000} className="block w-full mt-1" value={valor.descripcion} onChange={e => cambiar({ ...valor, descripcion: e.target.value })}/>
    </label>

    <label>Estimación (min)<input aria-label={`${prefijo}: estimación en minutos`} type="number" min={1} max={43200} step={1} placeholder="Sin estimar" className="block w-full mt-1" value={valor.duracionEstimadaMin ?? ''} onChange={e => cambiar({ ...valor, duracionEstimadaMin: e.target.value === '' ? null : Number(e.target.value) })}/>
    </label>

    <label>Estado<select aria-label={`${prefijo}: estado`} className="block w-full mt-1" value={valor.estado} onChange={e => cambiar({ ...valor, estado: e.target.value as CamposTarea['estado'] })}>
        <option value="borrador">Borrador</option>
        <option value="pendiente">Pendiente</option>
        <option value="en_curso">En curso</option>
        <option value="hecha">Hecha (tarea)</option>
        <option value="anulada">Anulada</option>
      </select>
    </label>

    <label>Vencimiento inclusivo<input aria-label={`${prefijo}: vencimiento`} type="date" className="block w-full mt-1" value={valor.venceFecha ?? ''} onChange={e => cambiar({ ...valor, venceFecha: e.target.value || null })}/>
    </label>

    <label className="sm:col-span-2">Notas<textarea aria-label={`${prefijo}: notas`} maxLength={2000} className="block w-full mt-1" value={valor.notas} onChange={e => cambiar({ ...valor, notas: e.target.value })}/>
    </label>

  </div>;
}

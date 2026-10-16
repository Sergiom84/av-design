'use client';
import { useState } from 'react';
import type { TareaPlan } from '@/lib/planificacion/modelo';
import { pedirPlan, useOperacionPlan, EstadoOperacion, claveNueva } from './comun';
interface Evento {
    id: string;
    tipo: string;
    autor: string;
    creado_en: string;
    motivo: string | null;
    antecedente_id: string | null;
    antes: Record<string, unknown> | null;
    despues: Record<string, unknown> | null;
}
export function HistorialPlan({ tarea, editar, alGuardar, alRestaurar, alPendiente }: {
    tarea: TareaPlan;
    editar: boolean;
    alGuardar: () => Promise<void>;
    alRestaurar?: () => Promise<void>;
    alPendiente?: (v: boolean) => void;
}) {
    const [eventos, setEventos] = useState<Evento[]>([]), [motivo, setMotivo] = useState(''), [pagina, setPagina] = useState(1);
    const op = useOperacionPlan();
    async function consultar(n = 1) {
        await op.ejecutar(async () => {
            setEventos((await pedirPlan<{
                eventos: Evento[];
            }>(`/api/plan/tareas/${tarea.id}/historial?pagina=${n}`)).eventos);
            setPagina(n);
        }, 'Historial consultado.');
    }
    return <div className="space-y-3">
    <h3 className="font-semibold">Historial de planificación</h3>
    <button className="boton" disabled={op.ocupado} onClick={() => void consultar()}>Consultar historial</button>
    <ul className="space-y-4">
      {eventos.map(e => <li key={e.id} className="border-b border-linea pb-3">
        <p>
          {e.tipo.replaceAll('_', ' ')} · {e.autor} · {new Date(e.creado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
        </p>
        {e.motivo && <p>Motivo: {e.motivo}
        </p>}
        {e.despues?.titulo != null && <p>Título: {String(e.despues.titulo)} · Estado: {String(e.despues.estado ?? 'Sin cambio')} · Estimación: {e.despues.duracionEstimadaMin == null ? 'Sin estimar' : String(e.despues.duracionEstimadaMin) + ' min'}
        </p>}
        {editar && typeof e.despues?.titulo === 'string' && <button className="boton" disabled={!motivo.trim() || op.ocupado} onClick={() => {
                    alPendiente?.(true);
                    void op.ejecutar(async () => {
                        await pedirPlan(`/api/plan/tareas/${tarea.id}/historial`, 'POST', { versionPlan: tarea.versionPlan, versionTarea: tarea.version, clavePeticion: claveNueva(), motivo, eventoId: e.id });
                        if (alRestaurar)
                            await alRestaurar();
                        else
                            await alGuardar();
                    }, 'Versión restaurada como borrador, sin intervalo ni asignaciones.').finally(() => alPendiente?.(false));
                }}>Restaurar campos de este evento</button>}
      </li>)}
    </ul>
    {eventos.length === 50 && <button className="boton" onClick={() => void consultar(pagina + 1)}>Siguiente página de historial</button>}
    {editar && <label className="block">Motivo de restauración<input maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} className="block w-full mt-1"/>
    </label>}
    <EstadoOperacion estado={op}/>
  </div>;
}

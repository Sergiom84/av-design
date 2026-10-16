'use client';
import { Tarjeta } from '@/components/ui';
import { ESTADOS_TAREA, type TareaPlan } from '@/lib/planificacion/modelo';
export function ListaTareas({ tareas, elegir, estado, pagina, total, ocupado, cambiar }: {
    tareas: TareaPlan[];
    elegir: (t: TareaPlan) => void;
    estado: string;
    pagina: number;
    total: number;
    ocupado: boolean;
    cambiar: (pagina: number, estado: string) => void;
}) {
    return <Tarjeta titulo="Tareas del plan">
        <label className="block mb-4">Filtrar estado
            <select aria-label="Filtrar estado" disabled={ocupado} value={estado} onChange={e => cambiar(1, e.target.value)} className="block mt-1">
                <option value="">Todos los estados</option>
                {ESTADOS_TAREA.map(e => <option key={e} value={e}>
          {e.replaceAll('_', ' ')}
        </option>)}
            </select>
        </label>
        <p className="mb-3">Página {pagina} · {total} tareas en este filtro.</p>
        {!tareas.length ? <p>No hay tareas en este alcance.</p> : <ul className="space-y-3">
            {tareas.map(t => <li key={t.id} className="border-b border-linea-suave pb-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-40">
                    <strong>
            {t.titulo}
          </strong>
                    <p>
            {t.salaNombre ?? 'General de obra'} · {t.estado.replaceAll('_', ' ')} · {t.duracionEstimadaMin === null ? 'Sin estimar' : t.duracionEstimadaMin + ' min'} · {t.venceFecha ?? 'Sin vencimiento'}
          </p>
                    <p>
            {t.tecnicos.length ? t.tecnicos.map(p => p.nombre + (p.activo ? '' : ' (inactivo)')).join(', ') : 'Sin técnico asignado'}
          </p>
                </div>
                <button className="boton" onClick={() => elegir(t)}>Abrir tarea {t.titulo}
        </button>
            </li>)}
        </ul>}
        <nav aria-label="Páginas de tareas" className="flex gap-3 mt-4">
            <button className="boton" disabled={ocupado || pagina === 1} onClick={() => cambiar(pagina - 1, estado)}>Tareas anteriores</button>
            <button className="boton" disabled={ocupado || pagina * 50 >= total} onClick={() => cambiar(pagina + 1, estado)}>Tareas siguientes</button>
        </nav>
    </Tarjeta>;
}

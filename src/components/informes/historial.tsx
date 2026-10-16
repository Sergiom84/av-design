'use client';
import type { EjecucionUI } from './resultado';
export function Historial({ ejecuciones, ultimos, seleccionar, cargarMas, cursor }: {
    ejecuciones: EjecucionUI[];
    ultimos: EjecucionUI[];
    seleccionar: (id: string) => void;
    cargarMas: () => void;
    cursor: string | null;
}) {
    return <section className="space-y-3">
    
    <h2 className="text-lg font-semibold">Historial y cola</h2>
        
        {ultimos.length > 0 && <div className="rounded-lg bg-blue-50 p-3">
        
        <h3 className="font-semibold">Últimos correctos por fecha prevista</h3>
        
        <ul>
            
            {ultimos.map(e => <li key={e.id}>
            
            <button className="text-left underline" type="button" onClick={() => seleccionar(e.id)}>{e.definicion_snapshot.nombre} · {e.ocurrencia_utc} · {(e.caducada || e.estado === 'caducada') ? 'Último correcto caducado' : e.manifiesto?.revision}</button>
            
            </li>)}
        
        </ul>
        
        </div>}
    
    <ul className="divide-y divide-slate-200">
        
        {ejecuciones.map(e => <li className="py-3" key={e.id}>
        
        <button className="text-left underline" type="button" onClick={() => seleccionar(e.id)}>{e.definicion_snapshot.nombre} · {e.estado}</button>
        
        <p className="text-sm text-slate-600">{e.ocurrencia_utc} · intento {e.intento_actual}/3{e.error_codigo ? ` · ${e.error_codigo}` : ''}</p>
        
        </li>)}
    
    </ul>
    
    {!ejecuciones.length && <p>No hay ejecuciones visibles todavía.</p>}
    
    {cursor && <button className="boton" type="button" onClick={cargarMas}>Ver más ejecuciones</button>}
    
    </section>;
}

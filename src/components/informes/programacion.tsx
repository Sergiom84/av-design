'use client';
import { useState } from 'react';
import type { CalendarioInforme } from '@/lib/informes/modelo';
import { proximasOcurrencias } from '@/lib/informes/calendario';
export interface ProgramacionUI {
    id: string;
    version: number;
    calendario: CalendarioInforme;
    activa: boolean;
    proxima_utc: string | null;
    ultima_omision: unknown;
    ultimo_correcto?: {
        id: string;
        estado: string;
        revision: string;
        ocurrencia: string;
    } | null;
}
export function Programacion({ programaciones, guardar, modificar }: {
    programaciones: ProgramacionUI[];
    guardar: (c: CalendarioInforme) => Promise<void>;
    modificar: (p: ProgramacionUI, activa: boolean, c?: CalendarioInforme) => Promise<void>;
}) {
    const [c, setC] = useState<CalendarioInforme>({ frecuencia: 'diaria', inicio: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()), fin: null, hora: '09:00' });
    const [editando, setEditando] = useState<ProgramacionUI | null>(null);
    const [error, setError] = useState('');
    let preview: ReturnType<typeof proximasOcurrencias> | null = null;
    try {
        preview = proximasOcurrencias(c, new Date());
    }
    catch {
    }
    return <section className="space-y-4">
    
    <h2 className="text-lg font-semibold">Programación · Europe/Madrid</h2>
    
    <p className="text-sm text-slate-600">La hora inexistente de primavera se omite; en otoño se usa la primera aparición. La programación requiere un runner activo.</p>
    
    <div className="flex flex-wrap gap-3">
    
    <label>Frecuencia<select aria-label="Frecuencia" className="campo ml-2" value={c.frecuencia} onChange={e => {
            const f = e.target.value as CalendarioInforme['frecuencia'];
            setC({ ...c, frecuencia: f, ...f === 'semanal' ? { diasSemana: [1] } : { diasSemana: undefined } });
        }}>
    
    <option value="una_vez">Una vez</option>
    
    <option value="diaria">Diaria</option>
    
    <option value="semanal">Semanal</option>
    
    </select></label>
    
    <label>Inicio<input type="date" className="campo ml-2" value={c.inicio} onChange={e => setC({ ...c, inicio: e.target.value })}/></label>
    
    <label>Fin inclusivo<input type="date" className="campo ml-2" value={c.fin ?? ''} onChange={e => setC({ ...c, fin: e.target.value || null })}/></label>
    
    <label>Hora local<input type="time" className="campo ml-2" value={c.hora} onChange={e => setC({ ...c, hora: e.target.value })}/></label>
    
    </div>
        
        {c.frecuencia === 'semanal' && <fieldset>
        
        <legend>Días de la semana</legend>
        
        <div className="flex flex-wrap gap-3">
            
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia, i) => <label key={dia}>
            
            <input type="checkbox" className="mr-1" checked={c.diasSemana?.includes(i + 1) ?? false} onChange={e => setC({ ...c, diasSemana: e.target.checked ? [...c.diasSemana ?? [], i + 1] : (c.diasSemana ?? []).filter(x => x !== i + 1) })}/>
            
            {dia}
            
            </label>)}
        
        </div>
        
        </fieldset>}
        
        {preview && <div className="rounded-lg bg-slate-50 p-3">
        
        <p className="font-medium">Próximas cinco ocurrencias</p>
        
        <ul className="mt-1 text-sm">
        
        {preview.ocurrencias.map(o => <li key={o.utc}>{o.local} {o.offset} · {o.utc}</li>)}
            
            {preview.omisiones.map(o => <li key={o}>
            
            {o}
            
            </li>)}
        
        </ul>
        
        </div>}
        
        {error && <p role="alert" className="text-red-700">
        
        {error}
        
        </p>}
    
    <button type="button" className="boton boton-principal" onClick={async () => {
            try {
                setError('');
                if (editando)
                    await modificar(editando, true, c);
                else
                    await guardar(c);
                setEditando(null);
            }
            catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo guardar.');
            }
        }}>
    
    {editando ? 'Guardar cambios de programación' : 'Guardar programación'}
    
    </button>
    
    {editando && <button type="button" className="boton ml-2" onClick={() => setEditando(null)}>Cancelar edición</button>}
    
    <ul className="space-y-3">
        
        {programaciones.map(p => <li key={p.id} className="rounded-lg border border-slate-200 p-3">
        
        <p>{p.calendario.frecuencia} · {p.calendario.hora} Madrid · v{p.version} · {p.activa ? 'Activa' : 'Pausada'}</p>
        
        <p className="text-sm">Próxima UTC: {p.proxima_utc ?? 'Sin próxima ocurrencia'}</p>
        
        {p.ultimo_correcto && <p className="text-sm">{p.ultimo_correcto.estado === 'caducada' ? 'Último correcto caducado' : 'Último correcto'}: {p.ultimo_correcto.revision} · {p.ultimo_correcto.ocurrencia}</p>}
        
        {!!p.ultima_omision && <p className="break-words text-sm">Omisiones: {JSON.stringify(p.ultima_omision)}</p>}
        
        <div className="mt-2 flex gap-3">
        
        <button type="button" className="underline" onClick={() => {
                setEditando(p);
                setC(p.calendario);
            }}>Editar calendario</button>
        
        <button type="button" className="underline" onClick={async () => {
                try {
                    await modificar(p, !p.activa);
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : 'No se pudo guardar.');
                }
            }}>
        
        {p.activa ? 'Pausar' : 'Reanudar desde la próxima fecha futura'}
        
        </button>
        
        </div>
        
        </li>)}
    
    </ul>
    
    </section>;
}

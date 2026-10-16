'use client';
import { useState } from 'react';
import type { CamposTarea, TareaPlan, TecnicoPlan } from '@/lib/planificacion/modelo';
import { pedirPlan, useOperacionPlan, EstadoOperacion, claveNueva } from './comun';
export interface GrupoPlan {
    id: string;
    nombre: string;
    version: number;
    activo: boolean;
    miembros: TecnicoPlan[];
}
export function HorarioPlan({ valor, cambiar }: {
    valor: CamposTarea['intervalo'];
    cambiar: (v: CamposTarea['intervalo']) => void;
}) {
    return <div className="space-y-3"><label className="block"><input type="checkbox" checked={!!valor} onChange={e => cambiar(e.target.checked ? { inicio: { fecha: '', hora: '' }, fin: { fecha: '', hora: '' } } : null)}/> Programar intervalo común (Europe/Madrid)</label>{valor && <div className="grid sm:grid-cols-2 gap-3">{(['inicio', 'fin'] as const).map(extremo => <div key={extremo} className="space-y-2"><p>{extremo === 'inicio' ? 'Inicio' : 'Final'}</p><input aria-label={`Fecha de ${extremo}`} required type="date" value={valor[extremo].fecha} onChange={e => cambiar({ ...valor, [extremo]: { ...valor[extremo], fecha: e.target.value } })}/><input aria-label={`Hora de ${extremo} en Madrid`} required type="time" step={60} value={valor[extremo].hora} onChange={e => cambiar({ ...valor, [extremo]: { ...valor[extremo], hora: e.target.value } })}/><label className="block">Offset de {extremo}<select value={valor[extremo].offset ?? ''} onChange={e => cambiar({ ...valor, [extremo]: { fecha: valor[extremo].fecha, hora: valor[extremo].hora, ...(e.target.value ? { offset: e.target.value as '+01:00' | '+02:00' } : {}) } })} className="block mt-1"><option value="">Automático si la hora es única</option><option value="+02:00">+02:00 (primera aparición en otoño)</option><option value="+01:00">+01:00 (segunda aparición en otoño)</option></select></label></div>)}</div>}</div>;
}
export function AsignacionesPlan({ tarea, grupos, alGuardar }: {
    tarea: TareaPlan;
    grupos: GrupoPlan[];
    alGuardar: () => Promise<void>;
}) {
    const [tecnicos, setTecnicos] = useState(tarea.tecnicos), [resultados, setResultados] = useState<TecnicoPlan[]>([]), [q, setQ] = useState(''), [elegidos, setElegidos] = useState<string[]>([]), [nota, setNota] = useState('');
    const op = useOperacionPlan();
    const [clave, setClave] = useState(claveNueva);
    async function guardar(aceptar = false) {
        await op.ejecutar(async () => {
            await pedirPlan(`/api/plan/tareas/${tarea.id}/asignaciones`, 'PUT', { versionPlan: tarea.versionPlan, versionTarea: tarea.version, clavePeticion: clave, tecnicos: tecnicos.map(t => t.id), grupos: grupos.filter(g => elegidos.includes(g.id)).map(g => ({ id: g.id, version: g.version })), ...(aceptar && op.error?.detalle?.hash ? { aceptacionConflictos: { hash: op.error.detalle.hash, nota } } : {}) });
            await alGuardar();
            setClave(claveNueva());
        }, 'Asignación guardada. La expansión del grupo queda congelada en esta tarea.');
    }
    return <div className="space-y-3"><h3 className="font-semibold">Asignar técnicos existentes</h3><p>Asignados sin intervalo: responsabilidad pendiente de fechar, sin minutos de ocupación.</p><div className="flex flex-wrap gap-3"><label>Buscar técnico<input value={q} maxLength={200} onChange={e => setQ(e.target.value)} className="block mt-1"/></label><button className="boton" disabled={op.ocupado} onClick={() => void op.ejecutar(async () => {
            const r = await pedirPlan<{
                tecnicos: TecnicoPlan[];
            }>(`/api/plan/tecnicos?q=${encodeURIComponent(q)}&tareaId=${tarea.id}`);
            setResultados(r.tecnicos);
        }, 'Técnicos consultados.')}>Buscar técnicos</button></div>
    <ul className="space-y-2">{resultados.map(t => <li key={t.id}>{t.nombre} {t.activo ? '' : '· Técnico inactivo'} <button className="boton" disabled={!t.activo || tecnicos.some(p => p.id === t.id)} onClick={() => setTecnicos([...tecnicos, t])}>Añadir {t.nombre}</button></li>)}</ul>
    <ul className="space-y-2">{tecnicos.map(t => <li key={t.id}>{t.nombre}{!t.activo ? ' · Técnico inactivo' : ''} <button className="boton" onClick={() => setTecnicos(tecnicos.filter(p => p.id !== t.id))}>Quitar {t.nombre}</button></li>)}</ul>
    {grupos.filter(g => g.activo).map(g => <label key={g.id} className="block"><input type="checkbox" checked={elegidos.includes(g.id)} onChange={e => setElegidos(e.target.checked ? [...elegidos, g.id] : elegidos.filter(id => id !== g.id))}/> Grupo {g.nombre} · versión {g.version} · {g.miembros.map(t => t.nombre).join(', ')}</label>)}
    <button className="boton boton-principal" disabled={op.ocupado} onClick={() => void guardar()}>Guardar asignación revisada</button>
    {op.error?.detalle?.conflictos && <div className="border border-linea p-3 space-y-3"><h4 className="font-semibold">Conflictos actuales</h4><ul>{op.error.detalle.conflictos.map((c, i) => <li key={i}>{c.titulo} · {c.obra}{c.sala ? ' · ' + c.sala : ''} · {c.inicio} — {c.fin}</li>)}</ul><label className="block">Nota de aceptación<input value={nota} maxLength={500} onChange={e => setNota(e.target.value)} className="block w-full mt-1"/></label><button className="boton" disabled={!nota.trim() || op.ocupado} onClick={() => void guardar(true)}>Confirmar con estos conflictos</button></div>}
    <EstadoOperacion estado={op}/>
  </div>;
}

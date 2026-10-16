'use client';
import { useEffect, useState } from 'react';
import { serializarCanonico } from '@/lib/informes/modelo';
import type { ConfiguracionInforme } from '@/lib/informes/modelo';
export interface GrupoUI {
    id: string;
    nombre: string;
    version: number;
    activo: boolean;
    miembros: string[];
    ambito: ConfiguracionInforme['ambito'];
}
export interface DestinatarioUI {
    id: string;
    nombre: string;
    usuario: string;
    activo: boolean;
    apto: boolean;
}
export function Audiencia({ configuracion, admin, grupos, cambiar }: {
    configuracion: ConfiguracionInforme;
    admin: boolean;
    grupos: GrupoUI[];
    cambiar: (c: ConfiguracionInforme) => void;
}) {
    const [q, setQ] = useState('');
    const [resultado, setResultado] = useState<{
        firma: string;
        usuarios: DestinatarioUI[];
        error: string;
    } | null>(null);
    const firma = serializarCanonico({ admin, q, configuracion });
    const usuarios = resultado?.firma === firma ? resultado.usuarios : [];
    const error = resultado?.firma === firma ? resultado.error : '';
    useEffect(() => {
        if (!admin || q.length < 2) {
            return;
        }
        const abort = new AbortController();
        const t = setTimeout(() => {
            fetch(`/api/informes/destinatarios?q=${encodeURIComponent(q)}&configuracion=${encodeURIComponent(JSON.stringify(configuracion))}`, { signal: abort.signal }).then(async (r) => {
                const d = await r.json();
                if (!r.ok)
                    throw new Error(d.error);
                if (!abort.signal.aborted)
                    setResultado({ firma, usuarios: d.destinatarios, error: '' });
            }).catch(e => {
                if (!abort.signal.aborted && e.name !== 'AbortError')
                    setResultado({ firma, usuarios: [], error: e.message });
            });
        }, 300);
        return () => {
            clearTimeout(t);
            abort.abort();
        };
    }, [admin, q, configuracion, firma]);
    return <fieldset className="space-y-3">
    
    <legend className="font-semibold">Audiencia interna</legend>
    
    <p className="text-sm text-slate-600">El propietario está siempre incluido. Cada consulta y descarga comprueba los permisos actuales.</p>
        
        {admin && <>
        
        <label className="block">Buscar destinatarios<input className="campo mt-1 w-full" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre o código (dos caracteres)"/></label>
            
            {error && <p role="alert">
            
            {error}
            
            </p>}
        
        <div className="space-y-2">
        
        {(q.length >= 2 ? usuarios : []).map(u => <label key={u.id} className="flex gap-2"><input type="checkbox" disabled={!u.apto} checked={configuracion.audiencia.usuarios.includes(u.id)} onChange={e => cambiar({ ...configuracion, audiencia: { ...configuracion.audiencia, usuarios: e.target.checked ? [...configuracion.audiencia.usuarios, u.id] : configuracion.audiencia.usuarios.filter(id => id !== u.id) } })}/>{u.nombre} ({u.usuario}){!u.apto ? ' · Sin acceso a estas fuentes' : ''}</label>)}
        
        </div>
            
            {configuracion.audiencia.usuarios.length > 0 && <ul className="space-y-1 text-sm">
            
            {configuracion.audiencia.usuarios.map(id => <li key={id}>Destinatario {usuarios.find(u => u.id === id)?.nombre ?? id} <button type="button" className="underline" onClick={() => cambiar({ ...configuracion, audiencia: { ...configuracion.audiencia, usuarios: configuracion.audiencia.usuarios.filter(x => x !== id) } })}>Quitar</button></li>)}
            
            </ul>}
        
        <fieldset>
        
        <legend>Grupos del mismo ámbito</legend>
        
        {grupos.filter(g => g.activo && serializarCanonico(g.ambito) === serializarCanonico(configuracion.ambito)).map(g => <label key={g.id} className="mt-2 flex gap-2"><input type="checkbox" checked={configuracion.audiencia.grupos.some(x => x.id === g.id)} onChange={e => cambiar({ ...configuracion, audiencia: { ...configuracion.audiencia, grupos: e.target.checked ? [...configuracion.audiencia.grupos, { id: g.id, version: g.version }] : configuracion.audiencia.grupos.filter(x => x.id !== g.id) } })}/>{g.nombre} · {g.miembros.length} miembros · v{g.version}</label>)}
        
        </fieldset>
        
        </>}
    
    </fieldset>;
}

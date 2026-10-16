'use client';
import { useState } from 'react';
import { Tarjeta } from '@/components/ui';
import type { TecnicoPlan } from '@/lib/planificacion/modelo';
import type { GrupoPlan } from './asignaciones';
import { pedirPlan, useOperacionPlan, EstadoOperacion, claveNueva } from './comun';
export function GruposPlan({ proyectoId, version, grupos, alGuardar }: {
    proyectoId: string;
    version: number;
    grupos: GrupoPlan[];
    alGuardar: () => Promise<void>;
}) {
    const [nombre, setNombre] = useState(''), [miembros, setMiembros] = useState<TecnicoPlan[]>([]), [q, setQ] = useState(''), [resultados, setResultados] = useState<TecnicoPlan[]>([]), [actual, setActual] = useState<GrupoPlan>(), [activo, setActivo] = useState(true), [clavePeticion, setClavePeticion] = useState(claveNueva);
    const op = useOperacionPlan();
    return <Tarjeta titulo="Grupos operativos del plan"><p>Cambiar un grupo no cambia las asignaciones ya confirmadas.</p><ul className="space-y-3 mt-3">{grupos.map(g => <li key={g.id}>{g.nombre} · {g.miembros.map(t => t.nombre).join(', ')} · {g.activo ? 'Activo' : 'Inactivo'} <button className="boton" disabled={op.ocupado} onClick={() => {
                setActual(g);
                setClavePeticion(claveNueva());
                setNombre(g.nombre);
                setMiembros(g.miembros);
                setActivo(g.activo);
            }}>Editar grupo {g.nombre}</button></li>)}</ul><form className="space-y-3 mt-5" onSubmit={e => {
            e.preventDefault();
            void op.ejecutar(async () => {
                await pedirPlan(actual ? `/api/plan/grupos/${actual.id}` : `/api/plan/proyectos/${proyectoId}/grupos`, actual ? 'PATCH' : 'POST', { nombre, miembros: miembros.map(t => t.id), activo, versionPlan: version, clavePeticion, ...(actual ? { version: actual.version } : {}) });
                await alGuardar();
                setActual(undefined);
                setClavePeticion(claveNueva());
                setNombre('');
                setMiembros([]);
            });
        }}><fieldset disabled={op.ocupado} className="space-y-3"><label className="block">Nombre del grupo<input required maxLength={120} value={nombre} onChange={e => setNombre(e.target.value)} className="block w-full mt-1"/></label><label className="block"><input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)}/> Grupo activo</label><div className="flex flex-wrap gap-3"><label>Buscar miembro<input value={q} onChange={e => setQ(e.target.value)} className="block mt-1"/></label><button type="button" className="boton" onClick={() => void op.ejecutar(async () => {
            setResultados((await pedirPlan<{
                tecnicos: TecnicoPlan[];
            }>('/api/plan/tecnicos?q=' + encodeURIComponent(q))).tecnicos);
        }, 'Técnicos consultados.')}>Buscar miembros</button></div><ul>{resultados.map(t => <li key={t.id}><button type="button" className="boton" disabled={miembros.some(m => m.id === t.id)} onClick={() => setMiembros([...miembros, t])}>Incluir {t.nombre}</button></li>)}</ul><ul>{miembros.map(t => <li key={t.id}>{t.nombre}<button type="button" className="boton" onClick={() => setMiembros(miembros.filter(m => m.id !== t.id))}>Retirar {t.nombre}</button></li>)}</ul><button className="boton boton-principal">Guardar grupo</button></fieldset></form><EstadoOperacion estado={op}/></Tarjeta>;
}

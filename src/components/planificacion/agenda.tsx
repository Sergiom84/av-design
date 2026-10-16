'use client';
import { useRef, useState } from 'react';
import { pedirPlan, useOperacionPlan, EstadoOperacion } from './comun';
import type { TecnicoPlan } from '@/lib/planificacion/modelo';
import Link from 'next/link';
import { Tarjeta } from '@/components/ui';
import { urlAgendaPlan, type FiltroAgenda } from '@/lib/planificacion/modelo';
import type { RepositorioPlanificacion } from '@/lib/planificacion/repositorio';
type ResumenAgenda = Awaited<ReturnType<RepositorioPlanificacion['agenda']>>;
const nombres = { hoy: 'Hoy', semana: 'Semana', vencidas: 'Vencidas', sin_fecha: 'Sin fecha' };
export function AgendaPlan({ datos, obras, tecnicos }: {
    datos: ResumenAgenda;
    obras: {
        id: string;
        nombre: string;
    }[];
    tecnicos: TecnicoPlan[];
}) {
    const [personas, setPersonas] = useState(tecnicos), [busqueda, setBusqueda] = useState(''), [tecnicoSeleccionado, setTecnicoSeleccionado] = useState(datos.filtros.tecnicoId ?? '');
    const op = useOperacionPlan();
    const seleccionActual = useRef(tecnicoSeleccionado);
    return <div className="space-y-6">
    <p>Europe/Madrid · {datos.hoy} · Tiempo planificado. Los contadores se solapan entre vistas y no son horas trabajadas.</p>
    <nav className="flex flex-wrap gap-3" aria-label="Vistas de agenda">
      {(Object.keys(nombres) as FiltroAgenda['vista'][]).map(v => <Link key={v} href={urlAgendaPlan({ ...datos.filtros, vista: v }) as never} className="boton" aria-current={datos.filtros.vista === v ? 'page' : undefined}>
        {nombres[v]} ({datos.contadores[v]})</Link>)}
    </nav>
    <Tarjeta titulo="Filtrar agenda">
      <form className="flex flex-wrap gap-3 items-end">
        <input type="hidden" name="vista" value={datos.filtros.vista}/>
        <label className="block min-w-0 max-w-full">Obra<select name="proyectoId" defaultValue={datos.filtros.proyectoId ?? ''} className="block mt-1 max-w-full">
            <option value="">Todas las obras autorizadas</option>
            {obras.map(o => <option key={o.id} value={o.id}>
              {o.nombre}
            </option>)}
          </select>
        </label>
        <label className="block min-w-0 max-w-full">Técnico seleccionado<select name="tecnicoId" value={tecnicoSeleccionado} onChange={e => { seleccionActual.current = e.target.value; setTecnicoSeleccionado(e.target.value); }} className="block mt-1 max-w-full">
            <option value="">Todos los técnicos</option>
            {personas.map(t => <option key={t.id} value={t.id}>
              {t.nombre}
            </option>)}
          </select>
        </label>
        <label className="block min-w-0 max-w-full">Buscar técnico por nombre<input value={busqueda} onChange={e => setBusqueda(e.target.value)} className="block mt-1 max-w-full"/>
        </label>
        <button type="button" className="boton" disabled={op.ocupado} onClick={() => void op.ejecutar(async () => {
            const nuevos = (await pedirPlan<{ tecnicos: TecnicoPlan[] }>('/api/plan/tecnicos?q=' + encodeURIComponent(busqueda))).tecnicos;
            setPersonas(anteriores => [...new Map([...nuevos, ...anteriores.filter(t => t.id === seleccionActual.current)].map(t => [t.id, t])).values()]);
        }, 'Técnicos consultados.')}>Buscar en técnicos</button>
        <label className="block min-w-0 max-w-full">Desde para ocupación<input name="desde" type="date" defaultValue={datos.filtros.desde ?? ''} className="block mt-1 max-w-full"/>
        </label>
        <label className="block min-w-0 max-w-full">Hasta para ocupación<input name="hasta" type="date" defaultValue={datos.filtros.hasta ?? ''} className="block mt-1 max-w-full"/>
        </label>
        <label className="block min-w-0 max-w-full">
          <input name="historial" type="checkbox" value="1" defaultChecked={datos.filtros.historial}/> Incluir historial de estados cerrados</label>
        <button className="boton">Aplicar filtros</button>
      </form>
      <EstadoOperacion estado={op}/>
    </Tarjeta>
    <Tarjeta titulo={`Tareas · ${nombres[datos.filtros.vista]}`}>
      <ul className="space-y-4">
        {datos.tareas.map(t => <li key={t.id} className="border-b border-linea-suave pb-3">
          <Link href={`/proyectos/${t.proyectoId}/plan` as never} className="enlace">
            {t.titulo} · {t.proyectoNombre}
          </Link>
          <p>
            {t.salaNombre ?? 'General de obra'} · {t.estado} · vencimiento {t.venceFecha ?? 'sin fecha'}
          </p>
          <p>
            {t.inicio ? new Date(t.inicio).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : 'Sin intervalo'}
            {t.fin ? ' — ' + new Date(t.fin).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : ''}
          </p>
          <p>
            {t.tecnicos.length ? t.tecnicos.map(p => p.nombre + (p.activo ? '' : ' (inactivo)')).join(', ') : 'Sin técnico'} · Estimación: {t.duracionEstimadaMin === null ? 'Sin estimar' : t.duracionEstimadaMin + ' min'}
          </p>
        </li>)}
      </ul>
      {!datos.tareas.length && <p>Sin tareas en esta vista y alcance.</p>}
    </Tarjeta>
    <Tarjeta titulo="Ocupación planificada por técnico">
      <p>Rango: {new Date(datos.rango.inicio).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })} — {new Date(new Date(datos.rango.fin).getTime() - 1).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}.</p>
      <p>Se unen los intervalos solapados de cada persona dentro del rango visible. No se suma como duración global de tareas.</p>
      <ul className="space-y-2 mt-3">
        {datos.ocupacion.map(p => <li key={p.tecnicoId}>
          <Link className="enlace" href={urlAgendaPlan({ ...datos.filtros, tecnicoId: p.tecnicoId }) as never}>
            {p.nombre}
          </Link> · {p.minutos} min planificados{p.activo ? '' : ' · Técnico inactivo'}
        </li>)}
      </ul>
      {!datos.ocupacion.length && <p>Sin intervalos activos asignados en este rango.</p>}
      <p className="mt-3">Estimación conocida de tareas: {datos.estimacion.minutosConocidos} min · {datos.estimacion.sinEstimar} sin estimar.</p>
      <p>
        {datos.asignadasSinIntervalo} tareas asignadas sin intervalo · {datos.sinTecnico} sin técnico.</p>
    </Tarjeta>
  </div>;
}

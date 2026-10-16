'use client';
import { useState } from 'react';
import { Tarjeta } from '@/components/ui';
import type { Trabajo, Regla } from '@/lib/planificacion/modelo';
import { pedirPlan, useOperacionPlan, EstadoOperacion } from './comun';
import { ReglasPlan } from './reglas';
export function CatalogoTareas({ inicial, editar, puedeSalas, puedeCatalogo, reglas }: {
    inicial: Trabajo[];
    editar: boolean;
    puedeSalas: boolean;
    puedeCatalogo: boolean;
    reglas: Regla[];
}) {
    const [trabajos, setTrabajos] = useState(inicial), [seleccion, setSeleccion] = useState<Trabajo>(), [titulo, setTitulo] = useState(''), [descripcion, setDescripcion] = useState(''), [minutos, setMinutos] = useState(''), [activo, setActivo] = useState(true), [q, setQ] = useState('');
    const op = useOperacionPlan();
    const [pagina, setPagina] = useState(1);
    function elegir(t?: Trabajo) {
        setSeleccion(t);
        setTitulo(t?.titulo ?? '');
        setDescripcion(t?.descripcion ?? '');
        setMinutos(t?.duracionEstimadaMin?.toString() ?? '');
        setActivo(t?.activo ?? true);
    }
    async function recargar(p = pagina) {
        const r = await pedirPlan<{
            trabajos: Trabajo[];
        }>('/api/plan/catalogo?modo=administracion&q=' + encodeURIComponent(q) + '&pagina=' + p);
        setTrabajos(r.trabajos);
        setPagina(p);
    }
    return <div className="space-y-6">
    <Tarjeta titulo="Catálogo de trabajos">
      <form className="flex flex-wrap gap-3 mb-4" onSubmit={e => {
            e.preventDefault();
            void op.ejecutar(() => recargar(1), 'Catálogo consultado.');
        }}>
        <label>Buscar trabajo<input value={q} onChange={e => setQ(e.target.value)} maxLength={200} className="block mt-1"/>
        </label>
        <button className="boton" disabled={op.ocupado}>Buscar trabajos</button>
      </form>
      <ul className="space-y-3">
        {trabajos.map(t => <li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-linea-suave pb-3">
          <span className="flex-1 min-w-40">
            {t.titulo} · {t.duracionEstimadaMin === null ? 'Sin estimar' : `${t.duracionEstimadaMin} min`} · {t.activo ? 'Activo' : 'Inactivo'}
          </span>
          {editar && <button className="boton" disabled={op.ocupado} onClick={() => elegir(t)}>Editar {t.titulo}
          </button>}
        </li>)}
      </ul>
      {!trabajos.length && <p>Sin trabajos. Puedes crear tareas manuales sin catálogo.</p>}
      {editar && <form className="space-y-3 mt-5" onSubmit={e => {
                e.preventDefault();
                void op.ejecutar(async () => {
                    await pedirPlan('/api/plan/catalogo' + (seleccion ? '/' + seleccion.id : ''), seleccion ? 'PATCH' : 'POST', { titulo, descripcion, duracionEstimadaMin: minutos === '' ? null : Number(minutos), activo, ...(seleccion ? { version: seleccion.version } : {}) });
                    await recargar();
                    elegir();
                });
            }}>
        <fieldset disabled={op.ocupado} className="space-y-3">
          <h3 className="font-semibold">
            {seleccion ? 'Editar trabajo' : 'Nuevo trabajo'}
          </h3>
          <label className="block">Título literal<input aria-label="Título del trabajo" required maxLength={160} className="block w-full mt-1" value={titulo} onChange={e => setTitulo(e.target.value)}/>
          </label>
          <label className="block">Descripción<textarea aria-label="Descripción del trabajo" maxLength={2000} className="block w-full mt-1" value={descripcion} onChange={e => setDescripcion(e.target.value)}/>
          </label>
          <label className="block">Estimación (min)<input aria-label="Estimación del trabajo" type="number" min={1} max={43200} step={1} placeholder="Sin estimar" value={minutos} onChange={e => setMinutos(e.target.value)} className="block mt-1"/>
          </label>
          <label className="block">
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)}/> Trabajo activo</label>
          <div className="flex gap-3">
            <button className="boton boton-principal">Guardar trabajo</button>
            {seleccion && <button className="boton" type="button" onClick={() => elegir()}>Crear otro trabajo</button>}
          </div>
        </fieldset>
      </form>}
      <nav aria-label="Páginas de trabajos" className="flex gap-3 mt-4">
        <button className="boton" disabled={op.ocupado || pagina === 1} onClick={() => void op.ejecutar(() => recargar(pagina - 1), 'Catálogo consultado.')}>Trabajos anteriores</button>
        <button className="boton" disabled={op.ocupado || trabajos.length < 50} onClick={() => void op.ejecutar(() => recargar(pagina + 1), 'Catálogo consultado.')}>Trabajos siguientes</button>
      </nav>
      <EstadoOperacion estado={op}/>
    </Tarjeta>
    {puedeSalas && <ReglasPlan inicial={reglas} trabajos={trabajos} editar={editar} puedeCatalogo={puedeCatalogo}/>}
  </div>;
}

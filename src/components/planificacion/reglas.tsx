'use client';
import { useState } from 'react';
import { Tarjeta } from '@/components/ui';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import type { Regla, Trabajo, SelectorRegla } from '@/lib/planificacion/modelo';
import { pedirPlan, useOperacionPlan, EstadoOperacion } from './comun';
export function ReglasPlan({ trabajos, editar, puedeCatalogo, inicial = [] }: {
    trabajos: Trabajo[];
    editar: boolean;
    puedeCatalogo: boolean;
    inicial?: Regla[];
}) {
    const [reglas, setReglas] = useState<Regla[]>(inicial), [trabajo, setTrabajo] = useState(''), [selector, setSelector] = useState<SelectorRegla>({ tipo: 'sala' }), [elegida, setElegida] = useState<Regla>();
    const op = useOperacionPlan();
    const [pagina, setPagina] = useState(1);
    const visibles = reglas.filter(r => puedeCatalogo || ['sala', 'tipologia'].includes(r.selector.tipo));
    const seleccionPermitida = puedeCatalogo || ['sala', 'tipologia'].includes(selector.tipo);
    const [permisoLeido, setPermisoLeido] = useState(puedeCatalogo);
    if (permisoLeido !== puedeCatalogo) {
        setPermisoLeido(puedeCatalogo);
        setReglas(inicial);
        setPagina(1);
    }
    async function recargar(p = pagina) {
        const r = await pedirPlan<{
            reglas: Regla[];
        }>(`/api/plan/reglas?pagina=${p}`);
        setReglas(r.reglas);
        setPagina(p);
    }
    return <Tarjeta titulo="Reglas de propuesta">

    <ul className="space-y-3">
      {visibles.map(r => <li key={r.id} className="flex flex-wrap gap-3 items-center">
        <span className="flex-1">
          {r.trabajo.titulo} · {r.selector.tipo} · {r.activo ? 'Activa' : 'Inactiva'}
        </span>
        {editar && <>
          <button className="boton" disabled={op.ocupado} onClick={() => {
                    setElegida(r);
                    setTrabajo(r.trabajoId);
                    setSelector(r.selector);
                }}>Editar regla de {r.trabajo.titulo}
          </button>
          <button className="boton" disabled={op.ocupado} onClick={() => void op.ejecutar(async () => {
                    await pedirPlan('/api/plan/reglas/' + r.id, 'PATCH', { trabajoId: r.trabajoId, selector: r.selector, activo: !r.activo, version: r.version });
                    await recargar();
                })}>
            {r.activo ? 'Desactivar' : 'Activar'} regla de {r.trabajo.titulo}
          </button>
        </>}
      </li>)}
    </ul>

    {editar && !seleccionPermitida && <p role="status">La regla seleccionada requiere acceso al catálogo. Su edición se conserva sin mostrar el contenido retirado. <button className="boton" disabled={op.ocupado} onClick={() => {
            setSelector({ tipo: 'sala' });
            setElegida(undefined);
        }}>Nueva regla de sala</button>
    </p>}
    {editar && seleccionPermitida && <form className="space-y-3 mt-5" onSubmit={e => {
                e.preventDefault();
                void op.ejecutar(async () => {
                    await pedirPlan('/api/plan/reglas' + (elegida ? '/' + elegida.id : ''), elegida ? 'PATCH' : 'POST', { trabajoId: trabajo, selector, activo: true, ...(elegida ? { version: elegida.version } : {}) });
                    await recargar();
                    setElegida(undefined);
                });
            }}>
      <fieldset disabled={op.ocupado} className="space-y-3">
        <label className="block">Trabajo<select aria-label="Trabajo de la regla" required value={trabajo} onChange={e => setTrabajo(e.target.value)} className="block mt-1">
            <option value="">Elegir trabajo</option>
            {trabajos.filter(t => t.activo).map(t => <option key={t.id} value={t.id}>
              {t.titulo}
            </option>)}
          </select>
        </label>
        <label className="block">Aplicar a<select aria-label="Origen de la regla" value={selector.tipo} onChange={e => {
                const tipo = e.target.value as SelectorRegla['tipo'];
                setSelector(tipo === 'tipologia' ? { tipo, tipologia: '' } : { tipo } as SelectorRegla);
            }} className="block mt-1">
            <option value="sala">Cada sala</option>
            <option value="tipologia">Tipología literal</option>
            {puedeCatalogo && <>
              <option value="equipo">Equipos persistidos</option>
              <option value="conexion">Conexiones persistidas</option>
              <option value="material_bom">Partidas adicionales</option>
            </>}
          </select>
        </label>

        {selector.tipo === 'tipologia' && <label className="block">Tipología<input aria-label="Tipología literal" required value={selector.tipologia} onChange={e => setSelector({ ...selector, tipologia: e.target.value })} className="block mt-1"/>
        </label>}

        {selector.tipo === 'equipo' && <label className="block">Categoría literal (opcional)<input value={selector.categoria ?? ''} onChange={e => setSelector({ tipo: 'equipo', ...(selector.articuloId ? { articuloId: selector.articuloId } : {}), ...(e.target.value ? { categoria: e.target.value } : {}) })} className="block mt-1"/>
        </label>}

        {puedeCatalogo && ['equipo', 'conexion', 'material_bom'].includes(selector.tipo) && <BuscadorArticulo key={selector.tipo} etiqueta="Referencia específica de la regla (opcional)" tipo={selector.tipo === 'equipo' ? 'equipo' : selector.tipo === 'conexion' ? 'cable' : undefined} alElegir={a => {
                    if (selector.tipo === 'equipo' || selector.tipo === 'material_bom') {
                        setSelector(selector.tipo === 'equipo' ? { tipo: 'equipo', ...(selector.categoria ? { categoria: selector.categoria } : {}), ...(a ? { articuloId: a.id } : {}) } : { tipo: 'material_bom', ...(a ? { articuloId: a.id } : {}) });
                    }
                    else if (selector.tipo === 'conexion') {
                        setSelector({ tipo: 'conexion', ...(selector.senal ? { senal: selector.senal } : {}), ...(a ? { articuloCableId: a.id } : {}) });
                    }
                }}/>}

        {selector.tipo === 'conexion' && <label className="block">Señal<select value={selector.senal ?? ''} onChange={e => setSelector({ tipo: 'conexion', ...(selector.articuloCableId ? { articuloCableId: selector.articuloCableId } : {}), ...(e.target.value ? { senal: e.target.value as 'hdmi' } : {}) })} className="block mt-1">
            <option value="">Todas</option>
            {['hdmi', 'red', 'usb', 'audio_linea', 'audio_altavoz', 'microfono', 'alimentacion', 'control', 'otro'].map(s => <option key={s}>
              {s}
            </option>)}
          </select>
        </label>}

        <button className="boton boton-principal">Guardar regla</button>
      </fieldset>
    </form>}

    <nav aria-label="Páginas de reglas" className="flex gap-3 mt-4">
      <button className="boton" disabled={op.ocupado || pagina === 1} onClick={() => void op.ejecutar(() => recargar(pagina - 1), 'Reglas consultadas.')}>Reglas anteriores</button>
      <button className="boton" disabled={op.ocupado || reglas.length < 50} onClick={() => void op.ejecutar(() => recargar(pagina + 1), 'Reglas consultadas.')}>Reglas siguientes</button>
    </nav>
    <EstadoOperacion estado={op}/>

  </Tarjeta>;
}

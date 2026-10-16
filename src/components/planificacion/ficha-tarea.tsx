'use client';
import { useState } from 'react';
import { Tarjeta } from '@/components/ui';
import type { TareaPlan } from '@/lib/planificacion/modelo';
import { CamposDeTarea, camposDeTarea, pedirPlan, useOperacionPlan, EstadoOperacion, claveNueva } from './comun';
import { HorarioPlan, AsignacionesPlan, type GrupoPlan } from './asignaciones';
import { HistorialPlan } from './historial';
export function FichaTarea({ tarea, grupos, editar, agendaCompleta, alGuardar }: {
    tarea: TareaPlan;
    grupos: GrupoPlan[];
    editar: boolean;
    agendaCompleta: boolean;
    alGuardar: () => Promise<void>;
}) {
    const [campos, setCampos] = useState(() => camposDeTarea(tarea)), [motivo, setMotivo] = useState(''), [notaConflicto, setNotaConflicto] = useState(''), [comparacion, setComparacion] = useState<TareaPlan>(), [clave, setClave] = useState(claveNueva), [restaurando, setRestaurando] = useState(false);
    const op = useOperacionPlan();
    const [asignacionCanonica, setAsignacionCanonica] = useState<{ revision: number; tecnicos: TareaPlan['tecnicos'] }>({ revision: 0, tecnicos: tarea.tecnicos });
    function adoptar(t: TareaPlan) {
        setCampos(camposDeTarea(t));
        setClave(claveNueva());
        setAsignacionCanonica(anterior => ({ revision: anterior.revision + 1, tecnicos: t.tecnicos }));
    }
    async function guardar(aceptar = false) {
        await op.ejecutar(async () => {
            await pedirPlan(`/api/plan/tareas/${tarea.id}`, 'PATCH', { ...campos, versionPlan: tarea.versionPlan, versionTarea: tarea.version, clavePeticion: clave, ...(motivo ? { motivo } : {}), ...(aceptar && op.error?.detalle?.hash ? { aceptacionConflictos: { hash: op.error.detalle.hash, nota: notaConflicto } } : {}) });
            await alGuardar();
            if (['hecha', 'anulada'].includes(tarea.estado) && campos.estado !== tarea.estado)
                adoptar(await pedirPlan<TareaPlan>(`/api/plan/tareas/${tarea.id}`));
            else
                setClave(claveNueva());
        }, 'Tarea guardada. Su estado no registra entrega física.');
    }
    return <Tarjeta titulo={`Tarea: ${tarea.titulo}`}>
    <fieldset disabled={restaurando} className="min-w-0">
      <p>
        {tarea.salaNombre ?? 'General de obra'} · {tarea.estado} · {tarea.duracionEstimadaMin === null ? 'Sin estimar' : tarea.duracionEstimadaMin + ' min'}
      </p>
      {tarea.claveOrigen && <p className="text-sm">Origen {String(tarea.origenPublico.tipoOrigen ?? 'generado')} · {tarea.origenPublico.fuente === 'revision' ? `Revisión ${tarea.origenPublico.revisionNumero}: ${tarea.origenPublico.revisionNombre}` : 'Diseño persistido'} · versión {String(tarea.origenPublico.disenoVersion ?? 'desconocida')}
      </p>}
      {tarea.desactualizada && <p role="status">La sala o su diseño cambió desde el origen. Mantener esta tarea exige motivo.</p>}
      <form onSubmit={e => {
            e.preventDefault();
            void guardar();
        }} className="space-y-4 mt-4">
        <fieldset disabled={!editar || op.ocupado} className="space-y-4">
          <CamposDeTarea valor={campos} cambiar={setCampos} prefijo="Editar tarea"/>
          <HorarioPlan valor={campos.intervalo} cambiar={intervalo => setCampos({ ...campos, intervalo })}/>
          <label className="block">Motivo del cambio (obligatorio al anular, reabrir o conservar origen antiguo)<input aria-label="Motivo del cambio de tarea" maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} className="block w-full mt-1"/>
          </label>
          <button className="boton boton-principal">Guardar tarea</button>
        </fieldset>
      </form>
      {op.error?.detalle?.alternativas && <ul role="status">
        {op.error.detalle.alternativas.map(a => <li key={a.instante}>
          {a.offset} · {a.instante}; elige el offset en el horario.</li>)}
      </ul>}
      {op.error?.detalle?.conflictos && <div className="space-y-3 mt-4">
        <p>Conflictos actuales para el intervalo:</p>
        <ul>
          {op.error.detalle.conflictos.map((c, i) => <li key={i}>
            {c.titulo} · {c.obra} · {c.inicio} — {c.fin}
          </li>)}
        </ul>
        <label className="block">Nota sobre estos conflictos<input value={notaConflicto} maxLength={500} onChange={e => setNotaConflicto(e.target.value)} className="block w-full"/>
        </label>
        <button className="boton" disabled={op.ocupado || !notaConflicto.trim()} onClick={() => void guardar(true)}>Guardar intervalo con estos conflictos</button>
      </div>}
      <button className="boton mt-4" disabled={op.ocupado} onClick={() => void op.ejecutar(async () => {
            setComparacion(await pedirPlan<TareaPlan>(`/api/plan/tareas/${tarea.id}`));
        }, 'Versión guardada disponible para comparar. Tu edición sigue en el formulario.')}>Recargar tarea y comparar</button>
      {comparacion && <div className="mt-3 border border-linea p-3">
        <p>Guardado: {comparacion.titulo} · {comparacion.estado} · {comparacion.notas} · {comparacion.duracionEstimadaMin === null ? 'Sin estimar' : comparacion.duracionEstimadaMin + ' min'}
        </p>
        <button className="boton" disabled={op.ocupado} onClick={() => {
                adoptar(comparacion);
                setComparacion(undefined);
                void alGuardar();
            }}>Adoptar campos guardados</button>
      </div>}
      <EstadoOperacion estado={op}/>
      {editar && agendaCompleta && <div className="mt-6 border-t border-linea pt-4">
        <AsignacionesPlan key={asignacionCanonica.revision} tarea={{ ...tarea, tecnicos: asignacionCanonica.tecnicos }} grupos={grupos} alGuardar={alGuardar}/>
      </div>}
      <div className="mt-6 border-t border-linea pt-4">
        <HistorialPlan tarea={tarea} editar={editar} alGuardar={alGuardar} alPendiente={setRestaurando} alRestaurar={async () => {
            await alGuardar();
            const t = await pedirPlan<TareaPlan>(`/api/plan/tareas/${tarea.id}`);
            adoptar(t);
        }}/>
      </div>
    </fieldset>
  </Tarjeta>;
}

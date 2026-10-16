'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Aviso, Tarjeta } from '@/components/ui';
import type { RepositorioPlanificacion } from '@/lib/planificacion/repositorio';
import { LIMITES_PLAN, type Regla, type Trabajo, type TareaPlan } from '@/lib/planificacion/modelo';
import { CamposDeTarea, camposVacios, pedirPlan, useOperacionPlan, EstadoOperacion, claveNueva, FalloPlan } from './comun';
import { HorarioPlan, type GrupoPlan } from './asignaciones';
import { PreparacionPlan } from './preparacion';
import { ListaTareas } from './lista-tareas';
import { FichaTarea } from './ficha-tarea';
import { GruposPlan } from './grupos';
type DatosPlan = Awaited<ReturnType<RepositorioPlanificacion['leerPlan']>>;
export function PlanMontaje({ inicial, reglas, trabajos, gruposIniciales }: {
    inicial: DatosPlan;
    reglas: Regla[];
    trabajos: Trabajo[];
    gruposIniciales: GrupoPlan[];
}) {
    const [datos, setDatos] = useState(inicial), [grupos, setGrupos] = useState(gruposIniciales), [abierta, setAbierta] = useState<TareaPlan>(), [manual, setManual] = useState(camposVacios), [salaId, setSalaId] = useState(''), [trabajoId, setTrabajoId] = useState(''), [motivo, setMotivo] = useState(''), [busquedaTrabajo, setBusquedaTrabajo] = useState(''), [trabajosDisponibles, setTrabajosDisponibles] = useState(trabajos), [clavePlan] = useState(claveNueva), [claveManual, setClaveManual] = useState(claveNueva);
    const [pagina, setPagina] = useState(1), [estado, setEstado] = useState(''), [total, setTotal] = useState(inicial.totalTareas);
    const [paginaTrabajo, setPaginaTrabajo] = useState(1), [consultaTrabajo, setConsultaTrabajo] = useState(''), [trabajoCopiado, setTrabajoCopiado] = useState<Trabajo>();
    async function buscarTrabajos(p: number, q: string) {
        setTrabajosDisponibles((await pedirPlan<{ trabajos: Trabajo[] }>('/api/plan/catalogo?q=' + encodeURIComponent(q) + '&pagina=' + p)).trabajos);
        setPaginaTrabajo(p);
        setConsultaTrabajo(q);
    }
    const turno = useRef(0), op = useOperacionPlan(), router = useRouter();
    const puedeSalas = datos.puedeSalas && inicial.puedeSalas, puedeEditar = datos.puedeEditar && inicial.puedeEditar;
    const tareasVisibles = puedeSalas ? datos.tareas : datos.tareas.filter(t => !t.salaId);
    const proyectoId = datos.proyecto.id, editable = puedeEditar && !datos.cerrado && !datos.plan?.archivado;
    async function actualizar(p = pagina, e = estado) {
        const n = ++turno.current;
        const [plan, gruposLeidos, lista, seleccionada] = await Promise.all([
            pedirPlan<DatosPlan>(`/api/plan/proyectos/${proyectoId}`),
            pedirPlan<{
                grupos: GrupoPlan[];
            }>(`/api/plan/proyectos/${proyectoId}/grupos`),
            pedirPlan<{
                tareas: TareaPlan[];
                total: number;
            }>(`/api/plan/proyectos/${proyectoId}/tareas?pagina=${p}${e ? '&estado=' + e : ''}`),
            abierta ? pedirPlan<TareaPlan>(`/api/plan/tareas/${abierta.id}`).catch(error => {
                if (error instanceof FalloPlan && error.status === 404)
                    return undefined;
                throw error;
            }) : undefined,
        ]);
        if (n === turno.current) {
            setDatos({ ...plan, tareas: lista.tareas });
            setGrupos(gruposLeidos.grupos);
            setPagina(p);
            setEstado(e);
            setTotal(lista.total);
            setAbierta(actual => actual?.id === abierta?.id ? seleccionada : actual);
        }
    }
    const tarea = abierta && (datos.tareas.find(t => t.id === abierta.id) ?? abierta);
    const tareaVisible = tarea && (puedeSalas || !tarea.salaId) ? tarea : undefined;
    return <div className="space-y-6">
    <div className="flex flex-wrap gap-4">
      <Link className="enlace" href={`/proyectos/${proyectoId}`}>Volver a la obra</Link>
      <Link className="enlace" href={`/proyectos/agenda?proyectoId=${proyectoId}`}>Agenda de esta obra</Link>
      <Link className="enlace" href={"/proyectos/planificacion/catalogo" as never}>Catálogo de trabajos y reglas</Link>
    </div>
    <p>
      {puedeSalas ? datos.alcance : 'Sólo tareas generales de obra; salas no autorizadas'} · Obra {datos.cerrado ? 'cerrada' : 'abierta'} · Plan {datos.plan ? datos.plan.archivado ? 'archivado' : 'activo' : 'sin crear'}
    </p>
    <Aviso>Completar una tarea sólo registra planificación. No firma instalación, entrega ni cierre de obra y no mueve material.</Aviso>
    {!datos.plan ? <Tarjeta titulo="Crear plan de montaje">
      <p>La obra ya existe. Crear su plan no la inicia ni añade salas.</p>
      {puedeEditar && !datos.cerrado && <button className="boton boton-principal mt-3" disabled={op.ocupado} onClick={() => void op.ejecutar(async () => {
                    await pedirPlan(`/api/plan/proyectos/${proyectoId}`, 'POST', { clavePeticion: clavePlan });
                    await actualizar();
                }, 'Plan creado.')}>Crear plan de esta obra</button>}
    </Tarjeta> : <>
      <ListaTareas tareas={tareasVisibles} elegir={setAbierta} estado={estado} pagina={pagina} total={puedeSalas ? total : Math.min(total, inicial.totalTareas)} ocupado={op.ocupado} cambiar={(p, e) => void op.ejecutar(() => actualizar(p, e), 'Lista actualizada.')}/>
      {tareaVisible && <FichaTarea key={tareaVisible.id} tarea={tareaVisible} grupos={grupos} editar={editable} agendaCompleta={puedeSalas} alGuardar={() => actualizar()}/>}
      {editable && <Tarjeta titulo="Crear tarea manual">
        <form onSubmit={e => {
                    e.preventDefault();
                    void op.ejecutar(async () => {
                        await pedirPlan(`/api/plan/proyectos/${proyectoId}/tareas`, 'POST', { ...manual, salaId: salaId || null, trabajoId: trabajoId || null, versionPlan: datos.plan!.version, clavePeticion: claveManual });
                        await actualizar();
                        setManual(camposVacios);
                        setClaveManual(claveNueva());
                        setTrabajoId('');
                        setTrabajoCopiado(undefined);
                        setSalaId('');
                    }, 'Tarea manual creada.');
                }} className="space-y-4">
          <fieldset disabled={op.ocupado} className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <label>Buscar trabajo para copiar<input value={busquedaTrabajo} maxLength={200} onChange={e => setBusquedaTrabajo(e.target.value)} className="block mt-1"/>
              </label>
              <button type="button" className="boton" onClick={() => void op.ejecutar(async () => {
                await buscarTrabajos(1, busquedaTrabajo);
            }, 'Trabajos consultados.')}>Buscar trabajo para tarea</button>
            </div>
            <label className="block">Copiar trabajo (opcional)<select aria-label="Copiar trabajo (opcional)" value={trabajoId} onChange={e => {
                    setTrabajoId(e.target.value);
                    const t = trabajosDisponibles.find(t => t.id === e.target.value);
                    setTrabajoCopiado(t);
                    if (t)
                        setManual({ ...manual, titulo: t.titulo, descripcion: t.descripcion, duracionEstimadaMin: t.duracionEstimadaMin });
                }} className="block w-full mt-1">
                <option value="">Manual, sin catálogo</option>
                {[...new Map([...trabajosDisponibles, ...(trabajoCopiado ? [trabajoCopiado] : [])].map(t => [t.id, t])).values()].filter(t => t.activo).map(t => <option key={t.id} value={t.id}>
                  {t.titulo}
                </option>)}
              </select>
            </label>
            <nav aria-label="Páginas de búsqueda de trabajos" className="flex flex-wrap gap-3">
              <button type="button" className="boton" disabled={paginaTrabajo === 1} onClick={() => void op.ejecutar(() => buscarTrabajos(paginaTrabajo - 1, consultaTrabajo), 'Trabajos consultados.')}>Trabajos anteriores para tarea</button>
              <button type="button" className="boton" disabled={trabajosDisponibles.length < LIMITES_PLAN.busqueda} onClick={() => void op.ejecutar(() => buscarTrabajos(paginaTrabajo + 1, consultaTrabajo), 'Trabajos consultados.')}>Trabajos siguientes para tarea</button>
            </nav>
            {puedeSalas && <label className="block">Sala de la tarea<select value={salaId} onChange={e => setSalaId(e.target.value)} className="block w-full mt-1">
                <option value="">General de obra</option>
                {datos.salas.map(s => <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>)}
              </select>
            </label>}
            <CamposDeTarea valor={manual} cambiar={setManual} prefijo="Nueva tarea"/>
            <HorarioPlan valor={manual.intervalo} cambiar={intervalo => setManual({ ...manual, intervalo })}/>
            <button className="boton boton-principal">Crear tarea manual</button>
          </fieldset>
        </form>
      </Tarjeta>}
      {editable && puedeSalas && <PreparacionPlan proyectoId={proyectoId} version={datos.plan.version} salas={datos.salas} revisiones={datos.revisiones} reglas={reglas} puedeCatalogo={datos.puedeCatalogo && inicial.puedeCatalogo} alGuardar={() => actualizar()}/>}
      {editable && <GruposPlan proyectoId={proyectoId} version={datos.plan.version} grupos={grupos} alGuardar={() => actualizar()}/>}
      {puedeEditar && !datos.cerrado && <Tarjeta titulo={datos.plan.archivado ? 'Reactivar plan' : 'Archivar plan'}>
        <p>La historia y las tareas se conservan. Reactivar deja las tareas abiertas en borrador sin reservar intervalos ni técnicos antiguos.</p>
        <label className="block mt-3">Motivo de archivo o reactivación<input value={motivo} maxLength={2000} onChange={e => setMotivo(e.target.value)} className="block w-full mt-1"/>
        </label>
        <button className="boton mt-3" disabled={!motivo.trim() || op.ocupado} onClick={() => void op.ejecutar(async () => {
                    await pedirPlan(`/api/plan/proyectos/${proyectoId}`, 'PATCH', { versionPlan: datos.plan!.version, clavePeticion: claveNueva(), notas: datos.plan!.notas, archivado: !datos.plan!.archivado, motivo });
                    await actualizar();
                    if (datos.plan!.archivado)
                        setAbierta(undefined);
                })}>
          {datos.plan.archivado ? 'Reactivar plan como borrador' : 'Archivar plan'}
        </button>
      </Tarjeta>}
    </>}
    <button className="boton" disabled={op.ocupado} onClick={() => void op.ejecutar(async () => {
        await actualizar();
        router.refresh();
    }, 'Lista actualizada. Los formularios conservan su edición local.')}>Actualizar lista del plan</button>
    <EstadoOperacion estado={op}/>
  </div>;
}

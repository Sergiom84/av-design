'use client';
import { useState } from 'react';
import { Tarjeta } from '@/components/ui';
import type { Regla, SeleccionPlan, DiferenciaPlan } from '@/lib/planificacion/modelo';
import { pedirPlan, useOperacionPlan, EstadoOperacion, claveNueva } from './comun';
interface Sala {
    id: string;
    nombre: string;
}
interface Revision {
    id: string;
    sala_id: string;
    numero: number;
    nombre: string;
}
interface Preview {
    token: string;
    hash: string;
    seleccion: SeleccionPlan;
    diff: DiferenciaPlan[];
    anteriores: string[];
    leidaEn: string;
}
function detalleOrigen(valor: Record<string, unknown> | undefined) {
    const e = valor?.elemento as Record<string, unknown> | undefined;
    if (!e)
        return '';
    const a = e.articulo as Record<string, unknown> | undefined;
    return [e.nombre, a && [a.marca, a.modelo].filter(Boolean).join(' '), e.identificadorCable, e.cantidad == null ? null : `${e.cantidad} ${e.unidad ?? 'unidades'}`, e.nota, a?.activo === false ? 'Referencia retirada del catálogo actual' : null].filter(Boolean).join(' · ');
}
const nombreDiff = { nueva: 'Nueva', sin_cambios: 'Sin cambios', cambiada: 'Origen actualizado', origen_retirado: 'Origen retirado', anulada_existente: 'Ya anulada', edicion_manual: 'Tiene edición manual' };
export function PreparacionPlan({ proyectoId, version, salas, revisiones, reglas, puedeCatalogo, alGuardar }: {
    proyectoId: string;
    version: number;
    salas: Sala[];
    revisiones: Revision[];
    reglas: Regla[];
    puedeCatalogo: boolean;
    alGuardar: () => Promise<void>;
}) {
    const [elegidas, setElegidas] = useState<string[]>([]), [todas, setTodas] = useState(false), [reglasIds, setReglasIds] = useState<string[]>([]), [fuentes, setFuentes] = useState<Record<string, string>>({}), [previa, setPrevia] = useState<Preview>(), [acciones, setAcciones] = useState<Record<string, {
        accion: 'crear' | 'actualizar' | 'anular';
        campos: ('titulo' | 'descripcion' | 'duracionEstimadaMin')[];
        motivo: string;
    }>>({}), [acepto, setAcepto] = useState(false), [clavePeticion, setClavePeticion] = useState(claveNueva);
    const op = useOperacionPlan();
    const [adicionales, setAdicionales] = useState<Regla[]>([]), [pagina, setPagina] = useState(1), [hayMas, setHayMas] = useState(reglas.length === 50);
    const reglasDisponibles = [...reglas, ...adicionales].filter((r, i, lista) => lista.findIndex(otra => otra.id === r.id) === i && (puedeCatalogo || ['sala', 'tipologia'].includes(r.selector.tipo)));
    const idsPermitidos = new Set(reglasDisponibles.map(r => r.id));
    const previaVisible = previa && previa.seleccion.reglas.every(id => idsPermitidos.has(id)) ? previa : undefined;
    function invalidar() {
        setPrevia(undefined);
        setAcciones({});
        setAcepto(false);
    }
    async function preparar() {
        const ids = todas ? salas.map(s => s.id) : elegidas;
        const seleccion: SeleccionPlan = { versionPlan: version, salas: todas ? { modo: 'todas' } : { modo: 'seleccion', ids }, reglas: reglasIds.filter(id => idsPermitidos.has(id)), fuentes: ids.map(salaId => ({ salaId, tipo: fuentes[salaId] ? 'revision' : 'actual', ...(fuentes[salaId] ? { revisionId: fuentes[salaId] } : {}) })) };
        await op.ejecutar(async () => {
            const p = await pedirPlan<Preview>(`/api/plan/proyectos/${proyectoId}/preparar`, 'POST', seleccion);
            setPrevia(p);
            setClavePeticion(claveNueva());
            setAcciones({});
            setAcepto(false);
        }, 'Preparación lista. Elige las acciones que quieres confirmar.');
    }
    return <Tarjeta titulo="Proponer desde salas y reglas">
    <p>La propuesta no cambia el diseño ni registra instalación. Cada acción se elige después de revisar su origen.</p>
    <fieldset disabled={op.ocupado} className="space-y-3 mt-4"><label className="block"><input type="checkbox" checked={todas} onChange={e => {
            setTodas(e.target.checked);
            invalidar();
        }}/> Todas las salas actuales de la obra</label>
      {salas.map(s => <div key={s.id} className="flex flex-wrap gap-3 items-center"><label className="min-w-40"><input type="checkbox" checked={todas || elegidas.includes(s.id)} disabled={todas} onChange={e => {
                setElegidas(e.target.checked ? [...elegidas, s.id] : elegidas.filter(id => id !== s.id));
                invalidar();
            }}/> {s.nombre}</label><label>Fuente de {s.nombre}<select aria-label={`Fuente de ${s.nombre}`} value={fuentes[s.id] ?? ''} onChange={e => {
                setFuentes({ ...fuentes, [s.id]: e.target.value });
                invalidar();
            }} className="block mt-1"><option value="">Diseño actual persistido</option>{revisiones.filter(r => r.sala_id === s.id).map(r => <option key={r.id} value={r.id}>Revisión {r.numero}: {r.nombre}</option>)}</select></label></div>)}
      <p className="font-semibold">Reglas activas</p>{reglasDisponibles.filter(r => r.activo && r.trabajo.activo).map(r => <label className="block" key={r.id}><input type="checkbox" checked={reglasIds.includes(r.id)} onChange={e => {
                setReglasIds(e.target.checked ? [...reglasIds, r.id] : reglasIds.filter(id => id !== r.id));
                invalidar();
            }}/> {r.trabajo.titulo} · {r.selector.tipo}</label>)}
      {hayMas && <button className="boton" type="button" onClick={() => void op.ejecutar(async () => {
                const r = await pedirPlan<{
                    reglas: Regla[];
                }>(`/api/plan/reglas?pagina=${pagina + 1}`);
                setAdicionales([...adicionales, ...r.reglas]);
                setPagina(pagina + 1);
                setHayMas(r.reglas.length === 50);
            }, 'Más reglas disponibles.')}>Cargar más reglas</button>}
      <button className="boton" type="button" disabled={!reglasIds.some(id => idsPermitidos.has(id)) || !todas && !elegidas.length} onClick={() => void preparar()}>Preparar propuesta</button>
    </fieldset>
    {previa && !previaVisible && <p role="status">La propuesta requiere permisos que ya no están disponibles. Revisa las reglas autorizadas y vuelve a preparar.</p>}
    {previaVisible && <fieldset disabled={op.ocupado} className="mt-5 space-y-4 min-w-0"><h3 className="font-semibold">Diff para revisar</h3><p>Lectura: {new Date(previaVisible.leidaEn).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })} · {previaVisible.diff.length} candidatas</p>
      {!previaVisible.diff.length && <p>No hay candidatas para esta selección.</p>}
      {previaVisible.diff.map((d, i) => <div key={d.clave} className="border border-linea rounded p-3 space-y-2"><p><strong>{d.candidata?.titulo ?? d.tarea?.titulo}</strong> · {nombreDiff[d.estado]}</p><p>{String(d.candidata?.origenPublico.salaNombre ?? d.tarea?.salaNombre ?? 'Sala')} · {String(d.candidata?.origenPublico.fuente ?? 'Fuente anterior')}{d.candidata?.origenPublico.posicionEstimada ? ' · Posición estimada, sin visita acreditada' : ''}</p>
        {!['sin_cambios', 'anulada_existente'].includes(d.estado) && <label><input aria-label={`Elegir candidata ${i + 1}`} type="checkbox" checked={!!acciones[d.clave]} onChange={e => setAcciones(a => {
                        const copia = { ...a };
                        if (e.target.checked)
                            copia[d.clave] = { accion: d.estado === 'nueva' ? 'crear' : d.estado === 'origen_retirado' ? 'anular' : 'actualizar', campos: [], motivo: '' };
                        else
                            delete copia[d.clave];
                        return copia;
                    })}/> {d.estado === 'nueva' ? 'Crear borrador' : d.estado === 'origen_retirado' ? 'Proponer anulación' : 'Actualizar sólo los campos elegidos'}</label>}
        <p className="text-sm">Versión de origen {String(d.candidata?.origenPublico.disenoVersion ?? d.tarea?.origenPublico.disenoVersion ?? 'desconocida')} · Versión actual {String(d.candidata?.origenPublico.actualVersion ?? d.tarea?.origenPublico.actualVersion ?? 'desconocida')}{d.candidata?.origenPublico.revisionNumero ? ` · Revisión ${d.candidata.origenPublico.revisionNumero}: ${d.candidata.origenPublico.revisionNombre}` : ''}</p>
        {detalleOrigen(d.candidata?.origenCatalogo ?? d.tarea?.origenCatalogo) && <p>{detalleOrigen(d.candidata?.origenCatalogo ?? d.tarea?.origenCatalogo)}</p>}
        {d.campos.map(c => <div key={c.campo} className="text-sm"><p>{c.campo === 'duracionEstimadaMin' ? 'Estimación' : c.campo === 'titulo' ? 'Título' : 'Descripción'}: actual «{c.actual === null ? 'Sin estimar' : String(c.actual)}» → propuesta «{c.propuesto === null ? 'Sin estimar' : String(c.propuesto)}»{c.manual ? ' · Editado a mano; se conserva salvo elección explícita' : ''}</p>{acciones[d.clave]?.accion === 'actualizar' && <label><input type="checkbox" checked={acciones[d.clave].campos.includes(c.campo)} onChange={e => setAcciones({ ...acciones, [d.clave]: { ...acciones[d.clave], campos: e.target.checked ? [...acciones[d.clave].campos, c.campo] : acciones[d.clave].campos.filter(k => k !== c.campo) } })}/> Sustituir este campo</label>}</div>)}
        {acciones[d.clave]?.accion === 'anular' && <label className="block">Motivo de anulación<input required value={acciones[d.clave].motivo} onChange={e => setAcciones({ ...acciones, [d.clave]: { ...acciones[d.clave], motivo: e.target.value } })} className="block w-full mt-1"/></label>}
      </div>)}
      {previaVisible.anteriores.length > 0 && <label className="block"><input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)}/> Acepto las revisiones anteriores mostradas como fuente, conservando su referencia E3.</label>}
      <button className="boton boton-principal" disabled={op.ocupado || !Object.keys(acciones).length || previaVisible.anteriores.length > 0 && !acepto} onClick={() => void op.ejecutar(async () => {
                await pedirPlan(`/api/plan/proyectos/${proyectoId}/confirmar`, 'POST', { seleccion: previaVisible.seleccion, token: previaVisible.token, clavePeticion, aceptoFuenteAnterior: acepto, acciones: Object.entries(acciones).map(([clave, a]) => ({ clave, accion: a.accion, campos: a.campos, versionTarea: previaVisible.diff.find(d => d.clave === clave)?.tarea?.version ?? null, ...(a.motivo ? { motivo: a.motivo } : {}) })) });
                await alGuardar();
                setPrevia(undefined);
                setAcciones({});
            })}>Confirmar {Object.keys(acciones).length} acciones elegidas</button>
    </fieldset>}
    <EstadoOperacion estado={op}/>
  </Tarjeta>;
}

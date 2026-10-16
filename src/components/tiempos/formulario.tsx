'use client';
import { useRef, useState } from 'react';
import { Tarjeta } from '@/components/ui';
import type { TareaTiempo } from '@/lib/tiempos/modelo';
import { CampoHoraTrabajo, ErrorDeTiempo, pedirTiempo, useVigenciaTiempo, vacioTrabajo } from './comun';
export function FormularioTiempo({ proyectoId, alGuardar, relacionadoInicial }: { proyectoId?: string; alGuardar: () => Promise<void>; relacionadoInicial?: { id: string; descripcion: string } }) {
  const gestion = !!proyectoId;
  const [campos, setCampos] = useState(vacioTrabajo), [tarea, setTarea] = useState<TareaTiempo | null>(null), [tecnico, setTecnico] = useState<{ id: string; nombre: string } | null>(null), [relacionado, setRelacionado] = useState(relacionadoInicial?.id ?? '');
  const [consulta, setConsulta] = useState(''), [busquedaTecnico, setBusquedaTecnico] = useState(''), [tareas, setTareas] = useState<TareaTiempo[]>([]), [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState<Error | null>(null), [mensaje, setMensaje] = useState(''), [ocupado, setOcupado] = useState(false);
  const revision = useRef(0), clave = useRef<string | null>(null), enviando = useRef(false), vigencia = useVigenciaTiempo(), busqueda = useVigenciaTiempo(), busquedaT = useVigenciaTiempo();
  function editar(nuevo: typeof campos) { revision.current++; clave.current = null; setCampos(nuevo); }
  async function buscar(tipo: 'tareas' | 'tecnicos') {
    const guard = tipo === 'tareas' ? busqueda : busquedaT, n = guard.siguiente();
    try {
      const r = tipo === 'tareas' ? await pedirTiempo<{ tareas: TareaTiempo[] }>(`/api/tiempos/tareas?q=${encodeURIComponent(consulta)}${gestion ? '&gestion=1&proyectoId=' + proyectoId : ''}`) : await pedirTiempo<{ tecnicos: { id: string; nombre: string }[] }>(`/api/tiempos/tecnicos?q=${encodeURIComponent(busquedaTecnico)}`);
      if (guard.vigente(n)) { if ('tareas' in r) setTareas(r.tareas); else setTecnicos(r.tecnicos); setError(null); }
    } catch (e) { if (guard.vigente(n)) setError(e as Error); }
  }
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); if (enviando.current) return;
    if (!tarea || gestion && !tecnico) { setError(new Error('Selecciona la tarea y, en gestión, el técnico.')); return; }
    enviando.current = true; setOcupado(true); setError(null); setMensaje('');
    const n = vigencia.siguiente(), edicion = revision.current;
    const clavePeticion = clave.current ??= crypto.randomUUID();
    try {
      await pedirTiempo(gestion ? `/api/tiempos/proyectos/${proyectoId}` : '/api/tiempos/mios', 'POST', { tareaId: tarea.id, ...(gestion ? { tecnicoId: tecnico!.id } : {}), ...campos, ...(campos.motivo ? {} : { motivo: undefined }), ...(relacionado ? { relacionadoId: relacionado } : {}), clavePeticion });
      if (!vigencia.vigente(n)) return;
      clave.current = null;
      if (revision.current === edicion) { setCampos(vacioTrabajo()); setRelacionado(''); }
      setMensaje(revision.current === edicion ? 'Parte registrado.' : 'Parte enviado registrado. Tu edición posterior se conserva.');
      await alGuardar();
    } catch (e) { if (vigencia.vigente(n)) setError(e as Error); }
    finally { if (vigencia.vigente(n)) { enviando.current = false; setOcupado(false); } }
  }
  return <Tarjeta titulo={gestion ? 'Registrar trabajo de un técnico' : 'Registrar trabajo real'}><form onSubmit={enviar} className="space-y-4">
    <div><label>Buscar tarea<input aria-label="Buscar tarea para parte" className="block w-full mt-1" value={consulta} maxLength={120} onChange={e => { setConsulta(e.target.value); busqueda.invalidar(); setTareas([]); }} /></label><button type="button" className="boton mt-2" onClick={() => void buscar('tareas')}>Buscar tareas</button><ul className="mt-2 space-y-1">{tareas.map(t => <li key={t.id}><button type="button" className="text-acento text-left" onClick={() => { revision.current++; clave.current = null; setTarea(t); setTareas([]); }}>{t.titulo} · {t.proyecto}{t.sala ? ' · ' + t.sala : ''}{t.historica ? ' · histórico' : ''}</button></li>)}</ul><p role="status">{tarea ? `Tarea elegida: ${tarea.titulo} · ${tarea.proyecto}` : 'Ninguna tarea elegida'}</p></div>
    {gestion && <div><label>Buscar técnico<input aria-label="Buscar técnico para parte" className="block w-full mt-1" value={busquedaTecnico} maxLength={120} onChange={e => { setBusquedaTecnico(e.target.value); busquedaT.invalidar(); setTecnicos([]); }} /></label><button type="button" className="boton mt-2" onClick={() => void buscar('tecnicos')}>Buscar técnicos</button><ul>{tecnicos.map(t => <li key={t.id}><button type="button" className="text-acento" onClick={() => { revision.current++; clave.current = null; setTecnico(t); setTecnicos([]); }}>{t.nombre}</button></li>)}</ul><p role="status">{tecnico ? `Técnico elegido: ${tecnico.nombre}` : 'Ningún técnico elegido'}</p></div>}
    <CampoHoraTrabajo nombre="Inicio" valor={campos.inicio} cambiar={inicio => editar({ ...campos, inicio })} />
    <CampoHoraTrabajo nombre="Fin" valor={campos.fin} cambiar={fin => editar({ ...campos, fin })} />
    <label className="block">Notas<textarea aria-label="Notas del parte" className="block w-full mt-1" maxLength={2000} value={campos.notas} onChange={e => editar({ ...campos, notas: e.target.value })} /></label>
    <label className="block">Motivo {gestion || relacionado ? '(obligatorio)' : '(opcional)'}<textarea aria-label="Motivo del parte" className="block w-full mt-1" required={gestion || !!relacionado} maxLength={2000} value={campos.motivo} onChange={e => editar({ ...campos, motivo: e.target.value })} /></label>
    {relacionado && <p>Parte anterior anulado: {relacionadoInicial?.descripcion}. El motivo dejará constancia de la reclasificación.</p>}
    <button className="boton boton-principal" disabled={ocupado}>Registrar parte</button><ErrorDeTiempo error={error} /><p role="status" aria-live="polite">{mensaje}</p>
  </form></Tarjeta>;
}

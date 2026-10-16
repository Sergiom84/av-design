'use client';
import { useRef, useState } from 'react';
import { Aviso, Boton, CampoCasilla, Enlace, Estado, Tarjeta } from '@/components/ui';
import { EditorArea, EditorMaterial, FuenteCandidato } from './candidato';
import { EditorAvanzado } from './avanzado';
import { Informe } from './informe';
import { DESTINOS, decisionesIniciales, idsElegidos, type Candidato, type Decisiones, type Extraccion, type ObraRequisitos, type Plan, type Preview } from './tipos';

type Peticion = <T>(url: string, cuerpo?: object, metodo?: string) => Promise<T>;
export function EditorPlan({ plan, extraccion, obra, pedir, actualizar, ocupadoExterior, alErrorAcceso }: { plan: Plan; extraccion: Extraccion; obra: ObraRequisitos; pedir: Peticion; actualizar: () => Promise<void>; ocupadoExterior: boolean; alErrorAcceso?: () => void }) {
  const inicial: Decisiones | null = plan.decisiones && 'datos' in plan.decisiones && !('versionModelo' in plan.decisiones) ? plan.decisiones.datos : plan.decisiones && 'destino' in plan.decisiones && !('pendiente' in plan.decisiones) ? plan.decisiones as Decisiones : decisionesIniciales(plan.destino);
  const [decisiones, setDecisiones] = useState<Decisiones | null>(inicial);
  const [version, setVersion] = useState(plan.version);
  const [editor, setEditor] = useState<{ id: string; tipo: 'area' | 'material' | 'otro' } | null>(null);
  const [editoresAvanzados, setEditoresAvanzados] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [sucio, setSucio] = useState(false);
  const [caducidad, setCaducidad] = useState(0);
  const [finalRevisado, setFinalRevisado] = useState(false);
  const [candidatosGuardados, setCandidatosGuardados] = useState<string[]>(plan.decisiones && 'revisadoPor' in plan.decisiones ? idsElegidos(inicial) : []);
  const [fragmentosConsulta, setFragmentosConsulta] = useState<string[]>([]);
  const peticionConfirmar = useRef<{ token: string; clave: string } | null>(null);
  const borrador = useRef(0);
  const candidatos = extraccion.resultado.candidatos;
  const elegidos = idsElegidos(decisiones);
  const excluidos = decisiones && 'excluidos' in decisiones ? decisiones.excluidos : [];
  const congelado = plan.estado !== 'borrador' && plan.estado !== 'pendiente' && plan.estado !== 'revisado';
  function cambiar(d: Decisiones | null) { borrador.current++; setDecisiones(d && 'excluidos' in d ? { ...d, excluidos: d.excluidos.filter(id => !idsElegidos(d).includes(id)) } : d); setSucio(true); setPreview(null); setFinalRevisado(false); setFragmentosConsulta([]); peticionConfirmar.current = null; setMensaje('Borrador modificado. Revisa el preview antes de confirmar.'); }
  function quitar(id: string) {
    if (!decisiones) return;
    if (decisiones.destino === 'areas_bom') cambiar({ ...decisiones, areas: decisiones.areas.filter(a => a.candidatoId !== id), material: decisiones.material.filter(m => m.candidatoId !== id && m.areaCandidatoId !== id) });
    else if (decisiones.destino === 'catalogo' || decisiones.destino === 'ofertas') cambiar({ ...decisiones, filas: decisiones.filas.filter(f => f.candidatoId !== id) });
    else cambiar(null);
  }
  function incluir(d: Decisiones) {
    if ((d.destino === 'catalogo' || d.destino === 'ofertas') && decisiones?.destino === d.destino && 'filas' in decisiones) cambiar({ ...d, filas: [...decisiones.filas.filter(f => f.candidatoId !== d.filas[0].candidatoId), ...d.filas] });
    else cambiar(d);
    setEditor(null);
  }
  function excluir(id: string) {
    if (!decisiones || !('excluidos' in decisiones)) return;
    if (decisiones.destino === 'areas_bom') cambiar({ ...decisiones, areas: decisiones.areas.filter(a => a.candidatoId !== id), material: decisiones.material.filter(m => m.candidatoId !== id && m.areaCandidatoId !== id), excluidos: [...excluidos.filter(v => v !== id), id] });
    else cambiar({ ...decisiones, filas: decisiones.filas.filter(f => f.candidatoId !== id), excluidos: [...excluidos.filter(v => v !== id), id] });
    setEditor(null);
  }
  async function revisar() {
    if (!decisiones) return; const numero = borrador.current; setOcupado(true); setPreview(null); setFinalRevisado(false); setMensaje('');
    try {
      const guardado = await pedir<{ version: number }>(`/api/requisitos/planes/${plan.id}`, { version, decisiones }, 'PATCH');
      if (numero !== borrador.current) return;
      setVersion(guardado.version); setSucio(false); setCandidatosGuardados(idsElegidos(decisiones)); setFragmentosConsulta([]);
      if (!idsElegidos(decisiones).length) { setMensaje('Exclusiones guardadas. No hay candidatos elegidos para aplicar.'); return; }
      const p = await pedir<Preview>(`/api/requisitos/planes/${plan.id}/preview`, {});
      if (numero !== borrador.current) return;
      setPreview(p); setCaducidad(Date.now() + 10 * 60_000); setMensaje('Preview preparado. Revisa el resultado antes de confirmar.');
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setMensaje(e instanceof Error ? e.message : 'No se ha podido revisar. El borrador se conserva.'); }
    finally { setOcupado(false); }
  }
  async function confirmar() {
    if (!preview || sucio || !finalRevisado || Date.now() >= caducidad) { setPreview(null); setFinalRevisado(false); setMensaje('Revisa un preview vigente antes de confirmar.'); return; }
    const numero = borrador.current; setOcupado(true); setMensaje('');
    peticionConfirmar.current ??= { token: preview.token, clave: crypto.randomUUID() };
    try {
      const r = await pedir<{ id: string }>(`/api/requisitos/planes/${plan.id}/confirmar`, { version: preview.version, token: preview.token, clavePeticion: peticionConfirmar.current.clave });
      if (numero !== borrador.current) return;
      setPreview(null); setMensaje(`Aplicación registrada: ${r.id}`); await actualizar();
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) { setMensaje(e instanceof Error ? e.message : 'No se ha podido confirmar. El borrador se conserva.'); if (e instanceof Error && 'status' in e && e.status === 409) { setPreview(null); setFinalRevisado(false); peticionConfirmar.current = null; } } }
    finally { setOcupado(false); }
  }
  function abrir(c: Candidato, tipo: 'area' | 'material' | 'otro') { setPreview(null); setFragmentosConsulta([]); if (tipo === 'otro') setEditoresAvanzados(v => v.includes(c.id) ? v : [...v, c.id]); setEditor({ id: c.id, tipo }); }
  return <Tarjeta titulo={`Plan · ${DESTINOS[plan.destino]}`} pie={<span className="dato text-xs">Plan {plan.id} · versión {version} · {elegidos.length} candidatos elegidos</span>}>
    <div className="flex flex-wrap gap-3 mb-4"><Estado tono={congelado ? 'neutro' : 'informacion'}>{plan.estado}</Estado>{sucio && <Estado tono="aviso">Borrador local sin guardar</Estado>}</div>
    {plan.destino === 'areas_bom' && <Aviso>El material se añade a la BOM. Revisa primero lo que ya aporta el diseño de cada sala.</Aviso>}
    <fieldset disabled={ocupado || ocupadoExterior || congelado} className="mt-4 space-y-4">
      {candidatos.length === 0 && <p className="text-tinta-tenue">Esta extracción no contiene candidatos. Puedes incorporar una transcripción manual.</p>}
      {candidatos.map(c => {
        const esEditor = editor?.id === c.id;
        return <section key={c.id} className="border border-linea-suave rounded-md p-4 space-y-3">
          <FuenteCandidato candidato={c} />
          <div className="flex flex-wrap items-center gap-3"><Estado tono={elegidos.includes(c.id) ? 'listo' : 'neutro'}>{elegidos.includes(c.id) ? 'Elegido y revisado' : excluidos.includes(c.id) ? 'Excluido de este plan' : 'Pendiente, sin seleccionar'}</Estado>
            {plan.destino === 'areas_bom' ? <><Boton tipo="button" variante="secundario" onClick={() => abrir(c, 'area')}>Revisar como área</Boton><Boton tipo="button" variante="secundario" onClick={() => abrir(c, 'material')}>Revisar como material</Boton></> : <Boton tipo="button" variante="secundario" onClick={() => abrir(c, 'otro')}>Revisar decisión</Boton>}
            {elegidos.includes(c.id) && <Boton tipo="button" variante="secundario" onClick={() => quitar(c.id)}>Quitar de la selección</Boton>}
            {decisiones && 'excluidos' in decisiones && (excluidos.includes(c.id) ? <Boton tipo="button" variante="secundario" onClick={() => cambiar({ ...decisiones, excluidos: excluidos.filter(id => id !== c.id) })}>Quitar exclusión y dejar pendiente</Boton> : <Boton tipo="button" variante="secundario" onClick={() => excluir(c.id)}>Excluir del plan</Boton>)}
          </div>
          {esEditor && editor.tipo === 'area' && decisiones?.destino === 'areas_bom' && <EditorArea key={`${c.id}:area`} candidato={c} obra={obra} inicial={decisiones.areas.find(a => a.candidatoId === c.id)} cancelar={() => setEditor(null)} incluir={a => { cambiar({ ...decisiones, areas: [...decisiones.areas.filter(v => v.candidatoId !== c.id), a], material: decisiones.material.filter(v => v.candidatoId !== c.id) }); setEditor(null); }} />}
          {esEditor && editor.tipo === 'material' && decisiones?.destino === 'areas_bom' && <EditorMaterial key={`${c.id}:material`} candidato={c} obra={obra} areas={decisiones.areas} inicial={decisiones.material.find(m => m.candidatoId === c.id)} cancelar={() => setEditor(null)} leerArticulo={id => pedir(`/api/requisitos/base-tecnica?articuloId=${id}&destino=articulo`)} alErrorAcceso={alErrorAcceso} incluir={m => { cambiar({ ...decisiones, areas: decisiones.areas.filter(v => v.candidatoId !== c.id), material: [...decisiones.material.filter(v => v.candidatoId !== c.id), m] }); setEditor(null); }} />}
          {editoresAvanzados.includes(c.id) && plan.destino !== 'areas_bom' && <div hidden={!esEditor || editor.tipo !== 'otro'}><EditorAvanzado key={`${c.id}:${plan.destino}`} candidato={c} destino={plan.destino} inicial={decisiones} incluir={incluir} cancelar={() => setEditor(null)} leerBase={(id, destino) => pedir(`/api/requisitos/base-tecnica?articuloId=${id}&destino=${destino}`)} alErrorAcceso={alErrorAcceso} /></div>}
        </section>;
      })}
      {!congelado && <div className="flex flex-wrap gap-3"><Boton tipo="button" disabled={!elegidos.length || Boolean(editor)} onClick={() => void revisar()}>Guardar revisión y preparar preview</Boton>
        {!elegidos.length && excluidos.length > 0 && <Boton tipo="button" onClick={() => void revisar()}>Guardar exclusiones</Boton>}
        <Boton tipo="button" variante="secundario" disabled={!elegidos.length && !excluidos.length} onClick={() => { cambiar(decisionesIniciales(plan.destino)); setEditor(null); }}>Vaciar selección</Boton></div>}
      {!congelado && <Boton tipo="button" variante="secundario" onClick={async () => { setOcupado(true); try { const p = await pedir<{ version: number; estado: string }>(`/api/requisitos/planes/${plan.id}`); if (p.estado !== 'borrador') { await actualizar(); return; } setVersion(p.version); setPreview(null); setFinalRevisado(false); setFragmentosConsulta([]); setCandidatosGuardados([]); setMensaje('Versión actualizada. El borrador local se conserva; vuelve a guardar y revisar sus diferencias.'); } catch (e) { if (e instanceof Error && e.name !== 'AbortError') setMensaje(e.message); } finally { setOcupado(false); } }}>Actualizar versión conservando el borrador</Boton>}
    </fieldset>
    {mensaje && <p role="status" className="mt-4">{mensaje}</p>}
    {!sucio && !editor && candidatosGuardados.length > 0 && <section className="mt-5 border-t border-linea pt-4 space-y-3"><h3 className="t-subtitulo">Fragmentos para consultar</h3><p className="text-tinta-tenue">Elige entre 1 y 20 fragmentos de la revisión guardada.</p>
      <fieldset disabled={ocupado || ocupadoExterior} className="space-y-2">{candidatos.filter(c => candidatosGuardados.includes(c.id)).map(c => <div key={c.id}><CampoCasilla type="checkbox" data-candidato-consulta={c.id} checked={fragmentosConsulta.includes(c.id)} disabled={!fragmentosConsulta.includes(c.id) && fragmentosConsulta.length >= 20} onChange={e => setFragmentosConsulta(v => e.target.checked ? [...v, c.id] : v.filter(id => id !== c.id))}>{c.ancla.pagina === null ? `Línea ${c.ancla.linea}` : `Página ${c.ancla.pagina}`} · {c.fragmento}</CampoCasilla></div>)}</fieldset>
      <p className="dato text-xs">{fragmentosConsulta.length} de 20 fragmentos elegidos</p>
      {fragmentosConsulta.length > 0 && <Enlace href={`/cuenta/consultas?${new URLSearchParams({ tipo: 'obra', id: obra.id, requisito: candidatos[0].ancla.documentoId, extraccion: extraccion.id, candidatos: fragmentosConsulta.join(',') })}`}>Consultar fragmentos elegidos</Enlace>}
    </section>}
    {preview && <section className="mt-5 border-t border-linea pt-4 space-y-4"><h3 className="t-subtitulo">Preview antes de aplicar</h3><Informe datos={preview.diff} />
      <p className="dato text-xs [overflow-wrap:anywhere]">Huella {preview.huella} · versión {preview.version}</p>
      {(decisiones?.destino === 'tecnico' || decisiones?.destino === 'puerto') && <p><Enlace href={`/articulo/${decisiones.articuloId}?requisitoPlan=${plan.id}`}>Abrir formulario de catálogo con procedencia</Enlace></p>}
      <CampoCasilla type="checkbox" checked={finalRevisado} disabled={ocupado} onChange={e => setFinalRevisado(e.target.checked)}>He revisado altas, vínculos, omisiones y material adicional</CampoCasilla>
      <Boton tipo="button" disabled={ocupado || ocupadoExterior || sucio || congelado || !finalRevisado} onClick={() => void confirmar()}>Confirmar aplicación de este plan</Boton>
    </section>}
  </Tarjeta>;
}

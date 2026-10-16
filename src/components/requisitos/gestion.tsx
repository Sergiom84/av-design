'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Aviso, Boton, Cabecera, Campo, Enlace, Estado, Tarjeta } from '@/components/ui';
import { RegistrarFuente } from './fuente';
import { EditorPlan } from './plan';
import { Informe } from './informe';
import { DESTINOS, type Aplicacion, type Destino, type Detalle, type Documento, type ObraRequisitos } from './tipos';

class ErrorApi extends Error { constructor(mensaje: string, public status: number) { super(mensaje); } }
function cancelada() { return new DOMException('La selección ha cambiado.', 'AbortError'); }
export function RequisitosObra(props: { identidad: string; obra: ObraRequisitos; puedeEditar: boolean; destinos: Destino[]; documentoInicial?: string }) {
  return <GestionRequisitos key={`${props.identidad}:${props.obra.id}:${props.documentoInicial ?? ''}`} {...props} />;
}
function GestionRequisitos({ obra, puedeEditar, destinos, documentoInicial }: { identidad: string; obra: ObraRequisitos; puedeEditar: boolean; destinos: Destino[]; documentoInicial?: string }) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [extraccionId, setExtraccionId] = useState('');
  const [planId, setPlanId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [denegado, setDenegado] = useState(false);
  const [revisionPrivada, setRevisionPrivada] = useState(0);
  const solicitudes = useRef(new Set<AbortController>());
  const secuencia = useRef(0);
  const numeroPeticion = useRef(0);
  const ultimasPeticiones = useRef(new Map<string, number>());
  const seleccionActual = useRef<string | null>(null);
  const activa = useRef(true);
  const bloquear = useCallback(() => {
    secuencia.current++; for (const c of solicitudes.current) c.abort(); solicitudes.current.clear();
    setDenegado(true); setDocumentos([]); setDetalle(null); setSeleccion(null); seleccionActual.current = null;
    setExtraccionId(''); setPlanId(''); setRevisionPrivada(v => v + 1); setOcupado(false);
    setMensaje('El acceso ha cambiado. Se ha retirado el contenido de esta pantalla.');
  }, []);
  const pedir = useCallback(async <T,>(url: string, cuerpo?: object | FormData, metodo?: string): Promise<T> => {
    const turno = secuencia.current, c = new AbortController(), numero = ++numeroPeticion.current, llave = `${metodo ?? (cuerpo ? 'POST' : 'GET')}:${url}`;
    ultimasPeticiones.current.set(llave, numero); solicitudes.current.add(c);
    try {
      const r = await fetch(url, { method: metodo ?? (cuerpo ? 'POST' : 'GET'), cache: 'no-store', credentials: 'same-origin', signal: c.signal,
        ...(cuerpo instanceof FormData ? { body: cuerpo } : cuerpo ? { body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } } : {}) });
      if (!activa.current || turno !== secuencia.current || c.signal.aborted || ultimasPeticiones.current.get(llave) !== numero) throw cancelada();
      if (r.status === 401 || r.status === 403) { bloquear(); throw cancelada(); }
      const datos = await r.json().catch(() => null) as (T & { error?: string; codigo?: string }) | null;
      if (!activa.current || turno !== secuencia.current || c.signal.aborted || ultimasPeticiones.current.get(llave) !== numero) throw cancelada();
      if (r.status === 404 || datos?.codigo === 'FUENTE_RETIRADA' || datos?.codigo === 'FUENTE_CAMBIADA') { bloquear(); throw cancelada(); }
      if (!r.ok) throw new ErrorApi(datos?.error ?? 'La operación no está disponible. Conserva la revisión y vuelve a intentarlo.', r.status);
      if (datos === null) throw new ErrorApi('La respuesta no está disponible. El borrador se conserva.', 503);
      return datos;
    } finally { solicitudes.current.delete(c); }
  }, [bloquear]);
  const listar = useCallback(async () => {
    const r = await pedir<{ documentos: Documento[] }>(`/api/requisitos?proyectoId=${obra.id}`); setDocumentos(r.documentos);
  }, [obra.id, pedir]);
  useEffect(() => {
    activa.current = true; const controladores = solicitudes.current;
    void Promise.resolve().then(async () => {
      await listar();
      if (!documentoInicial || !activa.current) return;
      seleccionActual.current = documentoInicial; setSeleccion(documentoInicial);
      const d = await pedir<Detalle>(`/api/requisitos/${documentoInicial}`);
      if (seleccionActual.current !== documentoInicial) return;
      setDetalle(d); setExtraccionId(d.extracciones.at(-1)?.id ?? '');
    }).catch(e => { if (e.name !== 'AbortError') setMensaje(e.message); });
    return () => { activa.current = false; for (const c of controladores) c.abort(); controladores.clear(); };
  }, [listar, pedir, documentoInicial]);
  useEffect(() => {
    const revalidar = () => {
      if (document.visibilityState === 'hidden' || denegado) return;
      const id = seleccionActual.current;
      if (!id) { void listar().catch(() => {}); return; }
      void pedir<Detalle>(`/api/requisitos/${id}`).then(d => {
        if (seleccionActual.current !== id) return;
        if (d.documento.estado !== 'activo') { setExtraccionId(''); setPlanId(''); setRevisionPrivada(v => v + 1); }
        setDetalle(d);
      }).catch(e => { if (e instanceof Error && e.name !== 'AbortError') setMensaje('No se ha podido actualizar la fuente. El borrador local se conserva.'); });
    };
    window.addEventListener('focus', revalidar); document.addEventListener('visibilitychange', revalidar);
    return () => { window.removeEventListener('focus', revalidar); document.removeEventListener('visibilitychange', revalidar); };
  }, [denegado, listar, pedir]);
  async function operar(accion: () => Promise<void>) {
    const turno = secuencia.current; setOcupado(true); setMensaje('');
    try { await accion(); } catch (e) { if (activa.current && turno === secuencia.current && e instanceof Error && e.name !== 'AbortError') setMensaje(e.message); }
    finally { if (activa.current && turno === secuencia.current) setOcupado(false); }
  }
  async function abrir(id: string) {
    secuencia.current++; for (const c of solicitudes.current) c.abort(); solicitudes.current.clear();
    seleccionActual.current = id; setSeleccion(id); setDetalle(null); setExtraccionId(''); setPlanId(''); setRevisionPrivada(v => v + 1);
    await operar(async () => { const d = await pedir<Detalle>(`/api/requisitos/${id}`); if (seleccionActual.current !== id) return; setDetalle(d); setExtraccionId(d.extracciones.at(-1)?.id ?? ''); });
  }
  async function refrescar() {
    const id = seleccionActual.current; if (!id) return; const d = await pedir<Detalle>(`/api/requisitos/${id}`); if (seleccionActual.current === id) setDetalle(d);
  }
  const extraccion = detalle?.extracciones.find(e => e.id === extraccionId);
  const plan = detalle?.planes.find(p => p.id === planId);
  const esActivo = detalle?.documento.estado === 'activo';
  const alta = async (cuerpo: FormData | object) => {
    let correcto = false;
    await operar(async () => { const r = await pedir<{ id: string }>('/api/requisitos', cuerpo); await listar(); correcto = true; await abrir(r.id); }); return correcto;
  };
  return <div className="space-y-6">
    <Cabecera titulo="Documentos y requisitos" descripcion={denegado ? undefined : obra.nombre} acciones={<Enlace href={`/proyectos/${obra.id}`}>Volver a la obra</Enlace>} />
    {mensaje && <div role={denegado ? 'alert' : 'status'}><Aviso tono={denegado ? 'alerta' : 'aviso'}>{mensaje}</Aviso></div>}
    {denegado ? <Enlace href={`/proyectos/${obra.id}/requisitos`}>Volver a comprobar el acceso</Enlace> : <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Tarjeta titulo="Fuentes de esta obra" acciones={<Boton tipo="button" variante="secundario" disabled={ocupado} onClick={() => void operar(listar)}>Actualizar listado</Boton>}>
          {!documentos.length ? <p className="text-tinta-tenue">Todavía no has registrado documentos en esta obra.</p> : <ul className="divide-y divide-linea-suave">{documentos.map(d => <li key={d.id} className="py-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center"><strong>{d.metadatos?.nombre ?? `Fuente ${d.estado}`}</strong><Estado tono={d.estado === 'activo' ? 'informacion' : 'neutro'}>{d.estado}</Estado></div>
            <p className="dato text-xs [overflow-wrap:anywhere]">{d.id} · SHA-256 {d.sha256}</p>
            <Boton tipo="button" variante="secundario" aria-pressed={seleccion === d.id} onClick={() => void abrir(d.id)}>{seleccion === d.id ? 'Fuente seleccionada' : 'Abrir fuente'}</Boton>
          </li>)}</ul>}
        </Tarjeta>
        {puedeEditar ? <RegistrarFuente key={revisionPrivada} proyectoId={obra.id} ocupado={ocupado} registrar={alta} /> : <Tarjeta titulo="Consulta de fuentes"><p className="text-tinta-tenue">Tu acceso permite consultar documentos. Registrar o revisar fuentes requiere editar proyectos.</p></Tarjeta>}
      </div>
      {seleccion && !detalle && <p role="status">Cargando fuente autorizada…</p>}
      {detalle && <>
        <Tarjeta titulo={detalle.metadatos?.nombre ?? `Fuente ${detalle.documento.estado}`} acciones={esActivo && <Boton tipo="button" variante="secundario" disabled={ocupado} onClick={() => void operar(async () => {
          const turno = secuencia.current, c = new AbortController(); solicitudes.current.add(c);
          try { const r = await fetch(`/api/requisitos/${detalle.documento.id}/archivo`, { signal: c.signal, cache: 'no-store', credentials: 'same-origin' });
            if (turno !== secuencia.current || !activa.current) throw cancelada(); if (r.status === 401 || r.status === 403) { bloquear(); throw cancelada(); }
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? 'No se puede descargar la fuente.'); }
            const blob = await r.blob(); if (turno !== secuencia.current || !activa.current) throw cancelada(); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = detalle.metadatos?.nombre ?? 'fuente'; a.click(); URL.revokeObjectURL(url);
          } finally { solicitudes.current.delete(c); }
        })}>Descargar original</Boton>}>
          <dl className="space-y-2"><div><dt className="t-etiqueta">Identificador y hash original</dt><dd className="dato text-xs [overflow-wrap:anywhere]">{detalle.documento.id} · {detalle.documento.sha256}</dd></div>
            {detalle.metadatos && <><div><dt className="t-etiqueta">Procedencia</dt><dd>{detalle.metadatos.procedencia}</dd></div><div><dt className="t-etiqueta">Fecha de la fuente</dt><dd>{detalle.metadatos.fechaFuente ?? 'Desconocida'}</dd></div><div><dt className="t-etiqueta">Incorporación</dt><dd>{new Date(detalle.documento.creadoEn).toLocaleString('es')}</dd></div></>}</dl>
          {!esActivo && <p className="mt-3 text-tinta-tenue">Fuente no disponible. Se conservan los identificadores y los resultados de negocio registrados.</p>}
        </Tarjeta>
        {esActivo && <>
          {puedeEditar && <Tarjeta titulo="Extraer y revisar texto" acciones={<Boton tipo="button" disabled={ocupado} onClick={() => void operar(async () => { const r = await pedir<{ id: string }>(`/api/requisitos/${detalle.documento.id}/extracciones`, { modo: 'local' }); await refrescar(); setExtraccionId(r.id); setPlanId(''); })}>Extraer texto local</Boton>} pie="El texto del documento es contenido para revisar. La extracción no crea salas ni material.">
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void operar(async () => { const r = await pedir<{ id: string }>(`/api/requisitos/${detalle.documento.id}/extracciones`, { modo: 'manual', texto: String(f.get('texto')), pagina: f.get('pagina') ? Number(f.get('pagina')) : null, motivo: String(f.get('motivo')) }); await refrescar(); setExtraccionId(r.id); setPlanId(''); }); }}>
              <fieldset disabled={ocupado} className="space-y-3"><Campo etiqueta="Transcripción manual"><textarea name="texto" maxLength={20000} required rows={5} placeholder="Sala: …" className="w-full" /></Campo>
                <div className="grid gap-3 sm:grid-cols-2"><Campo etiqueta="Página verificada (vacío para TXT)"><input name="pagina" type="number" min="1" max="100" step="1" className="w-full dato" /></Campo><Campo etiqueta="Motivo y procedencia de la transcripción"><input name="motivo" required maxLength={500} className="w-full" /></Campo></div>
                <p className="text-tinta-tenue">Transcripción manual, sin cotejo automático. OCR no configurado.</p><Boton variante="secundario" disabled={ocupado}>Guardar transcripción manual</Boton></fieldset>
            </form>
          </Tarjeta>}
          {!!detalle.extracciones.length && <Tarjeta titulo="Extracciones y planes">
            <Campo etiqueta="Extracción"><select value={extraccionId} className="w-full" onChange={e => { setExtraccionId(e.target.value); setPlanId(''); }}><option value="">Elegir extracción</option>{detalle.extracciones.map(e => <option key={e.id} value={e.id}>{e.resultado.estado.replaceAll('_', ' ')} · {e.parser} {e.parser_version} · {e.id}</option>)}</select></Campo>
            {extraccion && <div className="space-y-3 mt-4"><p><Estado tono={extraccion.resultado.estado === 'sin_texto' || extraccion.resultado.estado === 'mixto' ? 'aviso' : 'informacion'}>{extraccion.resultado.estado.replaceAll('_', ' ')}</Estado> · {extraccion.resultado.candidatos.length} candidatos</p>
              {extraccion.resultado.avisos.map((a, i) => <p key={i}>{a}</p>)}
              {extraccion.resultado.estado === 'sin_texto' && <Aviso>No se encontró texto extraíble. Puedes transcribir una página verificada. No se ha realizado OCR.</Aviso>}
              <details><summary className="enlace cursor-pointer">Consultar texto conservado</summary><div className="space-y-4 mt-3">{extraccion.resultado.paginas.map((p, i) => <section key={i}><h3 className="font-medium">{p.numero === null ? 'Texto UTF-8 · anclas por línea' : `Página ${p.numero}`}</h3><pre className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{p.texto || 'Sin texto extraíble'}</pre></section>)}</div></details>
              {puedeEditar && destinos.length > 0 && <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); const destino = new FormData(e.currentTarget).get('destino') as Destino; void operar(async () => { const p = await pedir<{ id: string }>('/api/requisitos/planes', { extraccionId, destino }); await refrescar(); setPlanId(p.id); }); }}>
                <Campo etiqueta="Destino del nuevo plan"><select name="destino" disabled={ocupado}>{destinos.map(d => <option key={d} value={d}>{DESTINOS[d]}</option>)}</select></Campo><Boton disabled={ocupado || !extraccion.resultado.candidatos.length}>Crear plan con selección vacía</Boton>
              </form>}
            </div>}
            <ul className="mt-4 divide-y divide-linea-suave">{detalle.planes.filter(p => p.extraccion_id === extraccionId).map(p => <li key={p.id} className="flex flex-wrap gap-3 items-center py-3"><span>{DESTINOS[p.destino]} · {p.estado} · versión {p.version}</span><Boton tipo="button" variante="secundario" disabled={ocupado} onClick={() => setPlanId(p.id)}>Abrir plan</Boton></li>)}</ul>
          </Tarjeta>}
          {plan && extraccion && <EditorPlan key={`${detalle.documento.id}:${plan.id}`} plan={plan} extraccion={extraccion} obra={obra} pedir={pedir} actualizar={refrescar} ocupadoExterior={ocupado || !puedeEditar} alErrorAcceso={bloquear} />}
        </>}
        {!!detalle.aplicaciones.length && <Tarjeta titulo="Aplicaciones registradas"><div className="space-y-5">{detalle.aplicaciones.map(a => <ResultadoAplicacion key={a.id} aplicacion={a} ocupado={ocupado} puedeEditar={puedeEditar} revertir={async (motivo, antecedenteId, clavePeticion) => { let resultado: unknown = null; await operar(async () => { resultado = await pedir(`/api/requisitos/aplicaciones/${a.id}/revertir`, { motivo, antecedenteId, clavePeticion }); await refrescar(); }); return resultado; }} />)}</div></Tarjeta>}
        {puedeEditar && detalle.documento.estado !== 'purgado' && <Tarjeta titulo="Retirar o purgar fuente" variante="peligrosa"><form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget), accion = String(f.get('accion')); void operar(async () => {
          await pedir(`/api/requisitos/${detalle.documento.id}`, { version: detalle.documento.version, accion, motivo: String(f.get('motivo')), confirmarHash: String(f.get('confirmarHash')) }, 'PATCH');
          setDetalle(null); setExtraccionId(''); setPlanId(''); setRevisionPrivada(v => v + 1); await listar(); await refrescar(); setMensaje(`Fuente ${accion === 'purgar' ? 'purgada' : 'retirada'}.`);
        }); }}><fieldset disabled={ocupado} className="space-y-3">
          <Campo etiqueta="Operación"><select name="accion" className="w-full">{esActivo && <option value="retirar">Retirar acceso a la fuente</option>}<option value="purgar">Purgar contenido y borradores copiados</option></select></Campo>
          <Aviso>Retirar impide consultar y aplicar esta fuente. Purgar elimina además archivo, metadatos, texto y borradores copiados. Se conservan los hashes y los hechos de negocio confirmados. En una referencia E2, el origen E2 se conserva.</Aviso>
          <p className="dato text-xs">Contenido afectado: {detalle.metadatos?.tamano.toLocaleString('es') ?? 'sin acceso a'} bytes de origen · {detalle.extracciones.length} extracciones · {detalle.planes.length} planes. Se conservan {detalle.aplicaciones.length} aplicaciones registradas.</p>
          <Campo etiqueta="Motivo"><input name="motivo" required maxLength={500} className="w-full" /></Campo><Campo etiqueta="Confirmar SHA-256 completo"><input name="confirmarHash" required pattern={detalle.documento.sha256} className="w-full dato" /></Campo>
          <Boton variante="peligro" disabled={ocupado}>Confirmar retirada o purga</Boton></fieldset></form></Tarjeta>}
      </>}
    </>}
  </div>;
}
function ResultadoAplicacion({ aplicacion, ocupado, puedeEditar, revertir }: { aplicacion: Aplicacion; ocupado: boolean; puedeEditar: boolean; revertir: (motivo: string, antecedenteId: string | null, clave: string) => Promise<unknown> }) {
  const clave = useRef<string | null>(null);
  const [resultado, setResultado] = useState<unknown>(null);
  async function enviar(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); clave.current ??= crypto.randomUUID(); const r = await revertir(String(f.get('motivo')), String(f.get('antecedenteId') ?? '').trim() || null, clave.current); if (r) { clave.current = null; setResultado(r); } }
  return <section className="border-l-2 border-linea pl-4 space-y-3"><p className="dato text-xs [overflow-wrap:anywhere]">Aplicación {aplicacion.id} · plan {aplicacion.plan_id}</p><Informe datos={aplicacion.resultado} />
    {puedeEditar && <details><summary className="enlace cursor-pointer">Revisar reversión de esta aplicación</summary><form className="mt-3 space-y-3" onSubmit={e => void enviar(e)}><fieldset disabled={ocupado} className="space-y-3"><p>La reversión conserva las modificaciones y dependencias posteriores. Puede ser parcial. Una edición técnica o de puerto requiere revisión manual de su ficha.</p><Campo etiqueta="Motivo de la reversión"><input name="motivo" required maxLength={500} className="w-full" onChange={() => { clave.current = null; }} /></Campo><Campo etiqueta="ID del intento anterior (sólo para continuar una reversión parcial)"><input name="antecedenteId" className="w-full dato" onChange={() => { clave.current = null; }} /></Campo><Boton variante="peligro" disabled={ocupado}>Revertir aplicación</Boton></fieldset></form></details>}
    {resultado !== null && <div role="status"><p className="font-medium">Intento de reversión registrado</p><Informe datos={resultado} /></div>}
  </section>;
}

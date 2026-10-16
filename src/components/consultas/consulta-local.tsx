'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AmbitoConsulta, RespuestaConsulta, EntradaPregunta } from '@/lib/consultas/modelo';
import { EJEMPLOS_CONSULTA } from '@/lib/consultas/intenciones';
import { DictadoLocal } from './dictado-local';
interface Cabecera {
    id: string;
    version: number;
    ambito: AmbitoConsulta;
    retencion_dias: 7 | 30 | 90;
    creado_en: string;
    caduca_en: string;
}
interface Turno {
    id: string;
    numero: number;
    intent: string;
    observado_en: string;
}
interface Resultado {
    id: string;
    numero: number;
    pregunta?: string;
    respuesta?: RespuestaConsulta;
    historica?: boolean;
    bloqueado?: boolean;
    mensaje?: string;
    version?: number;
}
interface Opcion {
    id: string;
    nombre: string;
    codigo: string | null;
}
const fecha = (v: string) => new Date(v).toLocaleString('es-ES');
export function ConsultaLocal({ identidad, permisos, inicial, fuenteInicial }: {
    identidad: string;
    permisos: {
        sala: boolean;
        obra: boolean;
        catalogo: boolean;
    };
    inicial?: AmbitoConsulta;
    fuenteInicial?: Extract<NonNullable<EntradaPregunta['fuente']>, { tipo: 'documento_requisitos' }>;
}) {
    const router = useRouter();
    const [tipo, setTipo] = useState<AmbitoConsulta['tipo']>(inicial?.tipo ?? (permisos.sala ? 'sala' : permisos.obra ? 'obra' : 'catalogo'));
    const [entidad, setEntidad] = useState(inicial && inicial.tipo !== 'catalogo' ? inicial.id : '');
    const [salas, setSalas] = useState<string[]>(inicial?.tipo === 'obra' ? inicial.salaIds : []);
    const [opciones, setOpciones] = useState<Opcion[]>([]), [opcionesSalas, setOpcionesSalas] = useState<Opcion[]>([]), [q, setQ] = useState(''), [pagina, setPagina] = useState(0), [mas, setMas] = useState<number | null>(null);
    const [conversaciones, setConversaciones] = useState<Cabecera[]>([]), [cursor, setCursor] = useState<string | null>(null), [conversacion, setConversacion] = useState<Cabecera | null>(null), [turnos, setTurnos] = useState<Turno[]>([]), [siguienteTurno, setSiguienteTurno] = useState<number | null>(null);
    const [resultado, setResultado] = useState<Resultado | null>(null), [pregunta, setPregunta] = useState(''), [retencion, setRetencion] = useState<7 | 30 | 90>(30), [ocupado, setOcupado] = useState(false), [error, setError] = useState('');
    const [fuente, setFuente] = useState<EntradaPregunta['fuente']>(), [documentos, setDocumentos] = useState<Array<{
        tipo: 'documento_e1' | 'informe_03' | 'propuesta_06';
        id: string;
        etiqueta: string;
    }>>([]), [fichaId, setFichaId] = useState('');
    const generacion = useRef(0), control = useRef<AbortController | null>(null), peticion = useRef<{
        id: string;
        huella: string;
    } | null>(null), edicion = useRef(0), montado = useRef(true);
    const vigente = useRef({ identidad, conversacion: '' });
    useEffect(() => { montado.current = true; return () => { montado.current = false; control.current?.abort(); }; }, []);
    const invalidar = () => { generacion.current++; control.current?.abort(); control.current = null; setOcupado(false); setResultado(null); setDocumentos([]); setFuente(undefined); setFichaId(''); peticion.current = null; };
    const leer = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => { const r = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init?.headers } }); const v = await r.json(); if (!r.ok)
        throw Object.assign(new Error(v.error ?? 'Consulta no disponible.'), { status: r.status }); return v as T; }, []);
    const historial = useCallback(async (c?: string) => { const r = await leer<{
        conversaciones: Cabecera[];
        siguiente: string | null;
    }>(`/api/consultas${c ? `?cursor=${encodeURIComponent(c)}` : ''}`); if (montado.current) {
        setConversaciones(prev => c ? [...prev, ...r.conversaciones] : r.conversaciones);
        setCursor(r.siguiente);
    } }, [leer]);
    useEffect(() => { void historial().catch(() => setError('El historial no está disponible.')); }, [historial]);
    useEffect(() => { const ac = new AbortController(); const token = generacion.current; const qs = new URLSearchParams({ tipo, q, pagina: String(pagina) }); if (tipo === 'obra' && entidad)
        qs.set('id', entidad); if (tipo === 'catalogo')
        return; void leer<{
        opciones: Opcion[];
        siguiente: number | null;
    }>(`/api/consultas/opciones?${qs}`, { signal: ac.signal }).then(r => { if (token !== generacion.current)
        return; if (tipo === 'obra' && entidad)
        setOpcionesSalas(r.opciones);
    else
        setOpciones(r.opciones); setMas(r.siguiente); }).catch(e => { if (e.name !== 'AbortError')
        setError('No se pudo cargar la selección.'); }); return () => ac.abort(); }, [tipo, entidad, q, pagina, leer]);
    const abrir = async (c: Cabecera) => { invalidar(); const token = generacion.current; setConversacion(c); setPregunta(''); edicion.current++; vigente.current = { identidad, conversacion: c.id }; try {
        const r = await leer<{
            conversacion: Cabecera;
            turnos: Turno[];
            siguiente: number | null;
        }>(`/api/consultas/${c.id}/turnos`);
        if (token !== generacion.current)
            return;
        setConversacion(r.conversacion);
        setRetencion(r.conversacion.retencion_dias);
        setTurnos(r.turnos);
        setSiguienteTurno(r.siguiente);
    }
    catch (e) {
        if (token === generacion.current) {
            setError((e as Error).message);
            setConversacion(null);
            setTurnos([]);
        }
    } };
    const verTurno = async (t: Turno) => { control.current?.abort(); const ac = new AbortController(); control.current = ac; const token = ++generacion.current; setResultado(null); setDocumentos([]); setFuente(undefined); if (!conversacion)
        return; try {
        const r = await leer<Resultado>(`/api/consultas/${conversacion.id}/turnos/${t.id}`, { signal: ac.signal });
        if (token === generacion.current) {
            setResultado(r);
            setDocumentos((r.respuesta?.enlaces ?? []).flatMap((l, i) => { const f = r.respuesta?.citas[i]?.fuente; return f && ['documento_e1', 'informe_03', 'propuesta_06'].includes(f.tipo) ? [{ tipo: f.tipo as 'documento_e1' | 'informe_03' | 'propuesta_06', id: f.id, etiqueta: l.etiqueta }] : []; }));
        }
    }
    catch (e) {
        if (token === generacion.current && !(e as Error).message.includes('abort'))
            setError((e as Error).message);
    } };
    useEffect(() => { const verificar = () => { if (document.visibilityState !== 'visible')
        return; router.refresh(); if (!conversacion || !resultado)
        return; const actual = vigente.current; void leer<Resultado>(`/api/consultas/${conversacion.id}/turnos/${resultado.id}`).then(r => { if (actual !== vigente.current)
        return; if (r.bloqueado) {
        generacion.current++;
        control.current?.abort();
        setResultado(r);
        setDocumentos([]);
        setFuente(undefined);
    } }).catch(() => { if (actual === vigente.current) {
        setResultado(null);
        setDocumentos([]);
        setFuente(undefined);
    } }); }; window.addEventListener('focus', verificar); const timer = window.setInterval(verificar, 15000); return () => { window.removeEventListener('focus', verificar); window.clearInterval(timer); }; }, [router, leer, conversacion, resultado]);
    const crear = async () => { invalidar(); setError(''); const token = generacion.current; let ambito: AmbitoConsulta; if (tipo === 'catalogo')
        ambito = { tipo };
    else if (tipo === 'sala')
        ambito = { tipo, id: entidad };
    else
        ambito = { tipo, id: entidad, salaIds: salas }; setOcupado(true); try {
        const c = await leer<Cabecera>('/api/consultas', { method: 'POST', body: JSON.stringify({ ambito, retencionDias: retencion }) });
        if (token !== generacion.current)
            return;
        const fragmentosEnAmbito = fuenteInicial && inicial?.tipo === 'obra' && c.ambito.tipo === 'obra' && c.ambito.id === inicial.id;
        setFuente(fragmentosEnAmbito ? fuenteInicial : undefined);
        setPregunta(fragmentosEnAmbito ? 'Consultar documentos seleccionados' : '');
        setConversacion(c);
        vigente.current = { identidad, conversacion: c.id };
        setTurnos([]);
        setSiguienteTurno(null);
        await historial();
    }
    catch (e) {
        if (token === generacion.current)
            setError((e as Error).message);
    }
    finally {
        if (token === generacion.current)
            setOcupado(false);
    } };
    const enviar = async () => { if (!conversacion || !pregunta.trim())
        return; control.current?.abort(); const ac = new AbortController(); control.current = ac; const token = ++generacion.current, envio = edicion.current, conv = conversacion.id, huella = JSON.stringify({ pregunta: pregunta.trim(), fuente: fuente ?? (fichaId ? { tipo: 'catalogo', id: fichaId } : undefined), conversacion: conv }); const clave = peticion.current?.huella === huella ? peticion.current.id : crypto.randomUUID(); peticion.current = { id: clave, huella }; setOcupado(true); setError(''); setResultado(null); try {
        const r = await leer<Resultado>(`/api/consultas/${conv}/turnos`, { method: 'POST', signal: ac.signal, body: JSON.stringify({ pregunta, version: conversacion.version, clavePeticion: clave, ...(fuente ? { fuente } : fichaId ? { fuente: { tipo: 'catalogo', id: fichaId } } : {}) }) });
        if (token !== generacion.current || vigente.current.conversacion !== conv)
            return;
        setResultado(r);
        setConversacion(c => c ? { ...c, version: r.version ?? c.version } : c);
        if (envio === edicion.current)
            setPregunta(pregunta);
        const meta = await leer<{
            turnos: Turno[];
            siguiente: number | null;
        }>(`/api/consultas/${conv}/turnos`);
        if (token !== generacion.current)
            return;
        setTurnos(meta.turnos);
        setSiguienteTurno(meta.siguiente);
        setDocumentos((r.respuesta?.enlaces ?? []).flatMap((l, i) => { const f = r.respuesta?.citas[i]?.fuente; return f && ['documento_e1', 'informe_03', 'propuesta_06'].includes(f.tipo) ? [{ tipo: f.tipo as 'documento_e1' | 'informe_03' | 'propuesta_06', id: f.id, etiqueta: l.etiqueta }] : []; }));
        void historial();
    }
    catch (e) {
        if (token === generacion.current && (e as Error).name !== 'AbortError')
            setError((e as Error).message);
    }
    finally {
        if (token === generacion.current)
            setOcupado(false);
    } };
    const cambiarTexto = (texto: string) => { edicion.current++; setPregunta(texto); };
    const nueva = () => { invalidar(); setConversacion(null); setTurnos([]); setPregunta(''); setError(''); vigente.current = { identidad, conversacion: '' }; };
    return <div className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]"><aside className="tarjeta order-2 self-start p-5 xl:order-1"><h2 className="t-subtitulo">Historial propio</h2><p className="mt-2 text-sm text-[var(--tinta-tenue)]">Retención desde la creación: 7, 30 o 90 días.</p><button className="boton mt-4" onClick={nueva}>Nueva consulta</button><ul className="mt-4 space-y-2">{conversaciones.map((c, i) => <li key={c.id}><button className="w-full rounded-md px-2 py-3 text-left hover:bg-[var(--superficie-hundida)]" aria-current={conversacion?.id === c.id ? 'true' : undefined} onClick={() => void abrir(c)}>Conversación {i + 1}<span className="block text-xs text-[var(--tinta-tenue)]">{fecha(c.creado_en)} · {c.ambito.tipo}</span></button></li>)}</ul>{cursor && <button className="boton mt-3" onClick={() => void historial(cursor)}>Más conversaciones</button>}</aside><main className="order-1 min-w-0 space-y-6 xl:order-2">{error && <p role="alert" className="rounded-lg bg-[var(--alerta-suave)] p-4 text-[var(--alerta)]">{error}</p>}{!conversacion ? <section className="tarjeta p-6"><h2 className="t-subtitulo">Elegir ámbito</h2>{fuenteInicial && inicial?.tipo === 'obra' && tipo === 'obra' && entidad === inicial.id && <p className="mt-3 text-sm">{fuenteInicial.candidatoIds.length} fragmentos elegidos en Documentación y requisitos. Selecciona entre una y veinte salas y empieza la consulta; podrás revisar la pregunta antes de enviarla.</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2">Ámbito<select value={tipo} onChange={e => { invalidar(); setTipo(e.target.value as AmbitoConsulta['tipo']); setEntidad(''); setSalas([]); setQ(''); setPagina(0); }}>{permisos.sala && <option value="sala">Sala</option>}{permisos.obra && <option value="obra">Selección de salas de una obra</option>}{permisos.catalogo && <option value="catalogo">Catálogo</option>}</select></label><label className="grid gap-2">Conservar historial<select value={retencion} onChange={e => setRetencion(Number(e.target.value) as 7 | 30 | 90)}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></label></div>{tipo !== 'catalogo' && <div className="mt-4 space-y-3"><label className="grid gap-2">Buscar {tipo === 'obra' && entidad ? 'salas' : tipo === 'obra' ? 'obras' : 'salas'}<input value={q} onChange={e => { setQ(e.target.value); setPagina(0); }}/></label>{tipo === 'obra' && entidad ? <><button className="boton" onClick={() => { setEntidad(''); setSalas([]); setPagina(0); }}>Cambiar obra</button><p>{salas.length} de 20 salas seleccionadas</p><div className="grid gap-2 sm:grid-cols-2">{opcionesSalas.map(o => <label key={o.id} className="flex min-h-11 min-w-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={salas.includes(o.id)} disabled={!salas.includes(o.id) && salas.length >= 20} onChange={e => setSalas(prev => e.target.checked ? [...prev, o.id] : prev.filter(id => id !== o.id))}/>{o.nombre}{o.codigo ? ` · ${o.codigo}` : ''}</label>)}</div></> : <label className="grid gap-2">{tipo === 'obra' ? 'Obra' : 'Sala'}<select value={entidad} onChange={e => { setEntidad(e.target.value); setQ(''); setPagina(0); }}><option value="">Seleccionar</option>{inicial && inicial.tipo !== 'catalogo' && entidad === inicial.id && !opciones.some(o => o.id === entidad) && <option value={entidad}>Selección enlazada</option>}{opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}{o.codigo ? ` · ${o.codigo}` : ''}</option>)}</select></label>}{(pagina > 0 || mas !== null) && <div className="flex gap-2"><button className="boton" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anteriores</button><button className="boton" disabled={mas === null} onClick={() => setPagina(mas ?? 0)}>Siguientes</button></div>}</div>}<button className="boton boton-principal mt-5" disabled={ocupado || tipo !== 'catalogo' && !entidad || tipo === 'obra' && !salas.length} onClick={() => void crear()}>Empezar consulta</button></section> : <><section className="tarjeta p-6"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="t-subtitulo">Consulta de {conversacion.ambito.tipo}</h2><span className="text-xs text-[var(--tinta-tenue)]">Caduca {fecha(conversacion.caduca_en)}</span></div><p className="mt-3 text-sm text-[var(--tinta-tenue)]">Medidas, equipos, conexiones, metros, material técnico, catálogo, documentos e informes. Cada pregunta es independiente.</p><div className="my-4 flex flex-wrap gap-2">{EJEMPLOS_CONSULTA.map(t => <button type="button" className="boton text-xs" key={t} onClick={() => cambiarTexto(t)}>{t}</button>)}</div><label className="mb-2 block" htmlFor="pregunta-consulta">Pregunta</label><textarea className="block w-full" id="pregunta-consulta" rows={4} maxLength={2000} value={pregunta} onChange={e => cambiarTexto(e.target.value)} placeholder="Escribe una pregunta técnica"/><p className="mt-1 text-xs text-[var(--tinta-tenue)]">{pregunta.length}/2000 caracteres</p>{fuente?.tipo === 'documento_requisitos' && <div className="mt-3 rounded-md border border-[var(--linea-suave)] p-3"><p>{fuente.candidatoIds.length} fragmentos revisados seleccionados · extracción <span className="break-all font-mono text-xs">{fuente.extraccionId}</span></p><button type="button" className="boton mt-2" onClick={() => setFuente(undefined)}>Quitar selección de fragmentos</button></div>}{documentos.length > 0 && <label className="mt-3 grid gap-2">Documento técnico para consultar<select value={fuente ? `${fuente.tipo}:${fuente.id}` : ''} onChange={e => { const d = documentos.find(d => `${d.tipo}:${d.id}` === e.target.value); setFuente(d ? { tipo: d.tipo, id: d.id } : undefined); }}><option value="">Sin selección · listar documentos</option>{documentos.map(d => <option key={d.id} value={`${d.tipo}:${d.id}`}>{d.etiqueta}</option>)}</select></label>}{resultado?.respuesta?.intent === 'catalogo' && <label className="mt-3 grid min-w-0 gap-2">Ficha exacta del resultado<select className="w-full min-w-0" value={fichaId} onChange={e => setFichaId(e.target.value)}><option value="">Sin selección</option>{resultado.respuesta.hechos.filter(h => h.campo.endsWith('.descripcion')).map(h => { const id = h.campo.split(':')[1]?.split('.')[0]; return <option value={id} key={id}>{h.etiqueta}</option>; })}</select></label>}<DictadoLocal key={conversacion.id} identidad={`${identidad}:${conversacion.id}`} onFinal={t => { edicion.current++; setPregunta(p => { const final = `${p}${p ? ' ' : ''}${t}`; return final; }); }}/><div className="mt-5 flex flex-wrap gap-2"><button className="boton boton-principal" disabled={ocupado || !pregunta.trim() || pregunta.length > 2000} onClick={() => void enviar()}>{ocupado ? 'Consultando…' : 'Consultar'}</button>{ocupado && <button className="boton" onClick={() => { generacion.current++; control.current?.abort(); setOcupado(false); }}>Cancelar consulta</button>}<button className="boton" onClick={() => void abrir(conversacion)}>Recargar historial</button></div></section><section className="tarjeta p-6" aria-live="polite"><h2 className="t-subtitulo">Respuesta y fuentes</h2>{resultado?.bloqueado ? <p className="mt-4">{resultado.mensaje}</p> : resultado?.respuesta ? <><p className="mt-4">{resultado.respuesta.texto}</p><p className="my-3 text-sm text-[var(--tinta-tenue)]">{resultado.historica ? 'Histórica, observada en' : 'Observado en'} {fecha(resultado.respuesta.observadoEn)}</p><div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Hechos técnicos y fuentes</caption><thead><tr><th className="text-left">Dato</th><th className="text-left">Valor</th><th className="text-left">Fuente</th></tr></thead><tbody>{resultado.respuesta.hechos.map((h, i) => { const c = resultado.respuesta?.citas.find(c => c.fuente.id === h.fuenteId); return <tr className="border-b border-[var(--linea-suave)]" key={i}><td className="py-3 pr-3">{h.etiqueta}{h.advertencia && <small className="mt-1 block text-[var(--tinta-tenue)]">{h.advertencia}</small>}</td><td className="py-3 pr-3 font-mono">{h.ausencia === 'sin_filas' ? 'Sin filas' : h.ausencia === 'no_calculable' ? 'No calculable' : h.valor === null ? 'Sin dato' : h.valor}{h.valor !== null && h.unidad ? ` ${h.unidad}` : ''}{h.ausencia === 'sin_dato' && h.valor !== null ? ' · sin confirmar' : ''}</td><td className="py-3">{c && <a className="text-[var(--acento)]" href={c.href}>Abrir fuente</a>}<small className="block break-all text-[var(--tinta-tenue)]">{h.campo}</small>{h.anclaDocumento && <small className="mt-2 block break-all text-[var(--tinta-tenue)]">{h.anclaDocumento.pagina === null ? `Línea ${h.anclaDocumento.linea}` : `Página ${h.anclaDocumento.pagina}`} · {h.anclaDocumento.metodo} · offsets UTF-16 {h.anclaDocumento.inicio}–{h.anclaDocumento.fin}<span className="block font-mono">Fragmento SHA-256 {h.anclaDocumento.sha256}</span></small>}</td></tr>; })}</tbody></table></div>{resultado.respuesta.avisos.map((a, i) => <p className="mt-3 text-sm text-[var(--aviso)]" key={i}>{a}</p>)}<ul className="mt-4 space-y-2">{resultado.respuesta.enlaces.map((l, i) => <li key={i}><a className="text-[var(--acento)]" href={l.href}>{l.etiqueta}</a></li>)}</ul><details className="mt-5"><summary>Procedencia de la captura</summary>{resultado.respuesta.citas.map((c, i) => <div className="mt-3 break-all text-xs" key={i}><p>{c.borrador ? 'Borrador actual' : c.fuente.revisionNumero ? `Revisión ${c.fuente.revisionNumero}` : 'Fuente registrada'} · {c.fuente.tipo}</p><p className="font-mono">Proyección SHA-256 {c.fuente.hash}</p>{c.fuente.revisionHash && <p className="font-mono">Revisión SHA-256 {c.fuente.revisionHash}</p>}</div>)}</details></> : <p className="mt-4 text-[var(--tinta-tenue)]">Escribe la pregunta o abre un turno del historial.</p>}</section><section className="tarjeta p-6"><h2 className="t-subtitulo">Turnos conservados</h2><ul className="mt-3 flex flex-wrap gap-2">{turnos.map(t => <li key={t.id}><button className="boton" onClick={() => void verTurno(t)}>Turno {t.numero} · {t.intent}</button></li>)}</ul>{siguienteTurno !== null && <button className="boton mt-3" onClick={() => { const token = generacion.current; const conv = conversacion.id; void leer<{
        turnos: Turno[];
        siguiente: number | null;
    }>(`/api/consultas/${conv}/turnos?desde=${siguienteTurno}`).then(r => { if (token !== generacion.current || vigente.current.conversacion !== conv)
        return; setTurnos(p => [...p, ...r.turnos]); setSiguienteTurno(r.siguiente); }); }}>Más turnos</button>}<div className="mt-5 flex flex-wrap items-end gap-3"><label className="grid gap-2">Retención desde creación<select value={retencion} onChange={e => setRetencion(Number(e.target.value) as 7 | 30 | 90)}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></label><button className="boton" onClick={() => { const token = generacion.current; const conv = conversacion.id; void leer<{
        version: number;
        caduca_en: string;
        retencion_dias: 7 | 30 | 90;
    }>(`/api/consultas/${conversacion.id}`, { method: 'PATCH', body: JSON.stringify({ version: conversacion.version, retencionDias: retencion }) }).then(c => { if (token !== generacion.current || vigente.current.conversacion !== conv)
        return; setConversacion(p => p ? { ...p, ...c } : p); void historial(); }).catch(e => setError(e.message)); }}>Guardar retención</button><button className="boton boton-peligro" onClick={() => { const token = generacion.current; const conv = conversacion.id; void leer(`/api/consultas/${conv}`, { method: 'DELETE', body: JSON.stringify({ version: conversacion.version }) }).then(() => { if (token !== generacion.current || vigente.current.conversacion !== conv)
        return; nueva(); void historial(); }).catch(e => setError(e.message)); }}>Borrar conversación propia</button></div></section></>}</main></div>;
}

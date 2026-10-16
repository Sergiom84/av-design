'use client';
import { useEffect, useRef, useState } from 'react';
import type { Ambito, EntradaPropuesta, BasePropuesta, ModeloPropuesta, Previa, LineaFuente } from '@/lib/propuestas/modelo';
import { VistaPreviaPropuesta } from './vista-previa';
import { SelectorRevisiones } from './selector-revisiones';
import { ValoracionPropuesta, nuevaValoracion } from './valoracion';
type SalaOpcion = { id: string; nombre: string; codigo: string | null };
type Comparacion = { entradaPreparada: EntradaPropuesta; modelo: ModeloPropuesta; elegibles: string[]; fuenteRevisada: string };
type Contexto = {
    seleccionadas: SalaOpcion[];
    pagina: number;
    hayMas: boolean;
    salas: Array<{
        id: string;
        nombre: string;
        codigo: string | null;
    }>;
    revisiones: Array<{
        id: string;
        sala_id: string;
        numero: number;
        nombre: string;
    }>;
    puedeEditar: boolean;
    puedeValorar: boolean;
    puedeVerValoracion: boolean;
    puedeCatalogo: boolean;
    puedeBom: boolean;
    identidad: string;
};
type Lista = Array<{
    id: string;
    titulo: string;
    numero: number;
    version: number;
    revision_id: string;
    archivada_en: string | null;
}>;
type Plantilla = {
    id: string;
    nombre: string;
    version: number;
    hash: string;
    secciones: EntradaPropuesta['secciones'];
    activo: boolean;
};
const baseVacia: BasePropuesta = { version: 0, revisionId: null, hash: null };
function inicial(tipo: 'sala' | 'obra', id: string): EntradaPropuesta { return { ambito: tipo === 'sala' ? { tipo, id } : { tipo, id, salaIds: [] }, titulo: '', fuente: { tipo: 'diseno', revisiones: [] }, aceptoHistorica: false, secciones: [{ id: crypto.randomUUID(), titulo: 'Alcance', texto: '' }, { id: crypto.randomUUID(), titulo: 'Condiciones', texto: '' }], destinatario: null, plantilla: null, incluidas: null, conceptos: [], valoracion: null }; }
class FalloHttp extends Error {
    constructor(message: string, public status: number) { super(message); }
}
async function pedir(url: string, datos?: unknown, metodo = datos ? 'POST' : 'GET') { const r = await fetch(url, { method: metodo, cache: 'no-store', headers: datos ? { 'Content-Type': 'application/json' } : undefined, body: datos ? JSON.stringify(datos) : undefined }); const b = await r.json(); if (!r.ok)
    throw new FalloHttp(b.error ?? 'No se pudo completar la operación.', r.status); return b; }
export function EditorPropuestas({ tipo, id }: {
    tipo: 'sala' | 'obra';
    id: string;
}) {
    const [contexto, setContexto] = useState<Contexto | null>(null), [lista, setLista] = useState<Lista>([]), [e, setE] = useState<EntradaPropuesta | null>(null), [propuestaId, setPropuestaId] = useState<string | null>(null), [base, setBase] = useState(baseVacia), [previa, setPrevia] = useState<{
        modelo: ModeloPropuesta;
        previa: Previa;
    } | null>(null), [modelo, setModelo] = useState<ModeloPropuesta | null>(null), [error, setError] = useState(''), [aviso, setAviso] = useState(''), [ocupado, setOcupado] = useState(false), [plantillas, setPlantillas] = useState<Plantilla[]>([]), [historial, setHistorial] = useState<Array<{
        id: string;
        numero: number;
        titulo: string;
    }>>([]), [frescura, setFrescura] = useState(''), [diff, setDiff] = useState<{
        nuevas: LineaFuente[];
        retiradas: LineaFuente[];
        cambiadas: LineaFuente[];
    } | null>(null), [precioPendiente, setPrecioPendiente] = useState<{
        linea: LineaFuente;
        precio: {
            valor: string | null;
            moneda: 'EUR';
            hash: string;
            calidad: string;
        };
    } | null>(null);
    const [fuenteRevisadaEnEdicion, setFuenteRevisadaEnEdicion] = useState<string | undefined>(undefined);
    const [comparacion, setComparacion] = useState<Comparacion | null>(null), [elecciones, setElecciones] = useState<Record<string, 'conservar' | 'vaciar'>>({}), [consultaSalas, setConsultaSalas] = useState(''), [numeroConservado, setNumeroConservado] = useState<number | null>(null);
    const entradaRef = useRef<string | null>(null), consultaRef = useRef(''), paginaRef = useRef(0), cargaContexto = useRef(0);
    useEffect(() => { entradaRef.current = e ? JSON.stringify(e) : null; }, [e]);
    const epoca = useRef(0), edicion = useRef(0), identidad = useRef(''), permisos = useRef(''), valoradaCargada = useRef(false), contextoRef = useRef<Contexto | null>(null), clave = useRef(crypto.randomUUID()), pendientes = useRef(0), propuestaRef = useRef<string | null>(null);
    const limpiar = () => { epoca.current++; edicion.current++; setPrevia(null); setModelo(null); setHistorial([]); setPrecioPendiente(null); setPlantillas([]); setDiff(null); setComparacion(null); setFuenteRevisadaEnEdicion(undefined); setNumeroConservado(null); setPropuestaId(null); propuestaRef.current = null; setBase(baseVacia); valoradaCargada.current = false; setE(inicial(tipo, id)); };
    const fallo = (x: unknown) => { const f = x as FalloHttp; setError(f.message ?? 'No se pudo completar la operación.'); if (f.status === 401 || f.status === 403) {
        epoca.current++;
        setPrevia(null);
        setPrecioPendiente(null);
        setPlantillas([]);
        setLista([]);
        if (valoradaCargada.current || propuestaRef.current) {
            limpiar();
        }
        else
            setE(actual => actual ? { ...actual, valoracion: null } : null);
        setContexto(null);
        contextoRef.current = null;
    } };
    const refrescar = async (seleccionExplicita?: EntradaPropuesta | null) => {
        const seleccion: EntradaPropuesta | null = seleccionExplicita === undefined ? (entradaRef.current ? JSON.parse(entradaRef.current) : null) : seleccionExplicita;
        const captura = epoca.current, carga = ++cargaContexto.current;
        try {
            const consulta = new URLSearchParams({ tipo, id, q: consultaRef.current, pagina: String(paginaRef.current) });
            if (seleccion?.ambito.tipo === 'obra') for (const sala of seleccion.ambito.salaIds) consulta.append('sala', sala);
            if (seleccion?.fuente.tipo === 'diseno') for (const r of seleccion.fuente.revisiones) consulta.append('revision', r.revisionId);
            const b = await pedir(`/api/propuestas?${consulta}`) as {
                contexto: Contexto;
                propuestas: Lista;
            };
            if (captura !== epoca.current || carga !== cargaContexto.current)
                return;
            const c = b.contexto;
            const huella = JSON.stringify([c.identidad, c.puedeEditar, c.puedeValorar, c.puedeVerValoracion, c.puedeCatalogo, c.puedeBom]);
            if (propuestaRef.current && !b.propuestas.some(p => p.id === propuestaRef.current)) {
                limpiar();
            }
            if (identidad.current && identidad.current !== c.identidad)
                limpiar();
            else if (permisos.current && permisos.current !== huella) {
                epoca.current++;
                setPrevia(null);
                setComparacion(null);
                setDiff(null);
                setPrecioPendiente(null);
                if (!c.puedeVerValoracion && valoradaCargada.current)
                    limpiar();
                else if (!c.puedeVerValoracion)
                    setE(a => a ? { ...a, valoracion: null } : a);
            }
            identidad.current = c.identidad;
            permisos.current = huella;
            contextoRef.current = c;
            setContexto(c);
            setLista(b.propuestas);
            setE(actual => { if (actual)
                return actual; const n = inicial(tipo, id); if (n.ambito.tipo === 'obra')
                n.ambito.salaIds = c.salas.slice(0, 20).map(s => s.id); n.fuente = { tipo: 'diseno', revisiones: c.salas.slice(0, tipo === 'sala' ? 1 : 20).flatMap(s => { const r = c.revisiones.find(r => r.sala_id === s.id); return r ? [{ salaId: s.id, revisionId: r.id }] : []; }) }; return n; });
        }
        catch (x) {
            if (captura === epoca.current)
                fallo(x);
        }
    };
    useEffect(() => { const inicio = setTimeout(() => void refrescar(), 0); const foco = () => { void refrescar(); }; window.addEventListener('focus', foco); const timer = setInterval(foco, 20000); return () => { epoca.current++; clearTimeout(inicio); clearInterval(timer); window.removeEventListener('focus', foco); }; }, [tipo, id]); // eslint-disable-line react-hooks/exhaustive-deps
    const cambiar = (datos: Partial<EntradaPropuesta>) => { edicion.current++; if (datos.fuente) setFuenteRevisadaEnEdicion(undefined); setE(a => a ? { ...a, ...datos } : a); setPrevia(null); setDiff(null); setComparacion(null); setError(''); clave.current = crypto.randomUUID(); };
    const operar = async (accion: () => Promise<void>) => { const g = epoca.current; pendientes.current++; setOcupado(true); setError(''); try {
        await accion();
    }
    catch (x) {
        if (g === epoca.current)
            fallo(x);
    }
    finally {
        pendientes.current--;
        setOcupado(pendientes.current > 0);
    } };
    const preparar = async (actualizar = false) => { if (!e)
        return; const v = edicion.current, g = epoca.current; const actuales = [...(modelo?.fuente.lineas ?? []).filter(l => e.incluidas === null || e.incluidas.includes(l.clave)), ...e.conceptos.map(c => ({ clave: `manual:${c.id}`, articuloId: null, descripcion: c.descripcion, cantidad: c.cantidad, unidad: c.unidad, detalles: [], origen: 'concepto documental manual', enlace: '' }))]; const preparada = { ...e, valoracion: e.valoracion === null ? null : actuales.map(l => e.valoracion!.find(x => x.clave === l.clave) ?? nuevaValoracion(l)) }; const b = await pedir(actualizar && propuestaId ? `/api/propuestas/${propuestaId}/actualizar-fuente` : '/api/propuestas/preparar', actualizar ? { entrada: preparada, base } : { entrada: preparada, base, propuestaId, ...(fuenteRevisadaEnEdicion ? { fuenteRevisada: fuenteRevisadaEnEdicion } : {}) }); if (v !== edicion.current || g !== epoca.current)
        return;
        if (actualizar) { setComparacion(b); setElecciones({}); setDiff(b.diff); setPrevia(null); return; }
        setE(preparada); setPrevia(b); setModelo(b.modelo); setDiff(null); setComparacion(null);
    };
    const aplicarComparacion = async () => {
        if (!comparacion || !e || comparacion.elegibles.some(k => !elecciones[k])) return;
        const v = edicion.current, g = epoca.current;
        const candidata = { ...comparacion.entradaPreparada, valoracion: comparacion.entradaPreparada.valoracion?.map(l => elecciones[l.clave] === 'conservar' ? e.valoracion!.find(a => a.clave === l.clave)! : l) ?? null };
        const b = await pedir('/api/propuestas/preparar', { entrada: candidata, base, propuestaId, fuenteRevisada: comparacion.fuenteRevisada });
        if (v !== edicion.current || g !== epoca.current) return;
        setE(candidata); setFuenteRevisadaEnEdicion(comparacion.fuenteRevisada); setModelo(b.modelo); setPrevia(b); setComparacion(null); setDiff(null); clave.current = crypto.randomUUID();
    };
    const abrir = async (pid: string) => { const v = edicion.current, g = epoca.current; const b = await pedir(`/api/propuestas/${pid}`); if (v !== edicion.current || g !== epoca.current)
        return; const m = b.revision as ModeloPropuesta; const c = contextoRef.current; if (!c || m.valoracion && !c.puedeVerValoracion)
        return; valoradaCargada.current = m.valoracion !== null; edicion.current++; setPropuestaId(pid); propuestaRef.current = pid; setBase({ version: b.cabecera.version, revisionId: m.id, hash: m.sha256 }); setModelo(m); setNumeroConservado(m.numero); setPrevia(null); setComparacion(null); setFuenteRevisadaEnEdicion(undefined); setDiff(null); setFrescura(`${b.frescura.estado}: ${b.frescura.motivo}`); const d = m.tecnico.destinatario; const cargada: EntradaPropuesta = { ambito: m.fuente.ambito, titulo: m.tecnico.titulo, fuente: m.fuente.tipo === 'bom' ? { tipo: 'bom' } : { tipo: 'diseno', revisiones: m.fuente.salas.map(s => ({ salaId: s.id, revisionId: s.revisionId! })) }, aceptoHistorica: true, secciones: m.tecnico.secciones.map(s => ({ id: s.id, titulo: s.titulo, texto: s.texto })), destinatario: d ? { entidad: d.entidad, nombre: d.nombre, contacto: d.contacto, grupo: d.grupo } : null, plantilla: m.tecnico.plantilla, incluidas: m.tecnico.lineas.filter(l => !l.clave.startsWith('manual:')).map(l => l.clave), conceptos: m.tecnico.lineas.filter(l => l.clave.startsWith('manual:')).map(l => ({ id: l.clave.slice(7), descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad })), valoracion: m.valoracion ? m.valoracion.lineas.map(l => ({ clave: l.clave, moneda: l.moneda, coste: l.coste, origenCoste: l.origenCoste, regla: l.regla, precio: l.precio, motivoPrecio: l.motivoPrecio ?? null, porcentaje: l.porcentaje, impuesto: l.impuesto })) : null }; setE(cargada); void refrescar(cargada); const h = await pedir(`/api/propuestas/${pid}/revisiones`); if (g === epoca.current)
        setHistorial(h.revisiones); };
    const publicar = async () => { if (!e || !previa)
        return; const v = edicion.current, g = epoca.current; const b = await pedir(propuestaId ? `/api/propuestas/${propuestaId}` : '/api/propuestas', { entrada: e, base, previa: previa.previa, clavePeticion: clave.current }); if (v !== edicion.current || g !== epoca.current)
        return; setAviso(b.sinCambio ? 'La revisión ya estaba conservada.' : 'Revisión y PDF conservados.'); await abrir(b.id); await refrescar(); };
    const cargarPlantillas = async () => { const g = epoca.current; const b = await pedir('/api/propuestas/plantillas'); if (g === epoca.current)
        setPlantillas(b.plantillas); };
    const seleccionarRevision = (salaId: string, revisionId: string) => {
        if (!e || e.fuente.tipo !== 'diseno') return;
        cambiar({ fuente: { tipo: 'diseno', revisiones: [...e.fuente.revisiones.filter(r => r.salaId !== salaId), { salaId, revisionId }] } });
    };
    const lineas = modelo?.tecnico.lineas ?? [];
    const salasSeleccionadas: SalaOpcion[] = contexto ? [...contexto.salas, ...(contexto.seleccionadas ?? []).filter(s => !contexto.salas.some(a => a.id === s.id))] : [];
    return <div className="space-y-5 min-w-0"><header><h1 className="t-titulo">Propuestas internas</h1><p className="text-tinta-tenue">Alcance, fuentes revisadas y PDF por revisión.</p></header>
    {error && <p role="alert" className="rounded-lg p-3 bg-alerta-suave text-alerta">{error} Tu edición permanece disponible cuando conserva permiso.</p>}{aviso && <p role="status">{aviso}</p>}
    <section className="tarjeta p-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="t-subtitulo">Propuestas del ámbito</h2>{contexto?.puedeEditar && <button type="button" className="boton secundario" onClick={() => { limpiar(); void refrescar(); }}>Nueva propuesta</button>}</div><ul className="divide-y divide-linea-suave">{lista.map(p => <li key={p.id} className="py-3 flex gap-3 flex-wrap items-center"><button type="button" className="text-acento underline" onClick={() => void operar(() => abrir(p.id))}>{p.titulo} · revisión {p.numero}</button>{p.archivada_en && <span>Archivada</span>}<a href={`/api/propuestas/${p.id}/revisiones/${p.revision_id}/pdf`} className="text-acento underline">PDF de revisión {p.numero}</a><a href={`/propuestas/seguimiento?propuesta=${p.id}&revision=${p.revision_id}&tipo=${tipo}&id=${id}`} className="text-acento underline">Seguimiento de revisión {p.numero}</a></li>)}</ul>{!lista.length && <p className="text-tinta-tenue">Sin propuestas accesibles.</p>}</section>
    {e && contexto && <section className="tarjeta p-4 space-y-4"><h2 className="t-subtitulo">{propuestaId ? 'Revisar propuesta' : 'Preparar propuesta'}</h2>{frescura && <p>{frescura}</p>}
    <fieldset disabled={!contexto.puedeEditar} className="space-y-4"><label className="block">Título<input className="w-full" maxLength={160} value={e.titulo} onChange={x => cambiar({ titulo: x.target.value })}/></label>
    {e.ambito.tipo === 'obra' && <fieldset><legend>Salas de la propuesta (máximo 20)</legend><label className="block">Buscar sala<input value={consultaSalas} maxLength={100} onChange={x => { setConsultaSalas(x.target.value); consultaRef.current = x.target.value; paginaRef.current = 0; void refrescar(); }}/></label><p>{e.ambito.salaIds.length} salas seleccionadas</p>{salasSeleccionadas.filter(s => e.ambito.tipo === 'obra' && e.ambito.salaIds.includes(s.id)).map(s => <span className="inline-block mr-3" key={s.id}>{s.nombre}{!propuestaId && <button type="button" aria-label={`Quitar sala ${s.nombre}`} onClick={() => { const a = e.ambito as Extract<Ambito, { tipo: 'obra' }>; const nueva = { ...e, ambito: { ...a, salaIds: a.salaIds.filter(k => k !== s.id) } }; if (nueva.fuente.tipo === 'diseno') nueva.fuente = { tipo: 'diseno', revisiones: nueva.fuente.revisiones.filter(r => nueva.ambito.salaIds.includes(r.salaId)) }; cambiar({ ambito: nueva.ambito, fuente: nueva.fuente }); void refrescar(nueva); }}> · Quitar</button>}</span>)}<div>{contexto.salas.map(s => <label key={s.id} className="inline-flex gap-2 mr-4"><input type="checkbox" disabled={!!propuestaId} checked={e.ambito.tipo === 'obra' && e.ambito.salaIds.includes(s.id)} onChange={x => { const a = e.ambito as Extract<Ambito, {
            tipo: 'obra';
        }>; const ids = x.target.checked ? [...a.salaIds, s.id] : a.salaIds.filter(k => k !== s.id); if (ids.length <= 20) { const nueva = { ...e, ambito: { ...a, salaIds: ids } }; if (nueva.fuente.tipo === 'diseno') nueva.fuente = { tipo: 'diseno', revisiones: nueva.fuente.revisiones.filter(r => nueva.ambito.salaIds.includes(r.salaId)) }; cambiar({ ambito: nueva.ambito, fuente: nueva.fuente }); void refrescar(nueva); } }}/>{s.nombre}</label>)}</div><div className="flex gap-3"><button type="button" disabled={contexto.pagina === 0} onClick={() => { paginaRef.current = Math.max(0, contexto.pagina - 1); void refrescar(); }}>Página anterior de salas</button><span>Página {contexto.pagina + 1}</span><button type="button" disabled={!contexto.hayMas} onClick={() => { paginaRef.current = contexto.pagina + 1; void refrescar(); }}>Página siguiente de salas</button></div></fieldset>}
    <label className="block">Fuente<select value={e.fuente.tipo} onChange={x => cambiar({ fuente: x.target.value === 'bom' ? { tipo: 'bom' } : { tipo: 'diseno', revisiones: [] } })}><option value="diseno">Revisión de diseño guardada</option>{contexto.puedeBom && <option value="bom">Captura BOM actual para confirmar</option>}</select></label>
    <SelectorRevisiones entrada={e} salas={salasSeleccionadas} revisiones={contexto.revisiones} cambiar={seleccionarRevision}/>
    <label className="flex gap-2"><input type="checkbox" checked={e.aceptoHistorica} onChange={x => cambiar({ aceptoHistorica: x.target.checked })}/>Acepto usar la revisión histórica seleccionada si ya cambió el diseño</label>
    <div className="flex gap-3 flex-wrap"><button type="button" className="boton secundario" onClick={() => void operar(cargarPlantillas)}>Ver plantillas de alcance</button><select aria-label="Plantilla de alcance" value={e.plantilla?.id ?? ''} onChange={x => { const p = plantillas.find(p => p.id === x.target.value); if (p)
            cambiar({ plantilla: { id: p.id, version: p.version, hash: p.hash }, secciones: p.secciones.map(s => ({ ...s, id: crypto.randomUUID() })) }); }}><option value="">Sin plantilla</option>{plantillas.filter(p => p.activo).map(p => <option value={p.id} key={p.id}>{p.nombre} · v{p.version}</option>)}</select>{e.plantilla && <button type="button" className="boton secundario" onClick={() => void operar(async () => { const p = plantillas.find(p => p.id === e.plantilla!.id); if (!p)
            throw new Error('Vuelve a cargar la plantilla antes de editarla.'); await pedir(`/api/propuestas/plantillas/${p.id}`, { nombre: p.nombre, secciones: e.secciones, activo: p.activo, version: p.version }, 'PATCH'); const actual = await pedir(`/api/propuestas/plantillas/${p.id}`); cambiar({ plantilla: { id: actual.id, version: actual.version, hash: actual.hash } }); await cargarPlantillas(); setAviso('Plantilla textual actualizada. Las propuestas conservadas mantienen su copia.'); })}>Actualizar plantilla seleccionada</button>}</div>
    {e.secciones.map((s, i) => <div key={s.id} className="space-y-2"><label className="block">Título de sección {i + 1}<input className="w-full" value={s.titulo} onChange={x => cambiar({ secciones: e.secciones.map(a => a.id === s.id ? { ...a, titulo: x.target.value } : a) })}/></label><label className="block">Texto de sección {i + 1}<textarea className="w-full min-h-28" maxLength={10000} value={s.texto} onChange={x => cambiar({ secciones: e.secciones.map(a => a.id === s.id ? { ...a, texto: x.target.value } : a) })}/></label><button type="button" className="text-acento underline" onClick={() => cambiar({ secciones: e.secciones.filter(a => a.id !== s.id) })}>Quitar sección {i + 1}</button></div>)}
    <div className="flex flex-wrap gap-3"><button type="button" className="boton secundario" disabled={e.secciones.length >= 30} onClick={() => cambiar({ secciones: [...e.secciones, { id: crypto.randomUUID(), titulo: 'Nueva sección', texto: '' }] })}>Añadir sección</button><button type="button" className="boton secundario" onClick={() => void operar(async () => { const nombre = window.prompt('Nombre de la plantilla textual'); if (!nombre)
            return; await pedir('/api/propuestas/plantillas', { nombre, secciones: e.secciones, activo: true }); setAviso('Guardadas sólo las secciones textuales como plantilla.'); await cargarPlantillas(); })}>Guardar estas secciones como plantilla</button></div>
    <label className="flex gap-2"><input type="checkbox" checked={e.destinatario !== null} onChange={x => cambiar({ destinatario: x.target.checked ? { entidad: '', nombre: '', contacto: '', grupo: '' } : null })}/>Añadir destinatario opcional</label>
    {e.destinatario && <div className="grid md:grid-cols-2 gap-3">{(['entidad', 'nombre', 'contacto', 'grupo'] as const).map(k => <label key={k}>Destinatario · {k}<input className="w-full" value={e.destinatario![k]} onChange={x => cambiar({ destinatario: { ...e.destinatario!, [k]: x.target.value } })}/></label>)}</div>}
    <button type="button" className="boton secundario" onClick={() => cambiar({ conceptos: [...e.conceptos, { id: crypto.randomUUID(), descripcion: 'Servicio documental manual', cantidad: null, unidad: null }] })}>Añadir concepto documental</button>
    {e.conceptos.map(c => <div key={c.id} className="grid md:grid-cols-3 gap-3"><label>Concepto manual<input value={c.descripcion} onChange={x => cambiar({ conceptos: e.conceptos.map(a => a.id === c.id ? { ...a, descripcion: x.target.value } : a) })}/></label><label>Cantidad del concepto<input value={c.cantidad ?? ''} onChange={x => cambiar({ conceptos: e.conceptos.map(a => a.id === c.id ? { ...a, cantidad: x.target.value || null } : a) })}/></label><label>Unidad del concepto<input value={c.unidad ?? ''} onChange={x => cambiar({ conceptos: e.conceptos.map(a => a.id === c.id ? { ...a, unidad: x.target.value || null } : a) })}/></label></div>)}
    {contexto.puedeValorar && <label className="flex gap-2"><input type="checkbox" disabled={!lineas.length} checked={e.valoracion !== null} onChange={x => cambiar({ valoracion: x.target.checked ? lineas.map(nuevaValoracion) : null })}/>Incluir valoración prevista</label>}
    {e.valoracion && contexto.puedeVerValoracion && <ValoracionPropuesta lineas={lineas} valor={e.valoracion} editable={contexto.puedeValorar} permitirCatalogo={contexto.puedeCatalogo} cambiar={v => cambiar({ valoracion: v })} consultarPrecio={l => void operar(async () => { if (!contexto.puedeCatalogo)
            throw new Error('Se necesita catálogo y compras.'); const v = edicion.current, g = epoca.current; const p = await pedir(`/api/propuestas/precios?articuloId=${l.articuloId}`); if (v === edicion.current && g === epoca.current)
            setPrecioPendiente({ linea: l, precio: p }); })}/>}
    {precioPendiente && contexto.puedeCatalogo && contexto.puedeValorar && <section aria-label="Confirmación de precio" className="p-3 bg-acento-suave"><p>Previsto de catálogo: {precioPendiente.precio.valor ?? 'Sin dato'} {precioPendiente.precio.moneda} · {precioPendiente.precio.calidad}</p><button type="button" className="boton" disabled={precioPendiente.precio.valor === null} onClick={() => { const p = precioPendiente; cambiar({ valoracion: (e.valoracion ?? []).map(l => l.clave === p.linea.clave ? { ...l, coste: p.precio.valor, moneda: p.precio.moneda, origenCoste: { tipo: 'catalogo', articuloId: p.linea.articuloId!, hash: p.precio.hash } } : l) }); setPrecioPendiente(null); }}>Confirmar este coste previsto</button></section>}
    {modelo && <fieldset><legend>Líneas de fuente incluidas</legend>{modelo.fuente.lineas.map(l => <label key={l.clave} className="block"><input type="checkbox" checked={e.incluidas === null || e.incluidas.includes(l.clave)} onChange={x => { const actual = e.incluidas ?? modelo.fuente.lineas.map(a => a.clave); cambiar({ incluidas: x.target.checked ? [...actual, l.clave] : actual.filter(a => a !== l.clave), valoracion: e.valoracion?.filter(v => v.clave !== l.clave) ?? null }); }}/> {l.descripcion}</label>)}</fieldset>}<div className="flex gap-3 flex-wrap"><button type="button" className="boton" disabled={!!comparacion} onClick={() => void operar(() => preparar())}>Revisar vista previa</button>{propuestaId && <button type="button" className="boton secundario" onClick={() => void operar(() => preparar(true))}>Actualizar fuente y comparar</button>}</div></fieldset>
    {diff && <section aria-label="Diferencias de fuente"><h3 className="font-semibold">Cambio de fuente pendiente de confirmar</h3><p>{diff.nuevas.length} nuevas · {diff.retiradas.length} retiradas · {diff.cambiadas.length} cambiadas. Las líneas nuevas empiezan sin valoración.</p>{[...diff.nuevas, ...diff.retiradas, ...diff.cambiadas].map((l, i) => <p key={i}>{l.descripcion}: {l.cantidad ?? 'Sin dato'} {l.unidad ?? ''}</p>)}{comparacion && <><p>La edición anterior sigue intacta. Decide por cada línea coincidente si conservas su coste, regla e impuesto, o la dejas sin valoración. Las retiradas no traspasan sus importes.</p>{comparacion.elegibles.map(k => <label className="block" key={k}>Valoración de {comparacion.modelo.tecnico.lineas.find(l => l.clave === k)?.descripcion}<select value={elecciones[k] ?? ''} onChange={x => { edicion.current++; setPrevia(null); setElecciones(a => ({ ...a, [k]: x.target.value as 'conservar' | 'vaciar' })); clave.current = crypto.randomUUID(); }}><option value="">Elegir para esta línea</option><option value="conservar">Conservar coste, regla e impuesto revisados</option><option value="vaciar">Dejar sin valoración</option></select></label>)}<button type="button" className="boton" disabled={ocupado || comparacion.elegibles.some(k => !elecciones[k])} onClick={() => void operar(aplicarComparacion)}>Aplicar decisiones y revisar fuente</button><button type="button" className="boton secundario" onClick={() => { edicion.current++; setPrevia(null); setComparacion(null); setDiff(null); }}>Cancelar actualización de fuente</button></>}</section>}
    {previa && <><VistaPreviaPropuesta modelo={previa.modelo}/><button type="button" className="boton" disabled={ocupado || !contexto.puedeEditar} onClick={() => void operar(publicar)}>Confirmar revisión y guardar PDF</button></>}
    {propuestaId && base.revisionId && <div className="flex flex-wrap gap-3"><a className="text-acento underline" href={`/api/propuestas/${propuestaId}/revisiones/${base.revisionId}/pdf`}>Abrir PDF conservado · revisión {numeroConservado}</a><a className="text-acento underline" href={`/propuestas/seguimiento?propuesta=${propuestaId}&revision=${base.revisionId}&tipo=${tipo}&id=${id}`}>Seguimiento de esta revisión</a>{contexto.puedeEditar && <button type="button" className="text-acento underline" onClick={() => void operar(async () => { const motivo = window.prompt('Motivo para archivar o reactivar'); if (!motivo)
            return; const p = lista.find(p => p.id === propuestaId); await pedir(`/api/propuestas/${propuestaId}`, { version: base.version, archivada: !p?.archivada_en, motivo, clavePeticion: crypto.randomUUID() }, 'PATCH'); await refrescar(); await abrir(propuestaId); })}>Archivar o reactivar</button>}</div>}
    {historial.length > 0 && <section><h3 className="font-semibold">Revisiones conservadas</h3><ul>{historial.map(r => <li key={r.id}><a className="text-acento underline" href={`/api/propuestas/${propuestaId}/revisiones/${r.id}/pdf`}>Revisión {r.numero} · {r.titulo} · PDF</a></li>)}</ul></section>}
    </section>}
  </div>;
}

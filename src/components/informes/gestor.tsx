'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ClaveInforme, ConfiguracionInforme, CalendarioInforme } from '@/lib/informes/modelo';
import { serializarCanonico } from '@/lib/informes/modelo';
import { Definicion, type OpcionAmbito } from './definicion';
import { Audiencia, type GrupoUI } from './audiencia';
import { Programacion, type ProgramacionUI } from './programacion';
import { Historial } from './historial';
import { Resultado, type EjecucionUI } from './resultado';
import type { InicioInforme } from '@/lib/informes/seleccion-inicial';
interface DefinicionUI {
    id: string;
    nombre: string;
    version: number;
    configuracion: ConfiguracionInforme;
    archivada_en: string | null;
}
interface PreviaUI {
    hash: string;
    creadaEn: string;
    ambito: {
        nombre: string;
        salas: {
            id: string;
            nombre: string;
            codigo: string | null;
        }[];
    };
    periodo: unknown;
    audiencia: {
        usuarioId: string;
        nombre: string;
        origenes: unknown[];
    }[];
}
interface AutorizacionUI {
    usuarioId: string;
    claves: ClaveInforme[];
    opciones: OpcionAmbito[];
    admin: boolean;
}
interface Vigente<T> {
    autorizacion: AutorizacionUI;
    valor: T;
}
function cancelada() {
    return new DOMException('La selección o la autorización ha cambiado.', 'AbortError');
}
async function api<T>(ruta: string, metodo = 'GET', datos?: unknown, signal?: AbortSignal): Promise<T> {
    const r = await fetch(ruta, { method: metodo, cache: 'no-store', signal, ...datos ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) } : {} });
    const respuesta = await r.json();
    if (!r.ok)
        throw new Error(respuesta.error ?? 'El servicio no está disponible.');
    return respuesta as T;
}
function contenidoPermitido(c: ConfiguracionInforme, a: AutorizacionUI): boolean {
    return a.claves.includes(c.clave) && a.opciones.some(o => o.tipo === c.ambito.tipo && o.id === c.ambito.id)
        && (c.ambito.tipo === 'sala' || !c.ambito.salaIds?.some(id => !a.opciones.some(o => o.tipo === 'sala' && o.id === id)));
}
function definicionPermitida(c: ConfiguracionInforme, a: AutorizacionUI): boolean {
    return contenidoPermitido(c, a) && (a.admin || (!c.audiencia.grupos.length && c.audiencia.usuarios.every(id => id === a.usuarioId)));
}
function configuracionInicial(a: AutorizacionUI): ConfiguracionInforme {
    const opcion = a.opciones.find(o => o.tipo === 'sala') ?? a.opciones[0];
    return { versionModelo: 1, versionRegistro: 1, clave: a.claves[0], ambito: { tipo: opcion?.tipo ?? 'sala', id: opcion?.id ?? '' }, periodo: a.claves[0]?.endsWith('_actual') ? { modo: 'actual' } : { modo: 'rango', desde: '', hasta: '' }, formatos: ['pdf', 'xlsx', 'csv'], audiencia: { usuarios: [], grupos: [] } };
}
export function GestorInformes({ usuarioId, claves, opciones, admin, inicio = {} }: AutorizacionUI & { inicio?: InicioInforme }) {
    // Las props RSC pueden ser objetos nuevos con el mismo significado. Su identidad
    // semántica mantiene el borrador y las peticiones de ese mismo contexto.
    const firma = serializarCanonico({ usuarioId, claves: [...claves].sort(), opciones: [...opciones].sort((a, b) => `${a.tipo}:${a.id}`.localeCompare(`${b.tipo}:${b.id}`)), admin });
    const autorizacion = useMemo(() => JSON.parse(firma) as AutorizacionUI, [firma]);
    const [autorizacionEstado, setAutorizacionEstado] = useState(autorizacion);
    const autorizacionActual = useRef(autorizacion);
    const edicion = useRef(0);
    const secuencia = useRef(0);
    const seleccionActual = useRef<string | null>(inicio.ejecucionId ?? null);
    const definicionSeleccionada = useRef<string | null>(null);
    const [borrador, setConfiguracion] = useState<ConfiguracionInforme>(() => inicio.configuracion && contenidoPermitido(inicio.configuracion, autorizacion) ? inicio.configuracion : configuracionInicial(autorizacion));
    const [nombreBorrador, setNombre] = useState('');
    const [listaDefiniciones, setDefiniciones] = useState<DefinicionUI[]>([]);
    const [definicionActual, setActual] = useState<DefinicionUI | null>(null);
    const [comparacion, setComparacion] = useState<Vigente<DefinicionUI> | null>(null);
    const [revision, setRevision] = useState<Vigente<PreviaUI> | null>(null);
    const [listaGrupos, setGrupos] = useState<GrupoUI[]>([]);
    const [programaciones, setProgramaciones] = useState<ProgramacionUI[]>([]);
    const [listaEjecuciones, setEjecuciones] = useState<EjecucionUI[]>([]);
    const [listaUltimos, setUltimos] = useState<EjecucionUI[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [seleccionada, setSeleccionada] = useState<string | null>(inicio.ejecucionId ?? null);
    const [observacion, setObservacion] = useState(0);
    const [captura, setCaptura] = useState<Vigente<EjecucionUI> | null>(null);
    const [runner, setRunner] = useState<{
        estado: string;
        ultimaPasadaManual: unknown;
        cola: {
            pendientes: number;
            en_curso: number;
        };
        ultimoError?: {
            error_codigo: string;
            error_mensaje: string;
        } | null;
        programaciones: {
            id: string;
            proxima_utc: string | null;
            atraso: number;
            atrasoAcotado: boolean;
        }[];
    } | null>(null);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState(inicio.aviso ?? (inicio.configuracion ? 'Selección preparada desde Consulta local. Revisa contenido, ámbito, período, formatos y audiencia antes de continuar.' : ''));
    const [ocupado, setOcupado] = useState(false);
    const [nombreGrupo, setNombreGrupo] = useState('');
    const [grupoEditado, setGrupoEditado] = useState<GrupoUI | null>(null);
    const [miembros, setMiembros] = useState<string[]>([]);
    const [grupoConfig, setGrupoConfig] = useState<ConfiguracionInforme | null>(null);
    const [claveManual, setClaveManual] = useState<string | null>(null);
    const foco = useRef<HTMLParagraphElement>(null);
    const inicial = () => configuracionInicial(autorizacion);
    const conservaBorrador = contenidoPermitido(borrador, autorizacion);
    const configuracion = conservaBorrador ? admin ? borrador : { ...borrador, audiencia: { usuarios: [], grupos: [] } } : inicial();
    const nombre = conservaBorrador ? nombreBorrador : '';
    const actual = definicionActual && definicionPermitida(definicionActual.configuracion, autorizacion) ? definicionActual : null;
    const servidorComparado = comparacion?.autorizacion === autorizacion && definicionPermitida(comparacion.valor.configuracion, autorizacion) ? comparacion.valor : null;
    const previa = revision?.autorizacion === autorizacion && conservaBorrador ? revision.valor : null;
    const ejecucionPermitida = useCallback((e: EjecucionUI) => {
        const c = e.snapshot?.definicion.configuracion ?? e.definicion_snapshot.configuracion;
        // El historial puede incluir ámbitos fuera de las 500 opciones del selector.
        // Su acceso se revalida contra el GET autenticado; claves y distribución
        // sí son restricciones de autorización que deben aplicarse al render.
        return autorizacion.claves.includes(c.clave) && (e.propietario_id !== autorizacion.usuarioId || autorizacion.admin || (!c.audiencia.grupos.length && c.audiencia.usuarios.every(id => id === autorizacion.usuarioId)));
    }, [autorizacion]);
    const resultado = captura?.autorizacion === autorizacion && ejecucionPermitida(captura.valor) ? captura.valor : null;
    const definiciones = listaDefiniciones.filter(d => definicionPermitida(d.configuracion, autorizacion));
    const ejecuciones = listaEjecuciones.filter(ejecucionPermitida);
    const ultimos = listaUltimos.filter(ejecucionPermitida);
    const grupos = admin ? listaGrupos.filter(g => opciones.some(o => o.tipo === g.ambito.tipo && o.id === g.ambito.id)) : [];
    const setResultado = useCallback((valor: EjecucionUI | null) => setCaptura(valor ? { autorizacion, valor } : null), [autorizacion]);
    const setPrevia = (valor: PreviaUI | null) => setRevision(valor ? { autorizacion, valor } : null);
    const setServidorComparado = (valor: DefinicionUI | null) => setComparacion(valor ? { autorizacion, valor } : null);
    // Ajuste condicional de estado antes del commit: ningún árbol intermedio
    // presenta datos del contexto anterior. No reinicia el componente ni una
    // edición cuyo contenido y usuario siguen permitidos.
    if (autorizacionEstado !== autorizacion) {
        const mismoUsuario = autorizacionEstado.usuarioId === usuarioId;
        setAutorizacionEstado(autorizacion);
        setConfiguracion(mismoUsuario ? configuracion : inicial());
        setNombre(mismoUsuario ? nombre : '');
        setActual(mismoUsuario ? actual : null);
        setRevision(null);
        setComparacion(null);
        setCaptura(null);
        setClaveManual(null);
        setProgramaciones([]);
        setRunner(null);
        setError('');
        setMensaje('');
        setOcupado(false);
        if (!mismoUsuario) {
            setDefiniciones([]);
            setEjecuciones([]);
            setUltimos([]);
            setSeleccionada(null);
        }
        if (!mismoUsuario || !admin || grupoConfig && !contenidoPermitido(grupoConfig, autorizacion)) {
            setGrupos([]);
            setGrupoEditado(null);
            setGrupoConfig(null);
            setMiembros([]);
            setNombreGrupo('');
        }
    }
    useLayoutEffect(() => {
        autorizacionActual.current = autorizacion;
        edicion.current++;
        secuencia.current++;
    }, [autorizacion]);
    useLayoutEffect(() => { definicionSeleccionada.current = actual?.id ?? null; }, [actual]);
    const consultar = useCallback(async <T,>(ruta: string, metodo = 'GET', datos?: unknown, signal?: AbortSignal): Promise<T> => {
        if (autorizacionActual.current !== autorizacion || signal?.aborted)
            throw cancelada();
        try {
            const r = await api<T>(ruta, metodo, datos, signal);
            if (autorizacionActual.current !== autorizacion || signal?.aborted)
                throw cancelada();
            return r;
        }
        catch (e) {
            if (autorizacionActual.current !== autorizacion || signal?.aborted)
                throw cancelada();
            throw e;
        }
    }, [autorizacion]);
    const consultarEdicion = async <T,>(ruta: string, metodo = 'GET', datos?: unknown): Promise<T> => {
        const numero = edicion.current;
        const r = await consultar<T>(ruta, metodo, datos);
        if (numero !== edicion.current)
            throw cancelada();
        return r;
    };
    const solicitar = async (trabajo: () => Promise<void>) => {
        const numero = edicion.current;
        setOcupado(true);
        setError('');
        setMensaje('');
        try {
            await trabajo();
        }
        catch (e) {
            if (autorizacionActual.current === autorizacion && numero === edicion.current && !(e instanceof Error && e.name === 'AbortError')) {
                setError(e instanceof Error ? e.message : 'No se pudo completar.');
                setTimeout(() => foco.current?.focus(), 0);
            }
        }
        finally {
            if (autorizacionActual.current === autorizacion && numero === edicion.current)
                setOcupado(false);
        }
    };
    const cargar = useCallback(async (signal?: AbortSignal) => {
        const numero = ++secuencia.current;
        // Un resultado seleccionado se consulta de nuevo, aunque ya no aparezca
        // en la página del historial: la paginación no demuestra autorización.
        const idSeleccionado = seleccionActual.current;
        const idDefinicion = definicionSeleccionada.current;
        const [defs, hist, estado, gruposNuevos, seleccion] = await Promise.all([
            consultar<{
                definiciones: DefinicionUI[];
            }>('/api/informes', 'GET', undefined, signal),
            consultar<{
                ejecuciones: EjecucionUI[];
                ultimosCorrectos: EjecucionUI[];
                cursor: string | null;
            }>('/api/informes/ejecuciones', 'GET', undefined, signal),
            consultar<NonNullable<typeof runner>>('/api/informes/runner', 'GET', undefined, signal),
            autorizacion.admin ? consultar<{
                grupos: GrupoUI[];
            }>('/api/informes/grupos', 'GET', undefined, signal) : Promise.resolve({ grupos: [] }),
            idSeleccionado ? consultar<EjecucionUI>(`/api/informes/ejecuciones/${idSeleccionado}`, 'GET', undefined, signal).catch(e => {
                if (e.name === 'AbortError')
                    throw e;
                return null;
            }) : Promise.resolve(null)
        ]);
        if (numero !== secuencia.current)
            throw cancelada();
        setDefiniciones(defs.definiciones.filter(d => definicionPermitida(d.configuracion, autorizacion)));
        setEjecuciones(hist.ejecuciones.filter(ejecucionPermitida));
        setUltimos(hist.ultimosCorrectos.filter(ejecucionPermitida));
        setCursor(hist.cursor);
        setRunner(estado);
        setGrupos(gruposNuevos.grupos);
        if (idDefinicion && definicionSeleccionada.current === idDefinicion && !defs.definiciones.some(d => d.id === idDefinicion && definicionPermitida(d.configuracion, autorizacion))) {
            setRevision(null);
            setComparacion(null);
            setProgramaciones([]);
        }
        setActual(d => d && defs.definiciones.some(n => n.id === d.id && definicionPermitida(n.configuracion, autorizacion)) ? d : null);
        setComparacion(c => c && defs.definiciones.some(d => d.id === c.valor.id && definicionPermitida(d.configuracion, autorizacion)) ? c : null);
        if (idSeleccionado && seleccionActual.current === idSeleccionado) {
            if (seleccion && ejecucionPermitida(seleccion))
                setResultado(seleccion);
            else {
                setResultado(null);
                setSeleccionada(null);
                seleccionActual.current = null;
            }
        }
    }, [autorizacion, consultar, ejecucionPermitida, setResultado]);
    useEffect(() => {
        const abort = new AbortController();
        cargar(abort.signal).catch(e => {
            if (e.name !== 'AbortError')
                setError(e.message);
        });
        return () => abort.abort();
    }, [cargar]);
    useEffect(() => {
        seleccionActual.current = seleccionada;
        if (!seleccionada)
            return;
        const abort = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const leer = async () => {
            try {
                const r = await consultar<EjecucionUI>(`/api/informes/ejecuciones/${seleccionada}`, 'GET', undefined, abort.signal);
                if (!ejecucionPermitida(r))
                    throw new Error('La ejecución ya no está permitida.');
                setResultado(r);
                if (['pendiente', 'en_curso'].includes(r.estado))
                    timer = setTimeout(() => void leer(), 2000);
                else
                    await cargar(abort.signal);
            }
            catch (e) {
                if (!abort.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
                    setResultado(null);
                    setSeleccionada(null);
                    seleccionActual.current = null;
                    setError(e instanceof Error ? e.message : 'No se pudo consultar.');
                }
            }
        };
        void leer();
        return () => { abort.abort(); if (timer)
            clearTimeout(timer); };
    }, [seleccionada, observacion, consultar, ejecucionPermitida, setResultado, cargar]);
    useEffect(() => {
        if (!actual)
            return;
        const abort = new AbortController();
        consultar<{
            programaciones: ProgramacionUI[];
        }>(`/api/informes/${actual.id}/programaciones`, 'GET', undefined, abort.signal)
            .then(r => setProgramaciones(r.programaciones)).catch(e => { if (e.name !== 'AbortError')
            setError(e.message); });
        return () => abort.abort();
    }, [actual, consultar]);
    const cambiar = (c: ConfiguracionInforme) => {
        edicion.current++;
        setOcupado(false);
        setConfiguracion(c);
        setPrevia(null);
        setClaveManual(null);
        setServidorComparado(null);
    };
    const editar = (d: DefinicionUI) => {
        if (!definicionPermitida(d.configuracion, autorizacion))
            return;
        setActual(d);
        setProgramaciones([]);
        setNombre(d.nombre);
        cambiar(d.configuracion);
    };
    const revisar = async () => {
        const p = await consultarEdicion<PreviaUI>('/api/informes/vista-previa', 'POST', { configuracion });
        setPrevia(p);
        setClaveManual(crypto.randomUUID());
        setMensaje('Selección revisada durante diez minutos.');
    };
    const guardado = actual && actual.nombre === nombre && serializarCanonico(actual.configuracion) === serializarCanonico(configuracion);
    const refrescarProgramaciones = async () => {
        if (actual) {
            const r = await consultarEdicion<{
                programaciones: ProgramacionUI[];
            }>(`/api/informes/${actual.id}/programaciones`);
            setProgramaciones(r.programaciones);
            await cargar();
        }
    };
    return <div className="min-w-0 max-w-full space-y-6 [overflow-wrap:anywhere] [&_fieldset]:min-w-0 [&_select]:max-w-full [&_input]:max-w-full">
    
    <header>
    
    <h1 className="text-2xl font-semibold">Informes</h1>
    
    <p className="mt-2 text-slate-600">Capturas reproducibles del material, la carga y el estado. Archivos conservados durante treinta días.</p>
    
    </header>
    
    <div className="tarjeta p-4 shadow-sm" aria-live="polite">
    
    <p className="font-semibold">
    
    {runner?.estado ?? 'Consultando runner…'}
    
    </p>
    
    <p className="text-sm">{runner?.ultimaPasadaManual ? 'Última pasada manual registrada.' : 'Sin pasadas manuales registradas.'} · Cola propia: {runner?.cola.pendientes ?? 0} pendientes y {runner?.cola.en_curso ?? 0} en curso.</p>
    
    {runner?.ultimoError && <p className="text-sm">Último error propio: {runner.ultimoError.error_mensaje} ({runner.ultimoError.error_codigo})</p>}
    
    {runner?.programaciones.filter(p => p.atraso > 0).map(p => <p key={p.id} className="text-sm">Atraso pendiente: {p.atrasoAcotado ? 'al menos ' : ''}{p.atraso} ocurrencias · próxima UTC {p.proxima_utc}</p>)}
    
    <p className="text-sm text-slate-600">Scheduler de producción sin configurar. Entrega externa sin configurar; los resultados se descargan desde esta aplicación.</p>
    
    <button className="mt-2 underline" type="button" onClick={() => { edicion.current++; void solicitar(() => cargar()); }}>Actualizar estado</button>
    
    </div>
        
        {error && <p ref={foco} tabIndex={-1} role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
        
        {error}
        
        </p>}
        
        {error && actual && <button type="button" className="boton" onClick={() => void solicitar(async () => {
                setServidorComparado(await consultarEdicion<DefinicionUI>(`/api/informes/${actual.id}`));
                setMensaje('La edición sigue en el formulario. Compara antes de continuar.');
            })}>Comparar versión guardada</button>}

        {servidorComparado && <section className="tarjeta p-4" aria-label="Comparación de versiones">
        <h2 className="font-semibold">Versión guardada v{servidorComparado.version}: {servidorComparado.nombre}</h2>
        <p>Tu edición sigue en el formulario: {nombre}.</p>
        <p className="text-sm">Ámbito guardado: {opciones.find(o => o.id === servidorComparado.configuracion.ambito.id)?.nombre ?? servidorComparado.configuracion.ambito.id}. Formatos: {servidorComparado.configuracion.formatos.join(', ').toUpperCase()}.</p>
        <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className="boton" onClick={() => {
                edicion.current++;
                setActual(servidorComparado);
                setServidorComparado(null);
                setPrevia(null);
                setError('');
                setMensaje('Revisa tu edición otra vez antes de guardar sobre la versión actual.');
            }}>Revisar mi edición con la versión actual</button>
        <button type="button" className="boton" onClick={() => {
                editar(servidorComparado);
                setError('');
                setMensaje('Definición guardada cargada en el formulario.');
            }}>Usar la definición guardada</button>
        </div>
        </section>}

        {mensaje && <p role="status" className="rounded-lg bg-blue-50 p-3">
        
        {mensaje}
        
        </p>}
    
    
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[18rem_1fr]">
    
    <aside className="space-y-3 tarjeta p-4 shadow-sm">
    
    <h2 className="font-semibold">Mis definiciones</h2>
    
    <button type="button" className="boton" onClick={() => {
            setActual(null);
            setServidorComparado(null);
            setProgramaciones([]);
            setNombre('');
            cambiar(inicial());
        }}>Nueva definición</button>
    
    <ul className="space-y-2">
        
        {definiciones.map(d => <li key={d.id}>
        
        <button type="button" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left" aria-pressed={actual?.id === d.id} onClick={() => editar(d)}>
        
        {d.nombre}
        
        <span className="block text-xs text-slate-600">v{d.version}{d.archivada_en ? ' · Archivada' : ''}</span>
        
        </button>
        
        </li>)}
    
    </ul>
    
    </aside>
    
    <div className="min-w-0 space-y-6">
    
    <form className="space-y-5 tarjeta p-5 shadow-sm" onSubmit={e => {
            e.preventDefault();
            void solicitar(async () => {
                await revisar();
            });
        }}>
    
    <h2 className="text-lg font-semibold">
    
    {actual ? 'Editar definición' : 'Nueva definición'}
    
    </h2>
    
    <Definicion nombre={nombre} configuracion={configuracion} claves={claves} opciones={opciones} cambiarNombre={n => {
            edicion.current++;
            setOcupado(false);
            setNombre(n);
            setPrevia(null);
            setClaveManual(null);
        }} cambiar={cambiar}/>
    
    <Audiencia configuracion={configuracion} admin={admin} grupos={grupos} cambiar={cambiar}/>
    
    <div className="flex flex-wrap gap-3">
    
    <button className="boton" disabled={ocupado} type="submit">Revisar selección y audiencia</button>
    
    <button className="boton boton-principal" disabled={ocupado || !previa} type="button" onClick={() => void solicitar(async () => {
            const d = await consultarEdicion<DefinicionUI>(actual ? `/api/informes/${actual.id}` : '/api/informes', actual ? 'PATCH' : 'POST', { nombre, configuracion, ...actual ? { version: actual.version } : {} });
            setActual(d);
            await cargar();
            setMensaje('Definición guardada.');
        })}>Guardar definición revisada</button>
        
        {actual && !actual.archivada_en && <button className="boton" disabled={ocupado} type="button" onClick={() => void solicitar(async () => {
                const d = await consultarEdicion<DefinicionUI>(`/api/informes/${actual.id}`, 'PATCH', { nombre: actual.nombre, configuracion: actual.configuracion, version: actual.version, archivada: true });
                setActual(d);
                await cargar();
                setMensaje('Definición archivada y programaciones detenidas.');
            })}>Archivar</button>}
    
    </div>
        
        {previa && <section className="space-y-2 rounded-lg bg-slate-50 p-4" aria-label="Selección revisada">
        
        <h3 className="font-semibold">{previa.ambito.nombre} · {previa.ambito.salas.length} salas</h3>
        
        <ul className="max-h-56 overflow-y-auto text-sm">
        
        {previa.ambito.salas.map(s => <li key={s.id}>{s.nombre}{s.codigo ? ` (${s.codigo})` : ''} · {s.id}</li>)}
        
        </ul>
        
        <p className="break-words text-sm">Período resuelto: {JSON.stringify(previa.periodo)}</p>
        
        <p>Formatos: {configuracion.formatos.join(', ').toUpperCase()}</p>
        
        <h4 className="font-medium">Receptores efectivos</h4>
        
        <ul className="text-sm">
            
            {previa.audiencia.map(r => <li key={r.usuarioId}>{r.nombre} · {r.origenes.map((o: unknown) => String((o as {
                    tipo: string;
                }).tipo)).join(', ')}</li>)}
        
        </ul>
        
        <button className="boton boton-principal" type="button" disabled={!guardado || ocupado || !!actual?.archivada_en} onClick={() => void solicitar(async () => {
                if (!actual || !claveManual)
                    return;
                const e = await consultarEdicion<{
                    id: string;
                }>(`/api/informes/${actual.id}/ejecutar`, 'POST', { version: actual.version, vistaPrevia: { hash: previa.hash, creadaEn: previa.creadaEn }, clavePeticion: claveManual });
                setSeleccionada(e.id);
                setResultado(null);
                await cargar();
                setMensaje('Informe encolado. El runner lo procesará.');
            })}>Solicitar informe</button>
        
        {!guardado && <p className="text-sm">Guarda esta definición antes de solicitarla.</p>}
        
        <button type="button" className="ml-3 underline" onClick={() => {
                setClaveManual(crypto.randomUUID());
                setMensaje('Nueva captura preparada con otra clave.');
            }}>Preparar nueva captura</button>
        
        </section>}
    
    </form>
    
        
        {actual && !actual.archivada_en && <div className="tarjeta p-5 shadow-sm">
        
        <Programacion programaciones={programaciones} guardar={async (calendario: CalendarioInforme) => {
                await consultarEdicion(`/api/informes/${actual.id}/programaciones`, 'POST', { versionDefinicion: actual.version, calendario });
                await refrescarProgramaciones();
            }} modificar={async (p, activa, calendario) => {
                await consultarEdicion(`/api/informes/programaciones/${p.id}`, 'PATCH', { version: p.version, activa, ...calendario ? { calendario } : {} });
                await refrescarProgramaciones();
            }}/>
        
        </div>}
    
        
        {admin && <section className="space-y-3 tarjeta p-5 shadow-sm">
        
        <h2 className="text-lg font-semibold">Grupos internos</h2>
        
        <p className="text-sm text-slate-600">Un grupo distribuye el informe en su ámbito exacto; cada miembro necesita permiso propio sobre las fuentes.</p>
        
        <label className="block">Nombre del grupo<input className="campo ml-2" value={nombreGrupo} maxLength={120} onChange={e => setNombreGrupo(e.target.value)}/></label>
        
        <p className="text-sm">Ámbito: {(grupoConfig ?? configuracion).ambito.tipo} · {(grupoConfig ?? configuracion).ambito.id}</p>
        
        <Audiencia configuracion={{ ...(grupoConfig ?? configuracion), audiencia: { usuarios: miembros, grupos: [] } }} admin grupos={[]} cambiar={c => setMiembros(c.audiencia.usuarios)}/>
        
        <button type="button" className="boton" disabled={ocupado} onClick={() => void solicitar(async () => {
                await consultarEdicion(grupoEditado ? `/api/informes/grupos/${grupoEditado.id}` : '/api/informes/grupos', grupoEditado ? 'PATCH' : 'POST', { nombre: nombreGrupo, configuracion: grupoConfig ?? configuracion, miembros, ...grupoEditado ? { version: grupoEditado.version, activo: true } : {} });
                setNombreGrupo('');
                setMiembros([]);
                setGrupoEditado(null);
                setGrupoConfig(null);
                await cargar();
                setMensaje('Grupo guardado.');
            })}>
        
        {grupoEditado ? 'Guardar grupo' : 'Crear grupo con el ámbito seleccionado'}
        
        </button>
            
            {grupoEditado && <button type="button" className="ml-2 underline" onClick={() => {
                    setGrupoEditado(null);
                    setGrupoConfig(null);
                    setMiembros([]);
                    setNombreGrupo('');
                }}>Cancelar edición</button>}
        
        <ul className="space-y-2">
            
            {grupos.map(g => <li key={g.id} className="border-t pt-2">
            
            <p>{g.nombre} · {g.miembros.length} miembros · v{g.version} · {g.activo ? 'Activo' : 'Inactivo'}</p>
            
            <button type="button" className="mr-3 underline" onClick={() => {
                    setGrupoEditado(g);
                    setNombreGrupo(g.nombre);
                    setMiembros(g.miembros);
                    setGrupoConfig({ ...configuracion, ambito: g.ambito });
                }}>Editar grupo</button>
            
            <button type="button" className="underline" onClick={() => void solicitar(async () => {
                    await consultarEdicion(`/api/informes/grupos/${g.id}`, 'PATCH', { nombre: g.nombre, configuracion: { ...configuracion, ambito: g.ambito }, miembros: g.miembros, version: g.version, activo: !g.activo });
                    await cargar();
                })}>
            
            {g.activo ? 'Desactivar' : 'Activar'}
            
            </button>
            
            </li>)}
        
        </ul>
        
        </section>}
    
    
    <div className="tarjeta p-5 shadow-sm">
    
    <Historial ejecuciones={ejecuciones} ultimos={ultimos} seleccionar={id => {
            setSeleccionada(id);
            setObservacion(n => n + 1);
            setResultado(null);
        }} cursor={cursor} cargarMas={() => void solicitar(async () => {
            const numero = secuencia.current;
            const r = await consultar<{
                ejecuciones: EjecucionUI[];
                cursor: string | null;
            }>(`/api/informes/ejecuciones?cursor=${encodeURIComponent(cursor ?? '')}`);
            if (numero !== secuencia.current)
                return;
            setEjecuciones(actuales => [...actuales, ...r.ejecuciones.filter(e => ejecucionPermitida(e) && !actuales.some(a => a.id === e.id))]);
            setCursor(r.cursor);
        })}/>
    
    </div>
        
        {resultado && <div className="tarjeta p-5 shadow-sm">
        
        <Resultado ejecucion={resultado} propietario={resultado.propietario_id === usuarioId} reintentar={() => solicitar(async () => {
                await consultarEdicion(`/api/informes/ejecuciones/${resultado.id}/reintentar`, 'POST', { estado: resultado.estado, intento: resultado.intento_actual });
                setSeleccionada(resultado.id);
                // El mismo ID necesita una observación nueva: el efecto previo
                // ya terminó al leer «fallida» y React agrupa los setters.
                setObservacion(n => n + 1);
                await cargar();
            })} revocar={() => solicitar(async () => {
                await consultarEdicion(`/api/informes/ejecuciones/${resultado.id}`, 'POST', { estado: resultado.estado, intento: resultado.intento_actual });
                setResultado({ ...resultado, revocada_en: new Date().toISOString() });
                await cargar();
            })}/>
        
        </div>}
    
    </div>
    
    </div>
    
    </div>;
}

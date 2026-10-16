'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { bocaCodificada, conexionCompleta, crearBorrador, prepararGuardado, type ConexionBorrador, type GuardarEditorConexiones } from '@/lib/editor-conexiones';
import type { ArticuloElegible, Conexion, EquipoEnSala, Puerto } from '@/lib/tipos';
import { bloquesDelLienzo } from '@/lib/lienzo-conexiones';
import { reorganizarDiagrama, type OperacionDiagrama } from '@/lib/operaciones-diagrama';
import { resolverAnotacionesDeAncla, type AnotacionDiseno, type DecisionAnotacion } from '@/lib/anotaciones-diseno';

type Posiciones = Record<string, { x: number; y: number }>;
type Boca = { equipo_id: string; puerto_id: string; ordinal: number };

export interface DatosEditor {
  salaId: string;
  version: number;
  conexiones: Conexion[];
  equipos: EquipoEnSala[];
  puertos: Puerto[];
  posicionesIniciales?: Posiciones;
  anotacionesIniciales?: AnotacionDiseno[];
  cerrado: boolean;
  guardar: GuardarEditorConexiones;
}

/** El borrador entero comparte una versión y un único guardado. */
export function useEditorConexiones(datos: DatosEditor) {
  const [base, setBase] = useState(() => ({ conexiones: crearBorrador(datos.conexiones), equipos: datos.equipos, posiciones: datos.posicionesIniciales ?? {}, anotaciones: datos.anotacionesIniciales ?? [] }));
  const [borrador, setBorrador] = useState(base.conexiones);
  const [equipos, setEquipos] = useState(base.equipos);
  const [puertos, setPuertos] = useState(datos.puertos);
  const [posiciones, setPosiciones] = useState<Posiciones>(base.posiciones);
  const [anotaciones, setAnotaciones] = useState(base.anotaciones);
  const [decisionesAnotaciones, setDecisionesAnotaciones] = useState<DecisionAnotacion[]>([]);
  const [anclaPendiente, setAnclaPendiente] = useState<{ tipo: 'equipo' | 'conexion'; id: string } | null>(null);
  const [seleccionEquipos, setSeleccionEquipos] = useState<string[]>([]);
  const [vistaPrevia, setVistaPrevia] = useState<Posiciones | null>(null);
  const [historial, setHistorial] = useState<{ pasado: Posiciones[]; futuro: Posiciones[] }>({ pasado: [], futuro: [] });
  const [version, setVersion] = useState(datos.version);
  const [seleccionada, setSeleccionada] = useState<string | null>(datos.conexiones[0]?.id ?? null);
  const [estado, setEstado] = useState<string | null>(null);
  const [enConflicto, setEnConflicto] = useState(false);
  const [cargandoEquipo, setCargandoEquipo] = useState(false);
  const [pendiente, iniciarTransicion] = useTransition();
  const peticion = useRef<AbortController | null>(null);
  useEffect(() => () => peticion.current?.abort(), []);
  const bloqueado = datos.cerrado || pendiente || enConflicto || cargandoEquipo;
  const puertosPorId = useMemo(() => new Map(puertos.map((p) => [p.id, p])), [puertos]);
  const actual = borrador.find((c) => c.id === seleccionada) ?? null;
  const altasEquipo = equipos.filter((e) => !base.equipos.some((b) => b.id === e.id));
  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(base.conexiones) || altasEquipo.length > 0 || JSON.stringify(posiciones) !== JSON.stringify(base.posiciones) || JSON.stringify(anotaciones) !== JSON.stringify(base.anotaciones);

  const posicionesVisiblesActuales = () => Object.fromEntries(bloquesDelLienzo(equipos, puertos, posiciones).map(b => [b.equipo.id, { x: b.x, y: b.y }]));
  function aplicarPosiciones(siguiente: Posiciones) {
    if (bloqueado) return;
    const anterior = posicionesVisiblesActuales();
    if (JSON.stringify(anterior) === JSON.stringify(siguiente)) { setVistaPrevia(null); return; }
    setHistorial(h => ({ pasado: [...h.pasado.slice(-49), posiciones], futuro: [] }));
    setPosiciones(siguiente); setVistaPrevia(null); setEstado(null);
  }
  function deshacer() {
    if (bloqueado || vistaPrevia || !historial.pasado.length) return;
    setPosiciones(historial.pasado.at(-1)!);
    setHistorial({ pasado: historial.pasado.slice(0, -1), futuro: [posiciones, ...historial.futuro] });
  }
  function rehacer() {
    if (bloqueado || vistaPrevia || !historial.futuro.length) return;
    setPosiciones(historial.futuro[0]);
    setHistorial({ pasado: [...historial.pasado, posiciones], futuro: historial.futuro.slice(1) });
  }

  function actualizar(id: string, cambio: Partial<ConexionBorrador>) {
    if (bloqueado) return;
    setBorrador((lista) => lista.map((c) => c.id === id ? { ...c, ...cambio } : c));
    setEstado(null);
  }

  function nuevaConexion(origen?: Boca, destino?: Boca) {
    if (bloqueado) return;
    if (origen && destino) {
      const ocupadas = new Set(borrador.flatMap((c) => [bocaCodificada(c.origen_id, c.puerto_origen_id, c.puerto_origen_ordinal), bocaCodificada(c.destino_id, c.puerto_destino_id, c.puerto_destino_ordinal)]));
      if (origen.equipo_id === destino.equipo_id || [origen, destino].some((b) => ocupadas.has(bocaCodificada(b.equipo_id, b.puerto_id, b.ordinal)))) {
        setEstado('Elige dos equipos distintos y bocas libres.');
        return;
      }
    }
    const id = `temporal-${crypto.randomUUID()}`;
    setBorrador((lista) => [...lista, {
      id, temporal: true, sala_id: datos.salaId,
      origen_id: origen?.equipo_id ?? equipos[0]?.id ?? '',
      destino_id: destino?.equipo_id ?? equipos[1]?.id ?? '',
      puerto_origen_id: origen?.puerto_id ?? null, puerto_origen_ordinal: origen?.ordinal ?? null,
      puerto_destino_id: destino?.puerto_id ?? null, puerto_destino_ordinal: destino?.ordinal ?? null,
      articulo_cable_id: null, senal: origen ? puertosPorId.get(origen.puerto_id)?.senal ?? 'otro' : 'otro',
      ruta: null, longitud_manual_m: null, notas: null, puntos_paso: [], creado_en: new Date().toISOString(),
    }]);
    setSeleccionada(id);
    setEstado(null);
  }

  async function anadirEquipo(articulo: ArticuloElegible | null) {
    if (!articulo || bloqueado) return;
    const controlador = new AbortController();
    peticion.current = controlador;
    setCargandoEquipo(true);
    setEstado(null);
    try {
      const respuesta = await fetch(`/api/catalogo/${encodeURIComponent(articulo.id)}/puertos`, { signal: controlador.signal });
      if (!respuesta.ok) throw new Error('No se pudieron cargar los puertos. Vuelve a elegir el equipo.');
      const nuevos: Puerto[] = await respuesta.json();
      if (controlador.signal.aborted) return;
      const id = `equipo-${crypto.randomUUID()}`;
      setEquipos((lista) => [...lista, {
        id, sala_id: datos.salaId, articulo_id: articulo.id, nombre: articulo.etiqueta, cantidad: 1,
        extremo: 'mesa', posicion: { x_m: 0, y_m: 0, z_m: 0 }, posicion_confirmada: false, rotacion_grados: 0,
      }]);
      setPuertos((lista) => [...lista.filter((p) => p.articulo_id !== articulo.id), ...nuevos]);
      if (!nuevos.length) setEstado('Equipo añadido sin puertos definidos. Completa su ficha de catálogo para conectarlo.');
    } catch (error) {
      if (!controlador.signal.aborted) setEstado(error instanceof Error ? error.message : 'No se pudo añadir el equipo.');
    } finally {
      if (!controlador.signal.aborted) setCargandoEquipo(false);
    }
  }

  function descartar() {
    if (pendiente || cargandoEquipo) return;
    if (enConflicto) { window.location.reload(); return; }
    setBorrador(base.conexiones);
    setEquipos(base.equipos);
    setPosiciones(base.posiciones);
    setAnotaciones(base.anotaciones); setDecisionesAnotaciones([]); setAnclaPendiente(null);
    setVistaPrevia(null); setHistorial({ pasado: [], futuro: [] });
    setSeleccionada(base.conexiones[0]?.id ?? null);
    setEstado(null);
  }

  function guardarTodo() {
    if (bloqueado || vistaPrevia || anclaPendiente || !hayCambios) return;
    const incompletas = borrador.some((c) => {
      const modificada = c.temporal || JSON.stringify(c) !== JSON.stringify(base.conexiones.find((b) => b.id === c.id));
      return modificada && !conexionCompleta(c, puertosPorId);
    });
    if (incompletas) { setEstado('Completa las dos bocas de cada conexión modificada antes de guardar.'); return; }
    const entrada = prepararGuardado({ salaId: datos.salaId, versionEsperada: version, originales: base.conexiones, borrador, puertos: puertosPorId });
    entrada.equipos_alta = altasEquipo.map((e) => ({ temporal_id: e.id, articulo_id: e.articulo_id }));
    // Fijar también la colocación inicial: el orden de lectura del servidor no
    // debe reorganizar los bloques al resolver los identificadores temporales.
    const posicionesVisibles = Object.fromEntries(bloquesDelLienzo(equipos, puertos, posiciones).map((b) => [b.equipo.id, { x: b.x, y: b.y }]));
    entrada.posiciones = Object.entries(posicionesVisibles).map(([equipo_id, p]) => ({ equipo_id, ...p }));
    entrada.anotaciones = anotaciones;
    entrada.decisiones_anotaciones = decisionesAnotaciones;
    iniciarTransicion(async () => {
      try {
        const resultado = await datos.guardar(entrada);
        if (!resultado.ok) {
          setEnConflicto(resultado.motivo === 'conflicto');
          setEstado(resultado.detalle);
          return;
        }
        const idsEquipo = resultado.equipos_ids ?? {};
        const consolidadas = borrador.map((c) => ({ ...c, id: resultado.ids[c.id] ?? c.id, identificador_cable: resultado.identificadores_cable?.[resultado.ids[c.id] ?? c.id] ?? c.identificador_cable, origen_id: idsEquipo[c.origen_id] ?? c.origen_id, destino_id: idsEquipo[c.destino_id] ?? c.destino_id, temporal: false }));
        const equiposGuardados = equipos.map((e) => ({ ...e, id: idsEquipo[e.id] ?? e.id }));
        const posicionesGuardadas = Object.fromEntries(Object.entries(posicionesVisibles).map(([id, p]) => [idsEquipo[id] ?? id, p]));
        const notasGuardadas = anotaciones.map(a => ({ ...a, id: resultado.anotaciones_ids?.[a.id] ?? a.id, ancla_id: a.ancla_tipo === 'equipo' ? idsEquipo[a.ancla_id!] ?? a.ancla_id : a.ancla_tipo === 'conexion' ? resultado.ids[a.ancla_id!] ?? a.ancla_id : null }));
        setBase({ conexiones: consolidadas, equipos: equiposGuardados, posiciones: posicionesGuardadas, anotaciones: notasGuardadas });
        setAnotaciones(notasGuardadas); setDecisionesAnotaciones([]); setHistorial({ pasado: [], futuro: [] });
        setSeleccionEquipos(ids => ids.map(id => idsEquipo[id] ?? id));
        setBorrador(consolidadas); setEquipos(equiposGuardados); setPosiciones(posicionesGuardadas);
        setVersion(resultado.version);
        setSeleccionada((id) => id ? resultado.ids[id] ?? id : null);
        setEstado('Cambios guardados.');
      } catch {
        // Ante una respuesta perdida no se repite a ciegas una operación de alta.
        setEnConflicto(true);
        setEstado('No se pudo confirmar el guardado. Recarga la sala para comprobar su estado antes de continuar.');
      }
    });
  }

  function quitarAncla(tipo: 'equipo' | 'conexion', id: string, accion?: 'conservar' | 'retirar') {
    if (bloqueado) return;
    const conexionesAfectadas = tipo === 'equipo' ? borrador.filter(c => c.origen_id === id || c.destino_id === id) : [];
    const afectadas = anotaciones.filter(a => (a.ancla_tipo === tipo && a.ancla_id === id) || (a.ancla_tipo === 'conexion' && conexionesAfectadas.some(c => c.id === a.ancla_id)));
    if (afectadas.length && !accion) { setAnclaPendiente({ tipo, id }); return; }
    const decisiones = afectadas.map(a => ({ anotacion_id: a.id, accion: accion! }));
    let notas = resolverAnotacionesDeAncla(anotaciones, tipo, id, decisiones)!;
    for (const c of conexionesAfectadas) notas = resolverAnotacionesDeAncla(notas, 'conexion', c.id, decisiones)!;
    setAnotaciones(notas); setDecisionesAnotaciones(d => [...d.filter(n => !decisiones.some(s => s.anotacion_id === n.anotacion_id)), ...decisiones]);
    setAnclaPendiente(null);
    if (tipo === 'conexion') { setBorrador(lista => lista.filter(c => c.id !== id)); setSeleccionada(null); }
    else {
      setEquipos(lista => lista.filter(e => e.id !== id));
      setBorrador(lista => lista.filter(c => c.origen_id !== id && c.destino_id !== id));
      setPosiciones(lista => Object.fromEntries(Object.entries(lista).filter(([clave]) => clave !== id)));
      setSeleccionEquipos(ids => ids.filter(i => i !== id)); setVistaPrevia(null); setHistorial({ pasado: [], futuro: [] });
    }
  }

  return { equipos, puertos, posiciones, borrador, actual, seleccionada, setSeleccionada, estado, hayCambios, pendiente, cargandoEquipo, enConflicto, bloqueado, puertosPorId, actualizar, nuevaConexion, anadirEquipo, descartar, guardarTodo,
    mover: (id: string, p: { x: number; y: number }) => { if (!vistaPrevia) aplicarPosiciones({ ...posicionesVisiblesActuales(), [id]: p }); },
    quitarConexion: () => { if (actual) quitarAncla('conexion', actual.id); },
    quitarAlta: (id: string) => { if (altasEquipo.some(e => e.id === id)) quitarAncla('equipo', id); }, altasEquipo,
    seleccionEquipos, setSeleccionEquipos, vistaPrevia, deshacer, rehacer, puedeDeshacer: historial.pasado.length > 0, puedeRehacer: historial.futuro.length > 0,
    previsualizar: (operacion: OperacionDiagrama) => { if (!bloqueado && seleccionEquipos.length >= 2) setVistaPrevia(reorganizarDiagrama(equipos, puertos, borrador, posiciones, seleccionEquipos, operacion)); },
    aplicarVistaPrevia: () => { if (vistaPrevia) aplicarPosiciones(vistaPrevia); }, cancelarVistaPrevia: () => setVistaPrevia(null),
    anotaciones, anclaPendiente, cancelarBaja: () => setAnclaPendiente(null), resolverBaja: (accion: 'conservar' | 'retirar') => { if (anclaPendiente) quitarAncla(anclaPendiente.tipo, anclaPendiente.id, accion); },
    anadirAnotacion: (nota: Omit<AnotacionDiseno, 'id'>) => { if (!bloqueado && anotaciones.length < 200 && nota.texto.trim()) setAnotaciones(n => [...n, { ...nota, texto: nota.texto.trim(), id: `nota-${crypto.randomUUID()}` }]); },
    actualizarAnotacion: (id: string, texto: string) => { if (!bloqueado) setAnotaciones(n => n.map(a => a.id === id ? { ...a, texto } : a)); },
    conservarAnotacionEnSala: (id: string) => { if (!bloqueado) { setAnotaciones(n => n.map(a => a.id === id ? { ...a, ancla_tipo: 'sala', ancla_id: null, x: null, y: null } : a)); setDecisionesAnotaciones(d => [...d.filter(a => a.anotacion_id !== id), { anotacion_id: id, accion: 'conservar' }]); } },
    quitarAnotacion: (id: string) => { if (!bloqueado) { setAnotaciones(n => n.filter(a => a.id !== id)); setDecisionesAnotaciones(d => [...d.filter(a => a.anotacion_id !== id), { anotacion_id: id, accion: 'retirar' }]); } },
  };
}

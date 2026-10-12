'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { actualizarExtremoBorrador, conexionCompleta, crearBorrador, prepararGuardado, type ConexionBorrador, type GuardarEditorConexiones } from '@/lib/editor-conexiones';
import type { ArticuloElegible, Conexion, EquipoEnSala, Puerto, ExtremoConexion, TomaRed } from '@/lib/tipos';
import { bloquesDelLienzo, bloquesRosetasDelLienzo, ocupacionDeBocas } from '@/lib/lienzo-conexiones';
import { claveExtremo } from '@/lib/extremos-conexion';

type Posiciones = Record<string, { x: number; y: number }>;

export interface DatosEditor {
  salaId: string;
  version: number;
  conexiones: Conexion[];
  equipos: EquipoEnSala[];
  puertos: Puerto[];
  tomas: TomaRed[];
  posicionesIniciales?: Posiciones;
  cerrado: boolean;
  guardar: GuardarEditorConexiones;
}

/** El borrador entero comparte una versión y un único guardado. */
export function useEditorConexiones(datos: DatosEditor) {
  const [base, setBase] = useState(() => ({ conexiones: crearBorrador(datos.conexiones), equipos: datos.equipos, posiciones: datos.posicionesIniciales ?? {} }));
  const [borrador, setBorrador] = useState(base.conexiones);
  const [equipos, setEquipos] = useState(base.equipos);
  const [puertos, setPuertos] = useState(datos.puertos);
  const [posiciones, setPosiciones] = useState<Posiciones>(base.posiciones);
  const [posicionesRosetas, setPosicionesRosetas] = useState<Posiciones>({});
  const [basePosicionesRosetas, setBasePosicionesRosetas] = useState<Posiciones>({});
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
  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(base.conexiones) || altasEquipo.length > 0 || JSON.stringify(posiciones) !== JSON.stringify(base.posiciones) || JSON.stringify(posicionesRosetas) !== JSON.stringify(basePosicionesRosetas);

  function actualizar(id: string, cambio: Partial<ConexionBorrador>) {
    if (bloqueado) return;
    setBorrador((lista) => lista.map((c) => c.id === id ? { ...c, ...cambio } : c));
    setEstado(null);
  }

  function nuevaConexion(origen?: ExtremoConexion, destino?: ExtremoConexion) {
    if (bloqueado) return;
    if (origen && destino) {
      const ocupadas = ocupacionDeBocas(borrador, puertos);
      if (claveExtremo(origen) === claveExtremo(destino) || (origen.tipo === 'equipo' && destino.tipo === 'equipo' && origen.equipo_id === destino.equipo_id) || [origen, destino].some((b) => ocupadas.has(claveExtremo(b)))) {
        setEstado('Elige dos extremos distintos y bocas libres.');
        return;
      }
    }
    const id = `temporal-${crypto.randomUUID()}`;
    setBorrador((lista) => [...lista, {
      id, temporal: true, sala_id: datos.salaId,
      detalle: origen && destino ? { estado: 'completo', origen, destino } : { estado: 'legacy' },
      extremos_borrador: { origen: origen ?? null, destino: destino ?? null },
      origen_id: origen?.tipo === 'equipo' ? origen.equipo_id : null,
      destino_id: destino?.tipo === 'equipo' ? destino.equipo_id : null,
      puerto_origen_id: origen?.tipo === 'equipo' ? origen.puerto_id : null, puerto_origen_ordinal: origen?.tipo === 'equipo' ? origen.ordinal : null,
      puerto_destino_id: destino?.tipo === 'equipo' ? destino.puerto_id : null, puerto_destino_ordinal: destino?.tipo === 'equipo' ? destino.ordinal : null,
      articulo_cable_id: null, senal: origen?.tipo === 'equipo' ? puertosPorId.get(origen.puerto_id)?.senal ?? 'otro' : origen?.tipo === 'roseta' ? datos.tomas.flatMap((t) => t.bocas).find((b) => b.id === origen.toma_boca_id)?.senal ?? 'otro' : 'otro',
      ruta: null, longitud_manual_m: null, notas: null, puntos_paso: [], creado_en: new Date().toISOString(),
      estado_suministro: 'por_determinar', cable_suministrado_id: null,
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
    setPosicionesRosetas(basePosicionesRosetas);
    setSeleccionada(base.conexiones[0]?.id ?? null);
    setEstado(null);
  }

  function guardarTodo() {
    if (bloqueado || !hayCambios) return;
    const incompletas = borrador.some((c) => {
      const modificada = c.temporal || JSON.stringify(c) !== JSON.stringify(base.conexiones.find((b) => b.id === c.id));
      return modificada && !conexionCompleta(c, puertosPorId, datos.tomas);
    });
    if (incompletas) { setEstado('Completa las dos bocas de cada conexión modificada antes de guardar.'); return; }
    const entrada = prepararGuardado({ salaId: datos.salaId, versionEsperada: version, originales: base.conexiones, borrador, puertos: puertosPorId, tomas: datos.tomas });
    entrada.equipos_alta = altasEquipo.map((e) => ({ temporal_id: e.id, articulo_id: e.articulo_id }));
    // Fijar también la colocación inicial: el orden de lectura del servidor no
    // debe reorganizar los bloques al resolver los identificadores temporales.
    const posicionesVisibles = Object.fromEntries(bloquesDelLienzo(equipos, puertos, posiciones).map((b) => [b.equipo.id, { x: b.x, y: b.y }]));
    entrada.posiciones = Object.entries(posicionesVisibles).map(([equipo_id, p]) => ({ equipo_id, ...p }));
    const rosetasVisibles = Object.fromEntries(bloquesRosetasDelLienzo(datos.tomas, posicionesRosetas).map((b) => [b.toma.id, { x: b.x, y: b.y }]));
    entrada.posiciones_rosetas = Object.entries(rosetasVisibles).map(([toma_id, p]) => ({ toma_id, ...p }));
    iniciarTransicion(async () => {
      try {
        const resultado = await datos.guardar(entrada);
        if (!resultado.ok) {
          setEnConflicto(resultado.motivo === 'conflicto');
          setEstado(resultado.detalle);
          return;
        }
        const idsEquipo = resultado.equipos_ids ?? {};
        const consolidadas = borrador.map((c) => {
          const id = resultado.ids[c.id] ?? c.id;
          const etiqueta = resultado.etiquetas[id];
          if (!etiqueta?.trim()) throw new Error('Respuesta sin etiqueta confirmada.');
          const resolver = (extremo: ExtremoConexion): ExtremoConexion => extremo.tipo === 'equipo' ? { ...extremo, equipo_id: idsEquipo[extremo.equipo_id] ?? extremo.equipo_id } : extremo;
          const detalle = c.detalle.estado === 'completo' ? { estado: 'completo' as const, origen: resolver(c.detalle.origen), destino: resolver(c.detalle.destino) } : c.detalle;
          return { ...c, id, detalle, extremos_borrador: undefined, etiqueta_cable: etiqueta, origen_id: c.origen_id ? idsEquipo[c.origen_id] ?? c.origen_id : null, destino_id: c.destino_id ? idsEquipo[c.destino_id] ?? c.destino_id : null, temporal: false };
        });
        const equiposGuardados = equipos.map((e) => ({ ...e, id: idsEquipo[e.id] ?? e.id }));
        const posicionesGuardadas = Object.fromEntries(Object.entries(posicionesVisibles).map(([id, p]) => [idsEquipo[id] ?? id, p]));
        setBase({ conexiones: consolidadas, equipos: equiposGuardados, posiciones: posicionesGuardadas });
        setBorrador(consolidadas); setEquipos(equiposGuardados); setPosiciones(posicionesGuardadas);
        setBasePosicionesRosetas(rosetasVisibles); setPosicionesRosetas(rosetasVisibles);
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

  return { equipos, puertos, posiciones, borrador, actual, seleccionada, setSeleccionada, estado, hayCambios, pendiente, cargandoEquipo, enConflicto, bloqueado, puertosPorId, actualizar, nuevaConexion, anadirEquipo, descartar, guardarTodo,
    posicionesRosetas,
    elegirExtremo: (id: string, lado: 'origen' | 'destino', extremo: ExtremoConexion | null) => { if (!bloqueado) { setBorrador((lista) => lista.map((c) => c.id === id ? actualizarExtremoBorrador(c, lado, extremo) : c)); setEstado(null); } },
    moverRoseta: (id: string, p: { x: number; y: number }) => { if (!bloqueado) { setPosicionesRosetas((lista) => ({ ...lista, [id]: p })); setEstado(null); } },
    mover: (id: string, p: { x: number; y: number }) => { if (!bloqueado) { setPosiciones((lista) => ({ ...lista, [id]: p })); setEstado(null); } },
    quitarConexion: () => { if (!bloqueado && actual) { setBorrador((lista) => lista.filter((c) => c.id !== actual.id)); setSeleccionada(null); } },
    quitarAlta: (id: string) => { if (!bloqueado && altasEquipo.some((e) => e.id === id)) {
      setEquipos((lista) => lista.filter((e) => e.id !== id));
      setBorrador((lista) => lista.filter((c) => c.origen_id !== id && c.destino_id !== id));
      setPosiciones((lista) => Object.fromEntries(Object.entries(lista).filter(([clave]) => clave !== id)));
    } }, altasEquipo,
  };
}

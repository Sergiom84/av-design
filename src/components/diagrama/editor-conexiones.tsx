'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { construirDiagrama } from '@/lib/diagrama';
import {
  bocaCodificada,
  crearBorrador,
  decodificarBoca,
  prepararGuardado,
  tieneCambios,
  type ConexionBorrador,
  type GuardarEditorConexiones,
} from '@/lib/editor-conexiones';
import {
  ETIQUETA_RUTA,
  ETIQUETA_SENAL,
  type Articulo,
  type Conexion,
  type EquipoEnSala,
  type Puerto,
  type Ruta,
  type Sala,
  type Senal,
} from '@/lib/tipos';
import { Aviso, Boton, Tarjeta, Vacio } from '@/components/ui';
import { DibujoEsquema } from './dibujo-esquema';
import { GuardiaSalida } from '@/components/plano-editor/guardia-salida';

const mensajeError = {
  conflicto: 'La sala cambió en otra pestaña. Recarga antes de volver a guardar.',
  ajeno: 'Una conexión o un equipo ya no pertenece a esta sala.',
  invalido: 'El servidor rechazó el borrador. Revisa las bocas y los datos de la conexión.',
  cerrado: 'La obra está cerrada. No se pueden guardar conexiones.',
  no_existe: 'La sala ya no existe.',
} as const;

interface Props {
  sala: Sala;
  version: number;
  conexiones: Conexion[];
  equipos: EquipoEnSala[];
  puertos: Puerto[];
  articulos: Articulo[];
  cerrado: boolean;
  guardar: GuardarEditorConexiones;
}

export function EditorConexiones({ sala, version: versionInicial, conexiones, equipos, puertos, articulos, cerrado, guardar }: Props) {
  const [originales, setOriginales] = useState(conexiones);
  const [borrador, setBorrador] = useState(() => crearBorrador(conexiones));
  const [version, setVersion] = useState(versionInicial);
  const [seleccionada, setSeleccionada] = useState<string | null>(conexiones[0]?.id ?? null);
  const [estado, setEstado] = useState<string | null>(null);
  const [enConflicto, setEnConflicto] = useState(false);
  const [pendiente, iniciarTransicion] = useTransition();
  const router = useRouter();
  const puertosPorId = useMemo(() => new Map(puertos.map((puerto) => [puerto.id, puerto])), [puertos]);
  const cables = useMemo(() => articulos.filter((articulo) => articulo.tipo === 'cable'), [articulos]);
  const actual = borrador.find((conexion) => conexion.id === seleccionada) ?? null;
  const entrada = prepararGuardado({ salaId: sala.id, versionEsperada: version, originales, borrador, puertos: puertosPorId });
  const hayCambios = tieneCambios(entrada);
  const incompletas = borrador.filter((conexion) => !conexion.puerto_origen_id || !conexion.puerto_origen_ordinal || !conexion.puerto_destino_id || !conexion.puerto_destino_ordinal);

  const puertosPorArticulo = useMemo(() => puertos.reduce((mapa, puerto) => {
    const lista = mapa.get(puerto.articulo_id) ?? [];
    lista.push(puerto);
    mapa.set(puerto.articulo_id, lista);
    return mapa;
  }, new Map<string, Puerto[]>()), [puertos]);
  const escena = construirDiagrama({ equipos, conexiones: borrador, puertosPorArticulo, soloConectados: false });

  function actualizar(id: string, cambio: Partial<ConexionBorrador>) {
    if (cerrado) return;
    setBorrador((lista) => lista.map((conexion) => conexion.id === id ? { ...conexion, ...cambio } : conexion));
    setEstado(null);
  }

  function elegirBoca(lado: 'origen' | 'destino', valor: string) {
    if (!actual) return;
    const boca = decodificarBoca(valor);
    if (lado === 'origen') actualizar(actual.id, {
      origen_id: boca?.equipo_id ?? actual.origen_id,
      puerto_origen_id: boca?.puerto_id ?? null,
      puerto_origen_ordinal: boca?.ordinal ?? null,
    });
    else actualizar(actual.id, {
      destino_id: boca?.equipo_id ?? actual.destino_id,
      puerto_destino_id: boca?.puerto_id ?? null,
      puerto_destino_ordinal: boca?.ordinal ?? null,
    });
  }

  function opcionesBoca(lado: 'origen' | 'destino') {
    const equipoDelOtroExtremo = lado === 'origen' ? actual?.destino_id : actual?.origen_id;
    const ocupadas = new Set(borrador.flatMap((conexion) => conexion.id === actual?.id ? [] : [
      bocaCodificada(conexion.origen_id, conexion.puerto_origen_id, conexion.puerto_origen_ordinal),
      bocaCodificada(conexion.destino_id, conexion.puerto_destino_id, conexion.puerto_destino_ordinal),
    ].filter(Boolean)));
    return equipos.filter((equipo) => equipo.id !== equipoDelOtroExtremo).flatMap((equipo) => (puertosPorArticulo.get(equipo.articulo_id) ?? []).flatMap((puerto) =>
      Array.from({ length: Math.max(1, puerto.total) }, (_, indice) => ({
        valor: bocaCodificada(equipo.id, puerto.id, indice + 1),
        etiqueta: `${equipo.nombre} · ${puerto.nombre}${puerto.total > 1 ? ` ${indice + 1}` : ''}`,
      })).filter((opcion) => !ocupadas.has(opcion.valor)),
    ));
  }

  function nuevaConexion() {
    if (cerrado) return;
    const id = `temporal-${crypto.randomUUID()}`;
    const conexion: ConexionBorrador = {
      id, temporal: true, sala_id: sala.id,
      origen_id: equipos[0]?.id ?? '', destino_id: equipos[1]?.id ?? equipos[0]?.id ?? '',
      puerto_origen_id: null, puerto_origen_ordinal: null,
      puerto_destino_id: null, puerto_destino_ordinal: null,
      articulo_cable_id: null, senal: 'otro', ruta: null,
      longitud_manual_m: null, notas: null, puntos_paso: [],
    };
    setBorrador((lista) => [...lista, conexion]);
    setSeleccionada(id);
    setEstado(null);
  }

  function descartar() {
    if (enConflicto) {
      router.refresh();
      return;
    }
    setBorrador(crearBorrador(originales));
    setSeleccionada(originales[0]?.id ?? null);
    setEstado(null);
  }

  function guardarTodo() {
    if (incompletas.some((conexion) => conexion.temporal)) {
      setEstado('Completa las dos bocas de cada conexión nueva antes de guardar.');
      return;
    }
    iniciarTransicion(async () => {
      const resultado = await guardar(entrada);
      if (!resultado.ok) {
        setEnConflicto(resultado.motivo === 'conflicto');
        setEstado(resultado.detalle || mensajeError[resultado.motivo]);
        return;
      }
      const consolidadas = borrador.map((conexion) => ({
        ...conexion,
        id: conexion.temporal ? (resultado.ids[conexion.id] ?? conexion.id) : conexion.id,
        temporal: false,
      }));
      setVersion(resultado.version);
      setEnConflicto(false);
      setOriginales(consolidadas);
      setBorrador(consolidadas);
      setSeleccionada((id) => id ? (resultado.ids[id] ?? id) : null);
      setEstado('Cambios guardados.');
    });
  }

  return <>
    <GuardiaSalida activo={hayCambios && !cerrado} superficie="diagrama" />
    {cerrado && <div className="mb-6"><Aviso tono="alerta">La obra está cerrada: el diagrama se ve pero no se toca.</Aviso></div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0">
    <Tarjeta titulo="Editor de conexiones" acciones={<Boton tipo="button" variante="secundario" onClick={nuevaConexion} disabled={cerrado || equipos.length < 2}>Nueva conexión</Boton>}>
      {equipos.length === 0 ? <Vacio>La sala no tiene equipos.</Vacio> : borrador.length === 0 ? <Vacio>Sin conexiones. Añade la primera seleccionando sus dos bocas.</Vacio> : <DibujoEsquema escena={escena} conexionSeleccionada={seleccionada} onSeleccionarConexion={setSeleccionada} />}
    </Tarjeta>

    <aside className="space-y-4 min-w-0" aria-label="Inspector de conexión">
      <Tarjeta titulo="Conexión seleccionada">
        {!actual ? <Vacio>Selecciona una línea o crea una conexión.</Vacio> : <div className="space-y-4">
          {(!actual.puerto_origen_id || !actual.puerto_destino_id) && <Aviso tono="neutro">Conexión histórica: completa sus dos bocas físicas para actualizarla.</Aviso>}
          <label className="block"><span className="t-etiqueta block mb-1">Origen y boca</span><select disabled={cerrado} className="w-full" aria-label="Origen y boca" value={bocaCodificada(actual.origen_id, actual.puerto_origen_id, actual.puerto_origen_ordinal)} onChange={(e) => elegirBoca('origen', e.target.value)}><option value="">Seleccionar boca</option>{opcionesBoca('origen').map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}</select></label>
          <label className="block"><span className="t-etiqueta block mb-1">Destino y boca</span><select disabled={cerrado} className="w-full" aria-label="Destino y boca" value={bocaCodificada(actual.destino_id, actual.puerto_destino_id, actual.puerto_destino_ordinal)} onChange={(e) => elegirBoca('destino', e.target.value)}><option value="">Seleccionar boca</option>{opcionesBoca('destino').map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}</select></label>
          <div className="grid sm:grid-cols-2 xl:grid-cols-1 gap-3">
            <label><span className="t-etiqueta block mb-1">Señal</span><select disabled={cerrado} className="w-full" aria-label="Señal" value={actual.senal} onChange={(e) => actualizar(actual.id, { senal: e.target.value as Senal })}>{Object.entries(ETIQUETA_SENAL).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label>
            <label><span className="t-etiqueta block mb-1">Ruta</span><select disabled={cerrado} className="w-full" aria-label="Ruta" value={actual.ruta ?? ''} onChange={(e) => actualizar(actual.id, { ruta: (e.target.value || null) as Ruta | null })}><option value="">{ETIQUETA_RUTA[sala.ruta_por_defecto]} (sala)</option>{Object.entries(ETIQUETA_RUTA).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label>
          </div>
          <label className="block"><span className="t-etiqueta block mb-1">Cable</span><select disabled={cerrado} className="w-full" aria-label="Cable" value={actual.articulo_cable_id ?? ''} onChange={(e) => actualizar(actual.id, { articulo_cable_id: e.target.value || null })}><option value="">Sin asignar</option>{cables.map((cable) => <option key={cable.id} value={cable.id}>{`${cable.marca ?? ''} ${cable.modelo}`.trim()}</option>)}</select></label>
          <Boton tipo="button" variante="peligro" disabled={cerrado} onClick={() => { setBorrador((lista) => lista.filter((conexion) => conexion.id !== actual.id)); setSeleccionada(null); setEstado(null); }}>Quitar conexión</Boton>
        </div>}
      </Tarjeta>
      <Tarjeta titulo="Borrador" variante="operativa">
        <p aria-live="polite" className="text-tinta-tenue mb-3">{estado ?? (hayCambios ? 'Hay cambios sin guardar.' : 'Sin cambios pendientes.')}</p>
        <div className="flex flex-wrap gap-2"><Boton tipo="button" onClick={guardarTodo} disabled={cerrado || pendiente || enConflicto || !hayCambios}>{pendiente ? 'Guardando…' : 'Guardar borrador'}</Boton><Boton tipo="button" variante="secundario" onClick={descartar} disabled={cerrado || pendiente || (!enConflicto && !hayCambios)}>{enConflicto ? 'Recargar sala' : 'Descartar'}</Boton></div>
      </Tarjeta>
    </aside>
  </div></>;
}

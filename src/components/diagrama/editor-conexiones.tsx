'use client';

import { bocaCodificada, extremoCodificado, decodificarExtremo, extremoDelBorrador, type GuardarEditorConexiones } from '@/lib/editor-conexiones';
import { avisosDeConexion, identificadoresDeCable } from '@/lib/cable-schedule';
import { calcularConexion, diagnosticarCalculoConexion } from '@/lib/calculo-cable';
import { ETIQUETA_RUTA, ETIQUETA_SENAL, type Articulo, type Conexion, type EquipoEnSala, type ParametrosCable, type Puerto, type Ruta, type Sala, type Senal, type TomaRed } from '@/lib/tipos';
import { Aviso, Boton, Tarjeta, Vacio } from '@/components/ui';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { GuardiaSalida } from '@/components/plano-editor/guardia-salida';
import { LienzoConexiones } from './lienzo-conexiones';
import { useEditorConexiones } from './use-editor-conexiones';
import { resolverLadoConexion } from '@/lib/extremos-conexion';
import { PARAMETROS_POR_DEFECTO } from '@/lib/tipos';
import { ocupacionDeBocas } from '@/lib/lienzo-conexiones';
import { claveExtremo } from '@/lib/extremos-conexion';
import { etiquetaLatiguillo, latiguilloAsignableATirada, type CableSuministrado, type EstadoSuministroCable } from '@/lib/suministros';

interface Props {
  sala: Sala;
  version: number;
  conexiones: Conexion[];
  equipos: EquipoEnSala[];
  puertos: Puerto[];
  tomas: TomaRed[];
  articulos: Articulo[];
  latiguillos?: CableSuministrado[];
  parametros?: ParametrosCable;
  posicionesIniciales?: Record<string, { x: number; y: number }>;
  cerrado: boolean;
  guardar: GuardarEditorConexiones;
}

export function EditorConexiones(props: Props) {
  const e = useEditorConexiones({ ...props, salaId: props.sala.id });
  const { actual, bloqueado } = e;
  const identificadores = identificadoresDeCable(e.borrador);
  const cables = props.articulos.filter((a) => a.tipo === 'cable');
  const equiposPorId = new Map(e.equipos.map((equipo) => [equipo.id, equipo]));
  const contexto = { tomas: new Map(props.tomas.map((t) => [t.id, t])), puertos: e.puertosPorId };
  const resolver = (c: Conexion, lado: 'origen' | 'destino') => resolverLadoConexion(c, lado, equiposPorId, contexto, props.parametros ?? PARAMETROS_POR_DEFECTO);
  const puertoResuelto = (lado: 'origen' | 'destino') => {
    const extremo = actual ? resolver(actual, lado) : null;
    return extremo?.senal && extremo.sentido ? { senal: extremo.senal, sentido: extremo.sentido } : undefined;
  };
  const avisos = actual ? [...avisosDeConexion(actual, puertoResuelto('origen'), puertoResuelto('destino'), cables.find((c) => c.id === actual.articulo_cable_id)),
    ...diagnosticarCalculoConexion(actual, props.sala, equiposPorId, new Map(props.articulos.map((a) => [a.id, a])), props.parametros, contexto)] : [];
  const extremoNuevo = actual && e.altasEquipo.some((equipo) => [actual.origen_id, actual.destino_id].includes(equipo.id));
  const longitud = actual && (!extremoNuevo || actual.longitud_manual_m != null) && (actual.longitud_manual_m != null || (props.sala.largo_m && props.sala.ancho_m && props.sala.alto_m)) && props.parametros
    ? calcularConexion(actual, props.sala, new Map(e.equipos.map((equipo) => [equipo.id, equipo])), new Map(props.articulos.map((a) => [a.id, a])), props.parametros, { tomas: new Map(props.tomas.map((t) => [t.id, t])), puertos: e.puertosPorId })
    : null;

  function elegirBoca(lado: 'origen' | 'destino', valor: string) {
    if (!actual) return;
    e.elegirExtremo(actual.id, lado, decodificarExtremo(valor));
  }

  function opcionesBoca(lado: 'origen' | 'destino') {
    const otro = lado === 'origen' ? actual?.destino_id : actual?.origen_id;
    const ocupadas = ocupacionDeBocas(e.borrador.filter((c) => c.id !== actual?.id), e.puertos);
    const otroExtremo = actual ? extremoDelBorrador(actual, lado === 'origen' ? 'destino' : 'origen') : null;
    const libre = (valor: string) => {
      const extremo = decodificarExtremo(valor);
      return extremo && !ocupadas.has(claveExtremo(extremo)) && (!otroExtremo || claveExtremo(extremo) !== claveExtremo(otroExtremo));
    };
    const deEquipos = e.equipos.filter((equipo) => equipo.id !== otro && equipo.cantidad === 1).flatMap((equipo) => {
      const repetidos = e.equipos.filter((otroEquipo) => otroEquipo.nombre === equipo.nombre);
      const nombre = `${equipo.nombre}${repetidos.length > 1 ? ` ${repetidos.findIndex((r) => r.id === equipo.id) + 1}` : ''}`;
      return e.puertos.filter((p) => p.articulo_id === equipo.articulo_id).flatMap((p) => Array.from({ length: p.total }, (_, i) => ({
        valor: bocaCodificada(equipo.id, p.id, i + 1), etiqueta: `${nombre} · ${p.nombre}${p.total > 1 ? ` ${i + 1}` : ''}`,
      })).filter((opcion) => libre(opcion.valor)));
    });
    const deRosetas = props.tomas.flatMap((t) => t.bocas.map((b) => ({ valor: extremoCodificado({ tipo: 'roseta', toma_boca_id: b.id }), etiqueta: [t.codigo, b.etiqueta ?? ('Boca ' + b.ordinal)].join(' · ') }))).filter((o) => libre(o.valor));
    return [...deEquipos, ...deRosetas];
  }

  return <>
    <GuardiaSalida activo={e.hayCambios && !props.cerrado} superficie="diagrama" />
    {props.cerrado && <div className="mb-6"><Aviso tono="alerta">La obra está cerrada: el diagrama se ve pero no se toca.</Aviso></div>}
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0">
      <Tarjeta titulo="Editor de conexiones" acciones={<Boton tipo="button" variante="secundario" onClick={() => e.nuevaConexion()} disabled={bloqueado || (e.equipos.length + props.tomas.length) < 2}>Nueva conexión</Boton>}>
        <fieldset disabled={bloqueado} className="min-w-0 mb-4">
          <BuscadorArticulo etiqueta="Añadir equipo" tipo="equipo" className="w-full sm:max-w-lg" vaciarAlElegir alElegir={e.anadirEquipo} />
        </fieldset>
        {e.cargandoEquipo && <p role="status">Cargando puertos…</p>}
        {e.equipos.length === 0 && props.tomas.length === 0 ? <Vacio>Busca un equipo para empezar el diagrama.</Vacio> : <LienzoConexiones
          tomas={props.tomas} posicionesRosetas={e.posicionesRosetas} onMoverRoseta={e.moverRoseta} equipos={e.equipos} puertos={e.puertos} conexiones={e.borrador} posiciones={e.posiciones}
          onMover={e.mover} onConectar={e.nuevaConexion} onSeleccionarConexion={e.setSeleccionada}
          conexionSeleccionada={e.seleccionada} bloqueado={bloqueado}
        />}
        {e.altasEquipo.length > 0 && <ul className="mt-4 space-y-2" aria-label="Equipos nuevos sin guardar">
          {e.altasEquipo.map((equipo) => <li key={equipo.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words">{equipo.nombre} · Sin guardar</span>
            <Boton tipo="button" variante="secundario" disabled={bloqueado} onClick={() => e.quitarAlta(equipo.id)} aria-label={`Quitar del borrador ${equipo.nombre}`}>Quitar del borrador</Boton>
          </li>)}
        </ul>}
      </Tarjeta>
      <aside className="space-y-4 min-w-0" aria-label="Inspector de conexión">
        <Tarjeta titulo="Conexión seleccionada">
          {e.borrador.length > 0 && <label className="block mb-4"><span className="t-etiqueta block mb-1">Conexión</span>
            <select className="w-full min-w-0" aria-label="Seleccionar conexión" value={e.seleccionada ?? ''} onChange={(evento) => e.setSeleccionada(evento.target.value || null)}>
              <option value="">Seleccionar conexión</option>
              {e.borrador.map((c) => <option key={c.id} value={c.id}>{identificadores.get(c.id)} · {resolver(c, 'origen')?.nombre ?? 'Origen'} → {resolver(c, 'destino')?.nombre ?? 'Destino'}{c.detalle.estado !== 'completo' ? ' · Sin puertos' : ''}</option>)}
            </select>
          </label>}
          {!actual ? <Vacio>Selecciona dos puertos para conectarlos o una línea para editarla.</Vacio> : <fieldset disabled={bloqueado} className="space-y-4 min-w-0">
            {(actual.detalle.estado !== 'completo') && <Aviso tono="neutro">Completa las dos bocas físicas de la conexión.</Aviso>}
            {(['origen', 'destino'] as const).map((lado) => <label key={lado} className="block"><span className="t-etiqueta block mb-1">{lado === 'origen' ? 'Origen y boca' : 'Destino y boca'}</span>
              <select className="w-full min-w-0" aria-label={lado === 'origen' ? 'Origen y boca' : 'Destino y boca'} value={extremoCodificado(extremoDelBorrador(actual, lado))} onChange={(evento) => elegirBoca(lado, evento.target.value)}>
                <option value="">Seleccionar boca</option>{opcionesBoca(lado).map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
              </select>
            </label>)}
            <div className="grid sm:grid-cols-2 2xl:grid-cols-1 gap-3">
              <label><span className="t-etiqueta block mb-1">Señal</span><select className="w-full" aria-label="Señal" value={actual.senal} onChange={(evento) => e.actualizar(actual.id, { senal: evento.target.value as Senal })}>{Object.entries(ETIQUETA_SENAL).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label>
              <label><span className="t-etiqueta block mb-1">Ruta</span><select className="w-full" aria-label="Ruta" value={actual.ruta ?? ''} onChange={(evento) => e.actualizar(actual.id, { ruta: (evento.target.value || null) as Ruta | null })}><option value="">{ETIQUETA_RUTA[props.sala.ruta_por_defecto]} (sala)</option>{Object.entries(ETIQUETA_RUTA).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label>
            </div>
            <label className="block"><span className="t-etiqueta block mb-1">Cable</span><select className="w-full" aria-label="Cable" value={actual.articulo_cable_id ?? ''} onChange={(evento) => e.actualizar(actual.id, { articulo_cable_id: evento.target.value || null })}><option value="">Sin asignar</option>{cables.map((c) => <option key={c.id} value={c.id}>{`${c.marca ?? ''} ${c.modelo}`.trim()}</option>)}</select></label>
            <label className="block"><span className="t-etiqueta block mb-1">Suministro del cable</span>
              <select className="w-full" aria-label="Suministro del cable" value={actual.estado_suministro ?? 'por_determinar'} onChange={(evento) => {
                const estado = evento.target.value as EstadoSuministroCable;
                e.actualizar(actual.id, { estado_suministro: estado, cable_suministrado_id: estado === 'incluido' ? actual.cable_suministrado_id ?? null : null });
              }}>
                <option value="por_determinar">Por determinar</option>
                <option value="adicional">Adicional (compra)</option>
                <option value="incluido">Incluido (latiguillo)</option>
              </select>
            </label>
            {(actual.estado_suministro ?? 'por_determinar') === 'incluido' && <label className="block"><span className="t-etiqueta block mb-1">Latiguillo suministrado</span>
              <select className="w-full" aria-label="Latiguillo suministrado" value={actual.cable_suministrado_id ?? ''} onChange={(evento) => e.actualizar(actual.id, { cable_suministrado_id: evento.target.value || null })}>
                <option value="">Elegir latiguillo</option>
                {(props.latiguillos ?? []).filter((k) => latiguilloAsignableATirada(k, actual, new Set((props.latiguillos ?? []).filter((otro) =>
                  e.borrador.some((c) => c.id !== actual.id && c.cable_suministrado_id === otro.id)).map((otro) => otro.id)))).map((k) =>
                  <option key={k.id} value={k.id}>{etiquetaLatiguillo(k)}</option>)}
              </select>
            </label>}
            <p className="font-mono" aria-label="Longitud del cable">{longitud ? `${longitud.longitud_m.toLocaleString('es-ES', { maximumFractionDigits: 2 })} m${longitud.manual ? ' · Manual' : ' · Calculados desde Plano'}` : extremoNuevo ? 'Longitud disponible al guardar el equipo' : 'Longitud pendiente de cálculo'}</p>
            {avisos.map((aviso) => <Aviso key={aviso}>{aviso}</Aviso>)}
            <Boton tipo="button" variante="peligro" onClick={e.quitarConexion}>Quitar conexión</Boton>
          </fieldset>}
        </Tarjeta>
        <Tarjeta titulo="Borrador" variante="operativa">
          <p aria-live="polite" className="text-tinta-tenue mb-3">{e.estado ?? (e.hayCambios ? 'Hay cambios sin guardar.' : 'Sin cambios pendientes.')}</p>
          <div className="flex flex-wrap gap-2">
            <Boton tipo="button" onClick={e.guardarTodo} disabled={bloqueado || !e.hayCambios}>{e.pendiente ? 'Guardando…' : 'Guardar borrador'}</Boton>
            <Boton tipo="button" variante="secundario" onClick={e.descartar} disabled={props.cerrado || e.pendiente || e.cargandoEquipo || (!e.enConflicto && !e.hayCambios)}>{e.enConflicto ? 'Recargar sala' : 'Descartar'}</Boton>
          </div>
        </Tarjeta>
      </aside>
    </div>
  </>;
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { convertirAsignacionToma } from '@/app/acciones';
import { Boton, Campo, Aviso } from '@/components/ui';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { ETIQUETA_RUTA, ETIQUETA_SENAL, type EquipoEnSala, type Puerto, type TomaRed, type Conexion } from '@/lib/tipos';
import { claveExtremo } from '@/lib/extremos-conexion';

export function ConvertirAsignacionToma({ equipo, toma, puertos, conexiones, version, cerrado,
  convertirAccion = convertirAsignacionToma }: {
  equipo: EquipoEnSala; toma: TomaRed; puertos: Puerto[]; conexiones: Conexion[]; version: number; cerrado: boolean;
  convertirAccion?: typeof convertirAsignacionToma;
}) {
  const router = useRouter();
  const [pendiente, transicion] = useTransition();
  const [confirmada, setConfirmada] = useState<{ id: string; version: number } | null>(null);
  const registrada = equipo.toma_red_conexion_id ??
    (confirmada && version < confirmada.version ? confirmada.id : null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cable, setCable] = useState<string | null>(null);
  const ocupadas = new Set(conexiones.flatMap((c) => c.detalle.estado === 'completo'
    ? [claveExtremo(c.detalle.origen), claveExtremo(c.detalle.destino)] : []));
  const existentes = conexiones.flatMap((conexion) => {
    if (conexion.sala_id !== equipo.sala_id || conexion.detalle.estado !== 'completo') return [];
    const { origen, destino } = conexion.detalle;
    const extremoEquipo = origen.tipo === 'equipo' ? origen : destino;
    const extremoToma = origen.tipo === 'roseta' ? origen : destino;
    if (extremoEquipo.tipo !== 'equipo' || extremoToma.tipo !== 'roseta' || extremoEquipo.equipo_id !== equipo.id) return [];
    const boca = toma.bocas.find((b) => b.id === extremoToma.toma_boca_id);
    const puerto = puertos.find((p) => p.id === extremoEquipo.puerto_id && p.articulo_id === equipo.articulo_id);
    if (!boca || !puerto || extremoEquipo.ordinal < 1 || extremoEquipo.ordinal > puerto.total) return [];
    return [{ conexion, extremoEquipo, boca, puerto }];
  });
  if (registrada) return <Link href={`/salas/${equipo.sala_id}/diagrama`}>{equipo.nombre}: conexión registrada</Link>;
  if (cerrado) return <span>{equipo.nombre}: asignación documental</span>;
  if (toma.capacidad_documentada === null) return <p>{equipo.nombre}: documenta las bocas en Plano para crear su conexión.</p>;

  function guardar(datos: FormData, cableId = cable) {
    if (pendiente || registrada) return;
    const [puerto, ordinal] = String(datos.get('boca_equipo') ?? '').split('|');
    datos.set('sala_id', equipo.sala_id);
    datos.set('equipo_id', equipo.id);
    datos.set('versionEsperada', String(version));
    datos.set('puerto_id', puerto ?? '');
    datos.set('ordinal', ordinal ?? '');
    datos.set('articulo_cable_id', cableId ?? '');
    transicion(async () => {
      try {
        const resultado = await convertirAccion(datos);
        if (!resultado.ok) { setMensaje(resultado.detalle); return; }
        setConfirmada({ id: resultado.id, version: resultado.version });
        router.refresh();
      } catch { setMensaje('No se pudo confirmar la conexión. Recarga para comprobar su estado.'); }
    });
  }

  return <details className="relative min-w-0">
    <summary>{equipo.nombre}: convertir asignación en conexión</summary>
    {existentes.map(({ conexion, extremoEquipo, boca, puerto }) =>
      <Boton key={conexion.id} tipo="button" className="mt-3 max-w-full whitespace-normal text-left [overflow-wrap:anywhere]" disabled={pendiente} onClick={() => {
        const datos = new FormData();
        datos.set('boca_equipo', `${puerto.id}|${extremoEquipo.ordinal}`);
        datos.set('toma_boca_id', boca.id);
        datos.set('senal', conexion.senal);
        datos.set('ruta', conexion.ruta ?? '');
        datos.set('longitud_manual_m', conexion.longitud_manual_m === null ? '' : String(conexion.longitud_manual_m));
        guardar(datos, conexion.articulo_cable_id);
      }}>
        Enlazar conexión existente: {puerto.nombre} {extremoEquipo.ordinal} → {toma.codigo} · {boca.etiqueta ?? `Boca ${boca.ordinal}`}
      </Boton>)}
    <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); guardar(new FormData(e.currentTarget)); }}>
      <fieldset disabled={pendiente} className="min-w-0 space-y-3">
        <Campo etiqueta="Puerto del equipo"><select name="boca_equipo" required defaultValue="" className="w-full">
          <option value="">Elegir boca</option>
          {puertos.filter((p) => p.articulo_id === equipo.articulo_id).flatMap((p) =>
            Array.from({ length: p.total }, (_, i) => i + 1)
              .filter((ordinal) => !ocupadas.has(`${equipo.id}:${p.id}:${ordinal}`))
              .map((ordinal) => <option key={`${p.id}:${ordinal}`} value={`${p.id}|${ordinal}`}>
              {p.nombre}{p.total > 1 ? ` ${ordinal}` : ''}
            </option>))}
        </select></Campo>
        <Campo etiqueta="Boca de roseta"><select name="toma_boca_id" required defaultValue="" className="w-full">
          <option value="">Elegir boca</option>
          {toma.bocas.filter((b) => !ocupadas.has(`roseta:${b.id}`)).map((b) =>
            <option key={b.id} value={b.id}>{toma.codigo} · {b.etiqueta ?? `Boca ${b.ordinal}`}</option>)}
        </select></Campo>
        <Campo etiqueta="Señal"><select name="senal" required defaultValue="" className="w-full">
          <option value="">Elegir señal</option>
          {Object.entries(ETIQUETA_SENAL).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
        </select></Campo>
        <BuscadorArticulo etiqueta="Cable" tipo="cable" className="w-full" alElegir={(a) => setCable(a?.id ?? null)} />
        <Campo etiqueta="Ruta"><select name="ruta" defaultValue="" className="w-full">
          <option value="">La de la sala</option>
          {Object.entries(ETIQUETA_RUTA).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
        </select></Campo>
        <Campo etiqueta="Longitud manual (m)"><input name="longitud_manual_m" type="number" min="0.01" step="0.01" className="w-full" /></Campo>
        <Boton>{pendiente ? 'Guardando…' : 'Crear conexión'}</Boton>
      </fieldset>
      {mensaje && <Aviso tono="neutro">{mensaje}</Aviso>}
    </form>
  </details>;
}

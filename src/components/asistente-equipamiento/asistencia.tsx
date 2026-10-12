import Link from 'next/link';
import { ETIQUETA_SENAL, ETIQUETA_SENTIDO, type Puerto } from '@/lib/tipos';
import {
  captacionDeVoz,
  perfilEquipo,
  revisarSeleccion,
  resumenPuertos,
  type SeleccionAsistente,
} from '@/lib/asistente-equipamiento';
import type { DatoTecnico } from '@/lib/ficha-tecnica';
import type { AvisoTecnico } from '@/lib/revision-tecnica';

export function AvisosSeleccion({
  equipos,
  candidato,
  hechos,
}: {
  equipos: SeleccionAsistente[];
  candidato?: SeleccionAsistente;
  hechos?: Map<string, DatoTecnico[]>;
}) {
  const avisos = revisarSeleccion(equipos, candidato, hechos);
  return <div aria-live="polite" className="min-w-0 [overflow-wrap:anywhere]">
    {avisos.length > 0 && <ul aria-label="Avisos de selección" className="mb-4 space-y-2 text-tinta-tenue">
      {avisos.map((aviso) => {
        const equipoId = aviso.elemento?.equipo_id;
        return <li key={aviso.clave}>
          <p>{aviso.mensaje}</p>
          {aviso.elemento && (equipoId
            ? <a className="text-acento underline" href={`#equipo-${equipoId}`}>{aviso.elemento.nombre}</a>
            : <span>{aviso.elemento.nombre}</span>)}
          {aviso.accion && <p>{aviso.accion}</p>}
        </li>;
      })}
    </ul>}
  </div>;
}

export function AvisosTecnicos({ avisos }: { avisos: AvisoTecnico[] }) {
  if (avisos.length === 0) return null;
  return <div aria-live="polite" className="min-w-0 [overflow-wrap:anywhere]">
    <ul aria-label="Avisos técnicos" className="mb-4 space-y-2 text-tinta-tenue">
      {avisos.map((aviso) => {
        const anclaEquipo = aviso.elemento.tipo === 'equipo' ? `#equipo-${aviso.elemento.id}` : null;
        return <li key={aviso.clave}>
          <p>{aviso.causa}</p>
          {anclaEquipo
            ? <a className="text-acento underline" href={anclaEquipo}>{aviso.elemento.nombre}</a>
            : <span>{aviso.elemento.nombre}</span>}
          {aviso.accion.destino
            ? <p><a className="text-acento underline" href={aviso.accion.destino}>{aviso.accion.texto}</a></p>
            : <p>{aviso.accion.texto}</p>}
        </li>;
      })}
    </ul>
  </div>;
}

export function DatosEquipo({
  equipo, puertos, avisoPuertos, hechos = [],
}: {
  equipo: SeleccionAsistente; puertos: Puerto[]; avisoPuertos?: string; hechos?: DatoTecnico[];
}) {
  const resumen = equipo.articulo_id ? resumenPuertos(puertos, equipo.articulo_id) : [];
  const perfil = perfilEquipo(equipo.referencia);
  const captacion = captacionDeVoz(equipo.referencia, hechos);
  const ocultaPerfil = captacion.captacion === 'desconocida' || captacion.procedencia === 'sin_documentar';
  const nota = ocultaPerfil ? captacion.nota : (captacion.nota ?? perfil.nota);
  const fuente = ocultaPerfil ? captacion.fuente : (captacion.fuente ?? perfil.fuente);
  return <div className="w-full min-w-0 space-y-1 text-sm text-tinta-tenue [overflow-wrap:anywhere]">
    <p>{avisoPuertos ?? (resumen.length ? 'Puertos registrados por unidad: ' + resumen.map((p) => `${ETIQUETA_SENTIDO[p.sentido]} ${ETIQUETA_SENAL[p.senal]}: ${p.total}`).join(' · ') : 'Sin datos de puertos disponibles en esta selección.')}</p>
    {equipo.articulo_id && <Link className="text-acento underline" href={`/articulo/${equipo.articulo_id}`}>Ver ficha del artículo</Link>}
    {nota && <p>{nota}</p>}
    {perfil.eq && !ocultaPerfil && <details>
      <summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-acento">Referencia técnica del Codec EQ</summary>
      <p>Referencia del Codec EQ: 3 entradas HDMI, 3 salidas HDMI, 3 entradas analógicas mini jack, 1 salida de línea, 1 USB-C, 4 USB-A, 1 Micro USB de servicio y 5 RJ45 (1 LAN y 4 PoE++). Conectores de cámara y control no incluidos. No indica bocas libres; el resumen superior muestra los puertos registrados del artículo.</p>
    </details>}
    {fuente && <a className="text-acento underline" href={fuente}>Documentación oficial Cisco</a>}
  </div>;
}

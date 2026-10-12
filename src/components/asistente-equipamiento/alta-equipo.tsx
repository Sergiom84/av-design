'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { Boton } from '@/components/ui';
import { FormularioMutacion } from '@/components/formulario-mutacion/formulario';
import type { ArticuloElegible, Puerto } from '@/lib/tipos';
import type { SeleccionAsistente } from '@/lib/asistente-equipamiento';
import type { DatoTecnico } from '@/lib/ficha-tecnica';
import { AvisosSeleccion, DatosEquipo } from './asistencia';

function mapaHechos(hechos: Record<string, DatoTecnico[]> | Map<string, DatoTecnico[]> | undefined): Map<string, DatoTecnico[]> {
  if (!hechos) return new Map();
  return hechos instanceof Map ? hechos : new Map(Object.entries(hechos));
}

/** Si los hechos no llegan, no se reconstruye la captación por el nombre del modelo. */
const HECHOS_NO_DISPONIBLES: DatoTecnico[] = [{
  clave: 'captacion-voz',
  concepto: 'Captación de voz',
  tipo: 'microfonia',
  estado: 'sin_documentar',
  valor: null,
  fuente: 'app',
}];

/**
 * Lo que contestó `/hechos`, con el artículo al que contestó dentro.
 *
 * El identificador viaja en el propio estado a propósito: es lo que permite
 * descartar durante el render una respuesta que ya no es del artículo elegido,
 * sin tener que limpiar el estado con un efecto al cambiar de artículo.
 */
interface HechosDelCandidato {
  articuloId: string;
  datos: DatoTecnico[];
  aviso?: string;
}

function FichaCandidato({
  equipo, hechos, avisoHechos,
}: {
  equipo: SeleccionAsistente; hechos: DatoTecnico[]; avisoHechos?: string;
}) {
  const [resultado, cambiarResultado] = useState<{ puertos: Puerto[]; estado: 'cargando' | 'listo' | 'error' }>({ puertos: [], estado: 'cargando' });
  const [intento, reintentar] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();
    async function cargar() {
      try {
        const respuesta = await fetch(`/api/catalogo/${encodeURIComponent(equipo.articulo_id!)}/puertos`, { signal: controlador.signal });
        if (!respuesta.ok) throw new Error('No se pudieron cargar los puertos');
        const puertos: Puerto[] = await respuesta.json();
        if (!Array.isArray(puertos)) throw new Error('Respuesta inválida');
        if (!controlador.signal.aborted) cambiarResultado({ puertos, estado: 'listo' });
      } catch {
        if (!controlador.signal.aborted) cambiarResultado({ puertos: [], estado: 'error' });
      }
    }
    void cargar();
    return () => controlador.abort();
  }, [equipo.articulo_id, intento]);
  return <div aria-live="polite">
    <DatosEquipo
      equipo={equipo}
      puertos={resultado.puertos}
      hechos={hechos}
      avisoPuertos={avisoHechos ?? (resultado.estado === 'cargando' ? 'Cargando puertos…' : resultado.estado === 'error' ? 'No se han podido cargar los puertos.' : undefined)}
    />
    {resultado.estado === 'error' && <Boton tipo="button" variante="secundario" onClick={() => {
      cambiarResultado({ puertos: [], estado: 'cargando' });
      reintentar((valor) => valor + 1);
    }}>Reintentar puertos</Boton>}
  </div>;
}

export function AltaEquipo({
  salaId, equipos, accion, children, hechos,
}: {
  salaId: string;
  equipos: SeleccionAsistente[];
  accion: (datos: FormData) => Promise<void>;
  children: ReactNode;
  hechos?: Record<string, DatoTecnico[]>;
}) {
  const [articulo, elegir] = useState<ArticuloElegible | null>(null);
  const [revision, cambiarRevision] = useState(0);
  const [hechosRecibidos, cambiarHechosRecibidos] = useState<HechosDelCandidato | null>(null);
  // La API del buscador trae etiqueta y categoría, no marca/modelo. El modelo
  // es la etiqueta entera; la marca no se deduce del prefijo.
  const candidato: SeleccionAsistente | undefined = articulo ? {
    articulo_id: articulo.id, nombre: articulo.etiqueta, cantidad: 1,
    referencia: { categoria: articulo.categoria, marca: null, modelo: articulo.etiqueta },
  } : undefined;

  // El efecto existe solo por el sistema externo —la petición a `/hechos`— y
  // nunca escribe estado de forma síncrona: sin artículo elegido no hay nada
  // que pedir y no hay nada que limpiar, porque lo que se enseña se deriva
  // abajo. Sincronizar aquí el vaciado provocaba un render en cascada.
  useEffect(() => {
    const articuloId = articulo?.id;
    if (!articuloId) return;
    const controlador = new AbortController();
    void (async () => {
      try {
        const respuesta = await fetch(`/api/catalogo/${encodeURIComponent(articuloId)}/hechos`, { signal: controlador.signal });
        if (!respuesta.ok) throw new Error('hechos');
        const datos: DatoTecnico[] = await respuesta.json();
        if (!Array.isArray(datos)) throw new Error('hechos');
        if (!controlador.signal.aborted) cambiarHechosRecibidos({ articuloId, datos });
      } catch {
        if (!controlador.signal.aborted) {
          cambiarHechosRecibidos({ articuloId, datos: HECHOS_NO_DISPONIBLES, aviso: 'No se han podido cargar los hechos técnicos.' });
        }
      }
    })();
    return () => controlador.abort();
  }, [articulo?.id]);

  // Estado derivado durante el render: una respuesta de otro artículo —la
  // anterior, todavía en vuelo o ya escrita— no se enseña bajo el artículo
  // elegido ahora. Mientras la suya no llega, el candidato no tiene hechos:
  // ausencia de datos, que no es compatibilidad.
  const recibidos = articulo?.id && hechosRecibidos?.articuloId === articulo.id ? hechosRecibidos : null;
  const hechosCandidato = recibidos?.datos ?? [];
  const avisoHechos = recibidos?.aviso;

  const hechosSala = mapaHechos(hechos);
  const hechosVista = candidato?.articulo_id
    ? new Map([...hechosSala, [candidato.articulo_id, hechosCandidato]])
    : hechosSala;

  return <FormularioMutacion action={accion} onExito={() => {
    elegir(null);
    cambiarHechosRecibidos(null);
    cambiarRevision((valor) => valor + 1);
  }} className="space-y-3 pb-4 mb-4 border-b border-linea">
    <input type="hidden" name="sala_id" value={salaId} />
    <div className="flex flex-wrap items-end gap-2">
      <BuscadorArticulo key={revision} etiqueta="Añadir del catálogo" tipo="equipo" alElegir={elegir} />
      <Boton>Añadir equipo</Boton>
    </div>
    <AvisosSeleccion equipos={equipos} candidato={candidato} hechos={hechosVista} />
    {candidato && <FichaCandidato key={candidato.articulo_id} equipo={candidato} hechos={hechosCandidato} avisoHechos={avisoHechos} />}
    <details className="min-w-0">
      <summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-acento">Posición y toma de red (opcional)</summary>
      <div className="flex flex-wrap items-end gap-2">{children}</div>
    </details>
  </FormularioMutacion>;
}

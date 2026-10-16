'use client';

import { useEffect, useState } from 'react';
import { construirEscena } from '@/lib/croquis';
import { bloqueosPlantilla, entradaDePlantilla, type VistaPreviaPlantilla, type ContextoMontajePlantilla } from '@/lib/plantilla-preview';
import { PlanoSala } from '@/components/croquis/plano-sala';
import { Aviso, Boton, ContenedorTabla } from '@/components/ui';

export function VistaPreviaDePlantilla({ id, alRecibir, contexto }: { id: string | null; alRecibir?: (datos: VistaPreviaPlantilla | null) => void; contexto?: ContextoMontajePlantilla }) {
  return id ? <CargarPlantilla key={id} id={id} alRecibir={alRecibir} contexto={contexto} /> : null;
}
function CargarPlantilla({ id, alRecibir, contexto }: { id: string; alRecibir?: (datos: VistaPreviaPlantilla | null) => void; contexto?: ContextoMontajePlantilla }) {
  const [datos, setDatos] = useState<VistaPreviaPlantilla | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const control = new AbortController();
    fetch(`/api/plantillas/${encodeURIComponent(id)}`, { signal: control.signal, cache: 'no-store' }).then(async res => {
      const contenido = await res.json();
      if (!res.ok) throw new Error(contenido.error ?? 'No se pudo consultar la plantilla.');
      if (contenido.plantilla?.id !== id || !/^[a-f0-9]{64}$/.test(contenido.huella)) throw new Error('La respuesta no corresponde a la plantilla elegida.');
      if (!control.signal.aborted) { setDatos(contenido); setError(''); alRecibir?.(contenido); }
    }).catch(e => { if (!control.signal.aborted) { setError(e.message); alRecibir?.(null); } });
    return () => control.abort();
  }, [id, intento, alRecibir]);
  if (error) return <div className="space-y-2" role="alert"><Aviso tono="alerta">{error}</Aviso><Boton tipo="button" variante="secundario" onClick={() => { setError(''); setIntento(i => i + 1); }}>Reintentar vista previa</Boton></div>;
  if (!datos) return <p role="status">Cargando vista previa…</p>;
  const entrada = entradaDePlantilla(datos, contexto);
  const escena = construirEscena(entrada);
  const bloqueos = bloqueosPlantilla(datos);
  return <section aria-label={`Vista previa de ${datos.plantilla.nombre}`} className="space-y-3 min-w-0">
    <h3 className="t-subtitulo">Vista previa: {datos.plantilla.nombre}</h3>
    <p className="text-sm text-tinta-tenue">Sólo lectura. Las líneas opcionales no se aplican; las posiciones estimadas llevan trazo discontinuo.</p>
    {contexto && <p className="text-sm text-tinta-tenue">Montaje con las medidas y el aforo de destino: {entrada.sala.aforo ?? 'sin aforo'}.</p>}
    {[...escena.avisos, ...datos.avisos, ...bloqueos].map((aviso, i) => <Aviso key={i} tono={bloqueos.includes(aviso) ? 'alerta' : 'neutro'}>{aviso}</Aviso>)}
    {escena.sala.largo_m > 0 && escena.sala.ancho_m > 0 && <PlanoSala escena={escena} ancho_px={700} />}
    <ContenedorTabla etiqueta="Referencias de la plantilla"><table className="datos"><thead><tr><th>Referencia</th><th>Cantidad</th><th>Aplicación</th></tr></thead><tbody>
      {datos.lineas.map(l => <tr key={l.id}><td>{l.referencia?.etiqueta || l.modelo_texto || l.categoria}{(!l.referencia || !l.referencia.activo) && <span> · Sin referencia activa</span>}</td>
        <td className="num">{l.cantidad}</td><td>{l.opcional ? 'Opcional; no se hereda' : 'Se hereda'}</td></tr>)}
    </tbody></table></ContenedorTabla>
  </section>;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Aviso, Boton, Campo, ContenedorTabla, Enlace, Estado, Tarjeta } from '@/components/ui';
import type { DestinoImportacion, LoteImportacion, PreviewImportacion, SeleccionFila } from '@/lib/importacion/modelo';
import { DecisionFila } from './decision-fila';
import { seleccionarCoincidenciasValidas } from '@/lib/importacion/seleccion';

const DESTINO = { catalogo: 'Catálogo', bom: 'BOM de sala', precios: 'Ofertas y tarifas' };
class ErrorRespuesta extends Error { constructor(mensaje: string, public status: number) { super(mensaje); } }

async function respuesta<T>(res: Response): Promise<T> {
  const datos = await res.json();
  if (!res.ok) throw new ErrorRespuesta(datos.error ?? 'No se pudo completar la operación.', res.status);
  return datos as T;
}

type Props = { sala: { id: string; nombre: string } | null; puedeCatalogo: boolean; puedeBom: boolean };
export function Importador(props: Props) {
  return <ImportadorContexto key={`${props.sala?.id ?? "catalogo"}:${props.puedeBom}:${props.puedeCatalogo}`} {...props}/>;
}

function ImportadorContexto({ sala, puedeCatalogo, puedeBom }: {
  sala: { id: string; nombre: string } | null;
  puedeCatalogo: boolean;
  puedeBom: boolean;
}) {
  const [destino, setDestino] = useState<DestinoImportacion>(sala && puedeBom ? 'bom' : 'catalogo');
  const [origen, setOrigen] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewImportacion | null>(null);
  const [seleccion, setSeleccion] = useState<Record<number, SeleccionFila>>({});
  const [revisionFinal, setRevisionFinal] = useState<PreviewImportacion | null>(null);
  const [resumenSeleccion, setResumenSeleccion] = useState('');
  const [reinicio, setReinicio] = useState(0);
  const secuencia = useRef(0);
  const invalidar = () => { secuencia.current++; setPreview(null); setSeleccion({}); setRevisionFinal(null); setResumenSeleccion(''); setReinicio(v => v + 1); };
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [lote, setLote] = useState<LoteImportacion | null>(null);
  const [lotes, setLotes] = useState<LoteImportacion[]>([]);

  const cargarLotes = useCallback(async () => {
    const datos = await respuesta<LoteImportacion[]>(await fetch('/api/importacion/lotes', { cache: 'no-store' }));
    setLotes(datos);
  }, []);
  useEffect(() => {
    const control = new AbortController();
    fetch('/api/importacion/lotes', { cache: 'no-store', signal: control.signal })
      .then(respuesta<LoteImportacion[]>)
      .then(datos => { if (!control.signal.aborted) setLotes(datos); })
      .catch(e => { if (!control.signal.aborted) setError(e.message); });
    return () => control.abort();
  }, []);

  const formulario = () => {
    if (!archivo) throw new Error('Elige un archivo.');
    const datos = new FormData();
    datos.set('archivo', archivo); datos.set('destino', destino); datos.set('origen', origen);
    if (destino === 'bom' && sala) datos.set('salaId', sala.id);
    return datos;
  };

  const operar = async (accion: () => Promise<void>) => {
    setOcupado(true); setError('');
    try { await accion(); } catch (e) { if (e instanceof ErrorRespuesta && e.status === 409) setRevisionFinal(null); setError(e instanceof Error ? e.message : 'Error de importación.'); }
    finally { setOcupado(false); }
  };

  const revisar = () => operar(async () => {
    const turno = ++secuencia.current;
    const vista = await respuesta<PreviewImportacion>(await fetch('/api/importacion', { method: 'POST', body: formulario() }));
    if (turno !== secuencia.current) return;
    setPreview(vista); setSeleccion({}); setRevisionFinal(null); setResumenSeleccion(''); setReinicio(v => v + 1); setLote(null);
  });

  const revisarSeleccion = () => operar(async () => {
    const turno = ++secuencia.current;
    const datos = formulario(); datos.set('seleccion', JSON.stringify(Object.values(seleccion)));
    const vista = await respuesta<PreviewImportacion>(await fetch('/api/importacion', { method: 'POST', body: datos }));
    if (turno !== secuencia.current) return;
    setRevisionFinal(vista);
    setSeleccion(Object.fromEntries(vista.seleccionRevisada!.map(d => [d.seleccion.fila, d.seleccion])));
  });

  const confirmar = () => operar(async () => {
    if (destino === 'bom' && !revisionFinal) throw new Error('Revisa la selección antes de confirmar.');
    const turno = ++secuencia.current;
    const datos = formulario(); datos.set('seleccion', JSON.stringify(Object.values(seleccion)));
    datos.set('previewHash', String((destino === 'bom' ? revisionFinal : preview)?.previewHash ?? ''));
    const resultado = await respuesta<LoteImportacion>(await fetch('/api/importacion/confirmar', { method: 'POST', body: datos }));
    if (turno !== secuencia.current) return;
    setLote(resultado); setPreview(null); setSeleccion({}); setRevisionFinal(null);
    await cargarLotes();
  });

  const elegir = (fila: number, valor?: SeleccionFila) => {
    secuencia.current++; setRevisionFinal(null); setResumenSeleccion('');
    setSeleccion(actual => { const copia = { ...actual }; if (valor) copia[fila] = valor; else delete copia[fila]; return copia; });
  };

  return <div className="space-y-6 min-w-0">
    {error && <div role="alert"><Aviso tono="alerta">{error}</Aviso></div>}
    <Tarjeta titulo="Archivo y destino" pie="CSV UTF-8 o XLSX, máximo 500 filas y 5 MiB. La revisión no escribe datos. Las fórmulas no se ejecutan.">
      <form onSubmit={e => { e.preventDefault(); void revisar(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Destino">
            <select value={destino} onChange={e => { setDestino(e.target.value as DestinoImportacion); invalidar(); }} disabled={ocupado} className="w-full">
              {puedeCatalogo && <option value="catalogo">Catálogo</option>}
              {puedeBom && sala && <option value="bom">BOM de sala: {sala.nombre}</option>}
              {puedeCatalogo && <option value="precios">Ofertas y tarifas</option>}
            </select>
          </Campo>
          <Campo etiqueta="Procedencia" ayuda="Quién aporta la lista u oferta y a qué documento corresponde.">
            <input required maxLength={500} value={origen} onChange={e => { setOrigen(e.target.value); invalidar(); }} disabled={ocupado} className="w-full" />
          </Campo>
        </div>
        <Campo etiqueta="Archivo CSV o XLSX">
          <input type="file" accept=".csv,.xlsx" required disabled={ocupado} onChange={e => { setArchivo(e.target.files?.[0] ?? null); invalidar(); }} className="w-full" />
        </Campo>
        {destino === 'bom' && <Aviso tono="neutro">Estas partidas se suman al material necesario de {sala?.nombre}. No colocan equipos en el plano ni crean conexiones. Revisa que no repitan material ya incluido.</Aviso>}
        {destino === 'precios' && <Aviso tono="neutro">Las ofertas anteriores se conservan. Ceros de kits y ofertas sin clasificación quedan pendientes de decisión; no fijan un precio gratis.</Aviso>}
        <Boton disabled={ocupado}>{ocupado ? 'Procesando…' : 'Revisar archivo'}</Boton>
      </form>
    </Tarjeta>

    <Tarjeta titulo="Columnas del archivo">
      <p>La primera fila contiene las cabeceras. CSV admite separador punto y coma o coma. Los modelos y las referencias se comparan literalmente; conserva sus variantes.</p>
      <p className="mt-2 [overflow-wrap:anywhere] num text-xs">{destino === 'catalogo'
        ? 'referencia;marca;modelo;categoria;tipo;unidad;descripcion'
        : destino === 'bom' ? 'referencia;marca;modelo;categoria;unidad;cantidad'
        : 'referencia;marca;modelo;categoria;proveedor;presupuesto;fecha;moneda;unidad;unidad_compra;unidades_por_compra;precio_compra;origen;cantidad;notas'}</p>
      {destino === 'precios' && <p className="mt-2 text-tinta-tenue">Fecha AAAA-MM-DD; moneda EUR o USD; origen final u orientativo. Precio de compra sin IVA. Una bobina de 100 metros debe indicar 100 unidades por compra y unidad de catálogo m.</p>}
      {!sala && <p className="mt-2 text-tinta-tenue">La importación de BOM se abre desde Equipamiento de una sala.</p>}
    </Tarjeta>

    {preview && <Tarjeta titulo="Revisión antes de guardar" pie="Sólo se confirmarán las filas que elijas. Ante cualquier fallo se revierte toda la confirmación.">
      <p>{preview.archivo.nombre} · {preview.resumen.filas} filas · {DESTINO[preview.destino]}</p>
      <p className="num text-xs [overflow-wrap:anywhere] mt-1">SHA-256 {preview.archivo.sha256}</p>
      <p className="mt-2 text-tinta-tenue">{preview.resumen.coincidencias} coincidencias · {preview.resumen.ambiguas} ambiguas · {preview.resumen.altas} altas · {preview.resumen.noEncontradas} no encontradas · {preview.resumen.rechazadas} rechazadas</p>
      {preview.parametrosPrecio && <p className="mt-2 text-tinta-tenue">Cálculo al {preview.parametrosPrecio.fechaCalculo}: vigencia {preview.parametrosPrecio.vigenciaMeses} meses, cambio {preview.parametrosPrecio.tipoCambioUsdEur} EUR por USD. El informe confirmará el coste elegido para el conjunto de filas seleccionado.</p>}
      <div className="flex flex-wrap gap-3 my-4">
        <Boton tipo="button" variante="secundario" disabled={ocupado} onClick={() => {
          const r = seleccionarCoincidenciasValidas(preview, seleccion); setSeleccion(r.seleccion); setRevisionFinal(null); secuencia.current++;
          setResumenSeleccion(`${r.agregadas} añadidas. ${Object.entries(r.omitidas).map(([motivo, n]) => `${n}: ${motivo}`).join(' · ')}`);
        }}>Seleccionar coincidencias válidas</Boton>
        <Boton tipo="button" variante="secundario" disabled={ocupado} onClick={() => { secuencia.current++; setSeleccion({}); setRevisionFinal(null); setReinicio(v => v + 1); setResumenSeleccion('Selección vacía.'); }}>Desmarcar todas</Boton>
      </div>
      {resumenSeleccion && <p role="status">{resumenSeleccion}</p>}
      <ContenedorTabla etiqueta="Filas de importación revisables">
        <table className="datos mt-4 min-w-[850px]">
          <thead><tr><th>Fila</th><th>Datos originales</th><th>Resultado</th><th>Elegir acción</th></tr></thead>
          <tbody>{preview.filas.map(f => <tr key={f.fila}>
            <td className="num">{f.fila}</td>
            <td><dl className="grid grid-cols-[auto_1fr] gap-x-2 max-w-lg">{Object.entries(f.datos).filter(([,v]) => v !== '').map(([k,v]) => <div key={k} className="contents"><dt className="text-tinta-tenue">{k}</dt><dd className="[overflow-wrap:anywhere]">{v}</dd></div>)}</dl></td>
            <td><Estado tono={f.errores.length ? 'bloqueo' : f.estado === 'ambigua' ? 'aviso' : 'neutro'}>{f.estado.replace('_', ' ')}</Estado>
              {[...f.errores, ...f.avisos].map((aviso,i) => <p key={i} className="mt-1 max-w-xs [overflow-wrap:anywhere]">{aviso}</p>)}</td>
            <td><DecisionFila key={`${f.fila}:${reinicio}`} fila={f} destino={destino} valor={seleccion[f.fila]} ocupado={ocupado} alCambiar={valor => elegir(f.fila, valor)}/></td>
          </tr>)}</tbody>
        </table>
      </ContenedorTabla>
      <div className="flex flex-wrap gap-3 items-center mt-4">
        {destino === 'bom' && <Boton tipo="button" disabled={ocupado || !Object.keys(seleccion).length} onClick={() => void revisarSeleccion()}>Revisar selección</Boton>}
        <Boton tipo="button" disabled={ocupado || !Object.keys(seleccion).length || (destino === 'bom' && !revisionFinal)} onClick={() => void confirmar()}>Confirmar {Object.keys(seleccion).length} filas elegidas</Boton>
        <Boton tipo="button" variante="secundario" disabled={ocupado} onClick={invalidar}>Volver al archivo</Boton>
      </div>
    </Tarjeta>}

    {revisionFinal?.seleccionRevisada && <Tarjeta titulo="Selección revisada para confirmar">
      <p>Los datos y revisiones siguientes proceden del catálogo del servidor.</p>
      <ul>{revisionFinal.seleccionRevisada.map(d => <li key={d.seleccion.fila} className="py-2">Fila {d.seleccion.fila}: {d.original?.etiqueta ?? d.datosOriginales.referencia ?? d.datosOriginales.modelo} → {d.destino.etiqueta} · {d.cantidad} {d.unidad} · {d.tipoOrigen} · revisión {d.destino.revision}{d.seleccion.alternativa && <p>Motivo: {d.seleccion.alternativa.motivo} · {d.fuenteTipo.replaceAll('_', ' ')}</p>}</li>)}</ul>
    </Tarjeta>}

    {lote && <Tarjeta titulo="Resultado del lote" acciones={<Enlace href={`/api/importacion/lotes/${lote.id}/archivo`}>Descargar fuente original</Enlace>}>
      <p><Estado tono={lote.estado === 'confirmado' ? 'listo' : 'neutro'}>{lote.estado.replaceAll('_', ' ')}</Estado> · {DESTINO[lote.destino]} · {lote.archivoNombre}</p>
      <p className="num text-xs mt-2 [overflow-wrap:anywhere]">{lote.id} · SHA-256 {lote.archivoSha256}</p>
      <ContenedorTabla etiqueta="Informe del lote"><table className="datos mt-3"><thead><tr><th>Fila</th><th>Estado</th><th>Resultado</th></tr></thead>
        <tbody>{lote.informe.map((f,i) => <tr key={i}><td>{f.fila}</td><td>{f.estado}</td><td>{f.mensaje}{f.alternativa && <div className="text-sm text-tinta-tenue mt-2"><p>Original: {f.alternativa.original?.etiqueta ?? f.alternativa.datosOriginales.referencia ?? f.alternativa.datosOriginales.modelo} · Destino: {f.alternativa.destino.etiqueta} · {f.alternativa.tipoOrigen} · {f.alternativa.cantidad} {f.alternativa.unidad}</p><p>Revisión {f.alternativa.destino.revision} · Autor {f.alternativa.autorId} · {f.alternativa.fuenteTipo.replaceAll('_', ' ')}</p><p className="break-all">Revisión de selección: {f.alternativa.previewHash}</p></div>}{f.articuloId && <> · <Enlace href={`/articulo/${f.articuloId}`}>Referencia exacta</Enlace></>}</td></tr>)}</tbody></table></ContenedorTabla>
      {lote.reversion?.length > 0 && <ul className="mt-3 space-y-1">{lote.reversion.map(r => <li key={r.cambioId}>{r.estado}: {r.motivo}</li>)}</ul>}
      {lote.estado === 'confirmado' && <div className="mt-4"><p className="text-tinta-tenue mb-2">Revertir conserva las filas modificadas o utilizadas posteriormente y explica los conflictos.</p><Boton tipo="button" variante="peligro" disabled={ocupado} onClick={() => void operar(async () => {
        const resultado = await respuesta<LoteImportacion>(await fetch(`/api/importacion/lotes/${lote.id}/revertir`, { method: 'POST' }));
        setLote(resultado); await cargarLotes();
      })}>Revertir lote</Boton></div>}
    </Tarjeta>}

    <Tarjeta titulo="Tus lotes de importación">
      {lotes.length === 0 ? <p className="text-tinta-tenue">Todavía no hay lotes confirmados.</p> : <ul className="divide-y divide-linea-suave">{lotes.map(l => <li key={l.id} className="py-3 flex flex-wrap items-center gap-3">
        <span>{l.archivoNombre} · {DESTINO[l.destino]} · {l.estado.replaceAll('_', ' ')}</span>
        <Boton tipo="button" variante="secundario" disabled={ocupado} onClick={() => void operar(async () => setLote(await respuesta<LoteImportacion>(await fetch(`/api/importacion/lotes/${l.id}`, { cache: 'no-store' }))))}>Consultar lote</Boton>
      </li>)}</ul>}
    </Tarjeta>
  </div>;
}

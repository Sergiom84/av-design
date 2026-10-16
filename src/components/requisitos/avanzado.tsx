'use client';
import { useRef, useState } from 'react';
import { Boton, Campo, CampoCasilla, Enlace } from '@/components/ui';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { RevisionCampos } from './candidato';
import { Informe } from './informe';
import type { Candidato, Decisiones, Destino } from './tipos';
import { ETIQUETAS_CAMPOS } from './tipos';

type BaseTecnica = { articulo: { id: string; marca: string | null; modelo: string; revision?: number }; baseHash?: string; baseRevision?: string | null; datos?: Record<string, unknown> | unknown[] | null };
const COLUMNAS_CATALOGO = ['referencia', 'marca', 'modelo', 'tipo', 'categoria', 'unidad', 'descripcion', 'observaciones'];
const COLUMNAS_OFERTA = ['referencia', 'marca', 'modelo', 'proveedor', 'presupuesto', 'precio_compra', 'moneda', 'fecha', 'unidad', 'unidad_compra', 'unidades_por_compra', 'origen', 'kit', 'vinculante'];
const OPCIONES: Record<string, string[]> = { tipo: ['equipo', 'cable', 'consumible'], unidad: ['ud', 'm'], moneda: ['EUR', 'USD'], origen: ['final', 'orientativo'], unidad_compra: ['ud', 'm', 'bobina', 'caja', 'paquete'], kit: ['sí', 'no'], vinculante: ['sí', 'no'], sentido: ['entrada', 'salida', 'bidireccional', 'control'], senal: ['hdmi', 'red', 'usb', 'audio_linea', 'audio_altavoz', 'microfono', 'alimentacion', 'control', 'otro'] };
export function EditorAvanzado({ candidato, destino, incluir, cancelar, leerBase, alErrorAcceso, inicial }: { candidato: Candidato; destino: Exclude<Destino, 'areas_bom'>; incluir: (d: Decisiones) => void; cancelar: () => void; leerBase: (id: string, destino: 'articulo' | 'tecnico' | 'puerto') => Promise<BaseTecnica>; alErrorAcceso?: () => void; inicial?: Decisiones | null }) {
  const decision = inicial?.destino === destino ? inicial.destino === 'catalogo' || inicial.destino === 'ofertas' ? inicial.filas.find(f => f.candidatoId === candidato.id) : inicial.candidatoId === candidato.id ? inicial : null : null;
  const datosIniciales: Record<string, unknown> = decision ? { ...decision.datos } : {};
  const referenciaInicial = decision?.articuloId ? { id: decision.articuloId, etiqueta: [datosIniciales.marca, datosIniciales.modelo].filter(Boolean).join(' ') || String(datosIniciales.referencia ?? decision.articuloId) } : null;
  const [articulo, setArticulo] = useState<{ id: string; etiqueta: string } | null>(referenciaInicial);
  const [base, setBase] = useState<BaseTecnica | null>(() => decision?.articuloId ? { articulo: { id: decision.articuloId, marca: typeof datosIniciales.marca === 'string' ? datosIniciales.marca : null, modelo: String(datosIniciales.modelo ?? ''), ...('revisionArticulo' in decision && decision.revisionArticulo !== null ? { revision: decision.revisionArticulo } : {}) }, ...('baseHash' in decision ? { baseHash: decision.baseHash, baseRevision: decision.baseRevision } : {}) } : null);
  const [basePendiente, setBasePendiente] = useState<BaseTecnica | null>(null);
  const [crear, setCrear] = useState(Boolean(decision && 'crear' in decision && decision.crear));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [motivo, setMotivo] = useState(decision?.motivo ?? '');
  const [revisados, setRevisados] = useState<string[]>(decision ? [...decision.camposRevisados] : []);
  const [datos, setDatos] = useState<Record<string, unknown>>(() => decision ? { ...decision.datos } : Object.fromEntries((destino === 'catalogo' ? COLUMNAS_CATALOGO : destino === 'ofertas' ? COLUMNAS_OFERTA : []).map(k => [k, candidato.original[k] ?? ''])));
  const secuencia = useRef(0);
  const tecnico = destino === 'tecnico' || destino === 'puerto';
  const campos = [...Object.keys(datos), tecnico ? 'modeloExacto' : 'seleccion'];
  async function cargar() {
    if (!articulo) return; const actual = ++secuencia.current; setOcupado(true); setError('');
    try { const b = await leerBase(articulo.id, tecnico ? destino : 'articulo'); if (actual !== secuencia.current) return;
      if (base) {
        const igual = base.articulo.id === b.articulo.id && (tecnico ? base.baseHash === b.baseHash && base.baseRevision === b.baseRevision : base.articulo.revision === b.articulo.revision);
        setBasePendiente(igual ? null : b); return;
      }
      setBase(b);
      if (destino === 'tecnico' && !Object.keys(datos).length) {
        const origen = b.datos && !Array.isArray(b.datos) ? b.datos : {};
        setDatos({ marca: b.articulo.marca, modelo: b.articulo.modelo, origen: origen.origen ?? null, url: origen.url ?? null, fecha: origen.fecha ? String(origen.fecha).slice(0, 10) : null,
          ancho: origen.ancho === undefined || origen.ancho === null ? null : Number(origen.ancho), alto: origen.alto === undefined || origen.alto === null ? null : Number(origen.alto), fondo: origen.fondo === undefined || origen.fondo === null ? null : Number(origen.fondo), unidad: origen.unidad ?? null, ru: origen.ru === undefined || origen.ru === null ? null : Number(origen.ru) });
      } else if (destino === 'puerto' && !Object.keys(datos).length) setDatos({ nombre: candidato.original.puerto ?? '', total: null, sentido: '', senal: '', conector: null, orden: null, notas: null });
    } catch { if (actual === secuencia.current) setError('No se ha podido comprobar el registro. Tu propuesta, revisión y base anteriores se conservan.'); }
    finally { if (actual === secuencia.current) setOcupado(false); }
  }
  function guardar() {
    setError('');
    if (basePendiente && !crear) { setError('El registro cambió. Actualiza la base explícitamente y vuelve a revisar los campos.'); return; }
    if (tecnico) {
      if (!articulo || !base?.baseHash || !Object.keys(datos).length) { setError('Comprueba el modelo exacto y su registro antes de revisar.'); return; }
      // El servidor valida estrictamente el objeto y cada campo antes del preview.
      incluir({ versionModelo: 1, destino, candidatoId: candidato.id, articuloId: articulo.id, baseHash: base.baseHash, baseRevision: base.baseRevision ?? null, datos, camposRevisados: revisados, motivo } as Decisiones);
    } else incluir({ versionModelo: 1, destino, filas: [{ candidatoId: candidato.id, datos: datos as Record<string, string>, articuloId: crear ? null : articulo?.id ?? null, crear, revisionArticulo: crear ? null : base?.articulo.revision ?? null, camposRevisados: revisados, motivo }], excluidos: [] });
  }
  return <div className="mt-4 space-y-4">
    <BuscadorArticulo etiqueta="Modelo exacto del catálogo" className="w-full" alErrorAcceso={alErrorAcceso} alElegir={a => { secuencia.current++; setArticulo(a); setBase(null); setBasePendiente(null); setRevisados([]); setOcupado(false); setError(''); }} />
    {articulo && <p>{articulo.etiqueta} · <Enlace href={`/articulo/${articulo.id}`}>Abrir ficha actual</Enlace></p>}
    <Boton tipo="button" variante="secundario" disabled={!articulo || ocupado} onClick={() => void cargar()}>Comprobar registro actual</Boton>
    {destino === 'catalogo' && <CampoCasilla type="checkbox" checked={crear} onChange={e => { setCrear(e.target.checked); setRevisados([]); }}>Crear artículo nuevo con estos datos</CampoCasilla>}
    {base && <p className="dato text-xs">{base.articulo.revision === undefined ? 'Base conservada de la decisión revisada' : `Revisión del artículo ${base.articulo.revision}`}{base.baseRevision !== undefined && <> · Revisión de fuente {base.baseRevision ?? 'sin ficha previa'}</>}</p>}
    {basePendiente && <div role="status" className="rounded-md bg-aviso-suave p-3 space-y-2"><p>El registro cambió. Se conservan tu propuesta, revisión y base anteriores.</p><Boton tipo="button" variante="secundario" onClick={() => { setBase(basePendiente); setBasePendiente(null); setRevisados([]); }}>Actualizar base y volver a revisar</Boton></div>}
    {destino === 'puerto' && base && Array.isArray(base.datos) && <details><summary className="enlace cursor-pointer">Consultar puertos existentes</summary><Informe datos={base.datos} /></details>}
    {tecnico && !base && <p className="text-tinta-tenue">Comprueba el registro para cargar los campos revisables. Abrir el formulario no guarda cambios.</p>}
    {Object.keys(datos).length > 0 && <>
      <div className="grid gap-3 sm:grid-cols-2">{Object.entries(datos).map(([k, valor]) => <Campo key={k} etiqueta={ETIQUETAS_CAMPOS[k] ?? k.replaceAll('_', ' ')}>
        {(() => { const opciones = destino === 'tecnico' && k === 'unidad' ? ['mm', 'cm', 'm'] : destino === 'tecnico' && k === 'origen' ? undefined : OPCIONES[k];
          const numerico = ['ancho', 'alto', 'fondo', 'ru', 'total', 'orden'].includes(k) && tecnico;
          const cambiar = (v: string) => { setDatos(anterior => ({ ...anterior, [k]: numerico ? v === '' ? null : Number(v) : tecnico && v === '' ? null : v })); setRevisados(anterior => anterior.filter(c => c !== k)); };
          return opciones ? <select value={valor === null ? '' : String(valor)} onChange={e => cambiar(e.target.value)} className="w-full"><option value="">Elegir valor</option>{opciones.map(o => <option key={o} value={o}>{o}</option>)}</select>
            : <input type={k === 'fecha' ? 'date' : k === 'url' ? 'url' : numerico ? 'number' : 'text'} step={k === 'total' || k === 'orden' ? '1' : 'any'} value={valor === null ? '' : String(valor)} maxLength={2000} className="w-full" onChange={e => cambiar(e.target.value)} />;
        })()}
      </Campo>)}</div>
      {tecnico && <p className="text-tinta-tenue">Vacío indica ausencia. Dimensiones: unidad mm, cm o m. Puerto: sentido y señal deben coincidir con los valores del catálogo.</p>}
      <Campo etiqueta="Motivo de la decisión"><textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} className="w-full" /></Campo>
      <RevisionCampos campos={campos} valor={revisados} cambiar={setRevisados} />
      {error && <p role="alert" className="text-alerta">{error}</p>}
      <div className="flex flex-wrap gap-3"><Boton tipo="button" disabled={ocupado || !motivo.trim() || campos.some(c => !revisados.includes(c)) || !crear && (!base || Boolean(basePendiente))} onClick={guardar}>Incluir decisión revisada</Boton><Boton tipo="button" variante="secundario" onClick={cancelar}>Cancelar edición</Boton></div>
    </>}
  </div>;
}

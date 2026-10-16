'use client';

import { useState } from 'react';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import type { AlternativaBom, DestinoImportacion, FilaImportacion, SeleccionFila, TipoImportado } from '@/lib/importacion/modelo';

export function DecisionFila({ fila: f, destino, valor, ocupado, alCambiar }: {
  fila: FilaImportacion; destino: DestinoImportacion; valor?: SeleccionFila; ocupado: boolean;
  alCambiar: (valor?: SeleccionFila) => void;
}) {
  const [alternativa, setAlternativa] = useState(Boolean(valor?.alternativa));
  const [motivo, setMotivo] = useState(valor?.alternativa?.motivo ?? '');
  const [originalId, setOriginalId] = useState(valor?.alternativa?.articuloOriginalId ?? (f.candidatos.length === 1 ? f.candidatos[0].id : ''));
  const [tipoConfirmado, setTipoConfirmado] = useState<TipoImportado | ''>('');
  const [destinoId, setDestinoId] = useState(valor?.alternativa ? valor.articuloId ?? '' : '');
  const original = f.candidatos.find(c => c.id === originalId);
  const tipoArchivo = ['equipo', 'cable', 'consumible'].includes(f.datos.tipo) ? f.datos.tipo as TipoImportado : '';
  const tipoEfectivo = original?.tipo || tipoArchivo || tipoConfirmado;
  const fuenteTipo: AlternativaBom['fuenteTipo'] = original ? 'catalogo' : tipoArchivo ? 'archivo' : 'confirmado_por_usuario';
  const cambiarAlternativa = (cambio: { motivo?: string; originalId?: string; tipo?: TipoImportado | ''; destinoId?: string }) => {
    const idOriginal = cambio.originalId ?? originalId;
    const elegido = f.candidatos.find(c => c.id === idOriginal);
    const tipo = elegido?.tipo ?? (tipoArchivo || (cambio.tipo !== undefined ? cambio.tipo : tipoConfirmado));
    const id = cambio.destinoId ?? destinoId;
    alCambiar({ fila: f.fila, ...(id ? { articuloId: id } : {}), ...(tipo ? { alternativa: {
      motivo: cambio.motivo ?? motivo, articuloOriginalId: elegido?.id ?? null, tipoOrigen: tipo,
      fuenteTipo: elegido ? 'catalogo' : tipoArchivo ? 'archivo' : 'confirmado_por_usuario',
    } } : {}) });
  };
  const elegirNormal = (id: string) => {
    setAlternativa(false);
    alCambiar(!id ? undefined : id === 'crear' ? { fila: f.fila, crear: true } : {
      fila: f.fila, articuloId: id, revisionArticulo: f.candidatos.find(c => c.id === id)?.revision,
    });
  };
  return <div className="space-y-3 min-w-64">
    <label className="flex items-center gap-2"><input type="checkbox" aria-label={`Incluir fila ${f.fila}`} checked={Boolean(valor)}
      disabled={ocupado || Boolean(f.errores.length) || (!valor && f.candidatos.length !== 1 && f.estado !== 'alta')}
      onChange={e => { if (e.target.checked) elegirNormal(f.estado === 'alta' ? 'crear' : f.candidatos[0].id);
        else { setAlternativa(false); setMotivo(''); setDestinoId(''); setTipoConfirmado(''); alCambiar(undefined); } }} />Incluir fila</label>
    {!alternativa && <select aria-label={`Acción fila ${f.fila}`} value={valor?.crear ? 'crear' : valor?.articuloId ?? ''}
      disabled={ocupado || Boolean(f.errores.length)} onChange={e => elegirNormal(e.target.value)} className="w-full max-w-xs">
      <option value="">Omitir fila</option>{f.estado === 'alta' && <option value="crear">Crear referencia nueva</option>}
      {f.candidatos.map(c => <option key={c.id} value={c.id}>{c.etiqueta} · {c.tipo} · {c.unidad}{c.activo ? '' : ' · inactivo'}</option>)}
    </select>}
    {destino === 'bom' && !f.errores.length && <button type="button" className="boton" disabled={ocupado}
      onClick={() => { setAlternativa(!alternativa); alCambiar(undefined); setDestinoId(''); setMotivo(''); }}> {alternativa ? 'Cancelar alternativa' : 'Usar alternativa'}</button>}
    {destino !== 'bom' && f.estado === 'no_encontrada' && <BuscadorArticulo etiqueta={`Resolver fila ${f.fila}`} alElegir={a => elegirNormal(a?.id ?? '')} />}
    {alternativa && <fieldset disabled={ocupado} className="space-y-3">
      <legend className="font-semibold">Alternativa fila {f.fila}</legend>
      <p>Original: {original?.etiqueta ?? f.datos.referencia ?? f.datos.modelo} · {f.datos.cantidad} {f.datos.unidad}</p>
      {f.candidatos.length > 1 && <label>Referencia original<select aria-label={`Original fila ${f.fila}`} value={originalId}
        onChange={e => { setOriginalId(e.target.value); cambiarAlternativa({ originalId: e.target.value }); }}>
        <option value="">Identifica el original</option>{f.candidatos.map(c => <option key={c.id} value={c.id}>{c.etiqueta} · {c.tipo}</option>)}</select></label>}
      {!original && !tipoArchivo && <label>Tipo original confirmado<select aria-label={`Tipo original fila ${f.fila}`} value={tipoConfirmado}
        onChange={e => { const tipo = e.target.value as TipoImportado | ''; setTipoConfirmado(tipo); cambiarAlternativa({ tipo }); }}>
        <option value="">Confirma el tipo</option><option value="equipo">Equipo</option><option value="cable">Cable</option><option value="consumible">Consumible</option></select></label>}
      <p>{tipoEfectivo || 'Tipo pendiente'} · {fuenteTipo.replaceAll('_', ' ')}</p>
      <BuscadorArticulo etiqueta={`Alternativa fila ${f.fila}`} tipo={tipoEfectivo || undefined} alElegir={a => { setDestinoId(a?.id ?? ''); cambiarAlternativa({ destinoId: a?.id ?? '' }); }} />
      <label>Motivo de sustitución<textarea aria-label={`Motivo fila ${f.fila}`} maxLength={500} value={motivo}
        onChange={e => { setMotivo(e.target.value); cambiarAlternativa({ motivo: e.target.value }); }} className="w-full" /></label>
    </fieldset>}
  </div>;
}

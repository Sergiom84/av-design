import { ErrorRequisito, type Candidato, type Decisiones, type Destino, hash, type ResultadoExtraccion } from './modelo';
import type { EntradaImportacion, SeleccionFila } from '../importacion/modelo';

export function candidatosDecididos(d: Decisiones): string[] {
  return d.destino === 'areas_bom' ? [...d.areas.map(a => a.candidatoId), ...d.material.map(m => m.candidatoId)] : d.destino === 'catalogo' || d.destino === 'ofertas' ? d.filas.map(f => f.candidatoId) : [d.candidatoId];
}
function exigirCampos(revisados: string[], campos: string[]) {
  if (new Set(revisados).size !== revisados.length || campos.some(c => !revisados.includes(c))) throw new ErrorRequisito('REVISION', `Revisa cada campo: ${campos.join(', ')}.`, 409);
}
export function revisarDecisiones(d: Decisiones, r: ResultadoExtraccion, permitirVacio=false): Candidato[] {
  const ids = candidatosDecididos(d);
  if (!ids.length&&!permitirVacio) throw new ErrorRequisito('SELECCION', 'Selecciona y revisa al menos un candidato.', 409);
  if (new Set(ids).size !== ids.length) throw new ErrorRequisito('DUPLICADO', 'Cada candidato sólo puede tener una decisión por plan.', 409);
  const c = ids.map(id => { const candidato = r.candidatos.find(c => c.id === id); if (!candidato) throw new ErrorRequisito('CANDIDATO', 'El candidato no pertenece a esta extracción.', 409); return candidato; });
  if ('excluidos' in d && (d.excluidos.some(id => ids.includes(id) || !r.candidatos.some(c => c.id === id)) || new Set(d.excluidos).size !== d.excluidos.length)) throw new ErrorRequisito('SELECCION', 'Revisa los candidatos excluidos.');
  if (d.destino === 'areas_bom') {
    for (const a of d.areas) {
      exigirCampos(a.camposRevisados, ['accion', 'nombre', 'codigo', 'localizacion', 'medidas', 'aceptarHomonimo']);
      if (a.accion === 'vincular' ? !a.salaId : a.salaId !== null || Boolean(a.localizacion.id) === Boolean(a.localizacion.nombreNuevo)) throw new ErrorRequisito('AREA', 'Elige una sala existente o una localización explícita para crearla.');
    }
    const claves = new Set<string>();
    for (const m of d.material) {
      exigirCampos(m.camposRevisados, ['sala', 'articuloId', 'cantidad', 'unidad', 'disenoRevisado']);
      if (Boolean(m.salaId) === Boolean(m.areaCandidatoId) || m.areaCandidatoId && !d.areas.some(a => a.candidatoId === m.areaCandidatoId)) throw new ErrorRequisito('MATERIAL', 'Elige una única sala o área revisada.');
      if (m.unidad === 'ud' && !Number.isInteger(m.cantidad) || Number(m.cantidad.toFixed(2)) !== m.cantidad) throw new ErrorRequisito('CANTIDAD', 'Unidades enteras o metros con dos decimales.');
      const clave = `${m.salaId ?? m.areaCandidatoId}:${m.articuloId}`;
      if (claves.has(clave)) throw new ErrorRequisito('DUPLICADO', 'Dos candidatos añaden el mismo artículo a la misma sala. Elige una línea o consolida manualmente conservando su motivo.', 409);
      claves.add(clave);
    }
  } else if (d.destino === 'catalogo' || d.destino === 'ofertas') {
    for (const f of d.filas) {
      exigirCampos(f.camposRevisados, [...Object.keys(f.datos), 'seleccion']);
      if (Object.keys(f.datos).length > 24 || f.crear && (d.destino !== 'catalogo' || f.articuloId !== null) || !f.crear && (!f.articuloId || f.revisionArticulo === null)) throw new ErrorRequisito('IMPORTACION', 'Revisa la referencia y la selección E2.');
    }
  } else exigirCampos(d.camposRevisados, [...Object.keys(d.datos), 'modeloExacto']);
  return c;
}
export function idSalaFutura(planId: string, candidatoId: string): string {
  const h = hash(`${planId}:${candidatoId}`); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
function csv(filas: Record<string, string>[]): Uint8Array {
  const columnas = [...new Set(filas.flatMap(f => Object.keys(f)))].sort();
  const celda = (v: string) => `"${v.replaceAll('"', '""')}"`;
  return Buffer.from([columnas.map(celda).join(';'), ...filas.map(f => columnas.map(c => celda(f[c] ?? '')).join(';'))].join('\r\n'), 'utf8');
}
export function derivado(planId: string, destino: Destino, filas: Record<string,string>[], salaId?: string): EntradaImportacion {
  return { destino: destino === 'areas_bom' ? 'bom' : destino === 'ofertas' ? 'precios' : 'catalogo', ...(salaId ? { salaId } : {}),
    origen: `REA10 plan ${planId}; derivación revisada del documento.`, archivo: { nombre: `requisitos-${planId}${salaId ? '-' + salaId : ''}.csv`, bytes: csv(filas) } };
}
export function seleccionE2(filas: Array<{ articuloId: string | null; crear?: boolean; revisionArticulo: number | null }>): SeleccionFila[] {
  return filas.map((f,i) => ({ fila: i + 2, ...(f.articuloId ? { articuloId: f.articuloId } : {}), ...(f.crear ? { crear: true } : {}), ...(f.revisionArticulo !== null ? { revisionArticulo: f.revisionArticulo } : {}) }));
}

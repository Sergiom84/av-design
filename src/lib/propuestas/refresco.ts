import type { EntradaPropuesta, FuentePropuesta, LineaFuente, LineaValoracion } from './modelo';

export function mismaSeleccionFuente(entrada: EntradaPropuesta['fuente'], guardada: FuentePropuesta) {
    if (entrada.tipo !== guardada.tipo) return false;
    if (entrada.tipo === 'bom') return true;
    return entrada.revisiones.length === guardada.salas.length && guardada.salas.every(s => entrada.revisiones.some(r => r.salaId === s.id && r.revisionId === s.revisionId));
}

/** La clave de origen no basta si ha cambiado el artículo o la unidad. */
export function mismaIdentidadLinea(a: LineaFuente, b: LineaFuente) {
    return a.clave === b.clave && a.articuloId === b.articuloId && a.unidad === b.unidad;
}
export function valoracionVacia(clave: string): LineaValoracion {
    return { clave, moneda: 'EUR', coste: null, origenCoste: null, regla: 'directo', precio: null, motivoPrecio: null, porcentaje: null, impuesto: { tipo: 'sin_configurar' } };
}
export function prepararRefresco(e: EntradaPropuesta, anteriores: LineaFuente[], nuevas: LineaFuente[]) {
    const manuales: LineaFuente[] = e.conceptos.map(l => ({ clave: `manual:${l.id}`, articuloId: null, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, detalles: [], origen: 'concepto documental manual', enlace: '' }));
    const todas = [...nuevas, ...manuales];
    const elegibles = e.valoracion === null ? [] : todas.filter(l => {
        const registrada = anteriores.find(a => a.clave === l.clave);
        const coincide = registrada ? mismaIdentidadLinea(registrada, l) : manuales.some(a => mismaIdentidadLinea(a, l));
        return coincide && e.valoracion!.some(v => v.clave === l.clave);
    }).map(l => l.clave);
    const entradaPreparada: EntradaPropuesta = { ...e, incluidas: nuevas.filter(l => e.incluidas === null || e.incluidas.includes(l.clave) || !anteriores.some(a => mismaIdentidadLinea(a, l))).map(l => l.clave), valoracion: e.valoracion === null ? null : todas.filter(l => l.clave.startsWith('manual:') || e.incluidas === null || e.incluidas.includes(l.clave) || !anteriores.some(a => mismaIdentidadLinea(a, l))).map(l => valoracionVacia(l.clave)) };
    return { entradaPreparada, elegibles: elegibles.filter(k => entradaPreparada.valoracion?.some(l => l.clave === k)) };
}

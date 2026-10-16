import { canonico, type CandidataPlan, type TareaPlan, type DiferenciaPlan, type BaseGenerada } from './modelo';
const campos: (keyof BaseGenerada)[] = ['titulo', 'descripcion', 'duracionEstimadaMin'];
export function compararPlan(candidatas: CandidataPlan[], tareas: TareaPlan[]): DiferenciaPlan[] {
    const existentes = new Map(tareas.filter(t => t.claveOrigen).map(t => [t.claveOrigen!, t]));
    const claves = new Set(candidatas.map(c => c.clave));
    const resultado: DiferenciaPlan[] = candidatas.map(c => {
        const t = existentes.get(c.clave) ?? null;
        if (!t)
            return { clave: c.clave, estado: 'nueva', candidata: c, tarea: null, campos: [] };
        const diferencias = campos.filter(k => canonico(t[k]) !== canonico(c[k]) || canonico(t.baseGenerada?.[k]) !== canonico(c[k])).map(k => ({ campo: k, anterior: t.baseGenerada?.[k] ?? null, actual: t[k], propuesto: c[k], manual: !!t.baseGenerada && canonico(t[k]) !== canonico(t.baseGenerada[k]) }));
        const estado = t.estado === 'anulada' ? 'anulada_existente' : diferencias.some(f => f.manual) ? 'edicion_manual' : diferencias.length || canonico(t.origenPublico) !== canonico(c.origenPublico) || canonico(t.origenCatalogo) !== canonico(c.origenCatalogo) ? 'cambiada' : 'sin_cambios';
        return { clave: c.clave, estado, candidata: c, tarea: t, campos: diferencias };
    });
    for (const t of tareas)
        if (t.claveOrigen && !claves.has(t.claveOrigen))
            resultado.push({ clave: t.claveOrigen, estado: 'origen_retirado', candidata: null, tarea: t, campos: [] });
    return resultado;
}

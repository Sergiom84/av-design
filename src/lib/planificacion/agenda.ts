import { partesMadrid, sumarDias, diaISO, rangoMadrid } from './fechas';
import { type TareaAgenda, type FiltroAgenda } from './modelo';
export function unionMinutos(intervalos: {
    inicio: number;
    fin: number;
}[]): number {
    const ordenados = intervalos.filter(i => i.fin > i.inicio).sort((a, b) => a.inicio - b.inicio);
    let fin = -Infinity, total = 0;
    for (const i of ordenados) {
        total += Math.max(0, i.fin - Math.max(fin, i.inicio));
        fin = Math.max(fin, i.fin);
    }
    return total / 60000;
}
export function periodosAgenda(filtro: FiltroAgenda, ahora: Date) {
    const hoy = partesMadrid(ahora).fecha, lunes = sumarDias(hoy, 1 - diaISO(hoy));
    const dia = rangoMadrid(hoy, hoy), semana = rangoMadrid(lunes, sumarDias(lunes, 6));
    const rango = filtro.desde && filtro.hasta ? rangoMadrid(filtro.desde, filtro.hasta) : filtro.vista === 'hoy' ? dia : semana;
    return { hoy, lunes, dia, semana, rango };
}
export function resumirAgenda(tareas: TareaAgenda[], filtro: FiltroAgenda, ahora: Date) {
    const { hoy, lunes, dia, semana, rango } = periodosAgenda(filtro, ahora);
    const solapa = (t: TareaAgenda, r: typeof rango) => !!t.inicio && !!t.fin && t.inicio < r.fin && t.fin > r.inicio;
    const abiertas = [...new Map(tareas.filter(t => !t.archivado && ['borrador', 'pendiente', 'en_curso'].includes(t.estado) && (!filtro.proyectoId || t.proyectoId === filtro.proyectoId) && (!filtro.tecnicoId || t.tecnicos.some(p => p.id === filtro.tecnicoId))).map(t => [t.id, t])).values()];
    const enVista = (t: TareaAgenda, v: FiltroAgenda['vista']) => v === 'hoy' ? solapa(t, dia) || t.venceFecha === hoy : v === 'semana' ? solapa(t, semana) || !!t.venceFecha && t.venceFecha >= lunes && t.venceFecha <= sumarDias(lunes, 6) : v === 'vencidas' ? t.venceFecha ? t.venceFecha < hoy : !!t.fin && +new Date(t.fin) < +ahora : !t.venceFecha && !t.inicio;
    const contadores = { hoy: 0, semana: 0, vencidas: 0, sin_fecha: 0 };
    for (const v of Object.keys(contadores) as FiltroAgenda['vista'][])
        contadores[v] = abiertas.filter(t => enVista(t, v)).length;
    const seleccion = filtro.historial ? tareas.filter(t => !t.archivado && (!filtro.proyectoId || t.proyectoId === filtro.proyectoId) && (!filtro.tecnicoId || t.tecnicos.some(p => p.id === filtro.tecnicoId))) : abiertas.filter(t => enVista(t, filtro.vista));
    const ocupacion = new Map<string, {
        tecnicoId: string;
        nombre: string;
        activo: boolean;
        intervalos: {
            inicio: number;
            fin: number;
        }[];
    }>();
    for (const t of abiertas)
        if (['pendiente', 'en_curso'].includes(t.estado) && t.inicio && t.fin)
            for (const p of t.tecnicos) {
                if (filtro.tecnicoId && p.id !== filtro.tecnicoId)
                    continue;
                const r = ocupacion.get(p.id) ?? { tecnicoId: p.id, nombre: p.nombre, activo: p.activo, intervalos: [] };
                r.intervalos.push({ inicio: Math.max(+new Date(t.inicio), +new Date(rango.inicio)), fin: Math.min(+new Date(t.fin), +new Date(rango.fin)) });
                ocupacion.set(p.id, r);
            }
    return { ahora: ahora.toISOString(), hoy, zona: 'Europe/Madrid', rango, filtros: filtro, contadores, tareas: seleccion, ocupacion: [...ocupacion.values()].map(({ intervalos, ...p }) => ({ ...p, minutos: unionMinutos(intervalos) })), estimacion: { minutosConocidos: seleccion.reduce((n, t) => n + (t.duracionEstimadaMin ?? 0), 0), sinEstimar: seleccion.filter(t => t.duracionEstimadaMin === null).length }, asignadasSinIntervalo: seleccion.filter(t => t.tecnicos.length && !t.inicio).length, sinTecnico: seleccion.filter(t => !t.tecnicos.length).length };
}

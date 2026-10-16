import { ErrorInforme, ZONA, type PeriodoInforme, type PeriodoResuelto } from './modelo';
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function partesMadrid(fecha: Date) {
    const p = Object.fromEntries(formato.formatToParts(fecha).map(x => [x.type, x.value]));
    return { fecha: `${p.year.padStart(4, '0')}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, segundo: p.second };
}
export function fechaCivil(texto: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto))
        throw new ErrorInforme('ENTRADA_INVALIDA', 'La fecha debe ser YYYY-MM-DD.');
    const [y, m, d] = texto.split('-').map(Number);
    if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31 || new Date(texto + 'T00:00:00.000Z').toISOString().slice(0, 10) !== texto)
        throw new ErrorInforme('ENTRADA_INVALIDA', 'La fecha no existe.');
    return texto;
}
export function sumarDias(fecha: string, n: number): string {
    fechaCivil(fecha);
    return new Date(Date.parse(fecha + 'T00:00:00.000Z') + n * 86400000).toISOString().slice(0, 10);
}
export function diaISO(fecha: string) {
    fechaCivil(fecha);
    return new Date(fecha + 'T00:00:00.000Z').getUTCDay() || 7;
}
/** Todos los candidatos se verifican de vuelta contra la hora de pared, primera aparición en otoño. */
export function instantesMadrid(fecha: string, hora: string): Date[] {
    fechaCivil(fecha);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
        throw new ErrorInforme('ENTRADA_INVALIDA', 'Hora inválida.');
    const pared = Date.parse(`${fecha}T${hora}:00.000Z`);
    const offsets = new Set([-86400000, 0, 86400000].map(delta => {
        const muestra = new Date(pared + delta);
        const p = partesMadrid(muestra);
        return Date.parse(`${p.fecha}T${p.hora}:${p.segundo}.000Z`) - +muestra;
    }));
    return [...offsets].map(offset => new Date(pared - offset)).filter(instante => {
        const p = partesMadrid(instante);
        return p.fecha === fecha && p.hora === hora && p.segundo === '00';
    }).sort((a, b) => +a - +b);
}
export function medianocheMadrid(fecha: string): Date {
    const r = instantesMadrid(fecha, '00:00')[0];
    if (!r)
        throw new ErrorInforme('ENTRADA_INVALIDA', 'Medianoche no disponible.');
    return r;
}
export function resolverPeriodo(periodo: PeriodoInforme, ocurrencia: Date): PeriodoResuelto {
    if (!(ocurrencia instanceof Date) || !Number.isFinite(+ocurrencia))
        throw new ErrorInforme('ENTRADA_INVALIDA', 'Ocurrencia inválida.');
    if (periodo.modo === 'actual')
        return { modo: 'actual', zona: ZONA };
    let desde: string, hasta: string;
    if (periodo.modo === 'rango') {
        desde = fechaCivil(periodo.desde);
        hasta = fechaCivil(periodo.hasta);
    }
    else {
        const hoy = partesMadrid(ocurrencia).fecha;
        if (periodo.intervalo === 'dia_anterior')
            desde = hasta = sumarDias(hoy, -1);
        else if (periodo.intervalo === 'semana_anterior') {
            hasta = sumarDias(hoy, -diaISO(hoy));
            desde = sumarDias(hasta, -6);
        }
        else {
            hasta = sumarDias(hoy.slice(0, 8) + '01', -1);
            desde = hasta.slice(0, 8) + '01';
        }
    }
    if (desde > hasta || (+new Date(hasta + 'T00:00:00Z') - +new Date(desde + 'T00:00:00Z')) / 86400000 >= 366)
        throw new ErrorInforme('ENTRADA_INVALIDA', 'El rango debe contener entre 1 y 366 días.');
    return { modo: 'rango', zona: ZONA, desde, hasta, desdeUtc: medianocheMadrid(desde).toISOString(), hastaUtcExclusivo: medianocheMadrid(sumarDias(hasta, 1)).toISOString() };
}

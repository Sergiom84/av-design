import { fechaCivil, sumarDias, diaISO, partesMadrid, instantesMadrid, medianocheMadrid } from '../informes/periodos';
import { ErrorPlan, type CamposTarea } from './modelo';
export { sumarDias, diaISO, partesMadrid };
export function fechaPlan(texto: string): string {
    try {
        return fechaCivil(texto);
    }
    catch {
        throw new ErrorPlan('FECHA_INVALIDA', 'La fecha civil no existe.');
    }
}
export function instanteLocal(valor: {
    fecha: string;
    hora: string;
    offset?: string;
}): string {
    let opciones: Date[];
    try {
        opciones = instantesMadrid(valor.fecha, valor.hora);
    }
    catch {
        throw new ErrorPlan('FECHA_INVALIDA', 'Comprueba la fecha y la hora de Madrid.');
    }
    if (!opciones.length)
        throw new ErrorPlan('HORA_INEXISTENTE', 'La hora no existe en Madrid por el cambio de horario.', 422);
    const alternativas = opciones.map(d => ({ instante: d.toISOString(), offset: (Date.parse(`${valor.fecha}T${valor.hora}:00Z`) - +d) === 7200000 ? '+02:00' : '+01:00' }));
    if (opciones.length > 1 && !valor.offset)
        throw new ErrorPlan('HORA_AMBIGUA', 'La hora es ambigua: elige uno de los dos offsets de Madrid.', 422, { alternativas });
    const elegida = valor.offset ? alternativas.find(o => o.offset === valor.offset) : alternativas[0];
    if (!elegida)
        throw new ErrorPlan('OFFSET_INVALIDO', 'El offset no corresponde a esta hora de Madrid.', 422, { alternativas });
    return elegida.instante;
}
export function intervaloPlan(intervalo: CamposTarea['intervalo']) {
    if (!intervalo)
        return { inicio: null, fin: null };
    const inicio = instanteLocal(intervalo.inicio), fin = instanteLocal(intervalo.fin);
    if (+new Date(fin) <= +new Date(inicio) || +new Date(fin) - +new Date(inicio) > 7 * 86400000)
        throw new ErrorPlan('INTERVALO_INVALIDO', 'El final debe ser posterior y el bloque no puede superar siete días.');
    return { inicio, fin };
}
export function rangoMadrid(desde: string, hasta: string) {
    fechaPlan(desde);
    fechaPlan(hasta);
    if (desde > hasta || (+new Date(hasta) - +new Date(desde)) / 86400000 >= 93)
        throw new ErrorPlan('RANGO_INVALIDO', 'El rango admite entre uno y 93 días.');
    try {
        return { inicio: medianocheMadrid(desde).toISOString(), fin: medianocheMadrid(sumarDias(hasta, 1)).toISOString() };
    }
    catch {
        throw new ErrorPlan('FECHA_INVALIDA', 'No se pudo delimitar el día de Madrid.');
    }
}
export function localDesdeInstante(utc: string) {
    const instante = new Date(utc), pared = partesMadrid(instante);
    const offset = Date.parse(`${pared.fecha}T${pared.hora}:00Z`) - +instante === 7200000 ? '+02:00' as const : '+01:00' as const;
    return { fecha: pared.fecha, hora: pared.hora, offset };
}

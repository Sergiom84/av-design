import { calendarioSchema, entrada, ErrorInforme, type CalendarioInforme } from './modelo';
import { diaISO, fechaCivil, instantesMadrid, partesMadrid, sumarDias } from './periodos';
export interface OcurrenciaInforme {
    utc: string;
    local: string;
    offset: string;
}
export function describirOcurrencia(fecha: Date): OcurrenciaInforme {
    const p = partesMadrid(fecha);
    const offset = (Date.parse(`${p.fecha}T${p.hora}:00Z`) - (+fecha - fecha.getUTCSeconds() * 1000 - fecha.getUTCMilliseconds())) / 60000;
    return { utc: fecha.toISOString(), local: `${p.fecha} ${p.hora}`, offset: `+${String(Math.floor(offset / 60)).padStart(2, '0')}:${String(offset % 60).padStart(2, '0')}` };
}
export function proximasOcurrencias(entradaCalendario: CalendarioInforme, desde: Date, limite = 5) {
    const c = entrada(calendarioSchema, entradaCalendario);
    fechaCivil(c.inicio);
    if (c.fin !== null) {
        fechaCivil(c.fin);
        if (c.fin < c.inicio)
            throw new ErrorInforme('ENTRADA_INVALIDA', 'El fin precede al inicio.');
    }
    const ocurrencias: OcurrenciaInforme[] = [], omisiones: string[] = [];
    let fecha = c.inicio > partesMadrid(desde).fecha ? c.inicio : partesMadrid(desde).fecha;
    if (c.frecuencia === 'una_vez')
        fecha = c.inicio;
    for (let paso = 0; paso < 37000 && ocurrencias.length < limite; paso++, fecha = sumarDias(fecha, 1)) {
        if (c.fin && fecha > c.fin)
            break;
        if (c.frecuencia === 'una_vez' && fecha !== c.inicio)
            break;
        if (c.frecuencia === 'semanal' && !c.diasSemana!.includes(diaISO(fecha)))
            continue;
        const candidatos = instantesMadrid(fecha, c.hora);
        if (!candidatos.length) {
            if (omisiones.length < 20)
                omisiones.push(`${fecha} ${c.hora}: hora inexistente, omitida`);
            continue;
        }
        if (+candidatos[0] > +desde)
            ocurrencias.push(describirOcurrencia(candidatos[0]));
    }
    return { ocurrencias, omisiones };
}
export function validarCalendario(c: CalendarioInforme, ahora: Date) {
    const r = proximasOcurrencias(c, ahora);
    if (!r.ocurrencias.length)
        throw new ErrorInforme('ENTRADA_INVALIDA', 'El calendario no tiene una próxima ocurrencia válida.');
    return r;
}

import { instanteLocal } from '../planificacion/fechas';
import { ErrorPlan } from '../planificacion/modelo';
import { medianocheMadrid, partesMadrid, resolverPeriodo, sumarDias } from '../informes/periodos';
import { ErrorInforme } from '../informes/modelo';

export interface HoraTrabajo {
  fecha: string;
  hora: string;
  offset?: string;
}
export class ErrorIntervaloReal extends Error {
  constructor(message: string, public codigo = 'INTERVALO_INVALIDO', public status = 400, public detalles?: unknown) {
    super(message);
  }
}
function convertir(entrada: HoraTrabajo): string {
  if (!entrada || typeof entrada.fecha !== 'string' || typeof entrada.hora !== 'string') {
    throw new ErrorIntervaloReal('Indica fecha y hora de inicio y final.');
  }
  try {
    return instanteLocal(entrada);
  } catch (error) {
    if (error instanceof ErrorPlan) {
      throw new ErrorIntervaloReal(error.message, error.codigo, error.status, error.detalle);
    }
    throw error;
  }
}
/** El llamante entrega el reloj de BD; nunca se da por real una fecha futura. */
export function validarIntervaloReal(entrada: { inicio: HoraTrabajo; fin: HoraTrabajo }, ahora: Date) {
  if (!entrada || !(ahora instanceof Date) || !Number.isFinite(+ahora)) {
    throw new ErrorIntervaloReal('Se necesita un intervalo y un reloj válido.');
  }
  const inicioUtc = convertir(entrada.inicio), finUtc = convertir(entrada.fin);
  const minutos = (Date.parse(finUtc) - Date.parse(inicioUtc)) / 60000;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 1440) {
    throw new ErrorIntervaloReal('El final debe ser posterior; cada parte admite hasta 24 horas reales.');
  }
  if (Date.parse(finUtc) > +ahora) {
    throw new ErrorIntervaloReal('El trabajo real no puede terminar en el futuro.');
  }
  return { inicioUtc, finUtc, minutos, zona: 'Europe/Madrid' as const, entradaLocal: structuredClone(entrada) };
}
function instantePreciso(texto: string): number {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(texto)) {
    throw new ErrorIntervaloReal('El instante UTC debe tener precisión de minuto.');
  }
  const valor = Date.parse(texto);
  if (!Number.isFinite(valor) || new Date(valor).toISOString().replace('.000Z', 'Z') !== texto.replace('.000Z', 'Z')) {
    throw new ErrorIntervaloReal('El instante UTC no existe.');
  }
  return valor;
}
/** Hasta 366 días civiles; sus medianoches pueden distar 23 o 25 horas. */
export function repartirMinutosMadrid(inicioUtc: string, finUtc: string) {
  let cursor = instantePreciso(inicioUtc);
  const final = instantePreciso(finUtc);
  if (final <= cursor) {
    throw new ErrorIntervaloReal('El final del resumen debe ser posterior al inicio.');
  }
  // El final es exclusivo: una medianoche no añade el día siguiente.
  rangoTrabajoMadrid(partesMadrid(new Date(cursor)).fecha, partesMadrid(new Date(final - 60000)).fecha);
  const dias: Array<{ fecha: string; inicioUtc: string; finUtc: string; minutos: number }> = [];
  while (cursor < final) {
    const fecha = partesMadrid(new Date(cursor)).fecha;
    const limite = +medianocheMadrid(sumarDias(fecha, 1));
    const fin = Math.min(limite, final);
    if (fin <= cursor) throw new ErrorIntervaloReal('No se pudo delimitar el día de Madrid.');
    dias.push({ fecha, inicioUtc: new Date(cursor).toISOString(), finUtc: new Date(fin).toISOString(), minutos: (fin - cursor) / 60000 });
    cursor = fin;
  }
  return dias;
}
export function rangoTrabajoMadrid(desde: string, hasta: string) {
  try {
    const periodo = resolverPeriodo({ modo: 'rango', desde, hasta }, new Date('2000-01-01T00:00:00Z'));
    if (periodo.modo !== 'rango') throw new ErrorIntervaloReal('El rango debe tener inicio y final.');
    return { desde: periodo.desde, hasta: periodo.hasta, inicioUtc: periodo.desdeUtc, finUtcExclusivo: periodo.hastaUtcExclusivo, zona: 'Europe/Madrid' as const };
  } catch (error) {
    if (error instanceof ErrorInforme) throw new ErrorIntervaloReal(error.message);
    throw error;
  }
}

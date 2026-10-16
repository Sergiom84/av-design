import { RepositorioPlanificacion } from './repositorio';
import type { ConexionPlan } from './autorizacion';
import { entradaPlan, filtroAgendaSchema, type FiltroAgenda } from './modelo';
export { RepositorioPlanificacion };
/** Usa la transacción coherente del Panel o la llamada pública. Nunca abre begin. */
export function leerAgendaEnLectura(conexion: ConexionPlan, usuarioId: string, filtros: FiltroAgenda, ahora: Date) {
    return new RepositorioPlanificacion(conexion).agendaEnLectura(conexion, usuarioId, entradaPlan(filtroAgendaSchema, filtros), ahora);
}
export function leerAgendaPlanificada(conexion: ConexionPlan, usuarioId: string, filtros: FiltroAgenda, ahora: Date) {
    return conexion.begin('isolation level repeatable read read only', tx => leerAgendaEnLectura(tx as unknown as ConexionPlan, usuarioId, filtros, ahora));
}

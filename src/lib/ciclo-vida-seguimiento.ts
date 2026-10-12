/** La visita previa no acredita ninguna de estas pruebas de funcionamiento. */
export const PUNTOS_PRUEBA_FINAL = [
  { clave: 'encendido', titulo: 'Encendido y alimentación' },
  { clave: 'imagen', titulo: 'Imagen y fuentes de vídeo' },
  { clave: 'audio', titulo: 'Audio y micrófonos' },
  { clave: 'red', titulo: 'Red y conectividad' },
  { clave: 'control', titulo: 'Control y funcionamiento del conjunto' },
  { clave: 'cableado', titulo: 'Cableado, conexiones y etiquetado' },
] as const;
export type PuntoFinal = { clave: string; resultado: 'pendiente' | 'conforme' | 'incidencia' | 'no_aplica'; nota: string };
export type PlanInstalacion = { fecha_prevista: string | null; instalador_id: string | null; nota: string; version: number };
export type PruebaFinal = { puntos: PuntoFinal[]; version: number; fecha: string | null; tecnico_id: string | null; tecnico: string | null };
export type AuditoriaInstalacion = { id: string; operacion: string; autor: string; registrado_en: string; datos: Record<string, unknown> };
export type SeguimientoInstalacion = { disponible: boolean; plan: PlanInstalacion | null; prueba: PruebaFinal | null; auditoria: AuditoriaInstalacion[] };

export class ErrorSeguimiento extends Error {}
export function exigirSeguimiento(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorSeguimiento(mensaje);
}
export function fechaSeguimiento(valor: string): string {
  exigirSeguimiento(/^\d{4}-\d{2}-\d{2}$/.test(valor) && Number(valor.slice(0, 4)) > 0 &&
    Number.isFinite(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor, 'Fecha no válida.');
  return valor;
}
export function puntosFinales(valor: unknown): PuntoFinal[] {
  exigirSeguimiento(Array.isArray(valor) && valor.length === PUNTOS_PRUEBA_FINAL.length, 'Faltan puntos de la prueba final.');
  return PUNTOS_PRUEBA_FINAL.map(({ clave }) => {
    const coincidencias = valor.filter((p) => p && p.clave === clave);
    exigirSeguimiento(coincidencias.length === 1, 'Checklist incompleto o duplicado.');
    const p = coincidencias[0];
    exigirSeguimiento(['pendiente', 'conforme', 'incidencia', 'no_aplica'].includes(p.resultado) &&
      typeof p.nota === 'string' && p.nota.length <= 2000, 'Resultado de prueba no válido.');
    exigirSeguimiento(!['incidencia', 'no_aplica'].includes(p.resultado) || p.nota.trim(), 'Justifica las incidencias y los puntos que no aplican.');
    return { clave, resultado: p.resultado, nota: p.nota.trim() };
  });
}
export function pruebaCompleta(puntos: PuntoFinal[]): boolean {
  const validos = puntosFinales(puntos);
  return validos.every((p) => p.resultado === 'conforme' || p.resultado === 'no_aplica') &&
    validos.some((p) => p.resultado === 'conforme');
}
export function exigirOrdenFinal(instalacion: string | null, prueba: string | null, fecha: string, entrega = false) {
  fechaSeguimiento(fecha);
  exigirSeguimiento(instalacion, 'Primero marca la instalación como Hecho.');
  exigirSeguimiento(fecha >= instalacion, 'La fecha no puede ser anterior a la instalación.');
  if (entrega) {
    exigirSeguimiento(prueba, 'Primero completa la prueba técnica final.');
    exigirSeguimiento(fecha >= prueba, 'La entrega no puede ser anterior a la prueba final.');
  }
}

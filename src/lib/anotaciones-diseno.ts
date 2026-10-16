export interface AnotacionDiseno {
  id: string;
  texto: string;
  ancla_tipo: 'sala' | 'equipo' | 'conexion' | 'visual';
  ancla_id: string | null;
  /** Coordenadas de presentación lógica; nunca metros del plano físico. */
  x: number | null;
  y: number | null;
}
export type DecisionAnotacion = { anotacion_id: string; accion: 'conservar' | 'retirar' };
export function resolverAnotacionesDeAncla(anotaciones: AnotacionDiseno[], tipo: 'equipo' | 'conexion', id: string, decisiones: DecisionAnotacion[]): AnotacionDiseno[] | null {
  const afectadas = anotaciones.filter(a => a.ancla_tipo === tipo && a.ancla_id === id);
  if (afectadas.some(a => !decisiones.some(d => d.anotacion_id === a.id))) return null;
  return anotaciones.flatMap(a => {
    if (!afectadas.some(n => n.id === a.id)) return [a];
    return decisiones.find(d => d.anotacion_id === a.id)?.accion === 'retirar' ? [] : [{ ...a, ancla_tipo: 'sala' as const, ancla_id: null, x: null, y: null }];
  });
}

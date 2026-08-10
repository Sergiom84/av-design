import { Estado, type TonoEstado } from '@/components/ui';

/**
 * En qué punto está el guardado. Se dice con texto y no solo con color: el
 * color es un refuerzo, no el mensaje.
 */
export type EstadoGuardado =
  | 'limpio'
  | 'sucio'
  | 'guardando'
  | 'guardado'
  | 'conflicto'
  | 'error';

const ETIQUETA: Record<EstadoGuardado, string> = {
  limpio: 'Sin cambios',
  sucio: 'Cambios sin guardar',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  conflicto: 'Conflicto',
  error: 'No se ha guardado',
};

const TONO: Record<EstadoGuardado, TonoEstado> = {
  limpio: 'neutro',
  sucio: 'aviso',
  guardando: 'informacion',
  guardado: 'listo',
  conflicto: 'bloqueo',
  error: 'bloqueo',
};

export function EstadoDeGuardado({ estado }: { estado: EstadoGuardado }) {
  return (
    // `polite` y no `assertive`: enterarse de que se guardó no puede
    // interrumpir a quien está escribiendo una coordenada.
    <span role="status" aria-live="polite">
      <Estado tono={TONO[estado]}>{ETIQUETA[estado]}</Estado>
    </span>
  );
}

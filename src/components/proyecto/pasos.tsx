import { Enlace } from '@/components/ui';
import {
  ETIQUETA_PASO_PROYECTO,
  type ClavePasoProyecto,
  type PasoProyecto,
} from '@/lib/proyecto';

/**
 * Qué falta para que la obra esté lista, en el orden en que se hace:
 * localizaciones, salas y medidas. No es un asistente de alta —el proyecto ya
 * está creado— sino el estado derivado de lo que hay, con la acción del paso
 * actual a un clic. Sin esto, la portada de una obra recién creada no dice
 * cuál es el siguiente movimiento y "Nueva sala" pasa desapercibido.
 */
const ACCION_PASO: Record<ClavePasoProyecto, { texto: string; href: (id: string) => string }> = {
  localizaciones: {
    texto: 'Añadir localización',
    href: () => '#nueva-localizacion',
  },
  salas: {
    texto: 'Crear salas',
    href: (id) => `/salas/nueva?proyecto=${id}`,
  },
  medidas: {
    texto: 'Ver las salas',
    href: (id) => `/salas?proyecto=${id}`,
  },
};

export function PasosDeProyecto({
  proyectoId,
  pasos,
  cerrado = false,
}: {
  proyectoId: string;
  pasos: PasoProyecto[];
  /** Una obra cerrada no tiene siguiente paso: no se ofrece ninguna acción. */
  cerrado?: boolean;
}) {
  if (cerrado || pasos.every((p) => p.hecho)) return null;

  return (
    <ol className="grid sm:grid-cols-3 gap-3 mb-6">
      {pasos.map((paso, i) => (
        <li
          key={paso.clave}
          aria-current={paso.actual ? 'step' : undefined}
          className={`tarjeta p-3 flex items-start gap-3 ${
            paso.actual ? 'border-l-2 border-acento' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className={`shrink-0 w-6 h-6 rounded-full grid place-items-center text-[0.75rem] font-medium tabular-nums ${
              paso.hecho
                ? 'bg-exito-suave text-exito-fuerte'
                : paso.actual
                  ? 'bg-acento text-superficie'
                  : 'bg-linea-suave text-tinta-tenue'
            }`}
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <div className="t-etiqueta">
              {ETIQUETA_PASO_PROYECTO[paso.clave]}
              <span className="sr-only">{paso.hecho ? ' · hecho' : ' · pendiente'}</span>
            </div>
            <div className="text-tinta-tenue text-[0.8125rem] [overflow-wrap:anywhere]">
              {paso.detalle}
            </div>
            {paso.actual && (
              <div className="mt-1">
                <Enlace href={ACCION_PASO[paso.clave].href(proyectoId)}>
                  {ACCION_PASO[paso.clave].texto}
                </Enlace>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

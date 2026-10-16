import type { Estado as TipoEstado } from '@/lib/seguimiento-propuestas/modelo';
export const ETIQUETAS: Record<TipoEstado, string> = { borrador: 'Borrador', emitida: 'Emitida internamente', aceptada: 'Aceptada internamente', rechazada: 'Rechazada internamente' };
export function Estado({ estado }: { estado: TipoEstado }) { return <span className="inline-flex rounded-md bg-[var(--superficie-hundida)] px-2 py-1 text-sm font-semibold">{ETIQUETAS[estado]}</span>; }

'use client';

import { Boton } from '@/components/ui';

export function ImprimirPaquete() {
  return <Boton tipo="button" onClick={() => window.print()}>Imprimir paquete técnico</Boton>;
}

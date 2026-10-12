import type { TomaRed } from '@/lib/tipos';

export const rosetaEnsayo: TomaRed = {
  id: 't1', sala_id: 's1', codigo: 'R-12', codigo_referencia: null, codigo_confirmado: true,
  capacidad_documentada: 2, esquema_x: 900, esquema_y: 80, ubicacion: 'suelo',
  x_m: 0, y_m: 0, z_m: null, notas: null,
  bocas: [1, 2].map((ordinal) => ({ id: `r${ordinal}`, toma_red_id: 't1', ordinal,
    etiqueta: null, senal: 'red', conector: 'RJ45' })),
};

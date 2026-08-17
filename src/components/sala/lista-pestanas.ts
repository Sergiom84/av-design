/**
 * Qué pestañas tiene la ficha de sala, y en qué orden.
 *
 * Vive en su propio módulo y no dentro de `pestanas.tsx` por una razón
 * concreta: `pestanas.tsx` es `'use client'`, y una guarda que compruebe que
 * cada pestaña tiene ruta no debería tener que montar React para leer una
 * lista. Aquí es un dato, y `src/pruebas/pestanas-de-sala.test.ts` lo compara
 * contra los directorios que existen de verdad bajo `src/app/salas/[id]/`.
 *
 * `Plano` es la posición física de las cosas y `Diagrama` es qué conecta con
 * qué. `Acotaciones` aparece antes de tener contenido para que la barra deje
 * de moverse cuando llegue. `Cableado` se retira cuando `Diagrama` cubra su
 * flujo, y no antes: hoy es la única superficie del esquema de conexiones.
 */
export const PESTANAS = [
  { segmento: null, etiqueta: 'Resumen' },
  { segmento: 'plano', etiqueta: 'Plano' },
  { segmento: 'diagrama', etiqueta: 'Diagrama' },
  { segmento: 'acotaciones', etiqueta: 'Acotaciones' },
  { segmento: 'equipamiento', etiqueta: 'Equipamiento' },
  { segmento: 'cableado', etiqueta: 'Cableado' },
  { segmento: 'logistica', etiqueta: 'Logística y ciclo de vida' },
  { segmento: 'documentos', etiqueta: 'Documentos' },
] as const;

export type SegmentoPestana = (typeof PESTANAS)[number]['segmento'];

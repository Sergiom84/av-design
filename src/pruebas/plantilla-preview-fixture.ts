import type { DatosPlantillaPreview } from '@/lib/plantilla-preview';

export function fixturePlantilla(): DatosPlantillaPreview {
  return {
    plantilla: { id: 'a1010000-0000-4000-8000-000000000001', nombre: 'Prueba previa', tipologia: 'PRUEBA', aforo: 4, n_salas_reales: null,
      largo_m: 6, ancho_m: 4, alto_m: 3, alto_falso_techo_m: 2.6, ruta_por_defecto: 'falso_techo', notas: null,
      mesa_largo_m: 2, mesa_ancho_m: 1, mesa_alto_cm: 73, mesa_x_m: 2, mesa_y_m: 2, mesa_rotacion_grados: 30 },
    lineas: [
      { id: 'linea-1', articulo_id: 'art-1', categoria: 'Pantalla', cantidad: 1, opcional: false, modelo_texto: 'Pantalla confirmada', extremo: 'pared',
        x_m: 0, y_m: 0, z_m: 0, posicion_confirmada: true, rotacion_grados: 90, referencia: { id: 'art-1', etiqueta: 'Modelo exacto', activo: true, tipo: 'equipo', unidad: 'ud', revision: 2 } },
      { id: 'linea-2', articulo_id: 'art-2', categoria: 'Rack', cantidad: 1, opcional: false, modelo_texto: 'Rack estimado', extremo: 'rack',
        x_m: null, y_m: null, z_m: null, posicion_confirmada: null, rotacion_grados: 0, referencia: { id: 'art-2', etiqueta: 'Rack', activo: true, tipo: 'equipo', unidad: 'ud', revision: 0 } },
      { id: 'opcional', articulo_id: null, categoria: 'Altavoz', cantidad: 2, opcional: true, modelo_texto: 'No en todas', extremo: null,
        x_m: null, y_m: null, z_m: null, posicion_confirmada: false, rotacion_grados: 0, referencia: null },
    ], muebles: [], puertas: [], conexiones: [], referenciasCable: [], avisos: [],
  };
}


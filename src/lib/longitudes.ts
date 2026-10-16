export type UnidadLongitud = 'm' | 'ft';
export type Dimensiones = { largo_m: number | null; ancho_m: number | null; alto_m: number | null };

/** Entrada de usuario; el resultado persistido conserva la precisión actual. */
export function convertirLongitud(texto: string, unidad: unknown, maximo = 9999.99) {
  if (unidad !== 'm' && unidad !== 'ft') throw new Error('Elige metros o pies.');
  const bruto = texto.trim();
  if (!bruto) return null;
  if (!/^\d+(?:[.,]\d*)?$/.test(bruto)) throw new Error('Escribe una longitud positiva con coma o punto decimal.');
  const metrosExactos = Number(bruto.replace(',', '.')) * (unidad === 'ft' ? .3048 : 1);
  if (!Number.isFinite(metrosExactos) || metrosExactos > maximo) throw new Error(`La longitud debe estar entre 0 y ${maximo} m.`);
  const metrosPersistidos = Math.round((metrosExactos + Number.EPSILON) * 100) / 100;
  if (metrosExactos > 0 && metrosPersistidos === 0) throw new Error('La medida es menor que la precisión de un centímetro.');
  if (metrosPersistidos > maximo) throw new Error(`La longitud supera ${maximo} m.`);
  return { metrosExactos, metrosPersistidos };
}

export function leerDimensiones(datos: FormData, maximo = 9999.99): Dimensiones {
  const unidad = datos.get('unidad_dimensiones');
  return Object.fromEntries(['largo', 'ancho', 'alto'].map(clave => [
    `${clave}_m`, convertirLongitud(String(datos.get(`entrada_${clave}`) ?? ''), unidad, maximo)?.metrosPersistidos ?? null,
  ])) as Dimensiones;
}

export function textoEnUnidad(metros: number | null, unidad: UnidadLongitud): string {
  if (metros === null) return '';
  let mostrado = Number((metros / (unidad === 'ft' ? .3048 : 1)).toFixed(10));
  // El texto generado no debe sobrepasar el valor canónico por el redondeo
  // binario de la división: el servidor mantiene su límite estricto.
  if (unidad === 'ft' && mostrado * .3048 > metros) mostrado = Number((mostrado - 1e-10).toFixed(10));
  return String(mostrado).replace('.', ',');
}

const CAMPOS_PLANTILLA = ['largo_m', 'ancho_m', 'alto_m', 'alto_falso_techo_m', 'mesa_largo_m', 'mesa_ancho_m', 'mesa_alto_cm', 'mesa_x_m', 'mesa_y_m', 'mesa_rotacion_grados', 'ruta_por_defecto'] as const;
/** Huella de concurrencia del formulario; no es un permiso ni un secreto. */
export function firmaMedidasPlantilla(plantilla: object): string {
  const fila = plantilla as Record<string, unknown>;
  return JSON.stringify(CAMPOS_PLANTILLA.map(k => [k, fila[k] == null ? null : k === 'ruta_por_defecto' ? String(fila[k]) : Number(fila[k])]));
}

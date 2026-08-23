/**
 * El nombre de la localización que crea sola cada proyecto al nacer. Vive en
 * un módulo puro porque lo usan tanto la capa de datos (server-only) como la
 * lógica de portada con pruebas.
 */
export const LOCALIZACION_SIN_ASIGNAR = 'Sin asignar';

/**
 * El código de la obra es la referencia que se escribe en una factura, así
 * que lo propone la aplicación en vez de dejarlo en blanco: `230826_1` es
 * día, mes, año y el correlativo de ese día. Sigue siendo un campo editable
 * —una obra puede traer la referencia del cliente—, pero quien no tenga una
 * ya no se queda mirando un hueco sin saber qué escribir.
 */
const FORMATO_CODIGO = /^(\d{6})_(\d+)$/;

/** `DDMMYY` de una fecha, en hora local: es la fecha que ve quien factura. */
export function prefijoCodigoProyecto(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yy = String(fecha.getFullYear() % 100).padStart(2, '0');
  return `${dd}${mm}${yy}`;
}

/**
 * El primer correlativo libre de esa fecha. Los códigos que no siguen el
 * formato no estorban: una obra con la referencia del cliente no consume
 * número.
 */
export function codigoSugeridoProyecto(
  fecha: Date,
  usados: Iterable<string>,
): string {
  const prefijo = prefijoCodigoProyecto(fecha);
  let mayor = 0;
  for (const codigo of usados) {
    const partes = FORMATO_CODIGO.exec(codigo.trim());
    if (partes && partes[1] === prefijo) {
      mayor = Math.max(mayor, Number(partes[2]));
    }
  }
  return `${prefijo}_${mayor + 1}`;
}

/**
 * Dos altas abiertas a la vez proponen el mismo código, así que el servidor
 * lo vuelve a resolver contra lo que hay escrito en ese momento. Solo se
 * corrige un código con este formato: una referencia tecleada a mano se
 * respeta tal cual, aunque se repita, porque quien la escribe sabe por qué.
 */
export function codigoLibreDeProyecto(
  codigo: string | null,
  usados: Iterable<string>,
): string | null {
  if (!codigo) return null;
  const partes = FORMATO_CODIGO.exec(codigo.trim());
  if (!partes) return codigo;

  const ocupados = new Set([...usados].map((c) => c.trim()));
  if (!ocupados.has(codigo.trim())) return codigo.trim();

  const prefijo = partes[1];
  let n = Number(partes[2]) + 1;
  while (ocupados.has(`${prefijo}_${n}`)) n += 1;
  return `${prefijo}_${n}`;
}

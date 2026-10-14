/** Texto de catálogo/usuario: Excel debe leerlo como texto y nunca ejecutarlo. */
export function textoSeguroCsv(texto: string): string {
  return /^[\s\u0000-\u001F\u007F-\u009F\uFEFF]*[=+@-]/u.test(texto) || /^[\t\r\n]/u.test(texto)
    ? `'${texto}`
    : texto;
}

/** Mismo dialecto del CSV de cables: UTF-8, punto y coma y decimal español. */
export function celdaCsv(valor: string | number | null): string {
  if (valor == null) return '';
  const texto = typeof valor === 'number'
    ? valor.toFixed(2).replace('.', ',')
    : textoSeguroCsv(valor);
  return /[";\r\n]/u.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function codificarCsv(cabeceras: readonly string[], filas: Array<Array<string | number | null>>): Uint8Array {
  return new TextEncoder().encode(`\uFEFF${[
    cabeceras.join(';'),
    ...filas.map((fila) => fila.map(celdaCsv).join(';')),
  ].join('\r\n')}`);
}

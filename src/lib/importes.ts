/** Aritmética de imputaciones/propuestas; los importes JSON siguen siendo texto. */
export const MONEDAS = ['EUR', 'USD'] as const;
export type Moneda = (typeof MONEDAS)[number];
export const REGLA_REDONDEO = 'mitad_fuera_cero_v1' as const;
const MAXIMO_ESCALADO = BigInt('10') ** BigInt('30') - BigInt('1');
const CIEN_POR_CIEN_U4 = BigInt('1000000');

export class ErrorImporte extends Error {}

export function esMoneda(valor: unknown): valor is Moneda {
  return valor === 'EUR' || valor === 'USD';
}

function comprobarEscala(escala: number): void {
  if (!Number.isInteger(escala) || escala < 0 || escala > 12) {
    throw new ErrorImporte('La escala debe ser un entero entre cero y doce.');
  }
}

function acotar(valor: bigint): bigint {
  if (typeof valor !== 'bigint' || valor > MAXIMO_ESCALADO || valor < -MAXIMO_ESCALADO) {
    throw new ErrorImporte('El importe supera treinta dígitos escalados.');
  }
  return valor;
}

function noNegativo(valor: bigint): bigint {
  acotar(valor);
  if (valor < BigInt('0')) throw new ErrorImporte('El precio, porcentaje o cantidad no puede ser negativo.');
  return valor;
}

/** Canonical con punto, sin exponente/separadores ni redondeo durante el parseo. */
export function parsearDecimal(texto: string, escala: number): bigint {
  comprobarEscala(escala);
  if (typeof texto !== 'string' || texto.length > 45) {
    throw new ErrorImporte('Indica un decimal válido.');
  }
  const partes = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(texto);
  if (!partes || (partes[3]?.length ?? 0) > escala) {
    throw new ErrorImporte('El decimal no es canónico o supera la precisión permitida.');
  }
  const entero = BigInt(partes[2] + (partes[3] ?? '').padEnd(escala, '0'));
  return acotar(partes[1] ? -entero : entero);
}

export function formatearDecimal(valor: bigint, escala: number): string {
  comprobarEscala(escala);
  acotar(valor);
  const signo = valor < BigInt('0') ? '-' : '';
  const digitos = (valor < BigInt('0') ? -valor : valor).toString();
  if (!escala) return signo + digitos;
  const completo = digitos.padStart(escala + 1, '0');
  return `${signo}${completo.slice(0, -escala)}.${completo.slice(-escala)}`;
}

/** HALF_UP simétrico: una mitad se aleja de cero, también en un crédito. */
export function dividirRedondeando(numerador: bigint, denominador: bigint): bigint {
  if (typeof numerador !== 'bigint' || typeof denominador !== 'bigint' || denominador <= BigInt('0')) {
    throw new ErrorImporte('La división requiere enteros y un denominador positivo.');
  }
  // Las operaciones de dos entradas acotadas pueden producir hasta sesenta dígitos.
  const magnitud = numerador < BigInt('0') ? -numerador : numerador;
  if (magnitud.toString().length > 60 || denominador.toString().length > 60) {
    throw new ErrorImporte('La operación decimal supera el límite de cálculo.');
  }
  const cociente = numerador / denominador;
  const resto = numerador % denominador;
  const absoluto = resto < BigInt('0') ? -resto : resto;
  return absoluto * BigInt('2') >= denominador ? cociente + (numerador < BigInt('0') ? -BigInt('1') : BigInt('1')) : cociente;
}

/** Precio escala4 × cantidad escala2 → dinero escala2; el signo se aplica una vez. */
export function importeMaterialMinor(precioU4: bigint, cantidadU2: bigint): bigint {
  return acotar(dividirRedondeando(noNegativo(precioU4) * noNegativo(cantidadU2), BigInt('10000')));
}

/** Tarifa/hora escala4 × minutos enteros → dinero escala2. */
export function importeLaboralMinor(tarifaHoraU4: bigint, minutos: bigint): bigint {
  return acotar(dividirRedondeando(noNegativo(tarifaHoraU4) * noNegativo(minutos), BigInt('6000')));
}

/** No completa ausencias ni mezcla monedas: el llamante separa su ámbito/moneda. */
export function sumarImportesConocidos(importes: readonly (bigint | null)[]): bigint | null {
  let suma = BigInt('0');
  let conocidos = 0;
  for (const importe of importes) {
    if (importe === null) continue;
    suma += acotar(importe);
    conocidos++;
  }
  return conocidos ? acotar(suma) : null;
}

/** Precio unitario escala4; el porcentaje expresa 20% como BigInt('200000'). */
export function precioVentaU4(
  costeU4: bigint,
  regla: 'recargo' | 'margen',
  porcentajeU4: bigint,
): bigint {
  noNegativo(costeU4);
  noNegativo(porcentajeU4);
  if (regla === 'recargo') {
    return acotar(dividirRedondeando(costeU4 * (CIEN_POR_CIEN_U4 + porcentajeU4), CIEN_POR_CIEN_U4));
  }
  if (regla !== 'margen' || porcentajeU4 >= CIEN_POR_CIEN_U4) {
    throw new ErrorImporte('El margen debe ser menor del cien por cien.');
  }
  return acotar(dividirRedondeando(costeU4 * CIEN_POR_CIEN_U4, CIEN_POR_CIEN_U4 - porcentajeU4));
}

/** Impuesto de una base ya redondeada a unidad menor; conserva créditos firmados. */
export function importePorcentajeMinor(baseMinor: bigint, porcentajeU4: bigint): bigint {
  acotar(baseMinor);
  noNegativo(porcentajeU4);
  if (porcentajeU4 > CIEN_POR_CIEN_U4) {
    throw new ErrorImporte('El porcentaje de impuesto no puede superar el cien por cien.');
  }
  return acotar(dividirRedondeando(baseMinor * porcentajeU4, CIEN_POR_CIEN_U4));
}

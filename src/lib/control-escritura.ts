import type { Sql, TransactionSql } from 'postgres';

export class ErrorConcurrencia extends Error {
  readonly code = 'AV_CONCURRENCIA_AGOTADA';
  constructor() { super('Hay otra operación en curso. Conserva los datos y vuelve a intentarlo.'); }
}

/** Las Server Actions pueden cargar la clase desde distintos bundles de Next. */
export function esErrorConcurrencia(error: unknown): error is ErrorConcurrencia {
  return typeof error === 'object' && error !== null && 'code' in error
    && error.code === 'AV_CONCURRENCIA_AGOTADA' && 'message' in error && typeof error.message === 'string';
}

/** 23514 y concurrencia agotada: el formulario muestra el mensaje, no un 500. */
export function mensajeErrorSqlNegocio(error: unknown): string | null {
  if (esErrorConcurrencia(error)) return error.message;
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23514'
    && 'message' in error && typeof error.message === 'string') return error.message;
  if (error instanceof Error && error.message === 'El identificador ya se usó con otros datos.') return error.message;
  return null;
}

/** Solo SQLSTATE que garantizan aborto; nunca reintenta conexión/COMMIT incierto. */
export async function reintentarTransaccion<T>(operacion: () => PromiseLike<T>): Promise<T> {
  for (let intento = 0; intento < 3; intento++) {
    try { return await operacion(); } catch (error) {
      const codigo = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      if (codigo !== '40001' && codigo !== '40P01') throw error;
      if (intento === 2) throw new ErrorConcurrencia();
      await new Promise(resolve => setTimeout(resolve, 25 * (intento + 1)));
    }
  }
  throw new ErrorConcurrencia();
}

export async function entrarControlEscritura(tx: TransactionSql) {
  await tx`select tomar_control_escritura_kit()`;
}

export function transaccionConControl<T>(sql: Sql, operacion: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return reintentarTransaccion(() => sql.begin(async tx => {
    await entrarControlEscritura(tx);
    return operacion(tx);
  }) as Promise<T>);
}

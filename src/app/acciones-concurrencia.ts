'use server';

import { exigirUsuario } from '@/lib/sesion-servidor';
import { mensajeErrorSqlNegocio } from '@/lib/control-escritura';
import type { AccionFormularioMutacion, EstadoFormularioMutacion } from '@/components/formulario-mutacion/tipos';

/** La acción ligada conserva su propia guarda de edición; este adaptador no escribe. */
export async function ejecutarAccionConEstado(
  accion: AccionFormularioMutacion,
  _anterior: EstadoFormularioMutacion,
  datos: FormData,
): Promise<EstadoFormularioMutacion> {
  await exigirUsuario();
  try {
    const resultado = await accion(datos);
    if (resultado && resultado.error) return resultado;
    return { error: null };
  } catch (error) {
    const mensaje = mensajeErrorSqlNegocio(error);
    if (mensaje) return { error: mensaje };
    // Incluye redirects de éxito y errores de negocio de la acción original.
    throw error;
  }
}

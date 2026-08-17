import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerDatosPlanoSala } from '@/lib/datos-plano';
import { construirAcotaciones } from '@/lib/acotaciones';
import { SinConfigurar } from '@/components/sin-configurar';
import { EstadoAcotaciones } from '@/components/acotaciones/estado-acotaciones';

export const dynamic = 'force-dynamic';

/**
 * Acotaciones: las elevaciones de la sala con sus cotas de instalación.
 *
 * Las cuatro vistas se proyectan desde las mismas posiciones guardadas por
 * Plano. No hay un lienzo paralelo ni coordenadas propias de Acotaciones.
 */
export default async function AcotacionesSala({
  params,
}: PageProps<'/salas/[id]/acotaciones'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const datos = await obtenerDatosPlanoSala(id);
  if (!datos) notFound();

  return <EstadoAcotaciones salaId={datos.sala.id} escena={construirAcotaciones(datos)} />;
}

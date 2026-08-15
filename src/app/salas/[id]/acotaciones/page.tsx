import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSalaCabecera } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { EstadoAcotaciones } from '@/components/acotaciones/estado-acotaciones';

export const dynamic = 'force-dynamic';

/**
 * Acotaciones: las elevaciones de la sala con sus cotas de instalación.
 *
 * Todavía no hay vistas. La pestaña existe para que la navegación no vuelva a
 * moverse cuando lleguen, y para que quien la busque sepa que está prevista;
 * no ofrece controles que no guarden nada.
 */
export default async function AcotacionesSala({
  params,
}: PageProps<'/salas/[id]/acotaciones'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const sala = await obtenerSalaCabecera(id);
  if (!sala) notFound();

  return <EstadoAcotaciones salaId={sala.id} />;
}

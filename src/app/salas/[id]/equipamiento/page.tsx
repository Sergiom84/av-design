import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSala } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Equipamiento } from '@/components/sala/equipamiento';
import { GuardarComoPlantilla } from '@/components/sala/guardar-como-plantilla';
import { TomasDeRed } from '@/components/sala/tomas-red';

export const dynamic = 'force-dynamic';

/**
 * Qué hay puesto en la sala y dónde pincha. No necesita cálculo de cable:
 * es la pestaña barata, y por eso no pasa por `datos-ficha`.
 */
export default async function EquipamientoSala({
  params,
}: PageProps<'/salas/[id]/equipamiento'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const completa = await obtenerSala(id);
  if (!completa) notFound();

  const { sala, equipos, tomas } = completa;

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      <Equipamiento salaId={sala.id} equipos={equipos} tomas={tomas} />
      <TomasDeRed salaId={sala.id} tomas={tomas} equipos={equipos} />
      <GuardarComoPlantilla sala={sala} equipos={equipos} />
    </div>
  );
}

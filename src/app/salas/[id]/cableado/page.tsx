import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { TablaCables } from '@/components/cable-schedule/tabla-cables';
import { ResultadoDelCable } from '@/components/sala/resultado-cable';
import { fichaDeSala } from '../datos-ficha';

export const dynamic = 'force-dynamic';

/**
 * El entregable de cableado: tabla de cables y metros calculados.
 * El esquema y su edición viven en `/diagrama`, como única superficie.
 */
export default async function CableadoSala({ params }: PageProps<'/salas/[id]/cableado'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const ficha = await fichaDeSala(id);
  if (!ficha) notFound();

  const { sala, sinMedidas, resultados, filasCable } = ficha;

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      <TablaCables filas={filasCable} nombreSala={sala.nombre} />
      <ResultadoDelCable resultados={resultados} sinMedidas={sinMedidas} />
    </div>
  );
}

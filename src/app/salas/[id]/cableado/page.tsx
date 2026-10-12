import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { TablaCables } from '@/components/cable-schedule/tabla-cables';
import { ResultadoDelCable } from '@/components/sala/resultado-cable';
import { Conexiones } from '@/components/sala/conexiones';
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

  const { sala, equipos, conexiones, puertos, articulos, sinMedidas, resultados, filasCable } = ficha;

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      <TablaCables filas={filasCable} nombreSala={sala.nombre} />
      <Conexiones
        sala={sala}
        conexiones={conexiones}
        equipos={equipos}
        puertos={puertos}
        articulos={articulos}
        latiguillos={ficha.suministro.cables}
      />
      <ResultadoDelCable resultados={resultados} sinMedidas={sinMedidas} filas={filasCable} />
    </div>
  );
}

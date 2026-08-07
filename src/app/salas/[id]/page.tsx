import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { CroquisSala } from '@/components/croquis/croquis-sala';
import { EstadoMontaje } from '@/components/revision/estado-montaje';
import { Medidas } from '@/components/sala/medidas';
import { fichaConAlmacen } from './datos-ficha';

export const dynamic = 'force-dynamic';

/**
 * Resumen: lo que se mira al abrir la sala. El croquis, que es el entregable
 * que va a la obra, y el semáforo de montaje, que se deriva de todo lo demás.
 * La tarjeta de ciclo de vida (hitos de instalación y entrega) entra aquí
 * cuando exista P1.
 */
export default async function ResumenSala({ params }: PageProps<'/salas/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const ficha = await fichaConAlmacen(id);
  if (!ficha) notFound();

  const { sala, equipos, conexiones, tomas, resultados, puntosMontaje } = ficha;

  return (
    <div className="grid xl:grid-cols-[22rem_1fr] gap-6 items-start [&>*]:min-w-0">
      <Medidas sala={sala} />

      <div className="space-y-6">
        <CroquisSala
          sala={sala}
          equipos={equipos}
          conexiones={conexiones}
          tomas={tomas}
          metrosPorConexion={
            new Map(resultados.map((r) => [r.conexion_id, r.longitud_m]))
          }
        />
        <EstadoMontaje puntos={puntosMontaje} />
      </div>
    </div>
  );
}

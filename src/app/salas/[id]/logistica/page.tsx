import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { MaterialAComprar } from '@/components/sala/material';
import { QueFalta } from '@/components/compras/falta';
import { ReservasDeSala } from '@/components/almacen/reservas-sala';
import { CargasDeSala } from '@/components/carga/cargas-sala';
import { ListaVisitas } from '@/components/checkin/lista-visitas';
import { fichaConAlmacen } from '../datos-ficha';

export const dynamic = 'force-dynamic';

/**
 * La sala contra el mundo físico: qué hay que comprar, qué falta contra el
 * almacén, qué está reservado, qué se ha cargado en la furgoneta y qué se vio
 * en la visita. El check-in es lo contrario del semáforo del Resumen: aquello
 * se deriva, esto se ve con los ojos en la sala y se marca a mano.
 */
export default async function LogisticaSala({
  params,
}: PageProps<'/salas/[id]/logistica'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const ficha = await fichaConAlmacen(id);
  if (!ficha) notFound();

  const { sala, material, canalizacion, falta, cargas, visitas } = ficha;

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      {/* Orden operativo: necesario, lo ya reservado para esta obra, lo que
          falta y su pedido, y por último la carga. Reservado va antes de
          "qué falta" porque es lo primero que hay que mirar antes de
          comprar: lo que ya está apartado no se pide otra vez. */}
      <MaterialAComprar material={material} canalizacion={canalizacion} salaId={sala.id} />
      {falta && (
        <>
          <ReservasDeSala
            salaId={sala.id}
            reservas={falta.reservas}
            disponibilidad={falta.disponibilidad}
            necesidad={falta.faltantes}
            reservadoAqui={falta.reservadoAqui}
          />
          <QueFalta
            salaId={sala.id}
            faltantes={falta.faltantes}
            grupos={falta.grupos}
            sinCatalogar={falta.sinCatalogar}
          />
          <CargasDeSala
            salaId={sala.id}
            nombreSala={sala.nombre}
            cargas={cargas}
            reservasActivas={falta.reservas.filter((r) => r.estado === 'activa').length}
          />
        </>
      )}
      <ListaVisitas
        revisiones={visitas}
        titulo="Check-in de la sala"
        vacio="Sin visitas. Se abre una desde Check-in, eligiendo esta sala."
      />
    </div>
  );
}

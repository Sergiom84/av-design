import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { listarUbicaciones, obtenerPedido } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Boton, Cabecera } from '@/components/ui';
import { borrarPedido } from '@/app/acciones-almacen';
import { CabeceraPedido, LineasPedido } from '@/components/compras/detalle-pedido';
import { ETIQUETA_PEDIDO } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function DetallePedido({ params }: PageProps<'/compras/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const [completo, ubicaciones] = await Promise.all([
    obtenerPedido(id),
    listarUbicaciones(),
  ]);
  if (!completo) notFound();

  const { pedido, lineas } = completo;

  return (
    <>
      <Cabecera
        titulo={pedido.referencia ?? 'Pedido'}
        descripcion={[pedido.proveedor, pedido.sala, ETIQUETA_PEDIDO[pedido.estado]]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          <form action={borrarPedido}>
            <input type="hidden" name="id" value={pedido.id} />
            <Boton variante="peligro">Borrar pedido</Boton>
          </form>
        }
      />

      <div className="grid xl:grid-cols-[24rem_1fr] gap-6 items-start [&>*]:min-w-0">
        <CabeceraPedido
          pedido={pedido}
          tienePreciosOrientativos={lineas.some((linea) => linea.precio_orientativo)}
        />
        <LineasPedido pedido={pedido} lineas={lineas} ubicaciones={ubicaciones} />
      </div>
    </>
  );
}

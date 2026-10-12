import { FormularioMutacion } from '@/components/formulario-mutacion/formulario';
import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { listarUbicaciones, obtenerPedido } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Boton, Cabecera } from '@/components/ui';
import { borrarPedido } from '@/app/acciones-almacen';
import { CabeceraPedido, LineasPedido } from '@/components/compras/detalle-pedido';
import { ETIQUETA_PEDIDO } from '@/lib/tipos';
import { HistorialRecepcion } from '@/components/compras/historial-recepcion';
import { RepartoRecepcion } from '@/components/compras/reparto-recepcion';
import { exigirUsuario } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

export default async function DetallePedido({ params, searchParams }: PageProps<'/compras/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;
  const editable = (await exigirUsuario()).permisos.compras === 'editar';

  const { id } = await params;
  const { error } = await searchParams;
  const [completo, ubicaciones] = await Promise.all([
    obtenerPedido(id),
    listarUbicaciones(),
  ]);
  if (!completo) notFound();

  const { pedido, lineas, proyecto, recepcion } = completo;

  return (
    <>
      {typeof error === "string" && <Aviso tono="alerta">{error}</Aviso>}
      <Cabecera
        titulo={pedido.referencia ?? 'Pedido'}
        descripcion={[pedido.proveedor, pedido.sala ?? proyecto?.nombre, ETIQUETA_PEDIDO[pedido.estado]]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          editable && <FormularioMutacion action={borrarPedido}>
            <input type="hidden" name="id" value={pedido.id} />
            <Boton variante="peligro" disabled={recepcion.soloRecepcion || lineas.some((l) => l.comprado_en || l.cantidad_recibida > 0)}>Borrar pedido</Boton>
          </FormularioMutacion>
        }
      />

      <fieldset disabled={!editable} className="grid min-w-0 grid-cols-1 gap-6 items-start [&>*]:min-w-0">
        <fieldset disabled={recepcion.soloRecepcion}><CabeceraPedido
          pedido={pedido}
          proyecto={proyecto}
          ubicaciones={ubicaciones}
          tienePreciosOrientativos={lineas.some((linea) => linea.precio_orientativo)}
          compraPendiente={lineas.some((linea) => !linea.comprado_en)}
        /></fieldset>
        <LineasPedido pedido={pedido} lineas={lineas} ubicaciones={ubicaciones}
          soloRecepcion={recepcion.soloRecepcion} lineasKit={recepcion.lineasKit} />
        <RepartoRecepcion filas={recepcion.filas} sinAtribuir={recepcion.sinAtribuir} />
      </fieldset>
      <div className="mt-6"><HistorialRecepcion pedidoId={id} /></div>
    </>
  );
}

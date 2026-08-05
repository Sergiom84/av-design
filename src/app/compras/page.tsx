import { hayConfiguracion } from '@/lib/db';
import { listarPedidos } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace, Tarjeta } from '@/components/ui';
import { ListaPedidos } from '@/components/compras/lista-pedidos';

export const dynamic = 'force-dynamic';

export default async function Compras() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const pedidos = await listarPedidos();

  return (
    <>
      <Cabecera
        titulo="Compras"
        descripcion="Lo que falta para cada obra, agrupado por proveedor. Al recibir, el material entra solo en el almacén."
        acciones={<Enlace href="/salas">Ver salas</Enlace>}
      />

      <div className="space-y-6">
        <ListaPedidos pedidos={pedidos} />

        {pedidos.length === 0 && (
          <Tarjeta titulo="Cómo se pide">
            <ol className="list-decimal ml-5 space-y-2">
              <li>
                Abres una <Enlace href="/salas">sala</Enlace> con su equipamiento y sus
                conexiones.
              </li>
              <li>
                En <strong>Qué falta</strong> se resta lo que hay en el{' '}
                <Enlace href="/almacen">almacén</Enlace> y sale lo que hay que comprar,
                agrupado por proveedor.
              </li>
              <li>Cada proveedor genera su pedido, que nace en borrador.</li>
              <li>
                Al marcarlo como recibido, la entrada en almacén se genera sola: no se
                teclea dos veces.
              </li>
            </ol>
          </Tarjeta>
        )}
      </div>
    </>
  );
}

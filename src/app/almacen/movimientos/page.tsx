import { hayConfiguracion } from '@/lib/db';
import { listarMovimientos } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace } from '@/components/ui';
import { Movimientos } from '@/components/almacen/movimientos';

export const dynamic = 'force-dynamic';

/** El histórico completo. Es de donde sale toda existencia del almacén. */
export default async function HistoricoMovimientos() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const movimientos = await listarMovimientos(300);

  return (
    <>
      <Cabecera
        titulo="Movimientos"
        descripcion="Entradas, salidas, devoluciones, bajas y ajustes. Sumarlos es lo que da la existencia actual."
        acciones={<Enlace href="/almacen">Volver al almacén</Enlace>}
      />
      <Movimientos movimientos={movimientos} titulo="Histórico" />
    </>
  );
}

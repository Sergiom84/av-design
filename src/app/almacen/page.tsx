import { hayConfiguracion } from '@/lib/db';
import { listarSalas } from '@/lib/datos';
import {
  contarAlmacen,
  listarAlmacen,
  listarMovimientos,
  listarUbicaciones,
} from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Dato, Enlace } from '@/components/ui';
import { AltaMovimiento } from '@/components/almacen/alta-movimiento';
import { Existencias } from '@/components/almacen/existencias';
import { Movimientos } from '@/components/almacen/movimientos';
import { Ubicaciones } from '@/components/almacen/ubicaciones';

export const dynamic = 'force-dynamic';

/**
 * El almacén. Una composición de bloques, como la sala: existencias, alta de
 * movimiento, últimos apuntes y ubicaciones.
 *
 * Lo que XTEN-AV no tiene (docs/01, apartado 6): su "Inventory" es el
 * seguimiento de compra de un proyecto, no un almacén con cantidades,
 * ubicación y disponibilidad.
 */
export default async function Almacen() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const [filas, ubicaciones, salas, movimientos, cuenta] = await Promise.all([
    listarAlmacen(),
    listarUbicaciones(),
    listarSalas(),
    listarMovimientos(15),
    contarAlmacen(),
  ]);

  return (
    <>
      <Cabecera
        titulo="Almacén"
        descripcion="Qué hay, dónde está y cuánto queda libre. La existencia se deriva de los movimientos: no hay ninguna cifra que se pueda sobrescribir a mano."
        acciones={
          <>
            <Enlace href="/almacen/movimientos">Movimientos</Enlace>
            <Enlace href="/almacen/bajas">Bajas</Enlace>
          </>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-linea border border-linea mb-8">
        {(
          [
            ['Referencias en almacén', cuenta.referenciasEnAlmacen],
            ['Reservas activas', cuenta.reservasActivas],
            ['Bajo mínimo', cuenta.bajoMinimo],
            ['Bajas registradas', cuenta.bajas],
          ] as const
        ).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="bg-papel p-4">
            <Dato etiqueta={etiqueta} valor={valor} />
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <Existencias filas={filas} />
        <AltaMovimiento
          ubicaciones={ubicaciones}
          salas={salas.map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
        <Movimientos
          movimientos={movimientos}
          titulo="Últimos movimientos"
          pie="El histórico completo está en /almacen/movimientos."
        />
        <Ubicaciones ubicaciones={ubicaciones} />
      </div>
    </>
  );
}

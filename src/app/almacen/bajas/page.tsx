import { hayConfiguracion } from '@/lib/db';
import { listarBajas } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace, Tarjeta } from '@/components/ui';
import { Movimientos } from '@/components/almacen/movimientos';

export const dynamic = 'force-dynamic';

/**
 * Material averiado y retirado.
 *
 * Es lo único que el departamento tenía apuntado antes de esta aplicación: la
 * hoja "Almacén" del inventario de partida son 104 unidades sueltas por número
 * de serie con anotaciones libres ("ROTO", "POSIBLEMENTE NO PUEDA REPARARSE").
 * No era un stock: era un registro de retiradas. Aquí tiene sitio propio desde
 * el primer día, y con fecha, motivo y quién lo dio de baja.
 */
export default async function Bajas() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const bajas = await listarBajas();

  return (
    <>
      <Cabecera
        titulo="Bajas"
        descripcion="Material averiado o retirado. Sale de las existencias, pero no del registro."
        acciones={<Enlace href="/almacen">Volver al almacén</Enlace>}
      />

      {bajas.length === 0 && (
        <div className="mb-6">
          <Tarjeta titulo="Cómo se da de baja">
            <ol className="list-decimal ml-5 space-y-2">
              <li>
                Desde <Enlace href="/almacen">el almacén</Enlace>, registrando un
                movimiento de tipo Baja con su motivo.
              </li>
              <li>
                Al cerrar una obra, apuntando en la lista de carga qué se rompió. El
                material vuelve y se da de baja en el mismo paso.
              </li>
            </ol>
          </Tarjeta>
        </div>
      )}

      <Movimientos
        movimientos={bajas}
        titulo="Material dado de baja"
        pie="Una baja no se borra: si fue un error, se corrige con un ajuste de inventario que deja rastro."
      />
    </>
  );
}

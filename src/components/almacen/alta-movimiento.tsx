import { Boton, Campo, Tarjeta } from '@/components/ui';
import { registrarMovimiento } from '@/app/acciones-almacen';
import { BuscadorArticulo } from '@/components/catalogo/buscador-articulo';
import { ETIQUETA_MOVIMIENTO, type Ubicacion } from '@/lib/tipos';

/**
 * El único camino por el que cambia una existencia.
 *
 * No hay ninguna pantalla para escribir "aquí hay 7". Se apunta lo que ha
 * pasado —entra, sale, vuelve, se rompe, se recuenta— y la existencia sale de
 * ahí. Un stock que se puede sobrescribir sin dejar rastro vuelve a ser un
 * Excel, que es el problema del que se viene.
 */
export function AltaMovimiento({
  ubicaciones,
  salas = [],
}: {
  ubicaciones: Ubicacion[];
  salas?: Array<{ id: string; nombre: string }>;
}) {
  return (
    <Tarjeta
      titulo="Registrar movimiento"
      pie="El signo lo pone el tipo: entrada y devolución suman, salida y baja restan. El ajuste de inventario es el único que admite cantidad negativa."
    >
      <form action={registrarMovimiento} className="flex flex-wrap items-end gap-3">
        <BuscadorArticulo etiqueta="Referencia" requerido className="w-full sm:w-[18rem]" />
        <Campo etiqueta="Tipo">
          <select name="tipo" defaultValue="entrada">
            {Object.entries(ETIQUETA_MOVIMIENTO).map(([v, et]) => (
              <option key={v} value={v}>
                {et}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cantidad">
          <input
            name="cantidad"
            type="number"
            step="0.01"
            required
            className="w-24"
            placeholder="10"
          />
        </Campo>
        <Campo etiqueta="Ubicación">
          <select name="ubicacion_id" defaultValue={ubicaciones[0]?.id ?? ''}>
            <option value="">— sin ubicación —</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Campo>
        {salas.length > 0 && (
          <Campo etiqueta="Obra" ayuda="Solo si el movimiento es de una sala concreta">
            <select name="sala_id" defaultValue="">
              <option value="">— ninguna —</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Motivo">
          <input name="motivo" className="min-w-[12rem]" placeholder="Compra de reposición" />
        </Campo>
        <Campo etiqueta="Quién">
          <input name="quien" className="w-32" />
        </Campo>
        <Boton>Registrar</Boton>
      </form>
    </Tarjeta>
  );
}

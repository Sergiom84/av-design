import { Boton, Campo, ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import { crearUbicacion } from '@/app/acciones-almacen';
import type { Ubicacion } from '@/lib/tipos';

/**
 * Los sitios del almacén. El mismo artículo puede estar en varios: en el
 * estante, en el armario del rack y en la furgoneta.
 *
 * Nombre libre y no una lista cerrada: cada nave añade sitios y eso no puede
 * ser una migración. Igual que las ubicaciones de las tomas de red.
 */
export function Ubicaciones({ ubicaciones }: { ubicaciones: Ubicacion[] }) {
  return (
    <Tarjeta titulo="Ubicaciones">
      {ubicaciones.length === 0 ? (
        <Vacio>Sin ubicaciones. Añade la primera abajo.</Vacio>
      ) : (
        <ContenedorTabla etiqueta="Ubicaciones">
        <table className="datos">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {ubicaciones.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td className="text-tinta-tenue">{u.descripcion ?? '—'}</td>
                <td className="text-tinta-tenue">
                  {u.es_furgoneta ? 'Furgoneta' : 'Nave'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ContenedorTabla>
      )}

      <form
        action={crearUbicacion}
        className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-linea"
      >
        <Campo etiqueta="Nombre">
          <input name="nombre" required placeholder="Estantería B" className="w-40" />
        </Campo>
        <Campo etiqueta="Descripción">
          <input name="descripcion" className="min-w-[12rem]" />
        </Campo>
        <label className="flex items-center gap-2 pb-1">
          <input type="checkbox" name="es_furgoneta" className="w-4 h-4" />
          <span>Es furgoneta</span>
        </label>
        <Boton>Añadir ubicación</Boton>
      </form>
    </Tarjeta>
  );
}

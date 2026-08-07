import { Aviso, ContenedorTabla, Enlace, Tarjeta, Vacio } from '@/components/ui';
import type { FilaAlmacen } from '@/lib/datos-almacen';

/**
 * El almacén: qué hay, dónde y cuánto queda libre.
 *
 * Las tres cifras juntas y no solo el disponible, a propósito: "quedan cuatro
 * pero cuatro están reservados" y "no queda ninguno" son dos situaciones
 * distintas y se resuelven de forma distinta. Pedir dos veces el mismo material
 * porque estaba reservado y no se veía es el fallo que la aplicación evita.
 *
 * Solo aparece lo que se ha movido o reservado alguna vez: el catálogo son 948
 * referencias y listarlas todas a cero enterraría lo que sí hay.
 */
export function Existencias({ filas }: { filas: FilaAlmacen[] }) {
  if (filas.length === 0) {
    return (
      <Tarjeta titulo="Existencias">
        <Vacio>
          El almacén está vacío. Da de alta la primera entrada abajo: la existencia se
          deriva de los movimientos, no se teclea.
        </Vacio>
      </Tarjeta>
    );
  }

  const bajoMinimo = filas.filter((f) => f.bajo_minimo);
  const sobreReservadas = filas.filter((f) => f.sobre_reservado);

  return (
    <Tarjeta
      titulo="Existencias"
      pie="Disponible = existencias − reservado. Lo reservado sigue en el estante, pero está comprometido para una obra."
    >
      {(bajoMinimo.length > 0 || sobreReservadas.length > 0) && (
        <div className="space-y-3 mb-4">
          {bajoMinimo.length > 0 && (
            <Aviso tono="alerta">
              <strong>{bajoMinimo.length}</strong>{' '}
              {bajoMinimo.length === 1 ? 'referencia' : 'referencias'} por debajo del
              stock mínimo: {bajoMinimo.map((f) => f.descripcion).join(', ')}.
            </Aviso>
          )}
          {sobreReservadas.length > 0 && (
            <Aviso>
              <strong>{sobreReservadas.length}</strong>{' '}
              {sobreReservadas.length === 1
                ? 'referencia tiene'
                : 'referencias tienen'}{' '}
              más reservado que existencias. Hay obras contando con material que no está.
            </Aviso>
          )}
        </div>
      )}

      <ContenedorTabla etiqueta="Existencias">
      <table className="datos">
        <thead>
          <tr>
            <th>Referencia</th>
            <th>Dónde</th>
            <th className="num">Existencias</th>
            <th className="num">Reservado</th>
            <th className="num">Disponible</th>
            <th className="num">Mínimo</th>
            <th>Proveedor</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.articulo_id}>
              <td>
                <Enlace href={`/articulo/${f.articulo_id}`}>{f.descripcion}</Enlace>
                <div className="t-etiqueta">{f.categoria}</div>
              </td>
              <td className="text-tinta-tenue">
                {f.ubicaciones.length === 0
                  ? '—'
                  : f.ubicaciones
                      .map((u) => `${u.ubicacion}: ${u.cantidad}`)
                      .join(' · ')}
              </td>
              <td className="num">
                {f.existencias} {f.unidad}
              </td>
              <td className="num">{f.reservado || '—'}</td>
              <td
                className={`num ${
                  f.disponible <= 0 ? 'text-alerta' : f.bajo_minimo ? 'text-aviso' : ''
                }`}
              >
                {f.disponible}
              </td>
              <td className="num text-tinta-tenue">{f.stock_minimo ?? '—'}</td>
              <td className="text-tinta-tenue">{f.proveedor ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </ContenedorTabla>
    </Tarjeta>
  );
}

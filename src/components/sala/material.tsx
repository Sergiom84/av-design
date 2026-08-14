import { ContenedorTabla, Tarjeta } from '@/components/ui';
import type { DimensionCanalizacion, LineaMaterialCable } from '@/lib/calculo-cable';

/** Lo que hay que comprar: bobinas y latiguillos, no metros sueltos. */
export function MaterialAComprar({
  material,
  canalizacion,
  salaId,
}: {
  material: LineaMaterialCable[];
  canalizacion: DimensionCanalizacion | null;
  salaId: string;
}) {
  if (material.length === 0) return null;

  return (
    <Tarjeta
      titulo="Material a comprar"
      pie={
        canalizacion
          ? `Canalización: ${canalizacion.cables_con_reserva} cables con reserva · ${canalizacion.sugerencia}`
          : undefined
      }
    >
      <ContenedorTabla etiqueta="Material a comprar">
      <table className="datos">
        <thead>
          <tr>
            <th>Referencia</th>
            <th className="num">Cantidad</th>
            <th className="num">Tiradas</th>
            <th>Se pide</th>
            <th className="num">Coste</th>
          </tr>
        </thead>
        <tbody>
          {material.map((l, i) => (
            <tr key={i}>
              <td>{l.descripcion}</td>
              <td className="num">
                {l.cantidad} {l.unidad}
              </td>
              <td className="num">{l.tiradas}</td>
              <td>
                {l.a_pedir === 'Asignar cable en la conexión' ? (
                  <a className="enlace" href={`/salas/${salaId}/cableado`}>
                    Ir a Cableado para asignarlo
                  </a>
                ) : (
                  l.a_pedir
                )}
              </td>
              <td className="num">
                {l.coste_estimado != null ? `${l.coste_estimado.toFixed(2)} €` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ContenedorTabla>
    </Tarjeta>
  );
}

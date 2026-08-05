import { Enlace, Tarjeta, Vacio } from '@/components/ui';
import { efectoMovimiento } from '@/lib/almacen';
import { ETIQUETA_MOVIMIENTO } from '@/lib/tipos';
import type { FilaMovimiento } from '@/lib/datos-almacen';

/** Fecha corta, la que se lee de un vistazo. */
function cuando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
}

/**
 * El histórico. Es la verdad del almacén: la existencia sale de sumar esto,
 * así que aquí se ve por qué hay lo que hay y quién lo movió.
 */
export function Movimientos({
  movimientos,
  titulo = 'Movimientos',
  pie,
}: {
  movimientos: FilaMovimiento[];
  titulo?: string;
  pie?: string;
}) {
  if (movimientos.length === 0) {
    return (
      <Tarjeta titulo={titulo}>
        <Vacio>Sin movimientos todavía.</Vacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo={titulo} pie={pie}>
      <table className="datos">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Referencia</th>
            <th className="num">Efecto</th>
            <th>Ubicación</th>
            <th>Obra</th>
            <th>Motivo</th>
            <th>Quién</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => {
            const efecto = efectoMovimiento(m);
            return (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-tinta-tenue">{cuando(m.fecha)}</td>
                <td className={m.tipo === 'baja' ? 'text-alerta' : undefined}>
                  {ETIQUETA_MOVIMIENTO[m.tipo]}
                </td>
                <td>
                  <Enlace href={`/articulo/${m.articulo_id}`}>{m.descripcion}</Enlace>
                </td>
                <td className={`num ${efecto < 0 ? 'text-alerta' : ''}`}>
                  {efecto > 0 ? `+${efecto}` : efecto}
                </td>
                <td className="text-tinta-tenue">{m.ubicacion ?? '—'}</td>
                <td className="text-tinta-tenue">{m.sala ?? '—'}</td>
                <td className="text-tinta-tenue">{m.motivo ?? '—'}</td>
                <td className="text-tinta-tenue">{m.quien ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Tarjeta>
  );
}

import type { PrecioOfertado } from '@/lib/datos';
import { Aviso, Tarjeta } from '@/components/ui';

/**
 * Precios de un artículo, del más barato al más caro.
 *
 * Se separan en dos bloques porque no son lo mismo:
 *
 * - **Final**: lo que un proveedor ha puesto por escrito. La misma referencia
 *   sale a precios distintos según de quién venga y de cuándo sea: el HDMI
 *   Ultra/9 de Extron aparece a 77,89 €, 78,82 € y 93,00 € en tres
 *   presupuestos. De estos sale el coste del catálogo.
 * - **Orientativo**: precio de referencia mientras no hay oferta. Casi siempre
 *   PVP de lista y en otra moneda; se convierte a euros con el tipo de cambio
 *   de `/parametros`. Solo se usa como coste si no hay ninguna oferta real.
 */
export function TablaPrecios({
  precios,
  unidad,
}: {
  precios: PrecioOfertado[];
  unidad: 'ud' | 'm';
}) {
  const finales = precios.filter((p) => p.origen === 'final');
  const orientativos = precios.filter((p) => p.origen === 'orientativo');

  return (
    <div className="space-y-6">
      {finales.length > 0 && (
        <BloquePrecios
          titulo={`Precios finales (${finales.length})`}
          precios={finales}
          unidad={unidad}
          pie={
            finales.length > 1
              ? 'Diferencia entre la oferta más barata y la más cara: ' +
                `${((finales.at(-1)!.precio_eur / finales[0].precio_eur - 1) * 100).toFixed(0)} %.`
              : undefined
          }
        />
      )}

      {orientativos.length > 0 && (
        <BloquePrecios
          titulo={`Precios orientativos (${orientativos.length})`}
          precios={orientativos}
          unidad={unidad}
          pie="Precios de referencia, no ofertas cerradas. Solo se usan como coste mientras no hay oferta real."
        />
      )}
    </div>
  );
}

/** El euro va con símbolo; el resto de monedas con su código, que no se confunda. */
const importe = (valor: number, moneda: string) =>
  `${valor.toFixed(2)} ${moneda === 'EUR' ? '€' : moneda}`;

function BloquePrecios({
  titulo,
  precios,
  unidad,
  pie,
}: {
  titulo: string;
  precios: PrecioOfertado[];
  unidad: 'ud' | 'm';
  pie?: string;
}) {
  const porUnidad = unidad === 'm' ? '/m' : '/ud';
  const hayCompra = precios.some((p) => p.unidades_por_compra !== 1);
  const hayOtraMoneda = precios.some((p) => p.moneda !== 'EUR');
  const conNota = precios.filter((p) => p.notas);
  // A un precio de referencia sacado de una web no le falta el proveedor:
  // es que no lo tiene. Solo se reclama en las ofertas reales.
  const sinProveedor =
    precios.every((p) => p.origen === 'final') && precios.every((p) => !p.proveedor);

  return (
    <Tarjeta titulo={titulo} pie={pie}>
      <table>
        <thead>
          <tr>
            <th>Origen</th>
            <th>Proveedor</th>
            <th>Fecha</th>
            <th>Referencia</th>
            <th className="num">Cantidad</th>
            {hayCompra && <th className="num">Precio de compra</th>}
            {hayOtraMoneda && <th className="num">Original</th>}
            <th className="num">Precio{porUnidad}</th>
          </tr>
        </thead>
        <tbody>
          {precios.map((p) => (
            <tr key={p.presupuesto}>
              <td>{p.presupuesto}</td>
              <td className="text-tinta-tenue">{p.proveedor ?? '—'}</td>
              <td className="text-tinta-tenue num">{p.fecha ?? '—'}</td>
              <td className="text-tinta-tenue">{p.referencia ?? '—'}</td>
              <td className="num">{p.cantidad ?? '—'}</td>
              {hayCompra && (
                <td className="num text-tinta-tenue">
                  {p.precio_compra != null
                    ? importe(p.precio_compra, p.moneda) +
                      (p.unidades_por_compra !== 1
                        ? ` / ${p.unidades_por_compra} ${unidad}`
                        : '')
                    : '—'}
                </td>
              )}
              {hayOtraMoneda && (
                <td className="num text-tinta-tenue">
                  {p.moneda === 'EUR' ? '—' : importe(p.precio, p.moneda)}
                </td>
              )}
              <td className="num">{importe(p.precio_eur, 'EUR')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(sinProveedor || hayOtraMoneda || conNota.length > 0) && (
        <div className="mt-4 space-y-3">
          {sinProveedor && (
            <Aviso tono="neutro">
              Ninguna de estas líneas tiene proveedor. Se rellena en{' '}
              <code>data/precios.csv</code> y se vuelve a sembrar.
            </Aviso>
          )}
          {hayOtraMoneda && (
            <Aviso tono="neutro">
              Convertido a euros con el tipo de cambio de <code>/parametros</code>.
            </Aviso>
          )}
          {conNota.map((p) => (
            <Aviso key={p.presupuesto} tono="neutro">
              {p.presupuesto}: {p.notas}
            </Aviso>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

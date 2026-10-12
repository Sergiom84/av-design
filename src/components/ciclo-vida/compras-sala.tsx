import Link from 'next/link';
import type { ComprasCiclo, EstadoCompraCiclo } from '@/lib/ciclo-vida-compras';
const etiqueta: Record<EstadoCompraCiclo, string> = { sin_datos: 'Sin datos', pendiente: 'Pendiente', parcial: 'Parcial', total: 'Completa', sin_acreditar: 'Sin cobertura acreditada' };
export function ComprasDeSala({ compras }: { compras: ComprasCiclo }) {
  return <div className="space-y-2">
    <p className="font-medium">Compra: {etiqueta[compras.compra]}</p>
    <p className="font-medium">Recepción: {etiqueta[compras.recepcion]}</p>
    <p className="text-tinta-tenue">{!compras.disponible ? 'Trazabilidad de compras pendiente de integración.' :
      compras.lineas.length ? 'Cobertura de los pedidos directos de esta sala.' : 'Sin líneas de pedidos directos para esta sala.'}</p>
    {compras.lineas.length > 0 && <details><summary className="enlace cursor-pointer">Ver líneas de compra y recepción</summary>
      <ul className="space-y-2 pt-2">{compras.lineas.map((l) => <li key={l.id}>
        <Link href={`/compras/${l.pedido_id}`} className="enlace">{l.referencia}</Link> · {l.articulo}
        <span className="block">{l.comprado_en ? `Comprado: ${l.comprado_en}` : 'Compra pendiente'} · Recibido: {l.cantidad_recibida} / {l.cantidad} {l.unidad}</span>
        {l.recibida_trazada < l.cantidad_recibida && <span className="block text-tinta-tenue">Solo {l.recibida_trazada} {l.unidad} vinculados a recepciones de esta línea; el resto no acredita cobertura.</span>}
      </li>)}</ul>
    </details>}
  </div>;
}

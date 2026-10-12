import { ContenedorTabla, Tarjeta } from '@/components/ui';
import type { LineaNecesidad } from '@/lib/compras';
import type { proyectarSuministros } from '@/lib/suministros';

export function MaterialComercial({ necesidad, suministro, avisoComercial }: {
  necesidad: LineaNecesidad[];
  suministro: ReturnType<typeof proyectarSuministros>;
  avisoComercial?: string;
}) {
  return <Tarjeta titulo="Necesidad comercial">
    <ContenedorTabla etiqueta="Necesidad comercial">
      <table className="datos"><thead><tr><th>Referencia</th><th className="num">Cantidad</th></tr></thead>
        <tbody>{necesidad.map((l) => <tr key={l.articulo_id}>
          <td>{l.descripcion}</td><td className="num">{l.cantidad} {l.unidad}</td>
        </tr>)}</tbody>
      </table>
    </ContenedorTabla>
    {suministro.bloqueoComercial && <p className="mt-3 text-tinta-tenue">{avisoComercial ?? suministro.bloqueoComercial}</p>}
    {suministro.pendientes.length > 0 && <ul className="mt-3 list-disc pl-5">{suministro.pendientes.map((p) =>
      <li key={`${p.suministro_id}:${p.clave}`}>{p.detalle}</li>)}</ul>}
  </Tarjeta>;
}

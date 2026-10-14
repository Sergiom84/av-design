import { ContenedorTabla, Enlace, Tarjeta } from '@/components/ui';
import type { MaterialBomEnSala } from '@/lib/datos-material-bom';

export function MaterialBom({ salaId, material, cerrado }: { salaId: string; material: MaterialBomEnSala[]; cerrado: boolean }) {
  return <Tarjeta titulo="Material adicional de la BOM" acciones={cerrado ? undefined : <Enlace href={`/catalogo/importar?sala=${salaId}`}>Importar material</Enlace>}
    pie="Se suma al material necesario, a las reservas y a las compras. Estas partidas no están colocadas ni conectadas en el diseño.">
    {material.length === 0 ? <p className="text-tinta-tenue">No hay partidas adicionales importadas.</p> : <ContenedorTabla etiqueta="Material adicional importado">
      <table className="datos"><thead><tr><th>Referencia</th><th>Cantidad</th><th>Procedencia</th></tr></thead><tbody>{material.map(m => <tr key={m.id}>
        <td><Enlace href={`/articulo/${m.articulo_id}`}>{m.descripcion}</Enlace></td><td className="num">{m.cantidad} {m.unidad}</td><td className="[overflow-wrap:anywhere]">{m.nota ?? 'Importación de BOM'}</td>
      </tr>)}</tbody></table>
    </ContenedorTabla>}
  </Tarjeta>;
}

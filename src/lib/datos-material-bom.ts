import 'server-only';
import { sql } from './db';
import type { LineaMaterialBom } from './compras';

export interface MaterialBomEnSala extends LineaMaterialBom { id: string; lote_id: string }

export async function materialBomDeSala(salaId: string): Promise<MaterialBomEnSala[]> {
  const filas = await sql<Array<{ id: string; articulo_id: string; descripcion: string; unidad: 'ud' | 'm'; cantidad: number; nota: string | null; lote_id: string }>>`
    select m.id, m.articulo_id, trim(concat_ws(' ', a.marca, a.modelo)) as descripcion,
      m.unidad, m.cantidad, m.nota, m.lote_id
    from sala_material_bom m join articulos a on a.id = m.articulo_id
    where m.sala_id = ${salaId} order by a.modelo, m.id`;
  return filas.map(f => ({ ...f, cantidad: Number(f.cantidad) }));
}

import 'server-only';
import { sql } from './db';
import { esquemaDatoTecnico, type DatoTecnico } from './ficha-tecnica';

/** El catálogo remoto sigue devolviendo solo su página; la ficha lee un artículo. */
export async function datosTecnicosDeArticulo(articuloId: string): Promise<DatoTecnico[]> {
  return (await datosTecnicosDeArticulos([articuloId])).get(articuloId) ?? [];
}

/**
 * Hechos de las referencias presentes. Una consulta para los IDs de la sala,
 * no un viaje por tarjeta ni el catálogo entero.
 */
export async function datosTecnicosDeArticulos(ids: string[]): Promise<Map<string, DatoTecnico[]>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  const mapa = new Map<string, DatoTecnico[]>();
  if (unicos.length === 0) return mapa;
  const [estructura] = await sql`select to_regclass('public.articulo_datos_tecnicos') is not null as disponible`;
  if (!estructura.disponible) return mapa;
  const filas = await sql`select id, articulo_id, clave, concepto, tipo, estado, valor, fuente_url,
    documento, apartado, consultado_en::text, fuente, puerto_id
    from articulo_datos_tecnicos where articulo_id in ${sql(unicos)} order by articulo_id, tipo, clave`;
  for (const fila of filas) {
    const articuloId = String(fila.articulo_id);
    const lista = mapa.get(articuloId) ?? [];
    lista.push(esquemaDatoTecnico.parse(fila));
    mapa.set(articuloId, lista);
  }
  return mapa;
}

import 'server-only';
import { sql } from './db';

export interface TiradaDocumental {
  id: string; plantilla_id: string; fuente_clave: string;
  origen_categoria: string; destino_categoria: string; senal: string;
  ruta: string; notas: string; orden: string;
  conexion_resuelta_id: string | null; completa: boolean;
}

export interface BocaRosetaPlantilla {
  id: string; plantilla_id: string; codigo: string; ordinal: number; etiqueta: string | null;
}

export async function bocasRosetasPlantillas(): Promise<BocaRosetaPlantilla[]> {
  return await sql<BocaRosetaPlantilla[]>`
    select b.id, t.plantilla_id, t.codigo, b.ordinal, b.etiqueta
    from plantilla_toma_red_bocas b join plantilla_tomas_red t on t.id = b.plantilla_toma_red_id
    order by t.plantilla_id, t.codigo, b.ordinal`;
}

export async function tiradasDocumentales(): Promise<TiradaDocumental[]> {
  return await sql<TiradaDocumental[]>`
    select d.id, d.plantilla_id, d.fuente_clave, d.origen_categoria,
           d.destino_categoria, d.senal, d.ruta, d.notas, d.orden, d.conexion_resuelta_id,
           coalesce(c.detalle_extremos = 'completo', false) as completa
    from plantilla_tiradas_documentales d
    left join plantilla_conexiones c on c.id = d.conexion_resuelta_id
    order by d.plantilla_id, d.fuente_clave`;
}

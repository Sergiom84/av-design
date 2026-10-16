import { agruparMaterialCable, type ResultadoCable } from './calculo-cable';
import { necesidadDeSala, type LineaMaterialBom, type LineaNecesidad } from './compras';
import type { Articulo, Conexion, EquipoEnSala } from './tipos';

/** Los lectores técnicos no necesitan consultar precios ni existencias. */
export type ArticuloNecesidad = Pick<Articulo, 'id' | 'marca' | 'modelo' | 'unidad' | 'bobina_m'> &
  Partial<Pick<Articulo, 'coste'>>;

export interface DatosNecesidadSala {
  equipos: Array<Pick<EquipoEnSala, 'articulo_id' | 'nombre' | 'cantidad'>>;
  conexiones: Conexion[];
  resultadosCable: ResultadoCable[];
  materialBom?: LineaMaterialBom[];
}

/** Misma necesidad canónica de E1, con entradas mínimas y sin snapshot ficticio. */
export function necesidadExportada(
  fuente: { articulos: ArticuloNecesidad[] },
  sala: DatosNecesidadSala,
): LineaNecesidad[] {
  const articulos = new Map(fuente.articulos.map((a) => [a.id, a]));
  return necesidadDeSala(
    sala.equipos,
    agruparMaterialCable(sala.resultadosCable, sala.conexiones, articulos),
    articulos,
    sala.materialBom ?? [],
  );
}

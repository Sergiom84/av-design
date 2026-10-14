import { z } from 'zod';
import { puede, type Permisos } from './usuarios';

export interface UsuarioFavoritos {
  id: string;
  permisos: Permisos;
  debeCambiarClave: boolean;
  ficticio?: boolean;
}
export function puedeUsarFavoritos(usuario: UsuarioFavoritos | null): boolean {
  return Boolean(usuario && !usuario.ficticio && !usuario.debeCambiarClave &&
    puede(usuario.permisos, 'catalogo', 'ver') && z.uuid().safeParse(usuario.id).success);
}
export const favoritoSchema = z.object({ favorito: z.boolean() }).strict();
export const busquedaFavoritosSchema = z.object({ q: z.string().trim().max(200).default('') }).strict();
export function motivosFavorito(enSalas: boolean, enPlantillas: boolean): string[] {
  return ['Favorito personal', ...(enSalas ? ['Instalado en salas'] : []), ...(enPlantillas ? ['En plantillas'] : [])];
}
export interface ReferenciaFavorita {
  id: string;
  marca: string | null;
  modelo: string;
  categoria: string;
  activo: boolean;
  motivos: string[];
}

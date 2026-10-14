import type postgres from 'postgres';
import { z } from 'zod';
import {
  busquedaFavoritosSchema, favoritoSchema, motivosFavorito, puedeUsarFavoritos,
  type ReferenciaFavorita, type UsuarioFavoritos,
} from './catalogo-favoritos';

type BaseFavoritos = ReturnType<typeof postgres>;
function exigir(usuario: UsuarioFavoritos) {
  if (!puedeUsarFavoritos(usuario)) throw new Error('Los favoritos personales requieren un usuario con acceso al catálogo y contraseña cambiada.');
}
export async function esArticuloFavorito(db: BaseFavoritos, usuario: UsuarioFavoritos, articuloId: string): Promise<boolean> {
  exigir(usuario); z.uuid().parse(articuloId);
  const [fila] = await db<Array<{ favorito: boolean }>>`select exists(
    select 1 from usuarios_articulos_favoritos where usuario_id = ${usuario.id} and articulo_id = ${articuloId}
  ) as favorito`;
  return fila.favorito;
}
export async function guardarFavorito(db: BaseFavoritos, usuario: UsuarioFavoritos, articuloId: string, entrada: unknown): Promise<void> {
  exigir(usuario); z.uuid().parse(articuloId);
  const { favorito } = favoritoSchema.parse(entrada);
  // Idempotente: repetir una petición no invierte por accidente la decisión.
  if (favorito) {
    const filas = await db`insert into usuarios_articulos_favoritos (usuario_id, articulo_id)
      select ${usuario.id}, id from articulos where id = ${articuloId}
      on conflict (usuario_id, articulo_id) do update set usuario_id = excluded.usuario_id
      returning articulo_id`;
    if (!filas.length) throw new Error('La referencia no existe.');
  } else {
    await db`delete from usuarios_articulos_favoritos where usuario_id = ${usuario.id} and articulo_id = ${articuloId}`;
  }
}
export async function listarFavoritos(db: BaseFavoritos, usuario: UsuarioFavoritos, entrada: unknown = {}): Promise<ReferenciaFavorita[]> {
  exigir(usuario);
  const { q } = busquedaFavoritosSchema.parse(entrada);
  const patron = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const filas = await db<Array<{
    id: string; marca: string | null; modelo: string; categoria: string; activo: boolean;
    en_salas: boolean; en_plantillas: boolean;
  }>>`select a.id, a.marca, a.modelo, a.categoria, a.activo,
    exists(select 1 from sala_equipos where articulo_id = a.id) as en_salas,
    exists(select 1 from plantilla_articulos where articulo_id = a.id) as en_plantillas
    from usuarios_articulos_favoritos f join articulos a on a.id = f.articulo_id
    where f.usuario_id = ${usuario.id}
      and (${q} = '' or concat_ws(' ', a.marca, a.modelo, a.categoria) ilike ${patron})
    order by a.marca nulls last, a.modelo, a.id limit 20`;
  // Retirado sigue accesible: marcar favorito no cambia qué se instala ni sustituye nada.
  return filas.map(fila => ({ id: fila.id, marca: fila.marca, modelo: fila.modelo,
    categoria: fila.categoria, activo: fila.activo, motivos: motivosFavorito(fila.en_salas, fila.en_plantillas) }));
}

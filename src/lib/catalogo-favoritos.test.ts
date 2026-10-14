import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { busquedaFavoritosSchema, favoritoSchema, motivosFavorito, puedeUsarFavoritos } from './catalogo-favoritos';
import { esArticuloFavorito, guardarFavorito, listarFavoritos } from './catalogo-favoritos-repositorio';
import { PERMISOS_POR_ROL } from './usuarios';

const usuario = { id: 'e2000000-0000-4000-8000-000000000001', permisos: PERMISOS_POR_ROL.lectura,
  debeCambiarClave: false, ficticio: false };
const articuloId = 'e2000000-0000-4000-8000-000000000101';

describe('favoritos personales reversibles', () => {
  it('un lector puede guardar su preferencia sin permiso para editar el catálogo', () => {
    assert.equal(puedeUsarFavoritos(usuario), true);
    assert.equal(puedeUsarFavoritos({ ...usuario, permisos: { ...usuario.permisos, catalogo: 'oculto' } }), false);
  });
  it('exige usuario real, UUID de sesión y contraseña provisional cambiada', () => {
    assert.equal(puedeUsarFavoritos(null), false);
    assert.equal(puedeUsarFavoritos({ ...usuario, ficticio: true }), false);
    assert.equal(puedeUsarFavoritos({ ...usuario, debeCambiarClave: true }), false);
    assert.equal(puedeUsarFavoritos({ ...usuario, id: 'usuario-elegido-por-el-cliente' }), false);
  });
  it('acepta sólo una decisión booleana; no permite elegir otro usuario ni ranking', () => {
    assert.deepEqual(favoritoSchema.parse({ favorito: false }), { favorito: false });
    assert.deepEqual(favoritoSchema.parse({ favorito: true }), { favorito: true });
    for (const entrada of [{ favorito: 'true' }, { favorito: 1 }, { favorito: true, usuario_id: usuario.id }, { favorito: true, ranking: 1 }, {}])
      assert.equal(favoritoSchema.safeParse(entrada).success, false);
  });
  it('filtrar favoritos es explícito, acotado y no acepta otro propietario', () => {
    assert.deepEqual(busquedaFavoritosSchema.parse({ q: '  QB65R-B  ' }), { q: 'QB65R-B' });
    assert.equal(busquedaFavoritosSchema.safeParse({ q: 'x'.repeat(201) }).success, false);
    assert.equal(busquedaFavoritosSchema.safeParse({ usuarioId: usuario.id }).success, false);
  });
  it('explica por qué aparece una referencia sin puntuación o sustitución opaca', () => {
    assert.deepEqual(motivosFavorito(false, false), ['Favorito personal']);
    assert.deepEqual(motivosFavorito(true, true), ['Favorito personal', 'Instalado en salas', 'En plantillas']);
  });
  it('comprueba autorización antes de consultar o escribir', async () => {
    const db = (() => { throw new Error('No debía consultar SQL'); }) as unknown as Parameters<typeof listarFavoritos>[0];
    for (const bloqueado of [{ ...usuario, ficticio: true }, { ...usuario, debeCambiarClave: true },
      { ...usuario, permisos: { ...usuario.permisos, catalogo: 'oculto' as const } }]) {
      await assert.rejects(listarFavoritos(db, bloqueado), /requieren un usuario/);
      await assert.rejects(esArticuloFavorito(db, bloqueado, articuloId), /requieren un usuario/);
      await assert.rejects(guardarFavorito(db, bloqueado, articuloId, { favorito: true }), /requieren un usuario/);
    }
  });
  it('rechaza identificador y propietario inyectados antes de escribir', async () => {
    const db = (() => { throw new Error('No debía consultar SQL'); }) as unknown as Parameters<typeof listarFavoritos>[0];
    await assert.rejects(guardarFavorito(db, usuario, 'QB65R', { favorito: true }), /UUID/);
    await assert.rejects(guardarFavorito(db, usuario, articuloId, { favorito: true, usuarioId: 'otro' }), /usuarioId/);
  });
});

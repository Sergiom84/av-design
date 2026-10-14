-- AVX-18 opcional: preferencias personales, sin ranking ni sustituciones.
begin;
create table if not exists usuarios_articulos_favoritos (
  usuario_id uuid not null references usuarios(id),
  articulo_id uuid not null references articulos(id),
  creado_en timestamptz not null default now(),
  primary key (usuario_id, articulo_id)
);
comment on table usuarios_articulos_favoritos is
  'Favoritos personales reversibles. No modifica catálogo, equipos, precios o puertos de una obra.';
commit;
-- Rollback manual en destino previamente identificado: drop table usuarios_articulos_favoritos;

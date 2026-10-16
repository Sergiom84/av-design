-- REA-02: presentación personal. No modifica catálogo, diseños ni permisos.
create table if not exists preferencias_usuario (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  version integer not null default 0 check (version >= 0),
  panel jsonb not null default '{}'::jsonb
    check (jsonb_typeof(panel) = 'object' and octet_length(panel::text) <= 16384),
  catalogo jsonb not null default '{}'::jsonb
    check (jsonb_typeof(catalogo) = 'object' and octet_length(catalogo::text) <= 16384),
  actualizado_en timestamptz not null default now()
);

comment on table preferencias_usuario is
  'Marcas/filtros y orden/visibilidad de tarjetas propios. Nunca conceden permisos ni sustituyen catálogo o diseño.';

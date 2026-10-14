-- E2 local: fuentes revisables, sin aplicar automáticamente a producción.
-- Rollback de la migración: conservar primero archivo/reportes; retirar triggers,
-- tablas importacion_cambios/sala_material_bom/importacion_lotes y columnas
-- revision/fuente añadidas únicamente si no se han empezado a usar.
alter table articulos add column if not exists fuente text not null default 'csv';
alter table articulos alter column fuente set default 'app';
alter table articulos drop constraint if exists articulos_fuente_valida;
alter table articulos add constraint articulos_fuente_valida check (fuente in ('csv', 'app'));
alter table articulos add column if not exists revision bigint not null default 0;
alter table precios add column if not exists revision bigint not null default 0;
alter table proveedores add column if not exists revision bigint not null default 0;

create table if not exists importacion_lotes (
  id uuid primary key default gen_random_uuid(),
  destino text not null check (destino in ('catalogo', 'bom', 'precios')),
  sala_id uuid references salas on delete restrict,
  usuario_id uuid not null,
  origen text not null,
  archivo_nombre text not null,
  archivo_sha256 text not null check (archivo_sha256 ~ '^[a-f0-9]{64}$'),
  archivo bytea not null check (octet_length(archivo) <= 5242880),
  estado text not null default 'confirmado' check (estado in ('confirmado', 'revertido', 'reversion_parcial')),
  filas jsonb not null,
  informe jsonb not null,
  reversion jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  revertido_en timestamptz,
  check ((destino = 'bom') = (sala_id is not null))
);
create index if not exists importacion_lotes_usuario_idx on importacion_lotes (usuario_id, creado_en desc);

alter table precios add column if not exists unidad_compra text;
alter table precios add column if not exists lote_id uuid references importacion_lotes on delete restrict;

create table if not exists sala_material_bom (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas on delete cascade,
  articulo_id uuid not null references articulos on delete restrict,
  cantidad numeric(12,2) not null check (cantidad > 0),
  unidad unidad_medida not null,
  nota text,
  lote_id uuid references importacion_lotes on delete restrict,
  revision bigint not null default 0
);
create index if not exists sala_material_bom_sala_idx on sala_material_bom (sala_id);
comment on table sala_material_bom is 'Partidas adicionales a la necesidad derivada: sin equipo colocado, conexión ni cálculo inventado.';

create table if not exists importacion_cambios (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references importacion_lotes on delete restrict,
  orden integer not null,
  tabla text not null check (tabla in ('articulos', 'precios', 'sala_material_bom', 'proveedores')),
  fila_id uuid not null,
  antes jsonb,
  despues jsonb not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'revertido', 'conservado')),
  motivo text,
  unique (lote_id, orden)
);
-- También actualiza el checkpoint local anterior a registrar proveedores.
alter table importacion_cambios drop constraint if exists importacion_cambios_tabla_check;
alter table importacion_cambios add constraint importacion_cambios_tabla_check
  check (tabla in ('articulos', 'precios', 'sala_material_bom', 'proveedores'));

-- Contenido idéntico tras dos ediciones (ABA) sigue siendo trabajo posterior.
-- No depende de que quien escribe recuerde aumentar la revisión.
create or replace function e2_aumentar_revision() returns trigger language plpgsql as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;
drop trigger if exists e2_revision_articulos on articulos;
create trigger e2_revision_articulos before update on articulos for each row execute function e2_aumentar_revision();
drop trigger if exists e2_revision_precios on precios;
create trigger e2_revision_precios before update on precios for each row execute function e2_aumentar_revision();
drop trigger if exists e2_revision_bom on sala_material_bom;
create trigger e2_revision_bom before update on sala_material_bom for each row execute function e2_aumentar_revision();
drop trigger if exists e2_revision_proveedores on proveedores;
create trigger e2_revision_proveedores before update on proveedores for each row execute function e2_aumentar_revision();

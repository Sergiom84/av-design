-- AVX-16: bytes durables y dimensiones verificadas, sin alterar la geometría.
begin;
create table if not exists articulos_tecnicos (
  articulo_id uuid primary key references articulos(id),
  marca text,
  modelo text not null,
  ancho numeric,
  alto numeric,
  fondo numeric,
  unidad text check (unidad in ('mm', 'cm', 'm')),
  ru numeric,
  origen text not null,
  url text not null check (url ~ '^https://'),
  fecha date not null,
  verificado_por uuid references usuarios(id),
  verificado_en timestamptz not null default now(),
  check (ancho is null or ancho > 0),
  check (alto is null or alto > 0),
  check (fondo is null or fondo > 0),
  check (ru is null or ru > 0),
  check (unidad is not null or (ancho is null and alto is null and fondo is null))
);
create table if not exists articulos_archivos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references articulos(id),
  tipo text not null check (tipo in ('imagen', 'ficha')),
  nombre text not null,
  mime text not null,
  tamano_bytes integer not null check (tamano_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bytea not null check (octet_length(bytes) between 1 and 5242880),
  marca text,
  modelo text not null,
  origen text not null,
  url text not null check (url ~ '^https://'),
  fecha date not null,
  verificado_por uuid references usuarios(id),
  verificado_en timestamptz not null default now(),
  unique (articulo_id, tipo),
  check (octet_length(bytes) = tamano_bytes),
  check ((tipo = 'imagen' and mime in ('image/png', 'image/jpeg', 'image/webp'))
      or (tipo = 'ficha' and mime = 'application/pdf'))
);
alter table sala_equipos add column if not exists dimensiones_tecnicas jsonb;
alter table plantilla_articulos add column if not exists dimensiones_tecnicas jsonb;
comment on column sala_equipos.dimensiones_tecnicas is
  'Dimensiones verificadas congeladas al alta. Ausente sigue ausente; no sustituye geometría del plano.';
comment on column plantilla_articulos.dimensiones_tecnicas is
  'Dimensiones congeladas; sala -> plantilla -> sala conserva el snapshot, incluso ausencia.';

create or replace function congelar_dimensiones_tecnicas() returns trigger language plpgsql as $$
declare datos jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.articulo_id is not distinct from old.articulo_id then return new; end if;
    -- Sustituir la referencia sustituye su snapshot; editar el catálogo no.
    new.dimensiones_tecnicas := null;
  elsif new.dimensiones_tecnicas is not null then
    -- JSON null es ausencia explícita al copiar una instancia legado.
    return new;
  elsif tg_table_name = 'sala_equipos' then
    if new.origen_plantilla_linea_id is not null then
      select dimensiones_tecnicas into datos from plantilla_articulos
        where id = new.origen_plantilla_linea_id and articulo_id is not distinct from new.articulo_id;
      new.dimensiones_tecnicas := datos;
      return new;
    end if;
  end if;
  select jsonb_build_object('marca', t.marca, 'modelo', t.modelo,
    'ancho', t.ancho, 'alto', t.alto, 'fondo', t.fondo, 'unidad', t.unidad, 'ru', t.ru,
    'origen', t.origen, 'url', t.url, 'fecha', t.fecha)
    into datos from articulos_tecnicos t join articulos a on a.id = t.articulo_id
    where t.articulo_id = new.articulo_id and t.modelo = a.modelo
      and t.marca is not distinct from a.marca
      and (t.ancho is not null or t.alto is not null or t.fondo is not null or t.ru is not null);
  new.dimensiones_tecnicas := datos;
  return new;
end;
$$;
drop trigger if exists sala_equipos_congelar_dimensiones on sala_equipos;
create trigger sala_equipos_congelar_dimensiones before insert or update of articulo_id on sala_equipos
  for each row execute function congelar_dimensiones_tecnicas();
drop trigger if exists plantilla_articulos_congelar_dimensiones on plantilla_articulos;
create trigger plantilla_articulos_congelar_dimensiones before insert or update of articulo_id on plantilla_articulos
  for each row execute function congelar_dimensiones_tecnicas();
commit;
-- Rollback manual, sólo sobre la BD de prueba identificada: drop triggers, función,
-- tablas articulos_archivos_tecnicos/articulos_tecnicos y ambas columnas snapshot.
-- La entrega conserva los datos técnicos al revertir lotes de importación ajenos.

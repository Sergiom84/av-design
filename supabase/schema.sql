-- =====================================================================
-- AV_design · esquema Fase 1
-- Catálogo · Plantillas de sala · Salas con medidas · Cálculo de cable
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Personas y roles
-- ---------------------------------------------------------------------
do $$ begin
  create type rol_usuario as enum ('admin', 'tei', 'av', 'tecnico', 'lectura');
exception when duplicate_object then null; end $$;

create table if not exists perfiles (
  id          uuid primary key references auth.users on delete cascade,
  nombre      text not null,
  rol         rol_usuario not null default 'lectura',
  creado_en   timestamptz not null default now()
);

comment on table perfiles is
  'TEI revisa el diseño y propone compra. AV da el visto bueno. Técnico configura e instala.';

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
do $$ begin
  create type tipo_articulo as enum ('equipo', 'cable', 'consumible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unidad_medida as enum ('ud', 'm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type senal as enum (
    'hdmi','red','usb','audio_linea','audio_altavoz',
    'microfono','alimentacion','control','otro'
  );
exception when duplicate_object then null; end $$;

create table if not exists proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  contacto  text,
  email     text,
  telefono  text,
  notas     text
);

create table if not exists articulos (
  id                        uuid primary key default gen_random_uuid(),
  referencia                text unique,
  tipo                      tipo_articulo not null,
  categoria                 text not null,
  marca                     text,
  modelo                    text not null,
  descripcion               text,
  unidad                    unidad_medida not null default 'ud',
  coste                     numeric(12,4),
  pvp                       numeric(12,4),
  proveedor_id              uuid references proveedores on delete set null,
  plazo_dias                integer,
  stock_minimo              numeric(12,2),
  -- solo para tipo = 'cable'
  senal                     senal,
  conector_a                text,
  conector_b                text,
  longitudes_comerciales_m  numeric(6,2)[],
  bobina_m                  numeric(8,2),
  diametro_mm               numeric(6,2),
  -- trazabilidad con el inventario de partida
  unidades_instaladas       integer,
  activo                    boolean not null default true,
  creado_en                 timestamptz not null default now(),
  unique (marca, modelo, categoria)
);

create index if not exists articulos_tipo_idx      on articulos (tipo);
create index if not exists articulos_categoria_idx on articulos (categoria);
create index if not exists articulos_busqueda_idx  on articulos
  using gin (to_tsvector('spanish', coalesce(marca,'') || ' ' || modelo || ' ' || categoria));

-- ---------------------------------------------------------------------
-- Sedes, plantillas y salas
-- ---------------------------------------------------------------------
do $$ begin
  create type ruta_cable as enum ('falso_techo', 'canaleta', 'suelo_tecnico', 'directo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type extremo_cable as enum (
    'pantalla','proyector','rack','caja_conexiones','mesa','techo','pared'
  );
exception when duplicate_object then null; end $$;

create table if not exists sedes (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,
  ciudad  text,
  notas   text
);

create table if not exists plantillas_sala (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null unique,
  tipologia           text not null,
  aforo               integer,
  n_salas_reales      integer,
  largo_m             numeric(6,2),
  ancho_m             numeric(6,2),
  alto_m              numeric(6,2),
  alto_falso_techo_m  numeric(6,2),
  ruta_por_defecto    ruta_cable not null default 'falso_techo',
  notas               text,
  creado_en           timestamptz not null default now()
);

comment on column plantillas_sala.n_salas_reales is
  'Cuántas salas del inventario responden a esta plantilla. Sirve para priorizar.';

create table if not exists plantilla_articulos (
  id            uuid primary key default gen_random_uuid(),
  plantilla_id  uuid not null references plantillas_sala on delete cascade,
  articulo_id   uuid references articulos on delete set null,
  categoria     text not null,
  modelo_texto  text,
  cantidad      numeric(6,2) not null default 1,
  opcional      boolean not null default false
);

create index if not exists plantilla_articulos_plantilla_idx
  on plantilla_articulos (plantilla_id);

create table if not exists salas (
  id                      uuid primary key default gen_random_uuid(),
  sede_id                 uuid references sedes on delete set null,
  edificio                text,
  nivel                   text,
  codigo                  text,
  nombre                  text not null,
  tipologia               text,
  aforo                   integer,
  plantilla_id            uuid references plantillas_sala on delete set null,
  largo_m                 numeric(6,2) not null default 0,
  ancho_m                 numeric(6,2) not null default 0,
  alto_m                  numeric(6,2) not null default 0,
  alto_falso_techo_m      numeric(6,2),
  alto_canaleta_m         numeric(6,2) default 0.30,
  alto_suelo_tecnico_m    numeric(6,2) default 0,
  ruta_por_defecto        ruta_cable not null default 'falso_techo',
  notas                   text,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now()
);

create index if not exists salas_sede_idx      on salas (sede_id);
create index if not exists salas_tipologia_idx on salas (tipologia);

create table if not exists sala_equipos (
  id           uuid primary key default gen_random_uuid(),
  sala_id      uuid not null references salas on delete cascade,
  articulo_id  uuid references articulos on delete set null,
  nombre       text not null,
  cantidad     integer not null default 1,
  extremo      extremo_cable not null default 'pared',
  x_m          numeric(6,2) not null default 0,
  y_m          numeric(6,2) not null default 0,
  z_m          numeric(6,2) not null default 0
);

create index if not exists sala_equipos_sala_idx on sala_equipos (sala_id);

create table if not exists conexiones (
  id                 uuid primary key default gen_random_uuid(),
  sala_id            uuid not null references salas on delete cascade,
  origen_id          uuid not null references sala_equipos on delete cascade,
  destino_id         uuid not null references sala_equipos on delete cascade,
  articulo_cable_id  uuid references articulos on delete set null,
  senal              senal not null default 'otro',
  ruta               ruta_cable,
  longitud_manual_m  numeric(8,2),
  notas              text,
  check (origen_id <> destino_id)
);

create index if not exists conexiones_sala_idx on conexiones (sala_id);

-- ---------------------------------------------------------------------
-- Parámetros de cálculo
-- ---------------------------------------------------------------------
create table if not exists parametros (
  clave        text primary key,
  valor        numeric(10,4) not null,
  unidad       text,
  descripcion  text
);

-- ---------------------------------------------------------------------
-- Trigger de actualización
-- ---------------------------------------------------------------------
create or replace function tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

drop trigger if exists salas_actualizado on salas;
create trigger salas_actualizado before update on salas
  for each row execute function tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- RLS: todo el departamento lee; escribir requiere rol
-- ---------------------------------------------------------------------
alter table perfiles            enable row level security;
alter table proveedores         enable row level security;
alter table articulos           enable row level security;
alter table sedes               enable row level security;
alter table plantillas_sala     enable row level security;
alter table plantilla_articulos enable row level security;
alter table salas               enable row level security;
alter table sala_equipos        enable row level security;
alter table conexiones          enable row level security;
alter table parametros          enable row level security;

create or replace function rol_actual()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid();
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'proveedores','articulos','sedes','plantillas_sala','plantilla_articulos',
    'salas','sala_equipos','conexiones','parametros'
  ] loop
    execute format('drop policy if exists "%1$s_leer" on %1$s', t);
    execute format(
      'create policy "%1$s_leer" on %1$s for select to authenticated using (true)', t);

    execute format('drop policy if exists "%1$s_escribir" on %1$s', t);
    execute format(
      'create policy "%1$s_escribir" on %1$s for all to authenticated
         using (rol_actual() in (''admin'',''tei'',''av'',''tecnico''))
         with check (rol_actual() in (''admin'',''tei'',''av'',''tecnico''))', t);
  end loop;
end $$;

drop policy if exists "perfiles_propio" on perfiles;
create policy "perfiles_propio" on perfiles for select to authenticated using (true);

drop policy if exists "perfiles_admin" on perfiles;
create policy "perfiles_admin" on perfiles for all to authenticated
  using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

-- Alta automática de perfil al registrarse
create or replace function crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), 'lectura')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function crear_perfil();

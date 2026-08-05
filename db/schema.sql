-- =====================================================================
-- AV_design · esquema Fase 1
-- Catálogo · Plantillas de sala · Salas con medidas · Cálculo de cable
--
-- Postgres puro: funciona igual en el contenedor local y, más adelante,
-- en Supabase. Lo específico de Supabase (perfiles, auth, RLS) está
-- aparte en db/politicas-supabase.sql y se aplica solo al migrar.
--
--   npm run db:migrate
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos del dominio
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

do $$ begin
  create type ruta_cable as enum ('falso_techo', 'canaleta', 'suelo_tecnico', 'directo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type extremo_cable as enum (
    'pantalla','proyector','rack','caja_conexiones','mesa','techo','pared'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type rol_usuario as enum ('admin', 'tei', 'av', 'tecnico', 'lectura');
exception when duplicate_object then null; end $$;

comment on type rol_usuario is
  'TEI revisa el diseño y propone compra. AV da el visto bueno. Técnico configura e instala.';

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
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
  creado_en                 timestamptz not null default now()
);

-- La marca puede venir vacía, así que la clave única va sobre una expresión.
create unique index if not exists articulos_unico_idx
  on articulos (coalesce(marca, ''), modelo, categoria);
create index if not exists articulos_tipo_idx      on articulos (tipo);
create index if not exists articulos_categoria_idx on articulos (categoria);

-- ---------------------------------------------------------------------
-- Sedes, plantillas y salas
-- ---------------------------------------------------------------------
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
  opcional      boolean not null default false,
  unique (plantilla_id, categoria)
);

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

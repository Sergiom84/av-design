-- =====================================================================
-- Migración 2026-08 · Mobiliario y origen del diagrama
--
-- Delta revisable de la segunda fase del editor. El mismo bloque vive al
-- final de db/schema.sql, que sigue siendo la fuente completa. Idempotente:
-- se puede aplicar dos veces sin efecto y sin duplicar mobiliario.
--
-- Aplicar con:
--   node scripts/db.mjs db/migraciones/2026-08-mobiliario-diagrama.sql
--
-- NO aplicada en Neon. La anterior (2026-08-diagrama-sala.sql) tampoco se
-- toca: se añade al lado, no se edita.
-- =====================================================================

-- ---------------------------------------------------------------------
-- El mobiliario NO es catálogo AV
--
-- `articulos` alimenta stock, reservas, pedidos, precios, puertos y
-- conexiones. Una silla no se pide a un proveedor de AV, no tiene puertos y
-- no entra en una tirada: meterla ahí la haría aparecer entre los cables y
-- los consumibles de cada obra. Vive en su propio catálogo, con su propia
-- fuente editable (data/mobiliario.csv) y la misma convención `fuente` que
-- `precios`, `puertos` y `tecnicos`: 'csv' se regenera en cada siembra,
-- 'app' no se toca nunca.
-- ---------------------------------------------------------------------
create table if not exists catalogo_mobiliario (
  id              uuid primary key default gen_random_uuid(),
  clave           text not null unique,
  nombre          text not null,
  categoria       text not null,
  -- Lo que teclea el técnico y no es el nombre: «asiento», «butaca».
  palabras_clave  text,
  -- Cómo se dibuja en planta. La silla es el círculo de siempre.
  forma           text not null default 'rectangulo'
                    check (forma in ('rectangulo', 'circulo')),
  -- Nulas a propósito: no se inventan las medidas del mobiliario del
  -- departamento. Sin ellas la instancia nace «Sin medir» y el inspector
  -- pide largo y ancho antes de darla por colocada.
  largo_m_defecto numeric(6,2),
  ancho_m_defecto numeric(6,2),
  alto_m_defecto  numeric(6,2),
  activo          boolean not null default true,
  orden           integer not null default 100,
  fuente          text not null default 'csv' check (fuente in ('csv', 'app')),
  creado_en       timestamptz not null default now()
);

comment on table catalogo_mobiliario is
  'Sillas, mesas y demás mobiliario de sala. Deliberadamente fuera de articulos: no se pide, no tiene puertos y no entra en ninguna tirada.';
comment on column catalogo_mobiliario.largo_m_defecto is
  'Nulo = sin medida por defecto. La instancia nace Sin medir y no se da por colocada hasta que alguien la mide.';

create index if not exists catalogo_mobiliario_activo_idx
  on catalogo_mobiliario (activo, orden);

-- ---------------------------------------------------------------------
-- Una silla física es una fila
--
-- Ocho sillas son ocho instancias arrastrables y rotables, no una línea
-- con cantidad 8: cada una está en un sitio distinto y mirando a un lado
-- distinto. El `cantidad ×N` de `sala_equipos` tiene sentido para cuatro
-- micrófonos de techo que cuelgan del mismo punto del plano; para una
-- silla no lo tiene.
--
-- Las medidas se copian del catálogo al crear la instancia y se quedan:
-- son un snapshot. Corregir mañana la silla del catálogo no puede deformar
-- el plano de las salas que ya se dibujaron.
-- ---------------------------------------------------------------------
create table if not exists sala_mobiliario (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid not null references salas on delete cascade,
  mobiliario_id  uuid references catalogo_mobiliario on delete set null,
  nombre         text not null,
  forma          text not null default 'rectangulo'
                   check (forma in ('rectangulo', 'circulo')),
  largo_m        numeric(6,2),
  ancho_m        numeric(6,2),
  alto_m         numeric(6,2),
  -- Nulas mientras nadie lo coloque, igual que en `plantilla_articulos`:
  -- la ausencia se propaga como ausencia y no se convierte en (0,0,0).
  x_m            numeric(6,2),
  y_m            numeric(6,2),
  z_m            numeric(6,2),
  rotacion_grados numeric(6,2) not null default 0,
  posicion_confirmada boolean not null default false,
  -- De qué línea de plantilla vino, para distinguir lo heredado de lo que
  -- alguien añadió a mano y no volver a copiarlo.
  origen_plantilla_mobiliario_id uuid,
  orden          integer not null default 100,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists sala_mobiliario_sala_idx on sala_mobiliario (sala_id);
create unique index if not exists sala_mobiliario_origen_idx
  on sala_mobiliario (sala_id, origen_plantilla_mobiliario_id)
  where origen_plantilla_mobiliario_id is not null;

comment on table sala_mobiliario is
  'Una fila por mueble físico. Ocho sillas son ocho filas: cada una tiene su sitio y su giro.';

-- ---------------------------------------------------------------------
-- La plantilla trae el mobiliario, no solo el equipamiento
--
-- Colocar una silla una vez o colocarla 144 veces es la diferencia. Guarda
-- también la ausencia de posición: una plantilla sin colocar no inventa
-- (0,0,0) en la sala nueva.
-- ---------------------------------------------------------------------
create table if not exists plantilla_mobiliario (
  id             uuid primary key default gen_random_uuid(),
  plantilla_id   uuid not null references plantillas_sala on delete cascade,
  mobiliario_id  uuid references catalogo_mobiliario on delete set null,
  nombre         text not null,
  forma          text not null default 'rectangulo'
                   check (forma in ('rectangulo', 'circulo')),
  largo_m        numeric(6,2),
  ancho_m        numeric(6,2),
  alto_m         numeric(6,2),
  x_m            numeric(6,2),
  y_m            numeric(6,2),
  z_m            numeric(6,2),
  rotacion_grados numeric(6,2) not null default 0,
  posicion_confirmada boolean,
  orden          integer not null default 100,
  creado_en      timestamptz not null default now()
);

create index if not exists plantilla_mobiliario_plantilla_idx
  on plantilla_mobiliario (plantilla_id);

-- ---------------------------------------------------------------------
-- El equipamiento también gira
--
-- Sustituye la decisión anterior de no rotar equipos: una pantalla en una
-- esquina a 45°, un rack de costado y una barra de vídeo bajo la mesa
-- necesitan orientación, y sin ella el plano de obra es aproximado justo
-- donde se taladra.
-- ---------------------------------------------------------------------
alter table sala_equipos
  add column if not exists rotacion_grados numeric(6,2) not null default 0;
alter table plantilla_articulos
  add column if not exists rotacion_grados numeric(6,2) not null default 0;

comment on column sala_equipos.rotacion_grados is
  'Giro del símbolo sobre su ancla, en grados antihorarios y normalizado a [0,360). Rotar no cambia x/y/z.';

-- De qué línea de plantilla salió el equipo. Distingue lo heredado de lo
-- añadido a mano y es lo que impide copiar dos veces la misma plantilla.
alter table sala_equipos
  add column if not exists origen_plantilla_linea_id uuid;

create unique index if not exists sala_equipos_origen_idx
  on sala_equipos (sala_id, origen_plantilla_linea_id)
  where origen_plantilla_linea_id is not null;

-- ---------------------------------------------------------------------
-- De dónde sale el plano
--
-- Al entrar en Diagrama hay que saber si la sala se prepara desde cero o
-- desde una plantilla. Se pregunta UNA vez: `diagrama_iniciado_en` es la
-- marca de que ya se decidió, y a partir de ahí la pestaña abre el editor
-- directamente.
--
-- El origen puede quedarse nulo con el diagrama ya iniciado: es el caso de
-- las salas históricas de las que no se puede demostrar la procedencia. No
-- se inventa.
-- ---------------------------------------------------------------------
alter table salas add column if not exists diagrama_iniciado_en timestamptz;
alter table salas add column if not exists diagrama_origen text;
alter table salas add column if not exists diagrama_plantilla_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'salas_diagrama_origen_check'
  ) then
    alter table salas add constraint salas_diagrama_origen_check
      check (diagrama_origen is null or diagrama_origen in ('desde_cero', 'plantilla'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'salas_diagrama_plantilla_fk'
  ) then
    alter table salas add constraint salas_diagrama_plantilla_fk
      foreign key (diagrama_plantilla_id) references plantillas_sala on delete set null;
  end if;
end $$;

comment on column salas.diagrama_origen is
  'Nulo con el diagrama ya iniciado = sala histórica cuya procedencia no puede demostrarse. No se inventa.';

-- ---------------------------------------------------------------------
-- Las sillas: una sola fuente activa
--
-- Hoy las sillas se DERIVAN del aforo y se dibujan alrededor de la mesa.
-- Con `sala_mobiliario` pasan a poder ser filas reales, y las dos fuentes
-- a la vez dibujarían cada silla dos veces.
--
-- `sillas_modo` es la guarda: 'derivadas' = el croquis las reparte desde
-- el aforo y no hay filas de silla; 'manuales' = mandan las filas y el
-- aforo vuelve a ser solo la capacidad de la sala.
--
-- El paso de un modo a otro NO se hace aquí. La colocación de las sillas
-- derivadas la calcula `sillasAlrededor()` en `src/lib/croquis.ts`, que es
-- lógica pura con pruebas; repetirla en SQL sería una segunda geometría
-- que se separaría de la primera al primer retoque. La materialización la
-- hace el editor con esa misma función, sala a sala y cuando alguien toca
-- las sillas de esa sala. Hasta entonces el croquis dibuja exactamente lo
-- que dibujaba antes de esta migración.
-- ---------------------------------------------------------------------
alter table salas add column if not exists sillas_modo text not null default 'derivadas';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'salas_sillas_modo_check'
  ) then
    alter table salas add constraint salas_sillas_modo_check
      check (sillas_modo in ('derivadas', 'manuales'));
  end if;
end $$;

comment on column salas.sillas_modo is
  'derivadas = las reparte el croquis desde el aforo; manuales = mandan las filas de sala_mobiliario. Nunca las dos a la vez.';

-- ---------------------------------------------------------------------
-- Backfill del origen
--
-- Una sala con medidas, equipos, conexiones, tomas o mesa ya está
-- empezada: preguntarle «¿desde cero o desde plantilla?» a las 390 salas
-- reales sería interrumpir trabajo hecho. Se marcan como iniciadas.
--
-- La procedencia solo se conserva cuando puede demostrarse: `plantilla_id`
-- es de dónde nació la sala. Sin él, el diagrama queda iniciado y sin
-- origen, que es la verdad.
--
-- Idempotente por el `where diagrama_iniciado_en is null`: repetir la
-- migración no vuelve a marcar nada ni pisa una decisión posterior.
-- ---------------------------------------------------------------------
update salas s
   set diagrama_iniciado_en = coalesce(s.creado_en, now()),
       diagrama_origen = case when s.plantilla_id is not null then 'plantilla' end,
       diagrama_plantilla_id = s.plantilla_id
 where s.diagrama_iniciado_en is null
   and (
     s.largo_m > 0 or s.ancho_m > 0 or s.alto_m > 0
     or s.mesa_largo_m is not null or s.mesa_ancho_m is not null
     or s.plantilla_id is not null
     or exists (select 1 from sala_equipos e where e.sala_id = s.id)
     or exists (select 1 from tomas_red t where t.sala_id = s.id)
     or exists (select 1 from conexiones c where c.sala_id = s.id)
   );

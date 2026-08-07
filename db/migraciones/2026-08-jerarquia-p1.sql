-- =====================================================================
-- Migración 2026-08 · Jerarquía de obra y P1 (técnicos e hitos)
--
-- Migración acotada para producción (Neon). Es el mismo bloque que vive
-- al final de db/schema.sql: schema.sql sigue siendo la fuente completa
-- y este fichero es el delta revisable de esta fase. Idempotente: se
-- puede aplicar dos veces sin efecto.
--
-- Aplicar con: DATABASE_URL=<neon> node scripts/db.mjs db/migraciones/2026-08-jerarquia-p1.sql
-- SIEMPRE antes del push a main que despliega el código que la consume.
-- Aplicada en Neon el 7-8-2026 (via schema.sql completo).
-- =====================================================================

-- =====================================================================
-- Jerarquia de obra · Proyecto -> Localizaciones -> Salas
--
-- Hasta aqui las salas colgaban directas de la aplicacion. La obra real
-- agrupa salas: un proyecto (la obra) tiene localizaciones (edificio,
-- planta, campus) y cada localizacion tiene salas. Es la jerarquia de
-- XTEN-AV (docs/06, L496) que faltaba.
--
-- Una sala sin proyecto es un estado valido, no una deuda: todo lo
-- creado antes de esta ampliacion se queda con localizacion_id nulo y
-- se puede adoptar desde la portada del proyecto cuando toque.
-- ---------------------------------------------------------------------
create table if not exists proyectos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  codigo         text,
  sede_id        uuid references sedes on delete set null,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists proyectos_sede_idx on proyectos (sede_id);

drop trigger if exists proyectos_actualizado on proyectos;
create trigger proyectos_actualizado before update on proyectos
  for each row execute function tocar_actualizado_en();

comment on table proyectos is
  'La obra. Agrupa localizaciones y salas; sin estado editable: el estado se deriva de sus hitos.';

create table if not exists localizaciones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos on delete cascade,
  nombre       text not null,
  notas        text,
  creado_en    timestamptz not null default now(),
  unique (proyecto_id, nombre)
);

create index if not exists localizaciones_proyecto_idx on localizaciones (proyecto_id);

comment on table localizaciones is
  'Agrupacion de salas dentro de un proyecto: edificio, planta, campus. Cada proyecto nace con una "Sin asignar".';

alter table salas add column if not exists localizacion_id uuid
  references localizaciones on delete set null;

create index if not exists salas_localizacion_idx on salas (localizacion_id);

comment on column salas.localizacion_id is
  'Nula = sala sin proyecto (todo lo anterior a la jerarquia de obra). Estado valido, no error. Borrar el proyecto deja la sala viva y sin proyecto.';

alter table pedidos add column if not exists proyecto_id uuid
  references proyectos on delete set null;

create index if not exists pedidos_proyecto_idx on pedidos (proyecto_id);

comment on column pedidos.proyecto_id is
  'Para que obra se pide. Un pedido puede abastecer varias salas del proyecto; el reparto entre salas lo hacen las reservas. sala_id se conserva para el pedido que nace del que-falta de una sala.';

-- =====================================================================
-- P1 · Tecnicos e hitos: quien hizo que, y cuando
--
-- El estado del material se deriva de movimientos y recepciones; el hecho
-- humano se registra. Un hito no es un estado editable: es un registro que
-- se anade, como los movimientos del almacen. Los hitos de la obra (inicio,
-- cierre) cuelgan del proyecto; los de la sala (instalacion, entrega), de
-- la sala. La recepcion no es hito de ninguno de los dos: es por pedido, y
-- ya vive en la recepcion de compras con `movimientos.quien`.
-- ---------------------------------------------------------------------
create table if not exists tecnicos (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  activo    boolean not null default true,
  -- `csv` lo regenera la siembra; `app` se escribio aqui y no se toca.
  fuente    text not null default 'csv' check (fuente in ('csv', 'app')),
  creado_en timestamptz not null default now()
);

create table if not exists tecnico_roles (
  tecnico_id uuid not null references tecnicos on delete cascade,
  rol        text not null check (rol in ('inicio', 'recepcion', 'instalacion')),
  primary key (tecnico_id, rol)
);

comment on table tecnicos is
  'La lista de personas del departamento. Sin contrasenas: se elige el nombre al registrar el hecho; la puerta es la clave de departamento.';

create table if not exists hitos_proyecto (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos on delete cascade,
  tipo        text not null check (tipo in ('inicio', 'cierre')),
  tecnico_id  uuid references tecnicos on delete set null,
  fecha       date not null default current_date,
  notas       text,
  creado_en   timestamptz not null default now(),
  unique (proyecto_id, tipo)
);

create table if not exists hitos_sala (
  id         uuid primary key default gen_random_uuid(),
  sala_id    uuid not null references salas on delete cascade,
  tipo       text not null check (tipo in ('instalacion', 'entrega')),
  tecnico_id uuid references tecnicos on delete set null,
  fecha      date not null default current_date,
  notas      text,
  creado_en  timestamptz not null default now(),
  unique (sala_id, tipo)
);

comment on table hitos_proyecto is
  'Inicio y cierre de la obra. Un hito de cada tipo por proyecto; si se registro mal, se borra y se registra de nuevo.';
comment on table hitos_sala is
  'Instalacion y entrega de la sala concreta. La entrega con bloqueos del semaforo avisa y exige nota, no bloquea.';
comment on column hitos_sala.tecnico_id is
  'Nulo = hito historico de alguien que ya no esta en la lista. El hecho no se pierde porque se vaya la persona.';

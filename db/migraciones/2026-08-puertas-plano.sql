-- =====================================================================
-- Migración 2026-08 · Puertas del plano
--
-- Delta revisable del fascículo 3. El mismo bloque vive al final de
-- db/schema.sql, que sigue siendo la fuente completa. Idempotente: se puede
-- aplicar dos veces sin efecto.
--
-- Aplicar con:
--   node scripts/db.mjs db/migraciones/2026-08-puertas-plano.sql
--
-- Solo contra el Postgres local de Docker. NO aplicada en Neon.
--
-- Reversión: drop table puertas; (si ya hay filas reales, decide una
-- persona qué se hace con ellas; no se borran de paso).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Las puertas del plano
--
-- Una puerta es arquitectura de la sala, no catálogo AV: no se pide a un
-- proveedor, no tiene puertos y no entra en ninguna tirada. Vive en su
-- propia tabla y una sala puede tener varias.
--
-- Una tabla única para sala y plantilla, con propietario exclusivo: la
-- misma fila que describe la puerta de una sala describe la de una
-- plantilla, y la copia plantilla→sala copia filas, no traduce entre dos
-- modelos que divergirían.
--
-- La puerta vive EN una pared: `pared` dice cuál y `posicion_m` cuánto hay
-- del origen de esa pared al arranque del hueco. No tiene x/y libres a
-- propósito: una puerta en mitad de la sala no existe.
--
-- La anchura y la altura nacen NULAS y se presentan como «Sin medir».
-- No hay valor por defecto ni en esta tabla, ni en `parametros`, ni en el
-- dominio: inventar la anchura de una puerta es dar por medido lo que
-- nadie ha medido, y esto acaba en un plano de obra. Se miden las dos
-- juntas o ninguna: una anchura sin altura es una medida a medias y no se
-- guarda.
-- ---------------------------------------------------------------------
create table if not exists puertas (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid references salas on delete cascade,
  plantilla_id   uuid references plantillas_sala on delete cascade,
  pared          text not null check (pared in ('norte', 'sur', 'este', 'oeste')),
  posicion_m     numeric(6,2) not null check (posicion_m >= 0),
  anchura_m      numeric(6,2) check (anchura_m > 0),
  altura_m       numeric(6,2) check (altura_m > 0),
  orden          integer not null default 100,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- O de una sala o de una plantilla, nunca de las dos ni de ninguna.
  constraint puertas_propietario_check
    check ((sala_id is null) <> (plantilla_id is null)),
  -- Medida entera o sin medir: las dos dimensiones van juntas.
  constraint puertas_medida_entera_check
    check ((anchura_m is null) = (altura_m is null))
);

create index if not exists puertas_sala_idx on puertas (sala_id)
  where sala_id is not null;
create index if not exists puertas_plantilla_idx on puertas (plantilla_id)
  where plantilla_id is not null;

comment on table puertas is
  'Puertas del plano, de una sala o de una plantilla (propietario exclusivo). Anchura y altura nulas = «Sin medir»; no existe medida por defecto en ningún sitio.';
comment on column puertas.pared is
  'sur = y 0 (a lo largo de x), norte = y ancho, oeste = x 0 (a lo largo de y), este = x largo. El mismo sistema de ejes que el croquis.';
comment on column puertas.posicion_m is
  'Metros desde el origen de la pared al arranque del hueco. El origen es la esquina de menor coordenada de esa pared.';

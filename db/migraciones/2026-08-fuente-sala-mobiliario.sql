-- =====================================================================
-- Migración 2026-08 · Quién escribió cada mueble
--
-- Delta revisable sobre 2026-08-rol-mobiliario.sql, que no se toca: se
-- añade al lado. El mismo bloque vive al final de db/schema.sql, que sigue
-- siendo la fuente completa. Idempotente.
--
-- Aplicar con:
--   node scripts/db.mjs db/migraciones/2026-08-fuente-sala-mobiliario.sql
--
-- Es el paso PREVIO al backfill de sillas: primero esta migración, después
-- `npm run migrar:sillas`. Al revés, las filas materializadas nacerían
-- como `app` y el rollback documentado no sabría distinguirlas.
--
-- NO aplicada en Neon. Las anteriores tampoco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quién escribió cada mueble
--
-- Misma convención que `precios` y `puertos`: una columna `fuente` que
-- distingue lo que escribe una persona desde la aplicación de lo que
-- escribe un proceso, para poder deshacer lo segundo sin llevarse por
-- delante lo primero.
--
-- Aquí el proceso es el backfill de sillas (`scripts/migrar-sillas.mts`),
-- que en una base real materializa varios miles de filas de golpe. Sin
-- esta columna, deshacerlo era mirar `creado_en` y confiar en que nadie
-- hubiera colocado una silla a mano en esa misma ventana: un rollback que
-- puede borrar trabajo medido no es un rollback.
--
-- El defecto es `app` a propósito: ni una sola inserción de la aplicación
-- cambia por esto —ni el editor, ni la copia desde plantilla— y las filas
-- que ya existen se quedan donde tienen que estar. El backfill es el único
-- que escribe el otro valor.
-- ---------------------------------------------------------------------
alter table sala_mobiliario add column if not exists fuente text not null default 'app';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sala_mobiliario_fuente_check'
  ) then
    alter table sala_mobiliario add constraint sala_mobiliario_fuente_check
      check (fuente in ('app', 'backfill'));
  end if;
end $$;

comment on column sala_mobiliario.fuente is
  'app = lo colocó una persona desde la aplicación, no se toca nunca; backfill = lo materializó scripts/migrar-sillas.mts desde el aforo, y es lo único que el rollback documentado borra.';

create index if not exists sala_mobiliario_fuente_idx
  on sala_mobiliario (sala_id, fuente);

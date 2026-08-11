-- =====================================================================
-- Migración 2026-08 · El rol del mueble
--
-- Delta revisable sobre 2026-08-mobiliario-diagrama.sql, que no se toca:
-- se añade al lado. El mismo bloque vive al final de db/schema.sql, que
-- sigue siendo la fuente completa. Idempotente.
--
-- Aplicar con:
--   node scripts/db.mjs db/migraciones/2026-08-rol-mobiliario.sql
--
-- NO aplicada en Neon. Las dos anteriores tampoco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Qué es cada mueble, y no solo cómo se llama
--
-- El catálogo sabía dibujar un mueble —forma y medidas— pero no qué papel
-- juega en la sala, y de esa ausencia salieron tres fallos distintos:
--
-- - Una mesa auxiliar heredada de una plantilla apagaba las sillas del
--   aforo, porque la única pregunta que se sabía hacer era «¿hay alguna
--   fila de mobiliario?». Una sala con mesa auxiliar y sin sillas se
--   quedaba con cero sillas.
-- - Añadir una silla a mano NO las apagaba, así que se dibujaban las ocho
--   del aforo más la nueva.
-- - `Mesa principal` se podía añadir como mueble genérico teniendo la sala
--   su mesa canónica en `salas.mesa_*`: dos mesas principales editables.
--
-- `rol` contesta la pregunta una vez y en el sitio donde se corrige con
-- Excel (data/mobiliario.csv). Nulo es la respuesta normal: un armario no
-- es ni asiento ni la mesa de la sala.
-- ---------------------------------------------------------------------
alter table catalogo_mobiliario add column if not exists rol text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catalogo_mobiliario_rol_check'
  ) then
    alter table catalogo_mobiliario add constraint catalogo_mobiliario_rol_check
      check (rol is null or rol in ('asiento', 'mesa_principal'));
  end if;
end $$;

comment on column catalogo_mobiliario.rol is
  'asiento = su presencia en la sala apaga las sillas derivadas del aforo; mesa_principal = es la mesa canónica de salas.mesa_*, no se instancia como fila; nulo = mueble corriente.';

-- ---------------------------------------------------------------------
-- Backfill: la columna nueva nace con el rol puesto
--
-- Añadir la columna y esperar a que alguien ejecute `npm run seed` no es una
-- migración: es una instrucción que hay que acordarse de seguir. Entre la
-- migración y la siembra, la silla tiene `rol = null`, y con el rol nulo deja
-- de ser asiento: el aforo vuelve a repartir sillas junto a las filas reales
-- y el croquis dibuja cada una dos veces. La base de producción no se
-- resetea; se le aplica esto encima de lo que ya tiene.
--
-- Se reparte por CLAVE, que es el identificador estable del catálogo, y no
-- por nombre ni por categoría: «Silla» se puede renombrar y «Asientos» se
-- puede reorganizar, pero `silla` es la referencia. Un mueble que no sea una
-- de las dos claves canónicas no se toca: no se le inventa papel ni se
-- transforma. `is distinct from` deja la sentencia idempotente y no reescribe
-- una fila que ya está bien.
-- ---------------------------------------------------------------------
update catalogo_mobiliario set rol = 'asiento'
 where clave = 'silla' and rol is distinct from 'asiento';

update catalogo_mobiliario set rol = 'mesa_principal'
 where clave = 'mesa-principal' and rol is distinct from 'mesa_principal';

-- ---------------------------------------------------------------------
-- Y se comprueba, porque un backfill que no reparte nada es peor que no
-- tenerlo: deja la base con el fallo y la migración con el «aplicado».
--
-- La comprobación se salta cuando el catálogo está vacío, que es el caso de
-- aplicar db/schema.sql sobre una base recién creada: ahí todavía no hay nada
-- que repartir y la siembra viene después. Con catálogo sembrado sí se exige,
-- y una clave canónica que falte o quede con el rol equivocado aborta la
-- migración entera con el motivo escrito.
-- ---------------------------------------------------------------------
do $$
declare
  faltan text;
begin
  if not exists (select 1 from catalogo_mobiliario) then
    raise notice 'catalogo_mobiliario vacío: el reparto de roles lo hará la siembra';
    return;
  end if;

  select string_agg(esperado.clave || ' → ' || esperado.rol, ', ')
    into faltan
    from (values ('silla', 'asiento'), ('mesa-principal', 'mesa_principal')) as esperado(clave, rol)
   where not exists (
     select 1 from catalogo_mobiliario c
      where c.clave = esperado.clave and c.rol = esperado.rol
   );

  if faltan is not null then
    raise exception
      'El reparto de roles de mobiliario no ha quedado completo: falta %. Revisa data/mobiliario.csv y catalogo_mobiliario.',
      faltan;
  end if;
end $$;

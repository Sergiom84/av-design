-- Retirada manual sólo de un esquema sintético vacío. No borra historia.
begin;
do $$ declare tabla text; hay_datos boolean; begin
  foreach tabla in array array['tiempo_registros','tiempo_versiones','tiempo_operaciones','coste_tarifa_versiones','coste_labor_versiones','coste_material_apuntes','coste_material_versiones','coste_cortes','coste_operaciones'] loop
    if to_regclass(format('%I.%I',current_schema(),tabla)) is not null then
      execute format('select exists(select 1 from %I.%I)',current_schema(),tabla) into hay_datos;
      if hay_datos then raise exception 'REA05 contiene datos: conservar historial antes de retirar'; end if;
    end if;
  end loop;
end $$;
alter table if exists tiempo_registros drop constraint if exists tiempo_actual_fk;
drop table if exists coste_operaciones;
drop table if exists coste_cortes;
drop table if exists coste_material_versiones;
drop table if exists coste_material_apuntes;
drop table if exists coste_labor_versiones;
drop table if exists coste_tarifa_versiones;
drop table if exists tiempo_operaciones;
drop table if exists tiempo_versiones;
drop table if exists tiempo_registros;
drop function if exists rea05_identidad_tiempo();
drop function if exists rea05_inmutable();
commit;

-- Retirada manual sólo de un esquema sintético vacío. No borra historia.
begin;
do $$ declare tabla text; hay_datos boolean; begin
  foreach tabla in array array['propuestas','propuesta_plantillas','propuesta_revisiones',
    'propuesta_valoraciones','propuesta_archivos','propuesta_operaciones'] loop
    if to_regclass(format('%I.%I',current_schema(),tabla)) is not null then
      execute format('select exists(select 1 from %I.%I)',current_schema(),tabla) into hay_datos;
      if hay_datos then raise exception 'REA06 contiene datos: conservar historial antes de retirar'; end if;
    end if;
  end loop;
end $$;
alter table if exists propuestas drop constraint if exists propuesta_actual_fk;
alter table if exists propuesta_revisiones drop constraint if exists propuesta_pdf_fk;
drop table if exists propuesta_operaciones;
drop table if exists propuesta_valoraciones;
drop table if exists propuesta_archivos;
drop table if exists propuesta_revisiones;
drop table if exists propuesta_plantillas;
drop table if exists propuestas;
drop function if exists propuesta_identidad();
drop function if exists propuesta_inmutable();
commit;

begin;
do $$ begin
 if current_database()<>'av_design_rea08_prueba' or current_user<>'av_design_rea08' then
  raise exception 'Rollback REA08 sólo en av_design_rea08_prueba / av_design_rea08';
 end if;
 if exists(select 1 from servicio_registros) or exists(select 1 from servicio_versiones)
    or exists(select 1 from servicio_operaciones) then
  raise exception 'Se conserva la historia REA08; rollback rechazado';
 end if;
end $$;
alter table servicio_registros drop constraint servicio_actual_fk;
drop table servicio_operaciones;
drop table servicio_sustituciones;
drop table servicio_visitas;
drop table servicio_incidencias;
drop table servicio_acuerdos;
drop table servicio_activos;
drop table servicio_versiones;
drop table servicio_registros;
drop function servicio_identidad_registro();
drop function servicio_inmutable();
commit;

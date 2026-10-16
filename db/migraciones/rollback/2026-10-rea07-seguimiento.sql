begin;
do $$ begin
 if current_database()<>'av_design_rea07_prueba' or current_user<>'av_design_rea07' then
  raise exception 'Rollback REA07 sólo en av_design_rea07_prueba / av_design_rea07';
 end if;
 if exists(select 1 from propuesta_eventos) or exists(select 1 from propuesta_resultado_cortes)
    or exists(select 1 from propuesta_seguimiento_operaciones) or exists(select 1 from propuesta_seguimientos) then
  raise exception 'Se conserva la historia REA07; rollback rechazado';
 end if;
end $$;
drop trigger propuesta_visibilidad_nueva on propuesta_valoraciones;
drop table propuesta_seguimiento_operaciones;
drop table propuesta_resultado_cortes;
drop table propuesta_seguimientos;
drop table propuesta_eventos;
drop table propuesta_revision_visibilidad;
drop function rea07_visibilidad_propuesta();
drop function rea07_identidad_seguimiento();
drop function rea07_inmutable();
commit;

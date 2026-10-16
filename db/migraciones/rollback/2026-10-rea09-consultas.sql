-- Rollback sólo sobre destino sintético nombrado y sin ninguna conversación.
begin;
do $$ begin
  if current_database()<>'av_design_rea09_prueba' or current_user<>'av_design_rea09' then
    raise exception 'Rollback REA09 sólo en av_design_rea09_prueba / av_design_rea09';
  end if;
  if exists(select 1 from consultas_conversaciones) or exists(select 1 from consultas_turnos) then
    raise exception 'Se conserva la historia REA09; rollback rechazado';
  end if;
end $$;
drop table consultas_contenidos;
drop table consultas_turnos;
drop table consultas_conversaciones;
drop function rea09_turno_inmutable();
drop function rea09_identidad_conversacion();
commit;

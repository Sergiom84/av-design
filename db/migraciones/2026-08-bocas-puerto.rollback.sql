do $$ begin
  if exists (select 1 from conexion_bocas) or exists (select 1 from plantilla_conexion_bocas) then
    raise exception 'rollback rechazado: existen bocas fisicas persistidas';
  end if;
end $$;

drop table if exists plantilla_conexion_bocas;
drop table if exists conexion_bocas;
alter table puertos drop constraint if exists puertos_total_positivo;
drop function if exists invalidar_bocas_legacy_conexion();
drop function if exists invalidar_bocas_legacy_plantilla();
drop function if exists proteger_linea_con_bocas();
drop function if exists proteger_equipo_con_bocas();
drop function if exists proteger_puerto_con_bocas();
drop function if exists exigir_pareja_plantilla_conexion_bocas();
drop function if exists exigir_pareja_conexion_bocas();
drop function if exists validar_plantilla_conexion_boca();
drop function if exists validar_conexion_boca();
drop type if exists lado_conexion;

-- Sólo rollback estructural de E3 sin datos históricos. Nunca borra historial.
begin;
do $$ begin
  if current_database() <> 'av_design_e3_prueba' or current_user <> 'av_design_e3' then raise exception 'Rollback E3 sólo en la base de prueba identificada'; end if;
  if exists(select 1 from revisiones_diseno) or exists(select 1 from salas where origen_revision_id is not null)
     or exists(select 1 from anotaciones_sala) or exists(select 1 from conexiones where identificador_cable is not null) then
    raise exception 'Rollback rechazado: E3 tiene revisiones, alternativas, anotaciones o identificadores persistidos';
  end if;
end $$;
-- Esta guarda exige vaciar exclusivamente fixtures de prueba antes de desinstalar.
drop trigger if exists equipo_anotado on sala_equipos;
drop trigger if exists conexion_anotada on conexiones;
drop table if exists anotaciones_sala;
drop function if exists comprobar_ancla_anotacion();
drop function if exists proteger_ancla_anotada();
drop function if exists versionar_anotacion_diseno();
drop trigger if exists e3_revision_inmutable on revisiones_diseno;
alter table salas drop constraint if exists salas_origen_revision_fk;
drop table if exists revisiones_diseno;
drop table if exists correlativos_cable;
drop trigger if exists e3_identificador_cable on conexiones;
drop trigger if exists e3_version_sala on salas;
do $$ declare tabla text; begin
  foreach tabla in array array['sala_equipos','sala_mobiliario','puertas','tomas_red','conexiones','conexion_bocas','conexion_puntos_paso','sala_material_bom'] loop execute format('drop trigger if exists e3_version_hija on %I',tabla); end loop;
end $$;
drop function if exists e3_revision_inmutable();drop function if exists e3_identificador_cable();drop function if exists e3_version_sala();drop function if exists e3_version_hija();
drop index if exists conexiones_identificador_idx;
alter table conexiones drop column if exists identificador_cable;
alter table salas drop column if exists origen_revision_id,drop column if exists origen_sala_id,drop column if exists medidas_heredadas,drop column if exists mapa_ids_origen,drop column if exists diseno_version;
commit;

-- Requiere revisión manual: elimina únicamente el contenido y las tablas REA-03.
-- No ejecutar automáticamente ni sobre datos que deban conservarse.
begin;
drop table if exists informes_archivos;
drop table if exists informes_intentos;
drop table if exists informes_receptores;
drop table if exists informes_ejecuciones;
drop table if exists informes_programaciones;
drop table if exists informes_grupo_miembros;
drop table if exists informes_grupos;
drop table if exists informes_definiciones;
drop table if exists informes_runner_latidos;
drop function if exists guardar_inmutabilidad_informe();
drop function if exists impedir_actualizar_archivo_informe();
commit;

-- Retirada manual sólo en una base sintética identificada; conservar historia real.
begin;
drop table if exists plan_eventos;
drop table if exists plan_asignaciones;
drop table if exists plan_grupo_miembros;
drop table if exists plan_grupos;
drop table if exists plan_tareas;
drop table if exists plan_operaciones;
drop table if exists plan_fuentes;
drop table if exists planes;
drop table if exists reglas_plan;
drop table if exists catalogo_tareas;
drop function if exists plan_registro_inmutable();
drop function if exists plan_identidad_tarea_inmutable();
commit;

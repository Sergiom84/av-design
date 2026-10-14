-- Reversión de estructura para comprobar E2 en una BD sintética vacía de datos E2.
-- No revierte lotes: eso lo hace la aplicación y conserva cambios posteriores.
-- Nunca ejecutar sobre producción ni sobre la base habitual.
begin;
do $$
begin
  if current_database() <> 'av_design_e2_prueba' or current_user <> 'av_design_e2' then
    raise exception 'Rollback limitado a av_design_e2_prueba / av_design_e2';
  end if;
  if exists (select 1 from importacion_lotes) or exists (select 1 from sala_material_bom)
     or exists (select 1 from articulos_tecnicos) or exists (select 1 from articulos_archivos_tecnicos) then
    raise exception 'Hay datos E2: conservar/exportar sus fuentes y usar reversión de lotes antes de retirar estructura';
  end if;
  if exists (select 1 from sala_equipos where dimensiones_tecnicas is not null)
     or exists (select 1 from plantilla_articulos where dimensiones_tecnicas is not null) then
    raise exception 'Hay dimensiones congeladas: no se retiran silenciosamente';
  end if;
  if exists (select 1 from usuarios_articulos_favoritos) then
    raise exception 'Hay favoritos personales: no se retiran silenciosamente';
  end if;
end;
$$;
drop trigger if exists sala_equipos_congelar_dimensiones on sala_equipos;
drop trigger if exists plantilla_articulos_congelar_dimensiones on plantilla_articulos;
drop function if exists congelar_dimensiones_tecnicas();
drop trigger if exists e2_revision_articulos on articulos;
drop trigger if exists e2_revision_precios on precios;
drop trigger if exists e2_revision_proveedores on proveedores;
drop trigger if exists e2_revision_bom on sala_material_bom;
drop function if exists e2_aumentar_revision();
alter table precios drop column if exists lote_id;
alter table precios drop column if exists unidad_compra;
alter table precios drop column if exists revision;
alter table proveedores drop column if exists revision;
drop table if exists importacion_cambios;
drop table if exists sala_material_bom;
drop table if exists importacion_lotes;
drop table if exists articulos_archivos_tecnicos;
drop table if exists articulos_tecnicos;
drop table if exists usuarios_articulos_favoritos;
alter table sala_equipos drop column if exists dimensiones_tecnicas;
alter table plantilla_articulos drop column if exists dimensiones_tecnicas;
alter table articulos drop column if exists revision;
alter table articulos drop column if exists fuente;
commit;

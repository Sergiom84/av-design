-- Sólo QA nueva identificada y sin ninguna fuente/plan/aplicación. Nunca producción.
do $$
begin
  if current_database()<>'av_design_rea10_prueba' or current_user<>'av_design_rea10' then
    raise exception 'Rollback REA10 exclusivo de la base sintética5563';
  end if;
  if exists(select 1 from requisitos_documentos) or exists(select 1 from requisitos_extracciones) or
     exists(select 1 from requisitos_planes) or exists(select 1 from requisitos_aplicaciones) or
     exists(select 1 from requisitos_reversiones) then
    raise exception 'REA10 con historia no se elimina';
  end if;
end $$;
drop table requisitos_reversiones;
drop table requisitos_aplicaciones;
drop table requisitos_planes;
drop table requisitos_extracciones;
drop table requisitos_contenidos;
drop table requisitos_documentos;
drop function rea10_identidad_documento();
drop function if exists rea10_validar_auditoria(jsonb,timestamptz);
drop function rea10_contenido_fuente();
drop function rea10_extraccion_inmutable();
drop function rea10_plan_cas();
drop function rea10_historia_inmutable();
drop function rea10_alta_extraccion();
drop function rea10_consistencia_plan();
drop function rea10_purga_completa();
drop trigger rea10_revision_fuente on articulos_tecnicos;
drop trigger rea10_revision_fuente on articulos_archivos_tecnicos;
drop trigger rea10_revision_fuente on puertos;
drop trigger rea10_revision_fuente on localizaciones;
drop trigger if exists rea10_revision_conjunto_puertos on puertos;
drop function if exists rea10_revision_articulo_por_puerto();
drop function rea10_revision_fuente();
alter table articulos_tecnicos drop column revision_fuente;
alter table articulos_archivos_tecnicos drop column revision_fuente;
alter table puertos drop column revision_fuente;
alter table localizaciones drop column revision_fuente;
drop sequence revision_fuentes_requisitos;

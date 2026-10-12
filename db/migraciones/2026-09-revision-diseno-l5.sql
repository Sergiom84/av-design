-- L5 . Revision de diseno en la evidencia de check-in y check-out.
--
-- salas.diagrama_version es un contador monotono: cada guardado del plano o del
-- diagrama lo sube, y deshacer un cambio lo vuelve a subir. Por eso vale como
-- revision y una huella de contenido no: un cambio deshecho recuperaria la
-- huella antigua y acreditaria por coincidencia un diseno que nadie ha vuelto a
-- probar.
--
-- Nulo significa revision desconocida, no vigente: las pruebas y entregas
-- anteriores a esta migracion no registraron ninguna y no se inventa. El check
-- de la prueba ata revision y fecha: reabrir la prueba borra las dos.
begin;
-- BEGIN REVISION DISENO L5
alter table prueba_final_sala add column if not exists revision_diseno integer;
alter table prueba_final_sala drop constraint if exists prueba_final_revision_valida;
alter table prueba_final_sala add constraint prueba_final_revision_valida
  check (revision_diseno is null or (revision_diseno >= 0 and fecha is not null));
alter table hitos_sala add column if not exists revision_diseno integer;
alter table hitos_sala drop constraint if exists hitos_sala_revision_valida;
alter table hitos_sala add constraint hitos_sala_revision_valida
  check (revision_diseno is null or revision_diseno >= 0);
comment on column prueba_final_sala.revision_diseno is
  'salas.diagrama_version al finalizar la prueba. Nulo = revision desconocida, nunca vigente.';
comment on column hitos_sala.revision_diseno is
  'salas.diagrama_version al registrar el hito. Nulo = revision desconocida, nunca vigente.';
-- END REVISION DISENO L5
commit;

-- Auditoría mínima de retirada/purga. Las filas previas conservan null: no se inventan motivos.
alter table requisitos_documentos add column if not exists retirada jsonb
  check(retirada is null or (jsonb_typeof(retirada)='object' and octet_length(retirada::text)<=12288));
alter table requisitos_documentos add column if not exists purga jsonb
  check(purga is null or (jsonb_typeof(purga)='object' and octet_length(purga::text)<=12288));

create or replace function rea10_validar_auditoria(auditoria jsonb, fecha_registro timestamptz)
returns void language plpgsql as $$
declare clave text;
begin
  if auditoria is null or jsonb_typeof(auditoria)<>'object' or
     auditoria-array['motivo','autorId','fecha','diff']<>'{}'::jsonb or
     jsonb_typeof(auditoria->'motivo') is distinct from 'string' or
     length(btrim(auditoria->>'motivo')) not between 1 and 2000 or
     jsonb_typeof(auditoria->'autorId') is distinct from 'string' or
     (auditoria->>'autorId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
     jsonb_typeof(auditoria->'fecha') is distinct from 'string' or
     jsonb_typeof(auditoria->'diff') is distinct from 'object' or
     (auditoria->'diff')-array['bytes','extracciones','planes']<>'{}'::jsonb then
    raise exception 'La auditoría conserva sólo motivo, autor, fecha y cantidades retiradas';
  end if;
  foreach clave in array array['bytes','extracciones','planes'] loop
    if jsonb_typeof(auditoria->'diff'->clave) is distinct from 'number' or
       (auditoria->'diff'->>clave) !~ '^(0|[1-9][0-9]*)$' then
      raise exception 'El diff de retirada conserva cantidades enteras no negativas';
    end if;
  end loop;
  if fecha_registro is null or (auditoria->>'fecha')::timestamptz<>fecha_registro then
    raise exception 'La auditoría conserva la fecha exacta de su operación';
  end if;
end $$;

create or replace function rea10_identidad_documento() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'La fuente conserva tombstone e historia'; end if;
  if (to_jsonb(new)-array['version','estado','retirado_en','purgado_en','retirada','purga']) is distinct from
     (to_jsonb(old)-array['version','estado','retirado_en','purgado_en','retirada','purga']) then
    raise exception 'La identidad y procedencia de la fuente son inmutables';
  end if;
  if new.version<>old.version+1 then raise exception 'La fuente avanza una versión por operación'; end if;
  if old.estado='purgado' or (old.estado='retirado' and new.estado='activo') then
    raise exception 'La fuente retirada no se reactiva implícitamente';
  end if;
  if old.retirado_en is not null and new.retirado_en is distinct from old.retirado_en then
    raise exception 'La retirada original se conserva';
  end if;
  if old.retirada is not null and new.retirada is distinct from old.retirada then
    raise exception 'La auditoría de retirada no se sobrescribe';
  end if;
  if new.retirada is distinct from old.retirada and
     (old.estado<>'activo' or new.estado not in ('retirado','purgado')) then
    raise exception 'La auditoría de retirada se registra con la transición';
  end if;
  if old.estado='activo' and new.estado in ('retirado','purgado') then
    perform rea10_validar_auditoria(new.retirada,new.retirado_en);
  end if;
  if new.purga is distinct from old.purga and
     (old.estado='purgado' or new.estado<>'purgado') then
    raise exception 'La auditoría de purga se registra con la transición';
  end if;
  if new.estado='purgado' then
    perform rea10_validar_auditoria(new.purga,new.purgado_en);
  end if;
  return new;
end $$;

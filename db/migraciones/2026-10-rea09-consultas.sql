-- REA09: historial propio y fuentes; SQL aditivo, sin datos de negocio.
create table if not exists consultas_conversaciones (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  ambito jsonb not null check (jsonb_typeof(ambito)='object'),
  version integer not null default 0 check (version>=0),
  retencion_dias integer not null default 30 check (retencion_dias in (7,30,90)),
  creado_en timestamptz not null default now(),
  caduca_en timestamptz not null,
  unique(id,propietario_id),
  check(caduca_en=creado_en+retencion_dias*interval '1 day')
);
create table if not exists consultas_turnos (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null, propietario_id uuid not null,
  numero integer not null check(numero between 1 and 100),
  clave_peticion uuid not null, entrada_sha256 text not null,
  version_modelo integer not null default 1 check(version_modelo=1),
  intent text not null, motor text not null check(motor='local-1'),
  acl_fuentes jsonb not null check(jsonb_typeof(acl_fuentes)='object'),
  observado_en timestamptz not null, captura_sha256 text not null,
  creado_en timestamptz not null default now(),
  foreign key(conversacion_id,propietario_id)
    references consultas_conversaciones(id,propietario_id) on delete cascade,
  unique(conversacion_id,numero), unique(propietario_id,clave_peticion),
  check(entrada_sha256~'^[a-f0-9]{64}$' and captura_sha256~'^[a-f0-9]{64}$')
);
create table if not exists consultas_contenidos (
  turno_id uuid primary key references consultas_turnos(id) on delete cascade,
  pregunta text not null check(char_length(pregunta) between 1 and 2000),
  respuesta jsonb not null check(jsonb_typeof(respuesta)='object'),
  check(octet_length(pregunta)+octet_length(respuesta::text)<=262144)
);
create index if not exists consultas_propias on consultas_conversaciones(propietario_id,creado_en,id);
create index if not exists consultas_caducadas on consultas_conversaciones(caduca_en,id);

create or replace function rea09_turno_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El turno de consulta observado no se sobrescribe';
end $$;
drop trigger if exists consulta_turno_inmutable on consultas_turnos;
create trigger consulta_turno_inmutable before update on consultas_turnos
  for each row execute function rea09_turno_inmutable();
drop trigger if exists consulta_contenido_inmutable on consultas_contenidos;
create trigger consulta_contenido_inmutable before update on consultas_contenidos
  for each row execute function rea09_turno_inmutable();

create or replace function rea09_identidad_conversacion() returns trigger
language plpgsql as $$ begin
  if (to_jsonb(new)-array['version','retencion_dias','caduca_en']) is distinct from
     (to_jsonb(old)-array['version','retencion_dias','caduca_en']) then
    raise exception 'La conversación conserva propietario, ámbito y creación';
  end if;
  if new.version<>old.version+1 then
    raise exception 'La conversación avanza una versión por operación';
  end if;
  return new;
end $$;
drop trigger if exists consulta_identidad on consultas_conversaciones;
create trigger consulta_identidad before update on consultas_conversaciones
  for each row execute function rea09_identidad_conversacion();

-- REA-03: informes internos durables. Aplicación manual; sin datos operativos.
create table if not exists informes_definiciones (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  version integer not null default 0 check (version >= 0),
  configuracion jsonb not null check (jsonb_typeof(configuracion) = 'object'),
  archivada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists informes_def_propietario_idx
  on informes_definiciones(propietario_id, creado_en desc, id);

create table if not exists informes_grupos (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  ambito jsonb not null check (jsonb_typeof(ambito) = 'object'),
  version integer not null default 0 check (version >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists informes_grupo_miembros (
  grupo_id uuid not null references informes_grupos(id) on delete restrict,
  usuario_id uuid not null references usuarios(id) on delete restrict,
  primary key(grupo_id, usuario_id)
);

create table if not exists informes_programaciones (
  id uuid primary key default gen_random_uuid(),
  definicion_id uuid not null references informes_definiciones(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  calendario jsonb not null check (jsonb_typeof(calendario) = 'object'),
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  activa boolean not null default true,
  proxima_utc timestamptz,
  ultima_omision jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists informes_prog_vencida_idx
  on informes_programaciones(proxima_utc, id) where activa;

create table if not exists informes_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  definicion_id uuid not null references informes_definiciones(id) on delete restrict,
  propietario_id uuid not null references usuarios(id) on delete restrict,
  programacion_id uuid references informes_programaciones(id) on delete restrict,
  clave_peticion uuid,
  ocurrencia_utc timestamptz not null,
  definicion_snapshot jsonb not null check (jsonb_typeof(definicion_snapshot) = 'object'),
  definicion_sha256 text not null check (definicion_sha256 ~ '^[0-9a-f]{64}$'),
  periodo_resuelto jsonb not null check (jsonb_typeof(periodo_resuelto) = 'object'),
  snapshot jsonb check (jsonb_typeof(snapshot) = 'object'),
  snapshot_sha256 text check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  observado_en timestamptz,
  snapshot_expurgado_en timestamptz,
  estado text not null default 'pendiente' check
    (estado in ('pendiente','en_curso','correcta','fallida','bloqueada','cancelada','caducada')),
  reintentar_desde timestamptz,
  intento_actual integer not null default 0 check (intento_actual between 0 and 3),
  lease_token uuid,
  lease_hasta timestamptz,
  error_codigo text,
  error_mensaje text,
  manifiesto jsonb check (jsonb_typeof(manifiesto) = 'object'),
  entrega_externa text not null default 'no_configurada' check (entrega_externa = 'no_configurada'),
  revocada_en timestamptz,
  terminado_en timestamptz,
  caduca_en timestamptz,
  creado_en timestamptz not null default now(),
  check ((programacion_id is null) = (clave_peticion is not null)),
  check (snapshot is null or snapshot_sha256 is not null),
  check ((snapshot_sha256 is null) = (observado_en is null)),
  check (snapshot_expurgado_en is null or
    (estado = 'caducada' and snapshot is null and snapshot_sha256 is not null)),
  check ((lease_token is null) = (lease_hasta is null)),
  check (estado <> 'correcta' or
    (snapshot is not null and manifiesto is not null and terminado_en is not null and caduca_en is not null)),
  unique(programacion_id, ocurrencia_utc)
);
create unique index if not exists informes_ejec_manual_unica_idx
  on informes_ejecuciones(propietario_id, clave_peticion) where clave_peticion is not null;
create index if not exists informes_ejec_cola_idx
  on informes_ejecuciones(estado, reintentar_desde, creado_en, id);
create index if not exists informes_ejec_ultimo_correcto_idx
  on informes_ejecuciones(definicion_id, ocurrencia_utc desc, id desc) where estado = 'correcta';

create table if not exists informes_receptores (
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  usuario_id uuid not null references usuarios(id) on delete restrict,
  -- Origen directo/propietario/grupos y versiones: conjunto congelado, sin permisos cacheados.
  origenes jsonb not null check (jsonb_typeof(origenes) = 'array'),
  excluido_codigo text,
  revocado_en timestamptz,
  primary key(ejecucion_id, usuario_id)
);
create index if not exists informes_rec_usuario_idx on informes_receptores(usuario_id, ejecucion_id);

create table if not exists informes_intentos (
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  numero integer not null check (numero between 1 and 3),
  token uuid not null unique,
  estado text not null check (estado in ('en_curso','correcta','fallida','interrumpida','bloqueada')),
  iniciado_en timestamptz not null default now(),
  latido_en timestamptz not null default now(),
  terminado_en timestamptz,
  error_codigo text,
  error_mensaje text,
  primary key(ejecucion_id, numero)
);
create unique index if not exists informes_intento_vivo_idx
  on informes_intentos(ejecucion_id) where estado = 'en_curso';

create table if not exists informes_archivos (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  formato text not null check (formato in ('pdf','xlsx','csv')),
  nombre text not null check (nombre ~ '^informe-[0-9a-f-]+[.](pdf|xlsx|csv)$'),
  mime text not null,
  contenido bytea not null check (octet_length(contenido) between 1 and 26214400),
  bytes integer generated always as (octet_length(contenido)) stored,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  creado_en timestamptz not null default now(),
  unique(ejecucion_id, formato),
  check (encode(digest(contenido, 'sha256'), 'hex') = sha256)
);

create table if not exists informes_runner_latidos (
  id uuid primary key,
  modo text not null check (modo in ('manual','continuo')),
  version text not null,
  iniciado_en timestamptz not null default now(),
  latido_en timestamptz not null default now(),
  detenido_en timestamptz
);

-- Rechazar la reescritura de identidad/definición y de una captura ya persistida.
create or replace function guardar_inmutabilidad_informe() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.definicion_id,new.propietario_id,new.programacion_id,
         new.clave_peticion,new.ocurrencia_utc,new.definicion_snapshot,
         new.definicion_sha256,new.periodo_resuelto,new.creado_en)
     is distinct from
     row(old.id,old.definicion_id,old.propietario_id,old.programacion_id,
         old.clave_peticion,old.ocurrencia_utc,old.definicion_snapshot,
         old.definicion_sha256,old.periodo_resuelto,old.creado_en) then
    raise exception 'La definicion de una ejecucion es inmutable';
  end if;
  if old.snapshot_sha256 is not null then
    if new.caduca_en is distinct from old.caduca_en then
      raise exception 'La retencion de una captura no se prolonga';
    end if;
    if row(new.snapshot_sha256,new.observado_en)
       is distinct from row(old.snapshot_sha256,old.observado_en) then
      raise exception 'La identidad de una captura es inmutable';
    end if;
    if new.snapshot is distinct from old.snapshot or
       new.snapshot_expurgado_en is distinct from old.snapshot_expurgado_en then
      -- Excepcion unica: expurgar contenido vencido, conservando identidad y auditoria.
      if not (old.snapshot is not null and new.snapshot is null and
        old.snapshot_expurgado_en is null and new.snapshot_expurgado_en is not null and
        new.estado = 'caducada' and old.caduca_en is not null and
        old.caduca_en <= now()) then
        raise exception 'La captura de una ejecucion es inmutable';
      end if;
    end if;
  end if;
  if old.manifiesto is not null and
     row(new.manifiesto,new.terminado_en) is distinct from
     row(old.manifiesto,old.terminado_en) then
    raise exception 'Un resultado correcto no se sobrescribe';
  end if;
  return new;
end $$;
drop trigger if exists informes_ejec_inmutable on informes_ejecuciones;
create trigger informes_ejec_inmutable before update on informes_ejecuciones
  for each row execute function guardar_inmutabilidad_informe();

create or replace function impedir_actualizar_archivo_informe() returns trigger
language plpgsql as $$ begin
  raise exception 'Un archivo de informe no se sobrescribe';
end $$;
drop trigger if exists informes_arch_inmutable on informes_archivos;
create trigger informes_arch_inmutable before update on informes_archivos
  for each row execute function impedir_actualizar_archivo_informe();

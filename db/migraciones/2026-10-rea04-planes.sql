-- REA-04: planes y agenda. Aplicación manual; sin hechos físicos.
create table if not exists catalogo_tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (length(descripcion) <= 2000),
  duracion_estimada_min integer check (duracion_estimada_min between 1 and 43200),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists reglas_plan (
  id uuid primary key default gen_random_uuid(),
  trabajo_id uuid not null references catalogo_tareas(id) on delete restrict,
  selector jsonb not null check (jsonb_typeof(selector) = 'object'),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists planes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null unique references proyectos(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  notas text not null default '' check (length(notas) <= 2000),
  archivado_en timestamptz,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists plan_fuentes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo = 1),
  generador text not null default 'rea04-1' check (generador = 'rea04-1'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  -- Proyecciones separadas: no seleccionar la privada sin catálogo autorizado.
  publico jsonb not null check (jsonb_typeof(publico) = 'object'),
  catalogo jsonb not null default '{}' check (jsonb_typeof(catalogo) = 'object'),
  revisiones_e3 jsonb not null default '[]' check (jsonb_typeof(revisiones_e3) = 'array'),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  unique(plan_id, sha256)
);
create table if not exists plan_operaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in
    ('crear_plan','editar_plan','confirmar_fuente','crear_tarea','editar_tarea',
     'estado_tarea','asignar','restaurar_tarea','grupo','archivar_plan','reactivar_plan')),
  version_antes integer not null check (version_antes >= 0),
  version_despues integer not null check (version_despues >= version_antes),
  fuente_id uuid references plan_fuentes(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  motivo text check (length(motivo) between 1 and 2000),
  resumen jsonb not null check (jsonb_typeof(resumen) = 'object'),
  creado_en timestamptz not null default now(),
  unique(plan_id, clave_peticion)
);
create table if not exists plan_tareas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  trabajo_id uuid references catalogo_tareas(id) on delete restrict,
  regla_id uuid references reglas_plan(id) on delete restrict,
  clave_origen text check (clave_origen ~ '^[0-9a-f]{64}$'),
  fuente_id uuid references plan_fuentes(id) on delete restrict,
  origen_publico jsonb not null default '{}' check (jsonb_typeof(origen_publico) = 'object'),
  origen_catalogo jsonb not null default '{}' check (jsonb_typeof(origen_catalogo) = 'object'),
  base_generada jsonb check (jsonb_typeof(base_generada) = 'object'),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (length(descripcion) <= 2000),
  notas text not null default '' check (length(notas) <= 2000),
  duracion_estimada_min integer check (duracion_estimada_min between 1 and 43200),
  estado text not null default 'borrador' check
    (estado in ('borrador','pendiente','en_curso','hecha','anulada')),
  vence_fecha date,
  inicio_utc timestamptz,
  fin_utc timestamptz,
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check ((inicio_utc is null) = (fin_utc is null)),
  check (fin_utc is null or
    (fin_utc > inicio_utc and fin_utc - inicio_utc <= interval '7 days')),
  check ((clave_origen is null and regla_id is null and fuente_id is null) or
    (clave_origen is not null and regla_id is not null and fuente_id is not null and sala_id is not null)),
  unique(plan_id, clave_origen)
);
create index if not exists plan_tareas_obra_estado_idx on plan_tareas(plan_id, estado, id);
create index if not exists plan_tareas_vencimiento_idx on plan_tareas(vence_fecha, id);
create index if not exists plan_tareas_intervalo_idx on plan_tareas(inicio_utc, fin_utc);

create table if not exists plan_grupos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists plan_grupo_miembros (
  grupo_id uuid not null references plan_grupos(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  primary key(grupo_id, tecnico_id)
);
create table if not exists plan_asignaciones (
  tarea_id uuid not null references plan_tareas(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  activo boolean not null default true,
  origen_grupos jsonb not null default '[]' check (jsonb_typeof(origen_grupos) = 'array'),
  asignado_por uuid not null references usuarios(id) on delete restrict,
  actualizado_en timestamptz not null default now(),
  primary key(tarea_id, tecnico_id)
);
create index if not exists plan_asignaciones_tecnico_idx
  on plan_asignaciones(tecnico_id, tarea_id) where activo;

create table if not exists plan_eventos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  operacion_id uuid not null references plan_operaciones(id) on delete restrict,
  version_plan integer not null check (version_plan >= 0),
  orden integer not null check (orden >= 0),
  tipo text not null,
  autor_id uuid not null references usuarios(id) on delete restrict,
  antecedente_id uuid references plan_eventos(id) on delete restrict,
  motivo text check (length(motivo) between 1 and 2000),
  antes jsonb,
  despues jsonb,
  -- Detalle privado de procedencia nunca se devuelve por una lectura operativa.
  catalogo jsonb not null default '{}' check (jsonb_typeof(catalogo) = 'object'),
  creado_en timestamptz not null default now(),
  unique(plan_id, version_plan, orden)
);
create index if not exists plan_eventos_tarea_idx
  on plan_eventos(tarea_id, creado_en desc, id);

create or replace function plan_registro_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El historial y la fuente de un plan son inmutables';
end $$;
drop trigger if exists plan_fuente_inmutable on plan_fuentes;
create trigger plan_fuente_inmutable before update or delete on plan_fuentes
  for each row execute function plan_registro_inmutable();
drop trigger if exists plan_operacion_inmutable on plan_operaciones;
create trigger plan_operacion_inmutable before update or delete on plan_operaciones
  for each row execute function plan_registro_inmutable();
drop trigger if exists plan_evento_inmutable on plan_eventos;
create trigger plan_evento_inmutable before update or delete on plan_eventos
  for each row execute function plan_registro_inmutable();

create or replace function plan_identidad_tarea_inmutable() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.plan_id,new.sala_id,new.regla_id,new.clave_origen,
         new.creado_por,new.creado_en) is distinct from
     row(old.id,old.plan_id,old.sala_id,old.regla_id,old.clave_origen,
         old.creado_por,old.creado_en) then
    raise exception 'La identidad y el ambito de una tarea no se trasladan';
  end if;
  return new;
end $$;
drop trigger if exists plan_tarea_identidad on plan_tareas;
create trigger plan_tarea_identidad before update on plan_tareas
  for each row execute function plan_identidad_tarea_inmutable();

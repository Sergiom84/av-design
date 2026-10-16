-- REA08: activos y servicio; sin hechos físicos ni condiciones implícitas.
create table if not exists servicio_registros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('activo','acuerdo','incidencia','visita')),
  sala_id uuid not null references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  numero_actual integer not null default 1 check (numero_actual>0),
  actual_id uuid not null,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(id,tipo)
);
create table if not exists servicio_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references servicio_registros(id) on delete restrict,
  numero integer not null check (numero>0),
  antecedente_id uuid unique,
  accion text not null check (length(btrim(accion)) between 1 and 80),
  version_modelo integer not null default 1 check (version_modelo=1),
  sala_id uuid not null references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  revision_diseno_id uuid references revisiones_diseno(id) on delete restrict,
  hito_entrega_id uuid, -- informativo: deliberadamente SIN FK a hitos_sala
  entrega_snapshot jsonb check (jsonb_typeof(entrega_snapshot)='object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  check ((numero=1) = (antecedente_id is null)),
  check ((hito_entrega_id is null) = (entrega_snapshot is null)),
  unique(registro_id,numero), unique(registro_id,id),
  foreign key(registro_id,antecedente_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='servicio_actual_fk'
    and conrelid='servicio_registros'::regclass) then
    alter table servicio_registros add constraint servicio_actual_fk
      foreign key(id,actual_id) references servicio_versiones(registro_id,id)
      deferrable initially deferred;
  end if;
end $$;
create table if not exists servicio_activos (
  id uuid primary key,
  tipo text not null default 'activo' check (tipo='activo'),
  sala_origen_id uuid not null references salas(id) on delete restrict,
  origen_tipo text not null check (origen_tipo in ('equipo','manual','sustitucion')),
  equipo_origen_id uuid, -- identidad de fuente, SIN FK al diseño mutable
  ordinal integer check (ordinal between 1 and 10000),
  clave_origen text not null unique,
  fuente jsonb not null check (jsonb_typeof(fuente)='object'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict,
  check ((origen_tipo='equipo' and equipo_origen_id is not null and ordinal is not null)
    or (origen_tipo<>'equipo' and equipo_origen_id is null and ordinal is null))
);
create unique index if not exists servicio_activo_unidad_origen_idx
  on servicio_activos(sala_origen_id,equipo_origen_id,ordinal)
  where origen_tipo='equipo';
create table if not exists servicio_acuerdos (
  id uuid primary key,
  tipo text not null default 'acuerdo' check (tipo='acuerdo'),
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict
);
create table if not exists servicio_incidencias (
  id uuid primary key,
  tipo text not null default 'incidencia' check (tipo='incidencia'),
  activo_id uuid not null references servicio_activos(id) on delete restrict,
  activo_version_id uuid not null,
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict,
  foreign key(activo_id,activo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
create table if not exists servicio_visitas (
  id uuid primary key,
  tipo text not null default 'visita' check (tipo='visita'),
  incidencia_id uuid not null references servicio_incidencias(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict
);
create table if not exists servicio_sustituciones (
  id uuid primary key default gen_random_uuid(),
  antiguo_id uuid not null references servicio_activos(id) on delete restrict,
  antiguo_version_id uuid not null,
  nuevo_id uuid not null references servicio_activos(id) on delete restrict,
  nuevo_version_id uuid not null,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  evidencia jsonb not null check (jsonb_typeof(evidencia)='object'),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check (antiguo_id<>nuevo_id), unique(antiguo_id,antiguo_version_id),
  foreign key(antiguo_id,antiguo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict,
  foreign key(nuevo_id,nuevo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
create table if not exists servicio_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in ('materializar','activo','acuerdo','incidencia','visita','sustituir')),
  resultado jsonb not null check (jsonb_typeof(resultado)='object'),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);
create index if not exists servicio_contexto_idx
  on servicio_registros(sala_id,tipo,id);
create index if not exists servicio_obra_idx
  on servicio_registros(proyecto_id,tipo,id);
create index if not exists servicio_historia_idx
  on servicio_versiones(registro_id,numero desc);
create or replace function servicio_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'La historia de servicio no se sobrescribe';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['servicio_versiones','servicio_activos',
    'servicio_acuerdos','servicio_incidencias','servicio_visitas',
    'servicio_sustituciones','servicio_operaciones'] loop
    execute format('drop trigger if exists servicio_inmutable on %I',tabla);
    execute format('create trigger servicio_inmutable before update or delete on %I '
      'for each row execute function servicio_inmutable()',tabla);
  end loop;
end $$;

create or replace function servicio_identidad_registro() returns trigger
language plpgsql as $$ declare v record; begin
  if tg_op='DELETE' then
    raise exception 'El registro de servicio con historia no se borra';
  end if;
  if (to_jsonb(new)-array['numero_actual','actual_id','sala_id','proyecto_id']) is distinct from
     (to_jsonb(old)-array['numero_actual','actual_id','sala_id','proyecto_id']) or
     new.numero_actual<>old.numero_actual+1 then
    raise exception 'La identidad de servicio se conserva y avanza una version';
  end if;
  select numero,sala_id,proyecto_id,accion into v from servicio_versiones
    where registro_id=new.id and id=new.actual_id;
  if not found then
    raise exception 'La version de servicio debe pertenecer al registro';
  end if;
  if v.numero<>new.numero_actual or row(v.sala_id,v.proyecto_id) is distinct from
     row(new.sala_id,new.proyecto_id) then
    raise exception 'El contexto de servicio debe coincidir con su version';
  end if;
  if row(new.sala_id,new.proyecto_id) is distinct from row(old.sala_id,old.proyecto_id) and
     (old.tipo<>'activo' or v.accion not in ('trasladar','reconciliar_contexto')) then
    raise exception 'Solo un traslado o conciliacion de activo cambia su contexto';
  end if;
  return new;
end $$;
drop trigger if exists servicio_identidad on servicio_registros;
create trigger servicio_identidad before update or delete on servicio_registros
  for each row execute function servicio_identidad_registro();

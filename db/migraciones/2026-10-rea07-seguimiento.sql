-- REA07: seguimiento interno, sin transporte ni hechos físicos.
create table if not exists propuesta_seguimientos (
  revision_id uuid primary key references propuesta_revisiones(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  ultimo_evento_id uuid,
  check ((version=0) = (ultimo_evento_id is null))
);
create table if not exists propuesta_eventos (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null,
  revision_id uuid not null,
  revision_sha256 text not null check (revision_sha256 ~ '^[0-9a-f]{64}$'),
  numero integer not null check (numero > 0),
  antecedente_id uuid unique,
  tipo text not null check (tipo in ('emitir','aceptar','rechazar','revocar_decision')),
  decision_revocada_id uuid,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  referencia text not null check (length(btrim(referencia)) between 1 and 1000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null check (length(btrim(autor_nombre)) between 1 and 200),
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  unique(revision_id,numero), unique(revision_id,id),
  foreign key(revision_id,antecedente_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  foreign key(revision_id,decision_revocada_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  check ((numero=1) = (antecedente_id is null)),
  check ((tipo='revocar_decision') = (decision_revocada_id is not null))
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='propuesta_seguimiento_actual_fk'
    and conrelid='propuesta_seguimientos'::regclass) then
    alter table propuesta_seguimientos add constraint propuesta_seguimiento_actual_fk
      foreign key(revision_id,ultimo_evento_id)
      references propuesta_eventos(revision_id,id) deferrable initially deferred;
  end if;
end $$;
create index if not exists propuesta_eventos_historia_idx
  on propuesta_eventos(propuesta_id,revision_id,numero);
create index if not exists propuesta_eventos_fecha_idx
  on propuesta_eventos(creado_en,id);

create table if not exists propuesta_resultado_cortes (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references propuesta_resultado_cortes(id) on delete restrict,
  propuesta_id uuid not null,
  revision_id uuid not null,
  aceptacion_id uuid not null,
  coste_corte_id uuid not null references coste_cortes(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo=1),
  alcance jsonb not null check (jsonb_typeof(alcance)='object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('sin_datos','parcial','comparable_registrado')),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  foreign key(revision_id,aceptacion_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  check ((numero=1) = (antecedente_id is null)),
  unique(serie_id,numero)
);
create table if not exists propuesta_seguimiento_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  propuesta_id uuid not null,
  revision_id uuid not null,
  tipo text not null check (tipo in ('evento','resultado')),
  evento_id uuid references propuesta_eventos(id) on delete restrict,
  resultado_id uuid references propuesta_resultado_cortes(id) on delete restrict,
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  check ((tipo='evento' and evento_id is not null and resultado_id is null) or
    (tipo='resultado' and resultado_id is not null and evento_id is null)),
  unique(autor_id,clave_peticion)
);
create index if not exists propuesta_resultados_historia_idx
  on propuesta_resultado_cortes(propuesta_id,revision_id,creado_en,id);

create or replace function rea07_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El historial REA07 no se sobrescribe';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['propuesta_eventos','propuesta_resultado_cortes',
    'propuesta_seguimiento_operaciones'] loop
    execute format('drop trigger if exists rea07_inmutable on %I',tabla);
    execute format('create trigger rea07_inmutable before update or delete on %I '
      'for each row execute function rea07_inmutable()',tabla);
  end loop;
end $$;

create or replace function rea07_identidad_seguimiento() returns trigger
language plpgsql as $$ declare n integer; begin
  if tg_op='DELETE' then
    raise exception 'El seguimiento con historia no se borra';
  end if;
  if new.revision_id is distinct from old.revision_id or new.version<>old.version+1 then
    raise exception 'El seguimiento avanza una version sin cambiar su revision';
  end if;
  select numero into n from propuesta_eventos
    where revision_id=new.revision_id and id=new.ultimo_evento_id;
  if n is null or n<>new.version then
    raise exception 'El ultimo evento debe pertenecer a esta revision y version';
  end if;
  return new;
end $$;
drop trigger if exists propuesta_seguimiento_identidad on propuesta_seguimientos;
create trigger propuesta_seguimiento_identidad before update or delete on propuesta_seguimientos
  for each row execute function rea07_identidad_seguimiento();


-- Proyección física mínima para ACL técnica, sin leer valoraciones al consultar07.
create table if not exists propuesta_revision_visibilidad (
 revision_id uuid primary key references propuesta_revisiones(id) on delete restrict,
 requiere_catalogo boolean not null
);
create or replace function rea07_visibilidad_propuesta() returns trigger
language plpgsql as $$ begin
 if jsonb_typeof(new.snapshot->'lineas') is distinct from 'array' then
  raise exception 'La valoración necesita líneas válidas para derivar su acceso';
 end if;
 insert into propuesta_revision_visibilidad(revision_id,requiere_catalogo)
 values(new.revision_id,exists(select 1 from jsonb_array_elements(new.snapshot->'lineas') l
   where l->'origenCoste'->>'tipo'='catalogo'));
 return new;
end $$;
drop trigger if exists propuesta_visibilidad_nueva on propuesta_valoraciones;
create trigger propuesta_visibilidad_nueva after insert on propuesta_valoraciones
 for each row execute function rea07_visibilidad_propuesta();
insert into propuesta_revision_visibilidad(revision_id,requiere_catalogo)
 select v.revision_id,exists(select 1 from jsonb_array_elements(v.snapshot->'lineas') l
   where l->'origenCoste'->>'tipo'='catalogo')
 from propuesta_valoraciones v on conflict(revision_id) do nothing;
drop trigger if exists rea07_inmutable on propuesta_revision_visibilidad;
create trigger rea07_inmutable before update or delete on propuesta_revision_visibilidad
 for each row execute function rea07_inmutable();

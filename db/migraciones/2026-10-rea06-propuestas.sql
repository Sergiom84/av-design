-- REA-06: propuestas internas versionadas. Aplicación manual.
create table if not exists propuestas (
  id uuid primary key default gen_random_uuid(),
  ambito text not null check (ambito in ('sala','obra')),
  sala_id uuid references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  actual_revision_id uuid,
  contiene_valoracion boolean not null default false,
  archivada_en timestamptz,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check ((ambito='sala' and sala_id is not null and proyecto_id is null) or
    (ambito='obra' and proyecto_id is not null and sala_id is null)),
  check ((version=0) = (actual_revision_id is null))
);
create table if not exists propuesta_plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 160),
  version integer not null default 0 check (version >= 0),
  secciones jsonb not null check (jsonb_typeof(secciones)='array'),
  activo boolean not null default true,
  autor_id uuid not null references usuarios(id) on delete restrict,
  actualizado_en timestamptz not null default now()
);
create table if not exists propuesta_revisiones (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null references propuestas(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid references propuesta_revisiones(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo=1),
  generador text not null default 'rea06-1' check (generador='rea06-1'),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  tecnico jsonb not null check (jsonb_typeof(tecnico)='object'),
  fuente jsonb not null check (jsonb_typeof(fuente)='object'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  tecnico_sha256 text not null check (tecnico_sha256 ~ '^[0-9a-f]{64}$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  contiene_valoracion boolean not null,
  pdf_id uuid not null,
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  unique(propuesta_id,numero), unique(propuesta_id,id), unique(id,pdf_id)
);
create table if not exists propuesta_valoraciones (
  revision_id uuid primary key references propuesta_revisiones(id) on delete restrict,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  totales jsonb not null check (jsonb_typeof(totales)='object'),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$')
);
create table if not exists propuesta_archivos (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null unique references propuesta_revisiones(id) on delete restrict,
  nombre text not null check (nombre ~ '^propuesta-[0-9a-f-]+[.]pdf$'),
  mime text not null default 'application/pdf' check (mime='application/pdf'),
  contenido bytea not null check (octet_length(contenido) between 1 and 20971520),
  bytes integer generated always as (octet_length(contenido)) stored,
  paginas integer not null check (paginas between 1 and 100),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  check (encode(digest(contenido,'sha256'),'hex')=sha256),
  unique(revision_id,id)
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='propuesta_actual_fk'
    and conrelid='propuestas'::regclass) then
    alter table propuestas add constraint propuesta_actual_fk
      foreign key(id,actual_revision_id) references propuesta_revisiones(propuesta_id,id)
      deferrable initially deferred;
  end if;
  if not exists(select 1 from pg_constraint where conname='propuesta_pdf_fk'
    and conrelid='propuesta_revisiones'::regclass) then
    alter table propuesta_revisiones add constraint propuesta_pdf_fk
      foreign key(id,pdf_id) references propuesta_archivos(revision_id,id)
      deferrable initially deferred;
  end if;
end $$;
create table if not exists propuesta_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  propuesta_id uuid not null references propuestas(id) on delete restrict,
  revision_id uuid not null references propuesta_revisiones(id) on delete restrict,
  tipo text not null check (tipo in ('revision','archivar','reactivar')),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);
create index if not exists propuestas_contexto_sala_idx on propuestas(sala_id,id);
create index if not exists propuestas_contexto_obra_idx on propuestas(proyecto_id,id);
create index if not exists propuesta_revisiones_historia_idx
  on propuesta_revisiones(propuesta_id,numero desc);

create or replace function propuesta_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'Una revision y su PDF no se sobrescriben';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['propuesta_revisiones','propuesta_valoraciones',
    'propuesta_archivos','propuesta_operaciones'] loop
    execute format('drop trigger if exists propuesta_inmutable on %I',tabla);
    execute format('create trigger propuesta_inmutable before update or delete on %I '
      'for each row execute function propuesta_inmutable()',tabla);
  end loop;
end $$;
create or replace function propuesta_identidad() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.ambito,new.sala_id,new.proyecto_id,new.creado_por,new.creado_en)
     is distinct from
     row(old.id,old.ambito,old.sala_id,old.proyecto_id,old.creado_por,old.creado_en) then
    raise exception 'Una propuesta no cambia de ambito';
  end if;
  return new;
end $$;
drop trigger if exists propuesta_identidad on propuestas;
create trigger propuesta_identidad before update on propuestas
  for each row execute function propuesta_identidad();

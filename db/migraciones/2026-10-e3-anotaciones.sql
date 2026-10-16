-- E3: notas de presentación normalizadas; nunca geometría física paralela.
create table if not exists anotaciones_sala (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas(id),
  texto varchar(1000) not null check (length(trim(texto)) > 0),
  ancla_tipo text not null check (ancla_tipo in ('sala','equipo','conexion','visual')),
  ancla_id uuid,
  x double precision,
  y double precision,
  creado_en timestamptz not null default now(),
  constraint anotacion_ancla_valida check (
    (ancla_tipo = 'sala' and ancla_id is null and x is null and y is null) or
    (ancla_tipo in ('equipo','conexion') and ancla_id is not null and x is null and y is null) or
    (ancla_tipo = 'visual' and ancla_id is null and x between 0 and 100000 and y between 0 and 100000 and x is not null and y is not null)
  )
);
create index if not exists anotaciones_sala_sala on anotaciones_sala(sala_id);
create or replace function comprobar_ancla_anotacion() returns trigger language plpgsql as $$
begin
  if new.ancla_tipo = 'equipo' then
    perform id from sala_equipos where id = new.ancla_id and sala_id = new.sala_id for key share;
    if not found then raise check_violation using message = 'El equipo de la anotación no pertenece a esta sala.'; end if;
  elsif new.ancla_tipo = 'conexion' then
    perform id from conexiones where id = new.ancla_id and sala_id = new.sala_id for key share;
    if not found then raise check_violation using message = 'La conexión de la anotación no pertenece a esta sala.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists anotacion_pertenencia on anotaciones_sala;
create trigger anotacion_pertenencia before insert or update on anotaciones_sala for each row execute function comprobar_ancla_anotacion();

create or replace function proteger_ancla_anotada() returns trigger language plpgsql as $$
declare tipo text;
begin
  tipo := case tg_table_name when 'sala_equipos' then 'equipo' else 'conexion' end;
  if (tg_op = 'DELETE' or old.sala_id <> new.sala_id) and exists (select 1 from anotaciones_sala where sala_id = old.sala_id and ancla_tipo = tipo and ancla_id = old.id) then
    raise check_violation using message = 'Decide conservar o retirar las anotaciones desde Diagrama antes de quitar su ancla.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists equipo_anotado on sala_equipos;
create trigger equipo_anotado before delete or update of sala_id on sala_equipos for each row execute function proteger_ancla_anotada();
drop trigger if exists conexion_anotada on conexiones;
create trigger conexion_anotada before delete or update of sala_id on conexiones for each row execute function proteger_ancla_anotada();

create or replace function versionar_anotacion_diseno() returns trigger language plpgsql as $$
begin
  update salas set diseno_version = diseno_version + 1 where id = case when tg_op = 'DELETE' then old.sala_id else new.sala_id end;
  if tg_op = 'UPDATE' and old.sala_id <> new.sala_id then
    update salas set diseno_version = diseno_version + 1 where id = old.sala_id;
  end if;
  return null;
end $$;
drop trigger if exists anotacion_version_diseno on anotaciones_sala;
create trigger anotacion_version_diseno after insert or update or delete on anotaciones_sala for each row execute function versionar_anotacion_diseno();

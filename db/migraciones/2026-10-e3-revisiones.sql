-- E3: historial durable y frontera diseño/operación. Sin siembra de negocio.
alter table salas add column if not exists diseno_version bigint not null default 0;
alter table salas add column if not exists origen_sala_id uuid references salas on delete restrict;
alter table salas add column if not exists origen_revision_id uuid;
alter table salas add column if not exists medidas_heredadas boolean not null default false;
alter table salas add column if not exists mapa_ids_origen jsonb not null default '{}'::jsonb;

create table if not exists revisiones_diseno (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas on delete restrict,
  numero integer not null check(numero > 0),
  nombre text not null check(length(nombre) between 1 and 160),
  autor_id uuid not null references usuarios on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  hash text not null check(hash ~ '^[a-f0-9]{64}$'),
  diseno_version bigint not null,
  antecedente_id uuid references revisiones_diseno on delete restrict,
  restaurada_de_id uuid references revisiones_diseno on delete restrict,
  snapshot jsonb not null check(octet_length(snapshot::text) <= 5242880),
  unique(sala_id, numero)
);
create index if not exists revisiones_diseno_sala_idx on revisiones_diseno(sala_id, numero desc);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='salas_origen_revision_fk' and conrelid='salas'::regclass) then
    alter table salas add constraint salas_origen_revision_fk foreign key(origen_revision_id) references revisiones_diseno on delete restrict;
  end if;
end $$;
create or replace function e3_revision_inmutable() returns trigger language plpgsql as $$
begin raise exception 'Una revisión de diseño es inmutable' using errcode='23514'; end $$;
drop trigger if exists e3_revision_inmutable on revisiones_diseno;
create trigger e3_revision_inmutable before update or delete on revisiones_diseno for each row execute function e3_revision_inmutable();

-- El contador no retrocede al borrar un cable. El identificador es por sala.
alter table conexiones add column if not exists identificador_cable text;
create table if not exists correlativos_cable (
  sala_id uuid not null references salas on delete cascade,
  senal senal not null,
  siguiente integer not null check(siguiente >= 1000),
  primary key(sala_id, senal)
);
with orden as (
  select id, senal, row_number() over(partition by sala_id, senal order by creado_en, id)+999 n from conexiones
), etiquetas as (
  select id, case senal when 'hdmi' then 'HD' when 'red' then 'RED' when 'usb' then 'USB'
    when 'audio_linea' then 'AUD' when 'audio_altavoz' then 'ALT' when 'microfono' then 'MIC'
    when 'alimentacion' then 'PWR' when 'control' then 'RS' else 'CBL' end || '-' || n::text etiqueta from orden
)
update conexiones c set identificador_cable=e.etiqueta from etiquetas e where c.id=e.id and c.identificador_cable is null;
insert into correlativos_cable(sala_id,senal,siguiente)
select sala_id,senal,coalesce(max(substring(identificador_cable from '-([0-9]+)$')::integer),999)+1
from conexiones group by sala_id,senal
on conflict(sala_id,senal) do update set siguiente=greatest(correlativos_cable.siguiente,excluded.siguiente);
create unique index if not exists conexiones_identificador_idx on conexiones(sala_id,identificador_cable);
create or replace function e3_identificador_cable() returns trigger language plpgsql as $$
declare n integer; prefijo text;
begin
  if tg_op='UPDATE' then
    if new.identificador_cable is distinct from old.identificador_cable then
      raise exception 'El identificador de cable es inmutable' using errcode='23514';
    end if;
    return new;
  end if;
  if new.identificador_cable is not null then
    if new.identificador_cable !~ '^[A-Z]+-[0-9]+$' then raise exception 'Identificador de cable inválido'; end if;
    n := substring(new.identificador_cable from '-([0-9]+)$')::integer;
    insert into correlativos_cable(sala_id,senal,siguiente) values(new.sala_id,new.senal,n+1)
      on conflict(sala_id,senal) do update set siguiente=greatest(correlativos_cable.siguiente,excluded.siguiente);
    return new;
  end if;
  insert into correlativos_cable(sala_id,senal,siguiente) values(new.sala_id,new.senal,1001)
    on conflict(sala_id,senal) do update set siguiente=correlativos_cable.siguiente+1 returning siguiente-1 into n;
  prefijo := case new.senal when 'hdmi' then 'HD' when 'red' then 'RED' when 'usb' then 'USB'
    when 'audio_linea' then 'AUD' when 'audio_altavoz' then 'ALT' when 'microfono' then 'MIC'
    when 'alimentacion' then 'PWR' when 'control' then 'RS' else 'CBL' end;
  new.identificador_cable := prefijo || '-' || n::text;
  return new;
end $$;
drop trigger if exists e3_identificador_cable on conexiones;
create trigger e3_identificador_cable before insert or update on conexiones for each row execute function e3_identificador_cable();

-- Versión independiente de la del editor: también cubre BOM/notas/cantidad y ABA.
create or replace function e3_version_sala() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new)-array['diseno_version','diagrama_version','actualizado_en','origen_sala_id','origen_revision_id','medidas_heredadas','mapa_ids_origen'])
     is distinct from (to_jsonb(old)-array['diseno_version','diagrama_version','actualizado_en','origen_sala_id','origen_revision_id','medidas_heredadas','mapa_ids_origen']) then
    new.diseno_version := old.diseno_version+1;
  end if;
  return new;
end $$;
drop trigger if exists e3_version_sala on salas;
create trigger e3_version_sala before update on salas for each row execute function e3_version_sala();
create or replace function e3_version_hija() returns trigger language plpgsql as $$
declare anterior uuid; posterior uuid; fila jsonb;
begin
  if tg_op <> 'INSERT' then
    fila:=to_jsonb(old);
    if tg_table_name in ('conexion_bocas','conexion_puntos_paso') then select sala_id into anterior from conexiones where id=(fila->>'conexion_id')::uuid;
    else anterior:=(fila->>'sala_id')::uuid; end if;
  end if;
  if tg_op <> 'DELETE' then
    fila:=to_jsonb(new);
    if tg_table_name in ('conexion_bocas','conexion_puntos_paso') then select sala_id into posterior from conexiones where id=(fila->>'conexion_id')::uuid;
    else posterior:=(fila->>'sala_id')::uuid; end if;
  end if;
  update salas set diseno_version=diseno_version+1 where id in (anterior,posterior);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
do $$ declare tabla text;
begin
  foreach tabla in array array['sala_equipos','sala_mobiliario','puertas','tomas_red','conexiones','conexion_bocas','conexion_puntos_paso','sala_material_bom'] loop
    execute format('drop trigger if exists e3_version_hija on %I',tabla);
    execute format('create trigger e3_version_hija after insert or update or delete on %I for each row execute function e3_version_hija()',tabla);
  end loop;
end $$;

-- Fascículo 4 · bocas físicas de puerto. Aditiva, idempotente y sin backfill.
do $$ begin
  create type lado_conexion as enum ('origen', 'destino');
exception when duplicate_object then null; end $$;

alter table puertos drop constraint if exists puertos_total_positivo;
alter table puertos add constraint puertos_total_positivo check (total >= 1);

create table if not exists conexion_bocas (
  conexion_id uuid not null references conexiones(id) on delete cascade,
  lado lado_conexion not null,
  equipo_id uuid not null references sala_equipos(id) on delete cascade,
  puerto_id uuid not null references puertos(id) on delete restrict,
  ordinal integer not null check (ordinal >= 1),
  primary key (conexion_id, lado),
  constraint conexion_bocas_boca_unica unique (equipo_id, puerto_id, ordinal)
);

create table if not exists plantilla_conexion_bocas (
  plantilla_conexion_id uuid not null references plantilla_conexiones(id) on delete cascade,
  lado lado_conexion not null,
  linea_id uuid not null references plantilla_articulos(id) on delete cascade,
  puerto_id uuid not null references puertos(id) on delete restrict,
  ordinal integer not null check (ordinal >= 1),
  primary key (plantilla_conexion_id, lado),
  constraint plantilla_conexion_bocas_boca_unica unique (linea_id, puerto_id, ordinal)
);

create or replace function validar_conexion_boca()
returns trigger language plpgsql as $$
declare
  c conexiones%rowtype;
  e sala_equipos%rowtype;
  p puertos%rowtype;
  extremo_esperado uuid;
begin
  select * into c from conexiones where id = new.conexion_id;
  if not found then raise exception 'conexion inexistente' using errcode = '23503'; end if;
  select * into e from sala_equipos where id = new.equipo_id;
  if not found then raise exception 'equipo inexistente' using errcode = '23503'; end if;
  -- Serializa el alta de la boca contra cambios inversos de total o artículo.
  select * into p from puertos where id = new.puerto_id for update;
  if not found then raise exception 'puerto inexistente' using errcode = '23503'; end if;
  extremo_esperado := case new.lado when 'origen' then c.origen_id else c.destino_id end;
  if new.equipo_id <> extremo_esperado or e.sala_id <> c.sala_id then
    raise exception 'equipo ajeno al extremo o sala' using errcode = '23514';
  end if;
  if e.cantidad <> 1 then raise exception 'una boca exige una instancia fisica' using errcode = '23514'; end if;
  if e.articulo_id is null or p.articulo_id <> e.articulo_id then
    raise exception 'puerto ajeno al articulo del equipo' using errcode = '23514';
  end if;
  if new.ordinal > p.total then raise exception 'ordinal fuera del total del puerto' using errcode = '23514'; end if;
  return new;
end $$;

drop trigger if exists conexion_bocas_validar on conexion_bocas;
create trigger conexion_bocas_validar before insert or update on conexion_bocas
for each row execute function validar_conexion_boca();

create or replace function validar_plantilla_conexion_boca()
returns trigger language plpgsql as $$
declare
  c plantilla_conexiones%rowtype;
  l plantilla_articulos%rowtype;
  p puertos%rowtype;
  extremo_esperado uuid;
begin
  select * into c from plantilla_conexiones where id = new.plantilla_conexion_id;
  if not found then raise exception 'tirada inexistente' using errcode = '23503'; end if;
  select * into l from plantilla_articulos where id = new.linea_id;
  if not found then raise exception 'linea inexistente' using errcode = '23503'; end if;
  select * into p from puertos where id = new.puerto_id for update;
  if not found then raise exception 'puerto inexistente' using errcode = '23503'; end if;
  extremo_esperado := case new.lado when 'origen' then c.origen_linea_id else c.destino_linea_id end;
  if new.linea_id <> extremo_esperado or l.plantilla_id <> c.plantilla_id then
    raise exception 'linea ajena al extremo o plantilla' using errcode = '23514';
  end if;
  if l.cantidad <> 1 then raise exception 'una boca exige una instancia fisica' using errcode = '23514'; end if;
  if l.articulo_id is null or p.articulo_id <> l.articulo_id then
    raise exception 'puerto ajeno al articulo de la linea' using errcode = '23514';
  end if;
  if new.ordinal > p.total then raise exception 'ordinal fuera del total del puerto' using errcode = '23514'; end if;
  return new;
end $$;

drop trigger if exists plantilla_conexion_bocas_validar on plantilla_conexion_bocas;
create trigger plantilla_conexion_bocas_validar before insert or update on plantilla_conexion_bocas
for each row execute function validar_plantilla_conexion_boca();

create or replace function exigir_pareja_conexion_bocas()
returns trigger language plpgsql as $$
declare
  objetivo uuid := coalesce(new.conexion_id, old.conexion_id);
  filas integer;
  lados integer;
begin
  if not exists (select 1 from conexiones where id = objetivo) then return null; end if;
  select count(*), count(distinct lado) into filas, lados from conexion_bocas where conexion_id = objetivo;
  if filas not in (0, 2) or (filas = 2 and lados <> 2) then
    raise exception 'el detalle fisico exige origen y destino completos' using errcode = '23514';
  end if;
  return null;
end $$;

drop trigger if exists conexion_bocas_pareja on conexion_bocas;
create constraint trigger conexion_bocas_pareja
after insert or update or delete on conexion_bocas deferrable initially deferred
for each row execute function exigir_pareja_conexion_bocas();

create or replace function exigir_pareja_plantilla_conexion_bocas()
returns trigger language plpgsql as $$
declare
  objetivo uuid := coalesce(new.plantilla_conexion_id, old.plantilla_conexion_id);
  filas integer;
  lados integer;
begin
  if not exists (select 1 from plantilla_conexiones where id = objetivo) then return null; end if;
  select count(*), count(distinct lado) into filas, lados from plantilla_conexion_bocas where plantilla_conexion_id = objetivo;
  if filas not in (0, 2) or (filas = 2 and lados <> 2) then
    raise exception 'el detalle fisico exige origen y destino completos' using errcode = '23514';
  end if;
  return null;
end $$;

drop trigger if exists plantilla_conexion_bocas_pareja on plantilla_conexion_bocas;
create constraint trigger plantilla_conexion_bocas_pareja
after insert or update or delete on plantilla_conexion_bocas deferrable initially deferred
for each row execute function exigir_pareja_plantilla_conexion_bocas();

create or replace function proteger_puerto_con_bocas()
returns trigger language plpgsql as $$
begin
  if new.total <> old.total or new.articulo_id <> old.articulo_id then
    if exists (select 1 from conexion_bocas where puerto_id = old.id and (ordinal > new.total or new.articulo_id <> old.articulo_id))
       or exists (select 1 from plantilla_conexion_bocas where puerto_id = old.id and (ordinal > new.total or new.articulo_id <> old.articulo_id)) then
      raise exception 'el puerto tiene bocas fisicas incompatibles con el cambio' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists puertos_proteger_bocas on puertos;
create trigger puertos_proteger_bocas before update of total, articulo_id on puertos
for each row execute function proteger_puerto_con_bocas();

create or replace function proteger_equipo_con_bocas()
returns trigger language plpgsql as $$
begin
  if (new.articulo_id is distinct from old.articulo_id or new.cantidad <> old.cantidad)
     and exists (select 1 from conexion_bocas where equipo_id = old.id) then
    raise exception 'el equipo tiene bocas fisicas detalladas' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists sala_equipos_proteger_bocas on sala_equipos;
create trigger sala_equipos_proteger_bocas before update of articulo_id, cantidad on sala_equipos
for each row execute function proteger_equipo_con_bocas();

create or replace function proteger_linea_con_bocas()
returns trigger language plpgsql as $$
begin
  if (new.articulo_id is distinct from old.articulo_id or new.cantidad <> old.cantidad)
     and exists (select 1 from plantilla_conexion_bocas where linea_id = old.id) then
    raise exception 'la linea tiene bocas fisicas detalladas' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists plantilla_articulos_proteger_bocas on plantilla_articulos;
create trigger plantilla_articulos_proteger_bocas before update of articulo_id, cantidad on plantilla_articulos
for each row execute function proteger_linea_con_bocas();

create or replace function invalidar_bocas_legacy_conexion()
returns trigger language plpgsql as $$
begin
  if new.puerto_origen_id is distinct from old.puerto_origen_id
     or new.puerto_destino_id is distinct from old.puerto_destino_id
     or new.origen_id is distinct from old.origen_id
     or new.destino_id is distinct from old.destino_id
     or new.sala_id is distinct from old.sala_id then
    delete from conexion_bocas where conexion_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists conexiones_invalidar_bocas_legacy on conexiones;
create trigger conexiones_invalidar_bocas_legacy after update of puerto_origen_id, puerto_destino_id, origen_id, destino_id, sala_id on conexiones
for each row execute function invalidar_bocas_legacy_conexion();

create or replace function invalidar_bocas_legacy_plantilla()
returns trigger language plpgsql as $$
begin
  if new.origen_linea_id is distinct from old.origen_linea_id
     or new.destino_linea_id is distinct from old.destino_linea_id
     or new.plantilla_id is distinct from old.plantilla_id then
    delete from plantilla_conexion_bocas where plantilla_conexion_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists plantilla_conexiones_invalidar_bocas_legacy on plantilla_conexiones;
create trigger plantilla_conexiones_invalidar_bocas_legacy
after update of origen_linea_id, destino_linea_id, plantilla_id on plantilla_conexiones
for each row execute function invalidar_bocas_legacy_plantilla();

-- L2B: bocas documentadas de infraestructura. Sin backfill de capacidad ni cables.
begin;
lock table conexiones, plantilla_conexiones, conexion_bocas, plantilla_conexion_bocas,
  sala_equipos, plantilla_articulos, tomas_red in access exclusive mode;
create table if not exists plantilla_tomas_red (
 id uuid primary key default gen_random_uuid(),
 plantilla_id uuid not null references plantillas_sala on delete cascade,
 codigo text not null, ubicacion text, x_m numeric(6,2), y_m numeric(6,2), z_m numeric(6,2),
 notas text, creado_en timestamptz not null default now(), unique(plantilla_id,codigo)
);
alter table plantilla_conexiones add column if not exists longitud_manual_m numeric(8,2);
drop trigger if exists conexiones_invalidar_bocas_legacy on conexiones;
drop trigger if exists plantilla_conexiones_invalidar_bocas_legacy on plantilla_conexiones;

alter table tomas_red add column if not exists capacidad_documentada integer check(capacidad_documentada>0);
alter table tomas_red add column if not exists codigo_referencia text;
alter table tomas_red add column if not exists codigo_confirmado boolean not null default false;
alter table tomas_red add column if not exists esquema_x double precision;
alter table tomas_red add column if not exists esquema_y double precision;
alter table tomas_red drop constraint if exists tomas_red_esquema_posicion;
alter table tomas_red add constraint tomas_red_esquema_posicion check(
 (esquema_x is null and esquema_y is null) or (esquema_x is not null and esquema_y is not null
 and esquema_x between 0 and 100000 and esquema_y between 0 and 100000));
create table if not exists toma_red_bocas (
 id uuid primary key default gen_random_uuid(), toma_red_id uuid not null references tomas_red(id) on delete cascade,
 ordinal integer not null check(ordinal>0), etiqueta text,
 conector text not null check(conector ~ '[^[:space:]]'), senal senal not null,
 unique(toma_red_id,ordinal)
);
alter table conexion_bocas alter column equipo_id drop not null;
alter table conexion_bocas alter column puerto_id drop not null;
alter table conexion_bocas alter column ordinal drop not null;
alter table conexion_bocas add column if not exists toma_boca_id uuid references toma_red_bocas(id) on delete restrict;
create unique index if not exists conexion_bocas_toma_unica on conexion_bocas(toma_boca_id);
alter table conexion_bocas drop constraint if exists conexion_bocas_tipo_extremo;
alter table conexion_bocas add constraint conexion_bocas_tipo_extremo check(
 (equipo_id is not null and puerto_id is not null and ordinal is not null and toma_boca_id is null)
 or (equipo_id is null and puerto_id is null and ordinal is null and toma_boca_id is not null));
alter table conexiones alter column origen_id drop not null;
alter table conexiones alter column destino_id drop not null;
-- Clasifica solamente al incorporar la columna: repetir nunca degrada completos.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='conexiones' and column_name='detalle_extremos') then
  alter table conexiones add column detalle_extremos text;
  update conexiones c set detalle_extremos=case when exists(select 1 from conexion_bocas b where b.conexion_id=c.id) then 'completo' else 'legacy' end;
 end if;
end $$;
alter table conexiones alter column detalle_extremos set default 'completo';
alter table conexiones alter column detalle_extremos set not null;
alter table conexiones drop constraint if exists conexiones_detalle_extremos;
alter table conexiones add constraint conexiones_detalle_extremos check(detalle_extremos in ('legacy','completo'));
create or replace function guardar_estado_conexiones() returns trigger language plpgsql as $$
begin
 if (tg_op='INSERT' and new.detalle_extremos<>'completo')
 or (tg_op='UPDATE' and old.detalle_extremos='completo' and new.detalle_extremos<>'completo') then
  raise exception 'No se pueden crear ni degradar tiradas legacy' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.sala_id is distinct from old.sala_id) then
  raise exception 'Identidad y propietario de tirada inmutables' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists conexiones_estado_extremos on conexiones;
create trigger conexiones_estado_extremos before insert or update on conexiones for each row execute function guardar_estado_conexiones();

create or replace function validar_conexion_boca() returns trigger language plpgsql as $$
declare c conexiones%rowtype; e sala_equipos%rowtype; p puertos%rowtype; t tomas_red%rowtype; b toma_red_bocas%rowtype;
begin
 if tg_op='UPDATE' and (new.conexion_id is distinct from old.conexion_id or new.lado is distinct from old.lado) then
  raise exception 'Identidad del extremo inmutable; sustituya la pareja en transaccion' using errcode='23514';
 end if;
 select * into c from conexiones where id=new.conexion_id for update;
 if not found then raise exception 'Tirada inexistente' using errcode='23503'; end if;
 if new.toma_boca_id is not null then
  select * into b from toma_red_bocas where id=new.toma_boca_id;
  if not found then raise exception 'Boca de roseta inexistente' using errcode='23503'; end if;
  select * into t from tomas_red where id=b.toma_red_id for update;
  select * into b from toma_red_bocas where id=new.toma_boca_id for update;
  if not found or t.sala_id<>c.sala_id or t.capacidad_documentada is null or b.ordinal>t.capacidad_documentada then
   raise exception 'Boca de roseta ajena o sin capacidad documentada' using errcode='23514';
  end if;
 else
  select * into e from sala_equipos where id=new.equipo_id for update;
  if not found then raise exception 'Equipo inexistente' using errcode='23503'; end if;
  select * into p from puertos where id=new.puerto_id for update;
  if not found then raise exception 'Puerto inexistente' using errcode='23503'; end if;
  if e.sala_id<>c.sala_id or e.cantidad<>1 or e.articulo_id is null or e.articulo_id<>p.articulo_id or new.ordinal>p.total then
   raise exception 'Boca de equipo ajena o fuera del total fisico' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create or replace function comprobar_pareja_conexiones(objetivo uuid) returns void language plpgsql as $$
declare c conexiones%rowtype; filas integer;
begin
 select * into c from conexiones where id=objetivo;
 if not found then return; end if;
 select count(*) into filas from conexion_bocas where conexion_id=objetivo;
 if (c.detalle_extremos='completo' and filas<>2) or (c.detalle_extremos='legacy' and filas<>0) then
  raise exception 'El detalle fisico exige origen y destino completos' using errcode='23514';
 end if;
 if exists(select 1 from conexion_bocas b where b.conexion_id=objetivo and (
  b.equipo_id is distinct from case b.lado when 'origen' then c.origen_id else c.destino_id end
  or b.puerto_id is distinct from case b.lado when 'origen' then c.puerto_origen_id else c.puerto_destino_id end
 )) then raise exception 'Columnas compatibles no coinciden con las bocas' using errcode='23514'; end if;
end $$;
create or replace function exigir_pareja_conexion_bocas() returns trigger language plpgsql as $$
begin
 perform comprobar_pareja_conexiones(coalesce(new.conexion_id,old.conexion_id)); return null;
end $$;
create or replace function exigir_pareja_fila_conexiones() returns trigger language plpgsql as $$
begin perform comprobar_pareja_conexiones(new.id); return null; end $$;
drop trigger if exists conexiones_pareja on conexiones;
create constraint trigger conexiones_pareja after insert or update on conexiones deferrable initially deferred
 for each row execute function exigir_pareja_fila_conexiones();

create or replace function comprobar_capacidad_tomas_red(objetivo uuid) returns void language plpgsql as $$
declare capacidad integer; total integer; menor integer; mayor integer;
begin
 select capacidad_documentada into capacidad from tomas_red where id=objetivo for update;
 if not found then return; end if;
 select count(*),min(ordinal),max(ordinal) into total,menor,mayor from toma_red_bocas where toma_red_id=objetivo;
 if (capacidad is null and total<>0) or (capacidad is not null and (total<>capacidad or menor<>1 or mayor<>capacidad)) then
  raise exception 'Capacidad documentada exige exactamente bocas 1..N' using errcode='23514';
 end if;
end $$;
create or replace function exigir_capacidad_tomas_red() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_tomas_red(new.id); return null; end $$;
create or replace function exigir_capacidad_toma_red_bocas() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_tomas_red(coalesce(new.toma_red_id,old.toma_red_id)); return null; end $$;
drop trigger if exists tomas_red_capacidad on tomas_red;
create constraint trigger tomas_red_capacidad after insert or update on tomas_red deferrable initially deferred
 for each row execute function exigir_capacidad_tomas_red();
drop trigger if exists toma_red_bocas_capacidad on toma_red_bocas;
create constraint trigger toma_red_bocas_capacidad after insert or update or delete on toma_red_bocas deferrable initially deferred
 for each row execute function exigir_capacidad_toma_red_bocas();
create or replace function proteger_toma_red_bocas() returns trigger language plpgsql as $$
begin
 perform 1 from tomas_red where id=coalesce(new.toma_red_id,old.toma_red_id) for update;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.toma_red_id is distinct from old.toma_red_id or new.ordinal is distinct from old.ordinal) then
  raise exception 'Identidad y ordinal fisico de boca inmutables' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.conector is distinct from old.conector or new.senal is distinct from old.senal)
 and exists(select 1 from conexion_bocas where toma_boca_id=old.id) then
  raise exception 'La boca ocupada no puede cambiar su conector o senal' using errcode='23514';
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists toma_red_bocas_proteger on toma_red_bocas;
create trigger toma_red_bocas_proteger before insert or update or delete on toma_red_bocas for each row execute function proteger_toma_red_bocas();
create or replace function proteger_tomas_red() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.sala_id is distinct from old.sala_id) then
  raise exception 'Identidad y propietario de roseta inmutables' using errcode='23514';
 end if;
 if tg_op='INSERT' or new.x_m is distinct from old.x_m or new.y_m is distinct from old.y_m or new.z_m is distinct from old.z_m then
  if (new.x_m is null)::int+(new.y_m is null)::int+(new.z_m is null)::int not in (0,3) then
   raise exception 'Posicion de roseta exige tres ejes o ninguno' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists tomas_red_proteger on tomas_red;
create trigger tomas_red_proteger before insert or update on tomas_red for each row execute function proteger_tomas_red();
create or replace function proteger_equipo_con_bocas() returns trigger language plpgsql as $$
begin
 if (new.articulo_id is distinct from old.articulo_id or new.cantidad<>old.cantidad or new.sala_id is distinct from old.sala_id)
 and exists(select 1 from conexion_bocas where equipo_id=old.id) then
  raise exception 'El equipo tiene bocas fisicas detalladas' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists sala_equipos_proteger_bocas on sala_equipos;
create trigger sala_equipos_proteger_bocas before update of articulo_id,cantidad,sala_id on sala_equipos
 for each row execute function proteger_equipo_con_bocas();
-- Preflight del estado migrado; no corrige ni elimina extremos incompletos.
do $$ declare fila record; begin
 for fila in select id from conexiones loop perform comprobar_pareja_conexiones(fila.id); end loop;
 for fila in select id from tomas_red loop perform comprobar_capacidad_tomas_red(fila.id); end loop;
end $$;

alter table plantilla_tomas_red add column if not exists capacidad_documentada integer check(capacidad_documentada>0);
alter table plantilla_tomas_red add column if not exists codigo_referencia text;
alter table plantilla_tomas_red add column if not exists codigo_confirmado boolean not null default false;
alter table plantilla_tomas_red add column if not exists esquema_x double precision;
alter table plantilla_tomas_red add column if not exists esquema_y double precision;
alter table plantilla_tomas_red drop constraint if exists plantilla_tomas_red_esquema_posicion;
alter table plantilla_tomas_red add constraint plantilla_tomas_red_esquema_posicion check(
 (esquema_x is null and esquema_y is null) or (esquema_x is not null and esquema_y is not null
 and esquema_x between 0 and 100000 and esquema_y between 0 and 100000));
create table if not exists plantilla_toma_red_bocas (
 id uuid primary key default gen_random_uuid(), plantilla_toma_red_id uuid not null references plantilla_tomas_red(id) on delete cascade,
 ordinal integer not null check(ordinal>0), etiqueta text,
 conector text not null check(conector ~ '[^[:space:]]'), senal senal not null,
 unique(plantilla_toma_red_id,ordinal)
);
alter table plantilla_conexion_bocas alter column linea_id drop not null;
alter table plantilla_conexion_bocas alter column puerto_id drop not null;
alter table plantilla_conexion_bocas alter column ordinal drop not null;
alter table plantilla_conexion_bocas add column if not exists toma_boca_id uuid references plantilla_toma_red_bocas(id) on delete restrict;
create unique index if not exists plantilla_conexion_bocas_toma_unica on plantilla_conexion_bocas(toma_boca_id);
alter table plantilla_conexion_bocas drop constraint if exists plantilla_conexion_bocas_tipo_extremo;
alter table plantilla_conexion_bocas add constraint plantilla_conexion_bocas_tipo_extremo check(
 (linea_id is not null and puerto_id is not null and ordinal is not null and toma_boca_id is null)
 or (linea_id is null and puerto_id is null and ordinal is null and toma_boca_id is not null));
alter table plantilla_conexiones alter column origen_linea_id drop not null;
alter table plantilla_conexiones alter column destino_linea_id drop not null;
-- Clasifica solamente al incorporar la columna: repetir nunca degrada completos.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='plantilla_conexiones' and column_name='detalle_extremos') then
  alter table plantilla_conexiones add column detalle_extremos text;
  update plantilla_conexiones c set detalle_extremos=case when exists(select 1 from plantilla_conexion_bocas b where b.plantilla_conexion_id=c.id) then 'completo' else 'legacy' end;
 end if;
end $$;
alter table plantilla_conexiones alter column detalle_extremos set default 'completo';
alter table plantilla_conexiones alter column detalle_extremos set not null;
alter table plantilla_conexiones drop constraint if exists plantilla_conexiones_detalle_extremos;
alter table plantilla_conexiones add constraint plantilla_conexiones_detalle_extremos check(detalle_extremos in ('legacy','completo'));
create or replace function guardar_estado_plantilla_conexiones() returns trigger language plpgsql as $$
begin
 if (tg_op='INSERT' and new.detalle_extremos<>'completo')
 or (tg_op='UPDATE' and old.detalle_extremos='completo' and new.detalle_extremos<>'completo') then
  raise exception 'No se pueden crear ni degradar tiradas legacy' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.plantilla_id is distinct from old.plantilla_id) then
  raise exception 'Identidad y propietario de tirada inmutables' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists plantilla_conexiones_estado_extremos on plantilla_conexiones;
create trigger plantilla_conexiones_estado_extremos before insert or update on plantilla_conexiones for each row execute function guardar_estado_plantilla_conexiones();

create or replace function validar_plantilla_conexion_boca() returns trigger language plpgsql as $$
declare c plantilla_conexiones%rowtype; e plantilla_articulos%rowtype; p puertos%rowtype; t plantilla_tomas_red%rowtype; b plantilla_toma_red_bocas%rowtype;
begin
 if tg_op='UPDATE' and (new.plantilla_conexion_id is distinct from old.plantilla_conexion_id or new.lado is distinct from old.lado) then
  raise exception 'Identidad del extremo inmutable; sustituya la pareja en transaccion' using errcode='23514';
 end if;
 select * into c from plantilla_conexiones where id=new.plantilla_conexion_id for update;
 if not found then raise exception 'Tirada inexistente' using errcode='23503'; end if;
 if new.toma_boca_id is not null then
  select * into b from plantilla_toma_red_bocas where id=new.toma_boca_id;
  if not found then raise exception 'Boca de roseta inexistente' using errcode='23503'; end if;
  select * into t from plantilla_tomas_red where id=b.plantilla_toma_red_id for update;
  select * into b from plantilla_toma_red_bocas where id=new.toma_boca_id for update;
  if not found or t.plantilla_id<>c.plantilla_id or t.capacidad_documentada is null or b.ordinal>t.capacidad_documentada then
   raise exception 'Boca de roseta ajena o sin capacidad documentada' using errcode='23514';
  end if;
 else
  select * into e from plantilla_articulos where id=new.linea_id for update;
  if not found then raise exception 'Equipo inexistente' using errcode='23503'; end if;
  select * into p from puertos where id=new.puerto_id for update;
  if not found then raise exception 'Puerto inexistente' using errcode='23503'; end if;
  if e.plantilla_id<>c.plantilla_id or e.cantidad<>1 or e.articulo_id is null or e.articulo_id<>p.articulo_id or new.ordinal>p.total then
   raise exception 'Boca de equipo ajena o fuera del total fisico' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create or replace function comprobar_pareja_plantilla_conexiones(objetivo uuid) returns void language plpgsql as $$
declare c plantilla_conexiones%rowtype; filas integer;
begin
 select * into c from plantilla_conexiones where id=objetivo;
 if not found then return; end if;
 select count(*) into filas from plantilla_conexion_bocas where plantilla_conexion_id=objetivo;
 if (c.detalle_extremos='completo' and filas<>2) or (c.detalle_extremos='legacy' and filas<>0) then
  raise exception 'El detalle fisico exige origen y destino completos' using errcode='23514';
 end if;
 if exists(select 1 from plantilla_conexion_bocas b where b.plantilla_conexion_id=objetivo and (
  b.linea_id is distinct from case b.lado when 'origen' then c.origen_linea_id else c.destino_linea_id end
  
 )) then raise exception 'Columnas compatibles no coinciden con las bocas' using errcode='23514'; end if;
end $$;
create or replace function exigir_pareja_plantilla_conexion_bocas() returns trigger language plpgsql as $$
begin
 perform comprobar_pareja_plantilla_conexiones(coalesce(new.plantilla_conexion_id,old.plantilla_conexion_id)); return null;
end $$;
create or replace function exigir_pareja_fila_plantilla_conexiones() returns trigger language plpgsql as $$
begin perform comprobar_pareja_plantilla_conexiones(new.id); return null; end $$;
drop trigger if exists plantilla_conexiones_pareja on plantilla_conexiones;
create constraint trigger plantilla_conexiones_pareja after insert or update on plantilla_conexiones deferrable initially deferred
 for each row execute function exigir_pareja_fila_plantilla_conexiones();

create or replace function comprobar_capacidad_plantilla_tomas_red(objetivo uuid) returns void language plpgsql as $$
declare capacidad integer; total integer; menor integer; mayor integer;
begin
 select capacidad_documentada into capacidad from plantilla_tomas_red where id=objetivo for update;
 if not found then return; end if;
 select count(*),min(ordinal),max(ordinal) into total,menor,mayor from plantilla_toma_red_bocas where plantilla_toma_red_id=objetivo;
 if (capacidad is null and total<>0) or (capacidad is not null and (total<>capacidad or menor<>1 or mayor<>capacidad)) then
  raise exception 'Capacidad documentada exige exactamente bocas 1..N' using errcode='23514';
 end if;
end $$;
create or replace function exigir_capacidad_plantilla_tomas_red() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_plantilla_tomas_red(new.id); return null; end $$;
create or replace function exigir_capacidad_plantilla_toma_red_bocas() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_plantilla_tomas_red(coalesce(new.plantilla_toma_red_id,old.plantilla_toma_red_id)); return null; end $$;
drop trigger if exists plantilla_tomas_red_capacidad on plantilla_tomas_red;
create constraint trigger plantilla_tomas_red_capacidad after insert or update on plantilla_tomas_red deferrable initially deferred
 for each row execute function exigir_capacidad_plantilla_tomas_red();
drop trigger if exists plantilla_toma_red_bocas_capacidad on plantilla_toma_red_bocas;
create constraint trigger plantilla_toma_red_bocas_capacidad after insert or update or delete on plantilla_toma_red_bocas deferrable initially deferred
 for each row execute function exigir_capacidad_plantilla_toma_red_bocas();
create or replace function proteger_plantilla_toma_red_bocas() returns trigger language plpgsql as $$
begin
 perform 1 from plantilla_tomas_red where id=coalesce(new.plantilla_toma_red_id,old.plantilla_toma_red_id) for update;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.plantilla_toma_red_id is distinct from old.plantilla_toma_red_id or new.ordinal is distinct from old.ordinal) then
  raise exception 'Identidad y ordinal fisico de boca inmutables' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.conector is distinct from old.conector or new.senal is distinct from old.senal)
 and exists(select 1 from plantilla_conexion_bocas where toma_boca_id=old.id) then
  raise exception 'La boca ocupada no puede cambiar su conector o senal' using errcode='23514';
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists plantilla_toma_red_bocas_proteger on plantilla_toma_red_bocas;
create trigger plantilla_toma_red_bocas_proteger before insert or update or delete on plantilla_toma_red_bocas for each row execute function proteger_plantilla_toma_red_bocas();
create or replace function proteger_plantilla_tomas_red() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.plantilla_id is distinct from old.plantilla_id) then
  raise exception 'Identidad y propietario de roseta inmutables' using errcode='23514';
 end if;
 if tg_op='INSERT' or new.x_m is distinct from old.x_m or new.y_m is distinct from old.y_m or new.z_m is distinct from old.z_m then
  if (new.x_m is null)::int+(new.y_m is null)::int+(new.z_m is null)::int not in (0,3) then
   raise exception 'Posicion de roseta exige tres ejes o ninguno' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists plantilla_tomas_red_proteger on plantilla_tomas_red;
create trigger plantilla_tomas_red_proteger before insert or update on plantilla_tomas_red for each row execute function proteger_plantilla_tomas_red();
create or replace function proteger_linea_con_bocas() returns trigger language plpgsql as $$
begin
 if (new.articulo_id is distinct from old.articulo_id or new.cantidad<>old.cantidad or new.plantilla_id is distinct from old.plantilla_id)
 and exists(select 1 from plantilla_conexion_bocas where linea_id=old.id) then
  raise exception 'El equipo tiene bocas fisicas detalladas' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists plantilla_articulos_proteger_bocas on plantilla_articulos;
create trigger plantilla_articulos_proteger_bocas before update of articulo_id,cantidad,plantilla_id on plantilla_articulos
 for each row execute function proteger_linea_con_bocas();
-- Preflight del estado migrado; no corrige ni elimina extremos incompletos.
do $$ declare fila record; begin
 for fila in select id from plantilla_conexiones loop perform comprobar_pareja_plantilla_conexiones(fila.id); end loop;
 for fila in select id from plantilla_tomas_red loop perform comprobar_capacidad_plantilla_tomas_red(fila.id); end loop;
end $$;

alter table sala_equipos add column if not exists toma_red_conexion_id uuid references conexiones(id) on delete set null;
-- Serializa la asignacion documental contra sustituciones concurrentes de extremos.
create or replace function bloquear_asignacion_toma() returns trigger language plpgsql as $$
begin
 perform 1 from conexiones where id=new.toma_red_conexion_id
   or (tg_op='UPDATE' and id=old.toma_red_conexion_id) order by id for update;
 return new;
end $$;
drop trigger if exists sala_equipos_bloquear_asignacion_toma on sala_equipos;
create trigger sala_equipos_bloquear_asignacion_toma before insert or update on sala_equipos
 for each row execute function bloquear_asignacion_toma();
create or replace function comprobar_asignaciones_toma() returns trigger language plpgsql as $$
begin
 if exists(select 1 from sala_equipos e where e.toma_red_conexion_id is not null and not exists(
  select 1 from conexiones c join conexion_bocas equipo on equipo.conexion_id=c.id and equipo.equipo_id=e.id
  join conexion_bocas toma on toma.conexion_id=c.id and toma.lado<>equipo.lado
  join toma_red_bocas b on b.id=toma.toma_boca_id
  where c.id=e.toma_red_conexion_id and c.sala_id=e.sala_id and b.toma_red_id=e.toma_red_id
 )) then raise exception 'El enlace documental no corresponde al equipo y roseta de la tirada' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists sala_equipos_asignacion_toma on sala_equipos;
create constraint trigger sala_equipos_asignacion_toma after insert or update on sala_equipos
 deferrable initially deferred for each row execute function comprobar_asignaciones_toma();
drop trigger if exists conexion_bocas_asignacion_toma on conexion_bocas;
create constraint trigger conexion_bocas_asignacion_toma after insert or update or delete on conexion_bocas
 deferrable initially deferred for each row execute function comprobar_asignaciones_toma();
comment on table toma_red_bocas is 'Bocas de infraestructura documentadas; no son articulos ni equipos AV.';
comment on column tomas_red.capacidad_documentada is 'NULL significa desconocida y ninguna boca. N requiere exactamente ordinales 1..N.';
comment on column tomas_red.codigo_confirmado is 'Confirmacion fisica explicita. Ni backfill ni copias confirman codigos.';
commit;

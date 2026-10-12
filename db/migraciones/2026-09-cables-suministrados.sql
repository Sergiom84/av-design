-- BEGIN CABLES SUMINISTRADOS L3C
-- Una fila por latiguillo físico. No sustituye conexiones ni longitud_manual_m.
create unique index if not exists sala_suministros_id_sala on sala_suministros(id,sala_id);
create unique index if not exists conexiones_id_sala on conexiones(id,sala_id);

create table if not exists sala_cables_suministrados (
 id uuid primary key default gen_random_uuid(),
 suministro_id uuid not null,
 sala_id uuid not null,
 linea_id uuid references articulo_composicion_lineas(id) on delete restrict,
 ordinal integer not null check(ordinal>=1),
 tipo text not null check(tipo in ('libre','unido')),
 propietario_equipo_id uuid,
 puerto_fijo_id uuid,
 ordinal_fijo integer,
 articulo_cable_id uuid references articulos(id) on delete restrict,
 longitud_utilizable_m numeric,
 snapshot jsonb not null,
 creado_en timestamptz not null default now(),
 unique(id,sala_id),
 foreign key(suministro_id,sala_id) references sala_suministros(id,sala_id) on delete restrict,
 foreign key(propietario_equipo_id,sala_id) references sala_equipos(id,sala_id) on delete restrict,
 constraint cable_longitud_positiva check((longitud_utilizable_m is null) or (longitud_utilizable_m>0)),
 constraint cable_tipo_extremos check((tipo='unido' and propietario_equipo_id is not null and puerto_fijo_id is not null and ordinal_fijo is not null)
    or (tipo='libre' and propietario_equipo_id is null and puerto_fijo_id is null and ordinal_fijo is null))
);
create unique index if not exists sala_cables_suministrados_linea_ordinal
 on sala_cables_suministrados(suministro_id,linea_id,ordinal) where linea_id is not null;

alter table conexiones add column if not exists estado_suministro text;
alter table conexiones add column if not exists cable_suministrado_id uuid;
alter table conexiones add column if not exists decision_heredada boolean;
alter table plantilla_conexiones add column if not exists estado_suministro text;
alter table plantilla_conexiones add column if not exists decision_heredada boolean;

update conexiones set estado_suministro='adicional', decision_heredada=true, cable_suministrado_id=null
 where estado_suministro is null;
update plantilla_conexiones set estado_suministro='adicional', decision_heredada=true
 where estado_suministro is null;
-- El UPDATE dispara triggers de etiqueta; ALTER NOT NULL exige transacción nueva.
commit;
begin;

create or replace function normalizar_estado_suministro_conexion() returns trigger language plpgsql as $$
begin
 if tg_op='INSERT' then
  if new.estado_suministro is null then new.estado_suministro='por_determinar'; end if;
  if new.decision_heredada is null then new.decision_heredada=false; end if;
 end if;
 if tg_table_name='conexiones' and tg_op='DELETE' then
  if old.estado_suministro='incluido' or old.cable_suministrado_id is not null then
   raise exception 'Desasigna el cable incluido antes de borrar la conexion' using errcode='23514';
  end if;
  return old;
 end if;
 if new.decision_heredada and new.estado_suministro is distinct from 'adicional' then
  raise exception 'decision_heredada solo aplica a adicional' using errcode='23514';
 end if;
 if tg_table_name='plantilla_conexiones' and new.estado_suministro not in ('adicional','por_determinar') then
  raise exception 'La plantilla no admite cable incluido' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists conexiones_normalizar_estado_suministro on conexiones;
create trigger conexiones_normalizar_estado_suministro before insert or update or delete on conexiones
 for each row execute function normalizar_estado_suministro_conexion();
drop trigger if exists plantilla_conexiones_normalizar_estado_suministro on plantilla_conexiones;
create trigger plantilla_conexiones_normalizar_estado_suministro before insert or update on plantilla_conexiones
 for each row execute function normalizar_estado_suministro_conexion();

alter table conexiones alter column estado_suministro set not null;
alter table conexiones alter column decision_heredada set not null;
alter table plantilla_conexiones alter column estado_suministro set not null;
alter table plantilla_conexiones alter column decision_heredada set not null;

alter table conexiones drop constraint if exists conexiones_estado_suministro_fk;
alter table conexiones add constraint conexiones_estado_suministro_fk check(
 (estado_suministro='incluido' and cable_suministrado_id is not null)
 or (estado_suministro in ('adicional','por_determinar') and cable_suministrado_id is null));
alter table conexiones drop constraint if exists conexiones_decision_heredada;
alter table conexiones add constraint conexiones_decision_heredada check(not decision_heredada or estado_suministro='adicional');
alter table plantilla_conexiones drop constraint if exists plantilla_conexiones_estado_suministro;
alter table plantilla_conexiones add constraint plantilla_conexiones_estado_suministro check(estado_suministro in ('adicional','por_determinar'));
alter table plantilla_conexiones drop constraint if exists plantilla_conexiones_decision_heredada;
alter table plantilla_conexiones add constraint plantilla_conexiones_decision_heredada check(not decision_heredada or estado_suministro='adicional');

create unique index if not exists conexiones_cable_suministrado_unico on conexiones(cable_suministrado_id) where cable_suministrado_id is not null;
do $$ begin
 alter table conexiones drop constraint if exists conexiones_cable_sala_fk;
 alter table conexiones add constraint conexiones_cable_sala_fk
  foreign key(cable_suministrado_id,sala_id) references sala_cables_suministrados(id,sala_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create or replace function proteger_cable_suministrado() returns trigger language plpgsql as $$
declare s sala_suministros; e sala_equipos; p puertos; l articulo_composicion_lineas;
begin
 if tg_op='DELETE' then
  raise exception 'No se borra un cable suministrado' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
  raise exception 'El cable suministrado es inmutable' using errcode='23514';
 end if;
 perform 1 from salas where id=new.sala_id for update;
 select * into s from sala_suministros where id=new.suministro_id for update;
 if not found or s.sala_id is distinct from new.sala_id then
  raise exception 'El cable exige suministro de la misma sala' using errcode='23514';
 end if;
 if new.linea_id is not null then
  select * into l from articulo_composicion_lineas where id=new.linea_id;
  if not found or l.composicion_id is distinct from s.composicion_id or l.inclusion is distinct from 'incluido' then
   raise exception 'La linea de cable no pertenece a la composicion congelada' using errcode='23514';
  end if;
 end if;
 if new.tipo='unido' then
  if new.propietario_equipo_id is null or new.puerto_fijo_id is null or new.ordinal_fijo is null then
   raise exception 'Unido exige propietario, puerto y ordinal' using errcode='23514'; end if;
  select * into e from sala_equipos where id=new.propietario_equipo_id for update;
  if not found or e.sala_id is distinct from new.sala_id then
   raise exception 'El propietario del cable unido es ajeno a la sala' using errcode='23514';
  end if;
  if not exists(select 1 from sala_componentes_suministro c
   where c.equipo_id=new.propietario_equipo_id and c.suministro_id=new.suministro_id and c.sala_id=new.sala_id) then
   raise exception 'El propietario del cable unido no pertenece a este suministro' using errcode='23514';
  end if;
  select * into p from puertos where id=new.puerto_fijo_id for update;
  if not found or p.articulo_id is distinct from e.articulo_id then
   raise exception 'El puerto fijo es ajeno al articulo del propietario' using errcode='23514';
  end if;
  if new.ordinal_fijo<1 or new.ordinal_fijo>p.total then
   raise exception 'El ordinal fijo esta fuera de la capacidad del puerto' using errcode='23514';
  end if;
 elsif new.propietario_equipo_id is not null or new.puerto_fijo_id is not null or new.ordinal_fijo is not null then
  raise exception 'Un cable libre exige extremos nulos' using errcode='23514';
 end if;
 if jsonb_typeof(new.snapshot) is distinct from 'object' then
  raise exception 'El snapshot del cable es obligatorio' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists sala_cables_suministrados_proteger on sala_cables_suministrados;
create trigger sala_cables_suministrados_proteger before insert or update or delete on sala_cables_suministrados
 for each row execute function proteger_cable_suministrado();

create or replace function comprobar_cable_unido_en_conexion() returns trigger language plpgsql as $$
declare cid uuid; c conexiones; k sala_cables_suministrados;
begin
 if tg_table_name='conexiones' then
  if tg_op='DELETE' then return null; end if;
  cid=new.id; c=new;
 else
  cid=coalesce(new.conexion_id,old.conexion_id);
  select * into c from conexiones where id=cid;
  if not found then return null; end if;
 end if;
 if c.estado_suministro is distinct from 'incluido' or c.cable_suministrado_id is null then return null; end if;
 perform 1 from conexiones where id=c.id for update;
 select * into k from sala_cables_suministrados where id=c.cable_suministrado_id for update;
 if not found or k.sala_id is distinct from c.sala_id then
  raise exception 'incluido exige cable suministrado' using errcode='23514';
 end if;
 if k.tipo='unido' and not exists(
  select 1 from conexion_bocas b
   where b.conexion_id=c.id
     and b.equipo_id=k.propietario_equipo_id
     and b.puerto_id=k.puerto_fijo_id
     and b.ordinal=k.ordinal_fijo) then
  raise exception 'el cable unido exige el extremo fijo en la conexion' using errcode='23514';
 end if;
 return null;
end $$;
drop trigger if exists conexiones_cable_unido on conexiones;
create constraint trigger conexiones_cable_unido after insert or update on conexiones
 deferrable initially deferred for each row execute function comprobar_cable_unido_en_conexion();
drop trigger if exists conexion_bocas_cable_unido on conexion_bocas;
create constraint trigger conexion_bocas_cable_unido after insert or update or delete on conexion_bocas
 deferrable initially deferred for each row execute function comprobar_cable_unido_en_conexion();

create or replace function proteger_composicion_kit() returns trigger language plpgsql as $$
declare c articulo_composiciones;
begin
 perform pg_advisory_xact_lock(hashtextextended('av_design:composiciones',0));
 if tg_table_name='articulo_composiciones' then
  if tg_op<>'INSERT' and old.publicada then
   if tg_op='DELETE' or new is distinct from old then
    raise exception 'Composicion publicada inmutable: cree otra version' using errcode='23514';
   end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if exists(select 1 from articulo_composicion_lineas l
   join articulo_composiciones c2 on c2.id=l.composicion_id
   where l.articulo_componente_id=new.articulo_kit_id and c2.articulo_kit_id is distinct from new.articulo_kit_id) then
   raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
  if not exists(select 1 from articulos where id=new.articulo_kit_id and tipo='equipo' and unidad='ud') then
   raise exception 'El kit exige un articulo de equipo por unidad' using errcode='23514'; end if;
  if new.publicada and not exists(select 1 from articulo_composicion_lineas where composicion_id=new.id) then
   raise exception 'Una composicion publicada exige lineas' using errcode='23514'; end if;
  if new.publicada and new.estado_documental='documentada' and exists(select 1 from articulo_composicion_lineas
   where composicion_id=new.id and (inclusion='por_determinar'
    or (inclusion='incluido' and articulo_componente_id is null and rol is distinct from 'cable'))) then
   raise exception 'La composicion contiene pendientes: debe ser parcial' using errcode='23514'; end if;
  return new;
 end if;
 select * into c from articulo_composiciones where id=case when tg_op='DELETE' then old.composicion_id else new.composicion_id end for update;
 if c.publicada or (tg_op='UPDATE' and exists(select 1 from articulo_composiciones where id=old.composicion_id and publicada)) then
  raise exception 'Las lineas publicadas son inmutables' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.articulo_componente_id is not null and new.articulo_componente_id is distinct from c.articulo_kit_id
  and exists(select 1 from articulo_composiciones k where k.articulo_kit_id=new.articulo_componente_id) then
  raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
 if new.articulo_componente_id=c.articulo_kit_id then
  if new.cantidad is distinct from 1 or new.inclusion is distinct from 'incluido' then
   raise exception 'La unidad simple exige cuerpo cantidad 1 incluido' using errcode='23514'; end if;
  if exists(select 1 from articulo_composicion_lineas l
   where l.composicion_id=c.id and l.id is distinct from new.id and l.articulo_componente_id is not null
     and l.articulo_componente_id is distinct from c.articulo_kit_id) then
   raise exception 'La unidad simple no mezcla el cuerpo con otras piezas de equipo' using errcode='23514'; end if;
 elsif new.articulo_componente_id is not null and exists(select 1 from articulo_composicion_lineas l
  where l.composicion_id=c.id and l.articulo_componente_id=c.articulo_kit_id) then
  raise exception 'La unidad simple no mezcla el cuerpo con otras piezas de equipo' using errcode='23514';
 end if;
 if new.articulo_componente_id is not null and not exists(select 1 from articulos where id=new.articulo_componente_id and tipo='equipo' and unidad='ud') then
  raise exception 'Un componente fisico exige articulo de equipo por unidad' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists articulo_composiciones_proteger on articulo_composiciones;
create trigger articulo_composiciones_proteger before insert or update or delete on articulo_composiciones for each row execute function proteger_composicion_kit();
drop trigger if exists articulo_composicion_lineas_proteger on articulo_composicion_lineas;
create trigger articulo_composicion_lineas_proteger before insert or update or delete on articulo_composicion_lineas for each row execute function proteger_composicion_kit();

create or replace function comprobar_suministro_completo() returns trigger language plpgsql as $$
declare sid uuid;
begin
 if tg_table_name='sala_suministros' then sid=new.id;
 elsif tg_table_name='sala_componentes_suministro' then sid=new.suministro_id;
 else sid=coalesce(new.suministro_id,old.suministro_id); end if;
 if exists(select 1 from sala_suministros s join articulo_composicion_lineas l on l.composicion_id=s.composicion_id
  where s.id=sid and l.inclusion='incluido' and l.articulo_componente_id is not null
  and (select count(*) from sala_componentes_suministro p where p.suministro_id=s.id and p.linea_id=l.id)<>l.cantidad) then
  raise exception 'Suministro incompleto: equipo y vinculo deben confirmarse juntos' using errcode='23514'; end if;
 if exists(select 1 from sala_suministros s join articulo_composicion_lineas l on l.composicion_id=s.composicion_id
  where s.id=sid and l.inclusion='incluido' and l.rol='cable'
  and (select count(*) from sala_cables_suministrados k where k.suministro_id=s.id and k.linea_id=l.id)<>l.cantidad) then
  raise exception 'Suministro incompleto: el cable incluido debe nacer con el suministro' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists sala_suministros_completo on sala_suministros;
create constraint trigger sala_suministros_completo after insert on sala_suministros deferrable initially deferred for each row execute function comprobar_suministro_completo();
drop trigger if exists sala_componentes_suministro_completo on sala_componentes_suministro;
create constraint trigger sala_componentes_suministro_completo after insert on sala_componentes_suministro deferrable initially deferred for each row execute function comprobar_suministro_completo();
drop trigger if exists sala_cables_suministrados_completo on sala_cables_suministrados;
create constraint trigger sala_cables_suministrados_completo after insert on sala_cables_suministrados deferrable initially deferred for each row execute function comprobar_suministro_completo();

create or replace function proteger_equipo_de_kit() returns trigger language plpgsql as $$
begin
 if exists(select 1 from sala_componentes_suministro where equipo_id=old.id) then
  if tg_op='DELETE' or new.id is distinct from old.id or new.sala_id is distinct from old.sala_id
   or new.articulo_id is distinct from old.articulo_id or new.cantidad is distinct from old.cantidad then
   raise exception 'Gestionar kit: no se puede borrar ni cambiar la identidad o cantidad de una pieza incluida' using errcode='23514'; end if;
 end if;
 if exists(select 1 from sala_cables_suministrados where propietario_equipo_id=old.id) then
  if tg_op='DELETE' or new.id is distinct from old.id or new.sala_id is distinct from old.sala_id
   or new.articulo_id is distinct from old.articulo_id or new.cantidad is distinct from old.cantidad then
   raise exception 'No se puede cambiar la identidad de una pieza con cable unido' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists sala_equipos_kit on sala_equipos;
create trigger sala_equipos_kit before update or delete on sala_equipos for each row execute function proteger_equipo_de_kit();

create or replace function proteger_puerto_de_cable_unido() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from sala_cables_suministrados where puerto_fijo_id=old.id) then
   raise exception 'El puerto de un cable unido es inmutable' using errcode='23514'; end if;
  return old;
 end if;
 if (new.id is distinct from old.id or new.articulo_id is distinct from old.articulo_id)
  and exists(select 1 from sala_cables_suministrados where puerto_fijo_id=old.id) then
  raise exception 'El puerto de un cable unido es inmutable' using errcode='23514';
 end if;
 if new.total is distinct from old.total and exists(
  select 1 from sala_cables_suministrados k where k.puerto_fijo_id=old.id and k.ordinal_fijo>new.total) then
  raise exception 'El ordinal fijo del cable unido supera la capacidad del puerto' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists puertos_cable_unido on puertos;
create trigger puertos_cable_unido before update or delete on puertos for each row execute function proteger_puerto_de_cable_unido();

comment on table sala_cables_suministrados is
 'Latiguillo fisico de un suministro. longitud_utilizable_m no se sustituye por longitud_manual_m.';
comment on column conexiones.estado_suministro is
 'incluido exige FK al latiguillo; adicional y por_determinar no la llevan. Nuevo INSERT: por_determinar.';
comment on column conexiones.longitud_manual_m is
 'Longitud de instalacion exigida. Nunca sustituye longitud_utilizable_m del cable suministrado.';
-- END CABLES SUMINISTRADOS L3C

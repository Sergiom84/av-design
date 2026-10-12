-- L2B: fuente heredada sin bocas documentadas. No constituye un cable físico.
begin;
create table if not exists plantilla_tiradas_documentales (
 id uuid primary key default gen_random_uuid(),
 fuente_clave text not null unique check(fuente_clave ~ '^[a-z0-9][a-z0-9_-]*$'),
 plantilla_id uuid not null references plantillas_sala(id) on delete cascade,
 tipologia text not null, aforo text not null,
 origen_categoria text not null, destino_categoria text not null,
 senal text not null, ruta text not null, orden text not null, notas text not null,
 conexion_resuelta_id uuid unique references plantilla_conexiones(id) on delete set null,
 creado_en timestamptz not null default now()
);
create or replace function proteger_tirada_documental() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.fuente_clave is distinct from old.fuente_clave) then
  raise exception 'La identidad de la tirada documental es inmutable' using errcode='23514';
 end if;
 if tg_op='UPDATE' and old.conexion_resuelta_id is not null and (
  new.plantilla_id is distinct from old.plantilla_id or new.tipologia is distinct from old.tipologia
  or new.aforo is distinct from old.aforo or new.origen_categoria is distinct from old.origen_categoria
  or new.destino_categoria is distinct from old.destino_categoria or new.senal is distinct from old.senal
  or new.ruta is distinct from old.ruta or new.orden is distinct from old.orden or new.notas is distinct from old.notas
 ) then raise exception 'Fuente documental resuelta cambiada: requiere revision explicita (%)',old.fuente_clave using errcode='23514'; end if;
 perform 1 from plantilla_conexiones where id=new.conexion_resuelta_id
  or (tg_op='UPDATE' and id=old.conexion_resuelta_id) order by id for update;
 return new;
end $$;
drop trigger if exists plantilla_tiradas_documentales_proteger on plantilla_tiradas_documentales;
create trigger plantilla_tiradas_documentales_proteger before insert or update on plantilla_tiradas_documentales
 for each row execute function proteger_tirada_documental();
create or replace function comprobar_resoluciones_documentales() returns trigger language plpgsql as $$
begin
 if exists(select 1 from plantilla_tiradas_documentales d where d.conexion_resuelta_id is not null and not exists(
  select 1 from plantilla_conexiones c where c.id=d.conexion_resuelta_id and c.plantilla_id=d.plantilla_id
  and c.detalle_extremos='completo'
  and (select count(*) from plantilla_conexion_bocas b where b.plantilla_conexion_id=c.id)=2
 )) then raise exception 'La tirada documental exige una conexion completa de su misma plantilla' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists plantilla_tiradas_documentales_resolucion on plantilla_tiradas_documentales;
create constraint trigger plantilla_tiradas_documentales_resolucion after insert or update on plantilla_tiradas_documentales
 deferrable initially deferred for each row execute function comprobar_resoluciones_documentales();
drop trigger if exists plantilla_conexion_bocas_documentales on plantilla_conexion_bocas;
create constraint trigger plantilla_conexion_bocas_documentales after insert or update or delete on plantilla_conexion_bocas
 deferrable initially deferred for each row execute function comprobar_resoluciones_documentales();
drop trigger if exists plantilla_conexiones_documentales on plantilla_conexiones;
create constraint trigger plantilla_conexiones_documentales after insert or update on plantilla_conexiones
 deferrable initially deferred for each row execute function comprobar_resoluciones_documentales();
comment on table plantilla_tiradas_documentales is
 'Fuente CSV literal sin bocas acreditadas. No se calcula ni suma como cable. Resuelta solo mediante vinculo explicito a una conexion fisica completa.';
commit;

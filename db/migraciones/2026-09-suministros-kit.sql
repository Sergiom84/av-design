-- L3A: composición publicada e instancia comercial; no despiece de almacén.
begin;
create table if not exists articulo_composiciones (
 id uuid primary key default gen_random_uuid(),
 articulo_kit_id uuid not null references articulos(id) on delete restrict,
 sku text not null check(length(trim(sku))>0),
 version integer not null check(version>0),
 estado_documental text not null check(estado_documental in ('documentada','parcial')),
 fuente text not null check(length(trim(fuente))>0),
 publicada boolean not null default false,
 unique(articulo_kit_id,version), unique(id,articulo_kit_id)
);
create table if not exists articulo_composicion_lineas (
 id uuid primary key default gen_random_uuid(),
 composicion_id uuid not null references articulo_composiciones(id) on delete restrict,
 clave text not null check(length(trim(clave))>0),
 articulo_componente_id uuid references articulos(id) on delete restrict,
 identidad text not null check(length(trim(identidad))>0),
 rol text not null check(length(trim(rol))>0),
 cantidad integer not null check(cantidad>0),
 inclusion text not null check(inclusion in ('incluido','opcional','por_determinar')),
 fuente text not null check(length(trim(fuente))>0),
 unique(composicion_id,clave), unique(id,composicion_id)
);
create table if not exists sala_suministros (
 id uuid primary key default gen_random_uuid(),
 sala_id uuid not null references salas(id) on delete restrict,
 articulo_id uuid not null,
 composicion_id uuid not null,
 snapshot jsonb not null,
 cantidad integer not null default 1 check(cantidad=1),
 estado text not null default 'activo' check(estado in ('activo','cancelado','retirado_del_diseno')),
 creado_en timestamptz not null default now(),
 foreign key(composicion_id,articulo_id) references articulo_composiciones(id,articulo_kit_id) on delete restrict,
 unique(id,sala_id,composicion_id)
);
create unique index if not exists sala_equipos_identidad_sala on sala_equipos(id,sala_id);
create table if not exists sala_componentes_suministro (
 equipo_id uuid primary key,
 suministro_id uuid not null,
 sala_id uuid not null,
 composicion_id uuid not null,
 linea_id uuid not null,
 ordinal integer not null check(ordinal>0),
 snapshot jsonb not null,
 foreign key(equipo_id,sala_id) references sala_equipos(id,sala_id) on delete restrict,
 foreign key(suministro_id,sala_id,composicion_id) references sala_suministros(id,sala_id,composicion_id) on delete restrict,
 foreign key(linea_id,composicion_id) references articulo_composicion_lineas(id,composicion_id) on delete restrict,
 unique(suministro_id,linea_id,ordinal)
);

create or replace function snapshot_composicion(uuid) returns jsonb language sql stable as $$
 select jsonb_build_object('sku',c.sku,'version',c.version,'estado_documental',c.estado_documental,
  'fuente',c.fuente,'lineas',coalesce((select jsonb_agg(to_jsonb(l) order by l.clave)
   from articulo_composicion_lineas l where l.composicion_id=c.id),'[]'::jsonb))
 from articulo_composiciones c where c.id=$1
$$;

create or replace function proteger_composicion_kit() returns trigger language plpgsql as $$
declare c articulo_composiciones;
begin
 -- Publicación y cambios inversos de catálogo comparten un único cerrojo.
 -- Evita ciclos de kits y lecturas de tipo obsoletas entre dos transacciones.
 perform pg_advisory_xact_lock(hashtextextended('av_design:composiciones',0));
 if tg_table_name='articulo_composiciones' then
  if tg_op<>'INSERT' and old.publicada then
   if tg_op='DELETE' or new is distinct from old then
    raise exception 'Composicion publicada inmutable: cree otra version' using errcode='23514';
   end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if exists(select 1 from articulo_composicion_lineas where articulo_componente_id=new.articulo_kit_id) then
   raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
  if not exists(select 1 from articulos where id=new.articulo_kit_id and tipo='equipo' and unidad='ud') then
   raise exception 'El kit exige un articulo de equipo por unidad' using errcode='23514'; end if;
  if new.publicada and not exists(select 1 from articulo_composicion_lineas where composicion_id=new.id) then
   raise exception 'Una composicion publicada exige lineas' using errcode='23514'; end if;
  if new.publicada and new.estado_documental='documentada' and exists(select 1 from articulo_composicion_lineas
   where composicion_id=new.id and (inclusion='por_determinar' or (inclusion='incluido' and articulo_componente_id is null))) then
   raise exception 'La composicion contiene pendientes: debe ser parcial' using errcode='23514'; end if;
  return new;
 end if;
 select * into c from articulo_composiciones where id=case when tg_op='DELETE' then old.composicion_id else new.composicion_id end for update;
 if c.publicada or (tg_op='UPDATE' and exists(select 1 from articulo_composiciones where id=old.composicion_id and publicada)) then
  raise exception 'Las lineas publicadas son inmutables' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.articulo_componente_id=c.articulo_kit_id or exists(select 1 from articulo_composiciones where articulo_kit_id=new.articulo_componente_id) then
  raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
 if new.articulo_componente_id is not null and not exists(select 1 from articulos where id=new.articulo_componente_id and tipo='equipo' and unidad='ud') then
  raise exception 'Un componente fisico exige articulo de equipo por unidad' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists articulo_composiciones_proteger on articulo_composiciones;
create trigger articulo_composiciones_proteger before insert or update or delete on articulo_composiciones for each row execute function proteger_composicion_kit();
drop trigger if exists articulo_composicion_lineas_proteger on articulo_composicion_lineas;
create trigger articulo_composicion_lineas_proteger before insert or update or delete on articulo_composicion_lineas for each row execute function proteger_composicion_kit();

create or replace function proteger_suministro_kit() returns trigger language plpgsql as $$
declare l articulo_composicion_lineas; e sala_equipos;
begin
 if tg_table_name='sala_suministros' then
  if tg_op<>'INSERT' then
   if tg_op='DELETE' or new is distinct from old then
    raise exception 'Gestionar kit: retirada requiere revision de diseno registrada; cancelacion pendiente de gestion integral' using errcode='23514'; end if;
   return new;
  end if;
  perform 1 from salas where id=new.sala_id for update;
  perform 1 from articulo_composiciones where id=new.composicion_id and publicada for share;
  if not found or new.estado<>'activo' then raise exception 'El suministro exige composicion publicada y estado activo' using errcode='23514'; end if;
  new.snapshot=snapshot_composicion(new.composicion_id);
  return new;
 end if;
 if tg_op<>'INSERT' then
  if tg_op='DELETE' or new is distinct from old then
   raise exception 'Gestionar kit: no se puede desvincular una pieza incluida' using errcode='23514'; end if;
  return new;
 end if;
 perform 1 from sala_suministros where id=new.suministro_id for update;
 select * into l from articulo_composicion_lineas where id=new.linea_id;
 select * into e from sala_equipos where id=new.equipo_id for update;
 if l.inclusion is distinct from 'incluido' or l.articulo_componente_id is null or e.articulo_id is distinct from l.articulo_componente_id
  or e.cantidad is distinct from 1 or new.ordinal>l.cantidad then
  raise exception 'Componente incompatible: articulo, inclusion, ordinal o cantidad' using errcode='23514'; end if;
 new.snapshot=to_jsonb(l);
 return new;
end $$;
drop trigger if exists sala_suministros_proteger on sala_suministros;
create trigger sala_suministros_proteger before insert or update or delete on sala_suministros for each row execute function proteger_suministro_kit();
drop trigger if exists sala_componentes_suministro_proteger on sala_componentes_suministro;
create trigger sala_componentes_suministro_proteger before insert or update or delete on sala_componentes_suministro for each row execute function proteger_suministro_kit();

create or replace function comprobar_suministro_completo() returns trigger language plpgsql as $$
declare sid uuid;
begin
 if tg_table_name='sala_suministros' then sid=new.id; else sid=new.suministro_id; end if;
 if exists(select 1 from sala_suministros s join articulo_composicion_lineas l on l.composicion_id=s.composicion_id
  where s.id=sid and l.inclusion='incluido' and l.articulo_componente_id is not null
  and (select count(*) from sala_componentes_suministro p where p.suministro_id=s.id and p.linea_id=l.id)<>l.cantidad) then
  raise exception 'Suministro incompleto: equipo y vinculo deben confirmarse juntos' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists sala_suministros_completo on sala_suministros;
create constraint trigger sala_suministros_completo after insert on sala_suministros deferrable initially deferred for each row execute function comprobar_suministro_completo();
drop trigger if exists sala_componentes_suministro_completo on sala_componentes_suministro;
create constraint trigger sala_componentes_suministro_completo after insert on sala_componentes_suministro deferrable initially deferred for each row execute function comprobar_suministro_completo();

create or replace function proteger_equipo_de_kit() returns trigger language plpgsql as $$
begin
 if exists(select 1 from sala_componentes_suministro where equipo_id=old.id) then
  if tg_op='DELETE' or new.id is distinct from old.id or new.sala_id is distinct from old.sala_id
   or new.articulo_id is distinct from old.articulo_id or new.cantidad is distinct from old.cantidad then
   raise exception 'Gestionar kit: no se puede borrar ni cambiar la identidad o cantidad de una pieza incluida' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists sala_equipos_kit on sala_equipos;
create trigger sala_equipos_kit before update or delete on sala_equipos for each row execute function proteger_equipo_de_kit();

create or replace function proteger_articulo_de_kit() returns trigger language plpgsql as $$
begin
 if new.tipo is distinct from old.tipo or new.unidad is distinct from old.unidad then
  perform pg_advisory_xact_lock(hashtextextended('av_design:composiciones',0));
 end if;
 if (new.tipo<>'equipo' or new.unidad<>'ud') and
  (exists(select 1 from articulo_composiciones where articulo_kit_id=old.id)
   or exists(select 1 from articulo_composicion_lineas where articulo_componente_id=old.id)) then
  raise exception 'La composicion requiere equipos por unidad' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists articulos_kit on articulos;
create trigger articulos_kit before update on articulos for each row execute function proteger_articulo_de_kit();

-- Puerta temporal explícita L3A. Se retira con atribuciones reales L3B.
-- En sala/proyecto bloquea también destinos históricos: no asigna por parecido.
create or replace function exigir_logistica_sin_kits(sala uuid, proyecto uuid default null) returns void language plpgsql as $$
begin
 perform s.id from salas s left join localizaciones l on l.id=s.localizacion_id
  where s.id=sala or l.proyecto_id=proyecto order by s.id for update of s;
 if exists(select 1 from sala_suministros k join salas s on s.id=k.sala_id
  left join localizaciones l on l.id=s.localizacion_id where s.id=sala or l.proyecto_id=proyecto) then
  raise exception 'Kits pendientes de atribucion comercial: reserva, compra o carga no disponible' using errcode='23514'; end if;
end $$;
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid;
begin
 -- Comprueba destino anterior y nuevo para que cambiarlo no esquive la guarda.
 for fila in select value from jsonb_array_elements(case when tg_op='UPDATE' then jsonb_build_array(to_jsonb(old),to_jsonb(new)) else jsonb_build_array(to_jsonb(new)) end) loop
  sid=null; pid=null;
  if tg_table_name in ('movimientos','reservas','cargas','pedidos') then
   sid=(fila->>'sala_id')::uuid;
   if tg_table_name='pedidos' then pid=(fila->>'proyecto_id')::uuid; end if;
  elsif tg_table_name='carga_lineas' then
   select sala_id into sid from cargas where id=(fila->>'carga_id')::uuid;
  elsif tg_table_name='pedido_lineas' then
   select sala_id,proyecto_id into sid,pid from pedidos where id=(fila->>'pedido_id')::uuid;
  end if;
  perform exigir_logistica_sin_kits(sid,pid);
 end loop;
 return new;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['movimientos','reservas','cargas','pedidos','carga_lineas','pedido_lineas'] loop
  execute format('drop trigger if exists logistica_kit on %I',tabla);
  execute format('create trigger logistica_kit before insert or update on %I for each row execute function proteger_logistica_kit()',tabla);
 end loop;
end $$;
commit;

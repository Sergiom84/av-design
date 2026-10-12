-- BEGIN RECEPCION KITS B2A
alter table recepciones_compra add column if not exists protocolo text not null default 'legacy' check(protocolo in('legacy','kit_v1'));
alter table recepciones_compra add column if not exists transaccion xid8;
alter table recepciones_compra add column if not exists lineas_esperadas jsonb;
alter table recepciones_compra add column if not exists receptor_nombre text;
create table if not exists recepcion_lineas (
 recepcion_id uuid not null references recepciones_compra(id) on delete restrict,
 pedido_linea_id uuid not null references pedido_lineas(id) on delete restrict,
 cantidad numeric not null check(cantidad>0), recibido_previo numeric,
 articulo_id uuid references articulos(id) on delete restrict,
 sala_id uuid references salas(id) on delete restrict,
 ubicacion_id uuid references ubicaciones(id) on delete restrict,
 movimiento_id uuid unique, transaccion xid8,
 orden bigint generated always as identity,
 reparto_esperado jsonb,
 primary key(recepcion_id,pedido_linea_id)
);
create table if not exists recepcion_repartos (
 recepcion_id uuid not null, pedido_linea_id uuid not null,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 recibido_previo numeric not null, cantidad numeric not null check(cantidad=1),
 primary key(recepcion_id,pedido_linea_id,suministro_id),
 foreign key(recepcion_id,pedido_linea_id) references recepcion_lineas on delete restrict,
 foreign key(pedido_linea_id,suministro_id) references suministro_pedido_asignaciones on delete restrict
);

create or replace function pedido_tiene_kits(pid uuid) returns boolean language sql stable as $$
 select exists(select 1 from pedidos p join salas s on s.id=p.sala_id or exists(
   select 1 from localizaciones l where l.id=s.localizacion_id and l.proyecto_id=p.proyecto_id)
   join sala_suministros k on k.sala_id=s.id where p.id=pid)
$$;
create or replace function estado_recepcion_pedido(pid uuid) returns estado_pedido language sql stable as $$
 select case when not exists(select 1 from pedido_lineas where pedido_id=pid and cantidad_recibida<cantidad)
  then 'recibido'::estado_pedido when exists(select 1 from pedido_lineas where pedido_id=pid and cantidad_recibida>0)
  then 'recibido_parcial'::estado_pedido else p.estado end from pedidos p where id=pid
$$;

create or replace function preparar_token_recepcion() returns trigger language plpgsql as $$
declare p pedidos; actual pedidos; l pedido_lineas; q numeric; esperadas jsonb='[]'; ids_proyectos uuid[]; sid uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Token de recepcion inmutable' using errcode='23514'; end if;
 select * into p from pedidos where id=new.pedido_id;
 if not found then raise exception 'Pedido inexistente' using errcode='23503'; end if;
 select array_agg(distinct x) into ids_proyectos from (
  select p.proyecto_id x union select loc.proyecto_id from salas s join localizaciones loc on loc.id=s.localizacion_id where s.id=p.sala_id
 ) t where x is not null;
 perform s.id from salas s left join localizaciones loc on loc.id=s.localizacion_id
  where s.id=p.sala_id or loc.proyecto_id=any(coalesce(ids_proyectos,'{}')) order by s.id for update of s;
 perform id from proyectos where id=any(coalesce(ids_proyectos,'{}')) order by id for update;
 perform id from pedidos where id=p.id for update;
 select * into actual from pedidos where id=p.id;
 if actual.sala_id is distinct from p.sala_id or actual.proyecto_id is distinct from p.proyecto_id then
  raise exception 'El pedido ha cambiado de destino; recarga' using errcode='23514'; end if;
 p=actual;
 if exists(select 1 from hitos_proyecto where proyecto_id=any(coalesce(ids_proyectos,'{}')) and tipo='cierre') then
  raise exception 'El proyecto esta cerrado' using errcode='23514'; end if;
 new.protocolo=case when pedido_tiene_kits(p.id) then 'kit_v1' else 'legacy' end;
 new.transaccion=pg_current_xact_id(); new.lineas_esperadas=null;new.receptor_nombre=null;
 if new.protocolo='legacy' then return new; end if;
 if new.solicitud->>'pedidoId' is distinct from p.id::text or jsonb_typeof(new.solicitud)<>'object'
  or nullif(new.solicitud->>'autorId','') is null then raise exception 'Solicitud de recepcion incompatible' using errcode='23514'; end if;
 select nombre into new.receptor_nombre from usuarios where id=(new.solicitud->>'autorId')::uuid and activo;
 if new.receptor_nombre is null then raise exception 'La recepcion requiere usuario activo' using errcode='23514'; end if;
 if not exists(select 1 from ubicaciones where id=(new.solicitud->>'ubicacionId')::uuid) then
  raise exception 'Elige un almacen de recepcion' using errcode='23514'; end if;
 perform id from pedido_lineas where pedido_id=p.id order by id for update;
 if new.solicitud->>'lineaId' is not null and not exists(select 1 from pedido_lineas where pedido_id=p.id and id=(new.solicitud->>'lineaId')::uuid) then
  raise exception 'La linea no pertenece al pedido' using errcode='23514'; end if;
 for l in select * from pedido_lineas where pedido_id=p.id and
  (case when new.solicitud->>'lineaId' is null then cantidad_recibida<cantidad else id=(new.solicitud->>'lineaId')::uuid end) order by id loop
  q=case when new.solicitud->>'lineaId' is null then l.cantidad-l.cantidad_recibida else (new.solicitud->>'cantidad')::numeric end;
  if q is null or q<=0 or q>l.cantidad-l.cantidad_recibida or q::text in('NaN','Infinity','-Infinity') then
   raise exception 'La recepcion supera lo pendiente' using errcode='23514'; end if;
  if l.comprado_en is null or l.precio_orientativo then raise exception 'Primero registra la compra con oferta final' using errcode='23514'; end if;
  if exists(select 1 from articulo_composiciones where articulo_kit_id=l.articulo_id) then
   if q<>trunc(q) or not exists(select 1 from suministro_pedido_asignaciones where pedido_linea_id=l.id) then
    raise exception 'Kit exige unidades enteras y atribucion explicita previa' using errcode='23514'; end if;
  end if;
  esperadas=esperadas||jsonb_build_array(jsonb_build_object('linea',l.id,'cantidad',q,'previo',l.cantidad_recibida));
 end loop;
 for sid in select distinct a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas pl on pl.id=a.pedido_linea_id where pl.pedido_id=p.id order by 1 loop
  perform id from sala_suministros where id=sid for update;
 end loop;
 perform a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas pl on pl.id=a.pedido_linea_id where pl.pedido_id=p.id order by a.suministro_id for update of a;
 perform bloquear_atribuciones_kit();
 for sid in select distinct a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas pl on pl.id=a.pedido_linea_id where pl.pedido_id=p.id loop
  perform comprobar_atribuciones_de_suministro(sid);
 end loop;
 new.lineas_esperadas=esperadas; return new;
end $$;
drop trigger if exists recepcion_token_preparar on recepciones_compra;
create trigger recepcion_token_preparar before insert or update or delete on recepciones_compra for each row execute function preparar_token_recepcion();

create or replace function preparar_linea_recepcion() returns trigger language plpgsql as $$
declare t recepciones_compra; l pedido_lineas; p pedidos; e jsonb; a record; restante numeric; incremento numeric; reparto jsonb='[]';
begin
 if tg_op<>'INSERT' then raise exception 'Detalle de recepcion inmutable' using errcode='23514'; end if;
 select * into t from recepciones_compra where id=new.recepcion_id;
 if t.protocolo is distinct from 'kit_v1' or t.transaccion is distinct from pg_current_xact_id() then raise exception 'Detalle exige token de esta transaccion' using errcode='23514'; end if;
 select value into e from jsonb_array_elements(t.lineas_esperadas) where value->>'linea'=new.pedido_linea_id::text;
 if e is null or new.cantidad is distinct from (e->>'cantidad')::numeric then raise exception 'Detalle no solicitado' using errcode='23514'; end if;
 select * into l from pedido_lineas where id=new.pedido_linea_id for update;
 select * into p from pedidos where id=t.pedido_id;
 if l.pedido_id<>p.id or l.cantidad_recibida is distinct from (e->>'previo')::numeric or l.comprado_en is null or l.precio_orientativo
  or new.cantidad>l.cantidad-l.cantidad_recibida then raise exception 'Baseline o compra incompatible' using errcode='23514'; end if;
 if new.recibido_previo is not null or new.transaccion is not null or new.movimiento_id is not null or new.reparto_esperado is not null
  or new.articulo_id is not null or new.sala_id is not null or new.ubicacion_id is not null then
  raise exception 'Datos de recepcion impuestos por servidor' using errcode='23514'; end if;
 new.recibido_previo=l.cantidad_recibida; new.transaccion=pg_current_xact_id();new.articulo_id=l.articulo_id;
 new.sala_id=p.sala_id;new.ubicacion_id=(t.solicitud->>'ubicacionId')::uuid;new.movimiento_id=gen_random_uuid();
 restante=new.cantidad;
 for a in select * from suministro_pedido_asignaciones where pedido_linea_id=l.id order by creado_en,suministro_id for update loop
  incremento=least(restante,a.cantidad-a.cantidad_recibida_atribuida);
  if incremento>0 then
   if incremento<>1 then raise exception 'Recepcion de kit debe completar una unidad' using errcode='23514'; end if;
   reparto=reparto||jsonb_build_array(jsonb_build_object('suministro',a.suministro_id,'previo',a.cantidad_recibida_atribuida,'cantidad',incremento));
   restante=restante-incremento;
  end if;
 end loop;
 new.reparto_esperado=reparto;return new;
end $$;
drop trigger if exists recepcion_linea_preparar on recepcion_lineas;
create trigger recepcion_linea_preparar before insert or update or delete on recepcion_lineas for each row execute function preparar_linea_recepcion();

create or replace function proteger_reparto_recepcion() returns trigger language plpgsql as $$
begin
 if tg_op<>'INSERT' then raise exception 'Reparto de recepcion inmutable' using errcode='23514'; end if;
 if not exists(select 1 from recepcion_lineas d,jsonb_array_elements(d.reparto_esperado) e where d.recepcion_id=new.recepcion_id
  and d.pedido_linea_id=new.pedido_linea_id and d.transaccion=pg_current_xact_id() and e->>'suministro'=new.suministro_id::text
  and (e->>'previo')::numeric=new.recibido_previo and (e->>'cantidad')::numeric=new.cantidad) then
  raise exception 'Reparto no calculado por recepcion actual' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists recepcion_reparto_proteger on recepcion_repartos;
create trigger recepcion_reparto_proteger before insert or update or delete on recepcion_repartos for each row execute function proteger_reparto_recepcion();

create or replace function materializar_linea_recepcion() returns trigger language plpgsql as $$
declare e jsonb; pid uuid; actor text;
begin
 select pedido_id,receptor_nombre into pid,actor from recepciones_compra where id=new.recepcion_id;
 update pedido_lineas set cantidad_recibida=new.recibido_previo+new.cantidad where id=new.pedido_linea_id;
 insert into movimientos(id,articulo_id,ubicacion_id,tipo,cantidad,sala_id,motivo,quien,pedido_linea_id,recepcion_compra_id)
 values(new.movimiento_id,new.articulo_id,new.ubicacion_id,'entrada',new.cantidad,new.sala_id,'Recepcion de pedido',actor,new.pedido_linea_id,new.recepcion_id);
 for e in select value from jsonb_array_elements(new.reparto_esperado) loop
  insert into recepcion_repartos values(new.recepcion_id,new.pedido_linea_id,(e->>'suministro')::uuid,(e->>'previo')::numeric,(e->>'cantidad')::numeric);
  update suministro_pedido_asignaciones set cantidad_recibida_atribuida=(e->>'previo')::numeric+(e->>'cantidad')::numeric
   where pedido_linea_id=new.pedido_linea_id and suministro_id=(e->>'suministro')::uuid;
 end loop;
 update pedidos set estado=estado_recepcion_pedido(pid) where id=pid;
 return null;
end $$;
drop trigger if exists recepcion_linea_materializar on recepcion_lineas;
create trigger recepcion_linea_materializar after insert on recepcion_lineas for each row execute function materializar_linea_recepcion();

-- La linea resuelve el destino aunque una entrada compartida no tenga sala ni token.
create or replace function exigir_movimiento_pedido_sin_kits(linea uuid) returns void language plpgsql as $$
declare p pedidos; actual pedidos; pedido_actual uuid;
begin
 select pe.* into p from pedidos pe join pedido_lineas l on l.pedido_id=pe.id where l.id=linea;
 if not found then raise exception 'Linea de pedido inexistente' using errcode='23503'; end if;
 -- Mismo orden que recepcion: salas, proyecto, pedido y linea. Releer tras esperar.
 perform s.id from salas s left join localizaciones loc on loc.id=s.localizacion_id
  where s.id=p.sala_id or loc.proyecto_id=p.proyecto_id order by s.id for update of s;
 perform id from proyectos where id=p.proyecto_id for update;
 perform id from pedidos where id=p.id for update;
 select pedido_id into pedido_actual from pedido_lineas where id=linea for update;
 select * into actual from pedidos where id=p.id;
 if pedido_actual is distinct from p.id or actual.sala_id is distinct from p.sala_id
  or actual.proyecto_id is distinct from p.proyecto_id then
  raise exception 'El pedido ha cambiado de destino; recarga' using errcode='23514'; end if;
 if pedido_tiene_kits(actual.id) then
  raise exception 'Entrada sin detalle exacto de esta transaccion' using errcode='23514'; end if;
end $$;

-- Extiende L3A solo con hechos actuales de recepcion y transiciones exactas.
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid; admitida boolean=false;
begin
 if tg_table_name='pedido_lineas' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-'cantidad_recibida')=(to_jsonb(old)-'cantidad_recibida') and exists(
   select 1 from recepcion_lineas d where d.pedido_linea_id=new.id and d.transaccion=pg_current_xact_id()
   and old.cantidad_recibida=d.recibido_previo and new.cantidad_recibida=d.recibido_previo+d.cantidad);
 elsif tg_table_name='movimientos' and tg_op='INSERT' then
  admitida=exists(select 1 from recepcion_lineas d join recepciones_compra t on t.id=d.recepcion_id
   where d.movimiento_id=new.id and d.transaccion=pg_current_xact_id() and new.tipo='entrada' and new.articulo_id=d.articulo_id
   and new.cantidad=d.cantidad and new.sala_id is not distinct from d.sala_id and new.ubicacion_id=d.ubicacion_id
   and new.pedido_linea_id=d.pedido_linea_id and new.recepcion_compra_id=d.recepcion_id and new.quien=t.receptor_nombre);
 elsif tg_table_name='pedidos' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])
   and new.estado=estado_recepcion_pedido(new.id) and exists(select 1 from recepciones_compra t
    join recepcion_lineas d on d.recepcion_id=t.id where t.pedido_id=new.id and d.transaccion=pg_current_xact_id());
 end if;
 if admitida then return new; end if;
 for fila in select value from jsonb_array_elements(case when tg_op='UPDATE' then jsonb_build_array(to_jsonb(old),to_jsonb(new)) else jsonb_build_array(to_jsonb(new)) end) loop
  sid=null;pid=null;
  if tg_table_name='movimientos' and fila->>'pedido_linea_id' is not null then
   perform exigir_movimiento_pedido_sin_kits((fila->>'pedido_linea_id')::uuid);
  end if;
  if tg_table_name in('movimientos','reservas','cargas','pedidos') then sid=(fila->>'sala_id')::uuid;
   if tg_table_name='pedidos' then pid=(fila->>'proyecto_id')::uuid; end if;
  elsif tg_table_name='carga_lineas' then select sala_id into sid from cargas where id=(fila->>'carga_id')::uuid;
  elsif tg_table_name='pedido_lineas' then select sala_id,proyecto_id into sid,pid from pedidos where id=(fila->>'pedido_id')::uuid;
  end if;
  perform exigir_logistica_sin_kits(sid,pid);
 end loop;
 return new;
end $$;

create or replace function proteger_efecto_recepcion() returns trigger language plpgsql as $$
declare d recepcion_lineas;
begin
 if tg_table_name='movimientos' then
  if tg_op<>'INSERT' and old.recepcion_compra_id is not null then raise exception 'Movimiento de recepcion inmutable' using errcode='23514'; end if;
  if tg_op='INSERT' and exists(select 1 from recepciones_compra where id=new.recepcion_compra_id and protocolo='kit_v1') then
   if not exists(select 1 from recepcion_lineas l join recepciones_compra t on t.id=l.recepcion_id
    where l.movimiento_id=new.id and l.transaccion=pg_current_xact_id() and l.recepcion_id=new.recepcion_compra_id
    and l.pedido_linea_id=new.pedido_linea_id and l.articulo_id=new.articulo_id and l.ubicacion_id=new.ubicacion_id
    and l.sala_id is not distinct from new.sala_id and new.tipo='entrada' and l.cantidad=new.cantidad and new.quien=t.receptor_nombre) then
    raise exception 'Entrada sin detalle exacto de esta transaccion' using errcode='23514'; end if;
  end if;
 elsif tg_table_name='suministro_pedido_asignaciones' and tg_op='UPDATE' then
  if exists(select 1 from recepcion_lineas where pedido_linea_id=new.pedido_linea_id and transaccion=pg_current_xact_id())
   and new.cantidad_recibida_atribuida is distinct from old.cantidad_recibida_atribuida then
   if not exists(select 1 from recepcion_repartos r join recepcion_lineas l using(recepcion_id,pedido_linea_id)
    where r.pedido_linea_id=new.pedido_linea_id and r.suministro_id=new.suministro_id and l.transaccion=pg_current_xact_id()
    and r.recibido_previo=old.cantidad_recibida_atribuida and r.recibido_previo+r.cantidad=new.cantidad_recibida_atribuida) then
    raise exception 'Incremento atribuido sin reparto actual' using errcode='23514'; end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists recepcion_efecto_proteger on movimientos;
create trigger recepcion_efecto_proteger before insert or update or delete on movimientos for each row execute function proteger_efecto_recepcion();
drop trigger if exists recepcion_efecto_proteger on suministro_pedido_asignaciones;
create trigger recepcion_efecto_proteger before update on suministro_pedido_asignaciones for each row execute function proteger_efecto_recepcion();

create or replace function comprobar_recepcion_actual(rid uuid) returns void language plpgsql as $$
declare t recepciones_compra; e jsonb; d recepcion_lineas; x record;
begin
 select * into t from recepciones_compra where id=rid;
 if t.protocolo<>'kit_v1' then return; end if;
 if t.transaccion is distinct from pg_current_xact_id() then raise exception 'Recepcion ajena a esta transaccion' using errcode='23514'; end if;
 if (select count(*) from recepcion_lineas where recepcion_id=rid)<>jsonb_array_length(t.lineas_esperadas) then
  raise exception 'Recepcion incompleta desde token' using errcode='23514'; end if;
 for e in select value from jsonb_array_elements(t.lineas_esperadas) loop
  select * into d from recepcion_lineas where recepcion_id=rid and pedido_linea_id=(e->>'linea')::uuid;
  if not found or d.cantidad<>(e->>'cantidad')::numeric or d.recibido_previo<>(e->>'previo')::numeric then
   raise exception 'Detalle esperado ausente o alterado' using errcode='23514'; end if;
  if not exists(select 1 from movimientos m where m.id=d.movimiento_id and m.recepcion_compra_id=rid and m.pedido_linea_id=d.pedido_linea_id
   and m.tipo='entrada' and m.articulo_id=d.articulo_id and m.cantidad=d.cantidad and m.ubicacion_id=d.ubicacion_id
   and m.sala_id is not distinct from d.sala_id and m.quien=t.receptor_nombre) then
   raise exception 'Movimiento de recepcion ausente o alterado' using errcode='23514'; end if;
  if (select count(*) from recepcion_repartos where recepcion_id=rid and pedido_linea_id=d.pedido_linea_id)<>jsonb_array_length(d.reparto_esperado) then
   raise exception 'Reparto de recepcion incompleto' using errcode='23514'; end if;
 end loop;
 for x in select pedido_linea_id,(array_agg(recibido_previo order by orden))[1] previo,sum(cantidad) incremento
  from recepcion_lineas where transaccion=pg_current_xact_id() group by pedido_linea_id loop
  if not exists(select 1 from pedido_lineas where id=x.pedido_linea_id and cantidad_recibida=x.previo+x.incremento) then
   raise exception 'Saldo final de recepcion no coincide con todos los incrementos' using errcode='23514'; end if;
 end loop;
 for x in select r.pedido_linea_id,r.suministro_id,(array_agg(r.recibido_previo order by det.orden))[1] previo,sum(r.cantidad) incremento
  from recepcion_repartos r join recepcion_lineas det using(recepcion_id,pedido_linea_id)
  where det.transaccion=pg_current_xact_id() group by r.pedido_linea_id,r.suministro_id loop
  if not exists(select 1 from suministro_pedido_asignaciones where pedido_linea_id=x.pedido_linea_id and suministro_id=x.suministro_id
   and cantidad_recibida_atribuida=x.previo+x.incremento) then raise exception 'Saldo de reparto no coincide' using errcode='23514'; end if;
 end loop;
 if jsonb_array_length(t.lineas_esperadas)>0 and (select estado from pedidos where id=t.pedido_id)<>estado_recepcion_pedido(t.pedido_id) then
  raise exception 'Estado final de pedido incoherente' using errcode='23514'; end if;
end $$;
create or replace function validar_recepcion_actual() returns trigger language plpgsql as $$
declare rid uuid;
begin
 if tg_table_name='recepciones_compra' then perform comprobar_recepcion_actual(new.id);
 elsif tg_table_name in('recepcion_lineas','recepcion_repartos') then perform comprobar_recepcion_actual(new.recepcion_id);
 else
  for rid in select id from recepciones_compra where transaccion=pg_current_xact_id() and protocolo='kit_v1' loop
   perform comprobar_recepcion_actual(rid);
  end loop;
 end if;return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['recepciones_compra','recepcion_lineas','recepcion_repartos','pedido_lineas','movimientos','suministro_pedido_asignaciones','pedidos'] loop
  execute format('drop trigger if exists recepcion_completa on %I',tabla);
  execute format('create constraint trigger recepcion_completa after insert or update on %I deferrable initially deferred for each row execute function validar_recepcion_actual()',tabla);
 end loop;
end $$;
-- END RECEPCION KITS B2A

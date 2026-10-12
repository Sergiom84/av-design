-- BEGIN RESERVA KITS B2B
create or replace function tomar_control_escritura_kit() returns void language plpgsql as $$
begin
 if not pg_try_advisory_xact_lock(21440,2) then raise exception 'Control de escritura ocupado' using errcode='40001'; end if;
 update control_atribuciones_kit set revision=revision+1 where unico;
 if not found then raise exception 'Falta control de atribuciones' using errcode='23514'; end if;
end $$;
create or replace function bloquear_atribuciones_kit() returns void language plpgsql as $$
begin perform tomar_control_escritura_kit(); end $$;
create or replace function entrar_escritura_kit() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_level='STATEMENT' then return null; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create table if not exists articulos_stock_kit (
 articulo_id uuid primary key references articulos(id) on delete restrict,
 registrado_en timestamptz not null default now()
);
create table if not exists baselines_stock_kit (
 transaccion xid8 not null, articulo_id uuid not null,
 disponible numeric not null, primary key(transaccion,articulo_id)
);
create or replace function disponible_stock_kit(aid uuid) returns numeric language sql stable as $$
 select coalesce((select sum(cantidad) from existencias where articulo_id=aid),0)
  -coalesce((select sum(cantidad) from reservas where articulo_id=aid and estado='activa'),0)
$$;
create or replace function imponer_baseline_stock() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'Baseline inmutable' using errcode='23514'; end if;
 new.transaccion=pg_current_xact_id();new.disponible=disponible_stock_kit(new.articulo_id);return new;
end $$;
drop trigger if exists baseline_impuesto on baselines_stock_kit;
create trigger baseline_impuesto before insert or update or delete on baselines_stock_kit for each row execute function imponer_baseline_stock();
create or replace function capturar_baseline_stock(aid uuid) returns void language plpgsql as $$
begin
 if aid is not null then
  insert into baselines_stock_kit(transaccion,articulo_id,disponible) values(pg_current_xact_id(),aid,0) on conflict do nothing;
 end if;
end $$;
create or replace function proteger_perimetro_stock() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'El perimetro de kits es permanente' using errcode='23514'; end if;
 if not exists(select 1 from articulo_composiciones where articulo_kit_id=new.articulo_id)
  and not exists(select 1 from sala_suministros where articulo_id=new.articulo_id) then
  raise exception 'Perimetro sin fuente canonica' using errcode='23514'; end if;
 perform capturar_baseline_stock(new.articulo_id);return new;
end $$;
drop trigger if exists perimetro_proteger on articulos_stock_kit;
create trigger perimetro_proteger before insert or update or delete on articulos_stock_kit for each row execute function proteger_perimetro_stock();
create or replace function registrar_perimetro_stock() returns trigger language plpgsql as $$
declare aid uuid;
begin
 aid=case when tg_table_name='articulo_composiciones' then (to_jsonb(new)->>'articulo_kit_id')::uuid else (to_jsonb(new)->>'articulo_id')::uuid end;
 insert into articulos_stock_kit(articulo_id) values(aid) on conflict do nothing;return null;
end $$;
drop trigger if exists composicion_perimetro on articulo_composiciones;
create trigger composicion_perimetro after insert or update on articulo_composiciones for each row execute function registrar_perimetro_stock();
drop trigger if exists suministro_perimetro on sala_suministros;
create trigger suministro_perimetro after insert or update on sala_suministros for each row execute function registrar_perimetro_stock();
insert into articulos_stock_kit(articulo_id)
 select articulo_kit_id from articulo_composiciones union select articulo_id from sala_suministros on conflict do nothing;

create or replace function preparar_saldo_stock() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then perform capturar_baseline_stock(old.articulo_id); end if;
 if tg_op<>'DELETE' then perform capturar_baseline_stock(new.articulo_id); end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
create or replace function validar_deficit_stock() returns trigger language plpgsql as $$
declare b record;
begin
 for b in select bs.* from baselines_stock_kit bs join articulos_stock_kit p using(articulo_id) where transaccion=pg_current_xact_id() loop
  if greatest(0,-disponible_stock_kit(b.articulo_id))>greatest(0,-b.disponible) then
   raise exception 'La operacion agrava el deficit de stock del articulo %',b.articulo_id using errcode='23514'; end if;
 end loop;return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['movimientos','reservas'] loop
  execute format('drop trigger if exists aa_stock_baseline on %I',tabla);
  execute format('create trigger aa_stock_baseline before insert or update or delete on %I for each row execute function preparar_saldo_stock()',tabla);
 end loop;
 foreach tabla in array array['movimientos','reservas','articulos_stock_kit','baselines_stock_kit'] loop
  execute format('drop trigger if exists stock_deficit_validar on %I',tabla);
  execute format('create constraint trigger stock_deficit_validar after insert or update or delete on %I deferrable initially deferred for each row execute function validar_deficit_stock()',tabla);
 end loop;
end $$;

create table if not exists operaciones_reserva_kit (
 id uuid primary key, operacion text not null check(operacion in('reservar','liberar')),
 solicitud jsonb not null, suministro_id uuid references sala_suministros(id) on delete restrict,
 reserva_id uuid not null, transaccion xid8, articulo_id uuid references articulos(id) on delete restrict,
 sala_id uuid references salas(id) on delete restrict, usuario_id uuid references usuarios(id) on delete restrict,
 autor_nombre text, estado_previo text, disponible_previo numeric,
 orden bigint generated always as identity,
 creado_en timestamptz not null default now()
);
create or replace function preparar_operacion_reserva() returns trigger language plpgsql as $$
declare s sala_suministros; r reservas; pid uuid; servido numeric;
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'Operacion de reserva inmutable' using errcode='23514'; end if;
 if new.transaccion is not null or new.articulo_id is not null or new.sala_id is not null or new.usuario_id is not null
  or new.autor_nombre is not null or new.estado_previo is not null or new.disponible_previo is not null then
  raise exception 'Baseline de reserva impuesto por servidor' using errcode='23514'; end if;
 new.usuario_id=(new.solicitud->>'autorId')::uuid;
 select nombre into new.autor_nombre from usuarios where id=new.usuario_id and activo;
 if new.autor_nombre is null then raise exception 'Reserva requiere usuario activo' using errcode='23514'; end if;
 if new.operacion='reservar' then
  new.suministro_id=(new.solicitud->>'suministroId')::uuid;new.reserva_id=gen_random_uuid();new.estado_previo=null;
 else
  new.reserva_id=(new.solicitud->>'reservaId')::uuid;
  select * into r from reservas where id=new.reserva_id;
  select suministro_id into new.suministro_id from operaciones_reserva_kit where reserva_id=r.id and operacion='reservar';
  if not found then raise exception 'Solo se libera una reserva gestionada unitaria' using errcode='23514'; end if;
  new.estado_previo=r.estado;
 end if;
 select * into s from sala_suministros where id=new.suministro_id;
 if not found or s.estado<>'activo' then raise exception 'Suministro activo requerido' using errcode='23514'; end if;
 perform id from salas where id=s.sala_id for update;
 select l.proyecto_id into pid from salas sa left join localizaciones l on l.id=sa.localizacion_id where sa.id=s.sala_id;
 perform id from proyectos where id=pid for update;
 if exists(select 1 from hitos_proyecto where proyecto_id=pid and tipo='cierre') then raise exception 'Proyecto cerrado' using errcode='23514'; end if;
 perform id from sala_suministros where id=s.id for update;
 new.articulo_id=s.articulo_id;new.sala_id=s.sala_id;new.transaccion=pg_current_xact_id();
 perform capturar_baseline_stock(s.articulo_id);new.disponible_previo=disponible_stock_kit(s.articulo_id);
 if new.operacion='reservar' then
  perform comprobar_atribuciones_de_suministro(s.id);
  select coalesce(sum(case m.tipo when 'salida' then a.cantidad when 'devolucion' then -a.cantidad else 0 end),0) into servido
   from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=s.id;
  if servido>0 or exists(select 1 from reserva_suministros a join reservas rr on rr.id=a.reserva_id where a.suministro_id=s.id and rr.estado='activa') then
   raise exception 'El suministro ya esta cubierto' using errcode='23514'; end if;
  if new.disponible_previo<1 then raise exception 'No hay una unidad disponible' using errcode='23514'; end if;
 else
  select * into r from reservas where id=new.reserva_id for update;
  if r.estado<>'activa' or r.cantidad<>1 or r.articulo_id<>s.articulo_id or r.sala_id<>s.sala_id
   or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
   or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=s.id and cantidad=1) then
   raise exception 'La reserva gestionada no esta activa o no es unitaria' using errcode='23514'; end if;
 end if;
 return new;
end $$;
drop trigger if exists operacion_reserva_preparar on operaciones_reserva_kit;
create trigger operacion_reserva_preparar before insert or update or delete on operaciones_reserva_kit for each row execute function preparar_operacion_reserva();
create or replace function materializar_operacion_reserva() returns trigger language plpgsql as $$
begin
 if new.operacion='reservar' then
  insert into reservas(id,sala_id,articulo_id,cantidad,estado,quien) values(new.reserva_id,new.sala_id,new.articulo_id,1,'activa',new.autor_nombre);
  insert into reserva_suministros(reserva_id,suministro_id,cantidad) values(new.reserva_id,new.suministro_id,1);
  if disponible_stock_kit(new.articulo_id)<>new.disponible_previo-1 or disponible_stock_kit(new.articulo_id)<0 then
   raise exception 'Saldo posterior a reserva incompatible' using errcode='23514'; end if;
 else
  update reservas set estado='liberada' where id=new.reserva_id;
  if disponible_stock_kit(new.articulo_id)<>new.disponible_previo+1 then raise exception 'Saldo posterior a liberacion incompatible' using errcode='23514'; end if;
 end if;return null;
end $$;
drop trigger if exists operacion_reserva_materializar on operaciones_reserva_kit;
create trigger operacion_reserva_materializar after insert on operaciones_reserva_kit for each row execute function materializar_operacion_reserva();
create or replace function proteger_reserva_gestionada() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op='INSERT' then return new; end if;
 if exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='reservar') then
  if tg_op='DELETE' then raise exception 'Reserva gestionada conserva historial' using errcode='23514'; end if;
  if old.estado<>'activa' or new.estado<>'liberada'
   or (to_jsonb(new)-array['estado','actualizado_en']) is distinct from (to_jsonb(old)-array['estado','actualizado_en'])
   or not exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='liberar'
    and transaccion=pg_current_xact_id() and estado_previo=old.estado) then
   raise exception 'Transicion de reserva sin hecho actual exacto' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists reserva_gestionada_proteger on reservas;
create trigger reserva_gestionada_proteger before insert or update or delete on reservas for each row execute function proteger_reserva_gestionada();
create or replace function validar_operacion_reserva() returns trigger language plpgsql as $$
declare o operaciones_reserva_kit; r reservas; ultimo text;
begin
 for o in select * from operaciones_reserva_kit where transaccion=pg_current_xact_id() loop
  select * into r from reservas where id=o.reserva_id;
  select case operacion when 'reservar' then 'activa' else 'liberada' end into ultimo from operaciones_reserva_kit where reserva_id=o.reserva_id order by orden desc limit 1;
  if r.id is null or r.cantidad<>1 or r.articulo_id<>o.articulo_id or r.sala_id<>o.sala_id or r.estado<>ultimo
   or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
   or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=o.suministro_id and cantidad=1) then
   raise exception 'Operacion de reserva incompleta' using errcode='23514'; end if;
 end loop;return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['operaciones_reserva_kit','reservas','reserva_suministros'] loop
  execute format('drop trigger if exists reserva_operacion_completa on %I',tabla);
  execute format('create constraint trigger reserva_operacion_completa after insert or update on %I deferrable initially deferred for each row execute function validar_operacion_reserva()',tabla);
 end loop;
 -- SQL directo toma control antes de filas/FK; fila respalda cascadas.
 foreach tabla in array array['articulos','articulo_composiciones','articulo_composicion_lineas','sala_suministros','sala_componentes_suministro',
  'salas','localizaciones','proyectos','hitos_proyecto','pedidos','pedido_lineas','recepciones_compra','recepcion_lineas','recepcion_repartos',
  'movimientos','reservas','cargas','carga_lineas','suministro_pedido_asignaciones','reserva_suministros','movimiento_suministros','operaciones_reserva_kit','articulos_stock_kit'] loop
  execute format('drop trigger if exists aa_control_statement on %I',tabla);
  execute format('create trigger aa_control_statement before insert or update or delete on %I for each statement execute function entrar_escritura_kit()',tabla);
  execute format('drop trigger if exists aa_control_fila on %I',tabla);
  execute format('create trigger aa_control_fila before insert or update or delete on %I for each row execute function entrar_escritura_kit()',tabla);
 end loop;
end $$;
-- Retira únicamente los triggers añadidos al equipo en el ensayo local previo.
-- La lista contractual controla los vínculos; no amplía el mutex a sala_equipos.
drop trigger if exists aa_control_statement on sala_equipos;
drop trigger if exists aa_control_fila on sala_equipos;
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid; admitida boolean=false;
begin
 if tg_table_name='reservas' then
 if exists(select 1 from operaciones_reserva_kit o where o.reserva_id=new.id and o.transaccion=pg_current_xact_id()
  and o.articulo_id=new.articulo_id and o.sala_id=new.sala_id and new.cantidad=1 and (
   (tg_op='INSERT' and o.operacion='reservar' and new.estado='activa' and new.quien=o.autor_nombre)
   or (tg_op='UPDATE' and o.operacion='liberar' and old.estado=o.estado_previo and old.estado='activa' and new.estado='liberada'
    and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])))) then return new; end if;
 end if;
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
-- END RESERVA KITS B2B

begin;

-- BEGIN ATRIBUCIONES SUMINISTRO L3B
create table if not exists control_atribuciones_kit (
 unico boolean primary key default true check(unico),
 revision bigint not null default 0
);
insert into control_atribuciones_kit(unico) values(true) on conflict do nothing;

create table if not exists suministro_pedido_asignaciones (
 pedido_linea_id uuid not null references pedido_lineas(id) on delete restrict,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 cantidad numeric not null check(cantidad=1),
 cantidad_recibida_atribuida numeric not null default 0 check(cantidad_recibida_atribuida in(0,1)),
 creado_en timestamptz not null default now(),
 primary key(pedido_linea_id,suministro_id)
);
create index if not exists suministro_pedido_suministro_idx on suministro_pedido_asignaciones(suministro_id);
create table if not exists reserva_suministros (
 reserva_id uuid not null references reservas(id) on delete restrict,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 cantidad numeric not null check(cantidad=1),
 creado_en timestamptz not null default now(),
 primary key(reserva_id,suministro_id)
);
create index if not exists reserva_suministros_suministro_idx on reserva_suministros(suministro_id);
create table if not exists movimiento_suministros (
 movimiento_id uuid not null references movimientos(id) on delete restrict,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 cantidad numeric not null check(cantidad=1),
 salida_movimiento_id uuid,
 creado_en timestamptz not null default now(),
 primary key(movimiento_id,suministro_id),
 foreign key(salida_movimiento_id,suministro_id) references movimiento_suministros(movimiento_id,suministro_id) on delete restrict deferrable initially deferred
);
create index if not exists movimiento_suministros_suministro_idx on movimiento_suministros(suministro_id);
create index if not exists movimiento_suministros_salida_idx on movimiento_suministros(salida_movimiento_id,suministro_id);

-- La escritura de revision evita write skew también con instantáneas RR.
-- Solo serializa escrituras de atribuciones/canónicos que ya tienen vínculos.
create or replace function bloquear_atribuciones_kit() returns void language plpgsql as $$
begin
 update control_atribuciones_kit set revision=revision+1 where unico;
 if not found then raise exception 'Falta control de atribuciones' using errcode='23514'; end if;
end $$;

create or replace function proteger_atribuciones_kit() returns trigger language plpgsql as $$
begin
 if tg_op='INSERT' then
  if tg_table_name='suministro_pedido_asignaciones' then
   perform 1 from pedido_lineas where id=new.pedido_linea_id for update;
  elsif tg_table_name='reserva_suministros' then
   perform 1 from reservas where id=new.reserva_id for update;
  else
   perform 1 from movimientos where id=new.movimiento_id for update;
  end if;
  perform 1 from sala_suministros where id=new.suministro_id for update;
 end if;
 perform bloquear_atribuciones_kit();
 if tg_op='DELETE' then
  raise exception 'La atribucion conserva historial; no se borra' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
  -- Solo aumenta el recibido del mismo pedido. Cancelación integral espera L3D.
  if tg_table_name<>'suministro_pedido_asignaciones'
   or (to_jsonb(new)-'cantidad_recibida_atribuida') is distinct from (to_jsonb(old)-'cantidad_recibida_atribuida')
   or (to_jsonb(new)->>'cantidad_recibida_atribuida')::int < (to_jsonb(old)->>'cantidad_recibida_atribuida')::int then
   raise exception 'No se reasigna ni reduce una atribucion historica' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create or replace function comprobar_atribuciones_de_suministro(sid uuid) returns void language plpgsql as $$
declare s sala_suministros; pedidos_total numeric; reservado numeric; servido numeric;
begin
 select * into s from sala_suministros where id=sid;
 if not found then raise exception 'Suministro inexistente' using errcode='23503'; end if;
 if exists(select 1 from suministro_pedido_asignaciones a join pedido_lineas l on l.id=a.pedido_linea_id
   join pedidos p on p.id=l.pedido_id left join salas sala on sala.id=s.sala_id
   left join localizaciones loc on loc.id=sala.localizacion_id
   where a.suministro_id=sid and (l.articulo_id<>s.articulo_id
    or (p.sala_id is not null and p.sala_id<>s.sala_id)
    or (p.proyecto_id is not null and p.proyecto_id is distinct from loc.proyecto_id)
    or (p.sala_id is null and (p.proyecto_id is null or p.proyecto_id is distinct from loc.proyecto_id)))) then
  raise exception 'Pedido incompatible con articulo o destino del suministro' using errcode='23514'; end if;
 if exists(select 1 from pedido_lineas l where l.id in
   (select pedido_linea_id from suministro_pedido_asignaciones where suministro_id=sid)
   and ((select sum(cantidad) from suministro_pedido_asignaciones where pedido_linea_id=l.id)>l.cantidad
    or (select sum(cantidad_recibida_atribuida) from suministro_pedido_asignaciones where pedido_linea_id=l.id)>l.cantidad_recibida)) then
  raise exception 'Atribucion supera cantidad o recepcion de la linea de pedido' using errcode='23514'; end if;
 select coalesce(sum(cantidad),0) into pedidos_total from suministro_pedido_asignaciones where suministro_id=sid;
 if pedidos_total>1 then raise exception 'Pedido atribuido supera demanda' using errcode='23514'; end if;

 if exists(select 1 from reserva_suministros a join reservas r on r.id=a.reserva_id where a.suministro_id=sid
   and (r.articulo_id<>s.articulo_id or r.sala_id<>s.sala_id)) then
  raise exception 'Reserva incompatible con articulo o sala' using errcode='23514'; end if;
 if exists(select 1 from reservas r where r.id in(select reserva_id from reserva_suministros where suministro_id=sid)
   and (select sum(cantidad) from reserva_suministros where reserva_id=r.id)>r.cantidad) then
  raise exception 'Atribucion supera cantidad de reserva' using errcode='23514'; end if;

 if exists(select 1 from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=sid
   and (m.articulo_id<>s.articulo_id or m.sala_id is distinct from s.sala_id
    or m.tipo not in('entrada','salida','devolucion','baja')
    or (m.tipo='devolucion' and a.salida_movimiento_id is null)
    or (m.tipo in('entrada','salida') and a.salida_movimiento_id is not null))) then
  raise exception 'Movimiento incompatible con articulo, sala o retorno' using errcode='23514'; end if;
 if exists(select 1 from movimientos m where m.id in(select movimiento_id from movimiento_suministros where suministro_id=sid)
   and (select sum(cantidad) from movimiento_suministros where movimiento_id=m.id)>m.cantidad) then
  raise exception 'Atribucion supera cantidad del movimiento' using errcode='23514'; end if;
 if exists(select 1 from movimiento_suministros a left join movimiento_suministros origen
    on origen.movimiento_id=a.salida_movimiento_id and origen.suministro_id=a.suministro_id
   left join movimientos m on m.id=origen.movimiento_id where a.suministro_id=sid
   and a.salida_movimiento_id is not null and (origen.movimiento_id is null or m.tipo<>'salida')) then
  raise exception 'Retorno exige salida atribuida del mismo suministro' using errcode='23514'; end if;
 if exists(select 1 from movimiento_suministros origen where origen.suministro_id=sid and
   (select coalesce(sum(a.cantidad),0) from movimiento_suministros a join movimientos m on m.id=a.movimiento_id
    where a.salida_movimiento_id=origen.movimiento_id and a.suministro_id=sid and m.tipo='devolucion')>origen.cantidad) then
  raise exception 'Devoluciones superan salida atribuida' using errcode='23514'; end if;
 select coalesce(sum(a.cantidad),0) into reservado from reserva_suministros a join reservas r on r.id=a.reserva_id
  where a.suministro_id=sid and r.estado='activa';
 select coalesce(sum(case m.tipo when 'salida' then a.cantidad when 'devolucion' then -a.cantidad else 0 end),0)
  into servido from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=sid;
 if servido<0 or reservado+servido>(case when s.estado='activo' then 1 else 0 end) then
  raise exception 'Cobertura atribuida supera demanda activa' using errcode='23514'; end if;
end $$;

create or replace function validar_atribucion_kit() returns trigger language plpgsql as $$
begin
 perform comprobar_atribuciones_de_suministro(new.suministro_id);
 return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['suministro_pedido_asignaciones','reserva_suministros','movimiento_suministros'] loop
  execute format('drop trigger if exists atribucion_proteger on %I',tabla);
  execute format('create trigger atribucion_proteger before insert or update or delete on %I for each row execute function proteger_atribuciones_kit()',tabla);
  execute format('drop trigger if exists atribucion_validar on %I',tabla);
  execute format('create constraint trigger atribucion_validar after insert or update on %I deferrable initially deferred for each row execute function validar_atribucion_kit()',tabla);
 end loop;
end $$;

-- Inversas: identificar suministros afectados también por traslado de jerarquía.
create or replace function suministros_afectados_por_atribucion(tabla text, fila jsonb) returns setof uuid language sql stable as $$
 select suministro_id from suministro_pedido_asignaciones where tabla='pedido_lineas' and pedido_linea_id=(fila->>'id')::uuid
 union select a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas l on l.id=a.pedido_linea_id where tabla='pedidos' and l.pedido_id=(fila->>'id')::uuid
 union select suministro_id from reserva_suministros where tabla='reservas' and reserva_id=(fila->>'id')::uuid
 union select suministro_id from movimiento_suministros where tabla='movimientos' and movimiento_id=(fila->>'id')::uuid
 union select id from sala_suministros where tabla='salas' and sala_id=(fila->>'id')::uuid
 union select s.id from sala_suministros s join salas sa on sa.id=s.sala_id where tabla='localizaciones' and sa.localizacion_id=(fila->>'id')::uuid
 union select id from sala_suministros where tabla='sala_suministros' and id=(fila->>'id')::uuid
$$;
create or replace function proteger_inversa_atribucion_kit() returns trigger language plpgsql as $$
begin
 if exists(select 1 from suministros_afectados_por_atribucion(tg_table_name,to_jsonb(old))) then
  perform bloquear_atribuciones_kit();
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create or replace function validar_inversa_atribucion_kit() returns trigger language plpgsql as $$
declare sid uuid;
begin
 for sid in select * from suministros_afectados_por_atribucion(tg_table_name,to_jsonb(new)) order by 1 loop
  perform comprobar_atribuciones_de_suministro(sid);
 end loop;
 return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['pedido_lineas','pedidos','reservas','movimientos','salas','localizaciones','sala_suministros'] loop
  execute format('drop trigger if exists atribucion_inversa_proteger on %I',tabla);
  execute format('create trigger atribucion_inversa_proteger before update or delete on %I for each row execute function proteger_inversa_atribucion_kit()',tabla);
  execute format('drop trigger if exists atribucion_inversa_validar on %I',tabla);
  execute format('create constraint trigger atribucion_inversa_validar after update on %I deferrable initially deferred for each row execute function validar_inversa_atribucion_kit()',tabla);
 end loop;
end $$;
-- END ATRIBUCIONES SUMINISTRO L3B
commit;

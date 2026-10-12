-- BEGIN CARGA KITS B2C
-- Preparar una carga desde una reserva gestionada, marcar su unidad y
-- confirmar la salida desde una ubicación elegida expresamente. Cantidad 1.
-- Preparar no mueve stock ni sirve la reserva; marcar es "listo para cargar",
-- no salida; solo confirmar escribe el movimiento comercial y su atribución.
create table if not exists operaciones_carga_kit (
 id uuid primary key,
 operacion text not null check(operacion in('preparar','marcar','servir')),
 solicitud jsonb not null,
 transaccion xid8,
 reserva_id uuid references reservas(id) on delete restrict,
 suministro_id uuid references sala_suministros(id) on delete restrict,
 -- carga/línea/movimiento nacen en la misma TX: la FK restrictiva se aplaza al commit.
 carga_id uuid references cargas(id) on delete restrict deferrable initially deferred,
 linea_id uuid references carga_lineas(id) on delete restrict deferrable initially deferred,
 sala_id uuid references salas(id) on delete restrict,
 articulo_id uuid references articulos(id) on delete restrict,
 usuario_id uuid references usuarios(id) on delete restrict,
 autor_nombre text,
 cantidad numeric check(cantidad=1),
 marcado boolean, marcado_previo boolean,
 -- La procedencia histórica de la salida es restrictiva: no depende del SET NULL
 -- que movimientos.ubicacion_id aplica al borrar la ubicación.
 ubicacion_id uuid references ubicaciones(id) on delete restrict,
 movimiento_id uuid references movimientos(id) on delete restrict deferrable initially deferred,
 existencia_previa numeric, disponible_previo numeric,
 reutilizada boolean not null default false,
 orden bigint generated always as identity,
 creado_en timestamptz not null default now()
);
do $$ begin
 alter table operaciones_carga_kit drop constraint if exists operaciones_carga_kit_carga_id_fkey;
 alter table operaciones_carga_kit add constraint operaciones_carga_kit_carga_id_fkey foreign key(carga_id) references cargas(id) on delete restrict deferrable initially deferred;
 alter table operaciones_carga_kit drop constraint if exists operaciones_carga_kit_linea_id_fkey;
 alter table operaciones_carga_kit add constraint operaciones_carga_kit_linea_id_fkey foreign key(linea_id) references carga_lineas(id) on delete restrict deferrable initially deferred;
 alter table operaciones_carga_kit drop constraint if exists operaciones_carga_kit_movimiento_id_fkey;
 alter table operaciones_carga_kit add constraint operaciones_carga_kit_movimiento_id_fkey foreign key(movimiento_id) references movimientos(id) on delete restrict deferrable initially deferred;
end $$;
create unique index if not exists carga_kit_preparacion_reserva on operaciones_carga_kit(reserva_id) where operacion='preparar' and not reutilizada;
create unique index if not exists carga_kit_preparacion_carga on operaciones_carga_kit(carga_id) where operacion='preparar' and not reutilizada;
create unique index if not exists carga_kit_preparacion_linea on operaciones_carga_kit(linea_id) where operacion='preparar' and not reutilizada;
create unique index if not exists carga_kit_salida_reserva on operaciones_carga_kit(reserva_id) where operacion='servir';
create unique index if not exists carga_kit_salida_linea on operaciones_carga_kit(linea_id) where operacion='servir';
create unique index if not exists carga_kit_salida_carga on operaciones_carga_kit(carga_id) where operacion='servir';
create index if not exists carga_kit_linea_idx on operaciones_carga_kit(linea_id);
create index if not exists carga_kit_movimiento_idx on operaciones_carga_kit(movimiento_id);

create or replace function preparar_operacion_carga() returns trigger language plpgsql as $$
declare r reservas; s sala_suministros; c cargas; l carga_lineas; pid uuid; previa operaciones_carga_kit;
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'Operacion de carga inmutable' using errcode='23514'; end if;
 if new.transaccion is not null or new.reserva_id is not null or new.suministro_id is not null
  or new.carga_id is not null or new.linea_id is not null or new.sala_id is not null
  or new.articulo_id is not null or new.usuario_id is not null or new.autor_nombre is not null
  or new.cantidad is not null or new.marcado is not null or new.marcado_previo is not null
  or new.ubicacion_id is not null or new.movimiento_id is not null
  or new.existencia_previa is not null or new.disponible_previo is not null or new.reutilizada then
  raise exception 'Baseline de carga impuesto por servidor' using errcode='23514'; end if;
 if jsonb_typeof(new.solicitud)<>'object' then raise exception 'Solicitud de carga incompatible' using errcode='23514'; end if;
 new.usuario_id=(new.solicitud->>'autorId')::uuid;
 select nombre into new.autor_nombre from usuarios where id=new.usuario_id and activo;
 if new.autor_nombre is null then raise exception 'La carga requiere usuario activo' using errcode='23514'; end if;
 new.transaccion=pg_current_xact_id(); new.cantidad=1;

 if new.operacion='preparar' then
  new.reserva_id=(new.solicitud->>'reservaId')::uuid;
 elsif new.operacion='marcar' then
  new.linea_id=(new.solicitud->>'lineaId')::uuid;
  if jsonb_typeof(new.solicitud->'valor')<>'boolean' then
   raise exception 'Marcar exige un valor explicito' using errcode='23514'; end if;
  new.marcado=(new.solicitud->>'valor')::boolean;
  select * into previa from operaciones_carga_kit where operacion='preparar' and not reutilizada and linea_id=new.linea_id;
  if not found then raise exception 'Solo se marca una linea de carga gestionada' using errcode='23514'; end if;
  new.reserva_id=previa.reserva_id; new.carga_id=previa.carga_id;
 else
  new.carga_id=(new.solicitud->>'cargaId')::uuid;
  new.ubicacion_id=(new.solicitud->>'ubicacionId')::uuid;
  select * into previa from operaciones_carga_kit where operacion='preparar' and not reutilizada and carga_id=new.carga_id;
  if not found then raise exception 'Solo se confirma una carga gestionada' using errcode='23514'; end if;
  new.reserva_id=previa.reserva_id; new.linea_id=previa.linea_id;
 end if;

 -- Identidad gestionada: se elige la reserva, nunca se infiere el suministro.
 select suministro_id into new.suministro_id from operaciones_reserva_kit where reserva_id=new.reserva_id and operacion='reservar';
 if not found then raise exception 'Solo se carga una reserva gestionada unitaria' using errcode='23514'; end if;
 select * into s from sala_suministros where id=new.suministro_id;
 if not found or s.estado<>'activo' then raise exception 'Suministro activo requerido' using errcode='23514'; end if;
 -- Mismo orden de locks que B2a/B2b: salas, proyecto, suministro, reserva.
 perform id from salas where id=s.sala_id for update;
 select loc.proyecto_id into pid from salas sa left join localizaciones loc on loc.id=sa.localizacion_id where sa.id=s.sala_id;
 perform id from proyectos where id=pid for update;
 if exists(select 1 from hitos_proyecto where proyecto_id=pid and tipo='cierre') then
  raise exception 'Proyecto cerrado' using errcode='23514'; end if;
 perform id from sala_suministros where id=s.id for update;
 new.sala_id=s.sala_id; new.articulo_id=s.articulo_id;
 select * into r from reservas where id=new.reserva_id for update;
 if r.estado<>'activa' or r.cantidad<>1 or r.articulo_id<>s.articulo_id or r.sala_id<>s.sala_id
  or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
  or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=s.id and cantidad=1) then
  raise exception 'La reserva gestionada no esta activa o no es unitaria' using errcode='23514'; end if;

 if new.operacion='preparar' then
  -- Máximo una preparación gestionada por reserva: otro token devuelve la suya.
  select * into previa from operaciones_carga_kit where operacion='preparar' and not reutilizada and reserva_id=new.reserva_id;
  if found then new.reutilizada=true; new.carga_id=previa.carga_id; new.linea_id=previa.linea_id;
  else new.carga_id=gen_random_uuid(); new.linea_id=gen_random_uuid(); end if;
  return new;
 end if;

 select * into c from cargas where id=new.carga_id for update;
 if c.estado<>'preparacion' then raise exception 'La carga ya no esta en preparacion' using errcode='23514'; end if;
 if c.sala_id<>new.sala_id then raise exception 'La carga no pertenece a la sala del suministro' using errcode='23514'; end if;
 select * into l from carga_lineas where id=new.linea_id for update;
 if l.carga_id<>new.carga_id or l.articulo_id<>new.articulo_id or l.reserva_id is distinct from new.reserva_id or l.cantidad<>1 then
  raise exception 'La linea de carga no coincide con la reserva gestionada' using errcode='23514'; end if;
 if exists(select 1 from operaciones_carga_kit where operacion='servir' and linea_id=new.linea_id) then
  raise exception 'La carga ya salio del almacen' using errcode='23514'; end if;

 if new.operacion='marcar' then new.marcado_previo=l.cargado; return new; end if;

 if not l.cargado then raise exception 'Marca la linea antes de confirmar la salida' using errcode='23514'; end if;
 -- «Ajena» es inexistente o distinta de la solicitud: no hay propiedad de
 -- almacén por sala. Cualquier ubicación existente con saldo local vale.
 if new.ubicacion_id is null then raise exception 'Elige la ubicacion de la que sale el material' using errcode='23514'; end if;
 perform id from ubicaciones where id=new.ubicacion_id for key share;
 if not found then raise exception 'Elige la ubicacion de la que sale el material' using errcode='23514'; end if;
 perform capturar_baseline_stock(s.articulo_id);
 new.disponible_previo=disponible_stock_kit(s.articulo_id);
 new.existencia_previa=coalesce((select cantidad from existencias where articulo_id=s.articulo_id and ubicacion_id=new.ubicacion_id),0);
 if new.existencia_previa<1 then raise exception 'No hay una unidad en esa ubicacion' using errcode='23514'; end if;
 new.movimiento_id=gen_random_uuid();
 return new;
end $$;
drop trigger if exists operacion_carga_preparar on operaciones_carga_kit;
create trigger operacion_carga_preparar before insert or update or delete on operaciones_carga_kit for each row execute function preparar_operacion_carga();

create or replace function materializar_operacion_carga() returns trigger language plpgsql as $$
declare nombre text;
begin
 if new.operacion='preparar' then
  if new.reutilizada then return null; end if;
  select 'Carga · '||sa.nombre into nombre from salas sa where sa.id=new.sala_id;
  insert into cargas(id,sala_id,nombre,estado,quien) values(new.carga_id,new.sala_id,nombre,'preparacion',new.autor_nombre);
  insert into carga_lineas(id,carga_id,articulo_id,reserva_id,cantidad,cargado)
   values(new.linea_id,new.carga_id,new.articulo_id,new.reserva_id,1,false);
 elsif new.operacion='marcar' then
  if new.marcado is distinct from new.marcado_previo then
   update carga_lineas set cargado=new.marcado where id=new.linea_id; end if;
 else
  update reservas set estado='servida' where id=new.reserva_id;
  insert into movimientos(id,articulo_id,ubicacion_id,tipo,cantidad,sala_id,motivo,quien)
   values(new.movimiento_id,new.articulo_id,new.ubicacion_id,'salida',1,new.sala_id,'Carga de kit a obra',new.autor_nombre);
  insert into movimiento_suministros(movimiento_id,suministro_id,cantidad) values(new.movimiento_id,new.suministro_id,1);
  update cargas set estado='cargada' where id=new.carga_id;
  if coalesce((select cantidad from existencias where articulo_id=new.articulo_id and ubicacion_id=new.ubicacion_id),0)
    <>new.existencia_previa-1 or disponible_stock_kit(new.articulo_id)<>new.disponible_previo then
   raise exception 'Saldo posterior a la salida incompatible' using errcode='23514'; end if;
 end if;return null;
end $$;
drop trigger if exists operacion_carga_materializar on operaciones_carga_kit;
create trigger operacion_carga_materializar after insert on operaciones_carga_kit for each row execute function materializar_operacion_carga();

create or replace function comprobar_operacion_carga(o operaciones_carga_kit) returns void language plpgsql as $$
declare c cargas; l carga_lineas; r reservas; base operaciones_carga_kit; salida operaciones_carga_kit; ultimo boolean;
begin
 select * into c from cargas where id=o.carga_id;
 select * into l from carga_lineas where id=o.linea_id;
 select * into r from reservas where id=o.reserva_id;
 if c.id is null or l.id is null or r.id is null then raise exception 'Operacion de carga incompleta' using errcode='23514'; end if;
 select * into base from operaciones_carga_kit where operacion='preparar' and not reutilizada and carga_id=o.carga_id;
 if base.id is null or base.linea_id<>o.linea_id or base.reserva_id<>o.reserva_id or base.suministro_id<>o.suministro_id
  or base.sala_id<>o.sala_id or base.articulo_id<>o.articulo_id or o.cantidad<>1
  or (select count(*) from operaciones_carga_kit where operacion='preparar' and not reutilizada and reserva_id=o.reserva_id)<>1
  or c.sala_id<>o.sala_id or c.quien is distinct from base.autor_nombre
  or l.carga_id<>o.carga_id or l.articulo_id<>o.articulo_id or l.reserva_id is distinct from o.reserva_id or l.cantidad<>1
  or (select count(*) from carga_lineas where carga_id=c.id)<>1
  or r.cantidad<>1 or r.articulo_id<>o.articulo_id or r.sala_id<>o.sala_id
  or (select count(*) from reserva_suministros where reserva_id=r.id and suministro_id=o.suministro_id and cantidad=1)<>1 then
  raise exception 'Operacion de carga incompleta' using errcode='23514'; end if;
 -- El marcado final responde a la última transición válida, no a una intermedia.
 select marcado into ultimo from operaciones_carga_kit where operacion='marcar' and linea_id=o.linea_id order by orden desc limit 1;
 if l.cargado<>coalesce(ultimo,false) then
  raise exception 'Marcado final incoherente con el ultimo hecho' using errcode='23514'; end if;
 select * into salida from operaciones_carga_kit where operacion='servir' and carga_id=o.carga_id;
 if salida.id is null then
  if c.estado<>'preparacion' or r.estado<>'activa' then
   raise exception 'Estado de carga sin salida confirmada' using errcode='23514'; end if;
  return;
 end if;
 if c.estado<>'cargada' or r.estado<>'servida' or not l.cargado
  or (select count(*) from operaciones_carga_kit where operacion='servir' and reserva_id=o.reserva_id)<>1
  or salida.movimiento_id is null or salida.ubicacion_id is null
  or not exists(select 1 from movimientos m where m.id=salida.movimiento_id and m.tipo='salida' and m.cantidad=1
    and m.articulo_id=salida.articulo_id and m.ubicacion_id=salida.ubicacion_id and m.sala_id=salida.sala_id
    and m.quien=salida.autor_nombre and m.pedido_linea_id is null and m.recepcion_compra_id is null)
  or not exists(select 1 from movimiento_suministros a where a.movimiento_id=salida.movimiento_id
    and a.suministro_id=salida.suministro_id and a.cantidad=1 and a.salida_movimiento_id is null) then
  raise exception 'Salida de carga incompleta' using errcode='23514'; end if;
end $$;
create or replace function validar_operacion_carga() returns trigger language plpgsql as $$
declare o operaciones_carga_kit;
begin
 for o in select * from operaciones_carga_kit where transaccion=pg_current_xact_id() order by orden loop
  perform comprobar_operacion_carga(o);
 end loop;return null;
end $$;

-- Inversas: cabecera y línea gestionadas no cambian ni desaparecen dejando
-- un hecho falso. Cargas históricas sin enlace conservan su comportamiento.
create or replace function proteger_carga_gestionada() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op='INSERT' then return new; end if;
 if tg_table_name='cargas' then
  if exists(select 1 from operaciones_carga_kit where carga_id=old.id) then
   if tg_op='DELETE' then raise exception 'Carga gestionada conserva historial' using errcode='23514'; end if;
   if not exists(select 1 from operaciones_carga_kit o where o.carga_id=old.id and o.operacion='servir'
     and o.transaccion=pg_current_xact_id() and old.estado='preparacion' and new.estado='cargada'
     and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])) then
    raise exception 'Transicion de carga sin hecho actual exacto' using errcode='23514'; end if;
  end if;
 else
  if exists(select 1 from operaciones_carga_kit where linea_id=old.id) then
   if tg_op='DELETE' then raise exception 'Linea de carga gestionada conserva historial' using errcode='23514'; end if;
   if not exists(select 1 from operaciones_carga_kit o where o.linea_id=old.id and o.operacion='marcar'
     and o.transaccion=pg_current_xact_id() and o.marcado_previo=old.cargado and o.marcado=new.cargado
     and (to_jsonb(new)-'cargado')=(to_jsonb(old)-'cargado')) then
    raise exception 'Marcado de carga sin hecho actual exacto' using errcode='23514'; end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists carga_gestionada_proteger on cargas;
create trigger carga_gestionada_proteger before insert or update or delete on cargas for each row execute function proteger_carga_gestionada();
drop trigger if exists carga_gestionada_proteger on carga_lineas;
create trigger carga_gestionada_proteger before insert or update or delete on carga_lineas for each row execute function proteger_carga_gestionada();

create or replace function proteger_efecto_carga() returns trigger language plpgsql as $$
begin
 if tg_table_name='movimientos' then
  if tg_op<>'INSERT' and exists(select 1 from operaciones_carga_kit where movimiento_id=old.id) then
   raise exception 'Movimiento de carga gestionada inmutable' using errcode='23514'; end if;
 else
  if tg_op<>'INSERT' and exists(select 1 from operaciones_carga_kit where movimiento_id=old.movimiento_id) then
   raise exception 'Atribucion de carga gestionada inmutable' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists carga_efecto_proteger on movimientos;
create trigger carga_efecto_proteger before update or delete on movimientos for each row execute function proteger_efecto_carga();
drop trigger if exists carga_efecto_proteger on movimiento_suministros;
create trigger carga_efecto_proteger before update or delete on movimiento_suministros for each row execute function proteger_efecto_carga();

-- La reserva gestionada admite ahora dos salidas exactas: liberada por B2b y
-- servida por el hecho B2c de esta misma transacción. Nada más.
create or replace function proteger_reserva_gestionada() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op='INSERT' then return new; end if;
 if exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='reservar') then
  if tg_op='DELETE' then raise exception 'Reserva gestionada conserva historial' using errcode='23514'; end if;
  if old.estado<>'activa'
   or (to_jsonb(new)-array['estado','actualizado_en']) is distinct from (to_jsonb(old)-array['estado','actualizado_en'])
   or not((new.estado='liberada' and exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='liberar'
      and transaccion=pg_current_xact_id() and estado_previo=old.estado))
    or (new.estado='servida' and exists(select 1 from operaciones_carga_kit where reserva_id=old.id and operacion='servir'
      and transaccion=pg_current_xact_id()))) then
   raise exception 'Transicion de reserva sin hecho actual exacto' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;

-- El estado esperado de una reserva gestionada servida es 'servida', también
-- cuando reservar y servir ocurren en la misma transacción.
create or replace function validar_operacion_reserva() returns trigger language plpgsql as $$
declare o operaciones_reserva_kit; r reservas; ultimo text;
begin
 for o in select * from operaciones_reserva_kit where transaccion=pg_current_xact_id() loop
  select * into r from reservas where id=o.reserva_id;
  if exists(select 1 from operaciones_carga_kit c where c.reserva_id=o.reserva_id and c.operacion='servir') then ultimo='servida';
  else select case operacion when 'reservar' then 'activa' else 'liberada' end into ultimo
   from operaciones_reserva_kit where reserva_id=o.reserva_id order by orden desc limit 1; end if;
  if r.id is null or r.cantidad<>1 or r.articulo_id<>o.articulo_id or r.sala_id<>o.sala_id or r.estado<>ultimo
   or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
   or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=o.suministro_id and cantidad=1) then
   raise exception 'Operacion de reserva incompleta' using errcode='23514'; end if;
 end loop;return null;
end $$;

do $$ declare tabla text; begin
 foreach tabla in array array['operaciones_carga_kit','cargas','carga_lineas','reservas','movimientos','movimiento_suministros'] loop
  execute format('drop trigger if exists carga_operacion_completa on %I',tabla);
  execute format('create constraint trigger carga_operacion_completa after insert or update on %I deferrable initially deferred for each row execute function validar_operacion_carga()',tabla);
 end loop;
 foreach tabla in array array['operaciones_carga_kit'] loop
  execute format('drop trigger if exists aa_control_statement on %I',tabla);
  execute format('create trigger aa_control_statement before insert or update or delete on %I for each statement execute function entrar_escritura_kit()',tabla);
  execute format('drop trigger if exists aa_control_fila on %I',tabla);
  execute format('create trigger aa_control_fila before insert or update or delete on %I for each row execute function entrar_escritura_kit()',tabla);
 end loop;
end $$;

-- Extiende B2a/B2b con los efectos exactos de la carga gestionada. Ninguna
-- carga histórica sin enlace ni formulario genérico de kits se desbloquea.
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid; admitida boolean=false;
begin
 if tg_table_name='reservas' then
  if exists(select 1 from operaciones_reserva_kit o where o.reserva_id=new.id and o.transaccion=pg_current_xact_id()
   and o.articulo_id=new.articulo_id and o.sala_id=new.sala_id and new.cantidad=1 and (
    (tg_op='INSERT' and o.operacion='reservar' and new.estado='activa' and new.quien=o.autor_nombre)
    or (tg_op='UPDATE' and o.operacion='liberar' and old.estado=o.estado_previo and old.estado='activa' and new.estado='liberada'
     and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])))) then return new; end if;
  if tg_op='UPDATE' then
   if exists(select 1 from operaciones_carga_kit o where o.reserva_id=new.id and o.operacion='servir'
    and o.transaccion=pg_current_xact_id() and o.articulo_id=new.articulo_id and o.sala_id=new.sala_id
    and new.cantidad=1 and old.estado='activa' and new.estado='servida'
    and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])) then return new; end if;
  end if;
 elsif tg_table_name='cargas' then
  if tg_op='INSERT' then
   if exists(select 1 from operaciones_carga_kit o where o.carga_id=new.id and o.operacion='preparar' and not o.reutilizada
    and o.transaccion=pg_current_xact_id() and o.sala_id=new.sala_id and new.estado='preparacion'
    and new.quien=o.autor_nombre) then return new; end if;
  else
   if exists(select 1 from operaciones_carga_kit o where o.carga_id=new.id and o.operacion='servir'
    and o.transaccion=pg_current_xact_id() and old.estado='preparacion' and new.estado='cargada'
    and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])) then return new; end if;
  end if;
 elsif tg_table_name='carga_lineas' then
  if tg_op='INSERT' then
   if exists(select 1 from operaciones_carga_kit o where o.linea_id=new.id and o.operacion='preparar' and not o.reutilizada
    and o.transaccion=pg_current_xact_id() and o.carga_id=new.carga_id and o.articulo_id=new.articulo_id
    and o.reserva_id=new.reserva_id and new.cantidad=1 and new.cargado=false) then return new; end if;
  else
   if exists(select 1 from operaciones_carga_kit o where o.linea_id=new.id and o.operacion='marcar'
    and o.transaccion=pg_current_xact_id() and o.marcado_previo=old.cargado and o.marcado=new.cargado
    and (to_jsonb(new)-'cargado')=(to_jsonb(old)-'cargado')) then return new; end if;
  end if;
 end if;
 if tg_table_name='pedido_lineas' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-'cantidad_recibida')=(to_jsonb(old)-'cantidad_recibida') and exists(
   select 1 from recepcion_lineas d where d.pedido_linea_id=new.id and d.transaccion=pg_current_xact_id()
   and old.cantidad_recibida=d.recibido_previo and new.cantidad_recibida=d.recibido_previo+d.cantidad);
 elsif tg_table_name='movimientos' and tg_op='INSERT' then
  admitida=exists(select 1 from recepcion_lineas d join recepciones_compra t on t.id=d.recepcion_id
   where d.movimiento_id=new.id and d.transaccion=pg_current_xact_id() and new.tipo='entrada' and new.articulo_id=d.articulo_id
   and new.cantidad=d.cantidad and new.sala_id is not distinct from d.sala_id and new.ubicacion_id=d.ubicacion_id
   and new.pedido_linea_id=d.pedido_linea_id and new.recepcion_compra_id=d.recepcion_id and new.quien=t.receptor_nombre)
   or exists(select 1 from operaciones_carga_kit o where o.movimiento_id=new.id and o.operacion='servir'
    and o.transaccion=pg_current_xact_id() and new.tipo='salida' and new.articulo_id=o.articulo_id and new.cantidad=1
    and new.sala_id=o.sala_id and new.ubicacion_id=o.ubicacion_id and new.quien=o.autor_nombre
    and new.pedido_linea_id is null and new.recepcion_compra_id is null);
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
-- END CARGA KITS B2C

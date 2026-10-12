-- Compras por línea y destino previsto. No modifica existencias.
alter table pedidos add column if not exists entrega_prevista date;
alter table pedidos add column if not exists ubicacion_prevista_id uuid references ubicaciones(id);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'pedido_lineas' and column_name = 'comprado_en') then
    alter table pedido_lineas add column comprado_en date;
    update pedido_lineas l set comprado_en = coalesce(p.fecha, p.creado_en::date)
    from pedidos p where p.id = l.pedido_id and p.estado <> 'borrador';
  end if;
end $$;
alter table pedido_lineas add column if not exists comprado_por text;
-- Los pedidos históricos ya enviados conservan su significado, sin inventar autoría.
alter table movimientos add column if not exists pedido_linea_id uuid references pedido_lineas(id) on delete restrict;
create index if not exists movimientos_pedido_linea_idx on movimientos(pedido_linea_id);

-- Cada envío del formulario tiene identidad; sus efectos y el token se confirman juntos.
-- No atribuye tokens a movimientos históricos.
create table if not exists recepciones_compra (
  id uuid primary key,
  pedido_id uuid not null references pedidos(id) on delete restrict,
  solicitud jsonb not null,
  registrado_en timestamptz not null default clock_timestamp()
);
alter table movimientos add column if not exists recepcion_compra_id uuid references recepciones_compra(id) on delete restrict;
create unique index if not exists movimientos_recepcion_linea_idx on movimientos(recepcion_compra_id, pedido_linea_id);


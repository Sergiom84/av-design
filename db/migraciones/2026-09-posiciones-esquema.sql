-- Coordenadas del esquema lógico en píxeles; nunca afectan las medidas físicas.
alter table sala_equipos add column if not exists esquema_x double precision;
alter table sala_equipos add column if not exists esquema_y double precision;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sala_equipos_esquema_posicion') then
    alter table sala_equipos add constraint sala_equipos_esquema_posicion check (
      (esquema_x is null and esquema_y is null) or
      (esquema_x is not null and esquema_y is not null and
       esquema_x between 0 and 100000 and esquema_y between 0 and 100000)
    );
  end if;
end $$;

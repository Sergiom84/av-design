begin;

create table if not exists conexion_puntos_paso (
  id uuid primary key default gen_random_uuid(),
  conexion_id uuid not null references conexiones on delete cascade,
  orden integer not null check (orden >= 0),
  x_m numeric(8,3) not null,
  y_m numeric(8,3) not null,
  z_m numeric(8,3) not null,
  unique (conexion_id, orden)
);
create index if not exists conexion_puntos_paso_conexion_idx
  on conexion_puntos_paso (conexion_id, orden);

create table if not exists plantilla_conexion_puntos_paso (
  id uuid primary key default gen_random_uuid(),
  plantilla_conexion_id uuid not null references plantilla_conexiones on delete cascade,
  orden integer not null check (orden >= 0),
  x_m numeric(8,3) not null,
  y_m numeric(8,3) not null,
  z_m numeric(8,3) not null,
  unique (plantilla_conexion_id, orden)
);
create index if not exists plantilla_conexion_puntos_paso_conexion_idx
  on plantilla_conexion_puntos_paso (plantilla_conexion_id, orden);

commit;

-- REA-05: tiempos y costes imputados. Aplicación manual.
create table if not exists tiempo_registros (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references plan_tareas(id) on delete restrict,
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  titular_usuario_id uuid references usuarios(id) on delete restrict,
  relacionado_id uuid references tiempo_registros(id) on delete restrict,
  numero_actual integer not null default 1 check (numero_actual > 0),
  actual_id uuid not null,
  creado_en timestamptz not null default now()
);
create table if not exists tiempo_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references tiempo_versiones(id) on delete restrict,
  accion text not null check (accion in ('registro','correccion','anulacion')),
  inicio_utc timestamptz not null,
  fin_utc timestamptz not null,
  minutos integer not null check (minutos between 1 and 1440),
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  entrada_local jsonb not null check (jsonb_typeof(entrada_local) = 'object'),
  notas text not null default '' check (length(notas) <= 2000),
  motivo text check (length(motivo) between 1 and 2000),
  autor_usuario_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  check (fin_utc > inicio_utc and
    extract(epoch from (fin_utc-inicio_utc)) = minutos::numeric * 60),
  check (date_trunc('minute',inicio_utc) = inicio_utc and date_trunc('minute',fin_utc) = fin_utc),
  check ((numero = 1 and antecedente_id is null and accion = 'registro') or
    (numero > 1 and antecedente_id is not null and accion <> 'registro' and motivo is not null)),
  unique(registro_id, numero), unique(registro_id, id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tiempo_actual_fk'
    and conrelid='tiempo_registros'::regclass) then
    alter table tiempo_registros add constraint tiempo_actual_fk
      foreign key(id,actual_id) references tiempo_versiones(registro_id,id)
      deferrable initially deferred;
  end if;
end $$;
create index if not exists tiempo_tecnico_idx on tiempo_registros(tecnico_id, id);
create index if not exists tiempo_tarea_idx on tiempo_registros(tarea_id, id);
create index if not exists tiempo_titular_idx on tiempo_registros(titular_usuario_id, id);
create index if not exists tiempo_intervalo_idx on tiempo_versiones(inicio_utc, fin_utc);

create table if not exists tiempo_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  version_id uuid not null references tiempo_versiones(id) on delete restrict,
  tipo text not null check (tipo in ('registro','correccion','anulacion','restauracion')),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);

create table if not exists coste_tarifa_versiones (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_tarifa_versiones(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  accion text not null check (accion in ('definir','corregir','anular')),
  desde date not null, hasta_exclusivo date,
  precio_hora numeric(12,4) not null check (precio_hora >= 0),
  moneda text not null check (moneda in ('EUR','USD')),
  calidad text not null check (calidad in ('estimada','validada')),
  fuente text not null check (length(btrim(fuente)) between 1 and 1000),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check (hasta_exclusivo is null or hasta_exclusivo > desde),
  check ((numero=1 and antecedente_id is null and accion='definir') or
    (numero>1 and antecedente_id is not null and accion<>'definir')),
  unique(serie_id,numero)
);
create index if not exists coste_tarifa_tecnico_idx on coste_tarifa_versiones(tecnico_id,desde);

create table if not exists coste_labor_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  tiempo_version_id uuid not null references tiempo_versiones(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_labor_versiones(id) on delete restrict,
  accion text not null check (accion in ('valorar','revalorar','anular')),
  tramos jsonb not null check (jsonb_typeof(tramos) = 'array'),
  totales jsonb not null check (jsonb_typeof(totales) = 'object'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(registro_id,numero)
);

create table if not exists coste_material_apuntes (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references movimientos(id) on delete restrict,
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  creado_en timestamptz not null default now()
);
create index if not exists coste_material_mov_idx on coste_material_apuntes(movimiento_id,id);
create index if not exists coste_material_obra_idx on coste_material_apuntes(proyecto_id,id);
create table if not exists coste_material_versiones (
  id uuid primary key default gen_random_uuid(),
  apunte_id uuid not null references coste_material_apuntes(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_material_versiones(id) on delete restrict,
  accion text not null check (accion in ('imputar','corregir','anular')),
  cantidad numeric(12,2) not null check (cantidad > 0),
  unidad text not null check (unidad in ('ud','m')),
  tipo_hecho text not null check (tipo_hecho in ('salida','devolucion','baja')),
  signo integer not null check (signo in (-1,1)),
  movimiento_snapshot jsonb not null check (jsonb_typeof(movimiento_snapshot) = 'object'),
  movimiento_sha256 text not null check (movimiento_sha256 ~ '^[0-9a-f]{64}$'),
  precio_unitario numeric(12,4) check (precio_unitario >= 0),
  moneda text check (moneda in ('EUR','USD')),
  calidad text not null check (calidad in ('sin_valorar','estimado','documentado')),
  importe_minor numeric(30,0),
  origen_salida_version_id uuid references coste_material_versiones(id) on delete restrict,
  origen_devolucion_version_id uuid references coste_material_versiones(id) on delete restrict,
  linaje text not null check (linaje in ('salida','devolucion','reingreso_baja','baja_directa','pendiente')),
  evidencia jsonb not null check (jsonb_typeof(evidencia) = 'object'),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check ((precio_unitario is null) = (moneda is null)),
  check (tipo_hecho <> 'devolucion' or signo=-1),
  check (tipo_hecho='devolucion' or signo=1),
  check (calidad <> 'documentado' or
    (precio_unitario is not null and importe_minor is not null and linaje <> 'pendiente')),
  unique(apunte_id,numero)
);

create table if not exists coste_cortes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  serie_id uuid not null, numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_cortes(id) on delete restrict,
  tipo text not null check (tipo in ('previsto','real','comparacion')),
  version_modelo integer not null default 1 check (version_modelo=1),
  alcance jsonb not null check (jsonb_typeof(alcance) = 'object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(serie_id,numero)
);
create table if not exists coste_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in ('tarifa','laboral','material','corte')),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);

create or replace function rea05_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El registro historico REA05 no se sobrescribe';
end $$;
-- Integrar el mismo trigger antes de UPDATE/DELETE en:
-- tiempo_versiones, tiempo_operaciones, coste_tarifa_versiones,
-- coste_labor_versiones, coste_material_versiones, coste_cortes, coste_operaciones.
do $$ declare nombre text; begin
  foreach nombre in array array['tiempo_versiones','tiempo_operaciones',
    'coste_tarifa_versiones','coste_labor_versiones','coste_material_versiones',
    'coste_cortes','coste_operaciones','coste_material_apuntes'] loop
    execute format('drop trigger if exists rea05_inmutable on %I',nombre);
    execute format('create trigger rea05_inmutable before update or delete on %I '
      'for each row execute function rea05_inmutable()',nombre);
  end loop;
end $$;

create or replace function rea05_identidad_tiempo() returns trigger
language plpgsql as $$ declare n integer; begin
  if tg_op='DELETE' then
    raise exception 'La cabecera de tiempo con historia no se borra';
  end if;
  if (to_jsonb(new)-array['numero_actual','actual_id']) is distinct from
     (to_jsonb(old)-array['numero_actual','actual_id']) then
    raise exception 'La identidad del tiempo no se traslada';
  end if;
  select numero into n from tiempo_versiones
    where registro_id=new.id and id=new.actual_id;
  if n is null or n<>new.numero_actual or new.numero_actual<>old.numero_actual+1 then
    raise exception 'El tiempo avanza una version por correccion';
  end if;
  return new;
end $$;
drop trigger if exists tiempo_identidad on tiempo_registros;
create trigger tiempo_identidad before update or delete on tiempo_registros
  for each row execute function rea05_identidad_tiempo();

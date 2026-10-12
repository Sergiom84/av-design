-- Integración manual. No convierte visitas previas ni completa históricos.
begin;
create table if not exists seguimiento_instalacion_sala (
  sala_id uuid primary key references salas on delete cascade,
  fecha_prevista date,
  instalador_id uuid references tecnicos,
  nota text not null default '' check (length(nota) <= 2000),
  version integer not null check (version > 0)
);
create table if not exists prueba_final_sala (
  sala_id uuid primary key references salas on delete cascade,
  puntos jsonb not null check (jsonb_typeof(puntos) = 'array' and jsonb_array_length(puntos) = 6),
  version integer not null check (version > 0),
  fecha date,
  tecnico_id uuid references tecnicos,
  check ((fecha is null) = (tecnico_id is null))
);
create table if not exists auditoria_instalacion_sala (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas on delete cascade,
  autor_id uuid not null references usuarios,
  autor text not null,
  operacion text not null check (operacion in ('plan', 'checklist', 'prueba_final', 'reabrir_prueba', 'instalacion', 'entrega', 'borrar_instalacion', 'borrar_entrega')),
  registrado_en timestamptz not null default clock_timestamp(),
  datos jsonb not null
);
create index if not exists auditoria_instalacion_sala_historial on auditoria_instalacion_sala (sala_id, registrado_en);
comment on table auditoria_instalacion_sala is 'Registro acumulativo: autor de sesión, técnico y snapshots. No se edita ni borra desde seguimiento.';
commit;

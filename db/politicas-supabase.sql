-- =====================================================================
-- Solo al migrar a Supabase. NO se aplica en el Postgres local en Docker:
-- depende del esquema `auth`, que solo existe en Supabase.
--
-- Añade la tabla de perfiles, el alta automática de usuario y las
-- políticas RLS por rol del departamento.
-- =====================================================================

create table if not exists perfiles (
  id          uuid primary key references auth.users on delete cascade,
  nombre      text not null,
  rol         rol_usuario not null default 'lectura',
  creado_en   timestamptz not null default now()
);

create or replace function rol_actual()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid();
$$;

-- Todo el departamento lee. Escribir requiere rol asignado.
do $$
declare t text;
begin
  foreach t in array array[
    'proveedores','articulos','sedes','plantillas_sala','plantilla_articulos',
    'salas','sala_equipos','conexiones','parametros'
  ] loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "%1$s_leer" on %1$s', t);
    execute format(
      'create policy "%1$s_leer" on %1$s for select to authenticated using (true)', t);

    execute format('drop policy if exists "%1$s_escribir" on %1$s', t);
    execute format(
      'create policy "%1$s_escribir" on %1$s for all to authenticated
         using (rol_actual() in (''admin'',''tei'',''av'',''tecnico''))
         with check (rol_actual() in (''admin'',''tei'',''av'',''tecnico''))', t);
  end loop;
end $$;

alter table perfiles enable row level security;

drop policy if exists "perfiles_leer" on perfiles;
create policy "perfiles_leer" on perfiles for select to authenticated using (true);

drop policy if exists "perfiles_admin" on perfiles;
create policy "perfiles_admin" on perfiles for all to authenticated
  using (rol_actual() = 'admin') with check (rol_actual() = 'admin');

-- Alta automática de perfil al registrarse
create or replace function crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), 'lectura')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function crear_perfil();

-- REA10 aditivo. Fuentes privadas separadas; ningún hecho AV nace al extraer.
create sequence if not exists revision_fuentes_requisitos;
alter table articulos_tecnicos add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
alter table articulos_archivos_tecnicos add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
alter table puertos add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
alter table localizaciones add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
create or replace function rea10_revision_fuente() returns trigger language plpgsql as $$
begin
  new.revision_fuente := nextval('revision_fuentes_requisitos');
  return new;
end $$;
do $$ declare tabla text;
begin
  foreach tabla in array array['articulos_tecnicos','articulos_archivos_tecnicos','puertos','localizaciones'] loop
    execute format('drop trigger if exists rea10_revision_fuente on %I',tabla);
    execute format('create trigger rea10_revision_fuente before insert or update on %I for each row execute function rea10_revision_fuente()',tabla);
  end loop;
end $$;

-- La revisión del artículo también representa el conjunto, incluido el vacío.
-- Así alta -> baja de su último puerto no recupera un checkpoint anterior.
-- Usa el contador E2 existente; no hay una segunda colección de puertos.
create or replace function rea10_revision_articulo_por_puerto() returns trigger language plpgsql as $$
declare anterior uuid; siguiente uuid; articulo uuid;
begin
  if tg_op <> 'INSERT' then anterior := old.articulo_id; end if;
  if tg_op <> 'DELETE' then siguiente := new.articulo_id; end if;
  for articulo in select a.id from articulos a where a.id in (anterior,siguiente) order by a.id for update loop
    -- e2_revision_articulos incrementa siempre, también sin cambiar el modelo.
    update articulos set revision=revision where id=articulo;
  end loop;
  return null;
end $$;
drop trigger if exists rea10_revision_conjunto_puertos on puertos;
create trigger rea10_revision_conjunto_puertos after insert or update or delete on puertos
  for each row execute function rea10_revision_articulo_por_puerto();

create table if not exists requisitos_documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version integer not null default 0 check(version>=0),
  tipo text not null check(tipo in ('archivo_obra','ficha_e2','lote_e2')),
  origen_ref jsonb check(origen_ref is null or (jsonb_typeof(origen_ref)='object' and octet_length(origen_ref::text)<=4096)),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
  estado text not null default 'activo' check(estado in ('activo','retirado','purgado')),
  creado_en timestamptz not null default now(), retirado_en timestamptz, purgado_en timestamptz,
  check((tipo='archivo_obra')=(origen_ref is null)),
  check((estado='activo')=(retirado_en is null)),
  check((estado='purgado')=(purgado_en is not null))
);
create index if not exists requisitos_documentos_obra on requisitos_documentos(proyecto_id,creado_en desc,id);
create index if not exists requisitos_documentos_autor on requisitos_documentos(autor_id,estado);
create table if not exists requisitos_contenidos (
  documento_id uuid primary key references requisitos_documentos(id) on delete restrict,
  metadatos jsonb check(metadatos is null or (jsonb_typeof(metadatos)='object' and octet_length(metadatos::text)<=16384)),
  bytes bytea check(bytes is null or octet_length(bytes) between 1 and 5242880)
);
create table if not exists requisitos_extracciones (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references requisitos_documentos(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version_modelo integer not null default 1 check(version_modelo=1),
  metodo text not null check(metodo in ('pdf_local','txt_utf8','transcripcion_manual','referencia_e2')),
  parser text not null check(length(parser) between 1 and 80),
  parser_version text not null check(length(parser_version) between 1 and 80),
  fuente_sha256 text not null check(fuente_sha256~'^[a-f0-9]{64}$'),
  texto_sha256 text not null check(texto_sha256~'^[a-f0-9]{64}$'),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
  resultado jsonb check(resultado is null or (jsonb_typeof(resultado)='object' and octet_length(resultado::text)<=6291456)),
  creado_en timestamptz not null default now()
);
create index if not exists requisitos_extracciones_fuente on requisitos_extracciones(documento_id,creado_en,id);
create table if not exists requisitos_planes (
  id uuid primary key default gen_random_uuid(),
  extraccion_id uuid not null references requisitos_extracciones(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version integer not null default 0 check(version>=0),
  destino text not null check(destino in ('areas_bom','catalogo','ofertas','tecnico','puerto')),
  estado text not null default 'borrador' check(estado in ('borrador','aplicado','purgado')),
  decisiones jsonb check(decisiones is null or (jsonb_typeof(decisiones)='object' and octet_length(decisiones::text)<=262144)),
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create index if not exists requisitos_planes_autor on requisitos_planes(autor_id,estado,actualizado_en,id);
create table if not exists requisitos_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references requisitos_planes(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version_plan integer not null check(version_plan>=0), clave_peticion uuid not null,
  entrada_sha256 text not null check(entrada_sha256~'^[a-f0-9]{64}$'),
  -- Sólo IDs, hashes y decisiones de negocio; nunca fragmentos copiados de fuente.
  resultado jsonb not null check(jsonb_typeof(resultado)='object' and octet_length(resultado::text)<=262144),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);
create table if not exists requisitos_reversiones (
  id uuid primary key default gen_random_uuid(),
  aplicacion_id uuid not null references requisitos_aplicaciones(id) on delete restrict,
  numero integer not null check(numero>=1), antecedente_id uuid unique,
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null, entrada_sha256 text not null check(entrada_sha256~'^[a-f0-9]{64}$'),
  resultado jsonb not null check(jsonb_typeof(resultado)='object' and octet_length(resultado::text)<=262144),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'), creado_en timestamptz not null default now(),
  unique(aplicacion_id,numero), unique(aplicacion_id,id), unique(autor_id,clave_peticion),
  foreign key(aplicacion_id,antecedente_id) references requisitos_reversiones(aplicacion_id,id) on delete restrict,
  check((numero=1)=(antecedente_id is null))
);

-- Auditoría mínima de retirada/purga. Las filas previas conservan null: no se inventan motivos.
alter table requisitos_documentos add column if not exists retirada jsonb
  check(retirada is null or (jsonb_typeof(retirada)='object' and octet_length(retirada::text)<=12288));
alter table requisitos_documentos add column if not exists purga jsonb
  check(purga is null or (jsonb_typeof(purga)='object' and octet_length(purga::text)<=12288));

create or replace function rea10_validar_auditoria(auditoria jsonb, fecha_registro timestamptz)
returns void language plpgsql as $$
declare clave text;
begin
  if auditoria is null or jsonb_typeof(auditoria)<>'object' or
     auditoria-array['motivo','autorId','fecha','diff']<>'{}'::jsonb or
     jsonb_typeof(auditoria->'motivo') is distinct from 'string' or
     length(btrim(auditoria->>'motivo')) not between 1 and 2000 or
     jsonb_typeof(auditoria->'autorId') is distinct from 'string' or
     (auditoria->>'autorId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
     jsonb_typeof(auditoria->'fecha') is distinct from 'string' or
     jsonb_typeof(auditoria->'diff') is distinct from 'object' or
     (auditoria->'diff')-array['bytes','extracciones','planes']<>'{}'::jsonb then
    raise exception 'La auditoría conserva sólo motivo, autor, fecha y cantidades retiradas';
  end if;
  foreach clave in array array['bytes','extracciones','planes'] loop
    if jsonb_typeof(auditoria->'diff'->clave) is distinct from 'number' or
       (auditoria->'diff'->>clave) !~ '^(0|[1-9][0-9]*)$' then
      raise exception 'El diff de retirada conserva cantidades enteras no negativas';
    end if;
  end loop;
  if fecha_registro is null or (auditoria->>'fecha')::timestamptz<>fecha_registro then
    raise exception 'La auditoría conserva la fecha exacta de su operación';
  end if;
end $$;

create or replace function rea10_identidad_documento() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'La fuente conserva tombstone e historia'; end if;
  if (to_jsonb(new)-array['version','estado','retirado_en','purgado_en','retirada','purga']) is distinct from
     (to_jsonb(old)-array['version','estado','retirado_en','purgado_en','retirada','purga']) then
    raise exception 'La identidad y procedencia de la fuente son inmutables';
  end if;
  if new.version<>old.version+1 then raise exception 'La fuente avanza una versión por operación'; end if;
  if old.estado='purgado' or (old.estado='retirado' and new.estado='activo') then
    raise exception 'La fuente retirada no se reactiva implícitamente';
  end if;
  if old.retirado_en is not null and new.retirado_en is distinct from old.retirado_en then
    raise exception 'La retirada original se conserva';
  end if;
  if old.retirada is not null and new.retirada is distinct from old.retirada then
    raise exception 'La auditoría de retirada no se sobrescribe';
  end if;
  if new.retirada is distinct from old.retirada and
     (old.estado<>'activo' or new.estado not in ('retirado','purgado')) then
    raise exception 'La auditoría de retirada se registra con la transición';
  end if;
  if old.estado='activo' and new.estado in ('retirado','purgado') then
    perform rea10_validar_auditoria(new.retirada,new.retirado_en);
  end if;
  if new.purga is distinct from old.purga and
     (old.estado='purgado' or new.estado<>'purgado') then
    raise exception 'La auditoría de purga se registra con la transición';
  end if;
  if new.estado='purgado' then
    perform rea10_validar_auditoria(new.purga,new.purgado_en);
  end if;
  return new;
end $$;

drop trigger if exists rea10_documento_identidad on requisitos_documentos;
create trigger rea10_documento_identidad before update or delete on requisitos_documentos
  for each row execute function rea10_identidad_documento();

create or replace function rea10_contenido_fuente() returns trigger language plpgsql as $$
declare documento requisitos_documentos; identificador uuid;
begin
  identificador:=case when tg_op='DELETE' then old.documento_id else new.documento_id end;
  select * into documento from requisitos_documentos where id=identificador;
  if tg_op='DELETE' then
    if documento.estado<>'purgado' then raise exception 'La fuente activa o retirada conserva su contenido'; end if;
    return old;
  end if;
  if tg_op='UPDATE' and (documento.estado<>'purgado' or new.bytes is not null or new.metadatos is not null or
      new.documento_id<>old.documento_id) then raise exception 'Sólo la purga explícita retira contenido'; end if;
  if documento.estado='purgado' then
    if new.bytes is not null or new.metadatos is not null then raise exception 'Una fuente purgada no recupera contenido'; end if;
  elsif new.metadatos is null or ((documento.tipo='archivo_obra')<>(new.bytes is not null)) then
    raise exception 'Archivo y referencia conservan una sola fuente';
  end if;
  if new.bytes is not null and encode(public.digest(new.bytes,'sha256'),'hex')<>documento.sha256 then
    raise exception 'Los bytes no coinciden con la fuente';
  end if;
  return new;
end $$;
drop trigger if exists rea10_contenido on requisitos_contenidos;
create trigger rea10_contenido before insert or update or delete on requisitos_contenidos
  for each row execute function rea10_contenido_fuente();

create or replace function rea10_extraccion_inmutable() returns trigger language plpgsql as $$
declare estado_fuente text;
begin
  if tg_op='DELETE' then raise exception 'La extracción conserva hashes y procedencia'; end if;
  select estado into estado_fuente from requisitos_documentos where id=old.documento_id;
  if estado_fuente<>'purgado' or new.resultado is not null or
     (to_jsonb(new)-'resultado') is distinct from (to_jsonb(old)-'resultado') then
    raise exception 'La extracción es inmutable salvo retirada de contenido por purga';
  end if;
  return new;
end $$;
drop trigger if exists rea10_extraccion_historia on requisitos_extracciones;
create trigger rea10_extraccion_historia before update or delete on requisitos_extracciones
  for each row execute function rea10_extraccion_inmutable();

create or replace function rea10_plan_cas() returns trigger language plpgsql as $$
declare estado_fuente text;
begin
  if tg_op='DELETE' then raise exception 'El plan conserva decisiones e historia'; end if;
  if (to_jsonb(new)-array['version','estado','decisiones','actualizado_en']) is distinct from
     (to_jsonb(old)-array['version','estado','decisiones','actualizado_en']) or new.version<>old.version+1 then
    raise exception 'El plan conserva identidad y avanza una versión';
  end if;
  select d.estado into estado_fuente from requisitos_documentos d join requisitos_extracciones e on e.documento_id=d.id
    where e.id=old.extraccion_id;
  if new.estado='purgado' then
    if estado_fuente<>'purgado' or new.decisiones is not null then raise exception 'La purga del plan requiere fuente purgada'; end if;
  elsif old.estado<>'borrador' or estado_fuente<>'activo' or new.decisiones is null then
    raise exception 'El plan aplicado o de fuente retirada no se vuelve a editar';
  end if;
  return new;
end $$;
drop trigger if exists rea10_plan_version on requisitos_planes;
create trigger rea10_plan_version before update or delete on requisitos_planes
  for each row execute function rea10_plan_cas();

create or replace function rea10_historia_inmutable() returns trigger language plpgsql as $$
begin raise exception 'La aplicación y cada intento de reversión conservan su historia'; end $$;
drop trigger if exists rea10_aplicacion_historia on requisitos_aplicaciones;
create trigger rea10_aplicacion_historia before update or delete on requisitos_aplicaciones
  for each row execute function rea10_historia_inmutable();
drop trigger if exists rea10_reversion_historia on requisitos_reversiones;
create trigger rea10_reversion_historia before update or delete on requisitos_reversiones
  for each row execute function rea10_historia_inmutable();

create or replace function rea10_alta_extraccion() returns trigger language plpgsql as $$
declare fuente requisitos_documentos;
begin
  select * into fuente from requisitos_documentos where id=new.documento_id;
  if fuente.estado<>'activo' or new.fuente_sha256<>fuente.sha256 or new.resultado is null then
    raise exception 'La extracción requiere fuente activa, hash exacto y resultado completo';
  end if;
  return new;
end $$;
drop trigger if exists rea10_extraccion_fuente on requisitos_extracciones;
create trigger rea10_extraccion_fuente before insert on requisitos_extracciones
  for each row execute function rea10_alta_extraccion();

create or replace function rea10_consistencia_plan() returns trigger language plpgsql as $$
declare plan_actual requisitos_planes; plan_id_actual uuid; cantidad integer;
begin
  if tg_table_name='requisitos_planes' then plan_id_actual:=new.id;
  else plan_id_actual:=new.plan_id; end if;
  select * into plan_actual from requisitos_planes where id=plan_id_actual;
  select count(*)::int into cantidad from requisitos_aplicaciones where plan_id=plan_id_actual;
  if (plan_actual.estado='aplicado' and cantidad<>1) or
     (plan_actual.estado='borrador' and cantidad<>0) then
    raise exception 'El plan y su única aplicación se confirman en la misma transacción';
  end if;
  if tg_table_name='requisitos_aplicaciones' then
    if plan_actual.estado<>'aplicado' or plan_actual.autor_id<>new.autor_id or plan_actual.version<=new.version_plan then
      raise exception 'La aplicación conserva autor y versión confirmada del plan';
    end if;
  end if;
  return null;
end $$;
drop trigger if exists rea10_plan_consistente on requisitos_planes;
create constraint trigger rea10_plan_consistente after insert or update on requisitos_planes
  deferrable initially deferred for each row execute function rea10_consistencia_plan();
drop trigger if exists rea10_aplicacion_consistente on requisitos_aplicaciones;
create constraint trigger rea10_aplicacion_consistente after insert on requisitos_aplicaciones
  deferrable initially deferred for each row execute function rea10_consistencia_plan();

create or replace function rea10_purga_completa() returns trigger language plpgsql as $$
begin
  if new.estado='purgado' and (
    exists(select 1 from requisitos_contenidos c where c.documento_id=new.id and (c.bytes is not null or c.metadatos is not null)) or
    exists(select 1 from requisitos_extracciones e where e.documento_id=new.id and e.resultado is not null) or
    exists(select 1 from requisitos_planes p join requisitos_extracciones e on e.id=p.extraccion_id
      where e.documento_id=new.id and (p.decisiones is not null or p.estado<>'purgado'))
  ) then raise exception 'La purga retira todas las copias de contenido en la misma transacción'; end if;
  return null;
end $$;
drop trigger if exists rea10_purga_atomica on requisitos_documentos;
create constraint trigger rea10_purga_atomica after update on requisitos_documentos
  deferrable initially deferred for each row execute function rea10_purga_completa();

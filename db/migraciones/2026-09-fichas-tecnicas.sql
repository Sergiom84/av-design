begin;
-- Datos técnicos del artículo existente; no constituye otro catálogo.
create or replace function valor_dato_tecnico_valido(tipo text, valor jsonb)
returns boolean language plpgsql immutable as $$
declare claves text[]; esperadas text[]; campo text;
begin
  if valor is null then return true; end if;
  if jsonb_typeof(valor) <> 'object' then return false; end if;
  esperadas := case tipo
    when 'microfonia' then array['captacion']
    when 'alimentacion' then array['descripcion']
    when 'poe' then array['compartido','estandar','rol','vatios']
    when 'suministro' then array['cantidad','incluido','longitud_aplica','longitud_m','referencia']
    when 'puerto' then array['conector','nombre','senal','sentido','total']
    when 'restriccion' then array['texto'] else null end;
  select array_agg(k order by k) into claves from jsonb_object_keys(valor) k;
  if esperadas is null or claves is distinct from esperadas then return false; end if;
  for campo in select unnest(case tipo
    when 'microfonia' then array['captacion'] when 'alimentacion' then array['descripcion']
    when 'poe' then array['rol'] when 'suministro' then array['referencia']
    when 'puerto' then array['nombre','sentido','senal'] when 'restriccion' then array['texto'] end)
  loop
    if jsonb_typeof(valor->campo)<>'string' or not ((valor->>campo) ~ '[^[:space:]]') then return false; end if;
  end loop;
  case tipo
    when 'microfonia' then return valor->>'captacion' in ('integrada','externa','desconocida');
    when 'alimentacion','restriccion' then return true;
    when 'poe' then
      if valor->>'rol' not in ('pd','pse') or jsonb_typeof(valor->'compartido')<>'boolean'
        or jsonb_typeof(valor->'estandar') not in ('string','null')
        or jsonb_typeof(valor->'vatios') not in ('number','null') then return false; end if;
      if jsonb_typeof(valor->'estandar')='string' and not ((valor->>'estandar') ~ '[^[:space:]]') then return false; end if;
      return valor->'vatios'='null'::jsonb or (valor->>'vatios')::numeric between 0 and 1.7976931348623157e308;
    when 'suministro' then
      if jsonb_typeof(valor->'cantidad')<>'number' or jsonb_typeof(valor->'incluido') not in ('boolean','null')
        or jsonb_typeof(valor->'longitud_aplica') not in ('boolean','null')
        or jsonb_typeof(valor->'longitud_m') not in ('number','null') then return false; end if;
      if valor->'longitud_aplica'='false'::jsonb and valor->'longitud_m'<>'null'::jsonb then return false; end if;
      if (valor->>'cantidad')::numeric<1 or (valor->>'cantidad')::numeric>9007199254740991
        or trunc((valor->>'cantidad')::numeric)<>(valor->>'cantidad')::numeric then return false; end if;
      return valor->'longitud_m'='null'::jsonb or ((valor->>'longitud_m')::numeric>0 and (valor->>'longitud_m')::numeric<=1.7976931348623157e308);
    when 'puerto' then
      if jsonb_typeof(valor->'total')<>'number' or jsonb_typeof(valor->'conector') not in ('string','null') then return false; end if;
      if jsonb_typeof(valor->'conector')='string' and not ((valor->>'conector') ~ '[^[:space:]]') then return false; end if;
      return (valor->>'total')::numeric between 1 and 9007199254740991
        and trunc((valor->>'total')::numeric)=(valor->>'total')::numeric
        and valor->>'sentido' in ('entrada','salida','bidireccional','control')
        and valor->>'senal' in ('hdmi','red','usb','audio_linea','audio_altavoz','microfono','alimentacion','control','otro');
    else return false;
  end case;
end $$;
-- Contrato de fuente más estrecho que una URL general: HTTPS con nombre DNS
-- ASCII (sin IP literal/IPv6), sin credenciales y puerto numérico 0..65535.
create or replace function fuente_dato_tecnico_valida(url text)
returns boolean language plpgsql immutable as $$
declare puerto text;
begin
  if url is null then return true; end if;
  if url !~* '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z]([a-z0-9-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then return false; end if;
  puerto := substring(lower(url) from '^https://[^/:?#]+:([0-9]+)');
  return puerto is null or puerto::integer<=65535;
end $$;
create unique index if not exists puertos_id_articulo_unico on puertos(id,articulo_id);
create table if not exists articulo_datos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references articulos(id) on delete restrict,
  clave text not null check(clave ~ '[^[:space:]]'),
  concepto text,
  tipo text not null check(tipo in ('microfonia','alimentacion','poe','suministro','puerto','restriccion')),
  estado text not null check(estado in ('verificado','parcial','sin_documentar')),
  valor jsonb,
  fuente_url text check(fuente_dato_tecnico_valida(fuente_url)),
  documento text check(documento is null or documento ~ '[^[:space:]]'),
  apartado text check(apartado is null or apartado ~ '[^[:space:]]'),
  consultado_en date check(consultado_en is null or (isfinite(consultado_en) and consultado_en between date '0001-01-01' and date '9999-12-31')),
  puerto_id uuid,
  fuente text not null check(fuente in ('csv','app')),
  unique(articulo_id,clave),
  foreign key(puerto_id,articulo_id) references puertos(id,articulo_id) on delete restrict,
  constraint dato_tecnico_estado_valor check((estado='sin_documentar' and valor is null) or
    (estado<>'sin_documentar' and valor is not null and fuente_url is not null and documento is not null and apartado is not null and consultado_en is not null)),
  constraint dato_tecnico_valor_tipado check(valor_dato_tecnico_valido(tipo,valor))
);
-- Upgrade desde ronda 1: conserva datos y procedencia, sin inferir si aplica longitud.
alter table articulo_datos_tecnicos add column if not exists concepto text;
update articulo_datos_tecnicos set
  concepto=coalesce(concepto,case when tipo='suministro' then nullif(btrim(valor->>'referencia'),'') end,clave),
  valor=case when tipo='suministro' and valor is not null and not (valor ? 'longitud_aplica')
    then valor || '{"longitud_aplica":null}'::jsonb else valor end
where concepto is null or (tipo='suministro' and valor is not null and not (valor ? 'longitud_aplica'));
alter table articulo_datos_tecnicos alter column concepto set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='articulo_datos_tecnicos'::regclass and conname='dato_tecnico_concepto') then
    alter table articulo_datos_tecnicos add constraint dato_tecnico_concepto check(concepto ~ '[^[:space:]]');
  end if;
end $$;
comment on table articulo_datos_tecnicos is 'Hechos documentados por artículo. Desconocido es SQL NULL; CSV no pisa fuente app.';
commit;

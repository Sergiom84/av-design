/** Proyección SQL reproducible. Nunca recibe DATABASE_URL ni ejecuta SQL. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { require as tsRequire } from 'tsx/cjs/api';
const { PREFIJO_CABLE, PRIMER_CORRELATIVO_CABLE } = tsRequire('../src/lib/tipos.ts', import.meta.url);
const inicio = '-- BEGIN ETIQUETAS CABLE GENERADAS';
const fin = '-- END ETIQUETAS CABLE GENERADAS';
const literal = x => `'${String(x).replaceAll("'", "''")}'`;
export function sqlEtiquetasCable() {
  const valores = Object.entries(PREFIJO_CABLE).map(([s,p]) => `(${literal(s)}, ${literal(p)}, ${PRIMER_CORRELATIVO_CABLE})`).join(',\n');
  return `${inicio}
-- Generado por scripts/generar-etiquetas-cable.mjs desde src/lib/tipos.ts.
begin;
lock table conexiones in access exclusive mode;
create table if not exists configuracion_series_cable (
  senal senal primary key, prefijo text not null unique,
  primer_correlativo bigint not null check (primer_correlativo > 0)
);
insert into configuracion_series_cable values
${valores}
on conflict (senal) do nothing;
-- Una constante cambiada requiere una migración explícita, no sobrescribir historia.
do $$ begin
  if exists (select senal::text,prefijo,primer_correlativo from configuracion_series_cable
    except select * from (values ${valores}) v(senal,prefijo,primer_correlativo))
    or exists (select * from (values ${valores}) v(senal,prefijo,primer_correlativo)
    except select senal::text,prefijo,primer_correlativo from configuracion_series_cable) then
    raise exception 'Configuración de series divergente: requiere migración explícita';
  end if;
end $$;
create table if not exists series_cable_sala (
  sala_id uuid not null references salas on delete cascade,
  senal senal not null references configuracion_series_cable,
  siguiente bigint not null check (siguiente > 0), primary key(sala_id,senal)
);
alter table conexiones add column if not exists etiqueta_cable text;
alter table conexiones add column if not exists serie_cable senal;
alter table conexiones add column if not exists correlativo_cable bigint;
do $$ declare ids text; begin
  select string_agg(id::text, ', ') into ids from conexiones
    where not isfinite(creado_en) or creado_en < timestamptz '0001-01-01 00:00:00+00'
      or creado_en >= timestamptz '10000-01-01 00:00:00+00';
  if ids is not null then raise exception 'Fechas fuera del contrato histórico: %', ids; end if;
  if exists(select 1 from conexiones where (etiqueta_cable is null)::int + (serie_cable is null)::int + (correlativo_cable is null)::int not in (0,3))
    or (exists(select 1 from conexiones where etiqueta_cable is null) and exists(select 1 from conexiones where etiqueta_cable is not null))
  then raise exception 'Etiquetas históricas mezcladas: requiere reconciliación explícita'; end if;
  if exists(select 1 from conexiones c left join configuracion_series_cable p on p.senal=c.serie_cable
    where c.etiqueta_cable is not null and (p.senal is null or c.correlativo_cable < p.primer_correlativo
      or c.etiqueta_cable <> p.prefijo || '-' || c.correlativo_cable))
  then raise exception 'Etiqueta persistida incoherente: requiere reconciliación explícita'; end if;
end $$;
with numeradas as (
  select c.id, c.senal, p.prefijo,
    p.primer_correlativo - 1 + row_number() over(partition by c.sala_id,c.senal order by date_trunc('milliseconds',c.creado_en), c.id::text collate "C") numero
  from conexiones c join configuracion_series_cable p on p.senal=c.senal
  where c.etiqueta_cable is null
)
update conexiones c set etiqueta_cable=n.prefijo || '-' || n.numero, serie_cable=n.senal, correlativo_cable=n.numero
from numeradas n where n.id=c.id;
insert into series_cable_sala(sala_id,senal,siguiente)
select sala_id,serie_cable,max(correlativo_cable)+1 from conexiones group by sala_id,serie_cable
on conflict(sala_id,senal) do update set siguiente=greatest(series_cable_sala.siguiente,excluded.siguiente);
alter table conexiones alter column etiqueta_cable set not null;
alter table conexiones alter column serie_cable set not null;
alter table conexiones alter column correlativo_cable set not null;
create unique index if not exists conexiones_etiqueta_unica on conexiones(sala_id,etiqueta_cable);
create unique index if not exists conexiones_serie_numero_unico on conexiones(sala_id,serie_cable,correlativo_cable);
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='conexiones'::regclass and conname='conexiones_correlativo_positivo') then
  alter table conexiones add constraint conexiones_correlativo_positivo check(correlativo_cable > 0);
 end if;
end $$;
create or replace function asignar_etiqueta_cable() returns trigger language plpgsql as $$
declare pref text; primero bigint; numero bigint;
begin
 if tg_op='UPDATE' then
  if new.etiqueta_cable is distinct from old.etiqueta_cable or new.serie_cable is distinct from old.serie_cable
    or new.correlativo_cable is distinct from old.correlativo_cable or new.sala_id is distinct from old.sala_id
    or new.id is distinct from old.id then
   raise exception 'La identidad y sala de un cable son inmutables' using errcode='23514';
  end if;
  return new;
 end if;
 if new.etiqueta_cable is not null or new.serie_cable is not null or new.correlativo_cable is not null then
  raise exception 'La etiqueta del cable la asigna el servidor' using errcode='23514';
 end if;
 select prefijo,primer_correlativo into strict pref,primero from configuracion_series_cable where senal=new.senal;
 insert into series_cable_sala(sala_id,senal,siguiente) values(new.sala_id,new.senal,primero+1)
 on conflict(sala_id,senal) do update set siguiente=series_cable_sala.siguiente+1
 returning siguiente-1 into numero;
 new.serie_cable=new.senal; new.correlativo_cable=numero; new.etiqueta_cable=pref || '-' || numero;
 return new;
end $$;
drop trigger if exists conexiones_asignar_etiqueta on conexiones;
create trigger conexiones_asignar_etiqueta before insert or update on conexiones for each row execute function asignar_etiqueta_cable();
commit;
${fin}\n`;
}
export function verificarProyeccion() {
 const sql=sqlEtiquetasCable();
 const migracion=readFileSync(new URL('../db/migraciones/2026-09-etiquetas-cable.sql',import.meta.url),'utf8');
 const esquema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
 if(migracion!==sql || !esquema.endsWith(sql)) throw new Error('Proyección SQL de etiquetas desactualizada');
}
if(process.argv[1] && resolve(fileURLToPath(import.meta.url))===resolve(process.argv[1])) {
 if(process.argv.includes('--comprobar')) verificarProyeccion();
 else {
  const sql=sqlEtiquetasCable(); const ruta=new URL('../db/schema.sql',import.meta.url);
  const previo=readFileSync(ruta,'utf8'); const indice=previo.indexOf(inicio);
  writeFileSync(ruta,(indice<0?previo.trimEnd()+'\n\n':previo.slice(0,indice))+sql);
  writeFileSync(new URL('../db/migraciones/2026-09-etiquetas-cable.sql',import.meta.url),sql);
 }
}

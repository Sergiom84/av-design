/** SQL integrado en la transacción del seed; ninguna conexión ni escritura local. */
export function sqlSincronizarPuertos(puertos) {
  const texto = (v) => v == null || v === '' ? 'null' : `'${String(v).replaceAll("'", "''")}'`;
  const valores = puertos.map((p) => `(${texto(p.marca ?? '') ?? 'null'},${texto(p.modelo)},${texto(p.categoria)},${texto(p.nombre)},${p.total},${texto(p.sentido)}::sentido_puerto,${texto(p.senal)}::senal,${texto(p.conector)},${p.orden === '' ? 'null' : Number(p.orden)},${texto(p.notas)})`);
  return `-- BEGIN SINCRONIZACION PUERTOS
create temporary table seed_puertos_origen (
  marca text, modelo text not null, categoria text not null, nombre text not null,
  total integer not null check(total>0), sentido sentido_puerto not null,
  senal senal not null, conector text, orden integer, notas text
) on commit drop;
${valores.length ? `insert into seed_puertos_origen values\n${valores.join(',\n')};` : ''}
do $$ declare problemas text; begin
  select string_agg(format('%s %s [%s] / %s: %s artículos',o.marca,o.modelo,o.categoria,o.nombre,
    (select count(*) from articulos a where coalesce(a.marca,'')=coalesce(o.marca,'') and a.modelo=o.modelo and a.categoria=o.categoria)),E'\n')
  into problemas from seed_puertos_origen o where
    (select count(*) from articulos a where coalesce(a.marca,'')=coalesce(o.marca,'') and a.modelo=o.modelo and a.categoria=o.categoria) <> 1;
  if problemas is not null then raise exception 'CSV de puertos: artículo inexistente o ambiguo' using errcode='23514', detail=problemas; end if;
end $$;
create temporary table seed_puertos on commit drop as
select a.id as articulo_id,o.nombre,o.total,o.sentido,o.senal,o.conector,o.orden,o.notas
from seed_puertos_origen o join articulos a on coalesce(a.marca,'')=coalesce(o.marca,'') and a.modelo=o.modelo and a.categoria=o.categoria;
create unique index on seed_puertos(articulo_id,nombre);
-- Serializar altas/cambios del catálogo; los locks de fila bloquean también FK y bocas concurrentes.
lock table puertos in share row exclusive mode;
do $$ begin perform id from puertos order by id for update; end $$;
do $$ declare afectados text; begin
  with cambios as (
    select p.id,p.nombre,p.total,s.total as nuevo_total from puertos p
    left join seed_puertos s on s.articulo_id=p.articulo_id and s.nombre=p.nombre
    where p.fuente='csv' and (s.articulo_id is null or s.total<p.total)
  ), usos as (
    select p.id as puerto_id,p.nombre,p.nuevo_total,'conexion' as clase,c.id as referencia,
      s.nombre as propietario,v.lado,b.ordinal
    from cambios p join conexiones c on c.puerto_origen_id=p.id or c.puerto_destino_id=p.id
    join salas s on s.id=c.sala_id
    cross join lateral (values ('origen',c.puerto_origen_id),('destino',c.puerto_destino_id)) v(lado,puerto_id)
    left join conexion_bocas b on b.conexion_id=c.id and b.lado::text=v.lado and b.puerto_id=p.id
    where v.puerto_id=p.id and (p.nuevo_total is null or b.ordinal is null or b.ordinal>p.nuevo_total)
    union
    select p.id,p.nombre,p.nuevo_total,'conexion',b.conexion_id,s.nombre,b.lado::text,b.ordinal
    from cambios p join conexion_bocas b on b.puerto_id=p.id
    join conexiones c on c.id=b.conexion_id join salas s on s.id=c.sala_id
    where p.nuevo_total is null or b.ordinal>p.nuevo_total
    union
    select p.id,p.nombre,p.nuevo_total,'plantilla',b.plantilla_conexion_id,t.nombre,b.lado::text,b.ordinal
    from cambios p join plantilla_conexion_bocas b on b.puerto_id=p.id
    join plantilla_conexiones c on c.id=b.plantilla_conexion_id join plantillas_sala t on t.id=c.plantilla_id
    where p.nuevo_total is null or b.ordinal>p.nuevo_total
    union
    select p.id,p.nombre,p.nuevo_total,'ficha_tecnica',d.id,
      concat_ws(' ',a.marca,a.modelo,d.clave),'documental',null::integer
    from cambios p join articulo_datos_tecnicos d on d.puerto_id=p.id
    join articulos a on a.id=d.articulo_id where p.nuevo_total is null
  ) select string_agg(format('puerto %s [%s], %s %s [%s], lado %s, ordinal %s, nuevo total %s',
    nombre,puerto_id,clase,propietario,referencia,lado,coalesce(ordinal::text,'desconocido'),coalesce(nuevo_total::text,'retirado')),E'\n' order by puerto_id,clase,referencia,lado)
    into afectados from usos;
  if afectados is not null then raise exception 'CSV de puertos incompatible con conexiones o fichas existentes' using errcode='23514', detail=afectados; end if;
end $$;
delete from puertos p where p.fuente='csv' and not exists
  (select 1 from seed_puertos s where s.articulo_id=p.articulo_id and s.nombre=p.nombre);
insert into puertos(articulo_id,nombre,total,sentido,senal,conector,orden,notas,fuente)
select articulo_id,nombre,total,sentido,senal,conector,orden,notas,'csv' from seed_puertos
on conflict(articulo_id,nombre) do update set total=excluded.total,sentido=excluded.sentido,
  senal=excluded.senal,conector=excluded.conector,orden=excluded.orden,notas=excluded.notas
where puertos.fuente='csv';
-- END SINCRONIZACION PUERTOS`;
}

import { esquemaDatoTecnico } from '../src/lib/ficha-tecnica';
import { normalizarMarca, claveModelo } from './normalizacion.mjs';

type ArticuloSemilla = { marca: string | null; modelo: string; categoria: string };
const literal = (valor: unknown) => valor == null || valor === '' ? 'null' : `'${String(valor).replaceAll("'", "''")}'`;

/** Valida antes de escribir seed.sql. La resolución SQL vuelve a exigir una fila. */
export function sqlDatosTecnicos(filas: Record<string, string>[], catalogo: Map<string, ArticuloSemilla>, puertos: Array<ArticuloSemilla & { nombre: string }>) {
  const claves = new Set<string>();
  const valores = filas.map((fila, indice) => {
    const identidad = `${normalizarMarca(fila.marca) ?? ''}|${claveModelo(fila.marca, fila.modelo)}`;
    const articulo = catalogo.get(identidad);
    if (!articulo) throw new Error(`Ficha técnica fila ${indice + 2}: artículo no resuelto ${identidad}`);
    const clave = `${identidad}|${fila.clave}`;
    if (claves.has(clave)) throw new Error(`Ficha técnica duplicada: ${clave}`);
    claves.add(clave);
    const puertoNombre = fila.puerto_nombre || null;
    const puertoFuente = fila.puerto_fuente || null;
    if (puertoNombre ? !['csv', 'app'].includes(puertoFuente ?? '') : puertoFuente !== null) {
      throw new Error(`Ficha técnica fila ${indice + 2}: puerto_fuente explícita csv/app requerida solo con puerto_nombre`);
    }
    if (puertoFuente === 'csv' && !puertos.some((p) => p.nombre === puertoNombre && p.marca === articulo.marca && p.modelo === articulo.modelo && p.categoria === articulo.categoria)) {
      throw new Error(`Ficha técnica fila ${indice + 2}: puerto CSV no resuelto ${puertoNombre}`);
    }
    const dato = esquemaDatoTecnico.parse({ clave: fila.clave, concepto: fila.concepto, tipo: fila.tipo, estado: fila.estado,
      valor: JSON.parse(fila.valor_json), fuente: 'csv', fuente_url: fila.fuente_url || null,
      documento: fila.documento || null, apartado: fila.apartado || null, consultado_en: fila.consultado_en || null });
    // Mismo contrato DNS ASCII de la guarda SQL; no se admiten autoridades/IP literales.
    if (dato.fuente_url && !/^https:\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z]([a-z0-9-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^\s]*)?$/i.test(dato.fuente_url)) {
      throw new Error(`Ficha técnica fila ${indice + 2}: fuente HTTPS con nombre DNS ASCII requerida`);
    }
    return `(${[articulo.marca ?? '', articulo.modelo, articulo.categoria, dato.clave, dato.concepto, dato.tipo,
      dato.estado, JSON.stringify(dato.valor), dato.fuente_url, dato.documento, dato.apartado,
      dato.consultado_en, puertoNombre, puertoFuente].map(literal).join(',')})`;
  });
  return `-- BEGIN FICHAS TECNICAS
create temporary table seed_datos_tecnicos_origen (
  marca text, modelo text, categoria text, clave text, concepto text, tipo text, estado text,
  valor jsonb, fuente_url text, documento text, apartado text, consultado_en date, puerto_nombre text, puerto_fuente text
) on commit drop;
${valores.length ? `insert into seed_datos_tecnicos_origen values\n${valores.join(',\n')};` : ''}
do $$ declare errores text; begin
  select string_agg(format('%s %s: %s', o.marca,o.modelo,o.clave), E'\n') into errores
  from seed_datos_tecnicos_origen o where
    (select count(*) from articulos a where coalesce(a.marca,'')=coalesce(o.marca,'') and a.modelo=o.modelo and a.categoria=o.categoria)<>1
    or (o.puerto_nombre is not null and (select count(*) from puertos p join articulos a on a.id=p.articulo_id
      where coalesce(a.marca,'')=coalesce(o.marca,'') and a.modelo=o.modelo and a.categoria=o.categoria and p.nombre=o.puerto_nombre
        and (o.puerto_fuente='csv' or (o.puerto_fuente='app' and p.fuente='app')))<>1);
  if errores is not null then raise exception 'Ficha técnica: artículo o puerto sin resolver' using errcode='23514', detail=errores; end if;
end $$;
insert into articulo_datos_tecnicos(articulo_id,clave,concepto,tipo,estado,valor,fuente_url,documento,apartado,consultado_en,puerto_id,fuente)
select a.id,o.clave,o.concepto,o.tipo,o.estado,nullif(o.valor,'null'::jsonb),o.fuente_url,o.documento,o.apartado,o.consultado_en,p.id,'csv'
from seed_datos_tecnicos_origen o join articulos a on coalesce(a.marca,'')=coalesce(o.marca,'') and a.modelo=o.modelo and a.categoria=o.categoria
left join puertos p on p.articulo_id=a.id and p.nombre=o.puerto_nombre and (o.puerto_fuente='csv' or (o.puerto_fuente='app' and p.fuente='app'))
on conflict(articulo_id,clave) do update set concepto=excluded.concepto,tipo=excluded.tipo,estado=excluded.estado,valor=excluded.valor,
 fuente_url=excluded.fuente_url,documento=excluded.documento,apartado=excluded.apartado,
 consultado_en=excluded.consultado_en,puerto_id=excluded.puerto_id where articulo_datos_tecnicos.fuente='csv';
-- Una fuente retirada conserva su hecho: se marca desconocido, nunca compatible.
update articulo_datos_tecnicos d set estado='sin_documentar',valor=null
where d.fuente='csv' and not exists(select 1 from seed_datos_tecnicos_origen o join articulos a
  on coalesce(a.marca,'')=coalesce(o.marca,'') and a.modelo=o.modelo and a.categoria=o.categoria
  where a.id=d.articulo_id and o.clave=d.clave);
-- END FICHAS TECNICAS`;
}

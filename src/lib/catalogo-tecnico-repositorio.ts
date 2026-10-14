import type postgres from 'postgres';
import { z } from 'zod';
import {
  datosTecnicosSchema, filtrosTecnicosSchema, permisoCatalogoTecnico, procedenciaTecnicaSchema,
  validarArchivoTecnicoCompleto, type ArchivoTecnicoValidado, type EntradaDatosTecnicos,
  type FiltrosTecnicos, type ProcedenciaTecnica, type UsuarioTecnico,
} from './catalogo-tecnico';

type BaseTecnica = ReturnType<typeof postgres>;
export interface DatosTecnicos extends EntradaDatosTecnicos {
  articulo_id: string;
  verificado_en: string;
}
export interface ArchivoTecnico extends ProcedenciaTecnica {
  id: string;
  articulo_id: string;
  tipo: 'imagen' | 'ficha';
  nombre: string;
  mime: ArchivoTecnicoValidado['mime'];
  tamano_bytes: number;
  sha256: string;
  verificado_en: string;
}
export interface FichaTecnica {
  datos: DatosTecnicos | null;
  archivos: ArchivoTecnico[];
}
export interface ResultadoTecnico extends DatosTecnicos { categoria: string }

function exigir(usuario: UsuarioTecnico, minimo: 'ver' | 'editar') {
  if (!permisoCatalogoTecnico(usuario, minimo)) throw new Error(`Sin permiso para ${minimo} datos técnicos.`);
}
function identificador(valor: string): string { return z.uuid().parse(valor); }
function fecha(valor: unknown): string {
  return valor instanceof Date ? valor.toISOString() : String(valor);
}
function datosPublicos(fila: Record<string, unknown>): DatosTecnicos {
  return {
    articulo_id: String(fila.articulo_id), marca: fila.marca == null ? null : String(fila.marca),
    modelo: String(fila.modelo), origen: String(fila.origen), url: String(fila.url),
    fecha: fecha(fila.fecha).slice(0, 10), verificado_en: fecha(fila.verificado_en),
    ancho: fila.ancho == null ? null : Number(fila.ancho), alto: fila.alto == null ? null : Number(fila.alto),
    fondo: fila.fondo == null ? null : Number(fila.fondo), ru: fila.ru == null ? null : Number(fila.ru),
    unidad: fila.unidad as DatosTecnicos['unidad'],
  };
}
function archivoPublico(fila: Record<string, unknown>): ArchivoTecnico {
  return {
    id: String(fila.id), articulo_id: String(fila.articulo_id), tipo: fila.tipo as ArchivoTecnico['tipo'],
    nombre: String(fila.nombre), mime: fila.mime as ArchivoTecnico['mime'], tamano_bytes: Number(fila.tamano_bytes),
    sha256: String(fila.sha256), marca: fila.marca == null ? null : String(fila.marca), modelo: String(fila.modelo),
    origen: String(fila.origen), url: String(fila.url), fecha: fecha(fila.fecha).slice(0, 10),
    verificado_en: fecha(fila.verificado_en),
  };
}
async function comprobarModelo(db: BaseTecnica, articuloId: string, entrada: ProcedenciaTecnica) {
  const [articulo] = await db<Array<{ marca: string | null; modelo: string }>>`
    select marca, modelo from articulos where id = ${articuloId} for update`;
  if (!articulo) throw new Error('La referencia no existe.');
  if (articulo.marca !== entrada.marca || articulo.modelo !== entrada.modelo) {
    throw new Error('La marca o el modelo han cambiado. Recarga la ficha y verifica el modelo exacto.');
  }
}

/** La conexión se inyecta: las pruebas nunca recurren a DATABASE_URL. */
export async function obtenerDatosTecnicos(db: BaseTecnica, usuario: UsuarioTecnico, articuloId: string): Promise<FichaTecnica> {
  exigir(usuario, 'ver'); identificador(articuloId);
  const [datos, archivos] = await Promise.all([
    db`select articulo_id, marca, modelo, ancho, alto, fondo, unidad, ru, origen, url, fecha, verificado_en
       from articulos_tecnicos where articulo_id = ${articuloId}`,
    db`select id, articulo_id, tipo, nombre, mime, tamano_bytes, sha256, marca, modelo,
       origen, url, fecha, verificado_en from articulos_archivos_tecnicos where articulo_id = ${articuloId}
       order by tipo`,
  ]);
  return { datos: datos[0] ? datosPublicos(datos[0]) : null, archivos: archivos.map(archivoPublico) };
}

export async function guardarDatosTecnicos(db: BaseTecnica, usuario: UsuarioTecnico, articuloId: string, entrada: unknown): Promise<void> {
  exigir(usuario, 'editar'); identificador(articuloId);
  const datos = datosTecnicosSchema.parse(entrada);
  await db.begin(async tx => {
    await comprobarModelo(tx as unknown as BaseTecnica, articuloId, datos);
    await tx`insert into articulos_tecnicos
      (articulo_id, marca, modelo, ancho, alto, fondo, unidad, ru, origen, url, fecha, verificado_por)
      values (${articuloId}, ${datos.marca}, ${datos.modelo}, ${datos.ancho}, ${datos.alto},
              ${datos.fondo}, ${datos.unidad}, ${datos.ru}, ${datos.origen}, ${datos.url}, ${datos.fecha},
              ${usuario.ficticio ? null : identificador(usuario.id)})
      on conflict (articulo_id) do update set marca = excluded.marca, modelo = excluded.modelo,
        ancho = excluded.ancho, alto = excluded.alto, fondo = excluded.fondo, unidad = excluded.unidad,
        ru = excluded.ru, origen = excluded.origen, url = excluded.url, fecha = excluded.fecha,
        verificado_por = excluded.verificado_por, verificado_en = now()`;
  });
}

export async function guardarArchivoTecnico(db: BaseTecnica, usuario: UsuarioTecnico, articuloId: string,
  entrada: unknown, archivo: ArchivoTecnicoValidado): Promise<string> {
  exigir(usuario, 'editar'); identificador(articuloId);
  const procedencia = procedenciaTecnicaSchema.parse(entrada);
  // No fiarse del hash/tamaño aportado: comprobar otra vez los bytes que se guardan.
  const validado = await validarArchivoTecnicoCompleto(archivo.bytes, archivo.mime, archivo.nombre, archivo.tipo);
  return await db.begin(async tx => {
    await comprobarModelo(tx as unknown as BaseTecnica, articuloId, procedencia);
    const [fila] = await tx<Array<{id: string}>>`insert into articulos_archivos_tecnicos
      (articulo_id, tipo, nombre, mime, tamano_bytes, sha256, bytes, marca, modelo,
       origen, url, fecha, verificado_por)
      values (${articuloId}, ${validado.tipo}, ${validado.nombre}, ${validado.mime}, ${validado.tamano_bytes},
              ${validado.sha256}, ${validado.bytes}, ${procedencia.marca}, ${procedencia.modelo},
              ${procedencia.origen}, ${procedencia.url}, ${procedencia.fecha},
              ${usuario.ficticio ? null : identificador(usuario.id)})
      on conflict (articulo_id, tipo) do update set nombre = excluded.nombre, mime = excluded.mime,
        tamano_bytes = excluded.tamano_bytes, sha256 = excluded.sha256, bytes = excluded.bytes,
        marca = excluded.marca, modelo = excluded.modelo, origen = excluded.origen,
        url = excluded.url, fecha = excluded.fecha, verificado_por = excluded.verificado_por,
        verificado_en = now()
      returning id`;
    return fila.id;
  }) as string;
}

export async function obtenerArchivoTecnico(db: BaseTecnica, usuario: UsuarioTecnico, articuloId: string,
  archivoId: string): Promise<(ArchivoTecnico & {bytes: Buffer}) | null> {
  exigir(usuario, 'ver'); identificador(articuloId); identificador(archivoId);
  const [fila] = await db`select id, articulo_id, tipo, nombre, mime, tamano_bytes, sha256,
    bytes, marca, modelo, origen, url, fecha, verificado_en from articulos_archivos_tecnicos
    where articulo_id = ${articuloId} and id = ${archivoId}`;
  if (!fila) return null;
  const publico = archivoPublico(fila);
  const verificado = await validarArchivoTecnicoCompleto(fila.bytes as Buffer, publico.mime, publico.nombre, publico.tipo);
  if (verificado.sha256 !== publico.sha256 || verificado.tamano_bytes !== publico.tamano_bytes) {
    throw new Error('El archivo no coincide con su hash o tamaño registrados.');
  }
  return { ...publico, bytes: verificado.bytes };
}

export async function buscarPorAtributosTecnicos(db: BaseTecnica, usuario: UsuarioTecnico,
  entrada: FiltrosTecnicos): Promise<ResultadoTecnico[]> {
  exigir(usuario, 'ver');
  const f = filtrosTecnicosSchema.parse(entrada);
  if (!f.q && !f.ancho_max_mm && !f.alto_max_mm && !f.fondo_max_mm && !f.ru) return [];
  const patron = `%${f.q.replace(/[\\%_]/g, '\\$&')}%`;
  const filas = await db`select t.*, a.categoria from articulos_tecnicos t join articulos a on a.id = t.articulo_id
    where a.activo and t.modelo = a.modelo and t.marca is not distinct from a.marca
      and (${f.q} = '' or concat_ws(' ', a.marca, a.modelo, a.categoria) ilike ${patron})
      and (${f.ancho_max_mm ?? null}::numeric is null or t.ancho * case t.unidad when 'mm' then 1 when 'cm' then 10 when 'm' then 1000 end <= ${f.ancho_max_mm ?? null})
      and (${f.alto_max_mm ?? null}::numeric is null or t.alto * case t.unidad when 'mm' then 1 when 'cm' then 10 when 'm' then 1000 end <= ${f.alto_max_mm ?? null})
      and (${f.fondo_max_mm ?? null}::numeric is null or t.fondo * case t.unidad when 'mm' then 1 when 'cm' then 10 when 'm' then 1000 end <= ${f.fondo_max_mm ?? null})
      and (${f.ru ?? null}::numeric is null or t.ru = ${f.ru ?? null})
    order by a.marca nulls last, a.modelo, a.id limit 20`;
  return filas.map(fila => ({ ...datosPublicos(fila), categoria: String(fila.categoria) }));
}

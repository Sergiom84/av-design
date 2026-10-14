import 'server-only';
import { hayConfiguracion } from './db';
import { sesionActual } from './sesion-servidor';
import { puede } from './usuarios';
import type { DestinoImportacion, EntradaImportacion } from './importacion';
import { ErrorImportacion } from './importacion/modelo';

export class ErrorImportacionHttp extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function comprobarOrigen(request: Request) {
  const origen = request.headers.get('origin');
  if (!origen || origen !== new URL(request.url).origin) {
    throw new ErrorImportacionHttp('La petición debe proceder de esta aplicación.', 403);
  }
}

export async function usuarioImportacion(destino?: DestinoImportacion) {
  const yo = await sesionActual();
  if (!yo) throw new ErrorImportacionHttp('Sin sesión.', 401);
  if (yo.debeCambiarClave) throw new ErrorImportacionHttp('Cambia la contraseña provisional.', 403);
  if (!hayConfiguracion()) throw new ErrorImportacionHttp('Base de datos sin configurar.', 503);
  if (destino === 'bom') {
    if (!puede(yo.permisos, 'salas', 'editar') || !puede(yo.permisos, 'catalogo', 'ver')) {
      throw new ErrorImportacionHttp('Sin permiso para importar material de sala.', 403);
    }
  } else if (destino && !puede(yo.permisos, 'catalogo', 'editar')) {
    throw new ErrorImportacionHttp('Sin permiso para importar catálogo o precios.', 403);
  }
  return yo;
}

/** Limita incluso las peticiones sin Content-Length antes de analizar multipart. */
export async function formularioAcotado(request: Request): Promise<FormData> {
  const maximo = 6 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > maximo) {
    throw new ErrorImportacionHttp('Archivo demasiado grande: máximo 5 MiB.', 413);
  }
  const lector = request.body?.getReader();
  if (!lector) throw new ErrorImportacionHttp('Falta el archivo.', 400);
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel();
      throw new ErrorImportacionHttp('Archivo demasiado grande: máximo 5 MiB.', 413);
    }
    partes.push(value);
  }
  const bytes = Buffer.concat(partes);
  return new Response(bytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData();
}

export function destinoDelFormulario(datos: FormData): DestinoImportacion {
  const destino = datos.get('destino');
  if (destino !== 'catalogo' && destino !== 'bom' && destino !== 'precios') {
    throw new ErrorImportacionHttp('Elige catálogo, BOM de sala u ofertas.', 400);
  }
  return destino;
}

export async function entradaDelFormulario(datos: FormData): Promise<EntradaImportacion> {
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) throw new ErrorImportacionHttp('Falta el archivo.', 400);
  if (archivo.size > 5 * 1024 * 1024) throw new ErrorImportacionHttp('Máximo 5 MiB.', 413);
  const destino = destinoDelFormulario(datos);
  const origen = String(datos.get('origen') ?? '').trim();
  if (!origen || origen.length > 500) throw new ErrorImportacionHttp('Indica la procedencia (máximo 500 caracteres).', 400);
  const salaId = String(datos.get('salaId') ?? '').trim() || undefined;
  if (salaId && !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(salaId)) {
    throw new ErrorImportacionHttp('Identificador de sala inválido.', 400);
  }
  return { destino, salaId, origen, archivo: { nombre: archivo.name, bytes: new Uint8Array(await archivo.arrayBuffer()) } };
}

export function respuestaErrorImportacion(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : 'No se pudo completar la importación.' }, {
    status: error instanceof ErrorImportacionHttp ? error.status : error instanceof ErrorImportacion ? error.estadoHttp : 400,
    headers: { 'Cache-Control': 'no-store' },
  });
}

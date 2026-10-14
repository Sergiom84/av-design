import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { MAX_ARCHIVO_TECNICO, validarArchivoTecnicoCompleto } from '@/lib/catalogo-tecnico';
import { guardarArchivoTecnico, guardarDatosTecnicos, obtenerDatosTecnicos } from '@/lib/catalogo-tecnico-repositorio';
import { accesoTecnico, errorTecnico, leerCuerpoTecnico } from '../comun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = { params: Promise<{id: string}> };

export async function GET(request: Request, contexto: Contexto) {
  const acceso = await accesoTecnico(request, 'ver');
  if (acceso.error) return acceso.error;
  try { return Response.json(await obtenerDatosTecnicos(sql, acceso.usuario, (await contexto.params).id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return errorTecnico(error); }
}
export async function PUT(request: Request, contexto: Contexto) {
  const acceso = await accesoTecnico(request, 'editar');
  if (acceso.error) return acceso.error;
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Se requiere JSON.');
    const id = (await contexto.params).id;
    const cuerpo = await leerCuerpoTecnico(request, 8192);
    await guardarDatosTecnicos(sql, acceso.usuario, id, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(cuerpo)));
    revalidatePath(`/articulo/${id}`);
    return Response.json({ guardado: true });
  } catch (error) { return errorTecnico(error); }
}
export async function POST(request: Request, contexto: Contexto) {
  const acceso = await accesoTecnico(request, 'editar');
  if (acceso.error) return acceso.error;
  try {
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Error('Se requiere un formulario de archivo.');
    const cuerpo = await leerCuerpoTecnico(request, MAX_ARCHIVO_TECNICO + 64 * 1024);
    const formulario = await new Response(cuerpo as BodyInit, { headers: { 'content-type': request.headers.get('content-type')! } }).formData();
    const archivo = formulario.get('archivo');
    const tipo = formulario.get('tipo');
    if (!(archivo instanceof File) || (tipo !== 'imagen' && tipo !== 'ficha')) throw new Error('Selecciona una imagen o ficha.');
    const id = (await contexto.params).id;
    const metadata = JSON.parse(String(formulario.get('procedencia') ?? ''));
    const validado = await validarArchivoTecnicoCompleto(new Uint8Array(await archivo.arrayBuffer()), archivo.type, archivo.name, tipo);
    const archivoId = await guardarArchivoTecnico(sql, acceso.usuario, id, metadata, validado);
    revalidatePath(`/articulo/${id}`);
    return Response.json({ guardado: true, archivoId });
  } catch (error) { return errorTecnico(error); }
}

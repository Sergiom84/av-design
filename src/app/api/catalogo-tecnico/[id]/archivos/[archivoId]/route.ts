import { sql } from '@/lib/db';
import { obtenerArchivoTecnico } from '@/lib/catalogo-tecnico-repositorio';
import { accesoTecnico, errorTecnico } from '../../../comun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, contexto: { params: Promise<{id: string; archivoId: string}> }) {
  const acceso = await accesoTecnico(request, 'ver');
  if (acceso.error) return acceso.error;
  try {
    const { id, archivoId } = await contexto.params;
    const archivo = await obtenerArchivoTecnico(sql, acceso.usuario, id, archivoId);
    if (!archivo) return Response.json({ error: 'Archivo no encontrado.' }, { status: 404 });
    const mostrar = archivo.tipo === 'imagen' && new URL(request.url).searchParams.get('vista') === '1';
    return new Response(new Uint8Array(archivo.bytes), { headers: {
      'Content-Type': archivo.mime,
      'Content-Length': String(archivo.tamano_bytes),
      'Content-Disposition': `${mostrar ? 'inline' : 'attachment'}; filename="${archivo.tipo}.${archivo.nombre.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Archivo-Sha256': archivo.sha256,
    } });
  } catch (error) { return errorTecnico(error); }
}

import { sesionActual } from '@/lib/sesion-servidor';
import { permisoExportacion } from '@/lib/documentos/seleccion';
import { leerArchivo, leerPaquete } from '@/lib/documentos/paquete';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:RouteContext<'/api/documentos/[id]/descarga'>) {
  const yo=await sesionActual();
  if(!yo) return new Response('Sin sesión.',{status:401});
  if(yo.debeCambiarClave) return new Response('Cambia la contraseña provisional.',{status:403});
  const {id}=await context.params;
  const paquete=await leerPaquete(id,yo.id);
  if(!paquete) return new Response('Paquete no disponible o caducado.',{status:404});
  if(!permisoExportacion(yo.permisos,paquete.manifiesto.documentos,paquete.esObra)) return new Response('Sin permiso.',{status:403});
  const nombre=new URL(request.url).searchParams.get('archivo')??'paquete.zip';
  const bytes=await leerArchivo(id,nombre,paquete.manifiesto);
  if(!bytes) return new Response('Documento no disponible.',{status:404});
  const tipo=nombre.endsWith('.zip')?'application/zip':nombre.endsWith('.pdf')?'application/pdf':
    nombre.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      nombre.endsWith('.csv')?'text/csv; charset=utf-8':'application/json';
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':tipo,'Content-Disposition':`attachment; filename="${nombre}"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-AV-Revision':paquete.manifiesto.revision}});
}

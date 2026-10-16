import { sesionActual } from '@/lib/sesion-servidor';
import { permisoExportacion } from '@/lib/documentos/seleccion';
import { leerPaquete } from '@/lib/documentos/paquete';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:RouteContext<'/api/documentos/[id]'>) {
  let yo;
  try {yo=await sesionActual();}
  catch {return Response.json({error:'Servicio temporalmente no disponible. Prueba de nuevo.'},{status:503});}
  if(!yo) return Response.json({error:'Sin sesión.'},{status:401});
  if(yo.debeCambiarClave) return Response.json({error:'Cambia la contraseña provisional.'},{status:403});
  const {id}=await context.params;
  const paquete=await leerPaquete(id,yo.id);
  if(!paquete) return Response.json({error:'Paquete no disponible o caducado. Genera una revisión nueva.'},{status:404});
  if(!permisoExportacion(yo.permisos,paquete.manifiesto.documentos,paquete.esObra))
    return Response.json({error:'Sin permiso para descargar esta selección.'},{status:403});
  return Response.json(paquete.manifiesto,{headers:{'Cache-Control':'no-store'}});
}

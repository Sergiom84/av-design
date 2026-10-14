import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { cargarSnapshot, ErrorSeleccionDocumentos } from '@/lib/documentos/datos';
import { seleccionDocumentos, permisoExportacion } from '@/lib/documentos/seleccion';
import { generarPaquete, type EventoPaquete } from '@/lib/documentos/paquete';
import { generarPdfTecnico } from '@/lib/documentos/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request:Request) {
  const yo=await sesionActual();
  if(!yo) return Response.json({error:'Sin sesión.'},{status:401});
  if(yo.debeCambiarClave) return Response.json({error:'Cambia la contraseña provisional antes de descargar.'},{status:403});
  if(!hayConfiguracion()) return Response.json({error:'Base de datos sin configurar.'},{status:503});
  let entrada;
  try {
    const texto=await request.text();
    if(texto.length>16000) throw new Error('Solicitud demasiado grande');
    entrada=seleccionDocumentos.safeParse(JSON.parse(texto));
  } catch {return Response.json({error:'Selección de documentos inválida.'},{status:400});}
  if(!entrada.success) return Response.json({error:entrada.error.issues.map(i=>i.message).join(' ')},{status:400});
  const seleccion=entrada.data;
  if(!permisoExportacion(yo.permisos,seleccion.documentos,Boolean(seleccion.proyectoId))) {
    return Response.json({error:'Sin permiso para exportar los documentos seleccionados.'},{status:403});
  }
  let snapshot;
  try {snapshot=await cargarSnapshot(seleccion.salaIds,seleccion.proyectoId);}
  catch(e) {
    const seleccionInvalida = e instanceof ErrorSeleccionDocumentos;
    return Response.json({error:seleccionInvalida ? e.message : 'No se pudieron leer los datos. Prueba una nueva generación.'},
      {status:seleccionInvalida ? 400 : 503});
  }
  // Inyección exclusiva del servidor de prueba local; inaccesible en producción.
  const simular = process.env.NODE_ENV !== 'production' && process.env.AV_DOCUMENTOS_PRUEBA === '1'
    ? request.headers.get('x-av-prueba-fallo-pdf') : null;
  const encoder=new TextEncoder();
  let cancelado=false;
  const stream=new ReadableStream({
    start(controller) {
      const emitir=(evento:EventoPaquete)=>{if(!cancelado) controller.enqueue(encoder.encode(JSON.stringify(evento)+'\n'));};
      void generarPaquete(snapshot,seleccion.documentos,seleccion.opciones,yo.id,emitir,
        async (...args)=>{if(simular===args[2]) throw new Error('Fallo PDF simulado');return generarPdfTecnico(...args);},
        Boolean(seleccion.proyectoId))
        .catch(()=>emitir({tipo:'error',error:'No se pudo completar el paquete. Conserva el paquete anterior y prueba una nueva generación.'}))
        .finally(()=>{if(!cancelado) controller.close();});
    },cancel(){cancelado=true;},
  });
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'}});
}

import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerProyecto } from '@/lib/datos-proyectos';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { puedeExportarBom } from '@/lib/documentos/seleccion';
import { SinConfigurar } from '@/components/sin-configurar';
import { ExportadorDocumentos } from '@/components/documentos/exportador';
import { Cabecera, Enlace } from '@/components/ui';
export const dynamic='force-dynamic';
export default async function DocumentosProyecto({params}:PageProps<'/proyectos/[id]/documentos'>) {
  const yo=await exigirSeccion('salas');
  await exigirSeccion('proyectos');
  if(!hayConfiguracion())return <SinConfigurar/>;
  const {id}=await params;
  const proyecto=await obtenerProyecto(id);
  if(!proyecto)notFound();
  return <><Cabecera titulo={`Documentos · ${proyecto.nombre}`} descripcion={proyecto.codigo??undefined}
    acciones={<Enlace href={`/proyectos/${id}`}>Volver a la obra</Enlace>}/>
    <ExportadorDocumentos proyectoId={id} salas={proyecto.salas.map(s=>({id:s.id,nombre:s.nombre,codigo:s.codigo}))}
      puedeBom={puedeExportarBom(yo.permisos)}/></>;
}

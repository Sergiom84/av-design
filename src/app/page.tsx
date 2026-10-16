import { hayConfiguracion,sql } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso,Cabecera } from '@/components/ui';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { leerPanel } from '@/lib/panel-repositorio';
import { ResumenPanel } from '@/components/panel/resumen-panel';
import { EditorPreferencias } from '@/components/preferencias/editor-preferencias';
export const dynamic='force-dynamic';
export default async function Panel(){
  const yo=await exigirSeccion('panel','ver');
  if(!hayConfiguracion())return <SinConfigurar/>;
  let datos;
  try{datos=await leerPanel(sql,yo);}catch{return <><Cabecera titulo="Panel"/><Aviso tono="alerta">No se pudo consultar el Panel. Vuelve a cargar la página.</Aviso></>;}
  return <>
    <Cabecera titulo="Panel" descripcion="Diseño de salas, cálculo de metros de cable y lista de material para las instalaciones del departamento."/>
    <ResumenPanel datos={datos}/>
    <EditorPreferencias key={yo.id} grupo="panel" ficticio={yo.ficticio} inicial={{grupo:'panel',version:datos.version,valor:datos.preferencias,opciones:datos.opciones}}/>
  </>;
}

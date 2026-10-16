import { Cabecera,Aviso } from '@/components/ui';
import { SinConfigurar } from '@/components/sin-configurar';
import { GestionServicio } from '@/components/servicio-instalaciones/gestion';
import { sesionActual } from '@/lib/sesion-servidor';
import { sql,hayConfiguracion } from '@/lib/db';
import { RepositorioServicio } from '@/lib/servicio-instalaciones/repositorio';
import { errorServicio } from '@/lib/servicio-instalaciones/http';
export const dynamic='force-dynamic';
export default async function PaginaServicio({params}:{params:Promise<{id:string}>}){
  const {id}=await params,u=await sesionActual();if(!hayConfiguracion())return <SinConfigurar/>;
  const r=await new RepositorioServicio(sql).listar(u?.id??'',{salaId:id}).then(datos=>({datos,error:''})).catch(e=>({datos:null,error:errorServicio(e).message}));
  return <><Cabecera titulo="Activos y servicio" descripcion="Unidades identificadas, incidencias y visitas reales."/>{r.datos?<GestionServicio inicial={r.datos} salaId={id}/>:<Aviso tono="alerta">{r.error}</Aviso>}</>;
}

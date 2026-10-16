import { sql, hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { partesMadrid, sumarDias } from '@/lib/informes/periodos';
import { RepositorioCostes } from '@/lib/costes/repositorio';
import { errorSeguroCostes } from '@/lib/costes/http';
import { tieneCapacidadFinanciera } from '@/lib/costes/autorizacion';
import { CostesObra } from '@/components/costes/conciliacion';
import { Aviso } from '@/components/ui';
import { SinConfigurar } from '@/components/sin-configurar';
export const dynamic='force-dynamic';
export default async function CostesProyecto({params}:{params:Promise<{id:string}>}) {
  if(!hayConfiguracion())return <SinConfigurar/>;
  const resultado=await (async()=>{
    const u=await sesionActual();
    if(!u||u.ficticio||u.debeCambiarClave||!tieneCapacidadFinanciera(u))return {datos:null,error:'Acceso no disponible.'};
    const {id}=await params,datos=await new RepositorioCostes(sql).metadatos(u.id,id);
    return {datos,error:''};
  })().catch(e=>({datos:null,error:errorSeguroCostes(e).message}));
  if(!resultado.datos)return <Aviso tono="alerta">{resultado.error}</Aviso>;
  const hoy=partesMadrid(new Date()).fecha;
  return <CostesObra inicial={resultado.datos} periodo={{desde:sumarDias(hoy,-30),hasta:hoy}}/>;
}

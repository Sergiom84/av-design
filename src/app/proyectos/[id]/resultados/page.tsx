import { hayConfiguracion } from '@/lib/db';
import { sesionActual } from '@/lib/sesion-servidor';
import { exigirResultado } from '@/lib/resultados-propuestas/autorizacion';
import { SinConfigurar } from '@/components/sin-configurar';
import { ResultadosPropuestas } from '@/components/resultados-propuestas/comparacion';
export const dynamic='force-dynamic';
export default async function Pagina({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(!hayConfiguracion())return <SinConfigurar/>;
 const u=await sesionActual();if(!u||u.ficticio||u.debeCambiarClave)return <p role="alert">Se necesita una identidad real con contraseña definitiva.</p>;let permitido=true;try{exigirResultado(u);}catch{permitido=false;}if(!permitido)return <p role="alert">No tienes permiso para resultados financieros.</p>;
 const {id}=await params,p=await searchParams,primero=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
 return <ResultadosPropuestas key={`${id}:${primero(p.propuesta)??''}:${primero(p.revision)??''}`} proyectoId={id} propuestaInicial={primero(p.propuesta)} revisionInicial={primero(p.revision)}/>;
}

import { sql, hayConfiguracion } from '@/lib/db';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { RepositorioPlanificacion } from '@/lib/planificacion/repositorio';
import { errorSeguroPlan } from '@/lib/planificacion/http';
import { PlanMontaje } from '@/components/planificacion/plan';
import { Cabecera, Aviso, Enlace } from '@/components/ui';
import { puede } from '@/lib/usuarios';
import { SinConfigurar } from '@/components/sin-configurar';
export const dynamic = 'force-dynamic';
export default async function PlanObra({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const yo = await exigirSeccion('proyectos', 'ver');
    if (!hayConfiguracion())
        return <SinConfigurar />;
    const resultado = await (async () => {
        const { id } = await params, repo = new RepositorioPlanificacion(sql);
        const datos = await repo.leerPlan(yo.id, id);
        const [reglas, trabajos, grupos] = await Promise.all([datos.puedeSalas ? repo.reglas(yo.id) : [], repo.catalogo(yo.id), repo.grupos(yo.id, id)]);
        return { datos, reglas, trabajos, grupos };
    })().then(data => ({ data, error: '' })).catch(e => ({ data: null, error: errorSeguroPlan(e).message }));
    if (!resultado.data)
        return <Aviso tono="alerta">
    {resultado.error}
  </Aviso>;
    const { datos, reglas, trabajos, grupos } = resultado.data;
    return <>
    <Cabecera titulo={`Plan · ${datos.proyecto.nombre}`} descripcion="Tareas, técnicos e intervalos del montaje." acciones={
      !yo.ficticio && !yo.debeCambiarClave ? <>
        <Enlace href="/cuenta/tiempos">Mis tiempos</Enlace>
        {puede(yo.permisos, 'proyectos', 'editar') && <Enlace href={`/proyectos/${datos.proyecto.id}/tiempos`}>Tiempos de la obra</Enlace>}
      </> : undefined
    }/>
    <PlanMontaje key={datos.proyecto.id} inicial={datos} reglas={reglas} trabajos={trabajos} gruposIniciales={grupos}/>
  </>;
}

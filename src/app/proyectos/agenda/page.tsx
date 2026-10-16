import { sql, hayConfiguracion } from '@/lib/db';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { RepositorioPlanificacion } from '@/lib/planificacion/repositorio';
import { entradaPlan, filtroAgendaSchema, urlAgendaPlan } from '@/lib/planificacion/modelo';
import { errorSeguroPlan } from '@/lib/planificacion/http';
import { AgendaPlan } from '@/components/planificacion/agenda';
import { Cabecera, Aviso } from '@/components/ui';
import { SinConfigurar } from '@/components/sin-configurar';
export const dynamic = 'force-dynamic';
export default async function Agenda({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const yo = await exigirSeccion('proyectos', 'ver');
    if (!hayConfiguracion())
        return <SinConfigurar />;
    const resultado = await (async () => {
        const bruto = await searchParams;
        const limpio = Object.fromEntries(Object.entries(bruto).filter(([, v]) => v !== '' && v !== undefined));
        const filtro = entradaPlan(filtroAgendaSchema, { ...limpio, historial: limpio.historial === '1' });
        const repo = new RepositorioPlanificacion(sql), ahora = new Date();
        const datos = await repo.agenda(yo.id, filtro, ahora);
        const tecnicos = await repo.tecnicos(yo.id);
        if (filtro.tecnicoId && !tecnicos.some(t => t.id === filtro.tecnicoId))
            tecnicos.push(await repo.tecnicoAgenda(yo.id, filtro.tecnicoId));
        return { datos, obras: await repo.listadoObras(yo.id), tecnicos };
    })().then(data => ({ data, error: '' })).catch(e => ({ data: null, error: errorSeguroPlan(e).message }));
    if (!resultado.data)
        return <Aviso tono="alerta">
    {resultado.error}
  </Aviso>;
    return <>
    <Cabecera titulo="Agenda de montaje" descripcion="Hoy, semana, vencidas y tareas sin fecha. Ocupación planificada en Madrid."/>
    <AgendaPlan key={urlAgendaPlan(resultado.data.datos.filtros)} datos={resultado.data.datos} obras={resultado.data.obras} tecnicos={resultado.data.tecnicos}/>
  </>;
}

import { sql, hayConfiguracion } from '@/lib/db';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { RepositorioPlanificacion } from '@/lib/planificacion/repositorio';
import { veSalas, veCatalogo } from '@/lib/planificacion/autorizacion';
import { errorSeguroPlan } from '@/lib/planificacion/http';
import { CatalogoTareas } from '@/components/planificacion/catalogo-tareas';
import { Cabecera, Aviso } from '@/components/ui';
import { SinConfigurar } from '@/components/sin-configurar';
export const dynamic = 'force-dynamic';
export default async function Catalogo() {
    const yo = await exigirSeccion('proyectos', 'ver');
    if (!hayConfiguracion())
        return <SinConfigurar />;
    const resultado = await (async () => {
        const repo = new RepositorioPlanificacion(sql), autor = await repo.identidad(yo.id);
        return { autor, trabajos: await repo.catalogo(yo.id, '', 1, true), reglas: veSalas(autor) ? await repo.reglas(yo.id) : [] };
    })().then(data => ({ data, error: '' })).catch(e => ({ data: null, error: errorSeguroPlan(e).message }));
    if (!resultado.data)
        return <Aviso tono="alerta">
    {resultado.error}
  </Aviso>;
    const { autor, trabajos, reglas } = resultado.data;
    return <>
    <Cabecera titulo="Trabajos y reglas de montaje" descripcion="Las tareas existentes conservan sus valores al cambiar este catálogo."/>
    <CatalogoTareas inicial={trabajos} reglas={reglas} editar={autor.permisos.proyectos === 'editar'} puedeSalas={veSalas(autor)} puedeCatalogo={veCatalogo(autor)}/>
  </>;
}

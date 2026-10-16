import { RepositorioInformes } from './repositorio';
import { procesarEjecucion, type OpcionesProcesamiento } from './servicio';
export async function pasadaInformes(repo: RepositorioInformes, opciones: OpcionesProcesamiento & {
    detener?: () => boolean;
    latido?: () => Promise<void>;
} = {}) {
    const planificadas = await repo.planificar();
    await repo.transaccion(async (r) => {
        await r.sql `select pg_advisory_xact_lock(728303)`;
        await r.purgar();
    });
    const trabajos = [];
    for (let i = 0; i < 10 && !opciones.detener?.(); i++) {
        await opciones.latido?.();
        const e = await repo.reclamar();
        if (!e)
            break;
        trabajos.push(await procesarEjecucion(repo, e, opciones));
    }
    return { planificadas, trabajos, fallosInfraestructura: trabajos.filter(t => t.infraestructura).length };
}

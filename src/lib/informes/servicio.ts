import { capturarInforme } from './lectores';
import { exportarInforme, sellarSnapshot, sha256 } from './exportadores';
import { errorSeguro, ErrorInforme, GENERADOR, CLAVES, serializarCanonico } from './modelo';
import { RepositorioInformes, type EjecucionInforme } from './repositorio';
export interface OpcionesProcesamiento {
    capturar?: typeof capturarInforme;
    exportar?: typeof exportarInforme;
    antesDePublicar?: () => Promise<void>;
}
export async function procesarEjecucion(repo: RepositorioInformes, e: EjecucionInforme, opciones: OpcionesProcesamiento = {}) {
    let perdido = false;
    let renovando = false;
    const latido = setInterval(() => {
        if (renovando)
            return;
        renovando = true;
        repo.renovar(e).catch(() => {
            perdido = true;
        }).finally(() => {
            renovando = false;
        });
    }, 15000);
    try {
        if (e.definicion_snapshot.versionGenerador !== GENERADOR || e.definicion_snapshot.configuracion.versionRegistro !== 1 || e.definicion_snapshot.configuracion.versionModelo !== 1 || !CLAVES.includes(e.definicion_snapshot.configuracion.clave) || !!e.snapshot && e.snapshot.versionModelo !== 1)
            throw new ErrorInforme('VERSION_NO_SOPORTADA', 'La versión del generador no está disponible.', 422);
        if (sha256(serializarCanonico(e.definicion_snapshot)) !== e.definicion_sha256)
            throw new ErrorInforme('ARCHIVO_INTEGRO_NO_DISPONIBLE', 'La definición congelada no es íntegra.', 503);
        await repo.transaccion(async (r) => {
            await r.lease(e);
            await r.validarAudienciaEjecucion(e);
        });
        let snapshot = e.snapshot;
        let hash = e.snapshot_sha256;
        if (!snapshot) {
            const captura = await (opciones.capturar ?? capturarInforme)({ id: e.id, definicion: e.definicion_snapshot, definicionSha256: e.definicion_sha256, periodo: e.periodo_resuelto, ocurrencia: new Date(e.ocurrencia_utc).toISOString() });
            const sellado = sellarSnapshot(captura);
            snapshot = sellado.snapshot;
            hash = sellado.sha256;
            if (perdido)
                throw new ErrorInforme('LEASE_VENCIDO', 'Se perdió el lease.', 409);
            await repo.persistirCaptura(e, snapshot, hash);
        }
        if (!hash || sha256(serializarCanonico(snapshot)) !== hash)
            throw new ErrorInforme('ARCHIVO_INTEGRO_NO_DISPONIBLE', 'La captura no es íntegra.', 503);
        const resultado = await (opciones.exportar ?? exportarInforme)(snapshot, hash);
        await opciones.antesDePublicar?.();
        if (perdido)
            throw new ErrorInforme('LEASE_VENCIDO', 'Se perdió el lease durante la generación.', 409);
        await repo.publicar(e, resultado.archivos, resultado.manifiesto);
        return { id: e.id, estado: 'correcta' };
    }
    catch (error) {
        const seguro = errorSeguro(error);
        await repo.fallar(e, seguro);
        return { id: e.id, estado: ['PERMISO_RETIRADO', 'USUARIO_NO_DISPONIBLE', 'VERSION_NO_SOPORTADA', 'AMBITO_CAMBIADO'].includes(seguro.codigo) ? 'bloqueada' : 'fallida', codigo: seguro.codigo, infraestructura: seguro.transitorio || seguro.codigo === 'ARCHIVO_INTEGRO_NO_DISPONIBLE' };
    }
    finally {
        clearInterval(latido);
    }
}

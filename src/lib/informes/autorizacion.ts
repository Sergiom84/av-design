import type postgres from 'postgres';
import { esRol, esSeccion, esAcceso, resolverPermisos, puede, type Permisos, type Rol, type Seccion, type Acceso } from '../usuarios';
import { ErrorInforme, LIMITES, serializarCanonico, type ConfiguracionInforme } from './modelo';
import { seccionesInforme } from './registro';
export type ConexionInformes = ReturnType<typeof postgres>;
export type ConexionLecturaInformes = postgres.Sql<Record<string, unknown>> |
    postgres.TransactionSql<Record<string, unknown>>;
export interface IdentidadInforme {
    id: string;
    usuario: string;
    nombre: string;
    rol: Rol;
    activo: boolean;
    provisional: boolean;
    permisos: Permisos;
}
export interface OrigenReceptor {
    tipo: 'propietario' | 'directo' | 'grupo';
    id?: string;
    version?: number;
    revocadoEn?: string;
}
export interface ReceptorInforme {
    usuarioId: string;
    nombre: string;
    origenes: OrigenReceptor[];
}
export async function identidadActual(sql: ConexionLecturaInformes, id: string): Promise<IdentidadInforme> {
    const [u] = await sql `select id,usuario,nombre,rol::text as rol,activo,debe_cambiar_clave from usuarios where id=${id}`;
    if (!u || !u.activo)
        throw new ErrorInforme('USUARIO_NO_DISPONIBLE', 'No hay una identidad activa.', 401);
    if (u.debe_cambiar_clave)
        throw new ErrorInforme('USUARIO_NO_DISPONIBLE', 'Cambia la contraseña provisional antes de usar informes.', 403);
    if (!esRol(u.rol))
        throw new ErrorInforme('PERMISO_RETIRADO', 'Identidad no autorizada.', 403);
    const filas = await sql `select seccion,acceso from usuario_permisos where usuario_id=${id}`;
    const excepciones: Partial<Record<Seccion, Acceso>> = {};
    for (const f of filas)
        if (esSeccion(f.seccion) && esAcceso(f.acceso))
            excepciones[f.seccion] = f.acceso;
    return { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: u.activo, provisional: u.debe_cambiar_clave, permisos: resolverPermisos(u.rol, excepciones) };
}
export function autorizarAmbitoInforme(u: IdentidadInforme, c: Pick<ConfiguracionInforme, 'clave' | 'ambito'>): void {
    if (!u.activo || u.provisional || u.id === '00000000-0000-0000-0000-000000000000')
        throw new ErrorInforme('USUARIO_NO_DISPONIBLE', 'Se necesita un usuario real activo.', 403);
    if (seccionesInforme(c.clave, c.ambito).some(s => !puede(u.permisos, s, 'ver')))
        throw new ErrorInforme('PERMISO_RETIRADO', 'No tienes permiso para todas las fuentes de este informe.', 403);
}
export function exigirDistribucion(u: IdentidadInforme) {
    if (u.rol !== 'admin' || !puede(u.permisos, 'usuarios', 'editar'))
        throw new ErrorInforme('PERMISO_RETIRADO', 'Distribuir informes y gestionar grupos requiere administración.', 403);
}
export function distribuye(c: ConfiguracionInforme, propietarioId: string) {
    return c.audiencia.usuarios.some(id => id !== propietarioId) || c.audiencia.grupos.length > 0;
}
export async function expandirAudiencia(sql: ConexionInformes, propietario: IdentidadInforme, c: ConfiguracionInforme, comprobarVersion = true): Promise<ReceptorInforme[]> {
    autorizarAmbitoInforme(propietario, c);
    if (distribuye(c, propietario.id))
        exigirDistribucion(propietario);
    const mapa = new Map<string, OrigenReceptor[]>([[propietario.id, [{ tipo: 'propietario' }]]]);
    const agregar = (id: string, origen: OrigenReceptor) => mapa.set(id, [...(mapa.get(id) ?? []), origen]);
    for (const id of c.audiencia.usuarios)
        if (id !== propietario.id)
            agregar(id, { tipo: 'directo' });
    for (const g of c.audiencia.grupos) {
        const [grupo] = await sql `select id,version,ambito from informes_grupos where id=${g.id} and propietario_id=${propietario.id} and activo`;
        if (!grupo)
            throw new ErrorInforme('PERMISO_RETIRADO', 'El grupo ya no está disponible.', 403);
        if (comprobarVersion && grupo.version !== g.version)
            throw new ErrorInforme('VISTA_PREVIA_CAMBIADA', 'El grupo ha cambiado. Revisa otra vez la audiencia.', 409);
        if (serializarCanonico(grupo.ambito) !== serializarCanonico(c.ambito))
            throw new ErrorInforme('PERMISO_RETIRADO', 'El grupo pertenece a otro ámbito.', 403);
        for (const m of await sql `select usuario_id from informes_grupo_miembros where grupo_id=${g.id}`)
            agregar(m.usuario_id, { tipo: 'grupo', id: g.id, version: grupo.version });
    }
    if (mapa.size > LIMITES.receptores)
        throw new ErrorInforme('LIMITE_EXCEDIDO', 'Máximo cien receptores.', 413);
    const resultado: ReceptorInforme[] = [];
    for (const [id, origenes] of mapa) {
        try {
            const u = id === propietario.id ? propietario : await identidadActual(sql, id);
            autorizarAmbitoInforme(u, c);
            resultado.push({ usuarioId: id, nombre: u.nombre, origenes });
        }
        catch (error) {
            if (!(error instanceof ErrorInforme) || error.status === 503)
                throw error;
            throw new ErrorInforme('PERMISO_RETIRADO', 'Toda la audiencia debe conservar acceso al informe.', 403);
        }
    }
    return resultado.sort((a, b) => a.usuarioId < b.usuarioId ? -1 : 1);
}
export async function origenVigente(sql: ConexionInformes, ejecucionId: string, usuarioId: string, propietarioId: string, origenes: OrigenReceptor[]): Promise<boolean> {
    if (usuarioId === propietarioId)
        return true;
    const [def] = await sql `select d.configuracion,e.definicion_snapshot from informes_ejecuciones e join informes_definiciones d on d.id=e.definicion_id where e.id=${ejecucionId}`;
    const c = def?.configuracion as ConfiguracionInforme | undefined;
    const ambitoCongelado = (def?.definicion_snapshot as {
        configuracion: ConfiguracionInforme;
    } | undefined)?.configuracion.ambito;
    for (const o of origenes) {
        if (o.revocadoEn)
            continue;
        if (o.tipo === 'directo' && c?.audiencia.usuarios.includes(usuarioId))
            return true;
        if (o.tipo === 'grupo' && o.id) {
            const [miembro] = await sql `select g.ambito from informes_grupos g join informes_grupo_miembros m on m.grupo_id=g.id where g.id=${o.id} and g.activo and g.propietario_id=${propietarioId} and m.usuario_id=${usuarioId}`;
            if (miembro && ambitoCongelado && serializarCanonico(miembro.ambito) === serializarCanonico(ambitoCongelado))
                return true;
        }
    }
    return false;
}

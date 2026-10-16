import type postgres from 'postgres';
import { esAcceso, esRol, esSeccion, puede, resolverPermisos, type Acceso, type Permisos, type Seccion } from '../usuarios';
import { ErrorConsulta, type AmbitoConsulta, type IntentConsulta } from './modelo';
export type SqlConsulta = ReturnType<typeof postgres>;
export interface IdentidadConsulta {
    id: string;
    permisos: Permisos;
}
/** Se relee por conexión, sin cache de React ni confianza en permisos de cookie. */
export async function identidadConsulta(sql: SqlConsulta, id: string): Promise<IdentidadConsulta> {
    if (id === '00000000-0000-0000-0000-000000000000')
        throw new ErrorConsulta('IDENTIDAD', 'Inicia sesión con tu usuario.', 403);
    const [u] = await sql `select id,rol::text as rol,activo,debe_cambiar_clave from usuarios where id=${id}`;
    if (!u?.activo)
        throw new ErrorConsulta('IDENTIDAD', 'Sin sesión activa.', 401);
    if (u.debe_cambiar_clave || !esRol(u.rol))
        throw new ErrorConsulta('IDENTIDAD', 'Se necesita una contraseña definitiva.', 403);
    const ajustes: Partial<Record<Seccion, Acceso>> = {};
    for (const f of await sql `select seccion,acceso from usuario_permisos where usuario_id=${id}`)
        if (esSeccion(f.seccion) && esAcceso(f.acceso))
            ajustes[f.seccion] = f.acceso;
    return { id: u.id, permisos: resolverPermisos(u.rol, ajustes) };
}
export function exigirConsulta(u: IdentidadConsulta, secciones: readonly Seccion[]): void {
    if (secciones.some(s => !puede(u.permisos, s, 'ver')))
        throw new ErrorConsulta('PERMISO', 'No tienes acceso a todas las fuentes de esta consulta.', 403);
}
export function requisitosConsulta(intent: IntentConsulta, ambito: AmbitoConsulta): Seccion[] {
    const base: Seccion[] = ambito.tipo === 'catalogo' ? ['catalogo'] : ambito.tipo === 'obra' ? ['salas', 'proyectos'] : ['salas'];
    if (['conexiones', 'cables', 'necesidad', 'catalogo'].includes(intent))
        base.push('catalogo');
    if (['cables', 'necesidad'].includes(intent))
        base.push('parametros');
    return [...new Set(base)];
}
/** Sólo existencia y pertenencia actual; ningún nombre ni contenido. */
export async function resolverAmbito(sql: SqlConsulta, u: IdentidadConsulta, ambito: AmbitoConsulta): Promise<string[]> {
    exigirConsulta(u, requisitosConsulta('no_disponible', ambito));
    if (ambito.tipo === 'catalogo')
        return [];
    if (ambito.tipo === 'sala') {
        if (!(await sql `select id from salas where id=${ambito.id}`).length)
            throw new ErrorConsulta('AMBITO', 'La selección ya no está disponible.', 409);
        return [ambito.id];
    }
    const p = await sql `select id from proyectos where id=${ambito.id}`;
    const salas = await sql `select s.id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id in ${sql(ambito.salaIds)} and l.proyecto_id=${ambito.id} order by s.id`;
    if (!p.length || salas.length !== ambito.salaIds.length)
        throw new ErrorConsulta('AMBITO', 'La selección de salas ha cambiado. Crea una consulta nueva.', 409);
    return salas.map(f => String(f.id));
}

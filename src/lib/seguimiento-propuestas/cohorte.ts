import { createHmac, timingSafeEqual } from 'node:crypto';
import { resolverPeriodo } from '../informes/periodos';
import { dividirRedondeando, formatearDecimal } from '../importes';
import { ErrorSeguimiento, LIMITES, validar, filtrosSchema, hash, canonico, type Filtros, type Miembro } from './modelo';
export function resolverFiltros(datos: unknown): Filtros {
    const f = validar(filtrosSchema, datos);
    try { resolverPeriodo({ modo: 'rango', desde: f.desde, hasta: f.hasta }, new Date(f.observadoEn)); } catch { throw new ErrorSeguimiento('El rango debe contener entre 1 y 366 días civiles de Madrid.', 400); }
    return { ...f, observadoEn: new Date(f.observadoEn).toISOString(), ambito: f.ambito.tipo === 'seleccion' ? { tipo: 'seleccion', ids: [...f.ambito.ids].sort() } : f.ambito };
}
export function rango(f: Filtros) { const r = resolverPeriodo({ modo: 'rango', desde: f.desde, hasta: f.hasta }, new Date(f.observadoEn)); if (r.modo !== 'rango') throw new ErrorSeguimiento('Rango inválido.'); return r; }
export function ratio(numerador: number, denominador: number) {
    if (!Number.isSafeInteger(numerador) || !Number.isSafeInteger(denominador) || numerador < 0 || denominador < numerador) throw new ErrorSeguimiento('Fracción inválida.', 503);
    const porcentaje = denominador === 0 ? null : formatearDecimal(dividirRedondeando(BigInt(numerador) * BigInt('10000'), BigInt(denominador)), 2);
    return { numerador, denominador, fraccion: `${numerador}/${denominador}`, porcentaje };
}
export function compararRatios(a: ReturnType<typeof ratio>, b: ReturnType<typeof ratio>) { return a.denominador && b.denominador ? formatearDecimal(dividirRedondeando((BigInt(a.numerador) * BigInt(b.denominador) - BigInt(b.numerador) * BigInt(a.denominador)) * BigInt('10000'), BigInt(a.denominador) * BigInt(b.denominador)), 2) : null; }
export function manifiesto(miembros: Miembro[]) { return miembros.map(m => [m.propuestaId, m.revisionId, m.revisionHash, m.publicacionOperacionId, m.ultimoEventoId, m.numeroEvento, m.archivoAlCorte]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))); }
// Los demás filtros comparados se heredan de los filtros principales firmados.
export interface ContextoComparacion { desde: string; hasta: string; manifiestoHash: string; }
export function huellaConjunto(miembros: Miembro[], comparacion: ContextoComparacion | null) { return comparacion === null ? hash(manifiesto(miembros)) : hash({ principal: manifiesto(miembros), comparacion }); }
export interface DatosToken { comparacion: ContextoComparacion | null; modelo: 1; usuarioId: string; filtros: Filtros; manifiestoHash: string; permisosHash: string; creadoEn: number; }
export function crearToken(datos: DatosToken, secreto: string): string { if (secreto.length < 24) throw new ErrorSeguimiento('Falta configuración segura del seguimiento.', 503); const cuerpo = Buffer.from(canonico(datos)).toString('base64url'); return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`; }
export function verificarToken(token: string, usuarioId: string, filtros: Filtros, miembros: Miembro[], permisosHash: string, secreto: string, ahora = Date.now(), comparacion: ContextoComparacion | null = null): DatosToken {
    if (token.length > 600000 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(token)) throw new ErrorSeguimiento('Token de conjunto inválido.', 409);
    const [cuerpo, firma] = token.split('.'), esperada = createHmac('sha256', secreto).update(cuerpo).digest('hex');
    if (!timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) throw new ErrorSeguimiento('Token de conjunto inválido.', 409);
    let d: DatosToken; try { d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()); } catch { throw new ErrorSeguimiento('Token de conjunto inválido.', 409); }
    if (d.usuarioId !== usuarioId) throw new ErrorSeguimiento('El conjunto pertenece a otra identidad.', 403);
    if (d.permisosHash !== permisosHash) throw new ErrorSeguimiento('Los permisos cambiaron. Actualiza el seguimiento.', 403);
    if (!Object.hasOwn(d, 'comparacion') || hash(d.comparacion) !== hash(comparacion) || d.modelo !== 1 || !Number.isFinite(d.creadoEn) || ahora < d.creadoEn || ahora - d.creadoEn > LIMITES.tokenMs || hash(d.filtros) !== hash(filtros) || d.manifiestoHash !== huellaConjunto(miembros, comparacion)) throw new ErrorSeguimiento('El conjunto cambió o caducó. Actualiza el embudo y su lista conjuntamente.', 409);
    return d;
}

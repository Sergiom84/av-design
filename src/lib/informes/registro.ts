import type { Seccion } from '../usuarios';
import type { AmbitoInforme, ClaveInforme, ColumnaInforme } from './modelo';
const t = (clave: string, titulo: string, tipo: ColumnaInforme['tipo'] = 'texto', unidad?: string): ColumnaInforme => ({ clave, titulo, tipo, ...unidad ? { unidad } : {} });
export const REGISTRO_INFORMES: Record<ClaveInforme, {
    nombre: string;
    modulo: string;
    secciones: Seccion[];
    columnas: ColumnaInforme[];
}> = {
    material_actual: { nombre: 'Material actual', modulo: 'Material', secciones: ['salas', 'proyectos', 'catalogo', 'parametros', 'almacen', 'compras'], columnas: [] },
    material_movimientos: { nombre: 'Movimientos registrados', modulo: 'Material', secciones: ['almacen', 'catalogo', 'salas'], columnas: [t('fecha', 'Fecha', 'fecha'), t('sala', 'Sala'), t('articulo', 'Artículo'), t('tipo', 'Tipo'), t('cantidad', 'Cantidad', 'numero'), t('unidad', 'Unidad'), t('signo', 'Signo', 'numero'), t('cantidadNeta', 'Cantidad con signo', 'numero'), t('motivo', 'Motivo'), t('quien', 'Quién')] },
    carga_actual: { nombre: 'Carga actual', modulo: 'Carga', secciones: ['carga', 'salas', 'catalogo'], columnas: [t('sala', 'Sala'), t('carga', 'Carga'), t('estado', 'Estado'), t('articulo', 'Artículo'), t('cantidad', 'Cantidad', 'numero'), t('unidad', 'Unidad'), t('cargado', 'Cargado', 'booleano'), t('instalado', 'Instalado', 'numero'), t('devuelto', 'Devuelto', 'numero'), t('roto', 'Roto', 'numero'), t('lineas', 'Líneas', 'numero'), t('pendientes', 'Líneas pendientes', 'numero')] },
    carga_hechos: { nombre: 'Altas y cierres de carga', modulo: 'Carga', secciones: ['carga', 'salas'], columnas: [t('fecha', 'Fecha', 'fecha'), t('sala', 'Sala'), t('carga', 'Carga'), t('hecho', 'Hecho registrado')] },
    estado_actual: { nombre: 'Estado actual', modulo: 'Estado', secciones: ['salas'], columnas: [t('tipo', 'Tipo'), t('nombre', 'Nombre'), t('codigo', 'Código'), t('estado', 'Estado')] },
    estado_hitos: { nombre: 'Hitos registrados', modulo: 'Estado', secciones: ['salas'], columnas: [t('fecha', 'Fecha', 'fecha'), t('tipoEntidad', 'Tipo'), t('nombre', 'Nombre'), t('tipo', 'Hito'), t('tecnico', 'Técnico registrado'), t('nota', 'Nota')] },
};
export function seccionesInforme(clave: ClaveInforme, ambito: AmbitoInforme): Seccion[] {
    return [...new Set([...REGISTRO_INFORMES[clave].secciones, ...ambito.tipo === 'sala' ? [] : ['proyectos' as const]])];
}

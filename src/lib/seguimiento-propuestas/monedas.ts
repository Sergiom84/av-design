/** Lector monetario explícito. Nunca se importa desde el repositorio técnico. */
import { esMoneda, sumarImportesConocidos } from '../importes';
import type { ValoracionCalculada, Medida } from '../propuestas/modelo';
import { exigir, type Conexion, type Identidad } from './autorizacion';
import { ErrorSeguimiento, hash, estados, type Estado, type Miembro } from './modelo';
export interface Cobertura { subtotalMinor: string | null; propuestasIncluidas: number; completas: number; parciales: number; sinDatos: number; lineasSinDato: number; lineasOrientativas: number; }
export type Medidas = Record<'base' | 'impuesto' | 'bruto', Cobertura>;
const vacia = (): Cobertura => ({ subtotalMinor: null, propuestasIncluidas: 0, completas: 0, parciales: 0, sinDatos: 0, lineasSinDato: 0, lineasOrientativas: 0 });
export function agregarMonedas(miembros: Miembro[], valores: Map<string, ValoracionCalculada>) {
    const etapas = Object.fromEntries(estados.map(e => [e, { propuestasSinValoracion: 0, monedas: {} as Record<string, Medidas> }])) as Record<Estado, { propuestasSinValoracion: number; monedas: Record<string, Medidas> }>;
    for (const m of miembros) {
        const etapa = etapas[m.estado], v = valores.get(m.revisionId);
        if (!v) { etapa.propuestasSinValoracion++; continue; }
        for (const [moneda, total] of Object.entries(v.totales)) {
            if (!esMoneda(moneda)) throw new ErrorSeguimiento('Moneda conservada no compatible.', 503);
            const medidas = etapa.monedas[moneda] ?? { base: vacia(), impuesto: vacia(), bruto: vacia() };
            for (const [clave, original] of [['base', 'base'], ['impuesto', 'impuesto'], ['bruto', 'total']] as const) {
                const dato: Medida = total[original], a = medidas[clave];
                if (!dato || !['sin_datos', 'parcial', 'completo'].includes(dato.estado) || (dato.subtotal !== null && !/^(0|[1-9]\d*)$/.test(dato.subtotal)) || !Number.isSafeInteger(dato.ausentes) || dato.ausentes < 0 || !Number.isSafeInteger(dato.orientativas) || dato.orientativas < 0 || (dato.estado === 'sin_datos') !== (dato.subtotal === null)) throw new ErrorSeguimiento('La cobertura conservada es inconsistente.', 503);
                a.subtotalMinor = sumarImportesConocidos([a.subtotalMinor === null ? null : BigInt(a.subtotalMinor), dato.subtotal === null ? null : BigInt(dato.subtotal)])?.toString() ?? null;
                a.propuestasIncluidas++; a.completas += Number(dato.estado === 'completo'); a.parciales += Number(dato.estado === 'parcial'); a.sinDatos += Number(dato.estado === 'sin_datos'); a.lineasSinDato += dato.ausentes; a.lineasOrientativas += dato.orientativas;
            }
            etapa.monedas[moneda] = medidas;
        }
    }
    return etapas;
}
export async function leerMonedas(c: Conexion, u: Identidad, miembros: Miembro[]) {
    exigir(u, 'compras');
    const valores = new Map<string, ValoracionCalculada>();
    if (miembros.length) {
        const filas = await c`select r.id,r.contiene_valoracion,v.snapshot,v.sha256 from propuesta_revisiones r left join propuesta_valoraciones v on v.revision_id=r.id where r.id in ${c(miembros.map(m => m.revisionId))}`;
        for (const r of filas) {
            if (!r.contiene_valoracion) continue;
            if (!r.snapshot || hash(r.snapshot) !== r.sha256 || !r.snapshot.totales || !Array.isArray(r.snapshot.lineas)) throw new ErrorSeguimiento('La valoración conservada no supera la comprobación de integridad.', 503);
            valores.set(r.id, r.snapshot as ValoracionCalculada);
        }
    }
    return { etiqueta: 'Base propuesta sin impuestos por estado', etapas: agregarMonedas(miembros, valores) };
}

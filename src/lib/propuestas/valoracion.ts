import { esMoneda, parsearDecimal, formatearDecimal, precioVentaU4, importeMaterialMinor, importePorcentajeMinor, sumarImportesConocidos, ErrorImporte } from '../importes';
import { ErrorPropuesta, hash, type LineaFuente, type LineaValoracion, type ValoracionCalculada, type LineaCalculada, type Medida } from './modelo';
import { exigir, type IdentidadPropuesta, type ConexionPropuestas } from './autorizacion';
const cero = BigInt('0');
const parsear = (v: string, escala: number) => { const n = parsearDecimal(v, escala); if (n < cero)
    throw new ErrorPropuesta('No se admiten importes negativos.', 422); return n; };
export interface PrecioCongelado {
    articuloId: string;
    valor: string | null;
    moneda: 'EUR';
    calidad: 'final' | 'orientativo';
    hash: string;
    consultadoEn: string;
}
export async function precioCatalogo(sql: ConexionPropuestas, u: IdentidadPropuesta, id: string, fecha: string): Promise<PrecioCongelado> {
    exigir(u, 'compras');
    exigir(u, 'catalogo');
    const [a] = await sql `select id,coste::text,coste_orientativo from articulos where id=${id} and activo`;
    if (!a)
        throw new ErrorPropuesta('Referencia no disponible.', 404);
    const campos = { articuloId: a.id, valor: a.coste === null ? null : formatearDecimal(parsear(a.coste, 4), 4), moneda: 'EUR' as const, calidad: a.coste_orientativo ? 'orientativo' as const : 'final' as const };
    return { ...campos, hash: hash(campos), consultadoEn: fecha };
}
export function calcularValoracion(lineas: LineaFuente[], entradas: LineaValoracion[], fuentes: Map<string, unknown> = new Map()): ValoracionCalculada {
    try {
        if (entradas.length !== lineas.length || entradas.some(e => !lineas.some(l => l.clave === e.clave)))
            throw new ErrorPropuesta('Una valoración no pertenece a las líneas incluidas.', 422);
        const porClave = new Map(entradas.map(e => [e.clave, e]));
        // Cada línea incluida aparece exactamente una vez. Omitida = ausencia, nunca cero.
        const calculadas: LineaCalculada[] = lineas.map(l => {
            const e = porClave.get(l.clave) ?? { clave: l.clave, moneda: 'EUR' as const, coste: null, origenCoste: null, regla: 'directo' as const, precio: null, motivoPrecio: null, porcentaje: null, impuesto: { tipo: 'sin_configurar' as const } };
            if (!esMoneda(e.moneda))
                throw new ErrorPropuesta('Moneda inválida.', 422);
            if ((e.coste === null) !== (e.origenCoste === null))
                throw new ErrorPropuesta('Cada coste previsto necesita su fuente, también si es cero.', 422);
            const coste = e.coste === null ? null : parsear(e.coste, 4);
            const q = l.cantidad === null ? null : parsear(l.cantidad, 2);
            let precio: bigint | null;
            if (e.regla === 'directo') {
                if (e.porcentaje !== null)
                    throw new ErrorPropuesta('Un precio directo no lleva porcentaje.', 422);
                if (e.precio !== null && !e.motivoPrecio?.trim())
                    throw new ErrorPropuesta('El precio directo manual necesita un motivo.', 422);
                precio = e.precio === null ? null : parsear(e.precio, 4);
            }
            else {
                if (e.precio !== null || e.porcentaje === null)
                    throw new ErrorPropuesta('La regla exige porcentaje y no admite otro precio directo.', 422);
                const p = parsear(e.porcentaje, 4);
                if ((e.regla === 'margen' && p >= BigInt('1000000')) || (e.regla === 'recargo' && p > BigInt('10000000')))
                    throw new ErrorPropuesta('Margen menor de 100% o recargo hasta 1000%.', 422);
                precio = coste === null ? null : precioVentaU4(coste, e.regla, p);
            }
            const base = precio === null || q === null ? null : importeMaterialMinor(precio, q);
            let impuesto: bigint | null = null;
            if (e.impuesto.tipo === 'porcentaje') {
                const porcentaje = parsear(e.impuesto.porcentaje, 4);
                if (porcentaje > BigInt('1000000'))
                    throw new ErrorPropuesta('El impuesto no puede superar el 100%.', 422);
                if (base !== null)
                    impuesto = importePorcentajeMinor(base, porcentaje);
            }
            else if (e.impuesto.tipo === 'no_aplica' && base !== null)
                impuesto = cero;
            const fuenteCongelada = fuentes.get(e.clave) ?? (e.origenCoste?.tipo === 'manual' ? e.origenCoste : null);
            return { ...e, cantidad: l.cantidad, descripcion: l.descripcion, fuenteCongelada, precioUnitario: precio === null ? null : formatearDecimal(precio, 4), base: base === null ? null : base.toString(), impuestoMinor: impuesto === null ? null : impuesto.toString(), total: base === null || impuesto === null ? null : (base + impuesto).toString(), costePrevisto: coste === null || q === null ? null : importeMaterialMinor(coste, q).toString(), orientativa: (fuenteCongelada as {
                    calidad?: string;
                })?.calidad === 'orientativo' };
        });
        const totales: ValoracionCalculada['totales'] = {};
        for (const moneda of ['EUR', 'USD']) {
            const ls = calculadas.filter(l => l.moneda === moneda);
            if (!ls.length)
                continue;
            const medida = (clave: 'base' | 'impuestoMinor' | 'total' | 'costePrevisto'): Medida => {
                const valores = ls.map(l => l[clave] === null ? null : BigInt(l[clave]!));
                const ausentes = valores.filter(v => v === null).length;
                return { estado: ausentes === ls.length ? 'sin_datos' : ausentes ? 'parcial' : 'completo', subtotal: sumarImportesConocidos(valores)?.toString() ?? null, ausentes, orientativas: ls.filter(l => l.orientativa).length };
            };
            totales[moneda] = { base: medida('base'), impuesto: medida('impuestoMinor'), total: medida('total'), costePrevisto: medida('costePrevisto') };
        }
        const estados = Object.values(totales).map(t => t.total.estado);
        return { lineas: calculadas, totales, estado: !estados.length || estados.every(e => e === 'sin_datos') ? 'sin_datos' : estados.every(e => e === 'completo') ? 'completo' : 'parcial', redondeo: 'mitad_fuera_cero_v1' };
    }
    catch (error) {
        if (error instanceof ErrorImporte)
            throw new ErrorPropuesta(error.message, 422);
        throw error;
    }
}

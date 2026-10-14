import { ErrorImportacion, type CandidatoImportacion, type DestinoImportacion, type FilaImportacion } from './modelo';
import { claveLiteral, fechaIsoValida, numeroImportado, type FilaLeida } from './parser';

export interface ArticuloParaImportacion {
  id: string; referencia: string | null; referencia_fabricante: string | null;
  marca: string | null; modelo: string; categoria: string; tipo: string;
  unidad: 'ud' | 'm'; activo: boolean; revision: number; coste: number | null;
  coste_orientativo: boolean;
}

export function coincidenciasExactas(datos: Record<string, string>, articulos: ArticuloParaImportacion[]): CandidatoImportacion[] {
  const referencia = claveLiteral(datos.referencia);
  const marca = claveLiteral(datos.marca); const modelo = claveLiteral(datos.modelo);
  const categoria = claveLiteral(datos.categoria);
  const porReferencia = referencia ? articulos.filter(a => [a.referencia, a.referencia_fabricante].some(r => claveLiteral(r) === referencia)) : [];
  const encontradas = porReferencia.length ? porReferencia : modelo ? articulos.filter(a =>
    claveLiteral(a.modelo) === modelo && claveLiteral(a.marca) === marca && (!categoria || claveLiteral(a.categoria) === categoria)) : [];
  return encontradas.map(a => ({ id: a.id, etiqueta: `${a.marca ?? ''} ${a.modelo}`.trim(),
    categoria: a.categoria, unidad: a.unidad, activo: a.activo, revision: Number(a.revision) }));
}

export function revisarFilas(destino: DestinoImportacion, filas: FilaLeida[], articulos: ArticuloParaImportacion[]): FilaImportacion[] {
  const repetidas = new Map<string, number>();
  return filas.map(f => {
    const datos = f.datos; const errores = [...f.errores]; const avisos: string[] = [];
    if (!datos.referencia && !datos.modelo) errores.push('Falta referencia o modelo exacto.');
    if (!['ud', 'm'].includes(datos.unidad)) errores.push('La unidad debe ser ud o m.');
    const candidatos = coincidenciasExactas(datos, articulos);
    if (candidatos.some(a => !a.activo)) avisos.push('Hay una referencia desactivada: permanece consultable, pero no se importa como nueva necesidad.');
    if (candidatos.length === 1 && candidatos[0].unidad !== datos.unidad) errores.push('La unidad no coincide con la del catálogo.');
    const clave = datos.referencia ? `ref:${claveLiteral(datos.referencia)}` : `modelo:${claveLiteral(datos.marca)}|${claveLiteral(datos.modelo)}|${claveLiteral(datos.categoria)}`;
    const claveFila = destino === 'precios' ? `${clave}|${claveLiteral(datos.presupuesto)}` : clave;
    if (repetidas.has(claveFila)) avisos.push(`Fila duplicada de la fila ${repetidas.get(claveFila)}; elige una sola línea.`);
    else repetidas.set(claveFila, f.fila);
    if (destino === 'catalogo') {
      if (!candidatos.length && (!datos.modelo || !datos.categoria || !['equipo', 'cable', 'consumible'].includes(datos.tipo))) {
        errores.push('Un alta de catálogo exige modelo, categoría y tipo equipo/cable/consumible.');
      }
      if (candidatos.length) avisos.push('Actualizará descripción/observaciones si vienen en el archivo; conservará identidad, diseño, puertos y precio.');
    } else if (destino === 'bom') {
      const cantidad = numeroImportado(datos.cantidad);
      if (cantidad == null || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 1_000_000 || (datos.unidad === 'ud' && !Number.isInteger(cantidad)) || !precision(cantidad, 2)) {
        errores.push('Cantidad inválida: positiva, máximo 1000000; unidades enteras y metros con hasta dos decimales.');
      }
      avisos.push('Añade material a la BOM; no coloca equipos ni crea conexiones.');
    } else {
      if (!datos.presupuesto || !datos.proveedor) errores.push('Oferta sin presupuesto o proveedor.');
      if (!fechaIsoValida(datos.fecha ?? '')) errores.push('Fecha de oferta obligatoria con formato YYYY-MM-DD válido.');
      if (!['EUR', 'USD'].includes(datos.moneda)) errores.push('Moneda admitida: EUR o USD.');
      if (!['final', 'orientativo'].includes(datos.origen)) errores.push('Decisión pendiente: clasifica la oferta como final u orientativo.');
      if (!['ud', 'm', 'bobina', 'caja', 'paquete'].includes(datos.unidad_compra)) errores.push('Indica unidad de compra: ud, m, bobina, caja o paquete.');
      const unidades = numeroImportado(datos.unidades_por_compra);
      if (unidades == null || !Number.isFinite(unidades) || unidades <= 0 || unidades > 1_000_000 || !precision(unidades, 2)) errores.push('Unidades por compra inválidas.');
      if (['ud', 'm'].includes(datos.unidad_compra) && (datos.unidad_compra !== datos.unidad || unidades !== 1)) errores.push('La compra por ud/m debe coincidir con la unidad de catálogo y contener una unidad.');
      if (datos.unidad_compra === 'bobina' && datos.unidad !== 'm') errores.push('Una bobina debe convertirse a metros del catálogo.');
      if (datos.unidad === 'ud' && unidades != null && !Number.isInteger(unidades)) errores.push('Un paquete de unidades debe contener un número entero.');
      const precio = numeroImportado(datos.precio_compra);
      if (precio == null) errores.push('Precio ausente: no se convierte en cero.');
      else if (!Number.isFinite(precio) || precio < 0 || precio > 100_000_000 || !precision(precio, 4)) errores.push('Precio de compra inválido.');
      else if (precio === 0) errores.push('Decisión pendiente: cero de kit/componente no es una oferta gratuita. Esta entrega no guarda precios cero.');
      const kit = booleanoImportado(datos.kit); const vinculante = booleanoImportado(datos.vinculante);
      if (datos.kit && kit == null) errores.push('Kit debe indicar sí/no.');
      if (datos.vinculante && vinculante == null) errores.push('Vinculante debe indicar sí/no.');
      if (kit === true) errores.push('Decisión pendiente: composición de kits fuera del incremento de ofertas.');
      if (vinculante === false && datos.origen === 'final') errores.push('Decisión pendiente: una oferta no vinculante no se guarda como final. Clasifícala explícitamente como orientativo.');
      if (datos.cantidad) {
        const cantidad = numeroImportado(datos.cantidad);
        if (cantidad == null || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 1_000_000 || !precision(cantidad, 2)) errores.push('Cantidad ofertada inválida.');
      }
      if (precio != null && Number.isFinite(precio) && unidades != null && unidades > 0) {
        if (precio / unidades < 0.00005) errores.push('El precio por unidad se redondearía a cero; revisa la unidad de compra.');
        avisos.push(`Precio por ${datos.unidad}: ${(precio / unidades).toFixed(4)} ${datos.moneda}. Se conserva toda oferta anterior.`);
      }
      if (candidatos.length === 1) {
        const a = articulos.find(a => a.id === candidatos[0].id)!;
        avisos.push(`Coste elegido actual: ${a.coste == null ? 'ausente' : `${a.coste} EUR${a.coste_orientativo ? ' orientativo' : ' final'}`}. Se revisará con vigencia y cambio parametrizados.`);
      }
    }
    return { fila: f.fila, datos, candidatos,
      estado: errores.length ? 'rechazada' : candidatos.length > 1 ? 'ambigua' : candidatos.length === 1 ? 'coincidencia' : destino === 'catalogo' ? 'alta' : 'no_encontrada',
      errores, avisos };
  });
}

export function booleanoImportado(texto: string | undefined): boolean | null {
  if (['sí', 'si', 'true', '1'].includes((texto ?? '').toLowerCase())) return true;
  if (['no', 'false', '0'].includes((texto ?? '').toLowerCase())) return false;
  return null;
}
function precision(valor: number, decimales: number): boolean {
  return Math.abs(valor * 10 ** decimales - Math.round(valor * 10 ** decimales)) < 0.000001;
}
export function validarEntrada(destino: unknown, origen: unknown, salaId: unknown): asserts destino is DestinoImportacion {
  if (!['catalogo', 'bom', 'precios'].includes(String(destino))) throw new ErrorImportacion('Destino de importación inválido.');
  if (typeof origen !== 'string' || !origen.trim() || origen.length > 500) throw new ErrorImportacion('Indica la procedencia del archivo (máximo 500 caracteres).');
  if (destino === 'bom' && (typeof salaId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(salaId))) throw new ErrorImportacion('Selecciona una sala válida para la BOM.');
  if (destino !== 'bom' && salaId) throw new ErrorImportacion('Sólo la BOM tiene una sala de destino.');
}

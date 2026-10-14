export interface OfertaParaElegir {
  precio: number; moneda: string; origen: string; fecha: string | null;
}
export interface ParametrosEleccionCoste { hoy: string; vigenciaMeses: number; usdEur: number }
/** Paridad con el selector SQL de generar-seed: fecha límite de calendario,
 * final primero, orientativo después y misma conversión parametrizada.
 */
export function elegirCosteVigente(ofertas: OfertaParaElegir[], parametros: ParametrosEleccionCoste): { coste: number; orientativo: boolean } | null {
  const limite = fechaLimiteVigencia(parametros.hoy, parametros.vigenciaMeses);
  const vigentes = ofertas.filter(p => p.fecha == null || p.fecha >= limite);
  const minimo = (origen: string) => {
    const importes = vigentes.filter(p => p.origen === origen).map(p => p.precio * (p.moneda === 'EUR' ? 1 : parametros.usdEur));
    return importes.length ? Math.min(...importes) : null;
  };
  const final = minimo('final'); const orientativo = minimo('orientativo');
  const coste = final ?? orientativo;
  return coste == null ? null : { coste: Math.round((coste + Number.EPSILON) * 10000) / 10000, orientativo: final == null };
}
export function fechaLimiteVigencia(hoy: string, meses: number): string {
  const [ano, mes, dia] = hoy.split('-').map(Number);
  const destino = new Date(Date.UTC(ano, mes - 1 - Math.round(meses), 1));
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(dia, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

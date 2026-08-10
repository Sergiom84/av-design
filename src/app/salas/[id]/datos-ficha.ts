import 'server-only';
import { listarArticulos, obtenerParametros, obtenerSala } from '@/lib/datos';
import {
  agruparMaterialCable,
  calcularConexion,
  dimensionarCanalizacion,
  ResultadoCable,
} from '@/lib/calculo-cable';
import { construirTablaCables } from '@/lib/cable-schedule';
import { revisarMontaje } from '@/lib/revision';
import { cargasDeSala, faltaParaSala } from '@/lib/datos-almacen';
import { revisionesDeSala } from '@/lib/datos-checkin';

/**
 * La derivación que antes vivía entera en la página de la sala, repartida en
 * dos peldaños para que cada pestaña pague solo lo que pinta:
 *
 * - `fichaDeSala()`: diseño y cálculo puro (equipos, conexiones, metros,
 *   tabla de cables). Lo usan Resumen, Cableado y Logística.
 * - `fichaConAlmacen()`: añade lo de Fase 2 (qué falta, cargas, visitas) y el
 *   semáforo de montaje, que necesita todo lo anterior. Resumen y Logística.
 *
 * Equipamiento y Documentos no pasan por aquí: les basta `obtenerSala()`.
 */
export async function fichaDeSala(id: string) {
  const completa = await obtenerSala(id);
  if (!completa) return null;

  const { sala, equipos, muebles, conexiones, tomas, puertos } = completa;
  const [articulos, parametros] = await Promise.all([
    listarArticulos(),
    obtenerParametros(),
  ]);

  const porId = new Map(articulos.map((a) => [a.id, a]));
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));

  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;

  const resultados = sinMedidas
    ? []
    : (conexiones
        .map((c) => calcularConexion(c, sala, equiposPorId, porId, parametros))
        .filter(Boolean) as ResultadoCable[]);

  const material = agruparMaterialCable(resultados, conexiones, porId);

  const diametros = conexiones
    .map((c) => (c.articulo_cable_id ? porId.get(c.articulo_cable_id)?.diametro_mm : null))
    .filter((d): d is number => typeof d === 'number');
  const canalizacion = diametros.length
    ? dimensionarCanalizacion(diametros, parametros)
    : null;

  const filasCable = construirTablaCables({
    conexiones,
    equipos: equiposPorId,
    tomas: new Map(tomas.map((t) => [t.id, t])),
    puertos: new Map(puertos.map((p) => [p.id, p])),
    articulos: porId,
    resultados: new Map(resultados.map((r) => [r.conexion_id, r])),
  });

  return {
    sala,
    equipos,
    muebles,
    conexiones,
    tomas,
    puertos,
    articulos,
    porId,
    sinMedidas,
    resultados,
    material,
    canalizacion,
    filasCable,
  };
}

export async function fichaConAlmacen(id: string) {
  const base = await fichaDeSala(id);
  if (!base) return null;

  const [falta, cargas, visitas] = await Promise.all([
    faltaParaSala(base.sala.id),
    cargasDeSala(base.sala.id),
    revisionesDeSala(base.sala.id),
  ]);

  // Si la sala se puede montar o no no se teclea: se deriva de lo que ya hay.
  const puntosMontaje = revisarMontaje({
    sala: base.sala,
    equipos: base.equipos,
    conexiones: base.conexiones,
    tomas: base.tomas,
    resultados: base.resultados,
    filasCable: base.filasCable,
    falta,
    cargas,
  });

  return { ...base, falta, cargas, visitas, puntosMontaje };
}

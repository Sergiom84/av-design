import 'server-only';
import { pendientesDeTiradas, proyectarSuministros } from '@/lib/suministros';
import { necesidadDeSala } from '@/lib/compras';
import { listarArticulos, obtenerParametros, obtenerSala, type SalaCompleta } from '@/lib/datos';
import {
  agruparMaterialCable,
  calcularConexion,
  diagnosticarCalculoConexion,
  dimensionarCanalizacion,
  ResultadoCable,
} from '@/lib/calculo-cable';
import { construirTablaCables } from '@/lib/cable-schedule';
import { revisarMontaje } from '@/lib/revision';
import { revisarTecnicamente } from '@/lib/revision-tecnica';
import { datosTecnicosDeArticulos } from '@/lib/datos-ficha-tecnica';
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
export async function fichaDeSala(id: string, salaLeida?: SalaCompleta) {
  const completa = salaLeida ?? await obtenerSala(id);
  if (!completa) return null;
  if (completa.sala.id !== id) throw new Error('La lectura no pertenece a esta sala.');

  const { sala, equipos, muebles, conexiones, tomas, puertos } = completa;
  const [articulos, parametros] = await Promise.all([
    listarArticulos(),
    obtenerParametros(),
  ]);

  const porId = new Map(articulos.map((a) => [a.id, a]));
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const contextoExtremos = {
    tomas: new Map(tomas.map((t) => [t.id, t])),
    puertos: new Map(puertos.map((p) => [p.id, p])),
  };

  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;

  const resultados = (conexiones
        .filter((c) => !sinMedidas || c.longitud_manual_m != null)
        .map((c) => calcularConexion(c, sala, equiposPorId, porId, parametros, contextoExtremos))
        .filter(Boolean) as ResultadoCable[]);

  const material = agruparMaterialCable(resultados, conexiones, porId);
  const suministro = proyectarSuministros(equipos, completa.suministros);
  const pendientesCable = pendientesDeTiradas(conexiones, completa.suministros.cables ?? []);
  const necesidad = necesidadDeSala(suministro.necesidades, material, porId);

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
    avisosCalculo: new Map(conexiones.map((c) => [c.id,
      diagnosticarCalculoConexion(c, sala, equiposPorId, porId, parametros, contextoExtremos),
    ])),
    cables: completa.suministros.cables,
    suministros: completa.suministros.suministros,
  });

  return {
    suministro: { ...suministro, pendientes: [...suministro.pendientes, ...pendientesCable] },
    necesidad,
    sala,
    equipos,
    muebles,
    conexiones,
    tomas,
    puertos,
    articulos,
    parametros,
    porId,
    sinMedidas,
    resultados,
    material,
    canalizacion,
    filasCable,
  };
}

export async function fichaConAlmacen(id: string) {
  const completa = await obtenerSala(id);
  if (!completa) return null;

  // Ficha y logística proyectan el mismo montaje ya leído; no lo releen.
  const [base, falta, cargas, visitas, hechos] = await Promise.all([
    fichaDeSala(id, completa),
    faltaParaSala(id, completa),
    cargasDeSala(id),
    revisionesDeSala(id),
    datosTecnicosDeArticulos(completa.equipos.map((e) => e.articulo_id).filter(Boolean)),
  ]);
  if (!base) return null;
  const avisosTecnicos = revisarTecnicamente({
    salaId: id,
    equipos: base.equipos,
    conexiones: base.conexiones,
    puertos: base.puertos,
    catalogo: completa.catalogoEquipos,
    hechos,
    metros: new Map(base.resultados.map((r) => [r.conexion_id, { necesarios: r.longitud_m, comercial: r.longitud_comercial_m }])),
    cables: completa.suministros.cables,
  });

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
    avisosTecnicos,
  });

  return { ...base, falta, cargas, visitas, puntosMontaje };
}

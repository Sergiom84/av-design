import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { articulosPorIds, obtenerParametros, obtenerSala } from '@/lib/datos';
import { hitosDeProyecto } from '@/lib/datos-ciclo';
import { proyectoCerrado } from '@/lib/ciclo-vida';
import { calcularConexion } from '@/lib/calculo-cable';
import { datosTecnicosDeArticulos } from '@/lib/datos-ficha-tecnica';
import { SinConfigurar } from '@/components/sin-configurar';
import { Equipamiento } from '@/components/sala/equipamiento';
import { GuardarComoPlantilla } from '@/components/sala/guardar-como-plantilla';
import { TomasDeRed } from '@/components/sala/tomas-red';
import type { MetrosDeConexion } from '@/lib/revision-tecnica';

export const dynamic = 'force-dynamic';

/**
 * Qué hay puesto en la sala y dónde pincha. Los metros se calculan con el
 * catálogo de la sala, no con el catálogo entero.
 */
export default async function EquipamientoSala({
  params,
}: PageProps<'/salas/[id]/equipamiento'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const completa = await obtenerSala(id);
  if (!completa) notFound();

  const { sala, equipos, tomas, catalogoEquipos, puertos, conexiones } = completa;
  const cerrado = sala.proyecto_id
    ? proyectoCerrado(await hitosDeProyecto(sala.proyecto_id))
    : false;
  const ids = equipos.map((e) => e.articulo_id).filter(Boolean);
  const idsCable = [...new Set(conexiones.map((c) => c.articulo_cable_id).filter((id): id is string => Boolean(id)))];
  const [hechos, parametros, cables] = await Promise.all([
    datosTecnicosDeArticulos(ids),
    obtenerParametros(),
    articulosPorIds(idsCable),
  ]);
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const articulosCable = new Map(cables.map((a) => [a.id, a]));
  const contexto = {
    tomas: new Map(tomas.map((t) => [t.id, t])),
    puertos: new Map(puertos.map((p) => [p.id, p])),
  };
  const metros: Record<string, MetrosDeConexion> = {};
  for (const conexion of conexiones) {
    const resultado = calcularConexion(conexion, sala, equiposPorId, articulosCable, parametros, contexto);
    if (resultado) metros[conexion.id] = { necesarios: resultado.longitud_m, comercial: resultado.longitud_comercial_m };
    else if (conexion.longitud_manual_m != null) metros[conexion.id] = { necesarios: conexion.longitud_manual_m, comercial: null };
  }

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      <Equipamiento
        salaId={sala.id}
        equipos={equipos}
        tomas={tomas}
        cerrado={cerrado}
        catalogo={catalogoEquipos}
        puertos={puertos}
        conexiones={conexiones}
        hechos={Object.fromEntries(hechos)}
        metros={metros}
      />
      <TomasDeRed salaId={sala.id} tomas={tomas} equipos={equipos} puertos={puertos}
        conexiones={conexiones} version={sala.diagrama_version} cerrado={cerrado} />
      <GuardarComoPlantilla sala={sala} equipos={equipos} />
    </div>
  );
}

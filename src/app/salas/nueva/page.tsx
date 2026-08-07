import { hayConfiguracion } from '@/lib/db';
import { listarPlantillas, listarSedes } from '@/lib/datos';
import { listarProyectosConLocalizaciones } from '@/lib/datos-proyectos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace } from '@/components/ui';
import { AltaDeSala } from '@/components/sala/alta';

export const dynamic = 'force-dynamic';

/**
 * Una sola entrada para crear una sala, con plantilla o sin ella. XTEN-AV tiene
 * dos modales distintos que hacen casi lo mismo y uno ni siquiera funciona
 * (docs/06, apartado 3.1); aquí es una pantalla.
 */
export default async function NuevaSala({ searchParams }: PageProps<'/salas/nueva'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { plantilla, proyecto } = await searchParams;
  const [plantillas, sedes, proyectos] = await Promise.all([
    listarPlantillas(),
    listarSedes(),
    listarProyectosConLocalizaciones(),
  ]);

  return (
    <>
      <Cabecera
        titulo="Nueva sala"
        descripcion="Desde una plantilla o en blanco. Las medidas se piden siempre: son las que convierten un esquema en metros de cable."
        acciones={<Enlace href="/salas">Volver a salas</Enlace>}
      />

      <AltaDeSala
        plantillas={plantillas}
        sedes={sedes}
        proyectos={proyectos}
        plantillaInicial={Array.isArray(plantilla) ? plantilla[0] : plantilla}
        proyectoInicial={typeof proyecto === 'string' ? proyecto : undefined}
      />
    </>
  );
}

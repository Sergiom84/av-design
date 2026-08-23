import Link from 'next/link';
import { hayConfiguracion } from '@/lib/db';
import { listarSalasConEstado } from '@/lib/datos';
import { tablasDeCicloListas } from '@/lib/datos-ciclo';
import { esUuid } from '@/lib/uuid';
import { listarProyectos } from '@/lib/datos-proyectos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera } from '@/components/ui';
import { FiltroDeProyecto } from '@/components/sala/filtro-proyecto';
import { ListaDeSalas } from '@/components/sala/lista';

export const dynamic = 'force-dynamic';

export default async function Salas({ searchParams }: PageProps<'/salas'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { proyecto } = await searchParams;
  const proyectoId =
    typeof proyecto === 'string' && esUuid(proyecto) ? proyecto : undefined;

  const [salas, proyectos, cicloListo] = await Promise.all([
    listarSalasConEstado(proyectoId),
    listarProyectos(),
    tablasDeCicloListas(),
  ]);
  // Del listado de obras, no de la primera sala: un proyecto sin salas
  // todavía tiene nombre y antes se quedaba en "elegido".
  const nombreProyecto = proyectoId
    ? proyectos.find((p) => p.id === proyectoId)?.nombre
    : undefined;

  return (
    <>
      <Cabecera
        titulo="Salas"
        descripcion={
          proyectoId
            ? `Solo las salas del proyecto ${nombreProyecto ?? 'elegido'}.`
            : 'Cada sala guarda sus medidas reales, su equipamiento y sus conexiones. De ahí salen los metros de cable.'
        }
        acciones={
          <>
            <FiltroDeProyecto proyectos={proyectos} elegido={proyectoId} />
            <Link href="/salas/nueva" className="boton boton-principal">
              Nueva sala
            </Link>
          </>
        }
      />

      <ListaDeSalas salas={salas} conProyecto={!proyectoId} cicloListo={cicloListo} />
    </>
  );
}

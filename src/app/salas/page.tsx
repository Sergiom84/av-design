import Link from 'next/link';
import { hayConfiguracion } from '@/lib/db';
import { listarSalas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace } from '@/components/ui';
import { ListaDeSalas } from '@/components/sala/lista';

export const dynamic = 'force-dynamic';

export default async function Salas({ searchParams }: PageProps<'/salas'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { proyecto } = await searchParams;
  // Va directo a una comparación con columna uuid: un valor manipulado en la
  // dirección no puede convertirse en un error 500 de Postgres.
  const esUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const proyectoId =
    typeof proyecto === 'string' && esUuid(proyecto) ? proyecto : undefined;

  const salas = await listarSalas(proyectoId);
  const nombreProyecto = proyectoId ? salas[0]?.proyecto : undefined;

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
            {proyectoId && <Enlace href="/salas">Quitar filtro</Enlace>}
            <Link href="/salas/nueva" className="boton boton-principal">
              Nueva sala
            </Link>
          </>
        }
      />

      <ListaDeSalas salas={salas} conProyecto={!proyectoId} />
    </>
  );
}

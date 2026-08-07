import Link from 'next/link';
import { hayConfiguracion } from '@/lib/db';
import { listarProyectos, contarSalasSinProyecto } from '@/lib/datos-proyectos';
import { listarSedes } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace } from '@/components/ui';
import { ListaDeProyectos } from '@/components/proyecto/lista';
import { AltaDeProyecto } from '@/components/proyecto/alta';

export const dynamic = 'force-dynamic';

/**
 * La obra agrupa salas por localización, como el proyecto de XTEN-AV
 * (docs/06, apartado sobre la jerarquía). El alta va desplegada en la
 * dirección (`?nueva=1`), no en un acordeón: se puede enlazar y volver.
 */
export default async function Proyectos({ searchParams }: PageProps<'/proyectos'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { nueva } = await searchParams;
  const abrirAlta = nueva === '1';

  const [proyectos, salasSinProyecto, sedes] = await Promise.all([
    listarProyectos(),
    contarSalasSinProyecto(),
    abrirAlta ? listarSedes() : Promise.resolve([]),
  ]);

  return (
    <>
      <Cabecera
        titulo="Proyectos"
        descripcion="La obra agrupa salas por localización. Una sala sin proyecto sigue siendo válida: se adopta desde la portada cuando toque."
        acciones={
          abrirAlta ? (
            <Enlace href="/proyectos">Cerrar alta</Enlace>
          ) : (
            <Link href="/proyectos?nueva=1" className="boton boton-principal">
              Nuevo proyecto
            </Link>
          )
        }
      />

      <div className="space-y-6">
        {abrirAlta && <AltaDeProyecto sedes={sedes} />}
        <ListaDeProyectos proyectos={proyectos} salasSinProyecto={salasSinProyecto} />
      </div>
    </>
  );
}

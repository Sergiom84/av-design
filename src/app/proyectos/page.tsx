import Link from 'next/link';
import { hayConfiguracion } from '@/lib/db';
import {
  contarSalasSinProyecto,
  listarCodigosDeProyecto,
  listarProyectos,
} from '@/lib/datos-proyectos';
import { codigoSugeridoProyecto } from '@/lib/nombres-proyecto';
import { listarSedes } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera, Enlace } from '@/components/ui';
import { tablasDeCicloListas } from '@/lib/datos-ciclo';
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

  const [proyectos, salasSinProyecto, sedes, codigos, cicloListo] = await Promise.all([
    listarProyectos(),
    contarSalasSinProyecto(),
    abrirAlta ? listarSedes() : Promise.resolve([]),
    abrirAlta ? listarCodigosDeProyecto() : Promise.resolve([]),
    tablasDeCicloListas(),
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
        {!cicloListo && (
          <Aviso tono="alerta">
            Faltan las tablas de técnicos e hitos: el despliegue llegó antes que su
            migración. Aplicar db/migraciones/2026-08-jerarquia-p1.sql; hasta
            entonces los estados salen como &quot;sin iniciar&quot;.
          </Aviso>
        )}
        {abrirAlta && (
          <AltaDeProyecto
            sedes={sedes}
            codigoSugerido={codigoSugeridoProyecto(new Date(), codigos)}
          />
        )}
        <ListaDeProyectos proyectos={proyectos} salasSinProyecto={salasSinProyecto} />
      </div>
    </>
  );
}

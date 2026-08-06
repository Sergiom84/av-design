import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerRevision } from '@/lib/datos-checkin';
import { SinConfigurar } from '@/components/sin-configurar';
import { Boton, Cabecera, Enlace } from '@/components/ui';
import { borrarVisita } from '@/app/acciones-checkin';
import { PuntosVisita } from '@/components/checkin/puntos-visita';
import { CierreVisita } from '@/components/checkin/cierre-visita';

export const dynamic = 'force-dynamic';

/**
 * La pantalla que se usa en la sala, con el móvil.
 *
 * Una sola columna a propósito, como la lista de carga: a 375 px lo que importa
 * es que cada punto ocupe el ancho entero y que sus botones sean grandes. El
 * cierre va al final, que es donde se llega después de recorrerlo todo.
 */
export default async function DetalleVisita({ params }: PageProps<'/checkin/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const visita = await obtenerRevision(id);
  if (!visita) notFound();

  const { revision, puntos, resumen } = visita;

  return (
    <>
      <Cabecera
        titulo={revision.nombre}
        descripcion={[
          revision.sala,
          revision.cerrada ? 'Cerrada' : `${resumen.total - resumen.pendientes} de ${resumen.total} mirados`,
          resumen.incidencias > 0
            ? `${resumen.incidencias} ${resumen.incidencias === 1 ? 'incidencia' : 'incidencias'}`
            : null,
          revision.quien,
        ]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          <>
            <Enlace href={`/salas/${revision.sala_id}`}>Ver sala</Enlace>
            <form action={borrarVisita}>
              <input type="hidden" name="id" value={revision.id} />
              <input type="hidden" name="sala_id" value={revision.sala_id} />
              <Boton variante="peligro">Borrar</Boton>
            </form>
          </>
        }
      />

      <div className="max-w-2xl space-y-6">
        <PuntosVisita puntos={puntos} cerrada={revision.cerrada} />
        <CierreVisita revision={revision} puntos={puntos} />
      </div>
    </>
  );
}

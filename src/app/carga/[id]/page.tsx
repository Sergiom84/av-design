import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { listarUbicaciones, obtenerCarga } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Boton, Cabecera, Enlace } from '@/components/ui';
import { borrarCarga } from '@/app/acciones-almacen';
import { ListaDeCarga } from '@/components/carga/lista-carga';
import { CierreDeObra } from '@/components/carga/cierre-obra';
import { ETIQUETA_CARGA } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

/**
 * La pantalla que se usa en el almacén, con el móvil.
 *
 * Una sola columna a propósito, sin rejilla de dos: a 375 px lo que importa es
 * que la lista de material ocupe el ancho entero y que cada línea sea un botón
 * grande. Todo lo demás va debajo.
 */
export default async function DetalleCarga({ params }: PageProps<'/carga/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const [completa, ubicaciones] = await Promise.all([
    obtenerCarga(id),
    listarUbicaciones(),
  ]);
  if (!completa) notFound();

  const { carga, lineas } = completa;

  return (
    <>
      <Cabecera
        titulo={carga.nombre}
        descripcion={[carga.sala, ETIQUETA_CARGA[carga.estado], carga.quien]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          <>
            <Enlace href={`/salas/${carga.sala_id}`}>Ver sala</Enlace>
            <form action={borrarCarga}>
              <input type="hidden" name="id" value={carga.id} />
              <Boton variante="peligro">Borrar</Boton>
            </form>
          </>
        }
      />

      <div className="max-w-3xl space-y-6">
        <ListaDeCarga carga={carga} lineas={lineas} ubicaciones={ubicaciones} />
        <CierreDeObra carga={carga} lineas={lineas} ubicaciones={ubicaciones} />
      </div>
    </>
  );
}

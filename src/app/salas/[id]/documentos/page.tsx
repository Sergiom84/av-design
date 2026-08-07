import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSalaCabecera } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Enlace, Estado, Tarjeta } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Los entregables de la sala, reunidos. Hoy son los que ya existen dentro de
 * cada pestaña; el hub con PDF, Excel y paquete ZIP está en el roadmap como
 * `Después` y entrará aquí sin tocar el resto de la ficha.
 */
export default async function DocumentosSala({
  params,
}: PageProps<'/salas/[id]/documentos'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const sala = await obtenerSalaCabecera(id);
  if (!sala) notFound();

  // Literales de plantilla sin cast: typedRoutes valida cada destino.
  const entregables = [
    {
      nombre: 'Croquis de la sala',
      detalle: 'Plano en planta con cotas, mesa y equipos. Se imprime desde el Resumen.',
      href: `/salas/${sala.id}` as const,
    },
    {
      nombre: 'Tabla de cables',
      detalle:
        'El entregable de obra: identificador, extremos, puertos y metros. Con exportación CSV.',
      href: `/salas/${sala.id}/cableado` as const,
    },
    {
      nombre: 'Esquema de conexiones',
      detalle: 'Los equipos y sus cables, con los identificadores de la tabla.',
      href: `/salas/${sala.id}/cableado` as const,
    },
    {
      nombre: 'Lista de material',
      detalle: 'Cable y consumibles a comprar, con la canalización dimensionada.',
      href: `/salas/${sala.id}/logistica` as const,
    },
  ];

  return (
    <Tarjeta titulo="Entregables">
      <div className="divide-y divide-linea-suave">
        {entregables.map((e) => (
          <div key={e.nombre} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <Enlace href={e.href}>{e.nombre}</Enlace>
              <p className="text-tinta-tenue">{e.detalle}</p>
            </div>
            <Estado tono="listo">Disponible</Estado>
          </div>
        ))}
        <div className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <span className="font-medium">Paquete exportable</span>
            <p className="text-tinta-tenue">PDF, Excel y ZIP con todo lo anterior.</p>
          </div>
          <Estado tono="neutro">Pendiente</Estado>
        </div>
      </div>
    </Tarjeta>
  );
}

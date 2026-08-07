import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSalaCabecera } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { ContenedorTabla, Tarjeta } from '@/components/ui';

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
    <Tarjeta
      titulo="Entregables"
      pie="El paquete exportable (PDF, Excel, ZIP) está en el roadmap: entrará aquí."
    >
      <ContenedorTabla etiqueta="Entregables">
      <table className="datos">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Qué contiene</th>
          </tr>
        </thead>
        <tbody>
          {entregables.map((e) => (
            <tr key={e.nombre}>
              <td>
                <Link href={e.href} className="enlace">
                  {e.nombre}
                </Link>
              </td>
              <td className="text-tinta-tenue">{e.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </ContenedorTabla>
    </Tarjeta>
  );
}

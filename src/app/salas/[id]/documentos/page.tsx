import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSalaCabecera } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Enlace, Estado, Tarjeta } from '@/components/ui';
import { ExportadorDocumentos } from '@/components/documentos/exportador';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { puedeExportarBom } from '@/lib/documentos/seleccion';

export const dynamic = 'force-dynamic';

/** Entregables de una sala y acceso a las vistas que alimentan el snapshot. */
export default async function DocumentosSala({
  params,
}: PageProps<'/salas/[id]/documentos'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const sala = await obtenerSalaCabecera(id);
  if (!sala) notFound();
  const yo = await exigirSeccion('salas');

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
      href: `/salas/${sala.id}/diagrama` as const,
    },
    {
      nombre: 'Lista de material',
      detalle: 'Cable y consumibles a comprar, con la canalización dimensionada.',
      href: `/salas/${sala.id}/logistica` as const,
    },
  ];

  return (
    <div className="space-y-6">
    <ExportadorDocumentos salas={[{id:sala.id,nombre:sala.nombre,codigo:sala.codigo}]} puedeBom={puedeExportarBom(yo.permisos)}/>
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
      </div>
    </Tarjeta>
    </div>
  );
}

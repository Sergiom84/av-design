import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerDatosPlanoSala } from '@/lib/datos-plano';
import { SinConfigurar } from '@/components/sin-configurar';
import { Enlace, Estado, Tarjeta } from '@/components/ui';
import { fichaDeSala } from '../datos-ficha';
import { PaqueteTecnico } from '@/components/documentos/paquete-tecnico';
import { ImprimirPaquete } from '@/components/documentos/imprimir-paquete';

export const dynamic = 'force-dynamic';

/** Entregable HTML único, derivado de la ficha y las puertas de Plano. */
export default async function DocumentosSala({
  params,
}: PageProps<'/salas/[id]/documentos'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const ficha = await fichaDeSala(id);
  if (!ficha) notFound();
  const plano = await obtenerDatosPlanoSala(id);
  if (!plano) notFound();
  const { sala } = ficha;
  const emitido = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date());

  // Literales de plantilla sin cast: typedRoutes valida cada destino.
  const entregables = [
    {
      nombre: 'Croquis de la sala',
      detalle: 'Plano en planta con cotas, mesa y equipos.',
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
      detalle: 'Equipo, puerto y boca física de cada extremo.',
      href: `/salas/${sala.id}/diagrama` as const,
    },
    {
      nombre: 'Acotaciones y elevaciones',
      detalle: 'Medidas y alturas para colocar los equipos.',
      href: `/salas/${sala.id}/acotaciones` as const,
    },
    {
      nombre: 'Lista de material',
      detalle: 'Cable y consumibles a comprar, con la canalización dimensionada.',
      href: `/salas/${sala.id}/logistica` as const,
    },
  ];

  return (
    <div className="space-y-6">
    <Tarjeta titulo="Entregables" acciones={<ImprimirPaquete />}>
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
    <PaqueteTecnico ficha={ficha} puertas={plano.puertas} emitido={emitido} />
    </div>
  );
}

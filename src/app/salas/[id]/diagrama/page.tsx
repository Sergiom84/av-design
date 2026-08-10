import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerDatosPlanoSala } from '@/lib/datos-plano';
import { SinConfigurar } from '@/components/sin-configurar';
import { EditorPlanoSala } from '@/components/plano-editor/editor-plano-sala';

export const dynamic = 'force-dynamic';

/**
 * Diagrama: el plano en planta de la sala, editable.
 *
 * No dibuja nada aparte. Edita las medidas, la mesa, las posiciones de los
 * equipos y las rosetas —los mismos datos que ya alimentan el croquis de
 * Resumen, el cálculo de cable y la lista de material— y el croquis se
 * redibuja solo. No hay imagen guardada, ni JSON de lienzo, ni segunda fuente
 * de verdad.
 */
export default async function DiagramaSala({ params }: PageProps<'/salas/[id]/diagrama'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const datos = await obtenerDatosPlanoSala(id);
  if (!datos) notFound();

  return (
    <EditorPlanoSala
      sala={datos.sala}
      equipos={datos.equipos}
      conexiones={datos.conexiones}
      tomas={datos.tomas}
      cerrado={datos.cerrado}
    />
  );
}

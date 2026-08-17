import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { guardarEditorConexiones } from '@/app/acciones-diagrama';
import { SinConfigurar } from '@/components/sin-configurar';
import { EditorConexiones } from '@/components/diagrama/editor-conexiones';
import { fichaDeSala } from '../datos-ficha';
import { obtenerDatosPlanoSala } from '@/lib/datos-plano';

export const dynamic = 'force-dynamic';

/**
 * Diagrama: el editor de conexiones puerto a puerto.
 *
 * La misma fuente normalizada que alimenta la tabla y los metros de Cableado.
 */
export default async function DiagramaSala({ params }: PageProps<'/salas/[id]/diagrama'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const [ficha, datosPlano] = await Promise.all([fichaDeSala(id), obtenerDatosPlanoSala(id)]);
  if (!ficha || !datosPlano) notFound();

  return <EditorConexiones
    sala={ficha.sala}
    version={ficha.sala.diagrama_version}
    conexiones={ficha.conexiones}
    equipos={ficha.equipos}
    puertos={ficha.puertos}
    articulos={ficha.articulos}
    cerrado={datosPlano.cerrado}
    guardar={guardarEditorConexiones}
  />;
}

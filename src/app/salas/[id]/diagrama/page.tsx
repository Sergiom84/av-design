import { notFound } from 'next/navigation';
import { hayConfiguracion, sql } from '@/lib/db';
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

  const posiciones = await sql<Array<{id: string; esquema_x: number; esquema_y: number}>>`
    select id, esquema_x, esquema_y from sala_equipos
    where sala_id = ${id} and esquema_x is not null and esquema_y is not null`;
  const posicionesIniciales = Object.fromEntries(posiciones.map((e) =>
    [e.id, { x: Number(e.esquema_x), y: Number(e.esquema_y) }]));

  return <EditorConexiones
    key={`${ficha.sala.id}:${ficha.sala.diagrama_version}`}
    posicionesIniciales={posicionesIniciales}
    sala={ficha.sala}
    version={ficha.sala.diagrama_version}
    conexiones={ficha.conexiones}
    equipos={ficha.equipos}
    puertos={ficha.puertos}
    parametros={ficha.parametros}
    articulos={ficha.articulos.filter((a) => a.tipo === 'cable' || ficha.equipos.some((e) => e.articulo_id === a.id))}
    cerrado={datosPlano.cerrado}
    guardar={guardarEditorConexiones}
  />;
}

import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerDatosPlanoSala } from '@/lib/datos-plano';
import { categoriasDeMobiliario, nombreDePlantilla } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { EditorPlanoSala } from '@/components/plano-editor/editor-plano-sala';
import { OrigenDiagrama } from '@/components/plano-editor/origen-diagrama';

export const dynamic = 'force-dynamic';

/**
 * Plano: el plano en planta de la sala, editable.
 *
 * Hasta ahora esta pantalla vivía en `/salas/[id]/diagrama` y se llamaba
 * Diagrama. El nombre se ha liberado: `Diagrama` pasa a ser el editor de
 * conexiones, que es lo que un técnico entiende por diagrama, y la posición
 * física de las cosas se llama `Plano`, que es lo que es. El editor es el
 * mismo, no una copia: `EditorPlanoSala` sigue teniendo un único punto de
 * montaje.
 *
 * No dibuja nada aparte. Edita las medidas, la mesa, el mobiliario, las
 * posiciones de los equipos y las rosetas —los mismos datos que ya alimentan
 * el croquis de Resumen, el cálculo de cable y la lista de material— y el
 * croquis se redibuja solo. No hay imagen guardada, ni JSON de lienzo, ni
 * segunda fuente de verdad.
 *
 * La primera vez pregunta de dónde sale el plano. Una vez contestado no
 * vuelve a preguntarlo: es la diferencia entre decidirlo una vez y pagar un
 * peaje en cada visita a cada una de las 390 salas.
 */
export default async function PlanoSala({ params }: PageProps<'/salas/[id]/plano'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const datos = await obtenerDatosPlanoSala(id);
  if (!datos) notFound();

  if (!datos.sala.diagrama_iniciado_en) {
    return (
      <OrigenDiagrama
        salaId={datos.sala.id}
        version={datos.sala.diagrama_version}
        cerrado={datos.cerrado}
      />
    );
  }

  const [categorias, plantilla] = await Promise.all([
    categoriasDeMobiliario(),
    nombreDePlantilla(datos.sala.diagrama_plantilla_id),
  ]);

  return (
    <EditorPlanoSala
      sala={datos.sala}
      equipos={datos.equipos}
      conexiones={datos.conexiones}
      tomas={datos.tomas}
      muebles={datos.muebles}
      categoriasMobiliario={categorias}
      plantillaBase={plantilla}
      cerrado={datos.cerrado}
    />
  );
}

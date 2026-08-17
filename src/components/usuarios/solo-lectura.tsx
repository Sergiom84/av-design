import { Aviso } from '@/components/ui';
import { esSoloLectura } from '@/lib/sesion-servidor';
import type { Seccion } from '@/lib/usuarios';

/**
 * El aviso de que aquí se mira pero no se toca.
 *
 * Va en el layout de la sección, encima de todo. No esconde ningún botón: los
 * botones siguen ahí y la guarda que de verdad importa está en cada acción de
 * servidor, porque una acción es una dirección pública y esconder el botón no
 * la cierra. Esto resuelve el otro problema, el de la persona: pulsar y que no
 * pase nada es peor que saberlo antes.
 *
 * No se pinta nada cuando la persona sí puede editar, que es el caso normal.
 */
export async function SoloLectura({ seccion }: { seccion: Seccion }) {
  if (!(await esSoloLectura(seccion))) return null;

  return (
    <div className="mb-6">
      <Aviso tono="neutro">
        Tienes esta sección en solo lectura. Puedes consultarla; guardar no te dejará.
      </Aviso>
    </div>
  );
}

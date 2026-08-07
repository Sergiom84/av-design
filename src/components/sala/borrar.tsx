import Link from 'next/link';
import { Aviso, Boton, Enlace, Tarjeta } from '@/components/ui';
import { borrarSala } from '@/app/acciones';

/**
 * Borrar la sala, aparte del trabajo diario y con el mismo patrón de
 * confirmación por URL que el proyecto y los hitos: no es el primer botón
 * móvil ni un envío inmediato ambiguo. Vive al final del Resumen; la obra
 * cerrada no la muestra (`borrarSala` también lo comprueba en el servidor).
 */
export function BorrarSala({
  salaId,
  confirmar,
}: {
  salaId: string;
  confirmar: boolean;
}) {
  if (!confirmar) {
    return (
      <Tarjeta variante="peligrosa" titulo="Borrar sala">
        <Link href={`/salas/${salaId}?borrar=sala` as never} className="boton boton-peligro">
          Borrar sala
        </Link>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta variante="peligrosa" titulo="Borrar sala">
      <div className="space-y-2">
        <Aviso tono="alerta">
          Borra la sala: sus medidas y croquis, el equipamiento, las conexiones y la
          tabla de cables, las tomas de red, las reservas de material, las cargas de
          furgoneta y las revisiones (check-in) e hitos de instalación y entrega. Los
          movimientos de almacén y los pedidos que la mencionan no se borran: quedan
          sin sala, como el material legado. No se puede deshacer.
        </Aviso>
        <div className="flex gap-3 items-center">
          <form action={borrarSala}>
            <input type="hidden" name="id" value={salaId} />
            <Boton variante="peligro">Borrar definitivamente</Boton>
          </form>
          <Enlace href={`/salas/${salaId}`}>Cancelar</Enlace>
        </div>
      </div>
    </Tarjeta>
  );
}

import Link from 'next/link';
import { Aviso, Boton, Enlace, Tarjeta } from '@/components/ui';
import { borrarProyecto } from '@/app/acciones-proyectos';

/**
 * Borrar la obra, aparte del trabajo diario y con el mismo patrón de
 * confirmación por URL que los hitos: no es un envío inmediato ambiguo.
 * Borrar el proyecto borra sus localizaciones (`on delete cascade`); las
 * salas y los pedidos no se borran, quedan sueltos — el mismo legado válido
 * que una sala de antes de la jerarquía.
 */
export function BorrarProyecto({
  proyectoId,
  confirmar,
}: {
  proyectoId: string;
  confirmar: boolean;
}) {
  if (!confirmar) {
    return (
      <Tarjeta variante="peligrosa" titulo="Borrar proyecto">
        <Link
          href={`/proyectos/${proyectoId}?borrar=proyecto` as never}
          className="boton boton-peligro"
        >
          Borrar proyecto
        </Link>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta variante="peligrosa" titulo="Borrar proyecto">
      <div className="space-y-2">
        <Aviso tono="alerta">
          Borra las localizaciones de la obra. Las salas y los pedidos no se
          borran: quedan sueltos, como antes de la jerarquía. No se puede
          deshacer.
        </Aviso>
        <div className="flex gap-3 items-center">
          <form action={borrarProyecto}>
            <input type="hidden" name="id" value={proyectoId} />
            <Boton variante="peligro">Borrar definitivamente</Boton>
          </form>
          <Enlace href={`/proyectos/${proyectoId}`}>Cancelar</Enlace>
        </div>
      </div>
    </Tarjeta>
  );
}

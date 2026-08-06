import { Aviso, Boton, Campo, Tarjeta } from '@/components/ui';
import { cerrarVisita, guardarCabeceraVisita } from '@/app/acciones-checkin';
import { motivoParaNoCerrar, puedeCerrarse } from '@/lib/checkin';
import type { PuntoRevision, Revision } from '@/lib/tipos';

/**
 * Quién fue a la sala, qué pasó en general y el cierre de la visita.
 *
 * El botón de cerrar se deshabilita mientras quede algún punto sin mirar, y el
 * motivo se enseña al lado: un botón apagado sin explicación es una pantalla
 * rota. Cerrar con puntos sin mirar es firmar en blanco, y quien lo intenta
 * desde una pestaña vieja se topa además con la condición de la consulta.
 */
export function CierreVisita({
  revision,
  puntos,
}: {
  revision: Revision;
  puntos: PuntoRevision[];
}) {
  if (revision.cerrada) {
    return (
      <Tarjeta titulo="Visita cerrada">
        <div className="space-y-2">
          <p className="text-tinta-tenue">
            Cerrada{revision.quien ? ` por ${revision.quien}` : ''}. Es la foto de aquel
            día y no se toca.
          </p>
          {revision.notas && <p>{revision.notas}</p>}
        </div>
      </Tarjeta>
    );
  }

  const motivo = motivoParaNoCerrar(puntos);

  return (
    <Tarjeta titulo="Cierre de la visita">
      <div className="space-y-4">
        <form action={guardarCabeceraVisita} className="space-y-3">
          <input type="hidden" name="id" value={revision.id} />
          <Campo etiqueta="Nombre">
            <input
              name="nombre"
              defaultValue={revision.nombre}
              className="w-full min-h-[2.75rem]"
            />
          </Campo>
          <Campo etiqueta="Quién va">
            <input
              name="quien"
              defaultValue={revision.quien ?? ''}
              className="w-full min-h-[2.75rem]"
            />
          </Campo>
          <Campo etiqueta="Notas de la visita">
            <textarea
              name="notas"
              rows={3}
              defaultValue={revision.notas ?? ''}
              className="w-full"
            />
          </Campo>
          <Boton variante="secundario">Guardar</Boton>
        </form>

        <div className="pt-4 border-t border-linea space-y-3">
          {motivo && <Aviso>{motivo}</Aviso>}
          <form action={cerrarVisita}>
            <input type="hidden" name="id" value={revision.id} />
            <Boton variante="principal" disabled={!puedeCerrarse(puntos)}>
              Cerrar visita
            </Boton>
          </form>
          <p className="text-tinta-tenue">
            Una visita cerrada se ve pero no se edita. Las incidencias no impiden
            cerrar: son el resultado de haber ido.
          </p>
        </div>
      </div>
    </Tarjeta>
  );
}

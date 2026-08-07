import { Boton, Campo, Tarjeta } from '@/components/ui';
import { borrarHitoProyecto, registrarHitoProyecto } from '@/app/acciones-ciclo';
import {
  tecnicosDeRol,
  type HitoProyecto,
  type Tecnico,
  type TecnicoRol,
} from '@/lib/ciclo-vida';

/**
 * Inicio y cierre de la obra. La recepción no está aquí a propósito: es por
 * pedido y vive en compras; la instalación y la entrega son de cada sala.
 */
export function HitosDeProyecto({
  proyectoId,
  hitos,
  tecnicos,
  roles,
  salasSinEntregar,
}: {
  proyectoId: string;
  hitos: HitoProyecto[];
  tecnicos: Tecnico[];
  roles: TecnicoRol[];
  salasSinEntregar: number;
}) {
  const inicio = hitos.find((h) => h.tipo === 'inicio');
  const cierre = hitos.find((h) => h.tipo === 'cierre');
  const iniciadores = tecnicosDeRol(tecnicos, roles, 'inicio');

  const formulario = (tipo: 'inicio' | 'cierre', etiqueta: string) => (
    <form
      action={registrarHitoProyecto}
      className="flex flex-wrap items-end gap-3 pt-3 border-t border-linea-suave"
    >
      <input type="hidden" name="proyecto_id" value={proyectoId} />
      <input type="hidden" name="tipo" value={tipo} />
      <Campo etiqueta="Quién">
        <select name="tecnico_id" className="w-40">
          <option value="">—</option>
          {iniciadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Fecha">
        <input name="fecha" type="date" className="w-40 num" />
      </Campo>
      {tipo === 'cierre' && salasSinEntregar > 0 && (
        <Campo etiqueta="Nota (obligatoria)">
          <input name="notas" required className="w-56" />
        </Campo>
      )}
      <Boton variante="secundario">{etiqueta}</Boton>
    </form>
  );

  const fila = (titulo: string, hito: HitoProyecto | undefined, pendiente: string) => (
    <li className="flex gap-3 items-baseline">
      <span
        aria-hidden="true"
        className={`inline-block size-2 rounded-full shrink-0 ${
          hito ? 'bg-exito' : 'bg-linea-fuerte'
        }`}
      />
      <div>
        <span className={hito ? 'font-medium' : 'text-tinta-tenue font-medium'}>
          {titulo}
        </span>
        <span className="block text-tinta-tenue">
          {hito
            ? [hito.tecnico, hito.fecha, hito.notas].filter(Boolean).join(' · ')
            : pendiente}
        </span>
      </div>
    </li>
  );

  return (
    <Tarjeta
      titulo="Hitos del proyecto"
      pie="La recepción no es hito del proyecto: vive en cada pedido. Instalación y entrega son de cada sala."
    >
      <ol className="space-y-2 mb-2">
        {fila('Inicio del proyecto', inicio, 'Sin registrar.')}
        {fila(
          'Cierre del proyecto',
          cierre,
          salasSinEntregar > 0
            ? `Pendiente: ${salasSinEntregar} ${salasSinEntregar === 1 ? 'sala sin entregar' : 'salas sin entregar'}.`
            : 'Sin registrar.',
        )}
      </ol>

      {!inicio && formulario('inicio', 'Registrar inicio')}
      {!cierre && inicio && formulario('cierre', 'Registrar cierre')}

      {(inicio || cierre) && (
        <div className="flex gap-3 pt-3 border-t border-linea-suave">
          {[inicio, cierre].filter(Boolean).map((h) => (
            <form key={h!.id} action={borrarHitoProyecto}>
              <input type="hidden" name="proyecto_id" value={proyectoId} />
              <input type="hidden" name="id" value={h!.id} />
              <Boton variante="secundario">
                {h!.tipo === 'inicio' ? 'Borrar inicio' : 'Borrar cierre'}
              </Boton>
            </form>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

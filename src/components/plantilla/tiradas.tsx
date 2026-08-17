import { Boton, Campo, ContenedorTabla } from '@/components/ui';
import { anadirTiradaPlantilla, quitarTiradaPlantilla } from '@/app/acciones';
import {
  ETIQUETA_RUTA,
  ETIQUETA_SENAL,
  type LineaPlantilla,
  type Puerto,
  type TiradaPlantilla,
} from '@/lib/tipos';
import { bocasDePuerto } from '@/lib/bocas-puerto';

/**
 * Las tiradas tipo de la plantilla: qué va conectado con qué en la sala
 * estándar. La sala nueva las copia con sus propios equipos, así que las 144
 * salas de telepresencia nacen con su tabla de cables en vez de vacías.
 *
 * Una tirada cuyo equipo esté marcado "no en todas" no se hereda: la sala se
 * crea sin ella, porque una tirada a un equipo que no está es una tirada rota.
 */
export function TiradasDePlantilla({
  plantillaId,
  lineas,
  tiradas,
  puertos,
}: {
  plantillaId: string;
  lineas: LineaPlantilla[];
  tiradas: TiradaPlantilla[];
  puertos: Puerto[];
}) {
  if (lineas.length < 2) {
    return (
      <p className="text-tinta-tenue">
        Con menos de dos equipos no hay nada que conectar.
      </p>
    );
  }

  const opciones = lineas.flatMap((linea) => {
    if (!linea.articulo_id || linea.cantidad !== 1) return [];
    return puertos
      .filter((puerto) => puerto.articulo_id === linea.articulo_id)
      .flatMap((puerto) => bocasDePuerto(puerto, linea.id).map((boca) => (
        <option key={`${linea.id}:${puerto.id}:${boca.ordinal}`} value={`${linea.id}:${puerto.id}:${boca.ordinal}`}>
          {linea.modelo_texto ?? linea.categoria} · {boca.etiqueta}
        </option>
      )));
  });

  return (
    <div>
      {tiradas.length === 0 ? (
        <p className="text-tinta-tenue mb-3">
          Sin tiradas tipo. Las salas nacerán sin tabla de cables.
        </p>
      ) : (
        <ContenedorTabla etiqueta="Tiradas de la plantilla">
        <table className="datos mb-3">
          <thead>
            <tr>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Señal</th>
              <th>Ruta</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tiradas.map((t) => (
              <tr key={t.id}>
                <td>{t.origen}</td>
                <td>{t.destino}</td>
                <td>{ETIQUETA_SENAL[t.senal]}</td>
                <td className="text-tinta-tenue">
                  {t.ruta ? ETIQUETA_RUTA[t.ruta] : 'la de la sala'}
                </td>
                <td>
                  <form action={quitarTiradaPlantilla}>
                    <input type="hidden" name="id" value={t.id} />
                    <Boton variante="peligro">Quitar</Boton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </ContenedorTabla>
      )}

      <form
        action={anadirTiradaPlantilla}
        className="flex flex-wrap items-end gap-2 pt-3 border-t border-linea"
      >
        <input type="hidden" name="plantilla_id" value={plantillaId} />
        <Campo etiqueta="Desde">
          <select name="boca_origen" required>
            <option value="">—</option>
            {opciones}
          </select>
        </Campo>
        <Campo etiqueta="Hasta">
          <select name="boca_destino" required>
            <option value="">—</option>
            {opciones}
          </select>
        </Campo>
        <Campo etiqueta="Señal">
          <select name="senal" defaultValue="hdmi">
            {Object.entries(ETIQUETA_SENAL).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Ruta">
          <select name="ruta" defaultValue="">
            <option value="">la de la sala</option>
            {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </Campo>
        <Boton>Añadir tirada</Boton>
      </form>
    </div>
  );
}

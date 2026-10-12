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
import type { TiradaDocumental, BocaRosetaPlantilla } from '@/lib/datos-tiradas-documentales';

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
  documentales = [],
  bocasRosetas = [],
}: {
  plantillaId: string;
  lineas: LineaPlantilla[];
  tiradas: TiradaPlantilla[];
  puertos: Puerto[];
  documentales?: TiradaDocumental[];
  bocasRosetas?: BocaRosetaPlantilla[];
}) {
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
  opciones.push(...bocasRosetas.map((boca) => (
    <option key={`roseta:${boca.id}`} value={`roseta:${boca.id}`}>
      {boca.codigo} · {boca.etiqueta ?? `Boca ${boca.ordinal}`}
    </option>
  )));
  const pendientes = documentales.filter((tirada) => !tirada.completa);

  return (
    <div>
      {pendientes.length > 0 && <section className="mb-4 space-y-2" aria-label="Tiradas pendientes de documentar">
        <p>Documenta las bocas de estas tiradas antes de crear una sala con la plantilla.</p>
        <ul className="space-y-2">
          {pendientes.map((t) => <li key={t.id}>
            <span className="font-medium">{t.fuente_clave}: {t.origen_categoria} → {t.destino_categoria}</span>
            <span className="block text-tinta-tenue">{t.senal} · {t.ruta}</span>
            {t.notas && <p className="text-tinta-tenue">{t.notas}</p>}
          </li>)}
        </ul>
      </section>}
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
        {pendientes.length > 0 && <Campo etiqueta="Tirada documental">
          <select name="documental_id" defaultValue="" className="max-w-full">
            <option value="">Nueva tirada independiente</option>
            {pendientes.map((t) => <option key={t.id} value={t.id}>
              {t.fuente_clave}: {t.origen_categoria} → {t.destino_categoria}
            </option>)}
          </select>
        </Campo>}
        {tiradas.length > 0 && <Campo etiqueta="Conexión existente que se documenta">
          <select name="conexion_existente_id" defaultValue="" className="max-w-full">
            <option value="">Crear conexión nueva</option>
            {tiradas.map((t) => <option key={t.id} value={t.id}>
              {t.origen} → {t.destino} · {ETIQUETA_SENAL[t.senal]}
            </option>)}
          </select>
        </Campo>}
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
        <Boton>Guardar tirada</Boton>
      </form>
    </div>
  );
}

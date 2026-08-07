import Link from 'next/link';
import { Boton, Campo, ContenedorTabla, Estado, Tarjeta, Vacio } from '@/components/ui';
import { crearLocalizacion } from '@/app/acciones-proyectos';
import {
  estadoDeSalaEnPortada,
  ETIQUETA_ESTADO_SALA,
  TONO_ESTADO_SALA,
  type GrupoLocalizacion,
} from '@/lib/proyecto';

/**
 * Las salas de la obra agrupadas por localización. Cada grupo es una tarjeta;
 * el estado de cada sala es el ligero de la portada (medidas + hitos), no el
 * semáforo completo, que se mira en su ficha.
 */
export function LocalizacionesDelProyecto({
  proyectoId,
  grupos,
  cerrado = false,
}: {
  proyectoId: string;
  grupos: GrupoLocalizacion[];
  /** Con la obra cerrada la estructura no se toca: sin alta de localización. */
  cerrado?: boolean;
}) {
  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <Tarjeta
          key={g.id}
          titulo={`${g.nombre} · ${g.salas.length} ${g.salas.length === 1 ? 'sala' : 'salas'}`}
        >
          {g.salas.length === 0 ? (
            <Vacio>Sin salas todavía. Se eligen en el alta de sala o se adoptan abajo.</Vacio>
          ) : (
            <ContenedorTabla etiqueta={g.nombre}>
            <table className="datos">
              <thead>
                <tr>
                  <th>Sala</th>
                  <th className="num">Medidas (m)</th>
                  <th className="num">Tiradas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {g.salas.map((s) => {
                  const estado = estadoDeSalaEnPortada(s);
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/salas/${s.id}`} className="enlace">
                          {s.nombre}
                        </Link>
                        {s.codigo && (
                          <span className="text-tinta-tenue"> · {s.codigo}</span>
                        )}
                      </td>
                      <td className="num">
                        {s.largo_m && s.ancho_m
                          ? `${s.largo_m} × ${s.ancho_m} × ${s.alto_m}`
                          : '—'}
                      </td>
                      <td className="num">{s.n_conexiones}</td>
                      <td>
                        <Estado tono={TONO_ESTADO_SALA[estado]}>
                          {ETIQUETA_ESTADO_SALA[estado]}
                        </Estado>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </ContenedorTabla>
          )}
        </Tarjeta>
      ))}

      {!cerrado && (
        <Tarjeta titulo="Nueva localización">
          <form action={crearLocalizacion} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="proyecto_id" value={proyectoId} />
            <Campo etiqueta="Nombre">
              <input name="nombre" required placeholder="Edificio B · Planta 3" className="w-64" />
            </Campo>
            <Boton variante="secundario">Añadir</Boton>
          </form>
        </Tarjeta>
      )}
    </div>
  );
}

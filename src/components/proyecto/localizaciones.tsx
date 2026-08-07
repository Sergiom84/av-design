import Link from 'next/link';
import { Boton, Campo, Tarjeta, Vacio } from '@/components/ui';
import { crearLocalizacion } from '@/app/acciones-proyectos';
import {
  estadoDeSalaEnPortada,
  ETIQUETA_ESTADO_SALA,
  type GrupoLocalizacion,
} from '@/lib/proyecto';

const CLASE_ESTADO: Record<string, string> = {
  sin_medidas: 'bg-alerta-suave text-alerta',
  en_diseno: 'bg-superficie-hundida text-tinta-tenue',
  instalada: 'bg-acento-suave text-acento-fuerte',
  entregada: 'bg-acento-suave text-exito',
};

/**
 * Las salas de la obra agrupadas por localización. Cada grupo es una tarjeta;
 * el estado de cada sala es el ligero de la portada (medidas + hitos), no el
 * semáforo completo, que se mira en su ficha.
 */
export function LocalizacionesDelProyecto({
  proyectoId,
  grupos,
}: {
  proyectoId: string;
  grupos: GrupoLocalizacion[];
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
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[0.75rem] ${CLASE_ESTADO[estado]}`}
                        >
                          {ETIQUETA_ESTADO_SALA[estado]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Tarjeta>
      ))}

      <Tarjeta titulo="Nueva localización">
        <form action={crearLocalizacion} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="proyecto_id" value={proyectoId} />
          <Campo etiqueta="Nombre">
            <input name="nombre" required placeholder="Edificio B · Planta 3" className="w-64" />
          </Campo>
          <Boton variante="secundario">Añadir</Boton>
        </form>
      </Tarjeta>
    </div>
  );
}

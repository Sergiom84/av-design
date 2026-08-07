import { ContenedorTabla, Tarjeta } from '@/components/ui';
import type { PlantillaSala } from '@/lib/tipos';

/**
 * En qué orden hay que rellenar las medidas.
 *
 * No todas las plantillas valen lo mismo: la primera responde a 144 salas
 * reales y la última a tres. Medir por orden de cobertura es la diferencia
 * entre tener la mitad del parque calculable esta tarde o dentro de un mes.
 */
export function PrioridadDePlantillas({ plantillas }: { plantillas: PlantillaSala[] }) {
  const salas = (lista: PlantillaSala[]) =>
    lista.reduce((s, p) => s + (p.n_salas_reales ?? 0), 0);

  const conMedidas = plantillas.filter((p) => p.largo_m != null);
  const total = salas(plantillas);
  const cubiertas = salas(conMedidas);
  const porcentaje = total > 0 ? Math.round((cubiertas / total) * 100) : 0;

  // Qué porcentaje del parque queda cubierto al llegar a cada fila. Con
  // dieciséis plantillas rehacer la suma en cada una no cuesta nada.
  const cobertura = plantillas.map((_, i) =>
    total > 0 ? Math.round((salas(plantillas.slice(0, i + 1)) / total) * 100) : 0,
  );

  return (
    <Tarjeta
      titulo="Por dónde empezar"
      pie={`Con medidas: ${conMedidas.length} de ${plantillas.length} plantillas, que cubren ${cubiertas} de las ${total} salas representadas (${porcentaje} %).`}
    >
      <ContenedorTabla etiqueta="Por dónde empezar">
      <table className="datos">
        <thead>
          <tr>
            <th className="num">Orden</th>
            <th>Plantilla</th>
            <th className="num">Salas reales</th>
            <th className="num">Acumulado</th>
            <th>Medidas</th>
          </tr>
        </thead>
        <tbody>
          {plantillas.map((p, i) => (
            <tr key={p.id}>
              <td className="num">{i + 1}</td>
              <td>
                <a
                  href={`#p-${p.id}`}
                  className="enlace"
                >
                  {p.nombre}
                </a>
              </td>
              <td className="num">{p.n_salas_reales ?? '—'}</td>
              <td className="num text-tinta-tenue">{cobertura[i]} %</td>
              <td>
                {p.largo_m == null ? (
                  <span className="text-alerta">sin medidas</span>
                ) : (
                  <span className="tabular-nums">
                    {p.largo_m} × {p.ancho_m} × {p.alto_m} m
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ContenedorTabla>
    </Tarjeta>
  );
}

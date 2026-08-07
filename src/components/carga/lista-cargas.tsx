import { ContenedorTabla, Enlace, Tarjeta, Vacio } from '@/components/ui';
import { ETIQUETA_CARGA } from '@/lib/tipos';
import type { CargaConResumen } from '@/lib/datos-almacen';

/** Las cargas: qué furgoneta está preparada, cuál ha salido y cuál se cerró. */
export function ListaCargas({
  cargas,
  titulo = 'Cargas',
}: {
  cargas: CargaConResumen[];
  titulo?: string;
}) {
  if (cargas.length === 0) {
    return (
      <Tarjeta titulo={titulo}>
        <Vacio>
          Sin cargas. Se generan desde una sala, con el material que ya está reservado.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo={titulo}>
      <ContenedorTabla etiqueta={titulo}>
      <table className="datos">
        <thead>
          <tr>
            <th>Carga</th>
            <th>Obra</th>
            <th>Estado</th>
            <th className="num">Marcadas</th>
          </tr>
        </thead>
        <tbody>
          {cargas.map((c) => (
            <tr key={c.id}>
              <td>
                <Enlace href={`/carga/${c.id}`}>{c.nombre}</Enlace>
              </td>
              <td className="text-tinta-tenue">{c.sala ?? '—'}</td>
              <td className={c.estado === 'cerrada' ? 'text-tinta-tenue' : undefined}>
                {ETIQUETA_CARGA[c.estado]}
              </td>
              <td className="num">
                {c.cargadas} / {c.lineas}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </ContenedorTabla>
    </Tarjeta>
  );
}

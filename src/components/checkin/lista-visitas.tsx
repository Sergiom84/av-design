import { Enlace, Tarjeta, Vacio } from '@/components/ui';
import type { RevisionConResumen } from '@/lib/datos-checkin';

/**
 * Las visitas de check-in: cuál está abierta, por dónde va y qué se encontró
 * mal. Las incidencias van en su columna porque son el resultado útil de haber
 * ido a la sala: una visita conforme entera no genera trabajo, una con dos
 * incidencias sí.
 */
export function ListaVisitas({
  revisiones,
  titulo = 'Visitas',
  vacio = 'Sin visitas. Se abre una eligiendo la sala, arriba.',
}: {
  revisiones: RevisionConResumen[];
  titulo?: string;
  vacio?: string;
}) {
  if (revisiones.length === 0) {
    return (
      <Tarjeta titulo={titulo}>
        <Vacio>{vacio}</Vacio>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo={titulo}>
      <table className="datos">
        <thead>
          <tr>
            <th>Visita</th>
            <th>Sala</th>
            <th>Estado</th>
            <th className="num">Mirados</th>
            <th className="num">Incidencias</th>
          </tr>
        </thead>
        <tbody>
          {revisiones.map((r) => (
            <tr key={r.id}>
              <td>
                <Enlace href={`/checkin/${r.id}`}>{r.nombre}</Enlace>
              </td>
              <td className="text-tinta-tenue">{r.sala ?? '—'}</td>
              <td className={r.cerrada ? 'text-tinta-tenue' : undefined}>
                {r.cerrada ? 'Cerrada' : r.resumen.completa ? 'Lista para cerrar' : 'Abierta'}
              </td>
              <td className="num">
                {r.resumen.total - r.resumen.pendientes} / {r.resumen.total}
              </td>
              <td className={`num ${r.resumen.incidencias > 0 ? 'text-alerta' : 'text-tinta-tenue'}`}>
                {r.resumen.incidencias}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}

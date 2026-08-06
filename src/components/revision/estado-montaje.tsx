import { Aviso, Tarjeta } from '@/components/ui';
import {
  ETIQUETA_SEMAFORO,
  resumirMontaje,
  type PuntoMontaje,
  type Semaforo,
} from '@/lib/revision';

/**
 * El semáforo de montaje de una sala. No se teclea: sale entero de
 * `revisarMontaje()`, que mira las medidas, el equipamiento, las conexiones,
 * el cable, el material y la carga que ya están en la base.
 *
 * Aquí no se decide nada. Este componente solo pinta lo que la lógica pura ha
 * decidido, que es lo mismo que hace la tabla de cables con los metros.
 */

const COLOR: Record<Semaforo, string> = {
  listo: 'text-acento',
  aviso: 'text-aviso',
  bloqueo: 'text-alerta',
  no_aplica: 'text-tinta-tenue',
};

export function EstadoMontaje({ puntos }: { puntos: PuntoMontaje[] }) {
  const resumen = resumirMontaje(puntos);

  return (
    <Tarjeta
      titulo="Revisión de montaje"
      pie="Derivado del diseño de la sala y del almacén. No se marca a mano."
    >
      <div className="mb-4">
        {resumen.estado === 'bloqueo' ? (
          <Aviso tono="alerta">
            La sala no se puede montar: {resumen.bloqueos}{' '}
            {resumen.bloqueos === 1 ? 'punto bloquea' : 'puntos bloquean'}.
          </Aviso>
        ) : resumen.estado === 'aviso' ? (
          <Aviso>
            Se puede montar con {resumen.avisos}{' '}
            {resumen.avisos === 1 ? 'aviso' : 'avisos'}. Ninguno impide salir a obra.
          </Aviso>
        ) : (
          <Aviso tono="neutro">
            {resumen.listos} {resumen.listos === 1 ? 'punto conforme' : 'puntos conformes'}.
            La sala está lista para montarse.
          </Aviso>
        )}
      </div>

      <table className="datos">
        <thead>
          <tr>
            <th>Punto</th>
            <th>Estado</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {puntos.map((p) => (
            <tr key={p.clave}>
              <td>{p.titulo}</td>
              <td className={COLOR[p.estado]}>{ETIQUETA_SEMAFORO[p.estado]}</td>
              <td className="text-tinta-tenue">{p.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}

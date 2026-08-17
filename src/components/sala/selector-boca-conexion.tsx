import { bocasDePuerto } from '@/lib/bocas-puerto';
import { ETIQUETA_SENTIDO, type Puerto } from '@/lib/tipos';

export function SelectorBocaConexion({
  conexionId,
  lado,
  puertos,
  puertoActual,
  ordinalActual,
}: {
  conexionId: string;
  lado: 'origen' | 'destino';
  puertos: Puerto[];
  puertoActual?: string | null;
  ordinalActual?: number | null;
}) {
  return (
    <select
      form={`conexion-${conexionId}`}
      name={`boca_${lado}`}
      defaultValue={puertoActual && ordinalActual ? `${puertoActual}:${ordinalActual}` : ''}
      disabled={puertos.length === 0}
      aria-label={`Puerto de ${lado}`}
      className="max-w-[11rem]"
    >
      <option value="">{puertos.length === 0 ? '— sin puertos —' : '—'}</option>
      {puertos.flatMap((puerto) =>
        bocasDePuerto(puerto, '').map((boca) => (
          <option key={`${puerto.id}:${boca.ordinal}`} value={`${puerto.id}:${boca.ordinal}`}>
            {boca.etiqueta} · {ETIQUETA_SENTIDO[puerto.sentido]}
          </option>
        )),
      )}
    </select>
  );
}

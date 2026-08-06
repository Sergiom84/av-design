import { construirEscena, type EntradaCroquis } from '@/lib/croquis';
import { Aviso, Tarjeta } from '@/components/ui';
import { PlanoSala } from './plano-sala';

/**
 * El croquis dentro de la ficha de sala: el plano, lo que falta por medir y las
 * alturas al pie, que en una planta no se ven.
 *
 * Es un bloque más de la ficha, como la tabla de cables o la lista de material.
 * No sabe consultar nada: recibe la sala ya cargada y construye la escena.
 */
export function CroquisSala(entrada: EntradaCroquis) {
  const escena = construirEscena(entrada);
  const sinDibujo = !escena.sala.largo_m || !escena.sala.ancho_m;

  return (
    <Tarjeta
      titulo="Croquis"
      pie={escena.anotaciones.length > 0 ? escena.anotaciones.join(' · ') : undefined}
    >
      {escena.avisos.length > 0 && (
        <div className="mb-4 space-y-2">
          {escena.avisos.map((a) => (
            <Aviso key={a} tono={sinDibujo ? 'alerta' : 'neutro'}>
              {a}
            </Aviso>
          ))}
        </div>
      )}

      {!sinDibujo && <PlanoSala escena={escena} />}
    </Tarjeta>
  );
}

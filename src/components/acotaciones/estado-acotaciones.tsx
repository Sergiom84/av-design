import { Aviso, ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import type { EscenaAcotaciones } from '@/lib/acotaciones';
import { ElevacionSalaSvg } from './elevacion-sala';

/**
 * Lo que enseña `Acotaciones` mientras no hay vistas que enseñar.
 *
 * La pestaña existe desde ya para que la navegación deje de cambiar debajo de
 * los pies del departamento, pero no ofrece edición ficticia: un control que
 * no guarda nada es peor que la ausencia del control, porque quien lo usa cree
 * haber medido.
 *
 * Cuando llegue, no será un dibujo aparte. Las elevaciones se proyectarán
 * desde las mismas `x_m`/`y_m`/`z_m` que edita `Plano`, igual que el croquis
 * de Resumen: mover un altavoz en una elevación moverá el altavoz de la sala,
 * no una copia suya.
 */
export function EstadoAcotaciones({ salaId, escena }: { salaId: string; escena: EscenaAcotaciones }) {
  if (escena.sinMedidas) {
    return (
      <Tarjeta titulo="Acotaciones">
        <Vacio accion={{ texto: 'Medir en Plano', href: `/salas/${salaId}/plano` }}>
          Mide largo, ancho y alto para generar las elevaciones.
        </Vacio>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      {(escena.equiposSinPosicion > 0 || escena.tomasSinPosicion > 0) && (
        <Aviso tono="aviso">
          No se acotan datos estimados: {escena.equiposSinPosicion} equipos y {escena.tomasSinPosicion} tomas siguen sin posición medida.
        </Aviso>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        {escena.elevaciones.map((vista) => (
          <Tarjeta key={vista.pared} titulo={vista.titulo} pie="Las cotas salen de las coordenadas guardadas en Plano.">
            <ContenedorTabla etiqueta={`Elevación ${vista.titulo}`}>
              <ElevacionSalaSvg vista={vista} />
            </ContenedorTabla>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}

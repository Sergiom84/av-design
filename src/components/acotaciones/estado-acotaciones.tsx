import { Tarjeta, Vacio } from '@/components/ui';

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
export function EstadoAcotaciones({ salaId }: { salaId: string }) {
  return (
    <Tarjeta titulo="Acotaciones">
      <Vacio accion={{ texto: 'Ir a Plano', href: `/salas/${salaId}/plano` }}>
        Las vistas frontal, trasera y laterales con sus cotas de instalación
        todavía no están disponibles. Se proyectarán desde las posiciones que se
        editan en Plano, no desde un segundo dibujo.
      </Vacio>
    </Tarjeta>
  );
}

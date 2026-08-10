'use client';

import { Aviso, Boton, Campo, Vacio } from '@/components/ui';
import {
  colocarEnElCentro,
  editarMueble,
  estadoDelMueble,
  girar,
  quitarAlta,
  type BorradorPlano,
} from '@/lib/plano-editor';
import { CampoMetros } from './campos-plano';
import { ControlRotacion } from './control-rotacion';

/**
 * Un mueble de la sala: nombre, medidas, sitio y giro.
 *
 * Las medidas se piden antes que el sitio, y no al revés, porque un mueble sin
 * largo y ancho no se puede dar por colocado: el plano dibujaría un rectángulo
 * de tamaño inventado justo donde se va a medir el hueco.
 *
 * `Colocar en el centro` es la alternativa al arrastre, no un adorno: con
 * teclado o con el móvil en una mano se selecciona en la lista, se coloca en
 * el centro y desde ahí se ajusta con las flechas o escribiendo el número.
 */
export function InspectorMueble({
  borrador,
  id,
  alCambiar,
  alQuitar,
  soloLectura,
}: {
  borrador: BorradorPlano;
  id: string;
  alCambiar: (b: BorradorPlano) => void;
  /** Quitar cambia la selección, y eso lo decide el editor. */
  alQuitar: () => void;
  soloLectura: boolean;
}) {
  const m = borrador.mobiliario.find((x) => x.id === id);
  if (!m) return <Vacio>Ese mueble ya no está en el plano.</Vacio>;

  const estado = estadoDelMueble(m);

  return (
    <div className="space-y-3">
      <Campo etiqueta="Nombre">
        <input
          type="text"
          value={m.nombre}
          disabled={soloLectura}
          onChange={(ev) => alCambiar(editarMueble(borrador, id, { nombre: ev.target.value }))}
        />
      </Campo>

      {estado === 'sin_medir' && (
        <Aviso tono="aviso">
          Sin largo y ancho no se puede dar por colocado: el plano dibujaría un tamaño
          inventado.
        </Aviso>
      )}

      <CampoMetros
        etiqueta="Largo"
        valor={m.largo_m}
        alCambiar={(n) => alCambiar(editarMueble(borrador, id, { largo_m: n }))}
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Ancho"
        valor={m.ancho_m}
        alCambiar={(n) => alCambiar(editarMueble(borrador, id, { ancho_m: n }))}
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Alto"
        valor={m.alto_m}
        alCambiar={(n) => alCambiar(editarMueble(borrador, id, { alto_m: n }))}
        ayuda="No entra en el cálculo de cable; sirve para saber qué tapa qué."
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />

      <CampoMetros
        etiqueta="X"
        valor={m.x_m}
        alCambiar={(n) => alCambiar(editarMueble(borrador, id, { x_m: n }))}
        ayuda="Vaciarlo lo devuelve a «Por colocar» sin borrarlo."
        admiteVacio
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Y"
        valor={m.y_m}
        alCambiar={(n) => alCambiar(editarMueble(borrador, id, { y_m: n }))}
        admiteVacio
        deshabilitado={soloLectura}
      />
      <CampoMetros
        etiqueta="Z"
        valor={m.z_m}
        alCambiar={(n) => alCambiar(editarMueble(borrador, id, { z_m: n }))}
        admiteVacio
        minimo={0}
        deshabilitado={soloLectura}
      />

      <ControlRotacion
        grados={m.rotacion_grados}
        deshabilitado={soloLectura}
        alGirar={(g) => alCambiar(girar(borrador, { tipo: 'mueble', id }, g))}
        ayuda="Gira sobre su punto. No cambia X, Y ni Z."
      />

      {!soloLectura && (
        <div className="flex flex-wrap gap-2">
          <Boton
            tipo="button"
            onClick={() => alCambiar(colocarEnElCentro(borrador, { tipo: 'mueble', id }))}
            disabled={estado === 'sin_medir'}
          >
            Colocar en el centro
          </Boton>
          {/* Un mueble no es extremo de ninguna tirada: quitarlo no deja
              conexiones colgando, y por eso sí se puede quitar desde el plano
              y un equipo persistido no. */}
          <Boton
            tipo="button"
            onClick={() => {
              alCambiar(quitarAlta(borrador, { tipo: 'mueble', id }));
              alQuitar();
            }}
          >
            Quitar del plano
          </Boton>
        </div>
      )}
    </div>
  );
}

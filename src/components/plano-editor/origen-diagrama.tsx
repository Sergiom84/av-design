'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso, Boton, Tarjeta } from '@/components/ui';
import { ComboboxRemoto, type OpcionCombobox } from '@/components/catalogo/combobox-remoto';
import {
  aplicarPlantillaAlDiagrama,
  iniciarDiagramaDesdeCero,
} from '@/app/acciones-diagrama';
import { leerRespuesta } from '@/lib/combobox';
import type { PlantillaElegible } from '@/lib/datos';

type OpcionPlantilla = OpcionCombobox & { plantilla: PlantillaElegible };

const medidasDe = (p: PlantillaElegible): string => {
  if (p.largo_m == null || p.ancho_m == null) return 'Sin medidas';
  const n = (v: number | null) => (v == null ? '?' : v.toFixed(2).replace('.', ','));
  return `${n(p.largo_m)} × ${n(p.ancho_m)} × ${n(p.alto_m)} m`;
};

/**
 * De dónde sale el plano de esta sala.
 *
 * Se pregunta UNA vez, la primera. Después `salas.diagrama_iniciado_en` deja
 * constancia y la pestaña abre el editor directamente: preguntarlo en cada
 * visita sería un peaje diario para las 390 salas del inventario.
 *
 * Las dos opciones no son simétricas y no se pintan como si lo fueran:
 *
 * - `Desde cero` no borra nada. La sala conserva lo que tenga y el técnico
 *   completa a mano el mobiliario y el equipamiento que falten.
 * - `Plantilla` copia medidas, mesa, mobiliario, equipos, giros y tiradas,
 *   pero solo si la sala está vacía. Si ya tiene equipos o tiradas de otra
 *   plantilla, el servidor lo rechaza y aquí se explica por qué: un «merge»
 *   sería adivinar a qué equipo corresponde cada línea, y equivocarse borra
 *   trabajo medido.
 */
export function OrigenDiagrama({
  salaId,
  version,
  cerrado,
}: {
  salaId: string;
  version: number;
  cerrado: boolean;
}) {
  const router = useRouter();
  const [enCurso, empezar] = useTransition();
  const [elegida, setElegida] = useState<PlantillaElegible | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  /**
   * El listado de plantillas no contestó.
   *
   * Vive aquí y no solo dentro del combobox porque la decisión que hay encima
   * no es de un desplegable: `Desde cero` se escribe en
   * `salas.diagrama_iniciado_en` y no se vuelve a preguntar. Un 500 convertido
   * en «sin plantillas» acababa siendo una decisión permanente que nadie tomó.
   */
  const [sinListado, setSinListado] = useState(false);

  const buscar = useCallback(
    async (consulta: string, signal: AbortSignal): Promise<OpcionPlantilla[]> => {
      try {
        const respuesta = await fetch(
          `/api/plantillas?${new URLSearchParams({ q: consulta })}`,
          { signal },
        );
        // `leerRespuesta` y no `respuesta.ok ? … : []`: ese `: []` era el fallo.
        // Un 404 o un 500 salían por la misma puerta que «no hay ninguna».
        const lista = await leerRespuesta<PlantillaElegible>(respuesta);
        setSinListado(false);
        return lista.map((p) => ({
          id: p.id,
          etiqueta: p.nombre,
          detalle: `${p.tipologia} · ${medidasDe(p)}`,
          plantilla: p,
        }));
      } catch (fallo) {
        // La cancelación no es una caída: es la tecla siguiente.
        if (!signal.aborted) setSinListado(true);
        throw fallo;
      }
    },
    [],
  );

  const desdeCero = () => {
    setProblema(null);
    empezar(async () => {
      const r = await iniciarDiagramaDesdeCero(salaId, version);
      if (r.ok) return router.refresh();
      setProblema(r.detalle);
    });
  };

  const aplicar = () => {
    if (!elegida) return;
    setProblema(null);
    empezar(async () => {
      const r = await aplicarPlantillaAlDiagrama(salaId, elegida.id, version);
      if (r.ok) return router.refresh();
      setProblema(r.detalle);
    });
  };

  if (cerrado) {
    return (
      <Tarjeta titulo="El plano todavía no está empezado">
        <p className="text-tinta-tenue">
          La obra está cerrada: el plano se consulta, no se prepara. Para empezarlo hay
          que reabrir la obra.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="¿De dónde sale el plano?">
      <p className="mb-4 text-tinta-tenue">
        Se pregunta una sola vez. Después esta pestaña abre el editor directamente.
      </p>

      {problema && (
        <div className="mb-4">
          <Aviso tono="alerta">{problema}</Aviso>
        </div>
      )}

      {/* Que no se hayan podido listar las plantillas no es que no las haya, y
          esta pregunta se contesta una sola vez. Mientras dure la caída,
          `Desde cero` deja de pintarse como la opción principal: sigue estando,
          pero ya no es la única que parece posible. */}
      {sinListado && (
        <div className="mb-4">
          <Aviso tono="alerta">
            No se han podido consultar las plantillas. No es que no haya ninguna:
            reinténtalo en el buscador antes de decidir.
          </Aviso>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 items-start">
        <section className="border border-linea rounded-md p-4">
          <h3 className="t-subtitulo mb-2">Desde cero</h3>
          <p className="mb-4 text-tinta-tenue">
            No se borra nada: la sala conserva sus medidas, sus equipos y sus tiradas.
            El mobiliario y el equipamiento que falten se añaden a mano en el editor.
          </p>
          <Boton
            tipo="button"
            variante={sinListado ? 'secundario' : 'principal'}
            onClick={desdeCero}
            disabled={enCurso}
          >
            Empezar desde cero
          </Boton>
        </section>

        <section className="border border-linea rounded-md p-4">
          <h3 className="t-subtitulo mb-2">Desde una plantilla</h3>
          <p className="mb-4 text-tinta-tenue">
            Copia medidas, mesa, mobiliario, equipos, giros y tiradas de la tipología.
          </p>

          <ComboboxRemoto
            etiqueta="Buscar plantilla"
            marcador="Nombre o tipología"
            className="w-full"
            buscar={buscar}
            etiquetaLista="Plantillas de sala"
            nombreColeccion={['plantilla', 'plantillas']}
            vacio="Sin plantillas que coincidan"
            mensajeInvalido="Elige una plantilla de la lista."
            alElegir={(o) => setElegida(o ? (o as OpcionPlantilla).plantilla : null)}
          />

          {elegida && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-tinta-tenue">Tipología</dt>
              <dd>{elegida.tipologia}</dd>
              <dt className="text-tinta-tenue">Medidas</dt>
              <dd>{medidasDe(elegida)}</dd>
              <dt className="text-tinta-tenue">Muebles</dt>
              <dd>{elegida.muebles}</dd>
              <dt className="text-tinta-tenue">Equipamiento</dt>
              <dd>{elegida.lineas} líneas</dd>
              <dt className="text-tinta-tenue">Tiradas</dt>
              <dd>{elegida.conexiones}</dd>
            </dl>
          )}

          <div className="mt-4">
            <Boton
              tipo="button"
              variante="principal"
              onClick={aplicar}
              disabled={!elegida || enCurso}
            >
              Aplicar plantilla
            </Boton>
          </div>
        </section>
      </div>
    </Tarjeta>
  );
}

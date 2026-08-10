'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { construirEscena, proyectar } from '@/lib/croquis';
import {
  acercar,
  afectaAlCalculo,
  avisosDelBorrador,
  aplicarIdsReales,
  borradorDesde,
  confirmarEstimadas,
  construirPatch,
  desplazamientoDeTecla,
  desplazarEquipo,
  desplazarMesa,
  desplazarToma,
  desplazarVista,
  PASO_REJILLA_M,
  entradaCroquisDe,
  hayCambios as tieneCambios,
  moverEquipo,
  moverMesa,
  moverToma,
  vistaCompleta,
  zoomDe,
  type BorradorPlano,
  type Seleccion,
  type Vista,
} from '@/lib/plano-editor';
import type { Conexion, EquipoEnSala, MuebleEnSala, Sala, TomaRed } from '@/lib/tipos';
import { guardarDiagramaSala } from '@/app/acciones-diagrama';
import { Aviso, Boton, Tarjeta } from '@/components/ui';
import { BarraHerramientas, type Herramienta } from './barra-herramientas';
import { ANCHO_BASE_PX, LienzoPlano, type PuntoMetros } from './lienzo-plano';
import { ListaObjetos } from './lista-objetos';
import { InspectorSala } from './inspector-sala';
import { InspectorMesa } from './inspector-mesa';
import { InspectorEquipo } from './inspector-equipo';
import { InspectorToma } from './inspector-toma';
import { PanelMovil } from './panel-movil';
import type { EstadoGuardado } from './estado-guardado';

/**
 * El editor del plano de una sala.
 *
 * Mantiene un borrador local y no escribe en cada píxel del arrastre: se
 * arrastra, se ve el resultado, y `Guardar cambios` manda una sola operación
 * atómica con la versión que se leyó. Si otra pestaña guardó por medio, el
 * servidor lo rechaza y aquí se ofrece recargar o conservar el borrador para
 * compararlo — nunca se sobrescribe en silencio.
 *
 * Deshacer y rehacer son dos pilas de referencias al borrador, que es
 * inmutable (`src/lib/plano-editor.ts`): un paso atrás no cuesta una copia.
 */
export function EditorPlanoSala({
  sala,
  equipos,
  conexiones,
  tomas,
  muebles,
  cerrado,
}: {
  sala: Sala;
  equipos: EquipoEnSala[];
  conexiones: Conexion[];
  tomas: TomaRed[];
  muebles: MuebleEnSala[];
  cerrado: boolean;
}) {
  const router = useRouter();
  const [guardando, empezarGuardado] = useTransition();

  const desdeServidor = useMemo(
    () => borradorDesde(sala, equipos, tomas, muebles),
    [sala, equipos, tomas, muebles],
  );

  const [original, setOriginal] = useState(desdeServidor);
  const [version, setVersion] = useState(sala.diagrama_version);
  const [borrador, setBorradorBruto] = useState(desdeServidor);
  const [pasado, setPasado] = useState<BorradorPlano[]>([]);
  const [futuro, setFuturo] = useState<BorradorPlano[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [herramienta, setHerramienta] = useState<Herramienta>('seleccionar');
  const [rejilla, setRejilla] = useState(true);
  const [ajuste, setAjuste] = useState(true);
  const [vista, setVista] = useState<Vista | null>(null);
  const [estado, setEstado] = useState<EstadoGuardado>('limpio');
  const [problema, setProblema] = useState<string | null>(null);

  // Un arrastre son decenas de movimientos: entran como un solo paso en el
  // historial, no como cuarenta. Se apila el borrador de antes de agarrar.
  const arrastrando = useRef(false);

  const soloLectura = cerrado;

  // Si la sala cambia en el servidor —recarga, o la revalidación que dispara
  // el propio guardado— y no hay nada a medio escribir, el editor adopta lo
  // nuevo. Se ajusta durante el render y no en un efecto: un efecto que llama
  // a `setState` provoca un segundo render y React 19 lo desaconseja de
  // manera explícita. El estado de guardado no se toca aquí, para que el
  // «Guardado» siga viéndose después de refrescar.
  const [versionVista, setVersionVista] = useState(sala.diagrama_version);
  if (versionVista !== sala.diagrama_version && estado !== 'sucio' && estado !== 'conflicto') {
    setVersionVista(sala.diagrama_version);
    setOriginal(desdeServidor);
    setBorradorBruto(desdeServidor);
    setVersion(sala.diagrama_version);
    setPasado([]);
    setFuturo([]);
  }

  const patch = useMemo(
    () => construirPatch(sala.id, version, original, borrador),
    [sala.id, version, original, borrador],
  );
  const hayCambios = tieneCambios(patch);

  const aplicar = useCallback(
    (siguiente: BorradorPlano, { agrupar = false }: { agrupar?: boolean } = {}) => {
      if (siguiente === borrador) return;
      if (!agrupar) setPasado((p) => [...p.slice(-49), borrador]);
      setFuturo([]);
      setBorradorBruto(siguiente);
      setEstado((e) => (e === 'conflicto' ? e : 'sucio'));
    },
    [borrador],
  );

  const escena = useMemo(
    () => construirEscena(entradaCroquisDe(borrador, sala, conexiones)),
    [borrador, sala, conexiones],
  );

  const proyeccion = useMemo(
    () => proyectar(escena, { ancho_px: ANCHO_BASE_PX }),
    [escena],
  );

  const vistaEfectiva = vista ?? vistaCompleta(proyeccion.ancho_px, proyeccion.alto_px);
  const zoom = zoomDe(vistaEfectiva, proyeccion.ancho_px);

  const encajar = useCallback(() => setVista(null), []);

  // ---------------------------------------------------------------- arrastre

  const arrastrar = useCallback(
    (objetivo: Exclude<Seleccion, null>, punto: PuntoMetros) => {
      if (soloLectura) return;
      const agrupar = arrastrando.current;
      arrastrando.current = true;
      const opciones = { ajustar: ajuste };
      if (objetivo.tipo === 'equipo') {
        aplicar(moverEquipo(borrador, objetivo.id, punto, opciones), { agrupar });
      } else if (objetivo.tipo === 'toma') {
        aplicar(moverToma(borrador, objetivo.id, punto, opciones), { agrupar });
      } else if (objetivo.tipo === 'mesa') {
        aplicar(moverMesa(borrador, punto, opciones), { agrupar });
      }
    },
    [aplicar, ajuste, borrador, soloLectura],
  );

  const soltar = useCallback(() => {
    arrastrando.current = false;
  }, []);

  // ---------------------------------------------------------------- teclado

  const alPulsarTecla = (ev: React.KeyboardEvent) => {
    const destino = ev.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(destino.tagName)) return;

    if (ev.key === 'Escape') {
      setSeleccion(null);
      return;
    }

    const paso = desplazamientoDeTecla(ev.key, ev.shiftKey);
    if (!paso || !seleccion || soloLectura) return;
    ev.preventDefault();

    // Con Mayúsculas el paso es fino y el ajuste a rejilla estorbaría: se
    // pulsa Mayúsculas justo para salirse de la rejilla.
    const opciones = { ajustar: ajuste && !ev.shiftKey, paso: PASO_REJILLA_M };
    if (seleccion.tipo === 'equipo') {
      aplicar(desplazarEquipo(borrador, seleccion.id, paso, opciones));
    } else if (seleccion.tipo === 'toma') {
      aplicar(desplazarToma(borrador, seleccion.id, paso, opciones));
    } else if (seleccion.tipo === 'mesa') {
      aplicar(desplazarMesa(borrador, paso, opciones));
    }
  };

  // ---------------------------------------------------------------- guardado

  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);

  const guardar = () => {
    setProblema(null);
    setEstado('guardando');
    empezarGuardado(async () => {
      const r = await guardarDiagramaSala(patch);
      if (r.ok) {
        // El id temporal de un alta ya no vale: se cambia por el que puso
        // Postgres, o el siguiente guardado la daría de alta otra vez.
        const guardado = aplicarIdsReales(borrador, r.ids);
        setBorradorBruto(guardado);
        setOriginal(guardado);
        setVersion(r.version);
        setPasado([]);
        setFuturo([]);
        setEstado('guardado');
        // El plano cambia los metros y el material: se refresca la ficha para
        // que Resumen y Cableado no se queden con lo de antes.
        router.refresh();
        return;
      }
      setProblema(r.detalle);
      setEstado(r.motivo === 'conflicto' ? 'conflicto' : 'error');
    });
  };

  const descartar = () => {
    setPasado([]);
    setFuturo([]);
    setBorradorBruto(original);
    setEstado('limpio');
    setProblema(null);
  };

  const deshacer = () => {
    setPasado((p) => {
      if (p.length === 0) return p;
      const anterior = p[p.length - 1];
      setFuturo((f) => [borrador, ...f]);
      setBorradorBruto(anterior);
      setEstado((e) => (e === 'conflicto' ? e : 'sucio'));
      return p.slice(0, -1);
    });
  };

  const rehacer = () => {
    setFuturo((f) => {
      if (f.length === 0) return f;
      setPasado((p) => [...p, borrador]);
      setBorradorBruto(f[0]);
      setEstado((e) => (e === 'conflicto' ? e : 'sucio'));
      return f.slice(1);
    });
  };

  // ---------------------------------------------------------------- pintado

  const avisos = avisosDelBorrador(borrador);
  const sinMedidas = !borrador.largo_m || !borrador.ancho_m;
  const estimados = borrador.equipos.filter((e) => !e.posicion_confirmada);
  const posicionesDibujadas = useMemo(
    () => new Map(escena.equipos.map((e) => [e.id, { x_m: e.x_m, y_m: e.y_m, z_m: e.z_m }])),
    [escena],
  );

  const inspector = (
    <>
      {seleccion === null || seleccion.tipo === 'sala' ? (
        <InspectorSala borrador={borrador} alCambiar={aplicar} soloLectura={soloLectura} />
      ) : seleccion.tipo === 'mesa' ? (
        <InspectorMesa borrador={borrador} alCambiar={aplicar} soloLectura={soloLectura} />
      ) : seleccion.tipo === 'equipo' ? (
        (() => {
          const e = borrador.equipos.find((x) => x.id === seleccion.id);
          return e ? (
            <InspectorEquipo
              equipo={e}
              borrador={borrador}
              posicionDibujada={posicionesDibujadas.get(e.id) ?? null}
              alCambiar={aplicar}
              soloLectura={soloLectura}
            />
          ) : null;
        })()
      ) : (
        (() => {
          const t = borrador.tomas.find((x) => x.id === seleccion.id);
          return t ? (
            <InspectorToma
              toma={t}
              borrador={borrador}
              alCambiar={aplicar}
              soloLectura={soloLectura}
            />
          ) : null;
        })()
      )}
    </>
  );

  const resumenSeleccion =
    seleccion === null || seleccion.tipo === 'sala'
      ? 'Medidas de la sala'
      : seleccion.tipo === 'mesa'
        ? 'Mesa'
        : seleccion.tipo === 'equipo'
          ? (borrador.equipos.find((x) => x.id === seleccion.id)?.nombre ?? 'Equipo')
          : `Toma ${borrador.tomas.find((x) => x.id === seleccion.id)?.codigo ?? ''}`;

  return (
    // `onKeyDown` en el contenedor y no en el SVG: el foco vive en la lista de
    // objetos y en el inspector, que son controles de verdad.
    <div className="space-y-4" onKeyDown={alPulsarTecla}>
      {soloLectura && (
        <Aviso tono="neutro">
          La obra está cerrada: el plano se ve pero no se toca. Para corregir algo se
          reabre la obra borrando el cierre desde su portada.
        </Aviso>
      )}

      {estado === 'conflicto' && (
        <Aviso tono="alerta">
          <p>{problema}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Boton
              tipo="button"
              variante="principal"
              onClick={() => {
                setEstado('limpio');
                setProblema(null);
                router.refresh();
              }}
            >
              Recargar y perder mis cambios
            </Boton>
            <Boton
              tipo="button"
              onClick={() => {
                setEstado('sucio');
                setProblema(
                  'Se conserva tu borrador. Guardar volverá a fallar hasta que recargues: abre la sala en otra pestaña para comparar.',
                );
              }}
            >
              Conservar mi borrador para comparar
            </Boton>
          </div>
        </Aviso>
      )}

      {estado === 'error' && problema && <Aviso tono="alerta">{problema}</Aviso>}

      {sinMedidas ? (
        <Tarjeta titulo="Define la sala">
          <p className="mb-4 text-tinta-tenue">
            Sin el largo y el ancho no hay plano a escala. Un lienzo con medidas
            inventadas engaña más que una casilla vacía.
          </p>
          <div className="max-w-sm">
            <InspectorSala borrador={borrador} alCambiar={aplicar} soloLectura={soloLectura} />
          </div>
          {!soloLectura && (
            <div className="mt-4">
              <Boton tipo="button" variante="principal" onClick={guardar} disabled={!hayCambios || guardando}>
                Guardar cambios
              </Boton>
            </div>
          )}
        </Tarjeta>
      ) : (
        <section className="tarjeta">
          <BarraHerramientas
            herramienta={herramienta}
            alCambiarHerramienta={setHerramienta}
            zoom={zoom}
            alAcercar={() =>
              setVista(acercar(vistaEfectiva, 1.5, { ancho_px: proyeccion.ancho_px, alto_px: proyeccion.alto_px }))
            }
            alAlejar={() =>
              setVista(acercar(vistaEfectiva, 1 / 1.5, { ancho_px: proyeccion.ancho_px, alto_px: proyeccion.alto_px }))
            }
            alEncajar={encajar}
            rejilla={rejilla}
            alCambiarRejilla={setRejilla}
            ajuste={ajuste}
            alCambiarAjuste={setAjuste}
            puedeDeshacer={pasado.length > 0}
            puedeRehacer={futuro.length > 0}
            alDeshacer={deshacer}
            alRehacer={rehacer}
            hayCambios={hayCambios}
            guardando={guardando}
            alDescartar={descartar}
            alGuardar={guardar}
            estado={estado}
            soloLectura={soloLectura}
          />

          <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
            <div className="min-w-0 p-4 border-b lg:border-b-0 lg:border-r border-linea-suave">
              <LienzoPlano
                escena={escena}
                vista={vistaEfectiva}
                seleccion={seleccion}
                herramienta={herramienta}
                rejilla={rejilla}
                soloLectura={soloLectura}
                alSeleccionar={setSeleccion}
                alArrastrar={arrastrar}
                alSoltar={soltar}
                alDesplazarVista={(dx, dy) => setVista(desplazarVista(vistaEfectiva, dx, dy))}
              />

              {avisos.length > 0 && (
                <div className="mt-4 space-y-2">
                  {avisos.map((a) => (
                    <Aviso key={a} tono="neutro">
                      {a}
                    </Aviso>
                  ))}
                  {!soloLectura && estimados.length > 0 && (
                    <Boton
                      tipo="button"
                      onClick={() => aplicar(confirmarEstimadas(borrador, posicionesDibujadas))}
                    >
                      Confirmar posiciones estimadas
                    </Boton>
                  )}
                </div>
              )}

              {hayCambios && afectaAlCalculo(original, borrador) && (
                <div className="mt-4">
                  <Aviso tono="aviso">
                    Mover un equipo cambia los metros de cable y la lista de material, no
                    solo el dibujo.
                  </Aviso>
                </div>
              )}
            </div>

            {/* Escritorio: lista e inspector en columna. Móvil: panel inferior. */}
            <div className="hidden lg:flex lg:flex-col min-w-0 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <ListaObjetos
                borrador={borrador}
                seleccion={seleccion}
                alSeleccionar={setSeleccion}
              />
              <div className="p-4 border-t border-linea">{inspector}</div>
            </div>
          </div>

          <PanelMovil resumen={resumenSeleccion}>
            <div className="pt-2">
              <ListaObjetos
                borrador={borrador}
                seleccion={seleccion}
                alSeleccionar={setSeleccion}
              />
              <div className="pt-4">{inspector}</div>
            </div>
          </PanelMovil>
        </section>
      )}

      {/* El incremento exacto se dice, no se deja adivinar: es lo que
          convierte las flechas en una alternativa real al arrastre. */}
      {!soloLectura && !sinMedidas && (
        <p className="text-tinta-tenue text-[0.75rem]">
          Con un objeto seleccionado, las flechas lo mueven 0,10 m; con Mayúsculas,
          0,01 m. Escape quita la selección.
        </p>
      )}
    </div>
  );
}

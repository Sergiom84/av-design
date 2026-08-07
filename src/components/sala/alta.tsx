'use client';

import { useState } from 'react';
import { crearSala } from '@/app/acciones';
import { Aviso, Boton, Campo, ContenedorTabla, ListaClaveValor, Tarjeta } from '@/components/ui';
import { MAXIMO_COPIAS, resumirSerie, serieDeNombres } from '@/lib/nombres-serie';
import {
  ETIQUETA_RUTA,
  type LineaPlantilla,
  type PlantillaSala,
  type Ruta,
} from '@/lib/tipos';
import type { ProyectoConLocalizaciones } from '@/lib/datos-proyectos';

export type PlantillaConEquipamiento = PlantillaSala & { lineas: LineaPlantilla[] };

/** Lo que la sala hereda de la plantilla, más lo que se corrige a mano. */
interface Borrador {
  tipologia: string;
  aforo: string;
  largo_m: string;
  ancho_m: string;
  alto_m: string;
  alto_falso_techo_m: string;
  mesa_largo_m: string;
  mesa_ancho_m: string;
  mesa_alto_cm: string;
  ruta_por_defecto: Ruta;
}

const VACIO: Borrador = {
  tipologia: '',
  aforo: '',
  largo_m: '',
  ancho_m: '',
  alto_m: '',
  alto_falso_techo_m: '',
  mesa_largo_m: '',
  mesa_ancho_m: '',
  mesa_alto_cm: '',
  ruta_por_defecto: 'falso_techo',
};

const cifra = (v: number | null): string => (v == null ? '' : String(v));

function desdePlantilla(p: PlantillaConEquipamiento): Borrador {
  return {
    tipologia: p.tipologia,
    aforo: cifra(p.aforo),
    largo_m: cifra(p.largo_m),
    ancho_m: cifra(p.ancho_m),
    alto_m: cifra(p.alto_m),
    alto_falso_techo_m: cifra(p.alto_falso_techo_m),
    mesa_largo_m: cifra(p.mesa_largo_m),
    mesa_ancho_m: cifra(p.mesa_ancho_m),
    mesa_alto_cm: cifra(p.mesa_alto_cm),
    ruta_por_defecto: p.ruta_por_defecto,
  };
}

/**
 * Alta de sala: desde plantilla o en blanco, y de una en una o de N en N.
 *
 * Es el flujo de XTEN-AV con lo que a ellos les falta (docs/06, apartados 2, 4
 * y 7): las medidas se piden **siempre**. La plantilla las propone y aquí
 * vienen rellenas para corregirlas, pero si la plantilla no las trae el aviso
 * es inequívoco. No bloquea el alta: una sala sin medir se crea igual y se
 * completa luego, porque lo que no puede pasar es que no se dé de alta.
 */
/**
 * Con una sola localización —la "Sin asignar" del nacimiento— se elige sola;
 * con varias, se preselecciona "Sin asignar" y se corrige a mano.
 */
function localizacionPorDefecto(p: ProyectoConLocalizaciones | undefined): string {
  if (!p) return '';
  if (p.localizaciones.length === 1) return p.localizaciones[0].id;
  return p.localizaciones.find((l) => l.nombre === 'Sin asignar')?.id ?? '';
}

export function AltaDeSala({
  plantillas,
  sedes,
  proyectos,
  plantillaInicial,
  proyectoInicial,
}: {
  plantillas: PlantillaConEquipamiento[];
  sedes: string[];
  proyectos: ProyectoConLocalizaciones[];
  plantillaInicial?: string;
  /** Viniendo de la portada de una obra (`?proyecto=`), llega preseleccionada. */
  proyectoInicial?: string;
}) {
  const inicial = plantillas.find((p) => p.id === plantillaInicial);
  const proyectoDePartida = proyectos.find((p) => p.id === proyectoInicial);

  const [plantillaId, setPlantillaId] = useState(inicial?.id ?? '');
  const [borrador, setBorrador] = useState<Borrador>(
    inicial ? desdePlantilla(inicial) : VACIO,
  );
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [copias, setCopias] = useState(1);
  const [proyectoId, setProyectoId] = useState(proyectoDePartida?.id ?? '');
  const [localizacionId, setLocalizacionId] = useState(
    localizacionPorDefecto(proyectoDePartida),
  );

  const proyecto = proyectos.find((p) => p.id === proyectoId);

  const cambiarProyecto = (id: string) => {
    setProyectoId(id);
    setLocalizacionId(localizacionPorDefecto(proyectos.find((x) => x.id === id)));
  };

  const plantilla = plantillas.find((p) => p.id === plantillaId);
  const heredadas = plantilla?.lineas.filter((l) => !l.opcional) ?? [];
  const opcionales = plantilla?.lineas.filter((l) => l.opcional) ?? [];

  const sinMedidas = !borrador.largo_m || !borrador.ancho_m || !borrador.alto_m;
  const serie = serieDeNombres(nombre || 'Sala sin nombre', copias);

  const cambiarPlantilla = (id: string) => {
    setPlantillaId(id);
    const p = plantillas.find((x) => x.id === id);
    setBorrador(p ? desdePlantilla(p) : VACIO);
  };

  const campo =
    (clave: keyof Borrador) => (e: { target: { value: string } }) =>
      setBorrador((b) => ({ ...b, [clave]: e.target.value }) as Borrador);

  return (
    <form action={crearSala} className="grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
      <div className="space-y-6 min-w-0">
        <Tarjeta titulo="De dónde parte">
          <Campo
            etiqueta="Plantilla"
            ayuda="Sin plantilla la sala nace vacía y el equipamiento se añade después."
          >
            <select
              name="plantilla_id"
              value={plantillaId}
              onChange={(e) => cambiarPlantilla(e.target.value)}
              className="w-full"
            >
              <option value="">Empezar en blanco</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.n_salas_reales ? ` · ${p.n_salas_reales} salas reales` : ''}
                  {p.largo_m == null ? ' · sin medidas' : ''}
                </option>
              ))}
            </select>
          </Campo>
        </Tarjeta>

        <Tarjeta titulo="Identificación">
          <div className="grid sm:grid-cols-2 gap-3">
            {proyectos.length > 0 && (
              <>
                <Campo
                  etiqueta="Proyecto"
                  ayuda="Sin proyecto la sala se crea suelta, como hasta ahora."
                >
                  <select
                    value={proyectoId}
                    onChange={(e) => cambiarProyecto(e.target.value)}
                    className="w-full"
                  >
                    <option value="">— sin proyecto —</option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
                {proyecto ? (
                  <Campo
                    etiqueta="Localización"
                    ayuda={
                      copias > 1
                        ? 'Las salas de la serie caen todas en esta localización.'
                        : undefined
                    }
                  >
                    <select
                      name="localizacion_id"
                      required
                      value={localizacionId}
                      onChange={(e) => setLocalizacionId(e.target.value)}
                      className="w-full"
                    >
                      {proyecto.localizaciones.length > 1 && (
                        <option value="">Elegir localización</option>
                      )}
                      {proyecto.localizaciones.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                ) : (
                  <div aria-hidden="true" className="hidden sm:block" />
                )}
              </>
            )}
            <Campo
              etiqueta="Nombre"
              ayuda={
                copias > 1
                  ? 'Patrón de la serie. Usa # donde va el número: África ##.'
                  : undefined
              }
            >
              <input
                name="nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="África"
                className="w-full"
              />
            </Campo>
            <Campo etiqueta="Código">
              <input
                name="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="AFR-##"
                className="w-full"
              />
            </Campo>
            {proyecto ? (
              <Campo etiqueta="Sede" ayuda="Heredada del proyecto.">
                <input
                  value={proyecto.sede ?? '—'}
                  readOnly
                  disabled
                  className="w-full"
                />
              </Campo>
            ) : (
              <Campo etiqueta="Sede">
                <input
                  name="sede"
                  list="sedes-conocidas"
                  placeholder="Madrid"
                  className="w-full"
                />
                <datalist id="sedes-conocidas">
                  {sedes.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Campo>
            )}
            <Campo etiqueta="Edificio">
              <input name="edificio" className="w-full" />
            </Campo>
            <Campo etiqueta="Nivel">
              <input name="nivel" placeholder="Planta 3" className="w-full" />
            </Campo>
            <Campo etiqueta="Tipología">
              <input
                name="tipologia"
                value={borrador.tipologia}
                onChange={campo('tipologia')}
                placeholder="SALA TP"
                className="w-full"
              />
            </Campo>
            <Campo etiqueta="Aforo">
              <input
                name="aforo"
                type="number"
                min="0"
                value={borrador.aforo}
                onChange={campo('aforo')}
                className="w-full num"
              />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Medidas de la sala">
          {sinMedidas && (
            <div className="mb-4">
              <Aviso tono="alerta">
                Sin largo, ancho y alto no se calcula ni un metro de cable. La sala se
                crea igual y las medidas se rellenan luego, pero hasta entonces no hay
                tabla de cables ni lista de material.
              </Aviso>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ['largo_m', 'Largo (m)'],
                ['ancho_m', 'Ancho (m)'],
                ['alto_m', 'Alto (m)'],
                ['alto_falso_techo_m', 'Falso techo (m)'],
              ] as const
            ).map(([clave, etiqueta]) => (
              <Campo key={clave} etiqueta={etiqueta}>
                <input
                  name={clave}
                  type="number"
                  step="0.01"
                  min="0"
                  value={borrador[clave]}
                  onChange={campo(clave)}
                  className="w-full num"
                />
              </Campo>
            ))}
          </div>

          {/*
            La mesa no entra en el cálculo de cable, pero es lo que hace que la
            sala nazca con croquis. La plantilla la trae medida y aquí solo se
            corrige la sala que se salga.
          */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            {(
              [
                ['mesa_largo_m', 'Mesa largo (m)', '0.01'],
                ['mesa_ancho_m', 'Mesa ancho (m)', '0.01'],
                ['mesa_alto_cm', 'Mesa alto (cm)', '1'],
              ] as const
            ).map(([clave, etiqueta, paso]) => (
              <Campo key={clave} etiqueta={etiqueta}>
                <input
                  name={clave}
                  type="number"
                  step={paso}
                  min="0"
                  value={borrador[clave]}
                  onChange={campo(clave)}
                  className="w-full num"
                />
              </Campo>
            ))}
          </div>

          <div className="mt-3">
            <Campo
              etiqueta="Ruta por defecto"
              ayuda="Por dónde discurren los cables salvo que la tirada diga otra cosa."
            >
              <select
                name="ruta_por_defecto"
                value={borrador.ruta_por_defecto}
                onChange={campo('ruta_por_defecto')}
                className="w-full sm:w-auto"
              >
                {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
                  <option key={v} value={v}>
                    {e}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta
          titulo="Cuántas salas iguales"
          pie="Las 144 salas TP de aforo 8 del inventario son la misma sala repetida. Se crean de una vez y luego se corrige la que se salga."
        >
          <div className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Salas a crear">
              <input
                name="copias"
                type="number"
                min="1"
                max={MAXIMO_COPIAS}
                value={copias}
                onChange={(e) =>
                  setCopias(
                    Math.min(
                      MAXIMO_COPIAS,
                      Math.max(1, Math.round(Number(e.target.value) || 1)),
                    ),
                  )
                }
                className="w-24 num"
              />
            </Campo>
            {[3, 10, 144].map((n) => (
              <Boton
                key={n}
                tipo="button"
                variante="secundario"
                aria-label={`Poner ${n} salas`}
                onClick={() => setCopias(n)}
              >
                {n}
              </Boton>
            ))}
          </div>
        </Tarjeta>
      </div>

      {/* ------------------------------------------- qué se va a crear */}
      <div className="space-y-6 min-w-0 lg:sticky lg:top-4">
        <Tarjeta titulo="Se va a crear">
          <ListaClaveValor
            items={[
              { clave: 'Salas', valor: copias },
              { clave: 'Plantilla', valor: plantilla?.nombre ?? 'ninguna' },
              { clave: 'Proyecto', valor: proyecto?.nombre ?? 'ninguno' },
              {
                clave: 'Medidas',
                valor: sinMedidas ? (
                  <span className="text-alerta">sin medidas</span>
                ) : (
                  `${borrador.largo_m} × ${borrador.ancho_m} × ${borrador.alto_m} m`
                ),
              },
              { clave: 'Equipos heredados', valor: heredadas.length },
            ]}
          />

          <p className="mt-3 pt-3 border-t border-linea text-tinta-tenue break-words">
            {resumirSerie(serie)}
          </p>

          <div className="mt-4">
            <Boton>{copias === 1 ? 'Crear sala' : `Crear ${copias} salas`}</Boton>
          </div>
        </Tarjeta>

        {plantilla && (
          <Tarjeta
            titulo="Equipamiento heredado"
            pie={
              opcionales.length > 0
                ? `${opcionales.length === 1 ? 'Una línea marcada' : `${opcionales.length} líneas marcadas`} "no en todas" no se hereda${
                    opcionales.length === 1 ? '' : 'n'
                  }: ${opcionales.map((l) => l.modelo_texto ?? l.categoria).join(', ')}`
                : undefined
            }
          >
            {heredadas.length === 0 ? (
              <p className="text-tinta-tenue">
                La plantilla no tiene equipamiento estándar definido.
              </p>
            ) : (
              <ContenedorTabla etiqueta="Equipamiento heredado">
              <table className="datos">
                <thead>
                  <tr>
                    <th className="num">Ud</th>
                    <th>Equipo</th>
                  </tr>
                </thead>
                <tbody>
                  {heredadas.map((l) => (
                    <tr key={l.id}>
                      <td className="num">{l.cantidad}</td>
                      <td>
                        {l.modelo_texto ?? l.categoria}
                        <span className="block text-tinta-tenue">{l.categoria}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </ContenedorTabla>
            )}
          </Tarjeta>
        )}
      </div>
    </form>
  );
}

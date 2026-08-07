'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Aviso, Boton, Campo } from '@/components/ui';
import { anadirConexion } from '@/app/acciones';
import { avisosDeConexion } from '@/lib/cable-schedule';
import {
  ETIQUETA_RUTA,
  ETIQUETA_SENAL,
  ETIQUETA_SENTIDO,
  type Puerto,
  type Senal,
} from '@/lib/tipos';

export interface EquipoElegible {
  id: string;
  nombre: string;
  articulo_id: string;
}

export interface CableElegible {
  id: string;
  etiqueta: string;
  senal: Senal | null;
}

/**
 * Dar de alta una tirada diciendo de qué puerto sale y a qué puerto entra:
 * "la salida de cámara del Cisco va a la entrada 3 de la matriz".
 *
 * Es cliente porque los desplegables de puerto dependen del equipo elegido y
 * los avisos tienen que verse antes de guardar, no después. La validación
 * avisa pero no bloquea: el técnico puede tener un adaptador por medio o un
 * equipo con la serigrafía equivocada, y una aplicación que se lo impida
 * termina siendo un estorbo.
 */
export function FormularioConexion({
  salaId,
  equipos,
  puertos,
  cables,
}: {
  salaId: string;
  equipos: EquipoElegible[];
  puertos: Puerto[];
  cables: CableElegible[];
}) {
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [puertoOrigenId, setPuertoOrigenId] = useState('');
  const [puertoDestinoId, setPuertoDestinoId] = useState('');
  const [cableId, setCableId] = useState('');
  const [senal, setSenal] = useState<Senal>('hdmi');

  const porArticulo = useMemo(() => {
    const mapa = new Map<string, Puerto[]>();
    for (const p of puertos) {
      const lista = mapa.get(p.articulo_id) ?? [];
      lista.push(p);
      mapa.set(p.articulo_id, lista);
    }
    return mapa;
  }, [puertos]);

  const porId = useMemo(() => new Map(puertos.map((p) => [p.id, p])), [puertos]);
  const equipoPorId = useMemo(() => new Map(equipos.map((e) => [e.id, e])), [equipos]);

  const puertosDe = (equipoId: string): Puerto[] => {
    const articulo = equipoPorId.get(equipoId)?.articulo_id;
    return articulo ? (porArticulo.get(articulo) ?? []) : [];
  };

  const avisos = avisosDeConexion(
    { senal },
    porId.get(puertoOrigenId),
    porId.get(puertoDestinoId),
    cables.find((c) => c.id === cableId),
  );

  /** El puerto manda sobre la señal: si eliges un HDMI OUT, la tirada es HDMI. */
  const elegirPuerto = (id: string, lado: 'origen' | 'destino') => {
    if (lado === 'origen') setPuertoOrigenId(id);
    else setPuertoDestinoId(id);
    const p = porId.get(id);
    if (p) setSenal(p.senal);
  };

  const selectorPuerto = (lado: 'origen' | 'destino') => {
    const equipoId = lado === 'origen' ? origenId : destinoId;
    const valor = lado === 'origen' ? puertoOrigenId : puertoDestinoId;
    const lista = puertosDe(equipoId);

    return (
      <select
        name={`puerto_${lado}_id`}
        value={valor}
        onChange={(e) => elegirPuerto(e.target.value, lado)}
        disabled={lista.length === 0}
        className="min-w-[11rem]"
      >
        <option value="">{lista.length === 0 ? '— sin puertos —' : '— sin detallar —'}</option>
        {lista.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} · {ETIQUETA_SENTIDO[p.sentido]}
            {p.conector ? ` · ${p.conector}` : ''}
          </option>
        ))}
      </select>
    );
  };

  /** Equipos elegidos cuyo artículo no tiene puertos: hay que ir a rellenarlos. */
  const sinPuertos = [origenId, destinoId]
    .map((id) => equipoPorId.get(id))
    .filter((e): e is EquipoElegible => Boolean(e) && puertosDe(e!.id).length === 0);

  return (
    <form
      action={anadirConexion}
      className="mt-4 pt-4 border-t border-linea space-y-3"
    >
      <input type="hidden" name="sala_id" value={salaId} />

      <div className="flex flex-wrap items-end gap-2">
        <Campo etiqueta="Origen">
          <select
            name="origen_id"
            required
            value={origenId}
            onChange={(e) => {
              setOrigenId(e.target.value);
              setPuertoOrigenId('');
            }}
          >
            <option value="">—</option>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Puerto de origen">{selectorPuerto('origen')}</Campo>
        <Campo etiqueta="Destino">
          <select
            name="destino_id"
            required
            value={destinoId}
            onChange={(e) => {
              setDestinoId(e.target.value);
              setPuertoDestinoId('');
            }}
          >
            <option value="">—</option>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Puerto de destino">{selectorPuerto('destino')}</Campo>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Campo etiqueta="Señal">
          <select
            name="senal"
            value={senal}
            onChange={(e) => setSenal(e.target.value as Senal)}
          >
            {Object.entries(ETIQUETA_SENAL).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cable">
          <select
            name="articulo_cable_id"
            value={cableId}
            onChange={(e) => setCableId(e.target.value)}
            className="w-full min-w-0 sm:min-w-[14rem]"
          >
            <option value="">— sin asignar —</option>
            {cables.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Ruta">
          <select name="ruta" defaultValue="">
            <option value="">Por defecto de la sala</option>
            {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Longitud manual" ayuda="Vacío = calculada">
          <input name="longitud_manual_m" type="number" step="0.01" min="0" className="w-24" />
        </Campo>
        <Boton>Añadir conexión</Boton>
      </div>

      {sinPuertos.length > 0 && (
        <Aviso tono="alerta">
          Sin puertos en el catálogo:{' '}
          {sinPuertos.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <Link
                href={`/articulo/${e.articulo_id}`}
                className="enlace"
              >
                {e.nombre}
              </Link>
            </span>
          ))}
          . Se puede crear la conexión igual, pero la tabla de cables saldrá sin
          puerto ni conector hasta que se rellenen en su ficha.
        </Aviso>
      )}

      {avisos.length > 0 && (
        <Aviso tono="aviso">
          <ul className="list-disc pl-4">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}
    </form>
  );
}

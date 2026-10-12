'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarBocasToma } from '@/app/acciones';
import { ETIQUETA_SENAL, type Senal, type TomaRed } from '@/lib/tipos';
import { Aviso, Boton } from '@/components/ui';

export function BocasRoseta({ toma, version, bloqueado, alGuardar, guardarAccion = guardarBocasToma }: {
  toma: TomaRed; version: number; bloqueado: boolean; alGuardar: (version: number) => void;
  guardarAccion?: (datos: FormData) => Promise<{ ok: true; version: number } | { ok: false; detalle: string }>;
}) {
  const router = useRouter();
  const [capacidad, setCapacidad] = useState(toma.capacidad_documentada?.toString() ?? '');
  const [campos, setCampos] = useState<Partial<Record<number, { etiqueta: string; senal: string; conector: string }>>>(() =>
    Object.fromEntries(toma.bocas.map((boca) => [boca.ordinal,
      { etiqueta: boca.etiqueta ?? '', senal: boca.senal, conector: boca.conector }])));
  function cambiarCampo(ordinal: number, clave: 'etiqueta' | 'senal' | 'conector', valor: string) {
    setCampos((actuales) => ({ ...actuales, [ordinal]: {
      etiqueta: '', senal: '', conector: '', ...actuales[ordinal], [clave]: valor,
    } }));
  }
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, transicion] = useTransition();
  const total = Number(capacidad);
  const cantidadValida = capacidad === '' || (Number.isInteger(total) && total >= 1 && total <= 1000);

  function guardar(datos: FormData) {
    if (bloqueado || pendiente || !cantidadValida) return;
    datos.set('sala_id', toma.sala_id);
    datos.set('toma_id', toma.id);
    datos.set('versionEsperada', String(version));
    datos.set('bocas', JSON.stringify(Array.from({ length: capacidad === '' ? 0 : total }, (_, i) => ({
      ordinal: i + 1, etiqueta: String(datos.get(`etiqueta_${i + 1}`) ?? '').trim() || null,
      senal: datos.get(`senal_${i + 1}`), conector: datos.get(`conector_${i + 1}`),
    }))));
    transicion(async () => {
      try {
        const resultado = await guardarAccion(datos);
        if (!resultado.ok) { setMensaje(resultado.detalle); return; }
        alGuardar(resultado.version);
        setMensaje('Bocas guardadas.');
        router.refresh();
      } catch {
        setMensaje('No se pudieron confirmar las bocas. Recarga para comprobar el estado guardado.');
      }
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar(new FormData(e.currentTarget)); }}
      className="mt-4 space-y-3 border-t border-linea pt-4">
      <fieldset disabled={bloqueado || pendiente} className="min-w-0 space-y-3">
        <legend className="font-medium">Bocas de la roseta</legend>
        {toma.codigo_referencia && <p className="text-tinta-tenue">Referencia de origen: {toma.codigo_referencia}</p>}
        <label className="flex items-center gap-2">
          <input type="checkbox" name="codigo_confirmado" defaultChecked={toma.codigo_confirmado} />
          Código comprobado en la placa
        </label>
        <label className="block">
          Bocas documentadas
          <input type="number" name="capacidad_documentada" min="1" max="1000" step="1"
            value={capacidad} placeholder="Desconocidas" className="mt-1 w-full"
            onChange={(e) => setCapacidad(e.target.value)} />
        </label>
        {cantidadValida && capacidad !== '' && Array.from({ length: total }, (_, i) => {
          const ordinal = i + 1;
          const boca = campos[ordinal];
          return (
            <fieldset key={ordinal} className="min-w-0 space-y-2 border-t border-linea pt-2">
              <legend>Boca {ordinal}</legend>
              <label className="block">Etiqueta
                <input name={`etiqueta_${ordinal}`} value={boca?.etiqueta ?? ''}
                  onChange={(e) => cambiarCampo(ordinal, 'etiqueta', e.target.value)} className="w-full" />
              </label>
              <label className="block">Señal
                <select name={`senal_${ordinal}`} value={boca?.senal ?? ''}
                  onChange={(e) => cambiarCampo(ordinal, 'senal', e.target.value)} required className="w-full">
                  <option value="">Elegir señal</option>
                  {(Object.keys(ETIQUETA_SENAL) as Senal[]).map((senal) =>
                    <option key={senal} value={senal}>{ETIQUETA_SENAL[senal]}</option>)}
                </select>
              </label>
              <label className="block">Conector
                <input name={`conector_${ordinal}`} value={boca?.conector ?? ''}
                  onChange={(e) => cambiarCampo(ordinal, 'conector', e.target.value)} required className="w-full" />
              </label>
            </fieldset>
          );
        })}
        <Boton disabled={!cantidadValida}>{pendiente ? 'Guardando…' : 'Guardar bocas'}</Boton>
      </fieldset>
      {bloqueado && <p className="text-tinta-tenue">Guarda o descarta los cambios del plano antes de documentar las bocas.</p>}
      {mensaje && <Aviso tono="neutro">{mensaje}</Aviso>}
    </form>
  );
}

import Link from 'next/link';
import { Aviso, Boton, Campo, Tarjeta } from '@/components/ui';
import { borrarHitoSala, registrarHitoSala } from '@/app/acciones-ciclo';
import {
  proyectoCerrado,
  resumenCicloVida,
  tecnicosDeRol,
  type AvisosDeEntrega,
  type HitoProyecto,
  type HitoSala,
  type Recepcion,
  type Tecnico,
  type TecnicoRol,
} from '@/lib/ciclo-vida';

/**
 * La línea de tiempo de la sala: inicio del proyecto (heredado), recepciones
 * (derivadas de los pedidos), instalación y entrega (sus hitos). El estado
 * del material se deriva; el hecho humano se registra aquí.
 *
 * Borrar un hito elimina autoría y fecha, así que pide confirmación, y por
 * la dirección (`?borrar=<id>`), no con un diálogo del navegador: se puede
 * cancelar con el botón de atrás.
 */
export function CicloDeVidaSala({
  salaId,
  hitosProyecto,
  hitosSala,
  recepciones,
  tecnicos,
  roles,
  avisosEntrega,
  confirmarBorrado,
}: {
  salaId: string;
  hitosProyecto: HitoProyecto[];
  hitosSala: HitoSala[];
  recepciones: Recepcion[];
  tecnicos: Tecnico[];
  roles: TecnicoRol[];
  avisosEntrega: AvisosDeEntrega;
  /** El hito cuyo borrado se está confirmando (`?borrar=<id>`). */
  confirmarBorrado?: string;
}) {
  const resumen = resumenCicloVida({ hitosProyecto, hitosSala, recepciones });
  const instaladores = tecnicosDeRol(tecnicos, roles, 'instalacion');
  const instalacion = hitosSala.find((h) => h.tipo === 'instalacion');
  const entrega = hitosSala.find((h) => h.tipo === 'entrega');
  const cerrado = proyectoCerrado(hitosProyecto);

  const formularioHito = (
    tipo: 'instalacion' | 'entrega',
    etiqueta: string,
    exigeNota: boolean,
  ) => (
    <form
      action={registrarHitoSala}
      className="flex flex-wrap items-end gap-3 pt-3 border-t border-linea-suave"
    >
      <input type="hidden" name="sala_id" value={salaId} />
      <input type="hidden" name="tipo" value={tipo} />
      <Campo etiqueta="Quién">
        <select name="tecnico_id" required className="w-40" defaultValue="">
          <option value="" disabled>
            Elegir técnico
          </option>
          {instaladores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Fecha">
        <input name="fecha" type="date" className="w-40 num" />
      </Campo>
      <Campo etiqueta={exigeNota ? 'Nota (obligatoria)' : 'Nota'}>
        <input name="notas" required={exigeNota} className="w-56" />
      </Campo>
      <Boton variante="secundario">{etiqueta}</Boton>
    </form>
  );

  const borradoDeHito = (h: HitoSala, etiqueta: string) =>
    confirmarBorrado === h.id ? (
      <div className="space-y-2">
        <Aviso tono="alerta">
          Borrar la {h.tipo === 'instalacion' ? 'instalación' : 'entrega'} elimina quién
          y cuándo ({[h.tecnico, h.fecha].filter(Boolean).join(' · ')}). No se puede
          deshacer: se registraría de nuevo.
        </Aviso>
        <div className="flex gap-3 items-center">
          <form action={borrarHitoSala}>
            <input type="hidden" name="sala_id" value={salaId} />
            <input type="hidden" name="id" value={h.id} />
            <Boton variante="peligro">{etiqueta} definitivamente</Boton>
          </form>
          <Link href={`/salas/${salaId}`} className="enlace">
            Cancelar
          </Link>
        </div>
      </div>
    ) : (
      <Link
        href={`/salas/${salaId}?borrar=${h.id}` as never}
        className="boton boton-peligro"
      >
        {etiqueta}
      </Link>
    );

  return (
    <Tarjeta
      titulo="Ciclo de vida"
      pie="El inicio es de la obra y las recepciones, de los pedidos. Un hito mal registrado se borra y se registra de nuevo."
    >
      <ol className="space-y-2 mb-4">
        {resumen.pasos.map((p) => (
          <li key={p.clave} className="flex gap-3 items-baseline">
            <span
              aria-hidden="true"
              className={`inline-block size-2 rounded-full shrink-0 ${
                p.hecho ? 'bg-exito' : 'bg-linea-fuerte'
              }`}
            />
            <div>
              <span className={p.hecho ? 'font-medium' : 'text-tinta-tenue font-medium'}>
                {p.titulo}
              </span>
              <span className="block text-tinta-tenue">{p.detalle}</span>
            </div>
          </li>
        ))}
      </ol>

      {cerrado ? (
        <Aviso tono="neutro">
          El proyecto está cerrado: sus hitos de sala no se tocan. Para corregir algo se
          reabre la obra borrando el cierre desde su portada.
        </Aviso>
      ) : (
        <>
          {!instalacion && formularioHito('instalacion', 'Registrar instalación', false)}

          {!entrega && (
            <>
              {avisosEntrega.avisos.length > 0 && (
                <div className="mt-4 mb-3">
                  <Aviso tono={avisosEntrega.exigeNota ? 'alerta' : 'aviso'}>
                    {avisosEntrega.exigeNota
                      ? 'El semáforo dice que la sala no está montable. Entregarla es una decisión consciente: la nota es obligatoria.'
                      : 'La revisión de montaje tiene avisos. Se puede entregar igual.'}
                    <ul className="mt-1 list-disc pl-5">
                      {avisosEntrega.avisos.slice(0, 5).map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </Aviso>
                </div>
              )}
              {formularioHito('entrega', 'Registrar entrega', avisosEntrega.exigeNota)}
            </>
          )}

          {(instalacion || entrega) && (
            <div className="space-y-3 pt-3 border-t border-linea-suave">
              {instalacion && borradoDeHito(instalacion, 'Borrar instalación')}
              {entrega && borradoDeHito(entrega, 'Borrar entrega')}
            </div>
          )}
        </>
      )}
    </Tarjeta>
  );
}

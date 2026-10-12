import { FormularioMutacion } from '@/components/formulario-mutacion/formulario';
import type { ComprasCiclo } from '@/lib/ciclo-vida-compras';
import { ComprasDeSala } from './compras-sala';
import Link from 'next/link';
import { Aviso, Boton, Campo, Tarjeta } from '@/components/ui';
import { borrarHitoSala, registrarHitoSala, guardarSeguimientoSala } from '@/app/acciones-ciclo';
import { proyectoCerrado, resumenCicloVida, tecnicosDeRol, type AvisosDeEntrega,
  type HitoProyecto, type HitoSala, type Recepcion, type Tecnico, type TecnicoRol } from '@/lib/ciclo-vida';
import { PUNTOS_PRUEBA_FINAL, type SeguimientoInstalacion } from '@/lib/ciclo-vida-seguimiento';
import { HistorialInstalacion } from './historial-instalacion';
import { CompletarPrueba } from './completar-prueba';
import { FormularioPrueba } from './formulario-prueba';

export function CicloDeVidaSala({ salaId, hitosProyecto, hitosSala, recepciones, tecnicos, roles,
  avisosEntrega, confirmarBorrado, seguimiento, compras, editable, error }: {
  salaId: string; hitosProyecto: HitoProyecto[]; hitosSala: HitoSala[]; recepciones: Recepcion[];
  tecnicos: Tecnico[]; roles: TecnicoRol[]; avisosEntrega: AvisosDeEntrega; confirmarBorrado?: string;
  seguimiento: SeguimientoInstalacion; compras: ComprasCiclo; editable: boolean; error?: string;
}) {
  const resumen = resumenCicloVida({ hitosProyecto, hitosSala, recepciones });
  const instaladores = tecnicosDeRol(tecnicos, roles, 'instalacion');
  const instalacion = hitosSala.find((h) => h.tipo === 'instalacion');
  const entrega = hitosSala.find((h) => h.tipo === 'entrega');
  const cerrado = proyectoCerrado(hitosProyecto);
  const { plan, prueba } = seguimiento;
  const puedeEditar = editable && seguimiento.disponible && !cerrado;
  const identidad = <input type="hidden" name="sala_id" value={salaId} />;
  const tecnico = (valor = '', requerido = true) => <Campo etiqueta="Técnico de instalación">
    <select name="tecnico_id" required={requerido} defaultValue={valor} className="w-full">
      <option value="">Sin asignar</option>
      {valor && !instaladores.some((t) => t.id === valor) && <option value={valor} disabled>{tecnicos.find((t) => t.id === valor)?.nombre ?? 'Técnico no disponible'} (no disponible)</option>}
      {instaladores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
    </select>
  </Campo>;
  const formularioHito = (tipo: 'instalacion' | 'entrega') => <FormularioMutacion action={registrarHitoSala} className="space-y-3 border-t border-linea-suave pt-3">
    {identidad}<input type="hidden" name="tipo" value={tipo} />
    <div className="grid gap-3 sm:grid-cols-2">
      {tecnico(plan?.instalador_id ?? '')}
      <Campo etiqueta="Fecha realizada"><input name="fecha" type="date" required className="w-full" /></Campo>
      {tipo === 'entrega' && <Campo etiqueta="Quién recibe y acepta"><input name="acepta" required maxLength={200} className="w-full" /></Campo>}
      <Campo etiqueta={tipo === 'entrega' && avisosEntrega.exigeNota ? 'Nota obligatoria de entrega excepcional' : 'Nota'}>
        <textarea name="notas" required={tipo === 'entrega' && avisosEntrega.exigeNota} maxLength={2000} className="w-full" />
      </Campo>
    </div>
    <Boton variante="secundario">{tipo === 'instalacion' ? 'Instalación: Hecho' : 'Check-out: entregar y aceptar'}</Boton>
  </FormularioMutacion>;
  const borrar = (h: HitoSala) => confirmarBorrado === h.id ? <FormularioMutacion action={borrarHitoSala} className="space-y-3">
    {identidad}<input type="hidden" name="id" value={h.id} />
    <Aviso tono="alerta">Anular {h.tipo === 'entrega' ? 'entrega' : 'instalación'} de {h.fecha}. La anulación queda en el historial.</Aviso>
    <Campo etiqueta="Motivo"><input name="notas" required maxLength={2000} className="w-full" /></Campo>
    <div className="flex flex-wrap gap-3"><Boton variante="peligro">Confirmar anulación</Boton><Link href={`/salas/${salaId}`} className="enlace">Cancelar</Link></div>
  </FormularioMutacion> : <Link href={`/salas/${salaId}?borrar=${h.id}`} className="boton boton-peligro">Anular {h.tipo === 'entrega' ? 'entrega' : 'instalación'}</Link>;

  return <Tarjeta titulo="Seguimiento de instalación">
    <div className="space-y-5 min-w-0 break-words">
      {error && <div role="alert"><Aviso tono="alerta">{error}</Aviso></div>}
      {!seguimiento.disponible && <Aviso tono="aviso">Seguimiento pendiente de integración de la base de datos. Los hitos históricos se conservan.</Aviso>}
      {!editable && seguimiento.disponible && <Aviso tono="neutro">Solo lectura. Para registrar cambios necesitas una sesión real con permiso de edición.</Aviso>}
      <ComprasDeSala compras={compras} />
      {recepciones.length > 0 && <details><summary className="enlace cursor-pointer">Registros de recepción</summary><p className="text-tinta-tenue">La existencia de estos registros no acredita cobertura de los pedidos.</p><ul>{recepciones.map((r, i) => <li key={i}>{r.fecha} · {r.quien ?? 'Sin autor histórico'} · {r.referencia}</li>)}</ul></details>}
      <FormularioMutacion action={guardarSeguimientoSala}>
        {identidad}<input type="hidden" name="operacion" value="plan" /><input type="hidden" name="version" value={plan?.version ?? 0} />
        <fieldset disabled={!puedeEditar || !!entrega} className="space-y-3">
          <legend className="font-medium mb-3">Planificación</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha prevista de comienzo"><input name="fecha" type="date" defaultValue={plan?.fecha_prevista ?? ''} className="w-full" /></Campo>
            {tecnico(plan?.instalador_id ?? '', false)}
          </div>
          <Campo etiqueta="Situación"><textarea name="notas" maxLength={2000} defaultValue={plan?.nota ?? ''} placeholder="Equipo en sala; falta HDMI" className="w-full" /></Campo>
          {puedeEditar && !entrega && <Boton variante="secundario">Guardar planificación</Boton>}
        </fieldset>
      </FormularioMutacion>
      <ol className="space-y-2">
        {resumen.pasos.filter((p) => p.clave !== 'entrega' && p.clave !== 'recepciones').map((p) => <li key={p.clave}><span className="font-medium">{p.titulo}: {p.hecho ? 'Hecho' : 'Pendiente'}</span><span className="block text-tinta-tenue">{p.detalle}</span></li>)}
        <li><span className="font-medium">Check-in · Prueba técnica final: {prueba?.fecha ? 'Hecho' : 'Sin acreditar'}</span>
          {prueba?.fecha && <span className="block text-tinta-tenue">{prueba.tecnico} · {prueba.fecha}</span>}</li>
        <li><span className="font-medium">Check-out · Entrega y aceptación: {entrega ? 'Hecho' : 'Pendiente'}</span>
          {entrega && <span className="block text-tinta-tenue">{entrega.tecnico} · {entrega.fecha} {entrega.notas}</span>}
          {entrega && !prueba?.fecha && <span className="block text-tinta-tenue">Entrega histórica; no acredita una prueba técnica final.</span>}</li>
      </ol>
      {cerrado && <Aviso tono="neutro">Proyecto cerrado. Reabre la obra antes de corregir el seguimiento.</Aviso>}
      {puedeEditar && !instalacion && !entrega && formularioHito('instalacion')}
      {(instalacion || prueba) && <FormularioPrueba>
        {identidad}<input type="hidden" name="version" value={prueba?.version ?? 0} />
        <fieldset disabled={!puedeEditar || !!entrega || !!prueba?.fecha} className="space-y-3">
          <legend className="font-medium">Checklist de prueba técnica final</legend>
          {PUNTOS_PRUEBA_FINAL.map(({ clave, titulo }) => {
            const punto = prueba?.puntos.find((p) => p.clave === clave);
            return <div key={clave} className="grid gap-2 sm:grid-cols-2">
              <Campo etiqueta={titulo}><select name={`resultado_${clave}`} defaultValue={punto?.resultado ?? 'pendiente'} className="w-full">
                <option value="pendiente">Pendiente</option><option value="conforme">Conforme</option><option value="incidencia">Incidencia</option><option value="no_aplica">No aplica</option>
              </select></Campo>
              <Campo etiqueta={`Observación: ${titulo}`}><input name={`nota_${clave}`} defaultValue={punto?.nota ?? ''} maxLength={2000} className="w-full" /></Campo>
            </div>;
          })}
          {puedeEditar && !entrega && !prueba?.fecha && <>
            <p className="text-tinta-tenue">Incidencia y No aplica requieren justificación. Las incidencias impiden finalizar.</p>
            <Boton variante="secundario" name="operacion" value="checklist">Guardar checklist</Boton>
            <div className="grid gap-3 sm:grid-cols-2">{tecnico(plan?.instalador_id ?? '', false)}<Campo etiqueta="Fecha de prueba"><input type="date" name="fecha" className="w-full" /></Campo></div>
            <CompletarPrueba />
          </>}
        </fieldset>
      </FormularioPrueba>}
      {puedeEditar && !entrega && prueba?.fecha && <FormularioMutacion action={guardarSeguimientoSala} className="space-y-3">
        {identidad}<input type="hidden" name="operacion" value="reabrir_prueba" /><input type="hidden" name="version" value={prueba.version} />
        <Campo etiqueta="Motivo de reapertura"><input name="notas" required maxLength={2000} className="w-full" /></Campo><Boton variante="secundario">Reabrir prueba final</Boton>
      </FormularioMutacion>}
      {puedeEditar && !entrega && instalacion && prueba?.fecha && <>
        {avisosEntrega.avisos.length > 0 && <Aviso tono={avisosEntrega.exigeNota ? 'alerta' : 'aviso'}>
          {avisosEntrega.exigeNota ? 'Entrega excepcional: requiere nota.' : 'La revisión tiene avisos.'}
          <ul className="list-disc pl-5">{avisosEntrega.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </Aviso>}
        {formularioHito('entrega')}
      </>}
      {puedeEditar && <div className="space-y-3">{entrega ? borrar(entrega) : instalacion && !prueba?.fecha ? borrar(instalacion) : null}</div>}
      <HistorialInstalacion entradas={seguimiento.auditoria} />
    </div>
  </Tarjeta>;
}

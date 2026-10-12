import { PUNTOS_PRUEBA_FINAL, type AuditoriaInstalacion } from '@/lib/ciclo-vida-seguimiento';

const etiquetas: Record<string, string> = { plan: 'Planificación', checklist: 'Checklist guardado', prueba_final: 'Prueba final completada',
  reabrir_prueba: 'Prueba reabierta', instalacion: 'Instalación realizada', entrega: 'Entrega y aceptación',
  borrar_instalacion: 'Instalación anulada', borrar_entrega: 'Entrega anulada' };

export function HistorialInstalacion({ entradas }: { entradas: AuditoriaInstalacion[] }) {
  return <details><summary className="enlace cursor-pointer">Historial ({entradas.length})</summary>
    <ol className="space-y-3 pt-3">{entradas.map((a) => {
      const dato = (a.datos.nuevo ?? a.datos.anterior ?? {}) as Record<string, unknown>;
      const puntos = (a.datos.puntos ?? dato.puntos) as Array<{ clave: string; resultado: string; nota: string }> | undefined;
      return <li key={a.id} className="border-t border-linea-suave pt-2">
        <p className="font-medium">{etiquetas[a.operacion]} · {a.autor}</p>
        {Boolean(a.datos.tecnico) && <p>Técnico: {String(a.datos.tecnico)}</p>}
        <time className="text-tinta-tenue" dateTime={a.registrado_en}>{new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(a.registrado_en))}</time>
        {dato.fecha_prevista != null && <p>Comienzo previsto: {String(dato.fecha_prevista).slice(0, 10)}</p>}
        {dato.fecha != null && <p>Fecha realizada: {String(dato.fecha).slice(0, 10)}</p>}
        {Boolean(dato.nota || dato.notas || a.datos.motivo) && <p>{String(a.datos.motivo || dato.nota || dato.notas)}</p>}
        {Boolean(a.datos.acepta) && <p>Recibe y acepta: {String(a.datos.acepta)}</p>}
        {puntos && <ul>{puntos.map((p) => <li key={p.clave}>{PUNTOS_PRUEBA_FINAL.find((x) => x.clave === p.clave)?.titulo}: {p.resultado.replace('_', ' ')}{p.nota ? ` · ${p.nota}` : ''}</li>)}</ul>}
      </li>;
    })}</ol>
  </details>;
}

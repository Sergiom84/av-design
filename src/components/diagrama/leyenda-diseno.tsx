import { leyendaDiseno, type SimboloDiseno } from '@/lib/presentacion-diagrama';
import type { Conexion, EquipoEnSala } from '@/lib/tipos';

export function SimboloEquipo({ simbolo }: { simbolo: SimboloDiseno }) {
  return <svg aria-label={simbolo.nombre} role="img" viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={simbolo.forma} /></svg>;
}
export function LeyendaDiseno({ equipos, conexiones, categorias }: { equipos: EquipoEnSala[]; conexiones: Conexion[]; categorias?: Map<string, string> }) {
  const leyenda = leyendaDiseno(equipos, conexiones, categorias);
  return <section aria-label="Leyenda del diagrama" className="mt-4 space-y-2 text-xs">
    <p className="t-etiqueta">Leyenda</p>
    <ul className="flex flex-wrap gap-x-4 gap-y-2">{leyenda.simbolos.map(s => <li key={s.clave} className="flex items-center gap-2"><SimboloEquipo simbolo={s} />{s.nombre}</li>)}</ul>
    <ul className="flex flex-wrap gap-x-4 gap-y-2">{leyenda.senales.map(s => <li key={s.senal} className="flex items-center gap-2"><svg width="40" height="12" aria-hidden="true"><line x1="0" x2="40" y1="6" y2="6" stroke={s.color} strokeWidth="2" strokeDasharray={s.trazo} /></svg>{s.etiqueta}</li>)}</ul>
  </section>;
}

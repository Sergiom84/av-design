import { ContenedorTabla } from '@/components/ui';
export function Informe({ datos, profundidad = 0 }: { datos: unknown; profundidad?: number }) {
  if (datos === null || datos === undefined) return <span className="text-tinta-tenue">Sin dato</span>;
  if (typeof datos !== 'object') return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{String(datos)}</span>;
  if (Array.isArray(datos)) return datos.length ? <ol className="space-y-3">{datos.map((d, i) => <li key={i} className="border-l-2 border-linea pl-3"><Informe datos={d} profundidad={profundidad + 1} /></li>)}</ol> : <span className="text-tinta-tenue">Ninguno</span>;
  if (profundidad > 8) return <pre className="whitespace-pre-wrap text-xs [overflow-wrap:anywhere]">{JSON.stringify(datos, null, 2)}</pre>;
  return <ContenedorTabla etiqueta="Detalle del resultado"><table className="datos"><tbody>{Object.entries(datos).map(([k, v]) => <tr key={k}><th scope="row">{k.replaceAll('_', ' ')}</th><td><Informe datos={v} profundidad={profundidad + 1} /></td></tr>)}</tbody></table></ContenedorTabla>;
}

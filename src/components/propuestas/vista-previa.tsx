'use client';
import type { ModeloPropuesta } from '@/lib/propuestas/modelo';
import { formatearDecimal } from '@/lib/importes';
const estados = { sin_datos: 'Sin datos', parcial: 'Parcial', completo: 'Completa' };
const etiquetas = { base: 'Base', impuesto: 'Impuesto', total: 'Total', costePrevisto: 'Coste previsto' };
export function VistaPreviaPropuesta({ modelo }: {
    modelo: ModeloPropuesta;
}) {
    return <section className="tarjeta p-4 space-y-3" aria-label="Vista previa de propuesta">
    <h2 className="t-subtitulo">Propuesta interna · revisión {modelo.numero}</h2>
    <h3 className="font-semibold">{modelo.tecnico.titulo}</h3>
    <p>{modelo.fuente.nombre} · {modelo.fuente.etiqueta}</p>
    <p className="text-tinta-tenue break-all">SHA fuente: {modelo.fuenteHash}</p>
    {modelo.fuente.avisos.map((a, i) => <p key={i} className="text-aviso">{a}</p>)}
    <p>{modelo.tecnico.destinatario ? `Destinatario: ${Object.entries(modelo.tecnico.destinatario).filter(([k]) => ['entidad', 'nombre', 'contacto', 'grupo'].includes(k)).map(([, v]) => v).filter(Boolean).join(' · ')}` : 'Propuesta interna sin destinatario'}</p>
    {modelo.tecnico.secciones.map(s => <div key={s.id}><h3 className="font-semibold">{s.tituloResuelto ?? s.titulo}</h3><p className="whitespace-pre-wrap break-words">{s.resuelto}</p></div>)}
    <h3 className="font-semibold">Líneas incluidas ({modelo.tecnico.lineas.length}) · {modelo.tecnico.excluidas} excluidas</h3>
    <div className="overflow-x-auto"><table className="datos w-full"><thead><tr><th>Descripción</th><th>Cantidad</th><th>Origen</th></tr></thead><tbody>{modelo.tecnico.lineas.map(l => <tr key={l.clave}><td>{l.descripcion}</td><td className="font-mono">{l.cantidad ?? 'Sin dato'} {l.unidad ?? ''}</td><td>{l.origen}</td></tr>)}</tbody></table></div>
    {modelo.valoracion && <div className="space-y-2"><h3 className="font-semibold">Valoración prevista · {estados[modelo.valoracion.estado]}</h3><p>Importes sin impuestos · redondeo por línea: mitad_fuera_cero_v1</p>{Object.entries(modelo.valoracion.totales).map(([moneda, t]) => <div key={moneda}><h4 className="font-semibold">{moneda}</h4>{Object.entries(t).map(([k, v]) => <p key={k} className="font-mono">{etiquetas[k as keyof typeof etiquetas]}: {v.subtotal === null ? 'Sin dato' : formatearDecimal(BigInt(v.subtotal), 2)} {moneda} · {estados[v.estado]} · {v.ausentes} líneas sin dato · {v.orientativas} orientativas</p>)}</div>)}</div>}
  </section>;
}

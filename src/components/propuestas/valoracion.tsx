'use client';
import type { LineaFuente, LineaValoracion } from '@/lib/propuestas/modelo';
export function nuevaValoracion(l: LineaFuente): LineaValoracion { return { clave: l.clave, moneda: 'EUR', coste: null, origenCoste: null, regla: 'directo', precio: null, motivoPrecio: null, porcentaje: null, impuesto: { tipo: 'sin_configurar' } }; }
export function ValoracionPropuesta({ lineas, valor, cambiar, consultarPrecio, editable, permitirCatalogo }: {
    lineas: LineaFuente[];
    valor: LineaValoracion[];
    cambiar: (v: LineaValoracion[]) => void;
    consultarPrecio: (l: LineaFuente) => void;
    editable: boolean;
    permitirCatalogo: boolean;
}) {
    const editar = (clave: string, datos: Partial<LineaValoracion>) => cambiar(valor.map(l => l.clave === clave ? { ...l, ...datos } : l));
    return <div className="space-y-4"><p>Costes previstos. Sin datos no significa cero. Cada línea decide su impuesto.</p>{lineas.map(l => {
            const v = valor.find(x => x.clave === l.clave) ?? nuevaValoracion(l);
            return <fieldset key={l.clave} disabled={!editable} className="border border-linea rounded-lg p-3 space-y-3"><legend className="font-semibold">{l.descripcion}</legend><p className="font-mono">{l.cantidad ?? 'Sin cantidad'} {l.unidad ?? ''}</p><div className="grid md:grid-cols-3 gap-3">
    <label className="block min-w-0">Moneda<select className="block w-full" value={v.moneda} onChange={e => editar(l.clave, { moneda: e.target.value as 'EUR' | 'USD' })}><option>EUR</option><option>USD</option></select></label>
    <label className="block min-w-0">Coste unitario previsto<input className="block w-full" inputMode="decimal" value={v.coste ?? ''} onChange={e => editar(l.clave, { coste: e.target.value || null, origenCoste: e.target.value ? { tipo: 'manual', motivo: 'Estimación manual revisada' } : null })}/></label>
    <label className="block min-w-0">Motivo del previsto<input className="block w-full" value={v.origenCoste?.tipo === 'manual' ? v.origenCoste.motivo : ''} onChange={e => editar(l.clave, { origenCoste: v.coste !== null ? { tipo: 'manual', motivo: e.target.value } : null })}/></label>
    <label className="block min-w-0">Regla de precio<select className="block w-full" value={v.regla} onChange={e => editar(l.clave, { regla: e.target.value as LineaValoracion['regla'], precio: null, porcentaje: e.target.value === 'directo' ? null : '0' })}><option value="directo">Precio directo</option><option value="recargo">Recargo sobre coste</option><option value="margen">Margen sobre venta</option></select></label>
    {v.regla === 'directo' ? <label className="block min-w-0">Precio unitario sin impuestos<input className="block w-full" inputMode="decimal" value={v.precio ?? ''} onChange={e => editar(l.clave, { precio: e.target.value || null })}/></label> : <label className="block min-w-0">Porcentaje de {v.regla}<input className="block w-full" inputMode="decimal" value={v.porcentaje ?? ''} onChange={e => editar(l.clave, { porcentaje: e.target.value || null })}/></label>}
    {v.regla === 'directo' && <label className="block min-w-0">Motivo del precio directo<input className="block w-full" value={v.motivoPrecio ?? ''} onChange={e => editar(l.clave, { motivoPrecio: e.target.value || null })}/></label>}
    <label className="block min-w-0">Impuesto<select className="block w-full" value={v.impuesto.tipo} onChange={e => editar(l.clave, { impuesto: e.target.value === 'sin_configurar' ? { tipo: 'sin_configurar' } : e.target.value === 'no_aplica' ? { tipo: 'no_aplica', motivo: '' } : { tipo: 'porcentaje', porcentaje: '0', etiqueta: '', fuente: '' } })}><option value="sin_configurar">Sin configurar</option><option value="no_aplica">No aplica (con motivo)</option><option value="porcentaje">Porcentaje explícito</option></select></label>
    {v.impuesto.tipo === 'no_aplica' && <label className="block min-w-0">Motivo de no aplicación<input className="block w-full" value={v.impuesto.motivo} onChange={e => editar(l.clave, { impuesto: { tipo: 'no_aplica', motivo: e.target.value } })}/></label>}
    {v.impuesto.tipo === 'porcentaje' && <><label className="block min-w-0">Impuesto (%)<input className="block w-full" value={v.impuesto.porcentaje} inputMode="decimal" onChange={e => editar(l.clave, { impuesto: { ...v.impuesto as Extract<LineaValoracion['impuesto'], {
                        tipo: 'porcentaje';
                    }>, porcentaje: e.target.value } })}/></label><label className="block min-w-0">Etiqueta del impuesto<input className="block w-full" value={v.impuesto.etiqueta} onChange={e => editar(l.clave, { impuesto: { ...v.impuesto as Extract<LineaValoracion['impuesto'], {
                        tipo: 'porcentaje';
                    }>, etiqueta: e.target.value } })}/></label><label className="block min-w-0">Fuente del impuesto<input className="block w-full" value={v.impuesto.fuente} onChange={e => editar(l.clave, { impuesto: { ...v.impuesto as Extract<LineaValoracion['impuesto'], {
                        tipo: 'porcentaje';
                    }>, fuente: e.target.value } })}/></label></>}
    </div>{l.articuloId && permitirCatalogo && <button type="button" className="boton secundario" onClick={() => consultarPrecio(l)}>Consultar previsto de catálogo</button>}{v.origenCoste?.tipo === 'catalogo' && <p className="text-tinta-tenue break-all">Catálogo confirmado: {v.origenCoste.hash}</p>}</fieldset>;
        })}</div>;
}

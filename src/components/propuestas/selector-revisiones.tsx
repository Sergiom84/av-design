'use client';
import type { EntradaPropuesta } from '@/lib/propuestas/modelo';

export function SelectorRevisiones({ entrada, salas, revisiones, cambiar }: {
    entrada: EntradaPropuesta;
    salas: Array<{ id: string; nombre: string }>;
    revisiones: Array<{ id: string; sala_id: string; numero: number; nombre: string }>;
    cambiar: (salaId: string, revisionId: string) => void;
}) {
    if (entrada.fuente.tipo !== 'diseno') return null;
    const fuente = entrada.fuente;
    return salas.filter(s => entrada.ambito.tipo === 'sala' || entrada.ambito.salaIds.includes(s.id)).map(s => <label key={s.id} className="block">Revisión de {s.nombre}<select value={fuente.revisiones.find(r => r.salaId === s.id)?.revisionId ?? ''} onChange={e => cambiar(s.id, e.target.value)}><option value="">Seleccionar revisión</option>{revisiones.filter(r => r.sala_id === s.id).map(r => <option key={r.id} value={r.id}>{r.numero} · {r.nombre}</option>)}</select></label>);
}

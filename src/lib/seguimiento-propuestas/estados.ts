import { ErrorSeguimiento, type Estado, type Evento, type Comando } from './modelo';
export function transicion(estado: Estado, comando: Comando): Estado {
    if (estado === 'borrador' && comando === 'emitir') return 'emitida';
    if (estado === 'emitida' && comando === 'aceptar') return 'aceptada';
    if (estado === 'emitida' && comando === 'rechazar') return 'rechazada';
    if ((estado === 'aceptada' || estado === 'rechazada') && comando === 'revocar_decision') return 'emitida';
    throw new ErrorSeguimiento('La transición ya no es válida. Recarga y compara conservando tu motivo.', 409);
}
export function derivarEstado(eventos: Evento[]): Estado {
    let estado: Estado = 'borrador', anterior: Evento | undefined, decision: string | null = null;
    for (const e of eventos) {
        if (e.numero !== (anterior?.numero ?? 0) + 1 || e.antecedenteId !== (anterior?.id ?? null) || (anterior && (e.revisionId !== anterior.revisionId || e.propuestaId !== anterior.propuestaId || e.revisionHash !== anterior.revisionHash)) || (e.tipo === 'revocar_decision' ? e.decisionRevocadaId !== decision : e.decisionRevocadaId !== null)) throw new ErrorSeguimiento('El historial no supera la comprobación de integridad.', 503);
        try { estado = transicion(estado, e.tipo); } catch { throw new ErrorSeguimiento('El historial contiene una transición inconsistente.', 503); }
        decision = e.tipo === 'aceptar' || e.tipo === 'rechazar' ? e.id : e.tipo === 'revocar_decision' ? null : decision;
        anterior = e;
    }
    return estado;
}

import { type SelectorRegla, type Regla, type CandidataPlan, ErrorPlan, LIMITES_PLAN } from './modelo';
import { createHash } from 'node:crypto';
import { canonico } from './modelo';
export const hashPlan = (v: unknown) => createHash('sha256').update(canonico(v)).digest('hex');
export interface ElementoFuente {
    id: string;
    nombre?: string;
    nota?: string;
    articuloId?: string;
    articuloCableId?: string;
    categoria?: string;
    senal?: string;
    cantidad?: number;
    unidad?: string;
    revision?: number;
    loteId?: string | null;
    identificadorCable?: string | null;
    posicionConfirmada?: boolean;
    articulo?: {
        id: string;
        tipo: string;
        categoria: string;
        marca: string | null;
        modelo: string;
        activo: boolean;
    };
}
export interface SalaFuente {
    id: string;
    nombre: string;
    tipologia: string | null;
    proyectoId: string;
    localizacionId: string;
    disenoVersion: number;
    actualVersion: number;
    tipo: 'actual' | 'revision';
    revisionId?: string;
    revisionNumero?: number;
    revisionNombre?: string;
    hashE3?: string;
    equipos: ElementoFuente[];
    conexiones: ElementoFuente[];
    material: ElementoFuente[];
}
export function tipoPrivado(selector: SelectorRegla) {
    return !['sala', 'tipologia'].includes(selector.tipo);
}
function coincide(selector: SelectorRegla, e: ElementoFuente) {
    if (selector.tipo === 'equipo')
        return (!selector.articuloId || selector.articuloId === e.articuloId) && (!selector.categoria || selector.categoria === e.categoria);
    if (selector.tipo === 'conexion')
        return (!selector.senal || selector.senal === e.senal) && (!selector.articuloCableId || selector.articuloCableId === e.articuloCableId);
    if (selector.tipo === 'material_bom')
        return !selector.articuloId || selector.articuloId === e.articuloId;
    return true;
}
export function generarCandidatas(salas: SalaFuente[], reglas: Regla[]): CandidataPlan[] {
    const candidatas: CandidataPlan[] = [];
    for (const sala of salas)
        for (const regla of reglas) {
            if (!regla.activo || !regla.trabajo.activo)
                continue;
            const selector = regla.selector;
            if (selector.tipo === 'tipologia' && selector.tipologia !== sala.tipologia)
                continue;
            const elementos: ElementoFuente[] = selector.tipo === 'equipo' ? sala.equipos : selector.tipo === 'conexion' ? sala.conexiones : selector.tipo === 'material_bom' ? sala.material : [{ id: sala.id }];
            for (const e of elementos) {
                if (!coincide(selector, e))
                    continue;
                const publico = { salaId: sala.id, salaNombre: sala.nombre, tipologia: sala.tipologia, localizacionId: sala.localizacionId, proyectoId: sala.proyectoId, fuente: sala.tipo, disenoVersion: sala.disenoVersion, actualVersion: sala.actualVersion, revisionId: sala.revisionId ?? null, revisionNumero: sala.revisionNumero ?? null, revisionNombre: sala.revisionNombre ?? null, hashE3: sala.hashE3 ?? null, tipoOrigen: selector.tipo, idOrigen: e.id, posicionEstimada: e.posicionConfirmada === false };
                const privado = tipoPrivado(selector) ? { elemento: e } : {};
                candidatas.push({ clave: hashPlan({ versionClave: 1, reglaId: regla.id, salaId: sala.id, tipoOrigen: selector.tipo, idOrigen: e.id }), salaId: sala.id, reglaId: regla.id, trabajoId: regla.trabajoId, titulo: regla.trabajo.titulo, descripcion: regla.trabajo.descripcion, duracionEstimadaMin: regla.trabajo.duracionEstimadaMin, origenPublico: publico, origenCatalogo: privado });
                if (candidatas.length > LIMITES_PLAN.candidatas)
                    throw new ErrorPlan('LIMITE_EXCEDIDO', 'La propuesta supera 2.000 candidatas. Reduce salas o reglas.', 413);
            }
        }
    return candidatas.sort((a, b) => a.clave.localeCompare(b.clave));
}

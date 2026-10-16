import { autorizar, autorizarBom, type ConexionPropuestas, type IdentidadPropuesta } from './autorizacion';
import { ErrorPropuesta, hash, type Ambito, type EntradaPropuesta, type FuentePropuesta, type LineaFuente, type SalaFuente } from './modelo';
import { conConexionDeLectura } from '../db';
import { cargarSnapshotEnLectura } from '../documentos/datos';
import { avisosDeMaterial, construirBom, necesidadExportada } from '../documentos/tablas';
export async function resolverAmbito(sql: ConexionPropuestas, ambito: Ambito, bloquear = false) {
    const ids = ambito.tipo === 'sala' ? [ambito.id] : [...ambito.salaIds].sort();
    // Orden global: salas por UUID, proyecto y propuesta en último lugar.
    if (bloquear)
        for (const id of ids)
            await sql `select id from salas where id=${id} for update`;
    const salas = await sql<Array<{
        id: string;
        nombre: string;
        codigo: string | null;
        diseno_version: number;
        proyecto_id: string | null;
        cerrado: boolean;
    }>> `
    select s.id,s.nombre,s.codigo,s.diseno_version,l.proyecto_id,
      exists(select 1 from hitos_proyecto h where h.proyecto_id=l.proyecto_id and h.tipo='cierre') cerrado
    from salas s left join localizaciones l on l.id=s.localizacion_id where s.id in ${sql(ids)} order by s.id`;
    if (salas.length !== ids.length)
        throw new ErrorPropuesta('El ámbito ya no está disponible.', 404);
    let nombre = salas[0].nombre, codigo = salas[0].codigo;
    if (ambito.tipo === 'obra') {
        if (bloquear)
            await sql `select id from proyectos where id=${ambito.id} for update`;
        const [obra] = await sql `select id,nombre,codigo,exists(select 1 from hitos_proyecto where proyecto_id=${ambito.id} and tipo='cierre') cerrado from proyectos where id=${ambito.id}`;
        if (!obra)
            throw new ErrorPropuesta('La obra no está disponible.', 404);
        if (salas.some(s => s.proyecto_id !== ambito.id))
            throw new ErrorPropuesta('Cambió la selección de salas de la obra.', 409);
        nombre = obra.nombre;
        codigo = obra.codigo;
        if (obra.cerrado)
            salas.forEach(s => { s.cerrado = true; });
    }
    return { salas: salas.map(s => ({ ...s, diseno_version: Number(s.diseno_version) })), nombre, codigo, cerrado: salas.some(s => s.cerrado) };
}
const cantidad = (v: unknown): string | null => {
    if (v === null || v === undefined)
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0)
        throw new ErrorPropuesta('Cantidad de origen inválida.', 422);
    return n.toFixed(2);
};
/** El JSON proyectado no contiene contexto, catálogo, parámetros ni importes. */
export async function capturarFuente(sql: ConexionPropuestas, u: IdentidadPropuesta, e: EntradaPropuesta, leidaEn = new Date().toISOString()): Promise<FuentePropuesta> {
    autorizar(u, e.ambito);
    const contexto = await resolverAmbito(sql, e.ambito);
    const salas: SalaFuente[] = [];
    const lineas: LineaFuente[] = [];
    const avisos: string[] = [];
    if (e.fuente.tipo === 'diseno') {
        const refs = e.fuente.revisiones;
        if (refs.length !== contexto.salas.length || contexto.salas.some(s => !refs.some(r => r.salaId === s.id)))
            throw new ErrorPropuesta('Selecciona una revisión de diseño por sala.', 422);
        for (const s of contexto.salas) {
            const ref = refs.find(r => r.salaId === s.id)!;
            const [r] = await sql `select id,numero,hash,diseno_version,
        jsonb_build_object('nombre',snapshot->'sala'->'nombre','codigo',snapshot->'sala'->'codigo') sala,
        (select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','articulo_id',x->'articulo_id','nombre',x->'nombre','cantidad',x->'cantidad')),'[]'::jsonb) from jsonb_array_elements(snapshot->'datos'->'equipos') x) equipos,
        (select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','articulo_cable_id',x->'articulo_cable_id','identificador_cable',x->'identificador_cable','senal',x->'senal','longitud_manual_m',x->'longitud_manual_m')),'[]'::jsonb) from jsonb_array_elements(snapshot->'datos'->'conexiones') x) conexiones,
        (select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','articulo_id',x->'articulo_id','cantidad',x->'cantidad','unidad',x->'unidad','nota',x->'nota')),'[]'::jsonb) from jsonb_array_elements(snapshot->'datos'->'material') x) material
        from revisiones_diseno where id=${ref.revisionId} and sala_id=${s.id}`;
            if (!r)
                throw new ErrorPropuesta('La revisión de diseño no pertenece a esta sala.', 404);
            if (Number(r.diseno_version) !== s.diseno_version) {
                avisos.push(`${s.nombre}: revisión histórica; versión actual ${s.diseno_version}, fuente ${r.diseno_version}.`);
                if (!e.aceptoHistorica)
                    throw new ErrorPropuesta('Confirma expresamente el uso de una revisión histórica.', 409);
            }
            salas.push({ id: s.id, nombre: r.sala.nombre ?? s.nombre, codigo: r.sala.codigo ?? null, disenoVersion: Number(r.diseno_version), revisionId: r.id, revisionHash: r.hash, revisionNumero: r.numero });
            for (const x of r.equipos as Array<Record<string, unknown>>)
                lineas.push({ clave: `equipo:${s.id}:${x.id}`, articuloId: String(x.articulo_id), descripcion: String(x.nombre ?? 'Equipo de revisión'), cantidad: cantidad(x.cantidad), unidad: 'ud', detalles: [s.nombre], origen: 'equipo de revisión', enlace: `/salas/${s.id}/equipamiento` });
            for (const x of r.conexiones as Array<Record<string, unknown>>)
                lineas.push({ clave: `conexion:${s.id}:${x.id}`, articuloId: x.articulo_cable_id ? String(x.articulo_cable_id) : null, descripcion: `${x.identificador_cable ?? 'Conexión'} · ${x.senal ?? 'Sin señal'}`, cantidad: cantidad(x.longitud_manual_m), unidad: 'm', detalles: [s.nombre, 'Sólo longitud manual registrada; no se calcula otra necesidad.'], origen: 'conexión de revisión', enlace: `/salas/${s.id}/cableado` });
            for (const x of r.material as Array<Record<string, unknown>>)
                lineas.push({ clave: `material:${s.id}:${x.id}`, articuloId: String(x.articulo_id), descripcion: String(x.nota || 'Partida explícita de revisión'), cantidad: cantidad(x.cantidad), unidad: x.unidad ? String(x.unidad) : null, detalles: [s.nombre], origen: 'partida explícita de revisión', enlace: `/salas/${s.id}/logistica` });
        }
        avisos.push('Equipos/conexiones de la revisión: no es una necesidad completa calculada. Las cantidades ausentes permanecen sin dato.');
    }
    else {
        autorizarBom(u);
        const snapshot = await conConexionDeLectura(sql, () => cargarSnapshotEnLectura(contexto.salas.map(s => s.id), e.ambito.tipo === 'obra' ? e.ambito.id : undefined));
        for (const s of snapshot.salas) {
            const r = s.revisionDiseno;
            salas.push({ id: s.sala.id, nombre: s.sala.nombre, codigo: s.sala.codigo, disenoVersion: contexto.salas.find(c => c.id === s.sala.id)!.diseno_version,
                revisionId: r?.estado === 'revision' ? r.id : null, revisionHash: r?.hash ?? null, revisionNumero: r?.estado === 'revision' ? r.numero : null });
            // Usa también la necesidad original para conservar sus detalles por sala.
            necesidadExportada(snapshot, s);
        }
        for (const l of construirBom(snapshot, snapshot.salas))
            lineas.push({ clave: `bom:${l.articulo_id}:${l.unidad}`, articuloId: l.articulo_id, descripcion: l.descripcion, cantidad: cantidad(l.cantidad), unidad: l.unidad, detalles: l.detalle, origen: l.origenes.join(' + '), enlace: e.ambito.tipo === 'sala' ? `/salas/${e.ambito.id}/logistica` : `/proyectos/${e.ambito.id}` });
        avisos.push(...avisosDeMaterial(snapshot, snapshot.salas));
        if (salas.some(s => !s.revisionId))
            avisos.push('Captura BOM con diseño borrador; no se presenta como revisión E3 guardada.');
    }
    if (lineas.length > 2000)
        throw new ErrorPropuesta('La fuente supera dos mil líneas.', 413);
    return { tipo: e.fuente.tipo, leidaEn, etiqueta: e.fuente.tipo === 'diseno' ? 'Equipos/conexiones de la revisión' : 'Necesidad completa BOM confirmada', ambito: e.ambito, nombre: contexto.nombre, codigo: contexto.codigo, salas, lineas: lineas.sort((a, b) => a.clave.localeCompare(b.clave)), avisos, comprobacion: hash(contexto.salas.map(s => ({ id: s.id, proyectoId: s.proyecto_id, version: s.diseno_version }))) };
}
export async function frescura(sql: ConexionPropuestas, u: IdentidadPropuesta, f: FuentePropuesta) {
    autorizar(u, f.ambito);
    try {
        const c = await resolverAmbito(sql, f.ambito);
        const cambiada = f.salas.some(s => c.salas.find(x => x.id === s.id)?.diseno_version !== s.disenoVersion) || hash(c.salas.map(s => ({ id: s.id, proyectoId: s.proyecto_id, version: s.diseno_version }))) !== f.comprobacion;
        return { estado: cambiada ? 'desactualizada' : f.tipo === 'bom' ? 'no_comprobable' : 'actual', motivo: cambiada ? 'Cambió el diseño o la selección de salas.' : f.tipo === 'bom' ? 'Versiones de sala comprobadas; otras fuentes BOM requieren actualización explícita autorizada.' : 'Comparadas las versiones y la selección de salas.', comprobadoEn: new Date().toISOString() };
    }
    catch (error) {
        if (!(error instanceof ErrorPropuesta))
            throw error;
        return { estado: 'desactualizada', motivo: 'El ámbito original ha cambiado.', comprobadoEn: new Date().toISOString() };
    }
}
export function diffFuentes(anterior: FuentePropuesta, nueva: FuentePropuesta) {
    const a = new Map(anterior.lineas.map(l => [l.clave, l])), b = new Map(nueva.lineas.map(l => [l.clave, l]));
    return { nuevas: nueva.lineas.filter(l => !a.has(l.clave)), retiradas: anterior.lineas.filter(l => !b.has(l.clave)), cambiadas: nueva.lineas.filter(l => a.has(l.clave) && hash(a.get(l.clave)) !== hash(l)), conservadas: nueva.lineas.filter(l => a.has(l.clave) && hash(a.get(l.clave)) === hash(l)).map(l => l.clave) };
}

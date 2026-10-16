import { type ConexionPlan, type AutorPlan, exigirPlan } from './autorizacion';
import { ErrorPlan, type Regla, type SeleccionPlan } from './modelo';
import { tipoPrivado, type SalaFuente, type ElementoFuente } from './reglas';
export async function salasDeObra(c: ConexionPlan, proyectoId: string) {
    return c<{
        id: string;
        nombre: string;
        tipologia: string | null;
        localizacion_id: string;
        diseno_version: number;
    }[]> `select s.id,s.nombre,s.tipologia,s.localizacion_id,s.diseno_version from salas s join localizaciones l on l.id=s.localizacion_id where l.proyecto_id=${proyectoId} order by s.id`;
}
export async function leerFuentes(c: ConexionPlan, u: AutorPlan, proyectoId: string, seleccion: SeleccionPlan, reglas: Regla[]): Promise<SalaFuente[]> {
    exigirPlan(u, false, true, reglas.some(r => tipoPrivado(r.selector)));
    const todas = await salasDeObra(c, proyectoId);
    if (todas.length > 500 && seleccion.salas.modo === 'todas')
        throw new ErrorPlan('LIMITE_EXCEDIDO', 'Selecciona como máximo 500 salas.', 413);
    const elegidas = seleccion.salas.modo === 'todas' ? todas : todas.filter(s => (seleccion.salas as {
        ids: string[];
    }).ids.includes(s.id));
    if (seleccion.salas.modo === 'seleccion' && elegidas.length !== seleccion.salas.ids.length)
        throw new ErrorPlan('SALA_AJENA', 'Alguna sala no pertenece actualmente a la obra.', 404);
    if (seleccion.fuentes.length !== elegidas.length || seleccion.fuentes.some(f => !elegidas.some(s => s.id === f.salaId)))
        throw new ErrorPlan(seleccion.salas.modo === 'todas' ? 'PREVIEW_CAMBIADO' : 'FUENTE_INVALIDA', 'El conjunto de fuentes ya no coincide con las salas. Vuelve a preparar.', seleccion.salas.modo === 'todas' ? 409 : 400);
    const tipos = new Set(reglas.map(r => r.selector.tipo));
    const resultado: SalaFuente[] = [];
    for (const s of elegidas) {
        const elegida = seleccion.fuentes.find(f => f.salaId === s.id)!;
        const sala: SalaFuente = { id: s.id, nombre: s.nombre, tipologia: s.tipologia, localizacionId: s.localizacion_id, proyectoId, disenoVersion: Number(s.diseno_version), actualVersion: Number(s.diseno_version), tipo: elegida.tipo, equipos: [], conexiones: [], material: [] };
        if (elegida.tipo === 'revision') {
            const [r] = await c `select id,numero,nombre,hash,diseno_version,snapshot->>'formato' formato,snapshot->'sala'->>'tipologia' tipologia from revisiones_diseno where id=${elegida.revisionId!} and sala_id=${s.id}`;
            if (!r)
                throw new ErrorPlan('REVISION_AJENA', 'La revisión no pertenece a esta sala.', 404);
            if (r.formato !== '1')
                throw new ErrorPlan('FUENTE_NO_SOPORTADA', 'La versión de revisión no está soportada.', 422);
            Object.assign(sala, { revisionId: r.id, revisionNumero: Number(r.numero), revisionNombre: r.nombre, hashE3: r.hash, disenoVersion: Number(r.diseno_version), tipologia: r.tipologia });
        }
        for (const grupo of ['equipos', 'conexiones', 'material'] as const) {
            if (!tipos.has(grupo === 'equipos' ? 'equipo' : grupo === 'conexiones' ? 'conexion' : 'material_bom'))
                continue;
            if (elegida.tipo === 'actual') {
                if (grupo === 'equipos') {
                    const filas = await c `select e.id,e.nombre,e.articulo_id,e.cantidad,e.posicion_confirmada,a.tipo,a.categoria,a.marca,a.modelo,a.activo from sala_equipos e join articulos a on a.id=e.articulo_id where e.sala_id=${s.id} order by e.id`;
                    sala.equipos = filas.map(e => ({ id: e.id, nombre: e.nombre, articuloId: e.articulo_id, cantidad: Number(e.cantidad), posicionConfirmada: e.posicion_confirmada, categoria: e.categoria, articulo: { id: e.articulo_id, tipo: e.tipo, categoria: e.categoria, marca: e.marca, modelo: e.modelo, activo: e.activo } }));
                }
                else if (grupo === 'conexiones') {
                    const filas = await c `select id,articulo_cable_id,senal,identificador_cable from conexiones where sala_id=${s.id} order by id`;
                    sala.conexiones = filas.map(e => ({ id: e.id, articuloCableId: e.articulo_cable_id, senal: e.senal, identificadorCable: e.identificador_cable }));
                }
                else {
                    const filas = await c `select b.id,b.articulo_id,b.cantidad,b.unidad,b.revision,b.lote_id,b.nota,a.tipo,a.categoria,a.marca,a.modelo,a.activo from sala_material_bom b join articulos a on a.id=b.articulo_id where b.sala_id=${s.id} order by b.id`;
                    sala.material = filas.map(e => ({ id: e.id, articuloId: e.articulo_id, cantidad: Number(e.cantidad), unidad: e.unidad, revision: Number(e.revision), loteId: e.lote_id, nota: e.nota, articulo: { id: e.articulo_id, tipo: e.tipo, categoria: e.categoria, marca: e.marca, modelo: e.modelo, activo: e.activo } }));
                }
            }
            else {
                // La proyección JSON se realiza en SQL. No sale el snapshot privado íntegro.
                const filas = await c `select e->>'id' id,e->>'nombre' nombre,e->>'nota' nota,e->>'articulo_id' articulo_id,e->>'articulo_cable_id' articulo_cable_id,e->>'cantidad' cantidad,e->>'unidad' unidad,e->>'revision' revision,e->>'lote_id' lote_id,e->>'senal' senal,e->>'identificador_cable' identificador_cable,e->>'posicion_confirmada' posicion_confirmada from revisiones_diseno r cross join lateral jsonb_array_elements(r.snapshot->'datos'->${grupo}) e where r.id=${elegida.revisionId!} and r.sala_id=${s.id} order by e->>'id'`;
                const elementos: ElementoFuente[] = [];
                for (const e of filas) {
                    if (!e.id)
                        throw new ErrorPlan('FUENTE_NO_SOPORTADA', 'La revisión contiene un origen sin identidad.', 422);
                    const elemento: ElementoFuente = grupo === 'equipos' ? { id: e.id, nombre: e.nombre, articuloId: e.articulo_id, cantidad: Number(e.cantidad), posicionConfirmada: e.posicion_confirmada === 'true' } : grupo === 'conexiones' ? { id: e.id, articuloCableId: e.articulo_cable_id, senal: e.senal, identificadorCable: e.identificador_cable } : { id: e.id, articuloId: e.articulo_id, cantidad: Number(e.cantidad), unidad: e.unidad, revision: Number(e.revision), loteId: e.lote_id, nota: e.nota };
                    const articuloId = elemento.articuloId ?? elemento.articuloCableId;
                    if (articuloId) {
                        const [a] = await c `select a->>'id' id,a->>'tipo' tipo,a->>'categoria' categoria,a->>'marca' marca,a->>'modelo' modelo,a->>'activo' activo from revisiones_diseno r cross join lateral jsonb_array_elements(r.snapshot->'contexto'->'articulos') a where r.id=${elegida.revisionId!} and a->>'id'=${articuloId}`;
                        const [actual] = await c `select activo from articulos where id=${articuloId}`;
                        if (a) {
                            elemento.categoria = a.categoria;
                            elemento.articulo = { id: a.id, tipo: a.tipo, categoria: a.categoria, marca: a.marca, modelo: a.modelo, activo: actual?.activo === true };
                        }
                    }
                    elementos.push(elemento);
                }
                sala[grupo] = elementos;
            }
        }
        resultado.push(sala);
    }
    return resultado;
}

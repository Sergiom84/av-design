import { conLecturaConsistente, sql as conexion } from '../db';
import { cargarSnapshotEnLectura } from '../documentos/datos';
import { construirBom, necesidadExportada, COLUMNAS_BOM, filaBom, sumaConocida } from '../documentos/tablas';
import { estadoDeSalaEnPortada, ETIQUETA_ESTADO_SALA } from '../proyecto';
import { resumenCarga, avisoDeCierre } from '../carga';
import { SIGNO_MOVIMIENTO } from '../almacen';
import type { TipoMovimiento } from '../tipos';
import { identidadActual, autorizarAmbitoInforme, exigirDistribucion, distribuye, origenVigente, type ConexionInformes, type OrigenReceptor } from './autorizacion';
import { REGISTRO_INFORMES } from './registro';
import { ErrorInforme, LIMITES, GENERADOR, compararTexto, type AmbitoInforme, type AmbitoResuelto, type DefinicionCongelada, type PeriodoResuelto, type SnapshotInforme, type FilaInforme } from './modelo';
export async function resolverAmbito(sql: ConexionInformes, ambito: AmbitoInforme, jerarquia: boolean): Promise<AmbitoResuelto> {
    let nombre: string;
    let filas;
    if (ambito.tipo === 'sala' && !jerarquia) {
        filas = await sql `select id,nombre,codigo from salas where id=${ambito.id}`;
        if (!filas.length)
            throw new ErrorInforme('AMBITO_CAMBIADO', 'La sala ya no está disponible.', 409);
        nombre = filas[0].nombre;
    }
    else {
        if (ambito.tipo === 'sala') {
            filas = await sql `select s.id,s.nombre,s.codigo,p.id as proyecto_id,p.nombre as proyecto_nombre,case when p.id is not null then p.sede_id else s.sede_id end as sede_id,l.nombre as localizacion from salas s left join localizaciones l on l.id=s.localizacion_id left join proyectos p on p.id=l.proyecto_id where s.id=${ambito.id}`;
            if (!filas.length)
                throw new ErrorInforme('AMBITO_CAMBIADO', 'La sala ya no está disponible.', 409);
            nombre = filas[0].nombre;
        }
        else {
            const seleccion = ambito.salaIds ?? null;
            const filtro = seleccion ? sql `and s.id in ${sql(seleccion.length ? seleccion : ['00000000-0000-0000-0000-000000000000'])}` : sql ``;
            const entidad = ambito.tipo === 'obra' ? await sql `select id,nombre from proyectos where id=${ambito.id}` : await sql `select id,nombre from sedes where id=${ambito.id}`;
            if (!entidad.length)
                throw new ErrorInforme('AMBITO_CAMBIADO', 'El ámbito ya no está disponible.', 409);
            nombre = entidad[0].nombre;
            filas = ambito.tipo === 'obra' ? await sql `select s.id,s.nombre,s.codigo,p.id as proyecto_id,p.nombre as proyecto_nombre,p.sede_id,l.nombre as localizacion from salas s left join localizaciones l on l.id=s.localizacion_id left join proyectos p on p.id=l.proyecto_id where p.id=${ambito.id} ${filtro} order by s.id limit 501` : await sql `select s.id,s.nombre,s.codigo,p.id as proyecto_id,p.nombre as proyecto_nombre,case when p.id is not null then p.sede_id else s.sede_id end as sede_id,l.nombre as localizacion from salas s left join localizaciones l on l.id=s.localizacion_id left join proyectos p on p.id=l.proyecto_id where (case when p.id is not null then p.sede_id else s.sede_id end)=${ambito.id} ${filtro} order by s.id limit 501`;
        }
    }
    if (filas.length > LIMITES.salas)
        throw new ErrorInforme('LIMITE_EXCEDIDO', 'Selecciona como máximo quinientas salas.', 413);
    if (ambito.tipo !== 'sala' && ambito.salaIds) {
        const presentes = new Set(filas.map(s => s.id));
        if (ambito.salaIds.some(id => !presentes.has(id)))
            throw new ErrorInforme('AMBITO_CAMBIADO', 'Una sala seleccionada fue eliminada o trasladada.', 409);
        filas = filas.filter(s => ambito.salaIds!.includes(s.id));
    }
    const proyectos = jerarquia ? (ambito.tipo === 'obra' ? await sql `select id,nombre,codigo from proyectos where id=${ambito.id}` : ambito.tipo === 'sede' ? await sql `select id,nombre,codigo from proyectos where sede_id=${ambito.id} order by id` : []) : [];
    return { solicitado: ambito, nombre, salas: filas.map(s => ({ id: s.id, nombre: s.nombre, codigo: s.codigo, ...jerarquia ? { proyectoId: s.proyecto_id ?? null, proyectoNombre: s.proyecto_nombre ?? null, sedeId: s.sede_id ?? null, localizacion: s.localizacion ?? null } : {} })).sort((a, b) => compararTexto(a.nombre, b.nombre) || compararTexto(a.id, b.id)), proyectos: proyectos.map(p => ({ id: p.id, nombre: p.nombre, codigo: p.codigo })) };
}
interface CapturaEntrada {
    id: string;
    definicion: DefinicionCongelada;
    definicionSha256: string;
    periodo: PeriodoResuelto;
    ocurrencia: string;
}
/** Inyección para pruebas; producción y CLI comparten el contexto MVCC E1. */
export async function capturarInforme(e: CapturaEntrada, opciones: {
    sql?: ConexionInformes;
    consistente?: <T>(leer: () => Promise<T>) => Promise<T>;
} = {}): Promise<SnapshotInforme> {
    const sql = opciones.sql ?? conexion;
    const consistente = opciones.consistente ?? conLecturaConsistente;
    return consistente(async () => {
        const c = e.definicion.configuracion;
        const propietario = await identidadActual(sql, e.definicion.propietarioId);
        autorizarAmbitoInforme(propietario, c);
        if (distribuye(c, propietario.id))
            exigirDistribucion(propietario);
        // ACL congelada revisada antes de la primera fuente, sin confiar en permisos serializados.
        const receptores = await sql `select usuario_id,origenes from informes_receptores where ejecucion_id=${e.id} and revocado_en is null and excluido_codigo is null`;
        for (const r of receptores)
            if (r.usuario_id !== propietario.id) {
                try {
                    const u = await identidadActual(sql, r.usuario_id);
                    autorizarAmbitoInforme(u, c);
                    if (!await origenVigente(sql, e.id, r.usuario_id, propietario.id, r.origenes as OrigenReceptor[]))
                        throw new ErrorInforme('PERMISO_RETIRADO', 'El grupo ya no concede acceso.', 403);
                }
                catch (error) {
                    if (!(error instanceof ErrorInforme) || error.status === 503)
                        throw error; /* El repositorio registra la exclusión antes de esta lectura. */
                }
            }
        const [reloj] = await sql `select transaction_timestamp() as observado`;
        const observadoEn = new Date(reloj.observado).toISOString();
        const ambito = await resolverAmbito(sql, c.ambito, c.clave === 'material_actual' || c.ambito.tipo !== 'sala');
        const salaIds = ambito.salas.map(s => s.id);
        const nombres = new Map(ambito.salas.map(s => [s.id, s.nombre]));
        let filas: FilaInforme[] = [];
        let columnas = REGISTRO_INFORMES[c.clave].columnas;
        const avisos: string[] = [];
        let material: SnapshotInforme['material'];
        let detalleMaterial: unknown;
        let resumen: SnapshotInforme['resumen'];
        if (new Date(observadoEn).getTime() - new Date(e.ocurrencia).getTime() > 60000)
            avisos.push('Captura posterior a la hora prevista.');
        if (e.periodo.modo === 'rango')
            avisos.push('Hechos que permanecen registrados en el momento de lectura; no es un historial inmutable.');
        if (c.clave === 'material_actual') {
            columnas = COLUMNAS_BOM.map(([clave, titulo]) => ({ clave, titulo, tipo: ['necesidad', 'existencias', 'reservado_total', 'disponible_libre', 'reservado_propio', 'disponible_para_seleccion', 'a_comprar', 'precio_unitario_eur', 'importe_necesidad_eur', 'importe_compra_eur'].includes(clave) ? 'numero' : 'texto' }));
            {
                material = await cargarSnapshotEnLectura(salaIds, c.ambito.tipo === 'obra' ? c.ambito.id : undefined);
                material.creadoEn = observadoEn;
                const bom = construirBom(material, material.salas);
                resumen = { importe_necesidad_conocido_eur: sumaConocida(bom.map(l => l.importe_necesidad)), importe_compra_conocido_eur: sumaConocida(bom.map(l => l.importe_compra)), articulos_sin_precio: bom.filter(l => l.precio_unitario === null).length };
                columnas = COLUMNAS_BOM.map(([clave, titulo]) => ({ clave, titulo, tipo: ['necesidad', 'existencias', 'reservado_total', 'disponible_libre', 'reservado_propio', 'disponible_para_seleccion', 'a_comprar', 'precio_unitario_eur', 'importe_necesidad_eur', 'importe_compra_eur'].includes(clave) ? 'numero' : 'texto' }));
                filas = bom.map(l => ({ clave: l.articulo_id, valores: Object.fromEntries(COLUMNAS_BOM.map(([k], i) => [k, filaBom(l)[i]])) }));
                detalleMaterial = material.salas.map(s => ({ salaId: s.sala.id, necesidad: necesidadExportada(material!, s) }));
                for (const s of material.salas)
                    for (const r of s.resultadosCable)
                        if ('avisos' in r && Array.isArray(r.avisos))
                            avisos.push(...r.avisos);
            }
        }
        else if (c.clave === 'material_movimientos' && e.periodo.modo === 'rango' && salaIds.length) {
            const r = await sql `select m.id,m.fecha,m.sala_id,m.tipo::text,m.cantidad,trim(concat_ws(' ',a.marca,a.modelo)) as descripcion,a.unidad,m.motivo,m.quien from movimientos m join articulos a on a.id=m.articulo_id where m.sala_id in ${sql(salaIds)} and m.fecha>=${e.periodo.desdeUtc} and m.fecha<${e.periodo.hastaUtcExclusivo} order by m.fecha,m.id limit 10001`;
            filas = r.map(x => ({ clave: x.id, enlace: `/salas/${x.sala_id}`, valores: { fecha: new Date(x.fecha).toISOString(), sala: nombres.get(x.sala_id) ?? null, articulo: x.descripcion, tipo: x.tipo, cantidad: Number(x.cantidad), unidad: x.unidad, signo: SIGNO_MOVIMIENTO[x.tipo as TipoMovimiento], cantidadNeta: Number(x.cantidad) * SIGNO_MOVIMIENTO[x.tipo as TipoMovimiento], motivo: x.motivo, quien: x.quien } }));
        }
        else if (c.clave === 'carga_hechos' && e.periodo.modo === 'rango' && salaIds.length) {
            const r = await sql `select id,sala_id,nombre,creado_en,cerrado_en from cargas where sala_id in ${sql(salaIds)} and ((creado_en>=${e.periodo.desdeUtc} and creado_en<${e.periodo.hastaUtcExclusivo}) or (cerrado_en>=${e.periodo.desdeUtc} and cerrado_en<${e.periodo.hastaUtcExclusivo})) order by id limit 10001`;
            for (const x of r)
                for (const [hecho, fecha] of [['alta', x.creado_en], ['cierre', x.cerrado_en]] as const)
                    if (fecha && +new Date(fecha) >= +new Date(e.periodo.desdeUtc) && +new Date(fecha) < +new Date(e.periodo.hastaUtcExclusivo))
                        filas.push({ clave: `${x.id}:${hecho}`, enlace: `/carga/${x.id}`, valores: { fecha: new Date(fecha).toISOString(), sala: nombres.get(x.sala_id) ?? null, carga: x.nombre, hecho } });
        }
        else if (c.clave === 'carga_actual' && salaIds.length) {
            const cargas = await sql `select id,sala_id,nombre,estado::text from cargas where sala_id in ${sql(salaIds)} order by id limit 10001`;
            for (const carga of cargas) {
                const lineas = await sql `select l.id,l.cantidad,l.cargado,l.instalado,l.devuelto,l.roto,trim(concat_ws(' ',a.marca,a.modelo)) as descripcion,a.unidad from carga_lineas l join articulos a on a.id=l.articulo_id where carga_id=${carga.id} order by l.id limit 10001`;
                const resumen = resumenCarga(lineas.map(l => ({ cantidad: Number(l.cantidad), cargado: l.cargado })));
                if (!lineas.length)
                    filas.push({ clave: carga.id, enlace: `/carga/${carga.id}`, valores: { sala: nombres.get(carga.sala_id) ?? null, carga: carga.nombre, estado: carga.estado, articulo: null, cantidad: null, unidad: null, cargado: null, instalado: null, devuelto: null, roto: null, lineas: 0, pendientes: 0 } });
                for (const l of lineas) {
                    const aviso = avisoDeCierre({ cantidad: Number(l.cantidad), instalado: Number(l.instalado), devuelto: Number(l.devuelto), roto: Number(l.roto), descripcion: l.descripcion });
                    if (carga.estado === 'cerrada' && aviso)
                        avisos.push(`${carga.nombre}: ${l.descripcion}: ${aviso}`);
                    filas.push({ clave: l.id, enlace: `/carga/${carga.id}`, valores: { sala: nombres.get(carga.sala_id) ?? null, carga: carga.nombre, estado: carga.estado, articulo: l.descripcion, cantidad: Number(l.cantidad), unidad: l.unidad, cargado: l.cargado, instalado: Number(l.instalado), devuelto: Number(l.devuelto), roto: Number(l.roto), lineas: resumen.lineas, pendientes: resumen.pendientes } });
                }
                if (filas.length > LIMITES.filas)
                    throw new ErrorInforme('LIMITE_EXCEDIDO', 'Más de diez mil filas.', 413);
            }
        }
        else if (c.clave === 'estado_actual') {
            if (salaIds.length) {
                const salas = await sql `select s.id,s.nombre,s.codigo,s.largo_m,s.ancho_m,s.alto_m,exists(select 1 from hitos_sala h where h.sala_id=s.id and h.tipo='instalacion') as instalada,exists(select 1 from hitos_sala h where h.sala_id=s.id and h.tipo='entrega') as entregada from salas s where s.id in ${sql(salaIds)} order by s.nombre,s.id`;
                filas = salas.map(s => ({ clave: s.id, enlace: `/salas/${s.id}`, valores: { tipo: 'sala', nombre: s.nombre, codigo: s.codigo, estado: ETIQUETA_ESTADO_SALA[estadoDeSalaEnPortada({ id: s.id, nombre: s.nombre, codigo: s.codigo, instalada: s.instalada, entregada: s.entregada, largo_m: Number(s.largo_m), ancho_m: Number(s.ancho_m), alto_m: Number(s.alto_m), localizacion_id: null, n_conexiones: 0 })] } }));
            }
            for (const p of ambito.proyectos) {
                const h = await sql `select tipo from hitos_proyecto where proyecto_id=${p.id}`;
                filas.push({ clave: p.id, enlace: `/proyectos/${p.id}`, valores: { tipo: 'obra', nombre: p.nombre, codigo: p.codigo, estado: h.some(x => x.tipo === 'cierre') ? 'cerrada' : h.some(x => x.tipo === 'inicio') ? 'en curso' : 'sin iniciar' } });
            }
        }
        else if (c.clave === 'estado_hitos' && e.periodo.modo === 'rango') {
            if (salaIds.length) {
                const h = await sql `select h.id,h.sala_id,h.tipo,h.fecha::text,h.notas,t.nombre as tecnico from hitos_sala h left join tecnicos t on t.id=h.tecnico_id where h.sala_id in ${sql(salaIds)} and h.fecha>=${e.periodo.desde}::date and h.fecha<=${e.periodo.hasta}::date order by h.fecha,h.id limit 10001`;
                filas = h.map(x => ({ clave: x.id, enlace: `/salas/${x.sala_id}`, valores: { fecha: x.fecha, tipoEntidad: 'sala', nombre: nombres.get(x.sala_id) ?? null, tipo: x.tipo, tecnico: x.tecnico ?? null, nota: x.notas } }));
            }
            if (ambito.proyectos.length) {
                const h = await sql `select h.id,h.proyecto_id,h.tipo,h.fecha::text,h.notas,t.nombre as tecnico from hitos_proyecto h left join tecnicos t on t.id=h.tecnico_id where h.proyecto_id in ${sql(ambito.proyectos.map(p => p.id))} and h.fecha>=${e.periodo.desde}::date and h.fecha<=${e.periodo.hasta}::date order by h.fecha,h.id limit 10001`;
                filas.push(...h.map(x => ({ clave: x.id, enlace: `/proyectos/${x.proyecto_id}`, valores: { fecha: x.fecha, tipoEntidad: 'obra', nombre: ambito.proyectos.find(p => p.id === x.proyecto_id)?.nombre ?? null, tipo: x.tipo, tecnico: x.tecnico ?? null, nota: x.notas } })));
            }
        }
        if (filas.length > LIMITES.filas)
            throw new ErrorInforme('LIMITE_EXCEDIDO', 'Más de diez mil filas; reduce el ámbito.', 413);
        filas.sort((a, b) => compararTexto(String(a.valores.fecha ?? a.valores.nombre ?? a.valores.sala ?? a.valores.descripcion ?? ''), String(b.valores.fecha ?? b.valores.nombre ?? b.valores.sala ?? b.valores.descripcion ?? '')) || compararTexto(a.clave, b.clave));
        return { versionModelo: 1, versionGenerador: GENERADOR, revision: '', ejecucionId: e.id, definicion: e.definicion, definicionSha256: e.definicionSha256, periodo: e.periodo, ambito, previstaEn: e.ocurrencia, observadoEn, columnas, filas, ...resumen ? { resumen } : {}, avisos: [...new Set(avisos)].sort(compararTexto), ...material ? { material, detalleMaterial } : {} };
    });
}

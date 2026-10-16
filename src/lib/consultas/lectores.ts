import { createHash } from 'node:crypto';
import { calcularConexion, type ResultadoCable } from '../calculo-cable';
import { construirTablaCables } from '../cable-schedule';
import { necesidadExportada } from '../necesidad-tecnica';
import { validarCatalogo } from '../preferencias-usuario';
import { PARAMETROS_POR_DEFECTO, type Sala, type EquipoEnSala, type Conexion, type Puerto, type TomaRed, type ParametrosCable, type Articulo } from '../tipos';
import type { LineaMaterialBom } from '../compras';
import { datosTecnicosSchema } from '../catalogo-tecnico';
import type { DatosTecnicos } from '../catalogo-tecnico-repositorio';
import { puede } from '../usuarios';
import { canonico, ErrorConsulta, CLAVES_PARAMETROS_CONSULTA, type AmbitoConsulta, type ClasificacionConsulta, type FuenteConsulta, type HechoConsulta } from './modelo';
import { exigirConsulta, requisitosConsulta, type IdentidadConsulta, type SqlConsulta } from './autorizacion';
export const hashConsulta = (v: unknown) => createHash('sha256').update(canonico(v)).digest('hex');
export interface ProyeccionConsulta {
    fuente: FuenteConsulta;
    datos: unknown;
    hechos: HechoConsulta[];
    avisos: string[];
    href: string;
    etiqueta?: string;
    observadoEn?: string;
    borrador?: boolean;
}
type ArticuloTecnico = Pick<Articulo, 'id' | 'marca' | 'modelo' | 'unidad' | 'bobina_m' | 'longitudes_comerciales_m' | 'senal'>;
const n = (v: unknown): number | null => v == null ? null : Number(v);
function numericos<T extends object>(obj: T, claves: readonly string[]): T { const r = { ...obj }; for (const k of claves)
    if (k in r)
        (r as Record<string, unknown>)[k] = n((r as Record<string, unknown>)[k]); return r; }
function fuente(tipo: FuenteConsulta['tipo'], id: string, a: AmbitoConsulta, datos: unknown, intent: ClasificacionConsulta): FuenteConsulta { return { tipo, id, ambito: a, hash: hashConsulta(datos), secciones: requisitosConsulta(intent.intent, a), ...(intent.cableId ? { cableId: intent.cableId } : {}) }; }
export async function revisionTecnica(sql: SqlConsulta, salaId: string) {
    const [s] = await sql `select diseno_version from salas where id=${salaId}`;
    if (!s)
        throw new ErrorConsulta('FUENTE', 'Una fuente ya no está disponible.', 409);
    const [r] = await sql `select id,numero,hash,diseno_version from revisiones_diseno where sala_id=${salaId} order by numero desc,id limit 1`;
    return { disenoVersion: Number(s.diseno_version), revisionId: r?.id ?? null, revisionNumero: r ? Number(r.numero) : null, revisionHash: r?.hash ?? null, borrador: !r || Number(r.diseno_version) !== Number(s.diseno_version) };
}
const camposMedida = ['largo_m', 'ancho_m', 'alto_m', 'mesa_largo_m', 'mesa_ancho_m', 'mesa_alto_cm', 'mesa_x_m', 'mesa_y_m'] as const;
export async function proyectarSala(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, id: string, intent: ClasificacionConsulta): Promise<ProyeccionConsulta> {
    exigirConsulta(u, requisitosConsulta(intent.intent, a));
    const rev = await revisionTecnica(sql, id);
    let datos: unknown, hechos: HechoConsulta[] = [];
    const avisos: string[] = [];
    const href = `/salas/${id}`;
    const hecho = (etiqueta: string, valor: string | number | null, campo: string, unidad?: string, ausencia?: HechoConsulta['ausencia']): HechoConsulta => ({ etiqueta, valor, fuenteId: id, campo, ...(unidad ? { unidad } : {}), ...(ausencia ? { ausencia } : {}) });
    if (intent.intent === 'medidas') {
        const [r] = await sql `select id,largo_m,ancho_m,alto_m,mesa_largo_m,mesa_ancho_m,mesa_alto_cm,mesa_x_m,mesa_y_m from salas where id=${id}`;
        if (!r)
            throw new ErrorConsulta('FUENTE', 'La sala ya no está disponible.', 409);
        const s = numericos(r, camposMedida);
        datos = s;
        const etiquetas = ['Largo de sala', 'Ancho de sala', 'Alto de sala', 'Largo de mesa', 'Ancho de mesa', 'Alto de mesa', 'Centro de mesa X', 'Centro de mesa Y'];
        hechos = camposMedida.map((c, i) => hecho(etiquetas[i], s[c] as number | null, `salas.${c}`, c === 'mesa_alto_cm' ? 'cm' : 'm', s[c] == null ? 'sin_dato' : undefined));
        if (!Number(s.largo_m) || !Number(s.ancho_m) || !Number(s.alto_m))
            avisos.push('Las dimensiones cero registradas no permiten calcular un recorrido. No se han sustituido por medidas estimadas.');
    }
    else if (intent.intent === 'equipos') {
        const esCatalogo = puede(u.permisos, 'catalogo', 'ver');
        const filas = await leerEquipos(sql, id);
        const articulos = esCatalogo && filas.length ? await sql `select a.id,a.marca,a.modelo,a.categoria from articulos a where a.id in ${sql([...new Set(filas.map(e => e.articulo_id).filter(Boolean))])} order by a.id` : [];
        datos = { equipos: filas, ...(esCatalogo ? { articulos } : {}) };
        hechos = filas.flatMap(e => [hecho(e.nombre, e.cantidad, `sala_equipos:${e.id}.cantidad`, 'ud'), hecho(`${e.nombre} · posición confirmada`, e.posicion_confirmada ? 'Sí' : 'No', `sala_equipos:${e.id}.posicion_confirmada`), ...(['x_m', 'y_m', 'z_m'] as const).map(c => hecho(`${e.nombre} · ${c[0].toUpperCase()}`, e.posicion_confirmada ? e.posicion[c] : null, `sala_equipos:${e.id}.${c}`, 'm', !e.posicion_confirmada ? 'sin_dato' : undefined)), ...(esCatalogo ? (() => { const ar = articulos.find(f => f.id === e.articulo_id); return ar ? [hecho(`${e.nombre} · modelo`, `${ar.marca ?? ''} ${ar.modelo}`.trim(), `articulos:${ar.id}.modelo`), hecho(`${e.nombre} · categoría`, ar.categoria ?? 'Sin categoría', `articulos:${ar.id}.categoria`)] : []; })() : [])]);
        if (!filas.length)
            hechos = [hecho('Equipos registrados', null, 'sala_equipos', 'ud', 'sin_filas')];
        const f = fuente('equipos', id, a, { ...rev, datos }, intent);
        if (esCatalogo)
            f.secciones = [...new Set([...f.secciones, 'catalogo' as const])];
        f.versionAnclas = 1;
        f.filas = [...filas.map(e => ({ tabla: 'sala_equipos' as const, id: e.id })), ...articulos.map(ar => ({ tabla: 'articulos' as const, id: String(ar.id) }))];
        return { fuente: { ...f, ...sinBorrador(rev) }, datos, hechos, avisos, borrador: rev.borrador, href: `${href}/equipamiento` };
    }
    else {
        const tecnicos = await leerTecnica(sql, id, intent.intent !== 'conexiones');
        const { sala, equipos, conexiones, puertos, tomas, articulos, parametros, bom } = tecnicos;
        const equiposPorId = new Map(equipos.map(e => [e.id, e]));
        const resultadosCable: ResultadoCable[] = intent.intent === 'conexiones' || !sala.largo_m || !sala.ancho_m || !sala.alto_m ? [] : conexiones.map(c => calcularConexion(c, sala, equiposPorId, new Map(articulos.map(a => [a.id, a])), parametros)).filter((r): r is ResultadoCable => r !== null);
        const filas = construirTablaCables({ conexiones, equipos: equiposPorId, puertos: new Map(puertos.map(p => [p.id, p])), tomas: new Map(tomas.map(t => [t.id, t])), articulos: new Map(articulos.map(ar => [ar.id, ar])), resultados: new Map(resultadosCable.map(r => [r.conexion_id, r])) });
        datos = tecnicos;
        const elegidas = intent.cableId ? filas.filter(f => f.identificador === intent.cableId) : filas;
        if (intent.intent === 'necesidad') {
            const necesidad = necesidadExportada({ articulos }, { equipos, conexiones, resultadosCable, materialBom: bom });
            hechos = necesidad.map(l => ({ ...hecho(l.descripcion, l.cantidad, `necesidad:${l.articulo_id}:${l.unidad}`, l.unidad), advertencia: l.detalle.join(' · ') }));
            if (!necesidad.length)
                hechos = [hecho('Material registrado', null, 'necesidad', undefined, 'sin_filas')];
            if (equipos.some(e => !e.articulo_id))
                avisos.push('Hay equipos sin referencia de catálogo, excluidos de la necesidad canónica.');
        }
        else {
            hechos = elegidas.flatMap(f => {
                const c = conexiones.find(c => c.id === f.conexion_id)!;
                const campos = [hecho(`${f.identificador} · origen`, f.origen, `conexiones:${c.id}.origen_id`), hecho(`${f.identificador} · puerto origen`, f.puerto_origen, `conexiones:${c.id}.puerto_origen_id`, undefined, f.puerto_origen == null ? 'sin_dato' : undefined), hecho(`${f.identificador} · destino`, f.destino, `conexiones:${c.id}.destino_id`), hecho(`${f.identificador} · puerto destino`, f.puerto_destino, `conexiones:${c.id}.puerto_destino_id`, undefined, f.puerto_destino == null ? 'sin_dato' : undefined), hecho(`${f.identificador} · señal`, f.senal, `conexiones:${c.id}.senal`)];
                if (intent.intent === 'conexiones')
                    campos.push(hecho(`${f.identificador} · longitud manual`, c.longitud_manual_m, `conexiones:${c.id}.longitud_manual_m`, 'm', c.longitud_manual_m == null ? 'sin_dato' : undefined));
                else
                    campos.push(hecho(`${f.identificador} · ${f.manual ? 'longitud manual' : 'longitud calculada'}`, f.metros, `calculo:${c.id}.longitud_m`, 'm', f.metros == null ? 'no_calculable' : undefined));
                avisos.push(...f.avisos.map(av => `${f.identificador}: ${av}`));
                return campos;
            });
            if (!hechos.length)
                hechos = [hecho(intent.cableId ? `No hay cable ${intent.cableId} registrado` : 'Conexiones registradas', null, 'conexiones', undefined, 'sin_filas')];
        }
        if (intent.intent !== 'conexiones' && (!sala.largo_m || !sala.ancho_m || !sala.alto_m))
            avisos.push('Sala sin medidas completas: recorrido no calculable; la necesidad conserva únicamente las partidas canónicas disponibles.');
    }
    const tipo = intent.intent === 'medidas' ? 'sala' : intent.intent as 'conexiones' | 'cables' | 'necesidad';
    const f = fuente(tipo, id, a, { ...rev, datos }, intent);
    if (tipo !== 'sala') {
        const d = datos as Awaited<ReturnType<typeof leerTecnica>>;
        f.versionAnclas = 1;
        f.filas = [
            ...d.equipos.map(e => ({ tabla: 'sala_equipos' as const, id: e.id })),
            ...d.conexiones.map(c => ({ tabla: 'conexiones' as const, id: c.id })),
            ...d.conexiones.flatMap(c => (['origen', 'destino'] as const).flatMap(lado => c[lado === 'origen' ? 'puerto_origen_ordinal' : 'puerto_destino_ordinal'] != null ? [{ tabla: 'conexion_bocas' as const, id: c.id, lado }] : [])),
            ...d.conexiones.flatMap(c => (c.puntos_paso ?? []).flatMap(p => p.id ? [{ tabla: 'conexion_puntos_paso' as const, id: p.id }] : [])),
            ...d.puertos.map(p => ({ tabla: 'puertos' as const, id: p.id })),
            ...d.articulos.map(ar => ({ tabla: 'articulos' as const, id: ar.id })),
            ...d.bom.map(b => ({ tabla: 'sala_material_bom' as const, id: b.id })),
            ...d.tomas.map(t => ({ tabla: 'tomas_red' as const, id: t.id })),
            ...d.filasParametros.map(p => ({ tabla: 'parametros' as const, clave: p.clave as typeof CLAVES_PARAMETROS_CONSULTA[number] })),
        ];
    }
    return { fuente: { ...f, ...sinBorrador(rev) }, datos, hechos, avisos, borrador: rev.borrador, href: intent.intent === 'medidas' ? href : `${href}/cableado` };
}
const sinBorrador = ({ disenoVersion, revisionId, revisionNumero, revisionHash }: Awaited<ReturnType<typeof revisionTecnica>>) => ({ disenoVersion, revisionId, revisionNumero, revisionHash });
async function leerEquipos(sql: SqlConsulta, id: string): Promise<EquipoEnSala[]> {
    const filas = await sql `select id,sala_id,articulo_id,nombre,cantidad,extremo,x_m,y_m,z_m,posicion_confirmada,rotacion_grados,toma_red_id from sala_equipos where sala_id=${id} order by id`;
    return filas.map(e => ({ id: e.id, sala_id: e.sala_id, articulo_id: e.articulo_id, nombre: e.nombre, cantidad: Number(e.cantidad), extremo: e.extremo, posicion: { x_m: Number(e.x_m), y_m: Number(e.y_m), z_m: Number(e.z_m) }, posicion_confirmada: e.posicion_confirmada, rotacion_grados: Number(e.rotacion_grados), toma_red_id: e.toma_red_id }));
}
export async function leerTecnica(sql: SqlConsulta, id: string, calcular: boolean) {
    const [raw] = await sql `select id,sede_id,localizacion_id,codigo,nombre,tipologia,aforo,plantilla_id,largo_m,ancho_m,alto_m,alto_falso_techo_m,alto_canaleta_m,alto_suelo_tecnico_m,ruta_por_defecto,notas,mesa_largo_m,mesa_ancho_m,mesa_alto_cm,mesa_x_m,mesa_y_m,mesa_rotacion_grados,diagrama_version,sillas_modo from salas where id=${id}`;
    if (!raw)
        throw new ErrorConsulta('FUENTE', 'La sala ya no está disponible.', 409);
    const sala = numericos(raw, [...camposMedida, 'alto_falso_techo_m', 'alto_canaleta_m', 'alto_suelo_tecnico_m', 'aforo', 'mesa_rotacion_grados', 'diagrama_version']) as Sala;
    const equipos = await leerEquipos(sql, id);
    const filas = await sql `select c.id,c.sala_id,c.origen_id,c.destino_id,c.articulo_cable_id,c.senal,c.ruta,c.longitud_manual_m,c.notas,coalesce(bo.puerto_id,c.puerto_origen_id) as puerto_origen_id,coalesce(bd.puerto_id,c.puerto_destino_id) as puerto_destino_id,bo.ordinal as puerto_origen_ordinal,bd.ordinal as puerto_destino_ordinal,c.creado_en,c.identificador_cable from conexiones c left join conexion_bocas bo on bo.conexion_id=c.id and bo.lado='origen' left join conexion_bocas bd on bd.conexion_id=c.id and bd.lado='destino' where c.sala_id=${id} order by c.creado_en,c.id`;
    const puntos = filas.length ? await sql `select p.id,p.conexion_id,p.orden,p.x_m,p.y_m,p.z_m from conexion_puntos_paso p join conexiones c on c.id=p.conexion_id where c.sala_id=${id} order by p.conexion_id,p.orden,p.id` : [];
    const conexiones: Conexion[] = filas.map(c => ({ ...c, longitud_manual_m: n(c.longitud_manual_m), creado_en: new Date(c.creado_en).toISOString(), puntos_paso: puntos.filter(p => p.conexion_id === c.id).map(p => ({ id: p.id, orden: Number(p.orden), x_m: Number(p.x_m), y_m: Number(p.y_m), z_m: Number(p.z_m) })) })) as Conexion[];
    const puertoIds = [...new Set(conexiones.flatMap(c => [c.puerto_origen_id, c.puerto_destino_id]).filter((p): p is string => Boolean(p)))];
    const puertos: Puerto[] = puertoIds.length ? await sql<Puerto[]> `select p.id,p.articulo_id,p.nombre,p.total,p.sentido,p.senal,p.conector,p.orden,p.notas,p.fuente from puertos p where p.id in ${sql(puertoIds)} order by p.id` : [];
    const tomas = await sql<TomaRed[]> `select id,sala_id,codigo,ubicacion,x_m,y_m,z_m,notas from tomas_red where sala_id=${id} order by id`;
    const bom: Array<LineaMaterialBom & { id: string }> = calcular ? (await sql `select m.id,m.articulo_id,trim(concat_ws(' ',a.marca,a.modelo)) as descripcion,m.unidad,m.cantidad,m.nota from sala_material_bom m join articulos a on a.id=m.articulo_id where m.sala_id=${id} order by m.id`).map(m => ({ id: String(m.id), articulo_id: m.articulo_id, descripcion: m.descripcion, unidad: m.unidad, cantidad: Number(m.cantidad), nota: m.nota })) : [];
    const artIds = [...new Set([...equipos.map(e => e.articulo_id), ...conexiones.map(c => c.articulo_cable_id), ...bom.map(b => b.articulo_id)].filter((i): i is string => Boolean(i)))];
    const articulos: ArticuloTecnico[] = artIds.length ? (await sql `select id,marca,modelo,unidad,bobina_m,longitudes_comerciales_m,senal from articulos where id in ${sql(artIds)} order by id`).map(ar => ({ ...ar, bobina_m: n(ar.bobina_m), longitudes_comerciales_m: ar.longitudes_comerciales_m?.map(Number) ?? null })) as ArticuloTecnico[] : [];
    for (const b of bom) {
        const ar = articulos.find(ar => ar.id === b.articulo_id);
        if (!ar || ar.unidad !== b.unidad)
            throw new ErrorConsulta('INTEGRIDAD', 'Las unidades de una fuente de material requieren revisión.', 503);
    }
    const filasParametros = calcular ? await sql `select clave,valor from parametros where clave in ('holgura_pantalla','holgura_proyector','holgura_rack','holgura_caja_conexiones','holgura_mesa','holgura_techo','holgura_pared','margen','cables_por_canalizacion','ocupacion_maxima_canaleta') order by clave` : [];
    const mapa = new Map(filasParametros.map(p => [p.clave, Number(p.valor)]));
    const parametros: ParametrosCable = { ...PARAMETROS_POR_DEFECTO, holguras: { ...PARAMETROS_POR_DEFECTO.holguras } };
    for (const k of Object.keys(parametros.holguras) as Array<keyof typeof parametros.holguras>)
        if (mapa.has(`holgura_${k}`))
            parametros.holguras[k] = mapa.get(`holgura_${k}`)!;
    for (const k of ['margen', 'cables_por_canalizacion', 'ocupacion_maxima_canaleta'] as const)
        if (mapa.has(k))
            parametros[k] = mapa.get(k)!;
    return { sala, equipos, conexiones, puertos, tomas, articulos, parametros, bom, filasParametros };
}
export async function proyectarCatalogo(sql: SqlConsulta, u: IdentidadConsulta, a: AmbitoConsulta, seleccionId?: string): Promise<ProyeccionConsulta[]> {
    exigirConsulta(u, ['catalogo']);
    // Proyección propia REA02: no lee preferencias del panel.
    const [p] = await sql `select version,catalogo from preferencias_usuario where usuario_id=${u.id}`;
    const preferencias = validarCatalogo(p?.catalogo ?? {}), version = Number(p?.version ?? 0);
    const patron = `%${preferencias.q.replace(/[\\%_]/g, '\\$&')}%`;
    const filtros = sql `activo and (${preferencias.marcas.length === 0} or marca=any(${preferencias.marcas}::text[])) and (${!preferencias.tipo} or tipo::text=${preferencias.tipo ?? ''}) and (${!preferencias.q} or concat_ws(' ',marca,modelo,descripcion,categoria) ilike ${patron})`;
    const rows = seleccionId ? await sql `select id,marca,modelo,categoria,tipo,unidad,descripcion,caracteristicas,revision from articulos where id=${seleccionId} and ${filtros} order by id limit 1` : await sql `select id,marca,modelo,categoria,tipo,unidad,descripcion,caracteristicas,revision from articulos where ${filtros} order by marca,modelo,id limit 20`;
    if (seleccionId && !rows.length)
        throw new ErrorConsulta('FUENTE', 'La ficha ya no está disponible con tus filtros.', 409);
    const datos = rows.map(r => ({ id: String(r.id), marca: r.marca as string | null, modelo: String(r.modelo), categoria: r.categoria as string | null, tipo: String(r.tipo), unidad: String(r.unidad), descripcion: r.descripcion as string | null, caracteristicas: r.caracteristicas as string | null, revision: Number(r.revision) }));
    const fid = seleccionId ?? u.id;
    const ficha = seleccionId ? await leerFichaCatalogo(sql, seleccionId, datos[0]) : null;
    const f: FuenteConsulta = { tipo: 'catalogo', id: fid, ambito: a, hash: hashConsulta(seleccionId ? { datos, ficha } : datos), secciones: ['catalogo'], versionAnclas: 1, filas: [...datos.map(r => ({ tabla: 'articulos' as const, id: r.id })), ...(ficha ? [{ tabla: 'articulos_tecnicos' as const, id: ficha.articulo_id }] : [])], ...(seleccionId ? { seleccionId } : {}) };
    const hechos: HechoConsulta[] = datos.flatMap(r => [{ etiqueta: `${r.marca ?? ''} ${r.modelo}`.trim(), valor: r.descripcion, fuenteId: fid, campo: `articulos:${r.id}.descripcion`, ...(r.descripcion == null ? { ausencia: 'sin_dato' as const } : {}) }, { etiqueta: `${r.modelo} · categoría`, valor: r.categoria ?? 'Sin categoría', fuenteId: fid, campo: `articulos:${r.id}.categoria` }, ...(seleccionId ? [{ etiqueta: `${r.modelo} · características registradas`, valor: r.caracteristicas, fuenteId: fid, campo: `articulos:${r.id}.caracteristicas`, ...(r.caracteristicas == null ? { ausencia: 'sin_dato' as const } : {}) }] : [])]);
    if (seleccionId) {
        const hecho = (etiqueta: string, campo: string, valor: string | number | null, unidad?: string): HechoConsulta => ({ etiqueta, campo: `articulos_tecnicos:${seleccionId}.${campo}`, valor, fuenteId: fid, ...(unidad ? { unidad } : {}), ...(valor == null ? { ausencia: 'sin_dato' as const } : {}) });
        if (ficha) {
            for (const [campo, etiqueta] of [['ancho', 'Ancho'], ['alto', 'Alto'], ['fondo', 'Fondo']] as const)
                hechos.push(hecho(etiqueta, campo, ficha[campo], ficha.unidad ?? undefined));
            hechos.push(hecho('Unidades de rack', 'ru', ficha.ru, 'RU'), hecho('Origen de ficha', 'origen', ficha.origen), hecho('URL de origen', 'url', ficha.url), hecho('Fecha de fuente', 'fecha', ficha.fecha), hecho('Verificada en', 'verificado_en', ficha.verificado_en));
        } else hechos.push(hecho('Ficha técnica registrada', 'articulo_id', null));
    }
    if (!hechos.length)
        hechos.push({ etiqueta: 'Resultados de tus filtros', valor: null, fuenteId: fid, campo: 'articulos', ausencia: 'sin_filas' });
    return [{ fuente: { tipo: 'preferencias', id: u.id, ambito: a, hash: hashConsulta(preferencias), secciones: ['catalogo'], version, versionAnclas: 1, filas: p ? [{ tabla: 'preferencias_usuario', id: u.id }] : [] }, datos: preferencias, hechos: [], avisos: [preferencias.marcas.length ? `Marcas literales aplicadas: ${preferencias.marcas.join(', ')}. Máximo 20 referencias.` : 'Sin marcas preferidas: se aplica la búsqueda guardada al catálogo completo, con un máximo de 20 referencias.'], href: '/cuenta/preferencias' }, { fuente: f, datos: seleccionId ? { datos, ficha } : datos, hechos, avisos: [], href: seleccionId ? `/catalogo/${seleccionId}` : '/catalogo' }];
}

/** Proyección E2 mínima: mismo esquema técnico, sin archivos, bytes, autor ni dinero. */
async function leerFichaCatalogo(sql: SqlConsulta, id: string, articulo: { marca: string | null; modelo: string }): Promise<DatosTecnicos | null> {
    const [fila] = await sql`select articulo_id,marca,modelo,ancho,alto,fondo,unidad,ru,origen,url,fecha,verificado_en from articulos_tecnicos where articulo_id=${id}`;
    if (!fila) return null;
    const fecha = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);
    const entrada = { marca: fila.marca, modelo: fila.modelo, ancho: n(fila.ancho), alto: n(fila.alto), fondo: n(fila.fondo), unidad: fila.unidad, ru: n(fila.ru), origen: fila.origen, url: fila.url, fecha: fecha(fila.fecha).slice(0, 10) };
    const validada = datosTecnicosSchema.safeParse(entrada);
    if (!validada.success || !Number.isFinite(new Date(fila.verificado_en).getTime()))
        throw new ErrorConsulta('INTEGRIDAD', 'La ficha técnica requiere revisar sus datos de origen.', 503);
    if (validada.data.marca !== articulo.marca || validada.data.modelo !== articulo.modelo)
        throw new ErrorConsulta('FUENTE', 'La ficha técnica requiere verificar el modelo actual.', 409);
    return { ...validada.data, articulo_id: String(fila.articulo_id), verificado_en: fecha(fila.verificado_en) };
}

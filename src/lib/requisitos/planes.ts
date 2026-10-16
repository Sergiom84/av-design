import type postgres from 'postgres';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ErrorRequisito, LIMITES_REQUISITOS, anclaSchema, canonico, confirmarSchema, crearPlanSchema, decisionesSchema, decisionesVacias, editarPlanSchema, hash, hashBytes, resultadoExtraccionSchema, revertirSchema, uuid, validar, type Decisiones } from './modelo';
import { idOrigenLocal } from './extraccion';
import { autorizarDocumento, exigirDestino, identidad, type Base, type Conexion, type Documento, type Identidad } from './fuentes';
import { candidatosDecididos, derivado, idSalaFutura, revisarDecisiones, seleccionE2 } from './revision';
import { bloquearProyectoParaAlta, crearLocalizacionEnTransaccion, crearSalaMinimaEnTransaccion } from '../jerarquia-transaccional';
import { confirmarImportacionEnTransaccion, obtenerLote, previsualizarImportacion, revisarSeleccionBomSalaNueva, revisarSeleccionImportacion, revertirLoteEnTransaccion } from '../importacion/servicio';
import { guardarDatosTecnicosEnTransaccion } from '../catalogo-tecnico-repositorio';
import { crearPuertoEnTransaccion } from '../catalogo-puertos-escritura';
import type { EntradaImportacion, PreviewImportacion, SeleccionFila } from '../importacion/modelo';

type Tx = postgres.TransactionSql<Record<string, unknown>>;
interface Plan { id: string; version: number; estado: string; destino: Decisiones['destino']; documento: Documento; extraccion: { id: string; sha256: string; resultado: ReturnType<typeof resultadoExtraccionSchema.parse> }; decisiones: unknown }
interface Grupo { salaId?: string; nuevo: boolean; entrada: EntradaImportacion; seleccion: SeleccionFila[]; preview: PreviewImportacion; candidatoIds: string[] }
interface Preparacion { diff: Record<string, unknown>; huella: string; grupos: Grupo[]; decisiones: Decisiones; salas: string[] }
function datosDecisiones(p: Plan): Decisiones {
  const wrapper = p.decisiones as { datos?: unknown } | null;
  return validar(decisionesSchema, wrapper?.datos ?? p.decisiones);
}
function salasExistentes(d: Decisiones): string[] {
  return d.destino === 'areas_bom' ? [...new Set([...d.areas.flatMap(a => a.accion === 'vincular' && a.salaId ? [a.salaId] : []), ...d.material.flatMap(m => m.salaId ? [m.salaId] : [])])].sort() : [];
}
function firmar(datos: unknown, secreto: string) { const cuerpo = Buffer.from(canonico(datos)).toString('base64url'); return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`; }
const tokenSchema = z.object({ planId: uuid, usuarioId: uuid, proyectoId: uuid, version: z.number().int(), huella: z.string().regex(/^[a-f0-9]{64}$/u), caduca: z.number().int() }).strict();
function verificar(token: string, secreto: string) {
  const [cuerpo, firma, extra] = token.split('.'); if (!cuerpo || !firma || extra) throw new ErrorRequisito('TOKEN', 'Vuelve a previsualizar el plan.', 409);
  const esperada = createHmac('sha256', secreto).update(cuerpo).digest(); const recibida = Buffer.from(firma, 'base64url');
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) throw new ErrorRequisito('TOKEN', 'Vuelve a previsualizar el plan.', 409);
  try { return tokenSchema.parse(JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))); } catch { throw new ErrorRequisito('TOKEN', 'Vuelve a previsualizar el plan.', 409); }
}
export class PlanesRequisitos {
  constructor(readonly db: Base, private secreto = process.env.SESION_SECRETO ?? '') {}
  private secretoValido() { if (this.secreto.length < 32) throw new ErrorRequisito('NO_DISPONIBLE', 'No se puede firmar la revisión del plan.', 503); return this.secreto; }
  async crear(usuarioId: string, entrada: unknown) {
    const e = validar(crearPlanSchema, entrada);
    return this.db.begin(async tx => {
      const u = await identidad(tx, usuarioId); exigirDestino(u, e.destino);
      const [x] = await tx`select documento_id from requisitos_extracciones where id=${e.extraccionId} and autor_id=${usuarioId}`;
      if (!x) throw new ErrorRequisito('NO_EXISTE', 'La extracción no existe.', 404);
      await autorizarDocumento(tx, u, x.documento_id, { bloquear: true });
      await tx`select pg_advisory_xact_lock(hashtextextended(${'rea10-planes:' + usuarioId},0))`;
      const [q] = await tx`select count(*)::int as n from requisitos_planes p join requisitos_extracciones e on e.id=p.extraccion_id join requisitos_documentos d on d.id=e.documento_id where p.autor_id=${usuarioId} and p.estado='borrador' and d.estado='activo'`;
      if (q.n >= LIMITES_REQUISITOS.planes) throw new ErrorRequisito('CUOTA', 'Ya tienes 20 planes abiertos. Retira los que no necesites.', 429);
      const id = randomUUID(); const decisiones = decisionesVacias(e.destino) ?? { versionModelo: 1, destino: e.destino, pendiente: true };
      await tx`insert into requisitos_planes(id,extraccion_id,autor_id,destino,decisiones) values(${id},${e.extraccionId},${usuarioId},${e.destino},${tx.json(decisiones)})`;
      return { id, version: 0, destino: e.destino };
    });
  }
  private async cargar(db: Conexion, usuarioId: string, id: string, bloquear = false): Promise<{ p: Plan; u: Identidad }> {
    validar(uuid, id); const u = await identidad(db, usuarioId);
    const [cab] = await db`select p.id,p.autor_id,p.destino,e.documento_id from requisitos_planes p join requisitos_extracciones e on e.id=p.extraccion_id where p.id=${id}`;
    if (!cab || cab.autor_id !== usuarioId) throw new ErrorRequisito('NO_EXISTE', 'El plan no está disponible.', 404);
    exigirDestino(u, cab.destino);
    const documento = await autorizarDocumento(db, u, cab.documento_id, { bloquear });
    const [fila] = bloquear ? await db`select id,version,estado,destino,extraccion_id,decisiones from requisitos_planes where id=${id} for update` : await db`select id,version,estado,destino,extraccion_id,decisiones from requisitos_planes where id=${id}`;
    const [x] = await db`select id,sha256,fuente_sha256,resultado from requisitos_extracciones where id=${fila.extraccion_id} and documento_id=${documento.id}`;
    if (!x || x.fuente_sha256 !== documento.sha256 || !x.resultado) throw new ErrorRequisito('FUENTE', 'La extracción ya no está disponible.', 409);
    return { p: { id, version: Number(fila.version), estado: fila.estado, destino: fila.destino, documento, extraccion: { id: x.id, sha256: x.sha256, resultado: validar(resultadoExtraccionSchema, x.resultado) }, decisiones: fila.decisiones }, u };
  }
  async obtener(usuarioId: string, id: string) {
    const {p}=await this.cargar(this.db,usuarioId,id);
    const actual = await identidad(this.db,usuarioId); exigirDestino(actual,p.destino);
    await autorizarDocumento(this.db,actual,p.documento.id);
    return p;
  }
  async editar(usuarioId: string, id: string, entrada: unknown) {
    const e = validar(editarPlanSchema, entrada);
    return this.db.begin(async tx => {
      const { p } = await this.cargar(tx, usuarioId, id, true);
      if (p.version !== e.version || p.estado !== 'borrador' || p.destino !== e.decisiones.destino) throw new ErrorRequisito('CONFLICTO', 'El plan cambió. Conserva tu revisión y recarga.', 409);
      revisarDecisiones(e.decisiones, p.extraccion.resultado,true);
      const decisiones = { datos: e.decisiones, revisadoPor: usuarioId, fecha: new Date().toISOString() };
      await tx`update requisitos_planes set decisiones=${tx.json(decisiones)},version=version+1,actualizado_en=now() where id=${id}`;
      return { id, version: p.version + 1, decisiones };
    });
  }
  async preview(usuarioId: string, id: string) {
    const r = await this.db.begin('isolation level repeatable read read only', async tx => { const { p, u } = await this.cargar(tx, usuarioId, id); return { p, preparacion: await this.preparar(tx, u, p) }; });
    const vigente = await this.cargar(this.db, usuarioId, id);
    if (vigente.p.version !== r.p.version || vigente.p.documento.version !== r.p.documento.version || vigente.p.documento.sha256 !== r.p.documento.sha256) throw new ErrorRequisito('CONFLICTO', 'La fuente o el plan cambió. Repite la revisión.', 409);
    const token = firmar({ planId: id, usuarioId, proyectoId: r.p.documento.proyectoId, version: r.p.version, huella: r.preparacion.huella, caduca: Date.now() + LIMITES_REQUISITOS.tokenMs }, this.secretoValido());
    return { token, version: r.p.version, huella: r.preparacion.huella, diff: r.preparacion.diff, caducaEn: new Date(Date.now() + LIMITES_REQUISITOS.tokenMs).toISOString() };
  }
  private async preparar(db: Conexion, u: Identidad, p: Plan): Promise<Preparacion> {
    if (p.estado !== 'borrador') throw new ErrorRequisito('CONFLICTO', 'El plan ya está aplicado o retirado.', 409);
    const d = datosDecisiones(p); revisarDecisiones(d, p.extraccion.resultado); exigirDestino(u, d.destino);
    const [obra] = await db`select id,sede_id,exists(select 1 from hitos_proyecto h where h.proyecto_id=p.id and h.tipo='cierre') as cerrado from proyectos p where id=${p.documento.proyectoId}`;
    if (!obra || obra.cerrado) throw new ErrorRequisito('CIERRE', 'La obra está cerrada o ya no existe.', 409);
    const usados = await db`select a.resultado->'candidatoIds' as ids from requisitos_aplicaciones a join requisitos_planes p on p.id=a.plan_id join requisitos_extracciones e on e.id=p.extraccion_id where e.documento_id=${p.documento.id} and p.destino=${p.destino}`;
    const anteriores = new Set(usados.flatMap(f => Array.isArray(f.ids) ? f.ids : []));
    if (candidatosDecididos(d).some(id => anteriores.has(id))) throw new ErrorRequisito('YA_APLICADO', 'Un candidato ya se aplicó a este destino. Crea otro candidato manual con un motivo para otra demanda.', 409);
    // También reconoce aplicaciones anteriores a la identidad local estable.
    // Sólo proyecta anclas de los candidatos aplicados; nunca texto histórico.
    const localesAplicados = await db`select c->'ancla' as ancla from requisitos_aplicaciones a
      join requisitos_planes p on p.id=a.plan_id join requisitos_extracciones e on e.id=p.extraccion_id
      cross join lateral jsonb_array_elements(coalesce(e.resultado->'candidatos','[]'::jsonb)) c
      where e.documento_id=${p.documento.id} and p.destino=${p.destino} and e.metodo in ('pdf_local','txt_utf8')
        and (a.resultado->'candidatoIds') ? (c->>'id')`;
    const origenesAplicados = new Set(localesAplicados.map(f => idOrigenLocal(validar(anclaSchema,f.ancla))));
    const elegidos = new Set(candidatosDecididos(d));
    if (p.extraccion.resultado.candidatos.some(c => elegidos.has(c.id) && c.ancla.metodo !== 'transcripcion_manual' && origenesAplicados.has(idOrigenLocal(c.ancla))))
      throw new ErrorRequisito('YA_APLICADO', 'La necesidad del original ya se aplicó a este destino. Crea otro candidato manual con un motivo para otra demanda.', 409);
    const grupos: Grupo[] = []; const salas = salasExistentes(d); const entidades: unknown[] = []; const areas: unknown[] = [];
    if (d.destino === 'areas_bom') {
      for (const id of salas) {
        const [s] = await db`select s.id,s.localizacion_id,s.diseno_version,l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id=${id}`;
        if (!s || s.proyecto_id !== p.documento.proyectoId) throw new ErrorRequisito('AMBITO', 'Una sala no pertenece a esta obra; no se adopta ni se mueve desde requisitos.', 409);
        entidades.push(s);
      }
      for (const a of d.areas) {
        if (a.accion === 'vincular') { areas.push({ candidatoId: a.candidatoId, accion: 'vincular', salaId: a.salaId }); continue; }
        let localizacion;
        if (a.localizacion.id) {
          const [l] = await db`select id,proyecto_id,nombre,revision_fuente from localizaciones where id=${a.localizacion.id}`;
          if (!l || l.proyecto_id !== p.documento.proyectoId) throw new ErrorRequisito('LOCALIZACION', 'La localización no pertenece a esta obra.', 409); localizacion = l; entidades.push(l);
          const [hom] = await db`select exists(select 1 from salas where localizacion_id=${l.id} and (nombre=${a.nombre} or (${a.codigo}::text is not null and codigo=${a.codigo}))) as existe`;
          if (hom.existe && !a.aceptarHomonimo) throw new ErrorRequisito('HOMONIMO', 'Ya existe una sala con ese nombre o código. Elige vincularla o confirma el homónimo.', 409);
        } else {
          const [l] = await db`select id from localizaciones where proyecto_id=${p.documento.proyectoId} and nombre=${a.localizacion.nombreNuevo!}`;
          if (l) throw new ErrorRequisito('LOCALIZACION', 'Ya existe esa localización. Elige explícitamente su identificador.', 409);
          localizacion = { nombreNuevo: a.localizacion.nombreNuevo };
        }
        areas.push({ ...a, salaId: idSalaFutura(p.id, a.candidatoId), localizacion, estadoMedidas: 'Según documento; pendiente de comprobación física' });
      }
      const porSala = new Map<string, typeof d.material>();
      for (const m of d.material) {
        const area = d.areas.find(a => a.candidatoId === m.areaCandidatoId);
        const salaId = m.salaId ?? (area?.accion === 'vincular' ? area.salaId! : idSalaFutura(p.id, m.areaCandidatoId!));
        porSala.set(salaId, [...(porSala.get(salaId) ?? []), m]);
      }
      for (const [salaId, filas] of [...porSala].sort(([a], [b]) => a.localeCompare(b))) {
        const datos = [];
        for (const m of filas) {
          const [a] = await db`select id,referencia,marca,modelo,categoria,unidad,activo,revision from articulos where id=${m.articuloId}`;
          if (!a?.activo || Number(a.revision) !== m.revisionArticulo || a.unidad !== m.unidad) throw new ErrorRequisito('ARTICULO', 'La referencia o su unidad cambió. Revisa la fila.', 409);
          datos.push({ referencia: a.referencia ?? '', marca: a.marca ?? '', modelo: a.modelo, categoria: a.categoria ?? '', unidad: m.unidad, cantidad: String(m.cantidad), nota: `REA10 plan ${p.id}; candidato ${m.candidatoId}; adicional al diseño` });
        }
        const entrada = derivado(p.id, d.destino, datos, salaId); const seleccion = seleccionE2(filas);
        const nuevo = !salas.includes(salaId);
        const preview = nuevo ? await revisarSeleccionBomSalaNueva(db, entrada, seleccion) : await revisarSeleccionImportacion(db, entrada, seleccion, true);
        grupos.push({ salaId, nuevo, entrada, seleccion, preview, candidatoIds: filas.map(f => f.candidatoId) });
      }
    } else if (d.destino === 'catalogo' || d.destino === 'ofertas') {
      const entrada = derivado(p.id, d.destino, d.filas.map(f => f.datos)); const seleccion = seleccionE2(d.filas);
      const preview = await previsualizarImportacion(db, entrada);
      for (const s of seleccion) {
        const f = preview.filas.find(f => f.fila === s.fila);
        if (!f || f.errores.length || s.crear && (f.candidatos.length || d.destino !== 'catalogo') || s.articuloId && !f.candidatos.some(c => c.id === s.articuloId && c.revision === s.revisionArticulo)) throw new ErrorRequisito('E2', 'La selección E2 necesita revisión; comprueba errores y coincidencias exactas.', 409);
      }
      grupos.push({ nuevo: false, entrada, seleccion, preview, candidatoIds: d.filas.map(f => f.candidatoId) });
    } else {
      const [a] = await db`select id,marca,modelo,revision,activo from articulos where id=${d.articuloId}`;
      if (!a?.activo) throw new ErrorRequisito('ARTICULO', 'La referencia ya no está activa.', 409);
      if (d.destino === 'tecnico') {
        if (d.datos.modelo !== a.modelo || d.datos.marca !== a.marca) throw new ErrorRequisito('MODELO', 'Debes verificar el modelo y la variante exactos.', 409);
        const [t] = await db`select articulo_id,marca,modelo,ancho,alto,fondo,unidad,ru,origen,url,fecha,revision_fuente from articulos_tecnicos where articulo_id=${a.id}`;
        if (hash(t ?? null) !== d.baseHash || (t ? String(t.revision_fuente) : null) !== d.baseRevision) throw new ErrorRequisito('BASE', 'La verificación técnica cambió desde la revisión.', 409);
        entidades.push({ articulo: a, anterior: t ?? null, propuesto: d.datos });
      } else {
        const puertos = await db`select id,nombre,total,sentido,senal,conector,orden,notas,fuente,revision_fuente from puertos where articulo_id=${a.id} order by id`;
        if (hash(puertos) !== d.baseHash || String(a.revision) !== d.baseRevision) throw new ErrorRequisito('BASE', 'Los puertos o el modelo cambiaron desde la revisión.', 409);
        const duplicado = puertos.find(t => t.nombre === d.datos.nombre);
        if (duplicado) throw new ErrorRequisito('DUPLICADO', `Ese puerto ya existe (${duplicado.id}). Ábrelo para revisarlo; no se sobrescribe.`, 409);
        entidades.push({ articulo: a, anterior: puertos, propuesto: d.datos });
      }
    }
    const diff = { versionModelo: 1, destino: d.destino, areas, entidades, e2: grupos.map(g => ({ salaId: g.salaId ?? null, salaNueva: g.nuevo, preview: g.preview, csv: { nombre: g.entrada.archivo.nombre, sha256: hashBytes(g.entrada.archivo.bytes), filas: g.candidatoIds.map((candidatoId,i) => ({ fila: i+2, candidatoId })) } })),
      aviso: 'BOM adicional: revisa lo que ya aporta el diseño. No crea equipos, conexiones, stock ni mediciones físicas.',
      anclas: candidatosDecididos(d).map(id => p.extraccion.resultado.candidatos.find(c => c.id === id)!.ancla) };
    return { diff, decisiones: d, grupos, salas, huella: hash({ planId: p.id, version: p.version, documento: { id: p.documento.id, version: p.documento.version, sha256: p.documento.sha256 }, extraccion: p.extraccion.sha256, decisiones: d, obra, diff }) };
  }
  async confirmar(usuarioId: string, id: string, entrada: unknown, prueba: { fallarTrasPrimerLote?: boolean } = {}) {
    const e = validar(confirmarSchema, entrada); const entradaHash = hash({ id, ...e });
    return this.db.begin(async tx => {
      const inicial = await this.cargar(tx, usuarioId, id); const descubiertas = salasExistentes(datosDecisiones(inicial.p));
      // Reintento durable tras ACL actual: la caducidad o cierre no repiten negocio.
      const [yaConfirmada] = await tx`select id,plan_id,entrada_sha256,resultado from requisitos_aplicaciones where autor_id=${usuarioId} and clave_peticion=${e.clavePeticion}`;
      if(yaConfirmada){if(yaConfirmada.plan_id!==id||yaConfirmada.entrada_sha256!==entradaHash)throw new ErrorRequisito('CLAVE','La clave ya corresponde a otra confirmación.',409);return {id:yaConfirmada.id,resultado:yaConfirmada.resultado,repetida:true};}
      if (descubiertas.length) await tx`select id from salas where id in ${tx(descubiertas)} order by id for update`;
      await bloquearProyectoParaAlta(tx, inicial.p.documento.proyectoId);
      const { p, u } = await this.cargar(tx, usuarioId, id, true);
      const [repetida] = await tx`select id,plan_id,entrada_sha256,resultado from requisitos_aplicaciones where autor_id=${usuarioId} and clave_peticion=${e.clavePeticion}`;
      if (repetida) { if (repetida.plan_id !== id || repetida.entrada_sha256 !== entradaHash) throw new ErrorRequisito('CLAVE', 'La clave ya corresponde a otra confirmación.', 409); return { id: repetida.id, resultado: repetida.resultado, repetida: true }; }
      if (p.version !== e.version || canonico(descubiertas) !== canonico(salasExistentes(datosDecisiones(p)))) throw new ErrorRequisito('CONFLICTO', 'El plan cambió. Conserva la revisión local.', 409);
      const token = verificar(e.token, this.secretoValido());
      if (token.planId !== id || token.usuarioId !== usuarioId || token.proyectoId !== p.documento.proyectoId || token.version !== p.version || token.caduca <= Date.now()) throw new ErrorRequisito('TOKEN', 'La revisión caducó o pertenece a otro plan.', 409);
      // Orden E2 conservado, también al coordinar varios lotes o una fuente de
      // ficha distinta de los artículos elegidos. Un escritor de ficha E2 toma
      // artículo→archivo, y nunca vuelve al documento10.
      if(p.destino==='catalogo')await tx`lock table articulos in share row exclusive mode`;
      if(p.destino==='ofertas')await tx`select clave from parametros where clave in ('vigencia_precio_meses','tipo_cambio_usd_eur') order by clave for share`;
      await tx`select id from articulos order by id for update`;
      if(p.documento.referencia?.tipo==='ficha_e2')await tx`select id from articulos_archivos_tecnicos where id=${p.documento.referencia.archivoId} for share`;
      if(p.documento.referencia?.tipo==='lote_e2')await tx`select id from importacion_lotes where id=${p.documento.referencia.loteId} for share`;
      await autorizarDocumento(tx,await identidad(tx,usuarioId),p.documento.id);
      const r = await this.preparar(tx, u, p); if (r.huella !== token.huella) throw new ErrorRequisito('CONFLICTO', 'Las fuentes o los destinos cambiaron. Vuelve a previsualizar.', 409);
      const salasCreadas: Array<{ id: string; hash: string }> = [], localizacionesCreadas: Array<{ id: string; hash: string }> = [], lotes: string[] = [];
      const d = r.decisiones;
      if (d.destino === 'areas_bom') {
        const nuevas = new Map<string,string>();
        for (const a of d.areas.filter(a => a.accion === 'crear')) {
          let localizacionId = a.localizacion.id;
          if (!localizacionId) {
            localizacionId = nuevas.get(a.localizacion.nombreNuevo!) ?? null;
            if (!localizacionId) { localizacionId = await crearLocalizacionEnTransaccion(tx, p.documento.proyectoId, a.localizacion.nombreNuevo!); nuevas.set(a.localizacion.nombreNuevo!,localizacionId); const [l] = await tx`select id,proyecto_id,nombre,revision_fuente from localizaciones where id=${localizacionId}`; localizacionesCreadas.push({ id: localizacionId, hash: hash(l) }); }
          }
          const salaId = await crearSalaMinimaEnTransaccion(tx, { id: idSalaFutura(p.id,a.candidatoId), proyectoId: p.documento.proyectoId, localizacionId, nombre: a.nombre, codigo: a.codigo, medidas: a.medidas, aceptarHomonimo: a.aceptarHomonimo, procedencia: `REA10 documento ${p.documento.id}, hash ${p.documento.sha256}, candidato ${a.candidatoId}` });
          const [s] = await tx`select id,nombre,codigo,localizacion_id,sede_id,largo_m,ancho_m,alto_m,notas,diseno_version from salas where id=${salaId}`; salasCreadas.push({ id: salaId, hash: hash(s) });
        }
      }
      for (const g of r.grupos) {
        const lote = await confirmarImportacionEnTransaccion(tx, g.entrada, g.seleccion, usuarioId, { previewHash: g.preview.previewHash }); lotes.push(lote.id);
        if (prueba.fallarTrasPrimerLote) throw new ErrorRequisito('PRUEBA', 'Fallo sintético tras el primer lote.', 503);
      }
      let tecnico: postgres.JSONValue = null;
      if (d.destino === 'tecnico' || d.destino === 'puerto') {
        await tx`select id from articulos where id=${d.articuloId} for update`;
        // Releer la base bajo el lock del artículo detecta también ABA de la fuente.
        await this.preparar(tx, await identidad(tx, usuarioId), p);
        if (d.destino === 'tecnico') {
          await guardarDatosTecnicosEnTransaccion(tx, { ...u, debeCambiarClave: false }, d.articuloId, d.datos);
          const [t] = await tx`select articulo_id,marca,modelo,ancho,alto,fondo,unidad,ru,origen,url,fecha,revision_fuente from articulos_tecnicos where articulo_id=${d.articuloId}`;
          tecnico = { tipo: 'tecnico', articuloId: d.articuloId, revisionFuente: String(t.revision_fuente), hash: hash(t), campos: d.camposRevisados, candidatoId: d.candidatoId };
        } else {
          const puertoId = await crearPuertoEnTransaccion(tx, d.articuloId, d.datos, { rechazarDuplicado: true });
          const [t] = await tx`select id,nombre,total,sentido,senal,conector,orden,notas,fuente,revision_fuente from puertos where id=${puertoId!}`;
          tecnico = { tipo: 'puerto', articuloId: d.articuloId, puertoId, revisionFuente: String(t.revision_fuente), hash: hash(t), campos: d.camposRevisados, candidatoId: d.candidatoId };
        }
      }
      const actual = await identidad(tx, usuarioId); exigirDestino(actual,d.destino); await autorizarDocumento(tx,actual,p.documento.id);
      // La foto atribuible incluye los avances de versión causados por la BOM
      // de este mismo plan, no sólo el instante anterior al primer lote.
      for(const s of salasCreadas){const [fila]=await tx`select id,nombre,codigo,localizacion_id,sede_id,largo_m,ancho_m,alto_m,notas,diseno_version from salas where id=${s.id}`;s.hash=hash(fila);}
      const derivados=r.grupos.map((g,i)=>({loteId:lotes[i],nombre:g.entrada.archivo.nombre,sha256:hashBytes(g.entrada.archivo.bytes),filas:g.candidatoIds.map((candidatoId,n)=>({fila:n+2,candidatoId,anclas:[p.extraccion.resultado.candidatos.find(c=>c.id===candidatoId)!.ancla]}))}));
      const resultado = { versionModelo: 1, destino: d.destino, documentoId: p.documento.id, documentoSha256: p.documento.sha256, extraccionId: p.extraccion.id, extraccionSha256: p.extraccion.sha256, candidatoIds: candidatosDecididos(d), salasCreadas, localizacionesCreadas, vinculos: d.destino === 'areas_bom' ? d.areas.filter(a => a.accion === 'vincular').map(a => ({ candidatoId:a.candidatoId,salaId:a.salaId })) : [], lotes, derivados, tecnico };
      const aplicacionId = randomUUID();
      await tx`insert into requisitos_aplicaciones(id,plan_id,autor_id,version_plan,clave_peticion,entrada_sha256,resultado) values(${aplicacionId},${id},${usuarioId},${p.version},${e.clavePeticion},${entradaHash},${tx.json(resultado)})`;
      await tx`update requisitos_planes set estado='aplicado',version=version+1,actualizado_en=now() where id=${id}`;
      return { id: aplicacionId, resultado, repetida: false };
    });
  }
  async baseTecnica(usuarioId: string, articuloId: string, destino: 'tecnico' | 'puerto') {
    validar(uuid, articuloId); const u = await identidad(this.db, usuarioId); exigirDestino(u,destino);
    const [a] = await this.db`select id,marca,modelo,revision from articulos where id=${articuloId}`;
    if (!a) throw new ErrorRequisito('NO_EXISTE','La referencia no existe.',404);
    if (destino === 'tecnico') {
      const [t] = await this.db`select articulo_id,marca,modelo,ancho,alto,fondo,unidad,ru,origen,url,fecha,revision_fuente from articulos_tecnicos where articulo_id=${articuloId}`;
      return { articulo:a, baseHash:hash(t??null),baseRevision:t?String(t.revision_fuente):null,datos:t??null };
    }
    const puertos = await this.db`select id,nombre,total,sentido,senal,conector,orden,notas,fuente,revision_fuente from puertos where articulo_id=${articuloId} order by id`;
    return { articulo:a,baseHash:hash(puertos),baseRevision:String(a.revision),datos:puertos };
  }
  async revertir(usuarioId:string, id:string, entrada:unknown) {
    validar(uuid,id); const e=validar(revertirSchema,entrada); const entradaHash=hash({id,...e});
    return this.db.begin(async tx=>{
      const [meta]=await tx`select a.plan_id,a.autor_id,p.destino,e.documento_id from requisitos_aplicaciones a join requisitos_planes p on p.id=a.plan_id join requisitos_extracciones e on e.id=p.extraccion_id where a.id=${id}`;
      if(!meta||meta.autor_id!==usuarioId)throw new ErrorRequisito('NO_EXISTE','La aplicación no existe.',404);
      const u=await identidad(tx,usuarioId);exigirDestino(u,meta.destino);
      const documento=await autorizarDocumento(tx,u,meta.documento_id,{permitirRetirado:true,verificarOrigen:false});
      const [app]=await tx`select resultado from requisitos_aplicaciones where id=${id}`;
      const r=app.resultado as {salasCreadas:Array<{id:string;hash:string}>;localizacionesCreadas:Array<{id:string;hash:string}>;lotes:string[];tecnico:unknown};
      const cabecerasLote=r.lotes.length?await tx`select sala_id from importacion_lotes where id in ${tx(r.lotes)} and usuario_id=${usuarioId}`:[];
      const salas=[...new Set([...cabecerasLote.flatMap(l=>l.sala_id?[String(l.sala_id)]:[]),...r.salasCreadas.map(s=>s.id)])].sort();
      if(salas.length)await tx`select id from salas where id in ${tx(salas)} order by id for update`;
      const [obra]=await tx`select id from proyectos where id=${documento.proyectoId} for update`;
      if(!obra)throw new ErrorRequisito('AMBITO','La obra ya no existe.',409);
      await autorizarDocumento(tx,await identidad(tx,usuarioId),meta.documento_id,{permitirRetirado:true,bloquear:true,verificarOrigen:false});
      await tx`select id from requisitos_planes where id=${meta.plan_id} for update`;
      const [prev]=await tx`select id,entrada_sha256,resultado from requisitos_reversiones where autor_id=${usuarioId} and clave_peticion=${e.clavePeticion}`;
      if(prev){if(prev.entrada_sha256!==entradaHash)throw new ErrorRequisito('CLAVE','La clave ya corresponde a otra reversión.',409);return {id:prev.id,resultado:prev.resultado,repetida:true};}
      const [ultima]=await tx`select id,numero from requisitos_reversiones where aplicacion_id=${id} order by numero desc limit 1`;
      if((ultima?.id??null)!==e.antecedenteId)throw new ErrorRequisito('CONFLICTO','Ya existe otro intento de reversión. Recarga.',409);
      const [cierre]=await tx`select exists(select 1 from hitos_proyecto where proyecto_id=${documento.proyectoId} and tipo='cierre') as cerrado`;
      const informes:postgres.JSONValue[]=[];
      for(const loteId of [...r.lotes].reverse()){
        const lote=await obtenerLote(tx,loteId,usuarioId);
        if(cierre.cerrado||!lote||lote.estado!=='confirmado')informes.push({tipo:'lote',id:loteId,estado:'conservado',motivo:cierre.cerrado?'Obra cerrada.':'El lote ya conserva un resultado de reversión.',reversion:lote?.reversion.map(r=>({...r}))??[]});
        else {const revertido=await revertirLoteEnTransaccion(tx,loteId,usuarioId);informes.push({tipo:'lote',id:loteId,estado:revertido.estado,reversion:revertido.reversion.map(r=>({...r}))});}
      }
      for(const s of [...r.salasCreadas].reverse()){
        const [actual]=await tx`select id,nombre,codigo,localizacion_id,sede_id,largo_m,ancho_m,alto_m,notas,diseno_version from salas where id=${s.id}`;
        const conservar=cierre.cerrado||!actual||hash(actual)!==s.hash||await dependencias(tx,'salas',s.id);
        if(!conservar)await tx`delete from salas where id=${s.id}`;
        informes.push({tipo:'sala',id:s.id,estado:conservar?'conservado':'revertido',motivo:conservar?'Cierre, modificación posterior o dependencia: se conserva.':'Alta retirada sin dependencias.'});
      }
      for(const l of [...r.localizacionesCreadas].reverse()){
        const [actual]=await tx`select id,proyecto_id,nombre,revision_fuente from localizaciones where id=${l.id}`;
        const conservar=cierre.cerrado||!actual||hash(actual)!==l.hash||await dependencias(tx,'localizaciones',l.id);
        if(!conservar)await tx`delete from localizaciones where id=${l.id}`;
        informes.push({tipo:'localizacion',id:l.id,estado:conservar?'conservado':'revertido',motivo:conservar?'Cierre, modificación posterior o dependencia: se conserva.':'Alta retirada sin dependencias.'});
      }
      if(r.tecnico)informes.push({tipo:'catalogo',estado:'conservado',motivo:'La verificación técnica o puerto requiere revisión manual actual.'});
      const resultado={versionModelo:1,motivo:e.motivo,informes}; const reversionId=randomUUID();
      await tx`insert into requisitos_reversiones(id,aplicacion_id,numero,antecedente_id,autor_id,clave_peticion,entrada_sha256,resultado,sha256) values(${reversionId},${id},${Number(ultima?.numero??0)+1},${ultima?.id??null},${usuarioId},${e.clavePeticion},${entradaHash},${tx.json(resultado)},${hash(resultado)})`;
      return {id:reversionId,resultado,repetida:false};
    });
  }
}
/** Catálogo de FK del servidor, nunca nombres proporcionados por el documento. */
async function dependencias(tx:Tx,tabla:'salas'|'localizaciones',id:string):Promise<boolean>{
  const refs=await tx`select c.relname as tabla,a.attname as columna from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=fk.conkey[1] where fk.contype='f' and fk.confrelid=${'public.'+tabla}::regclass and n.nspname='public'`;
  for(const r of refs){const [f]=await tx`select exists(select 1 from ${tx(String(r.tabla))} where ${tx(String(r.columna))}=${id}::uuid) as hay`;if(f.hay)return true;}
  return false;
}

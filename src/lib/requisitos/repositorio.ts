import type postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ErrorRequisito, LIMITES_REQUISITOS, altaReferenciaSchema, extraerSchema, hash, hashBytes, metadatosSchema, resultadoExtraccionSchema, retirarSchema, uuid, validar } from './modelo';
import { autorizarDocumento, autorizarReferencia, contenido, exigir, exigirDestino, identidad, type Base, type Conexion } from './fuentes';
import { conCuotaParser, construirExtraccion, parsearFuente } from './extraccion';

export class RepositorioRequisitos {
  constructor(public readonly db: Base) {}
  async listar(usuarioId: string, proyectoId: string) {
    validar(uuid, proyectoId); const u = await identidad(this.db, usuarioId); exigir(u, ['proyectos', 'salas']);
    const ids = await this.db`select id from requisitos_documentos where autor_id=${usuarioId} and proyecto_id=${proyectoId} order by creado_en desc,id limit 101`;
    const documentos = [];
    for (const { id } of ids) {
      const d = await this.cabeceraVisible(this.db,u,id);
      const c = d.estado === 'activo' ? await contenido(this.db, u, d) : null;
      documentos.push({ ...d, metadatos: c?.metadatos ?? null });
    }
    const actual=await identidad(this.db,usuarioId);
    for(const d of documentos)await autorizarDocumento(this.db,actual,d.id,{permitirRetirado:true,verificarOrigen:d.estado==='activo'});
    return { documentos, limites: LIMITES_REQUISITOS, adaptadorOcr: 'no_configurado' };
  }
  async registrarArchivo(usuarioId: string, proyectoId: string, datos: unknown, bytes: Uint8Array) {
    if(bytes.length<1||bytes.length>LIMITES_REQUISITOS.archivo)throw new ErrorRequisito('ARCHIVO','Selecciona PDF o TXT de entre 1 byte y 5 MiB.',413);
    validar(uuid, proyectoId); const m = validar(metadatosSchema, datos);
    if (!['application/pdf', 'text/plain'].includes(m.mime) || bytes.length < 1 || bytes.length > LIMITES_REQUISITOS.archivo || bytes.length !== m.tamano) throw new ErrorRequisito('ARCHIVO', 'Selecciona PDF o TXT de entre 1 byte y 5 MiB.', 413);
    if (m.mime === 'application/pdf') { if (!m.nombre.toLowerCase().endsWith('.pdf') || !Buffer.from(bytes.subarray(0,5)).equals(Buffer.from('%PDF-'))) throw new ErrorRequisito('FORMATO', 'Extensión, MIME y firma PDF deben coincidir.', 422); }
    else {
      if (!m.nombre.toLowerCase().endsWith('.txt')) throw new ErrorRequisito('FORMATO', 'Extensión y MIME TXT deben coincidir.', 422);
      let texto:string;try{texto=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ErrorRequisito('FORMATO','El TXT debe estar codificado en UTF-8 estricto.',422);}
      if(texto.includes('\0'))throw new ErrorRequisito('FORMATO','El TXT no admite bytes NUL.',422);
    }
    if (/[/\\\u0000-\u001f\u007f"<>:]/u.test(m.nombre)) throw new ErrorRequisito('NOMBRE', 'Nombre de archivo no permitido.');
    return this.db.begin(async tx => {
      const u = await identidad(tx, usuarioId); exigir(u, ['proyectos', 'salas', 'compras']); exigir(u, ['proyectos'], 'editar');
      await this.cuotaDocumento(tx, proyectoId);
      const [q] = await tx`select coalesce(sum(octet_length(c.bytes)),0)::bigint as bytes from requisitos_documentos d join requisitos_contenidos c on c.documento_id=d.id where d.proyecto_id=${proyectoId} and d.estado<>'purgado'`;
      if (Number(q.bytes) + bytes.length > LIMITES_REQUISITOS.bytesObra) throw new ErrorRequisito('CUOTA', 'La obra supera 100 MiB de documentos.', 429);
      const id = randomUUID(); const sha256 = hashBytes(bytes);
      await tx`insert into requisitos_documentos(id,proyecto_id,autor_id,tipo,sha256) values(${id},${proyectoId},${usuarioId},'archivo_obra',${sha256})`;
      await tx`insert into requisitos_contenidos(documento_id,metadatos,bytes) values(${id},${tx.json(m)},${Buffer.from(bytes)})`;
      return { id, version: 0, sha256 };
    });
  }
  private async cuotaDocumento(tx: postgres.TransactionSql<Record<string, unknown>>, proyectoId: string) {
    const [p] = await tx`select id from proyectos where id=${proyectoId} for update`;
    if (!p) throw new ErrorRequisito('NO_EXISTE', 'La obra no existe.', 404);
    const [q] = await tx`select count(*)::int as n from requisitos_documentos where proyecto_id=${proyectoId} and estado<>'purgado'`;
    if (q.n >= LIMITES_REQUISITOS.documentos) throw new ErrorRequisito('CUOTA', 'La obra ya conserva 100 documentos.', 429);
  }
  async registrarReferencia(usuarioId: string, entrada: unknown) {
    const e = validar(altaReferenciaSchema, entrada);
    return this.db.begin(async tx => {
      const u = await identidad(tx, usuarioId); exigir(u, ['proyectos', 'salas']); exigir(u, ['proyectos'], 'editar');
      await autorizarReferencia(tx, u, e.referencia); await this.cuotaDocumento(tx, e.proyectoId);
      let m: z.infer<typeof metadatosSchema>;
      if (e.referencia.tipo === 'ficha_e2') {
        const [f] = await tx`select nombre,mime,tamano_bytes,fecha,url from articulos_archivos_tecnicos where id=${e.referencia.archivoId}`;
        m = validar(metadatosSchema, { nombre: f.nombre, mime: f.mime, tamano: Number(f.tamano_bytes), fechaFuente: f.fecha instanceof Date ? f.fecha.toISOString().slice(0,10) : String(f.fecha), url: f.url, procedencia: e.procedencia });
      } else {
        const [l] = await tx`select archivo_nombre,octet_length(archivo) as tamano from importacion_lotes where id=${e.referencia.loteId} and usuario_id=${usuarioId}`;
        m = validar(metadatosSchema, { nombre: l.archivo_nombre, mime: l.archivo_nombre.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv', tamano: Number(l.tamano), fechaFuente: null, url: null, procedencia: e.procedencia });
      }
      const id = randomUUID();
      await tx`insert into requisitos_documentos(id,proyecto_id,autor_id,tipo,origen_ref,sha256) values(${id},${e.proyectoId},${usuarioId},${e.referencia.tipo},${tx.json(e.referencia)},${e.referencia.sha256})`;
      await tx`insert into requisitos_contenidos(documento_id,metadatos) values(${id},${tx.json(m)})`;
      return { id, version: 0, sha256: e.referencia.sha256 };
    });
  }
  async detalle(usuarioId: string, id: string) {
    validar(uuid, id); const u = await identidad(this.db, usuarioId); const d = await this.cabeceraVisible(this.db,u,id);
    const destinos=await this.db`select p.id,p.destino from requisitos_planes p join requisitos_extracciones e on e.id=p.extraccion_id where e.documento_id=${id} and p.autor_id=${usuarioId}`;
    for(const p of destinos)exigirDestino(u,p.destino);
    if (d.estado !== 'activo') {
      const aplicaciones = await this.aplicacionesSinContenido(this.db,id,usuarioId);
      const actual = await identidad(this.db,usuarioId); for(const p of destinos)exigirDestino(actual,p.destino);
      await autorizarDocumento(this.db,actual,id,{permitirRetirado:true,verificarOrigen:false});
      return { documento: d, metadatos: null, extracciones: [], planes: [], aplicaciones };
    }
    const c = await contenido(this.db, u, d);
    const extracciones = await this.db`select id,metodo,parser,parser_version,fuente_sha256,texto_sha256,sha256,resultado,creado_en from requisitos_extracciones where documento_id=${id} order by creado_en,id`;
    const planes = destinos.length ? await this.db`select p.id,p.extraccion_id,p.version,p.destino,p.estado,p.decisiones,p.actualizado_en from requisitos_planes p join requisitos_extracciones e on e.id=p.extraccion_id where e.documento_id=${id} and p.autor_id=${usuarioId} and p.id in ${this.db(destinos.map(p=>p.id))} and p.destino in ${this.db([...new Set(destinos.map(p=>p.destino))])} order by p.creado_en,p.id` : [];
    const aplicaciones = await this.aplicacionesSinContenido(this.db,id,usuarioId);
    const actual = await identidad(this.db,usuarioId); for(const p of destinos)exigirDestino(actual,p.destino);
    await autorizarDocumento(this.db,actual,id);
    return { documento: d, metadatos: c.metadatos, extracciones: extracciones.map(e => ({ ...e, resultado: validar(resultadoExtraccionSchema, e.resultado) })), planes, aplicaciones };
  }
  private async cabeceraVisible(db:Conexion,u:Awaited<ReturnType<typeof identidad>>,id:string){
    const d=await autorizarDocumento(db,u,id,{permitirRetirado:true,verificarOrigen:false});
    if(d.estado==='activo')try{await autorizarReferencia(db,u,d.referencia);}catch(e){if(!(e instanceof ErrorRequisito)||![404,409].includes(e.status))throw e;return {...d,estado:'origen no disponible'};}
    return d;
  }
  private async aplicacionesSinContenido(db: Conexion, id: string, usuarioId: string) {
    return db`select a.id,a.plan_id,a.version_plan,a.resultado,a.creado_en from requisitos_aplicaciones a join requisitos_planes p on p.id=a.plan_id join requisitos_extracciones e on e.id=p.extraccion_id where e.documento_id=${id} and a.autor_id=${usuarioId} order by a.creado_en,a.id`;
  }
  async archivo(usuarioId: string, id: string) {
    validar(uuid, id); const u = await identidad(this.db, usuarioId); const d = await autorizarDocumento(this.db, u, id); const c = await contenido(this.db, u, d, true);
    await autorizarDocumento(this.db, await identidad(this.db, usuarioId), id);
    return { ...c, sha256: d.sha256 };
  }
  async extraer(usuarioId: string, id: string, entrada: unknown, signal?: AbortSignal) {
    validar(uuid, id); const e = validar(extraerSchema, entrada);
    const u = await identidad(this.db, usuarioId); exigir(u, ['proyectos'], 'editar'); const d = await autorizarDocumento(this.db, u, id);
    const c = await contenido(this.db, u, d, e.modo === 'local');
    let r;
    if (e.modo === 'manual') {
      if (c.metadatos.mime === 'application/pdf' && e.pagina === null || c.metadatos.mime !== 'application/pdf' && e.pagina !== null) throw new ErrorRequisito('ANCLA', 'PDF requiere una página verificada; TXT se cita por línea.');
      const extraccionId = randomUUID(); const paginas = [{ numero: e.pagina, texto: e.texto }];
      r = { extraccionId, resultado: construirExtraccion(id, extraccionId, paginas, 'manual', true, e.motivo), metodo: 'transcripcion_manual', parser: 'manual-no-cotejado', parserVersion: '1', textoSha256: hash(paginas.map(p => p.texto)), fuenteSha256: d.sha256 };
    } else r = await conCuotaParser(this.db, usuarioId, () => parsearFuente(id, c.metadatos.mime, c.bytes!, signal));
    if (signal?.aborted) throw new ErrorRequisito('CANCELADO', 'La extracción fue cancelada.', 409);
    return this.db.begin(async tx => {
      const actual = await identidad(tx, usuarioId); exigir(actual, ['proyectos'], 'editar');
      const vigente = await autorizarDocumento(tx, actual, id, { bloquear: true });
      if (vigente.sha256 !== d.sha256 || vigente.version !== d.version) throw new ErrorRequisito('FUENTE_CAMBIADA', 'La fuente cambió durante la extracción.', 409);
      const sha256 = hash(r.resultado);
      await tx`insert into requisitos_extracciones(id,documento_id,autor_id,metodo,parser,parser_version,fuente_sha256,texto_sha256,sha256,resultado)
        values(${r.extraccionId},${id},${usuarioId},${r.metodo},${r.parser},${r.parserVersion},${r.fuenteSha256},${r.textoSha256},${sha256},${tx.json(r.resultado)})`;
      return { id: r.extraccionId, sha256, ...r };
    });
  }
  async retirar(usuarioId: string, id: string, entrada: unknown) {
    validar(uuid, id); const e = validar(retirarSchema, entrada);
    return this.db.begin(async tx => {
      const u = await identidad(tx, usuarioId); exigir(u, ['proyectos'], 'editar'); const d = await autorizarDocumento(tx, u, id, { bloquear: true, permitirRetirado: true,verificarOrigen:false });
      if(d.referencia?.tipo==='lote_e2')exigirDestino(u,d.referencia.destino==='bom'?'areas_bom':d.referencia.destino==='precios'?'ofertas':'catalogo');
      if (d.version !== e.version || d.sha256 !== e.confirmarHash || d.estado === 'purgado' || e.accion === 'retirar' && d.estado !== 'activo') throw new ErrorRequisito('CONFLICTO', 'La fuente cambió. Recarga antes de retirarla.', 409);
      const [diff]=await tx`select coalesce((select octet_length(bytes) from requisitos_contenidos where documento_id=${id}),0)::int as bytes,
        (select count(*)::int from requisitos_extracciones where documento_id=${id} and resultado is not null) as extracciones,
        (select count(*)::int from requisitos_planes p join requisitos_extracciones x on x.id=p.extraccion_id where x.documento_id=${id} and p.decisiones is not null) as planes`;
      const fecha=new Date().toISOString();const auditoria={motivo:e.motivo,autorId:usuarioId,fecha,diff:{bytes:Number(diff.bytes),extracciones:Number(diff.extracciones),planes:Number(diff.planes)}};
      await tx`update requisitos_documentos set version=version+1,estado=${e.accion === 'purgar' ? 'purgado' : 'retirado'},retirado_en=coalesce(retirado_en,${fecha}::timestamptz),purgado_en=${e.accion === 'purgar' ? fecha : null}::timestamptz,
        retirada=case when estado='activo' then ${tx.json(auditoria)} else retirada end,purga=case when ${e.accion === 'purgar'} then ${tx.json(auditoria)} else purga end where id=${id}`;
      if (e.accion === 'purgar') {
        await tx`update requisitos_contenidos set bytes=null,metadatos=null where documento_id=${id}`;
        await tx`update requisitos_extracciones set resultado=null where documento_id=${id}`;
        await tx`update requisitos_planes set decisiones=null,estado='purgado',version=version+1,actualizado_en=now() where extraccion_id in (select id from requisitos_extracciones where documento_id=${id})`;
      }
      return { id, estado: e.accion === 'purgar' ? 'purgado' : 'retirado', version: d.version + 1, motivo: e.motivo };
    });
  }
}

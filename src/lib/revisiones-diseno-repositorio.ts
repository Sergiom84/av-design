import type postgres from 'postgres';
import { createHash, randomUUID } from 'node:crypto';
import { sql as conexionAplicacion } from './db';
import { compararDisenos, serializarDiseno, TABLAS_DISENO, type BaseDiseno, type FilaDiseno, type GrupoDiseno, type ReferenciaRevisionDiseno, type RevisionDiseno, type SnapshotDiseno } from './revisiones-diseno';
import { esUuid } from './uuid';

export type SqlDiseno = ReturnType<typeof postgres>;
type Tx = postgres.TransactionSql<Record<string, unknown>>;
export class ErrorRevisionDiseno extends Error { constructor(message: string, public status = 400) { super(message); } }
const SALA = ['nombre','codigo','tipologia','aforo','plantilla_id','largo_m','ancho_m','alto_m','alto_falso_techo_m','alto_canaleta_m','alto_suelo_tecnico_m','ruta_por_defecto','notas','mesa_largo_m','mesa_ancho_m','mesa_alto_cm','mesa_x_m','mesa_y_m','mesa_rotacion_grados','sillas_modo','diagrama_iniciado_en','diagrama_origen','diagrama_plantilla_id'];
const TABLAS: Record<GrupoDiseno, { tabla: string; columnas: string[] }> = {
  equipos: { tabla:'sala_equipos', columnas:['id','sala_id','articulo_id','nombre','cantidad','extremo','x_m','y_m','z_m','posicion_confirmada','rotacion_grados','origen_plantilla_linea_id','toma_red_id','esquema_x','esquema_y','dimensiones_tecnicas'] },
  muebles: { tabla:'sala_mobiliario', columnas:['id','sala_id','mobiliario_id','nombre','forma','largo_m','ancho_m','alto_m','x_m','y_m','z_m','rotacion_grados','posicion_confirmada','origen_plantilla_mobiliario_id','orden','fuente','creado_en'] },
  puertas: { tabla:'puertas', columnas:['id','sala_id','pared','posicion_m','anchura_m','altura_m','orden','creado_en'] },
  tomas: { tabla:'tomas_red', columnas:['id','sala_id','codigo','ubicacion','x_m','y_m','z_m','notas','creado_en'] },
  conexiones: { tabla:'conexiones', columnas:['id','sala_id','origen_id','destino_id','articulo_cable_id','senal','ruta','longitud_manual_m','notas','puerto_origen_id','puerto_destino_id','creado_en','identificador_cable'] },
  bocas: { tabla:'conexion_bocas', columnas:['conexion_id','lado','equipo_id','puerto_id','ordinal'] },
  puntos: { tabla:'conexion_puntos_paso', columnas:['id','conexion_id','orden','x_m','y_m','z_m'] },
  material: { tabla:'sala_material_bom', columnas:['id','sala_id','articulo_id','cantidad','unidad','nota','lote_id','revision'] },
  anotaciones: { tabla:'anotaciones_sala', columnas:['id','sala_id','texto','ancla_tipo','ancla_id','x','y','creado_en'] },
};
function idValido(id: string) { if (!esUuid(id)) throw new ErrorRevisionDiseno('Identificador inválido.'); }
function nombreValido(nombre: string) { if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 160) throw new ErrorRevisionDiseno('Indica un nombre de 1 a 160 caracteres.'); return nombre.trim(); }
const json = (valor: unknown) => valor as postgres.JSONValue;
const txSql = (tx: Tx) => tx as unknown as SqlDiseno;
const fecha = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);
export function hashDiseno(snapshot: SnapshotDiseno) { return createHash('sha256').update(serializarDiseno(snapshot)).digest('hex'); }
function aRevision(f: Record<string, unknown>, incluir = false): RevisionDiseno {
  return { id:String(f.id), salaId:String(f.sala_id), numero:Number(f.numero), nombre:String(f.nombre), autorId:String(f.autor_id), autor:String(f.autor_nombre),
    creadoEn:fecha(f.creado_en), hash:String(f.hash), antecedenteId:f.antecedente_id ? String(f.antecedente_id) : null,
    restauradaDeId:f.restaurada_de_id ? String(f.restaurada_de_id) : null, ...(incluir ? {snapshot:f.snapshot as SnapshotDiseno} : {}) };
}
async function foto(conexion: SqlDiseno, tabla: string, columnas: string[], where: string, id: string, orden = 'id') {
  const filas = await conexion.unsafe<Array<{datos:FilaDiseno}>>(`select to_jsonb(registro_diseno) datos from (select ${columnas.join(',')} from ${tabla} where ${where} order by ${orden}) registro_diseno`, [id]);
  return filas.map(f => f.datos);
}
/** Llamar dentro de una transacción consistente, también desde el contexto E1. */
export async function leerDiseno(conexion: SqlDiseno, salaId: string): Promise<{snapshot:SnapshotDiseno;base:BaseDiseno;cerrado:boolean;origen:ReferenciaRevisionDiseno['heredadaDe'];mapa:Record<string,string>}> {
  idValido(salaId);
  const [sala] = await conexion`select diseno_version, origen_sala_id, origen_revision_id, mapa_ids_origen,
    exists(select 1 from localizaciones l join hitos_proyecto h on h.proyecto_id=l.proyecto_id where l.id=s.localizacion_id and h.tipo='cierre') cerrado
    from salas s where id=${salaId}`;
  if (!sala) throw new ErrorRevisionDiseno('La sala ya no existe.',404);
  const [datosSala] = await foto(conexion,'salas',SALA,'id=$1',salaId,'id');
  const datos = {} as SnapshotDiseno['datos'];
  for (const grupo of TABLAS_DISENO) {
    const {tabla,columnas}=TABLAS[grupo];
    const hija = grupo === 'bocas' || grupo === 'puntos';
    datos[grupo]=await foto(conexion,tabla,columnas,hija ? 'conexion_id in (select id from conexiones where sala_id=$1)' : 'sala_id=$1',salaId,grupo==='bocas' ? 'conexion_id,lado' : 'id');
  }
  const usados=[...new Set([...datos.equipos.map(f=>f.articulo_id),...datos.conexiones.map(f=>f.articulo_cable_id),...datos.material.map(f=>f.articulo_id)].filter((v):v is string=>typeof v==='string'))];
  const articulos=usados.length ? (await conexion<Array<{datos:FilaDiseno}>>`select to_jsonb(a)-array['coste','pvp','proveedor_id','plazo_dias','stock_minimo','unidades_instaladas','coste_orientativo'] datos from articulos a where id in ${conexion(usados)} order by id`).map(f=>f.datos) : [];
  const puertos=usados.length ? (await conexion<Array<{datos:FilaDiseno}>>`select to_jsonb(p) datos from puertos p where articulo_id in ${conexion(usados)} order by id`).map(f=>f.datos) : [];
  const parametros=(await conexion<Array<{datos:FilaDiseno}>>`select to_jsonb(p) datos from parametros p where clave like 'holgura_%' or clave in ('margen','cables_por_canalizacion','ocupacion_maxima_canaleta') order by clave`).map(f=>f.datos);
  const mueblesIds=[...new Set(datos.muebles.map(f=>f.mobiliario_id).filter((v):v is string=>typeof v==='string'))];
  const mobiliario=mueblesIds.length ? (await conexion<Array<{datos:FilaDiseno}>>`select to_jsonb(m) datos from catalogo_mobiliario m where id in ${conexion(mueblesIds)} order by id`).map(f=>f.datos) : [];
  const snapshot:SnapshotDiseno={formato:1,salaId,sala:datosSala,datos,contexto:{articulos,puertos,parametros,mobiliario}};
  if (Buffer.byteLength(JSON.stringify(snapshot))>5*1024*1024) throw new ErrorRevisionDiseno('El diseño supera el máximo de 5 MiB por revisión.',413);
  return {snapshot,base:{version:Number(sala.diseno_version),hash:hashDiseno(snapshot)},cerrado:Boolean(sala.cerrado),
    origen:sala.origen_sala_id && sala.origen_revision_id ? {salaId:String(sala.origen_sala_id),revisionId:String(sala.origen_revision_id)} : null,
    mapa:(sala.mapa_ids_origen ?? {}) as Record<string,string>};
}
async function bloquearSala(conexion:SqlDiseno,salaId:string) {
  idValido(salaId);
  const [sala]=await conexion`select id,localizacion_id,sede_id from salas where id=${salaId} for update`;
  if(!sala) throw new ErrorRevisionDiseno('La sala ya no existe.',404);
  const [cierre]=await conexion`select exists(select 1 from hitos_proyecto h join localizaciones l on l.proyecto_id=h.proyecto_id where l.id=${sala.localizacion_id} and h.tipo='cierre') cerrado`;
  if(cierre.cerrado) throw new ErrorRevisionDiseno('La obra está cerrada: su diseño es de sólo lectura.',409);
  return sala;
}
function comprobarBase(actual:BaseDiseno,esperada:BaseDiseno) {
  if(!esperada || !Number.isSafeInteger(esperada.version) || !/^[a-f0-9]{64}$/.test(esperada.hash) || actual.version!==esperada.version || actual.hash!==esperada.hash) {
    throw new ErrorRevisionDiseno('El diseño cambió. Recarga y compara antes de continuar.',409);
  }
}
async function usuarioReal(conexion:SqlDiseno,usuarioId:string) {
  idValido(usuarioId);
  const [u]=await conexion`select nombre from usuarios where id=${usuarioId} and activo and not debe_cambiar_clave`;
  if(!u) throw new ErrorRevisionDiseno('La autoría requiere un usuario activo con contraseña definitiva.',403);
  return String(u.nombre);
}
async function registrar(conexion:SqlDiseno,salaId:string,nombre:string,usuarioId:string,autor:string,fotoActual:Awaited<ReturnType<typeof leerDiseno>>,restauradaDeId:string|null=null) {
  const [anterior]=await conexion`select id,numero from revisiones_diseno where sala_id=${salaId} order by numero desc limit 1`;
  const [fila]=await conexion`insert into revisiones_diseno(sala_id,numero,nombre,autor_id,autor_nombre,hash,diseno_version,antecedente_id,restaurada_de_id,snapshot)
    values(${salaId},${Number(anterior?.numero??0)+1},${nombreValido(nombre)},${usuarioId},${autor},${fotoActual.base.hash},${fotoActual.base.version},${anterior?.id??null},${restauradaDeId},${conexion.json(json(fotoActual.snapshot))}) returning *`;
  return aRevision(fila,true);
}
export async function crearRevisionDiseno(conexion:SqlDiseno,salaId:string,nombre:string,usuarioId:string,base:BaseDiseno) {
  return conexion.begin('isolation level serializable',async tx=>{
    const c=txSql(tx); await bloquearSala(c,salaId); const autor=await usuarioReal(c,usuarioId);
    const actual=await leerDiseno(c,salaId); comprobarBase(actual.base,base);
    return registrar(c,salaId,nombre,usuarioId,autor,actual);
  }) as Promise<RevisionDiseno>;
}
export async function historialDiseno(conexion:SqlDiseno,salaId:string,pagina=1) {
  idValido(salaId);
  if(!Number.isInteger(pagina)||pagina<1||pagina>100000) throw new ErrorRevisionDiseno('Página inválida.');
  return conexion.begin('isolation level repeatable read read only',async tx=>{
    const c=txSql(tx); const actual=await leerDiseno(c,salaId);
    const filas=await c`select * from revisiones_diseno where sala_id=${salaId} order by numero desc limit 50 offset ${(pagina-1)*50}`;
    const alternativas=await c`select id,nombre,codigo from salas where origen_sala_id=${salaId} order by nombre,id`;
    const resumen=Object.fromEntries(TABLAS_DISENO.map(g=>[g,actual.snapshot.datos[g].length]));
    return {base:actual.base,cerrado:actual.cerrado,origen:actual.origen,revisiones:filas.map(f=>aRevision(f)),pagina,hayMas:filas.length===50,resumen,alternativas};
  });
}
export async function obtenerRevisionDiseno(conexion:SqlDiseno,salaId:string,revisionId:string) {
  idValido(salaId);idValido(revisionId);
  const [f]=await conexion`select * from revisiones_diseno where id=${revisionId} and sala_id=${salaId}`;
  if(!f) throw new ErrorRevisionDiseno('La revisión no pertenece a esta sala.',404);
  const snapshot=f.snapshot as SnapshotDiseno;
  if(snapshot?.formato!==1 || snapshot.salaId!==salaId || TABLAS_DISENO.some(g=>!Array.isArray(snapshot.datos?.[g])||snapshot.datos[g].some(f=>!f||typeof f!=='object'||Array.isArray(f))))throw new ErrorRevisionDiseno('La revisión no contiene un snapshot de diseño válido. No se restauró ningún dato.',409);
  return aRevision(f,true);
}
/** No abre otra transacción: usa el sql contextual de la exportación E1. */
export async function referenciaRevisionDiseno(salaId:string,conexion:SqlDiseno=conexionAplicacion):Promise<ReferenciaRevisionDiseno> {
  const actual=await leerDiseno(conexion,salaId);
  const [ultima]=await conexion`select * from revisiones_diseno where sala_id=${salaId} order by numero desc limit 1`;
  const r=ultima ? aRevision(ultima) : null; const vigente=r?.hash===actual.base.hash && Number(ultima?.diseno_version)===actual.base.version;
  const [filaAntecedente]=vigente&&r?.antecedenteId ? await conexion`select * from revisiones_diseno where id=${r.antecedenteId} and sala_id=${salaId}` : [];
  const antecedente=vigente ? filaAntecedente ? aRevision(filaAntecedente) : null : r;
  return {estado:vigente?'revision':'borrador',id:vigente?r!.id:null,numero:vigente?r!.numero:null,nombre:vigente?r!.nombre:null,
    autor:vigente?r!.autor:null,creadoEn:vigente?r!.creadoEn:null,hash:actual.base.hash,
    antecedente:antecedente ? {id:antecedente.id,numero:antecedente.numero,nombre:antecedente.nombre,autor:antecedente.autor,creadoEn:antecedente.creadoEn} : null,heredadaDe:actual.origen};
}

async function referenciasCompatibles(c:SqlDiseno,s:SnapshotDiseno) {
  for(const e of s.datos.equipos) if(e.articulo_id) {
    const [ar]=await c`select id,tipo,activo from articulos where id=${e.articulo_id as string}`;
    if(!ar || !ar.activo || ar.tipo!=='equipo') throw new ErrorRevisionDiseno('Un equipo de la revisión está retirado o es incompatible.',409);
  }
  for(const f of [...s.datos.material,...s.datos.conexiones]) {
    const id=f.articulo_id??f.articulo_cable_id;if(!id)continue;
    const [ar]=await c`select id,activo from articulos where id=${id as string}`;
    if(!ar||!ar.activo)throw new ErrorRevisionDiseno('Una referencia de material está retirada.',409);
  }
  const equipos=new Map(s.datos.equipos.map(e=>[String(e.id),e]));
  for(const boca of s.datos.bocas) {
    const [p]=await c`select articulo_id,total from puertos where id=${boca.puerto_id as string}`;
    if(!p || p.articulo_id!==equipos.get(String(boca.equipo_id))?.articulo_id || Number(p.total)<Number(boca.ordinal)) throw new ErrorRevisionDiseno('Un puerto o una boca de la revisión ya no es compatible.',409);
  }
  for(const f of s.datos.conexiones) for(const k of ['puerto_origen_id','puerto_destino_id']) if(f[k]) {
    const equipo=equipos.get(String(f[k==='puerto_origen_id'?'origen_id':'destino_id']));
    const [p]=await c`select articulo_id from puertos where id=${f[k] as string}`;
    if(!p||p.articulo_id!==equipo?.articulo_id)throw new ErrorRevisionDiseno('Un puerto histórico ya no pertenece al equipo.',409);
  }
  for(const m of s.datos.muebles) if(m.mobiliario_id) {
    const [f]=await c`select rol,activo from catalogo_mobiliario where id=${m.mobiliario_id as string}`;
    if(!f||!f.activo||f.rol==='mesa_principal')throw new ErrorRevisionDiseno('Una referencia de mobiliario está retirada o ya no es compatible.',409);
  }
}
async function materialComprometido(c:SqlDiseno,salaId:string,articulo:string) {
  const [dependencia]=await c`select exists(select 1 from reservas where sala_id=${salaId} and articulo_id=${articulo})
    or exists(select 1 from movimientos where sala_id=${salaId} and articulo_id=${articulo})
    or exists(select 1 from cargas ca join carga_lineas cl on cl.carga_id=ca.id where ca.sala_id=${salaId} and cl.articulo_id=${articulo})
    or exists(select 1 from pedidos p join pedido_lineas pl on pl.pedido_id=p.id where (p.sala_id=${salaId} or p.proyecto_id=(select l.proyecto_id from salas s join localizaciones l on l.id=s.localizacion_id where s.id=${salaId})) and pl.articulo_id=${articulo}) protegido`;
  return Boolean(dependencia.protegido);
}
async function protegerNecesidadDerivada(c:SqlDiseno,actual:SnapshotDiseno,objetivo:SnapshotDiseno) {
  // Usa la misma necesidad de equipos+cable+BOM del diff; los hechos sólo se consultan.
  // Reserva, pedido, carga y movimiento son etapas: nunca se suman como existencias.
  for(const material of compararDisenos(actual,objetivo).material) {
    if(material.despues<material.antes && await materialComprometido(c,actual.salaId,material.articuloId)) {
      throw new ErrorRevisionDiseno('Ese material tiene reservas, pedidos, carga o movimientos. La restauración se rechaza íntegra porque reduce la necesidad comprometida.',409);
    }
  }
}
async function protegerBom(c:SqlDiseno,actual:SnapshotDiseno,objetivo:SnapshotDiseno) {
  const porId=(s:SnapshotDiseno)=>new Map(s.datos.material.map(m=>[String(m.id),m]));
  const a=porId(actual);const b=porId(objetivo);
  for(const id of new Set([...a.keys(),...b.keys()])) {
    const antes=a.get(id);const despues=b.get(id);if(serializarDiseno(antes)===serializarDiseno(despues))continue;
    if(antes?.lote_id||despues?.lote_id)throw new ErrorRevisionDiseno('La restauración alteraría material atribuido a una importación. Conserva o revierte ese lote desde Importación.',409);
    const articulo=String(antes?.articulo_id??despues?.articulo_id);
    if(await materialComprometido(c,actual.salaId,articulo))throw new ErrorRevisionDiseno('Ese material tiene reservas, pedidos, carga o movimientos. La restauración se rechaza íntegra para conservar la necesidad comprometida.',409);
  }
}
async function insertarFila(c:SqlDiseno,grupo:GrupoDiseno,f:FilaDiseno) {
  const {tabla,columnas}=TABLAS[grupo];
  // Datos de snapshot del servidor, sólo columnas permitidas; JSON null técnico es ausencia explícita.
  const valores={...f}; if(grupo==='equipos' && valores.dimensiones_tecnicas==null) valores.dimensiones_tecnicas=null;
  const expresiones=columnas.map(k=>k==='dimensiones_tecnicas' ? `case when $1::text::jsonb->'dimensiones_tecnicas'='null'::jsonb then 'null'::jsonb else r.dimensiones_tecnicas end` : `r.${k}`);
  await c.unsafe(`insert into ${tabla} (${columnas.join(',')}) select ${expresiones.join(',')} from jsonb_populate_record(null::${tabla},$1::text::jsonb) r`,[JSON.stringify(valores)]);
}
async function aplicarDiseno(c:SqlDiseno,salaId:string,s:SnapshotDiseno) {
  // Las notas se resuelven con el snapshot objetivo antes de retirar sus anclas.
  await c`delete from anotaciones_sala where sala_id=${salaId}`;
  await c`delete from conexiones where sala_id=${salaId}`;
  await c`delete from sala_equipos where sala_id=${salaId}`;
  await c`delete from sala_mobiliario where sala_id=${salaId}`;
  await c`delete from puertas where sala_id=${salaId}`;
  await c`delete from tomas_red where sala_id=${salaId}`;
  // Material idéntico no se recrea: mantiene revisión E2 y atribución.
  const [fila]=await c`select to_jsonb(s) datos from salas s where id=${salaId}`;
  const objetivo={...fila.datos,...s.sala};
  await c.unsafe(`update salas set ${SALA.map(k=>`${k}=r.${k}`).join(',')},diagrama_version=salas.diagrama_version+1 from jsonb_populate_record(null::salas,$1::text::jsonb) r where salas.id=$2`,[JSON.stringify(objetivo),salaId]);
  for(const grupo of ['tomas','equipos','muebles','puertas','conexiones','bocas','puntos','anotaciones'] as GrupoDiseno[])for(const f of s.datos[grupo])await insertarFila(c,grupo,f);
  const actuales=await c`select * from sala_material_bom where sala_id=${salaId}`;
  const ids=new Set(s.datos.material.map(f=>String(f.id)));
  for(const f of actuales)if(!ids.has(String(f.id)))await c`delete from sala_material_bom where id=${f.id}`;
  for(const f of s.datos.material) {
    const anterior=actuales.find(a=>a.id===f.id);
    if(!anterior)await insertarFila(c,'material',{...f,revision:0});
    else if(!f.lote_id)await c`update sala_material_bom set articulo_id=${f.articulo_id as string},cantidad=${f.cantidad as number},unidad=${f.unidad as string},nota=${f.nota as string|null} where id=${f.id as string}`;
  }
}
export async function restaurarRevisionDiseno(conexion:SqlDiseno,salaId:string,revisionId:string,usuarioId:string,base:BaseDiseno,opciones:{fallarDespuesDeAplicar?:boolean}={}) {
  return conexion.begin('isolation level serializable',async tx=>{
    const c=txSql(tx);await bloquearSala(c,salaId);const autor=await usuarioReal(c,usuarioId);
    const actual=await leerDiseno(c,salaId);comprobarBase(actual.base,base);const objetivo=await obtenerRevisionDiseno(c,salaId,revisionId);
    await referenciasCompatibles(c,objetivo.snapshot!);await protegerBom(c,actual.snapshot,objetivo.snapshot!);await protegerNecesidadDerivada(c,actual.snapshot,objetivo.snapshot!);
    await registrar(c,salaId,`Antes de restaurar ${objetivo.numero}`,usuarioId,autor,actual);
    await aplicarDiseno(c,salaId,objetivo.snapshot!);
    if(opciones.fallarDespuesDeAplicar)throw new ErrorRevisionDiseno('Fallo de rollback sintético.');
    return registrar(c,salaId,`Restaurada: ${objetivo.nombre}`.slice(0,160),usuarioId,autor,await leerDiseno(c,salaId),revisionId);
  }) as Promise<RevisionDiseno>;
}
export async function duplicarSalaDiseno(conexion:SqlDiseno,salaId:string,nombre:string,codigo:string|null,usuarioId:string,base:BaseDiseno) {
  return conexion.begin('isolation level serializable',async tx=>{
    const c=txSql(tx);const origen=await bloquearSala(c,salaId);const autor=await usuarioReal(c,usuarioId);
    const actual=await leerDiseno(c,salaId);comprobarBase(actual.base,base);await referenciasCompatibles(c,actual.snapshot);
    const nombreNuevo=nombreValido(nombre);if(codigo && (typeof codigo!=='string'||codigo.length>160))throw new ErrorRevisionDiseno('Código demasiado largo.');
    if(origen.localizacion_id)await c`select id from proyectos where id=(select proyecto_id from localizaciones where id=${origen.localizacion_id}) for update`;
    const [duplicada]=await c`select id from salas where localizacion_id is not distinct from ${origen.localizacion_id} and sede_id is not distinct from ${origen.sede_id} and (nombre=${nombreNuevo} or (${codigo}::text is not null and codigo=${codigo}))`;
    if(duplicada)throw new ErrorRevisionDiseno('Ya existe una sala con ese nombre o código en el destino.',409);
    const revisionOrigen=await registrar(c,salaId,`Origen de ${nombreNuevo}`.slice(0,160),usuarioId,autor,actual);
    const nuevoId=randomUUID();const mapa:Record<string,string>={};
    for(const grupo of TABLAS_DISENO)for(const f of actual.snapshot.datos[grupo])if(typeof f.id==='string')mapa[f.id]=randomUUID();
    const sala={...actual.snapshot.sala,id:nuevoId,sede_id:origen.sede_id,localizacion_id:origen.localizacion_id,nombre:nombreNuevo,codigo,
      origen_sala_id:salaId,origen_revision_id:revisionOrigen.id,medidas_heredadas:true,mapa_ids_origen:Object.fromEntries(Object.entries(mapa).map(([a,b])=>[b,a])),diagrama_version:0};
    const columnas=['id','sede_id','localizacion_id',...SALA,'origen_sala_id','origen_revision_id','medidas_heredadas','mapa_ids_origen','diagrama_version'];
    await c.unsafe(`insert into salas(${columnas.join(',')}) select ${columnas.map(k=>`r.${k}`).join(',')} from jsonb_populate_record(null::salas,$1::text::jsonb) r`,[JSON.stringify(sala)]);
    for(const grupo of ['tomas','equipos','muebles','puertas','conexiones','bocas','puntos','material','anotaciones'] as GrupoDiseno[]) {
      for(const f of actual.snapshot.datos[grupo]) {
        const nueva:FilaDiseno={...f};
        for(const clave of ['id','origen_id','destino_id','equipo_id','conexion_id','toma_red_id','ancla_id'])if(typeof nueva[clave]==='string'&&mapa[nueva[clave] as string])nueva[clave]=mapa[nueva[clave] as string];
        if('sala_id'in nueva)nueva.sala_id=nuevoId;
        if(grupo==='anotaciones'&&nueva.ancla_tipo==='sala')nueva.ancla_id=null;
        if(grupo==='material'){nueva.lote_id=null;nueva.revision=0;}
        await insertarFila(c,grupo,nueva);
      }
    }
    const revision=await registrar(c,nuevoId,'Alternativa heredada',usuarioId,autor,await leerDiseno(c,nuevoId));
    return {salaId:nuevoId,revision,origenRevisionId:revisionOrigen.id};
  });
}
export async function compararRevisionesDiseno(conexion:SqlDiseno,salaId:string,revisionA:string,revisionB:string) {
  return conexion.begin('isolation level repeatable read read only',async tx=>{
    const c=txSql(tx);const a=await obtenerRevisionDiseno(c,salaId,revisionA);
    const b=revisionB==='actual' ? (await leerDiseno(c,salaId)).snapshot : (await obtenerRevisionDiseno(c,salaId,revisionB)).snapshot!;
    return compararDisenos(a.snapshot!,b);
  });
}
export async function compararAlternativaDiseno(conexion:SqlDiseno,salaId:string,otraSalaId:string) {
  idValido(otraSalaId);
  return conexion.begin('isolation level repeatable read read only',async tx=>{
    const c=txSql(tx);const a=await leerDiseno(c,salaId);const b=await leerDiseno(c,otraSalaId);
    if(b.origen?.salaId===salaId)return compararDisenos(a.snapshot,b.snapshot,b.mapa);
    if(a.origen?.salaId===otraSalaId)return compararDisenos(b.snapshot,a.snapshot,a.mapa);
    throw new ErrorRevisionDiseno('Sólo se comparan una sala y sus alternativas directas.',404);
  });
}

import { createHmac,randomUUID,timingSafeEqual } from 'node:crypto';
import { bloquearAmbito } from '../seguimiento-propuestas/repositorio';
import { autorResultado,exigirResultado,type Conexion,type Identidad } from './autorizacion';
import { contexto,aprobarFuente,corteAutorizado,comprobarActual } from './repositorio';
import { compararRegistrado } from './comparacion';
import { ErrorResultado,LIMITES_RESULTADOS,hash,validar,uuid,seleccionSchema,confirmarSchema,comprobarTamano,type SeleccionResultado,type SnapshotResultado } from './modelo';
interface Opciones {secreto?:string;reloj?:()=>Date;antesDeGuardar?:()=>Promise<void>}
export class ServicioResultados{
 constructor(public sql:Conexion,private configuracion:Opciones={}){}
 private ahora(){return +(this.configuracion.reloj?.()??new Date());}
 private secreto(){const s=this.configuracion.secreto??process.env.SESION_SECRETO??'';if(s.length<24)throw new ErrorResultado('Falta configuración segura de resultados.',503);return s;}
 private async lectura<T>(id:string,f:(c:Conexion,u:Identidad)=>Promise<T>):Promise<T>{return this.sql.begin('isolation level repeatable read read only',async tx=>{const c=tx as unknown as Conexion;return f(c,await autorResultado(c,id));}) as Promise<T>;}
 private contenido(snapshot:SnapshotResultado){return hash({...snapshot,observadoEn:null});}
 private token(usuarioId:string,huella:string){const p=Buffer.from(JSON.stringify({v:1,u:usuarioId,h:huella,exp:this.ahora()+LIMITES_RESULTADOS.tokenMs})).toString('base64url');return p+'.'+createHmac('sha256',this.secreto()).update(p).digest('base64url');}
 private comprobarToken(token:string,usuario:string,huella:string){try{const [p,f,...extra]=token.split('.');if(!p||!f||extra.length)throw new Error();const a=createHmac('sha256',this.secreto()).update(p).digest(),b=Buffer.from(f,'base64url');if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error();const d=JSON.parse(Buffer.from(p,'base64url').toString());if(d.v!==1||d.u!==usuario||d.h!==huella||!Number.isSafeInteger(d.exp)||d.exp<=this.ahora()||d.exp>this.ahora()+LIMITES_RESULTADOS.tokenMs)throw new Error();}catch{throw new ErrorResultado('El preview cambió o caducó. Conserva tu selección y prepara de nuevo.',409);}}
 async autorizar(usuario:string,editar=false){return this.lectura(usuario,async(_c,u)=>{exigirResultado(u,editar);return {id:u.id};});}
 private async construir(c:Conexion,u:Identidad,s:SeleccionResultado):Promise<SnapshotResultado>{
  exigirResultado(u,true);const x=await contexto(c,u,s.propuestaId,s.revisionId,true);comprobarActual(x,s);
  const aprobacion=await aprobarFuente(c,u,x.p,x.r,s.aceptacionId),coste=await corteAutorizado(c,u,s.costeCorteId);
  if(coste.hash!==s.costeHash)throw new ErrorResultado('El hash del corte de costes no coincide.',409);
  const comparacion=compararRegistrado(aprobacion,coste,s);
  const snapshot:SnapshotResultado={versionModelo:1,seleccion:s,aprobacion,coste,comparacion,observadoEn:new Date(this.ahora()).toISOString(),autor:{id:u.id,nombre:u.nombre},permisosHash:hash(u.permisos)};comprobarTamano(snapshot);return snapshot;
 }
 async preparar(usuarioId:string,datos:unknown){await this.autorizar(usuarioId,true);const s=validar(seleccionSchema,datos);return this.lectura(usuarioId,async(c,u)=>{const snapshot=await this.construir(c,u,s);return {seleccion:s,snapshot,hash:this.contenido(snapshot),token:this.token(u.id,this.contenido(snapshot))};});}
 async guardar(usuarioId:string,datos:unknown){
  await this.autorizar(usuarioId,true);const e=validar(confirmarSchema,datos),s=e.seleccion,huella=hash(e);
  return this.sql.begin('isolation level read committed',async tx=>{
   const c=tx as unknown as Conexion;let u=await autorResultado(c,usuarioId,true),x=await contexto(c,u,s.propuestaId,s.revisionId,true);
   await bloquearAmbito(c,x.r);
   // Compartir sala→proyecto→propuesta con06/07A; las escrituras05 bloquean esos contextos.
   await c`select id from propuestas where id=${s.propuestaId} for update`;
   u=await autorResultado(c,usuarioId,true);x=await contexto(c,u,s.propuestaId,s.revisionId,true);exigirResultado(u,true,x.p.ambito);
   // Revalidar también la ACL específica05 ANTES de leer cualquier operación monetaria07.
   await corteAutorizado(c,u,s.costeCorteId);
   const [previa]=await c`select hash_peticion,propuesta_id,revision_id,tipo,resultado_id from propuesta_seguimiento_operaciones where autor_id=${u.id} and clave_peticion=${e.clavePeticion}`;
   if(previa){if(previa.hash_peticion!==huella||previa.tipo!=='resultado'||previa.propuesta_id!==s.propuestaId||previa.revision_id!==s.revisionId)throw new ErrorResultado('La clave de petición pertenece a otro contenido.',409);return {id:String(previa.resultado_id),repetida:true};}
   comprobarActual(x,s);
   const salasActuales=await c`select s.id,l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id in ${c(x.r.salas.map(s=>s.id))}`;
   if(salasActuales.length!==x.r.salas.length||salasActuales.some(sala=>sala.proyecto_id!==s.cobertura.proyectoId))throw new ErrorResultado('Cambió la pertenencia de las salas. Conserva tu declaración y prepara de nuevo.',409);
   const snapshot=await this.construir(c,u,s);this.comprobarToken(e.token,u.id,this.contenido(snapshot));
   let anterior:{id:string;numero:number;serie_id:string}|undefined;
   if(s.serieId){[anterior]=await c`select id,numero,serie_id from propuesta_resultado_cortes where propuesta_id=${s.propuestaId} and serie_id=${s.serieId} order by numero desc limit 1`;if(!anterior||anterior.id!==s.actualId||anterior.numero!==s.numeroActual)throw new ErrorResultado('Otra persona avanzó la serie. Conserva tu selección y compara.',409);}
   else if(s.actualId||s.numeroActual)throw new ErrorResultado('Una serie nueva no tiene antecedente.');
   const id=randomUUID(),serieId=s.serieId??randomUUID(),numero=(anterior?.numero??0)+1,sha256=hash(snapshot);
   await c`insert into propuesta_resultado_cortes(id,serie_id,numero,antecedente_id,propuesta_id,revision_id,aceptacion_id,coste_corte_id,alcance,snapshot,sha256,estado,motivo,autor_id) values(${id},${serieId},${numero},${anterior?.id??null},${s.propuestaId},${s.revisionId},${s.aceptacionId},${s.costeCorteId},${c.json(s.cobertura)},${c.json(JSON.parse(JSON.stringify(snapshot)))},${sha256},${snapshot.comparacion.estado},${s.motivo},${u.id})`;
   await c`insert into propuesta_seguimiento_operaciones(autor_id,clave_peticion,hash_peticion,propuesta_id,revision_id,tipo,resultado_id) values(${u.id},${e.clavePeticion},${huella},${s.propuestaId},${s.revisionId},'resultado',${id})`;
   await this.configuracion.antesDeGuardar?.();return {id,serieId,numero,hash:sha256,estado:snapshot.comparacion.estado,repetida:false};
  });
 }
 async leer(usuarioId:string,id:string){validar(uuid,id);return this.lectura(usuarioId,async(c,u)=>{
  // Sólo identificadores antes de validar las fuentes y la ACL privada actual.
  const [meta]=await c`select propuesta_id,revision_id,coste_corte_id from propuesta_resultado_cortes where id=${id}`;
  if(!meta)throw new ErrorResultado('Resultado no encontrado.',404);
  const x=await contexto(c,u,meta.propuesta_id,meta.revision_id),coste=await corteAutorizado(c,u,meta.coste_corte_id);
  const [r]=await c`select id,serie_id,numero,antecedente_id,snapshot,sha256,estado,motivo,autor_id,creado_en from propuesta_resultado_cortes where id=${id}`;
  const snapshot=r.snapshot as SnapshotResultado;
  if(snapshot.versionModelo!==1||hash(snapshot)!==r.sha256||snapshot.aprobacion.propuestaId!==meta.propuesta_id||snapshot.aprobacion.revisionId!==meta.revision_id||snapshot.aprobacion.revisionHash!==x.r.sha256||snapshot.coste.id!==meta.coste_corte_id||snapshot.coste.hash!==coste.hash||snapshot.comparacion.estado!==r.estado)throw new ErrorResultado('El resultado conservado no supera la comprobación de integridad.',503);
  const causas=[...coste.causasDesactualizacion];if(x.p.actual_revision_id!==meta.revision_id)causas.push('Hay una revisión nueva de la propuesta');if(x.estado!=='aceptada'||x.ultimo?.id!==snapshot.aprobacion.aceptacionId)causas.push('La aceptación guardada ya no es la decisión vigente');
  if(x.p.archivada_en)causas.push('La propuesta está archivada');
  const salas=await c`select s.id,l.proyecto_id from salas s left join localizaciones l on l.id=s.localizacion_id where s.id in ${c(snapshot.aprobacion.salaIds)}`;
  if(salas.length!==snapshot.aprobacion.salaIds.length||salas.some(s=>s.proyecto_id!==snapshot.aprobacion.proyectoId))causas.push('Cambió la pertenencia de las salas de la fuente');
  const [posterior]=await c`select id from propuesta_resultado_cortes where serie_id=${r.serie_id} and numero>${r.numero} limit 1`;if(posterior)causas.push('Existe otro corte posterior de esta serie');
  return {id:String(r.id),serieId:String(r.serie_id),numero:Number(r.numero),antecedenteId:r.antecedente_id as string|null,hash:String(r.sha256),snapshot,creadoEn:new Date(r.creado_en).toISOString(),vigente:causas.length===0,causasDesactualizacion:[...new Set(causas)]};
 });}
 async opciones(usuarioId:string,proyectoId:string,propuestaId?:string,revisionId?:string,corteId?:string,
  pagina:{propuestasDesde?:string;resultadosDesde?:string}={}){
  for(const id of [proyectoId,propuestaId,revisionId,corteId,pagina.propuestasDesde,pagina.resultadosDesde])if(id!==undefined)validar(uuid,id);
  if(pagina.resultadosDesde&&!propuestaId)throw new ErrorResultado('Selecciona la propuesta del historial.');
  return this.lectura(usuarioId,async(c,u)=>{
  const [filaProyecto]=await c`select id,nombre from proyectos where id=${proyectoId}`;if(!filaProyecto)throw new ErrorResultado('Obra no encontrada.',404);const proyecto={id:String(filaProyecto.id),nombre:String(filaProyecto.nombre)};
  const pertenece=c`(p.proyecto_id=${proyectoId} or exists(select 1 from salas s join localizaciones l on l.id=s.localizacion_id where s.id=p.sala_id and l.proyecto_id=${proyectoId}))`;
  const [cuenta]=await c`select count(*)::int as total from propuestas p join propuesta_revisiones r on r.id=p.actual_revision_id where ${pertenece}`;
  // UUID inmutable como cursor: una nueva revisión/título no mueve una opción de página.
  const propuestasDesde=pagina.propuestasDesde??null;
  const filasPropuestas=await c`select p.id,p.version,p.actual_revision_id,r.numero,r.titulo from propuestas p join propuesta_revisiones r on r.id=p.actual_revision_id where ${pertenece}
    and (${propuestasDesde}::uuid is null or p.id>${propuestasDesde}::uuid) order by p.id limit ${LIMITES_RESULTADOS.pagina+1}`;
  const hayMasPropuestas=filasPropuestas.length>LIMITES_RESULTADOS.pagina;
  filasPropuestas.splice(LIMITES_RESULTADOS.pagina);
  const propuestas=filasPropuestas.map(p=>({id:String(p.id),version:Number(p.version),actual_revision_id:String(p.actual_revision_id),numero:Number(p.numero),titulo:String(p.titulo)}));
  const propuestasPagina={total:Number(cuenta.total),cursor:propuestasDesde,siguiente:hayMasPropuestas?propuestas.at(-1)!.id:null};
  const resultadosVacios={total:0,cursor:null as string|null,siguiente:null as string|null};
  if(!propuestaId)return {proyecto,propuestas,propuestasPagina,propuestaSeleccionada:null,contexto:null,resultados:[],resultadosPagina:resultadosVacios,corte:null};
  // La selección explícita se resuelve por su identidad, aunque no esté en esta página.
  const [miembro]=await c`select p.id from propuestas p where p.id=${propuestaId} and ${pertenece}`;
  if(!miembro)throw new ErrorResultado('La propuesta pertenece a otra obra.',404);
  const x=await contexto(c,u,propuestaId,revisionId);const aprobacion=x.ultimo?.tipo==='aceptar'?await aprobarFuente(c,u,x.p,x.r,x.ultimo.id):null;
  if(aprobacion&&aprobacion.proyectoId!==proyectoId)throw new ErrorResultado('La propuesta pertenece a otra obra.',404);
  const propuestaSeleccionada={id:String(x.p.id),version:Number(x.p.version),actual_revision_id:String(x.p.actual_revision_id),numero:Number(x.r.numero),titulo:String(x.r.titulo)};
  const [cantidad]=await c`select count(*)::int as total from propuesta_resultado_cortes where propuesta_id=${propuestaId}`;
  let desde:{creado_en:Date|string;id:string}|undefined;
  if(pagina.resultadosDesde){
   const [fila]=await c`select id,creado_en::text as creado_en,coste_corte_id from propuesta_resultado_cortes where id=${pagina.resultadosDesde} and propuesta_id=${propuestaId}`;
   if(!fila)throw new ErrorResultado('El cursor no pertenece al historial seleccionado.');
   await corteAutorizado(c,u,fila.coste_corte_id);
   desde={id:String(fila.id),creado_en:fila.creado_en};
  }
  const referencias=await c`select id,coste_corte_id from propuesta_resultado_cortes where propuesta_id=${propuestaId}
    and (${desde?.id??null}::uuid is null or (creado_en,id)<(${desde?.creado_en??null}::timestamptz,${desde?.id??null}::uuid))
    order by creado_en desc,id desc limit ${LIMITES_RESULTADOS.pagina+1}`;
  const hayMasResultados=referencias.length>LIMITES_RESULTADOS.pagina;
  referencias.splice(LIMITES_RESULTADOS.pagina);
  for(const id of new Set(referencias.map(r=>String(r.coste_corte_id))))await corteAutorizado(c,u,id);
  const filasResultados=referencias.length?await c`select id,numero,estado,creado_en from propuesta_resultado_cortes where id in ${c(referencias.map(r=>r.id))} order by creado_en desc,id desc`:[];
  const resultados=filasResultados.map(r=>({id:String(r.id),numero:Number(r.numero),estado:String(r.estado),creado_en:new Date(r.creado_en).toISOString()}));
  const resultadosPagina={total:Number(cantidad.total),cursor:pagina.resultadosDesde??null,siguiente:hayMasResultados?resultados.at(-1)!.id:null};
  const corte=corteId?await corteAutorizado(c,u,corteId):null;
  if(corte&&corte.proyectoId!==proyectoId)throw new ErrorResultado('El corte pertenece a otra obra.',422);
  return {proyecto,propuestas,propuestasPagina,propuestaSeleccionada,contexto:{propuestaId:x.p.id,revisionId:x.r.id,revisionHash:x.r.sha256,versionPropuesta:x.p.version,versionSeguimiento:x.versionSeguimiento,aceptacionId:aprobacion?.aceptacionId??null,estado:x.estado,aprobacion},resultados,resultadosPagina,corte};
 });}
}

import { cantidadesMaterial } from './conciliacion';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { fechaCivil } from '../informes/periodos';
import { formatearDecimal, parsearDecimal } from '../importes';
import { rangoTrabajoMadrid } from '../tiempos/fechas';
import { autorCostes, exigirFinanzas, type AutorCostes } from './autorizacion';
import { bloquearContextos, comprobarAsociacion, movimientoFila, movimientosPorId, versionesMaterial } from './lecturas';
import { entrada, ErrorCoste, confirmarMaterialSchema, seleccionMaterialSchema, LIMITES_COSTES, type ConexionCostes, type EntradaMaterial, type MovimientoCoste, type SeleccionMaterial, type VersionMaterial } from './modelo';
import { signoConsumo, validarMaterial } from './material';
import { bloquearPeticion, comprobarRevision, firmarRevision, operacionPrevia, registrarOperacion, sha256 } from './servicio';
export async function autorizarFuentesMaterial(c:ConexionCostes,u:AutorCostes,versionIds:string[]=[],apunteIds:string[]=[]) {
  exigirFinanzas(u,{salas:true,material:true});
  if(!versionIds.length&&!apunteIds.length)return;
  const vf=versionIds.length?c`id in ${c(versionIds)}`:c`false`,af=apunteIds.length?c`apunte_id in ${c(apunteIds)}`:c`false`;
  const [r]=await c`select bool_or(evidencia->>'pedidoLineaId' is not null) as pedido,bool_or(evidencia->>'cargaLineaId' is not null) as carga from coste_material_versiones where ${vf} or ${af}`;
  exigirFinanzas(u,{pedido:!!r?.pedido,carga:!!r?.carga});
}
async function leerEvidencias(c:ConexionCostes,u:AutorCostes,e:EntradaMaterial,m:MovimientoCoste) {
  exigirFinanzas(u,{material:true,salas:!!e.salaId||!!m.salaId,pedido:!!e.evidencia.pedidoLineaId,carga:!!e.evidencia.cargaLineaId});
  const evidencia:VersionMaterial['evidencia']={...e.evidencia};
  if(e.evidencia.fechaAdquisicion)try{fechaCivil(e.evidencia.fechaAdquisicion);}catch{throw new ErrorCoste('ENTRADA_INVALIDA','Fecha de adquisición inválida.');}
  if(e.evidencia.pedidoLineaId) {
    const [p]=await c`select l.id,l.pedido_id,l.articulo_id,l.cantidad::text,l.cantidad_recibida::text,l.precio_unitario::text,l.precio_orientativo,p.referencia,p.fecha::text,p.proyecto_id,p.sala_id from pedido_lineas l join pedidos p on p.id=l.pedido_id where l.id=${e.evidencia.pedidoLineaId}`;
    if(!p||p.articulo_id!==m.articuloId)throw new ErrorCoste('EVIDENCIA_INVALIDA','La línea de pedido no corresponde al artículo.',422);
    evidencia.pedido=p;
  }
  if(e.evidencia.cargaLineaId) {
    const [l]=await c`select l.id,l.carga_id,l.articulo_id,l.cantidad::text,l.cargado,l.instalado::text,l.devuelto::text,l.roto::text,c.sala_id,c.estado::text from carga_lineas l join cargas c on c.id=l.carga_id where l.id=${e.evidencia.cargaLineaId}`;
    if(!l||l.articulo_id!==m.articuloId)throw new ErrorCoste('EVIDENCIA_INVALIDA','La línea de carga no corresponde al artículo.',422);
    evidencia.carga=l;
  }
  return evidencia;
}
export interface RevisionMaterial { entrada:EntradaMaterial; movimiento:MovimientoCoste; anterior:VersionMaterial|null; origenSalida:VersionMaterial|null; origenDevolucion:VersionMaterial|null; resuelto:ReturnType<typeof validarMaterial>; evidencia:VersionMaterial['evidencia']; fuenteSha256:string }
export async function vigenciaMaterial(c:ConexionCostes,u:AutorCostes,v:VersionMaterial,vistos=new Set<string>()):Promise<string[]> {
  if(vistos.has(v.id))return ['Ciclo de linaje económico'];vistos.add(v.id);
  exigirFinanzas(u,{salas:true,material:true,pedido:!!v.evidencia.pedidoLineaId,carga:!!v.evidencia.cargaLineaId});
  const causas:string[]=[];
  const m=(await movimientosPorId(c,[v.movimientoId]))[0];
  if(!m||sha256(m)!==v.movimientoSha256)causas.push('Fuente física o jerarquía modificada');
  const [actual]=await c`select id,accion from coste_material_versiones where apunte_id=${v.apunteId} order by numero desc limit 1`;
  if(actual?.id!==v.id||actual?.accion==='anular')causas.push('Versión económica sustituida o anulada');
  if(m&&(v.evidencia.pedidoLineaId||v.evidencia.cargaLineaId)) {
    try {const copia=await leerEvidencias(c,u,{...v,proyectoId:v.proyectoId,evidencia:v.evidencia,accion:'imputar',movimientoId:v.movimientoId,precioUnitario:v.precioUnitario,origenSalidaVersionId:v.origenSalidaVersionId,origenDevolucionVersionId:v.origenDevolucionVersionId} as EntradaMaterial,m);if(sha256(copia)!==sha256(v.evidencia))causas.push('Evidencia auxiliar modificada');}
    catch(e){if(e instanceof ErrorCoste&&e.status===403)throw e;causas.push('Evidencia auxiliar desaparecida o modificada');}
  }
  for(const id of [v.origenSalidaVersionId,v.origenDevolucionVersionId].filter((x):x is string=>!!x)) {
    await autorizarFuentesMaterial(c,u,[id]);const [origen]=await versionesMaterial(c,[id]);
    if(!origen)causas.push('Antecedente económico desaparecido');
    else {const otros=await vigenciaMaterial(c,u,origen,new Set(vistos));if(otros.length)causas.push('Antecedente económico desactualizado');}
  }
  return [...new Set(causas)];
}
export async function construirMaterial(c:ConexionCostes,usuarioId:string,s:SeleccionMaterial):Promise<RevisionMaterial[]> {
  const u=await autorCostes(c,usuarioId);exigirFinanzas(u,{material:true,salas:true,pedido:s.apuntes.some(e=>!!e.evidencia.pedidoLineaId),carga:s.apuntes.some(e=>!!e.evidencia.cargaLineaId)});
  const origenIds=[...new Set(s.apuntes.flatMap(e=>[e.origenSalidaVersionId,e.origenDevolucionVersionId]).filter((s):s is string=>!!s))];
  const apunteIds=s.apuntes.flatMap(e=>e.apunteId?[e.apunteId]:[]);
  await autorizarFuentesMaterial(c,u,origenIds,apunteIds);
  const antecedentes=await versionesMaterial(c,origenIds,apunteIds),movimientos=await movimientosPorId(c,s.apuntes.map(e=>e.movimientoId));
  const revisiones:RevisionMaterial[]=[];
  for(const e of s.apuntes) {
    const m=movimientos.find(m=>m.id===e.movimientoId);if(!m)throw new ErrorCoste('NO_ENCONTRADO','No se encuentra el movimiento físico.',404);
    const anterior=e.apunteId?antecedentes.find(v=>v.apunteId===e.apunteId)??null:null;
    await comprobarAsociacion(c,e.proyectoId,e.salaId,e.tareaId,!!e.evidencia.atribucion||!!anterior);
    if(e.accion==='imputar') {if(e.apunteId||e.numeroActual||e.actualId)throw new ErrorCoste('ENTRADA_INVALIDA','Un apunte nuevo no tiene antecedente.');}
    else if(!anterior||anterior.id!==e.actualId||anterior.numero!==e.numeroActual)throw new ErrorCoste('VERSION_CAMBIADA','El apunte ha cambiado. Revisa su historial.',409);
    if(anterior&&(anterior.movimientoId!==e.movimientoId||anterior.proyectoId!==e.proyectoId||anterior.salaId!==e.salaId||anterior.tareaId!==e.tareaId))throw new ErrorCoste('IDENTIDAD_INMUTABLE','Para otra obra, tarea o movimiento anula y crea un apunte nuevo.',422);
    if(!anterior&&(!m.salaId||m.proyectoActualId!==e.proyectoId||m.salaId!==e.salaId)&&!e.evidencia.atribucion)throw new ErrorCoste('ATRIBUCION_REQUERIDA','Explica la atribución histórica de este movimiento a la obra y sala.',422);
    if(e.accion==='anular'&&anterior) {
      revisiones.push({entrada:e,movimiento:anterior.movimientoSnapshot,anterior,origenSalida:null,origenDevolucion:null,resuelto:{signo:anterior.signo,precioUnitario:anterior.precioUnitario,moneda:anterior.moneda,calidad:anterior.calidad,importeMinor:anterior.importeMinor},evidencia:anterior.evidencia,fuenteSha256:sha256({anteriorId:anterior.id})});continue;
    }
    const origen=antecedentes.find(v=>v.id===e.origenSalidaVersionId)??null,devolucion=antecedentes.find(v=>v.id===e.origenDevolucionVersionId)??null;
    for(const v of [origen,devolucion].filter((x):x is VersionMaterial=>!!x))if((await vigenciaMaterial(c,u,v)).length)throw new ErrorCoste('ANTECEDENTE_DESACTUALIZADO','Concilia la capa económica antes de enlazarla.',409);
    const resuelto=validarMaterial(e,m,origen,devolucion),evidencia=await leerEvidencias(c,u,e,m);
    if(evidencia.pedido&&(evidencia.pedido as {precio_orientativo?:boolean}).precio_orientativo&&resuelto.calidad==='documentado')resuelto.calidad='estimado';
    const fuenteSha256=sha256({entrada:e,movimiento:m,anteriorId:anterior?.id??null,origen,devolucion,resuelto,evidencia});
    revisiones.push({entrada:e,movimiento:m,anterior,origenSalida:origen,origenDevolucion:devolucion,resuelto,evidencia,fuenteSha256});
  }
  const actuales=(await c`select a.id as apunte_id,a.movimiento_id,v.accion,v.cantidad::text from coste_material_apuntes a join coste_material_versiones v on v.apunte_id=a.id where a.movimiento_id in ${c([...new Set(s.apuntes.map(e=>e.movimientoId))])} and not exists(select 1 from coste_material_versiones p where p.apunte_id=a.id and p.numero>v.numero)`).map(v=>({apunteId:String(v.apunte_id),movimientoId:String(v.movimiento_id),accion:String(v.accion),cantidad:String(v.cantidad)}));
  const sustituidos=new Set(apunteIds);
  for(const movimiento of movimientos) {
    const fisico=parsearDecimal(movimiento.cantidad,2);
    const usado=actuales.filter(v=>v.movimientoId===movimiento.id&&v.accion!=='anular'&&!sustituidos.has(v.apunteId)).reduce((n,v)=>n+parsearDecimal(v.cantidad,2),BigInt('0'));
    const nuevo=s.apuntes.filter(e=>e.movimientoId===movimiento.id&&e.accion!=='anular').reduce((n,e)=>n+parsearDecimal(e.cantidad,2),BigInt('0'));
    if(usado+nuevo>fisico)throw new ErrorCoste('REPARTO_EXCEDIDO','La cantidad vigente repartida supera el movimiento físico.',409);
  }
  // Todos los retornos, incluso de otras confirmaciones, comparten el límite de su capa exacta.
  for(const r of revisiones.filter(r=>r.entrada.accion!=='anular')) for(const [tipo,origen] of [['devolucion',r.origenSalida],['reingreso_baja',r.origenDevolucion]] as const) {
    if(r.entrada.linaje!==tipo||!origen)continue;
    const campo=tipo==='devolucion'?c`v.origen_salida_version_id=${origen.id}`:c`v.origen_devolucion_version_id=${origen.id}`;
    const filas=await c`select v.apunte_id,v.cantidad::text from coste_material_versiones v where ${campo} and v.linaje=${tipo} and v.accion<>'anular' and not exists(select 1 from coste_material_versiones posterior where posterior.apunte_id=v.apunte_id and posterior.numero>v.numero)`;
    const anterior=filas.filter(v=>!sustituidos.has(String(v.apunte_id))).reduce((n,v)=>n+parsearDecimal(String(v.cantidad),2),BigInt('0'));
    const elegidas=revisiones.filter(v=>v.entrada.accion!=='anular'&&v.entrada.linaje===tipo&&(tipo==='devolucion'?v.origenSalida?.id:v.origenDevolucion?.id)===origen.id).reduce((n,v)=>n+parsearDecimal(v.entrada.cantidad,2),BigInt('0'));
    if(anterior+elegidas>parsearDecimal(origen.cantidad,2))throw new ErrorCoste('CAPA_EXCEDIDA','Los retornos o bajas vinculados superan las unidades de la capa.',409);
  }
  return revisiones;
}
export async function prepararMaterial(c:ConexionCostes,u:string,bruto:unknown,secreto:string) {
  const seleccion=entrada(seleccionMaterialSchema,bruto),revisiones=await construirMaterial(c,u,seleccion),hash=sha256(revisiones);
  return {seleccion,revisiones,hash,token:firmarRevision(secreto,u,'material',hash)};
}
export async function confirmarMaterial(c:postgres.Sql,usuarioId:string,bruto:unknown,secreto:string,fallo?:()=>void) {
  const e=entrada(confirmarMaterialSchema,bruto);
  return c.begin(async tx=>{
    const u=await autorCostes(tx,usuarioId);exigirFinanzas(u,{salas:true,material:true,pedido:e.seleccion.apuntes.some(a=>!!a.evidencia.pedidoLineaId),carga:e.seleccion.apuntes.some(a=>!!a.evidencia.cargaLineaId)});
    await bloquearPeticion(tx,usuarioId,e.clavePeticion);await autorCostes(tx,usuarioId);
    const h=sha256(e),previa=await operacionPrevia(tx,usuarioId,e.clavePeticion,h);if(previa)return previa;
    const origenIds=e.seleccion.apuntes.flatMap(a=>[a.origenSalidaVersionId,a.origenDevolucionVersionId]).filter((s):s is string=>!!s);
    await autorizarFuentesMaterial(tx,u,origenIds,e.seleccion.apuntes.flatMap(e=>e.apunteId?[e.apunteId]:[]));
    const origenes=await versionesMaterial(tx,origenIds),movIds=[...new Set([...e.seleccion.apuntes.map(a=>a.movimientoId),...origenes.map(a=>a.movimientoId)])].sort();
    const movs=await movimientosPorId(tx,movIds);
    const salas=[...e.seleccion.apuntes.flatMap(a=>a.salaId?[a.salaId]:[]),...origenes.flatMap(a=>a.salaId?[a.salaId]:[]),...movs.flatMap(m=>m.salaId?[m.salaId]:[])];
    const proyectos=[...e.seleccion.apuntes.map(a=>a.proyectoId),...origenes.map(a=>a.proyectoId),...movs.flatMap(m=>m.proyectoActualId?[m.proyectoActualId]:[])];
    await bloquearContextos(tx,salas,proyectos,e.seleccion.apuntes.flatMap(a=>a.tareaId?[a.tareaId]:[]));
    await tx`select id from movimientos where id in ${tx(movIds)} order by id for update`;
    const aps=[...new Set([...origenes.map(a=>a.apunteId),...e.seleccion.apuntes.flatMap(a=>a.apunteId?[a.apunteId]:[])])].sort();
    if(aps.length)await tx`select id from coste_material_apuntes where id in ${tx(aps)} order by id for update`;
    const revisiones=await construirMaterial(tx,usuarioId,e.seleccion);
    comprobarRevision(secreto,e.token,usuarioId,'material',sha256(revisiones));
    const resultado=[];
    for(const r of revisiones) {
      const a=r.entrada,id=randomUUID(),apunteId=r.anterior?.apunteId??randomUUID(),numero=(r.anterior?.numero??0)+1;
      if(!r.anterior)await tx`insert into coste_material_apuntes(id,movimiento_id,proyecto_id,sala_id,tarea_id) values(${apunteId},${a.movimientoId},${a.proyectoId},${a.salaId},${a.tareaId})`;
      const fuente=r.entrada.accion==='anular'?r.anterior!:null;
      await tx`insert into coste_material_versiones(id,apunte_id,numero,antecedente_id,accion,cantidad,unidad,tipo_hecho,signo,movimiento_snapshot,movimiento_sha256,precio_unitario,moneda,calidad,importe_minor,origen_salida_version_id,origen_devolucion_version_id,linaje,evidencia,motivo,autor_id) values(${id},${apunteId},${numero},${r.anterior?.id??null},${a.accion},${fuente?.cantidad??a.cantidad},${fuente?.unidad??a.unidad},${r.movimiento.tipo},${r.resuelto.signo},${tx.json(JSON.parse(JSON.stringify(r.movimiento)))},${fuente?.movimientoSha256??sha256(r.movimiento)},${r.resuelto.precioUnitario},${r.resuelto.moneda},${r.resuelto.calidad},${r.resuelto.importeMinor},${fuente?.origenSalidaVersionId??a.origenSalidaVersionId},${fuente?.origenDevolucionVersionId??a.origenDevolucionVersionId},${fuente?.linaje??a.linaje},${tx.json(JSON.parse(JSON.stringify(r.evidencia)))},${a.motivo},${usuarioId})`;
      resultado.push({id,apunteId,numero,importeMinor:r.resuelto.importeMinor,moneda:r.resuelto.moneda,calidad:r.resuelto.calidad});fallo?.();
    }
    const salida={apuntes:resultado};await registrarOperacion(tx,usuarioId,e.clavePeticion,h,'material',salida);return salida;
  });
}
export async function candidatosMaterial(c:ConexionCostes,usuarioId:string,proyectoId:string,desde:string,hasta:string,pagina=1,q='',todos=false) {
  const u=await autorCostes(c,usuarioId);exigirFinanzas(u,{material:true,salas:true});const r=rangoTrabajoMadrid(desde,hasta);
  const filtro=todos?c`true`:c`l.proyecto_id=${proyectoId}`;
  const busqueda=q.trim()?c`(a.modelo ilike ${'%'+q.trim()+'%'} or a.descripcion ilike ${'%'+q.trim()+'%'} or m.id::text=${q.trim()})`:c`true`;
  const [{total}]=await c`select count(*)::int as total from movimientos m join articulos a on a.id=m.articulo_id left join salas s on s.id=m.sala_id left join localizaciones l on l.id=s.localizacion_id where ${filtro} and ${busqueda} and m.fecha>=${r.inicioUtc} and m.fecha<${r.finUtcExclusivo}`;
  const filas=await c`select m.id,m.articulo_id,coalesce(a.descripcion,a.modelo) as descripcion,a.unidad::text,m.tipo::text,m.cantidad::text,m.fecha,m.sala_id,l.proyecto_id,m.ubicacion_id,m.motivo,m.quien from movimientos m join articulos a on a.id=m.articulo_id left join salas s on s.id=m.sala_id left join localizaciones l on l.id=s.localizacion_id where ${filtro} and ${busqueda} and m.fecha>=${r.inicioUtc} and m.fecha<${r.finUtcExclusivo} order by m.fecha,m.id limit ${LIMITES_COSTES.pagina} offset ${(pagina-1)*LIMITES_COSTES.pagina}`;
  const actuales=filas.length?(await c`select a.id as apunte_id,a.movimiento_id,a.proyecto_id,v.id,v.numero,v.accion,v.cantidad::text from coste_material_apuntes a join coste_material_versiones v on v.apunte_id=a.id where a.movimiento_id in ${c(filas.map(m=>String(m.id)))} and not exists(select 1 from coste_material_versiones p where p.apunte_id=a.id and p.numero>v.numero)`).map(v=>({apunteId:String(v.apunte_id),movimientoId:String(v.movimiento_id),proyectoId:String(v.proyecto_id),id:String(v.id),numero:Number(v.numero),accion:String(v.accion),cantidad:String(v.cantidad)})):[];
  return {candidatos:filas.map(f=>{const m=movimientoFila(f);return {...m,sugerencia:true,clasificacion:signoConsumo(m.tipo)===null?'evidencia_no_consumo':'consumo_posible',...cantidadesMaterial(m.cantidad,formatearDecimal(actuales.filter(v=>v.movimientoId===m.id&&v.accion!=='anular').reduce((n,v)=>n+parsearDecimal(v.cantidad,2),BigInt('0')),2)),apuntes:actuales.filter(v=>v.movimientoId===m.id).map(v=>({apunteId:v.apunteId,versionId:v.id,numero:v.numero,proyectoId:v.proyectoId,cantidad:v.cantidad,accion:v.accion}))};}),total:Number(total),pagina};
}
export async function historialMaterial(c:ConexionCostes,usuarioId:string,apunteId:string,pagina=1) {
  const u=await autorCostes(c,usuarioId);await autorizarFuentesMaterial(c,u,[],[apunteId]);
  const versiones=await versionesMaterial(c,[],[apunteId],{historial:true,limite:LIMITES_COSTES.pagina,offset:(pagina-1)*LIMITES_COSTES.pagina});if(!versiones.length&&pagina===1)throw new ErrorCoste('NO_ENCONTRADO','No se encuentra el apunte.',404);
  const paginaV=versiones,[{total}]=await c`select count(*)::int as total from coste_material_versiones where apunte_id=${apunteId}`;
  return {versiones:await Promise.all(paginaV.map(async v=>({...v,causasDesactualizacion:await vigenciaMaterial(c,u,v)}))),pagina,total:Number(total)};
}

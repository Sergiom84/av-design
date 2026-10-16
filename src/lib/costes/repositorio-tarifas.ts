import { randomUUID } from 'node:crypto';
import { autorCostes } from './autorizacion';
import { entrada, ErrorCoste, guardarTarifaSchema, LIMITES_COSTES, tarifaSchema, type ConexionCostes } from './modelo';
import { comprobarSolapamientoTarifa } from './tarifas';
import { tarifasActuales, tarifaFila } from './lecturas';
import { bloquearPeticion, operacionPrevia, registrarOperacion, sha256 } from './servicio';
import type postgres from 'postgres';
export async function listarTarifas(c:ConexionCostes,usuarioId:string,tecnicoId?:string,pagina=1) {
  await autorCostes(c,usuarioId);
  const filtro=tecnicoId?c`tecnico_id=${tecnicoId}`:c`true`;
  const [{total}]=await c`select count(distinct serie_id)::int as total from coste_tarifa_versiones where ${filtro}`;
  const filas=await c`select id,serie_id,numero,tecnico_id,accion,desde::text,hasta_exclusivo::text,precio_hora::text,moneda,calidad,fuente,motivo,autor_id,creado_en from (select distinct on(serie_id) id,serie_id,numero,tecnico_id,accion,desde,hasta_exclusivo,precio_hora,moneda,calidad,fuente,motivo,autor_id,creado_en from coste_tarifa_versiones where ${filtro} order by serie_id,numero desc) actuales order by tecnico_id,desde,id limit ${LIMITES_COSTES.pagina} offset ${(pagina-1)*LIMITES_COSTES.pagina}`;
  return {tarifas:filas.map(tarifaFila),total:Number(total),pagina};
}
export async function historialTarifa(c:ConexionCostes,usuarioId:string,serieId:string,pagina=1) {
  await autorCostes(c,usuarioId);
  const filas=await c`select id,serie_id,numero,tecnico_id,accion,desde::text,hasta_exclusivo::text,precio_hora::text,moneda,calidad,fuente,motivo,autor_id,creado_en from coste_tarifa_versiones where serie_id=${serieId} order by numero desc limit ${LIMITES_COSTES.pagina} offset ${(pagina-1)*LIMITES_COSTES.pagina}`;
  if(!filas.length&&pagina===1) throw new ErrorCoste('NO_ENCONTRADO','No se encuentra la tarifa.',404);
  return {versiones:filas.map(tarifaFila),pagina};
}
export async function prepararTarifa(c:ConexionCostes,usuarioId:string,bruto:unknown) {
  await autorCostes(c,usuarioId); const e=entrada(tarifaSchema,bruto);
  const actuales=await tarifasActuales(c,[e.tecnicoId]);comprobarSolapamientoTarifa(e,actuales);
  return {seleccion:e,actuales,nota:'Una nueva tarifa no modifica las valoraciones ya guardadas.'};
}
export async function guardarTarifa(c:postgres.Sql,usuarioId:string,bruto:unknown,fallo?:()=>void) {
  const e=entrada(guardarTarifaSchema,bruto);
  return c.begin(async tx=>{
    await autorCostes(tx,usuarioId);await bloquearPeticion(tx,usuarioId,e.clavePeticion);await autorCostes(tx,usuarioId);
    const h=sha256(e),previa=await operacionPrevia(tx,usuarioId,e.clavePeticion,h);if(previa)return previa;
    const [tecnico]=await tx`select id,activo from tecnicos where id=${e.tecnicoId} for update`;
    if(!tecnico||(e.accion==='definir'&&!tecnico.activo))throw new ErrorCoste('TECNICO_NO_DISPONIBLE','Selecciona un técnico activo para una nueva tarifa.',422);
    const actuales=await tarifasActuales(tx,[e.tecnicoId]);
    let anterior:ReturnType<typeof tarifaFila>|undefined;
    if(e.accion==='definir') {
      if(e.serieId||e.actualId||e.numeroActual)throw new ErrorCoste('ENTRADA_INVALIDA','Una tarifa nueva no tiene antecedente.');
    } else {
      anterior=actuales.find(t=>t.serieId===e.serieId);
      if(!anterior||anterior.id!==e.actualId||anterior.numero!==e.numeroActual)throw new ErrorCoste('VERSION_CAMBIADA','La tarifa ha cambiado. Revisa su historial.',409);
    }
    comprobarSolapamientoTarifa(e,actuales);
    const id=randomUUID(),serieId=anterior?.serieId??randomUUID(),numero=(anterior?.numero??0)+1;
    await tx`insert into coste_tarifa_versiones(id,serie_id,numero,antecedente_id,tecnico_id,accion,desde,hasta_exclusivo,precio_hora,moneda,calidad,fuente,motivo,autor_id) values(${id},${serieId},${numero},${anterior?.id??null},${e.tecnicoId},${e.accion},${e.desde},${e.hastaExclusivo},${e.precioHora},${e.moneda},${e.calidad},${e.fuente},${e.motivo},${usuarioId})`;
    fallo?.();const resultado={id,serieId,numero};await registrarOperacion(tx,usuarioId,e.clavePeticion,h,'tarifa',resultado);return resultado;
  });
}

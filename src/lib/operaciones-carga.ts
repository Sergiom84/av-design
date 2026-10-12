import type {Sql} from 'postgres';
import {transaccionConControl} from './control-escritura';
import {exigirAutorCompra,type AutorCompra} from './operaciones-compras';

/**
 * Carga unitaria desde una reserva gestionada (B2c).
 *
 * Tres hechos con token propio: preparar la carga de esa reserva, marcar su
 * línea con un valor explícito y confirmar la salida desde una ubicación
 * elegida. Preparar no mueve stock; marcar es «listo para cargar», no salida.
 * Toda la autoridad —autor, identidad, saldos previos y xid8— la impone SQL:
 * aquí solo viaja el identificador de la operación y la solicitud canónica.
 */
const UUID=/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export type SolicitudCargaKit=
 |{operacionId:string;operacion:'preparar';reservaId:string;autor:AutorCompra}
 |{operacionId:string;operacion:'marcar';lineaId:string;valor:boolean;autor:AutorCompra}
 |{operacionId:string;operacion:'servir';cargaId:string;ubicacionId:string;autor:AutorCompra};

export interface ResultadoCargaKit {
  cargaId:string; lineaId:string; reservaId:string;
  marcado:boolean|null; movimientoId:string|null; reutilizada:boolean;
}
export type EstadoCargaKit={error:string|null};
export class ErrorCargaKit extends Error {}

interface SolicitudCanonica {
  autorId:string; reservaId:string|null; lineaId:string|null;
  cargaId:string|null; ubicacionId:string|null; valor:boolean|null;
}

function canonica(entrada:SolicitudCargaKit):SolicitudCanonica {
  const base:SolicitudCanonica={autorId:entrada.autor.id,reservaId:null,lineaId:null,cargaId:null,ubicacionId:null,valor:null};
  if(entrada.operacion==='preparar')return {...base,reservaId:entrada.reservaId};
  if(entrada.operacion==='marcar')return {...base,lineaId:entrada.lineaId,valor:entrada.valor};
  return {...base,cargaId:entrada.cargaId,ubicacionId:entrada.ubicacionId};
}

function exigirIdentificadores(entrada:SolicitudCargaKit){
  if(!UUID.test(entrada.operacionId))throw new ErrorCargaKit('Falta identificador de operación. Recarga.');
  const referencias=entrada.operacion==='preparar'?[entrada.reservaId]
    :entrada.operacion==='marcar'?[entrada.lineaId]:[entrada.cargaId,entrada.ubicacionId];
  if(referencias.some(id=>!id||!UUID.test(id)))
    throw new ErrorCargaKit('La reserva, la línea o la ubicación no son válidas. Recarga.');
  if(entrada.operacion==='marcar'&&typeof entrada.valor!=='boolean')
    throw new ErrorCargaKit('Marcar exige un valor explícito.');
}

interface FilaOperacion {
  operacion:string; solicitud:Record<string,unknown>;
  carga_id:string; linea_id:string; reserva_id:string;
  marcado:boolean|null; movimiento_id:string|null; reutilizada:boolean;
}
const resultado=(fila:FilaOperacion):ResultadoCargaKit=>({
  cargaId:String(fila.carga_id),lineaId:String(fila.linea_id),reservaId:String(fila.reserva_id),
  marcado:fila.marcado,movimientoId:fila.movimiento_id==null?null:String(fila.movimiento_id),
  reutilizada:fila.reutilizada===true});

export async function operarCargaKit(sql:Sql,entrada:SolicitudCargaKit):Promise<ResultadoCargaKit>{
  exigirAutorCompra(entrada.autor);
  exigirIdentificadores(entrada);
  const solicitud=canonica(entrada);
  return transaccionConControl(sql,async tx=>{
    // El replay se resuelve antes que las condiciones actuales: el mismo token
    // con la misma solicitud devuelve su resultado aunque el stock se agotara.
    const [previa]=await tx<FilaOperacion[]>`select operacion,solicitud,carga_id,linea_id,reserva_id,
      marcado,movimiento_id,reutilizada from operaciones_carga_kit where id=${entrada.operacionId}`;
    if(previa){
      if(previa.operacion!==entrada.operacion
        ||Object.entries(solicitud).some(([clave,valor])=>previa.solicitud[clave]!==valor))
        throw new ErrorCargaKit('El identificador ya se usó con otros datos.');
      return resultado(previa);
    }
    const [creada]=await tx<FilaOperacion[]>`insert into operaciones_carga_kit(id,operacion,solicitud)
      values(${entrada.operacionId},${entrada.operacion},${tx.json({...solicitud})})
      returning operacion,solicitud,carga_id,linea_id,reserva_id,marcado,movimiento_id,reutilizada`;
    return resultado(creada);
  });
}

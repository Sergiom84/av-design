import type {Sql} from 'postgres';
import {transaccionConControl} from './control-escritura';
import {exigirAutorCompra,type AutorCompra} from './operaciones-compras';

export type SolicitudReservaKit={operacionId:string;operacion:'reservar'|'liberar';suministroId?:string;reservaId?:string;autor:AutorCompra};
export type EstadoReservaKit={error:string|null};
export class ErrorReservaKit extends Error {}
export async function operarReservaKit(sql:Sql,entrada:SolicitudReservaKit):Promise<string>{
  exigirAutorCompra(entrada.autor);
  if(!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(entrada.operacionId))throw new ErrorReservaKit('Falta identificador de operación. Recarga.');
  const entidad=entrada.operacion==='reservar'?entrada.suministroId:entrada.reservaId;
  if(!entidad||!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(entidad))throw new ErrorReservaKit('La reserva o suministro no es válido. Recarga.');
  const solicitud={autorId:entrada.autor.id,suministroId:entrada.operacion==='reservar'?entrada.suministroId??null:null,
    reservaId:entrada.operacion==='liberar'?entrada.reservaId??null:null};
  return transaccionConControl(sql,async tx=>{
    const [previa]=await tx`select operacion,solicitud,reserva_id from operaciones_reserva_kit where id=${entrada.operacionId}`;
    if(previa){
      if(previa.operacion!==entrada.operacion||Object.entries(solicitud).some(([k,v])=>previa.solicitud[k]!==v))throw new ErrorReservaKit('El identificador ya se usó con otros datos.');
      return String(previa.reserva_id);
    }
    const [creada]=await tx`insert into operaciones_reserva_kit(id,operacion,solicitud,reserva_id)
      values(${entrada.operacionId},${entrada.operacion},${tx.json(solicitud)},${entrada.reservaId??entrada.operacionId}) returning reserva_id`;
    return String(creada.reserva_id);
  });
}

import { bloquearYValidarExtremos, columnasExtremo, ConexionRechazada, escribirParejaConexion, type TransaccionConexiones } from './escritura-conexiones';
import type { ExtremoConexion } from './tipos';

type Origen = 'sala'|'plantilla';
export async function exigirDisenoCopiable(tx:TransaccionConexiones,origen:Origen,id:string) {
  const plantilla=origen==='plantilla', tabla=plantilla?'plantillas_sala':'salas', campo=plantilla?'plantilla_id':'sala_id';
  const [propietario]=await tx`select id from ${tx(tabla)} where id=${id} for update`;
  if(!propietario)throw new ConexionRechazada('El diseño que se quiere copiar ya no existe.');
  if(!plantilla){
    if((await tx`select id from sala_cables_suministrados where sala_id=${id} limit 1`).length
      || (await tx`select id from conexiones where sala_id=${id} and (estado_suministro='incluido' or cable_suministrado_id is not null) limit 1`).length) {
      throw new ConexionRechazada('La copia de cables unidos o incluidos es L3D. Todavía no está disponible.');
    }
    if((await tx`select id from sala_suministros where sala_id=${id} limit 1`).length) {
      throw new ConexionRechazada('Gestionar kit: la copia necesita conservar suministros y composición. Todavía no está disponible.');
    }
  }
  // El propietario serializa las acciones. Las filas existentes también se
  // bloquean ANTES de validar: un DELETE directo o en cascada no toma la FK
  // del padre y podría invalidar el check antes de leer los cables.
  await tx`select id from ${tx(plantilla?'plantilla_conexiones':'conexiones')} where ${tx(campo)}=${id} order by id for update`;
  await tx`select id from ${tx(plantilla?'plantilla_tomas_red':'tomas_red')} where ${tx(campo)}=${id} order by id for update`;
  if(plantilla){
    await tx`select id from plantilla_tiradas_documentales where plantilla_id=${id} order by id for update`;
    const pendientes=await tx<Array<{fuente_clave:string}>>`select d.fuente_clave from plantilla_tiradas_documentales d
      left join plantilla_conexiones c on c.id=d.conexion_resuelta_id
      where d.plantilla_id=${id} and (c.id is null or c.detalle_extremos<>'completo') order by d.fuente_clave`;
    if(pendientes.length)throw new ConexionRechazada(`Documenta las tiradas pendientes antes de copiar: ${pendientes.map(d=>d.fuente_clave).join(', ')}.`);
  }
  const historicas=await tx<Array<{id:string}>>`select id from ${tx(plantilla?'plantilla_conexiones':'conexiones')} where ${tx(campo)}=${id} and detalle_extremos<>'completo' order by id`;
  if(historicas.length)throw new ConexionRechazada(`Documenta las bocas de estas tiradas antes de copiar: ${historicas.map(c=>c.id).join(', ')}.`);
  const parciales=await tx<Array<{codigo:string}>>`select codigo from ${tx(plantilla?'plantilla_tomas_red':'tomas_red')}
    where ${tx(campo)}=${id} and (x_m is null)::int+(y_m is null)::int+(z_m is null)::int not in (0,3) order by codigo`;
  if(parciales.length)throw new ConexionRechazada(`Completa las coordenadas de estas rosetas antes de copiar: ${parciales.map(t=>t.codigo).join(', ')}.`);
}

/** Un solo recorrido para sala→plantilla y las dos entradas plantilla→sala. */
export async function copiarInfraestructuraYCables(tx:TransaccionConexiones,origen:Origen,origenId:string,destinoId:string,equipos:Map<string,string>) {
  await exigirDisenoCopiable(tx,origen,origenId);
  const desdePlantilla=origen==='plantilla', destinoPlantilla=!desdePlantilla;
  const campoOrigen=desdePlantilla?'plantilla_id':'sala_id',campoDestino=destinoPlantilla?'plantilla_id':'sala_id';
  const tablaTomas=desdePlantilla?'plantilla_tomas_red':'tomas_red',tablaTomasDestino=destinoPlantilla?'plantilla_tomas_red':'tomas_red';
  const tablaBocas=desdePlantilla?'plantilla_toma_red_bocas':'toma_red_bocas',tablaBocasDestino=destinoPlantilla?'plantilla_toma_red_bocas':'toma_red_bocas';
  const campoBoca=desdePlantilla?'plantilla_toma_red_id':'toma_red_id',campoBocaDestino=destinoPlantilla?'plantilla_toma_red_id':'toma_red_id';
  const tomas=await tx<Array<{id:string;codigo:string;codigo_referencia:string|null;ubicacion:string|null;x_m:string|null;y_m:string|null;z_m:string|null;notas:string|null;capacidad_documentada:number|null;esquema_x:number|null;esquema_y:number|null}>>`
    select * from ${tx(tablaTomas)} where ${tx(campoOrigen)}=${origenId} order by id for update`;
  const mapaBocas=new Map<string,string>();
  const mapaTomas=new Map<string,string>();
  const [medidas]=await tx<Array<{largo_m:string|null;ancho_m:string|null;alto_m:string|null}>>`select largo_m,ancho_m,alto_m from ${tx(destinoPlantilla?'plantillas_sala':'salas')} where id=${destinoId}`;
  const comprobarPosicion=(p:{x_m:string|null;y_m:string|null;z_m:string|null},nombre:string)=>{
    const valores=[p.x_m,p.y_m,p.z_m],limites=[medidas.largo_m,medidas.ancho_m,medidas.alto_m];
    if(valores.some((v,i)=>v!==null&&(Number(v)<0||!Number.isFinite(Number(v))||(Number(limites[i])>0&&Number(v)>Number(limites[i])))))throw new ConexionRechazada(`${nombre} queda fuera de las medidas del destino.`);
  };
  for(const t of tomas){
    comprobarPosicion(t,`La roseta ${t.codigo}`);
    const [nueva]=await tx<Array<{id:string}>>`insert into ${tx(tablaTomasDestino)} ${tx({
      [campoDestino]:destinoId,codigo:t.codigo,codigo_referencia:t.codigo_referencia??t.codigo,codigo_confirmado:false,
      ubicacion:t.ubicacion,x_m:t.x_m,y_m:t.y_m,z_m:t.z_m,notas:t.notas,capacidad_documentada:t.capacidad_documentada,esquema_x:t.esquema_x,esquema_y:t.esquema_y,
    })} returning id`;
    mapaTomas.set(t.id,nueva.id);
    const bocas=await tx<Array<{id:string;ordinal:number;etiqueta:string|null;conector:string;senal:string}>>`select * from ${tx(tablaBocas)} where ${tx(campoBoca)}=${t.id} order by ordinal`;
    for(const b of bocas){
      const [nuevaBoca]=await tx<Array<{id:string}>>`insert into ${tx(tablaBocasDestino)} ${tx({[campoBocaDestino]:nueva.id,ordinal:b.ordinal,etiqueta:b.etiqueta,conector:b.conector,senal:b.senal})} returning id`;
      mapaBocas.set(b.id,nuevaBoca.id);
    }
  }
  const tablaConexion=desdePlantilla?'plantilla_conexiones':'conexiones',tablaDetalle=desdePlantilla?'plantilla_conexion_bocas':'conexion_bocas';
  const campoConexion=desdePlantilla?'plantilla_conexion_id':'conexion_id',campoEquipo=desdePlantilla?'linea_id':'equipo_id';
  const conexiones=await tx<Array<{id:string;articulo_cable_id:string|null;senal:string;ruta:string|null;longitud_manual_m:string|null;notas:string|null;estado_suministro:string;decision_heredada:boolean;cable_suministrado_id?:string|null}>>`
    select * from ${tx(tablaConexion)} where ${tx(campoOrigen)}=${origenId} order by creado_en,id for update`;
  let orden=0;
  for(const c of conexiones){
    const detalle=await tx<Array<{lado:'origen'|'destino';equipo_id:string|null;puerto_id:string|null;ordinal:number|null;toma_boca_id:string|null}>>`
      select lado,${tx(campoEquipo)} as equipo_id,puerto_id,ordinal,toma_boca_id from ${tx(tablaDetalle)} where ${tx(campoConexion)}=${c.id}`;
    const remapear=(lado:'origen'|'destino'):ExtremoConexion=>{
      const e=detalle.find(e=>e.lado===lado);
      if(e?.toma_boca_id){const boca=mapaBocas.get(e.toma_boca_id);if(boca)return {tipo:'roseta',toma_boca_id:boca};}
      else if(e?.equipo_id&&e.puerto_id&&e.ordinal){const equipo=equipos.get(e.equipo_id);if(equipo)return {tipo:'equipo',equipo_id:equipo,puerto_id:e.puerto_id,ordinal:Number(e.ordinal)};}
      throw new ConexionRechazada(`La tirada ${c.id} utiliza un extremo no copiado; revisa equipos opcionales y bocas.`);
    };
    const o=remapear('origen'),d=remapear('destino');
    await bloquearYValidarExtremos(tx,destinoId,[o,d],destinoPlantilla);
    const origenColumnas=columnasExtremo(o),destinoColumnas=columnasExtremo(d);
    if(c.estado_suministro==='incluido' || c.cable_suministrado_id) {
      throw new ConexionRechazada('La copia de cables unidos o incluidos es L3D. Todavía no está disponible.');
    }
    const estado=c.estado_suministro==='adicional'||c.estado_suministro==='por_determinar'?c.estado_suministro:'por_determinar';
    const heredada=estado==='adicional' && c.decision_heredada===true;
    const [nueva]=destinoPlantilla
      ?await tx<Array<{id:string}>>`insert into plantilla_conexiones(plantilla_id,origen_linea_id,destino_linea_id,articulo_cable_id,senal,ruta,longitud_manual_m,notas,orden,estado_suministro,decision_heredada) values (${destinoId},${origenColumnas.equipo_id},${destinoColumnas.equipo_id},${c.articulo_cable_id},${c.senal}::senal,${c.ruta}::ruta_cable,${c.longitud_manual_m},${c.notas},${orden++},${estado},${heredada}) returning id`
      :await tx<Array<{id:string}>>`insert into conexiones(sala_id,origen_id,destino_id,puerto_origen_id,puerto_destino_id,articulo_cable_id,senal,ruta,longitud_manual_m,notas,estado_suministro,decision_heredada) values (${destinoId},${origenColumnas.equipo_id},${destinoColumnas.equipo_id},${origenColumnas.puerto_id},${destinoColumnas.puerto_id},${c.articulo_cable_id},${c.senal}::senal,${c.ruta}::ruta_cable,${c.longitud_manual_m},${c.notas},${estado},${heredada}) returning id`;
    await escribirParejaConexion(tx,nueva.id,o,d,destinoPlantilla);
    const puntos=await tx<Array<{orden:number;x_m:string;y_m:string;z_m:string}>>`select orden,x_m,y_m,z_m from ${tx(desdePlantilla?'plantilla_conexion_puntos_paso':'conexion_puntos_paso')} where ${tx(campoConexion)}=${c.id} order by orden`;
    for(const p of puntos){
      comprobarPosicion(p,`Un punto de la tirada ${c.id}`);
      await tx`insert into ${tx(destinoPlantilla?'plantilla_conexion_puntos_paso':'conexion_puntos_paso')} ${tx({[destinoPlantilla?'plantilla_conexion_id':'conexion_id']:nueva.id,orden:p.orden,x_m:p.x_m,y_m:p.y_m,z_m:p.z_m})}`;
    }
  }
  return mapaTomas;
}

import type { UsuarioSesion } from './sesion-servidor';
import { ErrorPreferencias, TARJETAS_PANEL, panelAutorizado, validarPanel, type ClaveTarjeta, type PreferenciasPanel } from './preferencias-usuario';
import { usuarioPreferenciasActual, type SqlPreferencias } from './preferencias-usuario-repositorio';
import { leerAgendaEnLectura } from './planificacion/servicio';
export interface AvisoPanel {clave:ClaveTarjeta;texto:string;href:string}
export interface DatosPanel {tarjetas:((typeof TARJETAS_PANEL)[number]&{valor:number|'Consultar'})[];avisos:AvisoPanel[];preferencias:PreferenciasPanel;version:number;opciones:readonly (typeof TARJETAS_PANEL)[number][]}
/** Una lectura coherente; cada rama pertenece exclusivamente a una sección visible. */
export async function leerPanel(c:SqlPreferencias,yo:UsuarioSesion,ahora=new Date()):Promise<DatosPanel>{
  return c.begin('isolation level repeatable read read only',async tx=>{
    const t=tx as unknown as SqlPreferencias;
    const actual=await usuarioPreferenciasActual(t,yo,'panel',true);
    const [fila]=actual.ficticio?[]:await t`select panel,version from preferencias_usuario where usuario_id=${actual.id}`;
    const preferencias=panelAutorizado(validarPanel(fila?.panel??{}),actual.permisos,actual.ficticio);
    const visibles=preferencias.orden.filter(k=>!preferencias.ocultas.includes(k));
    const agenda=visibles.some(k=>{const def=TARJETAS_PANEL.find(d=>d.clave===k)!;return 'planificacion'in def;})
      ?await leerAgendaEnLectura(t,actual.id,{vista:'semana'},ahora):null;
    const valores:Partial<Record<ClaveTarjeta,number|'Consultar'>>={};const avisos:AvisoPanel[]=[];
    for(const clave of visibles){
      const definicion=TARJETAS_PANEL.find(d=>d.clave===clave)!;
      if('enlaceSolo'in definicion){
        valores[clave]='Consultar';
      }else if('planificacion'in definicion&&agenda){
        valores[clave]=definicion.planificacion==='minutos_persona_semana'
          ?agenda.ocupacion.reduce((total,p)=>total+p.minutos,0)
          :agenda.contadores[definicion.planificacion];
      }else if(clave==='equipos'||clave==='cables'||clave==='consumibles'){
        const tipo=clave==='equipos'?'equipo':clave==='cables'?'cable':'consumible';
        const [f]=await t`select count(*)::int total,count(*) filter(where coste_orientativo)::int orientativos,count(*) filter(where coste is null)::int sin_precio from articulos where tipo=${tipo}`;
        valores[clave]=Number(f.total);
        if(clave==='cables'&&Number(f.sin_precio))avisos.push({clave,texto:`${f.sin_precio} referencias de cable sin precio de coste.`,href:'/catalogo'});
        if(Number(f.orientativos))avisos.push({clave,texto:`${f.orientativos} referencias con coste orientativo (${tipo}).`,href:'/catalogo'});
      }else if(clave==='plantillas'||clave==='salas'){
        const [f]=clave==='plantillas'?await t`select count(*)::int total,count(*) filter(where largo_m is null or ancho_m is null or alto_m is null or largo_m<=0 or ancho_m<=0 or alto_m<=0)::int sin_medidas from plantillas_sala`:await t`select count(*)::int total,count(*) filter(where largo_m is null or ancho_m is null or alto_m is null or largo_m<=0 or ancho_m<=0 or alto_m<=0)::int sin_medidas from salas`;
        valores[clave]=Number(f.total);if(Number(f.sin_medidas))avisos.push({clave,texto:`${f.sin_medidas} ${clave} sin medidas.`,href:`/${clave}`});
      }else if(clave==='almacen'){
        const [f]=await t`select count(*)::int total from (select articulo_id from existencias group by articulo_id) x`;valores.almacen=Number(f.total);
        const [b]=await t`select count(*)::int n from articulos a where a.stock_minimo>0 and coalesce((select sum(cantidad) from existencias e where e.articulo_id=a.id),0)-coalesce((select sum(cantidad) from reservas r where r.articulo_id=a.id and r.estado='activa'),0)<a.stock_minimo and (exists(select 1 from existencias e where e.articulo_id=a.id) or exists(select 1 from reservas r where r.articulo_id=a.id))`;
        if(Number(b.n))avisos.push({clave,texto:`${b.n} referencias por debajo del stock mínimo disponible.`,href:'/almacen'});
      }else if(clave==='reservas'){const [f]=await t`select count(*)::int total from reservas where estado='activa'`;valores.reservas=Number(f.total);
      }else if(clave==='pedidos'){const [f]=await t`select count(*) filter(where estado in ('pedido','recibido_parcial'))::int total,count(*) filter(where estado='borrador')::int borradores from pedidos`;valores.pedidos=Number(f.total);if(Number(f.borradores))avisos.push({clave,texto:`${f.borradores} pedidos en borrador sin mandar.`,href:'/compras'});
      }else if(clave==='cargas'){const [f]=await t`select count(*)::int total from cargas where estado<>'cerrada'`;valores.cargas=Number(f.total);}
    }
    return {tarjetas:visibles.map(k=>{const def=TARJETAS_PANEL.find(d=>d.clave===k)!;const valor=valores[k];if(valor===undefined||typeof valor==='number'&&!Number.isFinite(valor))throw new ErrorPreferencias('No se pudo leer el Panel.',503);return {...def,valor};}),avisos,preferencias,version:Number(fila?.version??0),opciones:TARJETAS_PANEL.filter(d=>preferencias.orden.includes(d.clave))};
  }) as Promise<DatosPanel>;
}

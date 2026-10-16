import type postgres from 'postgres';
import type { UsuarioSesion } from './sesion-servidor';
import { esAcceso, esRol, esSeccion, puede, resolverPermisos, type Acceso, type Seccion } from './usuarios';
import { ErrorPreferencias, TARJETAS_PANEL, validarPanel, validarCatalogo, panelAutorizado, type GrupoPreferencias } from './preferencias-usuario';
export type SqlPreferencias=ReturnType<typeof postgres>;
/** La identidad siempre llega de la sesión del servidor; los permisos se releen. */
export async function usuarioPreferenciasActual(c:SqlPreferencias,yo:UsuarioSesion|null,grupo:GrupoPreferencias,permitirFicticio=false):Promise<UsuarioSesion>{
  if(!yo)throw new ErrorPreferencias('Sin sesión.',401);
  if(yo.ficticio){if(permitirFicticio&&!yo.debeCambiarClave&&puede(yo.permisos,grupo==='panel'?'panel':'catalogo','ver'))return yo;throw new ErrorPreferencias('Inicia sesión con tu usuario para guardar preferencias personales.',403);}
  const [u]=await c`select id,usuario,nombre,rol::text,activo,debe_cambiar_clave from usuarios where id=${yo.id}`;
  if(!u||!u.activo)throw new ErrorPreferencias('Sin sesión.',401);
  if(u.debe_cambiar_clave)throw new ErrorPreferencias('Cambia la contraseña provisional.',403);
  const excepciones=await c`select seccion,acceso from usuario_permisos where usuario_id=${yo.id}`;
  const ajustes:Partial<Record<Seccion,Acceso>>={};
  for(const f of excepciones)if(esSeccion(f.seccion)&&esAcceso(f.acceso))ajustes[f.seccion]=f.acceso;
  const actual={...yo,permisos:resolverPermisos(esRol(u.rol)?u.rol:'lectura',ajustes),debeCambiarClave:false};
  if(!puede(actual.permisos,grupo==='panel'?'panel':'catalogo','ver'))throw new ErrorPreferencias('Sin permiso para esta sección.',403);
  return actual;
}
export async function leerPreferencias(c:SqlPreferencias,yo:UsuarioSesion|null,grupo:GrupoPreferencias){
  const actual=await usuarioPreferenciasActual(c,yo,grupo);
  const [fila]=await c`select version,panel,catalogo from preferencias_usuario where usuario_id=${actual.id}`;
  const version=Number(fila?.version??0);
  if(grupo==='panel'){
    const valor=panelAutorizado(validarPanel(fila?.panel??{}),actual.permisos);
    const opciones=TARJETAS_PANEL.filter(t=>valor.orden.includes(t.clave));
    return {grupo,version,valor,opciones};
  }
  return {grupo,version,valor:validarCatalogo(fila?.catalogo??{})};
}
export async function cambiarPreferencias(c:SqlPreferencias,yo:UsuarioSesion|null,grupo:GrupoPreferencias,version:number,valor:unknown,restablecer=false){
  if(!Number.isInteger(version)||version<0||version>2147483646)throw new ErrorPreferencias('Versión inválida.');
  const validado=grupo==='panel'?validarPanel(restablecer?{}:valor):validarCatalogo(restablecer?{}:valor);
  await c.begin(async tx=>{
    const t=tx as unknown as SqlPreferencias;
    const actual=await usuarioPreferenciasActual(t,yo,grupo);
    // ON CONFLICT espera al alta simultánea; el bloqueo y CAS deciden el ganador.
    await t`insert into preferencias_usuario(usuario_id) values(${actual.id}) on conflict(usuario_id) do nothing`;
    const [f]=await t`select version,panel from preferencias_usuario where usuario_id=${actual.id} for update`;
    if(Number(f.version)!==version)throw new ErrorPreferencias('Las preferencias cambiaron en otra pestaña. Conservamos tu edición: recarga y compara.',409);
    if(grupo==='panel'){
      const p=validado as ReturnType<typeof validarPanel>;
      const autorizadas=panelAutorizado(p,actual.permisos);
      // El cliente sólo recibe claves autorizadas. No puede introducir otras.
      if(!restablecer){
        const entrada=valor as {orden?:string[];ocultas?:string[]};
        const permitidas=new Set(autorizadas.orden);
        if([...(entrada.orden??[]),...(entrada.ocultas??[])].some(k=>!permitidas.has(k as never)))throw new ErrorPreferencias('Una sección dejó de estar disponible. Recarga y compara.',403);
      }
      // Conservar las preferencias fuera del alcance actual sin devolverlas.
      const anterior=validarPanel(f.panel);
      const noAutorizadas=anterior.orden.filter(k=>!autorizadas.orden.includes(k));
      const guardado=restablecer?validarPanel({}):{orden:[...autorizadas.orden,...noAutorizadas],ocultas:[...autorizadas.ocultas,...anterior.ocultas.filter(k=>noAutorizadas.includes(k))]};
      await t`update preferencias_usuario set panel=${t.json(guardado as unknown as postgres.JSONValue)},version=version+1,actualizado_en=now() where usuario_id=${actual.id}`;
    }else{
      await t`update preferencias_usuario set catalogo=${t.json(validado as unknown as postgres.JSONValue)},version=version+1,actualizado_en=now() where usuario_id=${actual.id}`;
    }
  });
  return leerPreferencias(c,yo,grupo);
}
export interface ResultadoPreferido {id:string;marca:string;modelo:string;descripcion:string|null;tipo:string;unidad:string;categoria:string|null;motivo:string}
/** Los filtros se aplican en SQL antes del límite; nunca incluye costes. */
export async function consultarCatalogoPreferido(c:SqlPreferencias,yo:UsuarioSesion|null){
  const p=await leerPreferencias(c,yo,'catalogo');
  const valor=validarCatalogo(p.valor);
  const patron=`%${valor.q.replace(/[\\%_]/g,'\\$&')}%`;
  const resultados=await c< Omit<ResultadoPreferido,'motivo'>[]>`select id,coalesce(marca,'') marca,modelo,descripcion,tipo,unidad,categoria from articulos
    where activo and (${valor.marcas.length===0} or marca=any(${valor.marcas}::text[]))
    and (${!valor.tipo} or tipo::text=${valor.tipo??''})
    and (${!valor.q} or concat_ws(' ',marca,modelo,descripcion,categoria) ilike ${patron})
    order by marca,modelo,id limit 20`;
  const marcasActivas=valor.marcas.length?await c`select distinct marca from articulos where activo and marca=any(${valor.marcas}::text[])`:[];
  return {preferencias:valor,version:p.version,limite:20,marcasSinReferencias:valor.marcas.filter(m=>!marcasActivas.some(f=>f.marca===m)),resultados:resultados.map(f=>({...f,motivo:valor.marcas.length?`Coincide con tu marca: ${f.marca}`:'Coincide con tus filtros del catálogo completo.'}))};
}

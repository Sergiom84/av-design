import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones,fotografiarRevisiones,URL_REA_PRUEBA,type SqlRevisionesPrueba } from './rea02-fixture.mjs';
import { leerPreferencias,cambiarPreferencias,consultarCatalogoPreferido } from '../src/lib/preferencias-usuario-repositorio';
import { leerPanel } from '../src/lib/panel-repositorio';
import { ErrorPreferencias } from '../src/lib/preferencias-usuario';
import { resolverPermisos } from '../src/lib/usuarios';
import type { UsuarioSesion } from '../src/lib/sesion-servidor';
export const idRea02=(n:number)=>`d2000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const salida=resolve('output/rea-integracion/rea02');
export async function prepararRea02(c:SqlRevisionesPrueba){
  for(let i=1;i<=4;i++)await c`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo) values(${idRea02(i)},${`rea02-persona-${i}`},${`Persona REA02 ${i}`},'lectura','PRUEBA-SIN-LOGIN',${i===3},${i!==4}) on conflict(id) do nothing`;
  for(let i=0;i<28;i++)await c`insert into articulos(id,referencia,tipo,categoria,marca,modelo,descripcion,unidad,activo,fuente) values(${idRea02(100+i)},${`REA02-${i}`},${i===25?'cable':'equipo'},'REA02',${i===26?'REA02 Variante':i===27?'REA02 Retirada':'REA02 Marca'},${i===24?'QB65R':i===25?'QB65R-B':`Modelo ${String(i).padStart(2,'0')}`},${i===24||i===25?'Objetivo final':'Referencia sintética REA02'},'ud',${i!==27},'app') on conflict(id) do nothing`;
}
export function yoRea02(n:number):UsuarioSesion{return {id:idRea02(n),usuario:`rea02-persona-${n}`,nombre:`Persona REA02 ${n}`,rol:'lectura',permisos:resolverPermisos('lectura'),debeCambiarClave:n===3,ficticio:false};}
function esError(status:number){return (e:unknown)=>e instanceof ErrorPreferencias&&e.status===status;}
const url=process.env.REA_DATABASE_URL;if(!url||url!==URL_REA_PRUEBA)throw new Error('URL REA02 explícita y exacta obligatoria.');
const c=await conectarRevisiones(url);await mkdir(salida,{recursive:true});
try{
  await prepararRea02(c);
  const protegidaAntes=await fotografiarRevisiones(c);await writeFile(resolve(salida,'hechos-antes.json'),JSON.stringify(protegidaAntes,null,2));
  // Sólo se limpia el estado propio de preferencias de estas dos identidades de aceptación.
  await c`delete from preferencias_usuario where usuario_id in (${idRea02(1)},${idRea02(2)})`;
  const a=yoRea02(1),b=yoRea02(2);let pruebas=0;
  assert.equal((await leerPreferencias(c,a,'catalogo')).version,0);assert.equal((await c`select * from preferencias_usuario where usuario_id=${a.id}`).length,0);pruebas++;
  const alta=await Promise.allSettled([cambiarPreferencias(c,a,'catalogo',0,{marcas:['REA02 Marca'],q:'Objetivo',tipo:'equipo'}),cambiarPreferencias(c,a,'catalogo',0,{marcas:['REA02 Variante']})]);
  assert.equal(alta.filter(r=>r.status==='fulfilled').length,1);assert.equal(alta.filter(r=>r.status==='rejected'&&esError(409)(r.reason)).length,1);pruebas++;
  let p=await leerPreferencias(c,a,'catalogo');await cambiarPreferencias(c,a,'catalogo',p.version,{marcas:['REA02 Marca'],q:'Objetivo',tipo:'equipo'});p=await leerPreferencias(c,a,'catalogo');
  let consulta=await consultarCatalogoPreferido(c,a);assert.deepEqual(consulta.resultados.map(f=>f.modelo),['QB65R']);assert.equal('coste'in consulta.resultados[0],false);pruebas++;
  assert.deepEqual((await leerPreferencias(c,b,'catalogo')).valor,{marcas:[],q:''});await cambiarPreferencias(c,b,'catalogo',0,{marcas:['REA02 Variante']});assert.equal((await consultarCatalogoPreferido(c,b)).resultados.length,1);assert.equal((await consultarCatalogoPreferido(c,a)).resultados[0].marca,'REA02 Marca');pruebas++;
  const marcasAntes=(await leerPreferencias(c,a,'catalogo')).valor;await cambiarPreferencias(c,a,'panel',p.version,{orden:['salas'],ocultas:['equipos']});assert.deepEqual((await leerPreferencias(c,a,'catalogo')).valor,marcasAntes);pruebas++;
  p=await leerPreferencias(c,a,'catalogo');await assert.rejects(()=>cambiarPreferencias(c,a,'catalogo',p.version-1,{marcas:['OTRA']}),esError(409));assert.deepEqual((await leerPreferencias(c,a,'catalogo')).valor,marcasAntes);pruebas++;
  await cambiarPreferencias(c,a,'catalogo',p.version,{marcas:['REA02 Marca','REA02 Variante','REA02 Retirada'],q:'',tipo:'equipo'});consulta=await consultarCatalogoPreferido(c,a);assert.equal(consulta.resultados.length,20);assert.deepEqual(consulta.marcasSinReferencias,['REA02 Retirada']);assert(consulta.resultados.every(f=>f.tipo==='equipo'&&f.marca!=='REA02 Retirada'));pruebas++;
  p=await leerPreferencias(c,a,'catalogo');await cambiarPreferencias(c,a,'catalogo',p.version,{marcas:['REA02 Marca'],q:'QB65R-B',tipo:'cable'});assert.deepEqual((await consultarCatalogoPreferido(c,a)).resultados.map(f=>f.modelo),['QB65R-B']);pruebas++;
  p=await leerPreferencias(c,a,'catalogo');await cambiarPreferencias(c,a,'catalogo',p.version,{marcas:['REA02 Marca'],q:'Modelo _'});assert.equal((await consultarCatalogoPreferido(c,a)).resultados.length,0);pruebas++;
  p=await leerPreferencias(c,a,'catalogo');await cambiarPreferencias(c,a,'catalogo',p.version,{},true);consulta=await consultarCatalogoPreferido(c,a);assert.deepEqual(consulta.preferencias,{marcas:[],q:''});assert.equal(consulta.resultados.length,20);pruebas++;
  for(const grupo of ['panel','catalogo'] as const){await assert.rejects(()=>leerPreferencias(c,null,grupo),esError(401));await assert.rejects(()=>leerPreferencias(c,{...a,ficticio:true},grupo),esError(403));await assert.rejects(()=>leerPreferencias(c,yoRea02(3),grupo),esError(403));await assert.rejects(()=>leerPreferencias(c,yoRea02(4),grupo),esError(401));}pruebas++;
  // Captura las consultas reales del repositorio, incluido el contexto transaccional.
  const consultas:string[]=[];
  function espiar(conexion:SqlRevisionesPrueba):SqlRevisionesPrueba{return new Proxy(conexion,{apply:(destino,thisArg,args)=>{consultas.push((args[0] as TemplateStringsArray).join('?'));return Reflect.apply(destino,thisArg,args);},get:(destino,k)=>k==='begin'?async(opciones:string,fn:(t:SqlRevisionesPrueba)=>Promise<unknown>)=>destino.begin(opciones,tx=>fn(espiar(tx as unknown as SqlRevisionesPrueba))):Reflect.get(destino,k)});}
  for(const seccion of ['catalogo','plantillas','compras','carga'] as const)await c`insert into usuario_permisos(usuario_id,seccion,acceso) values(${a.id},${seccion},'oculto') on conflict(usuario_id,seccion) do update set acceso='oculto'`;
  const panel=await leerPanel(espiar(c),a);assert.deepEqual(panel.tarjetas.map(t=>t.clave),['salas','almacen','reservas']);assert(!consultas.some(q=>/from (plantillas_sala|pedidos|cargas)\b/.test(q)));assert(!consultas.some(q=>/from articulos where tipo/.test(q)));assert(!JSON.stringify(panel).includes('Pedidos en curso'));await writeFile(resolve(salida,'consultas-panel-autorizado.json'),JSON.stringify(consultas,null,2));pruebas++;
  await assert.rejects(()=>consultarCatalogoPreferido(c,a),esError(403));p=await leerPreferencias(c,a,'panel');await assert.rejects(()=>cambiarPreferencias(c,a,'panel',p.version,{orden:['equipos']}),esError(403));pruebas++;
  await cambiarPreferencias(c,a,'panel',p.version,{orden:panel.preferencias.orden,ocultas:panel.preferencias.orden});const sinTarjetas=await leerPanel(c,a);assert.equal(sinTarjetas.tarjetas.length,0);assert.equal(sinTarjetas.avisos.length,0);pruebas++;
  p=await leerPreferencias(c,a,'panel');await cambiarPreferencias(c,a,'panel',p.version,{},true);const repuesto=await leerPanel(c,a);assert.equal(repuesto.tarjetas.length,3);pruebas++;
  await c`delete from usuario_permisos where usuario_id=${a.id} and seccion in ('catalogo','plantillas','compras','carga')`;
  const completo=await leerPanel(c,a);
  const [{equipos,plantillas,salas,almacen,reservas,pedidos,cargas}]=await c`select (select count(*)::int from articulos where tipo='equipo') equipos,(select count(*)::int from plantillas_sala) plantillas,(select count(*)::int from salas) salas,(select count(*)::int from(select articulo_id from existencias group by articulo_id)x) almacen,(select count(*)::int from reservas where estado='activa') reservas,(select count(*)::int from pedidos where estado in('pedido','recibido_parcial')) pedidos,(select count(*)::int from cargas where estado<>'cerrada') cargas`;
  for(const [clave,valor] of Object.entries({equipos,plantillas,salas,almacen,reservas,pedidos,cargas}))assert.equal(completo.tarjetas.find(t=>t.clave===clave)?.valor,valor);pruebas++;
  const despues=await fotografiarRevisiones(c);await writeFile(resolve(salida,'hechos-despues.json'),JSON.stringify(despues,null,2));
  const excluir=new Set(['preferencias_usuario','usuario_permisos']);assert.deepEqual(protegidaAntes.tablas.filter(t=>!excluir.has(t.tabla)),despues.tablas.filter(t=>!excluir.has(t.tabla)));pruebas++;
  await writeFile(resolve(salida,'sql-resultados.json'),JSON.stringify({pruebas,estado:'aprobado',protegidas:despues.tablas.length-excluir.size,nota:'Sólo preferencias propias cambian. Fixture REA02 añadida antes de foto.'},null,2));console.log(`${pruebas} gates REA02 aprobados.`);
}finally{await c.end();}

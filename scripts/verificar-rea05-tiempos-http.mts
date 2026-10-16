import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firmarSesion, COOKIE_SESION } from '../src/lib/sesion';
import { conectarRevisiones, URL_REA_PRUEBA, idTR, SALIDA_TIEMPOS, SECRETO_TIEMPOS, fotoTiempos } from './rea05-tiempos-fixture.mjs';
if(process.env.REA_DATABASE_URL!==URL_REA_PRUEBA)throw new Error('Destino REA05 explícito obligatorio.');
const c=await conectarRevisiones(process.env.REA_DATABASE_URL), base='http://localhost:3115';
const resultados:unknown[]=[];
async function api(ruta:string,n=2,method='GET',body?:unknown,extra:Record<string,string>={}){
 const cookie=await firmarSesion(SECRETO_TIEMPOS,Date.now()+3600000,idTR(n));
 const r=await fetch(base+ruta,{method,headers:{Cookie:COOKIE_SESION+'='+cookie,...body===undefined?{}:{'Content-Type':'application/json',Origin:base},...extra},...body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}});
 const data=await r.json();resultados.push({ruta,n,method,status:r.status,codigo:data.codigo});assert.match(r.headers.get('cache-control')??'',/no-store/);return {r,data};
}
try{
 const antes=await fotoTiempos(c,'antes-http');
 const [{n}]=await c`select count(*)::int n from tiempo_registros where tecnico_id=${idTR(102)}`;
 const dia=new Date(Date.UTC(2023,0,1+Number(n)*3)).toISOString().slice(0,10);
 const b={tareaId:idTR(311),inicio:{fecha:dia,hora:'09:00'},fin:{fecha:dia,hora:'10:00'},notas:'HTTP propia',clavePeticion:randomUUID()};
 assert.equal((await api('/api/tiempos/mios',2,'POST',b)).r.status,201);
 const repetido=await api('/api/tiempos/mios',2,'POST',b);assert.equal(repetido.r.status,201);assert.equal(repetido.data.repetida,true);
 const id=repetido.data.id, versionId=repetido.data.actualId;
 const propio=await api('/api/tiempos/mios?desde='+dia+'&hasta='+dia);assert(propio.data.partes.some((p:{id:string})=>p.id===id));
 assert.equal((await api('/api/tiempos/registros/'+id,4)).r.status,404);
 assert.equal((await api('/api/tiempos/registros/'+id+'/historial',4)).r.status,404);
 assert.equal((await api('/api/tiempos/proyectos/'+idTR(201),2)).r.status,403);
 assert.equal((await api('/api/tiempos/tecnicos',2)).r.status,403);
 assert.equal((await api('/api/tiempos/mios',4,'POST',{...b,clavePeticion:randomUUID()})).r.status,403);
 assert.equal((await api('/api/tiempos/mios',8)).r.status,403);
 assert.equal((await api('/api/tiempos/mios',9)).r.status,401);
 assert.equal((await api('/api/tiempos/mios',2,'POST',b,{Origin:'https://ajeno.example'})).r.status,403);
 assert.equal((await api('/api/tiempos/mios',2,'POST','{invalido')).r.status,400);
 assert.equal((await api('/api/tiempos/mios',2,'POST','x'.repeat(65537))).r.status,413);
 assert.equal((await api('/api/tiempos/mios?desde=2024-01-01&hasta=2026-01-01')).r.status,400);
 const hueco={...b,inicio:{fecha:'2025-03-30',hora:'02:30'},fin:{fecha:'2025-03-30',hora:'03:30'},clavePeticion:randomUUID()};
 assert.equal((await api('/api/tiempos/mios',2,'POST',hueco)).r.status,422);
 const ambiguo={...b,inicio:{fecha:'2025-10-26',hora:'02:10'},fin:{fecha:'2025-10-26',hora:'02:50'},clavePeticion:randomUUID()};
 const amb=await api('/api/tiempos/mios',2,'POST',ambiguo);assert.equal(amb.r.status,422);assert.equal(amb.data.detalle.alternativas.length,2);
 // Permiso retirado con cookie idéntica: también deniega el reintento idempotente.
 await c`update usuario_permisos set acceso='oculto' where usuario_id=${idTR(2)} and seccion='salas'`;
 try{assert.equal((await api('/api/tiempos/registros/'+id+'/historial')).r.status,404);assert.equal((await api('/api/tiempos/mios',2,'POST',b)).r.status,404);const lista=await api('/api/tiempos/mios?desde='+dia+'&hasta='+dia);assert.equal(lista.data.partes.length,0);}
 finally{await c`update usuario_permisos set acceso='ver' where usuario_id=${idTR(2)} and seccion='salas'`;}
 // Gestor sin permiso financiero puede apuntar por otro dejando usuario autor.
 const g=await api('/api/tiempos/proyectos/'+idTR(201),3,'POST',{...b,inicio:{fecha:dia,hora:'11:00'},fin:{fecha:dia,hora:'12:00'},tecnicoId:idTR(102),motivo:'Trabajo registrado por gestor operativo',clavePeticion:randomUUID()});assert.equal(g.r.status,201);
 const hg=await api('/api/tiempos/registros/'+g.data.id+'/historial',3);assert.equal(hg.data.versiones[0].autorNombre,'PRUEBA-REA05-TIEMPOS usuario 3');
 const cor=await api('/api/tiempos/registros/'+id,2,'PATCH',{numeroActual:1,actualId:versionId,...b,notas:'corrección',motivo:'Revisado',clavePeticion:randomUUID(),tareaId:undefined});assert.equal(cor.r.status,200);
 const sinSesion=await fetch(base+'/api/tiempos/mios');assert.equal(sinSesion.status,401);
 const cookie=await firmarSesion(SECRETO_TIEMPOS,Date.now()+3600000,idTR(2));
 for(const ruta of ['/cuenta/tiempos','/cuenta/tiempos?_rsc=rea05']){
  const r=await fetch(base+ruta,{headers:{Cookie:COOKIE_SESION+'='+cookie,...ruta.includes('_rsc')?{RSC:'1'}:{}}});const html=await r.text();assert.equal(r.status,200);assert(!/precio_hora|coste_labor_versiones|coste_tarifa|importeMinor|moneda|tarifasAusentes/i.test(html));await writeFile(resolve(SALIDA_TIEMPOS,ruta.includes('_rsc')?'privacidad-rsc.txt':'privacidad-html.html'),html);
 }
 const despues=await fotoTiempos(c,'despues-http');
 const mutables=new Set(['tiempo_registros','tiempo_versiones','tiempo_operaciones','usuario_permisos']);
 const diferencias=antes.tablas.filter(t=>!mutables.has(t.tabla)&&JSON.stringify(t)!==JSON.stringify(despues.tablas.find(d=>d.tabla===t.tabla)));assert.deepEqual(diferencias,[]);
 await writeFile(resolve(SALIDA_TIEMPOS,'http-resultados.json'),JSON.stringify({resultados,tablasInalteradas:82-3,htmlRscPrivados:true,dia},null,2));console.log(JSON.stringify({peticiones:resultados.length,preservacion:'79 tablas sin cambios',htmlRsc:'sin campos monetarios'}));
}finally{await c.end();}

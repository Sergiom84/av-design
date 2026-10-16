/** Gates deterministas de la única corrección E3; todo escritor revierte su transacción. */
import assert from 'node:assert/strict';
import Module from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type postgres from 'postgres';
import type { SqlDiseno } from '../src/lib/revisiones-diseno-repositorio';
import { compararDisenos,type RevisionDiseno } from '../src/lib/revisiones-diseno';
import { conectarRevisiones,fotografiarRevisiones,FIXTURE_REVISIONES as f,SALIDA_REVISIONES } from './revisiones-fixture.mjs';
const url=process.env.REVISIONES_DATABASE_URL;if(!url)throw new Error('REVISIONES_DATABASE_URL explícita obligatoria.');
const sql=await conectarRevisiones(url);process.env.DATABASE_URL=url;
type Loader={_load:(request:string,...resto:unknown[])=>unknown};const m=Module as unknown as Loader;const original=m._load;m._load=(request,...resto)=>request==='server-only'?{}:original.call(Module,request,...resto);
const r=await import('../src/lib/revisiones-diseno-repositorio');
const carpeta=resolve(SALIDA_REVISIONES,`correccion-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(carpeta,{recursive:true});const checks:string[]=[];const casos:unknown[]=[];const ok=(s:string)=>{checks.push(s);console.log(`OK ${s}`);};
try {
  const antes=await fotografiarRevisiones(sql);await writeFile(resolve(carpeta,'bd-antes.json'),JSON.stringify(antes,null,2));
  const cancelacion=new Error('Rollback de la corrección sintética E3.');
  await assert.rejects(sql.begin('isolation level serializable',async tx=>{
    const c=new Proxy(tx,{get(destino,propiedad){if(propiedad==='begin')return(...args:unknown[])=>destino.savepoint(args.at(-1) as (tx:postgres.TransactionSql<Record<string,unknown>>)=>Promise<unknown>);return Reflect.get(destino,propiedad);}}) as unknown as SqlDiseno;
    const nuevaSala=async(nombre:string,localizacion:string|null=null)=>{const id=randomUUID();await tx`insert into salas(id,nombre,localizacion_id,largo_m,ancho_m,alto_m) values(${id},${`PRUEBA-REV-01 · ${nombre}`},${localizacion},8,6,3)`;return id;};
    const equipo=async(sala:string,articulo:string=f.pantalla,cantidad=1)=>{const id=randomUUID();await tx`insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,extremo,x_m,y_m,z_m) values(${id},${sala},${articulo},'Equipo sintético corrección',${cantidad},'pared',1,1,1)`;return id;};
    const revision=async(sala:string,nombre='Diseño anterior')=>r.crearRevisionDiseno(c,sala,nombre,f.admin,(await r.leerDiseno(c,sala)).base);
    const debeRechazar=async(sala:string,rev:RevisionDiseno,caso:string)=>{
      const actual=await r.leerDiseno(c,sala);const fotAntes=await fotografiarRevisiones(c);
      await assert.rejects(r.restaurarRevisionDiseno(c,sala,rev.id,f.admin,actual.base),/reduce la necesidad comprometida/);
      const fotDespues=await fotografiarRevisiones(c);assert.equal(fotAntes.sha256,fotDespues.sha256);
      const dif=compararDisenos(actual.snapshot,rev.snapshot!);const reducciones=dif.material.filter(m=>m.despues<m.antes);assert.ok(reducciones.length);
      casos.push({caso,rechazada:true,reducciones,shaAntes:fotAntes.sha256,shaDespues:fotDespues.sha256});ok(caso);
    };
    // Repro confirmado: necesidad2/reserva2 no puede restaurarse a necesidad1.
    const salaCantidad=await nuevaSala('Reducción equipo con reserva');const eqCantidad=await equipo(salaCantidad);const revCantidad=await revision(salaCantidad);
    await tx`update sala_equipos set cantidad=2 where id=${eqCantidad}`;await tx`insert into reservas(sala_id,articulo_id,cantidad) values(${salaCantidad},${f.pantalla},2)`;
    await debeRechazar(salaCantidad,revCantidad,'Cantidad2 con reserva2 → cantidad1 rechazada; diseño/historial/reserva intactos');
    const copia=await r.duplicarSalaDiseno(c,salaCantidad,'PRUEBA-REV-01 · Copia sin compromisos corrección',null,f.admin,(await r.leerDiseno(c,salaCantidad)).base);
    assert.equal((await tx`select count(*)::int n from reservas where sala_id=${copia.salaId}`)[0].n,0);assert.equal((await tx`select cantidad from sala_equipos where sala_id=${copia.salaId}`)[0].cantidad,2);ok('Copia conserva necesidad2 y excluye la reserva2');
    // Retirar un equipo también reduce necesidad, aunque no exista BOM adicional.
    const salaRetirada=await nuevaSala('Retirada equipo con pedido');const revRetirada=await revision(salaRetirada);await equipo(salaRetirada);
    const pedidoSala=randomUUID();await tx`insert into pedidos(id,sala_id,referencia) values(${pedidoSala},${salaRetirada},'PEDIDO SINTÉTICO CORRECCIÓN')`;
    await tx`insert into pedido_lineas(pedido_id,articulo_id,cantidad) values(${pedidoSala},${f.pantalla},1)`;
    await debeRechazar(salaRetirada,revRetirada,'Retirada de equipo con pedido de sala rechazada íntegra');
    // Metros derivados de cable granel (no se suman con las líneas operativas).
    const salaCable=await nuevaSala('Reducción cable con carga');const origen=await equipo(salaCable,f.codec);const destino=await equipo(salaCable);const conexion=randomUUID();
    await tx`insert into conexiones(id,sala_id,origen_id,destino_id,articulo_cable_id,senal,ruta,longitud_manual_m) values(${conexion},${salaCable},${origen},${destino},${f.red},'red','directo',5)`;const revCable=await revision(salaCable);
    await tx`update conexiones set longitud_manual_m=10 where id=${conexion}`;const carga=randomUUID();await tx`insert into cargas(id,sala_id,nombre) values(${carga},${salaCable},'CARGA SINTÉTICA CORRECCIÓN')`;
    await tx`insert into carga_lineas(carga_id,articulo_id,cantidad) values(${carga},${f.red},10)`;
    await debeRechazar(salaCable,revCable,'Cable10 m con carga → cable5 m rechazado íntegro');
    const salaConexion=await nuevaSala('Retirada cable con movimiento');const conOrigen=await equipo(salaConexion,f.codec);const conDestino=await equipo(salaConexion);const revSinCable=await revision(salaConexion);
    await tx`insert into conexiones(sala_id,origen_id,destino_id,articulo_cable_id,senal,ruta,longitud_manual_m) values(${salaConexion},${conOrigen},${conDestino},${f.red},'red','directo',8)`;
    await tx`insert into movimientos(sala_id,articulo_id,ubicacion_id,tipo,cantidad,motivo) values(${salaConexion},${f.red},${f.ubicacion},'salida',8,'MOVIMIENTO SINTÉTICO CORRECCIÓN')`;
    await debeRechazar(salaConexion,revSinCable,'Retirada de conexión con movimiento de cable rechazada íntegra');
    // Pedido que abastece varias salas: proyecto_id, sin atribución a una sala.
    const proyecto=randomUUID(),localizacion=randomUUID();await tx`insert into proyectos(id,nombre,codigo) values(${proyecto},'OBRA SINTÉTICA CORRECCIÓN',${`PRUEBA-${proyecto}`})`;await tx`insert into localizaciones(id,proyecto_id,nombre) values(${localizacion},${proyecto},'LOCALIZACIÓN SINTÉTICA')`;
    const salaObra=await nuevaSala('Reducción material pedido por obra',localizacion);const equipoObra=await equipo(salaObra);const revisionObra=await revision(salaObra);await tx`update sala_equipos set cantidad=2 where id=${equipoObra}`;
    const pedidoObra=randomUUID();await tx`insert into pedidos(id,proyecto_id,sala_id,referencia) values(${pedidoObra},${proyecto},null,'PEDIDO DE OBRA SINTÉTICO')`;await tx`insert into pedido_lineas(pedido_id,articulo_id,cantidad) values(${pedidoObra},${f.pantalla},2)`;
    await debeRechazar(salaObra,revisionObra,'Pedido de obra sin sala protege reducción de necesidad en sala asociada');
    // Antecedente histórico real: R1 sin padre, R2→R1, borrador→R2.
    const salaReferencias=await nuevaSala('Antecedentes reales');const equipoReferencias=await equipo(salaReferencias);const primera=await revision(salaReferencias,'Primera');const refPrimera=await r.referenciaRevisionDiseno(salaReferencias,c);
    assert.equal(refPrimera.estado,'revision');assert.equal(refPrimera.id,primera.id);assert.equal(refPrimera.antecedente,null);
    const segunda=await revision(salaReferencias,'Segunda');const refSegunda=await r.referenciaRevisionDiseno(salaReferencias,c);assert.equal(refSegunda.id,segunda.id);assert.equal(refSegunda.antecedente?.id,primera.id);assert.equal(refSegunda.antecedente?.nombre,'Primera');
    await tx`update sala_equipos set cantidad=2 where id=${equipoReferencias}`;const refBorrador=await r.referenciaRevisionDiseno(salaReferencias,c);assert.equal(refBorrador.estado,'borrador');assert.equal(refBorrador.id,null);assert.equal(refBorrador.antecedente?.id,segunda.id);assert.equal(refBorrador.antecedente?.nombre,'Segunda');casos.push({refPrimera,refSegunda,refBorrador});ok('Referencia primera vigente sin antecedente; segunda apunta a primera; borrador apunta a segunda');
    // Referencia de mueble retirada: conservar snapshot no autoriza una nueva instancia.
    const salaMueble=await nuevaSala('Mueble retirado');const catalogo=randomUUID();await tx`insert into catalogo_mobiliario(id,clave,nombre,categoria,forma,activo,fuente) values(${catalogo},${`prueba-${catalogo}`},'Silla sintética corrección','Asientos','rectangulo',true,'app')`;
    await tx`insert into sala_mobiliario(sala_id,mobiliario_id,nombre,forma,largo_m,ancho_m,alto_m) values(${salaMueble},${catalogo},'Silla congelada','rectangulo',0.5,0.5,0.9)`;const revMueble=await revision(salaMueble);await tx`update catalogo_mobiliario set activo=false where id=${catalogo}`;
    const muebleActual=await r.leerDiseno(c,salaMueble);const muebleAntes=await fotografiarRevisiones(c);await assert.rejects(r.restaurarRevisionDiseno(c,salaMueble,revMueble.id,f.admin,muebleActual.base),/mobiliario está retirada/);await assert.rejects(r.duplicarSalaDiseno(c,salaMueble,'PRUEBA MUEBLE RETIRADO',null,f.admin,muebleActual.base),/mobiliario está retirada/);assert.equal((await fotografiarRevisiones(c)).sha256,muebleAntes.sha256);
    const diffMueble=compararDisenos(revMueble.snapshot!,muebleActual.snapshot);assert.ok(diffMueble.cambios.some(c=>c.grupo==='catalogo_mobiliario'&&c.campos.includes('activo')));assert.ok(!diffMueble.cambios.some(c=>c.grupo==='muebles'));ok('Mueble retirado rechaza restauración/copia; diff muestra contexto y conserva dimensiones de instancia');
    throw cancelacion;
  }),error=>error===cancelacion);
  const despues=await fotografiarRevisiones(sql);assert.equal(despues.sha256,antes.sha256);await writeFile(resolve(carpeta,'bd-despues.json'),JSON.stringify(despues,null,2));ok('Todos los casos de corrección revierten; hash completo público antes/después idéntico');
  await writeFile(resolve(carpeta,'resultados.json'),JSON.stringify({checks,casos,shaAntes:antes.sha256,shaDespues:despues.sha256},null,2));console.log(`Resultado ${checks.length} gates: ${carpeta}`);
}finally{m._load=original;await sql.end();}

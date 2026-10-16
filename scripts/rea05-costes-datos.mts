/** Fixture propia: sólo se llama después del guard de identidad5559. */
import { randomUUID } from 'node:crypto';
import { cifrarClave } from '../src/lib/contrasena';
import type { SqlRevisionesPrueba } from './rea05-costes-fixture.mjs';
export async function crearDatosCostes(c:SqlRevisionesPrueba) {
  const ids={admin:randomUUID(),lectura:randomUUID(),gestor:randomUUID(),trabajador:randomUUID(),provisional:randomUUID(),inactivo:randomUUID(),tecnico:randomUUID(),otroTecnico:randomUUID(),proyecto:randomUUID(),otroProyecto:randomUUID(),localizacion:randomUUID(),otraLocalizacion:randomUUID(),sala:randomUUID(),otraSala:randomUUID(),articulo:randomUUID(),ubicacion:randomUUID(),salida:randomUUID(),sobrante:randomUUID(),roto:randomUUID(),baja:randomUUID(),salidaCarrera:randomUUID(),salidaDecimal:randomUUID(),devolucionExceso:randomUUID(),bajaExceso:randomUUID(),plan:randomUUID(),tarea:randomUUID(),otraTarea:randomUUID(),registro:randomUUID(),versionTiempo:randomUUID(),pedido:randomUUID(),pedidoLinea:randomUUID(),carga:randomUUID(),cargaLinea:randomUUID()};
  const nombre='PRUEBA-REA05-COSTES-'+Date.now(),clave=await cifrarClave('Rea05CostesPruebaLocal2026!');
  await c.begin(async tx=>{
    await tx`insert into tecnicos(id,nombre,activo,fuente) values(${ids.tecnico},${nombre+' técnico'},true,'app'),(${ids.otroTecnico},${nombre+' técnico2'},true,'app')`;
    for(const [id,rol,provisional,activo,tecnico] of [[ids.admin,'admin',false,true,null],[ids.lectura,'lectura',false,true,null],[ids.gestor,'tecnico_avanzado',false,true,null],[ids.trabajador,'tecnico',false,true,ids.tecnico],[ids.provisional,'admin',true,true,null],[ids.inactivo,'admin',false,false,null]] as const)await tx`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo,tecnico_id)values(${id},${(nombre+'-'+rol+'-'+id.slice(0,6)).toLowerCase()},${nombre+' '+rol},${rol},${clave},${provisional},${activo},${tecnico})`;
    await tx`insert into proyectos(id,nombre,codigo) values(${ids.proyecto},${nombre+' obra'},${nombre}),(${ids.otroProyecto},${nombre+' obra2'},${nombre+'-2'})`;
    await tx`insert into localizaciones(id,proyecto_id,nombre) values(${ids.localizacion},${ids.proyecto},${nombre+' localización'}),(${ids.otraLocalizacion},${ids.otroProyecto},${nombre+' localización2'})`;
    await tx`insert into salas(id,localizacion_id,nombre,codigo,largo_m,ancho_m,alto_m)values(${ids.sala},${ids.localizacion},${nombre+' sala'},${nombre+'-sala'},6,4,3),(${ids.otraSala},${ids.otraLocalizacion},${nombre+' sala2'},${nombre+'-sala2'},6,4,3)`;
    await tx`insert into articulos(id,tipo,categoria,marca,modelo,descripcion,unidad,coste,fuente)values(${ids.articulo},'equipo','PRUEBA','PRUEBA',${nombre},${nombre+' material'},'ud','17.1234','app')`;
    await tx`insert into ubicaciones(id,nombre)values(${ids.ubicacion},${nombre+' almacén'})`;
    await tx`insert into sala_equipos(sala_id,articulo_id,nombre,cantidad,extremo)values(${ids.sala},${ids.articulo},${nombre+' equipos'},10,'rack')`;
    for(const [id,tipo,cantidad]of[[ids.salida,'salida','10'],[ids.sobrante,'devolucion','3'],[ids.roto,'devolucion','2'],[ids.baja,'baja','2'],[ids.salidaCarrera,'salida','10'],[ids.salidaDecimal,'salida','3'],[ids.devolucionExceso,'devolucion','6'],[ids.bajaExceso,'baja','1']]as const)await tx`insert into movimientos(id,articulo_id,ubicacion_id,tipo,cantidad,sala_id,motivo,quien,fecha)values(${id},${ids.articulo},${ids.ubicacion},${tipo},${cantidad},${ids.sala},${nombre+' hecho físico'},'Actor físico sintético','2026-10-14T08:00:00Z')`;
    await tx`insert into planes(id,proyecto_id,creado_por,version) values(${ids.plan},${ids.proyecto},${ids.admin},1)`;
    for(const [id,inicio,fin]of[[ids.tarea,'2026-10-14T07:00:00Z','2026-10-14T08:00:00Z'],[ids.otraTarea,'2026-10-14T07:30:00Z','2026-10-14T08:30:00Z']]as const){await tx`insert into plan_tareas(id,plan_id,sala_id,titulo,estado,duracion_estimada_min,inicio_utc,fin_utc,creado_por)values(${id},${ids.plan},${ids.sala},${nombre+' trabajo'},'pendiente',60,${inicio},${fin},${ids.admin})`;await tx`insert into plan_asignaciones(tarea_id,tecnico_id,asignado_por)values(${id},${ids.tecnico},${ids.admin})`;}
    await tx`insert into tiempo_registros(id,tarea_id,proyecto_id,sala_id,tecnico_id,titular_usuario_id,numero_actual,actual_id)values(${ids.registro},${ids.tarea},${ids.proyecto},${ids.sala},${ids.tecnico},${ids.trabajador},1,${ids.versionTiempo})`;
    await tx`insert into tiempo_versiones(id,registro_id,numero,accion,inicio_utc,fin_utc,minutos,entrada_local,autor_usuario_id,autor_nombre)values(${ids.versionTiempo},${ids.registro},1,'registro','2026-10-14T07:00:00Z','2026-10-14T08:30:00Z',90,'{}',${ids.trabajador},${nombre+' trabajador'})`;
    await tx`insert into pedidos(id,proyecto_id,sala_id,referencia,estado,fecha)values(${ids.pedido},${ids.proyecto},${ids.sala},${nombre+' pedido'},'recibido','2026-10-13')`;
    await tx`insert into pedido_lineas(id,pedido_id,articulo_id,cantidad,cantidad_recibida,precio_unitario,precio_orientativo)values(${ids.pedidoLinea},${ids.pedido},${ids.articulo},10,10,'10.0000',false)`;
    await tx`insert into cargas(id,sala_id,nombre,estado)values(${ids.carga},${ids.sala},${nombre+' carga'},'cerrada')`;
    await tx`insert into carga_lineas(id,carga_id,articulo_id,cantidad,cargado,instalado,devuelto,roto)values(${ids.cargaLinea},${ids.carga},${ids.articulo},10,true,5,3,2)`;
  });
  return {...ids,nombre};
}

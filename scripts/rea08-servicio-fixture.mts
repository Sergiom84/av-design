import { conectarRevisiones,idServicio,URL_REA_PRUEBA } from './rea08-fixture.mjs';
import Module from 'node:module';
const n=(i:number)=>process.env.REA08_NAMESPACE?`${process.env.REA08_NAMESPACE}-0000-4000-8000-${String(i).padStart(12,'0')}`:idServicio(i);
export const F={autor:idServicio(1),lectura:idServicio(2),sede:idServicio(100),proyecto:n(101),localizacion:n(102),sala:n(103),destino:n(104),sinEntrega:n(105),tecnico:idServicio(106),inactivo:idServicio(107),articulo:idServicio(108),equipo:n(109),entrega:n(110),entregaDestino:n(111),legado:n(112)};
export async function fixtureServicio(sql:Awaited<ReturnType<typeof conectarRevisiones>>){
  const m=Module as unknown as {_load:(r:string,...a:unknown[])=>unknown},cargar=m._load;m._load=(r,...a)=>r==='server-only'?{}:cargar.call(Module,r,...a);
  const {crearRevisionDiseno,leerDiseno}=await import('../src/lib/revisiones-diseno-repositorio');
  await sql.begin(async c=>{
    await c`insert into sedes(id,nombre) values(${F.sede},'PRUEBA REA08 · servicio sintético') on conflict(id) do nothing`;
    await c`insert into proyectos(id,nombre,codigo,sede_id) values(${F.proyecto},${'PRUEBA REA08 · obra cerrada '+(process.env.REA08_NAMESPACE??'')},${'REA08-SERVICIO-'+(process.env.REA08_NAMESPACE??'')},${F.sede}) on conflict(id) do nothing`;
    await c`insert into localizaciones(id,proyecto_id,nombre) values(${F.localizacion},${F.proyecto},'PRUEBA REA08 · edificio') on conflict(id) do nothing`;
    for(const [sid,nombre,loc] of [[F.sala,'Origen',F.localizacion],[F.destino,'Destino',F.localizacion],[F.sinEntrega,'Sin entrega',F.localizacion],[F.legado,'Legado',null]] as const)await c`insert into salas(id,nombre,codigo,sede_id,localizacion_id,largo_m,ancho_m,alto_m) values(${sid},${'PRUEBA REA08 · '+nombre},${'REA08-'+nombre},${F.sede},${loc},8,6,3) on conflict(id) do nothing`;
    await c`insert into tecnicos(id,nombre,activo,fuente) values(${F.tecnico},'PRUEBA REA08 técnico activo',true,'app'),(${F.inactivo},'PRUEBA REA08 técnico inactivo',false,'app') on conflict(id) do nothing`;
    await c`insert into articulos(id,referencia,tipo,categoria,marca,modelo,unidad,coste,pvp,fuente) values(${F.articulo},'REA08-QA','equipo','PANTALLA','PRUEBA REA08','MODELO PRIVADO QA','ud',999,1234,'app') on conflict(id) do nothing`;
    await c`insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,extremo) values(${F.equipo},${F.sala},${F.articulo},'Unidad literal observada',3,'pared') on conflict(id) do nothing`;
    for(const [hid,sid]of [[F.entrega,F.sala],[F.entregaDestino,F.destino]] as const)await c`insert into hitos_sala(id,sala_id,tipo,fecha,tecnico_id,notas,creado_en) values(${hid},${sid},'entrega','2026-10-14',${F.tecnico},'Entrega sintética QA','2026-10-14T10:00Z') on conflict(id) do nothing`;
  });
  for(const sid of [F.sala,F.destino,F.sinEntrega,F.legado]){const [r]=await sql`select id from revisiones_diseno where sala_id=${sid}`;if(!r){const d=await leerDiseno(sql,sid);await crearRevisionDiseno(sql,sid,'Revisión sintética QA08',F.autor,d.base);}}
  await sql`insert into hitos_proyecto(proyecto_id,tipo,fecha,notas) values(${F.proyecto},'cierre','2026-10-14','Cierre sintético protegido QA08') on conflict(proyecto_id,tipo) do nothing`;
  return F;
}
if(process.argv.includes('--aplicar')){if(process.env.REA08_DATABASE_URL!==URL_REA_PRUEBA)throw new Error('URL08 explícita requerida.');const sql=await conectarRevisiones(process.env.REA08_DATABASE_URL);try{await fixtureServicio(sql);console.log(F);}finally{await sql.end();}}

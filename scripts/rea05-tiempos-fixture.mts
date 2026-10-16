import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarRevisiones, URL_REA_PRUEBA, type SqlRevisionesPrueba } from './rea05-fixture.mjs';
import { fotografiarBase } from './documentos-fixture.mjs';
import { cifrarClave } from '../src/lib/contrasena';
export { conectarRevisiones, URL_REA_PRUEBA };
export const SALIDA_TIEMPOS = resolve('output/rea-integracion/rea05/tiempos-runtime');
export const SECRETO_TIEMPOS = 'rea05-tiempos-local-sintetico-2026-no-produccion';
export const idTR = (n: number) => `d5150000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function fixtureTiempos(c: SqlRevisionesPrueba) {
  await mkdir(SALIDA_TIEMPOS, { recursive: true });
  const clave = await cifrarClave('PruebaRea05Tiempos2026!');
  await c.begin(async t => {
    for (let n = 1; n <= 6; n++) await t`insert into tecnicos(id,nombre,fuente) values(${idTR(100+n)},${'PRUEBA-REA05-TIEMPOS técnico '+n},'app') on conflict(id) do nothing`;
    for (const [n,rol,tecnico,provisional,activo] of [[1,'admin',101,false,true],[2,'tecnico',102,false,true],[3,'tecnico_avanzado',103,false,true],[4,'lectura',104,false,true],[5,'tecnico',null,false,true],[6,'tecnico',106,false,true],[7,'tecnico',106,false,true],[8,'tecnico',102,true,true],[9,'tecnico',null,false,false]] as const) {
      await t`insert into usuarios(id,usuario,nombre,rol,clave_hash,tecnico_id,debe_cambiar_clave,activo) values(${idTR(n)},${'prueba-rea05-tiempos-'+n},${'PRUEBA-REA05-TIEMPOS usuario '+n},${rol},${clave},${tecnico ? idTR(tecnico) : null},${provisional},${activo}) on conflict(id) do nothing`;
    }
    // La cuenta provisional no debe introducir ambigüedad en el técnico propio.
    await t`update usuarios set tecnico_id=null where id=${idTR(8)}`;
    for (const [usuario,seccion,acceso] of [[2,'proyectos','ver'],[2,'salas','ver'],[3,'proyectos','editar']] as const) await t`insert into usuario_permisos(usuario_id,seccion,acceso) values(${idTR(usuario)},${seccion},${acceso}) on conflict(usuario_id,seccion) do update set acceso=excluded.acceso`;
    for (let n=1; n<=3; n++) {
      await t`insert into proyectos(id,nombre) values(${idTR(200+n)},${'PRUEBA-REA05-TIEMPOS obra '+n}) on conflict(id) do nothing`;
      await t`insert into localizaciones(id,proyecto_id,nombre) values(${idTR(210+n)},${idTR(200+n)},'PRUEBA-REA05-TIEMPOS localización') on conflict(id) do nothing`;
      await t`insert into salas(id,nombre,localizacion_id,largo_m,ancho_m,alto_m) values(${idTR(220+n)},${'PRUEBA-REA05-TIEMPOS sala '+n},${idTR(210+n)},6,4,3) on conflict(id) do nothing`;
      await t`insert into planes(id,proyecto_id,creado_por) values(${idTR(230+n)},${idTR(200+n)},${idTR(1)}) on conflict(id) do nothing`;
      for (let m=1; m<=3; m++) {
        const tareaId=idTR(300+n*10+m);
        await t`insert into plan_tareas(id,plan_id,sala_id,titulo,estado,creado_por) values(${tareaId},${idTR(230+n)},${m===3 ? null : idTR(220+n)},${'PRUEBA-REA05-TIEMPOS tarea '+n+'-'+m},'pendiente',${idTR(1)}) on conflict(id) do nothing`;
        for (let k=1; k<=6; k++) await t`insert into plan_asignaciones(tarea_id,tecnico_id,asignado_por) values(${tareaId},${idTR(100+k)},${idTR(1)}) on conflict(tarea_id,tecnico_id) do nothing`;
      }
    }
  });
  await writeFile(resolve(SALIDA_TIEMPOS,'servidor-sintetico.json'),JSON.stringify({ puerto:3115, cache:'.next-rea05-integracion', secreto:SECRETO_TIEMPOS, usuarios:{admin:idTR(1),trabajador:idTR(2),gestor:idTR(3),lectura:idTR(4)}, obra:idTR(201) },null,2));
}
export async function fotoTiempos(c: SqlRevisionesPrueba, nombre: string) {
  const foto={...await fotografiarBase(c),base:'av_design_rea05_prueba'};
  await writeFile(resolve(SALIDA_TIEMPOS,'bd-'+nombre+'.json'),JSON.stringify(foto,null,2));
  return foto;
}
if (process.argv[1] && resolve(process.argv[1])===resolve('scripts/rea05-tiempos-fixture.mts')) {
  if(process.env.REA_DATABASE_URL!==URL_REA_PRUEBA)throw new Error('Destino REA05 explícito obligatorio.');
  const c=await conectarRevisiones(process.env.REA_DATABASE_URL);
  try{await fixtureTiempos(c);await fotoTiempos(c,'fixture');}finally{await c.end();}
}

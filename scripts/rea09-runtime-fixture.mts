import Module from 'node:module';
import { idConsulta, conectarRevisiones, URL_REA_PRUEBA } from './rea09-fixture.mjs';
const m = Module as unknown as {
    _load: (id: string, ...a: unknown[]) => unknown;
}, prev = m._load;
m._load = (id, ...a) => id === 'server-only' ? {} : prev.call(Module, id, ...a);
const { leerDiseno, crearRevisionDiseno } = await import('../src/lib/revisiones-diseno-repositorio');
export { idConsulta };
export const F = { admin: idConsulta(1), lector: idConsulta(2), tecnico: idConsulta(3), provisional: idConsulta(4), inactivo: idConsulta(5), obra: idConsulta(201), localizacion: idConsulta(202), sala: idConsulta(203), legado: idConsulta(204), articulo: idConsulta(210), otro: idConsulta(211), cable: idConsulta(212), consumible: idConsulta(213), equipo: idConsulta(220), equipoDestino: idConsulta(221), equipoOrigen: idConsulta(222), puertoSalida: idConsulta(230), puertoEntrada: idConsulta(231), conexion: idConsulta(240), bom: idConsulta(250) };
export async function fixtureConsultas(sql: Awaited<ReturnType<typeof conectarRevisiones>>) {
    if ((await sql `select id from salas where id=${F.sala}`).length)
        return;
    await sql.begin(async (t) => {
        await t `insert into proyectos(id,nombre,codigo) values(${F.obra},'OBRA CONSULTAS REA09 sintética','REA09-QA')`;
        await t `insert into localizaciones(id,proyecto_id,nombre) values(${F.localizacion},${F.obra},'Edificio de prueba REA09')`;
        await t `insert into salas(id,nombre,codigo,localizacion_id,largo_m,ancho_m,alto_m,mesa_largo_m,mesa_ancho_m,mesa_alto_cm,mesa_x_m,mesa_y_m) values(${F.sala},'Sala de consulta local REA09','REA09-6x4',${F.localizacion},6,4,3,2,1,75,3,2),(${F.legado},'Legado sin medidas REA09','REA09-LEGADO',null,0,0,0,null,null,null,null,null)`;
        await t `insert into articulos(id,referencia,tipo,categoria,marca,modelo,unidad,caracteristicas,coste,fuente) values (${F.articulo},'REA09-X','equipo','PANTALLA','Marca literal M','Equipo X REA09','ud','Ficha técnica X registrada',87321,'app'),(${F.otro},'REA09-Y','equipo','SIN CATEGORÍA','Otra marca','Equipo Y REA09','ud',null,76234,'app'),(${F.cable},'REA09-H','cable','HDMI','Marca cable','HDMI metros REA09','m',null,65432,'app'),(${F.consumible},'REA09-C','consumible','FIJACIÓN','Marca literal M','Fijación REA09','ud',null,54321,'app')`;
        await t `insert into sala_equipos(id,sala_id,articulo_id,nombre,cantidad,extremo,x_m,y_m,z_m,posicion_confirmada) values(${F.equipo},${F.sala},${F.articulo},'Equipo X',2,'pantalla',0,0,0,true),(${F.equipoDestino},${F.sala},${F.otro},'Equipo Y',1,'mesa',3,2,0.75,true),(${F.equipoOrigen},${F.sala},${F.articulo},'Equipo origen físico',1,'pantalla',1,1,1,true)`;
        await t `insert into puertos(id,articulo_id,nombre,sentido,senal,conector,total,fuente) values(${F.puertoSalida},${F.articulo},'HDMI OUT 1','salida','hdmi','HDMI A',1,'app'),(${F.puertoEntrada},${F.otro},'HDMI IN 1','entrada','hdmi','HDMI A',1,'app')`;
        await t `insert into conexiones(id,sala_id,origen_id,destino_id,articulo_cable_id,senal,ruta,longitud_manual_m,puerto_origen_id,puerto_destino_id) values(${F.conexion},${F.sala},${F.equipoOrigen},${F.equipoDestino},${F.cable},'hdmi','directo',5,${F.puertoSalida},${F.puertoEntrada})`;
        await t `insert into conexion_bocas(conexion_id,lado,equipo_id,puerto_id,ordinal) values(${F.conexion},'origen',${F.equipoOrigen},${F.puertoSalida},1),(${F.conexion},'destino',${F.equipoDestino},${F.puertoEntrada},1)`;
        await t `insert into sala_material_bom(id,sala_id,articulo_id,cantidad,unidad,nota) values(${F.bom},${F.sala},${F.consumible},3,'ud','BOM adicional REA09')`;
    });
    const d = await leerDiseno(sql, F.sala);
    await crearRevisionDiseno(sql, F.sala, 'Revisión técnica REA09 sintética', F.admin, d.base);
    // Borrador posterior real: se guarda la cita E3 anterior sin atribuirle estos valores.
    await sql `update salas set mesa_x_m=3.25 where id=${F.sala}`;
}
if (process.argv[1]?.endsWith('rea09-runtime-fixture.mts')) {
    if (process.env.REA09_DATABASE_URL !== URL_REA_PRUEBA)
        throw new Error('URL09 explícita obligatoria.');
    const sql = await conectarRevisiones(process.env.REA09_DATABASE_URL);
    try {
        await fixtureConsultas(sql);
        console.log('Fixture09 propia preparada sin reset ni siembra.');
    }
    finally {
        await sql.end();
    }
}

/** Gate de autor B01/B03/B04. Sólo inserta fixtures propias en5563; nunca reescribe legado. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { conectarRevisiones, fotografiarRevisiones, idRequisito, SALIDA_REVISIONES } from './rea10-fixture.mjs';
import { RepositorioRequisitos } from '../src/lib/requisitos/repositorio';
import { PlanesRequisitos } from '../src/lib/requisitos/planes';
import { ErrorRequisito, hash, hashBytes, type Decisiones, type Destino } from '../src/lib/requisitos/modelo';
import { parsearFuente } from '../src/lib/requisitos/extraccion';

const url = process.env.REA10_DATABASE_URL;
if (!url) throw Error('URL sintética explícita obligatoria');
await mkdir(SALIDA_REVISIONES, { recursive: true });
const db = await conectarRevisiones(url), repo = new RepositorioRequisitos(db);
const planes = new PlanesRequisitos(db, 'rea10-correccion-secreto-sintetico-local-2026');
const resultados: unknown[] = [], trazas: string[] = [], usuarioId = randomUUID();
const ok = (caso: string, datos: unknown = true) => { resultados.push({ caso, datos }); console.log('PASS', caso); };
const conflicto = (fn: () => Promise<unknown>) => assert.rejects(fn, e => e instanceof ErrorRequisito && e.status === 409 && e.codigo === 'YA_APLICADO');
try {
  const antes = await fotografiarRevisiones(db);
  await writeFile(resolve(SALIDA_REVISIONES, 'baseline.json'), JSON.stringify(antes, null, 2));
  const codigo = 'PRUEBA-REA10-CORRECCION-' + Date.now();
  await db`insert into usuarios(id,usuario,nombre,rol,clave_hash,debe_cambiar_clave,activo)
    select ${usuarioId},${'cor10-' + Date.now()},'PRUEBA REA10 corrección','tecnico_avanzado',clave_hash,false,true from usuarios where id=${idRequisito(1)}`;
  const [obra] = await db`insert into proyectos(nombre,codigo) values(${codigo},${codigo}) returning id`;
  const [localizacion] = await db`insert into localizaciones(proyecto_id,nombre) values(${obra.id},'Sin asignar') returning id`;
  const [sala] = await db`insert into salas(nombre,localizacion_id) values('Alfa corrección',${localizacion.id}) returning id`;
  const [articulo] = await db`insert into articulos(tipo,categoria,marca,modelo,unidad,fuente)
    values('equipo','QA',${codigo},'MODELO-EXACTO','ud','app') returning id,revision`;
  const bytes = Buffer.from('Modelo: MODELO-EXACTO');
  const alta = (nombre: string) => repo.registrarArchivo(usuarioId, obra.id, { nombre, mime: 'text/plain', tamano: bytes.length, procedencia: 'Fuente sintética de corrección independiente del inventario', fechaFuente: null, url: null }, bytes);
  const decisionBom = (candidatoId: string, cantidad = 3): Decisiones => ({ versionModelo: 1, destino: 'areas_bom', areas: [], material: [{ candidatoId, camposRevisados: ['sala', 'articuloId', 'cantidad', 'unidad', 'disenoRevisado'], motivo: 'Necesidad revisada explícitamente para esta sala sintética', salaId: sala.id, areaCandidatoId: null, articuloId: articulo.id, revisionArticulo: Number(articulo.revision), cantidad, unidad: 'ud', disenoRevisado: true }], excluidos: [] });
  const planBom = async (extraccionId: string, candidatoId: string, cantidad = 3) => {
    const plan = await planes.crear(usuarioId, { extraccionId, destino: 'areas_bom' });
    await planes.editar(usuarioId, plan.id, { version: 0, decisiones: decisionBom(candidatoId, cantidad) });
    return plan;
  };
  const totalBom = async () => Number((await db`select coalesce(sum(cantidad),0)::text as total from sala_material_bom where sala_id=${sala.id} and articulo_id=${articulo.id}`)[0].total);

  const documento = await alta('origen-estable.txt');
  const primera = await repo.extraer(usuarioId, documento.id, { modo: 'local' });
  const segunda = await repo.extraer(usuarioId, documento.id, { modo: 'local' });
  assert.notEqual(primera.extraccionId, segunda.extraccionId);
  assert.equal(primera.resultado.candidatos[0].id, segunda.resultado.candidatos[0].id);
  const p1 = await planBom(primera.extraccionId, primera.resultado.candidatos[0].id);
  const p2 = await planBom(segunda.extraccionId, segunda.resultado.candidatos[0].id);
  const pv1 = await planes.preview(usuarioId, p1.id), pv2 = await planes.preview(usuarioId, p2.id);
  const entradas = [pv1, pv2].map(pv => ({ version: 1, token: pv.token, clavePeticion: randomUUID() }));
  const carrera = await Promise.allSettled([planes.confirmar(usuarioId, p1.id, entradas[0]), planes.confirmar(usuarioId, p2.id, entradas[1])]);
  assert.equal(carrera.filter(r => r.status === 'fulfilled').length, 1);
  const perdida = carrera.find(r => r.status === 'rejected');
  assert.ok(perdida?.status === 'rejected' && perdida.reason instanceof ErrorRequisito && perdida.reason.codigo === 'YA_APLICADO');
  assert.equal(await totalBom(), 3);
  const ganadora = carrera.findIndex(r => r.status === 'fulfilled');
  const replay = await planes.confirmar(usuarioId, [p1, p2][ganadora].id, entradas[ganadora]);
  assert.equal(replay.repetida, true); assert.equal(await totalBom(), 3);
  const tercera = await repo.extraer(usuarioId, documento.id, { modo: 'local' });
  const p3 = await planBom(tercera.extraccionId, tercera.resultado.candidatos[0].id);
  await conflicto(() => planes.preview(usuarioId, p3.id));
  ok('B01-local-dos-preview-confirmacion-concurrente-un-ganador-y-reextraccion-bloqueada', { totalBom: 3, documentoId: documento.id, planes: [p1.id, p2.id, p3.id] });

  // Construye una NUEVA fixture con la función anterior preservada. No altera
  // aplicaciones ni extracciones históricas del inventario o de otros gates.
  const rutaAntigua = resolve('output/rea-integracion/rea10/runtime-20261016/qa-07/freeze/fuentes-congeladas/src/lib/requisitos/extraccion.ts');
  const manifestAntiguo = JSON.parse(await readFile('output/rea-integracion/rea10/runtime-20261016/qa-07/freeze/manifest.json', 'utf8')) as { archivos: Array<{ ruta: string; sha256: string }> };
  const shaAntiguo = manifestAntiguo.archivos.find(f => f.ruta === 'src/lib/requisitos/extraccion.ts')!.sha256;
  assert.equal(hashBytes(await readFile(rutaAntigua)), shaAntiguo);
  const moduloAntiguo = await import(pathToFileURL(rutaAntigua).href) as { parsearFuente: typeof parsearFuente };
  const legado = await alta('fixture-legado-propio.txt');
  const xl = await moduloAntiguo.parsearFuente(legado.id, 'text/plain', bytes);
  await db`insert into requisitos_extracciones(id,documento_id,autor_id,metodo,parser,parser_version,fuente_sha256,texto_sha256,sha256,resultado)
    values(${xl.extraccionId},${legado.id},${usuarioId},${xl.metodo},${xl.parser},${xl.parserVersion},${xl.fuenteSha256},${xl.textoSha256},${hash(xl.resultado)},${db.json(xl.resultado)})`;
  const pl = await planBom(xl.extraccionId, xl.resultado.candidatos[0].id);
  const pvl = await planes.preview(usuarioId, pl.id);
  await planes.confirmar(usuarioId, pl.id, { version: 1, token: pvl.token, clavePeticion: randomUUID() });
  const xr = await repo.extraer(usuarioId, legado.id, { modo: 'local' });
  assert.notEqual(xr.resultado.candidatos[0].id, xl.resultado.candidatos[0].id);
  const pr = await planBom(xr.extraccionId, xr.resultado.candidatos[0].id);
  await conflicto(() => planes.preview(usuarioId, pr.id)); assert.equal(await totalBom(), 6);
  ok('B01-aplicacion-legada-reconocida-por-ancla-sin-reescribir-identificadores', { fuenteFixture: rutaAntigua, shaAntiguo, documentoId: legado.id, candidatoAntiguo: xl.resultado.candidatos[0].id, candidatoNuevo: xr.resultado.candidatos[0].id, totalBom: 6 });

  const motivo = 'MOTIVO-MANUAL-CORRECCION-' + randomUUID();
  const manual = await repo.extraer(usuarioId, legado.id, { modo: 'manual', texto: bytes.toString(), pagina: null, motivo });
  const [guardada] = await db`select autor_id,creado_en,resultado from requisitos_extracciones where id=${manual.extraccionId}`;
  assert.equal(guardada.resultado.motivoManual, motivo); assert.equal(guardada.autor_id, usuarioId); assert.ok(guardada.creado_en);
  const pm = await planBom(manual.extraccionId, manual.resultado.candidatos[0].id, 2);
  const pvm = await planes.preview(usuarioId, pm.id);
  const am = await planes.confirmar(usuarioId, pm.id, { version: 1, token: pvm.token, clavePeticion: randomUUID() });
  assert.equal(await totalBom(), 8); assert.ok(!JSON.stringify(am.resultado).includes(motivo));
  await repo.retirar(usuarioId, legado.id, { version: 0, accion: 'purgar', motivo: 'Cierre de fuente sintética y motivo manual privado', confirmarHash: legado.sha256 });
  const [purgada] = await db`select resultado from requisitos_extracciones where id=${manual.extraccionId}`;
  assert.equal(purgada.resultado, null);
  ok('B04-nueva-demanda-manual-permitida-con-motivo-autor-fecha-y-purga-sin-copia-en-aplicacion', { extraccionId: manual.extraccionId, aplicacionId: am.id, totalBom: 8 });

  const casosAcl: unknown[] = [];
  for (const destino of ['areas_bom', 'catalogo', 'ofertas', 'tecnico', 'puerto'] as Destino[]) {
    const da = await alta(`acl-${destino}.txt`), xa = await repo.extraer(usuarioId, da.id, { modo: 'local' });
    const pa = await planes.crear(usuarioId, { extraccionId: xa.extraccionId, destino });
    const candidatoId = xa.resultado.candidatos[0].id;
    let decisiones: Decisiones;
    if (destino === 'areas_bom') decisiones = decisionBom(candidatoId);
    else if (destino === 'catalogo' || destino === 'ofertas') {
      const datos = { marca: codigo, modelo: 'MODELO-EXACTO', unidad: 'ud', tipo: 'equipo', ...(destino === 'ofertas' ? { precio: '10', moneda: 'EUR', fecha: '2026-10-16' } : {}) };
      decisiones = { versionModelo: 1, destino, filas: [{ candidatoId, camposRevisados: [...Object.keys(datos), 'seleccion'], motivo: 'Decisión local privada para barrera ACL', datos, articuloId: articulo.id, crear: false, revisionArticulo: Number(articulo.revision) }], excluidos: [] };
    } else {
      const base = await planes.baseTecnica(usuarioId, articulo.id, destino);
      const datos = destino === 'tecnico' ? { marca: codigo, modelo: 'MODELO-EXACTO', ancho: 1200, alto: null, fondo: null, unidad: 'mm', ru: null, origen: 'Fuente sintética', url: 'https://example.invalid/ficha', fecha: '2026-10-16' } : { nombre: 'HDMI IN 1', total: 2, sentido: 'entrada', senal: 'hdmi', conector: 'HDMI A', orden: null, notas: null };
      decisiones = { versionModelo: 1, destino, candidatoId, camposRevisados: [...Object.keys(datos), 'modeloExacto'], motivo: 'Decisión individual privada para barrera ACL', articuloId: articulo.id, baseHash: base.baseHash, baseRevision: base.baseRevision, datos } as Decisiones;
    }
    await planes.editar(usuarioId, pa.id, { version: 0, decisiones });
    for (const modo of ['obtener', 'detalle']) {
      let barrera = false;
      const seccion = destino === 'areas_bom' ? 'salas' : destino === 'ofertas' ? 'compras' : 'catalogo';
      const proxy = new Proxy(db, { apply(target, thisArg, args) {
        const pendiente = Reflect.apply(target, thisArg, args);
        const sql = Array.isArray(args[0]) ? args[0].join('?') : '';
        trazas.push(`${destino}/${modo}: ${sql}`);
        const coincide = modo === 'obtener' ? sql.includes('select id,sha256,fuente_sha256,resultado') : sql.includes('select p.id,p.extraccion_id,p.version,p.destino,p.estado,p.decisiones');
        if (!barrera && coincide) {
          barrera = true;
          return Promise.resolve(pendiente).then(async filas => {
            await db`insert into usuario_permisos(usuario_id,seccion,acceso) values(${usuarioId},${seccion},'ver') on conflict(usuario_id,seccion) do update set acceso='ver'`;
            trazas.push(`BARRERA commit ${seccion}:editar->ver antes de identidad final`);
            return filas;
          });
        }
        return pendiente;
      } });
      await assert.rejects(() => modo === 'obtener' ? new PlanesRequisitos(proxy).obtener(usuarioId, pa.id) : new RepositorioRequisitos(proxy).detalle(usuarioId, da.id), e => e instanceof ErrorRequisito && e.status === 403);
      assert.equal(barrera, true);
      await db`delete from usuario_permisos where usuario_id=${usuarioId} and seccion=${seccion}`;
      assert.equal((await planes.obtener(usuarioId, pa.id)).id, pa.id);
      casosAcl.push({ destino, modo, barrera, estado: 403 });
    }
  }
  ok('B03-revocacion-despues-de-decisiones-bloquea-retorno-en-cinco-destinos', casosAcl);
  const despues = await fotografiarRevisiones(db);
  await writeFile(resolve(SALIDA_REVISIONES, 'final.json'), JSON.stringify(despues, null, 2));
  await writeFile(resolve(SALIDA_REVISIONES, 'acl-sql.log'), trazas.join('\n'));
  await writeFile(resolve(SALIDA_REVISIONES, 'resultado.json'), JSON.stringify({ estado: 'PASS', usuarioId, obraId: obra.id, salaId: sala.id, articuloId: articulo.id, resultados, antes: antes.sha256, despues: despues.sha256 }, null, 2));
} finally { await db.end(); }

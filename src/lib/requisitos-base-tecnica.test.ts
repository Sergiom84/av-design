import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { it } from 'node:test';

const ids = {
  usuario: 'b3000000-0000-4000-8000-000000000001',
  articulo: 'b3000000-0000-4000-8000-000000000002',
  plan: 'b3000000-0000-4000-8000-000000000003',
  documento: 'b3000000-0000-4000-8000-000000000004',
  extraccion: 'b3000000-0000-4000-8000-000000000005',
  candidato: 'b3000000-0000-4000-8000-000000000006',
  proyecto: 'b3000000-0000-4000-8000-000000000007',
};
const hash = 'a'.repeat(64);
const articulo = { id: ids.articulo, marca: 'Fabricante QA', modelo: 'Monitor QA',
  unidad: 'ud', tipo: 'equipo', referencia: 'QA-REA10', categoria: 'Pantalla', activo: true };
const resultado = { versionModelo: 1, estado: 'con_texto', paginas: [], avisos: [], candidatos: [{
  id: ids.candidato, clase: 'material', fragmento: 'Modelo: Monitor QA', original: {}, ambiguedades: [],
  ancla: { documentoId: ids.documento, extraccionId: ids.extraccion, pagina: 1, linea: null,
    inicio: 0, fin: 18, sha256: hash, metodo: 'literal_estructurado' },
}] };
type Destino = 'catalogo' | 'ofertas';
let destino: Destino = 'catalogo';
let articuloBD = { ...articulo, revision: '0' };
let version = 0, escrituras = 0, transacciones = 0;
let decisionesGuardadas: unknown;

// Sólo se sustituye I/O: las rutas, ejecutar, leerJson, el schema y editar son reales.
async function consultar(partes: TemplateStringsArray, ...valores: unknown[]) {
  const consulta = partes.join('?').replace(/\s+/gu, ' ').trim();
  if (consulta.startsWith('select id,rol::text as rol,activo,debe_cambiar_clave from usuarios'))
    return [{ id: ids.usuario, rol: 'admin', activo: true, debe_cambiar_clave: false }];
  if (consulta.startsWith('select seccion,acceso from usuario_permisos')) return [];
  if (consulta.startsWith('select id,marca,modelo,revision,unidad,tipo,referencia,categoria,activo from articulos'))
    return [articuloBD]; // BIGINT conserva el texto que entrega postgres.js.
  if (consulta.startsWith('select p.id,p.autor_id,p.destino,e.documento_id from requisitos_planes'))
    return [{ id: ids.plan, autor_id: ids.usuario, destino, documento_id: ids.documento }];
  if (consulta.startsWith('select id,proyecto_id,autor_id,version,tipo,sha256,estado,origen_ref,creado_en from requisitos_documentos'))
    return [{ id: ids.documento, proyecto_id: ids.proyecto, autor_id: ids.usuario, version: 0,
      tipo: 'archivo_obra', sha256: hash, estado: 'activo', origen_ref: null, creado_en: '2026-10-16T00:00:00Z' }];
  if (consulta.startsWith('select id,version,estado,destino,extraccion_id,decisiones from requisitos_planes'))
    return [{ id: ids.plan, version, estado: 'borrador', destino, extraccion_id: ids.extraccion, decisiones: decisionesGuardadas }];
  if (consulta.startsWith('select id,sha256,fuente_sha256,resultado from requisitos_extracciones'))
    return [{ id: ids.extraccion, sha256: hash, fuente_sha256: hash, resultado }];
  if (consulta.startsWith('update requisitos_planes set decisiones=')) {
    decisionesGuardadas = valores[0]; escrituras++; version++;
    return [];
  }
  throw new Error(`Consulta no prevista por la prueba: ${consulta}`);
}
type BasePrueba = typeof consultar & { json: (valor: unknown) => unknown;
  begin: <T>(fn: (tx: BasePrueba) => Promise<T>) => Promise<T> };
const db: BasePrueba = Object.assign(consultar, {
  json: (valor: unknown) => valor,
  begin: async <T>(fn: (tx: BasePrueba) => Promise<T>): Promise<T> => { transacciones++; return fn(db); },
});
const cargador = Module as unknown as { _load: (nombre: string, padre?: { filename?: string }, ...args: unknown[]) => unknown };
const original = cargador._load;
let GET: typeof import('../app/api/requisitos/base-tecnica/route').GET;
let PATCH: typeof import('../app/api/requisitos/planes/[id]/route').PATCH;
try {
  cargador._load = (nombre, padre, ...args) => padre?.filename?.endsWith('/requisitos/http.ts') && nombre === '../db'
    ? { sql: db, hayConfiguracion: () => true }
    : padre?.filename?.endsWith('/requisitos/http.ts') && nombre === '../sesion-servidor'
      ? { sesionActual: async () => ({ id: ids.usuario, ficticio: false, debeCambiarClave: false }) }
      : original.call(Module, nombre, padre, ...args);
  const cargar = createRequire(import.meta.url);
  GET = cargar('../app/api/requisitos/base-tecnica/route.ts').GET;
  PATCH = cargar('../app/api/requisitos/planes/[id]/route.ts').PATCH;
} finally { cargador._load = original; }

function reiniciar(nuevoDestino: Destino, revision = '7') {
  destino = nuevoDestino; articuloBD = { ...articulo, revision };
  version = 0; escrituras = 0; transacciones = 0; decisionesGuardadas = null;
}
function cuerpo(revision: unknown) {
  const datos: Record<string, string> = destino === 'catalogo'
    ? { marca: articulo.marca, modelo: articulo.modelo, descripcion: 'Descripción revisada QA' }
    : { marca: articulo.marca, modelo: articulo.modelo, precio_compra: '125.50', moneda: 'EUR' };
  return { version: 0, decisiones: { versionModelo: 1, destino, filas: [{ candidatoId: ids.candidato,
    datos, articuloId: ids.articulo, crear: false, revisionArticulo: revision,
    camposRevisados: [...Object.keys(datos), 'seleccion'], motivo: 'Referencia exacta comprobada en la fuente QA' }], excluidos: [] } };
}
function guardar(entrada: unknown) {
  return PATCH(new Request(`http://localhost/api/requisitos/planes/${ids.plan}`, { method: 'PATCH',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(entrada) }),
  { params: Promise.resolve({ id: ids.plan }) });
}

for (const destino of ['catalogo', 'ofertas'] as const) {
  for (const [revisionBD, revisionEsperada] of [['0', 0], ['7', 7]] as const) {
    it(`${destino}: GET de BIGINT ${revisionBD} permite PATCH sin transformar la revisión recibida`, async t => {
      reiniciar(destino, revisionBD);
      const respuestaBase = await GET(new Request(`http://localhost/api/requisitos/base-tecnica?destino=articulo&articuloId=${ids.articulo}`));
      const textoBase = await respuestaBase.text();
      assert.equal(respuestaBase.status, 200);
      const base = JSON.parse(textoBase);
      const entrada = cuerpo(base.articulo.revision);
      const respuesta = await guardar(entrada), textoPatch = await respuesta.text();
      t.diagnostic(JSON.stringify({ revisionBD, destino, get: textoBase, patch: entrada,
        estadoPatch: respuesta.status, respuestaPatch: textoPatch }));
      assert.equal(respuesta.status, 200, textoPatch);
      assert.equal(typeof base.articulo.revision, 'number');
      assert.deepEqual(base.articulo, { ...articulo, revision: revisionEsperada });
      assert.equal(articuloBD.revision, revisionBD);
      assert.deepEqual(JSON.parse(textoPatch).decisiones.datos, entrada.decisiones);
      assert.equal(version, 1); assert.equal(escrituras, 1);
    });
  }

  it(`${destino}: PATCH sigue rechazando revisión texto, negativa, fraccionaria y claves ajenas sin escribir`, async t => {
    reiniciar(destino);
    const entradasInvalidas = [cuerpo('7'), cuerpo(-1), cuerpo(1.5), { ...cuerpo(7), campoAjeno: true }];
    for (const entrada of entradasInvalidas) {
      reiniciar(destino);
      const respuesta = await guardar(entrada), texto = await respuesta.text();
      t.diagnostic(JSON.stringify({ destino, patch: entrada, estadoPatch: respuesta.status, respuestaPatch: texto }));
      assert.equal(respuesta.status, 400, texto);
      assert.equal(JSON.parse(texto).codigo, 'ENTRADA');
      assert.equal(transacciones, 0); assert.equal(escrituras, 0); assert.equal(version, 0);
    }
  });
}

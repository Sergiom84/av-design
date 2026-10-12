import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { montar, pulsar } from '@/pruebas/dom';
import { PaqueteTecnico, type FichaPaquete } from './paquete-tecnico';
import { ImprimirPaquete } from './imprimir-paquete';
import { GuiaMontaje } from '@/components/sala/guia-montaje';
import { construirTablaCables } from '@/lib/cable-schedule';
import { proyectarSuministros } from '@/lib/suministros';
import { necesidadDeSala } from '@/lib/compras';
import { calcularConexion, agruparMaterialCable } from '@/lib/calculo-cable';
import { PARAMETROS_POR_DEFECTO, type Articulo, type Conexion, type EquipoEnSala, type Puerto, type Sala } from '@/lib/tipos';

const sala: Sala = {
  id: 's', sede_id: null, localizacion_id: null, codigo: 'PRUEBA', nombre: 'Sala sintética',
  tipologia: null, aforo: 0, plantilla_id: null, largo_m: 8, ancho_m: 5, alto_m: 3,
  alto_falso_techo_m: null, alto_canaleta_m: null, alto_suelo_tecnico_m: null,
  ruta_por_defecto: 'directo', notas: null, mesa_largo_m: null, mesa_ancho_m: null,
  mesa_alto_cm: null, mesa_x_m: null, mesa_y_m: null, mesa_rotacion_grados: 0,
  diagrama_version: 0, sillas_modo: 'manuales',
};
const equipos: EquipoEnSala[] = ['Micro', 'Codec'].map((nombre, i) => ({
  id: nombre, sala_id: 's', articulo_id: nombre, nombre, cantidad: 1, extremo: 'mesa',
  posicion: { x_m: i + 1, y_m: 2, z_m: 1 }, posicion_confirmada: true, rotacion_grados: 0,
}));
const cable: Articulo = {
  id: 'cable', referencia: null, tipo: 'cable', categoria: 'CABLE', marca: 'PRUEBA', modelo: 'Cable documentado',
  descripcion: 'Conjunto de prueba', caracteristicas: 'Cuatro contactos', observaciones: 'Revisar pinout según ficha del suministro',
  unidad: 'm', coste: null, coste_orientativo: false, pvp: null, proveedor: null, plazo_dias: null,
  stock_minimo: null, senal: 'microfono', conector_a: 'Mini jack', conector_b: 'Mini jack',
  longitudes_comerciales_m: null, bobina_m: null, diametro_mm: null, unidades_instaladas: null, activo: true,
};
const puertos: Puerto[] = [
  { id: 'po', articulo_id: 'Micro', nombre: 'MIC OUT', total: 1, sentido: 'salida', senal: 'microfono', conector: 'Mini jack', orden: 1, notas: 'Salida documentada del micro', fuente: 'app' },
  { id: 'pd', articulo_id: 'Codec', nombre: 'Microphone inputs', total: 3, sentido: 'entrada', senal: 'microfono', conector: 'Mini jack', orden: 1, notas: 'Puertos del Codec EQ incluido; cámara/control aparte', fuente: 'app' },
];
const conexion: Conexion = {
  etiqueta_cable: 'MIC-1000',
  detalle: { estado: 'completo',
    origen: { tipo: 'equipo', equipo_id: 'Micro', puerto_id: 'po', ordinal: 1 },
    destino: { tipo: 'equipo', equipo_id: 'Codec', puerto_id: 'pd', ordinal: 2 } },
  id: 'c', sala_id: 's', origen_id: 'Micro', destino_id: 'Codec', articulo_cable_id: 'cable',
  senal: 'microfono', ruta: 'directo', longitud_manual_m: 7.25, notas: 'Usar el cable indicado\nNo sustituir el pinout',
  puerto_origen_id: 'po', puerto_destino_id: 'pd', puerto_origen_ordinal: 1, puerto_destino_ordinal: 2,
};
function fichaPrueba(): FichaPaquete {
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const articulos = new Map([[cable.id, cable]]);
  const resultado = calcularConexion(conexion, sala, equiposPorId, articulos, PARAMETROS_POR_DEFECTO,
    { tomas: new Map(), puertos: new Map(puertos.map((p) => [p.id, p])) });
  assert.ok(resultado);
  return {
    suministro: proyectarSuministros(equipos, { suministros: [], componentes: [] }),
    necesidad: necesidadDeSala(equipos, agruparMaterialCable([resultado], [conexion], articulos), articulos),
    sala, equipos, conexiones: [conexion], tomas: [], muebles: [], puertos, articulos: [cable],
    resultados: [resultado], canalizacion: null,
    material: agruparMaterialCable([resultado], [conexion], articulos),
    filasCable: construirTablaCables({ conexiones: [conexion], equipos: equiposPorId, tomas: new Map(),
      puertos: new Map(puertos.map((p) => [p.id, p])), articulos, resultados: new Map([[conexion.id, resultado]]) }),
  };
}

test('paquete renderizado reúne plano, cuatro elevaciones, cables, bocas y material sin recalcular metros', () => {
  const ficha = fichaPrueba();
  const dom = new JSDOM(renderToStaticMarkup(<PaqueteTecnico ficha={ficha} puertas={[]} emitido="08/09/2026 12:00" />));
  try {
    const paquete = dom.window.document.querySelector('#paquete-tecnico')!;
    assert.deepEqual([...paquete.querySelectorAll(':scope > section')].map((s) => s.getAttribute('aria-label')), ['Plano de la sala', 'Cotas y elevaciones', 'Conexiones y bocas físicas', 'Lista de material']);
    assert.equal(paquete.querySelectorAll('svg').length, 5);
    const texto = paquete.textContent ?? '';
    assert.match(texto, /Microphone inputs 2/);
    assert.match(texto, /Boca física de destino: 2/);
    assert.ok(texto.includes(ficha.filasCable[0].identificador));
    assert.match(texto, /7.25 m calculados/);
    assert.match(texto, /Usar el cable indicado\nNo sustituir el pinout/);
    assert.match(texto, /Revisar pinout según ficha del suministro/);
    assert.match(texto, /Puertos del Codec EQ incluido; cámara\/control aparte/);
    assert.match(texto, /Cuatro contactos/);
    assert.match(texto, /7.25 m/);
    assert.match(texto, /Adicional/);
    assert.doesNotMatch(texto, /ZIP|Descargar PDF/);
  } finally { dom.window.close(); }
});

test('la guía conserva ausencia de notas, conector, puerto y boca sin inferir compatibilidad', () => {
  const ficha = fichaPrueba();
  const filas = [{ ...ficha.filasCable[0], puerto_origen: null, conector_origen: null }];
  const texto = renderToStaticMarkup(<GuiaMontaje filas={filas} equipos={[]} tomas={[]} />);
  assert.match(texto, /puerto sin definir/);
  assert.match(texto, /Boca física de origen: sin definir/);
  assert.match(texto, /Conector de origen: sin documentar/);
  assert.doesNotMatch(texto, /Notas de conexión|Observaciones del cable|compatible/);
});

test('sala sin medidas ni conexiones muestra carencias imprimibles sin generar dibujos falsos', () => {
  const ficha: FichaPaquete = { ...fichaPrueba(), sala: { ...sala, largo_m: 0, ancho_m: 0, alto_m: 0 }, equipos: [], conexiones: [], filasCable: [], resultados: [], material: [] };
  const dom = new JSDOM(renderToStaticMarkup(<PaqueteTecnico ficha={ficha} puertas={[]} emitido="prueba" />));
  try {
    const paquete = dom.window.document.querySelector('#paquete-tecnico')!;
    assert.equal(paquete.querySelectorAll('svg').length, 0);
    assert.match(paquete.textContent ?? '', /Mide largo, ancho y alto/);
    assert.match(paquete.textContent ?? '', /Sin equipos registrados/);
    assert.match(paquete.textContent ?? '', /Sin material de cable calculado/);
  } finally { dom.window.close(); }
});

test('la regla de aislamiento de impresión oculta hermanos sin ocultar el paquete ni sus ancestros', () => {
  const html = renderToStaticMarkup(<PaqueteTecnico ficha={fichaPrueba()} puertas={[]} emitido="prueba" />);
  const dom = new JSDOM(`<aside id="menu">Menú</aside><main id="principal"><nav id="pestanas">Pestañas</nav><div id="pagina"><div id="acciones">Imprimir</div>${html}</div></main>`);
  try {
    const documento = dom.window.document;
    const css = documento.querySelector('style')!.textContent!;
    const regla = css.match(/(body:has\(#paquete-tecnico\) \*:not[^{}]+)\{ display: none !important;/);
    assert.ok(regla);
    const ocultos = [...documento.querySelectorAll(regla[1].trim())];
    for (const id of ['menu', 'pestanas', 'acciones']) assert.ok(ocultos.includes(documento.getElementById(id)!));
    for (const id of ['principal', 'pagina', 'paquete-tecnico']) assert.ok(!ocultos.includes(documento.getElementById(id)!));
    assert.ok([...documento.querySelectorAll('#paquete-tecnico *')].every((e) => !ocultos.includes(e)));
  } finally { dom.window.close(); }
});

test('el botón ejecuta la impresión nativa una vez, sin descarga ficticia', async () => {
  const m = await montar(<ImprimirPaquete />);
  try {
    let impresiones = 0;
    m.ventana.print = () => { impresiones++; };
    const boton = m.contenedor.querySelector('button')!;
    assert.equal(boton.type, 'button');
    await pulsar(boton);
    assert.equal(impresiones, 1);
    assert.equal(m.contenedor.querySelector('[download]'), null);
  } finally { await m.desmontar(); }
});

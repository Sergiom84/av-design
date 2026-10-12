import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import '@/pruebas/dom';
import { TablaCables } from './tabla-cables';
import { ResultadoDelCable } from '../sala/resultado-cable';
import { calcularConexion, diagnosticarCalculoConexion } from '@/lib/calculo-cable';
import { construirTablaCables } from '@/lib/cable-schedule';
import { PARAMETROS_POR_DEFECTO, type Conexion, type EquipoEnSala, type Puerto, type Sala, type TomaRed } from '@/lib/tipos';
const sala: Sala = {
  id: 's', sede_id: null, localizacion_id: null, codigo: null, nombre: 'Ensayo', tipologia: null,
  aforo: null, plantilla_id: null, largo_m: 6, ancho_m: 4, alto_m: 3, alto_falso_techo_m: 2.7,
  alto_canaleta_m: 0.3, alto_suelo_tecnico_m: 0, ruta_por_defecto: 'directo', notas: null,
  mesa_largo_m: null, mesa_ancho_m: null, mesa_alto_cm: null, mesa_x_m: null, mesa_y_m: null,
  mesa_rotacion_grados: 0, diagrama_version: 0, sillas_modo: 'derivadas',
};
const equipo: EquipoEnSala = { id: 'e', sala_id: 's', articulo_id: 'a', nombre: 'Equipo', cantidad: 1,
  extremo: 'mesa', posicion: { x_m: 3, y_m: 2, z_m: 1 }, posicion_confirmada: true, rotacion_grados: 0 };
const puerto: Puerto = { id: 'p', articulo_id: 'a', nombre: 'LAN', total: 2, sentido: 'bidireccional',
  senal: 'red', conector: 'RJ45', orden: 1, notas: null, fuente: 'app' };
const toma: TomaRed = { id: 't', sala_id: 's', codigo: 'R-12', codigo_referencia: null, codigo_confirmado: true,
  capacidad_documentada: 2, esquema_x: null, esquema_y: null, ubicacion: 'suelo', x_m: 0, y_m: 0, z_m: 0, notas: null,
  bocas: [1, 2].map((ordinal) => ({ id: `b${ordinal}`, toma_red_id: 't', ordinal, etiqueta: null, senal: 'red', conector: 'RJ45' })),
};
const conexion: Conexion = { id: 'c', etiqueta_cable: 'RED-1000', sala_id: 's', origen_id: 'e', destino_id: null,
  puerto_origen_id: 'p', puerto_origen_ordinal: 2, puerto_destino_id: null, puerto_destino_ordinal: null,
  detalle: { estado: 'completo', origen: { tipo: 'equipo', equipo_id: 'e', puerto_id: 'p', ordinal: 2 },
    destino: { tipo: 'roseta', toma_boca_id: 'b2' } }, articulo_cable_id: null, senal: 'red', ruta: null,
  longitud_manual_m: null, notas: null,
};
const equipos = new Map([[equipo.id, equipo]]);
const contexto = { tomas: new Map([[toma.id, toma]]), puertos: new Map([[puerto.id, puerto]]) };
const avisos = diagnosticarCalculoConexion(conexion, sala, equipos, new Map(), PARAMETROS_POR_DEFECTO, contexto);
const filas = construirTablaCables({ conexiones: [conexion], equipos, ...contexto, articulos: new Map(),
  resultados: new Map(), avisosCalculo: new Map([[conexion.id, avisos]]) });

test('tabla con medidas e identidad completas presenta holgura pendiente sin afirmar que faltan medidas', () => {
  assert.equal(calcularConexion(conexion, sala, equipos, new Map(), PARAMETROS_POR_DEFECTO, contexto), null);
  assert.deepEqual(avisos, ['Falta configurar la holgura de roseta (destino).']);
  const dom = new JSDOM(renderToStaticMarkup(<TablaCables filas={filas} nombreSala={sala.nombre} />));
  const fila = dom.window.document.querySelector('tbody tr')!;
  assert.match(fila.textContent!, /RED-1000/);
  const cabeceras = [...dom.window.document.querySelectorAll('thead th')].map((celda) => celda.textContent);
  assert.equal(fila.querySelectorAll('td')[cabeceras.indexOf('Desglose')].textContent, avisos[0]);
  assert.match(fila.textContent!, /Falta configurar la holgura de roseta/);
  assert.doesNotMatch(fila.textContent!, /Faltan las medidas/);
  dom.window.close();
});

test('resumen conserva la tirada pendiente y su causa sin pedir equipos que ya existen', () => {
  const html = renderToStaticMarkup(<ResultadoDelCable resultados={[]} sinMedidas={false} filas={filas} />);
  assert.match(html, /RED-1000/);
  assert.match(html, /1 tirada pendiente/);
  assert.match(html, /Falta configurar la holgura de roseta/);
  assert.doesNotMatch(html, /Añade equipos|Rellena las medidas|Metros totales/);
});

test('resumen mixto identifica la suma parcial y mantiene la tirada sin calcular', () => {
  const resultado = calcularConexion({ ...conexion, id: 'calculada', longitud_manual_m: 8 }, sala, equipos,
    new Map(), PARAMETROS_POR_DEFECTO, contexto)!;
  const html = renderToStaticMarkup(<ResultadoDelCable resultados={[resultado]} sinMedidas={false} filas={[
    ...filas, { ...filas[0], conexion_id: 'calculada', identificador: 'RED-1001', metros: 8, avisos: [] },
  ]} />);
  assert.match(html, /Metros calculados/);
  assert.match(html, /RED-1000/);
  assert.match(html, /holgura de roseta/);
  assert.doesNotMatch(html, /Metros totales/);
});

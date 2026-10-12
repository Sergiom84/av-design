import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectorBocaConexion } from './selector-boca-conexion';
import type { Articulo, Conexion, EquipoEnSala, Puerto, Sala } from '@/lib/tipos';
import type { CableSuministrado } from '@/lib/suministros';

test('la tabla de una conexión existente envía y conserva sus dos bocas físicas', () => {
  const puertosOrigen = [
    { id: 'puerto-a', articulo_id: 'articulo-a', nombre: 'OUTPUT', sentido: 'salida', total: 2 },
  ] as Puerto[];
  const puertosDestino = [
    { id: 'puerto-b', articulo_id: 'articulo-b', nombre: 'INPUT', sentido: 'entrada', total: 2 },
  ] as Puerto[];

  const origen = renderToStaticMarkup(createElement(SelectorBocaConexion, {
    conexionId: 'conexion-1', lado: 'origen', puertos: puertosOrigen,
    puertoActual: 'puerto-a', ordinalActual: 2,
  }));
  const destino = renderToStaticMarkup(createElement(SelectorBocaConexion, {
    conexionId: 'conexion-1', lado: 'destino', puertos: puertosDestino,
    puertoActual: 'puerto-b', ordinalActual: 1,
  }));

  assert.match(origen, /name="boca_origen"/);
  assert.match(destino, /name="boca_destino"/);
  assert.match(origen, /value="puerto-a:2" selected=""/);
  assert.match(destino, /value="puerto-b:1" selected=""/);
  assert.match(origen, /value="puerto-a:1"/);
  assert.match(destino, /value="puerto-b:2"/);
});

test('la ficha de conexión existente ofrece estado de suministro y latiguillo', async () => {
  const { montar } = await import('@/pruebas/dom');
  const { Conexiones } = await import('./conexiones');
  const sala = {
    id: 's1', sede_id: null, localizacion_id: null, codigo: null, nombre: 'Sala', tipologia: null, aforo: null,
    plantilla_id: null, largo_m: 6, ancho_m: 4, alto_m: 3, alto_falso_techo_m: null, alto_canaleta_m: null,
    alto_suelo_tecnico_m: null, ruta_por_defecto: 'directo', notas: null, mesa_largo_m: null, mesa_ancho_m: null,
    mesa_alto_cm: null, mesa_x_m: null, mesa_y_m: null, mesa_rotacion_grados: 0, diagrama_version: 1, sillas_modo: 'manuales',
  } as Sala;
  const equipos: EquipoEnSala[] = [
    { id: 'e1', sala_id: 's1', articulo_id: 'a1', nombre: 'Micro', cantidad: 1, extremo: 'mesa', posicion: { x_m: 1, y_m: 1, z_m: 1 }, posicion_confirmada: true, rotacion_grados: 0 },
    { id: 'e2', sala_id: 's1', articulo_id: 'a2', nombre: 'Switch', cantidad: 1, extremo: 'rack', posicion: { x_m: 2, y_m: 1, z_m: 1 }, posicion_confirmada: true, rotacion_grados: 0 },
  ];
  const puertos: Puerto[] = [
    { id: 'p1', articulo_id: 'a1', nombre: 'RJ45', total: 1, sentido: 'bidireccional', senal: 'red', conector: 'RJ45', orden: 1, notas: null, fuente: 'app' },
    { id: 'p2', articulo_id: 'a2', nombre: 'PoE', total: 8, sentido: 'bidireccional', senal: 'red', conector: 'RJ45', orden: 1, notas: null, fuente: 'app' },
  ];
  const conexion: Conexion = {
    id: 'c1', sala_id: 's1', etiqueta_cable: 'RED-1000', origen_id: 'e1', destino_id: 'e2',
    detalle: { estado: 'completo', origen: { tipo: 'equipo', equipo_id: 'e1', puerto_id: 'p1', ordinal: 1 }, destino: { tipo: 'equipo', equipo_id: 'e2', puerto_id: 'p2', ordinal: 1 } },
    articulo_cable_id: null, senal: 'red', ruta: null, longitud_manual_m: 8, notas: null,
    puerto_origen_id: 'p1', puerto_destino_id: 'p2', puerto_origen_ordinal: 1, puerto_destino_ordinal: 1,
    estado_suministro: 'por_determinar', cable_suministrado_id: null,
  };
  const latiguillo: CableSuministrado = {
    id: 'k1', suministro_id: 'sum', sala_id: 's1', linea_id: 'l', ordinal: 1, tipo: 'unido',
    propietario_equipo_id: 'e1', puerto_fijo_id: 'p1', ordinal_fijo: 1, articulo_cable_id: null,
    longitud_utilizable_m: 11, snapshot: { referencia: 'Cable Ethernet unido' },
  };
  const articulos: Articulo[] = [];
  const m = await montar(createElement(Conexiones, { sala, conexiones: [conexion], equipos, puertos, articulos, latiguillos: [latiguillo] }));
  try {
    const html = m.contenedor.innerHTML;
    assert.match(html, /name="estado_suministro"/);
    assert.match(html, /aria-label="Suministro del cable"/);
    assert.match(html, /name="cable_suministrado_id"/);
    assert.match(html, /Cable Ethernet unido/);
    assert.match(html, /Por determinar/);
    assert.match(html, /Adicional/);
    assert.match(html, /Incluido/);
  } finally { m.desmontar(); }
});

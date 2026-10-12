import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { ajustarALongitudComercial } from './calculo-cable';
import { esquemaDatoTecnico, type DatoTecnico } from './ficha-tecnica';
import { captacionDeVoz, revisarSeleccion, type CatalogoAsistente } from './asistente-equipamiento';
import {
  avisosDeBocas,
  avisosDeCable,
  avisosDeCaptacion,
  avisosDeDocumentacion,
  erroresEstructurales,
  revisarTecnicamente,
  resumirRevisionTecnica,
  type EntradaRevisionTecnica,
  type MetrosDeConexion,
} from './revision-tecnica';
import type { Conexion, EquipoEnSala, Puerto } from './tipos';

const FUENTE_EQ = 'https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/spark-room-kit-series/room-kit-eq-ds.html';

const equipo = (id: string, extra: Partial<EquipoEnSala> & { articulo_id?: string; nombre?: string } = {}): EquipoEnSala => ({
  id,
  sala_id: 's1',
  articulo_id: extra.articulo_id ?? `a-${id}`,
  nombre: extra.nombre ?? id,
  cantidad: 1,
  extremo: 'pantalla',
  posicion: { x_m: 0, y_m: 0, z_m: 0 },
  posicion_confirmada: extra.posicion_confirmada ?? true,
  rotacion_grados: 0,
  toma_red_id: null,
  ...extra,
});

const puerto = (id: string, articulo_id: string, extra: Partial<Puerto> = {}): Puerto => ({
  id, articulo_id, nombre: extra.nombre ?? id, sentido: 'entrada', senal: 'hdmi',
  total: extra.total ?? 1, conector: extra.conector ?? 'HDMI', orden: 1, notas: null, fuente: 'csv',
  ...extra,
});

const conexionCompleta = (
  id: string,
  origen: { equipo_id: string; puerto_id: string; ordinal: number },
  destino: { equipo_id: string; puerto_id: string; ordinal: number },
  extra: Partial<Conexion> = {},
): Conexion => ({
  id,
  sala_id: 's1',
  origen_id: origen.equipo_id,
  destino_id: destino.equipo_id,
  puerto_origen_id: origen.puerto_id,
  puerto_destino_id: destino.puerto_id,
  puerto_origen_ordinal: origen.ordinal,
  puerto_destino_ordinal: destino.ordinal,
  detalle: {
    estado: 'completo',
    origen: { tipo: 'equipo', ...origen },
    destino: { tipo: 'equipo', ...destino },
  },
  articulo_cable_id: 'a-hdmi',
  senal: 'hdmi',
  ruta: null,
  longitud_manual_m: null,
  notas: null,
  etiqueta_cable: extra.etiqueta_cable ?? id,
  ...extra,
});

const conexionHistorica = (
  id: string,
  origenId: string,
  destinoId: string,
  extra: Partial<Conexion> = {},
): Conexion => ({
  id,
  sala_id: 's1',
  origen_id: origenId,
  destino_id: destinoId,
  puerto_origen_id: extra.puerto_origen_id ?? 'p-out',
  puerto_destino_id: extra.puerto_destino_id ?? 'p-in',
  puerto_origen_ordinal: extra.puerto_origen_ordinal ?? null,
  puerto_destino_ordinal: extra.puerto_destino_ordinal ?? null,
  detalle: { estado: 'legacy' },
  articulo_cable_id: 'a-hdmi',
  senal: 'hdmi',
  ruta: null,
  longitud_manual_m: null,
  notas: null,
  etiqueta_cable: extra.etiqueta_cable ?? id,
  ...extra,
});

const catalogoDe = (...filas: Array<[string, { marca: string | null; modelo: string; categoria: string }]>): CatalogoAsistente =>
  new Map(filas);

const hecho = (entrada: Parameters<typeof esquemaDatoTecnico.parse>[0]): DatoTecnico => esquemaDatoTecnico.parse(entrada);

const microfonia = (captacion: 'integrada' | 'externa' | 'desconocida', estado: 'verificado' | 'parcial' | 'sin_documentar' = 'verificado'): DatoTecnico =>
  hecho({
    clave: 'captacion-voz',
    concepto: 'Captación de voz',
    tipo: 'microfonia',
    estado,
    valor: estado === 'sin_documentar' ? null : { captacion },
    fuente: 'csv',
    ...(estado === 'sin_documentar' ? {} : {
      fuente_url: FUENTE_EQ, documento: 'Data Sheet', apartado: 'Audio', consultado_en: '2026-09-08',
    }),
  });

const entrada = (extra: Partial<EntradaRevisionTecnica> = {}): EntradaRevisionTecnica => ({
  salaId: 's1',
  equipos: extra.equipos ?? [equipo('codec', { articulo_id: 'a-codec', nombre: 'CODEC EQ' })],
  conexiones: extra.conexiones ?? [],
  puertos: extra.puertos ?? [],
  catalogo: extra.catalogo ?? catalogoDe(['a-codec', { marca: 'CISCO', modelo: 'CODEC EQ', categoria: 'VIDEOCONFERENCIA' }]),
  hechos: extra.hechos ?? new Map(),
  metros: extra.metros ?? new Map(),
  ...extra,
});

function leerFilasBarra(): Array<Record<string, string>> {
  const texto = readFileSync(new URL('../../data/fichas-tecnicas.csv', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
  const lineas = texto.split(/\r?\n/).filter(Boolean);
  const cabecera = lineas[0].split(';');
  return lineas.slice(1).map((linea) => {
    const celdas = linea.split(';');
    return Object.fromEntries(cabecera.map((h, i) => [h, celdas[i] ?? '']));
  }).filter((f) => f.modelo === 'ROOM BAR PRO' || f.modelo === 'WEBEX ROOM BAR PRO');
}

test('las tres filas CSV de Room Bar Pro validan el esquema y no unifican alias', () => {
  const filas = leerFilasBarra();
  assert.equal(filas.length, 3);
  const parseadas = filas.map((f) => esquemaDatoTecnico.parse({
    clave: f.clave, concepto: f.concepto, tipo: f.tipo, estado: f.estado,
    valor: JSON.parse(f.valor_json), fuente: 'csv',
    fuente_url: f.fuente_url || null, documento: f.documento || null,
    apartado: f.apartado || null, consultado_en: f.consultado_en || null,
  }));
  const barra = parseadas.filter((_, i) => filas[i].modelo === 'ROOM BAR PRO');
  const webex = parseadas.filter((_, i) => filas[i].modelo === 'WEBEX ROOM BAR PRO');
  assert.equal(barra.length, 2);
  assert.equal(webex.length, 1);
  assert.equal(barra.find((h) => h.tipo === 'microfonia')?.estado, 'verificado');
  assert.deepEqual(barra.find((h) => h.tipo === 'microfonia')?.valor, { captacion: 'integrada' });
  assert.equal(barra.find((h) => h.tipo === 'restriccion')?.estado, 'verificado');
  assert.match((barra.find((h) => h.tipo === 'restriccion')?.valor as { texto: string }).texto, /4 m/);
  assert.equal(webex[0].estado, 'sin_documentar');
  assert.equal(webex[0].valor, null);
  assert.notEqual(filas[0].modelo, filas.find((f) => f.modelo === 'WEBEX ROOM BAR PRO')?.modelo);
});

test('kit o Codec EQ sin micro: ausencia con procedencia del hecho CSV, no del nombre', () => {
  const texto = readFileSync(new URL('../../data/fichas-tecnicas.csv', import.meta.url), 'utf8');
  const linea = texto.split(/\r?\n/).find((l) => l.startsWith('CISCO;CODEC EQ;microfonia;'));
  assert.ok(linea);
  const celdas = linea.split(';');
  const hechoCodec = esquemaDatoTecnico.parse({
    clave: celdas[2], concepto: celdas[3], tipo: celdas[4], estado: celdas[5],
    valor: JSON.parse(celdas[6]), fuente: 'csv', fuente_url: celdas[7],
    documento: celdas[8], apartado: celdas[9], consultado_en: celdas[10],
  });
  assert.equal(hechoCodec.estado, 'verificado');
  const referencia = { marca: 'CISCO', modelo: 'CODEC EQ', categoria: 'VIDEOCONFERENCIA' };
  const captacion = captacionDeVoz(referencia, [hechoCodec]);
  assert.equal(captacion.captacion, 'externa');
  assert.equal(captacion.procedencia, 'verificado');
  const avisos = revisarSeleccion(
    [{ articulo_id: 'a-codec', nombre: 'CODEC EQ', cantidad: 1, equipo_id: 'eq1', referencia }],
    undefined,
    new Map([['a-codec', [hechoCodec]]]),
  );
  const ausencia = avisos.find((a) => a.clave.startsWith('captacion_ausente'));
  assert.ok(ausencia);
  assert.equal(ausencia.procedencia, 'verificado');
  assert.equal(ausencia.elemento?.equipo_id, 'eq1');
  assert.ok(ausencia.accion);
});

test('ROOM BAR PRO con hecho integrado y 4 m no exige micro; avisa el límite', () => {
  const hechos = leerFilasBarra().filter((f) => f.modelo === 'ROOM BAR PRO').map((f) => esquemaDatoTecnico.parse({
    clave: f.clave, concepto: f.concepto, tipo: f.tipo, estado: f.estado,
    valor: JSON.parse(f.valor_json), fuente: 'csv',
    fuente_url: f.fuente_url || null, documento: f.documento || null,
    apartado: f.apartado || null, consultado_en: f.consultado_en || null,
  }));
  const referencia = { marca: 'CISCO', modelo: 'ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' };
  const captacion = captacionDeVoz(referencia, hechos);
  assert.equal(captacion.captacion, 'integrada');
  assert.equal(captacion.procedencia, 'verificado');
  assert.match(captacion.restricciones.join(' '), /4 m/);
  const avisos = avisosDeCaptacion(entrada({
    equipos: [equipo('barra', { articulo_id: 'a-bar', nombre: 'ROOM BAR PRO' })],
    catalogo: catalogoDe(['a-bar', { marca: 'CISCO', modelo: 'ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' }]),
    hechos: new Map([['a-bar', hechos]]),
  }));
  assert.equal(avisos.some((a) => a.clave.startsWith('captacion_ausente')), false);
  const limite = avisos.find((a) => a.clave.startsWith('captacion_restringida'));
  assert.ok(limite);
  assert.match(limite.causa, /4 m/);
  assert.ok(limite.accion.texto);
});

test('WEBEX ROOM BAR PRO sin_documentar es desconocida y no hereda integrado', () => {
  const hechos = leerFilasBarra().filter((f) => f.modelo === 'WEBEX ROOM BAR PRO').map((f) => esquemaDatoTecnico.parse({
    clave: f.clave, concepto: f.concepto, tipo: f.tipo, estado: f.estado,
    valor: JSON.parse(f.valor_json), fuente: 'csv',
    fuente_url: f.fuente_url || null, documento: f.documento || null,
    apartado: f.apartado || null, consultado_en: f.consultado_en || null,
  }));
  const referencia = { marca: 'CISCO', modelo: 'WEBEX ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' };
  const captacion = captacionDeVoz(referencia, hechos);
  assert.equal(captacion.captacion, 'desconocida');
  assert.equal(captacion.procedencia, 'sin_documentar');
  const avisos = avisosDeCaptacion(entrada({
    equipos: [equipo('webex', { articulo_id: 'a-webex', nombre: 'WEBEX ROOM BAR PRO' })],
    catalogo: catalogoDe(['a-webex', { marca: 'CISCO', modelo: 'WEBEX ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' }]),
    hechos: new Map([['a-webex', hechos]]),
  }));
  assert.ok(avisos.some((a) => a.clave.startsWith('captacion_desconocida')));
  assert.equal(avisos.some((a) => a.clave.startsWith('captacion_ausente')), false);
  assert.equal(avisos.some((a) => a.clave.startsWith('captacion_restringida')), false);
});

test('modelo no reconocido es desconocida, no ausencia', () => {
  const referencia = { marca: 'CISCO', modelo: 'MODELO INVENTADO', categoria: 'VIDEOCONFERENCIA' };
  assert.equal(captacionDeVoz(referencia).captacion, 'desconocida');
  const avisos = avisosDeCaptacion(entrada({
    equipos: [equipo('x', { articulo_id: 'a-x', nombre: 'MODELO INVENTADO' })],
    catalogo: catalogoDe(['a-x', referencia]),
    hechos: new Map(),
  }));
  assert.ok(avisos.some((a) => a.clave.startsWith('captacion_desconocida')));
  assert.equal(avisos.some((a) => a.clave.startsWith('captacion_ausente')), false);
});

test('videoconferencia duplicada: un aviso, equipo ya seleccionado, no bloquea', () => {
  const kit = { articulo_id: 'a-kit', nombre: 'ROOM KIT EQ', cantidad: 1, equipo_id: 'kit-1',
    referencia: { marca: 'CISCO', modelo: 'ROOM KIT EQ', categoria: 'VIDEOCONFERENCIA' } };
  const candidato = { articulo_id: 'a-bar', nombre: 'ROOM BAR PRO', cantidad: 1,
    referencia: { marca: 'CISCO', modelo: 'ROOM BAR PRO', categoria: 'VIDEOCONFERENCIA' } };
  const avisos = revisarSeleccion([kit], candidato);
  const duplicados = avisos.filter((a) => a.clave === 'videoconferencia_duplicada');
  assert.equal(duplicados.length, 1);
  assert.equal(duplicados[0].elemento?.equipo_id, 'kit-1');
  assert.ok(duplicados[0].accion);
  assert.doesNotMatch(avisos.map((a) => a.mensaje).join(), /referencias repetidas|varias unidades/);
});

test('puerto agotado cuenta boca a boca; histórico sin ordinal es pendiente', () => {
  const codec = equipo('codec', { articulo_id: 'a-codec', nombre: 'CODEC EQ' });
  const pantalla = equipo('tv', { articulo_id: 'a-tv', nombre: 'QB65R' });
  const hdmi = puerto('p-hdmi', 'a-codec', { nombre: 'HDMI outputs', total: 2, sentido: 'salida' });
  const entradaTv = puerto('p-in', 'a-tv', { nombre: 'HDMI IN', total: 2, sentido: 'entrada' });
  const agotado = avisosDeBocas(entrada({
    equipos: [codec, pantalla],
    puertos: [hdmi, entradaTv],
    conexiones: [
      conexionCompleta('c1', { equipo_id: 'codec', puerto_id: 'p-hdmi', ordinal: 1 }, { equipo_id: 'tv', puerto_id: 'p-in', ordinal: 1 }),
      conexionCompleta('c2', { equipo_id: 'codec', puerto_id: 'p-hdmi', ordinal: 2 }, { equipo_id: 'tv', puerto_id: 'p-in', ordinal: 2 }),
    ],
  }));
  const aviso = agotado.find((a) => a.clave === 'bocas_agotadas:codec:p-hdmi');
  assert.ok(aviso);
  assert.equal(aviso.nivel, 'aviso');
  assert.equal(aviso.procedencia, 'verificado');
  assert.match(aviso.causa, /2 de 2/);

  const historica = avisosDeBocas(entrada({
    equipos: [codec, pantalla],
    puertos: [hdmi, entradaTv],
    conexiones: [conexionHistorica('h1', 'codec', 'tv', { puerto_origen_id: 'p-hdmi', puerto_destino_id: 'p-in' })],
  }));
  assert.equal(historica.some((a) => a.clave.startsWith('bocas_agotadas')), false);
  const pendiente = historica.find((a) => a.clave === 'bocas_sin_ordinal:codec:p-hdmi');
  assert.ok(pendiente);
  assert.equal(pendiente.nivel, 'pendiente');
});

test('cable insuficiente no acredita 10 m para 40 m; sin longitud es pendiente', () => {
  const mapaCables = new Map([['a-hdmi', { longitudes_comerciales_m: [1, 2, 3, 5, 10] }]]);
  assert.equal(ajustarALongitudComercial(40, mapaCables.get('a-hdmi')?.longitudes_comerciales_m), 10);
  const c = conexionCompleta(
    'c40',
    { equipo_id: 'codec', puerto_id: 'p-out', ordinal: 1 },
    { equipo_id: 'tv', puerto_id: 'p-in', ordinal: 1 },
    { etiqueta_cable: 'HD-1000' },
  );
  const base = entrada({
    equipos: [equipo('codec', { articulo_id: 'a-codec' }), equipo('tv', { articulo_id: 'a-tv' })],
    conexiones: [c],
    puertos: [puerto('p-out', 'a-codec', { sentido: 'salida' }), puerto('p-in', 'a-tv')],
    metros: new Map<string, MetrosDeConexion>([['c40', { necesarios: 40, comercial: 10 }]]),
  });
  const comercial = avisosDeCable(base);
  const corto = comercial.find((a) => a.clave === 'cable_comercial_insuficiente:c40');
  assert.ok(corto);
  assert.match(corto.causa, /10 m/);
  assert.match(corto.causa, /40 m/);

  const latiguillo = (longitud: number | null) => ({
    id: 'k1', suministro_id: 'sum1', sala_id: 's1', linea_id: 'l1', ordinal: 1, tipo: 'unido' as const,
    propietario_equipo_id: 'codec', puerto_fijo_id: 'p-out', ordinal_fijo: 1,
    articulo_cable_id: null, longitud_utilizable_m: longitud, snapshot: {},
  });
  const incluida = { ...c, estado_suministro: 'incluido' as const, cable_suministrado_id: 'k1' };
  const sinLongitud = avisosDeCable(entrada({
    ...base,
    conexiones: [incluida],
    metros: new Map([['c40', { necesarios: 40, comercial: null }]]),
    cables: [latiguillo(null)],
  }));
  assert.ok(sinLongitud.some((a) => a.clave === 'cable_longitud_pendiente:c40' && a.nivel === 'pendiente'));
  assert.equal(sinLongitud.some((a) => a.clave.startsWith('cable_insuficiente') || a.clave.startsWith('cable_comercial')), false);

  const medido = avisosDeCable(entrada({
    ...base,
    conexiones: [incluida],
    metros: new Map([['c40', { necesarios: 40, comercial: null }]]),
    cables: [latiguillo(11)],
  }));
  const incluido = medido.find((a) => a.clave === 'cable_insuficiente:c40');
  assert.ok(incluido);
  assert.match(incluido.causa, /11 m/);
});

test('ficha ausente, cero conexiones y posición sin confirmar son pendientes, no listo', () => {
  const avisos = [
    ...avisosDeDocumentacion(entrada({
      equipos: [equipo('codec', { articulo_id: 'a-codec', posicion_confirmada: false })],
      conexiones: [],
      hechos: new Map(),
    })),
  ];
  assert.ok(avisos.some((a) => a.clave.startsWith('ficha_sin_documentar') && a.nivel === 'pendiente'));
  assert.ok(avisos.some((a) => a.clave === 'sin_conexiones' && a.nivel === 'pendiente'));
  assert.ok(avisos.some((a) => a.clave === 'posicion_sin_confirmar' && a.nivel === 'pendiente'));
  assert.equal(resumirRevisionTecnica(avisos).estado, 'pendiente');
});

test('un identificador ajeno es error estructural, no aviso de compatibilidad', () => {
  const errores = erroresEstructurales(entrada({
    equipos: [equipo('codec')],
    puertos: [puerto('p1', 'a-codec')],
    conexiones: [conexionCompleta(
      'c-ajeno',
      { equipo_id: 'no-esta', puerto_id: 'p1', ordinal: 1 },
      { equipo_id: 'codec', puerto_id: 'p1', ordinal: 1 },
    )],
  }));
  assert.ok(errores.some((a) => a.clave.includes('estructura_equipo_ajeno') && a.nivel === 'error'));
});

test('revisarTecnicamente junta los seis ensayos sin pintar listo sobre huecos', () => {
  const resultado = revisarTecnicamente(entrada({
    equipos: [equipo('codec', { posicion_confirmada: false })],
    conexiones: [],
    hechos: new Map([['a-codec', [microfonia('externa', 'verificado')]]]),
  }));
  assert.ok(resultado.some((a) => a.clave.startsWith('captacion_ausente')));
  assert.ok(resultado.some((a) => a.clave === 'sin_conexiones'));
  assert.notEqual(resumirRevisionTecnica(resultado).estado, 'listo');
});

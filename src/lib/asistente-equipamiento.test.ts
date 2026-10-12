import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avisosEquipamiento, esMicrofonoDeVoz, funcionEquipo, perfilEquipo, revisarSeleccion, resumenPuertos, type SeleccionAsistente } from './asistente-equipamiento';
import { esquemaDatoTecnico } from './ficha-tecnica';
import type { Puerto } from './tipos';
import { readFileSync } from 'node:fs';

const equipo = (modelo: string, categoria = 'VIDEOCONFERENCIA', cantidad = 1, id = modelo): SeleccionAsistente => ({
  articulo_id: id, nombre: modelo, cantidad, referencia: { marca: 'CISCO', modelo, categoria },
});
const faltaMicro = (equipos: SeleccionAsistente[]) => avisosEquipamiento(equipos).some((a) => a.includes('falta micrófono'));

test('categorías exactas normalizan acentos y espacios sin convertir receptores o controles en micrófonos', () => {
  for (const categoria of ['MICRÓFONO', ' micrófono mesa ', 'MICROFONO TECHO', 'MICRÓFONO DE MESA', 'MICRÓFONO DE TECHO', 'MICROFONÍA', 'MICRO BEAMTRACKING']) {
    assert.equal(funcionEquipo(equipo('x', categoria).referencia), 'microfono');
  }
  for (const categoria of ['BARRA VIDEOCONFERENCIA', 'BARRA DE VIDEOCONFERENCIA', 'VIDEOCONFERENCIA', 'CODEC']) assert.equal(funcionEquipo(equipo('x', categoria).referencia), 'videoconferencia');
  for (const categoria of ['RECEPTOR MICROFONÍA', 'UNIDAD CONTROL MICROFONÍA', 'PANTALLA', 'PANEL TÁCTIL']) assert.equal(funcionEquipo(equipo('x', categoria).referencia), 'otro');
  assert.equal(funcionEquipo(), 'desconocido');
});
test('sala vacía y pantallas solas no generan necesidades de videoconferencia', () => {
  assert.deepEqual(avisosEquipamiento([]), []);
  assert.deepEqual(avisosEquipamiento([equipo('pantalla', 'PANTALLA')]), []);
});
test('equipo sin catálogo señala ausencia de categoría y no adivina por nombre', () => {
  assert.deepEqual(avisosEquipamiento([{ articulo_id: null, nombre: 'Cisco Codec EQ', cantidad: 1 }]), ['Hay equipos sin categoría conocida. No se puede determinar su función.']);
});
test('codec sin ficha señala micrófono desconocido, no exige uno externo', () => {
  assert.equal(faltaMicro([equipo('desconocido')]), false);
  assert.match(avisosEquipamiento([equipo('desconocido')]).join(), /integrado desconocido/);
});
test('Room Bar Pro integrado no exige micro externo y conserva fuente', () => {
  assert.equal(faltaMicro([equipo('ROOM BAR PRO')]), false);
  assert.equal(perfilEquipo(equipo('ROOM BAR PRO').referencia).microfono, 'integrado');
  assert.match(perfilEquipo(equipo('ROOM BAR PRO').referencia).fuente ?? '', /^https:\/\/www.cisco.com\//);
});
test('WEBEX ROOM BAR PRO sin hechos es desconocida y no hereda el integrado', () => {
  assert.equal(perfilEquipo(equipo('WEBEX ROOM BAR PRO').referencia).microfono, 'desconocido');
  assert.equal(faltaMicro([equipo('WEBEX ROOM BAR PRO')]), false);
  assert.match(avisosEquipamiento([equipo('WEBEX ROOM BAR PRO')]).join(), /integrado desconocido/);
  assert.equal(perfilEquipo(equipo('WEBEX ROOM BAR PRO').referencia).fuente, undefined);
});
test('Codec EQ y kit requieren captación de voz aunque la cámara tenga micros de seguimiento', () => {
  for (const modelo of ['CODEC EQ', 'ROOM KIT EQ', 'CISCO ROOM KIT EQ']) assert.equal(faltaMicro([equipo(modelo)]), true);
  assert.match(perfilEquipo(equipo('ROOM KIT EQ').referencia).nota ?? '', /seguimiento/);
  assert.equal(faltaMicro([equipo('CODEC EQ'), equipo('QUAD CAMERA', 'CÁMARA')]), true);
  assert.equal(esMicrofonoDeVoz(equipo('cam', 'MICRO BEAMTRACKING').referencia), false);
  assert.equal(faltaMicro([equipo('CODEC EQ'), equipo('cam', 'MICRO BEAMTRACKING')]), true);
  assert.equal(faltaMicro([equipo('CODEC EQ'), equipo('receptor', 'UNIDAD CONTROL MICROFONÍA')]), true);
});
test('una barra integrada no resuelve por sí sola la captación de otro codec', () => {
  assert.equal(faltaMicro([equipo('ROOM BAR PRO'), equipo('CODEC EQ')]), true);
});
test('micro seleccionado evita falta pero no certifica compatibilidad; receptor no la resuelve', () => {
  const codec = equipo('CODEC EQ');
  const lista = [codec, equipo('micro', 'MICRÓFONO')];
  assert.equal(faltaMicro(lista), false);
  assert.match(avisosEquipamiento(lista).join(), /pendientes de comprobar/);
  assert.equal(faltaMicro([codec, equipo('receptor', 'RECEPTOR MICROFONÍA')]), true);
});
test('EQ ambiguo y variantes ajenas no se equiparan al Codec EQ', () => {
  for (const modelo of ['EQ', 'WEBEX ROOM EQ', 'WEBEX ROOM EQ QUADCAM']) {
    const perfil = perfilEquipo(equipo(modelo).referencia);
    assert.equal(perfil.microfono, 'desconocido');
    assert.match(perfil.nota ?? '', /ambigua/);
  }
  for (const modelo of ['ROOM KIT EQX', 'CODEC EQ PLUS']) assert.equal(perfilEquipo(equipo(modelo).referencia).eq, undefined);
  assert.equal(perfilEquipo({ marca: 'OTRA', modelo: 'CODEC EQ', categoria: 'CODEC' }).microfono, 'desconocido');
});
test('avisa antes de añadir videoconferencia sobre la existente', () => {
  const kit = { ...equipo('ROOM KIT EQ'), equipo_id: 'kit-1' };
  assert.match(avisosEquipamiento([kit], kit).join(), /Ya hay videoconferencia/);
  assert.doesNotMatch(avisosEquipamiento([kit], kit).join(), /referencias repetidas|varias unidades/);
  assert.match(avisosEquipamiento([equipo('ROOM BAR PRO')], equipo('CODEC EQ')).join(), /Ya hay videoconferencia/);
  assert.doesNotMatch(avisosEquipamiento([equipo('pantalla', 'PANTALLA')], equipo('CODEC EQ')).join(), /Ya hay videoconferencia/);
  const avisos = revisarSeleccion([kit], equipo('ROOM BAR PRO'));
  const duplicado = avisos.filter((a) => a.clave === 'videoconferencia_duplicada');
  assert.equal(duplicado.length, 1);
  assert.equal(duplicado[0].elemento?.equipo_id, 'kit-1');
  assert.ok(duplicado[0].accion);
});

test('fuentes CSV declaran un codec independiente con 21 bocas documentadas', () => {
  const catalogo = readFileSync(new URL('../../data/catalogo-equipos.csv', import.meta.url), 'utf8').split(/\r?\n/);
  assert.deepEqual(catalogo.filter((l) => l.includes(';CISCO;CODEC EQ;')), ['VIDEOCONFERENCIA;CISCO;CODEC EQ;;']);
  const puertos = readFileSync(new URL('../../data/puertos.csv', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l.includes(';CODEC EQ;')).map((l) => l.split(';'));
  assert.equal(puertos.length, 10);
  assert.equal(new Set(puertos.map((p) => p[3])).size, 10);
  assert.equal(puertos.reduce((total, p) => total + Number(p[4]), 0), 21);
  assert.equal(puertos.filter((p) => p[6] === 'red').reduce((total, p) => total + Number(p[4]), 0), 5);
  assert.equal(puertos.filter((p) => p[6] === 'hdmi' && p[5] === 'entrada').reduce((total, p) => total + Number(p[4]), 0), 3);
  assert.equal(puertos.filter((p) => p[6] === 'hdmi' && p[5] === 'salida').reduce((total, p) => total + Number(p[4]), 0), 3);
  for (const p of puertos) { assert.equal(p.length, 10); assert.match(p[9], /https:\/\/www.cisco.com\//); }
  assert.equal(puertos.find((p) => p[6] === 'audio_linea')?.[7], '', 'no se inventa el conector de salida de línea');
});

test('ROOM KIT EQ representa exactamente las bocas del codec incluido sin extenderse a variantes ambiguas', () => {
  const filas = readFileSync(new URL('../../data/puertos.csv', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(';'));
  const codec = filas.filter((p) => p[0] === 'CISCO' && p[1] === 'CODEC EQ');
  const kit = filas.filter((p) => p[0] === 'CISCO' && p[1] === 'ROOM KIT EQ');
  assert.equal(codec.length, 10);
  assert.equal(kit.length, 10);
  assert.deepEqual(kit.map((p) => p.slice(2, 9)), codec.map((p) => p.slice(2, 9)), 'mismos nombres, ordinales, sentidos, señales y conectores');
  assert.equal(kit.reduce((total, p) => total + Number(p[4]), 0), 21);
  for (const p of kit) {
    assert.equal(p.length, 10, 'nota compatible con el lector CSV existente');
    assert.match(p[9], /Puertos del Codec EQ incluido\. Cámara\/control se documentan aparte/);
    assert.match(p[9], /room-kit-eq-ds.html/);
  }
  assert.equal(filas.filter((p) => p[0] === 'CISCO' && ['EQ', 'WEBEX ROOM EQ', 'WEBEX ROOM EQ QUADCAM', 'ROOM KIT EQX'].includes(p[1])).length, 0);
});
test('repeticiones por id y cantidad, nunca por un nombre parecido ni por referencias nulas', () => {
  assert.match(avisosEquipamiento([equipo('pantalla', 'PANTALLA', 2)]).join(), /repetidas/);
  assert.match(avisosEquipamiento([equipo('p', 'PANTALLA')], equipo('p', 'PANTALLA')).join(), /repetidas/);
  assert.doesNotMatch(avisosEquipamiento([equipo('p', 'PANTALLA', 1, 'a'), equipo('p', 'PANTALLA', 1, 'b')]).join(), /repetidas/);
  assert.doesNotMatch(avisosEquipamiento([{ articulo_id: null, nombre: 'x', cantidad: 2 }]).join(), /repetidas/);
  assert.match(avisosEquipamiento([equipo('ROOM BAR PRO', 'VIDEOCONFERENCIA', 2)]).join(), /varias unidades/);
});
test('puertos suman total por sentido y señal, filtran artículo y mantienen bidireccional', () => {
  const puerto = (id: string, sentido: Puerto['sentido'], senal: Puerto['senal'], total: number, articulo_id = 'a'): Puerto => ({ id, articulo_id, nombre: id, sentido, senal, total, conector: null, orden: null, notas: null, fuente: 'app' });
  const resumen = resumenPuertos([puerto('1', 'entrada', 'hdmi', 3), puerto('2', 'entrada', 'hdmi', 1), puerto('3', 'salida', 'hdmi', 2), puerto('4', 'bidireccional', 'usb', 4), puerto('5', 'entrada', 'hdmi', 99, 'otro')], 'a');
  assert.deepEqual(resumen, [
    { sentido: 'bidireccional', senal: 'usb', total: 4 },
    { sentido: 'entrada', senal: 'hdmi', total: 4 },
    { sentido: 'salida', senal: 'hdmi', total: 2 },
  ]);
  assert.deepEqual(resumenPuertos([], 'a'), []);
});

test('un hecho CSV verificado manda sobre el reconocimiento por nombre', () => {
  const texto = readFileSync(new URL('../../data/fichas-tecnicas.csv', import.meta.url), 'utf8');
  const linea = texto.split(/\r?\n/).find((l) => l.startsWith('CISCO;CODEC EQ;microfonia;'));
  assert.ok(linea);
  const c = linea.split(';');
  const hecho = esquemaDatoTecnico.parse({
    clave: c[2], concepto: c[3], tipo: c[4], estado: c[5], valor: JSON.parse(c[6]),
    fuente: 'csv', fuente_url: c[7], documento: c[8], apartado: c[9], consultado_en: c[10],
  });
  const codec = equipo('CODEC EQ');
  const avisos = revisarSeleccion([codec], undefined, new Map([[codec.articulo_id!, [hecho]]]));
  const ausencia = avisos.find((a) => a.clave.startsWith('captacion_ausente'));
  assert.equal(ausencia?.procedencia, 'verificado');
});

test('WEBEX ROOM BAR PRO sin_documentar no hereda el integrado de ROOM BAR PRO', () => {
  const hecho = esquemaDatoTecnico.parse({
    clave: 'captacion-voz', concepto: 'Captación de voz', tipo: 'microfonia',
    estado: 'sin_documentar', valor: null, fuente: 'csv',
  });
  const webex = equipo('WEBEX ROOM BAR PRO');
  const avisos = revisarSeleccion([webex], undefined, new Map([[webex.articulo_id!, [hecho]]]));
  assert.ok(avisos.some((a) => a.clave.startsWith('captacion_desconocida')));
  assert.equal(avisos.some((a) => a.clave.startsWith('captacion_ausente')), false);
  assert.equal(avisos.some((a) => a.mensaje.includes('falta micrófono')), false);
});

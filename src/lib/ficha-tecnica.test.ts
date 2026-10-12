import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esquemaDatoTecnico, presentarDatoTecnico } from './ficha-tecnica';

const hecho = { clave: 'microfonia', concepto: 'Captación de voz', tipo: 'microfonia', estado: 'verificado',
  valor: { captacion: 'externa' }, fuente: 'csv', fuente_url: 'https://www.cisco.com/ficha',
  documento: 'Ficha oficial', apartado: 'Audio inputs', consultado_en: '2026-09-08' };
test('los seis tipos aceptan valores propios y conservan datos y procedencia', () => {
  const valores = { microfonia: { captacion: 'integrada' }, alimentacion: { descripcion: '100–240 V CA' },
    poe: { rol: 'pse', vatios: 90, estandar: '802.3bt', compartido: true },
    suministro: { referencia: 'Cable unido CS-MIC-ARRAY-T', cantidad: 1, longitud_m: 11, longitud_aplica: true, incluido: true },
    puerto: { nombre: 'HDMI IN 1', total: 1, sentido: 'entrada', senal: 'hdmi', conector: 'HDMI' },
    restriccion: { texto: 'Usar adaptador suministrado' } };
  for (const [tipo, valor] of Object.entries(valores)) {
    const entrada = { ...hecho, tipo, valor };
    assert.deepEqual(esquemaDatoTecnico.parse(entrada), entrada);
  }
});
test('verificado y parcial exigen valor y procedencia completa', () => {
  for (const estado of ['verificado', 'parcial']) {
    assert.equal(esquemaDatoTecnico.safeParse({ ...hecho, estado }).success, true);
    for (const campo of ['valor', 'fuente_url', 'documento', 'apartado', 'consultado_en']) {
      assert.equal(esquemaDatoTecnico.safeParse({ ...hecho, estado, [campo]: null }).success, false, `${estado}:${campo}`);
    }
  }
});
test('fechas reales distinguen bisiesto, día inexistente y desbordamiento de mes', () => {
  for (const consultado_en of ['0000-01-01', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-09-08T00:00:00Z']) {
    assert.equal(esquemaDatoTecnico.safeParse({ ...hecho, consultado_en }).success, false, consultado_en);
  }
  assert.equal(esquemaDatoTecnico.safeParse({ ...hecho, consultado_en: '2024-02-29' }).success, true);
  assert.equal(esquemaDatoTecnico.safeParse({ ...hecho, consultado_en: '0001-01-01' }).success, true);
});
test('no admite URL ejecutable, HTTP, texto roto o credenciales', () => {
  for (const fuente_url of ['javascript:alert(1)', 'http://example.com', 'invalida', 'https://user:password@example.com', '']) {
    assert.equal(esquemaDatoTecnico.safeParse({ ...hecho, fuente_url }).success, false, fuente_url);
  }
});
test('sin documentar conserva ausencia sin inventar microfonía o compatibilidad', () => {
  const desconocido = esquemaDatoTecnico.parse({ clave: 'microfonia', concepto: 'Captación de voz', tipo: 'microfonia', estado: 'sin_documentar', valor: null, fuente: 'app' });
  assert.equal(presentarDatoTecnico(desconocido), 'Captación de voz: sin documentar');
  assert.equal(esquemaDatoTecnico.safeParse({ ...desconocido, valor: { captacion: 'integrada' } }).success, false);
  assert.equal(esquemaDatoTecnico.safeParse({ ...desconocido, fuente_url: 'javascript:alert(1)' }).success, false);
});
test('rechaza tipos mezclados, cantidades y potencia imposibles y claves vacías', () => {
  const incorrectos = [
    { clave: ' ' }, { concepto: ' ' }, { valor: { captacion: 'compatible' } }, { tipo: 'alimentacion', valor: { captacion: 'integrada' } },
    { tipo: 'suministro', valor: { referencia: 'cable', cantidad: 0, longitud_m: 1, longitud_aplica: true, incluido: true } },
    { tipo: 'suministro', valor: { referencia: 'cable', cantidad: 1.5, longitud_m: 1, longitud_aplica: true, incluido: true } },
    { tipo: 'suministro', valor: { referencia: 'cable', cantidad: 1, longitud_m: 0, longitud_aplica: true, incluido: true } },
    { tipo: 'suministro', valor: { referencia: 'equipo', cantidad: 1, longitud_m: 3, longitud_aplica: false, incluido: true } },
    { tipo: 'poe', valor: { rol: 'pse', vatios: -1, estandar: null, compartido: true } },
    { tipo: 'puerto', valor: { nombre: 'LAN', total: 1.2, sentido: 'entrada', senal: 'red', conector: 'RJ45' } },
  ];
  for (const cambio of incorrectos) assert.equal(esquemaDatoTecnico.safeParse({ ...hecho, ...cambio }).success, false);
});
test('presentación diferencia suministro desconocido de adicional y presupuesto PoE compartido', () => {
  const suministro = esquemaDatoTecnico.parse({ ...hecho, tipo: 'suministro', valor: { referencia: 'Cable', cantidad: 1, longitud_m: null, longitud_aplica: true, incluido: null } });
  assert.equal(presentarDatoTecnico(suministro), '1 × Cable · inclusión desconocida · longitud desconocida');
  const poe = esquemaDatoTecnico.parse({ ...hecho, tipo: 'poe', valor: { rol: 'pse', vatios: 90, estandar: '802.3bt', compartido: true } });
  assert.match(presentarDatoTecnico(poe), /90 W.*presupuesto compartido/);
});

test('HDMI desconocido conserva su concepto', () => {
  const hdmi = esquemaDatoTecnico.parse({ ...hecho, clave: 'hdmi-suministrado', concepto: 'Cable HDMI suministrado',
    tipo: 'suministro', estado: 'sin_documentar', valor: null });
  assert.equal(presentarDatoTecnico(hdmi), 'Cable HDMI suministrado: sin documentar');
});

test('un equipo no crea un falso pendiente de longitud y la clasificación legacy permanece desconocida', () => {
  const equipo = esquemaDatoTecnico.parse({ ...hecho, tipo: 'suministro',
    valor: { referencia: 'CS-CODEC-EQ-K9+', cantidad: 1, incluido: true, longitud_aplica: false, longitud_m: null } });
  assert.equal(presentarDatoTecnico(equipo), '1 × CS-CODEC-EQ-K9+ · incluido');
  const legacy = esquemaDatoTecnico.parse({ ...equipo, estado: 'parcial', valor: { ...equipo.valor, longitud_aplica: null } });
  assert.match(presentarDatoTecnico(legacy), /aplicabilidad de longitud sin documentar/);
});

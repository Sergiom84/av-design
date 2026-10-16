import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { validarPanel, TARJETAS_PANEL } from './preferencias-usuario';
import { resolverPermisos } from './usuarios';
import { urlAgendaPlan } from './planificacion/modelo';
import type { UsuarioSesion } from './sesion-servidor';
import type { SqlPreferencias } from './preferencias-usuario-repositorio';

const anteriores = ['equipos','cables','consumibles','plantillas','salas','almacen','reservas','pedidos','cargas'];
const nuevas = ['agenda_hoy','agenda_semana','agenda_vencidas','agenda_sin_fecha','ocupacion_semana'];
const ahora = new Date('2026-10-15T09:00:00Z');
let llamadas: Array<{ usuarioId: string; filtros: unknown; ahora: Date }> = [];
let preferencias: unknown;
const consultas: string[] = [];
const cargador = Module as unknown as { _load: (s: string, ...args: unknown[]) => unknown };
const original = cargador._load;
let leerPanel: typeof import('./panel-repositorio').leerPanel;
try {
  cargador._load = (s, ...args) => s === './planificacion/servicio' ? { leerAgendaEnLectura: async (
    _conexion: unknown, usuarioId: string, filtros: unknown, fecha: Date,
  ) => {
    llamadas.push({ usuarioId, filtros, ahora: fecha });
    return { contadores: { hoy: 1, semana: 2, vencidas: 3, sin_fecha: 4 }, ocupacion: [{ minutos: 60 }, { minutos: 120 }] };
  } } : s === './preferencias-usuario-repositorio' ? { usuarioPreferenciasActual: async (_c: unknown, yo: UsuarioSesion) => yo }
    : original.call(Module, s, ...args);
  leerPanel = createRequire(import.meta.url)('./panel-repositorio.ts').leerPanel;
} finally { cargador._load = original; }

const conexion = Object.assign(async (consulta: TemplateStringsArray) => {
  consultas.push(consulta.join(''));
  if (consulta.join('').includes('from preferencias_usuario')) return [{ panel: preferencias, version: 7 }];
  // Sólo se necesitan las nueve proyecciones previas en el modo de desarrollo.
  return [{ total: 0, orientativos: 0, sin_precio: 0, sin_medidas: 0, n: 0, borradores: 0 }];
}, { begin: async (_opciones: string, leer: (c: unknown) => Promise<unknown>) => leer(conexion) }) as unknown as SqlPreferencias;

function usuario(ajustes: Parameters<typeof resolverPermisos>[1] = {}, ficticio = false): UsuarioSesion {
  return { id: '00000000-0000-4000-8000-000000000001', usuario: 'fixture', nombre: 'Fixture',
    rol: 'lectura', ficticio, debeCambiarClave: false, permisos: resolverPermisos('lectura', ajustes) };
}
function reiniciar(ocultas = anteriores) {
  llamadas = [];
  consultas.length = 0;
  preferencias = { orden: [...anteriores], ocultas: [...ocultas] };
}

describe('Panel y agenda de montaje comparten alcance y lectura', () => {
  it('conserva las nueve métricas previas, la agenda y el acceso a seguimiento sin escribir preferencias', async () => {
    reiniciar(); const antes = structuredClone(preferencias);
    const panel = await leerPanel(conexion, usuario(), ahora);
    assert.deepEqual(panel.preferencias.orden, [...anteriores, ...nuevas, 'seguimiento_propuestas']);
    assert.deepEqual(panel.tarjetas.map(t => [t.clave, t.valor]), [
      ['agenda_hoy', 1], ['agenda_semana', 2], ['agenda_vencidas', 3], ['agenda_sin_fecha', 4], ['ocupacion_semana', 180],
      ['seguimiento_propuestas', 'Consultar'],
    ]);
    assert.equal(panel.version, 7); assert.deepEqual(preferencias, antes);
    assert.deepEqual(llamadas, [{ usuarioId: usuario().id, filtros: { vista: 'semana' }, ahora }]);
    for (const vista of ['hoy','semana','vencidas','sin_fecha'] as const) {
      assert.equal(panel.tarjetas.find(t => t.clave === `agenda_${vista}`)?.href, urlAgendaPlan({ vista }));
    }
    assert.equal(panel.tarjetas.find(t => t.clave === 'ocupacion_semana')?.href, urlAgendaPlan({ vista: 'semana' }));
  });

  it('ocultar todas las nuevas tarjetas evita incluso llamar al lector de agenda', async () => {
    reiniciar([...anteriores, ...nuevas, 'seguimiento_propuestas']);
    const panel = await leerPanel(conexion, usuario(), ahora);
    assert.equal(panel.tarjetas.length, 0); assert.equal(llamadas.length, 0);
  });

  for (const seccion of ['salas','proyectos'] as const) it(`retirar ${seccion} impide consulta y datos de planificación`, async () => {
    reiniciar();
    const panel = await leerPanel(conexion, usuario({ [seccion]: 'oculto' }), ahora);
    assert.equal(llamadas.length, 0);
    assert(!panel.opciones.some(t => nuevas.includes(t.clave)));
    assert(!panel.tarjetas.some(t => nuevas.includes(t.clave)));
  });

  it('desarrollo conserva sus nueve métricas sin inventar identidad de planificación', async () => {
    reiniciar();
    const panel = await leerPanel(conexion, usuario({}, true), ahora);
    assert.deepEqual(panel.tarjetas.map(t => t.clave), anteriores);
    assert.equal(llamadas.length, 0);
  });

  it('las preferencias se validan y preservan orden y ocultas explícitos', () => {
    const claves = TARJETAS_PANEL.map(t => t.clave);
    const entrada = { orden: [...claves].reverse(), ocultas: claves };
    assert.deepEqual(validarPanel(entrada), entrada);
  });

  it('el acceso a seguimiento no inventa un agregado ni lee propuestas o finanzas', async () => {
    reiniciar([...anteriores, ...nuevas]);
    const panel = await leerPanel(conexion, usuario(), ahora);
    assert.equal(panel.tarjetas.length, 1);
    assert.equal(panel.tarjetas[0].clave, 'seguimiento_propuestas');
    assert.equal(panel.tarjetas[0].valor, 'Consultar');
    assert.equal(panel.tarjetas[0].href, '/propuestas/seguimiento');
    assert.equal(llamadas.length, 0);
    assert.equal(consultas.length, 1);
    assert.match(consultas[0], /from preferencias_usuario/u);
    const oculto = await leerPanel(conexion, usuario({ salas: 'oculto' }), ahora);
    assert.equal(oculto.tarjetas.some(t => t.clave === 'seguimiento_propuestas'), false);
  });
});

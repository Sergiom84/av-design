import { ETIQUETA_SENAL, type Conexion, type EquipoEnSala, type Senal } from './tipos';

/** Geometrías propias de 20 × 20; la misma forma se usa en pantalla y PDF. */
export interface SimboloDiseno { clave: string; nombre: string; forma: string }
const SIMBOLOS: Record<string, SimboloDiseno> = {
  pantalla: { clave: 'pantalla', nombre: 'Pantalla', forma: 'M2 3H18V15H2Z M7 18H13 M10 15V18' },
  camara: { clave: 'camara', nombre: 'Cámara', forma: 'M2 5H14V15H2Z M14 8L19 5V15L14 12 M5 10A3 3 0 1 0 11 10A3 3 0 1 0 5 10' },
  audio: { clave: 'audio', nombre: 'Audio', forma: 'M2 7H6L12 2V18L6 13H2Z M15 6Q20 10 15 14' },
  matriz: { clave: 'matriz', nombre: 'Matriz / procesador', forma: 'M10 1L19 10L10 19L1 10Z M5 10H15 M10 5V15' },
  red: { clave: 'red', nombre: 'Red', forma: 'M6 1H14L19 10L14 19H6L1 10Z M6 7H14V13H6Z' },
  microfono: { clave: 'microfono', nombre: 'Micrófono', forma: 'M7 2H13V12H7Z M4 9V11Q4 16 10 16Q16 16 16 11V9 M10 16V19 M6 19H14' },
  equipo: { clave: 'equipo', nombre: 'Equipo AV', forma: 'M2 2H18V18H2Z M5 6H15 M5 10H15 M5 14H10' },
};
export function simboloPorCategoria(categoria: string | null | undefined): SimboloDiseno {
  const c = (categoria ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/pantalla|display|monitor|proyector/.test(c)) return SIMBOLOS.pantalla;
  if (/camara|camera/.test(c)) return SIMBOLOS.camara;
  if (/microfono|microphone/.test(c)) return SIMBOLOS.microfono;
  if (/altavoz|speaker|audio|amplificador/.test(c)) return SIMBOLOS.audio;
  if (/matriz|matrix|procesador|processor|switcher/.test(c)) return SIMBOLOS.matriz;
  if (/red|network|switch|router/.test(c)) return SIMBOLOS.red;
  return SIMBOLOS.equipo;
}
export const ESTILO_SENAL: Record<Senal, { color: string; trazo: string }> = {
  hdmi: { color: '#3669d9', trazo: '' }, red: { color: '#298d74', trazo: '8 3' },
  usb: { color: '#7c3aed', trazo: '3 3' }, audio_linea: { color: '#b45309', trazo: '10 3 2 3' },
  audio_altavoz: { color: '#0e7490', trazo: '12 4' }, microfono: { color: '#be185d', trazo: '2 4' },
  alimentacion: { color: '#b3261e', trazo: '14 3 3 3' }, control: { color: '#57606f', trazo: '6 3 2 3' },
  otro: { color: '#57606f', trazo: '1 3' },
};
export function leyendaDiseno(equipos: EquipoEnSala[], conexiones: Conexion[], categoriaPorArticulo = new Map<string, string>()) {
  const simbolos = [...new Map(equipos.map(e => { const s = simboloPorCategoria(categoriaPorArticulo.get(e.articulo_id)); return [s.clave, s]; })).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const senales = [...new Set(conexiones.map(c => c.senal))].sort().map(senal => ({ senal, etiqueta: ETIQUETA_SENAL[senal], ...ESTILO_SENAL[senal] }));
  return { simbolos, senales };
}

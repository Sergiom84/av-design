import PDFDocument from 'pdfkit';
import { construirEscena, type EscenaCroquis, type Proyeccion } from '../croquis';
import { construirAcotaciones, type ElevacionSala } from '../acotaciones';
import { construirDiagrama, trazarLineaDiagrama, MEDIDAS_DIAGRAMA, type EscenaDiagrama } from '../diagrama';
import { cajaDelEquipo, cajaDelMueble, caminoDeTirada } from '../../components/croquis/plano-sala';
import { etiquetaRevisionDiseno, type OpcionesPdf, type SalaExportada, type SnapshotExportacion } from './modelo';
import type { Senal } from '../tipos';
import { ESTILO_SENAL, leyendaDiseno, simboloPorCategoria, type SimboloDiseno } from '../presentacion-diagrama';

type DocumentoPdf = 'plano' | 'elevaciones' | 'esquema';
type Doc = InstanceType<typeof PDFDocument>;
interface Zona { x: number; y: number; ancho: number; alto: number }
export interface PaginaMosaico extends Zona { columna: number; fila: number; columnas: number; filas: number }
interface Pagina { titulo: string; escala: string; notas: string[]; pintar: (doc: Doc, zona: Zona) => void }
export interface MaquetacionPdf {
  ancho: number;
  alto: number;
  zona: Zona;
  altoCabecera: number;
  altoNotas: number;
  cajetin: { y: number; alto: number; filaIdentidad: number; filaMetadatos: number; anchoColumna: number };
}
const MM = 72 / 25.4;
const MARGEN = 12 * MM;
const SOLAPE = 12 * MM;
const COLOR = Object.fromEntries(Object.entries(ESTILO_SENAL).map(([s, estilo]) => [s, estilo.color])) as Record<Senal, string>;
const metros = (n: number) => `${n.toFixed(2).replace('.', ',')} m`;
// Las fuentes PDF base cubren los acentos españoles; los símbolos de UI no son datos.
const textoPdf = (s: string) => s.replaceAll('→', '->').replace(/[−–—]/g, '-');

/** La escala física se expresa en puntos de papel por metro, nunca se ajusta al papel. */
export function puntosPorMetro(escala: OpcionesPdf['escala']): number { return 1000 * MM / escala; }

export function papelPdf(opciones: OpcionesPdf): { ancho: number; alto: number; zona: Zona } {
  const corto = (opciones.papel === 'A4' ? 210 : 297) * MM;
  const largo = (opciones.papel === 'A4' ? 297 : 420) * MM;
  const ancho = opciones.orientacion === 'horizontal' ? largo : corto;
  const alto = opciones.orientacion === 'horizontal' ? corto : largo;
  return { ancho, alto, zona: { x: MARGEN, y: MARGEN + 34, ancho: ancho - 2 * MARGEN, alto: alto - 2 * MARGEN - 144 } };
}

function camposCajetin(snapshot: SnapshotExportacion, exportada: SalaExportada) {
  const fecha = new Date(snapshot.creadoEn).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  return {
    obra: `OBRA: ${snapshot.proyecto?.nombre ?? 'Sala sin obra (legado)'}\nCódigo: ${snapshot.proyecto?.codigo ?? 'Sin código'}`,
    sala: `SALA: ${exportada.sala.nombre}\nCódigo: ${exportada.sala.codigo ?? 'Sin código'}`,
    snapshot: `Snapshot: ${snapshot.revision}\nFecha: ${fecha}${exportada.revisionDiseno ? `\nDiseño: ${etiquetaRevisionDiseno(exportada)}` : ''}`,
  };
}

/** Se reserva el texto real antes de paginar. Ningún nombre válido invade otra celda. */
export function maquetarPdf(snapshot: SnapshotExportacion, exportada: SalaExportada, tipo: DocumentoPdf, opciones: OpcionesPdf): MaquetacionPdf {
  const { ancho, alto } = papelPdf(opciones);
  const anchoUtil = ancho - 2 * MARGEN;
  const anchoColumna = anchoUtil / 2;
  const medidor = new PDFDocument({ autoFirstPage: false });
  const medir = (valor: string, anchura: number, tamano: number) => {
    medidor.font('Helvetica').fontSize(tamano);
    return medidor.heightOfString(textoPdf(valor), { width: anchura, lineGap: 1, paragraphGap: 0 });
  };
  const campos = camposCajetin(snapshot, exportada);
  const filaIdentidad = Math.max(35, medir(campos.obra, anchoColumna - 12, 8) + 12, medir(campos.sala, anchoColumna - 12, 8) + 12);
  // El límite de páginas es 200; se reserva la variante más larga antes de
  // saber cuántas hojas necesita la zona útil resultante.
  const muestraPagina = `${opciones.papel} ${opciones.orientacion} | Escala Sin escala\nPágina 200 de 200 | Versión sala ${exportada.sala.diagrama_version}`;
  const filaMetadatos = Math.max(35, medir(campos.snapshot, anchoColumna - 12, 7) + 12, medir(muestraPagina, anchoColumna - 12, 7) + 12);
  const titulos = tipo === 'esquema'
    ? ['Esquema de conexiones - conjunto', 'Conexiones y ausencias (200/200)', ...exportada.equipos.map((e) => `Puertos - E200 - ${e.nombre} 200 (200/200)`)]
    : tipo === 'elevaciones'
      ? ['Lateral izquierda · Oeste - mosaico 200,200 de 200x200', 'Lateral izquierda · Oeste - referencias (200/200)', 'Elevaciones - faltan medidas']
      : ['Plano en planta - mosaico 200,200 de 200x200', 'Equipos, cotas y ausencias (200/200)', 'Plano - faltan medidas'];
  const altoCabecera = Math.max(34, 14 + Math.max(...titulos.map((t) => medir(t, anchoUtil, 12))) + 8);
  // Las notas son textos editoriales fijos; se mide la variante física más larga.
  const notas = 'Imprimir al 100 %. Solape de hojas: 12 mm. Símbolos AV convencionales; cotas en metros. Trazo discontinuo: posición estimada, pendiente de medir. E1, E2...: referencias de la relación de equipos.';
  const altoNotas = Math.max(40, medir(notas, anchoUtil, 7) + 16);
  const altoCajetin = filaIdentidad + filaMetadatos;
  const cajetinY = alto - MARGEN - altoCajetin;
  const zona = { x: MARGEN, y: MARGEN + altoCabecera, ancho: anchoUtil, alto: cajetinY - altoNotas - MARGEN - altoCabecera };
  if (zona.alto < 100) throw new Error('Los textos del cajetín o del encabezado no dejan espacio para el documento. Elige un papel mayor o acorta esos textos.');
  return { ancho, alto, zona, altoCabecera, altoNotas, cajetin: { y: cajetinY, alto: altoCajetin, filaIdentidad, filaMetadatos, anchoColumna } };
}

/** Mosaico con solape físico constante. La última página no cambia la escala. */
export function paginasMosaico(ancho: number, alto: number, zona: Pick<Zona, 'ancho' | 'alto'>): PaginaMosaico[] {
  const columnas = Math.max(1, Math.ceil((ancho - SOLAPE) / (zona.ancho - SOLAPE)));
  const filas = Math.max(1, Math.ceil((alto - SOLAPE) / (zona.alto - SOLAPE)));
  return Array.from({ length: filas * columnas }, (_, i) => ({
    x: (i % columnas) * (zona.ancho - SOLAPE), y: Math.floor(i / columnas) * (zona.alto - SOLAPE),
    ancho: zona.ancho, alto: zona.alto, columna: i % columnas + 1, fila: Math.floor(i / columnas) + 1, columnas, filas,
  }));
}

function texto(doc: Doc, valor: string, x: number, y: number, ancho: number, tamano = 8, alineacion: 'left' | 'center' | 'right' = 'left') {
  doc.font('Helvetica').fontSize(tamano).fillColor('#182336');
  const contenido = textoPdf(valor);
  const altura = doc.heightOfString(contenido, { width: ancho, lineGap: 1, paragraphGap: 0 });
  // PDFKit pagina el texto contra la coordenada lógica, antes de translate.
  // En un mosaico esa coordenada puede superar el papel aunque esté dentro
  // del recorte visible. Una caja explícita evita páginas automáticas sin cajetín.
  doc.text(contenido, x, y, { width: ancho, height: altura + 1, align: alineacion, lineGap: 1, paragraphGap: 0 });
}
function linea(doc: Doc, x1: number, y1: number, x2: number, y2: number, color = '#697489', grosor = .6) {
  doc.strokeColor(color).lineWidth(grosor).moveTo(x1, y1).lineTo(x2, y2).stroke();
}

/** Los literales que no caben en una fila remiten a su ficha íntegra. */
function rotuloDeResumen(doc: Doc, valor: string, referencia: string, ancho: number, tamano: number): string {
  doc.font('Helvetica').fontSize(tamano);
  return !/[\r\n]/.test(valor) && doc.widthOfString(textoPdf(valor)) <= ancho ? valor : referencia;
}
const referenciaPuerto = (fila: { puerto_id: string; ordinal: number }) => `P${fila.puerto_id.slice(-4)}.${fila.ordinal}`;

function trazoSenal(doc: Doc, senal: Senal) {
  const trazo = ESTILO_SENAL[senal].trazo;
  // PDFKit acepta el patrón completo; sus tipos publicados sólo declaran número.
  if (trazo) (doc.dash as unknown as (patron: number[], opciones: object) => Doc).call(doc, trazo.split(' ').map(Number), {});
  else doc.undash();
}
function pintarSimbolo(doc: Doc, simbolo: SimboloDiseno, x: number, y: number, tamano = 14, color = '#182336') {
  doc.save().translate(x, y).scale(tamano / 20).path(simbolo.forma).lineWidth(1.4).stroke(color).restore();
}

function proyeccionMetrica(escena: EscenaCroquis, escala: number): Proyeccion {
  const margen = 54;
  const ancho = escena.sala.largo_m * escala + margen * 2;
  const alto = escena.sala.ancho_m * escala + margen * 2;
  const p: Proyeccion = {
    viewBox: `0 0 ${ancho} ${alto}`, ancho_px: ancho, alto_px: alto, escala,
    x: (m) => margen + m * escala, y: (m) => margen + (escena.sala.ancho_m - m) * escala,
    d: (m) => m * escala, aMetrosX: (p) => (p - margen) / escala,
    aMetrosY: (p) => escena.sala.ancho_m - (p - margen) / escala,
  };
  // Un mueble arrimado o girado puede sobresalir del recinto. Se amplía el
  // lienzo del documento, sin recortar la geometría ni cambiar su escala.
  const cajas: Array<{x:number;y:number;ancho:number;alto:number;giro:number;cx:number;cy:number}> = [
    ...escena.equipos.map((e) => ({ ...cajaDelEquipo(p, escena, e), giro: -e.rotacion_grados, cx: p.x(e.x_m), cy: p.y(e.y_m) })),
    ...escena.muebles.map((m) => ({ ...cajaDelMueble(p, m), giro: -m.rotacion_grados, cx: p.x(m.x_m), cy: p.y(m.y_m) })),
    ...(escena.mesa ? [{ x: p.x(escena.mesa.x_m), y: p.y(escena.mesa.y_m + escena.mesa.ancho_m), ancho: p.d(escena.mesa.largo_m), alto: p.d(escena.mesa.ancho_m), giro: -escena.mesa.rotacion_grados, cx: p.x(escena.mesa.centro.x_m), cy: p.y(escena.mesa.centro.y_m) }] : []),
    ...escena.sillas.map((s) => ({ x: p.x(s.x_m) - p.d(s.radio_m), y: p.y(s.y_m) - p.d(s.radio_m), ancho: p.d(s.radio_m * 2), alto: p.d(s.radio_m * 2), giro: 0, cx: p.x(s.x_m), cy: p.y(s.y_m) })),
  ];
  const puntos = cajas.flatMap((c) => {
    const rad = c.giro * Math.PI / 180;
    return [[c.x,c.y],[c.x+c.ancho,c.y],[c.x,c.y+c.alto],[c.x+c.ancho,c.y+c.alto]].map(([x,y]) => ({
      x: c.cx + (x-c.cx) * Math.cos(rad) - (y-c.cy) * Math.sin(rad),
      y: c.cy + (x-c.cx) * Math.sin(rad) + (y-c.cy) * Math.cos(rad),
    }));
  });
  const desplazamientoX = -Math.min(0, ...puntos.map((v) => v.x - 12));
  const desplazamientoY = -Math.min(0, ...puntos.map((v) => v.y - 12));
  const anchoTotal = Math.max(ancho, ...puntos.map((v) => v.x + 12)) + desplazamientoX;
  const altoTotal = Math.max(alto, ...puntos.map((v) => v.y + 12)) + desplazamientoY;
  return { ...p, ancho_px: anchoTotal, alto_px: altoTotal, viewBox: `0 0 ${anchoTotal} ${altoTotal}`,
    x: (m) => p.x(m) + desplazamientoX, y: (m) => p.y(m) + desplazamientoY,
    aMetrosX: (px) => p.aMetrosX(px - desplazamientoX), aMetrosY: (px) => p.aMetrosY(px - desplazamientoY),
  };
}

/** Solo los rótulos se mantienen enteros en una hoja del mosaico. Las medidas no se desplazan. */
interface RotuloSituado { x: number; y: number; minimoY: number; maximoY: number }
function rotulosDelMosaico(doc: Doc, mosaico: PaginaMosaico) {
  const ocupadas: Zona[] = [];
  const pendientes: Array<{ valor: string; x: number; y: number; ancho: number; situada?: RotuloSituado; tamano: number }> = [];
  return {
    reservar: (caja: Zona) => ocupadas.push(caja),
    rotular: (valor: string, x: number, y: number, ancho = 100, situada?: RotuloSituado, tamano = 7) => pendientes.push({ valor, x, y, ancho, situada, tamano }),
    pintar: () => {
      for (const r of pendientes) {
        if (r.x < mosaico.x || r.x > mosaico.x + mosaico.ancho || r.y < mosaico.y || r.y > mosaico.y + mosaico.alto) continue;
        doc.font('Helvetica').fontSize(r.tamano);
        const ancho = Math.min(r.ancho, doc.widthOfString(textoPdf(r.valor)) + 8, mosaico.ancho - 8);
        const alto = doc.heightOfString(textoPdf(r.valor), { width: ancho, lineGap: 1 });
        const situar = (dx: number, dy: number): Zona => ({
          x: Math.max(mosaico.x + 4, Math.min((r.situada?.x ?? r.x - ancho / 2) + dx, mosaico.x + mosaico.ancho - ancho - 4)),
          y: Math.max(r.situada?.minimoY ?? mosaico.y + 4, Math.min((r.situada?.y ?? r.y - alto) + dy, r.situada?.maximoY ?? mosaico.y + mosaico.alto - alto - 4)),
          ancho, alto,
        });
        const libre = (caja: Zona) => !ocupadas.some(c => caja.x < c.x + c.ancho + 3 && caja.x + caja.ancho + 3 > c.x && caja.y < c.y + c.alto + 3 && caja.y + caja.alto + 3 > c.y);
        const inicial = situar(0, 0);
        let caja = inicial;
        for (let paso = 0; paso < 20; paso++) {
          const distancia = paso * (alto + 4);
          const candidata = [situar(0, -distancia), situar(0, distancia), situar(-distancia, 0), situar(distancia, 0)].find(libre);
          if (candidata) { caja = candidata; break; }
        }
        if (caja.x !== inicial.x || caja.y !== inicial.y) linea(doc, r.x, r.y, caja.x + caja.ancho / 2, caja.y + caja.alto, '#a8b2c1', .35);
        // Si una escena muy densa agota los candidatos, el texto no borra
        // geometría medida con un fondo opaco.
        const sinSolape = libre(caja);
        ocupadas.push(caja);
        if (sinSolape) doc.rect(caja.x, caja.y, caja.ancho, caja.alto).fill('#ffffff');
        texto(doc, r.valor, caja.x, caja.y, caja.ancho, r.tamano, r.situada ? 'left' : 'center');
      }
    },
  };
}

function pintarPlanta(doc: Doc, escena: EscenaCroquis, p: Proyeccion, mosaico: PaginaMosaico, categorias: Map<string, string>) {
  const rotulos = rotulosDelMosaico(doc, mosaico);
  const reservar = (caja: Zona, giro = 0, ancla = { x: caja.x, y: caja.y }) => {
    const rad = giro * Math.PI / 180;
    const puntos = [[caja.x, caja.y], [caja.x + caja.ancho, caja.y], [caja.x, caja.y + caja.alto], [caja.x + caja.ancho, caja.y + caja.alto]]
      .map(([x, y]) => ({ x: ancla.x + (x - ancla.x) * Math.cos(rad) - (y - ancla.y) * Math.sin(rad),
        y: ancla.y + (x - ancla.x) * Math.sin(rad) + (y - ancla.y) * Math.cos(rad) }));
    const x = Math.min(...puntos.map(punto => punto.x)), y = Math.min(...puntos.map(punto => punto.y));
    rotulos.reservar({ x, y, ancho: Math.max(...puntos.map(punto => punto.x)) - x, alto: Math.max(...puntos.map(punto => punto.y)) - y });
  };
  doc.lineWidth(1).strokeColor('#182336').rect(p.x(0), p.y(escena.sala.ancho_m), p.d(escena.sala.largo_m), p.d(escena.sala.ancho_m)).stroke();
  const mesa = escena.mesa;
  if (mesa) {
    reservar({ x: p.x(mesa.x_m), y: p.y(mesa.y_m + mesa.ancho_m), ancho: p.d(mesa.largo_m), alto: p.d(mesa.ancho_m) },
      -mesa.rotacion_grados, { x: p.x(mesa.centro.x_m), y: p.y(mesa.centro.y_m) });
    doc.save().rotate(-mesa.rotacion_grados, { origin: [p.x(mesa.centro.x_m), p.y(mesa.centro.y_m)] });
    doc.rect(p.x(mesa.x_m), p.y(mesa.y_m + mesa.ancho_m), p.d(mesa.largo_m), p.d(mesa.ancho_m)).fillAndStroke('#f1f4f8', '#182336').restore();
  }
  for (const silla of escena.sillas) {
    const radio = p.d(silla.radio_m);
    reservar({ x: p.x(silla.x_m) - radio, y: p.y(silla.y_m) - radio, ancho: 2 * radio, alto: 2 * radio });
    doc.circle(p.x(silla.x_m), p.y(silla.y_m), radio).stroke('#697489');
  }
  for (const mueble of escena.muebles) {
    const caja = cajaDelMueble(p, mueble);
    reservar(caja, -mueble.rotacion_grados, { x: p.x(mueble.x_m), y: p.y(mueble.y_m) });
    doc.save().rotate(-mueble.rotacion_grados, { origin: [p.x(mueble.x_m), p.y(mueble.y_m)] }).lineWidth(.6).strokeColor('#697489');
    if (mueble.forma === 'circulo') {
      doc.circle(p.x(mueble.x_m), p.y(mueble.y_m), Math.min(caja.ancho, caja.alto) / 2).stroke();
      linea(doc, caja.x, caja.y, caja.x + caja.ancho, caja.y);
    } else doc.rect(caja.x, caja.y, caja.ancho, caja.alto).stroke();
    doc.restore();
  }
  for (const tirada of escena.tiradas) {
    doc.save(); trazoSenal(doc, tirada.senal);
    doc.path(caminoDeTirada(p, tirada)).lineWidth(.8).stroke(COLOR[tirada.senal]); doc.restore();
    if (tirada.metros != null) rotulos.rotular(metros(tirada.metros), p.x(tirada.hasta.x_m), p.y(tirada.hasta.y_m) + 13, 60);
  }
  escena.equipos.forEach((equipo, i) => {
    const caja = cajaDelEquipo(p, escena, equipo);
    reservar(caja, -equipo.rotacion_grados, { x: p.x(equipo.x_m), y: p.y(equipo.y_m) });
    doc.save().rotate(-equipo.rotacion_grados, { origin: [p.x(equipo.x_m), p.y(equipo.y_m)] });
    if (equipo.estimada) doc.dash(3, { space: 2 });
    doc.lineWidth(.7).rect(caja.x, caja.y, caja.ancho, caja.alto).fillAndStroke(equipo.estimada ? '#edf1f8' : '#61708a', '#182336').restore();
    const tamanoSimbolo = Math.max(3, Math.min(12, caja.ancho - 2, caja.alto - 2));
    reservar({ x: caja.x + 1, y: caja.y + 1, ancho: tamanoSimbolo, alto: tamanoSimbolo });
    pintarSimbolo(doc, simboloPorCategoria(categorias.get(equipo.id)), caja.x + 1, caja.y + 1, tamanoSimbolo);
    rotulos.rotular(`E${i + 1}${equipo.estimada ? ' (estimado)' : ''}`, caja.x + caja.ancho / 2, caja.y - 3);
  });
  for (const toma of escena.tomas) {
    reservar({ x: p.x(toma.x_m) - 3, y: p.y(toma.y_m) - 3, ancho: 6, alto: 6 });
    doc.rect(p.x(toma.x_m) - 3, p.y(toma.y_m) - 3, 6, 6).lineWidth(.8).stroke('#3669d9');
    rotulos.rotular(toma.codigo, p.x(toma.x_m), p.y(toma.y_m) + 16);
  }
  for (const puerta of escena.puertas) {
    const ax = p.x(puerta.desde.x_m), ay = p.y(puerta.desde.y_m), bx = p.x(puerta.hasta.x_m), by = p.y(puerta.hasta.y_m);
    if (!puerta.medida) {
      reservar({ x: ax - 4, y: ay - 4, ancho: 8, alto: 8 });
      doc.save().dash(3, { space: 2 }).rect(ax - 4, ay - 4, 8, 8).stroke('#b3261e').restore();
      rotulos.rotular('Puerta sin medir', ax, ay - 8);
      continue;
    }
    linea(doc, ax, ay, bx, by, '#ffffff', 3);
    const dx = puerta.pared === 'oeste' ? 1 : puerta.pared === 'este' ? -1 : 0;
    const dy = puerta.pared === 'sur' ? -1 : puerta.pared === 'norte' ? 1 : 0;
    const longitud = Math.hypot(bx - ax, by - ay);
    const puntosX = [ax, bx, ax + dx * longitud], puntosY = [ay, by, ay + dy * longitud];
    reservar({ x: Math.min(...puntosX), y: Math.min(...puntosY), ancho: Math.max(...puntosX) - Math.min(...puntosX), alto: Math.max(...puntosY) - Math.min(...puntosY) });
    linea(doc, ax, ay, ax + dx * longitud, ay + dy * longitud, '#182336', .8);
    // La misma hoja y barrido del plano, sin convertir una puerta desconocida en medida.
    const barrido = puerta.pared === 'sur' || puerta.pared === 'este' ? 1 : 0;
    doc.save().dash(2, { space: 2 }).path(`M ${bx} ${by} A ${longitud} ${longitud} 0 0 ${barrido} ${ax + dx * longitud} ${ay + dy * longitud}`).stroke('#697489').restore();
  }
  for (const cota of escena.cotas) {
    const estimada = cota.clave === 'pantalla_caja' && escena.equipos.some((e) => e.estimada && (e.extremo === 'pantalla' || e.extremo === 'caja_conexiones'));
    const dx = cota.lado === 'izquierda' ? -22 : cota.lado === 'derecha' ? 22 : 0;
    const dy = cota.lado === 'arriba' ? -22 : cota.lado === 'abajo' ? 22 : 0;
    const x1 = p.x(cota.desde.x_m) + dx, y1 = p.y(cota.desde.y_m) + dy;
    const x2 = p.x(cota.hasta.x_m) + dx, y2 = p.y(cota.hasta.y_m) + dy;
    doc.save();
    if (estimada) doc.dash(3, { space: 2 });
    linea(doc, x1, y1, x2, y2);
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      if (dx) linea(doc, x - 3, y, x + 3, y); else linea(doc, x, y - 3, x, y + 3);
    }
    doc.restore();
    rotulos.rotular(`${estimada ? 'Estimada: ' : ''}${cota.texto}`, (x1 + x2) / 2, (y1 + y2) / 2 + (dx ? 0 : dy > 0 ? 15 : -3), estimada ? 100 : 70);
  }
  rotulos.pintar();
}

function pintarElevacion(doc: Doc, vista: ElevacionSala, escala: number, mosaico: PaginaMosaico, categorias: Map<string, string>) {
  const rotulos = rotulosDelMosaico(doc, mosaico);
  const x = (m: number) => 54 + m * escala, y = (m: number) => 54 + (vista.alto_m - m) * escala;
  doc.rect(x(0), y(vista.alto_m), vista.ancho_m * escala, vista.alto_m * escala).lineWidth(1).stroke('#182336');
  for (const puerta of vista.puertas) {
    if (puerta.anchura_m != null && puerta.altura_m != null) {
      doc.rect(x(puerta.desde_m), y(puerta.altura_m), puerta.anchura_m * escala, puerta.altura_m * escala).fillAndStroke('#f8f9fc', '#697489');
      rotulos.rotular(`${metros(puerta.anchura_m)} x ${metros(puerta.altura_m)}`, x(puerta.desde_m + puerta.anchura_m / 2), y(puerta.altura_m) - 5, 120);
    } else {
      doc.save().dash(3, { space: 2 }).rect(x(puerta.desde_m) - 4, y(0) - 8, 8, 8).stroke('#b3261e').restore();
      rotulos.rotular('Puerta sin medir', x(puerta.desde_m), y(0) - 12);
    }
  }
  vista.puntos.forEach((punto, i) => {
    doc.save().dash(2, { space: 3 }); linea(doc, x(punto.horizontal_m), y(0), x(punto.horizontal_m), y(punto.altura_m)); doc.restore();
    if (punto.tipo === 'equipo') pintarSimbolo(doc, simboloPorCategoria(categorias.get(punto.id)), x(punto.horizontal_m) - 6, y(punto.altura_m) - 6, 12);
    else doc.circle(x(punto.horizontal_m), y(punto.altura_m), 3).fill('#3669d9');
    const valor = `${punto.tipo === 'toma' ? 'R' : 'E'}${i + 1}: z ${metros(punto.altura_m)}`;
    const px = x(punto.horizontal_m), py = y(punto.altura_m);
    rotulos.reservar({ x: px - 6, y: py - 6, ancho: 12, alto: 12 });
    if (px >= mosaico.x && px <= mosaico.x + mosaico.ancho && py >= mosaico.y && py <= mosaico.y + mosaico.alto) {
      doc.font('Helvetica').fontSize(7);
      const ancho = Math.min(doc.widthOfString(textoPdf(valor)) + 2, mosaico.ancho - 8);
      const rotulo = ubicarRotuloElevacion({ x: px, y: py }, ancho, mosaico, { techo: y(vista.alto_m), suelo: y(0) });
      rotulos.rotular(valor, px, py, ancho, { ...rotulo, minimoY: Math.max(mosaico.y + 4, y(vista.alto_m) + 4), maximoY: Math.min(mosaico.y + mosaico.alto - 12, y(0) - 11) });
    }
  });
  linea(doc, x(0), y(0) + 22, x(vista.ancho_m), y(0) + 22);
  rotulos.rotular(metros(vista.ancho_m), x(vista.ancho_m / 2), y(0) + 38, 72);
  linea(doc, 26, y(0), 26, y(vista.alto_m));
  rotulos.rotular(metros(vista.alto_m), 26, y(vista.alto_m / 2), 50);
  rotulos.pintar();
}

/** El rótulo se aparta del símbolo; la coordenada medida permanece intacta. */
export function ubicarRotuloElevacion(punto: { x: number; y: number }, ancho: number, mosaico: Zona, pared: { techo: number; suelo: number }) {
  const derecha = punto.x + 9;
  const izquierda = punto.x - ancho - 9;
  const x = derecha + ancho <= mosaico.x + mosaico.ancho - 4 ? derecha : izquierda;
  const superior = Math.max(mosaico.y + 4, pared.techo + 4);
  const inferior = Math.min(mosaico.y + mosaico.alto - 12, pared.suelo - 11);
  return {
    x: Math.max(mosaico.x + 4, Math.min(x, mosaico.x + mosaico.ancho - ancho - 4)),
    y: Math.max(superior, Math.min(punto.y - 4, inferior)),
  };
}

/** Las posiciones guardadas del editor son presentación, y no sustituyen a XYZ. */
export function escenaEsquemaExportada(snapshot: SnapshotExportacion, exportada: SalaExportada): EscenaDiagrama & { desplazamiento: { x: number; y: number } } {
  const porArticulo = new Map<string, typeof exportada.puertos>();
  for (const puerto of exportada.puertos) porArticulo.set(puerto.articulo_id, [...(porArticulo.get(puerto.articulo_id) ?? []), puerto]);
  const escena = construirDiagrama({
    equipos: exportada.equipos, conexiones: exportada.conexiones, puertosPorArticulo: porArticulo, soloConectados: false,
    descripcionArticulo: new Map(snapshot.articulos.map((a) => [a.id, [a.marca, a.modelo].filter(Boolean).join(' ')])),
    categoriaArticulo: new Map(snapshot.articulos.map((a) => [a.id, a.categoria ?? ''])),
  });
  const originales = new Map(escena.bloques.map((b) => [b.equipo_id, b]));
  const bloques = escena.bloques.map((b) => {
    const posicion = exportada.posicionesEsquema[b.equipo_id];
    if (!posicion) return b;
    const deltaY = posicion.y - b.y;
    return { ...b, x: posicion.x, y: posicion.y, entradas: b.entradas.map((f) => ({ ...f, y: f.y + deltaY })), salidas: b.salidas.map((f) => ({ ...f, y: f.y + deltaY })) };
  });
  const nuevos = new Map(bloques.map((b) => [b.equipo_id, b]));
  const conexiones = new Map(exportada.conexiones.map((c) => [c.id, c]));
  const lineas = escena.lineas.map((l, indice) => {
    const c = conexiones.get(l.conexion_id)!;
    const a = originales.get(c.origen_id)!, b = originales.get(c.destino_id)!;
    const aa = nuevos.get(c.origen_id)!, bb = nuevos.get(c.destino_id)!;
    const p1 = { x: l.puntos[0].x + aa.x - a.x, y: l.puntos[0].y + aa.y - a.y };
    const ultimo = l.puntos.at(-1)!;
    const p2 = { x: ultimo.x + bb.x - b.x, y: ultimo.y + bb.y - b.y };
    return { ...l, ...trazarLineaDiagrama(aa, bb, p1, p2, indice + 1) };
  });
  // Margen para muñones, categorías y rótulos: la escena original reserva solo 24 px.
  const visuales = (exportada.anotacionesDiseno ?? []).filter((a) => a.ancla_tipo === 'visual' && a.x != null && a.y != null);
  const minX = Math.min(0, ...bloques.map((b) => b.x - 40), ...lineas.flatMap((l) => l.puntos.map((p) => p.x - 40)), ...visuales.map((a) => a.x! - 20));
  const minY = Math.min(0, ...bloques.map((b) => b.y - 20), ...lineas.flatMap((l) => l.puntos.map((p) => p.y - 20)), ...visuales.map((a) => a.y! - 32));
  return {
    ...escena,
    desplazamiento: { x: -minX + 16, y: -minY + 16 },
    bloques: bloques.map((b) => ({ ...b, x: b.x - minX + 16, y: b.y - minY + 16, entradas: b.entradas.map((f) => ({ ...f, y: f.y - minY + 16 })), salidas: b.salidas.map((f) => ({ ...f, y: f.y - minY + 16 })) })),
    lineas: lineas.map((l) => ({ ...l, puntos: l.puntos.map((p) => ({ x: p.x - minX + 16, y: p.y - minY + 16 })), etiqueta_x: l.etiqueta_x - minX + 16, etiqueta_y: l.etiqueta_y - minY + 16 })),
    ancho: Math.max(80, ...bloques.map((b) => b.x + b.ancho + 56), ...lineas.flatMap((l) => l.puntos.map((p) => p.x + 56)), ...visuales.map((a) => a.x! + 56)) - minX,
    alto: Math.max(80, ...bloques.map((b) => b.y + b.alto + 36), ...lineas.flatMap((l) => l.puntos.map((p) => p.y + 36)), ...visuales.map((a) => a.y! + 36)) - minY,
  };
}

interface Llamada { etiqueta: string; x: number; y: number }
function llamadasEsquema(exportada: SalaExportada, escena: ReturnType<typeof escenaEsquemaExportada>): Llamada[] {
  return (exportada.anotacionesDiseno ?? []).flatMap((a, i) => {
    const etiqueta = `N${i + 1}`;
    if (a.ancla_tipo === 'equipo') {
      const b = escena.bloques.find((b) => b.equipo_id === a.ancla_id);
      return b ? [{ etiqueta, x: b.x + b.ancho + 20, y: b.y + 8 }] : [];
    }
    if (a.ancla_tipo === 'conexion') {
      const l = escena.lineas.find((l) => l.conexion_id === a.ancla_id);
      return l ? [{ etiqueta, x: l.etiqueta_x + 16, y: l.etiqueta_y + 10 }] : [];
    }
    if (a.ancla_tipo === 'visual' && a.x != null && a.y != null) {
      return [{ etiqueta, x: a.x + escena.desplazamiento.x, y: a.y + escena.desplazamiento.y }];
    }
    return [];
  });
}
function pintarEsquema(doc: Doc, escena: EscenaDiagrama, zona: Zona, factor = Math.min(zona.ancho / escena.ancho, zona.alto / escena.alto, 1), llamadas: Llamada[] = [], mosaico?: PaginaMosaico) {
  doc.save().translate(zona.x, zona.y).scale(factor);
  const rotulos = mosaico ? rotulosDelMosaico(doc, mosaico) : null;
  for (const b of escena.bloques) {
    rotulos?.reservar({ x: b.x, y: b.y - 16, ancho: b.ancho, alto: b.alto + 16 });
    for (const [filas, izquierda] of [[b.entradas, true], [b.salidas, false]] as const) for (const f of filas) {
      const borde = izquierda ? b.x : b.x + b.ancho, fuera = borde + (izquierda ? -26 : 26);
      rotulos?.reservar({ x: Math.min(borde, fuera) - 3, y: f.y - 3, ancho: 32, alto: 6 });
      if (f.conector) rotulos?.reservar({ x: Math.min(borde, fuera) - 7, y: f.y - 13, ancho: 40, alto: 9 });
    }
  }
  for (const llamada of llamadas) rotulos?.reservar({ x: llamada.x - 10, y: llamada.y - 10, ancho: 20, alto: 20 });
  for (const l of escena.lineas) {
    doc.save(); trazoSenal(doc, l.senal);
    l.puntos.forEach((p, i) => { if (i === 0) doc.moveTo(p.x, p.y); else doc.lineTo(p.x, p.y); });
    doc.lineWidth(1).stroke(COLOR[l.senal]); doc.restore();
    if (rotulos) rotulos.rotular(l.identificador, l.etiqueta_x, l.etiqueta_y - 3, 64, undefined, 8);
    else texto(doc, l.identificador, l.etiqueta_x - 32, l.etiqueta_y - 11, 64, 8, 'center');
  }
  for (const [indice, b] of escena.bloques.entries()) {
    const referencia = `E${indice + 1}`;
    doc.roundedRect(b.x, b.y, b.ancho, b.alto, 5).lineWidth(1).fillAndStroke('#ffffff', '#182336');
    if (b.categoria) texto(doc, rotuloDeResumen(doc, b.categoria, `Categoría: ficha ${referencia}`, b.ancho, 9), b.x, b.y - 14, b.ancho, 9);
    const pie = b.y + b.alto - MEDIDAS_DIAGRAMA.alto_pie;
    linea(doc, b.x, pie, b.x + b.ancho, pie);
    pintarSimbolo(doc, simboloPorCategoria(b.categoria), b.x + 6, pie + 4);
    texto(doc, rotuloDeResumen(doc, b.etiqueta, `Equipo ${referencia}: ficha de puertos`, b.ancho - 29, 8), b.x + 24, pie + 4, b.ancho - 29, 8, 'center');
    if (b.marca_modelo && b.marca_modelo !== b.etiqueta) texto(doc, rotuloDeResumen(doc, b.marca_modelo, `Marca y modelo: ficha ${referencia}`, b.ancho - 10, 7.5), b.x + 5, pie + 17, b.ancho - 10, 7.5, 'center');
    for (const [filas, izquierda] of [[b.entradas, true], [b.salidas, false]] as const) {
      for (const f of filas) {
        const borde = izquierda ? b.x : b.x + b.ancho, fuera = borde + (izquierda ? -26 : 26);
        linea(doc, borde, f.y, fuera, f.y, f.conectado ? COLOR[f.senal] : '#697489');
        if (f.conectado) doc.circle(fuera, f.y, 2).fill(COLOR[f.senal]);
        // El índice remite al literal completo de la ficha de puertos cuando es largo.
        const nombre = rotuloDeResumen(doc, f.nombre, referenciaPuerto(f), b.ancho / 2 - 7, 7.5);
        texto(doc, nombre, izquierda ? b.x + 7 : b.x + b.ancho / 2, f.y - 4, b.ancho / 2 - 7, 7.5, izquierda ? 'left' : 'right');
        if (f.conector) texto(doc, rotuloDeResumen(doc, f.conector, referenciaPuerto(f), 40, 6), Math.min(borde, fuera) - 7, f.y - 13, 40, 6, izquierda ? 'left' : 'right');
      }
    }
  }
  for (const llamada of llamadas) {
    doc.circle(llamada.x, llamada.y, 10).fillAndStroke('#ffffff', '#182336');
    texto(doc, llamada.etiqueta, llamada.x - 10, llamada.y - 3.5, 20, 7.5, 'center');
  }
  rotulos?.pintar();
  doc.restore();
}

/** Hojas de detalle a tamaño constante: los puertos nunca se reducen al ajustar una matriz. */
export function mosaicosEsquema(escena: Pick<EscenaDiagrama, 'ancho' | 'alto'>, zona: Pick<Zona, 'ancho' | 'alto'>): PaginaMosaico[] {
  if (escena.ancho <= zona.ancho && escena.alto <= zona.alto) return [];
  return paginasMosaico(escena.ancho, escena.alto, zona);
}

function paginasEsquemaDetalle(escena: EscenaDiagrama, zona: Zona, llamadas: Llamada[]): Pagina[] {
  return mosaicosEsquema(escena, zona).map((mosaico) => ({
    titulo: `Esquema - detalle ${mosaico.columna},${mosaico.fila} de ${mosaico.columnas}x${mosaico.filas}`,
    escala: 'Sin escala', notas: ['Detalle a tamaño de lectura constante. Solape: 12 mm. Las coordenadas son visuales; no representan metros.'],
    pintar: (doc, area) => {
      doc.save().rect(area.x, area.y, area.ancho, area.alto).clip();
      pintarEsquema(doc, escena, { ...area, x: area.x - mosaico.x, y: area.y - mosaico.y }, 1, llamadas, mosaico);
      doc.restore();
      doc.rect(area.x, area.y, area.ancho, area.alto).lineWidth(.3).stroke('#d6dde8');
    },
  }));
}

/** Listados complementarios legibles: no se pierde un literal largo por adaptar el dibujo. */
function paginasListado(titulo: string, filas: string[], zona: Zona, escala = 'Sin escala'): Pagina[] {
  if (filas.length === 0) return [];
  // Se mide con el mismo motor/fuente que pinta, antes de conocer el total de páginas.
  const medidor = new PDFDocument({ autoFirstPage: false });
  medidor.font('Helvetica').fontSize(8);
  const grupos: string[][] = [[]];
  let usado = 0;
  for (const fila of filas) {
    const alto = medidor.heightOfString(textoPdf(fila), { width: zona.ancho - 12, lineGap: 1 }) + 10;
    if (alto > zona.alto) throw new Error('Una etiqueta supera una página de texto; acorta ese texto para exportarlo.');
    if (usado + alto > zona.alto && grupos.at(-1)!.length) { grupos.push([]); usado = 0; }
    grupos.at(-1)!.push(fila); usado += alto;
  }
  return grupos.map((grupo, i) => ({ titulo: `${titulo}${grupos.length > 1 ? ` (${i + 1}/${grupos.length})` : ''}`, escala, notas: [], pintar: (doc, area) => {
    let y = area.y;
    for (const fila of grupo) {
      doc.font('Helvetica').fontSize(8);
      const alto = doc.heightOfString(textoPdf(fila), { width: area.ancho - 12, lineGap: 1 });
      texto(doc, fila, area.x + 6, y, area.ancho - 12);
      y += alto + 10;
    }
  } }));
}

function paginasFisicas(titulo: string, ancho: number, alto: number, zona: Zona, escala: number, notas: string[], pintar: (doc: Doc, mosaico: PaginaMosaico) => void): Pagina[] {
  return paginasMosaico(ancho, alto, zona).map((mosaico) => ({
    titulo: `${titulo}${mosaico.columnas * mosaico.filas > 1 ? ` - mosaico ${mosaico.columna},${mosaico.fila} de ${mosaico.columnas}x${mosaico.filas}` : ''}`,
    escala: `1:${escala}`, notas: [`Imprimir al 100 %. Solape de hojas: 12 mm. Símbolos AV convencionales; cotas en metros.`, ...notas],
    pintar: (doc, area) => {
      doc.save().rect(area.x, area.y, area.ancho, area.alto).clip().translate(area.x - mosaico.x, area.y - mosaico.y);
      pintar(doc, mosaico); doc.restore();
      doc.rect(area.x, area.y, area.ancho, area.alto).lineWidth(.3).stroke('#d6dde8');
    },
  }));
}

function construirPaginas(snapshot: SnapshotExportacion, exportada: SalaExportada, tipo: DocumentoPdf, opciones: OpcionesPdf, zona: Zona): Pagina[] {
  const escala = puntosPorMetro(opciones.escala);
  if (tipo === 'plano') {
    const escena = construirEscena({ ...exportada, sala: exportada.sala, muebles: exportada.muebles, metrosPorConexion: new Map(exportada.resultadosCable.map((r) => [r.conexion_id, r.longitud_m])) });
    const faltaMedida = !(escena.sala.largo_m > 0 && escena.sala.ancho_m > 0);
    const avisos = [...escena.avisos, ...exportada.tomas.filter((t) => t.x_m == null || t.y_m == null).map((t) => `Roseta ${t.codigo}: sin posición medida.`)];
    const paginas: Pagina[] = faltaMedida ? [{ titulo: 'Plano - faltan medidas', escala: 'Sin escala', notas: [], pintar: (doc, area) => texto(doc, 'Faltan el largo o el ancho de la sala. No se presenta una planta a escala ni se inventan medidas.', area.x, area.y + 12, area.ancho, 12) }] : (() => {
      const p = proyeccionMetrica(escena, escala);
      const categorias = new Map(exportada.equipos.map((e) => [e.id, snapshot.articulos.find((a) => a.id === e.articulo_id)?.categoria ?? '']));
      return paginasFisicas('Plano en planta', p.ancho_px, p.alto_px, zona, opciones.escala, ['Trazo discontinuo: posición estimada, pendiente de medir. E1, E2...: referencias de la relación de equipos.'], (doc, mosaico) => pintarPlanta(doc, escena, p, mosaico, categorias));
    })();
    const referencias = escena.equipos.map((e, i) => `E${i + 1} | ${e.nombre} | ${e.estimada ? 'POSICIÓN ESTIMADA, pendiente de medir' : 'Posición medida'} | x ${metros(e.x_m)}; y ${metros(e.y_m)}; z ${metros(e.z_m)}`);
    const anotaciones = escena.anotaciones.map((a) => {
      const e = escena.equipos.find((e) => a.clave === `equipo_altura:${e.id}`);
      return `${e?.estimada ? 'ALTURA ESTIMADA, pendiente de medir: ' : ''}${a.texto}`;
    });
    return [...paginas, ...paginasListado('Equipos, cotas y ausencias', [...avisos.map((s) => `AVISO: ${s}`), ...referencias, ...anotaciones], zona)];
  }
  if (tipo === 'elevaciones') {
    const escena = construirAcotaciones(exportada);
    const categorias = new Map(exportada.equipos.map((e) => [e.id, snapshot.articulos.find((a) => a.id === e.articulo_id)?.categoria ?? '']));
    const avisos = [
      ...(escena.equiposSinPosicion ? [`${escena.equiposSinPosicion} equipos sin posición medida: no se proyectan en las elevaciones.`] : []),
      ...(escena.tomasSinPosicion ? [`${escena.tomasSinPosicion} rosetas sin posición/altura completa: no se proyectan.`] : []),
    ];
    if (escena.sinMedidas) return [{ titulo: 'Elevaciones - faltan medidas', escala: 'Sin escala', notas: [], pintar: (doc, area) => texto(doc, ['Faltan largo, ancho o altura de sala. No se presentan elevaciones a escala.', ...avisos].join('\n\n'), area.x, area.y + 12, area.ancho, 12) }];
    return escena.elevaciones.flatMap((vista) => [
      ...paginasFisicas(vista.titulo, vista.ancho_m * escala + 108, vista.alto_m * escala + 108, zona, opciones.escala, ['Solo se representan posiciones confirmadas. E/R: referencias de la relación de esta elevación.'], (doc, mosaico) => pintarElevacion(doc, vista, escala, mosaico, categorias)),
      ...paginasListado(`${vista.titulo} - referencias`, [...avisos, ...vista.puntos.map((p, i) => `${p.tipo === 'toma' ? 'R' : 'E'}${i + 1} | ${p.etiqueta} | horizontal ${metros(p.horizontal_m)}; altura ${metros(p.altura_m)}`), ...vista.puertas.filter((p) => p.anchura_m == null || p.altura_m == null).map((p) => `Puerta ${p.id}: anchura o altura sin medir.`)], zona),
    ]);
  }
  const escena = escenaEsquemaExportada(snapshot, exportada);
  const llamadas = llamadasEsquema(exportada, escena);
  const avisos = [
    ...(exportada.conexiones.length === 0 ? ['Sin conexiones registradas.'] : []),
    ...(escena.omitidas ? [`${escena.omitidas} conexiones sin dibujar: falta un equipo extremo en esta sala.`] : []),
    ...exportada.filasCable.flatMap((fila) => fila.avisos.map((aviso) => `${fila.identificador}: ${aviso}`)),
  ];
  const resumen: Pagina = { titulo: 'Esquema de conexiones - conjunto', escala: 'Sin escala', notas: ['Todos los equipos, puertos y señales. Los detalles y literales completos figuran en las hojas siguientes. N1, N2...: anotaciones del diseño.'], pintar: (doc, area) => pintarEsquema(doc, escena, area, undefined, llamadas) };
  const fichas = escena.bloques.flatMap((b, indice) => paginasListado(`Puertos - E${indice + 1} - ${b.etiqueta}`, [
    `E${indice + 1} | ${b.etiqueta}${b.marca_modelo ? ` | ${b.marca_modelo}` : ''}${b.categoria ? ` | ${b.categoria}` : ''}`,
    ...b.entradas.map((f) => `${referenciaPuerto(f)} | ENTRADA | ${f.nombre} | ${f.conector ?? 'Sin conector definido'} | ${f.conectado ? 'Conectado' : 'Sin cable'}`),
    ...b.salidas.map((f) => `${referenciaPuerto(f)} | SALIDA / BIDIRECCIONAL | ${f.nombre} | ${f.conector ?? 'Sin conector definido'} | ${f.conectado ? 'Conectado' : 'Sin cable'}`),
    ...(!b.entradas.length && !b.salidas.length ? ['Sin puertos en el catálogo.'] : []),
  ], zona));
  return [resumen, ...paginasEsquemaDetalle(escena, zona, llamadas), ...paginasListado('Conexiones y ausencias', [...avisos.map((a) => `AVISO: ${a}`), ...exportada.filasCable.map((fila) => `${fila.identificador} | ${fila.origen} (${fila.puerto_origen ?? 'Sin puerto'}) -> ${fila.destino} (${fila.puerto_destino ?? 'Sin puerto'})`)], zona), ...fichas];
}

function paginasIdentidadYNotas(exportada: SalaExportada, zona: Zona): Pagina[] {
  const r = exportada.revisionDiseno;
  const identidad = r ? [
    etiquetaRevisionDiseno(exportada), `SHA-256 del diseño: ${r.hash}`,
    ...(r.id ? [`ID revisión: ${r.id}`, `Autor: ${r.autor ?? 'Sin autor registrado'} | Fecha (UTC): ${r.creadoEn ?? 'Sin fecha registrada'}`] : []),
    ...(r.antecedente ? [`Antecedente: revisión ${r.antecedente.numero}: ${r.antecedente.nombre} (${r.antecedente.id})`] : []),
    ...(r.heredadaDe ? [`Medidas heredadas de sala ${r.heredadaDe.salaId}; revisión ${r.heredadaDe.revisionId}. La herencia no acredita una visita de campo.`] : []),
  ] : [];
  const notas = (exportada.anotacionesDiseno ?? []).map((a, i) => {
    const equipo = a.ancla_tipo === 'equipo' ? exportada.equipos.find((e) => e.id === a.ancla_id)?.nombre : null;
    const cable = a.ancla_tipo === 'conexion' ? exportada.filasCable.find((c) => c.conexion_id === a.ancla_id)?.identificador : null;
    const ancla = a.ancla_tipo === 'sala' ? exportada.sala.nombre : a.ancla_tipo === 'visual'
      ? `Coordenada visual (${a.x}, ${a.y}); sin escala física` : equipo ?? cable ?? a.ancla_id ?? 'Sala';
    return `N${i + 1} | ${ancla} | ${a.texto}`;
  });
  return [...paginasListado('Identidad y antecedentes del diseño', identidad, zona), ...paginasListado('Anotaciones del diseño', notas, zona)];
}

function paginasLeyenda(snapshot: SnapshotExportacion, exportada: SalaExportada, zona: Zona): Pagina[] {
  const leyenda = leyendaDiseno(exportada.equipos, exportada.conexiones,
    new Map(snapshot.articulos.map((a) => [a.id, a.categoria ?? ''])));
  if (!leyenda.simbolos.length && !leyenda.senales.length) return [];
  const filas: Array<{ simbolo?: SimboloDiseno; senal?: Senal; etiqueta: string }> = [
    ...leyenda.simbolos.map((simbolo) => ({ simbolo, etiqueta: simbolo.nombre })),
    ...leyenda.senales.map((senal) => ({ senal: senal.senal, etiqueta: senal.etiqueta })),
  ];
  const porPagina = Math.max(1, Math.floor((zona.alto - 10) / 28));
  const total = Math.ceil(filas.length / porPagina);
  return Array.from({ length: total }, (_, i) => ({ titulo: `Leyenda del diseño${total > 1 ? ` (${i + 1}/${total})` : ''}`, escala: 'Sin escala',
    notas: ['Símbolos geométricos propios de AV_design. Forma, trazo y texto identifican el tipo y la señal; el color es una ayuda adicional.'],
    pintar: (doc, area) => {
      let y = area.y + 5;
      for (const fila of filas.slice(i * porPagina, (i + 1) * porPagina)) {
        if (fila.simbolo) pintarSimbolo(doc, fila.simbolo, area.x + 8, y, 18);
        if (fila.senal) {
          doc.save(); trazoSenal(doc, fila.senal);
          linea(doc, area.x + 8, y + 10, area.x + 32, y + 10, ESTILO_SENAL[fila.senal].color, 1.2); doc.restore();
        }
        texto(doc, fila.etiqueta, area.x + 40, y + 5, area.ancho - 48, 9); y += 28;
      }
    } }));
}

/** PDF vectorial de una única lectura coherente; no accede a BD ni escribe estado de sala. */
export async function generarPdfTecnico(snapshot: SnapshotExportacion, exportada: SalaExportada, tipo: DocumentoPdf, opciones: OpcionesPdf): Promise<Uint8Array> {
  if (!snapshot.salas.some((s) => s.sala.id === exportada.sala.id)) throw new Error('La sala no pertenece al snapshot exportado.');
  const { ancho, alto, zona, cajetin } = maquetarPdf(snapshot, exportada, tipo, opciones);
  const paginas = [...construirPaginas(snapshot, exportada, tipo, opciones, zona), ...paginasIdentidadYNotas(exportada, zona),
    ...(exportada.revisionDiseno || exportada.anotacionesDiseno ? paginasLeyenda(snapshot, exportada, zona) : [])];
  // Límite determinista: una escala/papel imposible debe fallar por documento, no agotar el servidor.
  if (paginas.length > 200) throw new Error('El documento supera 200 páginas. Elige un papel mayor o una escala 1:50 / 1:100.');
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, compress: true, info: {
    Title: `${tipo} - ${exportada.sala.nombre}`, Author: 'Departamento de Audiovisuales', Subject: `Snapshot ${snapshot.revision}`, CreationDate: new Date(snapshot.creadoEn),
  } });
  const salida = new Promise<Uint8Array>((resolve, reject) => {
    const partes: Buffer[] = []; doc.on('data', (parte: Buffer) => partes.push(parte)); doc.on('end', () => resolve(new Uint8Array(Buffer.concat(partes)))); doc.on('error', reject);
  });
  paginas.forEach((pagina, i) => {
    doc.addPage({ size: [ancho, alto], margin: 0 });
    doc.rect(0, 0, ancho, alto).fill('#ffffff');
    texto(doc, 'AV / DOCUMENTACIÓN TÉCNICA', MARGEN, MARGEN, ancho - 2 * MARGEN, 8);
    texto(doc, pagina.titulo, MARGEN, MARGEN + 14, ancho - 2 * MARGEN, 12);
    pagina.pintar(doc, zona);
    texto(doc, pagina.notas.join(' '), MARGEN, zona.y + zona.alto + 8, zona.ancho, 7);
    const cajetinY = cajetin.y;
    doc.rect(MARGEN, cajetinY, ancho - 2 * MARGEN, cajetin.alto).lineWidth(.7).stroke('#182336');
    const columna = cajetin.anchoColumna;
    const campos = camposCajetin(snapshot, exportada);
    linea(doc, MARGEN + columna, cajetinY, MARGEN + columna, cajetinY + cajetin.alto);
    texto(doc, campos.obra, MARGEN + 6, cajetinY + 6, columna - 12, 8);
    texto(doc, campos.sala, MARGEN + columna + 6, cajetinY + 6, columna - 12, 8);
    const separadorY = cajetinY + cajetin.filaIdentidad;
    linea(doc, MARGEN, separadorY, ancho - MARGEN, separadorY);
    texto(doc, campos.snapshot, MARGEN + 6, separadorY + 6, columna - 12, 7);
    texto(doc, `${opciones.papel} ${opciones.orientacion} | Escala ${pagina.escala}\nPágina ${i + 1} de ${paginas.length} | Versión sala ${exportada.sala.diagrama_version}`, MARGEN + columna + 6, separadorY + 6, columna - 12, 7);
  });
  doc.end();
  return salida;
}

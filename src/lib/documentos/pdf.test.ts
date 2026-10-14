import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inflateSync } from 'node:zlib';
import { generarPdfTecnico, escenaEsquemaExportada, maquetarPdf, paginasMosaico, papelPdf, puntosPorMetro } from './pdf';
import type { OpcionesPdf, SalaExportada, SnapshotExportacion } from './modelo';
import { PARAMETROS_POR_DEFECTO, type Sala, type EquipoEnSala } from '../tipos';

function fixture(): { snapshot: SnapshotExportacion; exportada: SalaExportada } {
  const sala: Sala = {
    id: 's', nombre: 'PRUEBA-DOC-01 - Sala con acentos', codigo: 'DOC-01', sede_id: null, localizacion_id: null,
    tipologia: 'Reunión', aforo: 2, plantilla_id: null, largo_m: 6, ancho_m: 4, alto_m: 3,
    alto_falso_techo_m: null, alto_canaleta_m: null, alto_suelo_tecnico_m: null, ruta_por_defecto: 'directo',
    notas: null, mesa_largo_m: 2, mesa_ancho_m: 1, mesa_alto_cm: 73, mesa_x_m: 3, mesa_y_m: 2,
    mesa_rotacion_grados: 30, diagrama_version: 7, sillas_modo: 'derivadas',
  };
  const equipo = (id: string, nombre: string, confirmado: boolean): EquipoEnSala => ({
    id, nombre, sala_id: 's', articulo_id: id, cantidad: 1, extremo: 'pared',
    posicion: { x_m: 2, y_m: 1, z_m: 1.2 }, posicion_confirmada: confirmado, rotacion_grados: 0,
  });
  const exportada: SalaExportada = {
    sala, equipos: [equipo('e1', 'Pantalla', true), equipo('e2', 'Micrófono estimado', false)],
    muebles: [], puertas: [], tomas: [], conexiones: [], puertos: [], resultadosCable: [], filasCable: [], reservas: [], posicionesEsquema: {},
  };
  const snapshot: SnapshotExportacion = { revision: 'DOC-PRUEBA-DOC-01-7', creadoEn: '2026-10-13T12:00:00.000Z',
    proyecto: { id: 'p', nombre: 'PRUEBA-DOC-01 - Obra', codigo: '131026_1' }, salas: [exportada], articulos: [],
    parametros: PARAMETROS_POR_DEFECTO, disponibilidad: [],
  };
  return { snapshot, exportada };
}
const opciones: OpcionesPdf = { papel: 'A4', orientacion: 'horizontal', escala: 50 };

function contenidoPdf(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const texto = buffer.toString('latin1');
  const streams: string[] = [];
  const regex = /stream\r?\n/g;
  for (const inicio of texto.matchAll(regex)) {
    const desde = inicio.index! + inicio[0].length;
    const hasta = texto.indexOf('\nendstream', desde);
    if (hasta < 0) continue;
    try { streams.push(inflateSync(buffer.subarray(desde, hasta)).toString('latin1')); } catch { /* Metadatos no comprimidos. */ }
  }
  return streams.join('\n');
}

describe('PDF técnico: papel, escala física y mosaico', () => {
  it('1 metro ocupa exactamente 20 mm a 1:50, sea cual sea el papel', () => {
    assert.equal(puntosPorMetro(50), 20 * 72 / 25.4);
    for (const papel of ['A4', 'A3'] as const) for (const orientacion of ['horizontal', 'vertical'] as const) {
      const forma = papelPdf({ papel, orientacion, escala: 50 });
      assert.ok(forma.zona.ancho > 400 && forma.zona.alto > 300);
      assert.equal(forma.ancho > forma.alto, orientacion === 'horizontal');
    }
  });

  it('el mosaico cubre hasta el último punto sin cambiar su escala y con solape', () => {
    const zona = { ancho: 500, alto: 400 };
    const hojas = paginasMosaico(1350, 950, zona);
    assert.equal(hojas.length, 9);
    assert.ok(hojas.at(-1)!.x + zona.ancho >= 1350);
    assert.ok(hojas.at(-1)!.y + zona.alto >= 950);
    assert.ok(hojas[1].x < zona.ancho);
    assert.equal(hojas[3].columna, 1);
  });

  it('el PDF realmente escribe una sala de 6x4 a 1:50 en puntos físicos', async () => {
    const { snapshot, exportada } = fixture();
    const antes = JSON.stringify(snapshot);
    const bytes = await generarPdfTecnico(snapshot, exportada, 'plano', opciones);
    assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
    const contenido = contenidoPdf(bytes);
    // PDFKit redondea la operación vectorial a seis decimales, sin ajuste a página.
    assert.match(contenido, /54 54 340\.15748\d* 226\.77165\d* re/);
    assert.match(Buffer.from(bytes).toString('latin1'), /\/Count 2\b/);
    assert.equal(JSON.stringify(snapshot), antes, 'Exportar no puede mutar ni ordenar in situ el diseño.');
  });

  it('papel grande mantiene la misma longitud dibujada a igual escala', async () => {
    const { snapshot, exportada } = fixture();
    for (const papel of ['A4', 'A3'] as const) for (const orientacion of ['horizontal', 'vertical'] as const) {
      const pdf = await generarPdfTecnico(snapshot, exportada, 'plano', { papel, orientacion, escala: 50 });
      assert.match(contenidoPdf(pdf), /340\.15748\d* 226\.77165\d* re/);
    }
  });

  it('el texto del mosaico no crea páginas automáticas sin cajetín al superar la altura lógica del papel', async () => {
    const { snapshot, exportada } = fixture();
    const pdf = await generarPdfTecnico(snapshot, exportada, 'plano', { ...opciones, escala: 20 });
    // Cuatro hojas de dibujo a escala y una relación. PDFKit debe obedecerlas.
    assert.match(Buffer.from(pdf).toString('latin1'), /\/Count 5\b/);
  });

  it('ausencia de medidas genera advertencia y no una planta física falsa', async () => {
    const { snapshot, exportada } = fixture();
    exportada.sala.largo_m = 0;
    const pdf = await generarPdfTecnico(snapshot, exportada, 'plano', opciones);
    assert.doesNotMatch(contenidoPdf(pdf), /54 54 340\.15748\d* 226\.77165\d* re/);
    assert.ok(pdf.length > 1000);
  });

  it('una escala imposible devuelve un error por documento antes de generar cientos de hojas', async () => {
    const { snapshot, exportada } = fixture();
    exportada.sala.largo_m = 200;
    exportada.sala.ancho_m = 200;
    await assert.rejects(generarPdfTecnico(snapshot, exportada, 'plano', { ...opciones, escala: 20 }), /200 páginas/);
  });

  it('rechaza una sala que no forma parte de la lectura exportada', async () => {
    const { snapshot, exportada } = fixture();
    await assert.rejects(generarPdfTecnico({ ...snapshot, salas: [] }, exportada, 'plano', opciones), /no pertenece/);
  });

  it('reserva nombres y códigos largos con acentos antes de paginar, sin perder texto ni escala', async () => {
    const { snapshot, exportada } = fixture();
    snapshot.proyecto!.nombre = 'Renovación de los sistemas de audiovisuales en las salas de reunión y formación de todos los departamentos del edificio administrativo principal y de las oficinas técnicas';
    exportada.sala.nombre = 'Sala de reuniones del departamento de servicios audiovisuales, edificio administrativo principal, planta tercera, zona de formación e instalaciones técnicas';
    exportada.sala.codigo = 'EDIFICIO-ADMINISTRATIVO-PRINCIPAL-ZONA-FORMACIÓN-ÁÉÍÓÚÑ-Ü';
    const vertical = { ...opciones, orientacion: 'vertical' as const };
    const layout = maquetarPdf(snapshot, exportada, 'plano', vertical);
    assert.ok(layout.cajetin.filaIdentidad > 35, 'La identidad crece con los textos reales.');
    assert.ok(layout.zona.alto < papelPdf(vertical).zona.alto, 'La paginación recibe la zona útil reducida.');
    assert.ok(Math.abs(layout.zona.y + layout.zona.alto + layout.altoNotas - layout.cajetin.y) < .001);
    const pdf = await generarPdfTecnico(snapshot, exportada, 'plano', vertical);
    const contenido = contenidoPdf(pdf);
    assert.match(contenido, /340\.15748\d* 226\.77165\d* re/);
    const textos = [...contenido.matchAll(/<([a-f0-9]+)>/gi)].map((m) => Buffer.from(m[1], 'hex').toString('latin1')).join('');
    assert.ok(textos.includes(snapshot.proyecto!.nombre));
    assert.ok(textos.includes(exportada.sala.nombre));
    assert.ok(textos.includes(exportada.sala.codigo));
  });

  it('el encabezado de una ficha de puertos también reserva su altura real', () => {
    const { snapshot, exportada } = fixture();
    exportada.equipos[0].nombre = 'Equipo de videoconferencia, distribución y gestión audiovisual del salón principal con señales de audio y vídeo y todos los puertos serigrafiados del fabricante. '.repeat(3);
    const layout = maquetarPdf(snapshot, exportada, 'esquema', { ...opciones, orientacion: 'vertical' });
    assert.ok(layout.altoCabecera > 34);
    assert.equal(layout.zona.y, 12 * 72 / 25.4 + layout.altoCabecera);
  });
});

describe('esquema técnico completo', () => {
  it('conserva las posiciones visuales guardadas y no las toma por coordenadas físicas', async () => {
    const { snapshot, exportada } = fixture();
    exportada.posicionesEsquema = { e1: { x: 800, y: 700 }, e2: { x: 16, y: 16 } };
    const antes = JSON.stringify(snapshot);
    const escena = escenaEsquemaExportada(snapshot, exportada);
    const a = escena.bloques.find((b) => b.equipo_id === 'e1')!, b = escena.bloques.find((b) => b.equipo_id === 'e2')!;
    assert.equal(a.x - b.x, 784);
    assert.equal(a.y - b.y, 684);
    assert.ok(escena.ancho > a.x + a.ancho);
    assert.equal(JSON.stringify(snapshot), antes);
    const bytes = await generarPdfTecnico(snapshot, exportada, 'esquema', opciones);
    assert.ok(bytes.length > 1000);
  });

  it('las cuatro elevaciones no proyectan una posición estimada', async () => {
    const { snapshot, exportada } = fixture();
    const pdf = await generarPdfTecnico(snapshot, exportada, 'elevaciones', opciones);
    // Cuatro dibujos + referencias de cada vista. Dos equipos, solo uno medido.
    assert.match(Buffer.from(pdf).toString('latin1'), /\/Count 8\b/);
    assert.ok(pdf.length > 5000);
  });
});

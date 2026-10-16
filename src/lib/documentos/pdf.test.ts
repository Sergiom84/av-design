import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inflateSync } from 'node:zlib';
import PDFDocument from 'pdfkit';
import { generarPdfTecnico, escenaEsquemaExportada, maquetarPdf, mosaicosEsquema, paginasMosaico, papelPdf, puntosPorMetro, ubicarRotuloElevacion } from './pdf';
import type { OpcionesPdf, SalaExportada, SnapshotExportacion } from './modelo';
import { PARAMETROS_POR_DEFECTO, type Sala, type EquipoEnSala, type Puerto } from '../tipos';

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

it('el PDF une ambas caras reales tras mover los bloques y conserva los datos físicos', () => {
  for (const origen of ['entrada', 'salida', 'bidireccional', 'control'] as const) for (const destino of ['entrada', 'salida', 'bidireccional', 'control'] as const) {
    for (const posiciones of [{ e1: { x: 800, y: 500 }, e2: { x: 16, y: 20 } }, { e1: { x: 20, y: 20 }, e2: { x: 20, y: 300 } }]) {
      const { snapshot, exportada } = fixture();
      exportada.posicionesEsquema = posiciones;
      exportada.puertos = [origen, destino].map((sentido, i): Puerto => ({ id: `p${i + 1}`, articulo_id: `e${i + 1}`, nombre: 'LAN PoE', total: 1, sentido, senal: 'red', conector: 'RJ45', orden: 1, notas: null, fuente: 'csv' }));
      exportada.conexiones = [{ id: 'c1', sala_id: 's', origen_id: 'e1', destino_id: 'e2', articulo_cable_id: null, puerto_origen_id: 'p1', puerto_destino_id: 'p2', puerto_origen_ordinal: 1, puerto_destino_ordinal: 1, senal: 'red', ruta: 'directo', longitud_manual_m: null, notas: null, creado_en: '2026-10-15T12:00:00Z' }];
      const antes = JSON.stringify(snapshot);
      const escena = escenaEsquemaExportada(snapshot, exportada);
      const puntos = escena.lineas[0].puntos;
      for (const [id, sentido, punto] of [['e1', origen, puntos[0]], ['e2', destino, puntos.at(-1)!]] as const) {
        const b = escena.bloques.find(b => b.equipo_id === id)!;
        const derecha = sentido === 'salida' || sentido === 'bidireccional';
        assert.equal(punto.x, derecha ? b.x + b.ancho + 26 : b.x - 26);
        assert.equal(punto.y, (derecha ? b.salidas : b.entradas)[0].y);
      }
      for (let i = 1; i < puntos.length; i++) {
        const a = puntos[i - 1], b = puntos[i];
        assert.ok(a.x === b.x || a.y === b.y);
        for (const cuerpo of escena.bloques) {
          const cruza = a.y === b.y
            ? a.y > cuerpo.y && a.y < cuerpo.y + cuerpo.alto && Math.max(a.x, b.x) > cuerpo.x && Math.min(a.x, b.x) < cuerpo.x + cuerpo.ancho
            : a.x > cuerpo.x && a.x < cuerpo.x + cuerpo.ancho && Math.max(a.y, b.y) > cuerpo.y && Math.min(a.y, b.y) < cuerpo.y + cuerpo.alto;
          assert.equal(cruza, false, 'el PDF no debe ocultar la línea debajo de su bloque');
        }
      }
      assert.equal(JSON.stringify(snapshot), antes);
    }
  }
});

it('rótulos de equipos proyectados en el mismo eje no cruzan los símbolos ni cambian la medida', () => {
  const hoja = { x: 0, y: 0, ancho: 700, alto: 400 };
  for (const x of [54, 300, 646]) {
    for (const y of [200, 214]) {
      const punto = { x, y }, rotulo = ubicarRotuloElevacion(punto, 42, hoja, { techo: 54, suelo: 350 });
      assert.ok(rotulo.x >= 4 && rotulo.x + 42 <= 696);
      assert.ok(rotulo.x >= x + 6 || rotulo.x + 42 <= x - 6);
      assert.equal(rotulo.y, y - 4);
      assert.deepEqual(punto, { x, y });
    }
  }
});

it('un equipo al nivel del suelo o del techo conserva su altura sin cruzar el rótulo con la pared', () => {
  const hoja = { x: 0, y: 0, ancho: 700, alto: 400 }, pared = { techo: 54, suelo: 350 };
  for (const y of [54, 60, 345, 350]) {
    const punto = { x: 100, y }, rotulo = ubicarRotuloElevacion(punto, 42, hoja, pared);
    assert.ok(rotulo.y > pared.techo && rotulo.y + 9 < pared.suelo);
    assert.deepEqual(punto, { x: 100, y });
  }
});

function contenidosPorPagina(bytes: Uint8Array): string[] {
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
  return streams;
}

const contenidoPdf = (bytes: Uint8Array) => contenidosPorPagina(bytes).join('\n');
const textosPdf = (contenido: string) => [...contenido.matchAll(/<([a-f0-9]+)>/gi)].map((m) => Buffer.from(m[1], 'hex').toString('latin1')).join('');

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

  it('separa referencias de equipos coincidentes sin mover sus medidas físicas', async () => {
    const { snapshot, exportada } = fixture();
    exportada.equipos[1].posicion_confirmada = true;
    const antes = JSON.stringify(snapshot);
    const pagina = contenidosPorPagina(await generarPdfTecnico(snapshot, exportada, 'plano', opciones))[0];
    const posiciones = new Map([...pagina.matchAll(/BT([\s\S]*?)ET/g)].flatMap(m => {
      const posicion = /1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/.exec(m[1]);
      return posicion ? [[textosPdf(m[1]), { x: Number(posicion[1]), y: Number(posicion[2]) }] as const] : [];
    }));
    const e1 = posiciones.get('E1')!, e2 = posiciones.get('E2')!;
    assert.ok(e1 && e2, 'Los dos equipos deben tener su referencia visible.');
    assert.ok(Math.abs(e1.y - e2.y) >= 10 || Math.abs(e1.x - e2.x) >= 16, 'Dos etiquetas cortas no pueden ocupar la misma caja.');
    assert.match(pagina, /340\.15748\d* 226\.77165\d* re/);
    assert.equal(JSON.stringify(snapshot), antes);
  });


  it('el texto del mosaico no crea páginas automáticas sin cajetín al superar la altura lógica del papel', async () => {
    const { snapshot, exportada } = fixture();
    const pdf = await generarPdfTecnico(snapshot, exportada, 'plano', { ...opciones, escala: 20 });
    // Cuatro hojas de dibujo a escala y una relación. PDFKit debe obedecerlas.
    assert.match(Buffer.from(pdf).toString('latin1'), /\/Count 5\b/);
  });

  it('las elevaciones separan etiquetas coincidentes conservando altura, símbolos y límites de pared', async () => {
    const { snapshot, exportada } = fixture();
    exportada.equipos[1].posicion_confirmada = true;
    const antes = JSON.stringify(snapshot);
    const pagina = contenidosPorPagina(await generarPdfTecnico(snapshot, exportada, 'elevaciones', opciones))[0];
    const posiciones = [...pagina.matchAll(/BT([\s\S]*?)ET/g)].flatMap(m => {
      const etiqueta = textosPdf(m[1]);
      const posicion = /1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/.exec(m[1]);
      return posicion && /^E[12]: z 1,20 m$/.test(etiqueta)
        ? [{ etiqueta, x: Number(posicion[1]), y: Number(posicion[2]) }] : [];
    });
    assert.equal(posiciones.length, 2);
    assert.ok(Math.abs(posiciones[0].y - posiciones[1].y) >= 10 || Math.abs(posiciones[0].x - posiciones[1].x) >= 48);
    assert.equal(JSON.stringify(snapshot), antes);
  });

  it('ningún fondo de rótulo tapa equipos próximos en la planta física', async (t) => {
    type Caja = { x: number; y: number; ancho: number; alto: number; pagina: number; orden: number };
    const cajas = new WeakMap<InstanceType<typeof PDFDocument>, Caja>();
    const paginas = new WeakMap<InstanceType<typeof PDFDocument>, number>();
    let orden = 0;
    const equipos: Caja[] = [], fondos: Caja[] = [];
    const paginaOriginal = PDFDocument.prototype.addPage;
    const rectOriginal = PDFDocument.prototype.rect;
    const rellenoOriginal = PDFDocument.prototype.fill;
    const equipoOriginal = PDFDocument.prototype.fillAndStroke;
    t.mock.method(PDFDocument.prototype, 'addPage', function (this: InstanceType<typeof PDFDocument>, ...args: Parameters<typeof paginaOriginal>) {
      paginas.set(this, (paginas.get(this) ?? 0) + 1);
      return paginaOriginal.apply(this, args);
    });
    t.mock.method(PDFDocument.prototype, 'rect', function (this: InstanceType<typeof PDFDocument>, ...args: Parameters<typeof rectOriginal>) {
      const [x, y, ancho, alto] = args;
      assert.ok(typeof x === 'number' && typeof y === 'number' && typeof ancho === 'number' && typeof alto === 'number');
      cajas.set(this, { x, y, ancho, alto, pagina: paginas.get(this) ?? 0, orden: ++orden });
      return rectOriginal.apply(this, args);
    });
    t.mock.method(PDFDocument.prototype, 'fill', function (this: InstanceType<typeof PDFDocument>, ...args: Parameters<typeof rellenoOriginal>) {
      const caja = cajas.get(this);
      if (caja && args[0] === '#ffffff') fondos.push(caja);
      return rellenoOriginal.apply(this, args);
    });
    t.mock.method(PDFDocument.prototype, 'fillAndStroke', function (this: InstanceType<typeof PDFDocument>, ...args: Parameters<typeof equipoOriginal>) {
      const caja = cajas.get(this);
      if (caja && args[0] === '#61708a') equipos.push(caja);
      return equipoOriginal.apply(this, args);
    });
    const { snapshot, exportada } = fixture();
    exportada.equipos[1].posicion_confirmada = true;
    exportada.equipos[1].posicion = { x_m: 2, y_m: 1.2, z_m: 1.2 };
    const antes = JSON.stringify(snapshot);
    await generarPdfTecnico(snapshot, exportada, 'plano', opciones);
    assert.equal(equipos.length, 2);
    assert.ok(fondos.length > 0);
    for (const fondo of fondos) for (const equipo of equipos) {
      if (fondo.pagina !== equipo.pagina || fondo.orden < equipo.orden) continue;
      const solapa = fondo.x < equipo.x + equipo.ancho && fondo.x + fondo.ancho > equipo.x
        && fondo.y < equipo.y + equipo.alto && fondo.y + fondo.alto > equipo.y;
      assert.equal(solapa, false, `Fondo ${JSON.stringify(fondo)} tapa equipo ${JSON.stringify(equipo)}`);
    }
    assert.equal(JSON.stringify(snapshot), antes);
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
  it('los identificadores recolocados en el borde del mosaico no pisan el rótulo del conector', async (t) => {
    const { snapshot, exportada } = fixture();
    exportada.posicionesEsquema = { e1: { x: 404, y: 24 }, e2: { x: 784, y: 24 } };
    exportada.puertos = ['salida', 'entrada'].map((sentido, i): Puerto => ({ id: `p${i}`, articulo_id: `e${i + 1}`, nombre: i ? 'HDMI IN 1' : 'HDMI OUT 1', total: 1, sentido: sentido as Puerto['sentido'], senal: 'hdmi', conector: 'HDMI A', orden: 1, notas: null, fuente: 'app' }));
    exportada.conexiones = [{ id: 'c1', sala_id: 's', origen_id: 'e1', destino_id: 'e2', articulo_cable_id: null, puerto_origen_id: 'p0', puerto_destino_id: 'p1', senal: 'hdmi', ruta: 'directo', longitud_manual_m: null, notas: null, creado_en: '2026-10-15' }];
    const paginaPorDoc = new WeakMap<InstanceType<typeof PDFDocument>, number>();
    const textos: Array<{ valor: string; pagina: number; x: number; y: number; ancho: number; alto: number }> = [];
    const paginaOriginal = PDFDocument.prototype.addPage, textoOriginal = PDFDocument.prototype.text;
    t.mock.method(PDFDocument.prototype, 'addPage', function(this: InstanceType<typeof PDFDocument>, ...args: Parameters<typeof paginaOriginal>) {
      paginaPorDoc.set(this, (paginaPorDoc.get(this) ?? 0) + 1);
      return paginaOriginal.apply(this, args);
    });
    t.mock.method(PDFDocument.prototype, 'text', function(this: InstanceType<typeof PDFDocument>, ...args: Parameters<typeof textoOriginal>) {
      const [valor, x, y, opcionesTexto] = args;
      if ((valor === 'HD-1000' || valor === 'HDMI A') && typeof x === 'number' && typeof y === 'number' && opcionesTexto && typeof opcionesTexto === 'object') {
        const ancho = 'width' in opcionesTexto && typeof opcionesTexto.width === 'number' ? opcionesTexto.width : this.widthOfString(valor);
        textos.push({ valor, pagina: paginaPorDoc.get(this) ?? 0, x, y, ancho, alto: this.heightOfString(valor, { width: ancho }) });
      }
      return textoOriginal.apply(this, args);
    });
    await generarPdfTecnico(snapshot, exportada, 'esquema', opciones);
    const identificadores = textos.filter(r => r.valor === 'HD-1000' && r.pagina > 1);
    assert.ok(identificadores.length, 'se debe comprobar al menos un mosaico real');
    for (const id of identificadores) for (const conector of textos.filter(r => r.valor === 'HDMI A' && r.pagina === id.pagina)) {
      assert.ok(id.x + id.ancho <= conector.x || conector.x + conector.ancho <= id.x || id.y + id.alto <= conector.y || conector.y + conector.alto <= id.y, 'ID de cable y conector requieren cajas separadas');
    }
  });
  it('los nombres anchos remiten a fichas íntegras sin salir del pie ni ocupar la siguiente fila', async () => {
    const { snapshot, exportada } = fixture();
    const nombre = 'Equipo de videoconferencia y distribución de audio y vídeo del salón principal. '.repeat(3);
    const categoria = 'Sistemas de videoconferencia del departamento de servicios audiovisuales'.repeat(2);
    const marca = 'Fabricante de soluciones audiovisuales con referencia de modelo detallada'.repeat(2);
    exportada.equipos[0].nombre = nombre;
    snapshot.articulos = [{ id: 'e1', marca, modelo: 'Modelo-X', categoria } as SnapshotExportacion['articulos'][number]];
    exportada.puertos = [{ id: 'p-0001', articulo_id: 'e1', nombre: 'WWWWWWWWWWWWWWWWWWW', conector: 'WWWWWWWWW', sentido: 'entrada', senal: 'hdmi', total: 1, orden: null, notas: null, fuente: 'app' }];
    const antes = JSON.stringify(snapshot);
    const paginas = contenidosPorPagina(await generarPdfTecnico(snapshot, exportada, 'esquema', { ...opciones, orientacion: 'vertical' }));
    const resumen = textosPdf(paginas[0]);
    assert.ok(resumen.includes('Equipo E1: ficha de puertos'));
    assert.ok(resumen.includes('Categoría: ficha E1'));
    assert.ok(resumen.includes('Marca y modelo: ficha E1'));
    assert.ok(resumen.includes('P0001.1'));
    assert.ok(!resumen.includes(nombre));
    assert.ok(!resumen.includes(exportada.puertos[0].nombre));
    const fichas = textosPdf(paginas.slice(1).join('\n'));
    assert.ok(fichas.includes(nombre));
    assert.ok(fichas.includes(categoria));
    assert.ok(fichas.includes(marca));
    assert.ok(fichas.includes(exportada.puertos[0].nombre));
    assert.ok(fichas.includes(exportada.puertos[0].conector!));
    assert.equal(JSON.stringify(snapshot), antes);
  });


  it('pagina matrices a tamaño constante y cubre hasta el último bloque sin reducir su letra', () => {
    const escena = { ancho: 2100, alto: 1600 };
    const zona = { ancho: 720, alto: 400 };
    const hojas = mosaicosEsquema(escena, zona);
    assert.ok(hojas.length > 1);
    assert.ok(hojas.at(-1)!.x + zona.ancho >= escena.ancho);
    assert.ok(hojas.at(-1)!.y + zona.alto >= escena.alto);
    assert.deepEqual(mosaicosEsquema({ ancho: 700, alto: 390 }, zona), []);
  });

  it('los tres PDF conservan nota completa, identidad de borrador, antecedente, herencia y leyenda usada', async () => {
    const { snapshot, exportada } = fixture();
    exportada.revisionDiseno = { estado: 'borrador', id: null, numero: null, nombre: null, autor: null, creadoEn: null,
      hash: 'f'.repeat(64), antecedente: { id: 'revision-anterior', numero: 2, nombre: 'Antes del cambio', autor: 'Persona', creadoEn: snapshot.creadoEn },
      heredadaDe: { salaId: 'sala-original', revisionId: 'revision-original' } };
    exportada.anotacionesDiseno = [{ id: 'nota', texto: 'Revisar soporte antes de instalar. '.repeat(20), ancla_tipo: 'visual', ancla_id: null, x: 500, y: 300 }];
    snapshot.articulos = exportada.equipos.map((e) => ({ id: e.articulo_id, categoria: 'Pantalla' })) as SnapshotExportacion['articulos'];
    const antes = JSON.stringify(snapshot);
    for (const tipo of ['plano', 'elevaciones', 'esquema'] as const) {
      const bytes = await generarPdfTecnico(snapshot, exportada, tipo, opciones);
      const textos = [...contenidoPdf(bytes).matchAll(/<([a-f0-9]+)>/gi)].map((m) => Buffer.from(m[1], 'hex').toString('latin1')).join('');
      assert.ok(textos.includes(exportada.anotacionesDiseno[0].texto));
      for (const literal of ['Borrador', 'Antes del cambio', 'sala-original', 'revision-original', 'Leyenda del diseño', 'Pantalla']) {
        assert.ok(textos.includes(literal), `${tipo}: ${literal}`);
      }
      assert.ok(textos.includes('f'.repeat(64)));
    }
    assert.equal(JSON.stringify(snapshot), antes);
  });

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

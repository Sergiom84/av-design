import PDFDocument from 'pdfkit';
import { formatearDecimal } from '../importes';
import { ErrorPropuesta, LIMITES, fechaMadrid, type ModeloPropuesta } from './modelo';
export interface PdfPropuesta {
    contenido: Buffer;
    paginas: number;
}
const estados = { sin_datos: 'Sin datos', parcial: 'Parcial', completo: 'Completa' };
const etiquetas = { base: 'Base', impuesto: 'Impuesto', total: 'Total', costePrevisto: 'Coste previsto' };
const dinero = (v: string | null) => v === null ? 'Sin dato' : formatearDecimal(BigInt(v), 2);
/** Pintor puro: no consulta SQL, archivos de origen ni recursos remotos. */
export async function renderizarPdf(modelo: ModeloPropuesta): Promise<PdfPropuesta> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margins: { top: 45, bottom: 48, left: 45, right: 45 }, bufferPages: true, info: { Title: `Propuesta interna · ${modelo.tecnico.titulo}`, Author: modelo.autor, CreationDate: new Date(modelo.creadoEn) } });
        const partes: Buffer[] = [];
        let bytes = 0;
        let fallo = false;
        const fallar = (error: unknown) => { if (fallo)
            return; fallo = true; reject(error); doc.destroy(); };
        doc.on('data', (b: Buffer) => { bytes += b.length; if (bytes > LIMITES.pdf)
            fallar(new ErrorPropuesta('El PDF supera veinte MiB.', 413));
        else
            partes.push(b); });
        doc.on('error', () => fallar(new ErrorPropuesta('No se pudo renderizar el PDF.', 503)));
        doc.on('end', () => { if (!fallo)
            resolve({ contenido: Buffer.concat(partes), paginas: paginasFinal || paginas }); });
        let paginas = 1;
        let paginasFinal = 0;
        doc.on('pageAdded', () => { paginas++; if (paginas > LIMITES.paginas)
            throw new ErrorPropuesta('El PDF supera cien páginas.', 413); });
        const ancho = doc.page.width - 90;
        let tablaActiva: 'material' | 'valoracion' | null = null;
        const cabeceraTabla = () => {
            if (!tablaActiva)
                return;
            doc.font('Helvetica-Bold').fontSize(9);
            const y = doc.y;
            const columnas = tablaActiva === 'material' ? [['Descripción', 45, 330], ['Cantidad', 380, 80], ['Unidad', 465, 85]] : [['Concepto', 45, 215], ['Moneda', 265, 45], ['Base', 315, 75], ['Impuesto', 395, 75], ['Total', 475, 75]];
            for (const [titulo, x, w] of columnas)
                doc.text(String(titulo), Number(x), y, { width: Number(w) });
            doc.y = y + 24;
            doc.font('Helvetica').fontSize(10);
        };
        const filaTabla = (valores: string[]) => {
            const columnas = tablaActiva === 'material' ? [[45, 330], [380, 80], [465, 85]] : [[45, 215], [265, 45], [315, 75], [395, 75], [475, 75]];
            doc.font('Helvetica').fontSize(10);
            const alto = Math.max(...valores.map((v, i) => doc.heightOfString(v, { width: columnas[i][1] }))) + 8;
            espacio(alto);
            const y = doc.y;
            valores.forEach((v, i) => doc.text(v, columnas[i][0], y, { width: columnas[i][1] }));
            doc.y = y + alto;
        };
        const cabecera = (continuacion = false) => {
            doc.fillColor('#3669d9').font('Helvetica-Bold').fontSize(12).text(continuacion ? 'Propuesta interna · continuación' : 'Propuesta interna', 45, 45, { width: ancho });
            doc.fillColor('#23262f').font('Helvetica').fontSize(9);
        };
        const espacio = (alto: number) => { if (doc.y + alto > doc.page.height - 60) {
            doc.addPage();
            cabecera(true);
            doc.moveDown();
            cabeceraTabla();
        } };
        const texto = (valor: string, negrita = false) => {
            doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            // Trozos por párrafo y palabra para no truncar ni desbordar una fila de página.
            const palabras = valor.split(/(\s+)/).flatMap(p => p.length > 120 ? (p.match(/[\s\S]{1,120}/g) ?? []) : [p]);
            let bloque = '';
            for (const palabra of palabras) {
                if (doc.heightOfString(bloque + palabra, { width: ancho }) > 350 && bloque) {
                    espacio(doc.heightOfString(bloque, { width: ancho }) + 5);
                    doc.text(bloque, 45, doc.y, { width: ancho });
                    bloque = '';
                }
                bloque += palabra;
            }
            if (bloque) {
                espacio(doc.heightOfString(bloque, { width: ancho }) + 5);
                doc.text(bloque, 45, doc.y, { width: ancho });
            }
            doc.moveDown(.4);
        };
        try {
            cabecera();
            doc.moveDown();
            texto(modelo.tecnico.titulo, true);
            texto(`Revisión ${modelo.numero} · ${fechaMadrid(modelo.creadoEn)} (Europe/Madrid) · ${modelo.autor}`);
            texto(`${modelo.fuente.ambito.tipo === 'sala' ? 'Sala' : 'Obra'}: ${modelo.fuente.nombre} · ${modelo.fuente.codigo ?? 'Sin código'}`);
            texto(`Selección: ${modelo.fuente.salas.map(s => `${s.nombre} (${s.codigo ?? 'Sin código'})`).join('; ')}`);
            texto(`${modelo.fuente.etiqueta}. Fuente leída ${fechaMadrid(modelo.fuente.leidaEn)}; verificada al preparar esta revisión; el documento conserva ese momento.`);
            for (const s of modelo.fuente.salas)
                texto(`${s.nombre}: ${s.revisionId ? `revisión E3 ${s.revisionNumero} · ${s.revisionId} · SHA ${s.revisionHash}` : 'diseño borrador'} · versión ${s.disenoVersion}`);
            texto(`SHA revisión: ${modelo.sha256}`);
            texto(`SHA fuente: ${modelo.fuenteHash}`);
            for (const aviso of modelo.fuente.avisos)
                texto(`Aviso: ${aviso}`);
            const d = modelo.tecnico.destinatario;
            texto(d ? `Destinatario: ${[d.entidad, d.nombre, d.contacto, d.grupo].filter(Boolean).join(' · ')}. Procedencia manual · ${fechaMadrid(d.fecha)}` : 'Destinatario: propuesta interna sin destinatario.');
            for (const s of modelo.tecnico.secciones) {
                espacio(Math.min(350, doc.heightOfString(s.resuelto, { width: ancho })) + 35);
                texto(s.tituloResuelto ?? s.titulo, true);
                texto(s.resuelto);
            }
            texto(`Líneas incluidas (${modelo.tecnico.lineas.length})${modelo.tecnico.excluidas ? ` · selección parcial: ${modelo.tecnico.excluidas} excluidas` : ''}`, true);
            tablaActiva = 'material';
            cabeceraTabla();
            for (const l of modelo.tecnico.lineas) {
                filaTabla([l.descripcion, l.cantidad ?? 'Sin dato', l.unidad ?? 'Sin dato']);
                texto(`${l.origen}. ${l.detalles.join(' · ')}`);
                if (l.enlace) {
                    texto(`Detalle: ${l.enlace}`);
                    doc.fontSize(9).fillColor('#3669d9').text('Abrir detalle de origen', 45, doc.y, { width: ancho, link: l.enlace });
                    doc.fillColor('#23262f').moveDown(.5);
                }
            }
            tablaActiva = null;
            if (modelo.valoracion) {
                texto(`Valoración prevista · ${estados[modelo.valoracion.estado]}`, true);
                texto('Importes sin impuestos. Costes previstos; no son costes históricos ni beneficio real. Redondeo mitad_fuera_cero_v1: precio U4, cantidad U2, base e impuesto por línea a unidad menor. EUR y USD separados.');
                tablaActiva = 'valoracion';
                cabeceraTabla();
                for (const l of modelo.valoracion.lineas) {
                    filaTabla([l.descripcion, l.moneda, dinero(l.base), dinero(l.impuestoMinor), dinero(l.total)]);
                    texto(`Cantidad ${l.cantidad ?? 'Sin dato'}; coste unitario previsto ${l.coste ?? 'Sin dato'}; precio unitario ${l.precioUnitario ?? 'Sin dato'}; regla ${l.regla}${l.porcentaje !== null ? ` ${l.porcentaje}%` : ''}.`);
                    texto(`Base ${dinero(l.base)}; impuesto ${dinero(l.impuestoMinor)}; total ${dinero(l.total)}; coste previsto ${dinero(l.costePrevisto)} ${l.moneda}.`);
                    texto(l.impuesto.tipo === 'sin_configurar' ? 'Impuesto sin configurar: bruto desconocido.' : l.impuesto.tipo === 'no_aplica' ? `Impuesto no aplica: ${l.impuesto.motivo}` : `${l.impuesto.etiqueta}: ${l.impuesto.porcentaje}%. Fuente: ${l.impuesto.fuente}`);
                    if (l.regla === 'directo' && l.precio !== null)
                        texto(`Precio directo manual: ${l.motivoPrecio}. Autor ${modelo.autor}; ${fechaMadrid(modelo.creadoEn)}`);
                    const f = l.fuenteCongelada as {
                        tipo?: string;
                        motivo?: string;
                        fecha?: string;
                        articuloId?: string;
                        valor?: string;
                        moneda?: string;
                        calidad?: string;
                        consultadoEn?: string;
                        hash?: string;
                    } | null;
                    texto(f?.tipo === 'manual' ? `Fuente manual del coste previsto: ${f.motivo}. Autor ${modelo.autor}; ${f.fecha ? fechaMadrid(f.fecha) : fechaMadrid(modelo.creadoEn)}.` : f?.articuloId ? `Fuente de catálogo: artículo ${f.articuloId}; ${f.valor ?? 'Sin dato'} ${f.moneda}; ${f.calidad}. Consulta ${f.consultadoEn ? fechaMadrid(f.consultadoEn) : 'Sin dato'}; SHA ${f.hash}.` : 'Coste previsto sin dato.');
                }
                tablaActiva = null;
                for (const [moneda, t] of Object.entries(modelo.valoracion.totales)) {
                    texto(`Subtotales conocidos ${moneda}`, true);
                    for (const [nombre, m] of Object.entries(t))
                        texto(`${etiquetas[nombre as keyof typeof etiquetas]}: ${dinero(m.subtotal)} ${moneda} · ${estados[m.estado]} · ${m.ausentes} líneas sin dato · ${m.orientativas} orientativas`);
                }
            }
            const rango = doc.bufferedPageRange();
            paginasFinal = rango.count;
            for (let i = 0; i < rango.count; i++) {
                doc.switchToPage(i);
                doc.page.margins.bottom = 0;
                doc.font('Helvetica').fontSize(9).fillColor('#637381').text(`Propuesta interna · revisión ${modelo.numero} · ${i + 1}/${rango.count}`, 45, doc.page.height - 35, { width: ancho, lineBreak: false });
            }
            doc.end();
        }
        catch (error) {
            fallar(error instanceof ErrorPropuesta ? error : new ErrorPropuesta('No se pudo renderizar el PDF.', 503));
        }
    });
}

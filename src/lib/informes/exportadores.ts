import { createHash, randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { generarXlsx } from '../documentos/tablas';
import { codificarCsv, textoSeguroCsv } from '../documentos/csv';
import { ErrorInforme, LIMITES, serializarCanonico, type ArchivoInforme, type Celda, type FormatoInforme, type SnapshotInforme, type ManifiestoInforme } from './modelo';
export const MIME_INFORME: Record<FormatoInforme, string> = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv; charset=utf-8' };
export function metadatosArchivo(a: ArchivoInforme): Omit<ArchivoInforme, 'contenido'> {
    const { contenido, ...metadatos } = a;
    void contenido;
    return metadatos;
}
export function sha256(valor: string | Uint8Array) {
    return createHash('sha256').update(valor).digest('hex');
}
/** La identidad de contenido excluye sólo las revisiones que se derivan de ella. */
export function sellarSnapshot(snapshot: SnapshotInforme) {
    const copia = structuredClone(snapshot);
    copia.revision = '';
    if (copia.material) {
        copia.material.revision = '';
        copia.material.creadoEn = copia.observadoEn;
    }
    const revision = `INF-${sha256(serializarCanonico(copia)).slice(0, 12)}`;
    copia.revision = revision;
    if (copia.material)
        copia.material.revision = revision;
    const texto = serializarCanonico(copia);
    if (Buffer.byteLength(texto) > LIMITES.snapshot)
        throw new ErrorInforme('LIMITE_EXCEDIDO', 'La captura supera ocho MiB. Reduce el ámbito.', 413);
    return { snapshot: copia, sha256: sha256(texto) };
}
export function contextoInforme(s: SnapshotInforme, hash: string): Array<[
    string,
    string
]> {
    return [['Ejecución', s.ejecucionId], ['Definición', `${s.definicion.nombre} · v${s.definicion.version}`], ['Clave', s.definicion.configuracion.clave], ['Revisión', s.revision], ['SHA-256 snapshot', hash], ['SHA-256 definición', s.definicionSha256], ['Versiones', `modelo 1 · registro 1 · ${s.versionGenerador}`], ['Ámbito solicitado', serializarCanonico(s.ambito.solicitado)], ['Ámbito resuelto', s.ambito.nombre], ['Salas seleccionadas', s.ambito.salas.map(x => `${x.id}: ${x.nombre}${x.codigo ? ` (${x.codigo})` : ''}`).join(' | ')], ['Fecha prevista UTC', s.previstaEn], ['Fecha observada UTC', s.observadoEn], ['Período', serializarCanonico(s.periodo)], ['Zona', 'Europe/Madrid'], ...s.resumen ? Object.entries(s.resumen).map(([k, v]): [
            string,
            string
        ] => [k, v === null ? 'Sin importes conocidos' : String(v)]) : [], ['Avisos', s.avisos.join(' | ')], ['Desconocidos', 'Un valor vacío indica ausencia; cero conserva su valor.'], ['Entrega externa', 'entrega_externa_no_configurada']];
}
function textoCelda(v: Celda | undefined) {
    return v == null ? '—' : typeof v === 'boolean' ? v ? 'Sí' : 'No' : String(v);
}
export function generarCsvInforme(s: SnapshotInforme, hash: string): Uint8Array {
    const contexto = contextoInforme(s, hash);
    const encabezado = codificarCsv([...contexto.map(([k]) => `informe_${k.replaceAll(' ', '_')}`), 'clave_fila', 'enlace_detalle', ...s.columnas.map(c => c.clave)], []);
    const trozos: Uint8Array[] = [encabezado];
    let bytes = encabezado.length;
    // El dialecto, el BOM y el escape de celdas siguen siendo los de E1.
    // Quitar sólo el BOM de cada fila conserva su CRLF inicial.
    for (const fila of s.filas) {
        const valores = [...contexto.map(([, v]) => v), fila.clave, fila.enlace ?? null, ...s.columnas.map(c => {
                const v = fila.valores[c.clave];
                return typeof v === 'boolean' ? v ? 'Sí' : 'No' : v ?? null;
            })];
        const trozo = codificarCsv([], [valores]).subarray(3);
        bytes += trozo.length;
        if (bytes > LIMITES.archivo)
            throw new ErrorInforme('LIMITE_EXCEDIDO', 'El CSV supera veinticinco MiB. Reduce el ámbito.', 413);
        trozos.push(trozo);
    }
    const contenido = new Uint8Array(bytes);
    let posicion = 0;
    for (const trozo of trozos) {
        contenido.set(trozo, posicion);
        posicion += trozo.length;
    }
    return contenido;
}
function trozosLegiblesLibro(texto: string): string[] {
    const partes: string[] = [];
    let actual = '';
    let saltos = 0;
    for (const caracter of texto) {
        actual += caracter;
        if (caracter === '\n')
            saltos++;
        if (actual.length >= 1200 || saltos >= 20) {
            partes.push(actual);
            actual = '';
            saltos = 0;
        }
    }
    if (actual)
        partes.push(actual);
    return partes;
}
function altoTextoLibro(texto: string): number {
    return Math.min(409, Math.max(25, texto.split('\n').reduce((n, linea) => n + Math.max(1, Math.ceil(linea.length / 65)), 0) * 15 + 10));
}
export async function generarLibroInforme(s: SnapshotInforme, hash: string): Promise<Uint8Array> {
    for (const fila of s.filas)
        for (const columna of s.columnas) {
            const valor = fila.valores[columna.clave];
            if (typeof valor === 'string' && valor.length > 32767)
                throw new ErrorInforme('LIMITE_EXCEDIDO', 'Un texto supera la capacidad de una celda XLSX. Solicita PDF o CSV para conservarlo íntegro.', 413);
        }
    const libro = new ExcelJS.Workbook();
    let textos: ExcelJS.Worksheet | undefined;
    const agregarTexto = (clave: string, campo: string, valor: string) => {
        if (!textos) {
            textos = libro.addWorksheet('Textos completos');
            textos.columns = [{ header: 'Clave de fila', key: 'clave', width: 40 }, { header: 'Campo', key: 'campo', width: 30 }, { header: 'Continuación', key: 'parte', width: 15 }, { header: 'Texto íntegro', key: 'texto', width: 110 }];
            textos.views = [{ state: 'frozen', ySplit: 1 }];
        }
        trozosLegiblesLibro(valor).forEach((trozo, i) => {
            const fila = textos!.addRow({ clave, campo, parte: i + 1, texto: textoSeguroCsv(trozo) });
            fila.alignment = { wrapText: true, vertical: 'top' };
            fila.height = altoTextoLibro(trozo);
        });
    };
    if (s.material) {
        const bytes = await generarXlsx(s.material, s.material.salas, 'bom');
        await libro.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
    }
    else {
        const hoja = libro.addWorksheet('Datos');
        hoja.columns = [{ header: 'Clave', key: 'clave', width: 39 }, ...s.columnas.map(c => ({ header: c.titulo, key: c.clave, width: c.tipo === 'numero' ? 20 : 32 })), { header: 'Detalle', key: 'enlace', width: 46 }];
        for (const f of s.filas)
            hoja.addRow({ clave: f.clave, ...Object.fromEntries(s.columnas.map(c => [c.clave, typeof f.valores[c.clave] === 'string' ? textoSeguroCsv(String(f.valores[c.clave])) : f.valores[c.clave]])), enlace: f.enlace ?? '' });
        for (const fila of s.filas)
            for (const columna of s.columnas) {
                const valor = fila.valores[columna.clave];
                if (typeof valor === 'string' && (valor.length > 1200 || valor.split('\n').length > 20))
                    agregarTexto(fila.clave, columna.titulo, valor);
            }
        hoja.views = [{ state: 'frozen', ySplit: 1 }];
        hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, hoja.rowCount), column: hoja.columnCount } };
        for (const fila of hoja.getRows(1, hoja.rowCount) ?? []) {
            fila.alignment = { vertical: 'top', wrapText: true };
            fila.height = Math.min(409, Math.max(25, ...fila.values instanceof Array ? fila.values.map(v => typeof v === 'string' ? altoTextoLibro(v) : 25) : [25]));
        }
        hoja.getRow(1).font = { bold: true };
    }
    for (const hoja of libro.worksheets)
        hoja.eachRow(fila => fila.eachCell(celda => {
            if (typeof celda.value === 'string' && celda.value.length > 32767)
                throw new ErrorInforme('LIMITE_EXCEDIDO', 'Un texto supera la capacidad de una celda XLSX. Solicita PDF o CSV.', 413);
        }));
    const contexto = libro.addWorksheet('Informe');
    contexto.columns = [{ header: 'Campo', key: 'campo', width: 29 }, { header: 'Valor', key: 'valor', width: 110 }];
    for (const [campo, valor] of contextoInforme(s, hash))
        trozosLegiblesLibro(valor || '—').forEach((trozo, i) => contexto.addRow({ campo: campo + (i ? ' (continuación)' : ''), valor: textoSeguroCsv(trozo) }));
    for (const fila of contexto.getRows(1, contexto.rowCount) ?? []) {
        fila.alignment = { wrapText: true, vertical: 'top' };
        fila.height = altoTextoLibro(String(fila.getCell(2).value ?? ''));
    }
    contexto.getRow(1).font = { bold: true };
    return new Uint8Array(await libro.xlsx.writeBuffer());
}
/** Tablas legibles, con grupos de columnas para no comprimir dieciocho campos en A4. */
export async function generarPdfInforme(s: SnapshotInforme, hash: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32, bufferPages: true, autoFirstPage: false });
        const trozos: Buffer[] = [];
        let bytes = 0;
        doc.on('data', (b: Buffer) => {
            bytes += b.length;
            if (bytes > LIMITES.archivo) {
                doc.destroy();
                reject(new ErrorInforme('LIMITE_EXCEDIDO', 'PDF mayor de veinticinco MiB.', 413));
            }
            else
                trozos.push(b);
        });
        doc.on('error', reject);
        doc.on('end', () => resolve(new Uint8Array(Buffer.concat(trozos))));
        try {
            let paginas = 0;
            const ancho = 777;
            let y = 32;
            const pagina = (subtitulo: string) => {
                if (++paginas > LIMITES.paginas)
                    throw new ErrorInforme('LIMITE_EXCEDIDO', 'El PDF supera doscientas páginas.', 413);
                doc.addPage();
                doc.font('Helvetica-Bold').fontSize(13).text(s.definicion.nombre, 32, 24, { width: ancho });
                const bajoTitulo = doc.y + 7;
                doc.font('Helvetica').fontSize(8).text(`${s.revision} · ${subtitulo}`, 32, bajoTitulo, { width: ancho });
                y = doc.y + 12;
            };
            pagina('Contexto conservado');
            for (const [campo, valor] of contextoInforme(s, hash)) {
                let pendiente = valor || '—';
                let continua = false;
                while (pendiente.length) {
                    doc.font('Helvetica').fontSize(9);
                    const prefijo = `${campo}${continua ? ' (continuación)' : ''}: `;
                    const espacio = 530 - y;
                    if (espacio < 45) {
                        pagina('Contexto · continuación');
                        continue;
                    }
                    const candidato = pendiente.slice(0, 12000);
                    let corte = candidato.length;
                    if (doc.heightOfString(prefijo + candidato, { width: ancho }) > espacio - 10) {
                        let lo = 1, hi = candidato.length;
                        while (lo < hi) {
                            const mid = Math.ceil((lo + hi) / 2);
                            if (doc.heightOfString(prefijo + candidato.slice(0, mid), { width: ancho }) <= espacio - 10)
                                lo = mid;
                            else
                                hi = mid - 1;
                        }
                        corte = lo;
                    }
                    doc.text(prefijo + pendiente.slice(0, corte), 32, y, { width: ancho });
                    y = doc.y + 8;
                    pendiente = pendiente.slice(corte);
                    if (pendiente.length) {
                        continua = true;
                        pagina('Contexto · continuación');
                    }
                }
            }
            const columnasPdf = s.columnas.map(c => ({ ...c, enlace: false }));
            if (s.filas.some(f => f.enlace))
                columnasPdf.push({ clave: '__ruta_detalle', titulo: 'Detalle actual (ruta)', tipo: 'texto', enlace: true });
            const grupos: Array<typeof columnasPdf> = [];
            for (let i = 0; i < columnasPdf.length; i += 5)
                grupos.push(columnasPdf.slice(i, i + 5));
            if (!grupos.length)
                grupos.push([]);
            for (let indice = 0; indice < grupos.length; indice++) {
                const columnas = grupos[indice];
                const width = ancho / (columnas.length + 1);
                const cabecera = () => {
                    doc.font('Helvetica-Bold').fontSize(8);
                    const textos = ['Clave de fila', ...columnas.map(c => c.titulo + (c.unidad ? ` (${c.unidad})` : ''))];
                    const alto = Math.max(30, ...textos.map(t => doc.heightOfString(t, { width: width - 8 }) + 10));
                    textos.forEach((t, i) => doc.text(t, 32 + i * width, y + 4, { width: width - 8 }));
                    y += alto;
                    doc.moveTo(32, y).lineTo(809, y).stroke('#3669d9');
                };
                const nueva = () => {
                    pagina(`Datos · bloque ${indice + 1}/${grupos.length}`);
                    cabecera();
                };
                nueva();
                if (!s.filas.length)
                    doc.font('Helvetica').fontSize(10).text('Sin filas en el ámbito y período seleccionados.', 32, y + 10);
                for (const fila of s.filas) {
                    let celdas = [fila.clave, ...columnas.map(c => {
                            if (!c.enlace)
                                return textoCelda(fila.valores[c.clave]);
                            if (fila.enlace && !/^\/(salas|carga|proyectos)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fila.enlace))
                                throw new ErrorInforme('DATOS_INVALIDOS', 'La ruta de detalle no es una ruta interna permitida.', 422);
                            return fila.enlace ?? '—';
                        })];
                    let continuacion = false;
                    while (celdas.some(v => v.length)) {
                        doc.font('Helvetica').fontSize(8);
                        const espacio = 530 - y;
                        if (espacio < 40) {
                            nueva();
                            continue;
                        }
                        const mostrar: string[] = [], resto: string[] = [];
                        for (const celda of celdas) {
                            const candidato = celda.slice(0, 4000);
                            if (doc.heightOfString(candidato, { width: width - 8 }) <= espacio - 12) {
                                mostrar.push(candidato);
                                resto.push(celda.slice(candidato.length));
                            }
                            else {
                                let lo = 1, hi = candidato.length;
                                while (lo < hi) {
                                    const mid = Math.ceil((lo + hi) / 2);
                                    if (doc.heightOfString(candidato.slice(0, mid), { width: width - 8 }) <= espacio - 16)
                                        lo = mid;
                                    else
                                        hi = mid - 1;
                                }
                                mostrar.push(celda.slice(0, lo));
                                resto.push(celda.slice(lo));
                            }
                        }
                        const alto = Math.max(22, ...mostrar.map(t => doc.heightOfString(t, { width: width - 8 }) + 10));
                        mostrar.forEach((t, i) => doc.text(t, 32 + i * width, y + 4, { width: width - 8 }));
                        y += alto;
                        doc.moveTo(32, y).lineTo(809, y).stroke('#e2e8f0');
                        if (resto.some(v => v.length)) {
                            celdas = resto;
                            celdas[0] = `${fila.clave} (continuación)`;
                            continuacion = true;
                            nueva();
                        }
                        else {
                            celdas = [];
                        }
                    }
                    if (continuacion)
                        y += 3;
                }
            }
            const rango = doc.bufferedPageRange();
            for (let i = rango.start; i < rango.start + rango.count; i++) {
                doc.switchToPage(i);
                doc.font('Helvetica').fontSize(8).text(`${s.revision} · Página ${i + 1} de ${rango.count}`, 32, 546, { width: 777, lineBreak: false });
            }
            doc.end();
        }
        catch (error) {
            doc.destroy();
            reject(error);
        }
    });
}
export async function exportarInforme(s: SnapshotInforme, hash: string): Promise<{
    archivos: ArchivoInforme[];
    manifiesto: ManifiestoInforme;
}> {
    const archivos: ArchivoInforme[] = [];
    for (const formato of s.definicion.configuracion.formatos) {
        const contenido = formato === 'csv' ? generarCsvInforme(s, hash) : formato === 'xlsx' ? await generarLibroInforme(s, hash) : await generarPdfInforme(s, hash);
        if (!contenido.length || contenido.length > LIMITES.archivo)
            throw new ErrorInforme('LIMITE_EXCEDIDO', 'El archivo supera el límite permitido.', 413);
        archivos.push({ id: randomUUID(), formato, nombre: `informe-${s.ejecucionId}.${formato}`, mime: MIME_INFORME[formato], contenido, sha256: sha256(contenido), bytes: contenido.length });
    }
    if (archivos.reduce((n, a) => n + a.bytes, 0) > LIMITES.ejecucion)
        throw new ErrorInforme('LIMITE_EXCEDIDO', 'Los archivos superan cincuenta MiB.', 413);
    const { filas, material, detalleMaterial, ...contexto } = s;
    void filas;
    void material;
    void detalleMaterial;
    return { archivos, manifiesto: { versionModelo: 1, ejecucionId: s.ejecucionId, revision: s.revision, snapshotSha256: hash, contexto, archivos: archivos.map(metadatosArchivo), entregaInterna: 'disponible_en_aplicacion', entregaExterna: 'entrega_externa_no_configurada' } };
}

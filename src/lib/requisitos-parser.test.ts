import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import PDFDocument from 'pdfkit';
import { extraerPdfLocal, extraerTxtLocal, ErrorExtraccion, LIMITES_EXTRACCION } from './requisitos/parser';

function pdf(crear: (doc: PDFKit.PDFDocument) => void, opciones: PDFKit.PDFDocumentOptions = {}): Promise<Uint8Array> {
  return new Promise((aceptar, rechazar) => {
    const doc = new PDFDocument({ compress: true, ...opciones }), trozos: Buffer[] = [];
    doc.on('data', b => trozos.push(Buffer.from(b)));
    doc.on('end', () => aceptar(new Uint8Array(Buffer.concat(trozos))));
    doc.on('error', rechazar);
    crear(doc); doc.end();
  });
}
describe('extracción local de documentos REA10', () => {
  it('PDF textual conserva páginas y texto en un proceso dedicado', async () => {
    const r = await extraerPdfLocal(await pdf(d => { d.text('Sala: Alfa\nCantidad: 3'); d.addPage(); d.text('Sala: Beta'); }));
    assert.equal(r.parserVersion, '6.4.299'); assert.equal(r.estado, 'con_texto');
    assert.equal(r.paginas.length, 2); assert.match(r.paginas[0].texto, /Sala: Alfa/u);
    assert.match(r.paginas[1].texto, /Sala: Beta/u);
  });
  it('página vacía y documento mixto no se afirman revisados por OCR', async () => {
    const vacio = await extraerPdfLocal(await pdf(() => {}));
    assert.equal(vacio.estado, 'sin_texto'); assert.equal(vacio.paginas[0].texto, '');
    const mixto = await extraerPdfLocal(await pdf(d => { d.text('Sala: Alfa'); d.addPage(); }));
    assert.equal(mixto.estado, 'mixto'); assert.equal(mixto.paginas[1].texto, '');
  });
  it('cifrado, adjunto y corrupto se rechazan antes de entregar un extracto', async () => {
    await assert.rejects(extraerPdfLocal(await pdf(d => d.text('Privado'), { userPassword: 'sintetica' })),
      e => e instanceof ErrorExtraccion && e.codigo === 'pdf_cifrado');
    await assert.rejects(extraerPdfLocal(await pdf(d => { d.text('Adjunto'); d.file(Buffer.from('PRUEBA'), { name: 'prueba.txt' }); })),
      e => e instanceof ErrorExtraccion && e.codigo === 'contenido_activo');
    await assert.rejects(extraerPdfLocal(Buffer.from('%PDF-1.7\nCORRUPTO')),
      e => e instanceof ErrorExtraccion && e.codigo === 'pdf_no_valido');
    await assert.rejects(extraerPdfLocal(await pdf(d => {
      d.text('Acción sin ejecutar');
      d.addNamedJavaScript('prueba', 'throw new Error("NO DEBE EJECUTARSE");');
    })), e => e instanceof ErrorExtraccion && e.codigo === 'contenido_activo');
  });
  it('101 páginas y texto por página fuera de límite no devuelven parciales', async () => {
    const paginas = await pdf(d => { for (let i = 1; i < 101; i++) d.addPage(); });
    await assert.rejects(extraerPdfLocal(paginas), e => e instanceof ErrorExtraccion && e.codigo === 'limite_paginas');
    const texto = await pdf(d => d.fontSize(0.1).text('x'.repeat(20_001), 10, 10,
      { lineBreak: false }), { size: [4096, 792] });
    await assert.rejects(extraerPdfLocal(texto), e => e instanceof ErrorExtraccion && e.codigo === 'limite_texto_pagina');
    const justo = await pdf(d => d.fontSize(0.1).text('x'.repeat(20_000), 10, 10,
      { lineBreak: false }), { size: [4096, 792] });
    assert.equal((await extraerPdfLocal(justo)).paginas[0].texto.length, 20_000);
  });
  it('100 páginas y5MiB exactos son admitidos; texto total excesivo se rechaza entero', async () => {
    const cien = await pdf(d => { for (let i = 1; i < 100; i++) d.addPage(); });
    assert.equal((await extraerPdfLocal(cien)).paginas.length, 100);
    const pequeno = Buffer.from(await pdf(d => d.text('Sala: Límite de bytes')));
    const inicio = pequeno.lastIndexOf(Buffer.from('\nxref\n')) + 1;
    assert.ok(inicio > 0);
    const cola = pequeno.subarray(inicio).toString('latin1');
    const referencia = /startxref\s+(\d+)\s+%%EOF/u.exec(cola);
    assert.ok(referencia);
    let relleno = LIMITES_EXTRACCION.bytes - pequeno.length;
    for (let i = 0; i < 5; i++) relleno = LIMITES_EXTRACCION.bytes - pequeno.length -
      (String(inicio + relleno).length - referencia[1].length);
    const final = cola.replace(/startxref\s+\d+\s+%%EOF/u, `startxref\n${inicio + relleno}\n%%EOF`);
    const espacios = Buffer.alloc(relleno, 32); espacios[espacios.length - 1] = 10;
    const exacto = Buffer.concat([pequeno.subarray(0, inicio), espacios, Buffer.from(final, 'latin1')]);
    assert.equal(exacto.length, LIMITES_EXTRACCION.bytes);
    assert.match((await extraerPdfLocal(exacto)).paginas[0].texto, /Sala: Límite de bytes/u);
    const mucho = await pdf(d => {
      for (let i = 0; i < 60; i++) {
        if (i) d.addPage();
        d.fontSize(0.1).text('x'.repeat(18_000), 10, 10, { lineBreak: false });
      }
    }, { size: [4096, 792] });
    await assert.rejects(extraerPdfLocal(mucho), e => e instanceof ErrorExtraccion && e.codigo === 'limite_texto');
  });
  it('timeout mata el proceso y espera su cierre, sin una promesa de parseo huérfana', async () => {
    const datos = await pdf(d => d.text('Sala: Timeout'));
    await assert.rejects(extraerPdfLocal(datos, { tiempoMaximoMs: 1 }), e => {
      assert.ok(e instanceof ErrorExtraccion); assert.equal(e.codigo, 'tiempo_agotado');
      assert.equal(e.proceso?.cerrado, true); assert.equal(e.proceso?.senial, 'SIGKILL');
      assert.ok(e.proceso?.pid); assert.throws(() => process.kill(e.proceso!.pid!, 0), /ESRCH/u);
      return true;
    });
    const c = new AbortController(); c.abort();
    await assert.rejects(extraerPdfLocal(datos, { signal: c.signal }), e => e instanceof ErrorExtraccion && e.codigo === 'cancelado');
  });
  it('límites de bytes, UTF8 estricto, NUL y texto preservan ausencias', async () => {
    assert.throws(() => extraerTxtLocal(Uint8Array.of(0xff)), /utf8_no_valido/u);
    assert.throws(() => extraerTxtLocal(Uint8Array.of(0)), /texto_con_nul/u);
    assert.throws(() => extraerTxtLocal(new Uint8Array(0)), /limite_archivo/u);
    assert.deepEqual(extraerTxtLocal(Buffer.from('Sala: Álamo\r\n')), { parser: 'utf8', parserVersion: '1', texto: 'Sala: Álamo\r\n' });
    await assert.rejects(extraerPdfLocal(new Uint8Array(LIMITES_EXTRACCION.bytes + 1)), /limite_archivo/u);
  });
});

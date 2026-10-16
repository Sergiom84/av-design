import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import { extraerPdfLocal } from '../src/lib/requisitos/parser';
const peticiones: string[] = [];
const servidor = createServer((req, res) => { peticiones.push(req.url ?? ''); res.end('PRUEBA local'); });
await new Promise<void>(resolve => servidor.listen(0, '127.0.0.1', resolve));
try {
  const direccion = servidor.address(); assert.ok(direccion && typeof direccion !== 'string');
  const pdf = new PDFDocument({ compress: false });
  const trozos: Buffer[] = [];
  const bytes = new Promise<Buffer>(resolve => { pdf.on('data', t => trozos.push(t)); pdf.on('end', () => resolve(Buffer.concat(trozos))); });
  pdf.text('PRUEBA REA10 texto local, enlace inerte.');
  pdf.link(40, 40, 100, 20, `http://127.0.0.1:${direccion.port}/recurso-no-solicitado`);
  pdf.end();
  const resultado = await extraerPdfLocal(await bytes);
  assert.match(resultado.paginas[0].texto, /PRUEBA REA10/u);
  assert.equal(peticiones.length, 0);
  const evidencia = { resultado: 'PASS', peticionesLocalesObservadas: peticiones,
    paginas: resultado.paginas.length, limite: 'Enlace URI inerte no solicitado durante extracción real. No acredita todos los posibles recursos PDF ni el futuro handler/cuotas10.' };
  await writeFile((process.env.REA10_SALIDA??'output/rea-integracion/rea10/runtime-20261016')+'/parser-red-resultado.json', JSON.stringify(evidencia, null, 2));
  console.log(JSON.stringify(evidencia));
} finally { await new Promise<void>((resolve, reject) => servidor.close(e => e ? reject(e) : resolve())); }

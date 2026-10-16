'use client';
import { useState, type FormEvent } from 'react';
import { Boton, Campo, Tarjeta } from '@/components/ui';

export function RegistrarFuente({ proyectoId, ocupado, registrar }: { proyectoId: string; ocupado: boolean; registrar: (cuerpo: FormData | object) => Promise<boolean> }) {
  const [tipo, setTipo] = useState('archivo_obra');
  const [archivo, setArchivo] = useState<File | null>(null);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const formulario = e.currentTarget, f = new FormData(formulario);
    const procedencia = String(f.get('procedencia') ?? '');
    let cuerpo: FormData | object;
    if (tipo === 'archivo_obra') {
      if (!archivo) return;
      const datos = new FormData(); datos.set('archivo', archivo); datos.set('proyectoId', proyectoId); datos.set('procedencia', procedencia);
      if (f.get('fechaFuente')) datos.set('fechaFuente', String(f.get('fechaFuente')));
      if (f.get('url')) datos.set('url', String(f.get('url')));
      cuerpo = datos;
    } else cuerpo = { proyectoId, procedencia, referencia: tipo === 'ficha_e2'
      ? { tipo, articuloId: f.get('articuloId'), archivoId: f.get('archivoId'), sha256: f.get('sha256'), revisionFuente: f.get('revisionFuente') }
      : { tipo, loteId: f.get('loteId'), sha256: f.get('sha256'), destino: f.get('destino') } };
    if (await registrar(cuerpo)) { formulario.reset(); setArchivo(null); }
  }
  return <Tarjeta titulo="Registrar fuente" pie="PDF o TXT UTF-8 · Hasta 5 MiB por archivo · OCR no configurado">
    <form onSubmit={e => void enviar(e)} className="space-y-4">
      <fieldset disabled={ocupado} className="space-y-4">
        <Campo etiqueta="Tipo de fuente"><select value={tipo} onChange={e => { setTipo(e.target.value); setArchivo(null); }} className="w-full">
          <option value="archivo_obra">Archivo de la obra</option><option value="ficha_e2">Ficha técnica E2 existente</option><option value="lote_e2">Lote E2 propio</option>
        </select></Campo>
        {tipo === 'archivo_obra' ? <>
          <Campo etiqueta="Archivo PDF o TXT"><input key={tipo} type="file" accept=".pdf,.txt,application/pdf,text/plain" required className="w-full" onChange={e => setArchivo(e.target.files?.[0] ?? null)} /></Campo>
          {archivo && <p className="dato text-xs">{archivo.name} · {archivo.size.toLocaleString('es')} bytes</p>}
          <div className="grid gap-4 sm:grid-cols-2"><Campo etiqueta="Fecha de la fuente (opcional)"><input name="fechaFuente" type="date" className="w-full" /></Campo>
            <Campo etiqueta="URL de procedencia (opcional)"><input name="url" type="url" pattern="https://.*" placeholder="https://" maxLength={2048} className="w-full" /></Campo></div>
        </> : <div className="grid gap-4 sm:grid-cols-2">
          {tipo === 'ficha_e2' ? <><Campo etiqueta="ID del artículo"><input name="articuloId" required className="w-full dato" /></Campo><Campo etiqueta="ID del archivo técnico"><input name="archivoId" required className="w-full dato" /></Campo><Campo etiqueta="Revisión de fuente"><input name="revisionFuente" required inputMode="numeric" pattern="[0-9]+" className="w-full dato" /></Campo></>
            : <><Campo etiqueta="ID del lote propio"><input name="loteId" required className="w-full dato" /></Campo><Campo etiqueta="Destino del lote"><select name="destino" className="w-full"><option value="catalogo">Catálogo</option><option value="bom">BOM</option><option value="precios">Precios</option></select></Campo></>}
          <Campo etiqueta="SHA-256 exacto del origen"><input name="sha256" required pattern="[a-f0-9]{64}" maxLength={64} className="w-full dato" /></Campo>
        </div>}
        <Campo etiqueta="Procedencia declarada"><input name="procedencia" required maxLength={500} className="w-full" /></Campo>
        <Boton disabled={ocupado || tipo === 'archivo_obra' && (!archivo || archivo.size < 1 || archivo.size > 5 * 1024 * 1024)}>Registrar fuente</Boton>
      </fieldset>
    </form>
  </Tarjeta>;
}

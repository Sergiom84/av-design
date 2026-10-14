'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso, Boton, Campo, Tarjeta } from '@/components/ui';
import type { FichaTecnica } from '@/lib/catalogo-tecnico-repositorio';

export function FichaTecnicaArticulo({ articuloId, marca, modelo, ficha, puedeEditar }: {
  articuloId: string; marca: string | null; modelo: string; ficha: FichaTecnica; puedeEditar: boolean;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const exacto = !ficha.datos || (ficha.datos.modelo === modelo && ficha.datos.marca === marca);
  const datos = exacto ? ficha.datos : null;
  const identidad = [marca, modelo].filter(Boolean).join(' · ');

  async function enviar(evento: FormEvent<HTMLFormElement>, archivo: boolean) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const entrada = new FormData(formulario);
    setOcupado(true); setMensaje(''); setError(false);
    try {
      const procedencia = { marca, modelo, origen: String(entrada.get('origen') ?? ''),
        url: String(entrada.get('url') ?? ''), fecha: String(entrada.get('fecha') ?? '') };
      const numero = (nombre: string) => entrada.get(nombre) === '' ? null : Number(entrada.get(nombre));
      let cuerpo: FormData | string;
      if (archivo) {
        entrada.delete('origen'); entrada.delete('url'); entrada.delete('fecha');
        entrada.set('procedencia', JSON.stringify(procedencia));
        cuerpo = entrada;
      } else {
        cuerpo = JSON.stringify({ ...procedencia, ancho: numero('ancho'), alto: numero('alto'),
          fondo: numero('fondo'), unidad: entrada.get('unidad') || null, ru: numero('ru') });
      }
      const respuesta = await fetch(`/api/catalogo-tecnico/${articuloId}`, {
        method: archivo ? 'POST' : 'PUT', body: cuerpo,
        ...(archivo ? {} : { headers: { 'Content-Type': 'application/json' } }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error ?? 'No se pudo guardar.');
      if (archivo) formulario.reset();
      setMensaje(archivo ? 'Archivo verificado y guardado.' : 'Datos técnicos verificados y guardados.');
      router.refresh();
    } catch (error) { setError(true); setMensaje(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setOcupado(false); }
  }

  return (
    <Tarjeta titulo="Datos técnicos por modelo" pie={`Modelo exacto: ${identidad}`}>
      {!exacto && <div className="mb-4"><Aviso>Los datos guardados corresponden a {ficha.datos?.marca} {ficha.datos?.modelo}. Verifica de nuevo el modelo actual antes de reutilizarlos.</Aviso></div>}
      <p className="text-tinta-tenue mb-4">Deja vacías las medidas desconocidas. Las dimensiones verificadas se conservan en los equipos que se añadan a salas y plantillas.</p>
      {mensaje && <div className="mb-4" role="status"><Aviso tono={error ? 'aviso' : 'neutro'}>{mensaje}</Aviso></div>}
      <form onSubmit={evento => void enviar(evento, false)}>
        <fieldset disabled={!puedeEditar || ocupado}>
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(['ancho', 'alto', 'fondo'] as const).map(nombre => (
              <Campo key={nombre} etiqueta={nombre[0].toUpperCase() + nombre.slice(1)}>
                <input name={nombre} type="number" min="0.000001" max="1000000" step="any" defaultValue={datos?.[nombre] ?? ''} className="w-full num" />
              </Campo>
            ))}
            <Campo etiqueta="Unidad de dimensión">
              <select name="unidad" defaultValue={datos?.unidad ?? ''} className="w-full">
                <option value="">Sin verificar</option><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
              </select>
            </Campo>
            <Campo etiqueta="Rack (RU)"><input name="ru" type="number" min="0.5" max="1000" step="any" defaultValue={datos?.ru ?? ''} className="w-full num" /></Campo>
          </div>
          <Procedencia origen={datos?.origen} url={datos?.url} fecha={datos?.fecha} />
          {puedeEditar && <div className="mt-4"><Boton disabled={ocupado}>Guardar verificación técnica</Boton></div>}
        </fieldset>
      </form>

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        {(['imagen', 'ficha'] as const).map(tipo => {
          const archivo = ficha.archivos.find(a => a.tipo === tipo);
          const enlace = archivo ? `/api/catalogo-tecnico/${articuloId}/archivos/${archivo.id}` : '';
          return <div key={tipo} className="min-w-0">
            <h3 className="font-semibold mb-2">{tipo === 'imagen' ? 'Imagen del modelo' : 'Ficha PDF del modelo'}</h3>
            {archivo ? <div className="mb-3 space-y-2 [overflow-wrap:anywhere]">
              {tipo === 'imagen' && <>
                {/* El endpoint exige la sesión actual y devuelve sólo raster validado. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${enlace}?vista=1`} alt={`${archivo.marca ?? ''} ${archivo.modelo}`} className="w-full h-40 object-contain bg-fondo rounded" />
              </>}
              <p><a className="enlace" href={enlace}>Descargar {archivo.nombre}</a></p>
              <p className="text-tinta-tenue">{archivo.marca} {archivo.modelo} · {archivo.origen} · {archivo.fecha} · {(archivo.tamano_bytes / 1024).toFixed(1)} KiB</p>
              <a className="enlace" href={archivo.url} target="_blank" rel="noopener noreferrer">Consultar origen</a>
            </div> : <p className="text-tinta-tenue mb-3">Sin archivo verificado.</p>}
            {puedeEditar && <form onSubmit={evento => void enviar(evento, true)}>
              <fieldset disabled={ocupado}>
                <input name="tipo" value={tipo} type="hidden" />
                <Campo etiqueta={tipo === 'imagen' ? 'PNG, JPEG o WebP (máx. 5 MiB)' : 'PDF (máx. 5 MiB)'}>
                  <input name="archivo" type="file" accept={tipo === 'imagen' ? 'image/png,image/jpeg,image/webp' : 'application/pdf'} required className="w-full" />
                </Campo>
                <Procedencia origen={archivo?.origen ?? datos?.origen} url={archivo?.url ?? datos?.url} fecha={archivo?.fecha ?? datos?.fecha} />
                <div className="mt-3"><Boton variante="secundario" disabled={ocupado}>{archivo ? 'Sustituir archivo verificado' : 'Guardar archivo verificado'}</Boton></div>
              </fieldset>
            </form>}
          </div>;
        })}
      </div>
    </Tarjeta>
  );
}

function Procedencia({ origen, url, fecha }: { origen?: string; url?: string; fecha?: string }) {
  return <div className="grid sm:grid-cols-3 gap-3 mt-3">
    <Campo etiqueta="Origen"><input name="origen" required maxLength={200} defaultValue={origen ?? ''} className="w-full" /></Campo>
    <Campo etiqueta="URL HTTPS"><input name="url" type="url" required maxLength={2048} pattern="https://.*" defaultValue={url ?? ''} className="w-full" /></Campo>
    <Campo etiqueta="Fecha de verificación"><input name="fecha" type="date" required defaultValue={fecha ?? ''} className="w-full" /></Campo>
  </div>;
}

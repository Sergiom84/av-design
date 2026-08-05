'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { clienteServidor } from '@/lib/supabase/servidor';

const numero = (v: FormDataEntryValue | null): number | null => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const texto = (v: FormDataEntryValue | null): string | null => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};

// ---------------------------------------------------------------- plantillas
export async function guardarMedidasPlantilla(datos: FormData) {
  const sb = await clienteServidor();
  const id = String(datos.get('id'));
  const { error } = await sb
    .from('plantillas_sala')
    .update({
      largo_m: numero(datos.get('largo_m')),
      ancho_m: numero(datos.get('ancho_m')),
      alto_m: numero(datos.get('alto_m')),
      alto_falso_techo_m: numero(datos.get('alto_falso_techo_m')),
      ruta_por_defecto: texto(datos.get('ruta_por_defecto')) ?? 'falso_techo',
    })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/plantillas');
  revalidatePath('/');
}

// --------------------------------------------------------------------- salas
export async function crearSala(datos: FormData) {
  const sb = await clienteServidor();
  const plantillaId = texto(datos.get('plantilla_id'));

  let base: Record<string, unknown> = {};
  if (plantillaId) {
    const { data: p } = await sb
      .from('plantillas_sala')
      .select('*')
      .eq('id', plantillaId)
      .maybeSingle();
    if (p) {
      base = {
        tipologia: p.tipologia,
        aforo: p.aforo,
        largo_m: p.largo_m ?? 0,
        ancho_m: p.ancho_m ?? 0,
        alto_m: p.alto_m ?? 0,
        alto_falso_techo_m: p.alto_falso_techo_m,
        ruta_por_defecto: p.ruta_por_defecto,
      };
    }
  }

  const { data: sala, error } = await sb
    .from('salas')
    .insert({
      ...base,
      nombre: texto(datos.get('nombre')) ?? 'Sala sin nombre',
      edificio: texto(datos.get('edificio')),
      nivel: texto(datos.get('nivel')),
      codigo: texto(datos.get('codigo')),
      plantilla_id: plantillaId,
    })
    .select('id')
    .single();
  if (error) throw error;

  // Arrastra el equipamiento de la plantilla que esté enlazado al catálogo.
  if (plantillaId) {
    const { data: lineas } = await sb
      .from('plantilla_articulos')
      .select('articulo_id, categoria, cantidad, opcional, modelo_texto')
      .eq('plantilla_id', plantillaId)
      .eq('opcional', false);

    if (lineas?.length) {
      await sb.from('sala_equipos').insert(
        lineas.map((l) => ({
          sala_id: sala.id,
          articulo_id: l.articulo_id,
          nombre: l.modelo_texto ?? l.categoria,
          cantidad: Math.max(1, Math.round(Number(l.cantidad) || 1)),
          extremo: extremoPorCategoria(String(l.categoria)),
        })),
      );
    }
  }

  revalidatePath('/salas');
  redirect(`/salas/${sala.id}`);
}

/** Traduce la categoría del inventario al tipo de extremo, para la holgura. */
function extremoPorCategoria(categoria: string): string {
  const c = categoria.toUpperCase();
  if (c.includes('PANTALLA') || c.includes('MONITOR') || c.includes('VIDEOWALL'))
    return 'pantalla';
  if (c.includes('PROYECTOR')) return 'proyector';
  if (c.includes('CAJA CONEXIONES')) return 'caja_conexiones';
  if (c.includes('ALTAVOZ') || c.includes('CAMARA') || c.includes('CÁMARA'))
    return 'techo';
  if (c.includes('PANEL') || c.includes('MICROFONO') || c.includes('MICRÓFONO'))
    return 'mesa';
  if (
    c.includes('MATRIZ') ||
    c.includes('AMPLIFICADOR') ||
    c.includes('PROCESADOR') ||
    c.includes('SWITCH') ||
    c.includes('CONTROLADORA') ||
    c.includes('DSP')
  )
    return 'rack';
  return 'pared';
}

export async function guardarSala(datos: FormData) {
  const sb = await clienteServidor();
  const id = String(datos.get('id'));
  const { error } = await sb
    .from('salas')
    .update({
      nombre: texto(datos.get('nombre')) ?? 'Sala sin nombre',
      edificio: texto(datos.get('edificio')),
      nivel: texto(datos.get('nivel')),
      codigo: texto(datos.get('codigo')),
      aforo: numero(datos.get('aforo')),
      largo_m: numero(datos.get('largo_m')) ?? 0,
      ancho_m: numero(datos.get('ancho_m')) ?? 0,
      alto_m: numero(datos.get('alto_m')) ?? 0,
      alto_falso_techo_m: numero(datos.get('alto_falso_techo_m')),
      alto_canaleta_m: numero(datos.get('alto_canaleta_m')),
      alto_suelo_tecnico_m: numero(datos.get('alto_suelo_tecnico_m')),
      ruta_por_defecto: texto(datos.get('ruta_por_defecto')) ?? 'falso_techo',
      notas: texto(datos.get('notas')),
    })
    .eq('id', id);
  if (error) throw error;
  revalidatePath(`/salas/${id}`);
  revalidatePath('/salas');
}

export async function borrarSala(datos: FormData) {
  const sb = await clienteServidor();
  await sb.from('salas').delete().eq('id', String(datos.get('id')));
  revalidatePath('/salas');
  redirect('/salas');
}

// ------------------------------------------------------------------ equipos
export async function anadirEquipo(datos: FormData) {
  const sb = await clienteServidor();
  const salaId = String(datos.get('sala_id'));
  const articuloId = texto(datos.get('articulo_id'));

  let nombre = texto(datos.get('nombre'));
  if (!nombre && articuloId) {
    const { data: a } = await sb
      .from('articulos')
      .select('marca, modelo')
      .eq('id', articuloId)
      .maybeSingle();
    if (a) nombre = `${a.marca ?? ''} ${a.modelo}`.trim();
  }

  const { error } = await sb.from('sala_equipos').insert({
    sala_id: salaId,
    articulo_id: articuloId,
    nombre: nombre ?? 'Equipo',
    cantidad: numero(datos.get('cantidad')) ?? 1,
    extremo: texto(datos.get('extremo')) ?? 'pared',
    x_m: numero(datos.get('x_m')) ?? 0,
    y_m: numero(datos.get('y_m')) ?? 0,
    z_m: numero(datos.get('z_m')) ?? 0,
  });
  if (error) throw error;
  revalidatePath(`/salas/${salaId}`);
}

export async function guardarEquipo(datos: FormData) {
  const sb = await clienteServidor();
  const salaId = String(datos.get('sala_id'));
  const { error } = await sb
    .from('sala_equipos')
    .update({
      nombre: texto(datos.get('nombre')) ?? 'Equipo',
      extremo: texto(datos.get('extremo')) ?? 'pared',
      x_m: numero(datos.get('x_m')) ?? 0,
      y_m: numero(datos.get('y_m')) ?? 0,
      z_m: numero(datos.get('z_m')) ?? 0,
    })
    .eq('id', String(datos.get('id')));
  if (error) throw error;
  revalidatePath(`/salas/${salaId}`);
}

export async function borrarEquipo(datos: FormData) {
  const sb = await clienteServidor();
  const salaId = String(datos.get('sala_id'));
  await sb.from('sala_equipos').delete().eq('id', String(datos.get('id')));
  revalidatePath(`/salas/${salaId}`);
}

// ---------------------------------------------------------------- conexiones
export async function anadirConexion(datos: FormData) {
  const sb = await clienteServidor();
  const salaId = String(datos.get('sala_id'));
  const origen = String(datos.get('origen_id'));
  const destino = String(datos.get('destino_id'));
  if (origen === destino) return;

  const { error } = await sb.from('conexiones').insert({
    sala_id: salaId,
    origen_id: origen,
    destino_id: destino,
    articulo_cable_id: texto(datos.get('articulo_cable_id')),
    senal: texto(datos.get('senal')) ?? 'otro',
    ruta: texto(datos.get('ruta')),
    longitud_manual_m: numero(datos.get('longitud_manual_m')),
  });
  if (error) throw error;
  revalidatePath(`/salas/${salaId}`);
}

export async function borrarConexion(datos: FormData) {
  const sb = await clienteServidor();
  const salaId = String(datos.get('sala_id'));
  await sb.from('conexiones').delete().eq('id', String(datos.get('id')));
  revalidatePath(`/salas/${salaId}`);
}

// ---------------------------------------------------------------- parámetros
export async function guardarParametros(datos: FormData) {
  const sb = await clienteServidor();
  const cambios: Array<{ clave: string; valor: number }> = [];
  for (const [clave, valor] of datos.entries()) {
    const n = numero(valor);
    if (n != null) cambios.push({ clave, valor: n });
  }
  for (const c of cambios) {
    await sb.from('parametros').update({ valor: c.valor }).eq('clave', c.clave);
  }
  revalidatePath('/parametros');
}

// ------------------------------------------------------------------ catálogo
export async function guardarPrecioArticulo(datos: FormData) {
  const sb = await clienteServidor();
  const { error } = await sb
    .from('articulos')
    .update({
      coste: numero(datos.get('coste')),
      bobina_m: numero(datos.get('bobina_m')),
      diametro_mm: numero(datos.get('diametro_mm')),
    })
    .eq('id', String(datos.get('id')));
  if (error) throw error;
  revalidatePath('/catalogo');
  revalidatePath('/');
}

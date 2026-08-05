'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

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
  await sql`
    update plantillas_sala set
      largo_m            = ${numero(datos.get('largo_m'))},
      ancho_m            = ${numero(datos.get('ancho_m'))},
      alto_m             = ${numero(datos.get('alto_m'))},
      alto_falso_techo_m = ${numero(datos.get('alto_falso_techo_m'))},
      ruta_por_defecto   = ${texto(datos.get('ruta_por_defecto')) ?? 'falso_techo'}::ruta_cable
    where id = ${String(datos.get('id'))}`;
  revalidatePath('/plantillas');
  revalidatePath('/');
}

// --------------------------------------------------------------------- salas
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

export async function crearSala(datos: FormData) {
  const plantillaId = texto(datos.get('plantilla_id'));

  const id = await sql.begin(async (tx) => {
    // Si hay plantilla, la sala hereda sus medidas y su tipología.
    const plantilla = plantillaId
      ? (
          await tx<Array<Record<string, unknown>>>`
            select * from plantillas_sala where id = ${plantillaId}`
        )[0]
      : undefined;

    const [sala] = await tx<Array<{ id: string }>>`
      insert into salas ${tx({
        nombre: texto(datos.get('nombre')) ?? 'Sala sin nombre',
        edificio: texto(datos.get('edificio')),
        nivel: texto(datos.get('nivel')),
        codigo: texto(datos.get('codigo')),
        plantilla_id: plantilla ? plantillaId : null,
        tipologia: (plantilla?.tipologia as string) ?? null,
        aforo: (plantilla?.aforo as number) ?? null,
        largo_m: Number(plantilla?.largo_m ?? 0),
        ancho_m: Number(plantilla?.ancho_m ?? 0),
        alto_m: Number(plantilla?.alto_m ?? 0),
        alto_falso_techo_m: (plantilla?.alto_falso_techo_m as number) ?? null,
        ruta_por_defecto: (plantilla?.ruta_por_defecto as string) ?? 'falso_techo',
      })}
      returning id`;

    // Arrastra el equipamiento estándar de la plantilla.
    if (plantillaId) {
      const lineas = await tx<
        Array<{ articulo_id: string | null; categoria: string; cantidad: string; modelo_texto: string | null }>
      >`select articulo_id, categoria, cantidad, modelo_texto
        from plantilla_articulos
        where plantilla_id = ${plantillaId} and not opcional`;

      for (const l of lineas) {
        await tx`
          insert into sala_equipos (sala_id, articulo_id, nombre, cantidad, extremo)
          values (${sala.id}, ${l.articulo_id}, ${l.modelo_texto ?? l.categoria},
                  ${Math.max(1, Math.round(Number(l.cantidad) || 1))},
                  ${extremoPorCategoria(l.categoria)}::extremo_cable)`;
      }
    }

    return sala.id;
  });

  revalidatePath('/salas');
  redirect(`/salas/${id}`);
}

export async function guardarSala(datos: FormData) {
  const id = String(datos.get('id'));
  await sql`
    update salas set
      nombre               = ${texto(datos.get('nombre')) ?? 'Sala sin nombre'},
      edificio             = ${texto(datos.get('edificio'))},
      nivel                = ${texto(datos.get('nivel'))},
      codigo               = ${texto(datos.get('codigo'))},
      aforo                = ${numero(datos.get('aforo'))},
      largo_m              = ${numero(datos.get('largo_m')) ?? 0},
      ancho_m              = ${numero(datos.get('ancho_m')) ?? 0},
      alto_m               = ${numero(datos.get('alto_m')) ?? 0},
      alto_falso_techo_m   = ${numero(datos.get('alto_falso_techo_m'))},
      alto_canaleta_m      = ${numero(datos.get('alto_canaleta_m'))},
      alto_suelo_tecnico_m = ${numero(datos.get('alto_suelo_tecnico_m'))},
      ruta_por_defecto     = ${texto(datos.get('ruta_por_defecto')) ?? 'falso_techo'}::ruta_cable,
      notas                = ${texto(datos.get('notas'))}
    where id = ${id}`;
  revalidatePath(`/salas/${id}`);
  revalidatePath('/salas');
}

export async function borrarSala(datos: FormData) {
  await sql`delete from salas where id = ${String(datos.get('id'))}`;
  revalidatePath('/salas');
  redirect('/salas');
}

// ------------------------------------------------------------------ equipos
export async function anadirEquipo(datos: FormData) {
  const salaId = String(datos.get('sala_id'));
  const articuloId = texto(datos.get('articulo_id'));

  let nombre = texto(datos.get('nombre'));
  if (!nombre && articuloId) {
    const [a] = await sql<Array<{ marca: string | null; modelo: string }>>`
      select marca, modelo from articulos where id = ${articuloId}`;
    if (a) nombre = `${a.marca ?? ''} ${a.modelo}`.trim();
  }

  await sql`
    insert into sala_equipos (sala_id, articulo_id, nombre, cantidad, extremo, x_m, y_m, z_m)
    values (${salaId}, ${articuloId}, ${nombre ?? 'Equipo'},
            ${numero(datos.get('cantidad')) ?? 1},
            ${texto(datos.get('extremo')) ?? 'pared'}::extremo_cable,
            ${numero(datos.get('x_m')) ?? 0},
            ${numero(datos.get('y_m')) ?? 0},
            ${numero(datos.get('z_m')) ?? 0})`;
  revalidatePath(`/salas/${salaId}`);
}

export async function guardarEquipo(datos: FormData) {
  const salaId = String(datos.get('sala_id'));
  await sql`
    update sala_equipos set
      nombre   = ${texto(datos.get('nombre')) ?? 'Equipo'},
      cantidad = ${Math.max(1, Math.round(numero(datos.get('cantidad')) ?? 1))},
      extremo  = ${texto(datos.get('extremo')) ?? 'pared'}::extremo_cable,
      x_m      = ${numero(datos.get('x_m')) ?? 0},
      y_m      = ${numero(datos.get('y_m')) ?? 0},
      z_m      = ${numero(datos.get('z_m')) ?? 0}
    where id = ${String(datos.get('id'))}`;
  revalidatePath(`/salas/${salaId}`);
}

/** Suma o resta unidades de un equipo sin abrir el formulario completo. */
export async function ajustarCantidadEquipo(datos: FormData) {
  const salaId = String(datos.get('sala_id'));
  const paso = Number(datos.get('paso')) || 1;
  await sql`
    update sala_equipos
    set cantidad = greatest(1, cantidad + ${paso})
    where id = ${String(datos.get('id'))}`;
  revalidatePath(`/salas/${salaId}`);
}

export async function borrarEquipo(datos: FormData) {
  const salaId = String(datos.get('sala_id'));
  await sql`delete from sala_equipos where id = ${String(datos.get('id'))}`;
  revalidatePath(`/salas/${salaId}`);
}

// ---------------------------------------------------------------- conexiones
export async function anadirConexion(datos: FormData) {
  const salaId = String(datos.get('sala_id'));
  const origen = String(datos.get('origen_id'));
  const destino = String(datos.get('destino_id'));
  if (!origen || !destino || origen === destino) return;

  const ruta = texto(datos.get('ruta'));
  await sql`
    insert into conexiones (sala_id, origen_id, destino_id, articulo_cable_id,
                            senal, ruta, longitud_manual_m)
    values (${salaId}, ${origen}, ${destino},
            ${texto(datos.get('articulo_cable_id'))},
            ${texto(datos.get('senal')) ?? 'otro'}::senal,
            ${ruta}::ruta_cable,
            ${numero(datos.get('longitud_manual_m'))})`;
  revalidatePath(`/salas/${salaId}`);
}

export async function borrarConexion(datos: FormData) {
  const salaId = String(datos.get('sala_id'));
  await sql`delete from conexiones where id = ${String(datos.get('id'))}`;
  revalidatePath(`/salas/${salaId}`);
}

// ---------------------------------------------------------------- parámetros
export async function guardarParametros(datos: FormData) {
  for (const [clave, valor] of datos.entries()) {
    const v = numero(valor);
    if (v == null) continue;
    await sql`update parametros set valor = ${v} where clave = ${clave}`;
  }
  revalidatePath('/parametros');
  revalidatePath('/');
}

// ------------------------------------------------------------------ catálogo
export async function guardarPrecioArticulo(datos: FormData) {
  await sql`
    update articulos set
      coste       = ${numero(datos.get('coste'))},
      bobina_m    = ${numero(datos.get('bobina_m'))},
      diametro_mm = ${numero(datos.get('diametro_mm'))}
    where id = ${String(datos.get('id'))}`;
  revalidatePath('/catalogo');
  revalidatePath('/');
}


// ------------------------------------------- equipamiento de las plantillas
export async function anadirLineaPlantilla(datos: FormData) {
  const plantillaId = String(datos.get('plantilla_id'));
  const articuloId = texto(datos.get('articulo_id'));
  if (!articuloId) return;

  const [a] = await sql<Array<{ marca: string | null; modelo: string; categoria: string }>>`
    select marca, modelo, categoria from articulos where id = ${articuloId}`;
  if (!a) return;

  await sql`
    insert into plantilla_articulos (plantilla_id, articulo_id, categoria, modelo_texto, cantidad, opcional)
    values (${plantillaId}, ${articuloId}, ${a.categoria},
            ${`${a.marca ?? ''} ${a.modelo}`.trim()},
            ${Math.max(1, Math.round(numero(datos.get('cantidad')) ?? 1))},
            ${datos.get('opcional') === 'on'})`;
  revalidatePath('/plantillas');
}

export async function guardarLineaPlantilla(datos: FormData) {
  await sql`
    update plantilla_articulos set
      cantidad = ${Math.max(1, Math.round(numero(datos.get('cantidad')) ?? 1))},
      opcional = ${datos.get('opcional') === 'on'}
    where id = ${String(datos.get('id'))}`;
  revalidatePath('/plantillas');
}

/** Suma o resta unidades de una línea de plantilla. */
export async function ajustarLineaPlantilla(datos: FormData) {
  const paso = Number(datos.get('paso')) || 1;
  await sql`
    update plantilla_articulos
    set cantidad = greatest(1, cantidad + ${paso})
    where id = ${String(datos.get('id'))}`;
  revalidatePath('/plantillas');
}

export async function borrarLineaPlantilla(datos: FormData) {
  await sql`delete from plantilla_articulos where id = ${String(datos.get('id'))}`;
  revalidatePath('/plantillas');
}

// ------------------------------------------------------- ficha de catálogo
function longitudes(v: FormDataEntryValue | null): number[] | null {
  const s = texto(v);
  if (!s) return null;
  const partes = s
    .split(/[,;/|\s]+/)
    .map((x) => Number(x.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return partes.length ? partes : null;
}

async function proveedorId(nombre: string | null): Promise<string | null> {
  if (!nombre) return null;
  const [p] = await sql<Array<{ id: string }>>`
    insert into proveedores (nombre) values (${nombre})
    on conflict (nombre) do update set nombre = excluded.nombre
    returning id`;
  return p.id;
}

export async function guardarArticulo(datos: FormData) {
  const id = String(datos.get('id'));
  const idProveedor = await proveedorId(texto(datos.get('proveedor')));

  await sql`
    update articulos set
      marca                    = ${texto(datos.get('marca'))},
      modelo                   = ${texto(datos.get('modelo')) ?? 'Sin modelo'},
      categoria                = ${(texto(datos.get('categoria')) ?? 'SIN CATEGORIA').toUpperCase()},
      descripcion              = ${texto(datos.get('descripcion'))},
      caracteristicas          = ${texto(datos.get('caracteristicas'))},
      observaciones            = ${texto(datos.get('observaciones'))},
      coste                    = ${numero(datos.get('coste'))},
      pvp                      = ${numero(datos.get('pvp'))},
      proveedor_id             = ${idProveedor},
      plazo_dias               = ${numero(datos.get('plazo_dias'))},
      stock_minimo             = ${numero(datos.get('stock_minimo'))},
      unidad                   = ${texto(datos.get('unidad')) ?? 'ud'}::unidad_medida,
      senal                    = ${texto(datos.get('senal'))}::senal,
      conector_a               = ${texto(datos.get('conector_a'))},
      conector_b               = ${texto(datos.get('conector_b'))},
      longitudes_comerciales_m = ${longitudes(datos.get('longitudes_comerciales_m'))},
      bobina_m                 = ${numero(datos.get('bobina_m'))},
      diametro_mm              = ${numero(datos.get('diametro_mm'))}
    where id = ${id}`;

  revalidatePath(`/articulo/${id}`);
  revalidatePath('/catalogo');
  revalidatePath('/');
}

export async function crearArticulo(datos: FormData) {
  const idProveedor = await proveedorId(texto(datos.get('proveedor')));
  const [a] = await sql<Array<{ id: string }>>`
    insert into articulos ${sql({
      tipo: texto(datos.get('tipo')) ?? 'equipo',
      marca: texto(datos.get('marca')),
      modelo: texto(datos.get('modelo')) ?? 'Sin modelo',
      categoria: (texto(datos.get('categoria')) ?? 'SIN CATEGORIA').toUpperCase(),
      descripcion: texto(datos.get('descripcion')),
      caracteristicas: texto(datos.get('caracteristicas')),
      observaciones: texto(datos.get('observaciones')),
      unidad: texto(datos.get('unidad')) ?? 'ud',
      coste: numero(datos.get('coste')),
      pvp: numero(datos.get('pvp')),
      proveedor_id: idProveedor,
    })}
    returning id`;

  revalidatePath('/catalogo');
  redirect(`/articulo/${a.id}`);
}

/** No se borra: se desactiva, para no romper las salas que ya lo usan. */
export async function desactivarArticulo(datos: FormData) {
  await sql`update articulos set activo = false where id = ${String(datos.get('id'))}`;
  revalidatePath('/catalogo');
  redirect('/catalogo');
}

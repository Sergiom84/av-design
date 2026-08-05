/**
 * Limpia el catálogo de una base de datos ya sembrada.
 *
 *   node scripts/normalizar-catalogo.mjs            → solo informa, no toca nada
 *   node scripts/normalizar-catalogo.mjs --aplicar  → aplica los cambios
 *
 * Qué hace, en este orden:
 *   1. Corrige el modelo: quita la marca repetida, aplica las erratas
 *      confirmadas y unifica las familias del fabricante.
 *   2. Unifica la sección con el mapa de sinónimos.
 *   3. Funde los artículos que quedan iguales (misma marca y mismo modelo
 *      ignorando espacios y guiones), sumando las unidades instaladas y
 *      repuntando plantillas, salas y conexiones al que se queda.
 *   4. Cuando un mismo modelo sigue repartido entre varias secciones, lo lleva
 *      entero a la sección que más unidades tiene.
 *
 * Todo va en una transacción y deja un informe en .tmp/informe-normalizacion.md
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { argv, exit } from 'node:process';
import postgres from 'postgres';
import {
  claveModelo,
  normalizarMarca,
  normalizarModelo,
  normalizarSeccion,
} from './normalizacion.mjs';

const aplicar = argv.includes('--aplicar');
const url =
  process.env.DATABASE_URL ??
  'postgres://av_design:av_design_local@localhost:5433/av_design';
const sql = postgres(url, {
  max: 1,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
});

const informe = [];
const linea = (t = '') => {
  informe.push(t);
  console.log(t);
};

try {
  const articulos = await sql`
    select id, tipo, marca, modelo, categoria,
           coalesce(unidades_instaladas, 0) as unidades,
           coste, pvp, descripcion, caracteristicas, observaciones, proveedor_id
    from articulos order by coalesce(unidades_instaladas,0) desc, modelo`;

  linea(`# Normalización del catálogo`);
  linea();
  linea(`Artículos de partida: **${articulos.length}**`);
  linea();

  // ------------------------------------------------------------- 1 y 2
  const corregidos = articulos.map((a) => ({
    ...a,
    unidades: Number(a.unidades),
    marcaNueva: normalizarMarca(a.marca),
    modeloNuevo: normalizarModelo(a.marca, a.modelo),
    seccionNueva: normalizarSeccion(a.categoria),
  }));

  const cambiosTexto = corregidos.filter(
    (a) =>
      a.modeloNuevo !== a.modelo ||
      a.seccionNueva !== a.categoria ||
      a.marcaNueva !== a.marca,
  );

  const marcaCambia = corregidos.filter((a) => a.marcaNueva !== a.marca);
  linea(`### Marcas corregidas (${marcaCambia.length} referencias)`);
  linea();
  linea('| Antes | Después | Modelo |');
  linea('|---|---|---|');
  for (const a of marcaCambia) linea(`| ${a.marca} | ${a.marcaNueva} | ${a.modeloNuevo} |`);
  linea();

  linea(`## 1 · Modelos y secciones reescritos: ${cambiosTexto.length}`);
  linea();
  const modeloCambia = cambiosTexto.filter((a) => a.modeloNuevo !== a.modelo);
  linea(`### Modelos corregidos (${modeloCambia.length})`);
  linea();
  linea('| Marca | Antes | Después |');
  linea('|---|---|---|');
  for (const a of modeloCambia) {
    linea(`| ${a.marca ?? '—'} | ${a.modelo} | ${a.modeloNuevo} |`);
  }
  linea();

  const secciones = new Map();
  for (const a of corregidos) {
    if (a.seccionNueva !== a.categoria) {
      const clave = `${a.categoria} → ${a.seccionNueva}`;
      secciones.set(clave, (secciones.get(clave) ?? 0) + 1);
    }
  }
  linea(`### Secciones unificadas (${secciones.size} equivalencias)`);
  linea();
  linea('| Antes | Después | Referencias |');
  linea('|---|---|---|');
  for (const [clave, n] of [...secciones].sort((a, b) => b[1] - a[1])) {
    const [antes, despues] = clave.split(' → ');
    linea(`| ${antes} | ${despues} | ${n} |`);
  }
  linea();

  // --------------------------------------------------------------- 3
  // Grupos de artículos que son el mismo producto.
  const grupos = new Map();
  for (const a of corregidos) {
    const clave = `${a.marcaNueva ?? ''}|${claveModelo(a.marca, a.modelo)}|${a.tipo}`;
    const lista = grupos.get(clave) ?? [];
    lista.push(a);
    grupos.set(clave, lista);
  }
  const fusiones = [...grupos.values()].filter((g) => g.length > 1);

  linea(`## 2 · Duplicados fundidos: ${fusiones.length} grupos`);
  linea();
  linea('Se queda el que más unidades instaladas tiene. Las unidades se suman.');
  linea();
  linea('| Marca | Se queda | Absorbe | Unidades |');
  linea('|---|---|---|---|');
  const plan = [];
  for (const grupo of fusiones) {
    const orden = [...grupo].sort(
      (a, b) => b.unidades - a.unidades || a.modeloNuevo.localeCompare(b.modeloNuevo),
    );
    const gana = orden[0];
    const pierden = orden.slice(1);
    const total = orden.reduce((s, a) => s + a.unidades, 0);

    // El grupo puede venir repartido entre secciones. Se queda la del que gana,
    // pero si la segunda anda cerca la decisión no es evidente y se avisa.
    const porSeccion = new Map();
    for (const a of orden) {
      porSeccion.set(a.seccionNueva, (porSeccion.get(a.seccionNueva) ?? 0) + a.unidades);
    }
    const reparto = [...porSeccion].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const dudosa =
      reparto.length > 1 && reparto[0][1] > 0 && reparto[1][1] / reparto[0][1] > 0.6;

    plan.push({ gana, pierden, total, reparto, dudosa });
    linea(
      `| ${gana.marcaNueva ?? '—'} | ${gana.modeloNuevo} | ${pierden.map((p) => `${p.modeloNuevo} (${p.unidades})`).join(', ')} | ${total} |`,
    );
  }
  linea();

  const ajustadas = plan.filter((p) => p.dudosa);
  if (ajustadas.length) {
    linea(`### Revisar a mano: sección poco clara (${ajustadas.length})`);
    linea();
    linea(
      'El modelo venía repartido entre secciones y ninguna manda con claridad. ' +
        'Se queda la del artículo con más unidades; corrígelo desde su ficha si procede.',
    );
    linea();
    for (const p of ajustadas) {
      linea(
        `- **${p.gana.marcaNueva ?? ''} ${p.gana.modeloNuevo}** → se queda en ` +
          `**${p.gana.seccionNueva}** · reparto: ${p.reparto.map(([s, u]) => `${s} ${u}`).join(' · ')}`,
      );
    }
    linea();
  }

  // --------------------------------------------------------------- 4
  // Tras fundir, un mismo modelo puede seguir en varias secciones.
  const supervivientes = plan.length
    ? corregidos.filter((a) => !plan.some((p) => p.pierden.some((x) => x.id === a.id)))
    : corregidos;
  const totalPorId = new Map(plan.map((p) => [p.gana.id, p.total]));

  // Un modelo con la misma clave ya se ha fundido arriba, así que aquí solo
  // quedan los que comparten marca y modelo final pero no clave.
  const porMarcaModelo = new Map();
  for (const a of supervivientes) {
    const clave = `${a.marcaNueva ?? ''}|${a.modeloNuevo}`;
    const lista = porMarcaModelo.get(clave) ?? [];
    lista.push(a);
    porMarcaModelo.set(clave, lista);
  }

  const reasignaciones = [];
  for (const lista of porMarcaModelo.values()) {
    const seccionesDistintas = new Set(lista.map((a) => a.seccionNueva));
    if (seccionesDistintas.size < 2) continue;

    const porSeccion = new Map();
    for (const a of lista) {
      const u = totalPorId.get(a.id) ?? a.unidades;
      porSeccion.set(a.seccionNueva, (porSeccion.get(a.seccionNueva) ?? 0) + u);
    }
    const orden = [...porSeccion].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [seccionGanadora, unidadesGanadora] = orden[0];
    const segunda = orden[1]?.[1] ?? 0;
    // Si la diferencia es pequeña, la decisión no es evidente: se marca.
    const dudosa = unidadesGanadora > 0 && segunda / unidadesGanadora > 0.6;

    for (const a of lista) {
      if (a.seccionNueva !== seccionGanadora) {
        reasignaciones.push({ articulo: a, destino: seccionGanadora, dudosa, orden });
      }
    }
  }

  linea(`## 3 · Modelos repartidos entre secciones: ${reasignaciones.length} movimientos`);
  linea();
  linea('Cada modelo se lleva entero a la sección donde tiene más unidades.');
  linea();
  linea('| Marca | Modelo | Sale de | Va a | Reparto |');
  linea('|---|---|---|---|---|');
  for (const r of reasignaciones) {
    linea(
      `| ${r.articulo.marcaNueva ?? '—'} | ${r.articulo.modeloNuevo} | ${r.articulo.seccionNueva} | ${r.destino} |` +
        ` ${r.orden.map(([s, u]) => `${s} ${u}`).join(' · ')} |`,
    );
  }
  linea();

  const dudosas = reasignaciones.filter((r) => r.dudosa);
  if (dudosas.length) {
    linea(`### Revisar a mano (${dudosas.length})`);
    linea();
    linea('La sección ganadora no es evidente. Corrígelo desde la ficha si procede.');
    linea();
    for (const r of dudosas) {
      linea(
        `- **${r.articulo.marcaNueva} ${r.articulo.modeloNuevo}** → ${r.destino} · reparto: ${r.orden
          .map(([s, u]) => `${s} ${u}`)
          .join(' · ')}`,
      );
    }
    linea();
  }

  // ------------------------------------------------------------- aplicar
  if (!aplicar) {
    linea('---');
    linea();
    linea('_Solo informe. Para aplicarlo: `npm run catalogo:normalizar -- --aplicar`_');
  } else {
    await sql.begin(async (tx) => {
      // 3 · fundir duplicados
      for (const { gana, pierden, total } of plan) {
        for (const p of pierden) {
          await tx`update plantilla_articulos set articulo_id = ${gana.id} where articulo_id = ${p.id}`;
          await tx`update sala_equipos      set articulo_id = ${gana.id} where articulo_id = ${p.id}`;
          await tx`update conexiones set articulo_cable_id = ${gana.id} where articulo_cable_id = ${p.id}`;
        }
        // El que se queda hereda los datos que él no tenga y los otros sí.
        const relleno = {};
        for (const campo of ['coste', 'pvp', 'descripcion', 'caracteristicas', 'observaciones', 'proveedor_id']) {
          if (gana[campo] == null) {
            const otro = pierden.find((p) => p[campo] != null);
            if (otro) relleno[campo] = otro[campo];
          }
        }
        await tx`
          update articulos set ${tx({ ...relleno, unidades_instaladas: total })}
          where id = ${gana.id}`;
        for (const p of pierden) await tx`delete from articulos where id = ${p.id}`;
      }

      // 1, 2 y 4 · reescribir modelo y sección
      const destinoSeccion = new Map(
        reasignaciones.map((r) => [r.articulo.id, r.destino]),
      );
      for (const a of corregidos) {
        if (plan.some((p) => p.pierden.some((x) => x.id === a.id))) continue;
        const seccion = destinoSeccion.get(a.id) ?? a.seccionNueva;
        if (
          a.modeloNuevo === a.modelo &&
          seccion === a.categoria &&
          a.marcaNueva === a.marca
        )
          continue;
        await tx`
          update articulos
          set marca = ${a.marcaNueva}, modelo = ${a.modeloNuevo}, categoria = ${seccion}
          where id = ${a.id}`;
      }

      // Las plantillas guardan el nombre y la sección como texto: se refrescan.
      await tx`
        update plantilla_articulos pa
        set modelo_texto = trim(coalesce(a.marca,'') || ' ' || a.modelo),
            categoria    = a.categoria
        from articulos a
        where a.id = pa.articulo_id`;
    });

    const [{ count }] = await sql`select count(*)::int as count from articulos`;
    linea('---');
    linea();
    linea(`**Aplicado.** El catálogo pasa de ${articulos.length} a ${count} referencias.`);
  }

  mkdirSync('.tmp', { recursive: true });
  writeFileSync('.tmp/informe-normalizacion.md', informe.join('\n') + '\n', 'utf8');
  console.log('\nInforme en .tmp/informe-normalizacion.md');
} catch (e) {
  console.error(e);
  exit(1);
} finally {
  await sql.end();
}

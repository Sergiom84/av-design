<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AV_design · contrato del proyecto

Aplicación interna del departamento de Audiovisuales para diseñar salas,
calcular los metros de cable de una instalación y sacar la lista de material.

## Qué problema resuelve

Tres fallos recurrentes en las instalaciones: falta material, nadie ha calculado
cuánto cable hace falta, y no hay un stock actualizado. Nació de analizar
XTEN-AV (`docs/01-analisis-xtenav.md`), que estructura bien el diseño AV pero
deja vacíos exactamente esos tres puntos.

## Estado

**Fase 1 implementada:** catálogo, plantillas de sala, salas con medidas,
cálculo de cable y lista de material.
Fases pendientes en `docs/02-propuesta-app.md`: stock y compras (2), esquema de
conexiones con React Flow (3), documentos para cliente (4).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Postgres · despliegue en
Render desde GitHub.

La base de datos es **Postgres en Docker** durante el desarrollo
(`docker-compose.yml`). Se migrará a Supabase cuando el proyecto esté maduro:
como Supabase también es Postgres, basta con cambiar `DATABASE_URL` y aplicar
además `db/politicas-supabase.sql`. El acceso a datos usa `postgres.js`
(`src/lib/db.ts`), sin SDK de Supabase.

## Reglas del proyecto

- **El dominio se escribe en español.** Tablas, columnas, tipos, funciones y
  variables usan el vocabulario del departamento: sala, tipología, aforo, caja
  de conexiones, canaleta, falso techo, tirada, holgura, bobina, latiguillo.
- **El cálculo de cable es lógica pura y con pruebas.** Vive en
  `src/lib/calculo-cable.ts` y no toca la base de datos. Cualquier cambio en la
  fórmula pasa antes por `src/lib/calculo-cable.test.ts`.
- **Los CSV de `data/` son la fuente editable del catálogo.** Se corrigen en
  Excel y se regenera con `npm run seed`. Nunca se edita `db/seed.sql` a mano.
- **El criterio de holguras y márgenes no se cablea en el código.** Vive en la
  tabla `parametros` y se edita desde `/parametros`.
- **La app no revienta sin base de datos.** Si falta `DATABASE_URL` muestra
  `SinConfigurar` en vez de lanzar un error.
- **Aspecto:** `design-system/MASTER.md` manda. Cormorant Garamond + JetBrains
  Mono, sin emojis en la interfaz.

## Comandos

| | |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (también valida tipos) |
| `npm test` | Pruebas del cálculo de cable |
| `npm run seed` | Regenera `db/seed.sql` desde los CSV de `data/` |
| `npm run db:reset` | Levanta Postgres en Docker, migra y siembra |
| `npm run typecheck` | Solo tipos (requiere haber compilado antes una vez) |

## Datos de partida

`docs/INVENTARIO GENERAL DE SALAS 2026.xlsx` y `docs/Salas_Sede.xlsx`: 7.181
líneas de inventario real, 390 salas. De ahí salen `data/catalogo-equipos.csv`
(1.071 referencias) y `data/plantillas-salas.csv` (17 plantillas). El análisis
está en `docs/03-datos-reales.md`.

`Inicio/` es un volcado local de la web de XTEN-AV que sirvió de referencia. No
se publica en el repositorio.

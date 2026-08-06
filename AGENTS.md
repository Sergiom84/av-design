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

**Fase 1 completa:** catálogo, plantillas de sala, salas con medidas, cálculo de
cable y lista de material. Más precios por artículo, que no estaba previsto.

**Fase 3:** puertos por artículo, conexiones de puerto a puerto y tabla de
cables con los metros calculados, que es lo que XTEN-AV deja vacío. Más el
croquis: la sala tiene mesa y los equipos tienen altura, y de ahí sale el plano
en planta con sus cotas. El dibujo es presentación de datos que ya existen, no
un rediseño.

**Qué queda y en qué orden: `docs/07-roadmap.md`.** Manda sobre
`docs/05-continuar.md`, que se quedó viejo.

**Fase 2 implementada:** almacén con existencias por ubicación y movimientos,
reservas de material para una obra, qué falta contra el almacén, pedidos por
proveedor con recepción que entra sola en el almacén, lista de carga marcable
desde el móvil y cierre de obra con bajas.

El detalle de las fases está en `docs/02-propuesta-app.md`. El análisis del flujo
real de XTEN-AV, con qué copiar y qué no, en `docs/06-xtenav-flujo-creacion.md`.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Postgres · despliegue en
Render desde GitHub.

La base de datos es **Postgres en Docker** durante el desarrollo
(`docker-compose.yml`) y **Postgres en Neon** en producción. El acceso a datos
usa `postgres.js` (`src/lib/db.ts`), así que el proveedor da igual mientras sea
Postgres: cambiar de uno a otro es cambiar `DATABASE_URL` y aplicar
`db/schema.sql` y `db/seed.sql`. Si algún día se va a Supabase, se aplica
además `db/politicas-supabase.sql`; nunca se usa su SDK.

La conexión se abre en la primera consulta, no al cargar el módulo: `next build`
importa todas las páginas para recoger su configuración, y compilar no puede
exigir una base de datos.

En producción está en <https://av-design.onrender.com>, en el workspace
**Av Weekly** de Render, con despliegue automático desde `main`.

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
  tabla `parametros` y se edita desde `/parametros`. Lo mismo vale para la
  vigencia de un precio.
- **Un artículo tiene tantos precios como ofertas.** La misma referencia sale a
  precios distintos según el proveedor y la antigüedad del presupuesto, así que
  se guardan todos en `precios`. **Los precios están aplazados**: el
  presupuesto de Cisco de marzo de 2024 sigue sin cargar, y el porqué y las dos
  decisiones pendientes están en `docs/07-roadmap.md`. Cada precio es `final` (oferta escrita de un
  proveedor, en `data/precios.csv`) u `orientativo` (referencia de mercado, en
  `data/precios-orientativos.csv`). `articulos.coste` se queda con la mejor
  oferta final vigente; si no hay ninguna, usa la mejor orientativa convertida a
  euros y marca `coste_orientativo`. Se puede cambiar desde la ficha del
  artículo. El informe está en `docs/05-precios.md`.
- **Un puerto es el conector físico del equipo, y se escribe como lo serigrafía
  el fabricante.** `HDMI IN 1`, `LAN PoE`, `MIC IN 1`: no se traducen ni se
  normalizan, porque el técnico busca en el aparato lo que lee en la pantalla.
  Viven en `puertos`, con sentido, señal y conector. La fuente editable es
  `data/puertos.csv`. Sin puertos no hay esquema ni tabla de cables.
- **Lo que se escribe desde la aplicación no lo pisa la siembra.** Las tablas
  que se alimentan de CSV (`precios`, `puertos`) llevan una columna `fuente`:
  `csv` se regenera entera en cada `npm run seed`, `app` no se toca nunca.
- **Un cable sale de un puerto y entra en otro.** Los puertos son del catálogo
  (`puertos`, por artículo) y una conexión guarda cuál usa en cada extremo. De
  ahí sale la tabla de cables (`src/components/cable-schedule/`), que es el
  entregable de obra. Su identificador (`HD-1000`, `RED-1000`) es correlativo
  por señal, se numera por orden de alta de la conexión y **no puede cambiar**:
  puede estar ya escrito en una brida. Los prefijos viven solo en
  `PREFIJO_CABLE` (`src/lib/tipos.ts`).
- **El croquis se dibuja con los datos, no se dibuja aparte.** El plano en
  planta de una sala sale de sus medidas: paredes de `largo_m` y `ancho_m`,
  mesa de `mesa_largo_m` y `mesa_ancho_m`, sillas repartidas según el aforo,
  equipos en su `x_m`/`y_m` y tiradas con los metros que ya calcula
  `calculo-cable.ts`. La escena se construye en `src/lib/croquis.ts`, que es
  lógica pura con pruebas; pintarla es cosa de `src/components/croquis/`. Una
  imagen de fondo no se recalcula, no da metros y habría que redibujarla 390
  veces.
- **Un equipo sin coordenadas se coloca donde suele ir, y se marca.** La
  pantalla al testero, la caja de conexiones en la mesa, el rack a una esquina.
  Sale con trazo discontinuo: sirve para orientarse, no para taladrar. Sin esto
  el croquis de una sala recién creada sale todo amontonado en la esquina, que
  es peor que no dibujar nada.
- **La revisión de montaje se deriva; el check-in se teclea.** Si la sala está
  lista para montarse lo dice `src/lib/revision.ts` mirando medidas, cable,
  material y carga: no tiene tablas, porque un estado que se marca a mano
  miente. Lo que sí se marca a mano es la visita previa a la sala (`revisiones`
  y `revision_puntos`), porque eso se ve con los ojos y no está en ningún sitio.
- **La toma de red es la roseta del edificio, no un puerto.** Vive en
  `tomas_red`, es de la sala concreta, y hoy **no es extremo de tirada**: dice
  dónde pincha un equipo. Hacerla extremo obligaría a cambiar
  `calculo-cable.ts`, y eso pasa antes por sus pruebas.
- **La validación de conexiones avisa, no bloquea.** Señales que no casan,
  salida contra salida, cable que no corresponde: se enseña el aviso y se deja
  seguir. El técnico puede tener un adaptador por medio.
- **La existencia del almacén no se escribe: se deriva.** Solo se insertan
  movimientos (`entrada`, `salida`, `devolucion`, `baja`, `ajuste`) y la vista
  `existencias` los suma. El signo lo pone el tipo, no quien teclea, y la tabla
  vive en `SIGNO_MOVIMIENTO` (`src/lib/almacen.ts`); la vista SQL la repite y
  una prueba obliga a que cambiarla sea deliberado. Un stock que se puede
  sobrescribir sin rastro vuelve a ser un Excel.
- **Disponible = existencias − reservado, y se enseñan los tres.** Reservado no
  es salido: sigue en el estante, comprometido para una obra. "Quedan cuatro
  pero cuatro están reservados" y "no queda ninguno" son problemas distintos.
- **Cargar la furgoneta es sacar del almacén.** La salida se apunta contra la
  ubicación donde estaba el material, no contra la furgoneta. Lo cargado ya no
  es existencia.
- **El material roto vuelve y luego se da de baja.** Neto cero sobre el stock
  —ya había salido— y la avería queda registrada, que es lo único que el
  departamento tenía apuntado antes de esta aplicación.
- **Un precio orientativo presupuesta, no pide.** Las líneas de pedido
  congelan el precio del catálogo al crearse y arrastran la marca.
- **El catálogo no viaja al navegador.** Elegir una referencia se hace
  escribiendo, con `src/components/catalogo/buscador-articulo.tsx`, que
  pregunta a `/api/catalogo` y trae como mucho veinte. Es el único selector de
  artículo: lo usan plantillas, sala y almacén. Un `<select>` con las 948
  referencias servía 5,4 MB en `/plantillas`, porque la página lo repetía una
  vez por plantilla. Lo que se envía es el identificador, nunca el texto.
- **Lo que se despliega va en la dirección, no en un acordeón.** En
  `/plantillas` las medidas de las diecisiete se editan siempre, pero el
  equipamiento solo se abre en la que dice `?abierta=<id>`. Con enlaces
  normales: se puede enlazar, volver con el botón del navegador y funciona sin
  JavaScript. Cien filas editables a la vez pesaban más que el resto junto.
- **Cada bloque de la interfaz vive en su propia carpeta de componente.** Nada
  de páginas monolíticas: `src/components/<bloque>/`.
- **La app no revienta sin base de datos.** Si falta `DATABASE_URL` muestra
  `SinConfigurar` en vez de lanzar un error.
- **Aspecto:** `design-system/MASTER.md` manda. Cormorant Garamond + JetBrains
  Mono, sin emojis en la interfaz.

## Comandos

| | |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (también valida tipos) |
| `npm test` | Pruebas de la lógica pura: cable, tabla de cables, almacén, compras y carga |
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

## Limpieza del catálogo

El inventario de partida trae la misma cosa escrita de varias formas. Las reglas
que lo unifican están en `scripts/normalizacion.mjs` y las usan tanto la siembra
(`npm run seed`) como la limpieza de una base ya sembrada
(`npm run catalogo:normalizar -- --aplicar`).

- Solo se unifica lo inequívoco. Las variantes reales de producto (QB65R y
  QB65R-B, TCM-X y TCM-XEX, K400 y K400+) no se tocan.
- Las erratas se corrigen una a una en `ERRATAS` y `MARCAS`, nunca por parecido.
- Cuando un modelo aparece en varias secciones se queda con la que más unidades
  tiene, y el informe marca los casos ajustados para revisarlos a mano.

El informe de la primera pasada está en `docs/04-limpieza-catalogo.md`.

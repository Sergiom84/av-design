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

- **La obra agrupa salas por localización.** Jerarquía Proyecto → Localización
  → Sala (`proyectos`, `localizaciones`, `salas.localizacion_id`), la de
  XTEN-AV. Una sala sin proyecto es **legado válido, no error**: todos los
  joins a la jerarquía son `left` y la sala se adopta desde la portada de la
  obra, que le arrastra la sede del proyecto. Cada proyecto nace con la
  localización `Sin asignar`. Un pedido puede abastecer varias salas de la
  obra (`pedidos.proyecto_id`); el reparto entre salas lo hacen las reservas.
- **El estado de proyecto y sala se deriva de hitos registrados, nunca se
  teclea.** Los hitos de la obra (`inicio`, `cierre`) viven en
  `hitos_proyecto`; los de la sala (`instalacion`, `entrega`), en
  `hitos_sala`. Un hito mal registrado se borra y se registra de nuevo, como
  un movimiento de almacén. La entrega con bloqueos del semáforo avisa y exige
  nota, no bloquea. La recepción es por pedido (`movimientos.quien`), no un
  hito. Los técnicos y sus roles se siembran de `data/tecnicos.csv` con la
  convención `fuente` csv/app.
- **La ficha de sala son seis pestañas por ruta** (`salas/[id]`, `/diagrama`,
  `/equipamiento`, `/cableado`, `/logistica`, `/documentos`) con layout
  compartido. Las acciones que tocan la sala revalidan con alcance `layout`;
  `typedRoutes` está activado y `next build` caza los enlaces rotos.
- **El plano se edita donde vive, y no se guarda como imagen.** La pestaña
  `Diagrama` (`src/components/plano-editor/`, `src/lib/plano-editor.ts`) edita
  medidas, mesa, mobiliario, posiciones de equipo y rosetas: los mismos datos
  que alimentan
  el croquis de Resumen y el cálculo de cable. No hay PNG, ni SVG final, ni
  JSON de lienzo en la base. El lienzo pinta la misma `GeometriaPlano` que el
  croquis, para que una posición confirmada dé el mismo dibujo en los dos
  sitios. En código el plano en planta se llama `plano-editor`: `diagrama` a
  secas ya es el esquema de conexiones de Cableado.
- **Colocado y estimado son cosas distintas.** `sala_equipos.posicion_confirmada`
  las separa, porque `(0,0,0)` significaba a la vez «sin colocar» y la esquina
  de la sala, que es justo donde va el rack. Un equipo sin confirmar se dibuja
  discontinuo y se deduce del extremo; uno confirmado es una medida aunque
  valga cero. La ausencia se propaga como ausencia en el viaje a la plantilla y
  de vuelta: no se convierte en `(0,0,0)`.
- **El plano se guarda entero o no se guarda.** `guardarDiagramaSala`
  (`src/app/acciones-diagrama.ts`) es una transacción con `diagrama_version`
  optimista: dos pestañas no se pisan en silencio, la segunda recibe conflicto
  y decide. Se comprueba contra Postgres real con `npm run test:diagrama`.
- **Se pregunta una vez de dónde sale el plano.** La primera entrada a Diagrama
  ofrece `Desde cero` o `Plantilla` y lo deja escrito en
  `salas.diagrama_iniciado_en`; después abre el editor directamente, porque un
  peaje diario multiplicado por 390 salas es un peaje. `Desde cero` no borra
  nada. `Plantilla` copia medidas, mesa, mobiliario, equipos, giros y tiradas,
  y solo si la sala está vacía: aplicar otra plantilla sobre una sala con
  equipos se bloquea y se explica, porque el merge sería adivinar a qué equipo
  corresponde cada línea y equivocarse borra trabajo medido. **Vacía incluye no
  tener rosetas**: aplicar una plantilla sustituye las medidas, y una roseta
  medida en (9,9) de una sala de 10 × 10 se quedaba fuera de una plantilla de
  6 × 4. Lo copiado se valida entero contra las medidas nuevas con la misma
  `coordenadasFueraDeSala()` del guardado manual, y el rechazo posterior a una
  escritura se lanza —no se devuelve—, porque `sql.begin` hace commit de todo lo
  que resuelva.
- **De un alta solo se cree el identificador.** Un equipo añadido desde el
  plano manda su `articulo_id`; el nombre, la categoría y el extremo los relee
  el servidor del catálogo, exigiendo activo y `tipo = 'equipo'`. Los ids
  temporales los inventa el navegador y no se escriben nunca: cada alta recibe
  su uuid y la acción devuelve el mapa.
- **El mobiliario no es catálogo AV.** Una silla no se pide a un proveedor de
  audiovisuales, no tiene puertos y no entra en ninguna tirada: vive en
  `catalogo_mobiliario` con su fuente editable `data/mobiliario.csv`, y las
  instancias en `sala_mobiliario`. De un alta solo se cree el identificador,
  igual que en el equipamiento: el nombre y la forma los relee el servidor del
  catálogo, y un alta sin referencia se rechaza entera. Una silla física es una fila —ocho sillas
  son ocho filas arrastrables, no una línea con `cantidad = 8`— y sus medidas
  son un snapshot del catálogo, para que corregirlo mañana no deforme los
  planos ya dibujados.
- **Las sillas tienen una sola fuente activa.** `salas.sillas_modo` decide:
  `derivadas` = las reparte el croquis desde el aforo; `manuales` = mandan las
  filas de `sala_mobiliario` y el aforo vuelve a ser solo la capacidad. Con las
  dos fuentes vivas el croquis dibujaba cada silla dos veces. **Quien apaga el
  aforo es el asiento, no el mueble**: lo dice `catalogo_mobiliario.rol`
  (`asiento`, `mesa_principal` o nulo, desde `data/mobiliario.csv`). Una
  plantilla con una mesa auxiliar y sin sillas dejaba la sala con cero sillas;
  una plantilla con sillas sí pasa la sala a `manuales`. Y añadir una silla a
  mano **materializa antes las del aforo en su sitio** con la misma
  `sillasAlrededor()`: sin eso una sala de aforo ocho pasaba a dibujar nueve, y
  apagarlas sin materializarlas las habría hecho desaparecer.
- **La mesa principal es una y no se instancia.** Vive en `salas.mesa_*` y es el
  elemento canónico. El buscador ofrece `Mesa principal` para poder encontrarla:
  elegirla selecciona la que hay y abre su inspector, no crea una fila. El
  servidor rechaza el alta de un mueble con `rol = 'mesa_principal'`, porque
  ocultar el control no es una guarda. Las mesas adicionales sí son filas de
  `sala_mobiliario`.
- **Todo lo que se coloca puede girar; lo que no se nota girado, no.** Mesa,
  mobiliario y equipamiento tienen `rotacion_grados` normalizado a `[0,360)` y
  comparten `ControlRotacion`. Girar no mueve: el SVG rota alrededor del ancla
  y x, y, z se quedan. La sala no gira, y una roseta cuyo símbolo es un círculo
  tampoco: un control que no cambia nada deja a quien lo pulsa buscando el
  cambio.
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
- **La plantilla trae el montaje, no solo la lista de material.** Además de qué
  equipos lleva la sala, guarda dónde va cada uno (`plantilla_articulos.x_m`) y
  qué conecta con qué (`plantilla_conexiones`), y qué muebles lleva y dónde
  (`plantilla_mobiliario`). Crear una sala copia las tres cosas, así que nace
  con croquis medido, mobiliario puesto y tabla de cables. Colocar una silla
  una vez o colocarla 144 veces es la diferencia. El giro viaja en los dos
  sentidos y lo comprueba `npm run test:plantillas`.
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
- **Se entra con una clave de departamento, no con usuario.** La aplicación
  está en una dirección pública con el inventario dentro, así que hay puerta:
  `src/middleware.ts` la vigila y el criterio vive en `src/lib/sesion.ts`, que
  es lógica pura con pruebas. La clave no se guarda en ningún sitio, solo su
  huella SHA-256 (`CLAVE_ACCESO_HASH`), y la cookie va firmada con
  `SESION_SECRETO`. Sin las dos variables, en desarrollo se pasa y **en
  producción no pasa nadie**: un despliegue al que se le olvidó la variable es
  justo el caso en el que el inventario acaba abierto. **Cambiar la clave exige
  redesplegar**: el proceso lee las variables al arrancar, y guardar la nueva
  huella en Render sin redesplegar deja la aplicación comparando contra la
  anterior. Saber quién tocó qué es
  otro problema, y para eso ya está `rol_usuario` en el esquema.
- **La app no revienta sin base de datos.** Si falta `DATABASE_URL` muestra
  `SinConfigurar` en vez de lanzar un error.
- **Aspecto:** `design-system/MASTER.md` manda. Desde el 7-8-2026 el sistema es
  el extraído de XTEN-AV (volcado `Inicio/`): Plus Jakarta Sans + JetBrains
  Mono, acento azul `#3669d9`, sidebar y tarjetas con sombra. La migración va
  pantalla a pantalla según `docs/07-roadmap.md`; sin emojis en la interfaz.

## Comandos

| | |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (también valida tipos) |
| `npm test` | Pruebas de la lógica pura: cable, tabla de cables, croquis, plano, almacén, compras y carga |
| `npm run test:diagrama` | Guardas del guardado del plano contra Postgres real |
| `npm run test:plantillas` | Ida y vuelta sala ↔ plantilla contra Postgres real |
| `npm run test:guardas-sala` | Guardas de «proyecto cerrado» contra Postgres real |
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

# Plan visual y E2E multiagente

## 1. Objetivo

Convertir la interfaz actual en una herramienta operativa elegante, legible y
predecible sin rehacer la aplicación ni cambiar su dominio. El resultado debe
permitir que un técnico entienda dónde está, qué falta y cuál es la siguiente
acción, tanto en un portátil como de pie con el móvil.

Este plan parte de `79ac4e2`, con la jerarquía Proyecto → Localización → Sala y
las guardas de proyecto cerrado ya revisadas. La atomicidad concurrente con
`SELECT FOR UPDATE` sigue clasificada como **Después** y no se mezcla con el
trabajo visual.

## 2. Decisiones ya tomadas

- No se rediseña desde cero. `design-system/MASTER.md` sigue mandando.
- Se conserva el lenguaje extraído de XTEN-AV: Plus Jakarta Sans, JetBrains
  Mono para datos, rail oscuro, fondo gris, tarjetas blancas y azul `#3669d9`.
- La elegancia sale de jerarquía, alineación, espacio y consistencia; no de
  gradientes, animaciones o decoración.
- El contenido nunca ensancha la página. Una tabla o diagrama técnico puede
  desplazarse dentro de su tarjeta, pero no arrastrar el `body`.
- Una tabla no se convierte automáticamente en tarjetas móviles. Las tablas
  comparativas cortas pueden apilarse; el cable schedule, inventario y otras
  matrices técnicas conservan columnas y scroll interno.
- Las acciones destructivas no compiten visualmente con la acción principal.
- No se cambia `calculo-cable.ts`, el modelo de datos, la siembra, los precios
  ni las reglas de negocio durante esta fase.
- Se trabaja en unidades pequeñas, con un commit verificado por unidad.

## 3. Diagnóstico verificado

La base visual es válida y reconocible. Los problemas no vienen de la paleta ni
de la tipografía, sino de cómo se comportan los contenedores cuando reciben
tablas, formularios y textos técnicos reales.

Hallazgos principales de la revisión a 1280 × 720 y 390 × 844:

1. A 1280 px varias tarjetas de proyecto y sala quedan cortadas por la derecha.
   El shell, las rejillas y sus hijos no comparten una regla firme de
   `min-width: 0` y ancho máximo.
2. `Tarjeta` tiene scroll horizontal en su cuerpo, pero el contrato no cubre
   cabecera, pie, acciones, SVG, palabras largas ni hijos de rejilla.
3. Las tablas se contienen razonablemente en móvil, pero cada pantalla decide
   de forma implícita su ancho mínimo. No se distingue una tabla apilable de
   una tabla técnica que necesita desplazamiento.
4. El Resumen de sala empieza con un formulario largo. La información más
   importante —estado, croquis, bloqueos y siguiente acción— queda demasiado
   abajo.
5. Las pestañas funcionan en móvil, pero su barra de desplazamiento domina la
   navegación y no indica con claridad que quedan opciones a la derecha.
6. Botones principales, secundarios y peligrosos tienen estilo consistente,
   pero su posición y peso cambian entre páginas.
7. Foco visible y `prefers-reduced-motion` ya existen globalmente. Hay que
   preservarlos y verificarlos, no sustituirlos.
8. `/catalogo` produce overflow real a 320 px por la combinación de un
   formulario sin `flex-wrap`, un buscador con ancho mínimo fijo y el contador.
9. Muchos controles se quedan en 32–35 px. En móvil necesitan un objetivo
   táctil mínimo de 44 px, especialmente en alta, equipamiento y check-in.
10. El cajón móvil todavía no gestiona `aria-expanded`, Escape, traslado y
    restauración del foco ni bloqueo del scroll del contenido inferior.
11. `Tarjeta` aplica hoy scroll horizontal a todo su cuerpo. Esto contiene
    algunas tablas, pero también oculta formularios y textos mal dimensionados.

## 4. Criterios globales de aceptación

La fase visual no se considera terminada hasta cumplir todos:

- Cero scroll horizontal del documento a 1440, 1280, 1024, 768, 390 y 320 px.
- A zoom 200 %, el documento conserva lectura y operación; el overflow técnico
  permanece dentro de la tarjeta correspondiente.
- Ningún texto, código, botón, input, tabla, SVG o badge sobresale de su tarjeta.
- Todo contenedor flex/grid que pueda encoger tiene `min-width: 0`.
- Inputs, selects y textareas usan `width: 100%` y `max-width: 100%` dentro de
  su celda; las excepciones se justifican por el contenido.
- Textos humanos largos envuelven. Códigos y referencias largas usan una regla
  deliberada (`overflow-wrap: anywhere` o scroll interno), nunca recorte.
- Las tablas técnicas muestran scroll propio, con cabecera y primera columna
  legibles cuando sea viable.
- Una tarjeta normal no tiene scroll horizontal; únicamente `ContenedorTabla`,
  diagramas y barras de pestañas declaradas pueden tenerlo.
- Los controles táctiles miden al menos 44 × 44 px en móvil.
- La acción principal es evidente; una acción peligrosa está separada y pide
  confirmación cuando borra información material.
- Todas las rutas se pueden usar con teclado y tienen foco visible.
- Estados no dependen solo del color y conservan texto inequívoco.
- No hay errores de consola, hidratación ni respuestas 500 en el recorrido E2E.
- `npm test`, `npm run build` y `git diff --check` pasan al final de cada unidad.

## 5. Unidades de implementación

### Unidad V0 — Línea base y mapa de pantallas

**Objetivo:** congelar evidencia antes de tocar estilos.

Trabajo:

- Leer `AGENTS.md`, `design-system/MASTER.md` y `docs/07-roadmap.md`.
- Inventariar todas las rutas de `src/app` y clasificarlas:
  listado, detalle, formulario, tabla técnica, flujo móvil o documento.
- Capturar escritorio y móvil de: Proyectos, portada de proyecto, Salas, alta
  de sala, Resumen, Equipamiento, Cableado, Logística, Documentos, Plantillas,
  Check-in, Catálogo, Almacén, Compras, Carga y Parámetros.
- Registrar `document.documentElement.scrollWidth/clientWidth`, errores de
  consola y los contenedores que originan cada overflow.
- Guardar los artefactos en `output/e2e/<fecha>/baseline/`, fuera del commit.

Aceptación:

- Cada ruta tiene captura 1440 × 900 y 390 × 844, o un bloqueo nombrado.
- El informe distingue overflow de página, de tarjeta y técnico deliberado.
- No se ha editado código ni datos de producción.

### Unidad V1 — Shell y contrato de contención

**Radio:** `src/components/navegacion/index.tsx`, `src/app/globals.css` y
`src/components/ui.tsx`.

Trabajo:

- Añadir `min-w-0` al contenedor que comparte espacio con el rail, al `main` y
  a los hijos flexibles que reciben las páginas.
- Garantizar `max-width: 100%` y `overflow-x: clip` en el nivel de página sin
  ocultar el foco. El scroll horizontal permitido vive más abajo.
- Reforzar `.tarjeta` con `min-width: 0; max-width: 100%`.
- Separar `Tarjeta` en zonas con contrato explícito:
  cabecera, acciones opcionales, cuerpo y pie. Todas pueden encoger y envolver.
- Retirar el `overflow-x-auto` universal del cuerpo de `Tarjeta`: los
  formularios y textos deben envolver, no convertirse en paneles desplazables.
- Incorporar una primitiva `ContenedorTabla` para el scroll horizontal técnico:
  `max-w-full`, `overflow-x-auto`, `overscroll-x-contain` y nombre accesible.
- Incorporar una primitiva `GrupoAcciones` que envuelva, mantenga orden y
  separe la acción peligrosa.
- Añadir reglas globales seguras para medios: `img`, `svg`, `canvas` y `video`
  no superan el ancho de su contenedor.
- No aplicar `overflow: hidden` indiscriminado: ocultaría contenido y foco.

Aceptación:

- Proyectos y la portada de proyecto ya no se cortan a 1280 px.
- Una cadena de 180 caracteres no ensancha el `body`.
- Las tablas anchas conservan scroll dentro de la tarjeta.
- La corrección falla de forma demostrable si se retira `min-w-0` del shell o
  la contención de `Tarjeta`.

Commit sugerido: `fix(ui): contiene tarjetas y overflow técnico`.

### Unidad V2 — Primitivas de lectura y estado

**Radio:** `src/components/ui.tsx`, tokens globales y componentes nuevos bajo
`src/components/ui/` solo si la extracción lo justifica.

Trabajo:

- Definir variantes de tarjeta: estándar, resumen/KPI, operativa y peligrosa.
  Comparten radio, sombra y espaciado; no crean cinco estilos nuevos.
- Normalizar badges de estado: neutro, información, listo, aviso y bloqueo.
- Normalizar pares etiqueta/valor, unidades y códigos técnicos.
- Añadir `ListaClaveValor` para datos cortos que no necesitan tabla.
- Definir estado vacío con: qué falta, siguiente acción y enlace, sin párrafos
  explicativos de relleno.
- Asegurar `overflow-wrap` en textos y notas; mantener los números tabulares.
- Homogeneizar alturas mínimas y objetivos táctiles de botones/controles.
- Mantener controles compactos en escritorio, pero elevarlos a un mínimo de
  44 px en móvil; reforzar el borde del control sin oscurecer los separadores.
- Completar estados hover, active, disabled, error y solo lectura.

Aceptación:

- Un mismo estado se ve y se nombra igual en proyecto, sala, carga y compras.
- Los KPI no cambian de altura por una etiqueta larga.
- Vacíos y avisos indican una acción concreta cuando existe.
- Contraste y foco se revisan sin afirmar cumplimiento WCAG total.

Commit sugerido: `refactor(ui): unifica estados y bloques de lectura`.

### Unidad V3 — Proyectos, localizaciones y alta de sala

**Objetivo:** hacer evidente la jerarquía Proyecto → Localización → Sala.

Trabajo:

- `/proyectos` y `/salas`: aplicar las tarjetas de proyecto definidas en
  `MASTER.md`: nombre dominante, ubicación/estado como datos secundarios, una
  columna móvil y dos o tres en escritorio. Las tablas quedan para matrices
  técnicas, no para navegar entre entidades.
- Portada del proyecto:
  - cabecera con estado y acción principal;
  - KPI en rejilla autoajustable;
  - localizaciones como secciones compactas;
  - pedidos e hitos en columna secundaria solo cuando hay ancho;
  - formularios de nueva localización/adopción después del contenido existente.
- No mostrar acciones estructurales cuando la obra está cerrada; enseñar un
  aviso breve de solo lectura y una única vía de reapertura.
- Mover `Borrar proyecto` fuera de la acción principal y aplicarle confirmación
  por URL, igual que a los hitos; nunca debe ser un envío inmediato ambiguo.
- Alta de sala:
  - secuencia visual `Origen → Identificación → Medidas → Serie → Resumen`;
  - proyecto y localización juntos;
  - plantilla y número de salas visibles antes de los detalles;
  - resumen de nombres inicial/final antes de crear;
  - formulario a una columna en móvil y máximo dos columnas legibles.

Aceptación:

- Desde una portada se llega al alta con proyecto, sede y Sin asignar visibles.
- Crear 144 salas se entiende antes de enviar el formulario.
- Una localización, sala o código largo no rompe tarjeta ni tabla.
- En móvil la acción principal aparece sin obligar a recorrer toda la página.

Commit sugerido: `feat(ui): ordena el flujo de proyecto y alta de sala`.

### Unidad V4 — Ficha de sala y cinco pestañas

**Objetivo:** que la ficha responda primero “¿puedo montar esta sala y qué me
falta?”, y después permita editar.

#### Resumen

- Arriba: estado de montaje, etapa del ciclo y tres o cuatro datos esenciales.
- Después: croquis y bloqueos/avisos, en dos columnas cuando quepan.
- Medidas: vista compacta de lectura con acción `Editar medidas`. La edición se
  despliega mediante URL (`?editar=medidas`) para conservar Atrás/Adelante y
  evitar un acordeón dependiente de JavaScript.
- Ciclo de vida debajo del diagnóstico, con la siguiente acción visible.
- Separar borrar sala del trabajo diario; no debe ser el primer botón móvil.
  Su confirmación debe seguir el patrón por URL ya usado en hitos.

#### Equipamiento

- Buscador único de catálogo arriba.
- Equipos como filas compactas con nombre, referencia, cantidad, ubicación y
  estado de catálogo; acciones secundarias agrupadas.
- En móvil, apilar datos del equipo; no comprimir cinco columnas ilegibles.

#### Cableado

- Dos vistas claras: `Tabla de cables` y `Esquema`, conservando la misma fuente
  de datos.
- Cable schedule en `ContenedorTabla`, con identificador y extremos siempre
  reconocibles.
- Diagrama y croquis con zoom/scroll interno, nunca ancho de página.
- Avisos de compatibilidad junto a la tirada afectada.

#### Logística y ciclo de vida

- Orden operativo: necesario → reservado → disponible → falta → pedido → carga.
- No mezclar existencia y reservado en un único número.
- En móvil, controles de carga y recepción con objetivos táctiles amplios.

#### Documentos

- Tarjetas o lista breve con nombre, contenido, disponibilidad y acción.
- Los documentos aún no implementados se marcan como pendientes, no como
  botones que aparenten funcionar.

#### Pestañas

- Mantenerlas como rutas tipadas.
- Scroll horizontal interno en móvil, indicador visual discreto de que hay más
  contenido y pestaña activa llevada a la vista.
- Foco, `aria-current`, recarga directa y Atrás/Adelante obligatorios.

Aceptación:

- En menos de diez segundos se identifica si la sala está montable y el bloqueo
  principal.
- El formulario de medidas no domina el primer pantallazo.
- Las cinco rutas funcionan por URL directa y a 320 px.
- Ninguna tabla, diagrama o pestaña ensancha el documento.

Commits sugeridos:

1. `feat(ui): prioriza el estado en el resumen de sala`
2. `feat(ui): adapta equipamiento y cableado`
3. `feat(ui): ordena logística y documentos`

### Unidad V5 — Flujos móviles operativos

**Pantallas:** Check-in, Almacén, Compras, Carga y bajas.

Trabajo:

- Diseñar para uso con una mano: acción primaria persistente cuando aporta
  valor, objetivos táctiles y campos con teclado adecuado.
- Check-in: un punto por bloque visual, estado evidente, avance visible y
  cierre solo cuando corresponde.
- Almacén: existencia, reservado y disponible juntos pero diferenciados.
- Compras: pedido, recepción parcial/completa y autor en secuencia temporal.
- Carga: líneas marcables con referencia, cantidad y ubicación visibles sin
  abrir detalles.
- No truncar la descripción del material: envolver completa o limitar a dos
  líneas con una vía explícita para leer el resto.
- Evitar tablas horizontales para tareas binarias de móvil; reservarlas para
  comparación técnica real.

Aceptación:

- Check-in y carga se completan a 390 × 844 solo con teclado/táctil.
- El foco no queda detrás de la barra superior.
- Ninguna acción irreversible se dispara con un único toque ambiguo.
- Recargar conserva el estado guardado y ofrece recuperación comprensible.

Commit sugerido: `feat(ui): optimiza los flujos operativos móviles`.

### Unidad V6 — Catálogo, plantillas, parámetros y puerta

Trabajo:

- Reutilizar exactamente las primitivas cerradas en V1/V2.
- Catálogo: búsqueda como entrada principal; marca/categoría/referencia con
  jerarquía estable y modelos largos contenidos.
- Corregir específicamente su formulario móvil: `flex-wrap`, buscador flexible
  sin `min-width` rígido y contador en línea propia cuando no quepa.
- Plantillas: conservar `?abierta=<id>` y evitar renderizar todas las ediciones.
- Parámetros: agrupar por finalidad, mantener unidad junto al valor y explicar
  solo criterios que puedan cambiar el cálculo.
- Entrada: una única tarjeta centrada, errores claros y retorno al destino.

Aceptación:

- No aparece una tercera variante visual improvisada.
- Los nombres largos de catálogo y plantilla no generan overflow de página.
- Los parámetros muestran valor, unidad y efecto sin ambigüedad.

Commit sugerido: `feat(ui): completa la migracion visual restante`.

### Unidad V7 — Accesibilidad, regresión visual y cierre

Trabajo:

- Recorrer todos los flujos solo con teclado.
- Probar el cajón móvil como navegación modal: `aria-expanded`,
  `aria-controls`, Escape, foco inicial, restauración del foco y bloqueo del
  scroll inferior.
- Verificar encabezados, landmarks, etiquetas, `aria-current`, avisos y orden de
  lectura mediante snapshot accesible.
- Revisar 200 % de zoom, 320 px y `prefers-reduced-motion`.
- Ejecutar el E2E multiagente del apartado 7.
- Corregir por primitiva compartida, no parchear pantalla por pantalla.
- Actualizar `design-system/MASTER.md` solo con decisiones realmente adoptadas.

Aceptación:

- Cumple todos los criterios globales del apartado 4.
- No quedan P0/P1; los P2 tienen arreglo o decisión explícita.
- `npm test`, `npm run build` y `git diff --check` pasan.
- El arquitecto revisa diff, capturas y artefactos antes del último commit.

Commit sugerido: `test(ui): cierra accesibilidad y regresion visual`.

## 6. Orden recomendado

```text
V0 evidencia
  → V1 contención
  → V2 primitivas
  → V3 proyectos/alta
  → V4 ficha de sala
  → V5 operación móvil
  → V6 resto de pantallas
  → V7 E2E y cierre
```

No empezar V3 antes de cerrar V1. Si el shell y `Tarjeta` siguen admitiendo
overflow, cada pantalla añadirá parches incompatibles.

## 7. E2E multiagente para Claude

### 7.1 Reglas de seguridad

- Producción solo se inspecciona sin escritura.
- Altas, movimientos, recepciones, cargas, entregas y borrados usan Postgres
  local.
- Los agentes de prueba no editan código ni hacen operaciones Git.
- Dos agentes simultáneos, no cuatro.
- Los agentes read-only pueden compartir servidor y base.
- Los agentes mutantes trabajan en serie o con base, checkout y puerto aislados.
- Cada dato lleva prefijo `E2E-<fecha>-<agente>`.
- La limpieza elimina la base E2E completa; nunca recompone stock borrando filas.

### 7.2 Preparación simple

```powershell
Set-Location 'C:\Users\sergi\Desktop\Aplicaciones\AV_design'
npm ci
npm run db:reset
npm test
npm run build
$env:DATABASE_URL='postgres://av_design:av_design_local@localhost:5433/av_design'
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Esta modalidad permite dos agentes read-only en paralelo. Los flujos que
escriben se ejecutan en serie, reseteando la base entre agentes.

### 7.3 Preparación paralela aislada

Para dos agentes mutantes a la vez, el orquestador crea dos bases y dos
instancias. Los ejecutores no hacen este trabajo.

```powershell
docker exec av_design_db psql -U av_design -d postgres -c "DROP DATABASE IF EXISTS av_design_e2e_a"
docker exec av_design_db psql -U av_design -d postgres -c "DROP DATABASE IF EXISTS av_design_e2e_b"
docker exec av_design_db createdb -U av_design av_design_e2e_a
docker exec av_design_db createdb -U av_design av_design_e2e_b
```

Aplicar `db/schema.sql` y `db/seed.sql` a cada URL. Dos procesos `next dev` no
deben compartir `.next`; usar dos checkouts desechables preparados por el
orquestador o ejecutar los agentes en serie. Puertos sugeridos: 3101 y 3102.

### 7.4 Lotes y responsabilidades

#### Lote 1 — Paralelo y read-only

**Agente Visual**

- Recorre todas las secciones y rutas de detalle.
- Viewports: 1440 × 900, 1280 × 800, 768 × 1024, 390 × 844 y 320 × 568.
- Prueba una sala y una tabla a zoom 200 %.
- Busca overflow de documento, tarjeta, tabla, SVG, pestañas y acciones.
- Captura estado normal, vacío, aviso y bloqueo disponibles.

**Agente UX/A11y**

- Navega con teclado, abre/cierra menú móvil y recorre las cinco pestañas.
- Prueba Atrás/Adelante y estados por query sin confirmar borrados.
- Comprueba foco, etiquetas, encabezados, landmarks y `aria-current`.
- Registra consola, hidratación, respuestas 4xx/5xx y red fallida.

El arquitecto deduplica y reproduce P0/P1 antes del lote 2.

#### Lote 2 — Mutante y aislado

**Agente Flujo**

Ejecuta el recorrido dorado:

```text
proyecto → localizaciones → serie de salas desde plantilla
→ equipamiento → conexión/cable → stock → reserva → falta
→ pedido → recepción → carga → check-in → instalación
→ entrega con aviso → cierre → solo lectura → reapertura
```

Comprueba persistencia tras recarga y contexto con Atrás/Adelante.

**Agente Bordes**

- Nombres/notas de 80 y 180 caracteres.
- Series con `##`, cambio proyecto/localización y campos obligatorios.
- 390, 320 y zoom 200 % mientras crea datos.
- UUID inválidos e inexistentes.
- Proyecto cerrado: no borrar, renombrar, adoptar, mover, soltar ni modificar
  hitos de sala hasta reabrir.
- Confirmaciones de borrado y cancelación.
- Doble pulsación y ausencia de envíos duplicados.

### 7.5 Matriz mínima de rutas

| Flujo | Escritorio | Móvil | Teclado | Escritura |
|---|---:|---:|---:|---:|
| Entrada y salida | sí | sí | sí | local |
| Proyectos/localizaciones | sí | sí | sí | local |
| Alta en serie desde plantilla | sí | sí | sí | local |
| Cinco pestañas de sala | sí | sí | sí | parcial |
| Equipamiento y catálogo | sí | sí | sí | local |
| Cable schedule y diagrama | sí | sí | sí | local |
| Almacén/reservas | sí | sí | sí | local |
| Pedido/recepción | sí | sí | sí | local |
| Carga | sí | sí | sí | local |
| Check-in | sí | sí | sí | local |
| Instalación/entrega/cierre | sí | sí | sí | local |
| Documentos/exportaciones | sí | sí | sí | descarga |

### 7.6 Artefactos

Cada agente entrega:

```text
output/e2e/<fecha-hora>/<agente>/
  resumen.md
  hallazgos.md
  consola.txt
  red-fallida.txt
  trace.zip
  capturas/
```

Contrato de hallazgo:

```markdown
## E2E-VIS-003 — [P1] El modelo sale de la tarjeta en móvil

Tipo: Visual / Usabilidad / Funcional / Accesibilidad
Ruta: /salas/<id>/equipamiento
Viewport y zoom: 390 × 844, 100 %
Dato: E2E-20260807-A
Reproducibilidad: 3/3

Precondición:
Pasos:
Esperado:
Actual:
Impacto:
Evidencia:
Componente sospechoso:
```

No se acepta “se ve mal” sin ruta, viewport, dato, pasos y captura.

### 7.7 Severidad y puertas de calidad

- **P0:** pérdida/corrupción, acceso indebido o escritura en producción. Parar.
- **P1:** flujo principal imposible, 500, invariante rota o contenido inaccesible.
- **P2:** overflow recurrente, navegación/foco deficiente o alternativa confusa.
- **P3:** refinamiento cosmético localizado.

El E2E aprueba solo si:

- no quedan P0/P1;
- no hay scroll horizontal de página a 390/320 ni a zoom 200 %;
- las cinco pestañas cargan directamente por URL;
- el recorrido dorado llega a cierre y reapertura;
- no hay consola/hidratación/500;
- teclado completa los flujos críticos;
- todos los agentes entregan evidencia;
- el arquitecto reproduce los P0/P1;
- pruebas y build pasan tras las correcciones.

Criterios de parada inmediata:

- navegador apuntando a Render/Neon antes de escribir;
- dos agentes compartiendo la misma base mutante;
- 500 sin comprender, pérdida de datos o mezcla entre proyectos;
- semilla distinta de la precondición;
- agente editando código o Git;
- referencias del navegador obsoletas sin snapshot nuevo.

## 8. Prompt para Claude

```text
Actúa como arquitecto y revisor E2E de AV_design.

Objetivo:
Probar con navegador real la aplicación completa, su usabilidad, responsive,
accesibilidad básica, persistencia y flujo operativo. No modifiques código.

Antes de actuar:
1. Lee AGENTS.md completo.
2. Lee package.json, design-system/MASTER.md, docs/07-roadmap.md y
   docs/09-plan-visual-y-e2e.md.
3. Inventaría las rutas visibles de src/app.
4. Confirma URL y base local asignadas a cada agente.
5. Verifica que ninguna prueba mutante apunta a Render o Neon.

Reglas:
- Máximo dos subagentes simultáneos.
- Los subagentes no editan código ni hacen git add, commit, stash o checkout.
- Lote 1: VISUAL y UX-A11Y en paralelo, estrictamente read-only.
- Revisa, deduplica y reproduce sus P0/P1 antes del lote 2.
- Lote 2: FLUJO y BORDES solo en paralelo si tienen URL y base independientes;
  si comparten base, ejecútalos en serie y resetea entre ambos.
- Usa navegador real visible.
- Haz snapshot accesible antes de interactuar y después de cada navegación,
  pestaña, modal o cambio importante. No reutilices referencias obsoletas.
- Usa roles, etiquetas y texto visible; evita selectores CSS frágiles.
- Captura consola, red fallida, screenshots y trace.
- No escribas nunca en https://av-design.onrender.com.
- Prefija los datos con E2E-AAAAMMDD-HHMM-<agente>.
- Limpia destruyendo la base E2E, no borrando filas sueltas.
- No afirmes que funciona sin ejecutarlo.
- Reproduce tú mismo todo P0/P1.

Lote 1, agente VISUAL:
- Recorre diez secciones, portada de proyecto, ficha de sala y cinco pestañas,
  artículo, pedido, carga y check-in.
- Prueba 1440x900, 1280x800, 768x1024, 390x844, 320x568 y zoom 200 %.
- Comprueba overflow de página/tarjetas, tablas, SVG, acciones, rail/cajón,
  jerarquía, estados y reduced motion.
- No envíes formularios.

Lote 1, agente UX-A11Y:
- Recorre navegación, filtros, query params, Atrás/Adelante y retornos.
- Prueba teclado, foco, orden de tabulación, nombres accesibles, encabezados,
  aria-current, menú móvil y avisos.
- Registra consola, hidratación, 4xx/5xx y red fallida.
- No envíes formularios.

Lote 2, agente FLUJO:
- Ejecuta proyecto → localizaciones → serie desde plantilla → equipamiento →
  conexión/cable → stock → reserva → pedido → recepción → carga → check-in →
  instalación → entrega → cierre → reapertura.
- Comprueba persistencia tras recarga y contexto con Atrás/Adelante.

Lote 2, agente BORDES:
- Usa nombres/notas largos, móvil, zoom 200 %, campos obligatorios, series,
  cambio de proyecto/localización, UUID inválidos y doble envío.
- Cierra una obra y verifica que no se pueda borrar, renombrar, adoptar, mover,
  soltar ni registrar/borrar hitos hasta reabrir.
- Prueba confirmaciones y cancelación.

Artefactos:
Guarda bajo output/e2e/<fecha-hora>/<agente>/ resumen.md, hallazgos.md,
consola.txt, red-fallida.txt, trace.zip y capturas/.

Cada hallazgo incluye ID, P0-P3, tipo, ruta, viewport, dato E2E, precondición,
pasos, esperado, actual, impacto, reproducibilidad, evidencia y componente.

Gates:
- Detente ante escritura en producción, pérdida de datos, mezcla de bases,
  error 500 no comprendido o P0.
- No apruebes con P0/P1, consola/hidratación, overflow de página a 390/320,
  flujo dorado incompleto o artefactos ausentes.
- Entrega un informe consolidado con cobertura, hallazgos ordenados, duplicados
  agrupados, rutas no cubiertas, riesgos residuales y clasificación
  Ahora/Después/Experimental.
```

## 9. Clasificación final

### Ahora

- V0 a V4: línea base, contención, primitivas, proyectos/alta y ficha de sala.
- E2E lote 1 tras V1 y E2E completo tras V4.

### Después

- V5 y V6: operación móvil y cierre de la migración visual.
- Atomicidad con bloqueo transaccional.
- Convertir los recorridos estables en una suite `@playwright/test` mantenida
  por CI, cuando el flujo deje de cambiar cada pocos días.

### Experimental

- Editor visual avanzado tipo draw.io.
- Comparación automática de capturas por píxel.
- Personalización de columnas y paneles por usuario.

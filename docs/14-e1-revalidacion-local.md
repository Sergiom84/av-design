# E1 · Revalidación y continuidad local, 14-10-2026

## Base y contrato de esta iteración

La fuente es `Xtenav/PROMPT_CONTINUACION.md`, AVX-01–03 y `docs/10-e1-especificacion.md`.
El checkout AV_design ya contiene implementación local E1 y cambios E2 sin commit.
Se conserva íntegramente esa base en un worktree detached desde `f38baa8`, con
los archivos actuales superpuestos y registrados por SHA-256 en
`output/e1-revalidacion/base-checkout.json`. No se continúa E2 ni se aceptan
como actuales los resultados del informe histórico `11-e1-entrega-local.md`.

Worktree: `/Users/sergio/Desktop/Aplicaciones/Xtenav/.worktrees/av-design-e1-20261014`.
El checkout original y los trabajos previos se conservan. No hay commit, push,
fetch, despliegue ni cambios de producción.

## Especificación breve

- Reutilizar escenas físicas/lógicas, cálculo de cables, necesidad y faltante.
- Leer el conjunto relacionado bajo `REPEATABLE READ READ ONLY`; PDF, XLSX,
  CSV y manifiesto provienen del mismo snapshot y lo identifican.
- Sala individual (incluido legado) primero; selección de salas de una obra
  mediante el mismo exportador. Stock global se cuenta una vez en el agregado.
- Sesión vigente, secciones autorizadas y propiedad al generar/descargar.
- A4/A3, ambas orientaciones, escala física fija y paginación sin ajustar
  silenciosamente. Ausencias/estimados, precios nulos y orientativos explícitos.
- ZIP seleccionable con progreso por documento, fallos parciales recuperables,
  descarga repetida idéntica y último paquete completo accesible.
- Revalidar con fixture `PRUEBA-DOC-01`, una segunda sala y caso incompleto.
  BD nueva exclusiva `av_design_e1_revalidacion_20261014_db`, loopback:5545,
  base `av_design_e1_prueba`, usuario `av_design_e1`. Sólo schema E1, sin seed
  de inventario real ni migraciones E2. Fotografías antes/después de exportar.
- Gates: pruebas pertinentes y npm test/build/types/lint, recorrido real
  escritorio antes de móvil, XLSX reabierto, todos los PDF renderizados,
  manifiesto/ZIP reabiertos, revisión independiente y corrección acotada.

## Implementación conservada y correcciones de esta iteración

El exportador existente de sala/obra, lectores normalizados, cálculo de cable,
BOM, CSV de 18 columnas y flujos operativos se conservan. PDFKit, ExcelJS y
fflate siguen siendo dependencias específicas de formato compatibles con el
proyecto; Artifact Tool se usa para reabrir/renderizar archivos de prueba, no
como framework de edición dentro del producto.

| Archivos | Corrección y propósito |
|---|---|
| `src/lib/documentos/datos.ts`, nuevo `datos.test.ts` | E1 funciona con `db/schema.sql`, aunque la tabla opcional de partidas E2 no exista; si existe, conserva esas partidas dentro del mismo snapshot. Pruebas de lectura consistente, legado y alcance. |
| `src/app/api/documentos/route.ts` | Distingue selección inválida (400) de fallo interno (503), sin devolver SQL al cliente. |
| `src/lib/documentos/paquete.ts`, `paquete.test.ts` | Identidad/caducidad coherentes al leer archivos; error de límite de tamaño por documento; sólo cuenta bytes escritos. Pruebas de progreso, parciales, identidad y caducidad. |
| `src/lib/documentos/pdf.ts`, `pdf.test.ts` | Nombres largos remiten a fichas completas; rótulos coincidentes se separan y se pintan después de los símbolos, sin mover coordenadas ni cambiar escala. |
| `src/lib/documentos/tablas.ts`, `tablas.test.ts` | Cabeceras legibles con los botones del autofiltro en Excel. Invariantes de reservas externas, BOM adicional y cero frente a precio ausente. |
| `e2e-gate/documentos.config.ts`, `documentos.spec.mts` | URL local configurable; ocultar equipamiento en el plano antes de exportar conserva toda la BOM y no registra edición. |
| `src/components/documentos/exportador.tsx`, nuevo `exportador.test.tsx` | Una respuesta antigua de recuperación no sustituye una generación nueva ni borra su identificador. Si la nueva es parcial, conserva el último completo recuperado. |

## Verificación actual

Las evidencias de esta iteración están en `output/e1-revalidacion/` y los
archivos del gate y las descargas en `output/e1-documentos/` del worktree.
Se vuelve a ejecutar cada check; no se presentan como actuales los resultados
guardados el día anterior.

| Check | Resultado observado | Evidencia |
|---|---|---|
| Pruebas de E1 y cálculos/capas relacionados | 122/122, cero fallos u omitidas | `pruebas-e1-post-revision.log` |
| `DATABASE_URL= npm run build` | Exit 0, Turbopack; sin BD | `build-post-revision.log` |
| `npm run typecheck` | Exit 0 | `typecheck-post-revision.log` |
| ESLint de fuentes/scripts/E2E de E1 | Exit 0 | `lint-post-revision.log` |
| E2E real en Chrome local | 3/3, escritorio antes de móvil; filtros, permisos y fallo parcial | `e2e-post-revision.log`, capturas y `e2e-permisos.json` |
| Gate Postgres + formatos | Exit 0: snapshot estable, XLSX/CSV/ZIP reabiertos, descarga idéntica | `gate-documentos-final.log` y manifiestos/ZIP |
| PDF | 43 PDF / 222 páginas renderizadas e inspeccionadas; 14 pruebas PDF pasan | `pdf/gate-pdf.json`, `pdf/descargados-finales/gate-descargados-finales.json` y renders |
| XLSX | 6 libros / 7 hojas, 19 renders, tipos/totales/vacíos y acentos; cero errores de fórmula | `tablas/` JSON/NDJSON/PNG |
| Excel nativo | Material y Cables abiertos sin reparación; precios vacíos, acentos, metraje y cabeceras comprobados | `excel-nativo-observaciones.json`; capturas/AX CUA en la conversación |
| BD sintética | 38 tablas idénticas antes/después | `control-bd-final.json` |

Los PDF descargados de sala y obra se reabrieron y se reconciliaron con el
manifiesto: nueve PDF, 55 páginas dentro del total anterior. Los hashes de los
bytes descargados coinciden con los originales. Los PDF de plano/elevación
conservan su escala vectorial; el esquema lógico se identifica sin escala.
Se inspeccionan medidas ausentes, estimados, nombres/cajetines largos, puertas
sin medir y mosaicos. No se realiza impresión física: se indica imprimir al
100 %.

Los totales sintéticos de la BOM son 2.367,79 € conocidos / 1.550,50 € a comprar
para la sala y 4.430,79 € / 2.350,50 € para las dos salas. El metraje conocido es
11,47 m / 14,47 m. Importes ausentes se conservan vacíos; el subtotal conocido
se identifica como parcial. Un filtro nunca se recibe como alcance de la BOM.

La huella de las 38 tablas de prueba es
`eaf39e2838c39cf5005c1fea4b191e126d63479fa9ab4e28b2f3281ef8669fd4`
en todas las fotografías. Las pruebas de MVCC y retirada de permiso hacen
cambios temporales exclusivamente en esa fixture y restauran exactamente el
estado; generar/descargar documentos no escribe diseño, precios, reservas ni
stock.

## Checks globales y trabajo ajeno

`npm test` sobre el snapshot completo después de la corrección da 707/708: falla la prueba JPEG
de `src/lib/catalogo-tecnico.test.ts` de E2, ya fallida antes de nuestras
correcciones (694/695). No se omite ni repara esa prueba dentro de E1.
ESLint de todas las fuentes de ese snapshot falla también en el efecto de
`src/components/importacion/importador.tsx` de E2; las fuentes de E1 pasan.
`npm run lint` además recorre los artefactos `output/` y `.next-e1-documentos/`;
se conservan el log bruto y la ejecución separada sobre fuentes.

Durante esta ejecución el checkout original recibe cambios E2 concurrentes.
`original-drift.json` identifica ocho archivos que difieren de la fotografía
inicial durante la revisión; al cierre, `original-drift-final.json` identifica
20 archivos, incluidos schema y lectores compartidos de ese trabajo ajeno.
No se sobrescriben ni se incorporan a escondidas al worktree E1.
El lint actual del checkout original pasa con tres warnings, evidenciando esa
diferencia; no se afirma que el fallo E2 del snapshot continúe en su versión
actual. No hay modificaciones de nuestra parte al checkout original salvo la
registración Git del worktree aislado. Los archivos E2 conservados en el
worktree son contexto, no entrega aprobada por esta conversación.

## Reproducción local

Trabajar desde la ruta del worktree indicada al inicio. La BD y el servidor
actuales usan loopback:5545 y localhost:3102, respectivamente. Nunca se carga
`.env.local` del checkout original ni se usa su seed de inventario.

Primera preparación en un contenedor nuevo y vacío:

```sh
docker run --name av_design_e1_revalidacion_20261014_db -d \
  -p 127.0.0.1:5545:5432 -e POSTGRES_DB=av_design_e1_prueba \
  -e POSTGRES_USER=av_design_e1 -e POSTGRES_PASSWORD=av_design_e1_local \
  postgres:17-alpine

DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5545/av_design_e1_prueba \
  node --import tsx scripts/documentos-fixture.mts --schema --aplicar --foto=inicial
```

Omitir la creación y `--schema` si ya está preparado. El script comprueba URL,
identidad real y base vacía antes de escribir; rechaza otros destinos. No reset.

```sh
DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5545/av_design_e1_prueba \
SESION_SECRETO=e1-local-prueba-documentos-secreto-2026 AV_DOCUMENTOS_PRUEBA=1 \
NEXT_DIST_DIR=.next-e1-documentos npm run dev -- --hostname localhost --port 3102

DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5545/av_design_e1_prueba \
  node --import tsx scripts/verificar-documentos.mts

DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5545/av_design_e1_prueba \
DOCUMENTOS_BASE_URL=http://localhost:3102 \
  node node_modules/@playwright/test/cli.js test --config=e2e-gate/documentos.config.ts

npm test
DATABASE_URL= npm run build
npm run typecheck
git diff --check
```

Entrada sintética: `prueba-doc-admin` / `Prueba-doc-01-local!`.
Sala: `http://localhost:3102/salas/e1000000-0000-4000-8000-000000000010/documentos`.
El fallo PDF simulado se habilita sólo en desarrollo con la variable de prueba;
en producción el header se ignora.

## Límites y estado de entrega

Se mantienen los límites de E1: 20 salas, 50 MiB por paquete, 200 páginas por
PDF y conservación temporal de 30 minutos por usuario. Reabrir el paquete
usa los archivos guardados, con los mismos bytes y revisión. Otra generación
lee un snapshot nuevo y obtiene otro identificador. La retención no es
historial de diseño ni almacenamiento compartido entre instancias; los
reinicios o discos independientes pueden hacer perder el acceso temporal.

La revisión independiente y su corrección final se registran debajo. No hay
commit, push, merge, despliegue ni cambios de producción. HEAD permanece en
`f38baa8`, detached, con todos los cambios locales revisables en el worktree.

## Revisión independiente y única corrección

El revisor recibió fuentes, contrato y evidencia cruda, sin informes ni
conclusiones de los ejecutores. Reejecutó 210 pruebas (210 pasan), reabrió los
seis XLSX sin modificar originales y contrastó servidor, snapshot, paquete y
una muestra visual. Su alcance y límites están en
`output/e1-revalidacion/revision-independiente.md`.

Encontró un único P2 confirmado en el exportador preexistente: un GET inicial
lento podía responder después del POST nuevo y sustituir el paquete visible,
mientras URL y almacenamiento ya tenían el identificador nuevo. El repro y
su salida previa se conservan en `repro-recuperacion.tsx` / `.log`.

Se realiza una sola corrección: secuencias de generación impiden actualizar
el resultado con una recuperación anterior; un completo nuevo tiene
precedencia, y un parcial nuevo conserva el último completo recuperado. Un
GET antiguo caducado sólo puede borrar su propio identificador almacenado.
No se modifican datos, generadores, formatos ni permisos en esta corrección.

El gate determinista `exportador.test.tsx` monta el componente real y resuelve
las respuestas en el orden que causaba el fallo. Sus tres casos pasan:
completo nuevo frente a GET viejo; GET viejo caducado; parcial nuevo con
último completo tardío. Evidencia: `correccion-recuperacion.log`.

Los checks después de la corrección se conservan con sufijo `post-revision`;
los anteriores permanecen como evidencia del orden de revisión. No se abre
una segunda ronda de implementación/revisión ni se modifica E2 para conseguir
que sus checks globales parezcan pasar.

Gate posterior: 122/122 pruebas E1/cálculos/capas/cliente, 3/3 E2E, build
Turbopack sin BD, typecheck y lint E1 con exit 0. `npm test` global conserva
707/708 por el mismo JPEG E2 previo del snapshot, sin omitidas. Los nueve
PDF descargados tras esta corrección vuelven a renderizarse e inspeccionarse
(55 páginas); los anteriores se conservan en `descargados-pre-correccion-cliente/`.
Revisión final de sala `DOC-0c8bae066865-14e76650`; obra
`DOC-e945690e0edc-292f3631`. ZIP de obra descargado:
`15641ecd4f5441246997950120e9c67b2f03321eb5b2ed25632cd1a41e66872f`.

| Contrato | Resultado local |
|---|---|
| AVX-01 | Cumplido en fixtures y archivos reales: cajetín, escala/papel, paginado, revisión y ausencias; inspección de todas las páginas. |
| AVX-02 | Cumplido: BOM consolidada de sala/selección, stock sin duplicar, tipos numéricos y precios distinguibles; XLSX/CSV y Excel real comprobados. |
| AVX-03 | Cumplido: selección, progreso, errores/ZIP parcial, último correcto conservado, permisos, identidad de descarga y carrera de recuperación corregida. |

Los límites de retención/instancia/impresión y los checks globales E2 anteriores
siguen explícitos. Ningún criterio de E1 queda pendiente dentro de ese alcance
local; no se declara validación ni disponibilidad de producción.

Pruebas focalizadas reproducibles después de la corrección:

```sh
node --import tsx --test 'src/lib/documentos/*.test.ts' \
  src/components/documentos/exportador.test.tsx src/lib/calculo-cable.test.ts \
  src/lib/compras.test.ts src/lib/material-bom.test.ts src/lib/cable-schedule.test.ts \
  src/components/plano-editor/capas-plano.test.ts

npx eslint src/lib/documentos src/app/api/documentos src/components/documentos \
  'src/app/salas/[id]/documentos/page.tsx' 'src/app/proyectos/[id]/documentos/page.tsx' \
  e2e-gate/documentos.config.ts e2e-gate/documentos.spec.mts \
  scripts/documentos-fixture.mts scripts/verificar-documentos.mts
```

`output/e1-revalidacion/delta-e1.patch` contiene únicamente los cambios de esta
iteración frente a la base local capturada; no mezclar con el diff a HEAD, que
incluye E1/E2 anteriores. `archivos-iteracion.json`, hashes, estado Git y
resolución de revisión permiten identificar exactamente lo entregado.

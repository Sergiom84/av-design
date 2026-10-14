# E1 · Implementación y verificación local

13-10-2026. Alcance AVX-01, AVX-02, AVX-03. Base `main`,
`f38baa805a1868b7cad55bb97064386e9b5f8555`, limpia antes de empezar. Trabajo
en `/Users/sergio/Desktop/Aplicaciones/AV_design`, sin worktree adicional al
no existir trabajo ajeno en el checkout. No se hizo fetch ni se tomó como base
el commit adicional de la referencia local `origin/main` (solo `.mcp.json`).
Sin commit, push, despliegue, migración ni conexión a producción.

## Cambios

| Archivo o carpeta | Motivo |
|---|---|
| `src/lib/documentos/modelo.ts`, `seleccion.ts` | Contrato de formatos, selección validada y permisos por sección |
| `src/lib/documentos/datos.ts`, `src/lib/db.ts` | Snapshot con los lectores actuales dentro de lectura consistente y de solo lectura |
| `src/lib/documentos/pdf.ts` | PDF vectorial desde las escenas existentes, escala física, mosaico, cajetín y ausencias |
| `src/lib/documentos/tablas.ts`, `csv.ts` | BOM consolidada, tablas numéricas, precios ausentes/orientativos y CSV seguro |
| `src/lib/documentos/paquete.ts` | ZIP, manifiesto con hashes, progreso y errores por documento, propiedad y caducidad |
| `src/app/api/documentos/` | Generación y descarga protegidas en servidor, sin depender del layout |
| `src/components/documentos/exportador.tsx` | Selector, progreso, descargas y conservación del último paquete completo |
| `src/app/salas/[id]/documentos/page.tsx` | Sustituye el pendiente por exportación; conserva enlaces existentes y corrige el de Diagrama |
| `src/app/proyectos/[id]/documentos/page.tsx`, portada de obra | Selección de salas reutilizando el mismo exportador |
| `src/lib/documentos/*.test.ts` | Escala, paginación, totales, null/cero, stock único, CSV y permisos |
| `scripts/documentos-fixture.mts`, `verificar-documentos.mts` | Fixture guardada por destino, gates de BD/archivos y concurrencia |
| `e2e-gate/documentos.{config.ts,spec.mts}` | Flujo escritorio, permisos de API y móvil al cierre |
| `package.json`, lock, `next.config.ts` | PDFKit, ExcelJS, fflate, tipos PDFKit, descubrimiento de tests y assets de PDFKit |
| `.gitignore`, `tsconfig.json` | Caché independiente del servidor local y tipos de rutas generados |
| `docs/07-roadmap.md` | Nota de entrega local fechada, conservando el contexto histórico |

No se modifican fórmulas de cable, catálogo fuente, identificadores de cable,
tablas de producción ni fuentes históricas de Xtenav.

## Evidencia verificable

Todos los artefactos se conservan en `output/e1-documentos/` (ignorado en Git):

- `gate-resultados.json`, manifiestos, CSV, XLSX y ZIP: comparación con funciones
  actuales, formatos reales reabiertos, archivos/hashes coherentes y repetición
  de descarga con los mismos bytes.
- `pdf-validacion/resultado.json`, `indice.json`, PNG y 25 contactos: 16 PDF,
  86 páginas; A4/A3, vertical/horizontal, escala 1:50, mosaico 1:20 y casos
  incompletos. Todas las páginas inspeccionadas; cajetín y paginado presentes.
  La prueba de escala comprueba las dimensiones vectoriales en puntos de papel.
- `e2e-pdf-verificacion.json`: las seis descargas PDF de las dos tandas E2E,
  36 páginas y 10 contactos, renderizadas e inspeccionadas sin modificar los
  originales. Cajetín/paginado completos y cero texto fuera del papel.
  El repro final de nombres largos añade tres páginas inspeccionadas.
- `xlsx-artifact-verificacion.json` y PNG: importación e inspección de los
  libros reales con Artifact Tool, cero errores de celda. ExcelJS comprueba
  tipos numéricos y nulos. Apertura nativa en Microsoft Excel de Material y
  Cables: acentos, unidades, `N13` vacía, metraje numérico y subtotales.
  `excel-cables-nativo.png` conserva la captura nativa.
- `e2e-resultados.json`, reporter HTML, trazas, capturas y descargas: escritorio
  completo antes de móvil, selección de obra, descarga real, error parcial y
  permisos. `e2e-consola.json` recoge errores de página.
- `e2e-permisos.json`: sección oculta/BOM restringida 403; otra obra 400;
  otro propietario 404; retirar el permiso bloquea la siguiente petición
  metadata y descarga con la misma cookie. El permiso se restaura al terminar.
- `gate-concurrencia.json`: lectura consistente mantiene 800 mientras otra
  conexión confirma 801; fuera se ve 801; escritura en lectura rechazada.
  El dato original se restaura y se compara el estado de todas las tablas.
- `bd-gate-antes/despues.json`, `bd-e2e-antes/despues.json`: 38 tablas con el
  mismo SHA-256 `f1879f687e0791a86bd18f74d0cfae24dbe388ddefd595f52db11b8db247b064`.

La fixture se limita al contenedor `av_design_e1_prueba_db`, base
`av_design_e1_prueba`, usuario `av_design_e1`, loopback, puerto 5544. Se rechaza
cualquier otro destino antes de aplicar schema o escribir. No se usa el seed
de inventario real ni se reinicia la BD habitual. La fixture es idempotente.

## Reproducción

Desde la raíz del proyecto, con Docker disponible:

```sh
docker run --name av_design_e1_prueba_db -d \
  -p 127.0.0.1:5544:5432 \
  -e POSTGRES_DB=av_design_e1_prueba \
  -e POSTGRES_USER=av_design_e1 \
  -e POSTGRES_PASSWORD=av_design_e1_local postgres:17-alpine

DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba \
  node --import tsx scripts/documentos-fixture.mts

DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba \
  node --import tsx scripts/verificar-documentos.mts

DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba \
  node --import tsx scripts/verificar-documentos.mts --solo-concurrencia
```

Si el contenedor ya existe y está encendido, se omite `docker run`. Servidor
local en una terminal independiente:

```sh
DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba \
SESION_SECRETO=e1-local-prueba-documentos-secreto-2026 \
AV_DOCUMENTOS_PRUEBA=1 NEXT_DIST_DIR=.next-e1-documentos \
  npm run dev -- --hostname localhost --port 3101
```

`AV_DOCUMENTOS_PRUEBA` habilita únicamente en desarrollo el header
`x-av-prueba-fallo-pdf`, usado por el test para fallar un PDF. En producción
ese header se ignora, aunque estuviera configurada la variable.

```sh
DOCUMENTOS_DATABASE_URL=postgres://av_design_e1:av_design_e1_local@127.0.0.1:5544/av_design_e1_prueba \
  node node_modules/@playwright/test/cli.js test --config=e2e-gate/documentos.config.ts

npm test
DATABASE_URL= npm run build -- --webpack
npm run typecheck
git diff --check
```

E2E usa Chrome instalado. El build Webpack termina; el build Turbopack de este
entorno falla al crear un proceso interno que intenta abrir un puerto. Los
logs de ambos están conservados. La advertencia de middleware obsoleto y la
advertencia interna de Next/Edge se conservan; no se migra autenticación en E1.

Para entrar manualmente en la fixture: usuario `prueba-doc-admin`, contraseña
sintética `Prueba-doc-01-local!`; sólo existe en la BD aislada. Sala:
`http://localhost:3101/salas/e1000000-0000-4000-8000-000000000010/documentos`.

## Límites de E1

- Hasta 20 salas, 50 MiB de documentos correctos por paquete y 200 páginas
  por PDF. Un documento que excede el límite falla y conserva los demás.
- Retención temporal 30 minutos por usuario. La misma descarga conserva bytes
  y revisión; otra generación crea una revisión nueva. Los caducados se
  eliminan al acceder o al generar otro paquete. Reinicios o instancias con
  discos separados pueden hacerlos inaccesibles: no se implementa AVX-06.
- Plano y elevación se imprimen al 100 % para conservar escala. El esquema
  lógico es sin escala; el panorama se acompaña de fichas con serigrafías
  completas. No se añaden dimensiones físicas de producto inexistentes.
- Las cantidades de equipos sin referencia de catálogo y el cable sin
  artículo/cálculo se advierten; no se fabrican referencias ni metrajes.
- BOM de obra usa el stock una vez. La necesidad por sala no repite stock.
  Los subtotales conocidos pueden ser parciales; no son presupuesto comercial.
- El override de `exceljs.uuid` elimina los dos avisos nuevos del primer
  audit. Permanecen 12 avisos de dependencias anteriores (11 altos, 1 crítico),
  fuera del alcance de E1; no se aplica una actualización global de Next.

## Revisión independiente y cierre

El revisor recibió artefacto, contrato y evidencia cruda, sin el informe ni
la conclusión de los ejecutores. Encontró tres P2, registrados sin reescribir
su informe en `output/e1-documentos/revision-independiente.md`:

| Hallazgo | Corrección | Gate posterior |
|---|---|---|
| Recargar un parcial perdía el enlace al completo | Restaurar también el identificador completo de sessionStorage | E2E completo → parcial → recarga → descarga anterior con bytes idénticos |
| Nombres/códigos largos invadían metadatos del cajetín | Medir identidad, metadatos y encabezados antes de paginar | Dos regresiones PDF; repro A4 vertical renderizado, literales completos y separación geométrica de los campos |
| UUID con prefijo igual y código igual colisionaban | Usar UUID completo en cada nombre de archivo | Prueba ZIP con dos salas, mismo código/prefijo, dos archivos, manifiesto y todos los hashes correctos |

Una revisión, una corrección conjunta y gate determinista. No quedaron
hallazgos funcionales confirmados abiertos después de esos gates.

| Check final | Resultado | Evidencia |
|---|---|---|
| `npm test` | 681 pruebas, 144 suites; cero fallos u omitidas | `npm-test-final.log` |
| Build Webpack, sin BD | Exit 0 | `build-final.log` |
| `npm run typecheck` | Exit 0 | `typecheck-final.log` |
| ESLint de código/scripts/E2E cambiados | Exit 0 | `lint-final.log` |
| E2E final | 3/3; escritorio, permisos, móvil; sin errores de página | `e2e-final.log`, `e2e-resultados.json` |
| Gate de BD/archivos final | Exit 0; 38 tablas sin mutación | `final-pdf-gate.log`, `gate-resultados.json` |
| PDF escala/cajetín/paginado | 12/12 y revisión visual final | `final-pdf-unit.log`, `pdf-validacion/` |
| XLSX finales reabiertos y renderizados | Tres libros; cero errores de celda | `xlsx-verificacion-final.log`, `xlsx-artifact-verificacion.json` |
| PDF descargados del navegador | 6 PDF / 36 páginas; hashes intactos y revisión visual completa | `e2e-pdf-verificacion.json` |
| `git diff --check` | Sin errores | Ejecutado al cierre |

AVX-01, AVX-02 y AVX-03 cumplen sus criterios locales dentro de los límites
indicados. Los comandos para Turbopack permanecen bloqueados por el entorno,
con alternativa Webpack verificada. El HEAD sigue en `f38baa8`; los cambios
se entregan sin commit, en `main` (un commit por detrás de la referencia local
`origin/main`). La validación descrita es local; producción no se ha tocado.

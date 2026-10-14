# E2 · Fuentes de catálogo y precios revisables

Entrega local de 14-10-2026, retomada desde `13-e2-continuidad-local.md`.
AVX-14, AVX-15, AVX-16 y AVX-18 personal implementados. Trabajo en
`/Users/sergio/Desktop/Aplicaciones/AV_design`, rama `main`, HEAD
`f38baa805a1868b7cad55bb97064386e9b5f8555` durante la implementación.
Al cerrar las verificaciones E1 y E2 estaban sin commit, sin fetch, publicación
ni conexión a producción. El usuario autorizó después commit y push: se prepara
su publicación en `codex/e1-e2-local`, desde `adacf0e` de `origin/main`, sin mover
`main` ni activar su autodespliegue. El SHA publicado se comprueba con Git.
La siguiente conversación parte de [PROMPT_CONTINUACION_E3.md](PROMPT_CONTINUACION_E3.md).

## Qué se entrega

| Contrato | Comportamiento local |
|---|---|
| AVX-14 | CSV/XLSX → revisión → elección explícita → confirmación atómica → informe y archivo original → reversión atribuible. Coincidencias literales, variantes distintas y ambigüedad con elección de ID. Catálogo y BOM son destinos separados. |
| AVX-15 | Ofertas nuevas `app`, proveedor/presupuesto/fecha/EUR-USD/unidad de compra/paquete/origen revisables. Vigencia y cambio parametrizados; coste previo/propuesto y resultado. Ofertas anteriores y pedidos congelados intactos. |
| AVX-16 | Dimensiones parciales mm/cm/m y RU, modelo exacto y procedencia HTTPS/fecha. Imagen/ficha durables en Postgres, hash y descarga protegida. Dimensiones congeladas en equipo/plantilla, incluida ausencia legado. Búsqueda sólo por atributos verificados. |
| AVX-18 | Favoritos personales por usuario real, reversibles, filtro explícito y motivos visibles. Referencias retiradas siguen accesibles. No altera modelos, puertos, precios o equipos de obra. |

La BOM importada es material **adicional**: se suma a equipos y cable calculado
mediante `necesidadDeSala`. No crea posiciones, equipos ni conexiones. Quien
importa debe excluir cantidades ya incluidas en el diseño; la pantalla lo dice.
Cada confirmación conserva original/hash, procedencia, propietario, filas e
informe. La revisión no escribe. Archivo/catálogo/parámetros cambiados invalidan
la confirmación pendiente. No hay PDF/OCR/IA ni investigación nueva de Xtenav.

Revertir conserva versiones posteriores, dependencias ajenas, compromisos de
BOM, edición A→B→A y decisiones posteriores de coste; informa de lo conservado.
Una reversión parcial es un resultado deliberado, no una eliminación por cascada.
El historial del lote conserva su fuente después de revertir. Esto no introduce
historial de diseño AVX-06. Cada acceso vuelve a comprobar permisos y propiedad.

## Archivos y motivo

| Archivos/carpeta | Cambio |
|---|---|
| `src/lib/importacion/`, `importacion.test.ts` | Parseo acotado, normalización de OOXML válido para ExcelJS, matching literal, revisión/hash, precios vigentes, transacciones y reversión |
| `src/lib/importacion-http.ts`, `src/app/api/importacion/` | Sesión/permisos/propiedad/origen y límites de cuerpo; preview, confirmar, consultar, fuente y revertir |
| `src/components/importacion/`, `src/app/catalogo/importar/` | Flujo revisable y presentación de material adicional |
| `src/lib/compras.ts`, `datos-material-bom.ts`, `datos-almacen.ts` | Partidas BOM en el cálculo único de necesidades, reservas/compras y referencias utilizadas retiradas |
| `src/lib/documentos/{modelo,datos,tablas}.ts` | Material adicional dentro del snapshot coherente y exportación E1; stock global sigue contado una vez |
| `src/lib/catalogo-tecnico*.ts`, componentes y API `catalogo-tecnico/` | Datos técnicos, búsqueda, archivos y permisos; decodificación real acotada de imágenes |
| `src/lib/catalogo-favoritos*.ts`, componentes y API `catalogo-favoritos/` | Preferencias personales, sin ranking opaco ni sustituciones |
| `src/app/acciones.ts`, `src/lib/datos.ts` | Copia de dimensión congelada/ausencia, catálogo manual `app`, usos de BOM visibles |
| Páginas catálogo, artículo y equipamiento | Entradas a importación, datos técnicos y favoritos; material adicional de sala |
| `scripts/generar-seed.mjs` | Regeneración CSV conserva catálogo escrito/importado en app; precios y puertos app ya protegidos |
| `db/schema.sql`, tres migraciones E2 y `rollback/2026-10-e2.sql` | Estructura versionada, versiones para reversión, bytes durables y snapshot técnico |
| `scripts/importacion-fixture.mts`, `verificar-importacion*.mts`, `preparar-seed-importacion.mjs`, `e2e-gate/importacion.*` | Fixture sintética, gates reproducibles y siembra conflictiva aislada |
| `package.json`, lock | Sharp 0.35.3 declarado directo para decodificar imágenes. Ya estaba instalado como dependencia de Next; no se cambia framework ni versiones de dependencias de E1. |
| `.gitignore`, `tsconfig.json` | Cachés independientes y tipos generados de los servidores/builds locales |

Los CSV reales de `data/` y `db/seed.sql` no se modifican. Los datos técnicos no
cambian la simbología, el plano ni las fórmulas de cable. No se carga Cisco ni
se resuelve composición de kits. Cualquier precio importado cero queda pendiente;
los ceros existentes y los precios ausentes se conservan distintos.

## Entorno y migraciones

Sólo se escribe en la fixture `PRUEBA-IMPORT-01`, base `av_design_e2_prueba`,
usuario `av_design_e2`, loopback **5546**, servidor Postgres 5432. Cada escritor
comprueba URL e identidad real antes de escribir. No usa la BD habitual.

El 14-10 los puertos 5545 y 3102 estaban ocupados por otra verificación local.
No se detuvo ni modificó ese trabajo. Se reabrió el volumen original E2 en
`av_design_e2_prueba_20261014_db`; el contenedor E2 original permanece detenido.
**No arrancar ambos sobre el mismo volumen.** App de prueba: `localhost:3103`.

Migraciones aplicadas únicamente a esta base sintética:

- `db/migraciones/2026-10-e2-importacion.sql`
- `db/migraciones/2026-10-e2-tecnico.sql`
- `db/migraciones/2026-10-e2-favoritos.sql`

También están incorporadas a `db/schema.sql`. No se aplican automáticamente a
producción. El rollback estructural sólo admite la base/usuario de prueba y
rechaza datos E2, favoritos o snapshots existentes. Su rechazo conserva el hash
de todas las tablas. No es una orden para borrar archivos/reportes históricos:
la reversión de un lote vive en la aplicación y conserva esa trazabilidad.

## Verificaciones y evidencia

Todo en `output/e2-importacion/`; está ignorado por Git y debe conservarse aparte.
Comandos completos en `gates/README.md` y resultados crudos con códigos de salida.

| Gate | Resultado/evidencia |
|---|---|
| `npm test` | 734 pruebas, 151 suites, cero fallos/omitidas; `npm-test-final.log` |
| Build Webpack sin BD | Exit 0; `build-final.log` |
| Tipos y ESLint | Exit 0; `typecheck-final.log`, `lint-final.log` y lint de gates |
| Core CSV/XLSX/Postgres | Preview sin escritura, selección, fallo atómico, reversión, ofertas, unidades/monedas/fechas, null/cero, técnica/favoritos; `gates/gate-core.log` y tanda final |
| Navegador | Escritorio completo y permisos, técnico/favorito/copia real de plantilla; móvil al cierre. Capturas, descargas y reportes `gates/e2e-*`; tanda final después de corrección |
| Snapshot BOM concurrente | 0/0 dentro de lectura coherente, exterior 1; sólo lectura y hash original restaurado; `gates/snapshot-bom-concurrencia.json` |
| E1 exportación | Snapshot, stock único, CSV/XLSX/PDF/ZIP, hashes y descarga repetida; `gates/e1-preservacion/` sin tocar evidencia histórica |
| PDF | 16 archivos, 86 páginas, 25 contactos inspeccionados; cajetín/paginado y cero texto fuera del papel |
| XLSX | Fuentes sintéticas tipadas inspeccionadas/renderizadas; BOM importada reabierta/renderizada, 3 = 1 equipo + 2 BOM, nulos y stock único preservados |
| Siembra CSV/app | Generador original ejecutado con CSV sólo sintéticos en esquema aislado; catálogo/precios/puertos app idénticos, CSV se regenera; `gates/tanda-final/g1-seed.json` |
| Reversión posterior/ajena | Dependencia de otro usuario, proveedor utilizado, BOM reservada/pedida, ABA y coste posterior conservados; control libre eliminado; `gates/tanda-final/regresiones-*` |
| Imágenes corruptas | WebP sin píxeles, PNG sin paleta y JPEG corrupto rechazados; válida anterior conserva bytes/hash; tres formatos válidos aceptados |

La siembra de regresión se ejecuta en un esquema exclusivo `e2_seed_prueba`
dentro de la misma BD guardada, sin resolver tablas públicas. Se retira sólo
ese esquema sintético al terminar y las 44 tablas públicas mantienen su hash.
Las pruebas de reversión eliminan sólo sus objetos sintéticos temporales y
conservan informes/lotes durables. Los datos de negocio protegidos permanecen.

## Revisión independiente y corrección

El revisor recibió únicamente artefacto E2 frente al snapshot E1, contrato y
salida cruda. Informe original preservado en
`output/e2-importacion/revision/revision-independiente.md`.

Encontró un P2 (PNG/WebP corruptos aceptados por comprobación estructural) y
dos brechas de evidencia (siembra CSV/app conflictiva y reversión con trabajo
posterior/ajeno). Una corrección conjunta y gate determinista:

- Decodificación real con Sharp antes de guardar/descargar, sin cambiar original
  ni hash. Rechazo antes del upsert conserva imagen válida anterior.
- Siembra original con fuentes exclusivamente sintéticas y colisiones app/CSV.
- Reversión con dependencia ajena, reserva/pedido posteriores, edición ABA y
  coste posterior, comparando dependencias y dejando motivos verificables.

El cierre del arquitecto y los resultados finales se registran en
`output/e2-importacion/revision/cierre-gate.md`. No se abre otra ronda ilimitada.

## Límites

CSV UTF-8/XLSX de una hoja, 500 filas y 5 MiB; celdas de texto de 2000 caracteres,
ZIP descomprimido acotado. Columnas documentadas en UI; fórmulas, macros,
objetos activos y enlaces externos se rechazan. No es una importación universal.
Catálogo actualiza descripción/observaciones sin sustituir identidad, puertos
ni coste. Ofertas son nuevas y no pisan presupuesto/artículo ya existentes.
EUR/USD únicamente, usando parámetros existentes. Cero/kit y clasificación de
ofertas no vinculantes siguen sujetos al criterio de negocio, sin cargar Cisco.

Técnica: dos archivos por artículo (imagen y ficha), cada uno máximo 5 MiB.
PNG/JPEG/WebP hasta 8192 px y 16M píxeles, decodificación 64 MiB y timeout 5 s;
ficha PDF. Origen URL HTTPS/fecha/modelo verificado explícitamente por persona;
no scraping ni deducción de datos ausentes. Bytes en Postgres sobreviven a
reinicios de Render; no se ha probado ni modificado ningún servicio de producción.
Los snapshots preparan dimensiones para futuros usos; no redibujan símbolos
ni introducen cálculos de ingeniería.

Favoritos personales de usuario real con catálogo visible; consulta máxima 20,
orden alfabético y motivo visible. No se guarda un filtro global del departamento.
Lotes recientes mostrados: 30 del propietario. Una reversión ya registrada no
se ejecuta otra vez: las filas conservadas se explican en su informe.

E1 conserva retención temporal de 30 minutos y sus límites de 20 salas/50 MiB/
200 páginas por PDF. No se cambia su caché por historial permanente. Las 288
fuentes de evidencia histórica siguen byte a byte iguales; no falta ninguno de
sus 32 archivos iniciales. `preservacion-e1-final.json` registra los cambios
integradores deliberados y las dependencias de E1 sin cambios de versión.
Las advertencias previas de middleware/Next permanecen; no se migra el framework.

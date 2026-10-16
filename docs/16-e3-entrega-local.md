# E3 · Entrega local y cierre de verificación

Fecha: 14-10-2026. E3 implementada localmente, con corrección conjunta de los
hallazgos F1–F5, gates dirigidos del arquitecto y recorrido completo E3 aprobado.
Reinspecciones finales PDF/XLSX aceptadas y tipos/lint con exit0. Conservación
E1/E2 y fuentes protegidas comprobada en `gates/preservacion-final.json`.
El cierre independiente confirma F1–F5 resueltos. El artefacto completo, estado
Git y hashes quedan en `output/e3-revisiones/revision/artefacto-final.patch` y
`artefacto-final.json`. Los resultados siguientes proceden de ejecuciones del
arquitecto, pruebas adicionales del revisor y archivos crudos comprobados.

Ruta: `/Users/sergio/Desktop/Aplicaciones/AV_design`.
Rama y HEAD conservados: `codex/e1-e2-local`,
`7ba796077ff39e799b9b7eb87109b648c3df5c2d`.
E3 es un conjunto de cambios locales sobre E1/E2, sin commit, push, merge a main,
despliegue ni migración de producción. No se ha repetido investigación XTEN-AV.
El contrato de implementación está en `docs/15-e3-especificacion.md`; los criterios
se recuperan del backlog existente AVX-06/07/08/13.

## Qué cambia y por qué

El diseño puede registrarse como revisión nombrada con autor real, fecha, número,
hash, antecedente y snapshot inmutable. Comparar revisiones distingue medidas,
equipos/puertos, rutas físicas, material y presentación visual. Restaurar genera
una revisión nueva; la base esperada se comprueba por `diseno_version` y hash
dentro de una transacción. Los triggers detectan también A→B→A. El catálogo y
los parámetros son contexto histórico: restaurar no modifica esas tablas globales.

El snapshot incluye medidas/mesa/sillas, equipos y dimensiones congeladas,
XYZ/ausencias/giros, posiciones visuales, mobiliario, puertas, rosetas, conexiones,
bocas, puntos de ruta, BOM adicional y anotaciones. Quedan fuera movimientos,
existencias, reservas, pedidos/recepciones, cargas, hitos, visitas, seriales/activos
y favoritos. Los gates comparan esos hechos antes/después. Una dependencia
incompatible debe rechazar la restauración completa, sin cascade operativo.

Duplicar crea otra sala en la misma localización —o conserva el legado— y nuevos
IDs para instancias, conexiones, puntos y notas. Conserva geometría, ausencias,
rotaciones, dimensiones congeladas, puertos y códigos de cable. La BOM copiada
no atribuye sus filas al lote de importación del original. La cabecera y los
entregables identifican las medidas heredadas; la herencia no acredita visita de
campo. La previsualización explica las exclusiones operativas y la comparación
original/copia usa el mismo diff. Guardar como plantilla mantiene la acción existente.

El editor lógico incorpora selección múltiple, alineación, distribución y ordenación
deterministas con altura real de bloques, previsualización, aplicar/cancelar y
deshacer/rehacer. Sólo modifica `esquema_x/y`; no transforma XYZ en píxeles ni
cambia metros, conexiones o orden de alta. Los identificadores de cable se
persisten y un correlativo por sala/señal evita renumerar o reutilizar una etiqueta
cuando se reorganiza o se elimina una conexión.

Las notas usan anclas `sala|equipo|conexion|visual`. Quitar un ancla exige conservar
la nota en sala o retirarla; la guarda se comprueba también en servidor. Símbolos
geométricos propios, texto y trazos permiten reconocer categorías/señales sin
depender sólo del color. UI y PDF consumen el helper compartido. E1 incorpora
referencia de diseño, antecedentes, notas y leyenda desde su snapshot consistente;
la matriz grande añade hojas de detalle a tamaño constante. CSV de cables mantiene
sus 18 columnas; BOM CSV, XLSX y manifiesto añaden la identidad por sala.

## Cambios por carpeta y archivo

La lista se contrasta con el manifiesto final: 64 archivos, 29 modificados y
35 nuevos. La evidencia ignorada de `output/` se conserva aparte.

| Carpeta / archivos | Motivo |
|---|---|
| `db/schema.sql`; `db/migraciones/2026-10-e3-revisiones.sql` | Historial, origen/herencia, versión de diseño, correlativos e identificadores inmutables, triggers que detectan cambios de diseño. El schema incluye el mismo incremento para una base nueva. |
| `db/migraciones/2026-10-e3-anotaciones.sql` | Anotaciones normalizadas, integridad de anclas, protección de bajas y versión de diseño. |
| `db/migraciones/rollback/2026-10-e3.sql` | Rollback estructural restringido a la base sintética y rechazado cuando hay historia, alternativas, notas o códigos persistidos. |
| `src/lib/revisiones-diseno.ts`; `revisiones-diseno.test.ts` | Contrato snapshot/hash, diff físico/visual y comparación de material, remapeo de copias. |
| `src/lib/revisiones-diseno-repositorio.ts` | Lectura consistente, historial, creación/restauración/duplicación transaccionales, pertenencia, autoría, referencias y dependencias. |
| `src/lib/revisiones-diseno-http.ts` | Sesión/permisos vigentes, origen, entrada estricta y acotada, errores y respuestas privadas sin caché. |
| `src/app/api/salas/[id]/revisiones/route.ts`; `revisiones/[revisionId]/route.ts`; `comparar/route.ts`; `duplicar/route.ts`; `anotaciones/route.ts` | APIs de historial, snapshot/restauración, diff, alternativa y anotaciones con validación en servidor. |
| `src/components/revisiones-diseno/panel.tsx`; `src/app/salas/[id]/documentos/page.tsx` | Historial navegable, revisión/diff/restauración y previsualización de alternativa dentro de Documentos; ancho mínimo de tabla con scroll dentro de su contenedor para leer nombre/hash en móvil. |
| `src/app/salas/[id]/layout.tsx` | Aviso común y enlace al original para medidas heredadas. |
| `src/lib/operaciones-diagrama.ts`; `operaciones-diagrama.test.ts` | Organización visual pura, determinista y separada del cableado físico. |
| `src/lib/anotaciones-diseno.ts`; `anotaciones-diseno.test.ts`; `datos-anotaciones.ts` | Modelo/validación de notas, resolución de bajas de ancla y lectura de sala. |
| `src/lib/presentacion-diagrama.ts`; `src/components/diagrama/leyenda-diseno.tsx` | Una fuente para símbolos, estilos por señal y leyenda derivada de lo usado. |
| `src/components/diagrama/herramientas-organizacion.tsx`; `anotaciones-editor.tsx` | Controles accesibles de selección/organización y edición de anotaciones. |
| `src/components/diagrama/use-editor-conexiones.ts`; `use-editor-conexiones.test.tsx`; `editor-conexiones.tsx` | Estado de selección, preview, undo/redo, notas, decisiones de baja y guardado del borrador existente. |
| `src/components/diagrama/lienzo-conexiones.tsx`; `lienzo-conexiones.test.tsx`; `dibujo-esquema.tsx`; `esquema-sala.tsx` | Selección teclado/ratón, etiquetas y notas sobre el mismo SVG, símbolos/trazos; regresión SSR/hidratación. |
| `src/app/acciones-diagrama.ts`; `src/app/salas/[id]/diagrama/page.tsx` | Guardado transaccional de notas/decisiones junto a conexiones, validación de anclas y devolución de IDs/códigos definitivos; aviso accionable para resolver anclas. |
| `src/app/acciones.ts` | Las bajas existentes de equipo/cable detectan notas del ancla y de conexiones hijas antes de escribir y llevan a Diagrama para conservarlas/retirarlas. |
| `src/lib/editor-conexiones.ts`; `src/lib/tipos.ts`; `src/lib/datos.ts` | Propagación del identificador persistido y tipos/lectura de conexiones. |
| `src/lib/cable-schedule.ts`; `cable-schedule.test.ts` | Consumir etiquetas persistidas preservando el fallback del legado y el contrato CSV existente. |
| `src/lib/documentos/datos.ts`; `modelo.ts` | Identidad de diseño, notas y antecedentes leídos dentro del mismo snapshot E1. |
| `src/lib/documentos/pdf.ts`; `pdf.test.ts` | Notas/llamadas, identidad y leyenda en PDF vectorial; detalles de matriz a tamaño constante y límites existentes; rótulos de elevaciones a un lateral y acotados por altura para evitar símbolos, pared y suelo sin mover XYZ. |
| `src/lib/documentos/tablas.ts`; `tablas.test.ts` | Hoja de revisiones en XLSX y metadatos BOM CSV, sin cambiar las 18 columnas de cables; descripción de variantes comerciales en BOM consolidada sin tocar cantidades/stock. |
| `src/lib/documentos/paquete.ts`; `paquete.test.ts` | Referencia por sala en manifiesto, conservando hashes, propietario y descarga E1. |
| `scripts/revisiones-fixture.mts`; `verificar-revisiones.mts`; `verificar-revisiones-regresiones.mts`; `verificar-revisiones-correccion.mts` | Fixture sintética dirigida, identidad de destino y gates de historia/conflicto/rollback/operación; nueve casos deterministas de corrección que revierten íntegramente. |
| `scripts/verificar-documentos-e3.mts`; `verificar-xlsx-obra-e3.mts`; `reusar-regresiones-e1-e3.mts`; `reusar-regresiones-e2-e3.mts` | Exportaciones, dos libros de obra desde el snapshot guardado sin BD y regresiones afectadas con evidencia exclusiva E3 y sin tocar fuentes/evidencia E1/E2. |
| `e2e-gate/revisiones.config.ts`; `revisiones.spec.mts` | Recorrido E3 escritorio antes de móvil, matriz, APIs y exportación real. |
| `src/pruebas/identificadores-e3.test.ts` | Guarda la paridad deliberada entre los prefijos del dominio y los que congela la migración SQL. |
| `.gitignore`; `tsconfig.json` | Caches E3 separados para convivir con otros servidores/builds locales. |
| `docs/15-e3-especificacion.md`; `docs/16-e3-entrega-local.md`; `docs/07-roadmap.md` | Contrato previo, entrega con criterios/evidencia/límites y estado local E3 separado de la historia previa. |

No se añade dependencia: `package.json` y `package-lock.json` conservan su hash
de la base. El cálculo puro del cable no se sustituye.

## Destinos y retención

| Uso | URL admitida / identidad real | App y evidencia |
|---|---|---|
| E3, PRUEBA-REV-01 | `127.0.0.1:5547/av_design_e3_prueba`, usuario `av_design_e3`; `current_database()=av_design_e3_prueba`, `current_user=av_design_e3`, `inet_server_port()=5432` | `http://localhost:3105`, `.next-e3-revisiones`, `output/e3-revisiones/` |
| Regresiones E2 reusadas | `127.0.0.1:5548/av_design_e3_regresiones`, usuario `av_design_e3_regresiones`; base/usuario iguales a esos nombres y puerto servidor `5432` | `output/e3-revisiones/regresiones-e2/` |

Los escritores exigen la variable explícita, rechazan otro host/puerto/base/usuario
y verifican identidad real antes de escribir. No leen `.env.local` como destino.
No se ejecutan `seed` o `db:reset` habituales ni se escribe en el inventario real
o los contenedores E1/E2 anteriores. La siembra E2 reusada usa fuentes sintéticas
en la nueva base 5548.
Nombres/volúmenes y bindings capturados en `gates/destinos-docker.jsonl`:
`av_design_e3_prueba_20261014_db`, volumen
`6abcbba2cdca29b2564b1d4571a928600d139c249e73d847b1992293e131e343`,
binding `127.0.0.1:5547`; `av_design_e3_regresiones_20261014_db`, volumen
`864c5eed58c7a9964653912f981ec0a70222c01695b082c6405b60f135666c06`,
binding `127.0.0.1:5548`. Son volúmenes separados y los datos están en
`/var/lib/postgresql/data` dentro de cada contenedor. No iniciar contenedores previos.

`PRUEBA-REV-01` reutiliza exclusivamente la fixture sintética E1 en la base E3,
añade BOM y hechos sintéticos protegidos, sala legado, obra cerrada y matriz de
15 equipos/24 bocas/100 conexiones. La preparación de schema sólo acepta base
vacía; la fixture existente se conserva. No resetea para conseguir un resultado.

Historial durable sin purga automática ni borrado desde la aplicación, 50 revisiones
por página, snapshot máximo 5 MiB. API mutante: cuerpo máximo 16 KiB y nombre
de revisión/alternativa 1–160 caracteres. Notas: máximo 200, texto 1–1.000
caracteres y coordenadas visuales finitas. Son límites de E3, separados de E1:
retención de paquetes 30 minutos, máximo 20 salas, 50 MiB y 200 páginas por PDF.
La matriz de esta fixture ocupa 52 páginas A3 o 90 A4, con detalles de lectura
constante; el conjunto es una vista general y no sustituye esos detalles. El
historial no libera reservas ni revierte recepciones: una restauración que reduce
necesidad comprometida de equipo o cable se rechaza íntegramente, aunque no exista
BOM adicional. Resolver el compromiso operativo es otro flujo de negocio.

## Criterios AVX y evidencia al corte

| Criterio | Implementación y evidencia disponible | Estado de aceptación local |
|---|---|---|
| AVX-06: revisión inmutable consistente, autor/fecha | Core registra snapshot; lectura antes/después; UPDATE/DELETE rechazados; serializable y versión/hash con ABA. R1 sin antecedente, R2→R1 y borrador→R2 en `arquitecto-correccion.log`. | Dominio/gates, recorrido E3 y referencias finales de exportación aprobados. |
| AVX-06: diff equipo/puertos/rutas/medidas, física distinta de visual | Pruebas puras, `diff.json` y material derivado; contexto de mobiliario incluido sin cambiar dimensiones congeladas. E2E comprueba dirección anunciada al seleccionar las dos revisiones en ambos órdenes. | Corregido y aprobado en los gates actuales. |
| AVX-06: restauración nueva, conflicto y hechos intactos | Core, 8/8 regresiones y 9/9 corrección: reservas, pedidos de sala/obra, carga y movimiento impiden reducir necesidad; cada rechazo mantiene hash íntegro de diseño/historial/operación. | Corregido y aprobado; ningún compromiso operativo se deshace. |
| AVX-07: 15 equipos/24 bocas, preview/undo y 100 conexiones | `e2e-e3-aceptacion.log`: caso matriz y móvil; `navegador/matriz-invariantes.json`, capturas de selección/preview; pruebas cliente/puras. | 4/4 recorrido E3 completo, escritorio antes de móvil. |
| AVX-08: anclas/baja/nota al PDF | Notas, decisión de baja, guarda SQL y aviso de otras superficies; E2E, PDF real y `documentos/verificada/` con 26 notas principal/alternativa. | Navegador y reinspección PDF final aprobados: 26/26 notas y 20/20 rótulos físicos sin cruce. |
| AVX-08: leyenda usada y símbolos en pantalla/impresión | Helper UI/PDF, forma/trazo/texto propios; inspección de 186 páginas, cierre de rótulos y paridad estricta de las seis exportaciones sin cambios de cuerpo/geometría. | Aprobado en pantalla y documentos; cero imágenes raster. |
| AVX-13: copia con IDs nuevos, ausencias/giros y sin operación | Core y E2E de alternativa, comparación original/copia, IDs nuevos/herencia/BOM sin lote; 9/9 corrección demuestra copia con necesidad2 y sin reserva2. Ausencia técnica JSON null tras catálogo posterior. | Implementado y recorrido aprobado; guardar como plantilla conserva la acción existente. |
| E1/E2 conservadas | E1 reusado 3/3; E2 dos scripts exit0 en 5548 y seis regresiones app/CSV/dependencias/ABA/coste posterior/imágenes corruptas. | Gates aprobados; 642/642 evidencias históricas y 15/15 fuentes protegidas idénticas. |

Los ocho gates dirigidos en `gates/arquitecto-regresiones.log` comprueban borrador
tras ABA, BOM comprometida/atribuida, códigos no reutilizados/inmutables, ausencia
técnica JSON null y BOM copiada sin lote; los casos adicionales revierten su
transacción y el rollback estructural se prueba en esquema exclusivo. El hash de
todas las tablas públicas es idéntico antes/después de esos casos.

Las copias de gates E2 conservan fotos crudas. La comparación de negocio exceptúa
sólo `salas.diseno_version` y `salas.actualizado_en`: tras cambiar y revertir diseño
el contador E3 sigue aumentando deliberadamente. No se ocultan sus valores crudos.

## Revisión independiente y corrección comprobada

Informe: `output/e3-revisiones/revision/revision-independiente.md`. El revisor leyó
contrato, artefacto y salidas crudas, sin aceptar conclusiones de autores. Hallazgos:
El cierre posterior se registra separadamente en
`output/e3-revisiones/revision/cierre-independiente.md`: F1–F5 cerrados, variantes
comprobadas y 18/18 pruebas puras ejecutadas por el revisor. El informe original
se conserva. El arquitecto repitió las pruebas completas y el build tras el
último ajuste visual de anchura de tabla; todos terminaron con exit0.

| ID | Hallazgo confirmado | Corrección y prueba actual |
|---|---|---|
| F5 · P1 | Restaurar podía reducir material comprometido derivado de equipos/cables, aunque no hubiera BOM adicional. | Necesidad completa antes/objetivo y compromisos comprobados antes de registrar/aplicar. 9/9 gates del arquitecto incluyen reducción/retirada de equipo, cable, pedido de sala/obra, carga/movimiento y hashes íntegros. |
| F1 · P2 | Una revisión vigente figuraba como su propio antecedente. | `antecedente_id` real para revisión vigente, última guardada para borrador; R1/R2/borrador comprobados en gate y snapshots/documentos. |
| F2 · P2 | `<title>` SVG con varios hijos provocaba error SSR/hidratación en React 19. | Template string único, prueba SSR/hidratación y recorrido 4/4 con consola controlada. |
| F3 · P2 | Orden de clic invertía añadido/retirado en comparación de revisiones. | Orden por número y dirección explícita; recorrido E3 prueba ambas órdenes de selección y las notas añadidas. |
| F4 · P3 | Contexto histórico de mobiliario cambiaba hash y quedaba fuera del diff. | Diff de contexto separado, instancia congelada intacta; gate adicional rechaza restauración/copia de referencia retirada. |

El caso de necesidad comprometida fue elevado a F5 al revisar la reproducción
autorizada del arquitecto (`revision/repro-necesidad-comprometida.*`). La
reproducción posterior conservada en
`revision/repro-necesidad-comprometida-corregido.log` ahora muestra
`rechazada:true` y explica la reducción de necesidad comprometida. Los nueve gates
de `arquitecto-correccion.log` cierran también sus variantes y el mueble retirado.
Las bajas de equipo/cable existentes detectan ancla/equipos/conexiones hijas antes
de escribir y llevan a Diagrama con aviso accionable; el recorrido E3 comprueba
la superficie y las guardas. Se conserva el informe original con los defectos
previos, junto a la corrección y sus resultados crudos; no se sustituye para
aparentar que el artefacto nunca tuvo hallazgos.

## Gates, incidencias y evidencia conservada

Comandos completos de reproducción: `output/e3-revisiones/gates/README.md`.
Toda evidencia E3 está bajo `output/e3-revisiones/`, ignorada en Git. Un clon no
transporta capturas, documentos, bases ni esta evidencia local: conservarla por
separado; `docs/15` y este informe son los puntos versionables de recuperación.

| Comprobación leída | Resultado actual | Salida cruda |
|---|---|---|
| Core E3 | 16 gates | `gates/core-cuarta.log`, `core-ultimo.json`, `core-2026-10-14T10-02-55-462Z/` |
| Regresiones core | 8/8 | `gates/arquitecto-regresiones.log`, `regresiones-2026-10-14T10-26-02-961Z/` |
| Corrección arquitecto | 9/9, hashes íntegros tras rollback de casos | `gates/arquitecto-correccion.log`, `correccion-2026-10-14T10-25-04-341Z/` |
| Unitarias completas finales | 766 pruebas, 152 suites; cero fallos/omitidas, exit0 tras el último ajuste visual | `gates/npm-test-cierre.log` |
| Tipos/lint finales | Exit0; ESLint sobre 55 archivos E3 y reaplicado a los tres últimos archivos ajustados | `gates/typecheck-definitivo.log`, `lint-verificado.log`, `lint-comando-verificado.json`, `lint-ultimos-ficheros.log` |
| Build Webpack final sin BD | Exit0 tras el último ajuste visual; `DATABASE_URL` explícitamente vacía, cache separada | `gates/build-cierre.log`; `build.log` conserva fallo DNS previo |
| Cierre independiente | F1–F5 cerrados; 18/18 pruebas puras propias del revisor | `revision/cierre-independiente.md` |
| E1 navegador reusado | 3/3 | `gates/e1-e2e-verificado.log`, `e1-navegador/` |
| E2 reusado | Dos scripts exit 0; seis regresiones dirigidas | `gates/e2-regresiones-con-rollback.log`, `regresiones-e2/comandos.json`, logs, `tanda-final/` |
| E3 matriz aislada | 1/1 | `gates/e2e-matriz.log`, `navegador/matriz-invariantes.json` |
| E3 recorrido completo | 4/4 escritorio→matriz→APIs→móvil | `gates/e2e-e3-aceptacion.log`, `navegador/` |
| Móvil con historial cargado | 1/1 adicional de sólo lectura, espera formulario/historial y captura preview de alternativa | `gates/e2e-movil-cargado.log`, `movil-historial-cargado/` |
| Móvil con tabla legible | 1/1 adicional tras fijar ancho de tabla y scroll interno; sin escritura de diseño | `gates/e2e-movil-tabla-legible.log`, `movil-tabla-legible/` |
| Documentos definitivos generados | 7 PDF + 8 XLSX, ZIP/manifiesto/CSV de cables 18 columnas; 47 tablas con SHA idéntico | `gates/documentos-verificados.log`, `documentos/verificada/` |
| XLSX adicionales de obra | 2/2 reabiertos desde snapshot guardado, sin conexión BD; stock contado una vez | `gates/xlsx-obra-verificada.log`, `documentos/verificada/xlsx-obra-resultados.json` |
| Reinspección PDF definitiva | Aprobada: 12/12 páginas de elevaciones, 20/20 rótulos sin cruces, 26/26 notas, escala y geometría intactas; otras 174 páginas aceptadas por paridad estricta | `pdf-inspeccion-verificada/INFORME.md`, `raw/elevaciones-verificacion.json`, `comparacion-pdf.json`, `comparacion-snapshots.json` |
| Reinspección XLSX definitiva | Aprobada: 10 libros/21 hojas/3.570 checks, 5.892 celdas vs aceptación; único cambio real esperado C12, tres renders nuevos | `xlsx-inspeccion-verificada/informes/inspeccion-verificada.md`, `contenido-resultados.json`, `aceptacion-paridad-resultados.json`, `renders/` |

La tanda `documentos/verificada/` contiene 10 XLSX sumando los ocho individuales
y los dos libros de obra. Tiene notas/antecedentes reales, herencia de alternativa
y organización grande guardada sin solapamientos. El hash de las 47 tablas antes
y después de exportar es
`a3fe0a4225aede1120dd3482982b8d5de5d5304efbf1c3214342ce78304b18d6`.
Esto acredita la lectura/no mutación de esa tanda; no convierte un estado vivo
posterior en la misma fotografía.

El inspector PDF original renderizó 7 archivos/186 páginas a 150 dpi y revisó 34
contactos; no encontró pérdida de etiquetas/notas/IDs en mosaicos y sí un P2 de
rótulos de elevaciones que cruzaban símbolos E2/E3 y pared. El primer ajuste
eliminó ese cruce pero dejó `E4: z 0,00 m` sobre el suelo. La corrección definitiva
coloca los rótulos lateralmente y limita su altura, preservando escala, XYZ y
cálculo. La reinspección final aprueba las 12 páginas y 20 cajas: no cruzan
símbolos/pared/suelo, 26/26 notas, escala de 8 m a 1:50 = 453,543307 puntos,
cero raster. Las otras seis exportaciones son idénticas en geometría y cada
carácter del cuerpo con sus posiciones/tamaños, salvo DOC/fecha del pie; sus 174
páginas conservan la aceptación visual anterior. Se mantienen ambos informes
previos y el cierre nuevo para hacer visible la detección/corrección.

El inspector XLSX original reabrió 10 libros/21 hojas, contrastó 3.570 checks y
revisó 43 renders. Observó que `obra-bom.xlsx!Material!C12` decía latiguillo 5 m,
aunque sus dos unidades eran variantes de 5 y 3 m; la cantidad y el detalle eran
correctos. Se cambió la descripción consolidada para enumerar variantes, sin
tocar cantidad, precio, stock ni la fórmula. La reinspección definitiva aprueba
10 libros/21 hojas/3.570 checks y contrasta 5.892 celdas: único cambio real C12
esperado, además de metadatos DOC/fecha. Tres renders nuevos de la superficie
cambiada muestran las dos variantes completas; las 42 imágenes anteriores de
superficies iguales se reutilizan con paridad de contenido/formato acreditada.
No se abrió Microsoft Excel: reapertura openpyxl y Artifact Tool del runtime local.

La captura móvil original se había tomado durante `Cargando historial…`. El
arquitecto endureció el gate para esperar `Nombre de revisión`, ausencia del
mensaje de carga y preview de alternativa visible. Reejecución adicional de sólo
lectura 1/1: `movil-historial-cargado/`, sin guardar diseño, notas o revisión. El
intento anterior de selector equivocado queda conservado en su log de rechazo.
La primera captura cargada comprimía nombre/hash: se fijó `min-w-[48rem]` en la
tabla dentro de `ContenedorTabla`, permitiendo scroll de ese bloque. Gate posterior
1/1 y capturas `movil-tabla-legible/` verifican esa última presentación, sin
registrar revisiones ni guardar notas/diseño. El arquitecto repitió tests/build/
tipos/lint después de ese ajuste: 766/766, build sin BD y tipos/lint con exit0.

Incidencias históricas de preparación quedan retenidas, no se usan como éxito:
schema en conexión sin reserva (`UNSAFE_TRANSACTION`), acceso sandbox a loopback
(`EPERM`), serialización inicial (`populate_composite on a scalar`) y una primera
fixture de retirada de puerto que chocó con la guarda de bocas. Los snapshots
sintéticos inválidos de esas primeras tandas quedaron inmutables en la base de
prueba. Son pruebas previas identificadas y rechazadas por la validación de
snapshot; **no son snapshots generados por el código actual**. No se borran ni se
reescriben para limpiar el historial. No afirmar IDs si no se dispone de su foto
cruda; `core-segunda.log` conserva el fallo previo. La recuperación
dirigida `--recuperar-fixture` sólo reponía campos de esa fixture sintética, sin
alterar revisiones ni datos reales.

Las tandas E3 previas también conservan fallo de hidratación, expectativa de
guardado, undo sobre organización sin cambio y comparación invertida. No se
sobrescriben esos logs para presentar la última tanda como si hubiera sido la única.
Los avisos previos de Next sobre middleware/Edge quedan fuera de E3.

## Migraciones y rollback

Aplicadas exclusivamente a la nueva base E3 y a la nueva base de regresiones:
`2026-10-e3-revisiones.sql` y `2026-10-e3-anotaciones.sql`. No hay aplicación a Neon
ni backfill/seed habitual. La migración inicializa etiquetas por el mismo orden
actual de conexiones y registra el siguiente correlativo; no cambia bridas ya
numeradas después de reorganizar.

El rollback estructural verifica base/usuario E3 y rechaza historial, alternativas,
anotaciones o identificadores persistidos. No es un botón para deshacer diseños y
no borra historia. Los gates prueban rechazo en base con datos y retirada completa
en un esquema vacío exclusivo, dejando todas las tablas públicas idénticas. No
ejecutar un rollback público para reproducir ese gate: usar
`scripts/verificar-revisiones-regresiones.mts`, que reserva conexión y restaura
`search_path` al terminar. Restaurar revisión de sala es otra operación: transacción
de diseño con revisión nueva, sin retroceder hechos operativos.

## Conservación y estado final

El manifiesto base `output/e3-revisiones/base/evidencia-e1-e2-sha256.json` contiene
642 artefactos: 288 E1 y 354 E2. `gates/preservacion-final.json` confirma
642/642 SHA-256 idénticos, sin faltantes. Hash del manifiesto base:
`e9567d6b9595b691f054e25bc37f8de881eb61cf84a3d6c95bd535dd200870c8`.
Quince archivos protegidos (`data/*`, `db/seed.sql`, `package.json`,
`package-lock.json`) conservan 15/15 hashes de `base/fuentes-sha256.json`:
`d8cfb4a826977a0ca07118b0c3b82d346317ca98c2d33e0f691ae68ddd80d53a`.
La comparación general de las 404 fuentes se conserva en
`gates/comparacion-todas-fuentes.json`: contiene modificaciones E3 deliberadas
presentes en el diff; **no se afirma que las 404 fuentes sean idénticas**. Los
cambios intencionados en fuentes E1 figuran en el diff y tienen regresiones.
Fotografías de 47 tablas de `documentos/verificada`, `movil-historial-cargado`
y `movil-tabla-legible`
son iguales antes/después, con hash
`a3fe0a4225aede1120dd3482982b8d5de5d5304efbf1c3214342ce78304b18d6`.

`git diff --check` final pasa. La fotografía de cierre de la base conserva el
mismo hash y las 47 tablas (`gates/foto-cierre.log`). El manifiesto del artefacto
contiene las 64 rutas, hashes, diff de archivos modificados y nuevos, snapshots
Git y las referencias de gates aceptados. No hay criterios E3 pendientes en el
alcance local especificado.

Autoría del cierre: ejecutores por unidad aportaron fuentes/gates; el revisor
independiente examinó contrato, artefacto y resultados y registró F1–F5; el
arquitecto integró la corrección, ejecutó 9/9+8/8 y los recorridos E1/E3; inspectores
independientes revisaron PDF/XLSX y aceptaron la última presentación. E4–E8
permanecen fuera de alcance. No asumir push ni producción a partir de la aceptación
local que se documente.

Estado Git de cierre, tamaño de diff final y manifiesto del artefacto corregido:
`output/e3-revisiones/revision/artefacto-final.patch` y `artefacto-final.json`,
generados por el arquitecto tras cerrar esta documentación. La referencia de
continuidad sigue siendo el HEAD E1/E2 indicado arriba con E3 local sin commit:
29 archivos modificados y 35 nuevos, sin staged ni eliminaciones. El manifiesto
registra el tamaño y SHA-256 del patch completo, incluidos los archivos nuevos.
La comprobación remota archivada `gates/refs-remotas-cierre.txt` conserva
`codex/e1-e2-local=7ba796077ff39e799b9b7eb87109b648c3df5c2d` y
`main=adacf0eaf4f07390bd15c335ec394aceeff9a4b0`. No se ha movido main ni se
verifica producción en esta entrega local.

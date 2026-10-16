> **Cierre vigente ·16-10-2026 · July285.** REA10 y la integración están **aceptadas localmente dentro de sus contratos y límites documentados**. La ronda adicional de serialización está aplicada y verificada: catálogo/ofertas guardan, recargan, generan preview y confirman con200; recuperación503 y rebase explícito; cuatro destinos completos en escritorio antes de móvil390. Suite1112/1112; Webpack sinBD, tipos, lint66 y diff-check con exit0. Revisión independiente sin hallazgos. Cierre y evidencias en `docs/29-rea-entrega-local.md` y `output/rea-integracion/rea10/serializacion-ronda-adicional-20261016/raiz/aceptacion-root.json`. No hay unidad REA pendiente en este programa local: **no reaplicar el parche ni relanzar07B/08/09 o prompts históricosE2/E3**. Sin commit, push, merge, despliegue ni producción. Las entradas inferiores conservan su fecha como historia y no reabren trabajo.

> **Relevo anterior (histórico) ·16-10-2026.** REA07B/08/09 cerradas localmente. REA10: los seis hallazgos originales están corregidos; el gate completo de interfaz sigue rojo por PATCH400 de catálogo/ofertas (revisión BIGINT enviada como texto). Sergio autorizó una ronda adicional y pidió una instrucción aparte para liberar contexto. **Parche SIN APLICAR; continuación únicamente por `docs/CONTINUACION_REA_RONDA_ADICIONAL.md`.** Suite1106/1106, build sinBD, tipos/lint y regresiónE2 verdes no equivalen a aceptar ese flujo. No repetir unidades cerradas ni prompts históricos; sin Git/producción. Los bloques inferiores son historia.

> Actualización 16-10-2026 11:26 UTC: REA07B/08/09 aceptadas localmente. Primera revisión independiente de REA10 terminada: seis hallazgos consolidados y única corrección conjunta en curso. B01/B03/B04 y testigo durable B02 tienen pruebas de autor verdes; UI y gate selectivo original pendientes. El puente09–10 pasa19controles SQL y cinco pasos Chrome. Suite1087/1087 corresponde al candidato anterior a esta corrección; falta corte final. Sin aceptación global ni cambios Git/producción. Detalle en `docs/29-rea-entrega-local.md`; los estados inferiores se conservan como historia.

> Actualización 16-10-2026 10:42 UTC: REA07B y REA09 aceptadas localmente tras sus gates selectivos independientes de la única corrección conjunta de cada unidad. Evidencia: `output/rea-integracion/revision/rea07b/correccion-20261016/` y `revision/rea09/correccion-20261016/`; aceptaciones de raíz en las carpetas de corrección. REA08 sigue aceptada. REA10 e integración09-10 y gate global continúan activos. Los estados anteriores de revisión pendientes se conservan como historia.

# Integración REA · contrato y continuidad

Fecha de arranque: 15-10-2026. Estado: **en ejecución**.

**Entrada vigente ·16-10-2026, sesión July282.** Reanudación expresa de Sergio,
anterior coordinador idle/completed comprobado, sin procesos QA previos. Git en
`codex/rea-integracion`, mismo HEAD7ba7960, WIP conservado. Snapshot857fuentes
en `reanudacion-20261016/inicio/`, sin secretos. Un coordinador; cada autor tiene
archivos/base propios y revisión independiente. Las entradas fechadas después
del bloque anterior conservan sus cortes históricos, no son una nueva pausa.

- REA08 cerrada localmente: gate selectivo del sucesor independiente cierra
  R08-01…05 y suplemento raíz;63hashes actuales contrastados. Dictamen
  `revision/rea08/correccion-20261016/dictamen.json`, aceptación raíz en
  `rea08/correccion/20261016T084354Z/aceptacion-root.json`. El preámbulo añadido
  después al contrato26 es continuidad; los63hashes se contrastaron antes.
- REA07B: primera revisión reproduce dosP2 de paginación, conservados en
  `revision/rea07b/inicial/`. Única corrección conjunta raíz en
  `rea07b/correccion-20261016/`:23propias+87deps congeladas;51propuestas y
  51resultados paginan50+1, selección explícita fuera de página, borrador y
  móvil verificados;104tablas idénticas,11puras/tipos/lint0. Falta gate selectivo
  del mismo revisor; no otra ronda abierta.
- REA09: primera revisión reproduce P1 por historial de fuente BOM/catálogo
  eliminada/retirada y P2 por omitir ficha técnica E2. Única corrección del mismo
  autor congelada en `rea09/correccion/20261016T090932Z/final2/freeze/`,29propias,
  hash3d5f37465047cd64ef985ed16930787eab91a7c24c06fe737cf4d47a8eab6a2c.
  Autor:15SQL/5UI/4modelo/tipos/lint0 y93tablas ajenas idénticas. Gate selectivo
  del revisor original en curso; no aceptación09 aún. Ocho artefactos previos
  y un puntero operativo fueron sobrescritos al repetir scripts de salida fija;
  no recuperables, no reconstruidos. Incidente en la tanda0851Z; rojos intactos.
- REA10: runtime/backend/puente catálogo y UI delegada en construcción, aún
  sin revisión. Sólo5563/104tablas; fuentes/planes/aplicación/reversión/gates de
  autor avanzan, sin atribuir aceptación por sus cifras. Root integra enlace
  obra→Documentación y requisitos con tres ACL; el adaptador09 todavía falta.
  Todos estos deltas posteriores a07B/09 entrarán en la revisión10 y corte final.

Root amplía E2 para preview BOM de UUIDsala futura fijado en servidor, sin alta
durante preview; confirmación ordinaria sigue exigiendo sala real y hashidéntico.
El helper de alta admite ese UUID. Cuatro casos SQL sobre la **nueva5565**
`av_design_rea10_puente_prueba`/`av_design_rea10_puente`, más29puras, preservan
104tablas tras rollback. Auditoría mínima de retirada/purga10 en dos JSON sin
texto privado: delta SQL probado5565 y aplicado sólo5563 con autor SQL parado;
columnas nuevas null en historia previa, sin inventar backfill. Evidencia
`rea10/puente-e2/20261016-sala-futura/`. Buscador común notifica401/403 actual al
formulario, ignora401abortado;14DOM/lint0. No migración de otras bases.

Quedan freezes/gates selectivos07B/09, integración09↔10, primera revisión10 y
su única corrección si procede, y el corte conjunto actual: pruebas, Webpack
sinBD, tipos/lint/diff y regresionesE1/E2/E3 pertinentes. Sin commit/push/merge,
despliegue ni producción. No relanzar unidades cerradas ni prompts históricos.

Reanudada por Sergio en el chat `01a14075-9d2b-7a63-bcda-018f65636ad6` tras
comprobar el paro del coordinador anterior y sus agentes. El aviso inicial de
`CONTINUACION_REA_ESTADO_ACTUAL.md` y `ejecucion_unidades` de la cobertura18
registran el estado nuevo; las pausas y cifras posteriores de este historial
conservan su fecha y no sustituyen esa entrada vigente. Snapshot nuevo de646
fuentes,438base presentes,17protegidas y642artefactos históricos idénticos en
`output/rea-integracion/reanudacion-20261015/inicio/`.

## Objetivo autorizado

Reconciliar todas las correcciones útiles de E1 con el AV_design actual,
conservando E2 y E3. Revisar todos los candidatos detectados por ClonerSoft/REA
y aplicar los que mejoren esta aplicación interna, con verificación funcional,
revisión independiente y continuidad persistente. No hacer commit, push,
merge a main, despliegue ni escrituras en producción.

La autorización actual amplía el alcance de los prompts históricos E1–E3.
Que una mejora figurara antes como opcional no basta para descartarla: se decide
por su utilidad, evidencia y encaje con el departamento. Una pista estática no
acredita por sí sola una funcionalidad ni su corrección. No se copian scripts,
endpoints privados, sesiones ni supuestos comerciales de XTEN-AV.

## Único destino y base conservada

- Checkout de implementación: `/Users/sergio/Desktop/Aplicaciones/AV_design`.
- Rama de integración local: `codex/rea-integracion`, desde
  `7ba796077ff39e799b9b7eb87109b648c3df5c2d`, sin commit nuevo.
- E1/E2 están en esa base; E3 es el conjunto local de 64 archivos descrito por
  `docs/15-e3-especificacion.md` y `docs/16-e3-entrega-local.md`.
- Antes de editar se conservaron 438 archivos, hashes, estado Git y diff en
  `output/rea-integracion/base/`. Se excluyen secretos y configuración MCP.
- La rama auxiliar `feat/e1-documentos` (`d38d9a3`) es fuente de correcciones,
  no un reemplazo del checkout. Los worktrees de Xtenav se conservan intactos.
- `Xtenav/research/` es evidencia histórica. El inventario comparativo del
  13-10-2026 no describe el estado actual de la aplicación.

## Partición y responsables

| Unidad | Responsable | Estado y criterio de cierre |
|---|---|---|
| R0 · preservación | Arquitecto | Snapshot creado; ninguna eliminación o sobrescritura de trabajo ajeno. |
| R1 · reconciliación E1 | Ejecutor E1 + revisión independiente | **Terminada localmente.** Correcciones selectivas, cuatro P2 cerrados entre código y archivos, regresiones y descarga real posterior. Ver cierre R1 abajo. |
| R2 · cobertura completa REA | Arquitecto de alcance | Matriz inicial terminada: 34 candidatos con evidencia, utilidad y aceptación en `docs/18-rea-cobertura.{md,json}`. Su implementación sigue en R4. |
| R3 · continuidad | Ejecutor de documentación | Terminada: entrada única REA, avisos históricos E2/E3 y Xtenav, AGENTS y roadmap. Enlaces y cuerpos históricos comprobados; July actualizado. |
| R4 · mejoras de producto | Arquitecto + ejecutores | 11 unidades REA-00…10 en la matriz. REA-01 se especifica en `docs/19-rea01-especificacion.md`: medidas, preview y selección/sustitución revisable. REA-02 tiene contrato en `docs/20-rea02-especificacion.md`. El resto sigue en alcance hasta implementación y verificación. |
| R5 · verificación final | Arquitecto + revisor independiente | Pendiente: pruebas, build sin BD, tipos/lint, Postgres sintético, escritorio completo antes de móvil y revisión de entregables afectados. |

Los ejecutores tienen archivos asignados; los cambios en archivos compartidos
se integran secuencialmente. El revisor recibe artefacto, contrato y evidencia
cruda, sin las conclusiones del autor. Cada unidad sigue implementación,
revisión, una corrección y gate determinista; las incidencias de integridad o
seguridad se resuelven sin una aceptación ficticia.

## R1 · aceptación de la reconciliación

- Dado un GET de recuperación lento, cuando termina una generación posterior,
  entonces la respuesta antigua no sustituye el paquete nuevo, no borra su
  referencia y no introduce un error de caducidad falso. Un parcial nuevo
  mantiene accesible el último completo recuperado.
- Dada una selección inválida, cuando se solicita un paquete, entonces la API
  devuelve un error de entrada. Un fallo interno devuelve un mensaje genérico
  y estado de servicio, sin detalles de SQL o infraestructura.
- Dado un paquete caducado o de otro propietario, cuando se intenta leer su
  manifiesto o un archivo, entonces ambas vías aplican la misma identidad,
  caducidad y validación de nombre. Los límites, fallos parciales y progreso
  reflejan los bytes realmente conservados.
- Dados nombres/puertos extensos o rótulos coincidentes, cuando se exporta,
  entonces se conservan los datos completos y la legibilidad sin mover XYZ,
  alterar escala, reducir medidas ni perder símbolos, notas o revisión E3.
- Dadas reservas externas, BOM adicional, precios ausentes y valores cero,
  cuando se generan PDF/XLSX/CSV, entonces el alcance y los totales siguen
  siendo los mismos y el autofiltro no tapa las cabeceras.
- Cada diferencia de `d38d9a3` se clasifica como portada, ya cubierta por una
  solución vigente u obsoleta con motivo. No se reintroduce compatibilidad con
  una aplicación sin E2/E3 ni se reemplaza una fuente por su versión antigua.

## Verificación y datos

Toda escritura de aceptación va a una **nueva base sintética local** con URL e
identidad verificadas. No se usa `.env.local` como destino, no se ejecuta
`db:reset` del inventario, no se reutilizan bases históricas E1/E2/E3. Los
artefactos nuevos se guardan en `output/rea-integracion/`, sin reescribir
evidencia previa. Si cambian documentos, se reabren los archivos reales y se
inspeccionan sus renders, además de comprobar cantidades y texto.

El cierre global exige que cada candidato REA esté cubierto por implementación
verificada, una capacidad existente verificada o una exclusión concreta por no
aportar mejora. Una clasificación o un test estrecho no prueba el funcionamiento
completo. La memoria y los prompts no sustituyen la comprobación del checkout.

## Recuperación automática del contexto

Leer primero este archivo y `docs/18-rea-cobertura.md`, después el estado real
de Git y los contratos de la unidad activa. Recuperar July con proyecto
`av-design`, sesión `av-design-rea-integracion-2026-10-15`. No relanzar los
prompts históricos de E1, E2 o E3. Seguir trabajando desde el estado comprobado;
no volver a investigar XTEN-AV salvo una pregunta imprescindible sin evidencia.

La memoria July recuperada al inicio era anterior a E1/E2/E3: se trata como
antecedente, no como instrucción para rehacer trabajo ni como permiso para
desplegar. La ficha de producción puede estar desfasada; esta ejecución no
necesita usar producción.

## Corte comprobado · reconciliación R1

- 786/786 pruebas, 155 suites, cero fallos/omitidas:
  `output/rea-integracion/gates/npm-test-r1.log`.
- Build Webpack sin BD aprobado: `gates/build-r1-final.log`; el primer
  intento sin red no pudo descargar las fuentes públicas de Google. El
  segundo detectó un tipo de instrumentación de test, corregido con una
  comprobación de tipos en ejecución; el build final pasó.
- E1 navegador 3/3, E3 navegador 4/4, escritorio antes de móvil:
  `e1-navegador.log`, `e3-navegador.log` y sus carpetas de captura/descarga.
- Gates de Postgres E3: 16 principales, 8 regresiones, 9 de corrección;
  E2: ambos scripts adaptados terminan con exit 0. Fuentes y evidencia
  históricas no se reescriben.
- Revisión independiente: dos P2 reproducidos y corregidos juntos (fondo
  de rótulo sobre otro símbolo y error de sesión fuera de frontera segura).
  Informes original y cierre separados en `output/rea-integracion/revision/`;
  46/46 pruebas independientes. 52/52 focales del ejecutor.
- Exportación real: 7 PDF, 8 XLSX y CSV/ZIP reabiertos, historia/notas/herencia
  E3 y BOM adicional E2 comprobadas; 47 tablas mantienen el mismo hash.
  `output/rea-integracion/documentos/r1/`. **Corpus inicial conservado**. La inspección visual independiente detectó
  dos P2 adicionales:
  anclaje forzado de bocas bidireccionales y colisión ID de cable/conector en
  mosaicos. Corregidos en `diagrama.ts`/`pdf.ts`, con 73/73 pruebas focales
  (`e1/correccion-visual-green.log`), incluidos 16 sentidos y posiciones PDF.
  Archivos regenerados en `documentos/correccion-visual-r1/` y
  `documentos/extremos-r1-corregido/`; ambos cerrados por inspección independiente.
- 642/642 artefactos históricos idénticos; 438 archivos base conservados sin
  eliminaciones; 17 fuentes protegidas (datos, seed, dependencias y cálculo
  de cable) idénticas. `gates/preservacion-r1.json` y
  `gates/continuidad-preservacion.json` enumeran los cambios deliberados.

### Destinos actuales de prueba

Docker ya disponible tras conectar el disco externo. Se crearon exclusivamente
`av_design_rea_prueba_20261015_db` (loopback:5550, base `av_design_rea_prueba`,
rol `av_design_rea`) y `av_design_rea_regresiones_20261015_db` (loopback:5551,
base/rol `av_design_rea_regresiones`), Postgres 17 y servidor:5432. Volúmenes,
bindings e identidad están en `output/rea-integracion/postgres/` y gates.
No se arrancaron ni modificaron los contenedores históricos.

App sintética: `http://localhost:3110`, caché `.next-rea-integracion`, secreto
exclusivo de prueba. El proceso se comprueba por su handle/puerto antes de
reutilizarlo. Scripts `rea-fixture.mts` y `preparar-regresiones-rea.mts` guardan
los destinos y copian/adaptan los gates a evidencia nueva, sin debilitar su
aceptación. Nunca usar la URL de `.env.local` para esos gates.

Antes de que estuviera disponible Docker se instaló PostgreSQL 17 como recurso
local alternativo. No se inició servicio global ni se creó una base utilizable;
la inicialización denegada quedó registrada y retiró su directorio incompleto.
Las verificaciones aceptadas anteriores usan exclusivamente Docker.

### REA-01 · destino y partición inicial

Ejecutor A: medidas m/ft y preview de plantilla; ejecutor B: selección y
alternativas BOM. Contrato y propiedad de archivos en `docs/19-rea01-especificacion.md`.
Destino nuevo `av_design_rea01_prueba_20261015_db`, loopback:5552, base
`av_design_rea01_prueba`, rol `av_design_rea01`, Postgres17. Guard de URL y
servidor en `scripts/rea01-fixture.mts`; foto inicial de 47 tablas en
`output/rea-integracion/rea01/postgres/bd-inicial.json`. No reutilizar 5550/5551
para esta aceptación. July: R1=232; integración global=233; continuidad=234
(done); REA-01…10=235…244 (REA-01 en curso, resto pendiente).

## Cierre R1 · reconciliación terminada localmente

Informe independiente: `output/rea-integracion/documentos/inspeccion-r1/informe.md`
y `evidencia.json`. Cuatro P2 cerrados en total: dos de la revisión de código
y dos visuales posteriores. Los archivos iniciales con defectos se conservan
como reproducciones; las salidas corregidas están en
`documentos/correccion-visual-r1/` y `documentos/extremos-r1-corregido/`.

- Inspección documental: 34 PDF/560 páginas renderizadas; aceptación de 511
  páginas, excluido el ensayo anterior cuyo fixture se corrigió. 7.003
  comprobaciones XLSX/CSV, 168 estructurales PDF y 10 de procedencia R7,
  sin discrepancias. Cabeceras con flechas verificadas también en Excel nativo.
- Tras ese informe, el coordinador descargó de nuevo principal A4 y matriz
  A4/A3 por POST/NDJSON y GET ZIP reales. Hash y tamaño de cada PDF coinciden
  con su manifiesto; 47 tablas mantienen su hash. Los cuerpos útiles de sus
  **163/163 páginas** son idénticos por píxeles a los ya revisados.
  Evidencia: `documentos/descarga-post-correccion/{gate,comparacion-render}.json`
  y `e1/descarga-post-correccion.log`. La cabecera/cajetín variable se excluye
  sólo de esa comparación de píxeles; el contenido y manifiesto siguen guardados.
- 73/73 pruebas focales nuevas de dibujo/PDF aprobadas. El corte de integración
  posterior tiene 824/824 pruebas, build Webpack sin BD, tipos, lint de 114
  archivos y diff sin problemas (`rea01/`). Los cambios A posteriores al corte
  se vuelven a validar al cerrar REA-01.
- 438 fuentes iniciales conservadas, 17 fuentes protegidas idénticas y 642
  artefactos históricos idénticos (`rea01/preservacion.json`). HEAD sigue
  `7ba7960`; ningún commit, push, merge o despliegue.

Límite explícito: en la matriz de estrés 100 rutas comparten tramos; el conjunto
orienta y las fichas/listado conservan la identidad de cada cable. La revisión
no certifica seguimiento inequívoco de cada ruta sólo por el dibujo ni impresión
física. La aceptación local no acredita producción.

### REA-02 · terminada localmente

Contrato `docs/20-rea02-especificacion.md`, ejecutor `implement_rea02`. Tabla
`preferencias_usuario` añadida al schema y a la migración
`2026-10-rea02-preferencias.sql`. Sólo aplicada en la nueva base sintética
`av_design_rea02_prueba`, rol `av_design_rea02`, contenedor
`av_design_rea02_prueba_20261015_db`, loopback:5554; 48 tablas iniciales. Guard
`scripts/rea02-fixture.mts`, app local:3112 y caché `.next-rea02-integracion`.
Los destinos anteriores no reciben esta migración. La revisión independiente
recorrió 14 bloques propios, nueve métricas y seis avisos; 12 pruebas unitarias
y 5/5 recorridos E2E aprobados. Su primer P2 reproducía un refresh RSC tardío
del Panel que desmontaba el editor y perdía una edición posterior al guardado.
Informe `output/rea-integracion/revision/rea02/REVISION.md`;
el autor corrigió ese caso y la reauditoría lo cerró para Guardar/Restablecer,
incluido el siguiente CAS. Se detectó después otra omisión en la comparación
abierta: conservaba seis etiquetas/preferencias retiradas, sin cifras ni enlaces
operativos. El coordinador aplicó el filtro vigente también a esa lista;
regresión RED→GREEN y 16/16 focales, lint limpio. Corte congelado en
`rea02/correccion-acl-comparacion/`. El revisor repitió su reproducción ACL y
cuatro casos de estado/CAS: sin hallazgos pendientes, 16/16 focales y 48 tablas
idénticas tras limpiar. `revision/rea02/correccion-acl/REVISION.md` cierra ambos
P2 y conserva los RED. Los 5/5 E2E completos de la revisión anterior se mantienen;
el único cambio externo identificado es el enlace de informes desde Cuenta.
Los gates conjuntos de tipos/build/regresión del corte A/02/03 pasan después
de esa revisión, con fuentes idénticas durante su ejecución. July236 cerrada;
las ampliaciones futuras del Panel deben conservar preferencias y ACL.

### REA-01 · terminada localmente

La parte B (selección y alternativas BOM) está cerrada localmente tras corregir
la invalidación del identificador/revisión al editar o vaciar una alternativa.
Revisor: `revision/rea01-b/cierre-p2.md`, 46/46 focales y 17/17 hashes. Las
pruebas propias SQL/HTTP y el recorrido de escritorio antes de móvil conservaron
el inventario y los hechos operativos. El guard global de API ahora devuelve
JSON 401/no-store sin cookie; la expectativa del gate B se ha actualizado y
se vuelve a ejecutar sobre el corte conjunto.

La parte A está en una corrección conjunta de seis hallazgos independientes:
concurrencia del cierre, medidas que desplazaban posiciones confirmadas,
entrada inválida aún guardable, preview con aforo diferente, conversión del
máximo SQL y respuesta API sin sesión. El autor ha reproducido los seis casos
antes de corregirlos; pasan nueve regresiones nuevas, 241 focales y el gate
Postgres 12/12. La reauditoría confirmó dos P1 adicionales: una sala nueva no
visible en el primer barrido podía quedar sin bloquear durante el cierre, y el
guardado de un recinto reducido validaba sólo los elementos enviados, dejando
fuera un equipo persistido omitido del patch. Reproducciones independientes en
`revision/rea01-a/cierre/phantom-close.mts` y `review-integrity.mts`. Ambos
impiden cerrar REA-01 y requieren corrección/repetición determinista; las cifras
del ejecutor no acreditan por sí solas la integridad.

La corrección posterior de A pasa los dos repros originales de esos P1 y diez
casos físicos propios del revisor. Sigue abierto un P1 adicional descubierto al
invertir el orden de la carrera E3: duplicación SERIALIZABLE que ya esperaba
una sala del cierre podía continuar con snapshot anterior. Repro independiente
`revision/rea01-a/integridad-final/e3-close-first-real.mts`, con ambas acciones
reales; `e3-close-first.mts` conserva sólo el ensayo anterior manual. No se
declara aceptación. La barrera mínima en el cierre actualiza únicamente
`salas.actualizado_en` de las salas ya bloqueadas cuando se inserta un cierre
nuevo: el repro canónico pasa de copia indebida a conflicto 40001. Falta
comprobar los tres mutadores E3, ambos órdenes y la reauditoría independiente.
Se conservan aislamiento SERIALIZABLE, hashes, versiones y coordenadas E3.
La reauditoría final cierra ese último P1 con 13 comprobaciones propias:
canónico real, seis carreras, fantasma y cinco regresiones. 38/38 fuentes
idénticas, seis fotografías estrictas y guarda E3 activa tras limpiar sólo
sus fixtures. `revision/rea01-a/barrera-mvcc/review.md`. Root repitió después
B con el guard global401, sin otro escritor5552: 3/3 recorridos de escritorio
antes del móvil, incluidos alternativa, conflicto, fuente/informe y reversión.
`corte-a02-03/rea01-b-e2e.log` y `navegador-b/`. Los gates conjuntos aprobados
conservan las fuentes y regresiones; July235 cerrada.

### REA-03 · informes en construcción

Contrato aprobado `docs/21-rea03-especificacion.md`: seis informes conocidos,
snapshot/archivos durables en Postgres, audiencia interna autorizada,
programación Europe/Madrid y runner CLI local con leases/reintentos. La creación
de una programación no acredita scheduler desplegado ni entrega externa.

SQL aditivo integrado en schema y migración/rollback REA-03, aplicado sólo a la
nueva base sintética `av_design_rea03_prueba`, usuario `av_design_rea03`,
contenedor `av_design_rea03_prueba_20261015_db`, loopback:5555. Identidad
comprobada y 57 tablas iniciales: `rea03/postgres/bd-inicial.json`.
Guard `scripts/rea03-fixture.mts`, app local:3113, caché
`.next-rea03-integracion`. No reutilizar destinos anteriores ni `.env.local`.

El servidor sintético E1 local:3110 se ha detenido después del gate de paridad
para liberar recursos; su base y caché se conservan. Antes de reutilizarlo hay
que arrancarlo con el destino5550/secreto/caché indicados y comprobar el puerto.

El lector E1 se ha extraído como `cargarSnapshotEnLectura`, sin abrir otra
transacción; el wrapper público conserva su selección y atribución histórica.
Se comparten `COLUMNAS_BOM` y `filaBom` en vez de duplicar el mapeo. 17/17
focales E1 aprobadas, incluida paridad E2/E3 y lectura sin transacción anidada.
Además, tres casos con Postgres y API reales (sala, legado, obra) verifican
equivalencia del lector, ZIP/hash, tres CSV exactos y tres XLSX reabiertos con
sus valores; 47 tablas idénticas. Evidencia `rea03/integracion/paridad-http.json`.
La implementación nueva aún no tiene aceptación. July237 está en curso;
233 sigue abierto hasta cerrar todas las unidades útiles REA-00…10.

### REA-04 · contrato aprobado y destino preparado

`docs/22-rea04-especificacion.md` define planificación sobre la obra existente,
catálogo/reglas de tareas, fuente E3 revisada, diff/selección/idempotencia,
técnicos/grupos operativos, agenda y ocupación por unión de intervalos. Completar
una tarea no escribe hitos ni hechos de almacén. El protocolo conserva el orden
de bloqueos de cierre/adopción de REA-01. No es una segunda obra ni otro BOM.

Diez tablas aditivas integradas literalmente desde el contrato en schema,
migración y rollback separados. Sólo se han aplicado al nuevo contenedor
`av_design_rea04_prueba_20261015_db`, base `av_design_rea04_prueba`, usuario
`av_design_rea04`, loopback:5556/servidor:5432. Foto inicial de 67 tablas en
`rea04/postgres/bd-inicial.json`; guard `scripts/rea04-fixture.mts`. App local3114
arrancada con esa base y caché `.next-rea04-integracion`, PID34481/sesión37518.
Sigue en construcción, sin aceptación; comprobar el proceso antes de reutilizar.

Tras aprobar el corte técnico conjunto A/02/03 y cerrar la reauditoría A, se
autoriza al ejecutor `implement_rea02` a construir REA04 en sus archivos y5556.
La revisión documental/ACL de informes continúa aparte y no se declara cerrada.
La independencia de fuentes/base permite avanzar sin modificar el corte03.
Root integra enlaces/Panel y cualquier feedback de borrado referenciado;
el ejecutor04 no modifica esas fuentes compartidas ni las fechas03.

### Corte conjunto A/02/03 · 15-10-2026

903/903 pruebas en 168 suites, build Webpack sin BD, tipos y lint de 162 archivos
aprobados. 481 fuentes conservan exactamente sus hashes durante esos gates.
Las regresiones E2 originales pasan en5553, con copias de evidencia exclusivas.
Se conservan tres intentos previos de preparación: dos archivos sintéticos no
copiados al nuevo directorio y una función pgcrypto fuera del search_path QA.
La copia final califica sólo `public.digest` sin abrir fallback de tablas públicas
ni alterar aserciones. Evidencia `corte-a02-03/`.

438 fuentes base presentes, 17 protegidas y 642 artefactos históricos idénticos.
La revisión A posterior está cerrada;03 conserva hallazgos pendientes. El corte
no declara cerrada toda REA ni acredita producción. REA02 está cerrada localmente.

Informes conserva 24/24 descargas reales —seis informes, tres formatos y
manifiesto— tras reiniciar su servidor3113 de PID86600 a PID26366: mismos bytes,
SHA y revisiones, sin regenerar ni leer tablas operativas. Evidencia
`rea03/durabilidad/`. La revisión independiente terminó con tres P2:
cambiar ámbito de grupo conserva concesión anterior; RSC/respuesta tardía conserva
contenido retirado; PDF omite ruta de detalle. `revision/rea03/REVISION.md`.
57 tablas y 48 fuentes quedaron idénticas en esa revisión, que incluyó casos
propios SQL/HTTP/Chrome/PDF/XLSX. El autor corrige los tres conjuntamente en5555;
no se declara aceptación hasta repetir sus repros independientemente.

### REA-05 · contrato preparado

`docs/23-rea05-especificacion.md` define horas reales por tarea/técnico y
correcciones inmutables, separadas de tarifas y valoraciones privadas. Autor
usuario y técnico son identidades distintas. El coste laboral exige admin y
usuarios:editar; registrar horas no consulta tablas financieras. Los movimientos
actuales carecen de FK de precio/pedido/carga: la imputación material requiere
asociación/evidencia humana y conserva los huecos como desconocidos. No se
modifican stock, recepción, carga, hitos ni CSV. Contrato revisado por raíz;
implementación pendiente de REA04 verificada, sin migración05 aplicada.

El núcleo puro `src/lib/importes.ts` ya está implementado: cadenas y BigInt
exactos, escalas4/2, HALF_UP simétrico, nulos/cero distintos, margen, recargo e
impuesto por línea. 9 pruebas y lint aprobados, tipos focales ES2017. Se usan
constructores BigInt de cadena para conservar el target actual. La revisión
independiente se repitió sobre el SHA actual
`bb5d9736957c96cc7c632e91f2a0be787f9313787b308c52fb5e1d2dfcfba715`:
217.545 comprobaciones con oráculo racional sin hallazgos. No acredita aún
registro de horas, ACL financiera o persistencia de costes.

### REA-06 · construcción paralela autorizada

Contrato `docs/24-rea06-especificacion.md` leído íntegramente y aprobado por raíz.
Seis tablas integradas literalmente en schema/migración; rollback separado que
rechaza retirar un esquema con datos. Aplicación sólo en el contenedor nuevo
`av_design_rea06_prueba_20261015_db`, ID35763d25ad0aac365c51a12ae2896204bae77c0a98902518cb8d1e5d90b9af87,
base `av_design_rea06_prueba`, usuario `av_design_rea06`, loopback5558/servidor5432.
73 tablas iniciales y foto hashce6241a0a495751a3ebcef8c52785421358f5bdfd5e86be10bebd47642684f8f.
Guard `scripts/rea06-fixture.mts`; app3116/cache`.next-rea06-integracion`
arrancada, PID40205/sesión61152, con base5558 exclusiva del ejecutor06. No se aplica esa migración a5556 ni destinos anteriores.

Ejecutor `implement_rea06`: propuestas versionadas por sala/obra, alcance textual
reutilizable, destinatario opcional y valoración/PDF durables. No crea otro BOM ni
eventos comerciales. El núcleo exacto permite construirla sin esperar a la UI de
horas/costes05. Fuente/código/gates y base propios, separados de03/04.

Root añadió `conConexionDeLectura` en `db.ts`, sin cambiar firmas/flujo existentes:
comparte con E1 una transacción de lectura ya abierta, con ACL/aislamiento a cargo
del llamante. Seis focales verifican anidación, paralelismo, error y paridad E1.
La aceptación06 debe comprobar también su uso sobre Postgres real.

### Integraciones compartidas04 en comprobación

Enlaces de obra a plan y de proyectos a agenda/catálogo; feedback seguro para
borrados que PG23503 rechaza por historia vinculada. El buscador único de catálogo
aplica permiso vigente/provisional antes de consultar, JSON/no-store y frontera503;
repro RED→GREEN5/5. No se modificó su proyección de20 referencias.

Panel: nueve claves previas y cinco nuevas, máximo derivado del registro y ACL
multisección. Cuatro contadores y ocupación en minutos-persona usan una sola
llamada `leerAgendaEnLectura` dentro de su transacción, con el mismo `ahora`.
Si están ocultas o falta proyectos/salas, no se llama al lector. El modo de
desarrollo conserva las nueve métricas anteriores sin inventar identidad de plan.
14 focales de preferencias/RSC/lectura pasan; el autor04 pasó también GWT19
con valores/URLs y spy SQL sin lecturas de plan si las tarjetas están ocultas
o la ACL es parcial. Pendiente la revisión independiente de04.

Los servidores propios3111/PID61101 y3112/PID73015 se detuvieron tras cerrar01/02
para liberar recursos; bases/cachés/evidencias conservadas. No reutilizar esos
puertos sin comprobar proceso/destino. Permanecen03:3113,04:3114 y06:3116.
Estos deltas posteriores al corte903 se validan en la siguiente integración;
no se atribuye aquel build al código nuevo aún en construcción.


### Reauditoría03 y preparación05 · corte13:39UTC

Las tres P2 originales de03 están corregidas según reauditor independiente:
RSC/tardías, grupo A→C→A con orígenes directos/H conservados y rutas completas
en7PDF/32páginas. Detectó otra P2: reintentar deja de consultar el mismoID.
Root añadió generación explícita de observación sin reiniciar el Gestor:
RED2/2 reproducido, GREEN65/65 y lint; falta repetir Chrome/CLI y retirada RSC
independientemente. Evidencia `rea03/correccion-polling/` y revisión previa
`revision/rea03/correccion/REVISION.md`. No cerrar237 todavía.

05 ya tiene nueve tablas integradas literalmente y rollback que protege datos.
Se aplicó sólo al contenedor nuevo `av_design_rea05_prueba_20261015_db`,
IDba1587fa7fb4da3e3f36717e42a56130777a776e6f0d93f2a04c7fc9b1ec2425,
base/usuario `av_design_rea05_prueba`/`av_design_rea05`,127.0.0.1:5557.
Foto inicial82tablas hashd74ced48df10f631ae4f2ad2e575f5eac169a41d62bd8a19d0dd7768fe209d3a.
La creación del esquema no acredita horas/costes implementados. La integración
funcional05 sigue esperando04 verificada; app3115 todavía sin arrancar.


### Corte preliminar04/06 · compilación y conservación

Webpack sin BD, tipos y diffcheck aprobados. La batería preliminar pasó973/974:
el único fallo era la guarda que exigía pestaña propia a la nueva ruta de
propuestas; se conserva el acceso desde Documentos y se exige ese enlace
concreto. La guarda corregida pasa7/7 y los enlaces nuevos conservan typedRoutes
sin cast. Las fuentes de los autores seguían cambiando durante el corte:
no es todavía la validación conjunta final de04/06. Evidencia
`corte-04-06-preliminar/` y `rea06/integracion/navegacion-green.log`.

Preservación actual:438fuentes base presentes,17protegidas idénticas y642artefactos
históricos idénticos.05: rollback vacío y rechazo con historia verificados en
transacciones deliberadamente revertidas;82tablas con hash antes/después
idéntico, cero cambios persistidos (`rea05/integracion/esquema-verificado.json`).

### REA03 cerrada localmente ·16:37UTC

Revisor independiente repitió Chrome/API/CLI reales tras corregir polling:
fallida→202→pendiente→correcta automática; al terminar peticiones7→7 durante2,5s.
GET suspendido del reintento+retirada RSC+respuesta antigua no recupera datos ni
consultas. CAS/borrador y props semánticamente iguales conservados.65/65focales,
lint limpio y57tablas idénticas trascleanup; los dos SHA actuales coinciden y
las otras40fuentes siguen intactas. `revision/rea03/polling-final/REVISION.md`.
Se suman las revisiones originales de ACLgrupos/RSC/PDF. No hay hallazgos abiertos
REA03; scheduler/entrega externa sin configurar siguen expresamente fuera del
alcance local. Las regresiones conjuntas nuevas04/06 no se acreditan por esto.

06 ya congelada30fuentes, manifiestoSHA
b80e0b2b6831d1ab53ccc4e395fd911be2cf79c4f0cad7e39019454396a290cb.
Revisor nuevo `review_rea06_final` con contexto propio y base5558 exclusiva.
El corpus congelado definitivo es valorada1/larga16/estrés300líneas27páginas;
conserva las variantes anteriores. Reinicio3116 PID40205→51224/sesión36489:
PDF3760bytes ySHA97bba26cab06ba72ae133e0c8ad4bd47d37696fc90e4b5f9dd56918247d3d935
idénticos en descarga real, sin regenerar. Aún no aceptación independiente06.


### Pausa solicitada ·15-10-2026,16:40UTC

Sergio continuará en otro chat y solicita parar. Agentes04/revisor06/arquitecto07
interrumpidos; sin procesos propios de gates04/06 detectados. REA03 cerrada,
3113 detenido;04 aún no congelada y06 revisión independiente incompleta.
Contrato25 no escrito. WIP nuevo `src/lib/tiempos/fechas.ts` sin probar y con
propiedad ErrorPlan.detalles pendiente de concordar con detalle: no atribuir
los tipos/build previos al checkout posterior a ese WIP. Estado completo y
siguiente paso en `CONTINUACION_REA_ESTADO_ACTUAL.md`, aviso inicial prioritario.
Sin commit/push/merge/despliegue/producción.

### Reanudación: fechas05 verificadas y revisiones04/06

El coordinador nuevo comprobó Git/July, paro anterior y procesos antes de editar.
Ningún gate04/06 previo seguía activo. El helper WIP05 perdía las alternativas
de hora ambigua por usar `ErrorPlan.detalles` en lugar de `detalle`; se reprodujo
en RED y corrigió. La revisión independiente detectó después el máximo fijo de
366×24h: dos rangos civiles válidos duraban una hora más. Root repitió el repro
original en RED y validó el límite por días civiles. La reauditoría acepta sólo
esos helpers:31/31pruebas,10.128muestras de oráculo Python original y9/9rangos,
6hashes esperados coincidentes, sin cambios de03/04. Evidencia nueva
`output/rea-integracion/revision/rea05-fechas/correccion/`. No acredita runtime05.

04: autor congeló50fuentes y pasó17SQL/5carreras/5Chrome/23focales/tipos/lint.
El revisor reprodujo cincoP2 y unP3; root repitió sus repros de servidor/cardinalidad
en `revision/rea04/root-precorreccion/`. `finish_rea04` corrige conjuntamente.
06: revisor reprodujo unP1 y cincoP2; `fix_rea06` corrige conjuntamente.
No hay aceptación04/06 aún. Informes originales y todos los RED conservados.
25/REA07 quedó como contrato propuesto;26/REA08 se redacta sin producto.


## Cierre local04/06 y arranque del runtime05 · reanudación15-10-2026

REA04 queda cerrada localmente: seis hallazgos corregidos, reauditoría independiente
sin pendientes en ese alcance,27focales/17SQL/5carreras/6Chrome/28paridades.
`output/rea-integracion/rea04/correccion-reanudacion/aceptacion-root.json` contrasta
sus52fuentes con994pruebas y Webpack sinBD previos; no es entrega en producción.

REA06 queda cerrada localmente tras corregir seis hallazgos iniciales y tres
casos de integridad adicionales. La revisión `revision/rea06/integridad-final/`
reprodujo E3+valoración, decisión tardía y textoBOM1/125 frente a actualización
explícita3/375, además de ACL/precio/hash/TTL/PDF. Suplemento raíz conserva39de41
fuentes del autor y declara2compartidos modificados;41/41del corte raíz y71deps
coinciden. JS de motores/db idéntico, necesidad pura canónica reexportada desdeE1.

Gate raíz estable: snapshot de prueba `reanudacion-20261015/corte04-06-estable/`,
1001/1001pruebas y Webpack sinBD0. Excluye expresamente57archivos05en edición;
40fuentes de código06 coinciden y contrato24 permanece idéntico. Fallo previo
DNS de GoogleFonts conservado; repetición con las fuentes tipográficas0.
No sustituye el gate final del checkout completo tras congelar05.

05runtime en marcha con propietarios y bases separados: `implement_tiempos05`
en5557/app3115; `implement_costes05` en5559/app3117. Ninguno puede tocar el otro
ni compartidos. Fechas puras previamente aceptadas, sin cambios. Adaptador
financiero07 se acordó en contrato23 con tratamiento fiscal explícito por versión.
07A puede empezar tras este cierre06;07B espera05 verificada.08contrato aprobado;
09mínimo tipado/clasificador y85tablas sólo en nueva5562, sinruntime consulta;
vozlocal es-ES devuelveunavailable en Chrome155, sinmicro/descarga/fallbackremoto.
10contrato28 propuesto; raíz corrigió orden de locks a salas→proyectos→documento.
Todos los demás estados pendientes siguen explícitos; sin aceptación global.


### Avance local05/07 y unidades nuevas ·15-10-2026,20:35UTC

REA05 aceptada localmente en tiempos y costes. El gate independiente de la única
corrección de costes cierra4P2: exclusiones auditables, paginación de históricos,
preservación del borrador ante201tardío y residual con unidad. Raíz contrastó
110fuentes(57propias)y60evidencias. La posterior cabecera compartida08 sólo
modifica datos.ts fuera de sus57propias y se declara en aceptación-root.json.
El corte antiguo conserva bytes/hash, sin rellenar con fuentes vivas.

REA07A/C cierra tres hallazgos: respuesta tardía, autorización antes del cuerpo
y token ligado también al manifiesto/período comparados;87tablas y53evidencias
iniciales conservadas. REA07B tiene ejecutor propio y nueva5564(104tablas), sin
tocar5559/5560. REA08 congelada21fuentes, revisión independiente en curso con
suplemento raíz de enlaces y privacidad de cabecera. REA09 ejecutor/base5562(96)
en marcha, puente03 técnico e inicio visible del formulario03 en verificación.
REA10 sólo preparación: parser7puras, puenteTxE2 y escritores compartidos,SQL104
en nueva5563; sin requisitosruntime10. No aceptación ST33/global/publicación.


### Pausa expresa ·15-10-2026,20:52UTC

Sergio solicita parar y continuar mañana en otra conversación. Agentes08/09/07B
interrumpidos; puertos3119/3120/3121 libres comprobados. Contenedores/datos y WIP
conservados. Relevo prioritario `CONTINUACION_REA_2026-10-16.md`; evidencia de
pausa `output/rea-integracion/pausa-20261015/`.438fuentes iniciales presentes y
642artefactos históricos idénticos. Ningún commit/push/merge/despliegue/producción.

05 tiempos/costes aceptados localmente;07A/C gate focal cerrado, con integración
raíz posterior pendiente de revisión07B.07B23fuentes congeladas sin revisión;
caso>50propuestas pendiente.08 única corrección aún abierta: últimoChrome5pasados,
1fallido(defaultambitoacuerdo),2noejecutados.09 SQL y barreraACL verdes del autor,
Chrome pendiente; tsc global actual falla en dictado-local.test.tsx:13/15(never).
10 sólo preparación. Pool de producción compartido corregido y probado localmente,
y tiposNext estándar regenerados sinBD; no confundir gates antiguos con actual.

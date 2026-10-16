> **Publicación autorizada ·16-10-2026.** Sergio autorizó después del cierre local el commit, push de `codex/rea-integracion` y las migraciones necesarias de BD. Neon ya tiene las14 migraciones,104tablas y1357filas previas conservadas. Estado, mejoras y pasos de despliegue en [30-rea-publicacion.md](30-rea-publicacion.md). Render sigue en `main`/`adacf0e`; autoDeploy está activado. Esta autorización sustituye para esta entrega la prohibición Git/BD de los registros anteriores; no incluye merge a main ni despliegue.

# Integración REA · cierre local del 16-10-2026

**REA10 y la integración local aceptadas dentro de sus contratos y límites documentados.** La ronda adicional autorizada corrige el HTTP400 de catálogo/ofertas. El endpoint `base-tecnica` convierte a número la revisión BIGINT al construir su respuesta. El editor y el esquema estricto de PATCH permanecen intactos. Sólo cambia una expresión del producto y se añade la prueba de contrato incluida en `npm test`.

El fallo previo queda conservado: GET200 devuelve revisión como string y el mismo payload emitido por la UI provoca PATCH400 en ambos destinos. La prueba propia del revisor reproduce cuatro fallos con el original y pasa6/6 con el candidato. Las revisiones texto, negativas, fraccionarias y las claves ajenas siguen rechazándose con400 antes de escribir.

## Verificación del corte aceptado

| Gate | Resultado |
|---|---|
| HTTP/Chrome real | Driver03 completo con fixture nueva, sinCONTINUAR; cuatro destinos guardan200 y recargan selección, propuesta, motivo, checks y base/revisión; recuperación503 y rebase explícito |
| Catálogo/ofertas | Click de guardar200, preview200, casilla de revisión humana y confirmar200; aplicación y destino SQL trazables |
| Orden visual | Escritorio1440 antes de móvil390; técnico/puerto/salas09 con objetivos44px, teclado/foco y overflow0; sin errores ni solicitudes externas |
| Suite completa |1112/1112,186 suites,0 fallos,exit0 |
| Webpack sinBD, tipos, lint66, diff-check | Todos exit0; ES2017;21assets parser trazados |
| Revisión independiente | Sin hallazgos ni evidencia pendiente focal; GET y consultas SQL propios del revisor |
| Conservación BD sintética |104tablas,136filas anteriores al driver03 idénticas,190finales; también preservados los cortes previos3/40/87 |
| Conservación de evidencia |307artefactos previos sellados intactos;973artefactos gate conjunto,177HTTP y manifiesto del revisor contrastados por raíz |

Freeze del corte probado: `11ee30c911a624c34a3d6da4f682afd0456306890b702a9ddf2aa5abc73124a4` (926entradas:924fuentes visibles y dos auxiliares). Las861fuentes del candidato03 previo estaban intactas al arrancar; la única fuente previa de producto modificada en esta ronda es el endpoint. La nueva prueba es `src/lib/requisitos-base-tecnica.test.ts`. La documentación de cierre se actualiza después del freeze y se contrasta aparte; no altera el código probado.

## Evidencia y continuidad

Todas las rutas siguientes parten de `output/rea-integracion/rea10/serializacion-ronda-adicional-20261016/`:

- `raiz/aceptacion-root.json`: aceptación raíz y contrastes mecánicos propios.
- `revision-independiente/dictamen.json` y `DICTAMEN.md`: revisión focal independiente; SHA del JSON `3b0ed92d1041d16d2c59d1df5601dc281e03984b58a54d11f4c01ada565e75e9`.
- `autor-contrato/`: prueba roja y verde, rutas originales y delta exacto del parche preparado.
- `ejecutor-http-ui/pre/resultado-pre-3.json`: reproducciónHTTP400 original sin coerción del conductor.
- `ejecutor-http-ui/post03/resultado-completo-5.json`: recorrido completo verde; `manifest-final.json` sella177artefactos, SHA `28a0cf39c83448b052c259dfe4d88fd47cfeba53e6afb2ec9ab1c2b22d9c349b`.
- `gate-conjunto/`: suite,build,tipos,lint,diff,assets y freeze; `manifest-evidencias.json` sella973artefactos, SHA `8ee9ee9efe9b2c506f13f621a335863ff6ad0bf0232d1c66d01ba3fcf763c25c`.

Se conservan los dos rojos instrumentales del nuevo conductor: una comprobación SQL usó `proveedor` en vez de su FK y otra comparó literalmente una etiqueta técnica que cambia al recuperar una base conservada. Sólo se corrigió el conductor; cada repetición usó una fixture nueva y recorrió todo desde el principio. No se ocultó el rojoHTTP400 previo ni se usóCONTINUAR para aceptar el parche.

Único checkout `/Users/sergio/Desktop/Aplicaciones/AV_design`, rama `codex/rea-integracion`, HEAD `7ba796077ff39e799b9b7eb87109b648c3df5c2d` conservado. No commit,push,merge,despliegue ni producción. La base nueva `av_design_rea10_serializacion_prueba` y su usuario/puerto real se verificaron antes de escribir; Docker publica5569 sólo en127.0.0.1. Se cargó schema y fixtures sintéticas, nunca seed ni CSV reales. QA3130 se detuvo porPID/CWD comprobados; ambasQA,volumen,intentos y bases anteriores se conservan. Build separado sin.env, con preload/fontmock locales; sus generados no se copiaron al producto.

July: proyecto `av-design`, memoria385 y sesión282 recuperados. Sesión de esta ronda285 `av-design-rea10-serializacion-2026-10-16`; pendientes244 y233 cerrados con estas evidencias. No se reabren07B/08/09 ni se relanzan prompts históricosE2/E3.

## Límites conservados

El cierre sólo acredita esta integración local con datos sintéticos. No amplía los límites de las unidades cerradas ni certificaST33general fuera del alcance del dictamen05. Voz real esES no disponible enChrome155; teclado verificado. OCR y proveedor generativo siguen sin configurar; scheduler/transporte externos sin desplegar. La reversión de un alta sala+BOM conserva la sala si la auditoríaE2 la referencia medianteFK.

Incidente09 conservado: ocho raws auxiliares anteriores y un puntero fueron sobrescritos y no pudieron recuperarse. El contraste actual de manifiestos no permite afirmar conservación histórica total. Los rojos y límites del registro anterior mantienen su fecha; no representan el estado vigente del parche.

## Registro anterior al parche · histórico

# Integración REA · entrega local del 16-10-2026

**Estado: relevo para una ronda adicional autorizada de REA10.** REA07B,
REA08 y REA09 han superado sus gates selectivos independientes. Los seis
hallazgos iniciales de REA10 están corregidos, pero su gate completo sigue
bloqueado por dos PATCH400 reales de catálogo/ofertas. Sergio autorizó corregir
ese bloqueo y pidió la instrucción aparte para liberar contexto. El parche
está preparado **sin aplicar**. No hay aceptación global ni de producción.

Continuación única: [CONTINUACION_REA_RONDA_ADICIONAL.md](/Users/sergio/Desktop/Aplicaciones/AV_design/docs/CONTINUACION_REA_RONDA_ADICIONAL.md).

## Checkout y límites

- Único destino de implementación: `/Users/sergio/Desktop/Aplicaciones/AV_design`.
- Rama `codex/rea-integracion`; HEAD conservado
  `7ba796077ff39e799b9b7eb87109b648c3df5c2d`.
- Sin commit, push, merge, despliegue ni escritura en producción.
- Xtenav conserva la investigación. No se relanzaron los prompts históricos
  E2/E3 ni se volvió a implementar una unidad cerrada.
- July: proyecto `av-design`, memoria385, sesión anterior277 recuperada y
  sesión282 `av-design-rea-integracion-2026-10-16` cerrada con relevo pendiente.

## Resultado por unidad retomada

| Unidad | Estado local | Evidencia independiente y contraste de raíz |
|---|---|---|
| REA07B | Dos P2 de paginación corregidos y verificados | `output/rea-integracion/revision/rea07b/correccion-20261016/dictamen.json`; aceptación en `rea07b/correccion-20261016/aceptacion-root.json` |
| REA08 | Cinco P2 corregidos y verificados | `output/rea-integracion/revision/rea08/correccion-20261016/dictamen.json`; aceptación en `rea08/correccion/20261016T084354Z/aceptacion-root.json` |
| REA09 | F01/F02 corregidos y verificados | `output/rea-integracion/revision/rea09/correccion-20261016/dictamen.md`; aceptación en `rea09/correccion/20261016T090932Z/final2/aceptacion-root.json` |
| REA10 | Seis hallazgos iniciales corregidos; bloqueo HTTP400 adicional y ronda autorizada sin ejecutar | Contrato28; `output/rea-integracion/rea10/runtime-20261016/` y `integracion-consultas-20261016/` |

REA00–06 y REA07A/C mantienen los cierres previos y sus evidencias recogidas en
`docs/18-rea-cobertura.{md,json}`. La matriz de 34 candidatos conserva su
clasificación inicial; `ejecucion_unidades` registra la entrega posterior.

Se respetan las rondas consumidas: la corrección08 ya estaba abierta al retomar;
07B y09 tuvieron primera revisión y una sola corrección conjunta, seguida de
gate selectivo. REA10 consumió también esa corrección y su gate; se observó
un bloqueo adicional. Sergio autorizó una ronda extra acotada para otro chat;
aún no se ha aplicado.

## Comportamiento comprobado en esta continuación

REA07B recorre 51 propuestas y 51 cortes mediante páginas de 50 + 1, sin duplicados y con
el orden SQL esperado. El contexto explícito funciona aunque la propuesta esté
fuera de la primera página. Navegar conserva selección, corte, motivo y
declaración; permite leer historia y preparar otro contraste.

REA08 valida el ordinal contra la revisiónE3, avisa de cambios del origen,
reproduce una petición idéntica después del TTL sin duplicar escrituras,
precarga todas las condiciones del acuerdo y conserva el borrador propio al
recuperar permisos. Se contrastaron también privacidad de cabecera y enlaces.

REA09 bloquea el turno completo antes de consultar su contenido cuando se
retiran las filas de origen. La ficha exacta incluye los datos técnicosE2,
unidades, procedencia, URL, fecha y verificación. Un cambio accesible conserva
la respuesta anterior y la marca histórica.

El puente nuevo REA10→REA09 exige elegir entre 1 y 20 fragmentos revisados y
entre 1 y 20 salas de la obra. El enlace prepara la selección; la persona crea la
conversación y envía la pregunta. La respuesta conserva la cita de página o
línea, método, offsets UTF-16 y hash. Retirar la fuente elimina texto y cita
del turno visible. No se reconstruye contenido purgado desde planes antiguos.

REA10 conserva la identidad local del candidato entre reextracciones, reconoce
aplicaciones legadas sin reescribir historia y evita duplicados concurrentes.
Los cambios de puertos incrementan una revisión durable del artículo incluso
al borrar el último. Las lecturas finales comprueban los permisos de destino;
el motivo manual conserva autor y fecha y desaparece al purgar. El gate
independiente B01–B04 consta de ocho comandos con exit0 y preserva104 tablas y
1114 filas previas.

U01 conserva las propuestas de los cuatro destinos, incluida la medida1210mm
frente a una base1200mm; comprobar cambios exige rebase explícito. U02 cumple
44px en las etiquetas técnicas, puertos y selección de salas, con teclado y
sin desbordamiento a390px. Sin embargo, catálogo/ofertas emiten
`revisionArticulo` como string y el PATCH real devuelve400. Técnico y puerto
sí guardan200 y recargan. El [dictamen UI](/Users/sergio/Desktop/Aplicaciones/AV_design/output/rea-integracion/revision/rea10/correccion-ui-20261016/DICTAMEN.md)
y sus70 artefactos se contrastaron por SHA. El gate completo permanece exit1;
no se convirtió en un éxito parcial.

La [propuesta sin aplicar](/Users/sergio/Desktop/Aplicaciones/AV_design/output/rea-integracion/rea10/bloqueo-serializacion-20261016/propuesta-no-aplicada.patch)
normaliza la revisión en el endpoint existente. El relevo contiene los cuerpos
400, hashes, conductor repetible, autorización y validaciones necesarias.

## Validación actual y sus límites

| Comprobación | Resultado observado | Evidencia |
|---|---|---|
| Gate07B | 11 pruebas puras, HTTP/Chrome y104 tablas idénticas; exit0 | Revisión selectiva07B |
| Gate08 | Cinco hallazgos verdes;63 fuentes contrastadas | Revisión selectiva08 y aceptación raíz |
| Gate10 backend | B01–B04 corregidos;8 comandos exit0,38 artefactos contrastados | `revision/rea10/correccion-backend-20261016/` |
| Gate10 UI | U01/U02 corregidos; gate completo exit1 por catálogo/ofertas400 | `revision/rea10/correccion-ui-20261016/` |
| Gate09 | 15 controles SQL, 5 pasos Chrome y 4 pruebas de modelo, tipos/lint;93 tablas ajenas idénticas | Revisión selectiva09 |
| Puente09–10 | 19 controles SQL;85 filas iniciales conservadas,93 tablas enteras idénticas | `rea10/integracion-consultas-20261016/sql-2026-10-16T10-46-11-095Z-a971468c/` |
| Navegador09–10 | Cinco pasos completos; escritorio antes de móvil de 390 px; cero errores y solicitudes externas | `rea10/integracion-consultas-20261016/chrome-04/` |
| Regresión principalE2 tras corrección10 | Diez comprobaciones;104 tablas,12 fotos,48 dependencias estables | `reanudacion-20261016/regresion-e2-cierre/20261016T112452Z/INFORME.md` |
| Suite conjunta final | 1106/1106,186 suites,exit0;859 fuentes de copia sin drift | `reanudacion-20261016/final-coordinador/pruebas-candidato-03.{json,log}` |
| Build Webpack sin BD, tipos, lint y diff | Exit0;65 archivos lint,7 assets parser incluidos | `reanudacion-20261016/final-coordinador/candidato-03/` |

Los builds de autor usan una copia sin `.env*`, el preload `sin-env.cjs` en
todos los procesos Next y respuestas CSS de fuentes públicas respaldadas por
WOFF2 locales con SHA. No se cambian los imports de fuentes del producto. Los
gates antiguos 1001/1029 pertenecen a otros cortes y no se atribuyen al actual.

El corte congelado previo al parche pendiente es `779f560a7f5c4d5bc57a410bfeec77a30025b24fbff1202deeb18dd0bbca3c77`
(861 entradas). El candidato03 difiere del02 únicamente en un conductor de
verificación: la expresión regular DOTALL se expresa mediante `[\s\S]` para
el target ES2017. El rojo TS1501 anterior queda preservado. El primer intento
de suite sin acceso al monitor local falló en cinco pruebas PDF; con el acceso
a procesos que requiere el aislamiento, las1106 pasan.

El build genera `next-env.d.ts` y ajustes de `tsconfig.json` únicamente en la
copia QA. Sus bytes se conservan en `generados-build/`; el checkout mantiene
los861 hashes del freeze. El preload y los assets del parser tienen hashes
verificados y están incluidos en la traza del build.

La regresiónE2 conserva fotografías completas. Sólo excluye de la igualdad de
contenido los contadores técnicos `salas.diseno_version` y `actualizado_en`,
cuya monotonicidad se comprueba; `revision_fuente` permanece íntegra.

## Aislamiento y conservación

Todos los servidores Postgres se publican sólo en loopback y contienen datos
sintéticos. Se verifican base, usuario y puerto real antes de escribir.

| Puerto | Base sintética | Uso |
|---|---|---|
| 5561 | `av_design_rea08_prueba` | Corrección08 |
| 5562 | `av_design_rea09_prueba` | Corrección09 |
| 5563 | `av_design_rea10_prueba` | Runtime10 |
| 5564 | `av_design_rea07b_prueba` | Revisión y corrección07B |
| 5565 | `av_design_rea10_puente_prueba` | PuenteE2, auditoría y consultas09–10 |
| 5566 | `av_design_rea_final_e2_prueba` | Primera regresiónE2 del incremento |
| 5568 | `av_design_rea_e2_cierre_prueba` | RegresiónE2 tras corrección10 |

No se reseteó ninguna base existente. Los volúmenes y los intentos fallidos se
conservan. Las 857 fuentes presentes al comenzar siguen existiendo:819 tienen
el mismo hash y38 cambios intencionales. El contraste mecánico preserva también
los manifiestos de evidencia aceptada; no equivale a verificar toda la historia
fuera de esos manifiestos.

**Incidente de conservación de evidencia09:** un conductor de autor con rutas
fijas sobrescribió ocho artefactos auxiliares anteriores y un puntero operativo.
No se encontró copia recuperable. Se conservó el error, se separaron las nuevas
salidas por fecha y no se reconstruyeron los bytes perdidos. El detalle está en
`output/rea-integracion/rea09/consultas-runtime/20261016T0851Z/incidente-evidencia.json`.
Los rojos restantes y las fuentes de producto se conservan. No afirmar que toda
la evidencia histórica quedó intacta.

## Capacidades dependientes del entorno

El dictado local en español aparece no disponible en Chrome155; el recorrido
completo por teclado está verificado. No se activó micrófono ni se descargó un
motor, y no existe alternativa remota implícita. Los dobles de prueba no
acreditan voz real.

El OCR y el proveedor generativo permanecen sin configurar. La extracción local
y la revisión manual no se presentan como OCR ni como generación por un modelo.
REA03 conserva la definición y el runner local; no hay scheduler desplegado ni
transporte externo acreditado. Estas condiciones no se confunden con errores
de código ni con un despliegue realizado.

Los QA3123/3124 y3126 usados en los últimos gates se detuvieron tras verificar
PID y carpeta. Las bases sintéticas y sus volúmenes se conservan. El sucesor
debe verificar nuevamente agentes/procesos antes de editar.

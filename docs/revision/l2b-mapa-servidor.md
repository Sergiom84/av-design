# L2B · Mapa de servidor y migración

Inspección estática del árbol compartido, 08/09/2026. Preparación solamente: no
se ejecutaron consultas, migraciones, generador, pruebas ni operaciones Git.
Contrato: `l2-diseno-previo.md`, L2 de plan 40 y `l2a-contrato.md`. La precisión
final separada corresponde a L3. El director confirma que la holgura de roseta
queda configurable y desconocida cuando falta; no requiere inventar un valor.

## Superficies concretas

| Archivo / función | Situación observada | Cambio necesario |
|---|---|---|
| `db/schema.sql`, sección `tomas_red` (~380), migración nueva | Coordenadas nulas independientes, código único por sala; sin capacidad ni bocas | Capacidad nullable, `toma_red_bocas`, capacidad y ordinales coherentes en transacción, referencia física pendiente tras copia |
| `db/schema.sql`, `conexion_bocas` (~1590) | Equipo/puerto/ordinal obligatorios; PK conexión/lado, UNIQUE boca física | Alternativa excluyente equipo o `toma_boca_id`; conservar PK/UUID y UNIQUE equipo; añadir UNIQUE roseta y FK RESTRICT |
| `validar_conexion_boca`, `validar_plantilla_conexion_boca` | Resuelven solamente equipo/línea y puerto; puerto bloqueado FOR UPDATE | Bifurcar por tipo; verificar sala/plantilla, placa, capacidad y boca documentada, con locks coherentes |
| `exigir_pareja_conexion_bocas` y equivalente plantilla | Aceptan cero o dos filas; disparan únicamente al mutar bocas | Pareja completa y columnas compatibles al cierre; trigger también sobre conexión para detectar altas sin ninguna boca |
| `invalidar_bocas_legacy_conexion`, equivalente plantilla | Cambiar extremos borra automáticamente la pareja | Sustituir coordinadamente: nunca degradar conexión completa a histórica al actualizar columnas compatibles |
| `proteger_equipo_con_bocas`, `proteger_linea_con_bocas` | Protegen artículo y cantidad, no sala/plantilla | Guardas inversas de traslado también para equipo, línea, placa y boca; no basta comprobar INSERT |
| `src/app/acciones.ts`: `anadirToma`, `guardarToma`, `borrarToma` (~1030) | Sala bloqueada y versión; admite XYZ parciales; borrar placa SET NULL documental | Alta/edición de capacidad y bocas atómicas; nuevas coordenadas completas o ausentes, preservar parciales históricos al no editarlas; explicar rechazo de placa ocupada |
| `acciones.ts`: `detalleBocasDelFormulario`, `bloquearExtremosBocas`, `guardarDetalleBocas` (~1111) | Formato equipo/puerto/ordinal en ambos extremos | Contrato tipado común con editor; bloqueos de placas/bocas además de equipos/puertos; escritura de dos alternativas coherentes |
| `acciones.ts`: `anadirConexion`, `anadirConexionConEstado`, `guardarConexion`, `borrarConexion` (~1157) | Exigen dos equipos; error estructural puede ser retorno silencioso; wrapper reconoce solo UNIQUE equipo | Ambos tipos, errores legibles conservando campos; guardar detalle de legacy sin recrear cable; borrar limpia vínculo documental mediante FK SET NULL |
| `acciones-diagrama.ts`: `esquemaEditorConexiones`, `guardarEditorConexiones` (~777/825) | Valida IDs temporales de equipos, puertos, ocupación, guarda versión/cierre y escribe lote completo | Unión discriminada; referencias temporales solo equipos declarados; rosetas con UUID reales y sala correcta; colisión dentro de lote y con BD por clave tipada |
| `acciones-diagrama.ts`: `guardarDiagramaSala` (~237, tomas ~446/557) | Plano guarda XYZ y asignación documental | Preservar capacidad/bocas cuando no se editan; traslado físico modifica cálculo; ninguna escritura de esquema debe alterar XYZ |
| `acciones.ts`: `anadirEquipo`, `guardarEquipo` (~903/948) | Escriben `toma_red_id` documental | Conservar asignación; validar cualquier vínculo de conversión al cambiar equipo/placa, sin convertir automáticamente |
| `acciones.ts`: `crearSala` (~215), `crearPlantillaDesdeSala` (~654) | Mapas solo equipo/línea; saltan conexiones si falta cualquiera de esos mapas | Mapas separados equipo/placa/boca/conexión; copiar rosetas antes de tiradas; no saltar una tirada válida porque su extremo no es equipo |
| `acciones-diagrama.ts`: `aplicarPlantillaAlDiagrama` (~1154) | Exige sala vacía incluyendo tomas; copia equipos, conexiones y puntos | Mantener guarda de sala vacía; incorporar placas/bocas/mapas y validación geométrica final dentro de la transacción |
| `acciones.ts`: `anadirTiradaPlantilla`, `quitarTiradaPlantilla` (~1348) | Nueva tirada usa dos líneas y bocas | Misma semántica de extremos y ocupación; no abrir una vía nueva sin detalle |
| `src/lib/datos.ts`: `obtenerSala` (~729) | JOIN bocas para ordinales; fallback a puertos legacy; IDs mediante String | Lectura tipada que distingue histórico/completo, conserva null y carga bocas de roseta; no interpretar String(null) como identificador |
| `src/lib/datos.ts`: `tiradasDePlantillas` (~565) | Lector separado de tiradas de plantilla | Extremos tipados y referencias de placa pendientes; no ocultar tiradas no equipables |
| `src/lib/datos-plano.ts`: `obtenerDatosPlanoSala` | No consulta `conexion_bocas`; también convierte IDs con String | Compartir decodificación de conexión y resolución con datos.ts sin cargar todo el catálogo para Plano |
| `scripts/sql-sincronizar-puertos.mjs` | Diagnósticos de uso recorren legacy y bocas de sala/plantilla | Regresión obligatoria al admitir columnas null; no cambiar UUID/ordinal ni tocar seed manualmente |

## Invariantes de migración y concurrencia

1. Extremo equipo: equipo, puerto y ordinal presentes; boca de toma ausente.
   Extremo roseta: solamente FK a boca documentada. No UUID polimórfico y no
   equipo ficticio. Nullable en columnas compatibles de conexiones y plantillas.
2. `detalle_extremos` distingue legado existente del detalle completo. Backfill
   marca exclusivamente filas anteriores sin pareja; las altas normales no pueden
   crear cero bocas ni solicitar `legacy`. La transición completo→legacy se
   rechaza. Las columnas de equipo/puerto deben coincidir con bocas detalladas;
   son null cuando el lado es roseta.
3. El trigger diferido debe comprobar ambos propietarios si se actualiza
   `conexion_id` de una boca: `coalesce(new, old)` solo comprueba el destino y
   puede dejar incompleta la conexión anterior. Alternativa mantenible: identidad
   conexión/lado inmutable y sustitución explícita por DELETE/INSERT en lote.
4. Capacidad null no es cero ni dos. Alta N requiere exactamente ordinales 1..N;
   no borrar ni reducir bocas ocupadas. Cambiar placa propietaria de una boca,
   sala de placa o equipo, y plantilla de línea también deben quedar protegidos.
5. Bloquear sala antes de hijos; establecer un único orden entre conexiones,
   equipos, placas, bocas y puertos, todos ordenados por UUID dentro de cada
   tabla. Reusar el orden en acciones de capacidad y conexiones. La comprobación
   inversa SQL no puede quedar expuesta a carreras que el bloqueo de sala de la
   aplicación oculte en tests ordinarios.
6. FK de asignación→conexión exige mismo equipo y placa en ambos extremos.
   Conversión explícita reintentada devuelve el ID existente; conflictos reales
   entre dos cables/rutas no deben sobrescribir silenciosamente la conexión
   previa. DELETE conexión deja asignación pendiente mediante SET NULL.
7. L2A sigue siendo autoridad de etiquetas. Ni nuevas rosetas ni copiar tiradas
   escriben etiqueta/serie/correlativo desde cliente o plantilla. Rollback de
   toda transacción también revierte contador no confirmado y versión.

## Orden de implementación recomendado

1. Fijar DTO de extremo/lectura y firmas con director y ejecutor UI. No editar
   `tipos.ts`, `editor-conexiones.ts` o bocas comunes desde dos radios simultáneos.
2. Congelar base L2A aprobada. Migración en transacción con bloqueo de tablas
   afectadas, snapshot UUID→etiqueta/extremos/puntos y preflight de parejas
   existentes. Crear placas/bocas de plantilla y campos nuevos sin inventar datos.
3. Backfill de estado histórico una sola vez, eliminar invalidación destructiva,
   sustituir funciones/triggers y activar guardas de parejas/capacidad/traslado.
   Repetir migración no reclasifica cables nuevos ni regenera bocas.
4. Acciones de placas + conexión tipada + conversión documental; luego tres
   caminos de copia. La transición de esquema y acciones es un único lote local,
   no un despliegue parcial compatible con clientes antiguos.
5. Lectores compartidos, cálculo/tabla y UI mediante DTO acordado. Ejecutar
   regresión equipo/equipo, migración anterior poblada y copias antes de QA.

## Asperezas que deben cerrarse en contrato de implementación

- **Copia de tirada histórica sin bocas:** hoy las tres copias permiten crear
  tiradas nuevas sin pareja. El contrato aprobado prohíbe nuevas legacy, mientras
  exige conservar historial y no inventar ordinales. No se resuelve introduciendo
  una excepción silenciosa de alta. Propuesta conservadora: rechazar la copia
  entera con las tiradas que requieren documentación previa; si se pretende copiar
  también ese legado sin bocas, hace falta precisión del diseño y prueba de que
  no abre una vía genérica de inserción legacy. Decisión del director/revisor
  antes de implementar esa rama, sin preguntar de nuevo por capacidad/holgura.
- **Longitud manual y copia:** `plantilla_conexiones` no tiene longitud manual;
  ninguno de los SELECT de copias la transporta. Además `crearSala` no copia
  puntos, mientras `aplicarPlantillaAlDiagrama` sí. Preservar precedencia y
  geometría del contrato exige incluirlo explícitamente en L2B, no limitar la
  migración a las rosetas.
- **Códigos de edificio copiados:** definir columnas distintas de referencia
  heredada/confirmación; no reutilizar un booleano de posición como prueba física.
  Las fuentes y autorías comprobadas del edificio de origen no se transfieren.

## Verificación reutilizable

`scripts/verificar-base-plan40.mjs --solo=...` crea una BD UUID propia, aplica
schema/seed y elimina solo esa base; admite `--plan`. Usarlo como envoltorio
para `bocas-puerto`, `editor-conexiones`, `concurrencia`, `diagrama`, `plantillas`,
`guarda-equipos` y `rutas-cable`. Los verificadores `.mts` internos pueden caer
por defecto en la BD compartida: no invocarlos sin un destino desechable explícito.

Reusar `verificar-etiquetas-cable.mjs` y pruebas de lectura/respuesta L2A,
`verificar-seed-puertos.mjs` para regresión L1A y el patrón de
`verificar-migraciones-plan40.mjs` para esquema previo poblado, repetición,
preservación y mutantes en copia. No se ejecutó ninguno durante este mapeo.

Nuevas aserciones deben cubrir SQL directo además de acciones: pareja ausente,
mixta e incompleta, inserción legacy, traslado, FK documental incoherente,
reducción de capacidad ocupada, carreras capacidad/conexión y doble conexión a
misma boca; rollback después de bocas también revierte equipos, esquema y
etiquetas. Copiar por los tres caminos conserva null/parciales/ceros, puntos y
manual, remapea todos los UUID y deja códigos pendientes. Medir fallos reales
al retirar cada guarda en copia aislada; no estimarlos.

## Radio de colisión

Servidor/SQL/copias constituye una unidad serial: `db/schema.sql`, migración,
ambas acciones, lectores y verificadores DB. Comparte `tipos.ts`, bocas y
`editor-conexiones.ts` con UI/cálculo; esos contratos necesitan un propietario
único antes de paralelizar. El generador y diagnósticos de puertos siguen bajo
propietario exclusivo. Ninguna parte de este mapa acredita el gate L2B.

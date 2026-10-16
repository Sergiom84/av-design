# REA-03 · Informes reproducibles y programación interna

15-10-2026. **Especificación lista para implementar; no acredita una implementación
ni un proceso desplegado.** Contrato padre: `17-integracion-rea.md`. Cubre ST18,
ST19 y ST20 de `18-rea-cobertura.md`, después de R1 y REA-02. Único destino:
AV_design, rama `codex/rea-integracion`. Sin commit, push, despliegue, correo,
comunicación externa ni escrituras en producción.

## Resultado y decisiones resueltas

La persona elige una definición conocida, ámbito, período y uno o varios formatos,
revisa la selección y sus receptores y solicita el informe. Puede guardar esa
definición y programarla. La aplicación conserva ejecuciones, errores, última
ejecución correcta y archivos descargables con autorización vigente. La selección
es determinista, por formulario; no necesita IA ni interpreta texto libre como SQL.

Los archivos se conservan en **Postgres, como `bytea`**, junto al snapshot y su
manifiesto. Así sobreviven al proceso web y al runner, sin requerir un disco de
Render ni un proveedor nuevo. No se guardan enlaces a los paquetes E1 temporales,
URLs firmadas caducadas ni rutas de `.tmp`. La retención de esta unidad es 30 días.

El runner es un proceso Node local ejecutable de verdad, con modo una pasada y
modo continuo. Una programación guardada no demuestra que exista un proceso que
la atienda: la interfaz distingue «Sin runner», «Runner detenido», «Runner activo»
y «Última pasada manual». Esta unidad no instala cron, servicio, contenedor ni
scheduler en Render. Entrega interna y transporte externo tienen estados
separados: `disponible_en_aplicacion` y `entrega_externa_no_configurada`.

No se añade otro BOM, motor de cable, estado editable, beneficio, facturación,
horas ni porcentaje de avance. Precio desconocido sigue siendo ausencia.

## Base real y reutilización

| Fuente comprobada | Contrato de integración |
|---|---|
| `documentos/datos.ts::cargarSnapshot` realiza una lectura MVCC y carga diseño E3, material adicional E2, catálogo, parámetros, disponibilidad y reservas. | Se conserva su API E1. Un extracto interno permite reutilizar esa carga en la transacción del informe y para una selección de salas ya resuelta por el servidor. No llamar a este cargador para informes de carga o estado. |
| `documentos/tablas.ts::construirBom` consolida necesidad antes de descontar existencias/reservas y conserva precios ausentes/orientativos. | Es la única construcción del material actual. Reutilizar `necesidadExportada` para detalle por sala, sin repartir varias veces el mismo stock. |
| E1 tiene `generarBomCsv`, `generarXlsx`, `codificarCsv` y `textoSeguroCsv`; PDF técnico sólo dibuja plano/elevaciones/esquema. | Reutilizar los exportadores tabulares cuando corresponda y su seguridad de texto. El PDF de informes es una tabla paginada con PDFKit existente, no una captura ni una variante del plano. |
| `documentos/paquete.ts` escribe en tmp con 30 minutos de vigencia y admite parciales. | No usar como almacenamiento, cola, ACL ni modelo de éxito de REA-03. Un informe sólo es correcto cuando están persistidos todos sus formatos pedidos. E1 conserva su comportamiento. |
| `datos-proyectos.ts::obtenerProyecto` consulta también pedidos; `datos-almacen.ts::cargasDeSala` lee todas las cargas antes de filtrar. | No usarlos en lectores de REA-03: consultas acotadas al ámbito y a las fuentes permitidas antes de leer. |
| `proyecto.ts::estadoDeSalaEnPortada`, `carga.ts::resumenCarga`, `almacen.ts::SIGNO_MOVIMIENTO` y `usuarios.ts::resolverPermisos/puede` ya fijan significados. | Reutilizar esas funciones; no inventar otro semáforo ni sumar cantidades de distintas unidades como un total útil. |

Se han leído las guías instaladas
`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y
`01-app/03-api-reference/04-functions/after.md`. Los Route Handlers no heredan
layout, sus params son asíncronos y cada handler lleva autorización propia.
`after()` tiene la duración de la ruta: **no es una cola durable ni un scheduler**.
El POST encola y responde; nunca deja una promesa suelta generando el informe.

## Registro cerrado de informes y significado del período

Seis claves de registro, versión inicial `1`, agrupadas en tres módulos. No hay
campos, agregaciones o filtros arbitrarios suministrados por el cliente.

| Clave / módulo | Período válido y filas | Secciones mínimas de lectura |
|---|---|---|
| `material_actual` / material | `actual`: BOM E1 de las salas resueltas, detalle y advertencias de cálculo; existencias/reservas/precios actuales. | `salas`, `proyectos`, `catalogo`, `parametros`, `almacen`, `compras`. El cargador E1 lee estas fuentes incluso para una sola sala. |
| `material_movimientos` / material | `rango`: movimientos todavía registrados cuya `movimientos.fecha` pertenece al rango; cantidad, unidad, tipo y signo canónico. | `almacen`, `catalogo`, `salas`; también `proyectos` para ámbito obra/sede. |
| `carga_actual` / carga | `actual`: cargas y sus líneas actuales; estado, marcado, instalado/devuelto/roto, resumen y avisos existentes. | `carga`, `salas`, `catalogo`; también `proyectos` para obra/sede. No leer movimientos ni reservas para recalcularlos. |
| `carga_hechos` / carga | `rango`: una fila `alta` por `cargas.creado_en` y una fila `cierre` por `cerrado_en` dentro del rango. ID, nombre y fecha registrada, sin afirmar qué cantidades o marcas había entonces. | `carga`, `salas`; también `proyectos` para obra/sede. No necesita catálogo. |
| `estado_actual` / estado | `actual`: estado ligero de cada sala por medidas/hitos existentes; estado de obra por hitos cuando el ámbito lo incluye. No incluye el semáforo completo de montaje ni pedidos. | `salas`; también `proyectos` para obra/sede. |
| `estado_hitos` / estado | `rango`: hitos de sala y, en obra/sede, de proyecto, por su campo `fecha` de tipo `date`. Tipo, fecha, técnico registrado y nota. | `salas`; también `proyectos` para obra/sede. La proyección nombre/id de técnico es atribución del hito, no gestión de usuarios. |

`actual` significa **observado en la lectura de esta ejecución**. La fecha de
observación se obtiene de `transaction_timestamp()` dentro de su lectura MVCC.
No admite un campo «a fecha» arbitrario. No filtra material/stock/estado por fecha
de creación y no reconstruye el pasado usando datos actuales. Si una ocurrencia
del lunes se ejecuta el martes, se muestran ambas fechas y «Captura posterior a la
hora prevista». No se etiqueta como estado del lunes.

`rango` significa hechos que **permanecen registrados en el momento de lectura**.
Un hito borrado/corregido o un movimiento eliminado no forman un historial
inmutable del sistema. El snapshot conservado sí acredita lo leído en esa
ejecución. `actualizado_en` no es un diario de cambios: no se usa para inventar
recepciones, cambios de estado ni acciones de marcado de carga.

Rango fijo: fechas civiles estrictas `YYYY-MM-DD`, desde/hasta inclusivas y
`desde <= hasta`, máximo 366 días. Para timestamps se convierte en
`[medianoche(desde, Europe/Madrid), medianoche(hasta + 1 día civil, Europe/Madrid))`;
no sumar 86.400 segundos. Los días del cambio horario tienen 23 o 25 horas.
Para `hitos.fecha` se compara directamente el `date` inclusivo, sin conversión a
UTC ni cambio de día. En la UI y todos los archivos constan el rango civil, zona
y, donde corresponda, sus dos límites UTC.

Para programaciones de claves `rango` se admite rango fijo o `dia_anterior`,
`semana_anterior` (lunes a domingo) y `mes_anterior`, siempre respecto a la **fecha
civil de la ocurrencia prevista**, no al día del reintento. Un mes se calcula con
calendario, no con 30 días. La ejecución congela sus límites resueltos. Las claves
`actual` sólo admiten `{ modo: 'actual' }`. Vacío, fecha imposible, `null` inesperado
o texto numérico no se convierten en epoch/1970.

Columnas y orden se declaran en el registro. Todas las filas tienen clave estable
(UUID o `cargaId:alta|cierre`); orden principal por fecha/nombre según el informe y
desempate por clave. No depender del orden incidental de SQL, de un `Map` o del
idioma del sistema operativo. Fechas ISO en datos; es-ES sólo en presentación.

## Ámbito y lectura coherente

Ámbitos exactos: `{ tipo:'sala', id }`, `{ tipo:'obra', id, salaIds?:[] }` o
`{ tipo:'sede', id, salaIds?:[] }`. Lista omitida significa todas las salas
pertenecientes **en esa ejecución**; una lista explícita es una selección fijada
de IDs, se muestra como tal y debe seguir perteneciendo al ámbito. Nunca omitir
silenciosamente una sala eliminada, trasladada o ajena: `AMBITO_CAMBIADO`.

La sede efectiva de una sala con obra es `proyectos.sede_id`; para legado sin obra
es `salas.sede_id`. Se resuelve mediante left joins. Una sala sin obra es válida,
no se inventa un proyecto; una obra sin sede no entra en otra sede por un valor
antiguo de la sala. Ámbito sala sin permiso de proyectos no consulta ni devuelve
la jerarquía: sólo su identidad y fuentes propias. La definición de material
requiere proyectos por las lecturas E1 descritas arriba.

Primero se valida sesión/identidad real y la lista de permisos de la clave y
ámbito. Después, en una lectura `repeatable read read only`, se releen propietario
y receptores, se resuelve ámbito, se capturan fuentes y se construyen filas. Una
sola transacción produce todo el snapshot. Las consultas se filtran en SQL antes
de leer y no llaman contadores/lectores que mezclan módulos. Para estado sala no
se consulta compras/carga/almacén/catálogo/parámetros; para carga no se llama E1.
Si falta una migración no se degrada a estado «sin iniciar»: `FUENTE_NO_DISPONIBLE`.

Para `material_actual` el arquitecto extrae la carga interior de `cargarSnapshot`
como `cargarSnapshotEnLectura(salaIds, proyectoId?)`, manteniendo la API E1 pública,
su validación de varias salas sólo con obra y el máximo HTTP E1 de veinte. El
extracto interior no abre otra transacción: usa el contexto MVCC ya establecido
por `conLecturaConsistente`; sólo lo llaman servidores después de resolver el
ámbito. REA-03 puede pasar salas de varias obras y `proyectoId` ausente: el contexto
de informe conserva sus identidades y `snapshot.proyecto` permanece nulo, sin
atribuir todas a una obra. `construirBom(snapshot, snapshot.salas)` consolida el
stock una sola vez. Se conserva E3 y BOM adicional E2, sin restaurar existencias.

## Autorización, audiencia y grupos

No se cambian roles, secciones ni permisos existentes para hacer pasar pruebas.
Se usa `resolverPermisos` contra `usuarios` y `usuario_permisos` actuales; no se
confía en una cookie, una preferencia REA-02 ni un permiso serializado antiguo.
Usuario ficticio, inactivo o con contraseña provisional no guarda, encola,
ejecuta ni descarga. Las lecturas mínimas de identidad para comprobar ACL no
incluyen hash de contraseña, correo u otros datos de administración.

Una persona con lectura de todas las fuentes puede crear/programar **sus propios
informes**, sin permiso para modificar el material de la obra. Puede ver sólo
definiciones propias y ejecuciones de las que sea receptora vigente. No hay nuevo
permiso general «informes» ni catálogo visible de informes no autorizados.

La distribución a otras personas y la gestión de grupos requieren además
administrador y `usuarios:editar`. Esta decisión evita abrir un directorio de
empleados o una nueva delegación implícita a los otros roles. El propietario
siempre está incluido. Los grupos son listas internas de usuarios reales,
asociadas a un ámbito exacto; no son roles, listas de correo ni grupos SaaS.
Administrar un grupo no da acceso a su contenido. No se aceptan destinos de texto
libre, correos, URLs, webhooks ni identificadores de otros sistemas.

Al guardar una audiencia se comprueba que todos sus miembros actuales están
activos, han cambiado la clave, tienen todas las secciones requeridas y el mismo
ámbito. Hoy no existe ACL por obra/sede en el producto: «mismo ámbito» significa
el descriptor resuelto y esas secciones, **no** una pertenencia a obra inventada.
La función central `autorizarAmbitoInforme` deja el punto único para una ACL futura.
Una audiencia inválida rechaza el guardado completo con 403; no la guarda vacía.

Antes de crear cada ejecución se expande la unión de usuarios directos y miembros
de grupos, se deduplica y congela origen/grupo/versión de cada receptor. La vista
previa muestra ese conjunto, ámbito, contenido, formatos y período. Grupos
cambiados desde la vista previa provocan conflicto y nueva revisión antes de
guardar/ejecutar manualmente. Para ocurrencias programadas se expande la
composición actual al encolarlas, sin un diálogo inexistente.

Antes de **cualquier lectura de contenido** el runner comprueba propietario y
cada receptor. Si el propietario perdió permiso, no se consulta ninguna fuente y
la ejecución queda `bloqueada`. Los otros receptores que lo hayan perdido se
excluyen antes de leer y constan como excluidos sin concederles acceso. Antes de
publicar archivos se vuelve a comprobar con una lectura nueva: un permiso
revocado durante el render impide publicarlos al receptor afectado; si lo pierde
el propietario se bloquea la publicación completa. No se relee contenido para
un receptor excluido. El snapshot no contiene las contraseñas ni el mapa completo
de permisos de nadie.

Cuando hay audiencia distinta del propietario se comprueba también que éste
continúe siendo administrador con `usuarios:editar`, al encolar, ejecutar,
publicar y descargar. Una programación no conserva capacidad de distribuir
después de que su propietario pierda esa atribución.

Cada descarga/consulta del resultado requiere usuario y propietario actualmente
activos/no provisionales, permisos actuales completos de ambos, receptor congelado
no revocado y grupo todavía vigente cuando el acceso proceda sólo de un grupo.
Quitar a alguien de un grupo corta su acceso anterior; añadirlo no lo añade a
ejecuciones antiguas. Retirar un destinatario directo de la definición revoca en
la misma transacción sus concesiones directas anteriores. Una concesión por otro
grupo todavía válido puede seguir permitiendo el acceso. Archivar la definición
detiene nuevas ejecuciones; sus resultados correctos siguen bajo estas ACL hasta
caducar. El propietario puede revocar toda una ejecución, sin borrar la auditoría.

Revocar permisos no borra físicamente archivos ya descargados; sí bloquea la
siguiente petición. Las respuestas de lista/historial se filtran igualmente: no
filtrar después de obtener todos los snapshots. Un no receptor recibe 404; un
receptor identificado que perdió permisos, 403 sin cifras ni nombres de la obra.

## Versiones, snapshot y formatos

La definición editable y la programación tienen `version` optimista. Guardar,
pausar, archivar y cambiar audiencia requieren la versión leída; una versión
antigua devuelve 409 y conserva la edición local. La definición tiene
`version_modelo:1` y la clave una `version_registro:1`. Una versión de registro
desconocida no se interpreta como la actual: queda bloqueada hasta migración
explícita o nueva definición revisada.

Contrato JSON de configuración (objetos estrictos; campos desconocidos se
rechazan). El propietario se obtiene de la sesión; no forma parte de la entrada:

```ts
type AmbitoInforme =
  | { tipo: 'sala'; id: string }
  | { tipo: 'obra' | 'sede'; id: string; salaIds?: string[] };
type PeriodoInforme =
  | { modo: 'actual' }
  | { modo: 'rango'; desde: string; hasta: string }
  | { modo: 'relativo'; intervalo: 'dia_anterior' | 'semana_anterior' | 'mes_anterior' };
type ConfiguracionInforme = {
  versionModelo: 1;
  clave: 'material_actual' | 'material_movimientos' | 'carga_actual' |
    'carga_hechos' | 'estado_actual' | 'estado_hitos';
  versionRegistro: 1;
  ambito: AmbitoInforme;
  periodo: PeriodoInforme;
  formatos: ('pdf' | 'xlsx' | 'csv')[];
  audiencia: { usuarios: string[]; grupos: { id: string; version: number }[] };
};
type CalendarioInforme = {
  frecuencia: 'una_vez' | 'diaria' | 'semanal';
  inicio: string; fin: string | null; hora: string;
  diasSemana?: number[]; // Sólo semanal; ISO 1..7.
};
```

Las claves `*_actual` sólo aceptan modo actual; las otras sólo rango/relativo.
Lista de formatos no vacía y sin duplicados. Un grupo aparece una vez; sus
versiones deben coincidir al confirmar manualmente. `versionModelo` y
`versionRegistro` son 1; `versionGenerador: 'rea03-1'` lo agrega el servidor al
snapshot, nunca el cliente. El runner mantiene ese generador o rechaza la
ejecución por versión, sin reinterpretarla con otro. En generación manual con
período relativo se usa la fecha civil de su encolado en Madrid y se congela;
si cambió el día desde el preview, se devuelve conflicto para mostrar el rango.

Al encolar se congela `definicion_snapshot`: definición completa, versión,
programación y su versión si existe, propietario, ámbito solicitado, formatos,
política temporal, selección de audiencia y versiones de registro/modelo/generador.
Su hash SHA-256 no cambia durante reintentos ni por ediciones posteriores.
`periodo_resuelto`, descriptor de ámbito y receptores quedan congelados en esa
misma creación. El conjunto de salas para «todas» se resuelve al capturar; se escribe
una sola vez en el snapshot de datos junto a nombres/códigos/jerarquía.

La primera captura de fuentes que finaliza correctamente se persiste con su
fecha real de observación. Después ningún reintento relee o reemplaza esos datos.
Si el proceso cae antes de persistirla no hay captura acreditada: el siguiente
intento captura de nuevo y registra su hora real. No puede llamarla captura de
la ocurrencia prevista. «Nueva captura» crea otra ejecución y clave manual; no
modifica la anterior. Las fuentes vivas pueden cambiar o borrarse después sin
alterar el resultado conservado.

El snapshot versión 1 contiene contexto/filas canónicas/tipos/unidades/avisos y,
para material, el `SnapshotExportacion` E1 reutilizable. Canonicalizar claves y
orden de filas, normalizar timestamps a ISO UTC y números finitos; conservar
null. Hash del contenido sin IDs aleatorios de paquete E1 identifica su revisión
`INF-<12 primeros hex>`. La envoltura conservada no incluye su propio hash:
`snapshot_sha256` calcula el SHA-256 completo de su serialización canónica UTF-8.
El UUID temporal y `revision` aleatoria de E1 no se usan como identidad del informe.
Cada archivo además tiene su propio SHA-256 sobre los bytes realmente almacenados.

En el adaptador de material se fija `SnapshotExportacion.creadoEn = observado_en`.
La preimagen canónica del hash de contenido excluye sólo el campo `revision` E1;
incluye definición/hash, período, ámbito, observación y datos ordenados. Después
se asigna la revisión `INF-...` al snapshot E1 y se calcula el SHA-256 completo de
la envoltura ya persistible. Esto evita un hash circular y mantiene la misma
fecha/revisión en el exportador reutilizado y en el informe.

Pantalla, PDF, XLSX y CSV salen de esas mismas filas, sin consultas nuevas. Los
metadatos incluyen ID de ejecución, definición/versiones, revisión/hash del
snapshot, ámbito solicitado y resuelto, fecha prevista y observada, período/zona,
campos desconocidos/avisos y enlaces a detalles. Los enlaces son rutas relativas
permitidas por tipo (`/salas/<uuid>`, `/carga/<uuid>`, `/proyectos/<uuid>`), no URLs
del usuario ni promesa de que el detalle vivo siga siendo idéntico al snapshot.

Material mantiene campos/unidades y totales conocidos de E1. Usar
`generarXlsx(snapshot, salas, 'bom')` para su libro y añadir una hoja `Informe`
con metadatos REA-03; su BOM y revisiones permanecen intactas. Para CSV se reutiliza
la tabla de material E1 y `codificarCsv`: se añaden columnas de contexto del
informe sin cambiar los valores de `construirBom`; una prueba compara todas las
columnas BOM con `generarBomCsv`. Si hace falta compartir el mapeo de columnas,
el arquitecto extrae/exporta ese mapeo de E1, sin copiarlo ni cambiar su resultado.
Las otras claves usan columnas del registro y los exportadores genéricos.

PDF tabular: A4 horizontal, texto completo envuelto, cabeceras repetidas,
numeración de páginas, filas partidas sólo con continuación identificada y límite
200 páginas. No reducir a letra ilegible ni cortar texto para entrar. XLSX usa
celdas numéricas reales, autofiltro/cabeceras sin solapamiento y hoja de contexto.
CSV UTF-8 BOM, dialecto/escape existente y contexto en cada fila; con cero filas
conserva cabecera y se descarga junto al manifiesto con contexto completo. El
manifiesto JSON siempre existe como metadato descargable, no como cuarto formato
elegible. Celdas que comienzan por `=`, `+`, `-`, `@`, tab o CR no ejecutan fórmulas;
un número negativo legítimo conserva tipo numérico. No cargar vínculos remotos.

El manifiesto enumera archivos, MIME, longitud y hashes, sin incluir su propio
hash dentro de sí mismo. La selección de uno a tres formatos es inmutable por
ejecución. Fallar uno falla la ejecución; no publicar un conjunto incompleto ni
reemplazar el último correcto con un parcial. Los artefactos de un intento
fallido sólo viven en memoria acotada y no son descargables.

## Calendario Europe/Madrid

Calendario cerrado: `una_vez`, `diaria`, `semanal`. `inicio` es fecha civil
obligatoria, `fin` es fecha inclusiva o ausencia explícita para no tener fin;
`hora` obligatoria `HH:mm`. Semanal exige lista distinta de días ISO 1..7. Zona
única `Europe/Madrid`. No admitir RRULE, cron libre ni zona implícita del servidor.
Inicio/final vacíos no son fechas; fin anterior a inicio, fecha imposible y una
vez sin instante futuro se rechazan. Guardar exige una próxima fecha válida.

La hora es hora de pared de Madrid, no UTC fijo. Se resuelven candidatos con
`Intl.DateTimeFormat` y `timeZone:'Europe/Madrid'`, verificando ida y vuelta de
todos los componentes; no confiar en `new Date('fecha sin zona')`. Sin dependencia
nueva y con reloj inyectable en pruebas.

- En el salto de primavera una hora inexistente **se omite**, no se desplaza.
  Se registra la fecha omitida y la UI lo explica en la vista previa. Una
  programación `una_vez` en esa hora se rechaza porque nunca ocurriría.
- En la repetición de otoño se elige **la primera aparición** de la hora
  ambigua (offset de verano); no hay segunda ejecución ese día.
- La vista previa muestra las próximas cinco ocurrencias con fecha/hora local,
  offset y UTC, además de omisiones cercanas. Fin limita fechas locales.
- Ejemplos de aceptación: 29-03-2026 02:30 no existe; la diaria salta a
  30-03-2026 02:30 +02:00. 25-10-2026 02:30 se ejecuta sólo a 00:30Z (+02:00),
  y el día siguiente a 01:30Z (+01:00).

El runner sólo considera ocurrencias vencidas desde `proxima_utc`. Inserta
ejecución y avanza ese cursor **en una misma transacción** con bloqueo de fila;
la unicidad `(programacion_id, ocurrencia_utc)` es la defensa final ante dos
runners. Un fallo de generación no frena el calendario ni borra la ejecución.
Editar/pausar no recrea ocurrencias ya materializadas. Reanudar sólo genera desde
la próxima fecha futura y registra el intervalo saltado; no oculta la omisión.

Recuperación tras parada: se materializan cronológicamente como máximo diez
ocurrencias vencidas por programación y pasada, sin descartarlas en silencio.
La interfaz muestra el atraso restante; posteriores pasadas continúan. Para
informes actuales cada captura atrasada sigue indicando su observación actual;
no se vende como una serie histórica. Máximo total cincuenta ocurrencias por
pasada; planificación no monopoliza una transacción larga.

La planificación respeta primero los cinco trabajos pendientes/en curso por
propietario. Si no cabe otra ocurrencia, deja su cursor sin consumir y muestra
el atraso; no salta una fecha para cumplir la cuota. Pausar cancela los trabajos
todavía pendientes de esa programación y los registra; uno ya en curso conserva
su definición congelada y el propietario puede revocarlo explícitamente.

## Cola, intentos, concurrencia y último correcto

Estados de ejecución: `pendiente → en_curso → correcta | fallida | bloqueada`;
también `cancelada` antes de trabajar y `caducada` por retención. «Correcta»
significa todos los formatos y manifiesto persistidos y verificados en una única
transacción. La disponibilidad interna no significa envío.

Manual: `POST ejecutar` exige UUID `clavePeticion` y versión/vista previa
vigente. Un índice único por propietario/clave devuelve la misma ejecución al
repetir la petición; si la clave ya tiene otro payload, 409. No genera otra
ejecución porque la conexión se haya cortado. Programada: clave natural indicada
arriba, independiente de versión; cambiar la versión no duplica una ocurrencia.

El runner reclama una ejecución pendiente o reintentable con
`FOR UPDATE SKIP LOCKED`, crea una tentativa y asigna UUID de lease. Una ejecución
tiene una sola tentativa viva. Lease 90 s, latido cada 15 s y límite 300 s por
tentativa; reloj de la BD para leases. Otra conexión permite renovar mientras se
renderiza. Si el bucle no puede renovar, pierde el derecho a publicar.

Todo cambio/finalización comprueba ejecución, tentativa y token vigente. Un
trabajador viejo que vuelve tras perder lease no publica ni sobrescribe al nuevo.
Al vencer el lease se registra `interrumpida`; se recupera con nuevo token y mismo
snapshot si ya existía. La comprobación de permisos se repite también al reintentar.

Máximo tres intentos por ejecución. Fallos transitorios reintentan a los 30 s y
120 s; el tercero es final. Permiso retirado, ámbito cambiado, versión no soportada,
límite o entrada inválida no reintentan automáticamente. Reintento manual sólo
si queda presupuesto, con la misma ejecución/snapshot, CAS de estado y permiso;
no añade formatos ni receptores. Tras agotarlo, «Nueva captura» es explícita.

El último correcto se calcula por ocurrencia prevista (desempate por ID), no por
orden de finalización. Una ocurrencia antigua que termine tarde no desplaza a una
nueva correcta. El último correcto general de la definición incluye ejecuciones
manuales; cada programación tiene además el suyo. Fallo, bloqueo o parcial no
modifican esas referencias. Caducidad conserva fecha/referencia, muestra
«Último correcto caducado» y desactiva la descarga; no afirma que siga disponible.

## Runner local que el ejecutor debe entregar

`scripts/ejecutar-informes.mts` exige `INFORMES_DATABASE_URL` explícita, valida su
identidad y fija `DATABASE_URL` **antes de importar** lectores E1/BD. No carga
`.env.local`. En esta ejecución de integración rechaza cualquier destino que no
sea la nueva base sintética local nombrada por el arquitecto. Antes de escritura
comprueba `current_database()`, `current_user` y puerto real. No usa un usuario
administrador ficticio: cada trabajo se autoriza como su propietario real.

Interfaz obligatoria y probada en un proceso nuevo:

```sh
INFORMES_DATABASE_URL='<URL sintética entregada por el arquitecto>' \
  node --import tsx scripts/ejecutar-informes.mts --una-vez
INFORMES_DATABASE_URL='<la misma URL explícita>' \
  node --import tsx scripts/ejecutar-informes.mts --continuo --intervalo-segundos=15
```

`--una-vez` planifica/reclama/procesa hasta diez trabajos y termina, cerrando todas
las conexiones. `--continuo` repite con concurrencia uno y señales SIGTERM/SIGINT:
deja de reclamar, intenta concluir el trabajo vigente y, si no termina en 30 s,
sale dejando el lease recuperable. Los errores no imprimen credenciales ni URL.
La pasada termina con resumen e ID de proceso lógico; código 0 sólo si el servicio
terminó sin fallos de infraestructura, 1 para infraestructura/archivo inválido,
2 para destino/configuración rechazados. Bloqueos funcionales de trabajos se
registran en BD y resumen, no se ocultan por un exit 0 del proceso.

El bootstrap CLI puede interceptar **sólo** el marcador `server-only` en memoria,
antes de importar E1 y restaurar el cargador al acabar las importaciones, siguiendo
los verificadores locales existentes. Es una entrada confiable de servidor, no
una relajación de ACL. No stubear `next/headers`, sesión, SQL ni permisos y no
editar `node_modules`. El núcleo del runner/repo recibe conexión/reloj por
inyección y no importa cookies ni `next/cache`; el gate debe usar el comando real,
sin interceptores añadidos desde la prueba para hacerlo funcionar.

Cada proceso registra UUID lógico, modo `manual|continuo`, versión y latido, sin
hostnames/credenciales. Registra parada al cerrar. La UI considera activo un
continuo no detenido con latido <=45 s; manual terminado sólo acredita su última
pasada. Una caída pasa a detenido por antigüedad, aunque el registro no tenga fin.
Latido activo acredita proceso, no generación correcta: se muestran separados
último correcto, último error, próxima ocurrencia, cola y atraso propios.

## Propiedad exacta de archivos

Un ejecutor implementa REA-03 completa; no escribe archivos de REA-02 mientras
su responsable trabaja. No hay modificaciones masivas de componentes compartidos.

| Responsable | Archivos exclusivos |
|---|---|
| Ejecutor REA-03 · dominio/servidor | Nuevos `src/lib/informes/{modelo,registro,periodos,calendario,autorizacion,repositorio,lectores,servicio,exportadores,runner,http}.ts` y pruebas `src/lib/informes-*.test.ts` para que las recoja el glob actual de `npm test`. Las funciones puras no importan servidor/BD. |
| Ejecutor REA-03 · UI | Nuevos `src/components/informes/{gestor,definicion,programacion,audiencia,historial,resultado}.tsx`, sus pruebas y `src/app/cuenta/informes/{layout,page}.tsx`. No modifica el Panel ni preferencias de REA-02. |
| Ejecutor REA-03 · API | Nuevo árbol `src/app/api/informes/` con las rutas fijadas abajo. No modifica `/api/documentos/`. |
| Ejecutor REA-03 · CLI/gates | Nuevos `scripts/ejecutar-informes.mts`, `scripts/rea03-fixture.mts`, `scripts/verificar-rea03.mts`, `e2e-gate/rea03.{config.ts,spec.mts}`; evidencia nueva bajo `output/rea-integracion/rea03/`. |
| Arquitecto · integración secuencial | `db/schema.sql`, `db/migraciones/2026-10-rea03-informes.sql`, `db/migraciones/rollback/2026-10-rea03-informes.sql`; el extracto mínimo de `src/lib/documentos/datos.ts`, y exportar mapeo BOM desde `documentos/tablas.ts` si es necesario. Conserva firmas/resultados de E1 y aporta prueba de paridad. |
| Arquitecto · enlace/cierre | Una entrada en `src/app/cuenta/page.tsx`, **después** de integrar REA-02 y sólo para usuario real/no provisional con alguna definición habilitada. `package.json` sólo si quiere atajos para los comandos ya operativos. Documentación 17/18/21 y continuidad. |

No tocar CSV/seed, `tipos.ts`, fórmula de cable, roles, acciones de almacén,
importación E2, diseño/historial E3 ni evidencia anterior. El código nuevo no
necesita dependencias nuevas. El ejecutor entrega propuestas para los archivos
del arquitecto; no los escribe en paralelo.

## HTTP y pantalla

Todas las rutas API usan runtime Node, respuestas `no-store`, sesión dentro de
la frontera de errores y autorización propia. Mutaciones exigen origen propio
con `mismoOrigen`, JSON estricto y máximo 16 KiB comprobado mientras se lee el
cuerpo; no confiar sólo en Content-Length. UUID, listas y enums se validan antes
de SQL. No aceptar propietario desde el cuerpo.

| Ruta | Operación |
|---|---|
| `/api/informes` | GET definiciones propias autorizadas; POST crear definición con versión inicial. |
| `/api/informes/vista-previa` | POST valida configuración/versiones y muestra **selección** de ámbito/fechas/audiencia y ejemplos de próximas ocurrencias; no genera ni escribe. Hash de selección válido 10 min; se recalcula en servidor al confirmar. |
| `/api/informes/[id]` | GET propia; PATCH configuración/audiencia/archive con versión. Audiencia ajena sólo admin. |
| `/api/informes/[id]/ejecutar` | POST versión, hash de selección y clavePeticion; 202 con ID/estado; repetición idéntica devuelve ese mismo ID. |
| `/api/informes/[id]/programaciones` | GET propias; POST calendario y versión de definición. |
| `/api/informes/programaciones/[id]` | PATCH calendario/pausa/version; la reanudación no genera pasado implícito. |
| `/api/informes/ejecuciones` | GET paginado propias/recibidas autorizadas, sin snapshot completo; cursor opaco estable y límite 20. |
| `/api/informes/ejecuciones/[id]` | GET metadatos/filas/manifiesto tras ACL actual; POST revocación sólo propietario con versión/estado esperado. |
| `/api/informes/ejecuciones/[id]/reintentar` | POST estado/intento esperado; sin carrera contra runner u otro reintento. |
| `/api/informes/ejecuciones/[id]/archivos/[archivoId]` | GET por UUID de archivo del manifiesto de esa ejecución; no acepta rutas/nombres libres. `manifiesto` se sirve por identificador reservado validado. |
| `/api/informes/grupos` y `/api/informes/grupos/[id]` | GET/POST/PATCH grupos propios del administrador, miembros/ámbito y versión. Desactivar conserva historia y revoca los accesos procedentes de ese grupo. |
| `/api/informes/destinatarios` | GET búsqueda remota admin con `usuarios:editar`, máximo 20; sólo id/código/nombre/activo y aptitud para la definición/ámbito pedido. |
| `/api/informes/runner` | GET estado mínimo del runner y contadores **propios** autorizados; sin trabajos, nombres o resultados de otras personas. |

Estados HTTP: 400 entrada/fechas inválidas; 401 sin sesión/inactivo; 403 provisional,
ficticio, permiso/origen denegado; 404 recurso ajeno/inexistente; 409 versión,
vista previa/clave idempotente incompatible o estado cambiado; 410 archivo
caducado para receptor autorizado; 413 cuerpo/límite de selección excesivo; 422
definición/generador no soportado; 429 cuota o cola propia llena; 503 BD/servicio
no disponible. En generación asíncrona esos fallos se registran como código de
ejecución; no se convierten en un resultado vacío correcto.

Errores persistidos: `PERMISO_RETIRADO`, `USUARIO_NO_DISPONIBLE`,
`AMBITO_CAMBIADO`, `VERSION_NO_SOPORTADA`, `FUENTE_NO_DISPONIBLE`,
`LIMITE_EXCEDIDO`, `CUOTA_EXCEDIDA`, `GENERACION_FALLIDA`, `LEASE_VENCIDO`,
`ARCHIVO_INTEGRO_NO_DISPONIBLE`. Mensaje seguro y fecha; nunca SQL, stack o URL.
Fallos transitorios internos conservan código estable, sin exponer detalles.

La UI permite crear/editar, seleccionar formatos y período, previsualizar,
solicitar, ver cola/historial y descargar. La programación muestra hora local,
offset, inicio/fin, próxima, estado de runner y estado externo exacto. Receptores
ven sólo ejecuciones para las que mantienen autorización, no la configuración
editable ni el directorio. Los grupos nunca se presentan como concesión de permiso.
El polling se detiene al terminar/salir, conserva el último correcto y no deja que
una respuesta antigua sustituya una ejecución posterior. Errores/conflictos
conservan lo editado. Teclado, foco, etiquetas, estados accesibles y sistema
`design-system/MASTER.md`; recorrido completo de escritorio antes del móvil.

## Persistencia propuesta para integrar por el arquitecto

SQL aditivo; no ejecutar como parte del trabajo documental. El JSON tiene
validación estricta adicional en servidor. Ningún endpoint permite SQL genérico
ni acceso directo a estas tablas. La migración y el bloque equivalente de schema
deben coincidir. No modificar tablas operativas ni la siembra.

```sql
create table if not exists informes_definiciones (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  version integer not null default 0 check (version >= 0),
  configuracion jsonb not null check (jsonb_typeof(configuracion) = 'object'),
  archivada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists informes_def_propietario_idx
  on informes_definiciones(propietario_id, creado_en desc, id);

create table if not exists informes_grupos (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  ambito jsonb not null check (jsonb_typeof(ambito) = 'object'),
  version integer not null default 0 check (version >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists informes_grupo_miembros (
  grupo_id uuid not null references informes_grupos(id) on delete restrict,
  usuario_id uuid not null references usuarios(id) on delete restrict,
  primary key(grupo_id, usuario_id)
);

create table if not exists informes_programaciones (
  id uuid primary key default gen_random_uuid(),
  definicion_id uuid not null references informes_definiciones(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  calendario jsonb not null check (jsonb_typeof(calendario) = 'object'),
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  activa boolean not null default true,
  proxima_utc timestamptz,
  ultima_omision jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists informes_prog_vencida_idx
  on informes_programaciones(proxima_utc, id) where activa;

create table if not exists informes_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  definicion_id uuid not null references informes_definiciones(id) on delete restrict,
  propietario_id uuid not null references usuarios(id) on delete restrict,
  programacion_id uuid references informes_programaciones(id) on delete restrict,
  clave_peticion uuid,
  ocurrencia_utc timestamptz not null,
  definicion_snapshot jsonb not null check (jsonb_typeof(definicion_snapshot) = 'object'),
  definicion_sha256 text not null check (definicion_sha256 ~ '^[0-9a-f]{64}$'),
  periodo_resuelto jsonb not null check (jsonb_typeof(periodo_resuelto) = 'object'),
  snapshot jsonb check (jsonb_typeof(snapshot) = 'object'),
  snapshot_sha256 text check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  observado_en timestamptz,
  snapshot_expurgado_en timestamptz,
  estado text not null default 'pendiente' check
    (estado in ('pendiente','en_curso','correcta','fallida','bloqueada','cancelada','caducada')),
  reintentar_desde timestamptz,
  intento_actual integer not null default 0 check (intento_actual between 0 and 3),
  lease_token uuid,
  lease_hasta timestamptz,
  error_codigo text,
  error_mensaje text,
  manifiesto jsonb check (jsonb_typeof(manifiesto) = 'object'),
  entrega_externa text not null default 'no_configurada' check (entrega_externa = 'no_configurada'),
  revocada_en timestamptz,
  terminado_en timestamptz,
  caduca_en timestamptz,
  creado_en timestamptz not null default now(),
  check ((programacion_id is null) = (clave_peticion is not null)),
  check (snapshot is null or snapshot_sha256 is not null),
  check ((snapshot_sha256 is null) = (observado_en is null)),
  check (snapshot_expurgado_en is null or
    (estado = 'caducada' and snapshot is null and snapshot_sha256 is not null)),
  check ((lease_token is null) = (lease_hasta is null)),
  check (estado <> 'correcta' or
    (snapshot is not null and manifiesto is not null and terminado_en is not null and caduca_en is not null)),
  unique(programacion_id, ocurrencia_utc)
);
create unique index if not exists informes_ejec_manual_unica_idx
  on informes_ejecuciones(propietario_id, clave_peticion) where clave_peticion is not null;
create index if not exists informes_ejec_cola_idx
  on informes_ejecuciones(estado, reintentar_desde, creado_en, id);
create index if not exists informes_ejec_ultimo_correcto_idx
  on informes_ejecuciones(definicion_id, ocurrencia_utc desc, id desc) where estado = 'correcta';

create table if not exists informes_receptores (
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  usuario_id uuid not null references usuarios(id) on delete restrict,
  -- Origen directo/propietario/grupos y versiones: conjunto congelado, sin permisos cacheados.
  origenes jsonb not null check (jsonb_typeof(origenes) = 'array'),
  excluido_codigo text,
  revocado_en timestamptz,
  primary key(ejecucion_id, usuario_id)
);
create index if not exists informes_rec_usuario_idx on informes_receptores(usuario_id, ejecucion_id);

create table if not exists informes_intentos (
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  numero integer not null check (numero between 1 and 3),
  token uuid not null unique,
  estado text not null check (estado in ('en_curso','correcta','fallida','interrumpida','bloqueada')),
  iniciado_en timestamptz not null default now(),
  latido_en timestamptz not null default now(),
  terminado_en timestamptz,
  error_codigo text,
  error_mensaje text,
  primary key(ejecucion_id, numero)
);
create unique index if not exists informes_intento_vivo_idx
  on informes_intentos(ejecucion_id) where estado = 'en_curso';

create table if not exists informes_archivos (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  formato text not null check (formato in ('pdf','xlsx','csv')),
  nombre text not null check (nombre ~ '^informe-[0-9a-f-]+[.](pdf|xlsx|csv)$'),
  mime text not null,
  contenido bytea not null check (octet_length(contenido) between 1 and 26214400),
  bytes integer generated always as (octet_length(contenido)) stored,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  creado_en timestamptz not null default now(),
  unique(ejecucion_id, formato),
  check (encode(digest(contenido, 'sha256'), 'hex') = sha256)
);

create table if not exists informes_runner_latidos (
  id uuid primary key,
  modo text not null check (modo in ('manual','continuo')),
  version text not null,
  iniciado_en timestamptz not null default now(),
  latido_en timestamptz not null default now(),
  detenido_en timestamptz
);

-- Rechazar la reescritura de identidad/definición y de una captura ya persistida.
create or replace function guardar_inmutabilidad_informe() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.definicion_id,new.propietario_id,new.programacion_id,
         new.clave_peticion,new.ocurrencia_utc,new.definicion_snapshot,
         new.definicion_sha256,new.periodo_resuelto,new.creado_en)
     is distinct from
     row(old.id,old.definicion_id,old.propietario_id,old.programacion_id,
         old.clave_peticion,old.ocurrencia_utc,old.definicion_snapshot,
         old.definicion_sha256,old.periodo_resuelto,old.creado_en) then
    raise exception 'La definicion de una ejecucion es inmutable';
  end if;
  if old.snapshot_sha256 is not null then
    if new.caduca_en is distinct from old.caduca_en then
      raise exception 'La retencion de una captura no se prolonga';
    end if;
    if row(new.snapshot_sha256,new.observado_en)
       is distinct from row(old.snapshot_sha256,old.observado_en) then
      raise exception 'La identidad de una captura es inmutable';
    end if;
    if new.snapshot is distinct from old.snapshot or
       new.snapshot_expurgado_en is distinct from old.snapshot_expurgado_en then
      -- Excepcion unica: expurgar contenido vencido, conservando identidad y auditoria.
      if not (old.snapshot is not null and new.snapshot is null and
        old.snapshot_expurgado_en is null and new.snapshot_expurgado_en is not null and
        new.estado = 'caducada' and old.caduca_en is not null and
        old.caduca_en <= now()) then
        raise exception 'La captura de una ejecucion es inmutable';
      end if;
    end if;
  end if;
  if old.manifiesto is not null and
     row(new.manifiesto,new.terminado_en) is distinct from
     row(old.manifiesto,old.terminado_en) then
    raise exception 'Un resultado correcto no se sobrescribe';
  end if;
  return new;
end $$;
drop trigger if exists informes_ejec_inmutable on informes_ejecuciones;
create trigger informes_ejec_inmutable before update on informes_ejecuciones
  for each row execute function guardar_inmutabilidad_informe();

create or replace function impedir_actualizar_archivo_informe() returns trigger
language plpgsql as $$ begin
  raise exception 'Un archivo de informe no se sobrescribe';
end $$;
drop trigger if exists informes_arch_inmutable on informes_archivos;
create trigger informes_arch_inmutable before update on informes_archivos
  for each row execute function impedir_actualizar_archivo_informe();
```

No se guarda un puntero frágil de último correcto: consulta indexada por definición
y/o programación y orden indicado, incluyendo `caducada` con `manifiesto` correcto
para mostrar su referencia histórica. Añadir índice equivalente si la consulta
incluye caducadas; una fallida nunca puede aparecer en ese conjunto.

El SQL anterior no sustituye las transacciones del servicio: al publicar se
verifican hash del snapshot, conjunto exacto de formatos, MIME permitido, cuota,
token y permisos actuales; se insertan bytes/manifiesto y se pasa a correcta
atómicamente. El snapshot sólo se rellena desde estado `en_curso` y lease vigente;
receptores/orígenes no se añaden después de encolar (sólo exclusión/revocación).
La integridad de esa transición y de los límites agregados se prueba contra
Postgres real, no sólo con mocks.

## Límites, descarga y retención

Límites de seguridad centralizados y probados: veinte definiciones activas y
veinte programaciones activas por propietario; veinte grupos propios, cien
miembros por grupo/cien receptores distintos por ejecución; cinco ejecuciones
pendientes/en curso por propietario; máximo 500 salas, 10.000 filas de datos,
8 MiB UTF-8 de snapshot, 200 páginas PDF, 25 MiB por archivo y 50 MiB por
ejecución. No truncar un resultado para declararlo correcto: pedir un ámbito
menor o registrar `LIMITE_EXCEDIDO`. La API E1 conserva su límite de veinte.

Cuota de bytes de informes conservados: 250 MiB por propietario y 1 GiB global.
Al persistir la captura y al publicar se toma un advisory lock transaccional
único de cuota, se purga lo caducado y se comprueba antes de insertar; dos
operaciones no pueden superar la cuota por carrera. Se suman snapshot UTF-8 y
bytea conservados. Es un límite técnico de conservación, no un parámetro de
stock/cálculo. No borrar un archivo vigente para hacer sitio sin una acción
explícita. El snapshot de intento fallido también cuenta para cuota y caduca
30 días después de su primera captura; un reintento no prolonga la retención.

`caduca_en` se fija al persistir la primera captura +30 días y no se prolonga
al publicar/reintentar. El CLI realiza limpieza por lotes: bajo bloqueo cambia
a `caducada`, pone snapshot a null con `snapshot_expurgado_en` y elimina las
filas de archivo. Conserva manifiesto, hashes, longitudes, definición, fecha de
observación, identidad y resultado. El trigger admite sólo ese borrado del
contenido vencido; nunca permite sustituirlo, recuperar filas nuevas o borrar su
hash. Esa operación permite liberar cuota de forma efectiva y comprobable.

La descarga busca archivo por UUID y ejecución, verifica ACL **antes de leer
bytea**, estado correcto, no revocación y vigencia. Recalcula hash/longitud antes
de enviar; corrupción devuelve 503 seguro y registra incidente, nunca bytes
parciales con 200. MIME por enum, nombre de servidor ASCII, Content-Disposition
attachment, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`,
`X-AV-Revision` y `X-AV-SHA256`. No nombres suministrados por cliente, rutas,
traversal, symlinks, enlaces públicos ni salida de bytes en logs.

## Pruebas de aceptación Dado / Cuando / Entonces

1. **Selección sin IA.** Dado usuario real y definiciones permitidas, cuando
   elige cada módulo/clave, ámbito, período y formatos, entonces ve exactamente
   qué contenido/receptores se usarán y puede generar sin proveedor de IA/correo.
2. **Material único.** Dadas dos salas de una obra, stock compartido, reservas
   propias/ajenas, BOM adicional E2, ausencia/precio cero/orientativo y diseño E3,
   cuando captura material, entonces `construirBom` concuerda con pantalla,
   XLSX/CSV/PDF, no descuenta stock dos veces y conserva revisiones/avisos.
3. **Sin lectura oculta.** Dado usuario sin compras/almacén/catálogo/parámetros,
   cuando pide estado sala o carga_hechos permitido, entonces spies/registro SQL
   demuestran cero consultas a esas tablas y sus respuestas/HTML/archivos no
   contienen cifras ni enlaces de esos módulos. Cuando pide material_actual,
   recibe 403 antes de tocar sus fuentes. Repetir con cada permiso por separado.
4. **Ámbito.** Dadas sala legado, obra sin sede y varias obras de una sede,
   cuando resuelve sala/obra/sede o selección explícita, entonces incluye sólo
   IDs canónicos, muestra selección completa y no trata legado como error. Sala
   ajena/eliminada/trasladada después de preview produce conflicto/error seguro.
5. **Estado observado.** Dado material y estado modificados tras una fecha pasada,
   cuando se solicita un informe actual, entonces informa de la lectura actual,
   rechaza un rango histórico y nunca etiqueta los valores como anteriores.
6. **Hechos en rango.** Dados movimientos justo antes/en/después de los límites,
   altas/cierres de carga y hitos date, cuando exporta el rango, entonces los
   bordes inclusivos/exclusivos y las filas de hechos coinciden con fuentes. No
   aparecen cantidades históricas de carga inferidas de sus valores actuales.
7. **DST y calendario.** Dados 29-03-2026/25-10-2026 en Madrid y días/meses con
   cambio de año, cuando calcula próximas/periodos anteriores, entonces cumple
   salto/repetición definidos, 23/25 horas, lunes-domingo, mes real e inicio/fin.
   Vacío, 31-02, fin anterior y número suelto fallan sin producir 1970.
8. **Versiones y edición.** Dadas dos pestañas con la misma versión y una vista
   previa de grupo vieja, cuando guardan o ejecutan, entonces sólo una escritura
   gana, la otra recibe 409 y se conserva su formulario. Una ejecución creada
   antes conserva definición/período/formatos aunque después se editen.
9. **Audiencia actual.** Dados usuarios A/B/C y grupo G, cuando se guarda G con
   receptor no apto, se rechaza completo; cuando se revoca a B después de guardar,
   el runner lo excluye antes de leer. Cuando se quita a C de G tras generar,
   su siguiente GET/descarga falla; un nuevo miembro no obtiene lo antiguo.
10. **Revocación durante render.** Dado un render detenido por barrera de prueba,
    cuando se retira permiso al propietario/receptor y se libera, entonces la
    comprobación nueva impide publicar al afectado; perder permiso del propietario
    bloquea todos los archivos y conserva el último correcto anterior.
11. **Idempotencia.** Dadas dos peticiones manuales idénticas y dos runners en
    la misma ocurrencia, cuando compiten, entonces hay una ejecución por clave,
    una tentativa viva y un solo conjunto de archivos. Clave manual con otro
    payload da 409; editar programación no duplica la misma ocurrencia UTC.
12. **Caída y fencing.** Dado trabajador A con snapshot persistido, cuando vence
    su lease y B reclama, entonces B usa el snapshot original. A no publica al
    volver. Si cae antes de persistir captura, la nueva registra su hora real.
    Reintentos respetan 30/120 s y máximo tres sin ejecuciones duplicadas.
13. **Último correcto.** Dados correcto reciente, fallo posterior y correcto
    antiguo finalizado tarde, cuando se consulta historial, entonces último
    correcto sigue siendo el de ocurrencia reciente. Un formato fallido no lo
    reemplaza. Caducar deshabilita descarga conservando la referencia exacta.
14. **Durabilidad real.** Dado informe publicado, cuando se cierran procesos web
    y CLI, se elimina tmp E1 y se relanza la app, entonces se descargan los mismos
    bytes/hashes desde BD sin consultar otra vez las fuentes ni regenerar.
15. **Archivos reales.** Dados nombres largos, saltos de línea, texto de fórmula,
    tildes, valores desconocidos y cero, cuando se descargan PDF/XLSX/CSV, entonces
    se reabren, coinciden filas/tipos/totales/contexto y el PDF renderizado no
    corta texto ni tapa cabeceras. CSV vacío tiene contexto en su manifiesto.
16. **Descarga segura.** Dado no receptor, usuario inactivo/provisional/ficticio,
    permiso revocado, archivo de otra ejecución, nombre/traversal y corrupción
    bytea, cuando pide contenido, entonces no recibe bytes ni datos internos y
    se distinguen denegación, caducidad, integridad y fallo de infraestructura.
17. **Cuotas/concurrencia.** Dadas dos publicaciones junto al límite y una
    selección mayor que el máximo, cuando compiten/generan, entonces sólo cabe
    lo permitido, no hay truncamiento/archivos parciales y se conserva lo anterior.
18. **Runner operativo.** Dada nueva BD sintética, cuando se ejecuta el comando
    `--una-vez` desde shell limpio y luego `--continuo`, se materializa una
    programación vencida y se conserva su archivo. Dos procesos concurrentes no
    duplican. Al parar/caer, la UI muestra detenido por marca/latido; una pasada
    manual nunca aparece como servicio continuo ni scheduler desplegado.
19. **Atraso y pausa.** Dadas más de diez ocurrencias vencidas y una programación
    pausada, cuando pasan runners y se reanuda, entonces el atraso se procesa
    por lotes sin pérdida y la reanudación registra lo saltado. Ninguna captura
    actual atrasada se presenta como reconstrucción histórica.
20. **Flujo completo.** Dado escritorio, cuando crea definición/grupo, revisa,
    genera, descarga, programa, observa runner, recupera error/conflicto y cambia
    de usuario, entonces el flujo persiste y no filtra contenido. Sólo después
    repetir cierre en móvil, incluidos foco, teclado y errores accesibles.

El arquitecto crea una **base sintética nueva REA-03** y entrega URL/identidad al
ejecutor; éste no inventa destinos ni reutiliza REA-02/E1/E3, `.env.local` o
inventario. Fixtures mínimas y nombradas; fotos de tablas operativas antes/después
demuestran que informar no mueve stock ni cambia diseños/hitos. Registrar en
`output/rea-integracion/rea03/` comandos reales, resultados crudos, SQL observado,
capturas escritorio/móvil, hashes y archivos reabiertos/renderizados. Pruebas
puras e integración Postgres, CLI de proceso nuevo, E2E completo, tipos/lint/build
sin BD y regresiones E1/E2/E3 afectadas. Revisión independiente del resultado y
evidencia antes de declarar ST18/19/20 implementados.

El cierre debe decir por separado: código local, migración aplicada sólo a base
sintética, runner manual/continuo probado, descarga real, scheduler desplegado y
transporte externo. En esta autorización los dos últimos siguen sin configurar.

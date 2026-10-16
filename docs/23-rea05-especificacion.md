# REA-05 · Tiempos y costes imputados con trazabilidad

15-10-2026. **Especificación para implementar después de REA-04; no acredita
producto ni aceptación.** Contratos padre `17-integracion-rea.md` y
`22-rea04-especificacion.md`. Desarrolla el prerrequisito de horas/costes de ST33;
beneficio y aceptación siguen en REA-07. El schema de planificación ya existe en
la nueva base sintética REA-04 según el coordinador; eso no demuestra que su UI,
servicios o gates estén implementados. No desplegar ni usar producción.

Este trabajo sólo añade registros/valoraciones y lecturas. No cambia tareas de
REA-04, stock, reservas, compras/recepciones, carga, hitos, diseño/revisiones E3,
CSV de precios, presupuesto Cisco aplazado ni criterio de márgenes/holguras.
SQL propuesto sólo en este documento; el arquitecto lo integra después.

## Resultado y fuentes de cada decisión

Una persona registra intervalos de trabajo real en tareas existentes, ve sus
minutos y corrige/anula mediante nuevas versiones. El gestor operativo puede
registrar/corregir por otro técnico dejando autor y motivo. Una capacidad
financiera separada permite guardar tarifas de imputación y valorar después,
congelando tarifa, fecha, fuente, moneda y versión exacta de tiempo.

La comparación muestra previsto y real con sus fuentes/cobertura. Ausencia de
tarifa, histórico de precio o asociación material produce desconocido/parcial;
no se convierte en coste cero. Un intervalo planificado no se transforma en
trabajo real, y un precio vivo de catálogo no se convierte en coste de consumo.

| Evidencia del checkout | Consecuencia ejecutable |
|---|---|
| Contrato22 y tablas `planes`, `plan_tareas`, `plan_asignaciones`, eventos de planificación. | Tiempo referencia UUID de tarea; sala/obra se derivan de ella y se congelan. No crear otra tarea ni modificar sus versiones/estado. No dar por implementados sus servicios. |
| `usuarios.tecnico_id` es FK opcional, sin unicidad; `acciones-usuarios.ts::crearUsuario` acepta ese vínculo explícito. | Autor usuario y recurso técnico son distintos. Autoservicio exige enlace vigente no ambiguo; nunca coincidencia por nombre/correo. No añadir un enlace automáticamente. |
| `movimientos` conserva artículo/ubicación/tipo/cantidad/sala/fecha/motivo/quien, sin precio/moneda, `pedido_linea_id` o `carga_linea_id`. | No existe linaje automático suficiente para coste material real. Asociación humana a IDs con snapshot/hash y evidencia; motivo es texto informativo, no FK canónica. |
| `recibirLineaPedido`/`recibirPedidoCompleto` incrementan recibido e insertan `entrada` con motivo textual; `pedido_lineas.precio_unitario` está congelado pero no tiene moneda ni referencia a factura. | Una entrada no identifica inequívocamente su línea de pedido. Cantidad recibida acumulada o precio de pedido no prueba qué salida se consumió ni su coste final. No reparar estas acciones dentro de REA-05. |
| `crearPedidoDesdeFalta` copia el coste del catálogo a la línea y `precio_orientativo`; artículos usan coste normalizado por lógica vigente de precios. | Es fuente de previsto/pedido, no factura ni valoración real automática. No inferir moneda histórica de toda fila por el código que hoy la crea. |
| `confirmarCarga` genera salidas y marca reservas servidas; no escribe FK de movimiento a línea de carga. | Unir por sala/artículo/nombre/fecha no acredita que sean las mismas unidades. La carga no es otra línea sumable de coste. |
| `movimientosDeCierre` devuelve sobrante; para roto crea `devolucion` y `baja`. `instalado` no genera movimiento nuevo. | Consumo imputado: salida + baja − devolución, con linaje de coste coherente. No sumar instalado, cierre, devolución rota y salida como consumos distintos. |
| `guardarCierreLinea` deja repartos editables; `borrarCarga` puede eliminar la carga y sus líneas. `movimientos.sala_id` puede quedar nulo; la jerarquía puede cambiar. | No reconstruir hechos pasados desde el cierre actual ni atribuir obra histórica por la jerarquía de hoy. Congelar evidencia y detectar fuente modificada/desaparecida. |
| `usuarios.ts` da `compras:ver` a lectura y no tiene permiso laboral separado. | Compras no autoriza costes salariales. Usar política financiera admin + usuarios:editar, sin añadir roles/secciones ni abrir tarifas a lectura. |
| Helpers puros Madrid de `informes/periodos.ts` y adaptador previsto en contrato22. | Reusar conversión/calendario/DST; no duplicar algoritmo ni editar archivos REA-03/04 unilateralmente. |

Las políticas nuevas de intervalos, valoración y redondeo de este contrato se
identifican como decisiones REA-05; no se presentan como reglas laborales,
tarifas o hechos históricos ya existentes en el departamento.

## Identidad y política de acceso

Toda operación requiere usuario real/activo/no provisional y permisos actuales
resueltos en servidor. La identidad y los roles no vienen del cuerpo. No se
consulta `clave_hash`. Usuario ficticio no registra, valora ni gestiona.

Capacidades centrales, sin modificar los cinco roles/once secciones:

| Capacidad | Política |
|---|---|
| Consultar tiempos propios | `proyectos:ver`; `salas:ver` para contexto de tarea de sala. Filtrar por titular de esos registros antes de leer/listar. |
| Registrar/corregir propios | Lo anterior y enlace `usuarios.tecnico_id` real/activo, no ambiguo; asignación activa a la tarea. Rol `lectura` siempre consulta, nunca escribe. Los otros roles pueden registrar sus propios partes aunque tengan proyectos:ver, porque registrar trabajo propio no modifica el plan. |
| Gestionar tiempos ajenos | `proyectos:editar` y salas:ver cuando procede. No implica acceso a dinero. Técnico seleccionado existente/activo al crear; motivo obligatorio si actúa por otro. |
| Tarifas, valoración/coste laboral y cualquier resumen que lo contenga | **Rol admin y usuarios:editar**, además de proyectos:ver y salas:ver para su contexto. Se comprueba esta conjunción antes de consultar cualquier tabla financiera laboral. |
| Imputación/valoración material | Política financiera anterior + almacen:ver + catalogo:ver; carga:ver sólo al consultar evidencia de carga; compras:ver sólo al consultar evidencia de pedido. Escritura de sidecars financieros, sin permiso implícito para cambiar hechos físicos. |
| Previsto material desde E1 | Política financiera + todos los permisos reales del lector E1/REA-03 que se use, incluidos parámetros cuando los consulta. No llamar al snapshot completo para un resumen sólo laboral. |

Admin + usuarios:editar se elige porque los roles vigentes no distinguen
finanzas laborales y lectura puede ver compras. Es una restricción nueva de esta
capacidad, no una ampliación encubierta de compras ni un cambio de sus pantallas.
Un gestor operativo no recibe precio/hora, moneda, importe, valoraciones,
conteos de tarifas ausentes, payloads financieros ni enlaces de costes.

El enlace propio se valida leyendo sólo usuario/tecnico_id/activo y contando
enlaces de usuarios activos al mismo técnico. Sin enlace o con dos cuentas activas
enlazadas al mismo técnico, autoservicio no infiere identidad: muestra
`VINCULO_TECNICO_NO_RESUELTO` y deriva al gestor. No revela las otras cuentas.
No arregla ese vínculo desde horas; permanece en administración existente.

Al crear, el servidor congela `titular_usuario_id` desde el enlace explícito
único al técnico cuando existe, tanto para autoservicio como para alta del gestor.
Nunca acepta ese campo del cliente. Si no existe enlace, es nulo y sólo el gestor
puede consultar/gestionar el registro. Vincular otro usuario después no le abre
partes históricos automáticamente; cambiar el enlace no cambia titular/autor
histórico. El titular puede consultar lo suyo con ACL actual de contexto; para
escribir debe seguir enlazado al mismo técnico. La autoría de cada versión
siempre es el usuario que hizo esa operación, no el técnico del parte.

Revocar permisos tiene efecto en la petición siguiente, también APIs, historial,
restauraciones, idempotencia y snapshots financieros guardados. Una selección o
snapshot previamente autorizado no concede acceso permanente. El trabajador no
provoca una consulta a tarifas/valoraciones ni siquiera para «invalidarlas» al
corregir sus horas: esa desactualización se deriva en la lectura financiera.

## Registro real y correcciones

Una cabecera `tiempo_registros` fija tarea, plan/obra/sala derivados, técnico y
titular. Tarea/obra/sala/técnico son inmutables. El primer registro y cada cambio
son filas inmutables `tiempo_versiones`; la cabecera sólo avanza su puntero/version
con CAS. Corrección/anulación enlaza la versión antecedente y exige motivo.
Nunca UPDATE del intervalo/notas de una versión ni DELETE de partes.

Entrada temporal: inicio/fin locales con offset elegido, zona Europe/Madrid,
nota opcional; duración se calcula exclusivamente en servidor. Ambos instantes
obligatorios, precisión de minuto, fin > inicio y fin no posterior al reloj de
BD. Máximo técnico 24 horas por parte; si necesita más se registran intervalos
separados. Sin redondeo al cuarto de hora, pausas ficticias ni horas planificadas
copiadas. Una pausa se expresa como dos intervalos reales.

Un parte puede cruzar medianoche; los resúmenes distribuyen minutos por días
civiles de Madrid. Ausencia de fecha se rechaza, no se guarda como 1970. Hora
inexistente en primavera falla; hora ambigua en otoño exige elegir una de las
alternativas de `instantesMadrid`. Se conservan UTC y representación/offset
confirmados. Comparar duración por instantes, no por resta de horas de pared.

Autoservicio: tarea pendiente/en curso/hecha con asignación activa al técnico;
obra abierta y plan no archivado. No exige que la planificación horaria coincida
con lo trabajado ni convierte ese trabajo en tarea hecha. Un gestor puede
registrar hechos atrasados también sobre tarea/plan/obra cerrados o anulados,
con motivo explícito y fecha de trabajo real; REA-05 escribe sólo sus sidecars,
sin reabrir plan/obra o borrar un hito. El cierre físico no obliga a falsificar
la fecha de un parte conocido después.

Técnico inactivo: no nuevas altas propias ni altas ordinarias del gestor. El
gestor puede corregir/anular un parte histórico de un técnico ahora inactivo,
con motivo; no lo reactiva. Registrar trabajo histórico que aún no tiene parte
para un técnico inactivo queda fuera del alta ordinaria y requiere que el
administrador resuelva explícitamente el técnico en el flujo existente.

Error de tarea/técnico: anular y crear el parte correcto relacionado con el
anterior. No trasladar una cabecera ni sobrescribir su identidad. La UI conserva
el enlace entre ambos y el motivo; sólo el gestor puede reclasificar a otro
técnico. Restaurar un intervalo anterior es otra corrección con antecedente,
CAS y nueva comprobación de solapamiento/ACL, nunca volver atrás el historial.

## Solapamientos, concurrencia e idempotencia de tiempos

Intervalos reales vigentes del mismo técnico no pueden solaparse, incluyendo
otras tareas/obras y apuntes creados por un gestor. `[inicio,fin)` permite
09–10 y 10–11. Corrección excluye su propia cabecera, no todos los partes de la
tarea. Dos técnicos que comparten tarea pueden trabajar simultáneamente: son
dos recursos reales, no un duplicado de la misma persona.

Conflicto de tiempo real devuelve 409 y exige corregir/dividir intervalos.
**No hay override de solapamiento para inflar horas/costes**, tampoco del gestor.
Es una política distinta del aviso con aceptación de la agenda planificada.
Para el propio titular se puede comprobar la ocupación temporal de sus partes
sin leer títulos/salas de contextos retirados: devolver sólo intervalo propio y
un conflicto seguro sin nombres de obra ocultos. No afirmar «libre» si falla SQL.

Cabecera, nueva versión, avance CAS y operación idempotente se escriben en una
transacción. `clavePeticion` UUID única por autor para todas las mutaciones de
tiempos; misma clave/hash devuelve el resultado previo después de autorización
actual y antes de rechazar una versión antigua. Clave con otro payload, 409.
Antecedente único y `(registro_id,numero)` impiden ramas de corrección.

Para serializar solapamientos se bloquea el técnico y se releen partes vigentes
después de esperar. No mantener el snapshot del formulario. Protocolo coordinado
con raíz: sala(s) por UUID cuando hay referencias → proyecto(s) por UUID →
plan/tarea → técnico(s) por UUID → cabeceras de tiempo. No adquirir FK/lock de
sala después de proyecto. No actualizar `planes.version`/`plan_tareas.version`
por registrar horas; comparar su identidad/scope bajo la frontera acordada.

El cierre A/E3 tiene una investigación P1 de espera SERIALIZABLE abierta al
redactar este contrato. El ejecutor no modifica esas acciones ni impone un nuevo
aislamiento u orden global: el arquitecto integra/adapta la frontera final y
entrega su gate. REA-05 prueba su concurrencia contra esa versión, sin usar un
test local estrecho como cierre de la investigación general.

## Tarifas y valoración laboral privadas

Tarifa de imputación por técnico, unidad `hora`, importe decimal de cuatro
decimales, moneda explícita, vigencia `[desde,hasta_exclusivo)` de fechas civiles
Madrid, fuente/referencia y calidad `estimada|validada`. «Coste laboral imputado»
no se etiqueta nómina, salario pagado ni factura. No se deduce de rol, nombre,
precio de catálogo o ausencia de partes.

Tarifa opcional: `null` significa sin tarifa. Tarifa cero sólo es conocida cuando
un gestor financiero la registra expresamente con fuente/motivo; no se usa como
valor por defecto. Vigencias vacías, fin <= inicio y tarifas negativas se rechazan.
No puede haber dos tarifas vigentes actuales del mismo técnico en la misma fecha,
aunque sean monedas distintas. El gestor corrige/anula con nueva versión y motivo;
una tarifa editada no revaloriza partes anteriores automáticamente.

Registrar tiempo no lee tarifas. Un gestor financiero pide preview de valoración
para versiones de partes concretas; el servicio divide por medianoche/vigencia,
resuelve la tarifa vigente de cada tramo y muestra huecos. Confirma seleccionados
con versiones/hash; guarda snapshot de tramos, minutos, tarifa-versión/importe/
moneda/vigencia/calidad/fuente y resultado. Los huecos permanecen desconocidos.
Una tarifa estimada sirve a previsto y se muestra aparte; no completa un coste
real validado por el mero hecho de tener número.

Una valoración corresponde a una versión exacta de tiempo. Si cambian/anulan
horas después, el lector financiero detecta versión distinta y marca
`requiere_revaloracion`; no usa el coste antiguo como vigente ni lo borra.
Revalorar es otra versión auditada que conserva la anterior. Restaurar horas
tampoco recupera una valoración antigua silenciosamente. Tarifas y costes no
se incluyen en historial operativo de tiempos ni en eventos públicos de plan.

## Material real: asociación y precio que los datos actuales no resuelven

El módulo material empieza con movimientos físicos existentes, no BOM, reserva,
pedido sin recepción ni cifra de `instalado` de carga. Candidates de obra por
sala/jerarquía actual son **sugerencias de selección**, no prueba de pertenencia
histórica. La persona financiera confirma proyecto/sala/tarea y cantidades con
referencia/evidencia. Para una sala trasladada o movimiento sin sala exige motivo
de atribución explícito; no adopta sala ni cambia `movimientos.sala_id`.

Cada apunte de coste material referencia `movimientos.id`, conserva snapshot/hash
de artículo/unidad/tipo/cantidad/fecha/sala/ubicación y su asociación humana.
Cantidad de apunte positiva, con unidad canónica `ud|m`, compatible con el hecho.
Permite repartir un movimiento entre obras mediante apuntes explícitos, bajo
bloqueo del movimiento: suma de cantidades de apuntes vigentes no puede exceder
su cantidad física. No asignar toda la misma salida a cada obra ni duplicar por
repetir la confirmación. Anular/corregir apuntes libera cobertura con historial,
sin devolver material ni tocar la existencia física.

Tipos para consumo: `salida` suma, `devolucion` resta y `baja` suma. `entrada`
documenta adquisición/reposición; no se suma otra vez al consumo. `ajuste` no se
clasifica automáticamente como coste de obra. Los excluidos/no clasificables
quedan visibles al gestor con motivo/cobertura, sin inventar un signo económico.
Reusar la clasificación de tipos y contrastarla con `SIGNO_MOVIMIENTO`, sin
alterar esa fuente ni su vista SQL de existencias.

Un precio real requiere evidencia histórica confirmada por el gestor: referencia
de documento/coste de adquisición y fecha, moneda, unidad y precio congelados.
Puede asociar una línea de pedido por ID y copiar su precio escrito después de
revisarlo, pero `precio_orientativo=false` no acredita factura ni liquidación.
Como la línea no guarda moneda, confirmarla es obligatorio; no inferirla por
`articulos.coste`, por el proveedor o por el formato del motivo. Precio orientativo
queda estimado y no hace completo el coste real. No consultar `precios.csv`/Cisco
ni usar tarifa de mercado como sustituto silencioso.

Linaje económico que se debe registrar, sin parsers de texto:

- Devolución: enlaza una versión concreta del apunte de salida/lote económico
  de las mismas unidades. Hereda precio/moneda/unidad de esa capa congelada;
  no devuelve al precio vigente de hoy. Devoluciones enlazadas no pueden exceder
  cantidades de esa capa. Sin enlace/precio, parte pendiente/desconocida.
- Baja de material que volvió roto: enlaza devolución correspondiente y su
  salida original; mismas unidades/capa, límite de cantidad y precio idéntico.
  La devolución y la baja se cancelan entre sí, dejando el coste ya consumido
  en la salida. No añadir otro coste desde `carga_lineas.roto`.
- Baja directa de almacén: sólo con identificación explícita de esa procedencia
  y su coste histórico/evidencia, distinta de unidades ya imputadas como salida.
  Si no puede distinguirse de un roto devuelto, linaje no resuelto y coste parcial;
  no adivinar por tener los mismos sala/artículo/cantidad.
- La fila `instalado` de carga es información de reparto, no una nueva compra ni
  consumo adicional. Una partida del cierre ya representada por movimientos no
  se suma de nuevo; enlaces humanos a carga/línea son evidencia auxiliar.

Ejemplo de gate: salida 10, devolución sobrante 3, devolución roto 2 y baja de
ese roto 2, a 10 EUR/unidad de la misma capa = `100−30−20+20 = 70 EUR`.
Instalado 5 no añade 50 EUR: los 70 ya representan cinco instalados y dos rotos.
Sin evidencia de qué movimientos pertenecen al circuito, sólo se muestra lo
registrado como pendiente de conciliar; no se aplica ese ejemplo por semejanza.

Precio/linaje ausente no se rellena con cero, FIFO, media ponderada ni último
precio, porque el sistema actual no acredita esas capas. No se redondean unidades
de cable a piezas. El apunte puede estar `sin_valorar`, `estimado` o `documentado`;
sólo documentados/coherentes entran en subtotal real conocido. La valoración es
documentada **por gestor identificado**, no verificación automática de factura.

Si cambia/desaparece una fuente física o un antecedente económico después de
valorar, el snapshot se conserva y el resumen marca desactualizado/pendiente de
reconciliar. Una corrección de salida no recalcula devoluciones dependientes en
silencio: obliga a nueva revisión explícita de la cadena. Las versiones anteriores
siguen disponibles. Las asociaciones nunca escriben en movimientos/carga/pedidos.

## Aritmética decimal exacta y moneda

Contrato reusable para REA-06, sin paquetes nuevos: módulo puro de raíz
`src/lib/importes.ts`, integrado por el arquitecto. Valores de Postgres
`numeric` y JSON de dinero son **cadenas decimales**, no `Number`. Internamente
se usan BigInt/enteros escalados; nunca parseFloat, EPSILON, multiplicación de
dinero en coma flotante ni BigInt serializado directamente a JSON.

API propuesta:

```ts
export declare function parsearDecimal(texto: string, escala: number): bigint;
export declare function formatearDecimal(valor: bigint, escala: number): string;
export declare function dividirRedondeando(numerador: bigint, denominador: bigint): bigint;
// HALF_UP: mitades alejándose de cero; denominador positivo, también para créditos.
export declare function importeMaterialMinor(precioU4: bigint, cantidadU2: bigint): bigint;
// Producto escala 6 -> unidad menor escala 2: dividir entre 10_000.
export declare function importeLaboralMinor(tarifaHoraU4: bigint, minutos: bigint): bigint;
// Euros/USD por hora escala 4 * minutos / 60 -> minor: dividir entre 6_000.
```

Canonical de intercambio: punto decimal, sin separador de miles, sin exponente,
sin redondear al parsear; rechazar precisión excedida/no finito/overflow. UI puede
aceptar coma decimal mediante normalizador explícito y mostrar canonical antes de
enviar. Escala 4 para precio/tarifa, 2 para cantidad material y unidad menor de
dinero; minutos enteros. Monedas de esta versión `EUR|USD`, ambas con dos decimales;
otra exige ampliación explícita de registro/modelo. No usar conversión de precios
vigente ni un tipo de cambio supuesto. Totales separados por moneda; si hay dos,
no existe total monetario único ni diferencia cruzada.

Política de redondeo HALF_UP REA-05: laboral por tramo de **parte/día civil/tarifa** y
material por apunte/capa; después se suman enteros menores. Se conserva preimagen
(minutos/cantidad, precio y divisor), regla `mitad_fuera_cero_v1` e importe menor.
Cambiar agrupación visual no cambia esos importes. Esta decisión puede diferir de
redondear al final toda la obra y se muestra en metadatos; no se cambia en silencio.
Créditos/devoluciones redondean simétricamente. Un cero calculado válido se
distingue de ausencia de valoración; suma vacía devuelve null, no `0n`.

`coste_material_versiones.importe_minor` se guarda ya firmado:
`signo × importeMaterialMinor(precioU4,cantidadU2)`. El subtotal suma ese campo
una sola vez; no vuelve a aplicar el signo. Los importes laborales son positivos.

El arquitecto puede compartir este núcleo con REA-06. No refactorizar de paso
`calculo-cable`, compras, selector de precios o exportadores E1; REA-05 consume
cantidades/fuentes existentes y calcula sólo sus importes privados. SQL y cliente
reciben strings exactas para importes grandes; formatear no los convierte a Number.

## Previsto, real y estados honestos

El gestor financiero puede guardar un **corte previsto** inmutable de alcance y
fuentes revisadas. No se recalcula al abrir con los datos del día. Registra versión
de plan/tareas/selección, fecha, moneda, política de redondeo, tarifas y material
previstos con sus calidades/ausencias y hashes. Nueva revisión conserva anterior.

Laboral previsto deriva de intervalos planificados y técnicos explícitos de
REA-04, recortados al período y unidos por técnico antes de costear. Conflictos
planificados no crean dos costes para la misma persona a la misma hora. Sin
intervalo/técnico no hay persona-minutos previstos conocidos. La duración estimada
de una tarea compartida no se multiplica automáticamente por todos los técnicos;
ese campo sigue siendo duración de tarea, con sus desconocidos.

Material previsto reutiliza necesidad/lineas BOM E1 ya revisadas, cantidad, unidad
y precio/estado congelados. Usar necesidad completa, no confundir «a comprar» con
consumo total. Puede seleccionar un snapshot durable REA-03 o capturar con su
lector autorizado, copiando datos necesarios dentro del corte; no depender de
tmp E1 ni referencia caducada. Un precio de catálogo/orientativo aquí se etiqueta
**previsto**, nunca real. No crear otro BOM ni tocar la fórmula de cable.

Corte real: versiones actuales de partes/valoraciones e imputaciones materiales
seleccionadas, sus fuentes, huecos/linajes/desactualizaciones y moneda. Período
civil Madrid inclusivo, límites de medianoche contiguos; tiempo se distribuye por
días y material usa `movimientos.fecha` congelada, sin filtrar por fecha de carga
del apunte. Reabrir el corte conserva sus cifras; comparar con el estado actual
marca nuevas fuentes/partes y exige actualizar mediante otra revisión.

| Estado del componente/corte | Significado exacto |
|---|---|
| Sin datos | No hay importes reales conocidos o no hay registros de esa fuente. No significa cero trabajo/consumo. |
| Parcial | Hay subtotal conocido, pero quedan partes sin valorar, tarifa estimada/ausente, fuente/coste desactualizado, linaje no resuelto o moneda/alcance incomparable. Mostrar cantidades/minutos pendientes sin mezclarlos con cero monetario. |
| Completo | Todos los registros **incluidos en el alcance del corte** tienen valoración vigente/documentada, linaje resuelto y moneda coherente. No acredita que el personal haya registrado todas sus horas ni que toda la obra esté conciliada. |

Mostrar siempre denominador: versiones/partes/imputaciones incluidas y pendientes,
selección de tareas/salas/período/componentes y fecha de observación. Un subtotal
vacío es null; un precio explícito cero conserva fuente y es valor conocido.
No llamar «coste total real de obra» a un corte parcial o de una selección.
Estado general de laboral+material sólo es completo si ambos componentes incluidos
lo son; un componente sin datos no completa el otro por omisión.

Comparar minutos sólo con la misma unidad: persona-minutos planificados frente
a persona-minutos reales de la misma selección/período. Duración estimada por
tarea se muestra aparte. Una tarea compartida cuenta una vez como tarea; sus dos
técnicos con una hora real cada uno sí aportan dos horas-persona reales. No sumar
dos veces un mismo parte por joins a asignaciones/grupos.

Diferencia monetaria `real − previsto` sólo por misma moneda, componentes y
alcance comparables, con cobertura completa de los registros seleccionados en
ambos cortes. Si falta un lado o hay parciales, mostrar ambos subtotales y su
estado sin diferencia final engañosa. No beneficio, margen, aceptación, ingresos
ni porcentajes de venta. REA-07 deberá añadir venta aceptada y acreditar cobertura
de costes del ámbito; `completo` de este subconjunto no basta por sí solo.

## Adaptador de corte para REA-07 acordado por el coordinador

El propietario de costes entrega `src/lib/costes/adaptador-propuestas.ts` con
`leerCorteParaPropuesta(conexion, usuarioId, corteId)`. Reutiliza el lector05
autorizado del corte real y su comprobación de vigencia; no constituye otra vía
de consulta ni devuelve tarifas individuales a lectores técnicos. Devuelve ID,
hash, versión de modelo, fecha, ámbito/salas/período/componentes y selección
exactos, totales por moneda como strings, cobertura/pendientes y causas de
desactualización. No escoge automáticamente el último corte ni suma varios.

El snapshot del corte real conserva `tratamientoFiscal` por versión de coste
incluida: `base = sin_impuestos | con_impuestos | no_resuelto`, referencia y
motivo aportados expresamente por el actor financiero. El defecto es
`no_resuelto`; la confirmación no cambia precios/versiones históricas. Esta
declaración auditada se guarda dentro del JSON existente, sin nuevas columnas
ni inferir impuestos por moneda/proveedor/tipo de tarifa. Si faltan declaraciones
o no coinciden con las versiones incluidas, el adaptador conserva ese hueco y
REA07 no puede presentar una diferencia contra base aprobada sin impuestos.
Un corte completo de registros puede seguir siendo fiscalmente incomparable.

La persona revisa el alcance y esas fuentes al preparar/confirmar el corte.
Leerlo después conserva el snapshot y señala cambios actuales; no lo recalcula
ni reinterpreta como coste total de obra. El ejecutor05 verifica este contrato
con sus gates privados; REA07 consume el adaptador sólo después de su revisión.

## Persistencia propuesta

SQL aditivo, no ejecutado. Tablas operativas de tiempo separadas de dinero para
que el camino del trabajador no las consulte. Cabezas mutables sólo por CAS;
versiones, operaciones y cortes inmutables. Validaciones cruzadas del servidor
son obligatorias además de FK/checks. El arquitecto integra schema/migración y
ajustes mínimos de mensajes de borrados referenciados, sin nuevos borrados.

```sql
create table if not exists tiempo_registros (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references plan_tareas(id) on delete restrict,
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  titular_usuario_id uuid references usuarios(id) on delete restrict,
  relacionado_id uuid references tiempo_registros(id) on delete restrict,
  numero_actual integer not null default 1 check (numero_actual > 0),
  actual_id uuid not null,
  creado_en timestamptz not null default now()
);
create table if not exists tiempo_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references tiempo_versiones(id) on delete restrict,
  accion text not null check (accion in ('registro','correccion','anulacion')),
  inicio_utc timestamptz not null,
  fin_utc timestamptz not null,
  minutos integer not null check (minutos between 1 and 1440),
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  entrada_local jsonb not null check (jsonb_typeof(entrada_local) = 'object'),
  notas text not null default '' check (length(notas) <= 2000),
  motivo text check (length(motivo) between 1 and 2000),
  autor_usuario_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  check (fin_utc > inicio_utc and
    extract(epoch from (fin_utc-inicio_utc)) = minutos::numeric * 60),
  check (date_trunc('minute',inicio_utc) = inicio_utc and date_trunc('minute',fin_utc) = fin_utc),
  check ((numero = 1 and antecedente_id is null and accion = 'registro') or
    (numero > 1 and antecedente_id is not null and accion <> 'registro' and motivo is not null)),
  unique(registro_id, numero), unique(registro_id, id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tiempo_actual_fk'
    and conrelid='tiempo_registros'::regclass) then
    alter table tiempo_registros add constraint tiempo_actual_fk
      foreign key(id,actual_id) references tiempo_versiones(registro_id,id)
      deferrable initially deferred;
  end if;
end $$;
create index if not exists tiempo_tecnico_idx on tiempo_registros(tecnico_id, id);
create index if not exists tiempo_tarea_idx on tiempo_registros(tarea_id, id);
create index if not exists tiempo_titular_idx on tiempo_registros(titular_usuario_id, id);
create index if not exists tiempo_intervalo_idx on tiempo_versiones(inicio_utc, fin_utc);

create table if not exists tiempo_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  version_id uuid not null references tiempo_versiones(id) on delete restrict,
  tipo text not null check (tipo in ('registro','correccion','anulacion','restauracion')),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);

create table if not exists coste_tarifa_versiones (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_tarifa_versiones(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  accion text not null check (accion in ('definir','corregir','anular')),
  desde date not null, hasta_exclusivo date,
  precio_hora numeric(12,4) not null check (precio_hora >= 0),
  moneda text not null check (moneda in ('EUR','USD')),
  calidad text not null check (calidad in ('estimada','validada')),
  fuente text not null check (length(btrim(fuente)) between 1 and 1000),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check (hasta_exclusivo is null or hasta_exclusivo > desde),
  check ((numero=1 and antecedente_id is null and accion='definir') or
    (numero>1 and antecedente_id is not null and accion<>'definir')),
  unique(serie_id,numero)
);
create index if not exists coste_tarifa_tecnico_idx on coste_tarifa_versiones(tecnico_id,desde);

create table if not exists coste_labor_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  tiempo_version_id uuid not null references tiempo_versiones(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_labor_versiones(id) on delete restrict,
  accion text not null check (accion in ('valorar','revalorar','anular')),
  tramos jsonb not null check (jsonb_typeof(tramos) = 'array'),
  totales jsonb not null check (jsonb_typeof(totales) = 'object'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(registro_id,numero)
);

create table if not exists coste_material_apuntes (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references movimientos(id) on delete restrict,
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  creado_en timestamptz not null default now()
);
create index if not exists coste_material_mov_idx on coste_material_apuntes(movimiento_id,id);
create index if not exists coste_material_obra_idx on coste_material_apuntes(proyecto_id,id);
create table if not exists coste_material_versiones (
  id uuid primary key default gen_random_uuid(),
  apunte_id uuid not null references coste_material_apuntes(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_material_versiones(id) on delete restrict,
  accion text not null check (accion in ('imputar','corregir','anular')),
  cantidad numeric(12,2) not null check (cantidad > 0),
  unidad text not null check (unidad in ('ud','m')),
  tipo_hecho text not null check (tipo_hecho in ('salida','devolucion','baja')),
  signo integer not null check (signo in (-1,1)),
  movimiento_snapshot jsonb not null check (jsonb_typeof(movimiento_snapshot) = 'object'),
  movimiento_sha256 text not null check (movimiento_sha256 ~ '^[0-9a-f]{64}$'),
  precio_unitario numeric(12,4) check (precio_unitario >= 0),
  moneda text check (moneda in ('EUR','USD')),
  calidad text not null check (calidad in ('sin_valorar','estimado','documentado')),
  importe_minor numeric(30,0),
  origen_salida_version_id uuid references coste_material_versiones(id) on delete restrict,
  origen_devolucion_version_id uuid references coste_material_versiones(id) on delete restrict,
  linaje text not null check (linaje in ('salida','devolucion','reingreso_baja','baja_directa','pendiente')),
  evidencia jsonb not null check (jsonb_typeof(evidencia) = 'object'),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check ((precio_unitario is null) = (moneda is null)),
  check (tipo_hecho <> 'devolucion' or signo=-1),
  check (tipo_hecho='devolucion' or signo=1),
  check (calidad <> 'documentado' or
    (precio_unitario is not null and importe_minor is not null and linaje <> 'pendiente')),
  unique(apunte_id,numero)
);

create table if not exists coste_cortes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  serie_id uuid not null, numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_cortes(id) on delete restrict,
  tipo text not null check (tipo in ('previsto','real','comparacion')),
  version_modelo integer not null default 1 check (version_modelo=1),
  alcance jsonb not null check (jsonb_typeof(alcance) = 'object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(serie_id,numero)
);
create table if not exists coste_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in ('tarifa','laboral','material','corte')),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);

create or replace function rea05_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El registro historico REA05 no se sobrescribe';
end $$;
-- Integrar el mismo trigger antes de UPDATE/DELETE en:
-- tiempo_versiones, tiempo_operaciones, coste_tarifa_versiones,
-- coste_labor_versiones, coste_material_versiones, coste_cortes, coste_operaciones.
do $$ declare nombre text; begin
  foreach nombre in array array['tiempo_versiones','tiempo_operaciones',
    'coste_tarifa_versiones','coste_labor_versiones','coste_material_versiones',
    'coste_cortes','coste_operaciones','coste_material_apuntes'] loop
    execute format('drop trigger if exists rea05_inmutable on %I',nombre);
    execute format('create trigger rea05_inmutable before update or delete on %I '
      'for each row execute function rea05_inmutable()',nombre);
  end loop;
end $$;

create or replace function rea05_identidad_tiempo() returns trigger
language plpgsql as $$ declare n integer; begin
  if tg_op='DELETE' then
    raise exception 'La cabecera de tiempo con historia no se borra';
  end if;
  if (to_jsonb(new)-array['numero_actual','actual_id']) is distinct from
     (to_jsonb(old)-array['numero_actual','actual_id']) then
    raise exception 'La identidad del tiempo no se traslada';
  end if;
  select numero into n from tiempo_versiones
    where registro_id=new.id and id=new.actual_id;
  if n is null or n<>new.numero_actual or new.numero_actual<>old.numero_actual+1 then
    raise exception 'El tiempo avanza una version por correccion';
  end if;
  return new;
end $$;
drop trigger if exists tiempo_identidad on tiempo_registros;
create trigger tiempo_identidad before update or delete on tiempo_registros
  for each row execute function rea05_identidad_tiempo();
```

Cabeceras `tiempo_registros` sólo actualizan `numero_actual/actual_id`; identidad y
scope son inmutables. Cabeceras materiales tampoco se trasladan: corregir su
cantidad/precio es nueva versión; error de obra/movimiento exige anular y crear
otro apunte relacionado. Los triggers propuestos protegen esas cabeceras y sus
versiones sin escribir nada en las tablas históricas de otros módulos.

La versión actual financiera se determina por serie/registro/apunte y mayor
número, con antecedente que debe pertenecer a esa misma serie y número anterior.
`anular` conserva datos pero sale del cálculo. El servidor valida ese vínculo,
coincidencia tiempo-version/registro, técnico y ámbito, cantidades/capas y signos.
Bloquear técnico al crear/corregir tarifas; bloquear movimiento/capas al repartir
material y limitar devoluciones/bajas vinculadas. La unicidad no sustituye esas
transacciones. Misma clave idempotente siempre devuelve el mismo resultado bajo
ACL actual; claves repetidas con otro hash dan 409.

FK fuente no acredita un precio histórico: guardar snapshot/hash y comprobar
que el input revisado sigue vigente antes de escribir. Ninguna escritura de
tiempo tiene trigger que lea costes. Un fallo tras insertar una versión se lanza
y revierte cabecera/operación entera; no devolver error después de escribir dentro
de `sql.begin`. Los estados de tarifa/coste no se guardan en cookie ni eventos
públicos de planificación.

## Archivos, rutas y propiedad exacta

| Responsable | Ámbito exclusivo |
|---|---|
| Ejecutor REA-05 · tiempos | Nuevos `src/lib/tiempos/{modelo,autorizacion,fechas,repositorio,servicio,http}.ts`, pruebas `src/lib/tiempos-*.test.ts`; no editar módulos REA-04. |
| Ejecutor REA-05 · costes | Nuevos `src/lib/costes/{modelo,autorizacion,tarifas,laboral,material,previstos,resumen,repositorio,servicio,http}.ts` y `src/lib/costes-*.test.ts`; vistas públicas y financieras no comparten un cargador que lea todo. |
| Ejecutor REA-05 · UI/API | Nuevos componentes `src/components/tiempos/{mis-partes,formulario,historial,gestion}.tsx`, `src/components/costes/{resumen,tarifas,valoracion-laboral,imputacion-material,conciliacion,cortes}.tsx`; árboles `src/app/api/tiempos/` y `src/app/api/costes/`; páginas `/cuenta/tiempos`, `/proyectos/[id]/tiempos`, `/proyectos/[id]/costes`. |
| Ejecutor REA-05 · gates | Nuevos `scripts/rea05-fixture.mts`, `scripts/verificar-rea05.mts`, `e2e-gate/rea05.config.ts`, `e2e-gate/rea05.spec.mts`; evidencia nueva en `output/rea-integracion/rea05/`. |
| Arquitecto · compartidos | `src/lib/importes.ts` y pruebas raíz, schema, `db/migraciones/2026-10-rea05-tiempos-costes.sql`, `db/migraciones/rollback/2026-10-rea05-tiempos-costes.sql`; extractos comunes de fechas sólo acordados con REA-03/04. Entrega esos contratos antes de ejecución. No editar `importacion/coste.ts` E2 para compartir este núcleo. |
| Arquitecto · enlaces/continuidad | Enlaces desde cuenta/proyecto/plan, menú/panel y registro de tarjetas después del corte conjunto estable. Documentación 17/18/23. Integración con REA-03/06/07 secuencial, no edición del ejecutor. |
| Arquitecto · concurrencia existente | Cualquier frontera de cierre/A/E3 o mensajes de borrado referenciado; no se delega su modificación unilateral al ejecutor 05. |

No editar acciones de almacén/compras/carga/usuarios/ciclo, precios CSV/seed,
motor de cable/BOM, E3 ni preferencias. No crear otros roles/secciones o tablas
de personal/salario dentro de usuarios. El núcleo decimal puede implementarlo
el ejecutor sólo si raíz le asigna expresamente su propiedad durante ese corte;
de otro modo entrega propuesta para integración, no una copia competidora.

Rutas operativas y privadas separadas:

| Ruta API | Contrato |
|---|---|
| `/api/tiempos/mios` | GET partes del titular con filtro civil; POST propio desde vínculo/autor servidor. Sin campos monetarios. |
| `/api/tiempos/proyectos/[id]` | GET gestión con proyectos:editar; POST por gestor a técnico existente con motivo. |
| `/api/tiempos/registros/[id]` | GET/PATCH nueva corrección con numeroActual/actualId/clavePeticion; nunca UPDATE del histórico. |
| `/api/tiempos/registros/[id]/anular` y `/historial` | POST anulación; GET versiones/POST restauración con antecedente/motivo y mismos permisos. |
| `/api/costes/tarifas` y `/tarifas/[serieId]` | GET/POST nuevas versiones privadas; preview de vigencia/solapamiento, sin CRUD de técnico. |
| `/api/costes/laboral/preparar` y `/confirmar` | POST preview/confirmación por versiones de tiempo, tramos y tarifa, hash/versiones/clave. |
| `/api/costes/material/candidatos` | GET hechos físicos acotados permitidos; sin unión por texto ni coste vivo asumido. |
| `/api/costes/material/preparar` y `/confirmar` | POST preview/confirmación de asociaciones, reparto, linaje, evidencia y valoraciones por IDs. |
| `/api/costes/material/[apunteId]` | GET historial/POST nueva corrección o anulación con antecedente esperado y clave. |
| `/api/costes/proyectos/[id]` | GET resumen privado de alcance registrado/estado y comparación de cortes; ninguna carga de UI pública llama este endpoint. |
| `/api/costes/cortes/preparar` y `/confirmar` | POST snapshot previsto/real/comparación revisada; datos copiados, versiones/hash y clave. |
| `/api/costes/cortes/[id]` | GET snapshot inmutable después de autorización financiera actual. No enlace público. |

Next Node, params asíncronos, sesión dentro de frontera segura, `no-store` y origen
propio en mutaciones con convención existente. Validación JSON estricta/cuerpo
incremental antes de SQL. Cada handler se guarda por sí mismo; layout no protege
APIs. Una petición de tiempos propia no importa/invoca un repositorio financiero
como efecto secundario. No mensajes/correos, cron ni comunicación externa.

400 entrada/decimal inválido; 401 sin sesión/usuario inactivo; 403 vínculo,
rol/permiso, provisional/ficticio/origen; 404 registro fuera de alcance/no titular;
409 CAS/idempotencia/solapamiento/fuente cambiada; 413 selección/tamaño; 422 hora
inexistente/ambigua sin elección, moneda/modelo no soportados o linaje inválido;
503 BD/migración/servicio. No 200 vacío ante SQL fallido ni errores con consultas,
stack, credenciales o datos laborales de otras personas.

## UI, límites y gates Dado / Cuando / Entonces

Flujo de trabajador en cuenta/tarea: partes, intervalo real, nota, corrección y
historial propio. Gestión: selector explícito de técnico/obra/tarea, altas por
otro y conflictos. Finanzas en página separada sólo para capacidad autorizada:
tarifas, valorar sin tarifa, conciliación material, cortes y comparación.
Desconocidos/estimados/documentados distintos; no aviso de tarifa ausente al
trabajador. Una respuesta tardía no sustituye selección/editado posterior;
400/403/409 conserva formulario y permite recargar/comparar, sin sobreescritura.
Sistema visual vigente, foco/teclado/etiquetas/estado accesible, escritorio antes
de cierre móvil. No exponer campos financieros en HTML, RSC, hidratación o logs.

Límites centralizados: 64 KiB de cuerpo, 200 partes por valoración, 100 apuntes
materiales por confirmación, 50 resultados por página, 20 sugerencias de búsqueda,
366 días por consulta, 10.000 filas/10 MiB por corte. Si supera, error y ámbito
menor: nunca truncar para declarar completo. Costes en strings exactas; límites
de `numeric` y tamaño de BigInt/entrada validados, sin paquetes nuevos.

1. **Prerrequisito real.** Dadas tablas de contrato 22 sin servicio/UI 04, cuando
   comienza ejecución 05, entonces se exige el corte 04 verificado antes de integrar
   sus flujos; no se declara planificación implementada por la migración sola.
2. **Identidad.** Dado vínculo explícito único, sin vínculo y vínculo ambiguo,
   cuando registra, entonces sólo el primero admite autoservicio no lectura;
   gestor usa técnico/autor separados. Ninguna coincidencia de nombre crea enlace
   ni otra cuenta obtiene históricos al cambiar el vínculo.
3. **Privacidad salarial.** Dados lectura con compras:ver, gestor operativo y
   trabajador, cuando usan horas/UI/RSC/API, entonces no hay SELECT de tablas
   coste/tarifa, importes, campos de moneda ni conteos privados. Admin autorizado
   sí accede; revocación con cookie válida corta siguiente GET/mutación/snapshot.
4. **Intervalos.** Dados vacíos, segundos, fin <= inicio, futuro y >24 horas,
   cuando registra, entonces rechaza sin escritura. Parte válido calcula minutos
   exactos, no copia agenda ni cambia estado de tarea/hito.
5. **DST y período.** Dados primavera/otoño Madrid y parte cruzando medianoche,
   cuando registra/consulta, entonces gap falla, repetición exige offset y los
   minutos se reparten por días reales de 23/25 h. Sin 1970 ni sumar 24 h al día civil.
6. **Carrera real.** Dadas dos conexiones con partes solapados del mismo técnico
   en obras distintas, cuando confirman, entonces una gana y otra recibe 409 con datos
   permitidos; contiguos ganan y dos técnicos distintos no se bloquean como mismo.
   No existe override que duplique persona-minutos/coste.
7. **Corrección.** Dado parte existente y dos ediciones, cuando corrigen/anulan/
   restauran, entonces CAS/antecedente único permite una rama; conserva todo
   histórico y precio privado no se consulta desde esa acción del trabajador.
   Misma clave/payload devuelve mismo resultado; otro payload devuelve 409.
8. **Histórico cerrado.** Dada obra/plan/tarea cerrados, cuando trabajador intenta
   alta ordinaria, se rechaza; gestor con motivo registra/corrige trabajo atrasado
   sólo en sidecars. No reabre obra/plan ni toca diseño/hitos; técnico inactivo
   conserva corrección histórica sin alta nueva ordinaria.
9. **Tarifas.** Dadas vigencias contiguas, solapadas, huecos, cero explícito y
   monedas distintas, cuando prepara/confirma, entonces no hay tarifa ambigua;
   huecos permanecen desconocidos y cero conserva fuente. Revisión de tarifa no
   cambia valoraciones previas; estimada no completa real validado.
10. **Valoración posterior.** Dado parte sin tarifa creado por trabajador, cuando
    gestor valora, entonces congela tarifa/tramos/moneda/versión y fuente. Corregir
    tiempo después marca desactualización sólo en lector financiero; revalorar
    crea antecedente nuevo sin precio antiguo presentado como vigente.
11. **Decimal exacto.** Dados 0,10 × 3, 90 min × 20 EUR/h, medios céntimos positivos/
    negativos y límites grandes, cuando calcula, entonces usa BigInt/divisor
    exactos, resultados 0,30/30,00 y redondeo simétrico documentado. Suma vacía null,
    cero explícito distinto y ninguna conversión a Number para JSON/formato.
12. **Linaje ausente.** Dados movimientos y pedidos/cargas con mismos nombres,
    cuando sugiere material, entonces no infiere FK por motivo/artículo/fecha.
    Moneda/precio no confirmados o sólo catálogo vigente dejan real desconocido;
    un pedido orientativo no se usa como adquisición real.
13. **Circuito sin doble coste.** Dados IDs revisados de salida 10, devolución 3,
    devolución roto 2 y baja 2 con capa 10 EUR, cuando valora, entonces total 70 EUR y
    cierre instalado 5 no añade 50. Sin enlace de capa/retorno, marca parcial.
14. **Reparto concurrente.** Dada salida 10 repartida en dos obras por dos
    conexiones, cuando imputan 7+7, entonces una confirmación no puede superar 10
    vigente. Devoluciones/bajas enlazadas respetan sus límites; anular/corregir
    libera sólo cobertura de sidecar y no devuelve stock.
15. **Fuente alterada.** Dado apunte/circuito valorado, cuando cambia cantidad,
    sala/jerarquía/cierre físico o antecedente económico, entonces snapshot antiguo
    se conserva y comparación nueva exige conciliar; no repricia devoluciones ni
    atribuye historia automáticamente a la obra actual.
16. **Previsto comparable.** Dados tarea compartida, conflicto planificado,
    estimación desconocida y snapshot E1, cuando prepara corte previsto, entonces
    usa unión por técnico para persona-minutos, necesidad BOM congelada y calidad
    de precios; no multiplica duración de tarea por recursos ni lo llama real.
17. **Estados/moneda.** Dados real sin datos, subtotal parcial, cero conocido y
    EUR/USD, cuando compara, entonces conserva null/cobertura/moneda y no totaliza
    divisas ni muestra diferencia/beneficio final con un lado ausente. Completo
    explicita alcance registrado y no afirma haber capturado toda la obra.
18. **Durabilidad y no mutación.** Dadas fotos/hashes de tablas operativas y
    fuentes protegidas, cuando registra/corrige/valora/asocia/corta y reinicia app,
    entonces versiones/cortes reproducen datos; stock/movimientos/reservas,
    pedidos/líneas, cargas/líneas, hitos, planes/tareas/E3 y CSV siguen idénticos.
19. **Cierre concurrente.** Dadas barreras de raíz para cierre/A/E3 y tiempo 05,
    cuando compiten, entonces no hay ciclo de locks sala/proyecto ni modificación
    física posterior al cierre. Evidencia no se usa para cerrar la P1 general sin
    su gate independiente; operaciones históricas 05 sólo escriben sus sidecars.
20. **Flujo real.** Dado escritorio con trabajador/gestor/admin, cuando recorre
    partes/correcciones, tarifa posterior, valoración, material pendiente/conciliado
    y cortes, entonces roles ven exactamente su contenido y tardanzas/conflictos
    conservan formulario. Al final móvil, accesibilidad y descarga de HTML/RSC
    demuestran ausencia de datos salariales para usuarios no autorizados.

El arquitecto crea/entrega nueva base sintética REA-05 con URL/identidad explícita;
no inventario, `.env.local`, producción ni bases anteriores. Fixtures mínimas
nombradas, pruebas puras/SQL de dos conexiones, spies de consultas privadas,
E2E escritorio antes de móvil, tipos/lint/build sin BD y regresiones que afecten
fronteras compartidas. Guardar comandos, logs crudos, fotos operativas, resultados
decimales, capturas y evidencia de privacidad en `output/rea-integracion/rea05/`.
Revisión independiente de comportamiento/fuentes, no aceptación por informe del
autor. Cierre distingue código local, migración sintética, UI real verificada y
qué cobertura financiera sigue pendiente; ST33 global/beneficio/aceptación siguen
pendientes de REA-06/07 y de sus datos reales.

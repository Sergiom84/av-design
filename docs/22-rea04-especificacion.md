# REA-04 · Plan de montaje, tareas y agenda

15-10-2026. **Contrato listo para implementar; no acredita implementación ni
aceptación.** Candidatos ST25, ST27, ST28 y ST32 de `18-rea-cobertura.md`;
contrato padre `17-integracion-rea.md`. Conserva R1, E2/E3 y REA-01/02/03.
Sólo trabajo local en AV_design, rama `codex/rea-integracion`. Este documento
no ejecuta SQL ni autoriza commit, push, despliegue o producción.

## Resultado y frontera

Cada obra existente puede tener un plan con tareas manuales y tareas propuestas
desde sus salas y un catálogo editable de trabajos/reglas. Preparar muestra un
diff; confirmar escribe exclusivamente las acciones elegidas. Repetir no
duplica tareas. Técnicos existentes pueden asignarse a tareas y reservarse en
intervalos explícitos, con conflictos comprobados en servidor. La agenda muestra
Hoy, Semana, Vencidas y Sin fecha; la ocupación es tiempo **planificado**, nunca
horas trabajadas ni disponibilidad contractual del personal.

Un plan no crea obra, sala, localización, técnico ni usuario. Una sala legado se
adopta primero mediante el flujo existente; generar un plan no la adopta. No hay
proyecto X-PRO paralelo. Completar/anular/reactivar tareas no inicia/cierra obra,
firma hitos, marca visita/instalación/entrega, mueve stock, recibe pedidos ni
marca carga de furgoneta. Los estados físicos conservan sus fuentes actuales.

REA-05 incorporará registros reales de tiempo y sus correcciones, usando los
UUID estables de estas tareas. Esta unidad no crea horas, partes, tarifas,
costes, porcentajes de beneficio, identidad fiscal ni estados comerciales.

## Fuentes comprobadas y reutilización

| Fuente actual | Decisión |
|---|---|
| `proyectos → localizaciones → salas`, `datos-proyectos.ts`, `proyecto.ts` | El plan tiene FK a obra existente. Lectores nuevos no llaman `obtenerProyecto`, que también consulta pedidos. No usar sus resúmenes financieros/materiales para planificar. |
| `tecnicos`, `tecnico_roles`, `datos-ciclo.ts`, `ciclo-vida.ts` | Reusar IDs/nombres/activo de técnicos. Sus roles actuales habilitan hitos, no son una matriz de competencias inventada para tareas. No crear otro personal. |
| `usuarios.tecnico_id` es opcional; usuarios y técnicos son identidades distintas. | La autoría es usuario real; la asignación es técnico. Ninguna coincidencia por nombre, orden o correo crea ese enlace. La agenda usa selector de técnico; no llama «Mi agenda» a un filtro supuesto. |
| E3 guarda `revisiones_diseno` inmutables con id/hash/diseno_version/snapshot; `salas.diseno_version` cambia con diseño. | Conservar referencia E3 y una proyección propia mínima revisada. No crear/reabrir/restaurar revisiones para generar tareas. |
| `leerDiseno()` E3 consulta catálogo y parámetros, incluso si el plan sólo necesita sala/tipología. | No llamar ese lector completo ni al snapshot E1 para planificar. SQL propio selecciona sólo campos permitidos; tampoco leer un snapshot JSON entero para descartarlo luego. |
| `sala_equipos`, `conexiones`, `sala_material_bom` contienen el diseño persistido; la última incluye partidas adicionales con lote opcional/revisión. | Proponer desde esas filas, no desde una importación sin confirmar, reservas o compras. No construir otro BOM ni recalcular cable. |
| `acciones-ciclo.ts`, adopción y duplicación E3 usan sala(s) → proyecto; el protocolo final acordado está en `19-rea01-especificacion.md`, sección de concurrencia. | Mantener ese orden y su comprobación posterior del conjunto de salas; ninguna transacción de planificación bloquea proyecto y después sala, ni por FK. |
| `informes/periodos.ts` ya exporta `fechaCivil`, `sumarDias`, `diaISO`, `partesMadrid`, `instantesMadrid`, `medianocheMadrid`; calendario resuelve offset. | Adaptador de planificación sobre esos helpers puros. No escribir otro conversor DST ni editar sus archivos mientras REA-03 los implementa. |

Las guías locales de Next.js de Route Handlers y `after` ya consultadas durante
REA-03 siguen aplicando: handlers con guardas propias, params/searchParams
asíncronos, tipos de rutas generados y ninguna promesa suelta después del POST.
Preparación y confirmación son operaciones deterministas; no requieren IA.

## Permisos por contenido, antes de leer

Autenticación real, activo y contraseña definitiva en toda API/mutación.
Releer rol/excepciones con `resolverPermisos`/`puede` en servidor; no tomar
permisos del cuerpo, preferencias, grupo operativo o técnico asignado. Los
usuarios ficticios no persisten planes. Se conserva el layout actual de proyectos
y cada API realiza además su autorización propia.

| Operación/contenido | Lectura | Escritura de planificación |
|---|---|---|
| Plan, tarea manual general de obra, catálogo de trabajos y grupo operativo | `proyectos:ver` | `proyectos:editar` |
| Tarea vinculada a sala; regla/preview por sala o tipología; proyección E3 de sala | Lo anterior + `salas:ver` | `proyectos:editar` + `salas:ver`; no modifica diseño físico. |
| Elegir/matchear artículo/categoría/señal de equipo/conexión/partida BOM y ver su procedencia de catálogo | Lo anterior + `catalogo:ver` | Los mismos permisos de lectura + `proyectos:editar`; no requiere editar catálogo AV. |
| Agenda global/ocupación/conflictos completos por técnico, que cruzan tareas de salas | `proyectos:ver` + `salas:ver` | Reservar técnicos requiere también `proyectos:editar`. |

La vista de tarea separa su planificación operativa (título literal, notas,
estado, fecha y técnicos) del detalle de procedencia de catálogo. Sin permiso de
catálogo puede consultarse/organizarse una tarea de sala ya existente, pero no se
consulta ni devuelve su artículo, descripción de catálogo, selector privado o
snapshot privado. Los títulos del catálogo de trabajos son texto literal; no se
interpolan automáticamente marca/modelo en campos operativos visibles a otros.

Sin `salas:ver` sólo se consultan tareas generales de obra con `sala_id is null`,
sin contar/consultar las de sala. Se etiqueta ese alcance. Puede dar vencimiento
a esas tareas, pero no confirmar reservas de técnicos que exigirían comprobar
una agenda global incompleta. Los filtros/tarjetas globales exigen ambos permisos.
No devolver cero por una sección oculta ni ofrecer «sin conflictos» sin haber
podido consultar todo el conjunto relevante.

No se consulta `precios`, costes/pvp de artículos, `existencias`, movimientos,
reservas, pedidos, recepciones, cargas, parámetros ni ficha completa con almacén.
Proyectar columnas explícitas de `articulos`; prohibido `select *`, `to_jsonb(a)`
o cargar el catálogo completo. La comprobación de identidad sólo lee sus campos
mínimos, nunca `clave_hash`. Los grupos operativos no conceden ACL. Hoy no hay ACL
por obra/sede: no inventar pertenencias a proyectos o autorización por técnico.

## Modelo operativo y catálogo editable

Un único `planes` por `proyecto_id`, creado con acción explícita, con versión
optimista y archivo reversible. GET no crea filas. La obra puede estar sin iniciar;
tener un plan no registra su inicio. Una obra cerrada permite consultar pero no
crear/editar/archivar/reactivar plan ni tareas. Reabrir la obra sigue su flujo
existente, sin una acción nueva de planificación que borre el cierre.

Catálogo de trabajos `catalogo_tareas`: título literal (1..160), descripción
(0..2.000), duración estimada en minutos enteros positivos o `null`, activo y
versión. Editable desde planificación con `proyectos:editar`; cambios futuros no
actualizan planes existentes. No hay catálogo AV nuevo, competencias/tarifas ni
duraciones predeterminadas inventadas. Puede empezar vacío: tareas manuales
funcionan sin reglas; la UI permite crear trabajo y su primera regla. Fixtures
de aceptación sí contienen reglas sintéticas explícitas.

Reglas `reglas_plan`: trabajo, activo, versión y selector estricto discriminado:

```ts
type SelectorReglaPlan =
  | { tipo: 'sala' }
  | { tipo: 'tipologia'; tipologia: string }
  | { tipo: 'equipo'; articuloId?: string; categoria?: string }
  | { tipo: 'conexion'; senal?: string; articuloCableId?: string }
  | { tipo: 'material_bom'; articuloId?: string };
```

No SQL/expresiones libres, comodines arbitrarios, fuzzy matching ni funciones
de usuario. Tipología/categoría literal recortada, sin unir variantes por parecido;
señal usa el enum existente. Filtros simultáneos son AND. Seleccionar una nueva
referencia exige artículo existente/activo y del tipo correspondiente; una fuente
histórica que conserva artículo retirado se identifica y no se sustituye sola.
Desactivar regla/trabajo impide nuevas propuestas, sin eliminar sus tareas.

Cardinalidad determinista por regla:

- Sala/tipología: una candidata por `sala.id` que cumple.
- Equipo: una por `sala_equipos.id`. Su cantidad describe la fila; no se inventan
  IDs por cada unidad ni se multiplica una estimación por cantidad sin una regla
  de negocio que aquí no existe.
- Conexión: una por `conexiones.id`, conservando `identificador_cable`. No deriva
  otra longitud ni propone tareas para conexiones inexistentes.
- Material BOM: una por `sala_material_bom.id`, con cantidad/unidad/revisión y lote
  cuando existe. Incluye partidas adicionales persistidas manualmente o por E2,
  no el preview de importación ni toda la necesidad calculada de material.

«Confirmado» aquí significa fuente persistida o revisión E3 elegida. No equivale
a colocado, comprado, disponible o instalado. En especial
`posicion_confirmada=false` es geometría estimada: no elimina el equipo del plan
ni acredita una visita. La tarea recibe ese aviso cuando procede.

Una tarea manual puede ser general de obra o vincularse a una sala actual de ella.
Tiene UUID nuevo y no necesita regla. Reutilizar un trabajo copia sus valores
como snapshot editable, no crea un enlace vivo que reescriba la tarea mañana.
No hay borrado físico desde UI/API.

## Fuente revisada, preview y diff

Entrada de preparación: obra, versión de plan (o ausencia si aún no hay plan),
selección explícita de salas o intención «todas», reglas elegidas y fuente por
sala: `actual` o `revision` con UUID E3 de esa misma sala. Una sala legado o de
otra obra rechaza el conjunto; no se adopta ni se omite. Elegir revisión previa
no permite recuperar una sala que ya no pertenece a esta obra.

Lector propio de fuentes:

- Actual: identidad/jerarquía/tipología/versiones de sala y sólo grupos de datos
  necesarios para los selectores elegidos. Artículos: id/tipo/categoría y las
  etiquetas necesarias, únicamente con permiso de catálogo.
- E3: id, número, nombre, hash y `diseno_version`; JSON proyectado en SQL mediante
  `snapshot->'sala'`/rutas y campos permitidos de `datos.equipos`, `conexiones` o
  `material`. Si sólo se necesita tipología, seleccionar ese campo, no todo
  `sala`. No leer `contexto.parametros`, precios ni el blob íntegro. Metadatos
  mínimos de artículo del snapshot sólo cuando corresponda y esté autorizado.
- `hashFuente` propio SHA-256 de la proyección canónica y ordenada, IDs/versiones
  de trabajo/reglas, jerarquía y selección. Se conserva además hash E3 cuando
  existe. No recalcular el hash E3 con un lector que consultaría fuentes ocultas.

La versión de sala actual y la de una revisión elegida permiten avisar de revisión
anterior de forma conservadora; un cambio ajeno a los selectores puede marcar el
origen como posterior sin afirmar que haya cambiado el trabajo. Confirmar una
revisión histórica exige `aceptoFuenteAnterior` explícito tras mostrarla. No
convertirla en fuente actual por defecto.

Preview en una lectura `repeatable read read only`, sin insertar plan ni tareas.
Devuelve proyección segura, hash, fecha de lectura, versiones de plan/reglas,
fuentes, avisos y candidatas/diff. Token de selección de diez minutos, validado
recalculando todo en servidor al confirmar; token/hash no sustituye autorización.
Una edición de diseño, jerarquía, regla o plan desde preview produce 409 y exige
volver a revisar. Fuente/regla no soportada produce error, no lista vacía.

Identidad generada estable: `clave_origen = SHA256(versionClave=1, reglaId,
salaId, tipoOrigen, idOrigen)`. No incluye hash/versión de fuente, ni título,
cantidad o fechas: cambiar la revisión propone actualizar esa tarea, no otra.
Índice único `(plan_id, clave_origen)` también para tareas anuladas. Una tarea
manual no tiene esa clave. Duplicar una sala E3 crea otros IDs y otras candidatas
sólo si esa sala entra en la selección; no copia el plan de la original.

El diff distingue `nueva`, `sin_cambios`, `cambiada`, `origen_retirado`,
`anulada_existente` y `edicion_manual`. Muestra origen/versiones y cambios por
campo. No marca todo por defecto. Confirmación enumera `crear`, `actualizar` o
`anular` para claves concretas con versión esperada. Lo no elegido queda intacto.

Nuevas tareas nacen `borrador`, sin técnicos, fechas ni una duración inventada.
`base_generada` conserva título/descripción/estimación originales. Si esos campos
actuales difieren de la base, el diff conserva la edición manual y exige elección
por campo para sustituirla; nunca la pisa por marcar una fila genérica. Regenerar
no modifica estado, notas del técnico, vencimiento, intervalo ni asignaciones.

Retirar una fuente propone anular, nunca DELETE. La anulación exige motivo y
elección; una tarea hecha se conserva hecha salvo cambio de estado explícito
fuera de regeneración. Una candidata ya anulada no se vuelve a crear ni se
reactiva automáticamente. Se puede mantener una tarea aunque desaparezca su
origen, con aviso y motivo registrado, sin moverla de obra o cambiar su UUID.

Confirmación lleva UUID `clavePeticion`; misma clave/payload devuelve la operación
ya aplicada antes de comparar versiones antiguas. Misma clave/otro payload, 409.
Repetir con otra clave no duplica por el índice de origen; muestra diff actualizado
o conflicto de versión. Fuentes/acciones aplicadas y autor se conservan en una
operación inmutable. Fallar una candidata revierte toda esa confirmación.

## Tareas, estados e historial reversible

Estados de planificación: `borrador`, `pendiente`, `en_curso`, `hecha`, `anulada`.
Se puede confirmar un borrador como pendiente sin marcar hechos físicos. Pasar a
hecha es un apunte de tarea, no prueba de entrega; título y estado no invocan
acciones de ciclo de vida. No se calcula un porcentaje físico desde estas filas.

Duración estimada `null` se muestra «Sin estimar». Cero, negativo, no entero y
no finito se rechazan. El intervalo programado tampoco rellena automáticamente
la estimación: reservar dos horas no demuestra cuánto costará o cuánto se trabajó.

Todo cambio requiere `versionPlan` y `versionTarea`; la transacción incrementa
ambas proyecciones y escribe evento con usuario real, fecha de servidor,
motivo/tipo, antes/después y operación. CAS antiguo devuelve 409 y no sobrescribe.
Operaciones sin cambio efectivo no duplican eventos ni elevan versiones.

Anular, reabrir una hecha, reactivar una anulada, archivar/reactivar plan y
restaurar una versión de tarea exigen motivo. Restaurar escribe **otro** evento
con antecedente; conserva los eventos previos, UUID, origen y operación original.
No reescribe una captura E3 ni un apunte de tiempo futuro. Estado reactivado es
borrador; fechas/asignaciones históricas no vuelven a comprometer recursos sin
revisión explícita y comprobación de técnicos/conflictos actuales.

No hay borrado de eventos/operaciones/fuentes desde la aplicación. Cambios
manuales/restauraciones pueden recuperar campos editables, pero no falsificar
autor/fecha de un evento, propietario de obra u origen generado. Una sala
trasladada hace desactualizadas sus tareas anteriores: se permite conservarlas
con motivo o anularlas; no se transfieren de obra. No usar nueva jerarquía como
si hubiera sido la fuente histórica.

## Técnicos, grupos y conflictos

Se asignan UUID de `tecnicos` existentes/activos, deduplicados. No exige el rol
de firma de un hito, porque una tarea no es ese hito. La baja posterior conserva
la asignación/historia con aviso «Técnico inactivo»; impide asignaciones nuevas
y su reactivación hasta resolverlas. La UI muestra quién asignó y a qué técnico;
no atribuye la operación al técnico seleccionado.

Grupos operativos son listas con nombre, versión y miembros de técnicos,
**del plan concreto**. Editarlos exige proyectos:editar. Al asignar un grupo se
expande y confirma una lista de técnicos con versión/composición visible; cambiar
el grupo después no cambia tareas ya asignadas. Dos grupos con la misma persona
producen una asignación. No reutilizar grupos de audiencia de informes, usuarios
ni permisos. No crear técnicos, editar roles o dar accesos desde este módulo.

Una tarea tiene un intervalo común y cero o varios técnicos. No hay intervalos
distintos por miembro ni capacidad porcentual en esta unidad. Los asignados sin
intervalo son responsabilidad pendiente de fechar, sin minutos de ocupación
ficticios. Un intervalo sin técnico aparece como trabajo sin asignar.

Conflictos para el mismo técnico: intervalos activos `[inicio, fin)` con
`a.inicio < b.fin && b.inicio < a.fin`, excluyendo la misma tarea, tareas
borrador/hechas/anuladas y planes archivados. Dos intervalos que sólo se tocan
no se solapan. Se comprueba contra **todas las obras**, no sólo la pantalla
actual. Título/obra/sala del conflicto se devuelven sólo con sus permisos; el
detalle privado de catálogo no se consulta para decidir un solapamiento.

Los conflictos avisan y permiten una decisión explícita: respuesta 409 con lista
actual/hash y opciones de corregir o «Confirmar con conflicto» y nota (1..500).
El servidor vuelve a calcular bajo bloqueo de los técnicos ordenados por UUID.
`aceptacionConflictos:{hash,nota}` sólo vale para ese conjunto vigente y operación;
no es una bandera general `ignorar`. Un conflicto nuevo cambia el hash y obliga
a revisar. Si no hay permiso para la agenda completa, no se concede confirmación
ciega. Guardar otras notas no exige volver a aceptar un conflicto si no cambia
estado activo, intervalo, técnicos o reactivación de plan.

## Fechas y agenda Europe/Madrid

Zona única explícita `Europe/Madrid`; fechas civiles y horas de pared estrictas,
sin epoch por vacío. Reusar helpers puros de informes mediante
`planificacion/fechas.ts`, traduciendo `ErrorInforme` a `ErrorPlan` en el borde.
El ejecutor no modifica `informes/periodos.ts`/`calendario.ts`: si hace falta una
utilidad común nueva, propone al arquitecto el extracto mínimo y éste lo integra
secuencialmente con regresiones REA-03. No copiar algoritmos de offset/DST.

`vence_fecha` opcional es día civil inclusivo. `inicio`/`fin` de agenda son pareja
opcional; ambos ausentes o ambos presentes, `fin > inicio`, precisión de minuto,
máximo siete días por bloque. Se persisten UTC más zona y la representación
local/offset confirmada en evento. No se reinterpretan con la zona del navegador.

Una hora inexistente de primavera se rechaza con explicación; una hora ambigua
de otoño devuelve las dos alternativas y exige elegir offset. El adaptador usa
**todos** los resultados de `instantesMadrid`, no la elección automática de
primera aparición que usa el scheduler de informes. Un intervalo que cruce DST
conserva los instantes elegidos; sus minutos son tiempo UTC transcurrido. Un día
civil se delimita con medianoches contiguas, no sumando 24 horas.

Fijar `ahora` una vez por respuesta. Agenda con filtros URL reproducibles de obra,
técnico (opcional), estados y vista. Lectura coherente y sin consultas de material.

| Vista | Predicado sobre tareas abiertas (borrador/pendiente/en_curso), excluido plan archivado |
|---|---|
| Hoy | Intervalo que solapa el día civil de hoy **o** vencimiento hoy. |
| Semana | Intervalo que solapa lunes 00:00 a lunes siguiente 00:00 **o** vencimiento dentro de lunes-domingo de la semana actual. |
| Vencidas | Vencimiento civil anterior a hoy; si no hay vencimiento explícito, fin de intervalo anterior a `ahora`. |
| Sin fecha | Sin vencimiento y sin intervalo. La duración estimada no cuenta como fecha. |

Una tarea puede aparecer en varias vistas (por ejemplo atrasada y reprogramada
para hoy); no sumar sus contadores como si fueran conjuntos disjuntos. Cada vista
deduplica por tarea.id aunque tenga varios asignados. Los estados cerrados se
consultan con filtro explícito de historial, sin contaminar alertas pendientes.
Una fecha de vencimiento anterior al fin planificado avisa de incoherencia; no
se cambia automáticamente ninguna de las dos.

Ocupación activa por técnico: recortar intervalos de tareas pendientes/en curso
al rango visible, deduplicar `(tecnico_id,tarea_id)`, ordenar y calcular la **unión
de intervalos** antes de sumar minutos. No sumar sin más intervalos solapados.
Una tarea compartida de 120 min ocupa 120 min en cada técnico; el contador global
de tareas es uno. No sumar esas columnas y llamarlas duración de la tarea ni
horas reales. No se muestra total de horas global ambiguo ni porcentaje de
capacidad laboral sin fuente de jornada/disponibilidad.

Estimación total de tareas, si se muestra, suma una vez por tarea los minutos
conocidos; informa cuántas quedan sin estimar. Desconocido no es cero. Mostrar
aparte tareas asignadas sin intervalo/técnico inactivo. Ocupación y estimación
son medidas distintas; ninguna alimenta coste real, nómina ni hitos.

## Concurrencia y cierre: orden que no puede romperse

Se adopta el protocolo final de cierre A descrito en
`19-rea01-especificacion.md`: salas→proyecto, comparación del conjunto después
de esperar y rollback/reintento completo máximo tres. La adopción bloquea
sala→proyectos origen/destino ordenados y relee ambos cierres. No modificar esas
acciones ni E3 para adaptarlas unilateralmente al plan. El gate REA-04 debe
ejecutarse contra esa versión ya integrada, conservando su evidencia anterior.

Orden de las escrituras REA-04 que referencian salas: primero identificar IDs sin
locks de proyecto, bloquear **todas las salas afectadas en orden UUID**, después
proyecto, plan/tareas, catálogo de trabajo/reglas cuando corresponda y técnicos
en orden UUID. Releer bajo bloqueo pertenencia/versiones y cierre de obra antes
de escribir. Una operación general de obra que no toca ni referencia sala puede
comenzar por proyecto, pero no adquiere luego sala ni inserta una FK de sala.

Las FK también toman locks: insertar tarea/fuente que referencia sala no puede
hacerlo por primera vez poseyendo proyecto. Las tareas mantienen sala inmutable;
una lectura inicial de tarea para conocerla se revalida después de los locks.
No bloquear otra tarea/proyecto al calcular conflictos: leer su proyección de
intervalos tras serializar técnicos; sólo se modifica el plan de la operación.

Selección «todas»: revalidar el conjunto ordenado tras esperar proyecto para
detectar altas/duplicaciones/adopciones concurrentes. Si aparece o desaparece
una sala respecto a las bloqueadas, rollback completo y nuevo intento en orden,
máximo tres; nunca adquirir la sala nueva con proyecto ya bloqueado. Si cambia
respecto al preview, 409 para nueva revisión. Selección explícita no incorpora
salas nuevas a escondidas. No bloquear todas las salas para editar una nota
general que no depende de ellas.

Plan y tarea tienen CAS; en operaciones multifuente se verifica la versión de
plan antes de aplicar el lote. Locks de técnicos hacen que dos planes que
reservan a la misma persona lean conflictos actuales después de esperar, incluso
si ambos previews estaban libres. La base usa READ COMMITTED para esas escrituras
y relectura posterior a locks; no mantener un snapshot viejo de preview en la
confirmación. Reintentos de serialización/deadlock sólo si la operación completa
se revierte y se conserva su clave idempotente; no duplicar eventos.

El gate debe intercalar confirmación/tarea, cierre, nueva sala, adopción y copia
E3 con barreras de dos conexiones. Resultado válido: operación anterior al cierre
o 409 sin escrituras después de éste; sin deadlock, salas fantasma omitidas ni
plan de una sala ajena. No declarar resuelto el cierre general por probar sólo
la ruta de planificación.

## Propiedad exacta e integración

Un ejecutor construye REA-04 sin hijos ni escrituras sobre archivos ajenos.

| Responsable | Archivos |
|---|---|
| Ejecutor · dominio y servidor | Nuevos `src/lib/planificacion/{modelo,reglas,fuentes,diff,agenda,fechas,autorizacion,repositorio,servicio,http}.ts`; pruebas `src/lib/planificacion-*.test.ts` recogidas por el glob actual. Helpers puros sin BD/Next. |
| Ejecutor · UI | Nuevos `src/components/planificacion/{plan,catalogo-tareas,reglas,preparacion,lista-tareas,ficha-tarea,asignaciones,grupos,agenda,historial}.tsx` y pruebas; `src/app/proyectos/[id]/plan/page.tsx`, `src/app/proyectos/agenda/page.tsx`, `src/app/proyectos/planificacion/catalogo/page.tsx`. |
| Ejecutor · API | Nuevo árbol `src/app/api/plan/` con rutas de la tabla siguiente. Guardas por operación; no usar APIs físicas para guardar tarea. |
| Ejecutor · gates | Nuevos `scripts/rea04-fixture.mts`, `scripts/verificar-rea04.mts`, `e2e-gate/rea04.config.ts`, `e2e-gate/rea04.spec.mts`; evidencia sólo `output/rea-integracion/rea04/`. |
| Arquitecto · SQL/protocolo | `db/schema.sql`, `db/migraciones/2026-10-rea04-planes.sql`, `db/migraciones/rollback/2026-10-rea04-planes.sql`; integración del protocolo de cierre y borrado referenciado en `acciones-proyectos.ts`/`acciones.ts`, sólo tras coordinar cierre A. |
| Arquitecto · enlaces/Panel | `src/app/proyectos/[id]/page.tsx`, enlace de agenda desde proyectos; `preferencias-usuario.ts`, `panel-repositorio.ts` y componente de resumen del Panel, después de REA-02 estable. No las edita el ejecutor. |
| Arquitecto · fechas/continuidad | Cualquier extracto común de helpers de informes acordado con REA-03; documentación 17/18/22 y continuidad. |

No editar `datos.ts`, catálogo AV/CSV/seed, fórmulas, importación E2, esquema o
lectores E3, permisos/roles, paquete E1, preferencias ni acciones de cierre por
cuenta propia. No se necesitan paquetes nuevos.

Integración futura del Panel: las nueve tarjetas actuales y sus significados se
conservan. Añadir Hoy/Semana/Vencidas/Sin fecha/ocupación sólo al existir la fuente
y el gate REA-04. Centralizar `seccionesRequeridas`/`tarjetaAutorizada` para admitir
`['proyectos','salas']`, reemplazando el supuesto de una sola sección y el máximo
Zod fijo 9 por límite derivado del registro. No reinterpretar ni borrar preferencias
ya guardadas; las nuevas claves entran en orden canónico. Tarjeta y destino usan
el mismo servicio/filtro de agenda, con el mismo `ahora` y ámbito; no horas reales
ni contadores de furgoneta. El permiso se comprueba antes de la consulta, incluso
para tarjetas ocultas o enlaces auxiliares.

## Rutas, errores y comportamiento de UI

API Node, `no-store`, sesión dentro de frontera de errores. Mutaciones de mismo
origen con convención `mismoOrigen`, JSON estricto, UUID y límites antes de SQL.
Un usuario de lectura no consigue editar enviando POST directo. HTTP no hereda
el layout. `params` asíncronos y rutas tipadas según Next instalado.

| Ruta | Operación |
|---|---|
| `/api/plan/proyectos/[proyectoId]` | GET plan/proyección permitida; POST crear explícitamente; PATCH archivo/notas con versión/motivo. |
| `/api/plan/proyectos/[proyectoId]/preparar` | POST preview de fuentes/reglas/diff; sin escrituras. |
| `/api/plan/proyectos/[proyectoId]/confirmar` | POST token/hash, versiones, acciones elegidas y clavePeticion; todo o nada. |
| `/api/plan/proyectos/[proyectoId]/tareas` | GET paginado/filtrado; POST tarea manual. |
| `/api/plan/tareas/[id]` | GET segura; PATCH campos/estado con versiones/clavePeticion; sin DELETE. |
| `/api/plan/tareas/[id]/asignaciones` | PUT reemplazo explícito de lista técnicos/expansión de grupos, versiones y aceptación de conflictos. Se audita el diff; no cambia miembros por editar un grupo luego. |
| `/api/plan/tareas/[id]/historial` | GET paginado; POST restauración de campos editables/antecedente con motivo y CAS. |
| `/api/plan/catalogo` y `/api/plan/catalogo/[id]` | GET/POST/PATCH trabajos con versión, búsqueda remota y activo; no CRUD de artículos AV. |
| `/api/plan/reglas` y `/api/plan/reglas/[id]` | GET/POST/PATCH selectores/trabajo con versión y permisos de las fuentes. Sin DELETE. |
| `/api/plan/proyectos/[proyectoId]/grupos` y `/api/plan/grupos/[id]` | GET/POST/PATCH grupos operativos del plan, composición y versión. |
| `/api/plan/tecnicos` | GET búsqueda de técnicos activos, máximo 20, y los inactivos ya referenciados en la tarea autorizada; sólo ID/nombre/activo. |
| `/api/plan/agenda` | GET vistas/rango/técnico/obra con sus contadores y ocupación; mismo núcleo para tarjetas y detalle. |

400 entrada inválida; 401 sin sesión/inactivo; 403 provisional/ficticio/origen o
permiso; 404 recurso inexistente/fuera de la obra pedida; 409 versión/preview/
fuente/cierre/conflicto actual incompatible; 413 cuerpo/selección excesiva; 422
hora inexistente o ambigua sin elección, selector/versión no soportada; 503
BD/migración/servicio. Faltan tablas no equivale a cero tareas. Mensaje seguro,
código estable y sin SQL/stack/URL ni detalles de contenido no autorizado.

La confirmación de conflicto devuelve estado pendiente de decisión, nunca éxito
falso. Preview, guardado y agenda llevan ID de solicitud; una respuesta tardía
no reemplaza edición, selección o resultados de una solicitud posterior. Al
cambiar obra/filtro se invalidan las respuestas anteriores. Error conserva
formulario y selección; 409 permite recargar/comparar, sin sobrescribir.

Pantalla de plan: estado de la obra y del plan, fuentes/revisión/desactualización,
preparar/revisar diff, crear tarea, filtro y ficha con historial. Agenda: cuatro
vistas y selector explícito de obra/técnico; etiquetas distintas «Ocupación
planificada», «Estimación» y «Sin estimar». Ningún control sugiere que una tarea
marca una entrega física. Sistema `design-system/MASTER.md`, controles etiquetados,
foco/teclado y estados accesibles. Validar escritorio completo antes del móvil.

## SQL propuesto: sólo integrar y probar en una nueva base sintética

Bloque aditivo. Validación estricta extra en servidor para JSON/selectores,
estados, fuentes, tamaños y transiciones. No ejecutar desde este documento ni
crear una BD por cuenta del ejecutor. El arquitecto integra schema/migración.

```sql
create table if not exists catalogo_tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (length(descripcion) <= 2000),
  duracion_estimada_min integer check (duracion_estimada_min between 1 and 43200),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists reglas_plan (
  id uuid primary key default gen_random_uuid(),
  trabajo_id uuid not null references catalogo_tareas(id) on delete restrict,
  selector jsonb not null check (jsonb_typeof(selector) = 'object'),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists planes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null unique references proyectos(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  notas text not null default '' check (length(notas) <= 2000),
  archivado_en timestamptz,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists plan_fuentes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo = 1),
  generador text not null default 'rea04-1' check (generador = 'rea04-1'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  -- Proyecciones separadas: no seleccionar la privada sin catálogo autorizado.
  publico jsonb not null check (jsonb_typeof(publico) = 'object'),
  catalogo jsonb not null default '{}' check (jsonb_typeof(catalogo) = 'object'),
  revisiones_e3 jsonb not null default '[]' check (jsonb_typeof(revisiones_e3) = 'array'),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  unique(plan_id, sha256)
);
create table if not exists plan_operaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in
    ('crear_plan','editar_plan','confirmar_fuente','crear_tarea','editar_tarea',
     'estado_tarea','asignar','restaurar_tarea','grupo','archivar_plan','reactivar_plan')),
  version_antes integer not null check (version_antes >= 0),
  version_despues integer not null check (version_despues >= version_antes),
  fuente_id uuid references plan_fuentes(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  motivo text check (length(motivo) between 1 and 2000),
  resumen jsonb not null check (jsonb_typeof(resumen) = 'object'),
  creado_en timestamptz not null default now(),
  unique(plan_id, clave_peticion)
);
create table if not exists plan_tareas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  trabajo_id uuid references catalogo_tareas(id) on delete restrict,
  regla_id uuid references reglas_plan(id) on delete restrict,
  clave_origen text check (clave_origen ~ '^[0-9a-f]{64}$'),
  fuente_id uuid references plan_fuentes(id) on delete restrict,
  origen_publico jsonb not null default '{}' check (jsonb_typeof(origen_publico) = 'object'),
  origen_catalogo jsonb not null default '{}' check (jsonb_typeof(origen_catalogo) = 'object'),
  base_generada jsonb check (jsonb_typeof(base_generada) = 'object'),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (length(descripcion) <= 2000),
  notas text not null default '' check (length(notas) <= 2000),
  duracion_estimada_min integer check (duracion_estimada_min between 1 and 43200),
  estado text not null default 'borrador' check
    (estado in ('borrador','pendiente','en_curso','hecha','anulada')),
  vence_fecha date,
  inicio_utc timestamptz,
  fin_utc timestamptz,
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check ((inicio_utc is null) = (fin_utc is null)),
  check (fin_utc is null or
    (fin_utc > inicio_utc and fin_utc - inicio_utc <= interval '7 days')),
  check ((clave_origen is null and regla_id is null and fuente_id is null) or
    (clave_origen is not null and regla_id is not null and fuente_id is not null and sala_id is not null)),
  unique(plan_id, clave_origen)
);
create index if not exists plan_tareas_obra_estado_idx on plan_tareas(plan_id, estado, id);
create index if not exists plan_tareas_vencimiento_idx on plan_tareas(vence_fecha, id);
create index if not exists plan_tareas_intervalo_idx on plan_tareas(inicio_utc, fin_utc);

create table if not exists plan_grupos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists plan_grupo_miembros (
  grupo_id uuid not null references plan_grupos(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  primary key(grupo_id, tecnico_id)
);
create table if not exists plan_asignaciones (
  tarea_id uuid not null references plan_tareas(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  activo boolean not null default true,
  origen_grupos jsonb not null default '[]' check (jsonb_typeof(origen_grupos) = 'array'),
  asignado_por uuid not null references usuarios(id) on delete restrict,
  actualizado_en timestamptz not null default now(),
  primary key(tarea_id, tecnico_id)
);
create index if not exists plan_asignaciones_tecnico_idx
  on plan_asignaciones(tecnico_id, tarea_id) where activo;

create table if not exists plan_eventos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  operacion_id uuid not null references plan_operaciones(id) on delete restrict,
  version_plan integer not null check (version_plan >= 0),
  orden integer not null check (orden >= 0),
  tipo text not null,
  autor_id uuid not null references usuarios(id) on delete restrict,
  antecedente_id uuid references plan_eventos(id) on delete restrict,
  motivo text check (length(motivo) between 1 and 2000),
  antes jsonb,
  despues jsonb,
  -- Detalle privado de procedencia nunca se devuelve por una lectura operativa.
  catalogo jsonb not null default '{}' check (jsonb_typeof(catalogo) = 'object'),
  creado_en timestamptz not null default now(),
  unique(plan_id, version_plan, orden)
);
create index if not exists plan_eventos_tarea_idx
  on plan_eventos(tarea_id, creado_en desc, id);

create or replace function plan_registro_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El historial y la fuente de un plan son inmutables';
end $$;
drop trigger if exists plan_fuente_inmutable on plan_fuentes;
create trigger plan_fuente_inmutable before update or delete on plan_fuentes
  for each row execute function plan_registro_inmutable();
drop trigger if exists plan_operacion_inmutable on plan_operaciones;
create trigger plan_operacion_inmutable before update or delete on plan_operaciones
  for each row execute function plan_registro_inmutable();
drop trigger if exists plan_evento_inmutable on plan_eventos;
create trigger plan_evento_inmutable before update or delete on plan_eventos
  for each row execute function plan_registro_inmutable();

create or replace function plan_identidad_tarea_inmutable() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.plan_id,new.sala_id,new.regla_id,new.clave_origen,
         new.creado_por,new.creado_en) is distinct from
     row(old.id,old.plan_id,old.sala_id,old.regla_id,old.clave_origen,
         old.creado_por,old.creado_en) then
    raise exception 'La identidad y el ambito de una tarea no se trasladan';
  end if;
  return new;
end $$;
drop trigger if exists plan_tarea_identidad on plan_tareas;
create trigger plan_tarea_identidad before update on plan_tareas
  for each row execute function plan_identidad_tarea_inmutable();
```

Las FK conservan obra/sala/técnico con historia. El arquitecto integra mensajes
seguros en los borrados actuales cuando estas referencias impiden eliminar,
sin añadir un nuevo CRUD o borrado en cascada. Archivar un plan no elimina esa
historia. Rollback sólo en la nueva base sintética identificada y en orden
dependiente; no borrar planes reales para retirar la funcionalidad.

El servidor comprueba bajo locks que fuente/regla/tarea/grupo/operación pertenecen
al mismo plan y que sala pertenece actualmente a la obra. Ninguna FK simple prueba
esa relación cruzada. Proyecciones, evento y operación se escriben en la misma
transacción; error lanzado implica rollback. No devolver un error como valor
después de insertar, porque postgres.js confirmaría una transacción resuelta.

## Límites y aceptación verificable

Límites centralizados: 64 KiB de cuerpo leído incrementalmente, 500 salas por
preparación, 200 reglas activas elegidas, 2.000 candidatas por preview, 200 acciones
por confirmación, 10 MiB de proyección de fuente, 5.000 tareas por plan, 50 grupos
por plan, 100 técnicos por grupo y 50 por tarea. Página de lista/historial de 50,
búsquedas remotas de 20. Agenda máximo 93 días por consulta. No truncar preview,
ocupación o conflictos y declararlos completos; dar error y pedir filtro menor.
Estados/límites/versiones/UUID se validan antes de escribir. Sin dependencias nuevas.

1. **Obra existente.** Dada obra con dos localizaciones y sala legado aparte,
   cuando crea/prepara plan, entonces sólo añade planificación a esa obra. Sala
   legado/ajena se rechaza sin adoptarla; GET no crea plan y repetir no lo duplica.
2. **Catálogo editable.** Dadas reglas por sala/tipología/equipo/conexión/BOM,
   cuando se editan/desactivan con CAS, entonces el próximo preview cambia, los
   planes conservan sus snapshots y dos versiones no se pisan. Sin catálogo
   configurado se pueden crear tareas manuales y duración desconocida.
3. **Fuente exacta.** Dados equipo persistido con posición estimada, conexión con
   ID de cable y partida BOM manual/E2, cuando prepara, entonces propone por sus
   IDs reales, conserva avisos/cantidad/unidad/revisión y no inventa unidades,
   metros, stock ni hechos de instalación.
4. **E3 anterior.** Dada revisión E3 y diseño actual distinto, cuando la elige,
   entonces aparece origen anterior/hash/revisión; confirmar exige aceptación
   explícita y conserva esa proyección. No crea/restaura revisión ni consulta
   parámetros u otros campos fuera del selector autorizado.
5. **Selección/diff.** Dadas diez candidatas y dos elegidas, cuando confirma,
   entonces sólo crea esas dos borrador. Repetir misma clave/payload devuelve la
   operación; otra clave no duplica origen. Cambio de BOM/cantidad propone diff,
   conserva edición manual/fechas/técnicos y no borra tareas con origen retirado.
6. **Actualización elegida.** Dada tarea generada retocada a mano, cuando se
   actualiza una regla, entonces muestra antes/actual/propuesto por campo; una
   confirmación genérica no pisa la personalización. Una anulada sigue siendo
   la misma tarea y una hecha no deja de estar hecha por regenerar.
7. **Sin consultas ocultas.** Dados usuarios sin catálogo/compras/almacén/
   parámetros, cuando consultan una tarea operativa permitida o agenda, entonces
   SQL/HTML/respuesta no leen/devuelven esas fuentes privadas. Preview que necesita
   catálogo da 403 antes de consultarlo. Sin salas, las tareas de sala no aparecen
   ni se cuentan; no puede confirmar una reserva sin agenda completa.
8. **Autor/técnico.** Dado usuario sin enlace técnico y técnicos activos/inactivos,
   cuando asigna, entonces elige UUID activo y queda su usuario como autor. No se
   emparejan nombres ni se da permiso al asignado. Baja posterior conserva historia
   y bloquea nueva asignación/reactivación sin resolver el técnico.
9. **Grupos.** Dados dos grupos con un miembro común, cuando asigna su expansión,
   entonces hay un técnico una vez; versión antigua da 409. Cambiar grupo después
   no reasigna tareas ni amplía permisos. Grupo de otra obra se rechaza.
10. **Conflictos actuales.** Dados previews libres en dos obras para el mismo
    técnico/intervalo, cuando confirman simultáneamente, entonces el segundo ve
    el conflicto tras esperar. Sólo confirma con hash/nota vigente; un conflicto
    nuevo invalida una aceptación antigua. Intervalos contiguos no solapan y
    tarea compartida no genera conflicto consigo misma.
11. **DST.** Dado Madrid 29-03-2026 02:30, cuando agenda, entonces rechaza hora
    inexistente. Dado 25-10-2026 02:30, exige elegir +02:00/+01:00 y conserva el
    instante. Cruce DST suma minutos UTC; Hoy/Semana usan días de 23/25 horas.
    Fechas vacías/imposibles y fin <= inicio fallan sin 1970.
12. **Cuatro vistas.** Dadas tareas de hoy, semana, vencida, sin fecha y una hecha,
    cuando filtra, entonces aplica exactamente los predicados; los contadores y
    enlaces coinciden con detalle y una tarea compartida cuenta una vez. La hecha
    sólo aparece al pedir historial; las vistas no se suman como grupos disjuntos.
13. **Ocupación.** Dado técnico con 09–11 y 10–12, cuando calcula, entonces ocupa
    180 min, no 240. Otro técnico compartiendo una tarea mantiene su propia unión;
    el contador global conserva una tarea. Desconocido se declara, intervalos sin
    técnico no ocupan una persona inventada y ninguna cifra dice horas reales.
14. **Historial reversible.** Dada tarea completada/anulada, cuando reabre/restaura
    con motivo, entonces crea evento/antecedente nuevo, conserva los anteriores y
    CAS impide pisar otra edición. Reactivar queda borrador y no resucita reservas
    de técnicos/fechas sin comprobación actual.
15. **Sin hechos físicos.** Dados hashes de tablas operativas antes, cuando crea,
    genera, asigna, completa, anula y archiva planes/tareas, entonces stock,
    movimientos, reservas, pedidos/líneas, cargas/líneas, hitos/revisiones físicas y
    diseños E3 conservan sus valores. REA-05 aún no tiene tiempos ni costes nuevos.
16. **Cierre y fantasmas.** Dadas barreras para cierre, confirmación, alta,
    adopción y duplicación E3, cuando compiten, entonces respetan sala→proyecto,
    detectan conjunto cambiado sin lock inverso y o escriben antes del cierre o
    rechazan sin efectos. Sin deadlock ni sala no revisada incorporada al plan.
17. **Errores e idempotencia.** Dados origen modificado, caída tras primer insert,
    límite excedido y misma clave con otro payload, cuando confirma, entonces hay
    rollback completo/conflicto seguro, sin tareas/eventos parciales ni éxito
    vacío. Versiones no soportadas no se interpretan como conocidas.
18. **UI completa.** Dado escritorio, cuando crea trabajo/regla, prepara diffs,
    confirma algunas, crea manual, asigna grupo, resuelve conflicto, fecha,
    completa/restaura y consulta agenda, entonces guarda y reabre con el mismo
    estado. Respuestas tardías/403/409 conservan formulario y no filtran contenido.
    Después se comprueba cierre móvil, teclado/foco/etiquetas y errores accesibles.
19. **Panel integrado por root.** Dadas las nueve preferencias anteriores, cuando
    se añaden tarjetas de agenda, entonces siguen válidas y sólo consultan las
    nuevas cifras si ambos permisos/visibilidad lo permiten. Tarjeta y URL usan
    mismo filtro/ahora; ocultar salas evita su SQL, no lo sustituye por cero.

El arquitecto entrega una **BD sintética nueva REA-04** con URL/identidad verificadas;
no `.env.local`, inventario, producción ni bases REA-02/03/E1/E3. Evidencia nueva
en `output/rea-integracion/rea04/`: comandos/logs crudos, fotos operativas antes/
después, escenarios de dos conexiones, consultas observadas y capturas de flujo
escritorio antes de móvil. Pruebas puras, integración Postgres, E2E, tipos/lint y
build sin BD; regresiones de cierre/E3 y REA-02/03 si se integran sus fronteras.
Revisión independiente de artefactos y comportamiento, sin usar el informe del
autor como prueba de aceptación. Cierre registra implementación/gates reales y
pendientes explícitos; ninguna clasificación de la matriz acredita este módulo.

# REA-08 · Activos individuales y servicio de instalaciones entregadas

> **16-10-2026: cerrada localmente.** La revisión inicial y el gate selectivo de
> la única corrección cierran R08-01…05, incluido suplemento raíz de privacidad
> y enlaces.63fuentes actuales coinciden con el freeze contrastado por raíz.
> `output/rea-integracion/revision/rea08/correccion-20261016/dictamen.json` y
> `rea08/correccion/20261016T084354Z/aceptacion-root.json`. Build/gate conjunto
> posterior pendientes; las notas siguientes conservan el corte de preparación.

15-10-2026. **Contrato aprobado por el coordinador; ejecución después del corte
04 verificado y la integración de guardas compartidas. No producto implementado,
aceptación de runtime. SQL sólo aplicado en nueva5561.** Desarrolla ST24/ST26 y el registro mínimo
AVX-05 de `18-rea-cobertura.md`; conserva los contratos22/24, el ciclo físico y
las revisiones E3 existentes. Único checkout AV_design, rama
`codex/rea-integracion`. Sin investigación Xtenav adicional.

Preparación terminada y ejecución asignada a `implement_servicio08` por el coordinador.
SQL aplicado sólo a nueva5561 y añadido al schema raíz; ninguna base existente
fue migrada. Sin `.env`, commit, push, merge, despliegue, producción, mensajes
externos, cobro ni firma contractual.

## Resultado y frontera

Una persona elige qué unidades de una sala necesita seguir, revisa la fuente y
crea activos individuales previstos. Confirmar que una unidad está instalada y
entregada exige evidencia humana, una revisión E3 elegida expresamente y un hito
real de entrega de esa sala registrado en ese momento. Sobre esa instalación se
abren incidencias, registran visitas y aplican acuerdos internos con condiciones
aportadas. Traslados y sustituciones conservan la identidad e historia física.

| Evidencia actual | Decisión ejecutable |
|---|---|
| `sala_equipos.cantidad` es entero y una fila puede representar varias unidades de diseño. Coordenadas/posición confirmada son geometría. | No es inventario instalado. Un activo es una unidad sin campo cantidad; materializar requiere elegir ordinales concretos de esa fila. |
| `hitos_sala` tiene instalación/entrega, fecha civil, técnico y notas; no referencia una revisión E3. | La entrega de sala no acredita qué unidades se instalaron ni qué revisión se entregó. La asociación la confirma una persona, nunca la última revisión por fecha. |
| Los hitos se corrigen borrando y registrando de nuevo; `acciones-ciclo.ts` permite ese flujo en obra abierta. | Conservar ID informativo y snapshot/hash del hito; **sin FK a hitos_sala** ni trigger que impida borrarlo. Cambios posteriores se señalan sin destruir historia08. |
| E3 conserva revisiones inmutables con sala/hash/diseno_version/snapshot. Su lector completo consulta otras fuentes. | Proyección SQL mínima de metadatos/equipos elegidos; no cargar snapshot completo, catálogo, parámetros o dinero para descartarlos. |
| Técnicos y roles existentes habilitan hitos concretos; usuario y técnico son identidades distintas. | Reusar técnicos, sin otra plantilla de personal. Asignar servicio no exige rol de firma de instalación ni concede permisos. Autor es usuario real. |
| REA04 organiza tareas, pero una obra cerrada no admite modificar su plan. | Servicio08 puede registrar sidecars en obra cerrada sin reabrirla ni crear un plan paralelo. Relación opcional a tarea04 es lectura, sin agenda/horas automáticas. |
| Propuestas06 son documentos internos y pueden tener dinero privado. | No inferir cobertura, firma, pago o garantía desde una propuesta aceptada. Este módulo no consulta valoraciones, destinatarios, costes o precios. |

No se crea otra obra, sede, sala, localización, BOM, catálogo AV o stock. El
registro08 describe unidades de servicio; existencias, salida/devolución/baja,
reservas, recepción, carga, diseño, hitos y entrega mantienen sus fuentes y
acciones actuales. Una sustitución ofrece un resumen para revisar esas acciones
por separado, nunca las ejecuta al guardar servicio.

## ACL y proyecciones

Identidad real/activa/no provisional y permisos actuales de servidor en cada
GET, RSC, mutación, reintento e historial. Sin usuario ficticio, permisos del
cuerpo, cookie con derechos congelados o acceso por ser técnico asignado.
No añadir roles/secciones ni ACL por obra/sede que hoy no existe.

| Superficie | Lectura | Escritura08 |
|---|---|---|
| Activos, incidencias, visitas y acuerdos de una sala, incluida legado | salas:ver | salas:editar |
| Listado/agregado por obra y contexto de obra histórica/actual | salas:ver + proyectos:ver | salas:editar + proyectos:editar al operar desde ese ámbito o cambiar atribución entre obras |
| Traslado/sustitución entre salas u obras | Permisos de ambos contextos; proyectos:ver si hay una obra implicada | salas:editar y proyectos:editar para las obras implicadas; no adopta las salas |
| Detalle/búsqueda de referencia AV, marca/modelo del catálogo | catalogo:ver además del ámbito | Mismo permiso al confirmar esa referencia; nunca catalogo:editar implícito |
| Vincular tarea04 existente | Proyectos:ver + salas:ver y ACL04 | Edición08; el vínculo no edita04 ni reserva técnicos |

Sin proyectos:ver se puede leer/gestionar la sala por su ruta con salas:editar,
pero no nombres/códigos/resúmenes de obra ni filtros globales de obra. El servidor
puede resolver su UUID de pertenencia mínimo para congelar contexto y autorizar,
sin cargar la ficha financiera de proyecto. Histórico de traslado exige permisos
de los contextos que muestra; se omiten detalles retirados antes de cargar JSON,
con aviso de alcance, sin afirmar historial completo.

Los títulos operativos son texto literal de la sala o introducido por la persona;
no interpolar datos privados de catálogo en ellos. Campo técnico de catálogo,
snapshot E3 proyectado y detalle de fuente se cargan por funciones separadas
después de su permiso. Nunca `SELECT *`, lector E1/BOM completo, ficha con almacén,
precios, existencias, compras, tarifas, salarios, costes05/07, contactos de
proveedores o snapshot de propuesta06. No devolver campos monetarios ni ocultarlos
con CSS. No hay proveedor externo, correo, IA ni carga/descarga remota de evidencias.

## Materialización explícita y activo físico

Preview de **una sala elegida**, fuente actual o una revisión E3 elegida de esa
misma sala, filas de equipo y ordinales expresos, por ejemplo equipoX/unidad2 de4.
No botón que copie todas las salas ni todo el inventario. El servidor relee
cantidad y artículo/nombre permitido; no acepta esos hechos del navegador.
Sólo equipos con cantidad entera positiva; cables/metros, mobiliario y cantidades
ausentes/ambiguas no se convierten en activos mediante esta acción.

Preview READ ONLY muestra fuente/versión/hash, unidades propuestas/existentes,
avisos de fuente histórica y selección exacta. Confirmación con token firmado
de10min vuelve a comprobar IDs/ACL/versiones/hash y crea únicamente seleccionados.
Clave estable por `(salaOrigen,equipoOrigen,ordinal)` sin incluir hash o número
de revisión: revisar el mismo equipo no fabrica nuevas unidades. El índice único
incluye retirados/sustituidos; nunca reciclar esa identidad de origen.
Mismo lote/payload idempotente devuelve los mismos IDs; nueva cantidad sólo
propone ordinales nuevos. Reducción/desaparición de diseño marca fuente cambiada,
sin borrar activos, retirar físicamente unidades ni reasignar seriales.

Se admite un candidato manual observado que no esté en el diseño: sala existente,
etiqueta literal, fuente/referencia/motivo y artículo opcional confirmado con
catálogo:ver. Empieza Previsto/Pendiente de confirmar, con UUID propio; no crea
equipo de diseño ni afirma entrega. Un serial coincidente no es un mecanismo de
merge o importación. Para confirmar instalado se identifica después la revisión
E3 real de contexto y se declara expresamente si esa unidad no está representada
en ella, con evidencia y motivo; no inventar una fila E3 para hacerla encajar.

Cada activo mantiene identidad UUID de una sola unidad. Serial es opcional:
null significa desconocido; no poner `SIN SERIE`, UUID de app ni ordinal como
serial de fabricante. Conservar literal; detector usa trim+NFC+mayúsculas como
clave de posible duplicado, sin alterar el original ni unir identidades.
Vacío normaliza a null. Etiqueta operativa1..160, serial1..200 si existe.

Serial posiblemente duplicado produce409 revisable con coincidencias autorizadas.
Confirmarlo requiere hash vigente del conjunto y motivo explícito; no unicidad
falsa mundial, sustitución de serial ajeno ni permiso para leer otro contexto.
Sin acceso para revisar un conflicto no se ofrece override ciego ni se revela
su sala/obra/ID. Confirmaciones concurrentes serializan por clave normalizada y
releen después de esperar: un preview libre no concede permiso para duplicar.
Serial corregido es nueva versión con motivo; historial conserva el anterior.

## Confirmación, fuentes y cambios físicos registrados

Estados derivados de eventos/versiones08: `previsto`,
`instalado_entregado_confirmado`, `retirado` y `sustituido`. No son campos libres
del formulario ni estado del diseño/obra. El evento de confirmación guarda:

- activo/sala y contexto de proyecto resuelto, fecha real confirmada por persona,
  autor/fecha de registro y evidencia literal de identificación/ubicación;
- revisión E3 ID/hash/número/diseno_version de esa sala, elegida y revisada;
- snapshot de entrega: id, sala_id, tipo=entrega, fecha, tecnico_id/nombre resuelto,
  notas y creado_en, más hash canónico; hitoID es informativo, sin FK;
- si existe instalación, su snapshot adicional etiquetado; instalación sola,
  entrega de otra sala, diseño/cantidad, foto de catálogo o tarea hecha no bastan.

La fecha de confirmación física no puede ser futura ni anterior a la entrega
elegida. Si revisión de contexto es posterior a la fecha de entrega, la persona
debe declarar expresamente esa limitación; no llamarla automáticamente «revisión
entregada». Sin revisión E3 identificada o entrega real vigente se conserva el
candidato, pero no se permite confirmar instalado/entregado. No se obliga a
crear/restaurar una revisión ni a cambiar un hito desde servicio.

Durante confirmación se relee/bloquea temporalmente el hito elegido para que un
borrado concurrente no deje una comprobación partida; el lock acaba con la
transacción. Si ya desapareció/cambió respecto a preview,409 sin confirmación.
Después puede corregirse mediante el flujo físico vigente. Al consultar08 se
compara la proyección del hito actual: `coincide|modificado|ausente`, con fecha
observada. El snapshot y la confirmación histórica no se borran ni se sustituyen.
Una nueva entrega no se enlaza por semejanza: reconciliarla exige otra revisión08
con diff/motivo. Incidencias/visitas previas siguen su fuente original.

Una obra cerrada admite estas escrituras08: materialización revisada, confirmación
con entrega existente, acuerdos, incidencias, visitas y cambios de activos.
Es registro de servicio autorizado, no modificación de estructura/plan/diseño.
Que falte o se corrija la entrega después no destruye el servicio de un activo
ya confirmado: se puede continuar/abrir incidencia mostrando fuente cambiada y
aceptación explícita del aviso, sin afirmar una nueva entrega física vigente.

**Traslado:** misma unidad y UUID, salas origen/destino existentes, evidencia y
fecha/motivo, revisión y entrega confirmadas de destino. Nueva versión cambia
sólo su ubicación de servicio; no mueve `sala_equipos`, sala o stock. Destino sin
entrega queda como traslado propuesto en preview, sin presencia confirmada allí.
Los tickets antiguos conservan sala/proyecto/versión del activo al abrirse;
no viajan por un join a su ubicación de hoy. Retirado muestra última ubicación
conocida y motivo, sin presentarlo como instalado ni como existencia de almacén.

**Sustitución:** dos UUID distintos y relación antiguo→nuevo, con sus versiones
exactas/evidencia. Nuevo puede ser candidato previo o alta manual explícita;
confirmar exige sus propios serial/evidencia/revisión/entrega de destino.
Transacción única marca antiguo Sustituido, confirma nuevo y enlaza ambos. No
traspasa serial, garantía, cobertura, visitas ni identidad. La incidencia conserva
el activo averiado y añade el vínculo al sustituto, sin sobrescribir el origen.
Nuevo no puede sustituirse a sí mismo ni ya sustituir otra unidad en esa operación;
otro reemplazo requiere nueva relación/historia explícita.

La UI muestra «Revisar movimientos en Almacén» y el resumen de unidades como
paso independiente, con los permisos propios de las acciones existentes al
usarlas. Guardar08 no inserta siquiera un movimiento pendiente ni decide
salida/devolución/baja a partir de un estado de servicio. No simular recepción,
cierre/carga, garantía del fabricante o activo disponible en el estante.

## Incidencias y visitas reales

Incidencia vinculada a activo confirmado, sala/proyecto y versión de activo
congelados, revisión y evidencia de entrega de contexto. Síntoma obligatorio,
tipo de atención explícito `diagnostico|reparacion|sustitucion|preventivo|null`,
prioridad `baja|normal|alta|critica|null`, técnico responsable existente opcional.
Null se muestra Sin clasificar/Sin asignar, no prioridad normal ni técnico del
hito por defecto. No inferir urgencia del texto ni asignación por nombre/usuario.

Fecha de apertura es reloj de BD. Detección real opcional se introduce como
fecha/hora Madrid con offset cuando sea necesario, nunca futura; null permanece
desconocida. Cambiar síntoma/prioridad/asignado crea versión/evento con actor.
Se asignan técnicos activos; baja posterior conserva nombre/ID histórico con
aviso y exige resolverlo antes de nueva asignación, sin borrar visitas reales.

Transiciones: Abierta→En atención (acto humano de primera atención con evidencia),
En atención→Resuelta (resultado/pruebas), Resuelta→Cerrada (evidencia y nota de
verificación). Reabrir desde Resuelta/Cerrada exige motivo y conserva resultados
anteriores; Anular exige motivo y no cuenta como reparación resuelta. No cerrar
porque una tarea04 esté hecha o un técnico tenga una visita. No borrar tickets.

Primera atención y resolución registran instante real confirmado y fecha de
registro, con precisión de minuto y sin futuro; se rechaza un orden temporal
imposible respecto a apertura/detección usada. Corregir un instante es otro
evento con motivo/diff, no UPDATE. El estado actual sigue número de versión;
los hitos temporales de SLA conservan los eventos exactos usados. Reapertura no
borra cumplimiento anterior ni inicia/reinicia otro SLA silenciosamente.

Una visita es un **registro real de servicio**, sin otra agenda de reservas.
Tiene incidente/activo/sala congelados, fecha civil real, técnico(s) por ID,
pruebas realizadas, resultado, evidencia y seguimiento recomendado. Inicio/fin
reales son pareja opcional: ambos null=horas desconocidas; presentes requieren
offset validado, precisión de minuto, fin>inicio, fin no futuro y hasta24h reales.
Una fecha sin hora no se transforma en00:00 ni en duración0. Al menos un técnico;
histórico de técnico inactivo sólo con motivo de registro atrasado, sin nueva
asignación o reactivación. Una visita no crea partes05, coste, nómina u horas
planificadas. Corregir/anular visita conserva versiones y evidencia anteriores.

Puede referenciar una tarea04 existente de la misma obra/sala, después de su ACL,
pero no modificarla ni crear tareas en plan cerrado. Un vínculo perdido/cambiado
se señala, no elimina la visita. Sin tarea04, servicio sigue siendo válido.
Evidencia mínima es descripción/referencia interna literal1..2000 y pruebas/
resultado; no descarga por URL, adjuntos binarios nuevos ni supuesto informe
firmado. Evidencia de cierre debe explicar cómo se comprobó el resultado; una
nota vacía, checkbox aislado o visita programada no acredita reparación.

## Acuerdos internos, cobertura y SLA explícitos

Acuerdo de una sala entregada, con ámbito explícito sala completa o lista de
activos08 concretos, revisión/contexto de entrega y fuente/referencia aportada.
No otro proyecto de servicio, contrato legal, garantía supuesta, cliente/CRM,
importe, proveedor externo ni aceptación de una propuesta. Cabecera conserva
identidad; cada cambio de condiciones añade versión inmutable con motivo.

Vigencia de fechas civiles Madrid `[desde,hasta_exclusivo)`. Desde puede ser
desconocido; final se expresa como `fecha|sin_fin_explicito|desconocido`, nunca
null usado a la vez para ilimitado y ausencia. Fecha final debe ser posterior a
inicio cuando ambos conocidos. Fuente y fecha de observación no sustituyen
vigencia. Cobertura enumera tipos de atención incluidos/excluidos expresamente,
con condiciones textuales y fuente. Tipo no definido, fecha desconocida o dato
necesario ausente producen No determinable, sin completar cobertura automática.

Al abrir/aplicar acuerdo a incidencia, la persona elige versión exacta; el
servidor valida ámbito/activo y calcula sobre la fecha de referencia explícita
`apertura_registrada|deteccion_confirmada`. Detección ausente con esa regla deja
cobertura/SLA desconocidos. Se congela versión/hash, entradas, resultado y
justificación en el evento de incidencia. Si hay varios acuerdos candidatos no
se elige el más favorable, el último o uno por nombre; exige selección humana.
Sin acuerdo se atiende igual, etiquetado Sin acuerdo aplicado/Cobertura desconocida.

Resultados de cobertura: Cubierta, No cubierta por ámbito/tipo/vigencia y No
determinable, con razón e inputs visibles. No cubierta no bloquea registrar
servicio; exige decisión explícita de atender fuera de cobertura y nota. Cambio
de acuerdo no reescribe incidencia/visitas anteriores. Reaplicar nueva versión
requiere preview/diff y confirmación, conservando evaluación/SLA anteriores.

SLA de primera atención y resolución son independientes y opcionales. Cada uno
requiere fuente, origen temporal y una regla explícita; ninguna cifra por defecto:

| Regla | Cálculo preciso |
|---|---|
| `minutos_reales` (1..525600) | límite = instante UTC de origen + minutos×60s. Mostrar equivalente Madrid; DST no añade ni quita tiempo real. |
| `dias_civiles` (1..366) | vence el día civil Madrid `fecha(origen)+N`, inclusive; límite exclusivo es medianoche del día siguiente. No sumar N×24h. |
| `fecha_limite` | fecha/hora Madrid concreta aportada para esa incidencia con fuente y offset confirmado; acuerdo sólo indica que debe aportarse. Si falta, plazo desconocido. |
| null | SLA no definido; límite/cumplimiento=null, no0 ni vencido. |

No calendario laboral implícito, festivos, turnos, horas hábiles, pausas o stop
de reloj por espera/proveedor. No se confunden fecha de visita y primera atención.
Una asignación no prueba respuesta. Estado observado: Sin plazo, Pendiente,
Dentro de plazo, Incumplido o No determinable, con ahora único por respuesta y
evento usado. Para instantes se cumple con actuación<=límite; para día inclusivo,
actuación<medianoche exclusiva. Abierta sin actuación se considera vencida sólo
tras límite conocido. Reapertura muestra evaluación inicial y estado actual
por separado; crear un plazo nuevo exige evento explícito/fuente, nunca reinicio
automático. No prometer notificaciones, escalado externo o ejecución de SLA.

## Persistencia aditiva propuesta; SQL no ejecutado

Registro/versiones08 común para cuatro tipos, con snapshots distintos validados
estrictamente en servidor. Evita cuatro implementaciones de CAS/historia, sin
mezclar entidades: subtablas con tipo constante fijan sus relaciones. Cabecera
guarda sólo proyección autorizable/actual; estado/identificación/condiciones se
derivan de la versión apuntada. Activo carece de cantidad física agregada.

```sql
create table if not exists servicio_registros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('activo','acuerdo','incidencia','visita')),
  sala_id uuid not null references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  numero_actual integer not null default 1 check (numero_actual>0),
  actual_id uuid not null,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(id,tipo)
);
create table if not exists servicio_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references servicio_registros(id) on delete restrict,
  numero integer not null check (numero>0),
  antecedente_id uuid unique,
  accion text not null check (length(btrim(accion)) between 1 and 80),
  version_modelo integer not null default 1 check (version_modelo=1),
  sala_id uuid not null references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  revision_diseno_id uuid references revisiones_diseno(id) on delete restrict,
  hito_entrega_id uuid, -- informativo: deliberadamente SIN FK a hitos_sala
  entrega_snapshot jsonb check (jsonb_typeof(entrega_snapshot)='object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  check ((numero=1) = (antecedente_id is null)),
  check ((hito_entrega_id is null) = (entrega_snapshot is null)),
  unique(registro_id,numero), unique(registro_id,id),
  foreign key(registro_id,antecedente_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='servicio_actual_fk'
    and conrelid='servicio_registros'::regclass) then
    alter table servicio_registros add constraint servicio_actual_fk
      foreign key(id,actual_id) references servicio_versiones(registro_id,id)
      deferrable initially deferred;
  end if;
end $$;
create table if not exists servicio_activos (
  id uuid primary key,
  tipo text not null default 'activo' check (tipo='activo'),
  sala_origen_id uuid not null references salas(id) on delete restrict,
  origen_tipo text not null check (origen_tipo in ('equipo','manual','sustitucion')),
  equipo_origen_id uuid, -- identidad de fuente, SIN FK al diseño mutable
  ordinal integer check (ordinal between 1 and 10000),
  clave_origen text not null unique,
  fuente jsonb not null check (jsonb_typeof(fuente)='object'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict,
  check ((origen_tipo='equipo' and equipo_origen_id is not null and ordinal is not null)
    or (origen_tipo<>'equipo' and equipo_origen_id is null and ordinal is null))
);
create unique index if not exists servicio_activo_unidad_origen_idx
  on servicio_activos(sala_origen_id,equipo_origen_id,ordinal)
  where origen_tipo='equipo';
create table if not exists servicio_acuerdos (
  id uuid primary key,
  tipo text not null default 'acuerdo' check (tipo='acuerdo'),
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict
);
create table if not exists servicio_incidencias (
  id uuid primary key,
  tipo text not null default 'incidencia' check (tipo='incidencia'),
  activo_id uuid not null references servicio_activos(id) on delete restrict,
  activo_version_id uuid not null,
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict,
  foreign key(activo_id,activo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
create table if not exists servicio_visitas (
  id uuid primary key,
  tipo text not null default 'visita' check (tipo='visita'),
  incidencia_id uuid not null references servicio_incidencias(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict
);
create table if not exists servicio_sustituciones (
  id uuid primary key default gen_random_uuid(),
  antiguo_id uuid not null references servicio_activos(id) on delete restrict,
  antiguo_version_id uuid not null,
  nuevo_id uuid not null references servicio_activos(id) on delete restrict,
  nuevo_version_id uuid not null,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  evidencia jsonb not null check (jsonb_typeof(evidencia)='object'),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check (antiguo_id<>nuevo_id), unique(antiguo_id,antiguo_version_id),
  foreign key(antiguo_id,antiguo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict,
  foreign key(nuevo_id,nuevo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
create table if not exists servicio_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in ('materializar','activo','acuerdo','incidencia','visita','sustituir')),
  resultado jsonb not null check (jsonb_typeof(resultado)='object'),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);
create index if not exists servicio_contexto_idx
  on servicio_registros(sala_id,tipo,id);
create index if not exists servicio_obra_idx
  on servicio_registros(proyecto_id,tipo,id);
create index if not exists servicio_historia_idx
  on servicio_versiones(registro_id,numero desc);
create or replace function servicio_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'La historia de servicio no se sobrescribe';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['servicio_versiones','servicio_activos',
    'servicio_acuerdos','servicio_incidencias','servicio_visitas',
    'servicio_sustituciones','servicio_operaciones'] loop
    execute format('drop trigger if exists servicio_inmutable on %I',tabla);
    execute format('create trigger servicio_inmutable before update or delete on %I '
      'for each row execute function servicio_inmutable()',tabla);
  end loop;
end $$;
```

JSON por tipo es contrato cerrado, no formulario arbitrario: activo guarda estado,
etiqueta/serial literal+clave, ubicación/evidencias y fuentes; acuerdo guarda
vigencia/ámbito/cobertura/fuente/SLA; incidencia síntoma/prioridad/técnico,
transición/hitos de atención, evaluación de acuerdo exacta y evidencia; visita
fecha/intervalo/técnicos/pruebas/resultado/evidencia/anulación. No dinero,
ejecutables, HTML o campos desconocidos. Hash canónico cubre envoltura de IDs,
tipo/número/antecedente/scope/actor/fecha y payload, sin su propio hash.

Antes de integrar, el coordinador añade trigger de identidad de cabecera:
no borrar ni cambiar tipo/autor/origen; sólo avanzar número/puntero una unidad y
scope exactamente derivado de esa versión. Scope de incidencia/visita/acuerdo
es inmutable; sólo traslado de activo puede cambiar su sala/proyecto actual.
Confirmar exige revisión E3 de esa sala/hash válido, hito snapshot coherente y
transición permitida. Vincular tarea/acuerdo exige entidad/tipo/scope compatibles;
UUID y JSON por sí solos no acreditan esos hechos. Resultado de operación guarda
sólo IDs/versiones/estado seguro y se autoriza de nuevo antes de reproducirlo.

Migración aditiva idempotente sin filas de negocio ni backfill masivo. Rollback
rechaza retirar esquema con historia y sólo admite tablas08 vacías. Probar en
transacción revertida conservando hashes de todas las tablas previas.

## Concurrencia, errores y límites

Mutaciones requieren versionActual/actualId por cada registro afectado,
hashes/preview cuando hay fuente y UUID `clavePeticion`. Registro, nueva versión,
CAS, relación de sustitución y operación se confirman en una transacción; lanzar
errores después de escribir para rollback, nunca resolver un error con commit.
Misma clave/hash devuelve mismo resultado tras ACL actual antes de rechazar base
avanzada; otro payload409. No-op no duplica versiones. Antecedente único impide
ramas; restaurar información es nueva corrección con motivo y validación actual.

Orden: todas las salas origen/destino por UUID → proyectos implicados por UUID →
claves normalizadas de serial ordenadas → registros08 por UUID → técnicos por
UUID → hito seleccionado cuando requiere snapshot vigente. Identificar/releer
scope tras esperar; si aparece otra sala necesaria, rollback completo y reintento
desde el principio, máximo3. No adquirir FK/lock de sala por primera vez poseyendo
proyecto ni modificar acciones físicas/E3/04 para acomodar08. Cierre de obra no
rechaza sidecar08; sólo se serializa/relee contexto, sin reabrir ni tocar hitos.

Borrado concurrente de hito: o se captura el que todavía existe y puede borrarse
después, o confirmación409; no snapshot de una entrega inexistente ni FK duradera.
Dos traslados/sustituciones del mismo activo sólo permiten uno por CAS. Lote de
origen concurrente usa unicidad y devuelve unidades ya creadas sin fabricar otras.
Después de esperar un lock se relee en READ COMMITTED; no reutilizar snapshot de
preview como prueba de vigencia. Reintentos40001/40P01 sólo tras rollback completo
y con la misma clave; agotado409 seguro con edición cliente intacta.

400 cuerpo/ID/fecha inválidos;401 sin identidad/activo;403 permiso/provisional/
ficticio/origen;404 recurso no autorizado/inexistente;409 CAS/duplicado/fuente/
entrega/conflicto;413 tamaño;422 transición/modelo/SLA incoherente;503 BD/esquema/
integridad. JSON estricto incremental64KiB, mismo origen en mutaciones,
`private,no-store`, nosniff; no SQL/stack/secretos ni200 vacío al fallar BD.
Handlers Node/params asíncronos y guías Next locales antes de escribir código.

Límites08: una sala y50 unidades por materialización;50 filas por página,
20 sugerencias;1000 versiones por registro;1MiB de snapshot;2000 caracteres por
motivo/evidencia/pruebas/resultado;30 activos por acuerdo;10 técnicos por visita;
366 días por listado;intervalos/SLA según reglas anteriores. Si excede, error y
selección menor, sin truncar para declarar inventario/cobertura completos.

## Propiedad y API futuras sin solapamiento

| Responsable | Archivos exclusivos propuestos |
|---|---|
| Ejecutor08 dominio/servicio | Nuevos `src/lib/servicio/{modelo,autorizacion,fuentes,activos,seriales,acuerdos,cobertura,sla,incidencias,visitas,repositorio,servicio,http}.ts`; pruebas `src/lib/servicio-*.test.ts`. Reusar fechas puras03/04, sin editar sus archivos. |
| Ejecutor08 UI | Nuevos `src/components/servicio-activos/{lista,materializacion,ficha,confirmacion,traslado,sustitucion,historial}.tsx` y `src/components/servicio/{incidencias,incidencia,visita,acuerdos,cobertura,sla,historial}.tsx`; páginas `src/app/salas/[id]/servicio/page.tsx`, `src/app/proyectos/[id]/servicio/page.tsx`. Sin novena pestaña de sala automática. |
| Ejecutor08 API | Árbol nuevo `src/app/api/servicio/`, handlers del cuadro siguiente; no ampliar despachadores04/06 ni acciones físicas. |
| Ejecutor08 gates | Nuevos `scripts/rea08-fixture.mts`, `scripts/verificar-rea08.mts`, `scripts/verificar-rea08-concurrencia.mts`, `e2e-gate/rea08.config.ts`, `e2e-gate/rea08.spec.mts`; evidencia `output/rea-integracion/rea08/`. |
| Coordinador | `db/schema.sql`, migración nueva `db/migraciones/2026-10-rea08-servicio.sql`, rollback homónimo, trigger de identidad/cabecera, enlaces de sala/proyecto, integración con menú/panel y continuidad17/18/26. Cualquier extracto común se integra secuencialmente. |

| API dentro de `/api/servicio/` | Operación |
|---|---|
| `activos` | GET por sala/obra con ACL; POST candidato manual explícito. |
| `activos/preparar` y `activos/materializar` | POST preview de selección y confirmación idempotente por IDs/ordinales. |
| `activos/[id]` y `activos/[id]/historial` | GET proyección/historia autorizada; POST comando08 con CAS. |
| `activos/[id]/confirmar`, `/trasladar` | POST preview/confirmación con fuente/entrega/hash y CAS; no escritura física. |
| `sustituciones/preparar` y `sustituciones` | POST diff viejo/nuevo y confirmación atómica de sidecars. |
| `incidencias` y `incidencias/[id]` | GET/POST apertura; GET/POST transición/asignación/corrección/reapertura con CAS. |
| `incidencias/[id]/acuerdo` | POST preview/aplicación explícita de versión y evaluación congelada. |
| `incidencias/[id]/visitas` y `visitas/[id]` | GET/POST visita real; GET/POST corregir/anular con CAS. |
| `acuerdos` y `acuerdos/[id]` | GET/POST alta y nueva versión/archivo lógico; no borrado de historia. |

Cada endpoint guarda su propia frontera de sesión/ACL/errores. Parámetro
`fase=preparar|confirmar` se valida como unión estricta cuando comparten ruta;
preview no escribe. Confirmación no acepta payload de snapshot ni datos de
fuente del navegador. GET no materializa entidades, visita ni origen implícito.

UI completa de escritorio: selección de unidades→fuentes→confirmación física→
incidencia→acuerdo/SLA opcional→visita real→prueba/cierre; luego móvil. Formularios
mantienen edición ante400/403/409/red, abortan observación al cambiar selección
y rechazan respuesta tardía por generación/ID/versión. Revocación RSC durante GET
pendiente retira contenido y no lo repone al llegar la respuesta. Conflicto ofrece
recargar/comparar, sin sobrescritura ni spinner perpetuo. MASTER, sin emojis,
etiquetas/foco/teclado/errores accesibles. Desconocidos y fuente modificada visibles.

## Gates Dado / Cuando / Entonces

Base sintética nueva08 nombrada y verificada por coordinador; sin `.env.local`,
inventario/producción o reutilización de bases anteriores. Fixture: sala legado,
obra abierta/cerrada, equipoA cantidad3, equipoB cantidad1, dos revisiones E3,
entrega existente con técnico, otra sala sin entrega, serial repetido, técnicos
activo/inactivo y usuarios salas/obras/lectura/sin catálogo/provisional.

1. **Unidades elegidas.** Dado equipoA×3, cuando preview elige ordinales1y3,
   entonces cero escrituras; confirmar crea dos UUID previstos sin cantidad.
   Repetir/otra revisión con los mismos IDs no crea más; aumentar cantidad sólo
   ofrece ordinales nuevos. Reducir/borrar fuente no borra activos.
2. **Sin instalación inferida.** Dados equipos dibujados, coordenadas confirmadas,
   recepción/carga, tarea hecha o sólo hito instalación, cuando materializa,
   entonces siguen previstos. Confirmar sin entrega/E3/evidencia falla sin escribir.
3. **Confirmación real.** Dadas entrega de esa sala y E3 seleccionada, cuando
   confirma una unidad identificada, entonces guarda contexto/snapshots/hashes,
   autor y fecha; no confirma las otras unidades ni cambia hito/diseño/stock.
4. **Corrección de hito.** Dado activo confirmado, cuando flujo físico borra su
   entrega y registra otra, entonces no hay FK08 que lo bloquee, historia08 queda
   idéntica y lectura marca ausente/modificada. Reconciliar exige diff/confirmación,
   no remapear por fecha. Servicio posterior conserva el aviso y fuente histórica.
5. **Carrera con entrega.** Dadas dos conexiones08/borrado físico, cuando compiten
   con barrera, entonces captura entrega existente antes del borrado o409; nunca
   confirma con chequeo viejo ni impide borrar después del commit08.
6. **Seriales.** Dados null, vacío, literal con mayúsculas/acentos y posible
   duplicado, cuando registra/corrige, entonces preserva literal/null, detecta
   coincidencias sin unir activos. Dos previews libres concurrentes serializan;
   la segunda revisión409 exige hash/motivo y no revela contexto sin permiso.
7. **Traslado.** Dado activo confirmado enA, cuando traslada aB con revisión/
   entrega/evidencia propias, entonces mismo UUID y nueva localización08; ticket
   antiguo sigue enA y todo diseño físico idéntico. B sin entrega no se confirma.
8. **Sustitución.** Dados viejo/nuevo de una unidad cada uno, cuando confirma,
   entonces relación/versiones atómicas y viejo Sustituido, nuevo confirmado con
   su serial. Mismo UUID, dos sustituciones concurrentes o nuevo inválido fallan;
   no mueve almacén ni arrastra cobertura/serial del anterior.
9. **Obra cerrada.** Dada obra cerrada y sala entregada, cuando crea sidecars08,
   incidencia/visita/acuerdo o confirma fuente válida, entonces funciona con ACL
   y conserva cierre/plan/E3/hitos/estructura. No exige reabrir la obra.
10. **Permisos mínimos.** Dados usuario sólo salas y otro sin catálogo, cuando
    consulta operativo, entonces no proyecto privado, catálogo, precio, salarios,
    proveedor, snapshot E1/E3 completo ni SELECT financiero. La ruta por obra y
    cambio de ámbito exigen proyectos; retirar ACL corta siguiente GET/POST/history.
11. **Identidades.** Dado usuario autor distinto al técnico y técnico luego
    inactivo, cuando asigna/registra visita, entonces autoría real y recurso
    separados; sin enlace supuesto por nombre. Nueva asignación inactiva rechazada,
    histórico conservado y registro real atrasado exige motivo.
12. **Incidencia.** Dada instalación confirmada, cuando abre con prioridad/tipo
    null y sin acuerdo, entonces muestra desconocidos, no cobertura/plazo0.
    Rechaza cierre sin pruebas/evidencia; resolver/cerrar/reabrir conserva versiones
    y no modifica entrega/tarea04 ni genera tiempos05.
13. **Visita real.** Dada fecha sin horas, cuando registra pruebas/resultado,
    entonces horas/duración=null. Intervalo medido válido conserva UTC/offset;
    futuro, fin<=inicio, pareja incompleta y>24h fallan. Anular/corregir no borra
    evidencia anterior ni crea reservas de agenda, trabajo o coste laboral.
14. **Vigencia/cobertura.** Dadas fecha final exclusiva, sin fin explícito, inicio
    desconocido, activo excluido y tipo no clasificado, cuando aplica acuerdo,
    entonces calcula cubierta/no cubierta/no determinable con entradas visibles.
    Atiende fuera de cobertura sólo con elección/nota; varios candidatos exigen ID.
15. **Historia de acuerdo.** Dado acuerdo aplicado a ticket/visita, cuando cambia
    cobertura o SLA, entonces evaluaciones previas conservan versión/hash/plazos.
    Reaplicar exige preview/diff y otro evento; nunca cambia condiciones pasadas.
16. **SLA real y civil.** Dadas horas ambiguas/inexistentes Madrid, cuando valida,
    entonces exige offset/rechaza gap.60min reales cruzando DST duran60min;
    un día civil vence al final del siguiente día elegido, no+24h. Fecha límite
    vacía no es1970; null produce No definido, sin incumplimiento inventado.
17. **Acto de atención.** Dadas asignación y visita posterior sin evento de primera
    atención, cuando evalúa SLA, entonces no infiere respuesta de ninguna de ellas.
    Evento con evidencia usa instante confirmado, reabrir no borra cumplimiento
    inicial ni reinicia reloj; sin calendario no descuenta noches/festivos.
18. **CAS/idempotencia.** Dadas dos conexiones que corrigen/cerran el mismo ticket,
    cuando confirman misma base, entonces una gana y otra409 sin rama. Misma clave/
    payload devuelve mismos IDs; otra carga409; fallo inyectado revierte lote08
    entero. Probar también origen/serial/traslado/sustitución con barreras reales.
19. **Conservación.** Dadas fotos/hash completas antes, cuando recorre08 y reinicia,
    entonces sólo sidecars08 cambian: stock/movimientos/reservas/pedidos/carga,
    hitos, salas/equipos, revisiones/plan/propuestas, CSV y costes quedan iguales.
    UPDATE/DELETE histórico08 falla. Rollback vacío/rechazo con historia se prueba
    sin cambios persistidos ni pérdida de evidencia física.
20. **Flujo y fallos reales.** Dado escritorio y roles de fixture, cuando recorre
    selección/confirmación/serial/traslado/reemplazo/ticket/acuerdo/visita/cierre
    con400/403/409/red y retiradaRSC durante respuesta pendiente, entonces conserva
    formulario correcto y no repone datos retirados. Sólo después móvil, teclado,
    foco, textos largos y evidencias; inspeccionar HTML/RSC por privacidad.

Guardar comandos/logs crudos, fotos de todas las tablas previas, IDs/snapshots/
hashes, spies SQL, carreras de dos conexiones, capturas escritorio/móvil y repros
de fallos en `output/rea-integracion/rea08/`. Pruebas puras de estados/SLA/seriales,
SQL/HTTP reales, UI/RSC, tipos/lint/build sin BD y regresiones de fronteras físicas
según integración. Revisión independiente contra escenarios y fuentes, no cierre
por informe del autor. Diferenciar código local, SQL sintético, comportamiento
observado, políticas aportadas y capacidades aún pendientes.

## Decisiones del coordinador y condiciones de ejecución

1. Aprobadas la asociación humana E3↔entrega y la política de candidato manual no
   representado en diseño; sin revisión identificada permanece pendiente. El
   vínculo conserva snapshot/hash y no añade FK al hito físico borrable.
2. Pendiente integrar trigger de identidad/versiones y frontera sala→proyecto→08→técnico→
   hito contra las acciones físicas actuales; demostrar carrera/borrado sin FK.
3. Aprobada la entrada desde Documentos/Resumen de sala y portada de proyecto,
   sin novena pestaña de sala. Raíz integra los enlaces tras congelar producto;
   cualquier vínculo futuro con tareas04 es lectura, sin escritura04 implícita.
4. Las reglas de prioridad, cobertura y SLA son datos explícitos de acuerdos;
   esta spec no aporta condiciones reales del departamento. Fixture las nombra
   como sintéticas y producción sigue sin condiciones hasta introducirlas.

Partición posterior:08A registro/materialización/confirmación y seriales;
08B traslado/sustitución;08C incidencias/visitas;08D acuerdos/cobertura/SLA;
08E integración/gates/revisión independiente. Cada unidad conserva sus fuentes
y prueba no mutación física. No marcar ST24/ST26/AVX-05 como implementados por
este contrato ni iniciar producto sin asignación expresa del coordinador.


## Preparación SQL de raíz, todavía sin runtime08

Migración/rollback en `db/migraciones/2026-10-rea08-servicio.sql` y homónimo de
rollback; fixture guardada `scripts/rea08-fixture.mts`. Nueva base aislada
5561/av_design_rea08_prueba/av_design_rea08:90tablas base y98tras8nuevas.
Aplicación/reaplicación/rollbackvacío preservan las90anteriores. Triggers de
identidad/versiones, unicidad de ordinal, traslado y guardrollbackconhistoria
pasan dentrode transacción revertida. Borrar un hito físico no borra ni bloquea
su snapshot08; ningún dato adversario de ese gate persiste. Evidencia
`output/rea-integracion/rea08/preparacion/esquema-resultados.json`.
No se añadió aún08a `db/schema.sql`, para respetar el corte compartido que revisa
05tiempos. No servicio/UI/SLA/ACL de aplicación08 implementados ni aceptados.

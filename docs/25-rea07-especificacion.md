# REA-07 · Eventos internos de propuesta y métricas trazables

15-10-2026. **Contrato aprobado por el coordinador para seguimiento y embudo;
ejecución condicionada a06 verificada. No implementación, migración aplicada
ni aceptación.** Resultados financieros07B esperan runtime05 y su adaptador
verificado. Desarrolla ST29/ST30/ST33 de
`18-rea-cobertura.md` y depende de los contratos íntegros
`23-rea05-especificacion.md` y `24-rea06-especificacion.md`. Único destino:
AV_design, rama `codex/rea-integracion`. No reconstruye investigación Xtenav.

Esta preparación sólo añade este documento. El coordinador asigna propiedad
antes de construir. Se conservan todo el WIP y las evidencias.
Sin commit, push, merge, despliegue, producción, envío, cobro ni firma contractual.

## Resultado y base comprobada

Una persona autorizada registra emisión interna, aceptación o rechazo de una
**revisión concreta**. El estado se deriva de esas operaciones; una propuesta
con otra revisión empieza de nuevo. El embudo cuenta propuestas únicas de una
cohorte explícita, enlaza al mismo conjunto y separa monedas, subtotales y huecos.
Una capacidad financiera adicional compara importe aprobado con costes registrados
REA05 compatibles, sin afirmar ingresos cobrados ni beneficio total de obra.

| Fuente comprobada en el checkout | Consecuencia de este contrato |
|---|---|
| REA06 guarda revisión, valoración opcional, PDF y `propuesta_operaciones` en la misma transacción. El tipo `revision` también se inserta en un guardado sin cambio. | Publicación es la operación registrada; varias operaciones sobre una revisión no son varias propuestas ni revisiones. |
| `propuesta_revisiones.creado_en` viene del modelo preparado en preview; `propuesta_operaciones.creado_en` usa el reloj de BD. | La fecha de cohorte sale de la primera operación `revision`, nunca de preview, fecha del PDF o cabecera. Es fecha registrada de publicación, no timestamp certificado de commit o entrega. |
| `propuestas.actual_revision_id`, versión y archivo pertenecen a REA06; sus revisiones y PDF son inmutables. | El seguimiento añade sidecars, conserva número/hash exactos y no cambia el PDF ni el contador de revisión06. |
| REA06 puede retirar valoración en una revisión nueva; la cabecera valorada y las revisiones históricas valoradas tienen guardas de compras. | Aplicar la misma ACL antes de leer eventos, contar propuestas o acceder a importes. Una revisión técnica nueva no abre un histórico monetario. |
| `propuesta_valoraciones` distingue base, impuesto, total y coste previsto, con estados y monedas. | El embudo monetario usa base sin impuestos como medida principal y conserva medidas/cobertura independientes. No usa coste previsto como venta. |
| REA05 tiene contrato/tablas, pero al corte leído sólo existe `src/lib/tiempos/fechas.ts` y no su servicio de horas/costes. | No atribuir runtime05 a su SQL. El resultado económico exige adaptador05 verificado; mientras falta se muestra capacidad pendiente, sin SELECT financiero improvisado ni cifras de prueba. |
| REA05 exige admin + usuarios:editar para costes laborales y declara que completo sólo cubre registros seleccionados. | Compras no abre horas/tarifas/costes. Una comparación07 no eleva ese subconjunto a coste total real ni beneficio global. |
| Estados físicos salen de hitos y existencias de movimientos. | Ningún evento07 crea tarea, instalación, entrega, movimiento, pedido, pago o ingreso. |

## Identidad y permisos antes de consultar

Usuario real, activo y con contraseña definitiva en cada petición. Releer roles y
excepciones actuales en servidor; no aceptar autor, rol, permisos o estado desde
el cuerpo. Usuario ficticio no consulta ni escribe esta capacidad. No se añaden
roles, secciones ni una autorización persistente en cookie/token.

| Capacidad | Requisitos actuales |
|---|---|
| Leer seguimiento técnico de sala | salas:ver y todas las condiciones de lectura de propuesta/revisión06. |
| Leer seguimiento técnico de obra | proyectos:ver + salas:ver y las condiciones06. |
| Emitir/aceptar/rechazar/revocar decisión | Edición técnica06 del ámbito; compras:editar si la cabecera actual o revisión tratada contiene valoración. Lectura de sus fuentes cuando lo exige06. |
| Contar/listar estados | Mismo universo autorizado que el detalle06, filtrado en SQL antes de snapshots/eventos. No contar una propuesta que ese usuario no puede abrir. |
| Importe por estado/aprobado | Lo anterior + compras:ver; catálogo:ver cuando el documento o su valoración lo exige06. Lectores separados de los técnicos. |
| Comparación con costes05 y su histórico | Rol admin + usuarios:editar + proyectos:ver + salas:ver + compras:ver; demás permisos reales del corte05: almacen/catalogo y, si contiene esas evidencias, compras/carga/parámetros. Comprobar antes de cualquier tabla financiera. |
| Preparar/guardar resultado financiero07 | Política financiera anterior + edición técnica del ámbito + compras:editar. Sólo sidecars07; no autoriza modificar hechos o valoraciones05. |

El lector operativo proyecta identidad, revisión, publicación y eventos técnicos.
No consulta `propuesta_valoraciones`, tiempos, tarifas, costes, cortes ni sus
conteos para después ocultarlos. Los eventos no contienen importes, moneda,
precio/hora, destinatario completo ni snapshots de diseño. Una respuesta técnica
no incluye campos financieros nulos, payloads ocultos, enlaces privados o conteos
de tarifas ausentes. La referencia textual del evento es dato del documento y
queda bajo su misma ACL; la UI indica no introducir información salarial ahí.

Para filtrar catálogo/valoración se puede usar la proyección mínima de metadatos
que06 ya autoriza; no importar su lector completo ni leer precios. Revocar acceso
afecta al siguiente GET, drilldown, reintento, evento, resultado y PDF. Una tarjeta
oculta no dispara su consulta. El token de conjunto no conserva permisos.

La integración SQL de raíz añade `propuesta_revision_visibilidad`, sidecar mínimo
`revision_id/requiere_catalogo`, derivado al
insertar una valoración06 y rellenado por la migración con la misma regla de
origenCoste catálogo de06. No conserva importes y es inmutable. El lector técnico
lo usa junto al tipo de fuente y `contiene_valoracion`, sin SELECT de
`propuesta_valoraciones`. Valorada sin metadato es503; nunca suponerfalse.
La consulta monetaria explícita conserva sus ACL antes de leer valoraciones.
La migración07/rollback, trigger de flujo y sidecar se verificaron sólo en nueva
5560:87tablas(82previas+5), rollbackvacío/reaplicación/preservación verdes;
la prueba de inmutabilidad/guardhistoria ocurre en transacción revertida.
`db/schema.sql` los incluye; no se han aplicado en ninguna base anterior.

## Publicación, revisión y eventos internos

Definiciones deterministas:

- `publicada_revision_en`: mínimo `creado_en` de operaciones06 `tipo='revision'`
  con los mismos propuesta_id/revision_id; desempate por id sólo para ordenar.
- `primera_publicacion_en`: mínimo de esas publicaciones por propuesta_id.
  `archivar`/`reactivar`, reintentos y guardados sin cambio no desplazan la fecha.
- Una revisión sin operación06 correspondiente se considera inconsistencia de
  publicación: 503 seguro, sin inventar fecha ni incorporarla a métricas.
- Preview, render fallido, formulario sin guardar y borrador local no pertenecen
  al conjunto persistido. El estado Borrador del embudo significa documento06
  publicado internamente que aún no tiene emisión interna registrada.

El historial presenta publicación06 como hecho de origen y después eventos07.
No hay backfill que fabrique eventos de envío/visto/aceptación al migrar. Crear o
reabrir la página no escribe seguimiento. Para revisiones anteriores a07, cero
eventos significa Borrador; la publicación previa sigue siendo su operación06.

| Evento07 | Precondición y estado resultante |
|---|---|
| `emitir` | Revisión actual publicada, sin eventos previos: Borrador → Emitida internamente. Confirma disponibilidad para revisión dentro de la app, sin transporte externo. |
| `aceptar` | Emitida internamente → Aceptada internamente. Actor y referencia/motivo obligatorios. Se acepta el documento exacto, incluso técnico o parcial; no se completan sus importes. |
| `rechazar` | Emitida internamente → Rechazada internamente. Motivo obligatorio. |
| `revocar_decision` | Aceptada/Rechazada → Emitida internamente; referencia al último evento de decisión y motivo obligatorio. Conserva íntegra la decisión anterior. |

No hay transición directa aceptada→rechazada ni sobrescritura/borrado del evento.
Para corregir decisión se revoca y registra la nueva. Emitir dos veces, aceptar
antes de emitir o revocar otra decisión falla409. Un motivo puede corregirse
mediante revocación/nueva decisión; no hay editor del histórico. Retirar una
emisión y registrar hechos comerciales retroactivos quedan fuera de este mínimo.

`creado_en` del evento lo fija BD al registrar; no se permite fecha efectiva
retroactiva ni futura que reescriba métricas pasadas. Actor es usuario autenticado,
con nombre snapshot y motivo/referencia literal. No afirma que el destinatario
haya firmado o visto nada. No existe estado Enviada, Vista, Cobrada o Pagada;
visitar/descargar PDF no registra visualización del receptor.

Las mutaciones ordinarias requieren revisión actual, propuesta no archivada y
ámbito físico abierto conforme a06. En obra cerrada el seguimiento es consulta;
no se elude con sidecars para reabrir documentos. Archivo es filtro documental06,
no rechazo ni decisión. Reactivar no borra/crea decisiones. Una revisión nueva
mantiene histórico, pero su estado empieza Borrador y no hereda aceptación,
emisión, rechazo, importe aprobado ni comparación07. Aceptación técnica y fuente
desactualizada se muestran como dimensiones distintas; aceptar no actualiza fuente.

## Concurrencia e idempotencia

Cada revisión tiene un flujo07 con versión y último evento. El cliente envía
propuestaId, revisionId/hash, versionPropuesta06, versionSeguimiento07,
ultimoEventoId, comando, motivo/referencia y `clavePeticion` UUID. No manda
estado resultante ni dinero. Servidor deriva transición y todos los IDs/fechas.

Transacción corta: autorizar con metadatos mínimos; tomar las salas originales
por UUID → proyecto cuando procede → propuesta → seguimiento07; releer después
de esperar revisión/hash/archivo/cierre/ACL; insertar evento, avanzar flujo por
CAS y registrar operación idempotente. No render ni llamadas externas con locks.
El coordinador integra la frontera exacta con06/cierre; el ejecutor07 no cambia
su aislamiento ni acciones. No adquirir por primera vez FK/lock de sala después
de poseer proyecto/propuesta. No cambiar `propuestas.version` por un evento07.

Una nueva revisión06 y una decisión07 compiten por la propuesta. Si gana06,
la decisión sobre base antigua falla409. Si gana07, la decisión queda en la
revisión anterior y la posterior nace Borrador. Dos decisiones sobre la misma
base permiten una sola rama; `numero` y antecedente único respaldan el CAS.
Una propuesta sin flujo07 lo crea dentro de esa misma transacción, sin escritura
en un GET. Fallo posterior se lanza para rollback total.

Idempotencia por autor/clave para todas las mutaciones07: misma clave/hash devuelve
los mismos IDs después de ACL actual y antes de rechazar una base ya avanzada.
Otro payload409. Nunca reproducir dinero sin capacidad financiera actual. Claves
07 viven en tabla propia y no modifican ni colisionan con operaciones06/05.

## Cohorte, estado observado y detalle del embudo

La cohorte se define por **primera publicación** en un rango civil inclusivo de
Europe/Madrid, convertido a `[inicioUtc,finUtcExclusivo)` con los helpers03/04.
Filtros explícitos: ámbito sala/obra o selección autorizada, archivo
`activas|archivadas|todas` (defecto todas) y fecha de observación UTC. No filtrar
por fecha de aceptación y llamarlo la misma tasa. Grupo de destinatario es texto,
no ACL; este mínimo no introduce filtro de grupo/CRM.

Por cada propuesta de la cohorte se elige **una** revisión: la de mayor número
que tenga publicación registrada no posterior al corte de observación. Para esa
revisión se deriva el estado de sus eventos07 hasta ese corte, por número, no
por llegada de respuestas ni orden alfabético. Otra revisión aceptada histórica
no convierte en aceptada la actual. Archivo se evalúa desde operaciones06 al
corte, sin confundir la fecha actual de cabecera con el estado histórico; si el
histórico no permite resolverlo se rechaza ese corte, no se adivina.

Una sola lectura REPEATABLE READ READ ONLY resuelve identidad/ACL, conjunto,
revisiones, publicaciones, eventos y métricas autorizadas. Conteos, importes y
lista usan el mismo manifiesto de tuplas `(propuestaId,revisionId,revisionHash,
publicacionOperacionId,ultimoEventoId,numeroEvento,archivoAlCorte)`. No joins que
multipliquen propuestas por sus revisiones, líneas, salas o eventos.

Cada respuesta devuelve rango, corte, filtros canónicos, denominador, conteos,
primera página y un token firmado de conjunto de10min: versión de modelo,
usuario, filtros/corte y SHA del manifiesto completo ordenado. El detalle y las
páginas recomputan bajo ACL actual y verifican ese SHA antes de devolver éxito.
Si cambió el conjunto autorizado o llegó una operación concurrente cuyo timestamp
registrado cae antes del corte,409 pide actualizar tarjeta/lista conjuntamente;
no devuelve otra lista como si explicase el número anterior. Permiso retirado403.
El token no incluye documentos/importes ni habilita acceso durable.

Los cuatro estados forman una partición: suma de sus conteos = propuestas únicas
del manifiesto. Un filtro de etapa sólo selecciona miembros de ese manifiesto y
no cambia silenciosamente el denominador de la tasa. Paginación50 con cursor
estable; total independiente del tamaño de página. No truncar conjuntos grandes
para mostrar cobertura completa. Toda tarjeta enlaza a filtros+corte+token de su
detalle, incluidos rango, archivo y estado. Falta de BD no devuelve cero.

## Importes por estado y ratio de aceptación

El agregado principal se etiqueta **Base propuesta sin impuestos por estado**.
Por cada moneda usa la baseMinor de la revisión única elegida del manifiesto;
impuesto y bruto son medidas separadas con sus estados. Una parcial aporta sólo
su subtotal conocido identificado como tal; no convierte ausentes en0. Una
propuesta técnica sin valoración sigue en el conteo y aparece sin importe.

Por etapa/moneda/medida se devuelven subtotal conocido string|null, número de
propuestas incluidas, con valor completo/parcial/sin datos, líneas sin dato y
orientativas de fuente. Distinguir propuestas con varias monedas. Un coste
previsto orientativo no hace desconocido un precio directo documentado, pero
conserva su advertencia; no se elimina esa calidad del detalle. Suma vacía=null;
cero explícito conocido=\"0\" en unidades menores con su procedencia.

Sólo EUR y USD, separadas; sin conversión ni tipo de cambio implícito. Reusar
`src/lib/importes.ts`, BigInt y strings canónicas. No Number/parseFloat para
dinero, nuevo cálculo de precio, impuesto agregado o redondeo distinto de06.
El agregado concuerda con sus importes congelados por línea/revisión.

La métrica se llama **Aceptación interna sobre propuestas publicadas**:

- Denominador: propuestas únicas autorizadas de la cohorte de primera publicación,
  incluidos Borrador, Emitida, Aceptada y Rechazada al corte y filtro de archivo.
- Numerador: las de ese mismo conjunto cuya revisión elegida está Aceptada
  internamente al corte. Cada propuesta aporta como máximo1; aceptación antigua
  o revocada no cuenta. Propuesta sin valoración puede contar como aprobación
  técnica; no genera importe aprobado conocido.
- Porcentaje: `100 × numerador / denominador`, HALF_UP a2 decimales mediante
  enteros; devolver fracción exacta y texto. `0/0` → null/Sin datos; `0/3` →0,00%.
  No usar importe como peso ni cambiar denominador a sólo decisiones conocidas.
- Comparación de períodos: ambas cohortes/rangos y mismo corte observados,
  fracciones visibles; diferencia en puntos porcentuales sólo con dos tasas
  definidas. Un período sin propuestas no se convierte en0% ni en crecimiento.

Esta tasa describe decisiones registradas, no eficacia comercial probada ni
aceptación contractual. La edad diferente de las cohortes y las revisiones aún
sin decisión quedan visibles. Nuevas revisiones pueden bajar la tasa de una
cohorte al volver a Borrador; no se mantiene una aceptación heredada para evitarlo.

## Resultado sobre importe aprobado y costes registrados05

No se obtiene beneficio de la BOM, pedidos, costes previstos06, tareas planificadas
o ausencia de tiempos. La aprobación referencia evento `aceptar` vigente de una
revisión y su hash. Como06 es inmutable, esa referencia congela exactamente su
valoración; el evento técnico no duplica importes. Base aprobada, impuesto y bruto
permanecen independientes. La medida comparable usa **base sin impuestos**.

El adaptador financiero07 consume **un** corte05 `tipo='real'` existente e íntegro
y sus metadatos de cobertura; nunca crea/revalora horas/material al consultar.
No sumar cortes05 superpuestos ni tomar el último por nombre. La persona elige
ID y revisa explícitamente alcance, versiones, moneda, fecha y huecos en preview.
Sin runtime/lector05 verificado responde503/capacidad pendiente; no construir un
lector alternativo ad hoc que dé por reales las tablas sembradas.

Compatibilidad comprobada en servidor, sin inferencia por textos:

1. Proyecto y lista de salas exactos de la fuente aprobada. Sala legado sin obra
   mantiene su validez, pero no tiene coste05 de obra comparable hasta resolver
   ese ámbito explícitamente fuera de07; no se adopta automáticamente.
2. Tareas/partes/apuntes y período explícitos del corte. Un corte de toda la obra
   no se reparte proporcionalmente entre propuestas de sala; una selección de
   tareas o de días menor que el alcance aprobado se etiqueta parcial.
3. Laboral y material incluidos por separado; todos los registros05 del alcance
   declarado al corte deben quedar enumerados o pendientes. No declarar completo
   suprimiendo el componente que no tiene datos o excluyendo partes sin tarifa.
4. Valoraciones vigentes y documentadas, con versiones exactas de tiempo, tarifas,
   apuntes, fuentes/linajes y hashes que05 declara. Datos corregidos/anulados o
   fuentes desaparecidas no pasan como vigentes. No reconstruir coste histórico
   por jerarquía, precio de catálogo o motivo de un movimiento.
5. Misma moneda y unidad de comparación; importe05 registrado sin impuestos con
   esa base expresamente documentada. Si05 no acredita tratamiento fiscal de una
   fuente, incompatible/parcial: no comparar neto con bruto ni restar un impuesto
   supuesto. La nueva propiedad de metadatos requiere acuerdo con propietario05.

El preview muestra base aprobada, subtotal laboral/material, cobertura y causas
de incomparabilidad. Guardar crea un corte07 inmutable con aceptación/revisión,
ID/hash/snapshot mínimo del corte05, alcance, fecha observada, declaración literal
de revisión de cobertura por el actor y resultados por moneda. No edita05.
Nueva consulta conserva el antiguo; cambio posterior de decisión/fuente/coste
lo marca histórico/desactualizado y exige otro corte, sin recalcularlo en silencio.

| Estado07 | Presentación |
|---|---|
| Sin datos | Sin aprobación monetaria/base conocida o sin costes conocidos. Importes ausentes=null y diferencia=null. |
| Parcial | Subtotales separados con faltantes, alcance/moneda/fiscalidad incompatible, fuente obsoleta o componente no registrado. Diferencia=null; no saldo calculado con el coste parcial como si fuera total. |
| Comparable sobre registros conciliados | Base aprobada completa por moneda y registros05 del mismo alcance declarado completos/coherentes, ambos componentes revisados y sin exclusiones ocultas. Permite `base_aprobada_minor − coste_registrado_minor`, con alcance/denominadores visibles. |

La etiqueta numérica es **Diferencia entre base aprobada y costes registrados**,
nunca Beneficio real/total, Ingreso o Cobrado. Comparable sólo acredita los
registros y la revisión de cobertura indicados; no prueba horas/material que nadie
haya registrado ni cubre estructura, financiación u otros costes ausentes. Por
ello07 no publica beneficio global de obra ni suma diferencias de varias
propuestas sobre el mismo coste. No existe tarjeta global de beneficio ni ratio
de margen sobre costes parciales. Comparar períodos no sustituye ausencia por0.

## SQL aditivo propuesto; no ejecutar en esta entrega

Tablas nuevas, sin alterar estados físicos ni tablas06/05. FK restringida y
validación cruzada en servidor; el coordinador integra schema/migración/rollback
tras aprobación. JSON financieros guarda dinero como strings y modelo validado.

```sql
create table if not exists propuesta_seguimientos (
  revision_id uuid primary key references propuesta_revisiones(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  ultimo_evento_id uuid,
  check ((version=0) = (ultimo_evento_id is null))
);
create table if not exists propuesta_eventos (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null,
  revision_id uuid not null,
  revision_sha256 text not null check (revision_sha256 ~ '^[0-9a-f]{64}$'),
  numero integer not null check (numero > 0),
  antecedente_id uuid unique,
  tipo text not null check (tipo in ('emitir','aceptar','rechazar','revocar_decision')),
  decision_revocada_id uuid,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  referencia text not null check (length(btrim(referencia)) between 1 and 1000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null check (length(btrim(autor_nombre)) between 1 and 200),
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  unique(revision_id,numero), unique(revision_id,id),
  foreign key(revision_id,antecedente_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  foreign key(revision_id,decision_revocada_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  check ((numero=1) = (antecedente_id is null)),
  check ((tipo='revocar_decision') = (decision_revocada_id is not null))
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='propuesta_seguimiento_actual_fk'
    and conrelid='propuesta_seguimientos'::regclass) then
    alter table propuesta_seguimientos add constraint propuesta_seguimiento_actual_fk
      foreign key(revision_id,ultimo_evento_id)
      references propuesta_eventos(revision_id,id) deferrable initially deferred;
  end if;
end $$;
create index if not exists propuesta_eventos_historia_idx
  on propuesta_eventos(propuesta_id,revision_id,numero);
create index if not exists propuesta_eventos_fecha_idx
  on propuesta_eventos(creado_en,id);

create table if not exists propuesta_resultado_cortes (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references propuesta_resultado_cortes(id) on delete restrict,
  propuesta_id uuid not null,
  revision_id uuid not null,
  aceptacion_id uuid not null,
  coste_corte_id uuid not null references coste_cortes(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo=1),
  alcance jsonb not null check (jsonb_typeof(alcance)='object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('sin_datos','parcial','comparable_registrado')),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  foreign key(revision_id,aceptacion_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  check ((numero=1) = (antecedente_id is null)),
  unique(serie_id,numero)
);
create table if not exists propuesta_seguimiento_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  propuesta_id uuid not null,
  revision_id uuid not null,
  tipo text not null check (tipo in ('evento','resultado')),
  evento_id uuid references propuesta_eventos(id) on delete restrict,
  resultado_id uuid references propuesta_resultado_cortes(id) on delete restrict,
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  check ((tipo='evento' and evento_id is not null and resultado_id is null) or
    (tipo='resultado' and resultado_id is not null and evento_id is null)),
  unique(autor_id,clave_peticion)
);
create index if not exists propuesta_resultados_historia_idx
  on propuesta_resultado_cortes(propuesta_id,revision_id,creado_en,id);

create or replace function rea07_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El historial REA07 no se sobrescribe';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['propuesta_eventos','propuesta_resultado_cortes',
    'propuesta_seguimiento_operaciones'] loop
    execute format('drop trigger if exists rea07_inmutable on %I',tabla);
    execute format('create trigger rea07_inmutable before update or delete on %I '
      'for each row execute function rea07_inmutable()',tabla);
  end loop;
end $$;
```

El coordinador añade al integrar un trigger de identidad07: el flujo sólo avanza
`version/ultimo_evento_id` exactamente una unidad y no se borra; el evento apuntado
debe ser de esa revisión/número. Servidor verifica transición, hash06, antecedente
inmediato, decisión revocada exacta y actor. Corte07 exige evento aceptar vigente,
corte05 real íntegro y serie/antecedente de la misma propuesta; una FK UUID sola
no demuestra esos hechos. Operación debe referenciar evento/corte del mismo
propuesta/revisión/autor. Resultado financiero no se carga por leer operaciones.

La migración es idempotente y sin fabricar filas/eventos históricos. Rollback
rechaza retirar tablas con historia; sólo revierte esquema vacío, dentro de
transacción. Gate de integración verifica aplicación repetida y hashes completos
antes/después de rollback revertido, sobre base sintética nueva de07.

## API, UI, límites y propiedad futura

Rutas nuevas en árbol propio; no ampliar el despachador HTTP06 en paralelo:

| Ruta propuesta | Contrato |
|---|---|
| `/api/seguimiento-propuestas/[id]` | GET resumen/historia técnica de revisión autorizada; POST comando con CAS/clave. |
| `/api/seguimiento-propuestas/embudo` | GET cohorte/estados/tasa/lista con token; importes sólo mediante opción explícita y lector monetario autorizado. |
| `/api/seguimiento-propuestas/embudo/detalle` | GET mismos filtros/corte/token, etapa y cursor; identidad actual, manifiesto idéntico o409. |
| `/api/resultados-propuestas/preparar` | POST preview financiero de aceptación y corte05 existentes, hashes/cobertura; sin escrituras. |
| `/api/resultados-propuestas` | POST corte07 confirmado con token10min, versiones/hashes y clave. |
| `/api/resultados-propuestas/[id]` | GET corte07 inmutable e indicador de vigencia, tras ACL financiera actual. |

Handlers Node, parámetros asíncronos y guías Next locales antes de escribir código.
Sesión/SQL dentro de frontera segura; JSON estricto, cuerpo incremental, origen
propio en mutaciones, `private,no-store`, errores seguros. 400 entrada/filtro;
401 identidad ausente/inactiva;403 permiso/provisional/ficticio/origen;404 recurso
fuera de alcance;409 transición/CAS/token/fuente cambiada;413 límites;422 modelo,
moneda o comparación incompatible;503 infraestructura/integridad/servicio05 ausente.
Una comparación parcial válida puede previsualizarse/guardarse con estado parcial;
422 reserva estructuras imposibles o atribuciones que contradicen IDs.

UI: en propuesta/revisión muestra estado, publicación, autor/referencia/historia y
acciones disponibles con título explícito de decisión interna. Antes de aceptar
se ven revisión/hash, frescura y ausencias de valoración, sin completar datos.
Embudo muestra período/corte/denominador, cuatro etapas enlazadas y monedas
separadas. Finanzas tiene superficie distinta con alcance/cobertura y fuentes05.
Errores409 conservan motivo/selección, ofrecen recargar/comparar y no sobrescriben
por respuesta tardía. Estado de una selección anterior no pinta otra propuesta.
Sistema visual MASTER, sin emojis; teclado/foco/errores accesibles. Flujo completo
de escritorio antes de comprobación final móvil.

Límites centralizados07: cuerpo64KiB, motivo2000 y referencia1000 caracteres,
50 resultados/página,1000 eventos por revisión,10000 propuestas por cohorte,
366 días por rango,4MiB por corte financiero. Si se exceden, error y rango menor;
no truncar para declarar completo. Token de10min acotado, firmado y ligado a
usuario/filtros/modelo; no JSON financiero en URL. Sin paquetes nuevos ni cron.

| Unidad futura y dueño propuesto | Archivos exclusivos |
|---|---|
| 07A dominio/seguimiento, ejecutor07 | Nuevos `src/lib/seguimiento-propuestas/{modelo,autorizacion,estados,cohorte,repositorio,servicio,http}.ts`; `src/lib/seguimiento-propuestas-*.test.ts`. No modificar `src/lib/propuestas/`. |
| 07B métricas/finanzas, ejecutor07 tras adaptador05 | Nuevos `src/lib/resultados-propuestas/{modelo,autorizacion,comparacion,repositorio,servicio,http}.ts`; `src/lib/resultados-propuestas-*.test.ts`. Sin lector salarial desde el módulo operativo. |
| 07C superficies, ejecutor07 | Nuevos `src/components/seguimiento-propuestas/{estado,historial,decision,embudo,lista}.tsx`, `src/components/resultados-propuestas/{comparacion,cobertura,historial}.tsx`; árboles API de la tabla y páginas `src/app/propuestas/seguimiento/page.tsx`, `src/app/propuestas/resultados/page.tsx`. |
| 07D gates, ejecutor/revisor por separado | Nuevos `scripts/rea07-fixture.mts`, `scripts/verificar-rea07.mts`, `scripts/verificar-rea07-concurrencia.mts`, `e2e-gate/rea07.config.ts`, `e2e-gate/rea07.spec.mts`; evidencia `output/rea-integracion/rea07/`. Revisor escribe sólo su carpeta de evidencia. |
| Compartidos, coordinador exclusivamente | `db/schema.sql`, nueva migración `db/migraciones/2026-10-rea07-seguimiento.sql` y rollback homónimo, trigger de flujo, adaptador05 acordado, enlaces desde editor06/proyecto/panel, registro de tarjetas02, continuidad17/18/25. |

07A/07B pueden prepararse como módulos separados, pero no se editan a la vez el
mismo archivo compartido. Ningún ejecutor cambia usuarios/permisos, acciones
físicas, CSV/seed, cable/BOM, E1/E2/E3, importes, fechas ni repositorios05/06 sin
asignación expresa del coordinador. Cada unidad tiene gate propio; no declarar
ST33 integrado por terminar sólo eventos/embudo o aplicar su migración.

## Escenarios reproducibles Dado / Cuando / Entonces

Fixture nueva y nombrada por coordinador, sin `.env.local`, inventario, producción
o reutilizar bases anteriores. Reloj observado fijo y IDs literales en manifiesto.
Debe incluir P-A técnica, P-B valorada EUR, P-C parcial, P-D USD, P-E EUR+USD,
P-F de otro período, P-G archivada, sala legado y usuarios técnico/gestor con
compras/lectura/admin financiero, permiso de catálogo retirado y provisional.

1. **Publicación.** Dado preview P-A antes de medianoche y operación revision
   después en Madrid, cuando se consulta la cohorte, entonces entra en el día
   de la operación. Preview/fallo no cuenta. Reintento y no-op de otra fecha no
   desplazan primera publicación ni duplican revisión/propuesta.
2. **Estado por revisión.** Dada P-B/r1 emitida y aceptada, cuando06 publica r2,
   entonces actual=r2/Borrador, aprobación vigente ausente y r1 aceptada histórica
   intacta. PDF/hash/valoración06 no cambian por emitir/aceptar/rechazar.
3. **Transiciones.** Dada Borrador, cuando aceptar/rechazar sin emitir, entonces
   409 sin filas. Emitir→aceptar→revocar→rechazar produce cuatro eventos válidos;
   motivo vacío, revocar otro evento o dos aceptaciones directas falla sin rama.
4. **Carrera real.** Dadas dos conexiones con misma base07, cuando aceptan y
   rechazan tras barrera, entonces una gana y otra409. Mismo payload/clave devuelve
   mismo ID, otra carga409, sin repetir evento; probar sin flujo preexistente.
5. **Carrera06/07.** Dada r1, cuando publicar r2 y aceptar r1 compiten, entonces
   o aceptación anterior queda histórica y r2 Borrador, o decisión antigua409.
   Ningún deadlock por inversión sala/proyecto ni aceptación aplicada a r2.
6. **ACL técnica.** Dado usuario sin compras, cuando consulta técnico/UI/RSC/API,
   entonces no SELECT de valoraciones/tiempos/tarifas/costes ni campos monetarios.
   Propuestas valoradas y fuentes BOM/catálogo no autorizadas quedan fuera del
   conteo/lista igual que del detalle, con spy SQL y HTML/RSC inspeccionados.
7. **ACL financiera.** Dados lectura con compras:ver y gestor de propuesta,
   cuando piden resultados05/07, entonces403 antes de SQL financiero. Admin actual
   autorizado sí accede; retirar permiso durante preview bloquea confirmación,
   reintento y snapshot, sin entregar un dato por idempotencia o enlace antiguo.
8. **Cohorte exacta.** Dadas P-A…P-G y revisiones/eventos múltiples, cuando abre
   cuatro etapas y sus páginas con mismo token, entonces unión de IDs sin repetir
   = manifiesto y suma de conteos=denominador. Lista de50 no limita total.
9. **Conjunto cambiado.** Dado token previo, cuando llega nueva publicación/archivo
   que cambia su manifiesto o se retira permiso, entonces detalle no sustituye
   su conjunto:409/403 y recarga coordinada. Respuesta tardía de otro filtro no
   pisa tarjeta/lista. Sin escritura al crear/validar token o abrir GET.
10. **Ratio.** Dada cohorte de3 propuestas con una revisión actual aceptada,
    cuando calcula, entonces1/3 y33,33%; revisión histórica aceptada no suma.
    Cohorte vacía produce0/0 ynull, no0%. Revocar devuelve0/3 y0,00%.
11. **Períodos.** Dadas operaciones en límites Madrid y cambios DST23/25h,
    cuando filtra fechas civiles, entonces pertenencia exacta `[inicio,fin)`.
    Dos cohortes comparadas usan el mismo corte y ausencia no es0 ni crecimiento.
12. **Monedas y huecos.** Dadas bases EUR100, USD50, una parcial EUR20 conocida
    con otra línea ausente y P-A técnica, cuando suma, entonces EUR120 parcial y
    USD50 separado, con cobertura por propuesta/línea y sin EUR+USD. Cero explícito
    permanece conocido; sin valores=null. Impuesto desconocido no borra base.
13. **Aprobación parcial.** Dada P-C aceptada técnica con base parcial/impuesto
    ausente, cuando muestra aprobado, entonces conserva esos estados y fuentes;
    no completa importes, crea ingreso ni permite diferencia final financiera.
14. **Dependencia05.** Dado sólo esquema05 sin servicio verificado, cuando pide
    comparación, entonces capacidad pendiente/503, nunca beneficio0 o lectura
    alternativa de tarifas. Los gates de seguimiento pueden pasar sin cerrarST33.
15. **Comparación conocida.** Dada aceptación de base EUR100 y corte05 documentado
    con laboral30+material40 EUR, ambas fuentes netas y mismo alcance revisado,
    cuando confirma, entonces diferencia registrada30 EUR, denominadores/fuentes
    visibles, snapshot/hash durable; no etiqueta beneficio total ni cobrado.
16. **Comparación parcial.** Dada base100 y coste conocido40 con parte sin tarifa,
    fuente fiscal desconocida, sólo laboral o tareas/período parcial, cuando compara,
    entonces subtotales presentes, estado parcial y diferencia=null. Sin coste
    conocido=null; coste0 explícito documentado permite100 sólo si demás gates pasan.
17. **Alcance y doble coste.** Dadas dos propuestas sobre una obra y un mismo corte05,
    cuando consulta ambas, entonces no existe agregado que sume dos veces ese coste
    ni reparto automático por sala. Corte de otra sala/obra no pasa compatibilidad;
    varios cortes solapados no son entrada válida de una comparación.
18. **Frescura histórica.** Dado corte07 guardado, cuando corrige tiempo/material05,
    revoca aceptación o publica otra revisión, entonces antiguo snapshot/importe
    queda igual, marcado histórico/desactualizado y no como resultado vigente.
    Recalcular requiere nueva preparación/confirmación y conserva antecedente.
19. **Archivo/cierre.** Dadas P-G archivada y obra cerrada, cuando consulta al corte,
    entonces resuelve archivo por operaciones y estado independiente; nuevas
    decisiones fallan409 sin reabrir obra. Reactivación no borra aceptación y
    filtro todas conserva ambas, con denominador explícito.
20. **No mutación e integridad.** Dadas fotos/hash completos antes, cuando ejecuta
    todos los comandos/resultados y reinicia, entonces sólo cambian sidecars07.
    Propuestas/revisiones/PDF06, tiempos/costes05, planes, diseño/E3, movimientos,
    stock, reservas, pedidos/cargas/hitos y CSV protegidos quedan idénticos.
    Intento UPDATE/DELETE histórico falla; fallo inyectado revierte todo07.
21. **Flujo real.** Dado escritorio con los roles de fixture, cuando recorre
    emitir/decidir/revocar, nueva revisión, embudo/drilldown, retiroACL, conflicto,
    comparación parcial/completa y reapertura, entonces UI/API/RSC coinciden,
    foco y formulario se conservan. Sólo después móvil y teclado. Capturas por
    rol acreditan ausencia de dinero/costes en superficies no autorizadas.

Guardar comandos, logs crudos, consultas espiadas, carreras de dos conexiones,
manifiestos de IDs/importes exactos, fotos operativas antes/después, capturas de
escritorio/móvil y privacidad en `output/rea-integracion/rea07/`. Pruebas puras,
SQL y HTTP reales, tipos/lint/build sin BD y regresiones de fronteras06/05/02
según integración. Revisión independiente contra fuentes y escenarios, sin cierre
por informe del autor. Gates de07 no acreditan transporte, pago ni producción.

## Decisiones de coordinación y condiciones antes de asignar producto

1. **Adaptador05 concreto, pendiente del runtime:** acordar tipos/campos de alcance, cobertura de ambos
   componentes, tratamiento fiscal neto y comprobación de vigencia/hash de corte.
   El contrato fija el comportamiento;05 aún no lo acredita en runtime. Hasta
   entregarlo se implementa07A y el resultado07B permanece pendiente explícito.
2. **Frontera compartida aprobada con dependencia de verificación:** conservar
   salas→proyecto→propuesta de06 y READ COMMITTED con relecturas bajo locks para
   escrituras07; no cambiar cierre/A/E3. Confirmar el corte definitivo de06/cierre
   y la ubicación del trigger de flujo07; ejecutar carreras07 contra ese corte
   real, sin asumir resuelta una investigación de concurrencia por el documento.
3. **Entrada aprobada, integración secuencial de root:** enlace en editor06 y
   obra al seguimiento, sin nueva pestaña de sala. Tarjetas02 sólo técnicas con
   claves/permisos multisección explícitos y fuente real verificada; sin tarjeta
   global de beneficio. Toda integración espera el freeze de sus fuentes.
   Propiedad del coordinador, sin modificar esos archivos desde07 en paralelo.
4. **Políticas nuevas aprobadas para esta capacidad:** Borrador persistido, emisión interna
   separada, cohorte por primera publicación y tasa sobre toda la cohorte son
   decisiones de este contrato. No se atribuyen como práctica histórica del
   departamento; quedan fijadas para sus tests/UI.

La partición07A→07C→gates de seguimiento puede
avanzar con06 verificada;07B y su integración completa conST33 esperan05
verificada y adaptador real. Nada de esta preparación permite marcar como
implementadosST29/ST30/ST33 ni aplicar el SQL sin la asignación del coordinador.

# L3C · Cables suministrados

Ronda 1 de diseño. No autoriza implementar hasta que B2c cierre con dictamen
independiente. No acredita implementación, gate L3 ni cierre de L3B/L3C/plan40.
No autoaprueba B2c ni L3C.

Fuentes que mandan: `docs/40-plan-implementacion-y-revision.md` (gate L3),
`docs/revision/l3-contrato-ejecucion.md` (unidad L3C y matriz), precisión final
de `docs/revision/l3-diseno-previo.md` (tabla `sala_cables_suministrados` y
«Cable unido a una pieza»). Forma: `docs/revision/l3b-b2c-carga-contrato.md`.

Árbol actual (lectura, no baseline de implementación): `conexiones` no tiene
estado comercial ni FK de cable; `avisosDeCable` en `revision-tecnica.ts` lee
hechos L1 de los extremos, no filas físicas; `composiciones.csv` deja el
cableado del Room Kit EQ en `por_determinar`; la ficha del Table Microphone Pro
documenta cable unido de 11 m. Baseline de código: el manifiesto del B2c
**cerrado**, no 507 ni esta nota.

Resultado exacto: persistir cada cable físico suministrado, decidir el estado
comercial de cada conexión y proyectar compra, pendientes y alcance sin inventar
metros ni hacer desaparecer material.
Destinatario y motivo: técnico que monta con el latiguillo de la caja y el que
compra sin volver a pedir un cable ya incluido.
Éxito medible: kit + cable incluido → compra del kit, cero compra de ese cable;
longitud nula o menor que recorrido+holguras+margen → no acredita alcance;
dos micros → dos compras de micro y dos cables unidos no intercambiables;
HDMI/Ethernet opcionales del kit no entran como incluidos; históricos conservan
necesidad de cable vía backfill `adicional` heredado.
Alcance: tabla física y snapshot, columnas/FK/UNIQUE/guardas en `conexiones`,
proyección de `agruparMaterialCable`/faltantes/paquete/tabla, avisos desde filas
físicas, instanciación con el suministro, rechazo de copia que exigiría remap,
pruebas y UI mínima de lectura/decisión.
Fuera: L3D (copia/remap/alta UI de kit), L3E, L3F, snapshot L5, PDF L6,
retirada poscompra, cuarentena, carga/reserva/recepción B2, Git y producción.
Protegidos: árbol del B2c cerrado, históricos comerciales, etiquetas L2, piezas
y stock de componentes, BD compartida y producción. Solo QA UUID local
desechable, dueño único.
Comprobaciones: migración desde árbol actual (limpia/poblada/repetición), SQL
adversarial e inversas, causales, dominio, regresión L3A/L3B/L2, build/tipos/lint
y desktop de tabla/paquete antes de 390/320.
No Git/publicación ni aprobación de B2c/L3B/L3C/plan40.

## Precisión que manda

Las letras L3 son cortes de implementación, no requisitos nuevos. El cambio de
`conexiones` a estado comercial nuevo **exige en este mismo corte** que la
tabla de cables, los faltantes y el paquete expliquen pendientes. Si una tirada
deja de sumar compra, no puede desaparecer: queda visible como pendiente,
incluido insuficiente o adicional. No hay ruta parcial de negocio entre L3C y
L3D.

L3C **no habilita** retirada poscompra. Sigue el rechazo real de servidor
mientras no exista el snapshot íntegro L5. No se introduce snapshot incompleto
ni se borran conexiones compradas.

Copias y remap de propietario/puerto/ordinal son L3D. En L3C se rechaza o no se
abre la copia si haría falta remapear un cable unido o una fila física; no se
implementan equivalentes de plantilla ni UUID nuevos de cable.

## Modelo

### `sala_cables_suministrados`

Una fila por cable físico. No es `conexiones`: la conexión es la tirada
instalable; esta fila es la unidad que vino en la caja.

| Campo | Contrato |
|---|---|
| id | UUID. UNIQUE(id, sala_id) para FK compuestas. |
| suministro_id, sala_id | FK compuesta a `sala_suministros(id, sala_id)` RESTRICT. El cable no cambia de sala ni de dueño comercial por UPDATE. |
| linea_id | FK nullable a `articulo_composicion_lineas(id, composicion_id)` de la misma composición congelada del suministro. |
| ordinal | Entero ≥1. UNIQUE(suministro_id, linea_id, ordinal) cuando linea_id no es nulo. |
| tipo | `libre` \| `unido`. |
| propietario_equipo_id, puerto_fijo_id, ordinal_fijo | Ver guarda de tipo. |
| articulo_cable_id | FK nullable a `articulos`. Nulo si la identidad comercial del latiguillo no está documentada. |
| longitud_utilizable_m | Nullable; si existe, numérica estrictamente positiva. Nulo = longitud suministrada desconocida, nunca cero ni suficiencia. |
| snapshot | JSONB inmutable tras INSERT: referencia, fuente, conectores, requisitos, longitud y tipo congelados. Una actualización de CSV/hechos L1 no transforma filas ya instanciadas. |
| creado_en | timestamptz. |

El JSON no sustituye FK ni ocupación. `longitud_manual_m` de la conexión sigue
siendo longitud de instalación exigida por el cálculo; **nunca** sustituye
`longitud_utilizable_m`.

Hace falta UNIQUE(id, sala_id) en `sala_suministros` si aún no existe aparte de
`(id, sala_id, composicion_id)`, para la FK compuesta del cable. Es ampliación
de clave, no cambio de estado comercial del suministro.

### Tipo libre / unido

- **Unido** exige los tres: `propietario_equipo_id`, `puerto_fijo_id`,
  `ordinal_fijo`, todos NOT NULL. FK compuesta
  `(propietario_equipo_id, sala_id)` → `sala_equipos(id, sala_id)`.
  FK `(puerto_fijo_id, articulo del propietario)` → `puertos(id, articulo_id)`
  (`puertos_id_articulo_unico` ya existe). `ordinal_fijo` entre 1 y `puertos.total`.
  El propietario pertenece a ese suministro (`sala_componentes_suministro`) en
  la misma sala.
- **Libre** exige los tres nulos. No hay extremo fijo.
- CHECK: los tres llenos o los tres nulos, coherente con `tipo`.

Si el extremo fijo aún no está documentado (puerto/ordinal desconocidos), no se
asigna el cable a una conexión: se conserva la fila de suministro pendiente.
No se inventa boca genérica.

### `conexiones`: estado comercial y FK

Añadir, con backfill explícito:

- `estado_suministro text not null` en `incluido | adicional | por_determinar`.
- `cable_suministrado_id uuid` nullable.
- `decision_heredada boolean not null default false`.

CHECK:

- `incluido` ⇔ `cable_suministrado_id IS NOT NULL`.
- `adicional` y `por_determinar` ⇔ `cable_suministrado_id IS NULL`.
- `decision_heredada` solo puede ser true si `estado_suministro = 'adicional'`.

FK:

- UNIQUE parcial `conexiones(cable_suministrado_id)` donde no es nulo: un
  latiguillo no satisface dos conexiones.
- FK compuesta `(cable_suministrado_id, sala_id)` →
  `sala_cables_suministrados(id, sala_id)` RESTRICT. Incluido exige misma sala.
- UNIQUE `(id, sala_id)` en `conexiones` si hace falta para inversas.

Añadir las mismas tres columnas de estado a `plantilla_conexiones` **sin** FK
de cable físico y **sin** permitir `incluido` (CHECK solo `adicional` |
`por_determinar`). Sirve para que la copia histórica no convierta tiradas que
hoy suman compra en un vacío. No es tabla de cables de plantilla ni remap L3D.

### Backfill

Toda `conexiones` y `plantilla_conexiones` existente recibe
`estado_suministro = 'adicional'` y `decision_heredada = true`,
`cable_suministrado_id` nulo. Conserva el comportamiento comercial anterior
(sigue en material a comprar) sin declarar fuente documental de fabricante.

Toda conexión **nueva** (INSERT de diagrama/alta) nace `por_determinar`,
`decision_heredada = false`, sin FK. El artículo de cable de la tirada, si lo
hay, no implica `adicional` ni `incluido`.

No se crean filas de `sala_cables_suministrados` para el histórico. No se
adscriben HDMI/Ethernet del kit.

## Guardas (directas e inversas)

Validación diferida donde el estado intermedio de una TX lo exija; no
desactivar triggers L2/L3A/L3B. Cambiar extremos, artículo del propietario,
pertenencia al suministro, puerto, ordinal, sala o tipo revalida.

1. **Identidad unido.** Propietario ∈ suministro y sala; puerto ∈ artículo del
   propietario; ordinal ∈ capacidad. Libre sin extremo.
2. **Conexión que usa cable unido.** Alguna `conexion_bocas` de esa conexión es
   exactamente `(propietario_equipo_id, puerto_fijo_id, ordinal_fijo)`. Si se
   mueven bocas y dejan de contener ese extremo, rechazar o exigir retirar la
   asignación en la misma TX. No se “parece” al puerto: igualdad de UUID y
   ordinal.
3. **Unicidad.** Dos conexiones no comparten `cable_suministrado_id`. Dos
   micros de la misma sala no intercambian cables unidos: ni por UPDATE del
   propietario, ni reasignando la FK, ni intercambiando ordinales entre
   suministros.
4. **Incluido sin fila.** Rechazo. `por_determinar`/`adicional` con FK: rechazo.
5. **Borrado.** No borrar el cable para esconder una asignación. Retirar
   `incluido` deja la conexión en `por_determinar` (o `adicional` si la
   operación lo pide de forma explícita), libera la UNIQUE y **conserva** la
   fila física y su snapshot. No hay cascada desde `conexiones` hacia el cable.
   Borrar conexión con `incluido` exige desasignar antes, en la misma TX.
6. **Inversas de pieza.** Cambiar `sala_equipos.articulo_id` / `sala_id` /
   cantidad de un propietario con cable unido: rechazo (ya lo cubre en parte
   L3A; L3C añade el cable). Cambiar `puertos.total` por debajo del ordinal
   fijo: rechazo.
7. **Opcionales no se presuponen.** Instanciar Room Kit EQ no crea cables
   HDMI/Ethernet `incluido`. La línea `cableado` `por_determinar` del CSV
   permanece pendiente documental, sin fila física y sin compra. El hecho L1
   `hdmi-suministrado` está `sin_documentar`; `ethernet-panel-opcional` tiene
   `incluido: false`. Ninguno autoriza `incluido`.
8. **Retirada poscompra.** Cualquier intento de `retirado_del_diseno` o de
   borrar suministro/pieza/cable de un montaje con recepción o salida sigue
   rechazado. L3C no abre esa puerta.

Orden de locks alineado con L3A/L2: sala, suministro, equipos propietarios,
puertos, conexiones, bocas, filas de cable. No ampliar el mutex B2c a tablas
ajenas. No escribir `operaciones_carga_kit` ni atribuciones de almacén.

## Suministro dueño y micro independiente

El cable unido del Table Microphone Pro pertenece al **suministro del
micrófono**, no al kit EQ. Un segundo micro es otra compra de micro y otra
unidad de su cable L1; no una segunda compra de RJ45 genérico ni el cable del
primero.

L3A exige composición publicada y prohíbe `articulo_componente_id =
articulo_kit_id` mezclado con «no anidar kits». L3C **separa** esas dos
prohibiciones, dueño de este corte:

- Sigue prohibido que un componente sea un artículo con composición publicada
  (kits anidados).
- Se admite **unidad simple**: composición del propio artículo micrófono con
  una línea incluida cuyo `articulo_componente_id = articulo_kit_id` (el
  cuerpo, cantidad 1) y una línea incluida de cable unido con
  `articulo_componente_id` nulo (el latiguillo no es equipo). Completitud: el
  cuerpo se vincula en `sala_componentes_suministro`; el cable nace en
  `sala_cables_suministrados` tipo `unido`. Proyección: cuenta el suministro,
  no el equipo suelto. No se duplica la compra del micro.

No se migra todo el inventario histórico de micros. El caso obligatorio de
prueba instancia dos suministros de Table Microphone Pro. Equipos históricos
sin pertenencia conservan su necesidad actual y no inventan cable unido.

`instanciarSuministro` (interno, sin alta UI de kit: eso es L3D) en este corte
crea, en la misma TX que piezas:

- filas de cable para líneas `incluido` de latiguillo documentado (identidad y
  fuente en snapshot; longitud desde el hecho L1 **congelado en el INSERT**,
  no consultado después);
- nada para `por_determinar` ni para `opcional` no seleccionado;
- nada desde hechos `sin_documentar` o `incluido: false`.

Seleccionar un opcional y convertirlo en suministro independiente es L3D/compra
nueva, no un marcado silencioso a `incluido`.

## Proyección, faltantes y paquete (obligatorio en este corte)

Fórmula comercial vigente, ahora con decisión de cable:

`suministros + equipos sin suministro + cables adicionales confirmados`.

| Estado | Compra (`agruparMaterialCable` → `necesidadDeSala` → `faltaParaSala`) | Tabla / paquete / revisión |
|---|---|---|
| `adicional` | Suma como hoy (metros o latiguillo comercial). Heredados incluidos. | Visible como adicional. |
| `incluido` | **Cero** unidades de ese cable. No reserva, no pedido, no faltante de compra. | Visible; longitud conocida o «Longitud suministrada pendiente»; si utilizable < necesarios, aviso de insuficiencia **sin** acreditar alcance y **sin** convertir el aviso en línea de compra automática. |
| `por_determinar` | No suma compra, no precio 0, no cantidad inventada. | Pendiente explícito en tabla, faltantes de diseño/paquete y semáforo. No desaparece. |

El cálculo geométrico (`calcularConexion`) se ejecuta para los tres estados.
`longitud_manual_m` alimenta metros de instalación, no `longitud_utilizable_m`.
`ajustarALongitudComercial` no acredita suficiencia de un incluido: el alcance
del incluido se compara con `longitud_utilizable_m` de **esa** fila. Longitud
comercial del artículo de la tirada sigue avisando por su vía, sin sustituir
la suministrada.

`avisosDeCable` deja de inferir inclusión desde hechos L1 de los extremos.
Lee `estado_suministro` y, si hay FK, la fila física. Hechos L1 quedan como
fuente de instanciación y documentación, no como existencia del latiguillo en
la sala.

Puntos que deben compartir la misma proyección (radio único; no dos ejecutores
sobre la decisión de contar el cable):

- `src/lib/calculo-cable.ts` `agruparMaterialCable`
- `src/lib/compras.ts` `necesidadDeSala`
- `src/lib/datos-almacen.ts` `faltaParaSala` (después del B2c cerrado: no
  revertir su lector RR ni el protocolo de carga)
- `src/app/salas/[id]/datos-ficha.ts` material, necesidad, `filasCable`
- `src/lib/cable-schedule.ts` `FilaCable` / `construirTablaCables`
- `src/components/documentos/paquete-tecnico.tsx` y
  `src/components/cable-schedule/tabla-cables.tsx`
- `src/lib/revision-tecnica.ts` `avisosDeCable`
- `src/lib/suministros.ts` pendientes de composición `por_determinar` y
  cables sin asignar

Pendientes a mostrar, como mínimo: línea `cableado` del kit; conexión
`por_determinar`; incluido sin longitud; incluido corto; HDMI/Ethernet no
presupuestos. Coste de cable incluido: «Incluido en [suministro]», no 0 €.

## Copia (solo rechazo o transporte de estado no incluido)

`exigirDisenoCopiable` ya rechaza sala con `sala_suministros`. L3C **amplía**
ese rechazo, no implementa remap:

- Origen con alguna fila `sala_cables_suministrados`, o conexión `incluido`, o
  intento de copiar FK de cable: rechazo íntegro con mensaje de que la copia
  de cables unidos/incluidos es L3D.
- Origen sin cables físicos: la copia existente puede seguir. Transporta
  `estado_suministro` `adicional`/`por_determinar` y `decision_heredada`. No
  crea filas de cable. No consulta la composición vigente para “actualizar”.
- Plantilla: jamás `incluido` en L3C. Backfill `adicional` heredado para no
  perder material de plantillas históricas al crear sala.

No tocar el remap de bocas L2 más que para copiar las dos columnas de estado
no incluido y el rechazo anterior. Tres rutas de copia y equivalentes de
plantilla de suministro/cable quedan L3D.

## UI mínima

No hay alta de kit en UI (L3D). No se rediseña el editor.

- Tabla `/cableado` y paquete: columnas de decisión (`incluido` / `adicional`
  / `por_determinar`), longitud suministrada o pendiente, y aviso de corto.
  La tabla técnica lista **todas** las tiradas.
- Si hace falta una acción para marcar `adicional` o asignar un cable libre
  ya instanciado a una conexión `por_determinar`, reutilizar la ficha de
  conexión existente (diagrama o tabla), token de escritura de sala, permisos
  de edición de diseño y rechazo recuperable. Asignar unido exige que la
  conexión ya contenga el extremo fijo; si no, rechazo, no se reescribe la
  boca.
- HDMI/Ethernet no aparecen premarcados incluidos.
- Sin PDF L6, sin asistente L4, sin checklist L5.

## Lectura actual que este corte sustituye

- `db/schema.sql` `conexiones`: identidad de tirada, puertos, etiqueta L2,
  `longitud_manual_m`; **sin** estado comercial ni FK de cable.
- `avisosDeCable`: hechos `suministro` L1 de los equipos de los extremos,
  `incluido === true && longitud_aplica`. Un micro documentado avisaría en
  cualquier tirada que lo toque, y un kit sin hecho de cable deja
  `cable_suministro_pendiente` aunque la decisión real sea `adicional`.
- `agruparMaterialCable`: suma todas las tiradas con artículo, sin filtrar
  incluidos.
- `instanciarSuministro`: solo piezas `incluido` con artículo; ignora el
  cableado `por_determinar` (correcto) y no crea el cable unido del micro
  (hueco L3C).
- Copia: rechaza kits; copiaría tiradas nuevas a `por_determinar` por default
  y haría desaparecer compra si no hay backfill/transporte de estado.

## Evidencia obligatoria

Migración sobre el árbol actual (schema + seed L3A/L3B, no un esquema vacío
ideal): instalación limpia, upgrade poblado, repetición, rollback tras cada
nivel (tabla cable, columnas de conexión, backfill, UNIQUE, triggers). Legado
sin kits: todas las tiradas `adicional` heredado y las mismas líneas de
material de cable que antes. Schema de migración y bloque en `schema.sql`
equivalentes.

Casos de dominio (matriz L3 y diseño):

- Cable incluido único no suma compra; kit tres piezas sigue siendo kit1.
- Desconocido (`longitud_utilizable_m` nula) y corto (11 m frente a tirada
  mayor) no acreditan alcance; manual 20 m no convierte 11 m suministrados en
  suficientes.
- Dos micros: compras de micro 2; cables unidos 2; intercambio de
  propietario/FK/ordinal rechazado en SQL directo y en operación.
- HDMI/Ethernet del kit: 0 filas `incluido`; pendientes visibles; no entran
  en `agruparMaterialCable` como incluidos.
- Segundo micro no compra RJ45 genérico por el hecho L1 del primero.
- Asignar el mismo cable a dos conexiones: rechazo; rollback de ambos
  intentos.
- Unido cuya conexión no contiene el extremo fijo: rechazo.
- Libre con propietario no nulo o unido con nulos: rechazo.
- Retirar asignación: UNIQUE libre, fila física intacta, conexión no
  `incluido`.
- Histórico adicional heredado sigue en faltantes/compra; mutante que agregue
  también `incluido` duplica material y tumba aserción cuantitativa; mutante
  que filtre `por_determinar` sin listarlo en pendientes hace desaparecer
  tiradas y tumba aserción de visibilidad.
- Instanciar kit no crea cables opcionales. Instanciar dos micros crea dos
  unidos de 11 m congelados; cambiar el CSV después no altera el snapshot.
- Copia de sala con cable físico o `incluido`: rechazo, origen intacto. Copia
  sin cables: estados `adicional`/`por_determinar` viajan; no nacen filas
  físicas.
- Retirada poscompra / borrar pieza de kit / `retirado_del_diseno`: sigue
  rechazado; montaje y cables intactos.

SQL adversarial: FK ajena de sala, UNIQUE rota, backfill a `incluido` sin
fila, DELETE de cable con conexión, UPDATE inverso de tipo/extremos/artículo,
token/solicitud alterada si hay acción UI, obra cerrada. Causales por guarda
principal con AssertionError real al retirar la guarda en copia aislada, no
timeout. Concurrencia: dos asignaciones del mismo cable, ambos órdenes RC/RR.

Regresión: L3A, B1/B2a/B2b y B2c cerrado, compras/carga, extremos/etiquetas
L2, `npm test`, build sin BD, tipos, eslint `src` `scripts`. Desktop:
login → sala con kit y dos micros de fixture → tabla de cables y paquete
muestran incluido/pendiente/adicional → recarga conserva → intento de copia
rechazado si hay unidos. 390/320, foco, overflow y reduced motion al final.
No contar captura de código como gate.

Entrega: este contrato, delta respecto al manifiesto B2c cerrado, manifiesto
completo y copias verificadas, logs/comandos/resultados, límites y limpieza
QA propia. Revisor independiente, máximo dos rondas ordinarias; no
autoaprobación.

## Ficheros previstos (dueño L3C)

Un solo radio: la decisión de contar o no un cable. No partir
`agruparMaterialCable` y `faltaParaSala` entre ejecutores.

- `db/schema.sql` (bloque nuevo al final del vigente, sin reescribir B2c)
- `db/migraciones/2026-09-cables-suministrados.sql` (nombre final de
  implementación; no es segunda autoridad)
- `db/seed.sql` solo si el generador debe instanciar cables de fixture; no
  edición a mano
- `data/composiciones.csv` y `scripts/sql-composiciones.mjs` si se publica la
  composición de unidad simple del Table Microphone Pro (versión nueva; no
  mutar la v1 publicada del Room Kit EQ)
- `src/lib/suministros.ts`, `src/lib/suministros-db.ts`
- `src/lib/calculo-cable.ts`, `src/lib/compras.ts`, `src/lib/datos-almacen.ts`
- `src/lib/cable-schedule.ts`, `src/lib/revision-tecnica.ts`
- `src/lib/tipos.ts` (campos de conexión/cable; no otro catálogo)
- `src/lib/datos.ts` / lector de sala: cargar cables con la instantánea de
  suministros
- `src/app/salas/[id]/datos-ficha.ts`
- `src/components/cable-schedule/tabla-cables.tsx`
- `src/components/documentos/paquete-tecnico.tsx`
- `src/lib/copiar-conexiones.ts` **solo** rechazo y transporte de estado no
  `incluido`
- Acción de diseño existente que escriba conexiones (`acciones-diagrama.ts` o
  equivalente estrecho) si nace la asignación; no un módulo paralelo de carga
- Tests de dominio/SQL/UI mínima y `scripts/verificar-cables-suministrados.mts`
  + runner al estilo de los cortes L3
- Este contrato y la entrega L3C cuando exista. No `estado-plan40.md` en el
  corte de implementación salvo que el director lo pida.

## Ficheros y sistemas prohibidos

- Protocolo B2c: `operaciones_carga_kit`, `ejecutar-carga-kits.mjs`,
  `verificar-carga-kits.mts`, flujo `/carga/[id]` salvo lectura incidental
- Reserva/recepción: `operaciones_reserva_kit`, recepción atómica B2a
- L3D: alta UI de kit, remap completo, `plantilla_cables_*`, cancelación
  precompra con selección de cables
- L3E/L3F: cuarentena, custodia, traslado, manifiesto EQ, conversión de
  artículo
- L5: `revisiones_diseno_sala`, snapshot, retirada poscompra
- L6: generadores PDF / print como alcance de cierre
- L4: `asistente-equipamiento.ts` y UI del asistente (L4 consumirá avisos
  ya persistidos; no adelantar ensayos del gate L4)
- `package.json`, secretos, Neon, Render, Git write, `docs/revision/estado-plan40.md`
  en esta preparación
- `src/lib/ciclo-vida-seguimiento*.ts`, despiece de stock, precios a 0 €
  inventados

Cualquier escritura necesaria en un fichero de otro dueño se reporta; no se
hace de paso.

## Criterio de cierre de unidad (no de plan)

L3C está listo para revisión cuando la evidencia anterior se ha ejecutado y
el revisor independiente no autoaprueba. Un kit produce compra del kit,
componentes físicos y cables trazables; el incluido no duplica accesorio; el
desconocido/corto no declara que llega; la copia con unidos no se finge
correcta. Gate L3 del plan 40 exige además L3D–L3F y revisión del conjunto:
este corte no lo declara.

L3C no habilita retirada poscompra.

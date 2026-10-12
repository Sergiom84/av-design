# L2 · Diseño previo de conexiones a rosetas

08/09/2026. Propuesta para revisión antes de implementar. Inspección de código;
no se ha ejecutado BD, migración ni prueba de este diseño.

## Contrato

Representar una conexión entre una boca física de equipo y una boca documentada
de roseta, calcularla y presentarla una sola vez en todas las salidas. Conservar
UUID de conexión, puertos y ordinales históricos, geometría y etiquetas actuales.
Sin equipos ficticios, asignaciones convertidas automáticamente ni capacidad
inventada. Alcance: dominio, BD local desechable, lectores, editores, copias y
entregables. Producción requiere autorización separada.

## Hallazgos que condicionan el cambio

- `src/lib/tipos.ts`: `Conexion` exige dos IDs de equipo. `TomaRed` admite XYZ
  nulos independientes y no tiene bocas ni capacidad documentada.
- `src/lib/bocas-puerto.ts` identifica boca como equipo, puerto, ordinal;
  `src/lib/editor-conexiones.ts` y sus payloads solo admiten esa forma.
- `db/schema.sql`: `conexion_bocas` tiene PK conexión/lado y unicidad física
  equipo/puerto/ordinal. Sus triggers comprueban sala, artículo, cantidad uno y
  total de puerto. El constraint diferido admite cero filas históricas o dos
  completas. Cambiar extremos legacy invalida las filas de bocas mediante trigger.
- `src/app/acciones-diagrama.ts` guarda primero columnas legacy, después reemplaza
  las bocas. `src/app/acciones.ts` también crea, cambia, borra y copia conexiones.
  Cambiar solo el editor dejaría rutas de escritura incompatibles.
- `src/lib/datos.ts` une las bocas; `src/lib/datos-plano.ts` lee conexiones por
  otra consulta. Deben compartir resolución de extremos antes de incorporar L2.
- `src/lib/calculo-cable.ts` busca ambos equipos antes de resolver longitud manual;
  precedencia actual: manual, polilínea medida, ruta paramétrica, holguras y margen.
- `src/lib/cable-schedule.ts:identificadoresDeCable` **recalcula** correlativos por
  señal al recorrer las conexiones existentes. Borrar la primera renumera las
  siguientes; cambiar señal también puede hacerlo. Los comentarios sobre
  estabilidad no constituyen una garantía y este defecto debe corregirse.
  Reproducción pura ejecutada por director: `output/plan40-20260908-083450/causal-etiqueta-actual.log`.
  Una segunda conexión HDMI pasa de HD-1001 a HD-1000 al excluir la primera;
  la aserción de estabilidad falla con `ERR_ASSERTION`, salida 1.
- La copia sala/plantilla atraviesa `acciones.ts` y `acciones-diagrama.ts`, con
  `plantilla_conexiones` y `plantilla_conexion_bocas`; no copia rosetas físicas.

## Modelo propuesto

Conservar `conexiones.id` como identidad de cable. Ampliar `conexion_bocas`, no
crear otra tabla competidora de ocupación. Cada fila conserva conexión/lado y
contiene exactamente una alternativa, con CHECK explícito:

| Tipo | Campos obligatorios | Campos nulos |
|---|---|---|
| Equipo | equipo_id FK, puerto_id FK, ordinal positivo | toma_boca_id |
| Roseta | toma_boca_id FK a toma_red_bocas | equipo_id, puerto_id, ordinal |

`toma_red_bocas`: id UUID, toma_red_id FK, ordinal positivo, etiqueta física
opcional, conector y señal documentados; UNIQUE(toma_red_id, ordinal).
`tomas_red.capacidad_documentada` nullable y positiva cuando se conoce; ninguna
migración la rellena por defecto. Cero filas con capacidad NULL significa sin
documentar, nunca placa doble ni capacidad cero. El alta de capacidad N y sus N
bocas es atómica; un trigger diferido comprueba número/ordinales. No se reduce ni
borra una boca ocupada. La placa y sus bocas son infraestructura, no material AV.

Mantener UNIQUE(equipo_id, puerto_id, ordinal), añadir UNIQUE(toma_boca_id), y
conservar PK(conexion_id,lado). La BD comprueba pertenencia de placa/equipo a la
sala de conexión y coherencia de tipo; para bocas de equipo conserva todas las
guardas actuales. FK de boca de roseta con borrado RESTRICT; borrar la placa exige
resolver antes las conexiones. Un cambio de sala de placa o equipo también se
valida contra conexiones entrantes: no basta validar el alta de la boca.

Hacer nullable `conexiones.origen_id/destino_id` para el lado roseta, conservando
sus FK a equipos. Son columnas de compatibilidad, no UUID polimórficos. En las
conexiones detalladas manda la pareja de `conexion_bocas`; trigger diferido exige
que las columnas legacy de equipo/puerto coincidan y que sean nulas en lado
roseta. Las escrituras nuevas siempre crean dos filas. Añadir modo explícito
`detalle_extremos = legacy | completo`: solo se marca legacy durante backfill
para conexiones sin pareja; una nueva conexión no puede eludir las guardas
dejando cero filas. Convertir legacy a completo es irreversible desde los flujos
normales. Sustituir la invalidación legacy actual coordinadamente: nunca dejar
que una actualización inocente borre la pareja y transforme completo en legacy.

En TypeScript, unión discriminada por extremo: equipo con boca concreta, roseta
con boca concreta. La compatibilidad histórica se representa aparte como estado
de conexión sin detalle, con sus dos equipos y puertos opcionales originales;
no se representa como boca inventada. Un resolutor común produce nombre, boca,
conector, posición conocida/estimada/desconocida y categoría de holgura.

## Identificador de cable antes de incorporar rosetas

Añadir etiqueta persistida e inmutable a `conexiones`, UNIQUE(sala_id, etiqueta).
Guardar también señal de numeración/correlativo y contador por sala y señal;
reservar el siguiente valor dentro de la transacción con bloqueo/UPSERT atómico.
El contador no se reduce al borrar: los números no se reciclan. Cambiar la señal
técnica de una conexión no cambia la etiqueta que puede estar en una brida.

Backfill exclusivo sobre instantánea consistente, bloqueando altas/bajas durante
la operación: calcular exactamente las etiquetas que muestra hoy
`identificadoresDeCable`, con mismo orden creado_en/id, prefijos y primer número.
Persistirlas y comparar el mapa UUID→etiqueta antes/después antes de confirmar.
Usar `PREFIJO_CABLE` como fuente única: el ejecutor de backfill lo importa y los
valores necesarios en BD se generan desde él, no una segunda lista manual.
El siguiente contador empieza tras el máximo histórico de cada sala/señal.
No reconstruye etiquetas impresas antes de un borrado previo: ese dato no existe;
preserva las visibles en la instantánea. Esa limitación debe figurar en el informe.
Las copias crean cables nuevos con etiquetas nuevas del destino; no copian bridas.

## Geometría, medidas y holguras

Reutilizar el núcleo de recorridos, polilínea, formatos comerciales y márgenes;
extraer su entrada geométrica para aceptar extremos resueltos, sin fabricar un
`EquipoEnSala` para la roseta. XYZ=(0,0,0) completo es válido. Algún eje nulo
implica posición desconocida: no completar con cero ni descartar datos parciales
históricos. En altas nuevas se guardan tres ejes o ninguno; los históricos
parciales se muestran pendientes y se completan explícitamente.

Longitud manual válida mantiene precedencia incluso con posición desconocida;
puntos intermedios no sustituyen el origen/destino desconocido. Sin manual y sin
ambos extremos resolubles, devolver cálculo ausente y aviso concreto, no cero
metros. Equipos históricos mantienen la estimación existente y su marca; la
regresión equipo/equipo no debe cambiar. Añadir holgura de roseta configurable en
`parametros`; si falta, mostrar cálculo pendiente de criterio, sin asignar un
valor inventado. Este criterio se revisa antes de sembrar un valor inicial.
El layout `esquema_x/y` queda separado de XYZ en todos los caminos de guardado.

## Escrituras, concurrencia y asignaciones documentales

Todas las acciones conservan permisos, guarda de obra cerrada, lock de sala y
versión optimista. Validar payload tipado, pertenencia, capacidad y ocupación en
servidor y BD. Bloquear recursos en orden estable y probar cambios simultáneos de
capacidad y conexiones. La unicidad de boca decide dos altas concurrentes; el
perdedor recibe conflicto sin media conexión, contador confirmado ni cambio de
versión parcial. El guardado completo revierte también posiciones y altas.

`sala_equipos.toma_red_id` permanece como asignación documental pendiente. No se
convierte al migrar. La conversión exige boca de equipo, boca de placa, cable y
ruta seleccionados. Dentro de la misma transacción comprobar si la conexión
equivalente ya existe: devolver su ID cuando corresponda, no duplicar. Registrar
el enlace de asignación a conexión mediante FK explícita y verificar que ambos
extremos coincidan; así la UI distingue completada de pendiente sin borrar su
procedencia. Borrar esa conexión vuelve a pendiente mediante FK SET NULL.

## Plantillas y superficies afectadas

Añadir `plantilla_tomas_red` y sus bocas, con FK a plantilla. Ampliar
`plantilla_conexion_bocas` simétricamente; mismas guardas de pareja y ocupación.
Crear mapas independientes equipo, placa, boca y conexión. Copiar primero placas
y bocas, luego conexiones y puntos. Tanto sala→plantilla como plantilla→sala
conservan coordenadas desconocidas y geometría, generan UUID nuevos y validan
límites de sala. Código heredado se guarda como referencia, con confirmación
física pendiente: no se presenta como etiqueta comprobada del edificio destino.
No copiar asignaciones documentales como cable ni autorías/verificaciones físicas.

Unificar lectura/resolución en `datos.ts`, `datos-plano.ts`, cálculo y tabla;
llevarla a `diagrama.ts`, `lienzo-conexiones.ts`, editores de plano/diagrama,
formulario de conexiones, croquis, material y paquete técnico. Selectores ofrecen
placa y boca real libre; capacidad desconocida abre su documentación y no permite
elegir una boca ficticia. Texto final: “LAN [boca] → toma [código/boca]”.
Un registro de conexión produce una fila/material; no contar de nuevo la
asignación antigua. Mantener tokens y componentes; escritorio completo primero,
móvil/foco/overflow/reduced motion e impresión al cierre.

## Orden y pruebas de aceptación

1. Persistir etiquetas y probar backfill, repetición, borrado primero/intermedio,
   cambio de señal, altas simultáneas y no reutilización de números.
2. Migración de extremos/placas en instalación limpia y esquema anterior poblado;
   comparar UUID, equipos/puertos/ordinales, rutas, puntos, etiquetas y relaciones.
3. Guardas SQL directas: tipo mezclado/vacío, pareja incompleta, nueva fila legacy,
   sala ajena, puerto ajeno, boca ocupada, placa sin capacidad, reducción de
   capacidad usada, traslado de sala y borrado; dos conexiones simultáneas.
4. Dominio: equipo/equipo idéntico; equipo/roseta con XYZ cero, desconocidos y
   parciales; manual sobre puntos/ruta; holgura configurable; mover XYZ cambia
   metros y mover esquema no. Mutaciones verifican que quitar las guardas falla.
5. Copias en ambos sentidos, placa con varias bocas, códigos pendientes, UUID y
   etiquetas nuevos, posiciones conservadas, ruta/puntos remapeados y rollback
   al fallar después de insertar bocas.
6. Recorrido escritorio con recarga: conectar, editar, convertir asignación dos
   veces, conflicto entre pestañas; tabla/material/guía con una sola conexión.
   Permisos, obra cerrada, tests existentes, tipos/build/lint y cierre móvil/print.

Gate previo: revisión independiente de este diseño y resolución del criterio de
holgura inicial. Este documento no declara aprobados L1, L2 ni su implementación.

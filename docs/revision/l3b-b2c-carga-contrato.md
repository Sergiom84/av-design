# L3B B2c · Carga unitaria desde reserva

Ronda1 de diseño. Base aprobada507:
`output/plan40-b2b-ui-20260908/manifiesto-entrega.json`.
Diseño aprobado con precisiones incorporadas, dictamen independiente:
`output/revisor-plan40-01a080e5/b2b/diseno-b2c-ronda1.md`.
Autoriza implementar este contrato; no acredita implementación ni cierre.

Resultado exacto: preparar una carga de una reserva gestionada elegida, marcar
su unidad y confirmar su salida desde una ubicación física elegida.
Destinatario y motivo: técnico que prepara y saca una caja para una sala.
Éxito medible: E1/R1/D0 → E0/R0/D0, reservadoA0/servidoA1/coberturaA1;
B conserva cobertura0. Una salida comercial1 y una atribución1; piezas intactas.
Alcance: protocolo SQL/servidor, integración en carga existente, lector coherente,
guardas, pruebas y recorrido de una unidad completa.
Fuera: cargas mixtas o masivas nuevas de kits, compra nueva, cierre, devolución,
baja, custodia, cuarentena y traslado. No modificar los datos físicos del kit.
Protegidos: árbol507 completo y originales sin seguimiento; histórico legado;
BD compartida y producción. Solo QA UUID local desechable, dueño único.
Comprobaciones: SQL adversarial, causales, RC/RR, rollback, idempotencia,
migración repetible, regresión y desktop completo antes de390/320.
No Git/publicación ni aprobación de B2/L3B/plan40.

## Corte e integración

Una preparación nueva contiene exactamente una reserva B2b activa, cantidad1,
en una carga nueva con una línea. Se elige la reserva, nunca se infiere el
suministro por artículo. Se reutilizan `/carga/[id]` y sus componentes; la
logística ofrece preparar junto a la reserva gestionada. El flujo genérico de
kit y las cargas históricas sin enlace siguen bloqueados.

Preparar no mueve stock ni sirve la reserva. Marcar significa listo para cargar,
no salida: control con valor explícito, sin toggle ambiguo. Confirmar exige
marcado, carga en preparación, suministro activo, reserva activa y obra abierta.
Autor de cada operación procede del usuario autenticado con edición de carga;
el texto del técnico no sustituye esa identidad.

Preparar repetidamente la misma reserva devuelve su carga existente: máximo una
preparación gestionada por reserva. Liberar B2b sigue permitido antes de servir:
no borra la preparación; esta pasa a mostrarse no operable por reserva liberada.
Una reserva nueva puede preparar una carga nueva. No se inventa cancelación ni
reactivación. Confirmar esa carga antigua rechaza íntegramente. Tras salida,
liberar rechaza. No se habilitan borrar carga ni cierre de obra para kits.

Tokens distintos para preparar la misma reserva resuelven a la misma carga sin
sustituir el autor/hecho original. Cada token queda registrado con su solicitud
y resultado, también si reutilizó preparación, para rechazar reuso alterado.

## Autoridad persistente e idempotencia

Hecho de preparación con referencias restrictivas a carga/línea/reserva/
suministro/sala/artículo, cantidad1, autor y token. Hecho de salida con referencia
a preparación, movimiento y ubicación exactos. Una reserva y una preparación
solo pueden tener una salida confirmada. No reinterpretar cargas previas.

Preparar, establecer marcado y confirmar usan tokens UUID estables y solicitud
canónica. Misma solicitud/token devuelve resultado previo incluso si ahora el
stock se agotó o la obra cerró; mismo token y solicitud distinta rechaza. Marcar
solo cambia el booleano de su línea en preparación, sin tocar cantidad/identidad.
Los valores canónicos, saldos previos, autor válido y xid8 los impone SQL.

True→false→replay del primer true conserva false: replay devuelve el resultado
registrado, no reaplica su efecto. Marcado/desmarcado en una TX valida la última
transición; tras salida solo se admiten replays previos, nunca marcado nuevo.

Materialización atómica y validación diferida de completitud, incluso ante cero
efectos o eliminación del materializador. Un token viejo no autoriza otra TX.
Proteger también inversas: cabecera/línea, reserva, suministro, movimiento y
atribución no pueden cambiar o desaparecer dejando un hecho falso. La ubicación
histórica de la salida lleva referencia restrictiva, no depende de SET NULL.

## Transacción y saldos

Entrar al control B2b antes de cualquier padre. Mantener orden común de locks,
reintento máximo3 de TX completa para40001/40P01, sin reintentar commit incierto.
Resolver replay antes de condiciones actuales. Releer sala/proyecto/carga,
reserva/suministro y marcado bajo control; comprobar identidad y pertenencia.

La ubicación se elige expresamente; no basta saldo global ni ubicaciónNULL.
No existe propiedad de almacén por sala: «ajena» significa inexistente o distinta
de la solicitud/hecho, nunca otra sede inferida. Cualquier ubicación existente
con saldo suficiente es válida con la semántica vigente.
Stock físico en esa ubicación >=1. La salida conserva esa procedencia. No se
exige disponible global>=1: la propia reserva ya lo redujo. Tras la operación,
Eubicación baja1, Eglobal baja1, Ractiva baja1 y Dglobal permanece igual.

En una sola TX: reserva activa→servida, movimiento salida1 del artículo comercial
en ubicación/sala canónicas, movimiento_suministros1 para ese suministro con
salida_movimiento_id NULL, cabecera cargada y hecho completo. Mantener
reserva_suministros. No hacer decisiones operativas entre estos pasos; lectores
externos solo ven antes/después completos. Conservar guardas diferidas B1 y
cota de déficit B2b, sin desactivar triggers ni adelantar su comprobación.

Evolucionar estrechamente proteger_logistica_kit, proteger_reserva_gestionada y
validar_operacion_reserva para el hecho B2c exacto; deben admitir reservar y
servir dentro de una misma TX sin interpretar el último hecho B2b como activa.
No ampliar preventivamente el mutex global a tablas ajenas. Cualquier nueva
dependencia de escritura/lock se justifica con la matriz ejecutable del lote.

Ubicaciones reservables/cuarentena pertenecen a L3E según el contrato de ejecución.
B2c conserva la semántica vigente (ubicaciones existentes equivalentes a true),
sin crear cuarentena ni prometer filtrarla. L3E deberá cambiar conjuntamente
disponibilidad, reserva y salida, y probar esa restricción en servidor y SQL.

## Lectura y formularios

Cabecera, línea, identidad gestionada, estado de reserva/suministro, cobertura
y saldos de ubicaciones salen de un snapshot RR coherente. No combinar consultas
independientes que presenten reserva activa junto con salida confirmada.
Formulario conserva ubicación/marcado/token tras conflicto agotado, muestra error
recuperable y permite reintento manual. Deshabilitar doble envío; identidad de
solicitud estable durante el intento. Permisos de acción propios intactos.

## Evidencia obligatoria

- Caso A/B del diseño: recepciónA, reservaA, preparación, marcado, salidaA;
  recepción restanteB y reserva/salidaB sin alterar A; replay conserva todo.
- Preparación no altera E/R/cobertura; duplicada devuelve misma carga. Marcar
  repetido no alterna. Confirmar sin marcar, ubicación ajena/sin saldo/NULL,
  otra sala, reserva histórica/multiunidad/liberada, obra cerrada: rechazo íntegro.
- Resultado exacto comercial1, atribución1, reserva servida, cobertura1; piezas,
  puertos, medidas, cables y stock de componentes sin cambios.
- SQL directo: falsificación/reutilización/token incompleto, efectos ausentes,
  cambio de identidad/cantidad/carga/ubicación, borrados y cascadas prohibidos;
  reservar+preparar+marcar+servir mismaTX. Fallo tras cada efecto revierte todo.
- Cargar↔liberar y cargar↔cargar, ambos órdenes RC/RR; cambio de selección,
  stock movido y dos reservas del mismo artículo compitiendo por última unidad
  de una ubicación. Tras40001, ejecutar y comprobar resultado del reintento.
- Movimiento concurrente cambia saldo/ubicación; borrar ubicación concurrente;
  lectores RR y mutante RC con barrera real. No contar timeout como causal.
- Migración sobre507 poblado/repetición/schema equivalentes; legado intacto.
  Causales por guardas principales, contando AssertionErrors reales.
- B1, B2a, B2b, compras/carga, npm test, build sinBD, tipos, eslint src scripts;
  desktop login→preparar→marcar→confirmar→reload, replay y error recuperable;
  390/320, foco, overflow y reduced motion al final.
- Entrega: contrato, delta respecto507, manifiesto completo y copias verificadas,
  logs/comandos/resultados, límites y limpieza de recursos propios. Revisor
  independiente máximo dos rondas ordinarias; no autoaprobación.

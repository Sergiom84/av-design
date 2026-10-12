# L3B B2b · Reserva por suministro

09/2026. Ronda2 de diseño, no implementación aprobada. Corrige los cuatro puntos
de `output/revisor-plan40-01a080e5/b2a/diseno-b2b-ronda1.md`.
Base: B2a aprobado en ronda2, manifiesto490. Dictamen del revisor
`output/revisor-plan40-01a080e5/b2a/dictamen-ronda2.md`.

Resultado exacto: reservar una unidad comercial disponible para un suministro
elegido y liberar esa reserva, conservando historial e idempotencia.
Destinatario y motivo: técnico que aparta una caja para una sala concreta.
Éxito medible: stock1, A/B pendientes; reservar A→reservadoA1/B0, disponible0;
reservar produce coberturaA1/B0 y pendienteA0/B1, servido0/0. Liberar A→reservado0,
disponible1, cobertura0/0 y pendiente1/1. No crea movimientos.
Alcance autorizado: operación transaccional, guardas SQL exactas, proyección y
controles dentro del bloque existente de reservas, pruebas y entrega independiente.
Fuera: carga/salida, compra nueva, devolución, custodia, cuarentena, cancelación
de suministro, reserva masiva automática de kits y reasignación del histórico.
Protegidos: árbol490 completo, datos históricos, base compartida y producción.
Comprobaciones obligatorias: migración/repetición, SQL adversarial, concurrencia,
rollback, idempotencia, causal, regresión y recorrido desktop→390/320.
Sin autorización de Git/publicación. No completa B2 ni L3B global.

## Lectura que fundamenta el corte

- `crearReserva` inserta cantidad/sala/artículo sin transacción de disponibilidad.
- `reservarLoDisponible` lee antes de insertar, agrupa por artículo y no conserva
  identidad de suministro; no es una base válida para atribuir A/B automáticamente.
- `liberarReserva` actualiza estado; `borrarReserva` borra físicamente. Las reservas
  atribuidas B1 tienen FK RESTRICT, y L3A bloquea las mutaciones de salas con kits.
- `reserva_suministros` ya conserva enlaces unitarios y B1 exige reserva activa
  más servido neto <= demanda activa. No garantiza disponibilidad global de stock.
- `ReservasDeSala` ya enseña necesario/existencias/reservado/disponible y acciones.
  El aviso de sobre-reserva documenta el comportamiento histórico permisivo.
- La disponibilidad actual es por artículo, sumando ubicaciones. Este corte no
  inventa ubicación de reserva ni reserva una pieza física de una caja concreta.

## Unidad y selección

Cada operación nueva reserva exactamente un suministro activo elegido, una unidad
de su artículo comercial, en su sala canónica. No acepta sala/artículo/cantidad
como autoridad del formulario. Comprueba la demanda restante con B1.

Stock del artículo y recibido atribuido son magnitudes distintas: se puede apartar
stock comercial disponible sin afirmar que proceda del pedido de ese suministro.
No se fabrica una relación recepción→reserva. Elegir A no cambia recibidoB.

Una reserva gestionada nueva tiene una sola atribución unitaria y su cantidad1.
Liberar conserva reserva y vínculo, cambiando activa→liberada una sola vez.
No se permite reactivar, marcar servida ni borrar. Reservar de nuevo tras liberar
crea otra reserva con otro token; el historial anterior permanece.

Reservas históricas atribuidas a varias unidades no se dividen ni se liberan a
través de esta operación unitaria. Sus operaciones pendientes siguen bloqueadas;
la interfaz distingue el histórico de la reserva gestionada por este protocolo.
Artículos independientes conservan su flujo existente, con la precisión de stock
común que se describe debajo para artículos que también se usan como kits.

## Hecho atómico propuesto

Registro inmutable `operaciones_reserva_kit`, PK token de envío, operación
reservar/liberar, solicitud normalizada e identidad de suministro/reserva.
El servidor captura xid8, usuario activo y su nombre, artículo/sala, estado previo,
cantidad y efecto esperado. Ninguno se admite como baseline elegido por cliente.

Para reservar, BEFORE valida y captura; AFTER materializa reserva canónica1 y
enlace B1 exacto. Para liberar, captura la reserva gestionada elegida y materializa
solo activa→liberada, sin quitar el enlace. Completitud diferida desde el token,
incluso si no se insertó ningún efecto. No basta que exista un token antiguo.

La excepción L3A acepta únicamente la transición exacta del hecho actual. Se
verifican OLD/NEW, xid y efectos finales, no GUC, flags cliente o nombre del llamador.
Tokens/detalles/enlaces de esta operación no se editan ni se borran.

Idempotencia: comparar solicitud idéntica bajo locks antes del INSERT, también
cuando la demanda o estado ya cambió. Mismo token con otra solicitud rechaza.
Token y efectos revierten juntos; repetir tras fallo vuelve a poder completar.
Dos tokens que compiten por la misma demanda no crean dos reservas activas.

Permisos en acción: edición de almacén y usuario real. La SQL garantiza integridad
del hecho, no identidad del código llamador con el mismo rol SQL.

## Cobertura y disponibilidad: magnitudes distintas

Se conserva B1 sin cambiar sus fórmulas: coberturaFisica=reservado+servido;
pendiente=1-coberturaFisica. Este nombre de dominio no acredita una identificación
individual ni un check-in técnico. Recibido por sí solo no da cobertura; reserva sí.

Para cada artículo a, E(a)=suma de movimientos con SIGNO_MOVIMIENTO y
R(a)=suma de cantidades de reservas activas, incluidas las legacy no atribuidas.
D(a)=E(a)-R(a). Reservar una unidad B2b exige D_pre>=1 justo antes de su efecto,
bajo serialización, y D_post=D_pre-1>=0 inmediatamente después. Liberar suma1 a D.
Cada hecho sucesivo tiene su propio estado previo; no reutiliza el de otro hecho.

Además, al confirmar la transacción completa, para cada artículo protegido tocado:
max(0,-D_final)<=max(0,-D_inicial). No se compensa déficit de un artículo con otro.
D_inicial se captura en SQL una sola vez por xid8/artículo antes de su primer
efecto de stock/reserva; D_final se relee en validación diferida. El baseline no
lo envía el cliente, no se sobrescribe y no se obtiene de una lectura previa del UI.

Tabla técnica inmutable de baselines, clave(xid8,articulo_id), captura automática
desde BEFORE ROW de movimientos/reservas, tras adquirir el control descrito abajo.
Se capturan OLD y NEW si cambian de artículo, incluso si todavía no están en el
perímetro: si entran en él después dentro de la misma transacción, se conserva el
baseline anterior al primer efecto. Insertar un baseline directamente solo puede
capturar valores reales impuestos por SQL; no permite proporcionar saldo o xid.
La entrada en el perímetro captura también baseline si no existía. Los registros
se conservan como evidencia técnica, sin tarea de limpieza automática en este corte.

La validación diferida cubre el conjunto de INSERT/UPDATE/DELETE, no solo endpoints:
movimientos con cantidad/tipo/artículo OLD y NEW, incluidos ajustes positivos y
negativos; reservas con cantidad/estado/artículo OLD y NEW. Un cambio de artículo
comprueba ambos saldos. Un déficit histórico -3 puede mejorar a-2 o quedarse en-3;
no puede acabar en-4. Se permiten efectos legacy intermedios compensados dentro de
la transacción, pero B2b nunca omite su propia precondición D_pre>=1. Los hechos
de recepción/reserva conservan además sus invariantes exactos B1/B2a/B2b.

## Perímetro persistente y su concurrencia

Nueva tabla `articulos_stock_kit`, PK/FK RESTRICT a artículos. El perímetro inicial
es la unión exacta de articulo_composiciones.articulo_kit_id (cualquier estado,
incluido borrador) y sala_suministros.articulo_id (activo o histórico). La migración
solo registra ids; no sanea saldos ni crea reservas/movimientos/atribuciones.

Todo INSERT/UPDATE de composición o suministro incorpora automáticamente los ids
NEW y conserva OLD. La pertenencia es monotónica: no se permite UPDATE/DELETE del
registro ni borrar/cambiar la PK del artículo protegido. Borrar una composición,
cambiar su artículo o retirar un suministro no desprotege reservas vivas. Una baja
definitiva del perímetro requeriría otro contrato; no hay esa operación en B2b.
El alta del registro verifica la fuente canónica composición/suministro: no acepta
un artículo arbitrario enviado como bandera de protección. Los triggers de fuente
lo registran después de que exista la fila y antes de confirmar la transacción.

La incorporación y cualquier escritura de saldos participan del mismo control
global de escritura. Si la incorporación confirma primero, la escritura posterior
ya valida el perímetro. Si la escritura confirma primero, su estado es histórico
al incorporar. Si ambas ocurren en una transacción, se usa el baseline previo al
primer efecto. RR obsoleto aborta antes de usar un perímetro viejo.

Artículos fuera de esta tabla conservan sus reglas cuantitativas actuales. Sus
escrituras en movimientos/reservas participan técnicamente en la serialización y
captura para resolver la posible incorporación concurrente, pero no reciben la
nueva restricción de déficit mientras permanezcan fuera. Este coste es explícito.
Ubicaciones no reservables y cuarentena siguen siendo L3E; no se afirma cubrirlas.

## Protocolo de locks: control antes de cualquier padre

Se sustituye la propuesta anterior de «control después de padres». Una función
SQL común solicita primero un advisory lock transaccional no bloqueante, con clave
fija documentada para este protocolo (`pg_try_advisory_xact_lock(21440,2)`). Si está
ocupado lanza40001: no espera por el control mientras retiene un padre. Si lo toma,
escribe la revisión de control_atribuciones_kit antes de leer baselines/perímetro.
La revisión escrita sigue siendo necesaria: el advisory lock solo no renueva RR.
Cada entrada puede escribir la revisión; no se admite un flag cliente para omitirla.

Se mantiene hasta COMMIT/ROLLBACK, no hasta terminar una sentencia. Así un lote que
ya tiene el control puede tomar otro padre en su sentencia siguiente: ningún otro
escritor soportado retiene ese padre esperando adquirir el control. La operación
gestionada llama a la función antes incluso de su primer SELECT FOR UPDATE.

Respaldo SQL directo: BEFORE STATEMENT INSERT/UPDATE/DELETE adquiere ese mismo
control antes de locks de filas en estas tablas: articulos, articulo_composiciones,
articulo_composicion_lineas, sala_suministros, sala_componentes_suministro, salas,
localizaciones, proyectos, hitos_proyecto, pedidos, pedido_lineas, recepciones_compra,
recepcion_lineas, recepcion_repartos, movimientos, reservas, cargas, carga_lineas,
suministro_pedido_asignaciones, reserva_suministros, movimiento_suministros,
operaciones_reserva_kit y articulos_stock_kit. No se añade ese trigger a la tabla
de control ni a baselines, para evitar recursión. Sus escrituras quedan impuestas
por funciones/triggers que verifican y adquieren el mismo control.

Los locks ROW EXCLUSIVE de tabla previos al trigger son compatibles entre estos
escritores; los locks de fila del UPDATE/DELETE y KEY SHARE por FK llegan después
del control. Las guardas de fila vuelven a solicitarlo de forma no bloqueante como
respaldo para efectos de cascada. DDL/migraciones se ejecutan en exclusiva, nunca
simultáneos con esta operativa. Las lecturas normales siguen concurrentes.

| Ruta soportada | Entrada y locks posteriores al control |
|---|---|
| B1 atribuir histórico | Entrada antes de bloquearObraCompra/bloquearPedidoCompra; salas/proyectos ordenados, padre pedido/reserva/movimiento, suministros ordenados, enlaces; FK de esos padres bajo el control ya retenido |
| B1 inversas de canónicos/jerarquía | BEFORE STATEMENT antes del UPDATE/DELETE implícito; filas objetivo y OLD/NEW, validación diferida B1. proteger_inversa y bloquear_atribuciones no abren un segundo orden |
| B2a recibir | Entrada antes de bloquearPedidoCompra; salas→proyectos→pedido→líneas→suministros/asignaciones; token/detalles/movimiento/reparto y FK mantienen sus controles exactos |
| B2b reservar | Entrada; resolver y bloquear sala/proyecto, suministro y reservas activas relevantes; releer demanda y D, capturar token, materializar reserva1/enlace; FK y validación diferida al final |
| B2b liberar | Entrada; resolver y bloquear sala/proyecto, reserva gestionada y suministro; releer identidad/estado, capturar token y activa→liberada, conservar enlace |
| Reserva/movimiento legacy | BEFORE STATEMENT antes de fila UPDATE/DELETE o INSERT/FK; BEFORE ROW captura OLD/NEW, guarda existente y nueva cota diferida. Sala NULL no excluye artículo/perímetro |
| Alta/cambio de composición/suministro | Entrada en helper antes de locks actuales; respaldo BEFORE STATEMENT, filas de catálogo/sala, registro monotónico de ambos artículos y baseline; ninguna escritura previa fuera de protocolo |
| Operación multirregistro | Entrada única antes del primer padre; conjunto de ids conocidos ordenados de antemano, una transacción para todo el lote, control retenido en sentencias posteriores. No invocar transacciones independientes dentro del lote |

Las rutas TypeScript existentes de B1/B2a, instanciarSuministro y operaciones de
almacén multirregistro se adaptan solo para entrar antes de sus locks/lecturas y
mantener la transacción del lote. No se reconstruyen módulos. ReservarLoDisponible
legacy relee y escribe su lote dentro de esa transacción; sigue sin admitir kits
por asignación automática. La matriz y el barrido de tablas deben probarse contra
el esquema real, incluidas las FK y acciones encontradas, no una lista de tests
que pueda quedar vacía. Toda tabla omitida que permita la inversión bloquea el gate.

SQL arbitrario puede haber tomado SELECT FOR UPDATE antes de llamar a una mutación.
Si otro posee el control, el intento40001 revierte su transacción completa y suelta
esas filas; no espera al control. No se promete eliminar deadlocks de programas
SQL externos que bloqueen recursos ajenos a este protocolo. Un40P01 es fallo técnico
reintentable, nunca prueba de cota correcta ni éxito de negocio. Los recorridos
soportados de la matriz deben pasar sin40P01, con las esperas/admisiones instrumentadas.

Reintentos de aplicación: máximo3 intentos de la transacción completa para40001
(ocupación/instantánea obsoleta) o40P01, con espera breve creciente fuera de TX y
token idéntico. Releer todo; no continuar una TX abortada ni reintentar solo la
sentencia fallida. Si se agota, devolver error de concurrencia y conservar el token
para reintento manual. No reintentar resultados de COMMIT inciertos por fallo de
conexión; B2a/B2b consultan su token en el reintento posterior. Errores de negocio
no se reintentan. Las pruebas fuerzan liberación del ganador antes del reintento
del perdedor y comprueban el saldo/rechazo semántico final, no aceptan40001 como
sustituto de esa comprobación.

## Interfaz y lectura

Ampliar `ReservasDeSala` con selección explícita de suministro, una unidad y botón
Reservar; reutilizar Liberar para las reservas gestionadas. No duplicar el selector
de catálogo ni cambiar el sistema visual. No habilitar por arrastre los formularios
genéricos ni el botón masivo en salas con kits. Mostrar reservado/servido/pendiente
por suministro sin convertir recibido en cobertura física.

Lectura coherente de suministro, reservas, servido y disponibilidad. La proyección
pura B1 sigue siendo la autoridad cuantitativa. Stock y enlaces históricos sin
atribución se muestran separados; no se reparten por coincidencia de artículo.

## Casos obligatorios

1. Recibir A/B2 parcialmente1 mediante B2a real. Reservar A: stock1, reservaA1/B0,
   disponible0, servido0/0, coberturaA1/B0 y pendienteA0/B1. Liberar restaura
   disponible1, cobertura0/0 y pendiente1/1, sin movimientos nuevos.
2. Repetir reservar/liberar con el mismo token no añade hechos; token alterado
   rechaza. Nuevo token para A ya reservado rechaza; nueva reserva tras liberar.
3. Fallo tras token, reserva, enlace y cambio de estado: snapshot entero intacto,
   reintento válido. Sin apagar triggers de integridad.
4. SQL directo sin token/detalle, token viejo/ajeno, baseline falso, fracción,
   cantidad2, sala/artículo ajenos, segundo efecto en misma transacción, borrar,
   reactivar o marcar servida rechazan. Dos hechos distintos válidos no se confunden.
5. A y B compiten por stock1, misma/diferente sala; mismo A con tokens distintos;
   reservar↔liberar, reservar↔recepción, reservar↔escritor legacy que compromete o
   reduce stock. Ambos órdenes y RC/RR, instrumentando control y locks reales;
   tras un40001, reintento completo y comprobación del saldo/rechazo de negocio.
   Deadlock/timeout no acredita el rechazo semántico requerido.
6. Cambio concurrente de destino/artículo se relee tras locks; no se valida una
   jerarquía vieja. Artículo compartido entre kit/independiente y entrada sala NULL.
7. Déficit histórico intacto: nueva reserva rechazada, entrada/liberación que mejora
   déficit permitida. Sin afectar el resto de artículos independientes.
8. Causales aisladas sin cota disponible, sin vínculo transaccional y sin
   idempotencia: fallos concretos de aserción, no estimaciones ni cancelaciones.
9. Regresión B1/B2a/compras, tipos/build/lint de código. Desktop desde login,
   selección A, reservar/liberar, recarga; después390/320/foco/reduced motion.
10. Cambio OLD/NEW de artículo, cantidad, signo/tipo, estado; DELETE; ajuste positivo
    y negativo; secuencia compensada válida y déficit final agravado inválido.
    Dos hechos B2b sucesivos comprueban D_pre propio y conjunto final completo.
11. Alta de perímetro↔escritura legacy ambos órdenes RC/RR; composición borrada o
    cambiada conserva perímetro viejo y protege reservas vivas. Nuevos ids entran.
12. Dos lotes con padres en orden opuesto, FK/cascadas y prelock SQL externo antes
    de intentar mutar: rollback completo, reintento con token idéntico, sin duplicados.
    Snapshot RR tomado antes del ganador debe abortar por revisión escrita; RC
    tras adquirir control ve su commit. Causal sin entrada temprana debe detectar
    la inversión como defecto del protocolo, separada de los fallos de cota.

## Gate de ejecución

Revisión de diseño primero, con las precisiones incorporadas antes de código.
Después una implementación serial de BD/transacciones; UI pura independiente si
conviene, máximo dos subagentes. Entrega artefacto+contrato+manifiesto+evidencia.
Máximo dos rondas de revisión. No autoaprobación ni cierre de B2/L3B/plan40.

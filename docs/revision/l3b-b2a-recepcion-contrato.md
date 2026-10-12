# L3B B2a · Contrato de recepción atómica

08/09/2026. Preparación para revisión previa, no implementación aprobada.
Base: B1 aprobado en ronda2, manifiesto481. La guarda operativa sigue intacta.

Resultado exacto: recibir pedidos comprados con suministros atribuidos, mediante
los formularios actuales, escribe una entrada del artículo comercial y reparte
solo el incremento recibido entre sus asignaciones; reintento sin duplicados.
Destinatario: técnico que recibe la caja y registra su entrada una sola vez.
Éxito medible: pedido2 A/B, recepción1→stock kit1, recibidoA1/B0 y físico0/0;
recepción restante→stock2, recibido1/1 y físico0/0; reintentos sin efectos nuevos.
Alcance: detalle normalizado de recepción, integración de recibirCompra y UI
existente, guardas SQL exactas, pruebas API/SQL/desktop y cierre móvil.
Fuera: alta/compra nueva de kits, reservas, carga, devolución/custodia, retirada.
Protegidos: árbol local completo, vínculos históricos, base compartida y producción.
Comprobaciones: migración limpia/upgrade/repetición, atomicidad, concurrencia,
SQL adversarial, regresión B1/compras, build/tipos/lint y navegador QA local.
Sin autorización de Git ni publicación. B2a no completa B2 ni L3B global.

## Evidencia de lectura actual

- `src/lib/operaciones-compras.ts:recibirCompra` ya bloquea sala/proyecto/pedido,
  inserta token, bloquea líneas y escribe incremento/movimiento/estado juntos.
  Falta reparto; L3A rechaza las escrituras canónicas cuando hay suministros.
- `recepciones_compra` solo contiene pedido y solicitud JSON. Su existencia no
  acredita los efectos nuevos ni distingue un token antiguo reutilizado.
- B1 acota recibido atribuido contra recibido canónico, pero no acredita un
  incremento de recepción concreto. Su operación conservativa histórica sigue
  siendo una capacidad distinta del reparto automático de una recepción nueva.
- `recibirLineaPedido` y `recibirPedidoCompleto` exigen edición de compras y
  actor real; los formularios de `detalle-pedido.tsx` ya llevan UUID de envío.
  Se reutilizan en `/compras/[id]`; no crear otro formulario ni otra ruta.

No se ha ejecutado una recepción nueva de kits para preparar este contrato.
Las pruebas de B1 no acreditan esta integración.

## Operación propuesta y autoridad de los datos

Añadir detalle inmutable por recepción/línea, UNIQUE del par y FK RESTRICT.
Guarda incremento, recibido previo capturado de línea bloqueada, artículo,
destino, ubicación y UUID del movimiento previsto. Su transacción creadora la
escribe un trigger, nunca un valor aceptado del cliente ni un simple DEFAULT.
Reparto normalizado por detalle/suministro: recibido previo e incremento.

Insertar el detalle ejecuta la operación SQL de línea, movimiento y reparto.
El servidor calcula sus datos desde línea/asignaciones bloqueadas. No acepta
baselines, UUID de artículo, sala o reparto arbitrario enviados desde formulario.
Se conserva la solicitud del token y se valida contra pedido/línea/cantidad/
ubicación/autor reales. Tokens y detalles son inmutables.

`recibirCompra` conserva el control de sesión, la compra final registrada y el
orden de locks. Para el pedido afectado por la guarda de kits, crea detalles
de todas las líneas elegidas, también independientes si el pedido es mixto.
Las líneas comerciales de kit exigen atribución explícita previa; el sobrante
de cantidad pedida queda recibido sin destino atribuido. No crea asignaciones
por parecido ni atribuye de golpe recepciones históricas previas.

El reparto consume únicamente el incremento de esta recepción, por orden
`creado_en, suministro_id`. Cada asignación recibe como máximo lo pendiente.
El registro de reparto conserva cuánto se asignó y cuánto quedó sin atribuir.
Cantidades de kit enteras; artículos independientes conservan sus unidades.

Un pedido compartido conserva `sala_id=null` en su movimiento de entrada.
El recibido de A/B lo acredita la asignación de pedido. No se usa aquí
`movimiento_suministros` para inventar una sala de entrada ni se cambia su
contrato B1: sigue ligando salidas/devoluciones concretas a su suministro.

## Sustitución estrecha de L3A

Ninguna GUC, bandera del navegador, función desactivada o excepción por nombre
del llamador. La excepción exige detalle creado en la transacción actual y
valores exactos. Un token/detalle antiguo no puede autorizar un efecto nuevo.

| Tabla | Única escritura admitida bajo la excepción |
|---|---|
| pedido_lineas | Incremento recibido del baseline capturado al valor previsto; resto intacto |
| movimientos | INSERT de entrada con UUID, cantidad, artículo, ubicación, sala, pedido y token previstos; nunca piezas |
| suministro_pedido_asignaciones | Incremento recibido igual al reparto calculado del detalle, sin cambiar identidad/cantidad |
| pedidos | Estado de recepción derivado de las líneas; resto intacto |
| reservas/cargas/carga_lineas | Ninguna excepción; siguen bloqueadas |

Comprobación diferida desde detalle y efectos protegidos: movimiento único
exacto, incremento canónico completo, reparto exacto y acotado, token coherente,
estado derivado y ausencia de efectos sin detalle actual. UPDATE/DELETE de
tokens, detalles y movimientos de recepción protegidos se rechaza.

Los cambios de cantidad pedida, precio, artículo, destino y demás operaciones
genéricas no se habilitan. Las inversas B1 antes interceptadas por L3A solo se
acreditan en los caminos que esta recepción abre; las demás siguen pendientes.

Con un mismo rol SQL, un escritor puede construir el mismo hecho válido que la
función. El contrato garantiza integridad del hecho, no identidad del código
llamador. No se introducen roles/permisos nuevos para simular esa distinción.

## Concurrencia, fallos e idempotencia

Orden: salas, proyecto, pedido, líneas, suministros/asignaciones ordenados y
control B1. No tomar primero el control global y esperar después a sus padres.
El token repetido con solicitud idéntica vuelve sin efectos; con otros datos
rechaza. Los efectos y el token se confirman juntos. Un fallo permite reintento
del mismo token porque la transacción revierte también su alta.

Casos obligatorios, con baseline y filas finales, no solo códigos de error:

1. A/B, primera y segunda recepción; stock de componentes0, físico0/0 siempre.
2. Pedido compartido entre salas y pedido mixto; sin sala ficticia en entrada.
3. Histórico recibido previo y sobrante sin asignación: repartir solo incremento.
4. Reintento secuencial/concurrente mismo token; token distinto por última unidad,
   ambos órdenes, una recepción válida y la otra rechazada por exceder pendiente.
5. Recepción y atribución concurrentes: orden estable y sin perder incrementos.
6. Fallo después de token, detalle, línea, movimiento, reparto y estado: rollback
   completo, seguido de reintento correcto. No apagar triggers de integridad.
7. SQL directo: efecto sin detalle, token antiguo, cantidad distinta, reparto a B
   saltándose A, detalle incompleto, modificación de token o de entrada histórica.
8. Reserva, salida genérica y carga siguen rechazadas por L3A.
9. Tipos/identidades/cotas B1 y permisos/actor real de acciones actuales intactos.
10. Mutantes aislados: sin reparto, sin vínculo de transacción y sin idempotencia;
    contar fallos concretos, sin contar timeout como detección causal.

## Interfaz y entrega

Mostrar por suministro lo recibido y pendiente en el pedido actual, conservando
tokens, estilos, formularios y selector de almacén. Recibido no se presenta como
reservado ni servido. Advertir cantidad sin atribuir cuando exista; no inventar
procedencia. Mantener deshabilitadas operaciones aún pendientes en logística.
Cabecera, cantidades de líneas y reparto deben pertenecer a una misma lectura
coherente; no combinar recibido canónico anterior con asignaciones posteriores.
Los pedidos compartidos muestran la obra como destino, sin crear una sala.

QA solo UUID local: escritorio desde login y pedido, recepción parcial, recarga,
reintento y persistencia; luego390/320, foco, overflow y reduced motion. La prueba
técnica final/check-in y entrega/check-out no se cambian ni se dan por cumplidos.

Entrega futura: contrato, artefacto, manifiesto, causal y evidencia ejecutada al
revisor independiente. Esta preparación requiere revisión del mecanismo de
excepción antes de escribirlo; no es una aprobación de implementación ni cierre.
Máximo dos rondas por artefacto; sin Git ni producción.

## Precisiones vinculantes del diseño aprobado

Dictamen `output/revisor-plan40-01a080e5/l3b-persistencia/diseno-b2a-dictamen.md`:
diseño aprobado, implementación todavía pendiente. Estas precisiones prevalecen.

- Completitud diferida desde el token aunque no tenga detalles: se captura y
  exige el conjunto exacto de líneas y cantidades solicitadas. Token vacío o
  parcial con pendiente rechaza; no puede consumir el identificador y ocultar un
  reintento. Recepción completa de pedido ya recibido es no-op explícito, sin
  movimiento ni detalle; la recepción parcial de línea agotada se rechaza.
- Los tokens históricos conservan protocolo legacy; no se reinterpreta su JSON
  como captura completa retroactiva. Los nuevos afectados por kits usan protocolo
  explícito determinado por servidor, no una elección del cliente.
- Transacción actual es condición necesaria, no suficiente: OLD debe ser el
  baseline capturado y NEW exactamente baseline+incremento. Reutilizar el mismo
  detalle dentro de la misma transacción no autoriza un segundo incremento.
  La identidad de transacción almacenada no puede reciclarse ni ser suministrada
  por cliente; la escribe el servidor y permanece inmutable.
- El materializador SQL valida compra final, pendiente, unidad, destino y
  ubicación. La guarda no depende de haber pasado primero por TypeScript.
- Probar token vacío/parcial, reutilización del detalle en la misma transacción,
  baseline/transacción falsos y token histórico. Dos recepciones distintas dentro
  de una transacción son válidas solo con sus baselines e incrementos sucesivos
  exactos; completitud final comprende ambas y no confunde el primer estado
  intermedio con el estado final. Recepción frente a atribución se prueba en
  ambos órdenes y también bajo REPEATABLE READ.

La comparación final por línea tiene que sumar los detalles nuevos de esa
transacción desde el primer baseline, además de comprobar cada transición
OLD→NEW cuando ocurre. No se exige que un detalle intermedio describa por sí
solo el último estado tras dos recepciones legítimas.

# L3B · Entrega B1, atribución persistida conservativa

08/09/2026. Pendiente de dictamen independiente, no acredita L3B global.

## Contrato y estado

`l3b-persistencia-contrato.md`, diseño final L3 y contrato de ejecución L3.
Base aprobada: manifiesto474, subcorte puro de cobertura.
Estado entregado: `output/plan40-l3b-persistencia-20260908/manifiesto-entrega.json`
y `delta.json`. Sin commit. Ejecutor `01a080e4-d9a1-7500-ae26-d93eccbd139d`;
revisor `01a080e5-20d4-7191-b610-82ac1a263b11`.

## Artefacto y migración

- `db/migraciones/2026-09-atribuciones-suministro.sql`, bloque equivalente en
  `db/schema.sql`: asignaciones de pedido con recibido atribuido, reservas y
  movimientos por suministro; devolución ligada a salida del mismo suministro.
  FK RESTRICT, UNIQUE del par, cantidades exactas unitarias y restricciones
  finales diferidas. No backfill ni inferencia de vínculos históricos.
- `src/lib/atribuciones-suministro-db.ts`: operación interna transaccional de
  atribución explícita a un registro existente; relee y bloquea destino/padre y
  suministros. Lector en REPEATABLE READ, reusable en una transacción compuesta,
  con proyección aprobada y avisos por cantidades aún no atribuidas.
- `scripts/ejecutar-atribuciones.mjs` y `verificar-atribuciones.mts`: base UUID,
  migración/upgrade, pruebas reales y mutante de cota del padre reserva.
- `scripts/ejecutar-suministros.mjs`: su reconstrucción anterior a L3A excluye
  también el bloque B1 dependiente; después sigue aplicando el esquema completo.
  No cambian sus aserciones ni las guardas operativas L3A.

El cerrojo transaccional escribe una revisión de control. Serializa escrituras
de atribución y cambios inversos vinculados, también frente a instantáneas RR.
Las lecturas no lo toman. Es un coste de concurrencia explícito: este corte no
acredita rendimiento para escritura masiva de kits. Los padres y suministros
se bloquean antes de atribuir; las sumas validan solo los suministros afectados
y los registros canónicos relacionados, apoyadas por índices.

Las atribuciones históricas no se borran ni reasignan. Solo puede aumentar el
recibido de una asignación de pedido conservando su identidad y cotas.
La futura cancelación integral sigue dependiendo de L3D; no se simula aquí.

## Criterios y evidencia ejecutada

E = `output/plan40-l3b-persistencia-20260908/`.

| Esperado | Observado | Evidencia |
|---|---|---|
| Upgrade no convierte históricos; repetición y schema equivalentes | Reserva anterior idéntica, cero enlaces implícitos | `sql-definitivo.log` |
| Pedido2 A/B, recibido1 solo A, físico0/0 | Cantidades y lector real separados | `sql-definitivo.log` |
| Pedido compartido, salas de su obra | Dos salas admitidas; cruce de obra y contradicción sala/obra rechazados | `sql-definitivo.log` |
| Padres no sobreasignados y demanda1 | Rechazo de reserva, movimiento, compra y recibido excedidos | `sql-definitivo.log` |
| Identidad exacta | Artículo erróneo con sala correcta y sala errónea con artículo correcto rechazados | `sql-definitivo.log` |
| Salida A, devolución A, baja | A1/B0 pasa a A0/B0; registros canónicos idénticos | `sql-definitivo.log` |
| Retorno cruzado o doble | Rechazos SQL y FK real | `sql-definitivo.log` |
| Historia servida/liberada, legacy sin atribuir | Cobertura0/0 y seis avisos sin asignación automática | `sql-definitivo.log` |
| Lote inválido revierte completo | Cero atribuciones después de rechazo diferido | `sql-definitivo.log` |
| Concurrencia ambos órdenes | Doce carreras con espera observada, segundo rechazo y saldo final; RR rechaza instantánea obsoleta | `sql-definitivo.log` |
| Lectura coherente | RR conserva estado anterior; lectura nueva ve atribución confirmada | `sql-definitivo.log` |
| Historial protegido | DELETE de vínculo rechazado, padre RESTRICT y reasignación rechazada | `sql-definitivo.log` |
| Inversa de jerarquía | Mover sala/localización a otra obra se rechaza y revierte | `sql-definitivo.log` |

Comandos y resultados del director, 08/09/2026:

- `node scripts/ejecutar-atribuciones.mjs --plan`, leído antes de ejecutar.
- `node scripts/ejecutar-atribuciones.mjs`: **23/23**, cero omitidos/TODO/cancelados.
- `node scripts/ejecutar-atribuciones.mjs --sin-cota-padre`: **20/23, tres fallos
  de aserción**, exit1 esperado; sin timeout/cancelaciones. `sql-causal-definitivo.log`.
  El mutante modifica solo la función SQL dentro de su UUID QA y la base se elimina.
  Fallan lote reserva1→A/B y las dos carreras sobre ese padre. No se debilitó
  ningún test para obtener el resultado base.
- `node scripts/ejecutar-suministros.mjs`: **16/16**, `l3a.log`.
- `node scripts/ejecutar-compras-integrales.mjs`: **20/20**, `compras.log`.
- `npm.cmd test`: **770/770**, `generales.log`.
- `npm.cmd run build`, `npm.cmd run typecheck`, `npx.cmd eslint src scripts`:
  exit0, `build-final.log`, `tipos-cierre.log`, `lint-final.log`.
- `node scripts/verificar-base-plan40.mjs`: siete verificadores seriales,
  `regresion-base-final.log`, con logs individuales en el directorio que indica.
  Última base `qa_plan40_base_21947ab6c8a74a60af81e290a0c50e9e`, eliminada.
- `node output/plan40-l3b-persistencia-20260908/preservacion.mjs`: esquema
  anterior byte a byte fuera del bloque nuevo; runner solo adaptación de
  dependencia; resto de archivos anteriores intactos salvo notas de estado.
- `node output/plan40-l3b-persistencia-20260908/comprobar-bases.mjs`: las16
  bases propias registradas en logs están ausentes; `bases-cierre.json`.

Los logs iniciales fallidos se conservan: error de sintaxis CASE corregido y
colisión de nombre de localización QA que impedía alcanzar la inversa pretendida.
La prueba final exige el mensaje de la inversa real; no se aceptó aquella colisión
como evidencia del rechazo correcto.

## Límites de este dictamen

Los nuevos triggers inversos de los padres se instalan, pero UPDATE de cantidad,
artículo, destino y estado canónicos con kits sigue interceptado por L3A. Su
rechazo conserva el registro; **no acredita el disparo de la nueva inversa**.
La evidencia nueva ejecutada de inversas es la de jerarquía y FK DELETE.
Las transiciones canónicas se deben ejercitar al sustituir la puerta en B2.

No hay acción/UI pública de atribución todavía. No se ha habilitado reserva,
recepción ni carga de kits; los registros de prueba existían antes de instanciar
sus suministros. Este corte no acredita stock reservable, recepción idempotente
con reparto, consumo de reserva/salida conjunta, permisos de una nueva acción,
retorno físico completo, cuarentena ni gestión de piezas averiadas. B2 y L3E
conservan esos requisitos. Retirada poscompra sigue bloqueada hasta L5.

No hay recorrido UI nuevo porque no se modifican ni conectan pantallas. El gate
visual integrado de L3 sigue pendiente. No se tocó base compartida ni producción.
Solo bases QA UUID propias; cada runner las cierra y elimina en finally.

Reversión: no ejecutar rollback de una migración sobre datos reales desde esta
entrega. En QA se elimina exclusivamente la base UUID del runner. Para retirar
el artefacto local se coteja su delta y se retiran solo adiciones de B1; nunca
restaurar HEAD ni eliminar archivos ajenos. Historial/evidencias se conservan.

Se solicita revisión de B1 en este alcance persistido conservativo y sus límites.
No se solicita aprobación de L3B global ni cierre de plan40. Sin Git/publicación.
Agentes y pruebas del ejecutor terminados; no se escribe durante la revisión.

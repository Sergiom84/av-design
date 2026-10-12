# B2a · Corrección P1, ronda2

08/09/2026. Pendiente de dictamen independiente. Base congelada489 de ronda1.
Contrato original vigente: `l3b-b2a-recepcion-contrato.md`.

Hallazgo: `output/revisor-plan40-01a080e5/b2a/dictamen-ronda1.md`.
Una entrada con sala NULL podía eludir la guarda del pedido compartido usando
token legacy o ninguno. El reproductor original, sin modificar, falló antes y
pasa después: `output/plan40-b2a-ronda2-20260908/repro-antes.log` y
`repro-despues.log`. Ambas variantes rechazan y conservan saldo1, recibido1,
atribuido1, detalles0; la recepción histórica se conserva.

## Corrección

`exigir_movimiento_pedido_sin_kits(linea)` resuelve la sala y obra desde la línea
canónica. Bloquea salas, proyecto, pedido y línea en ese orden; relee el destino
tras esperar y rechaza si cambió. La guarda de movimientos la llama para los
estados viejo/nuevo cuando hay línea de pedido, aunque no haya sala ni token.
Si el pedido tiene kits, exige el detalle exacto de la recepción actual.

La excepción de una recepción legítima continúa exigiendo identidad, cantidad,
autor y transacción exactas. El resto del algoritmo, formularios y lector no
cambió. No se reinterpreta el histórico ni se habilitan operaciones adicionales.
La migración y el bloque equivalente de schema se mantienen iguales.

## Evidencia ejecutada de esta corrección

En `output/plan40-b2a-ronda2-20260908/`:

- `sql.log`:21/21, instalación/upgrade/repetición/equivalencia. Cuatro nuevas
  pruebas: entrada compartida sin token, legacy, legacy de otra línea; comparación
  completa antes/después. Carrera alta de kit↔entrada en ambos órdenes RC/RR:
  kit primero rechaza entrada; entrada antes de kit permanece histórico válido.
- `causal.log`:4 fallos concretos de21,0 canceladas. El mutante
  `--sin-destino-pedido` retira solo la comprobación de kits del destino canónico,
  conservando los locks para que la causal no dependa de timeouts. Fallan los
  tres rechazos y la aserción de la carrera, no una espera agotada.
- `b1.log`:24/24. `compras.log`:20/20. `generales.log`:774/774.
- `tipos.log`:exit0, sin incremental. `lint.log`:eslint src/scripts exit0.

No se debilitaron aserciones preexistentes. El nuevo rechazo conserva también
el texto exacto esperado por la prueba anterior de detalle incompatible.
Build y recorrido desktop/móvil de ronda1 siguen siendo evidencia de aquella
ejecución: no se reejecutaron en ronda2; los archivos UI/lector/runtime TypeScript
de aplicación mantienen sus hashes489. La incidencia RSC y lint global sobre
Inicio siguen documentadas en la entrega anterior.

Manifiesto y delta de ronda2 en esta carpeta de evidencia. Todas las bases
propias cerradas/eliminadas; sin agentes, servidor ni navegador nuevos.
Exclusividad devuelta al revisor al enviar esta corrección. B2a pendiente de
dictamen, B2b sin iniciar y plan40 abierto. Sin Git ni producción.

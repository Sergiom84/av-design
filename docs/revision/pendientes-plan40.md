# Plan 40 · trabajo pendiente comprobado

**Corte vigente: B2b aprobado sobre507.** Dictamen independiente en
`output/revisor-plan40-01a080e5/b2b/dictamen-ronda1.md`. Preparar y revisar
contrato B2c (carga/salida unitaria desde reserva gestionada) antes de código.
Compra nueva, cierre/devolución de kits y demás unidades siguen pendientes.
No implica aprobación de B2/L3B global ni cierre del plan40.

**Corte vigente B2b:** recepción B2a aprobada sobre490; reserva/liberación B2b
entregada según `l3b-b2b-reserva-entrega.md`, pendiente del revisor independiente.
Esperar dictamen antes de otra unidad. Compra nueva, carga y demás operaciones de
kits mantienen sus límites; B2, L3B global y plan40 no están cerrados.

**Actualización B1:** APROBADO en ronda2, manifiesto481; P2 cerrado.
Siguiente B2: integración de recepción idempotente y atribución, después reserva
y carga; mantener bloqueo hasta validar cada operación completa. L3B global pendiente.

**P2 B1 en ronda2:** corrección entregada según `l3b-retorno-correccion-ronda2.md`.
Esperar dictamen; no avanzar B2 ni marcar B1/L3B global terminado.

**B1 persistencia entregada:** `l3b-persistencia-entrega.md`, sin dictamen aún.
Pendientes B2: integración atómica, inversas canónicas que hoy intercepta L3A,
recepción idempotente, reserva/carga y UI. L3B global permanece abierto.

**Actualización:** proyección pura L3B APROBADA sobre manifiesto474.
Siguiente: persistencia B1, después integración B2. No acredita L3B global.

**Corte L3B:** proyección pura entregada según `l3b-proyeccion-entrega.md`,
pendiente de revisión. Persistencia B1, integración B2 y L3B global siguen
pendientes. Ninguna operación nueva habilitada ni aprobación global inferida.

**Actualización posterior:** L3A APROBADO en ronda2 sobre manifiesto470;
dictamen `output/revisor-plan40-01a080e5/l3a/dictamen-ronda2.md`.
Siguiente unidad L3B: atribución comercial por suministro y recepción idempotente.
L3 global, L3C–L3F y L4–L8 siguen pendientes; sin autorización Git/producción.

**Estado vigente 08/09/2026:** L2B aprobado por revisor
`01a080e5-20d4-7191-b610-82ac1a263b11`, dictamen
`output/revisor-plan40-01a080e5/dictamen-l2b-correccion.md`.
L3A implementado y entregado según `l3a-entrega.md`, pendiente de revisión.
L3B–L3F y L4–L8 pendientes. Las notas inferiores son cortes históricos.
Ninguna aprobación de implementación de L3 ni autorización Git/producción.

**Cierre para cambio de conversación:** consultar `traspaso-ejecucion-plan40.md`.
Incluye los últimos fallos de fixtures, correcciones sin reejecutar y causal UI
no acreditada. No hay agentes escribiendo ni otro lote iniciado; L2B no aprobado.

Corte actualizado: 08/09/2026, tras aprobación de L2A en ronda 1. Lectura del plan,
estado y entregas locales; no se han ejecutado migraciones ni operaciones Git
para elaborar esta matriz. «Implementado» no equivale a «aprobado» y un diseño
aprobado no acredita su implementación. Estado operativo: [estado-plan40.md](estado-plan40.md).

| Lote | Implementación o base existente | Aprobación recibida | Qué falta para cerrar |
|---|---|---|---|
| L0 | Preservación del árbol, comandos reproducibles y verificación de migraciones | Sí, ronda 2; `l0.md` | Sin trabajo abierto dentro del gate L0. No acredita UI completa ni publicación. |
| L1A | Sincronización segura de puertos CSV, guardas de cantidades y referencias vivas | Sí, ronda 2; `l1a.md` | Regresión cuando L1B o L2 amplíen relaciones. Base aprobada: 14/14; causales CSV 2 fallos, SQL anterior 11. |
| L1B / L1 | CSV técnico, hechos tipados, tabla aditiva, fuentes y ficha consultable; correcciones verificadas | Sí, ronda 2; dictamen independiente cierra L1 documental y sincronización | Mantener regresión; no equivale a acreditar todo el inventario físico ni el asistente L4. |
| L2 | L2A aprobado; L2B dominio, SQL, editor y Plano con pruebas por unidades | L2A aprobado en ronda 1; diseño L2B aprobado | Cerrar integración L2B de servidor y tres copias; adaptar verificadores, ejecutar UI real y revisión global. Cuatro tiradas CSV pasan a documentales pendientes de bocas, sin inventar conexiones. `l2b-dominio.md`, `l2b-editor.md`, `l2b-persistencia.md`, `l2b-tiradas-documentales.md`, `l2b-plano-dictamen.md`. |
| L3 | Diseño comercial/físico y asignación trazable de kits | Solo diseño previo, con precisión final de integridad | Implementar composición, snapshot, asignación por sala, accesorios incluidos y copias; impedir doble compra. Para retirar componentes ya comprados exige antes snapshot íntegro de diseño L5. `l3-diseno-previo.md`, sección final manda sobre propuestas anteriores. |
| L4 | Asistente existente, perfiles estáticos, búsqueda remota y semáforo; inventario de 17 pruebas existentes correctas | No | Integrar hechos L1 y kits L3; seis ensayos: kit sin micro, barra integrada, desconocido, duplicado, boca agotada y cable insuficiente. Avisos con causa/elemento/acción y conservación ante rechazo. `l4-inventario-previo.md`. |
| L5 | Compras/recepción/almacén y seguimiento ya existen; L0 reproduce parte de esa base | No para la ampliación L5 | Reparto de pedidos comunes, cobertura por sala, devoluciones, diseño posterior a compra, revisión/snapshot de diseño y vigencia explícita de pruebas/aceptación. Concurrencia y permisos. `l5-inventario-previo.md`. |
| L6 | Documentos, planta y tabla actuales | No | Esquema gráfico completo dentro del PDF, revisión de diseño, kits y rosetas; inspeccionar todas las páginas de sala pequeña y densa y contrastar con app. |
| L7 | Hay ensayos parciales de ficha L1; no son el recorrido de aceptación | No | Ejecutar los 16 pasos de plan 40 en UI con proyectista y técnico distintos; técnico creado después de compra. Escritorio completo, luego 390/320 px, foco y demás cierres. |
| L8 | Árbol preservado y evidencia local por lotes | No | Candidato final, diff/manifiesto, restauración/actualización local, orden de migraciones y runbook/rollback. Publicación y producción requieren autorización separada. |

## Cobertura recalculada en este corte

La reproducción histórica anterior a L2A mostró que borrar el primer HDMI
renumeraba el segundo de HD-1001 a HD-1000. L2A corrige este comportamiento y
su implementación está aprobada con pruebas y recorrido real (`l2a.md`).

Se ejecutaron `node scripts/informe-cobertura-catalogo.mjs --json` y `--csv`
contra el CSV de ronda 2 ya estabilizado por su responsable, ambos con salida 0.
Resultados: 872 referencias, 26 con algún puerto, 147 grupos de puertos,
40 hechos vinculados a seis referencias, cero hechos huérfanos o inválidos y
cero fichas completas acreditadas. El informe ya incorpora `concepto` y
`puerto_fuente`; no requirió cambios de código en esta revisión.

Evidencia: `output/plan40-20260908-083450/l1-cobertura-ronda2.json` y `.csv`.
El JSON incluye huellas de los CSV leídos. Es cobertura de fuentes locales,
no del contenido de Postgres ni certificación física del inventario. Las
referencias están ordenadas por uso registrado; ampliar otras fichas pertenece
a Después, sin prometer cobertura completa cuando no hay documentación fiable.

## Discrepancias que debe corregir la siguiente entrega

- `l1.md` ya corrige el aplazamiento de identidad y longitud a L4: ambas se
  cierran en L1B. Mantiene resultados de primera ronda junto a la corrección
  pura/DOM (11 correctas; variante causal con cinco fallos). Actualizar el
  paquete con integración y UI finales, sin sobrescribir logs históricos.
- Los encabezados de los documentos de diseño pueden seguir diciendo propuesta
  pendiente, aunque `estado-plan40.md` registre aprobación posterior. Leer sus
  precisiones finales y el dictamen recibido; no convertirlos en gate de código.
- La reproducción de L0 o las pruebas generales intermedias no sustituyen los
  casos nuevos L2–L8. Tampoco el QA de ficha acredita instalación, kit, compra,
  aceptación ni PDF completo.

La tarea revisora «Mejora el flujo de diseño» es la identificada por el contrato
como `01a07f5b-56ed-7bb3-8295-766f2d4d5057`. Consulta directa del 08/09/2026:
estado inactivo, última revisión completada sin error (turno
`01a08042-5187-79c3-b8c2-c3df4e67e32d`). El dictamen aprueba L2A en ronda 1.
La consulta posterior sobre las cuatro tiradas CSV también terminó sin error: aprobó separarlas como documentales pendientes. El plan completo sigue abierto y L2B está en integración. No consta un bloqueo
por límite. Si aparece, transferir este estado, el plan, artefactos y evidencias
del árbol actual; no iniciar un checkout desde HEAD.

# Corte vigente B2a

B2b: diseño ronda1 requirió precisiones; ronda2 corregida y pendiente de revisión.
No hay código ni guardas B2b implementadas. Sigue mandando B2a490 aprobado.

B2a aprobado en ronda2 sobre490. Siguiente gate: revisión de diseño de
`l3b-b2b-reserva-contrato.md`, sin código B2b todavía. B2/L3B/plan40 abiertos.

Ronda1 exigió corregir P1 de entradas compartidas sin detalle. Corrección ronda2
en `l3b-b2a-correccion-ronda2.md`, pendiente de dictamen; no iniciar B2b.

Recepción entregada en `l3b-b2a-recepcion-entrega.md`; falta dictamen independiente.
No iniciar B2b mientras dure la revisión. B1 aprobado; B2/L3B/L3/plan40 abiertos.
El historial inferior no sustituye este corte. Sin autorización de Git/publicación.

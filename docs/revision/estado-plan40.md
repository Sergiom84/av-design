# Estado de ejecución del plan 40

**B2b APROBADO en ronda1 de implementación, manifiesto507.** Dictamen:
`output/revisor-plan40-01a080e5/b2b/dictamen-ronda1.md`, revisor confirmado
`01a080e5-20d4-7191-b610-82ac1a263b11`. Recursos del revisor cerrados y
exclusividad de BD devuelta al ejecutor. Siguiente corte: contrato B2c de carga
unitaria; todavía sin implementación. B2, L3B y plan40 permanecen abiertos.
Las entradas inferiores son cortes históricos.

**B2b entregado, pendiente de dictamen independiente.** Artefacto y evidencia en
`l3b-b2b-reserva-entrega.md`; SQL66/66, B1 24/24, B2a21/21, compras20/20,
generales778/778, build/tipos/lint de código0; desktop y cierre móvil ejecutados.
Árbol congelado, subagentes y pruebas cerrados, QA propias eliminadas. No hay
aprobación de implementación B2b ni cierre de B2/L3B/plan40.

**Unidad activa B2b: implementación, diseño aprobado en ronda2.** Dictamen:
`output/revisor-plan40-01a080e5/b2a/diseno-b2b-ronda2.md`.
Reserva/liberación unitaria y control transaccional en ejecución serial de BD;
formularios y lector coherente en integración. Falta completar y reproducir los
gates y entregar el artefacto al revisor. No hay aprobación de implementación.
B2, L3B global y plan40 permanecen abiertos. Los cortes inferiores son historial.

**B2b, diseño ronda2 enviado:** contrato corregido en
`l3b-b2b-reserva-contrato.md`; pendiente de dictamen antes de código. Se precisan
cobertura B1, déficit transaccional, perímetro persistente y matriz de locks.

**B2a aprobado en ronda2, manifiesto490.** Dictamen independiente:
`output/revisor-plan40-01a080e5/b2a/dictamen-ronda2.md`. P1 cerrado.
B2b en preparación de contrato; no implementación aprobada ni apertura de
reserva/carga. B2, L3B global y plan40 continúan pendientes.

**B2a ronda2, corrección del P1 entregada:** `l3b-b2a-correccion-ronda2.md`.
21/21 SQL, causal4 fallos, reproductor independiente antes/tras. Pendiente de
dictamen; B2a no aprobado y B2b sin iniciar. Árbol congelado para revisión.

**B2a entregado, pendiente de revisión:** `l3b-b2a-recepcion-entrega.md`.
Núcleo17/17, B1 24/24, compras20/20, generales774/774; aceptación desktop y
móvil ejecutada. Árbol congelado para revisor independiente; B2/L3B siguen abiertos.

**Unidad activa: L3B B2a, recepción.** Diseño aprobado con precisiones en
`l3b-b2a-recepcion-contrato.md`; implementación y aceptación aún en curso.
No hay aprobación de implementación B2a ni apertura general de logística.
Los cortes inferiores son historial; B1 conserva su aprobación en ronda2.

**Dictamen vigente B1:** APROBADO en ronda2 sobre manifiesto481;
`output/revisor-plan40-01a080e5/l3b-persistencia/dictamen-ronda2.md`.
P2 cerrado. B2 en preparación serial, sin apertura de la guarda operativa.
L3B global, L3 y L4–L8 siguen pendientes.

**B1, corrección ronda2 del P2:** `l3b-retorno-correccion-ronda2.md`.
Devolución conjunta con salidas distintas: SQL y lector0/0; pendiente de dictamen.
B1 no aprobado; B2 detenido. Árbol congelado para revisión independiente.

**Entrega B1 persistencia:** `l3b-persistencia-entrega.md`, pendiente de dictamen.
23/23 SQL, causal3 fallos, guardas L3A intactas. B2 y L3B global pendientes.
Árbol congelado para el revisor; ejecutor sin agentes/pruebas activos.

**Dictamen vigente del subcorte puro L3B:** APROBADO, manifiesto474;
`output/revisor-plan40-01a080e5/l3b-proyeccion/dictamen.md`. B1 persistencia
en implementación serial según `l3b-persistencia-contrato.md`. L3B global pendiente.

**L3B, subcorte puro de cobertura:** artefacto y contrato en
`l3b-proyeccion-entrega.md` y `l3b-proyeccion-contrato.md`, pendiente de dictamen.
No acredita B1 persistido ni L3B completo. Guardas L3A intactas; siguiente unidad:
atribuciones persistidas con límites canónicos, inversas, concurrencia y rollback.

**Dictamen vigente L3A:** APROBADO por `01a080e5-20d4-7191-b610-82ac1a263b11`
sobre manifiesto470, `output/revisor-plan40-01a080e5/l3a/dictamen-ronda2.md`.
P2 cerrado. L3B en preparación/implementación serial; L3 global y L4–L8 pendientes.

**Corrección L3A, ronda2:** P2 de lectura concurrente del revisor; entrega en
`l3a-correccion-lectura.md`, pendiente de dictamen. L3B no iniciado.

**L3A entregado para revisión independiente:** `l3a-entrega.md`. No aprobado.
L3B no iniciado. El estado vigente de L2B es la aprobación indicada debajo;
los cortes anteriores se mantienen solo como historial.

**Dictamen vigente:** L2B aprobado por `01a080e5-20d4-7191-b610-82ac1a263b11`
sobre manifiesto456, `output/revisor-plan40-01a080e5/dictamen-l2b-correccion.md`.
P1 cerrado con reproducción independiente. L3A en implementación serial según
`l3-contrato-ejecucion.md`; L3 global y L4–L8 pendientes. Sin autorización Git,
publicación ni producción. Las notas inferiores conservan los cortes anteriores.

**Revisión de corrección L2B:** el revisor detectó un P1 de copia concurrente.
Corrección y evidencia en `l2b-correccion-integridad.md`; pendiente de su
dictamen. La primera entrega y su manifiesto se conservan. L3 no iniciado.

**Continuación 08/09/2026:** ejecutor `01a080e4-d9a1-7500-ae26-d93eccbd139d`;
nuevo revisor confirmado `01a080e5-20d4-7191-b610-82ac1a263b11`.
L2B entregado para dictamen, todavía no aprobado. Contrato, manifiesto y
evidencia actual en `l2b-entrega-continuacion.md`. El corte histórico de abajo
se conserva como procedencia; sus fallos se han reejecutado según esa entrega.
L3–L8 pendientes, sin operaciones Git de escritura ni publicación.

Checkpoint local, 08/09/2026. No hay commit, publicación ni migración de producción.
**Ejecución detenida por Sergio para traspaso.** Estado final, fallos abiertos,
manifiesto y próxima acción en `traspaso-ejecucion-plan40.md`; ese corte prevalece
sobre resultados intermedios de este documento. L2B sigue sin aprobación.
El árbol inicial se preservó en `output/plan40-20260908-083450/` con manifiesto,
diffs separados y copia de archivos locales. No restaurar desde HEAD.

| Unidad | Estado | Evidencia / siguiente gate |
|---|---|---|
| L0 | Aprobado por revisor en ronda 2 | `l0.md`; base 696 pruebas, build/tipos/lint y Postgres específicos ejecutados |
| L1A | Aprobado por revisor en ronda 2 | `l1a.md`; 14/14, variantes causales CSV y SQL, regeneración idéntica |
| L1B | Aprobado en ronda 2 | Revisor reproduce 12 PostgreSQL, 14 puertos, 11 dominio/DOM, 707 generales, tipos/lint y causales CSV4/SQL2/ficha5; manifiesto25/25 |
| L1 completo | Aprobado en su alcance documental y sincronización | Dictamen explícito de la tarea revisora; no acredita inventario físico completo, kits ni asistente |
| L2 | L2A aprobado en ronda 1; L2B en integración | Revisor reproduce 715 generales, 11 PostgreSQL, siete verificadores incluidos editor26/plantillas40 y causales; diseño L2B aprobado |
| L3 | Diseño previo aprobado tras revisión de integridad | `l3-diseno-previo.md`, manda su precisión final; no hay implementación aprobada |
| L4 | Pendiente | Inventario de funciones existentes antes de ampliar |
| L5 | Pendiente | `l5-inventario-previo.md`; snapshot de diseño es prerrequisito para retirar componentes comprados de L3 |
| L6 | Pendiente | Esquema imprimible y examen de todas las páginas |
| L7 | Pendiente | Recorrido completo UI con dos usuarios; escritorio antes de móvil |
| L8 | Pendiente | Candidato y runbook; producción requiere autorización separada |

Revisor: tarea `01a07f5b-56ed-7bb3-8295-766f2d4d5057`, “Mejora el flujo de diseño”.
Las aprobaciones de diseño no son aprobaciones de implementación ni de publicación.

Comprobación directa de la tarea revisora: L2A aprobado, revisión completada sin
error. Se consultó después la incompatibilidad entre cuatro tiradas CSV sin
bocas y las nuevas guardas. Su dictamen arquitectónico aprobó conservarlas como
tiradas documentales pendientes (`l2b-tiradas-documentales.md`); esa última
consulta también terminó sin error y la tarea quedó inactiva. No terminó el plan.
No consta un bloqueo por límite. Si aparece, transferir estado, plan y evidencias,
conservando el árbol local completo.

L2B: dominio reproducido por el director 168/168; lectores y plano 142/142;
consumidores de documentos/rutas/revisión/plano 167/167. SQL reproducido 14/14 y
siembra documental 6/6. Recorrido real de escritorio, copias y cierre móvil
documentados en `l2b-navegador.md`. Build y tipos de cierre correctos. La regresión
general detectó dos acciones que el barrido no podía analizar por sus tipos de
retorno inline (747/748). Ya comprobaban permiso primero; se extrajeron tipos
nombrados sin cambiar el barrido, que vuelve a pasar. Guardado, copias y
verificadores históricos están en regresión serial: no hay gate global verde.
Regresión intermedia tras añadir la lógica pura y componente de ficha: 705/705,
cero omisiones, `l1-pruebas-generales.log`. No sustituye el gate final del lote.

Infraestructura de navegador preparada en `scripts/iniciar-qa-plan40.mjs`:
crea únicamente una base QA nueva en Docker local, usuario sintético y servidor
en loopback. El alta de técnico y las acciones de negocio de L7 deben hacerse en
UI. No usar `db:reset` sobre la base compartida ni limpiar bases de ensayos ajenos.


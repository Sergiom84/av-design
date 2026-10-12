# L3B B2a · Recepción para revisión independiente

08/09/2026. Implementación entregada; pendiente de dictamen. No aprueba B2a,
B2, L3B ni plan40. Base aprobada B1: manifiesto481, ronda2.

Contrato: `l3b-b2a-recepcion-contrato.md`, incluidas precisiones vinculantes del
revisor. Artefacto congelado y evidencia:
`output/plan40-b2a-ui-20260908/manifiesto-entrega.json` y `delta.json`.

## Resultado implementado

Recepción de pedidos ya comprados y atribuidos a suministros: token, detalle,
entrada del artículo comercial, cantidad recibida y reparto incremental se
confirman juntos. Las recepciones históricas conservan protocolo legacy.
Los detalles son inmutables; el servidor captura transacción, baseline, efectos
y nombre del receptor desde el usuario activo. El reintento idéntico devuelve
sin nuevos efectos, incluso tras agotar la última unidad.

La excepción SQL a L3A exige hechos exactos de recepción de la transacción
actual, con completitud diferida desde el token. No habilita compra nueva,
reserva, carga, devoluciones ni otras mutaciones de kits.

La ficha existente muestra recibido/pendiente por suministro y recibido sin
atribuir. Cabecera, líneas y reparto se leen en una misma instantánea RR.
Un pedido compartido muestra su obra y conserva sala NULL en las entradas.
Se mantienen deshabilitadas las operaciones fuera de esta unidad.

## Evidencia reproducida por el arquitecto

Carpeta `output/plan40-b2a-ui-20260908/`:

| Gate | Resultado | Evidencia |
|---|---|---|
| Instalación, upgrade poblado, repetición, equivalencia | Correctos | core-reproducido.log |
| SQL/API recepción | 17/17 | core-reproducido.log |
| B1 | 24/24 | regresion-b1.log |
| Compras | 20/20 | regresion-compras.log |
| Lector intercalado tras cabecera y líneas | 2/2 | lectura-cabecera.log, lectura-lineas.log |
| Causal lector con READ COMMITTED | 1 fallo por punto | causal-cabecera.log, causal-lineas.log |
| Sin reparto / sin transacción / sin idempotencia | 11 / 13 / 5 fallos de17, cero canceladas | causal-sin-*.log |
| Generales | 774/774 | generales.log |
| Build, DATABASE_URL vacía | exit0 | build.log |
| Tipos, sin incremental | exit0 | tipos.log |
| Lint src y scripts | exit0 | lint-codigo.log |

Los mutantes SQL prueban que la recepción no completa si falta el reparto o
el vínculo transaccional; no afirman haber eliminado todas las defensas
redundantes. El mutante de idempotencia cambia el token en una copia temporal.
Los fallos del lector son aserciones de ficha incoherente, no timeouts.

El comando global `npm run lint` se ejecutó y falló:428 errores y8760 avisos en
el volcado protegido `Inicio/`, más un aviso preexistente en
`e2e-gate/gate-v4.spec.ts`. `lint.log` conserva el resultado completo. No se
modificó ese material ni la configuración de lint. El gate de código del
proyecto es `npx eslint src scripts`, igual que el alcance indicado en su config.

## Recorrido real y límites

Login QA → Compras → pedido compartido A/B → recibir1 → reenviar la misma
petición HTTP200 → recargar → recibir todo lo pendiente → recargar. Estados SQL
`estado-0/1/2.json` demuestran recibido0/1/2 y reparto0/0→1/0→1/1. Dos piezas
conocidas existen en las salas; su stock sigue0 y cobertura física0. El autor
de ambas entradas es legible. Capturas desktop-parcial/completo y logs browser.

Después del recorrido desktop:390 y320, foco visible, reduced motion activo,
sin overflow de página. La tabla nueva conserva512px de contenido en su
contenedor desplazable con foco; capturas `movil-final-*` comprueban ambos lados.

Al reproducir la petición RSC y cerrar el navegador, el servidor de desarrollo
emitió `Cannot write to a CLOSED writable stream` y `destination stream closed
early`. Se registra como incidencia del transporte de la prueba, sin afirmar
consola global limpia: respuesta200, recarga posterior correcta, sin duplicados,
ambas acciones y persistencia verificadas. No se cambió infraestructura.

Solo UUID QA locales5433 propias, eliminadas; servidor3128 y navegador propios
cerrados. Se restituyeron únicamente los cambios automáticos de Next en
tsconfig/next-env, comparados contra sus copias previas. Sin Git ni producción.
El ejecutor de núcleo cerró todos sus procesos y devolvió exclusividad antes de
la integración. Manifiesto de su radio6 en `output/plan40-b2a-core-20260908/`.

Pendiente: dictamen independiente de B2a. Cualquier hallazgo se atiende sobre
este artefacto, con máximo dos rondas según contrato; no continuar B2b mientras
el revisor posee el árbol/QA. Check-in/check-out no se dan por cumplidos aquí.

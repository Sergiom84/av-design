# L3A · entrega para revisión independiente

Ejecutor `01a080e4-d9a1-7500-ae26-d93eccbd139d`. Revisor confirmado por presentación:
`01a080e5-20d4-7191-b610-82ac1a263b11`. Fecha: 08/09/2026.
L2B aprobado por ese revisor en `output/revisor-plan40-01a080e5/dictamen-l2b-correccion.md`.
Esta entrega no se declara aprobada ni cierra L3 o plan40.

## Contrato

Mandan `l3-contrato-ejecucion.md`, apartado L3A, y la precisión final de
`l3-diseno-previo.md`. Resultado: una unidad comercial por suministro, piezas
físicas cantidad uno, composición publicada inmutable y snapshot por instancia.
La proyección compartida alimenta ficha, logística y documento sin sumar otra
compra por cada pieza incluida. Equipo independiente e histórico conserva su
cantidad; la relación se identifica por UUID, nunca por parecido de nombre.

Alcance autorizado: núcleo persistido, CSV versionado, operación interna real,
lectores, proyección, guardas y QA local desechable. No hay alta de kit en UI.
La atribución de reserva/compra/carga es L3B; copia y cancelación integral son
L3D. Retirada poscompra exige revisión íntegra L5 y se rechaza. L3C no está
implementado: no cambia el cálculo ni la agregación comercial de cables.

## Artefacto

Directorio E: `output/plan40-l3a-20260908/`.
`E/artefacto/` contiene el árbol entregado, `E/manifiesto-entrega.json` sus SHA256
y `E/cambios-desde-l2b.json` el delta frente al manifiesto456 aprobado de L2B.
El baseline previo sigue en `output/plan40-l2b-integridad-20260908/artefacto/`.

- `2026-09-suministros-kit.sql`, con bloque equivalente antes del sufijo generado
  de etiquetas en schema: composiciones, líneas, suministros y vínculos físicos.
  FK compuestas, ordinal único, cantidad uno, guardas inversas, completitud
  diferida y snapshots calculados en SQL. Publicación/cambios de tipo de catálogo
  comparten cerrojo transaccional. No se confirma un suministro conocido sin
  todos sus componentes; los desconocidos permanecen documentales.
- `data/composiciones.csv` y `scripts/sql-composiciones.mjs`: resolución exacta
  de referencias, versión incremental y rechazo de alteración de versión
  publicada. Seed regenerado por su generador; nunca editado a mano.
- `suministros.ts` y `suministros-db.ts`: proyección pura, lectura e
  `instanciarSuministro`, transacción con sala bloqueada, cierre de obra y versión
  de plano. Inserta nuevas piezas sin cambiar las históricas ni inventar XYZ.
- Ficha/logística/documento comparten necesidad; el documento conserva piezas
  físicas e identifica las incluidas. Material/reservas quedan bloqueados en el
  semáforo cuando aún no hay atribución comercial.
- Puerta temporal SQL de L3A en reservas, movimientos, pedidos, líneas y cargas,
  con bloqueo de sala y comprobación de destino anterior/nuevo; pedidos de
  proyecto consideran sus salas. Su dueño y sustitución son L3B. La UI conserva
  historial visible y deshabilita operaciones de esa sala. No acredita stock,
  pedidos, reservas o salidas legacy por artículo+sala a los kits nuevos.
- Borrado/desvinculación/cambio de identidad o cantidad de pieza rechazan en BD,
  también invocados por acciones existentes. Ajuste de cantidad usa el lock de
  sala. Copia de sala con suministro rechaza antes de copiar equipos, incluso
  si solo contiene documentación pendiente y ninguna pieza.

Fuente exacta de la composición inicial: [Cisco Room Kit EQ, tabla 3](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/spark-room-kit-series/room-kit-eq-ds.html),
consultada 08/09/2026. SKU CS-KIT-EQ-K9, tres identidades explícitas de su fila
First Light. El cableado queda por determinar: el lote no deduce cables,
longitudes ni SKU de equipos históricos. La composición es parcial.

## Evidencia ejecutada por el ejecutor

Logs finales en E con prefijo `l3a-`; los verificadores imprimen la eliminación
de su UUID propio. Ninguna ejecución usa la base compartida o producción.

| Comprobación | Resultado |
|---|---|
| `node scripts/ejecutar-suministros.mjs` | 16/16: lectores reales kit1, kit2+extra1; parcial con/sin piezas; snapshot/CSV; guardas/FK; cuatro fallos intermedios con rollback; dos altas concurrentes; logística y catálogo en ambos órdenes; retirada con compra registrada |
| `--sin-exclusion`, copia aislada | Dos fallos cuantitativos: 4 frente a1 y 8 frente a2; sin cancelados ni timeout de proceso |
| Instalación y upgrade | Servidor QA instala schema+seed desde vacío. Verificador instala esquema anterior al bloque L3A poblado, migra dos veces y reaplica schema; histórico cantidad3/XYZ0 idéntico, cero conversiones |
| `npm test` | 755/755, cero omisiones |
| Build, `tsc --noEmit --incremental false`, eslint src/scripts | Exit0 |
| Fichas / puertos | 12/12 y 14/14, incluidos upgrades y nuevas dependencias del generador |
| Siete verificadores PostgreSQL de plan40 | Todos exit0; logs originales en `output/qa_plan40_base_f19166da667d4e2eab3441ca2e99ac4c/` |
| Compras integrales / servidor rosetas / carrera de copia documental | 20/20, 14/14, 5/5 |
| Regeneración seed | SHA anterior=posterior en `E/seed-idempotencia.json` |
| Navegador real, usuario sintético | Escritorio → logística → recarga → documentos →390/320. Kit2+micro1; siete piezas/seis incluidas; controles bloqueados; foco y reduced motion; ancho y scroll iguales390/320 |

Las regresiones generales/de negocio se ejecutaron sobre el radio completo.
Tras añadir el cerrojo exclusivo del catálogo se repitieron el verificador de
suministros, su causal, fichas, puertos, tipos y lint; no se modificó después
el comportamiento de compras/cables/editores probado por las otras suites.

UI: `E/preparar-ui.mts`, scripts `ui-*.js`, logs y capturas inspeccionadas.
El alta de la fixture utiliza la operación interna real; no acredita alta UI,
L3B, el recorrido global L7 ni examen de todas las páginas PDF de L6.
La tabla nueva pasó de tres columnas a dos al comprobar la lectura en320.
Se repitió el recorrido final. La primera fixture fue
`qa_plan40_ui_0ccfff38ec3944c6b23e3c68c54ac927`; la final,
`qa_plan40_ui_2cb345f7b57942099a62b2f141ea6a4e`. Ambas cerradas y eliminadas.

Los rechazos de integridad se comprueban por códigos23503/23514, no por cualquier
error de ejecución. Se corrigió la comprobación de clase del ensayo porque
acciones CJS y pruebas ESM cargan constructores diferentes de postgres. Los
primeros ensayos también detectaron un acceso a campo de trigger de otra tabla,
una columna incorrecta de fixture y columnas compatibles de cable incompletas;
se corrigieron antes de la evidencia final, sin suprimir guardas ni aserciones.

## Recursos y siguiente gate

Agente `l3a_mapa_consumidores`: solo lectura, terminado. Todo código/SQL L3A tuvo
un único escritor. `l2b_ui_ack` sigue terminado. Las bases y procesos de otros
trabajos se preservaron, incluido servidor3100 y las tres bases del traspaso.
Los servidores/navegadores QA propios se cerraron. Los cambios de tsconfig y
next-env generados por QA se compararon y se repusieron desde copias previas.

No hay commit, push, merge, despliegue, migración compartida ni producción.
Rollback local de código: solo delta de E contra artefacto aprobado L2B,
preservando el resto del árbol. No existe rollback de producción que ejecutar.
No retirar tablas o suministros por cascada para revertir un montaje real.

Solicitado: dictamen independiente de L3A, máximo dos rondas salvo excepción
acotada de integridad/migración. Se entrega exclusividad de pruebas/escrituras
al revisor al enviar el manifiesto. Siguiente implementación: L3B solo después
del dictamen; L3 global y L4–L8 continúan pendientes.

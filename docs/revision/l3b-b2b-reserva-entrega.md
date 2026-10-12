# Entrega B2b: reservar y liberar un suministro

Estado: **entregado para revisión independiente, no aprobado**. B2, L3B y
plan40 continúan abiertos. Base aprobada: B2a, manifiesto490, ronda2.
Revisor confirmado: `01a080e5-20d4-7191-b610-82ac1a263b11`.
Contrato: `docs/revision/l3b-b2b-reserva-contrato.md`, diseño aprobado en ronda2.

Artefacto: árbol local preservado, identificado por
`output/plan40-b2b-ui-20260908/manifiesto-entrega.json`.
Cambios respecto de490: `delta.json`. Evidencias y sus hashes:
`manifiesto-evidencia.json`, en el mismo directorio.

## Comportamiento entregado

- Reserva de una unidad mediante suministro explícito; liberación de una reserva
  gestionada sin borrar su fila ni su vínculo. No abre reservas genéricas, compra
  nueva, carga, retirada ni cancelación de kits.
- Hechos inmutables con identidad de operación, autor y baseline impuestos por SQL;
  repetición del token consulta el resultado anterior. Reserva/liberación y efectos
  forman una sola transacción. La cobertura sigue siendo la proyección B1.
- Disponible global incluye todas las reservas activas, también legacy sin
  atribución. Cota por nueva reserva y déficit final por artículo; OLD/NEW y
  compensaciones no trasladan un déficit de un artículo a otro.
- Perímetro monotónico desde composiciones/suministros. La migración preserva
  déficit histórico y es repetible. Retira los dos triggers de `sala_equipos`
  incluidos en un ensayo anterior: esa ampliación no forma parte del artefacto.
- Control temprano explícito en operaciones afectadas y respaldo SQL en la lista
  exacta del contrato. El adaptador de postgres.js conserva consultas diferidas y
  reintenta transacciones completas; no introduce el mutex en todas las `.begin`.
  Usuarios, parámetros, edición exclusiva de plantillas y crearRevision quedan
  fuera de esa ampliación.
- Agotamiento con código estable `AV_CONCURRENCIA_AGOTADA`, reconocible entre
  bundles de Server Actions. No se reintenta COMMIT incierto ni se convierten
  redirects/errores de negocio en éxito.
- 47 formularios void en24 archivos usan el adaptador de presentación; tres
  formularios ocultos muestran feedback externo. Alta de sala, conexión y prueba
  final conservan su protocolo de estado y protegen el reinicio nativo. Los
  permisos de cada acción se mantienen. El censo barre153 TSX reales.
- Panel de reservas con cobertura B1, disponibilidad e identidad gestionada leídas
  en una única transacción RR readonly. La cobertura genérica, que excluye kits,
  no se presenta como saldo de sus reservas. Se conservan los controles genéricos
  bloqueados y el historial.

## Evidencia ejecutada por el director

Directorio `output/plan40-b2b-ui-20260908/`:

| Gate | Resultado | Evidencia |
|---|---|---|
| SQL B2b | 66/66, cero cancelaciones | `sql-ampliado.log` |
| Migración poblada/repetición | Historial negativo intacto; schema idéntico al bloque; limpieza de triggers descartados | Preámbulo del mismo runner/log |
| Causal sin cota | 30 fallos de aserción, cero cancelaciones | `causal-sin-cota.log` |
| Causal sin vínculo | 1 fallo de aserción, cero cancelaciones | `causal-sin-vinculo.log` |
| Causal sin idempotencia | 7 fallos de aserción, cero cancelaciones | `causal-sin-idempotencia.log` |
| Causal sin entrada temprana | 2 fallos de aserción: orden observado y barrido contractual | `causal-sin-entrada-temprana.log` |
| B1 | 24/24; causal sin cota padre4 aserciones | `regresion-b1.log`, `causal-b1.log` |
| B2a | 21/21 | `regresion-b2a.log` |
| Compras integrales | 20/20 | `regresion-compras.log` |
| Generales | 778/778, sin omisiones | `generales.log` |
| Tipos/build/lint de código | Salida0 | `tipos.log`, `build.log`, `lint-codigo.log` |
| Reinicio de formulario | Causal sin listener nativo:1 aserción, cero cancelaciones | `causal-formulario.log` |
| Lector concurrente | RR conserva estado anterior entero y nueva lectura ve commit | `coherencia-rr.log` |
| Causal lector RC | Aserción detecta cobertura anterior mezclada con saldo/reserva posterior | `coherencia-causal-rc.log` |
| Limpieza QA | Bases y conexiones de los nombres registrados ausentes | `limpieza.json` |

La causal de orden observa `pg_stat_activity` y cancela explícitamente la consulta
que está esperando fila; no es evidencia de cota ni un timeout/deadlock. Los
otros grupos de causales no emplean esa cancelación. El barrido del esquema lee
triggers y fronteras FK reales y exige conjuntos no vacíos.

La matriz SQL incluye RC/RR y ambos órdenes para última unidad, salas distintas,
reserva/liberación, recepción, stock legacy, compromiso de reserva legacy,
incorporación de perímetro, cascada desde ubicación externa, lotes con padres
opuestos, cambio de artículo de movimiento y traslado a jerarquía cerrada.
Incluye RR anterior al ganador, prelock externo, rollback en cuatro niveles,
OLD/NEW de movimiento/reserva, DELETE, compensaciones, dos hechos en una TX y
cambio/borrado de composición que conserva protegido el artículo viejo.

Los verificadores anteriores B1/compras adaptan sus carreras al control no
bloqueante: primero acreditan40001/agotamiento y después repiten la TX para
comprobar rechazo de negocio y saldo. B1 dispone de stock sintético explícito para
sus reservas históricas; no se desactivan triggers ni se suprimen aserciones.
Su causal vuelve a ejecutarse sobre este fixture y falla4 aserciones.

## Navegador y persistencia

QA exclusiva `qa_plan40_ui_afb287c77dbc40789ce8aeeebfd7236f`, localhost3128,
usuario sintético `qa.proyectista`. Desktop1440 antes de390/320.

- Login, dos suministros y stock1 recibido mediante B2a real. Reservar unidad1:
  reservado1/0, servido0/0, pendiente0/1, disponible0. El otro botón queda
  deshabilitado. Repetición del POST200 y recarga no duplican hechos.
- Liberar: reservado0/0, pendiente1/1, disponible1. POST repetido200 sin efecto
  adicional. `estado-antes/reservada/liberada.json` y logs/capturas `desktop-*`.
- Acción legacy real `registrarMovimiento`: mutex ocupado, error visible, artículo,
  cantidad3, motivo y autor conservados; BD con cero movimientos. Se libera el
  mutex y el mismo formulario crea exactamente un movimiento. `legacy-*.log`.
- Recepción B2a en su formulario real: agotamiento conserva exactamente
  `recepcion_id` y cantidad; no consume token ni aumenta recibido.
  `recepcion-rechazo.log` y `estado-final.json`.
- Cierre móvil: documento390/390 y320/320, tabla desplazable, Tab llega a Reservar,
  foco visible y reduced motion activo. `movil.log` y capturas390/320.
- Estado final de BD: stock kit1, stock componente0, equipos2, reservas activas0,
  recibido1, un solo movimiento del kit y cero filas del token rechazado.
  Las reservas transitorias de los ensayos de coherencia también se liberaron.

## Límites y procedencia

No se afirma consola de desarrollo limpia: hubo mensajes de streams RSC cerrados
en replay/recarga, ya registrados en B2a, y un aviso de hidratación que señala
atributos `caret-color: transparent` durante las capturas. Se conservan logs de
consola; las comprobaciones de persistencia y de interacción figuran por separado.
El500 inicial de concurrencia quedó corregido con el código estable y se repitió
el recorrido: el rechazo final devuelve200 con estado de error y conserva campos.

Lint ejecutado aquí: `eslint src scripts`, salida0. El lint indiscriminado del
volcado protegido `Inicio/` no se presenta como verde; se conserva sin alterar.
No se modifican tipografías/tokens ni archivos originales para limpiar diagnósticos.

Navegador y servidor QA cerrados; BD eliminada. `tsconfig.json` y `next-env.d.ts`
comparados byte a byte con la copia previa a QA. Los dos subagentes han finalizado.
Sin commit, push, merge, despliegue ni acceso a producción/base compartida.
El revisor recibe el árbol congelado y la propiedad de las siguientes pruebas QA;
el ejecutor espera dictamen antes de iniciar otra unidad de plan40.

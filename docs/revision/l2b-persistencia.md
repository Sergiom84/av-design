# L2B · Persistencia de rosetas y bocas físicas

08/09/2026. Unidad SQL local, pendiente de integración de acciones, lectores,
copias, generador, UI y revisión independiente del lote L2B. No acredita el cierre
de L2B ni autoriza aplicar una migración en producción.

## Artefactos y contrato

- `db/migraciones/2026-09-rosetas-conexiones.sql`, reproducida literalmente en
  `db/schema.sql` antes del bloque generado de etiquetas L2A.
- `scripts/verificar-rosetas-conexiones.mjs`, bases desechables propias
  `qa_rosetas_<UUID>` exclusivamente en `127.0.0.1:5433`, sin leer `.env`.
- Diseño aprobado: `l2-diseno-previo.md`; integración:
  `l2b-contrato-integracion.md`.

`conexion_bocas` y `plantilla_conexion_bocas` conservan su identidad de
conexión/lado y su unicidad equipo/puerto/ordinal. Añaden `toma_boca_id`, excluyente
con los tres campos de equipo. La FK de roseta es RESTRICT y su ocupación única.
Las columnas compatibles de conexión admiten NULL para ese extremo y deben
coincidir con las bocas al confirmar la transacción.

El estado `detalle_extremos` se incorpora una sola vez: las conexiones existentes
sin bocas quedan `legacy`; las que tienen pareja quedan `completo`. Toda alta
nueva exige `completo` y dos extremos. No se puede degradar, eliminar una pareja
ni mover solamente un extremo a otra conexión. Documentar una legacy conserva
su UUID, etiqueta, recorrido y longitud manual. Una actualización inocente no
borra bocas. Las etiquetas siguen bajo la autoridad inmutable L2A.

`tomas_red` y `plantilla_tomas_red` tienen capacidad nullable, referencia del
código, confirmación física inicialmente falsa y posiciones de esquema en pareja.
Sus tablas `toma_red_bocas` y `plantilla_toma_red_bocas` guardan UUID, ordinal,
etiqueta opcional, conector y señal expresos. NULL exige cero bocas; N positivo
exige exactamente 1..N. Cero no es una capacidad válida. Ampliar conserva los UUID;
reducir o borrar una ocupada falla. Cambiar el ordinal o propietario de una boca
falla. La infraestructura no crea equipos ni material AV.

Las altas y cambios de XYZ exigen los tres ejes o ninguno. Los históricos
parciales sobreviven si esos campos no cambian. Mover un bloque solo modifica
esquema X/Y. Una copia es un alta nueva: el director concretó rechazar toda copia
con rosetas históricas parciales e identificar cuáles requieren completarse,
sin sustituirlas por NULL ni cero y sin introducir un bypass SQL.

`sala_equipos.toma_red_conexion_id` referencia una conexión con SET NULL. Una
comprobación diferida exige que sus dos extremos sean ese equipo y una boca de
la roseta asignada. La asignación documental existente no se convierte al migrar.
Borrar el cable deja el vínculo pendiente y conserva `toma_red_id`. También se
comprueba la relación cuando se sustituyen bocas; el vínculo bloquea la conexión
para cerrar la carrera con una sustitución concurrente.

## Evidencia ejecutada

Directorio de crudos: `output/plan40-20260908-083450/`.

| Ejecución | Resultado | Archivo |
|---|---|---|
| `node scripts/verificar-rosetas-conexiones.mjs` | 14/14, exit 0 | `l2b-sql-base.log` |
| `--sin-pareja` | 3 fallos / 11 pasan, exit 1 esperado | `l2b-sql-causal-pareja.log` |
| `--sin-capacidad` | 2 fallos / 12 pasan, exit 1 esperado | `l2b-sql-causal-capacidad.log` |
| `--sin-propiedad` | 2 fallos / 12 pasan, exit 1 esperado | `l2b-sql-causal-propiedad.log` |
| `--sin-documental` | 2 fallos / 12 pasan, exit 1 esperado | `l2b-sql-causal-documental.log` |
| `npx.cmd eslint scripts/verificar-rosetas-conexiones.mjs` | exit 0 | `l2b-sql-lint.log` |

Las mutaciones actúan sobre una copia SQL en memoria aplicada únicamente a bases
desechables; nunca retiran guardas del árbol ni de bases compartidas. Las
aserciones que caen comprueban ausencia de pareja, capacidad inconsistente,
pertenencia ajena y enlace documental incoherente, respectivamente.

El ensayo aplica el esquema L2A completo previo, puebla conexiones legacy y
detalladas, roseta histórica parcial, XYZ de equipo y puntos de paso, compara
snapshots antes/después y repite la migración. Comprueba además el esquema final
completo, conversión explícita legacy→completo conservando brida, guardas SQL
directas y simetría de plantilla. El rollback posterior a insertar la pareja
revierte equipo, esquema, versión y contador. Dos altas concurrentes sobre una
boca confirman solo un cable y el siguiente conserva el correlativo esperado.
Las carreras capacidad/conexión y asignación/cambio de boca observan un bloqueo
real en `pg_stat_activity.wait_event_type = 'Lock'` antes de liberar la primera
transacción; no se infiere concurrencia por un sleep.

## Trabajo de integración todavía necesario

Las escrituras normales deben guardar conexión y dos extremos en la misma
transacción. Una tirada histórica solo se documenta explícitamente, manteniendo
su identidad. La documentación de capacidad guarda placa y todas sus bocas
atómicamente, conservando UUID por ordinal y dando errores legibles.

El barrido de escritores encontró fixtures que crean conexiones sin pareja en
`verificar-diagrama.mts`, `verificar-compras-integrales.mts`,
`verificar-guarda-equipos.mts`, `verificar-bocas-puerto.mts`,
`verificar-etiquetas-cable.mjs`, `verificar-fichas-tecnicas.mjs`,
`verificar-plantillas.mts`, `verificar-rutas-cable.mts` y
`verificar-seed-puertos.mjs`. Sus escenarios deben usar datos físicos completos,
o preparar históricos sobre un esquema anterior y migrarlos si eso es lo que
prueban. No quitar las nuevas restricciones para mantener fixtures obsoletas.

**Hallazgo de fuente real, resuelto en la unidad documental posterior:**
`data/plantillas-tiradas.csv` contiene cuatro tiradas
de SALA TP, aforo ocho, con categorías pero sin puerto ni ordinal. El generador
actual las inserta sin bocas (`scripts/generar-seed.mjs`, bloque de tiradas tipo).
No es un fixture vacío. La integración de siembra requiere resolver este origen
documental sin inventar conectores físicos ni omitir cables silenciosamente.
Esta unidad no ha modificado esos datos ni ejecutado la siembra sobre una base
compartida. La regresión integral y los caminos reales de copia siguen pendientes.
La siembra final actual se ensayó en una base propia y falla con SQLSTATE 23514,
`El detalle fisico exige origen y destino completos`; crudo `l2b-seed-pendiente.log`.
La base `qa_rosetas_seed_cdba3ffe072b471aa150149809dcf976` fue eliminada. El
director comunica aprobación independiente para separar estas cuatro fuentes
documentales, sin convertirlas en cables. Esa unidad ya está implementada y
ensayada, con siembra completa repetida verde; evidencia y alcance exacto en
`l2b-tiradas-documentales.md`. El fallo anterior se conserva como evidencia del
problema inicial, no representa el estado final del generador.

No hubo Git, producción, configuración global ni cambios de datos compartidos.

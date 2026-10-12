# L2B · Corrección acotada del P1 de copia concurrente

08/09/2026. Ejecutor `01a080e4-d9a1-7500-ae26-d93eccbd139d`.
Revisor `01a080e5-20d4-7191-b610-82ac1a263b11`.
**Nueva entrega para revisión de corrección. L2B no aprobado; L3 no iniciado.**

## Contrato

Hallazgo y reproducción independientes:
`output/revisor-plan40-01a080e5/dictamen-l2b.md` y
`carrera-copia-documental.mts` en esa carpeta.
Se mantiene el contrato de L2B y sus cuatro fuentes documentales.

- Copia primero: el borrado espera y el destino recibe el cable completo de esa
  revisión; después puede borrarse el original y quedar pendiente la fuente.
- Borrado primero: la copia espera el commit, detecta la documental pendiente
  y revierte todo lo que ya hubiera escrito en el destino.
- El borrado directo y el borrado en cascada de un equipo no eluden la guarda.
- Validación estable mediante bloqueos retenidos en la transacción, no un
  segundo check susceptible de la misma carrera.

Esta es la corrección del P1 de integridad y su revisión prevista por el dictamen;
no reinicia las rondas parciales anteriores. No autorización de publicación.

## Artefacto y protocolo

Base preservada: manifiesto de453 archivos y artefacto de
`output/plan40-continuacion-20260908-01a080e4/`.
Nueva entrega en `output/plan40-l2b-integridad-20260908/` (**I/**):
`artefacto/`, `manifiesto-entrega.json`, `cambios-desde-entrega.json`.
Se trabaja sobre el árbol material previo; no se reconstruye desde HEAD.

Cambios de aplicación:

- `src/lib/copiar-conexiones.ts`: después del propietario, bloquea conexiones
  y rosetas existentes por UUID; en plantilla, también las documentales. Todo
  ello **antes** de comprobar pendientes/legacy/XYZ. Los bloqueos permanecen
  hasta commit o rollback. El propietario impide altas concurrentes mediante
  sus FK; las filas existentes protegen borrados y cambios que no toman esa FK.
- `src/app/acciones.ts`: quitar tirada y operar línea comparten transacción y
  bloqueo de plantilla antes del hijo; releen la pertenencia tras esperar.
  Quitar línea cubre el borrado en cascada de su conexión. Las otras operaciones
  de línea mantienen el mismo protocolo. Alta/resolución de tirada ya tomaba
  el bloqueo de plantilla. La copia sala→plantilla conserva el mismo orden
  propietario/filas y comparte el helper.

Verificadores nuevos: `scripts/ejecutar-copia-documental.mjs` y
`scripts/verificar-copia-documental.mts`. No SQL/migración ni UI nuevos.

## Evidencia ejecutada

| Comando | Resultado | Log I/ |
|---|---|---|
| Reproducción original del revisor, antes del arreglo | exit1; borrado y copia confirman, pendiente1/cables0 | `reproduccion-antes.log` |
| Misma reproducción sin modificar, después | exit0; borrado espera lock; copia conserva cable1 | `reproduccion-despues.log` |
| `node scripts/ejecutar-copia-documental.mjs` | 5/5, exit0 | `carrera-base.log` |
| mismo `--sin-bloqueo-filas` | 2 fallos de5, exit1 | `carrera-sin-filas.log` |
| mismo `--sin-bloqueo-mutacion` | 2 fallos de5, exit1 | `carrera-sin-mutacion.log` |
| `npm.cmd test` | 751/751, sin omisiones, exit0 | `generales.log` |
| `npm.cmd run build` | exit0 | `build.log` |
| `npx.cmd tsc --noEmit --incremental false` | exit0 | `tipos.log` |
| `npx.cmd eslint src scripts` | exit0 | `lint.log` |
| `node scripts/ejecutar-servidor-rosetas.mjs` | 14/14, exit0 | `servidor.log` |
| `node scripts/verificar-base-plan40.mjs` | siete verificadores exit0 | `regresion-bd.log` |

Los cinco casos ejecutan el helper real; dos llaman las acciones reales de
quitar tirada y quitar línea. Se sustituye solamente navegación/cache Next del
arnés. El intercalado se controla con una pausa entre consultas, sin alterar
resultados; el bloqueo se observa en `pg_stat_activity`, no se presume por una
espera. Cubren SQL directo, ambas acciones, borrado no confirmado primero y
rechazo tardío después de insertar cable. Se verifican pareja completa,
manual7.25, documental pendiente, equipos/notas del destino y rollback del
contador. Mutantes en copias propias; ninguna restauración del árbol compartido.

Los fallos causales son aserciones de lock ausente y de rechazo ausente, sin
timeout del proceso ni tests cancelados. El timeout55P03 de la reproducción
original es su forma explícita de comprobar que el DELETE está bloqueado;
el nuevo verificador observa el lock y deja que ambas transacciones terminen.

## Aislamiento y límites

Todas las bases propias UUID en127.0.0.1:5433, ejecución serial. Los wrappers
eliminan exclusivamente sus bases y copias temporales. No navegador ni servidor
QA abierto en esta corrección; servidor habitual3100 preservado. Sin commit,
stash, reset, checkout, push, merge, despliegue o escritura en producción.

El recorrido visual anterior y el del revisor permanecen como evidencia de UI;
no se presenta un nuevo recorrido L7. No se reejecutan fichas/compras/etiquetas
por esta corrección: no cambiaron y sus logs permanecen en la entrega anterior.

Reversión: comparar solo los dos archivos de aplicación y los dos verificadores
con el artefacto anterior; no restaurar todo el árbol ni borrar evidencia.
Solicitado: dictamen de corrección del P1 y del lote L2B; plan40 permanece abierto.

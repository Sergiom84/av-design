# L2A · Persistencia de etiquetas de cable

08/09/2026. Implementación y evidencia del ejecutor; pendiente de integración y
dictamen independiente. No declara terminado L2 ni el plan 40.

## Artefactos

- `scripts/generar-etiquetas-cable.mjs`: importa `PREFIJO_CABLE` y
  `PRIMER_CORRELATIVO_CABLE` con el cargador CJS de tsx. Genera un bloque idéntico
  al final de `db/schema.sql` y `db/migraciones/2026-09-etiquetas-cable.sql`.
  `node scripts/generar-etiquetas-cable.mjs --comprobar` compara bytes de ambos.
- Columnas `etiqueta_cable`, `serie_cable`, `correlativo_cable` obligatorias;
  unicidad por sala para texto y pareja serie/número.
- `configuracion_series_cable` es la proyección generada. Una reaplicación no
  sobrescribe una configuración divergente: aborta y requiere migración explícita.
- `series_cable_sala` mantiene el siguiente número aunque se borre el último cable
  o todos. El UPSERT de alta reserva y avanza dentro de la misma transacción.
- Trigger rechaza etiqueta elegida por cliente y cambios de etiqueta, serie,
  número, UUID o sala con SQLSTATE `23514`. Cambiar la señal técnica conserva la
  brida inicial. El rollback devuelve únicamente una reserva nunca confirmada.

La migración bloquea escrituras, conserva el mapa visible por fecha truncada a
milisegundos y UUID textual C, y no cambia bocas, geometría, UUID ni fechas.
Rechaza mezclas de etiquetas parciales e identidades incoherentes. Solo admite
fechas UTC en años 0001–9999; infinitos, fechas AC y años extendidos requieren
reconciliación explícita porque el algoritmo antiguo ordenaba cadenas ISO, cuyo
orden extendido no equivale al cronológico SQL. No inventa una brida alternativa.

## Evidencia ejecutada

`node scripts/verificar-etiquetas-cable.mjs`: **11/11**. Destino fijo localhost
5433, usuario de desarrollo, cada prueba crea y elimina exclusivamente su
`qa_etiquetas_<UUID>`; no lee `.env` ni `DATABASE_URL`.

Se verifican instalación vacía, actualización poblada desde esquema L1 y desde
`f38baa805a1868b7cad55bb97064386e9b5f8555`, repetición, mapa calculado con la función
histórica real, desempate de microsegundos en orden contrario al UUID, bocas con
ordinales 2/1, puntos y posiciones completas, legado sin bocas, borrados de
primero/intermedio/último/todos, cambio de señal, SQL directo, copia independiente,
dos conexiones simultáneas en serie existente y vacía, rollback, fechas inválidas,
etiquetas parcialmente rellenadas y configuración divergente.

| Mutación de SQL en memoria y BD propia | Resultado medido | Aserción que detecta el defecto |
|---|---|---|
| `--sin-inmutabilidad` | 1 falla / 10 pasan | UPDATE de brida no se rechaza |
| `--sin-atomico` | 1 falla / 10 pasan | Solo una de dos altas concurrentes confirma |
| `--reiniciar-contador` | 1 falla / 10 pasan | Reutiliza HD-1004, se esperaba HD-1005 |
| `--sin-truncado` | 2 fallan / 9 pasan | Mapa histórico difiere en ambas actualizaciones |

Las cuatro mutaciones terminan con salida 1 por aserciones de aceptación; no
modifican el SQL del checkout. Proyección comprobada y ESLint de ambos scripts:
salida 0. Logs en `output/plan40-20260908-083450/`:
`l2a-persistencia-base.log`, `l2a-causal-identidad.log`, `l2a-causal-atomico.log`,
`l2a-causal-contador.log`, `l2a-causal-truncado.log`.

## Límites y siguiente gate

La copia probada aquí reproduce el INSERT a dos salas destino con UUID nuevos;
el recorrido real de plantillas, lectores, exportación, acciones y navegador
pertenece al gate de integración. No se certifica desde este informe build,
regresión completa, UI ni compatibilidad de rosetas. El director conserva ese gate.

Las bridas impresas antes de borrados anteriores a la migración no son
recuperables: se conserva el mapa visible de la instantánea actual. No se ha
ejecutado contra la base compartida ni producción. Retirar columnas no constituye
un rollback seguro: perdería identidades confirmadas; el runbook L8 debe preservar
datos y coordinar versión de aplicación y restauración. El ejecutor no ha hecho
Git, seed, despliegues ni cambios de credenciales.

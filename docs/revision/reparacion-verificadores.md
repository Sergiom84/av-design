# Reparación de los verificadores SQL en rojo

Fecha: 10/09/2026. Rama `codex/diagrama-salas`, HEAD `f38baa8`, árbol con
implementación local sin commit. Plan 40, secciones 6 y 7.

## Lote y contrato

| Campo | Acuerdo |
|---|---|
| Resultado exacto | Los verificadores SQL que estaban rojos vuelven a verde sin debilitar lo que comprueban |
| Éxito medible | Runners en exit 0 con su recuento, prueba causal con fallos medidos, `npm test`, `tsc` y `eslint` en verde |
| Alcance | `scripts/ejecutar-{reserva-kits,recepcion-kits,atribuciones,suministros}.mjs`, `scripts/verificar-{reserva-kits,carga-kits}.mts` y los verificadores hermanos de `scripts/` con el mismo defecto de CRLF |
| Fuera de alcance | `db/schema.sql`, `db/migraciones/**`, `src/**`, `package.json`, documentos de revisión anteriores |
| Sistemas protegidos | Base compartida `av_design`, producción, cualquier operación Git de escritura |
| Comprobaciones obligatorias | Los seis verificadores afectados, `npm test`, `npx tsc --noEmit --incremental false`, `npx eslint src scripts` |
| Autorización separada | Commit, push, despliegue; cambios en `scripts/verificar-suministros.mts` o en `db/schema.sql` |

## Estado base y estado entregado

No hay commit: el estado entregado se identifica por hashes.

Estado base medido (antes de tocar nada), con Docker arriba y Postgres en
`127.0.0.1:5433`:

| Runner | Exit | Fallo |
|---|---|---|
| `node scripts/ejecutar-reserva-kits.mjs` | 1 | AssertionError al comparar el bloque B2b de `db/schema.sql` con su migración |
| `node scripts/ejecutar-recepcion-kits.mjs` | 1 | Misma clase de AssertionError (B2a) |
| `node scripts/ejecutar-atribuciones.mjs` | 1 | Misma clase de AssertionError (L3B) |
| `node scripts/ejecutar-suministros.mjs` | 1 | `PostgresError: relation "sala_suministros" does not exist` |
| `node scripts/verificar-rosetas-conexiones.mjs` | 1 | `TypeError: Cannot read properties of undefined (reading 'split')`, 14 pruebas, 1 fallo |
| `node scripts/verificar-tiradas-documentales.mjs` | 1 | Mismo `TypeError`, 8 pruebas, 7 pasan, 1 falla |

Manifiesto de hashes del estado entregado:
`output/reparacion-verificadores-20260910/manifiesto-sha256.txt`.

## Archivos incluidos

Ninguna migración ni SQL de producción. Todo en `scripts/`:

- `scripts/bloques-schema.mjs` (nuevo): normalización de fin de línea,
  comparación bloque/migración y recorte del esquema «anterior a un bloque» con
  la clasificación de bloques comprobada contra el SQL real.
- `scripts/ejecutar-reserva-kits.mjs`, `scripts/ejecutar-recepcion-kits.mjs`,
  `scripts/ejecutar-atribuciones.mjs`, `scripts/ejecutar-suministros.mjs`: usan
  el helper y declaran su clasificación de bloques.
- `scripts/verificar-reserva-kits.mts`: `operaciones_carga_kit` añadido a la
  lista contractual de tablas con `aa_control_statement`.
- `scripts/verificar-carga-kits.mts`: retirada de la variable muerta `momento`.
- `scripts/verificar-rosetas-conexiones.mjs`,
  `scripts/verificar-tiradas-documentales.mjs`: mismo defecto de CRLF, resuelto
  en la comparación y con fallo explícito si el bloque falta.

## Qué estaba roto y por qué

1. **Fin de línea, no SQL.** `git config core.autocrlf` es `true`, así que
   `db/schema.sql` —seguido por Git— llega al árbol con 3805 CRLF y 0 LF
   sueltos. Las migraciones de `db/migraciones/` son ficheros nuevos sin
   seguimiento y están en LF (`2026-09-recepcion-kits.sql`: 0 CRLF, 278 LF).
   Comparar los dos bloques crudos con `assert.equal` fallaba por el salto de
   línea. El arreglo va en la comparación, no en los ficheros: convertir EOL se
   desharía en el siguiente checkout, y de hecho `git diff` ya avisa de que los
   `.mjs` nuevos pasarán a CRLF cuando Git los toque.
2. **Recorte incompleto del esquema.** Los runners simulan «el esquema anterior
   al bloque X» quitando ese bloque, pero los bloques posteriores se apoyan en
   él: `RECEPCION KITS B2A`, `RESERVA KITS B2B` y `CARGA KITS B2C` usan
   `sala_suministros` (L3A), y `CARGA KITS B2C` usa `operaciones_reserva_kit`
   (B2b). El esquema recortado no se podía aplicar. Ahora el recorte se calcula
   hacia adelante —el esquema se aplica en orden, así que un bloque solo puede
   depender de los anteriores— y la lista no se aplica a ciegas: cada runner
   declara la clasificación de **todos** los bloques del fichero y el helper la
   contrasta con las referencias reales del SQL. Un bloque nuevo sin clasificar
   detiene la prueba en vez de recortarse en silencio.
3. **Lista contractual desfasada.** `scripts/verificar-reserva-kits.mts`
   barría `aa_control_statement` contra una lista `esperadas` que no incluía
   `operaciones_carga_kit`. Comprobado en `db/schema.sql`: el bloque
   `CARGA KITS B2C` crea ese trigger sobre esa tabla (bucle `do $$` con
   `foreach tabla in array array['operaciones_carga_kit']`). La lista estaba
   incompleta; el hallazgo no es el inverso.
4. **Variable muerta.** `momento` en `scripts/verificar-carga-kits.mts` quedó
   superada por `evento`, que es la que usa el `create trigger`. Se retira; no
   se silencia con `eslint-disable`.

## Criterios de aceptación

| Criterio | Esperado | Observado | Evidencia |
|---|---|---|---|
| Runners rotos en verde | Exit 0 con recuento | 3 de 4 en verde: reserva 66/66, recepción 21/21, atribuciones 24/24. Suministros sigue en rojo por un defecto ajeno y previo | `fix2-*.log` |
| Verificadores hermanos | Exit 0 | Rosetas 14/14, tiradas documentales 8/8 | `fix2-rosetas-conexiones.log`, `fix2-tiradas-documentales.log` |
| El arreglo de CRLF no anula la comprobación | El bloque alterado en contenido debe seguir fallando | 9 casos, 0 desviaciones, 6 AssertionError medidos | `causal-bloques-schema.log` |
| `operaciones_carga_kit` era necesario | Sin él debe caer una prueba | 66 pruebas, 65 pasan, 1 falla: «Barrido SQL real: cobertura STATEMENT y fronteras FK no vacías» | `causal-sin-operaciones-carga-kit.log` |
| `npx eslint src scripts` | Exit 0 | Exit 0, sin avisos | `eslint.log` |
| `npm test` | 805/805 | 806 pruebas, 806 pasan, 0 fallan | `npm-test.log` |
| `npx tsc --noEmit --incremental false` | Exit 0 | Exit 0 | `tsc.log` |
| Sin regresión en lo que ya estaba verde | Exit 0 | Carga de kits 30/30 y compras integrales, ambos exit 0 | `regresion-*.log` |

`npm test` da 806 y no 805. Ninguno de mis ficheros entra en los globs de
`npm test` (`scripts/*.test.mjs`) y `scripts/bloques-schema.mjs` no es un
fichero de pruebas, así que la prueba de más no procede de esta unidad; el otro
ejecutor trabajaba a la vez en `src/components/asistente-equipamiento/`.

## Comandos ejecutados

Fecha 10/09/2026. Logs en `output/reparacion-verificadores-20260910/`.

| Comando | Exit | Log |
|---|---|---|
| `node scripts/ejecutar-reserva-kits.mjs` | 0 (66/66) | `fix2-reserva-kits.log` |
| `node scripts/ejecutar-recepcion-kits.mjs` | 0 (21/21) | `fix2-recepcion-kits.log` |
| `node scripts/ejecutar-atribuciones.mjs` | 0 (24/24) | `fix2-atribuciones.log` |
| `node scripts/ejecutar-suministros.mjs` | 1 (16 pruebas, 11 pasan, 5 fallan) | `fix2-suministros.log` |
| `node scripts/verificar-rosetas-conexiones.mjs` | 0 (14/14) | `fix2-rosetas-conexiones.log` |
| `node scripts/verificar-tiradas-documentales.mjs` | 0 (8/8) | `fix2-tiradas-documentales.log` |
| `node scripts/ejecutar-carga-kits.mjs` | 0 (30/30) | `regresion-carga-kits.log` |
| `node scripts/ejecutar-compras-integrales.mjs` | 0 | `regresion-compras-integrales.log` |
| `npx eslint src scripts` | 0 | `eslint.log` |
| `npm test` | 0 (806/806) | `npm-test.log` |
| `npx tsc --noEmit --incremental false` | 0 | `tsc.log` |
| `node output/.../causal-bloques-schema.mjs` | 0 (9 casos, 0 desviaciones) | `causal-bloques-schema.log` |
| `node output/.../control-esquema-limpio.mjs` | — (hijo: 16 pruebas, 11 pasan, 5 fallan) | `control-suministros-esquema-limpio.log` |

Estado base, para comparar: `base-*.log` en la misma carpeta.

## Prueba causal del arreglo y fallos medidos sin él

`output/reparacion-verificadores-20260910/causal-bloques-schema.mjs` ejercita
las funciones que usan los cuatro runners contra el `db/schema.sql` real, sin
escribir en él ni en ninguna base. Resultado: 9 casos, 0 desviaciones,
6 AssertionError medidos.

- Mismo SQL con CRLF distinto: pasa. Mismo SQL todo en LF: pasa.
- Una línea del bloque alterada en el esquema (`if new.disponible_previo<1 then`
  → `<99`): **falla**, «El bloque RESERVA KITS B2B de db/schema.sql y el de
  migración no son equivalentes».
- La misma línea alterada en la migración: **falla**, mismo mensaje.
- Bloque ausente del esquema: **falla**, «Falta el bloque RESERVA KITS B2B».
  Con el patrón anterior (`?? ''` en los dos lados) dos ausencias se habrían
  comparado iguales.
- Bloque nuevo sin clasificar: **falla**.
- Dependencia real declarada como independiente (`CARGA KITS B2C` como `false`):
  **falla**. Bloque independiente declarado como dependiente
  (`ETIQUETAS CABLE GENERADAS` como `true`): **falla**.

Segundo experimento causal, sobre el arreglo de la lista contractual: al retirar
`operaciones_carga_kit` de `esperadas` en `scripts/verificar-reserva-kits.mts` y
volver a ejecutar el runner completo, caen **1 de 66** pruebas («Barrido SQL
real: cobertura STATEMENT y fronteras FK no vacías»). El fichero se restauró
inmediatamente después y el hash del manifiesto corresponde al estado corregido.

## Recorrido UI

No aplica: esta unidad no toca interfaz.

## Datos e infraestructura modificados y cómo se aislaron

Cada runner crea y destruye su propia base `qa_<lote>_<uuid>` en
`127.0.0.1:5433` y no lee `.env`. La base compartida `av_design` no se tocó y no
se ejecutó `npm run db:reset`. El control de esquema limpio
(`output/.../control-esquema-limpio.mjs`) crea igualmente una base
`qa_suministros_<uuid>` propia y la elimina en el `finally`. Ninguna operación
Git de escritura.

## Limitaciones y puntos no comprobados

1. **`node scripts/ejecutar-suministros.mjs` sigue en rojo, por un defecto
   ajeno y anterior.** La parte que reparo —simular el esquema anterior a L3A,
   migrar, repetir y reaplicar— ya pasa: imprime «Upgrade poblado y repeticion:
   equipo historico cantidad3 y XYZ0 intactos; cero conversiones». Lo que falla
   después es el verificador hijo `scripts/verificar-suministros.mts`:
   16 pruebas, 11 pasan, 5 fallan. **Gravedad: alta**, porque es una prueba de
   dominio contra Postgres real que hoy no acredita nada.

   Reproducción sin el runner, para descartar que lo cause mi recorte: se crea
   una base `qa_suministros_<uuid>`, se aplica `db/schema.sql` y `db/seed.sql`
   tal cual —sin ninguna simulación de esquema anterior— y se lanza el mismo
   verificador. Fallan **las mismas 5 pruebas**
   (`control-suministros-esquema-limpio.log`). Son previas a esta unidad y
   estaban tapadas por el error que impedía llegar hasta ellas.

   - «Reservas y salidas históricas no acreditan kit nuevo; logística directa
     queda rechazada» (`verificar-suministros.mts:170`):
     `PostgresError: La operacion agrava el deficit de stock del articulo …`,
     lanzado por `validar_deficit_stock()`, que introduce el bloque
     `RESERVA KITS B2B`. El fixture de L3A inserta una salida histórica de 10
     sin existencias; la cota de B2b lo rechaza. Hay que decidir si manda la
     cota de B2b —y entonces el fixture de L3A debe registrar existencias— o si
     el histórico debe poder quedar en déficit.
   - Cuatro pruebas de concurrencia («Concurrencia kit/reserva primero» y
     «Catálogo concurrente composicion/tipo primero») fallan en
     `esperarBloqueo` (`verificar-suministros.mts:59`) con «No se observó
     bloqueo: …» tras 4 s. La segunda sesión ya no espera en el lock que la
     prueba vigila; el mutex `aa_control_statement` que añaden B2b y B2c cambió
     el punto de contención. Hay que decidir si la prueba debe vigilar el nuevo
     punto o si el cambio de contención es un defecto del esquema.

   **No la ablando ni la marco como aceptable.** El arreglo cae en
   `scripts/verificar-suministros.mts` (fichero que no poseo) o en
   `db/schema.sql` (prohibido), así que paro y lo reporto.

2. **`scripts/ejecutar-carga-kits.mjs` conserva un hueco menor** que no toco por
   contrato: su comparación usa `?? ''` en los dos lados, así que si el bloque
   B2c desapareciera de `db/schema.sql` **y** de su migración, el `assert.equal`
   compararía dos cadenas vacías y pasaría. En los cuatro runners reparados eso
   ya no ocurre: la ausencia falla explícitamente. Cambio propuesto:
   sustituir esa línea por `exigirBloqueEquivalente(...)` de
   `scripts/bloques-schema.mjs`. **Gravedad: baja.** Requiere autorización.

3. No se ejecutó `npm run build` ni recorrido de navegador: fuera del alcance de
   esta unidad.

4. La detección de dependencias entre bloques es textual (nombres de objetos
   creados con `create table|function|view|type`). Es conservadora: un bloque
   que solo redefine una función de otro cuenta como dependiente. Como la
   clasificación se declara y se contrasta, cualquier desviación se ve; no se
   recorta nada en silencio.

## Procedimiento de reversión

No hay commit que revertir. Para volver al estado base basta con deshacer los
cambios en los ficheros del manifiesto y borrar `scripts/bloques-schema.mjs`.
Ningún cambio toca `db/`, `src/` ni `package.json`, así que revertir no afecta a
la aplicación: solo devuelve los verificadores a rojo. Las bases QA son
efímeras y ya están eliminadas.

## Decisión solicitada al revisor

1. Aprobar los seis verificadores reparados y el helper
   `scripts/bloques-schema.mjs`.
2. Decidir quién arregla las 5 pruebas de `scripts/verificar-suministros.mts` y
   con qué criterio: si manda la cota de déficit de B2b sobre el fixture de L3A,
   y si las pruebas de concurrencia deben vigilar el nuevo punto de contención.
3. Autorizar o rechazar el cambio menor propuesto en
   `scripts/ejecutar-carga-kits.mjs`.
4. Decidir si la prueba causal
   (`output/reparacion-verificadores-20260910/causal-bloques-schema.mjs`) pasa a
   ser permanente como `scripts/bloques-schema.test.mjs`. Entra sola en
   `npm test` por el glob `scripts/*.test.mjs` y subiría el recuento, que hoy es
   un criterio de aceptación fijado en 805.

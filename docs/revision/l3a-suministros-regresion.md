# ¿Regresión de B2b/B2c o fixture obsoleto? Las cinco pruebas de `verificar-suministros.mts`

Fecha: 10/09/2026. Rama `codex/diagrama-salas`, HEAD `f38baa8`, árbol con
implementación local sin commit. Plan 40, secciones 4, 5-L3, 6 y 7.

**Veredicto: fixture obsoleto, no regresión.** Las dos garantías que tumban las
cinco pruebas —la cota de déficit de stock y el control de escritura no
bloqueante— están escritas en el contrato de B2b, y el mutex no se ha ampliado
ni una tabla más allá de lo que ese contrato enumera. Lo que quedó viejo es la
prueba, que montaba un estado de stock imposible y vigilaba un punto de
contención que el protocolo aprobado sustituyó a propósito. El arreglo va en
`scripts/verificar-suministros.mts`; **no se ha tocado `db/schema.sql` ni
`db/migraciones/`**.

## Lote y contrato

| Campo | Acuerdo |
|---|---|
| Resultado exacto | Decidir con evidencia si los 5 fallos son regresión o fixture obsoleto, y dejar `node scripts/ejecutar-suministros.mjs` en exit 0 sin debilitar lo que comprueba |
| Éxito medible | Runner en exit 0 con recuento, causal con fallos medidos, y los demás verificadores con su mismo recuento |
| Alcance | `scripts/verificar-suministros.mts`, `scripts/ejecutar-carga-kits.mjs`, `scripts/bloques-schema.test.mjs` (nuevo) |
| Fuera de alcance | `db/schema.sql`, `db/migraciones/**`, `src/**`, `package.json`, documentos de revisión anteriores |
| Sistemas protegidos | Base compartida `av_design`, Neon, producción, cualquier operación Git de escritura |
| Comprobaciones obligatorias | Suministros, reserva-kits, recepcion-kits, atribuciones, carga-kits, compras-integrales, `npm test`, `tsc`, `eslint src scripts` |
| Autorización separada | Commit, push, despliegue; cualquier cambio en SQL |

## Estado base y estado entregado

No hay commit: el estado se identifica por hashes.

Estado base medido (Docker arriba, Postgres en `127.0.0.1:5433`):
`node scripts/ejecutar-suministros.mjs` → **exit 1, 16 pruebas, 11 pasan, 5
fallan**, 17,6 s (`base-suministros.log`). Reproduce exactamente lo que reportó
el ejecutor anterior.

Estado entregado: **exit 0, 16 pruebas, 16 pasan, 0 fallan**, 1,9 s
(`final-suministros.log`). Manifiesto:
`output/suministros-regresion-20260910/manifiesto-sha256.txt`.

## Archivos y migraciones incluidos

**Ninguna migración. Ningún cambio en `db/`.** El hash de `db/schema.sql` del
manifiesto es el que ya había al empezar.

- `scripts/verificar-suministros.mts`: fixture de existencias coherente,
  sustitución de `esperarBloqueo` por `exigirControlOcupado`, reintento tras
  40001 y comprobación nueva del déficit histórico.
- `scripts/ejecutar-carga-kits.mjs`: la comparación del bloque B2c pasa a
  `exigirBloqueEquivalente()`; se retira el `nl` local.
- `scripts/bloques-schema.test.mjs` (nuevo): la causal del helper de bloques,
  permanente y dentro de `npm test`.

## Qué se rompió exactamente, y por qué no es regresión

### 1 fallo: `validar_deficit_stock()` sobre la salida de 10 sin existencias

`verificar-suministros.mts:170` insertaba `movimientos … 'salida',10` para el
artículo kit del fixture, que ya está en `articulos_stock_kit` porque su
composición está publicada. `PostgresError 23514` desde
`validar_deficit_stock() line 6`, con «La operacion agrava el deficit de stock
del articulo …».

Los dos criterios que habrían hecho de esto una regresión **no se cumplen**
(`diagnostico-radio.mjs`, esquema completo, base QA propia):

| Comprobación | Resultado medido |
|---|---|
| Material que **no** es de kit: salida 10 y reserva 10 sin existencias | **ACEPTADAS**, `disponible = -20`, y el artículo no entra en `articulos_stock_kit` |
| Déficit creado **antes** de entrar al perímetro, y luego entra | Sobrevive intacto: `disponible = -3` con la fila registrada en el perímetro |
| Agravar ese déficit histórico (-3 → -4) | Rechazado, `23514` |
| Mejorarlo (-3 → -2) | **ACEPTADO** |

Es decir: la guarda alcanza exactamente el perímetro de kit y deja pasar el
histórico; lo único que prohíbe es empeorarlo. Coincide literalmente con el
contrato B2b: «max(0,-D_final)<=max(0,-D_inicial)» y «Un déficit histórico -3
puede mejorar a-2 o quedarse en-3; no puede acabar en-4»
(`l3b-b2b-reserva-contrato.md`). Y con AGENTS.md: el dato histórico sobrevive.

Lo que el fixture montaba no era un histórico, era stock inventado: sacar diez
unidades de un artículo del que no había ninguna entrada.

### 4 fallos: el punto de contención cambió a propósito

`esperarBloqueo` esperaba ver la segunda sesión colgada de un lock en
`pg_stat_activity`. Ya no se cuelga: `entrar_escritura_kit` es un BEFORE
STATEMENT que llama a `pg_try_advisory_xact_lock(21440,2)` y, si otro lo
retiene, **lanza 40001 en el acto**. Medido: la segunda sesión recibe
`40001 Control de escritura ocupado`; tras soltar el control, el reintento
recibe `23514 La composicion requiere equipos por unidad`, que es la garantía
que la prueba protegía.

El punto anterior era el `pg_advisory_xact_lock(hashtextextended('av_design:composiciones',0))`
de `proteger_articulo_de_kit()` (L3A), que sí bloquea. El trigger de B2b entra
antes y rechaza sin llegar a él.

Esto es el protocolo aprobado, no un efecto lateral: `l3b-b2b-reserva-contrato.md`,
«Protocolo de locks: control antes de cualquier padre» — «Si está ocupado
lanza40001: no espera por el control mientras retiene un padre».

Y la prohibición de B2c («No ampliar preventivamente el mutex global a tablas
ajenas», `l3b-b2c-carga-contrato.md`) **no se ha violado**. Comprobado contra
el catálogo del sistema, no contra el texto del SQL:

```
aa_control_statement en 24 tablas = lista contratada B2b (23) + B2c (1). Sin ampliación.
```

Las 23 son exactamente las que enumera el contrato de B2b, `articulos` y
`articulo_composiciones` incluidas; la 24 es `operaciones_carga_kit`, la propia
tabla de hechos de B2c.

### Control complementario: recortar B2b/B2c no reconstruye el estado anterior

`control-anterior-a.mjs "RESERVA KITS B2B"` aplica el esquema sin B2b ni B2c
(`esquemaAnteriorA`) más el seed, y lanza el mismo verificador: **16 pruebas, 3
pasan, 13 fallan**, casi todas con `function tomar_control_escritura_kit() does
not exist`, porque `src/lib/control-escritura.ts` ya depende de ella. El árbol
de `src/` no vuelve atrás recortando SQL, así que ese control **no** puede
acreditar el estado previo de las cinco. Lo que sí acredita, y es el dato útil:
las dos pruebas de catálogo concurrente **pasaban** sin B2b/B2c y dejaron de
pasar con ellos. Su cambio de comportamiento es real; lo que lo autoriza es el
contrato, no que fuera inocuo.

## Qué se cambió en la prueba, y con qué línea del contrato

1. **Existencias reales detrás del histórico** (`verificar-suministros.mts:169`).
   `entrada 20` antes de la `salida 10`. Autoriza el contrato B2b, cota de
   déficit. No se deja de comprobar nada: las aserciones de `faltaParaSala`, de
   `reservadoAqui`/`servidoAqui` y el bucle de cuatro rechazos por
   `/atribucion comercial/` siguen intactos.
2. **Sustitución equivalente de lo que el fixture viejo tocaba de refilón.** Ese
   fixture era el único sitio donde había un artículo de kit en déficit. Se
   añade en su lugar la comprobación explícita en la semántica vigente: un
   artículo con salida de 3 sin existencias **antes** de tener composición entra
   al perímetro conservando `disponible = -3`, agravarlo se rechaza con
   `/agrava el deficit/` y mejorarlo se admite. Se comprueba, además, que el
   artículo queda registrado en `articulos_stock_kit`.
3. **`esperarBloqueo` → `exigirControlOcupado(via, rival)`.** Acredita la
   contención con el rechazo exacto —que solo puede ocurrir habiendo otro dueño
   del control— en vez de con una foto de `pg_stat_activity`. Distingue los dos
   renderizados legítimos y **no admite el otro**: `40001` +
   «Control de escritura ocupado» para SQL directo; `AV_CONCURRENCIA_AGOTADA`
   para una ruta de aplicación, que reintenta la transacción completa tres veces
   (contrato B2b/B2c) antes de traducirlo.
4. **Reintento y comprobación del resultado**, como exige la evidencia de B2c
   («Tras40001, ejecutar y comprobar resultado del reintento»). Las aserciones
   finales de las cuatro pruebas —`/atribucion comercial/`, `esRechazoIntegridad`,
   el recuento de `reservas`, `falta.faltantes`, `reservadoAqui.size` y el
   `count(*)` de composiciones sobre artículos que no son equipo— se conservan
   palabra por palabra.
5. **Cota de vivacidad, no timeout de conveniencia.** `exigirControlOcupado`
   falla con un `AssertionError` explícito si el rival se completa («no hubo
   exclusión») o si se queda esperando 8 s («el control debía rechazarlo en el
   acto»). Sin esto, desactivar el mutex colgaba el proceso y el causal se
   medía como timeout, que el contrato de B2c no admite como causal. En verde no
   se consume: el rechazo llega al instante y el temporizador se cancela.
6. **Fixture de la rama «reserva» de concurrencia**: una `entrada 1` del kit, por
   la misma razón que (1) —esa rama sí confirma una reserva de una unidad—. La
   rama «kit» no confirma ninguna y se queda sin existencias, así que la falta
   esperada sigue siendo 1 en las dos.

Se retira la conexión `monitor`, que solo servía a `esperarBloqueo`, y su
`end()`.

## Criterios de aceptación: esperado / observado / evidencia

| Criterio | Esperado | Observado | Evidencia |
|---|---|---|---|
| `node scripts/ejecutar-suministros.mjs` | Exit 0 con recuento | **Exit 0, 16 pruebas, 16 pasan, 0 fallan** (1,9 s frente a 17,6 s) | `final-suministros.log` |
| Causal del modo `--sin-exclusion` del propio runner | Sigue en rojo | Exit 1, 16 pruebas, 2 fallan | `causal-sin-exclusion.log` |
| `node scripts/ejecutar-reserva-kits.mjs` | 66/66 | Exit 0, 66 pruebas, 66 pasan | `regresion-reserva-kits.log` |
| `node scripts/ejecutar-recepcion-kits.mjs` | 21/21 | Exit 0, 21 pruebas, 21 pasan | `regresion-recepcion-kits.log` |
| `node scripts/ejecutar-atribuciones.mjs` | 24/24 | Exit 0, 24 pruebas, 24 pasan | `regresion-atribuciones.log` |
| `node scripts/ejecutar-carga-kits.mjs` | 30/30 | Exit 0, 30 pruebas, 30 pasan | `regresion-carga-kits.log` |
| `node scripts/ejecutar-compras-integrales.mjs` | Exit 0 | Exit 0, `pruebas=20 fallos=0` | `regresion-compras-integrales.log` |
| `npm test` | 806 o más | **815 pruebas, 815 pasan** (806 + las 9 nuevas de `bloques-schema.test.mjs`) | `npm-test.log` |
| `npx tsc --noEmit --incremental false` | Exit 0 | Exit 0 | `tsc.log` |
| `npx eslint src scripts` | Exit 0 | Exit 0, sin avisos | `eslint.log` |
| Radio real de la cota y del mutex | No alcanza material ajeno | 4 comprobaciones, todas OK | `diagnostico-radio.log` |
| Causal del arreglo | Cae cuando se rompe la garantía | 6 casos, 0 desviaciones | `causal-suministros.log` |

## Comandos ejecutados, fecha, salida y ubicación de logs

Fecha 10/09/2026. Logs en `output/suministros-regresion-20260910/`.

| Comando | Exit | Log |
|---|---|---|
| `node scripts/ejecutar-suministros.mjs` (base) | 1 (16/11/5) | `base-suministros.log` |
| `node output/…/control-anterior-a.mjs "RESERVA KITS B2B"` | 0 (hijo: 16/3/13) | `control-sin-b2b-b2c.log` |
| `node output/…/diagnostico-radio.mjs` | 0 | `diagnostico-radio.log` |
| `node scripts/ejecutar-suministros.mjs` (final) | 0 (16/16) | `final-suministros.log` |
| `node scripts/ejecutar-suministros.mjs --sin-exclusion` | 1 (16/14/2) | `causal-sin-exclusion.log` |
| `node output/…/causal-suministros.mjs` | 0 (6 casos, 0 desviaciones) | `causal-suministros.log` |
| `node scripts/ejecutar-reserva-kits.mjs` | 0 (66/66) | `regresion-reserva-kits.log` |
| `node scripts/ejecutar-recepcion-kits.mjs` | 0 (21/21) | `regresion-recepcion-kits.log` |
| `node scripts/ejecutar-atribuciones.mjs` | 0 (24/24) | `regresion-atribuciones.log` |
| `node scripts/ejecutar-carga-kits.mjs` | 0 (30/30) | `regresion-carga-kits.log` |
| `node scripts/ejecutar-compras-integrales.mjs` | 0 (20/0) | `regresion-compras-integrales.log` |
| `npm test` | 0 (815/815) | `npm-test.log` |
| `npx tsc --noEmit --incremental false` | 0 | `tsc.log` |
| `npx eslint src scripts` | 0 | `eslint.log` |

Estados intermedios, para ver cómo bajó el recuento de fallos: `fix1-` (15/1),
`fix2-` (15/1), `fix3-` (16/0), `fix4-`, `fix5-`.

## Prueba causal del arreglo y fallos medidos sin él

`output/suministros-regresion-20260910/causal-suministros.mjs`. Cada caso rompe
**una** cosa en una copia aislada —base QA propia con UUID, y para las
mutaciones de fichero una copia del árbol en `%TEMP%`— y cuenta las pruebas que
caen. El árbol compartido no se toca en ningún caso.

| Caso | Fallos medidos | Pruebas caídas |
|---|---|---|
| Control, sin romper nada | **0** de 16 | — |
| `validar_deficit_stock()` sustituida por `return null` | **1** | Reservas y salidas históricas |
| `exigir_logistica_sin_kits()` vaciada | **2** | Reservas y salidas históricas · Concurrencia kit primero |
| `tomar_control_escritura_kit()` sin el advisory lock (nunca ocupado) | **4** | Concurrencia kit · Concurrencia reserva · Catálogo composicion · Catálogo tipo |
| `proteger_articulo_de_kit()` sustituida por `return new` | **3** | Guardas inversas · Catálogo composicion · Catálogo tipo |
| Sin mi fixture de existencias (histórico de la nada) | **2** | Reservas y salidas históricas · Concurrencia reserva primero |

6 casos, **0 desviaciones**. Lectura de los dos que importan: la comprobación
nueva del déficit **cae** si se desactiva la cota (no es un adorno), y la
comprobación nueva de contención **cae en las cuatro** si se desactiva el mutex
(mide la exclusión real, no una foto de `pg_stat_activity`). Y el arreglo del
fixture es necesario: sin él vuelven a caer 2.

Revertir mis cambios enteros en `scripts/verificar-suministros.mts` devuelve el
estado base medido al principio: 16 pruebas, 11 pasan, **5 fallan**.

`scripts/bloques-schema.test.mjs` es la causal del helper de bloques hecha
permanente: 9 pruebas, entre ellas la que cierra el defecto del `?? ''` —bloque
ausente **en los dos ficheros** también falla—, que es justamente lo que
`scripts/ejecutar-carga-kits.mjs` acaba de dejar de tener.

## Recorrido UI

No aplica: esta unidad no toca interfaz.

## Datos o infraestructura modificados y cómo se aislaron

Todo contra `127.0.0.1:5433`, en bases `qa_suministros_<uuid>` /
`qa_carga_<uuid>` / `qa_compras_<uuid>` creadas y eliminadas por cada runner o
por mis scripts de `output/`, con `drop database … with(force)` en el `finally`.
No se tocó `av_design`, no se ejecutó `npm run db:reset`, no se leyó `.env` y no
se abrió ninguna conexión a Neon ni a producción. Las copias del árbol para las
mutaciones causales viven bajo `%TEMP%`, se comprueba que están dentro de él
antes de borrarlas y se borran siempre. Ninguna operación Git de escritura.

## Limitaciones y puntos no comprobados

1. **El estado previo a B2b/B2c no es reconstruible recortando SQL.**
   `src/lib/control-escritura.ts` ya depende de `tomar_control_escritura_kit()`,
   así que el control con el esquema recortado deja 13 de 16 pruebas en rojo por
   una función que no existe. Para las dos pruebas de catálogo concurrente sí
   vale, y pasaban. Para las otras tres, el veredicto se sostiene en el
   diagnóstico de radio sobre el esquema completo y en el texto de los contratos,
   no en una ejecución del código anterior. **Gravedad: baja**, pero conviene
   decirlo: no he ejecutado el árbol de `src/` anterior a B2b.
2. **La rama «reserva» de concurrencia comprueba el reintento en serie, no en
   paralelo.** El rival se relanza después de soltar el control, no queda
   esperando. Es lo que permite el protocolo —el control no espera— y el estado
   final que se comprueba es el mismo que antes; pero deja de ejercitarse el
   solapamiento real de las dos transacciones en el tiempo. La contención en sí
   sigue medida, con el 40001.
3. **`npm test` pasa de 806 a 815** por las 9 pruebas nuevas de
   `scripts/bloques-schema.test.mjs`. Si el criterio de aceptación de otro lote
   estaba fijado en 806, hay que actualizarlo.
4. No se ejecutó `npm run build` ni recorrido de navegador: fuera del alcance.
5. No he revisado si otros verificadores usan el patrón `esperarBloqueo` contra
   tablas del mutex. Solo `scripts/verificar-suministros.mts` lo tenía.

## Procedimiento de reversión

No hay commit que revertir. Deshacer los cambios de
`scripts/verificar-suministros.mts` y `scripts/ejecutar-carga-kits.mjs` y borrar
`scripts/bloques-schema.test.mjs` devuelve el estado base: suministros a 5
fallos, `npm test` a 806, el resto igual. Nada toca `db/`, `src/` ni
`package.json`, así que revertir no afecta a la aplicación. Las bases QA son
efímeras y ya están eliminadas.

## Decisión solicitada al revisor

1. Aprobar el veredicto —fixture obsoleto, no regresión— y el arreglo en
   `scripts/verificar-suministros.mts`, con el criterio de que la contención se
   acredita con el 40001 y la semántica con el reintento.
2. Confirmar que la cota de déficit de B2b manda sobre cualquier fixture que
   monte stock inventado, y que el histórico legítimo es el que existe antes de
   entrar al perímetro.
3. Aprobar el paso permanente de la causal de bloques a
   `scripts/bloques-schema.test.mjs` y **actualizar a 815** el recuento de
   `npm test` allí donde estuviera fijado en 805 u 806.
4. Aprobar el cambio menor ya aplicado en `scripts/ejecutar-carga-kits.mjs`
   (`?? ''` → `exigirBloqueEquivalente()`), que el ejecutor anterior dejó
   propuesto.

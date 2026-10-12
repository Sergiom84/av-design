# L4 · Corrección del gate de lint (`react-hooks/set-state-in-effect`)

Fecha: 2026-09-10. Ejecutor. No es una autoaprobación del gate.

## Lote y contrato

Corrección puntual sobre la unidad L4 ya entregada (`docs/revision/l4-entrega.md`).
Eliminar la cascada de renders que `npx eslint src scripts` señala en
`src/components/asistente-equipamiento/alta-equipo.tsx:86`, conservando
exactamente el comportamiento que L4 acredita. Prohibido añadir supresiones
(`eslint-disable`, `@ts-ignore`), ablandar pruebas o dejar stubs.

Radio autorizado: `src/components/asistente-equipamiento/`. Fuera de radio y no
tocados: `scripts/**`, `db/**`, `src/lib/suministros*`, `src/components/almacen/**`,
`src/components/carga/**`, `src/components/compras/**`, `src/app/acciones-*.ts`.

## Estado base y estado entregado

El árbol no tiene commit para esta unidad: `src/components/asistente-equipamiento/`
está sin seguimiento (`?? src/components/asistente-equipamiento/`). No hay SHA, así
que el estado se identifica por conducta medida y por hashes del entregado.

Estado base (reproducido antes de tocar nada, `output/l4-lint-2026-09-10/eslint-base.txt`):

- `npx eslint src scripts` → código de salida 1, 1 error + 1 aviso.
- Error: `alta-equipo.tsx:86:7 react-hooks/set-state-in-effect`.
- `npm test` → código de salida 0, `tests 805 / pass 805 / fail 0`
  (`output/l4-lint-2026-09-10/npm-test-base.txt`).

Estado entregado (sha256):

```
9efaa3486e8c5705953765f33d9924c51946b56afa1a9a64852321ab54230119  src/components/asistente-equipamiento/alta-equipo.tsx
6629e7c8e2633a3b5305064e69481843df206ed94d878c2cfc6b95880fb55321  src/components/asistente-equipamiento/alta-equipo.test.tsx
```

## Archivos y migraciones incluidos

- `src/components/asistente-equipamiento/alta-equipo.tsx` (arreglo).
- `src/components/asistente-equipamiento/alta-equipo.test.tsx` (una prueba nueva).
- `docs/revision/l4-correccion-lint.md` (este documento).

Ninguna migración. Ni `db/**`, ni `data/**`, ni `scripts/**`, ni acciones de
servidor. `asistencia.tsx` no se tocó.

## Qué cambió y por qué elimina la cascada

El efecto sincronizaba con `setState` un estado que en realidad es derivado de una
prop de estado local: al no haber artículo elegido vaciaba `hechosCandidato` y
`avisoHechos` en el propio cuerpo del efecto, es decir, un render que provoca otro
render. La orientación que cita la propia regla (react.dev, «You Might Not Need an
Effect») es que el estado derivado se calcula durante el render y el efecto queda
solo para el sistema externo.

El arreglo:

1. El estado ya no son dos casillas sueltas (`DatoTecnico[]` + aviso), sino una
   sola respuesta con el artículo al que pertenece:
   `{ articuloId, datos, aviso? }` (`HechosDelCandidato`), o `null`.
2. El efecto sale antes de hacer nada si no hay artículo (`if (!articuloId) return;`)
   y solo escribe estado **después** del `await`, dentro del `catch`/`then` de la
   petición, que es exactamente el caso que la regla permite: el efecto existe por
   el sistema externo (`/api/catalogo/[id]/hechos`) y conserva su `AbortController`
   y su comprobación de cancelación.
3. Lo que se enseña se deriva durante el render:

   ```ts
   const recibidos = articulo?.id && hechosRecibidos?.articuloId === articulo.id ? hechosRecibidos : null;
   const hechosCandidato = recibidos?.datos ?? [];
   const avisoHechos = recibidos?.aviso;
   ```

   Sin artículo, `recibidos` es `null` sin escribir estado: no hay nada que limpiar
   y desaparece la cascada.

Efecto lateral deliberado y a favor del contrato: la comparación por `articuloId`
descarta durante el render una respuesta que ya no es del artículo elegido, así que
los hechos del artículo anterior no se pintan bajo el nuevo mientras llega su
respuesta. Antes sí se pintaban: el vaciado síncrono limpiaba el aviso pero no los
hechos.

## Invariantes conservados

| Invariante | Cómo queda garantizado |
|---|---|
| Sin artículo no hay hechos ni aviso | `recibidos` exige `articulo?.id`; el efecto no arranca sin id |
| Fallo de `/hechos` → error visible + hecho `sin_documentar` de sesión | El `catch` sigue escribiendo `HECHOS_NO_DISPONIBLES` y el aviso; no se toca `perfilEquipo` |
| Nunca se reconstruye la captación por nombre del modelo | El `catch` fuerza el hecho `sin_documentar`, que en `captacionDeVoz` gana al perfil por modelo |
| Ausencia de datos ≠ compatibilidad | Sin respuesta propia, el candidato va con `[]` → `desconocida` / `sin_documentar` |
| Una respuesta antigua no pisa a la nueva | `AbortController` (como antes) **más** el filtro por `articuloId` en el render |
| El catálogo no viaja al navegador | Sigue el mismo `BuscadorArticulo` contra `/api/catalogo`; no se añadió ninguna carga |
| Sin emojis, sin rediseño | No se tocó ningún componente visual ni token; `asistencia.tsx` intacto |

## Criterios de aceptación: esperado / observado / evidencia

| Criterio | Esperado | Observado | Evidencia |
|---|---|---|---|
| Lint | `npx eslint src scripts` sin error ni aviso de `src/components/asistente-equipamiento/` | Código de salida **0**; único aviso restante, ajeno: `scripts/verificar-carga-kits.mts:247` | `output/l4-lint-2026-09-10/eslint-final.txt` |
| Pruebas | `npm test` ≥ 805, cero fallos | `tests 806 / pass 806 / fail 0`, salida 0 (805 base + 1 nueva) | `output/l4-lint-2026-09-10/npm-test-final.txt` |
| Tipos | `npx tsc --noEmit --incremental false` salida 0 | Salida **0**, sin diagnósticos | `output/l4-lint-2026-09-10/tsc-final.txt` |
| Prueba causal | Falla si se rompe un invariante | 1 de 8 pruebas del fichero cae por cada rotura, con la aserción concreta | `output/l4-lint-2026-09-10/causal-A.txt`, `causal-B.txt` |

## Comandos ejecutados, fecha, salida y ubicación de logs

Fecha: 2026-09-10. Logs en `output/l4-lint-2026-09-10/` (`output/` está en `.gitignore`).

| Comando | Código de salida | Log |
|---|---|---|
| `npx eslint src scripts` (base) | 1 (1 error, 1 aviso) | `eslint-base.txt` |
| `npm test` (base) | 0 · `tests 805 / pass 805 / fail 0` | `npm-test-base.txt` |
| `node --import tsx --test src/components/asistente-equipamiento/alta-equipo.test.tsx` | 0 · `tests 8 / pass 8 / fail 0` | (en consola; repetido dentro de `npm test`) |
| `npx eslint src scripts` (final) | **0** (1 aviso ajeno en `scripts/`) | `eslint-final.txt` |
| `npm test` (final) | **0** · `tests 806 / pass 806 / fail 0` | `npm-test-final.txt` |
| `npx tsc --noEmit --incremental false` | **0** | `tsc-final.txt` |

No se ejecutó `npm run seed`, `db:reset`, Docker, ni ningún verificador contra
Postgres: nada de lo tocado los alcanza.

## Prueba causal del arreglo y fallos medidos sin él

Prueba nueva en `alta-equipo.test.tsx`:
**«los hechos de un artículo no se enseñan bajo el siguiente mientras llegan los
suyos»**. Elige el artículo `a`, cuyos hechos documentan una captación con el
concepto `Captación documentada del equipo A`; comprueba que se pinta; vuelve a
abrir la lista, elige el artículo `b`, cuya petición a `/hechos` queda pendiente a
propósito, y exige que el texto de A haya desaparecido y que B salga como
`micrófono integrado desconocido`.

Las roturas se hicieron sobre una **copia aislada** en
`output/l4-lint-2026-09-10/causal/` (el árbol compartido no se revirtió ni se tocó).
La copia importa `asistencia` por alias y añade `import React` porque `output/` queda
fuera del `tsconfig` del proyecto; nada más cambia. Copia intacta: 8/8 en verde.

| Rotura introducida en la copia | Resultado medido | Aserción que cae |
|---|---|---|
| A — se quita el filtro por artículo: `const recibidos = hechosRecibidos;` | `tests 8 / pass 7 / fail 1` | `los hechos de A no pueden pisar a B` (`doesNotMatch /Captación documentada del equipo A/`) |
| B — el `catch` deja de forzar el hecho `sin_documentar`: `cambiarHechosRecibidos({ articuloId, datos: [] })` | `tests 8 / pass 7 / fail 1` | `si fallan los hechos se enseña el error y no se reconstruye la captación por nombre` (`match /No se han podido cargar los hechos técnicos/`) |

Es decir: cada invariante está sujeto por una prueba que cae de verdad al romperlo,
medido, no estimado.

## Recorrido UI

**No ejecutado.** No se levantó `npm run dev` ni navegador: el cambio es una
reorganización de estado sin ninguna diferencia visual pretendida, y el orden de
validación visual del proyecto (escritorio primero, móvil al cierre) corresponde al
QA de la unidad, no a esta corrección. Queda como punto no comprobado abajo.

## Datos o infraestructura modificados y cómo se aislaron

Ninguno. No se tocó base de datos, `.env`, producción ni CSV. Los experimentos
causales vivieron en `output/l4-lint-2026-09-10/causal/`, directorio ignorado por
Git, y no se importan desde `src/`. Ninguna operación de escritura de Git
(`add`, `commit`, `stash`, `checkout`, `reset`, `restore`).

## Limitaciones y puntos no comprobados

1. Sin navegador real: el flash de perfil mientras cargan los hechos (P2 abierto en
   `l4-entrega.md`) sigue sin verificarse a ojo.
2. El aviso ajeno de `scripts/verificar-carga-kits.mts:247` (`'momento' asignada y
   no usada`) sigue vivo; es de otro ejecutor y no se tocó.
3. Los P2 que L4 dejó abiertos siguen abiertos: `referencias_repetidas` sin
   elemento, `ArticuloElegible` sin marca/modelo separados.
4. El cambio de conducta al cambiar de artículo (ya no se enseñan los hechos del
   anterior) es una mejora respecto a lo que L4 entregó, no una equivalencia byte a
   byte: se señala explícitamente para que el revisor lo acepte o lo rechace.

## Procedimiento de reversión

No hay commit que revertir. La reversión es puntual y sobre dos ficheros:

1. En `alta-equipo.tsx`: sustituir `HechosDelCandidato` + la derivación del render
   por los dos `useState` anteriores (`hechosCandidato`, `avisoHechos`) y devolver
   al efecto la rama síncrona `if (!articulo?.id) { … return; }`.
2. En `alta-equipo.test.tsx`: borrar la prueba «los hechos de un artículo no se
   enseñan bajo el siguiente mientras llegan los suyos».

Consecuencia conocida de revertir: `npx eslint src scripts` vuelve a salida 1 con
el error `react-hooks/set-state-in-effect`, y el gate de lint del plan 40 se cae.

## Decisión solicitada al revisor

1. ¿Se acepta el patrón de estado derivado con la respuesta etiquetada por
   `articuloId` como arreglo del gate de lint, sin supresiones?
2. ¿Se acepta el cambio de conducta del punto 4 de Limitaciones (no enseñar los
   hechos del artículo anterior mientras llega la respuesta del nuevo) como parte
   del contrato de L4, o se pide dejarlo escrito además en `l4-entrega.md`?
3. ¿Se exige recorrido UI en navegador antes de dar por cerrada esta corrección?

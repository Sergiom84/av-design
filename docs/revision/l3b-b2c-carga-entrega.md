# Entrega B2c: carga unitaria desde reserva gestionada

Estado: **entregado para revisión independiente, no aprobado**. B2, L3B y
plan40 continúan abiertos. Contrato:
`docs/revision/l3b-b2c-carga-contrato.md`. Diseño aprobado en ronda1 con
precisiones en `output/revisor-plan40-01a080e5/b2b/diseno-b2c-ronda1.md`.

Cierre de evidencia de esta unidad (runner reejecutado, desktop, CRLF/B2b):
`docs/revision/l3b-b2c-cierre.md`. No hay autoaprobación.

No hay autoaprobación de B2c, B2, L3B ni plan40. El revisor independiente es
otra unidad. Sin Git, push, merge ni producción.

## Corrección ronda 2 (no aprobada)

P0 y P1 de contrato, una sola ronda. Sin radio L4.

- Formulario de carga usa `useConservarFormulario`: tras `{error}` no se
  resetea el select de ubicación ni el token. Tras éxito, el reset nativo
  sigue y un `revalidate` remonta con token nuevo.
- Marcar remonta con `key={`${línea}:${cargado}`}`: marcar→desmarcar no reusa
  el token del primer hecho.
- Filas B2b en la tabla genérica: sin Liberar genérico ni Quitar. Liberar
  kit sigue en `ReservasPorSuministro`. Históricas/genéricas no cambian.
- `faltaParaSala` abre RR readonly y lee reservas de suministro en la misma
  instantánea. Logística ya no llama a `obtenerReservasSuministro` aparte.

Desktop (`iniciar-qa-plan40.mjs`, 390/320) **sigue sin ejecutarse**. Los P0 de
formulario se cubren con tests DOM; no se dan por cerrados en navegador.

## Delta respecto manifiesto507 / B2b

B2b entregó reserva/liberación unitaria. B2c añade el hecho de sacar esa unidad
del estante:

- Una preparación = una reserva B2b activa, cantidad 1, carga nueva con una
  línea. Se elige la reserva; no se infiere el suministro por artículo.
- Preparar no mueve stock ni sirve. Tokens distintos de la misma reserva
  reutilizan la carga; cada token queda registrado. El autor/hecho original no
  se sustituye.
- Marcar es valor booleano explícito. True→false→replay del primer true
  conserva false.
- Confirmar exige marcado, carga en preparación, suministro activo, reserva
  activa, obra abierta y ubicación existente con saldo local ≥1. No basta el
  saldo global ni `ubicacion_id` NULL. No se exige disponible global ≥1.
- Una TX: reserva activa→servida, salida comercial 1 en la ubicación/sala
  canónicas, `movimiento_suministros` 1 con `salida_movimiento_id` NULL,
  cabecera cargada. Se conserva `reserva_suministros`.
- Resultado medible: E1/R1/D0 → E0/R0/D0; reservadoA0/servidoA1/coberturaA1;
  B intacta; piezas/puertos/conexiones/stock de componentes sin cambios.
- Liberar B2b sigue permitido antes de servir (la preparación queda no
  operable). Tras la salida, liberar rechaza. No hay cancelación, reactivación,
  borrar carga ni cierre de obra para kits. El flujo genérico de kit sigue
  bloqueado.
- `proteger_logistica_kit`, `proteger_reserva_gestionada` y
  `validar_operacion_reserva` admiten reservar y servir en la misma TX.
- FK de `carga_id`/`linea_id`/`movimiento_id` restrictivas y diferidas: nacen
  en la misma transacción que el hecho.
- Lector RR de `/carga/[id]`: cabecera, línea, identidad gestionada, cobertura
  y saldos de ubicación en una sola instantánea. Logística ofrece Preparar
  junto a la reserva gestionada.

No se tocó `control-escritura.ts` ni `sql-reintentos.ts`: el protocolo B2b
(reintento 3 de TX completa, sin reintentar commit incierto) cubre B2c.
`src/lib/carga.ts` no cambia: la atribución de la salida la materializa SQL.

## Comandos, códigos de salida y recuentos

Host QA: `127.0.0.1:5433`, pathname `/qa_carga_<32 hex>`. Cada runner crea y
elimina su base. No se usó `av_design` ni Neon/Render.

| Gate | Resultado | Notas |
|---|---|---|
| `node scripts/ejecutar-carga-kits.mjs` (ronda2) | exit 0, **30/30**, 0 canceladas | Misma suite; QA `qa_carga_*` eliminada al terminar |
| `--sin-marca` | exit 1, **1 AssertionError** | Confirmar sin marcar ya no dice «Marca la linea»; queda la completitud diferida |
| `--sin-vinculo` | exit 1, **1 AssertionError** | Insert genérico de `cargas` en sala kit deja de rechazarse |
| `--sin-idempotencia` | exit 1, **2 AssertionErrors** | Token original no queda; replay con otra solicitud no dice «otros datos» |
| `--sin-entrada-temprana` | exit 1, **1 AssertionError** | Barrido: falta `aa_control_statement` en `operaciones_carga_kit` |
| `--sin-rr` | exit 1, **1 AssertionError** | Segunda lectura RC ve `servida` mezclada con cabecera anterior |
| `--sin-completitud` | exit 0, 30/30 | Ancla del primer `if` de `comprobar_operacion_carga`; el resto de la función sigue. Causal débil; la de marcado cubre el hueco |
| `npx tsc --noEmit` (ronda2) | exit 0 | |
| `npx eslint` radio ronda2 | exit 0 | |
| Tests DOM carga/reservas + guardas | exit 0, **9/9** | Conserva ubicación tras error; marcar/desmarcar tokens distintos; sin Quitar en gestionada |
| Desktop `iniciar-qa-plan40.mjs` | **no ejecutado** | Hueco explícito: login→preparar→marcar→confirmar→reload y error recuperable de ubicación |
| `ejecutar-reserva-kits.mjs` | no llega a las pruebas | Compara bloque B2B schema/migración sin normalizar CRLF (Windows). Fichero ajeno |
| B1 / B2a / compras runners | no ejecutados aquí | Tras el fallo temprano de B2b por CRLF; `npm test` cubre la lógica pura |

Cero cancelaciones en el runner B2c. Timeout no se contó como causal: el lector
RR usa barrera real (pausa entre lecturas + mutante en otra conexión). Tras
40001, `carrera` reejecuta y comprueba el rechazo de negocio.

## Límites y limpieza de QA

- No se recorrió el escritorio. Los P0 de formulario tienen test DOM (select
  y token tras error; tokens distintos al cambiar el marcado). Falta recarga
  real y 390/320.
- `--sin-completitud` no tumba aserciones: no se presenta como causal de
  completitud. Usar `--sin-marca`.
- Ubicaciones reservables/cuarentena siguen siendo L3E. B2c trata cualquier
  ubicación existente con saldo local como válida.
- El runner B2b no se adaptó: su lista `aa_control_statement` no incluye
  `operaciones_carga_kit` y su comparación schema/migración no normaliza CRLF.
- Cada `ejecutar-carga-kits.mjs` hace `drop database ... with (force)` en
  `finally`. No quedó ninguna base `qa_carga_*` a cargo de este ejecutor al
  cerrar el último runner.

## Ficheros tocados

- `db/migraciones/2026-09-carga-kits.sql`
- `db/schema.sql` (solo el bloque `-- BEGIN CARGA KITS B2C`)
- `src/lib/operaciones-carga.ts` (ya existía; sin cambio de protocolo)
- `src/lib/datos-almacen.ts` (snapshot RR de carga)
- `src/lib/reservas-suministro-lectura.ts`
- `src/app/acciones-almacen.ts` (`prepararCargaKitConEstado`, `marcarCargaKitConEstado`, `confirmarCargaKitConEstado`)
- `src/app/carga/[id]/page.tsx`
- `src/app/salas/[id]/logistica/page.tsx`
- `src/components/carga/lista-carga.tsx`
- `src/components/carga/formulario-carga-kit.tsx`
- `src/components/carga/formulario-carga-kit.test.tsx`
- `src/components/almacen/reservas-sala.tsx`
- `src/components/almacen/reservas-sala.test.tsx`
- `src/components/almacen/reservas-suministro.tsx`
- `src/components/almacen/reservas-suministro.test.tsx` (`cargaId` en el fixture)
- `scripts/verificar-carga-kits.mts` (nuevo)
- `scripts/ejecutar-carga-kits.mjs` (nuevo)
- `docs/revision/l3b-b2c-carga-entrega.md` (este fichero)

No se modificaron `control-escritura.ts`, `sql-reintentos.ts`, `carga.ts`,
catálogo, asistente, L4, `.env`, producción ni `docs/revision/estado-plan40.md`.

## Cambios requeridos en ficheros ajenos

1. `scripts/ejecutar-reserva-kits.mjs` — normalizar `\r\n` al comparar el bloque
   B2B de `schema.sql` con la migración (mismo defecto que B2c ya corrige en
   su runner). Sin eso el runner B2b ni arranca en Windows.
2. `scripts/verificar-reserva-kits.mts` — en el barrido
   `aa_control_statement`, añadir `operaciones_carga_kit` a `esperadas`.
3. Runners B2a/compras si copian el `assert.equal` de bloques SQL sin
   normalizar CRLF, el mismo arreglo.
4. Recorrido desktop y 390/320: arquitecto o revisor con
   `scripts/iniciar-qa-plan40.mjs` sobre una QA nueva, dueño único.

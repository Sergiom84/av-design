# Cierre de evidencia B2c · carga unitaria

Estado: **evidencia ejecutada para revisión independiente**. No se aprueba
B2c, B2, L3B ni plan40. Contrato:
`docs/revision/l3b-b2c-carga-contrato.md`. Entrega previa:
`docs/revision/l3b-b2c-carga-entrega.md`.

Sin Git, push, merge, producción, Neon, Render ni `av_design`. Postgres
local `127.0.0.1:5433` (contenedor `av_design_db`, healthy). Solo bases
`qa_*` propias, eliminadas al terminar.

## Qué se hizo en esta unidad

El código B2c ya estaba. No se tocó `bloqueoComercial`. Se reejecutó el
runner, se recorrió el escritorio y se cerraron los huecos ajenos que
impedían arrancar B2b. Ronda única posterior: Quitar en fila B2b servida.

1. Runner B2c reejecutado: 30/30, 0 canceladas.
2. Recorrido desktop obligatorio: login → logística → preparar → marcar →
   error recuperable de ubicación → confirmar → replay HTTP 200 → reload;
   luego 390 y 320. Capturas y log en
   `output/plan40-b2c-cierre-20260910/`.
3. Huecos ajenos B2b:
   - CRLF schema/migración: ya lo cubre `scripts/bloques-schema.mjs`
     (`exigirBloqueEquivalente`). No se reintrodujo un `assert.equal` crudo.
   - `operaciones_carga_kit` ya estaba en `esperadas` de
     `scripts/verificar-reserva-kits.mts`. No se tocó ese fichero.
   - El runner B2b no arrancaba porque `esquemaAnteriorA` exige clasificar
     todos los bloques y faltaba `REVISION DISENO L5`. Cambio mínimo:
     `'REVISION DISENO L5': false` en `scripts/ejecutar-reserva-kits.mjs`.
     Tras eso, B2b 66/66.

## Comandos, códigos de salida y recuentos

Host: `127.0.0.1:5433`. Cada runner crea y elimina su `qa_*`.

| Gate | Exit | Recuento | Log |
|---|---|---|---|
| `node scripts/ejecutar-carga-kits.mjs` (cierre) | 0 | 30/30, fail 0, cancelled 0 | `output/plan40-b2c-cierre-20260910/carga-base.log` |
| `node scripts/ejecutar-carga-kits.mjs` (ronda única Quitar) | 0 | 30/30, fail 0, cancelled 0 | `output/plan40-b2c-cierre-20260910/carga-ronda3.log` |
| `node scripts/ejecutar-carga-kits.mjs` (corrección tras revisión) | 0 | **32/32**, fail 0, cancelled 0 | `output/plan40-b2c-cierre-20260910/carga-ronda4.log` |
| `node --import tsx --test src/lib/control-escritura.test.ts src/components/almacen/reservas-sala.test.tsx src/components/almacen/reservas-suministro.test.tsx` | 0 | 6/6 | stdout de la corrección |
| Desktop `orquestar.mjs` tras `reservasVinculadas` | 0 | sin Quitar/Liberar en fila B2b servida; 390/320 | `desktop.log`, `post-quitar/` |
| `--sin-marca` | 1 | 29 pass, **1 AssertionError** (`/Marca la linea/`) | `causal--sin-marca.log` |
| `--sin-vinculo` | 1 | 29 pass, **1 AssertionError** (falta rechazo) | `causal--sin-vinculo.log` |
| `--sin-idempotencia` | 1 | 28 pass, **2 AssertionError** (token original / `otros datos`) | `causal--sin-idempotencia.log` |
| `--sin-entrada-temprana` | 1 | 29 pass, **1 AssertionError** (`operaciones_carga_kit` en STATEMENT) | `causal--sin-entrada-temprana.log` |
| `--sin-rr` | 1 | 29 pass, **1 AssertionError** (lector mezcla estados) | `causal--sin-rr.log` |
| `node scripts/ejecutar-reserva-kits.mjs` | 0 | 66/66, fail 0, cancelled 0 | `reserva-b2b.log` |

Timeout no se contó como causal. Tras 40001 el runner reejecuta y
comprueba el rechazo de negocio. La carrera borrar-ubicación no cuenta
40P01 no reintentado: el segundo intento es rechazo de negocio
(`inmutable` si ya sirvió; `Elige la ubicacion` si borra antes).

`npm test` / `tsc` / `eslint` globales no se reejecutaron; sí los tests
DOM/mapeo citados.

## Desktop

- URL: `http://127.0.0.1:3128` (solo durante el ensayo).
- Usuario: `qa.proyectista` / `EnsayoPlan40!2026` (base desechable).
- Base: `qa_plan40_ui_6e414269f4614bda8d04c15eb03e138b`, eliminada al
  escribir `cerrar`.
- Fixture: recepción B2a de 1/2 + reserva B2b de la unidad A
  (`preparar.mts`). B queda pendiente.

Pasos observados (`desktop-resultado.json`):

1. Login → `/`.
2. `/salas/fddb7fea-adaa-482b-9d94-919b1e1c9e95/logistica`. Cobertura
   A `1/0/0/0`, B `0/0/1/0`. Aviso comercial visible. `Preparar carga`
   genérica deshabilitada.
3. Preparar en Reservas por suministro →
   `/carga/23982905-8347-43ee-8f36-d5b3cb9c4896`.
4. Marcar → «Listo para cargar» / Desmarcar.
5. Confirmar con ubicación sin saldo: alerta
   `No hay una unidad en esa ubicacion`; select y token
   `ebb34ecb-6ca2-454c-ad9a-c9ceaccad6e2` conservados.
6. Confirmar con `Almacén QA B2c`. Cabecera cargada.
7. Replay del POST: HTTP 200. Reload conserva «La carga ya salió del
   almacén.»
8. Logística final: A `0/1/0/0`, B `0/0/1/0`. SQL: stock 0, 1 salida
   en la ubicación elegida, 2 piezas intactas.

Capturas: `desktop-logistica-antes.png`, `desktop-preparada.png`,
`desktop-marcada.png`, `desktop-error-ubicacion.png`,
`desktop-confirmada.png`, `desktop-reload.png`, `desktop-final.png`,
`movil-390.png`, `movil-390-derecha.png`, `movil-320.png`,
`movil-320-derecha.png`.

390/320: `document.documentElement.scrollWidth` igual al viewport,
tabla con scroll interno, `prefers-reduced-motion: reduce`. Tras servir,
el grupo de suministros ya no tiene botón operable; Tab sale al
contenedor de «Material reservado».

## QA creadas y eliminadas (esta unidad)

Creadas y borradas por los runners o por `iniciar-qa-plan40.mjs`:

- `qa_carga_*` (base + cinco causales)
- `qa_reserva_39da7d45065f4ba7a5d13882f13af88f` (B2b 66/66)
- `qa_plan40_ui_*` de los intentos desktop, incluida
  `qa_plan40_ui_6e414269f4614bda8d04c15eb03e138b`

No se tocaron las ajenas que ya existían:
`qa_compras_ed6256d5544d4d6e9b09dcf7fc92d8c8`,
`qa_fichas_tecnicas_6c3dd2f6b969496c8493b22f7b7722b9`.

Next.js añadió `.next-qa-plan40` a `tsconfig.json` durante el ensayo;
se restauró el fichero al cerrar. No queda servidor en 3128 (solo
TIME_WAIT residual).

## Ronda única: Quitar en reserva B2b servida

Defecto medido en `desktop-final.png` y `desktop-resultado.json`: tras
confirmar, «Material reservado» pintaba Quitar sobre la reserva servida.

Causa: `reservaGestionadaId` solo sale si `reservas.estado='activa'`. Al
servir, el id sale del set y `reservas-sala.tsx` cae al ramal genérico.

Arreglo:

- `leerReservasSuministro` añade `reservasVinculadas`: todos los
  `reserva_id` de `reserva_suministros` de esa unidad, cualquier estado.
  `reservaGestionadaId` sigue siendo solo la activa (Liberar/Preparar).
- Logística pasa `reservasGestionadas` desde `reservasVinculadas`.
- `reservas-sala.tsx` no cambia: fila en el set y no activa no pinta
  Preparar, Liberar ni Quitar. El botón no se oculta con `disabled`.
- Test nuevo: servida gestionada sin botones; histórica servida no
  gestionada sí pinta Quitar.

SQL ya rechazaba el DELETE (`Reserva gestionada conserva historial`).
La acción `borrarReserva` no mapeaba 23514 y el adaptador de
`FormularioMutacion` lo convertía en 500. Corrección tras revisión:
`mensajeErrorSqlNegocio` + return `{error}` en `borrarReserva` y en
`ejecutarAccionConEstado`. Prueba: `src/lib/control-escritura.test.ts`
(falla si se quita el mapeo de 23514 o su uso en esos dos ficheros).

## Ficheros tocados

Cierre previo:

- `scripts/ejecutar-reserva-kits.mjs` — clasificar `REVISION DISENO L5`.
- `docs/revision/l3b-b2c-carga-entrega.md` — puntero a este cierre
- `output/plan40-b2c-cierre-20260910/**`

Ronda única:

- `src/lib/reservas-suministro-lectura.ts`
- `src/app/salas/[id]/logistica/page.tsx`
- `src/components/almacen/reservas-sala.test.tsx`
- `src/components/almacen/reservas-suministro.test.tsx` (campo nuevo en
  el fixture)
- `scripts/verificar-carga-kits.mts` (delete servida, snapshot
  `reservasVinculadas`, carrera DELETE ubicación durante servir ambos
  órdenes)
- `src/lib/control-escritura.ts`, `src/lib/control-escritura.test.ts`
- `src/app/acciones-almacen.ts` (`borrarReserva` mapea 23514)
- `src/app/acciones-concurrencia.ts`
- `src/components/formulario-mutacion/tipos.ts`
- `docs/revision/l3b-b2c-cierre.md` (este fichero)
- `output/plan40-b2c-cierre-20260910/post-quitar/**` y capturas
  `desktop-final.png` / `movil-*.png` reescritas

No se modificaron `bloqueoComercial`, L3C, L4, `db/**`, `.env` ni
producción. `reservas-sala.tsx` no necesitaba cambio de markup.

## Corrección tras revisión independiente (tope: esta vuelta)

1. Desktop reejecutado con `orquestar.mjs` después de `reservasVinculadas`.
   Base `qa_plan40_ui_9d2416b987ac4cf99ef3a2af78e293ef`, eliminada.
   `botonesMaterial: []`. Foco 390/320 sin Quitar/Liberar. Capturas:
   `output/plan40-b2c-cierre-20260910/desktop-final.png` y
   `output/plan40-b2c-cierre-20260910/post-quitar/`.
2. `borrarReserva` y `ejecutarAccionConEstado` mapean 23514 a `{error}`.
3. Carrera `DELETE FROM ubicaciones` frente a servir, ambos órdenes, RC.
   Recuento del runner: 32/32.

## Qué sigue abierto

- Dictamen independiente de B2c (esta era la única corrección ordinaria).
- L3C y el resto de L3B / plan40.
- Compra nueva y flujo genérico de kit siguen bloqueados, a propósito.
- Ubicaciones reservables/cuarentena siguen siendo L3E.
- `npm test` completo no forma parte de esta evidencia.

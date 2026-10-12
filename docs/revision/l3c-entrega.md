# Entrega L3C: cables suministrados

Estado: **entregado para revisión independiente, no aprobado**. No hay
autoaprobación de L3C, L3 ni plan40. Sin Git, push, merge ni producción.

Contrato: `docs/revision/l3c-contrato.md`.

## Resultado

Cada latiguillo físico vive en `sala_cables_suministrados` con snapshot
congelado. Cada tirada tiene `estado_suministro` (`incluido` ⇔ FK al
latiguillo; `adicional`/`por_determinar` sin FK). La compra solo suma
adicionales. Incluido nulo o más corto que recorrido+holguras+margen no
acredita alcance y no se convierte en línea de compra. Dos Table Microphone
Pro son dos compras y dos cables unidos no intercambiables. HDMI/Ethernet del
Room Kit EQ no se presuponen. La copia con cables físicos o `incluido` se
rechaza (remap = L3D).

## Comandos y evidencia

Host QA: `127.0.0.1:5433`, pathname `/qa_cables_<32 hex>`. El runner crea y
elimina la base. No se usó `av_design`, Neon ni Render. Logs:
`output/plan40-l3c-20260910/`.

| Gate | Resultado | Notas |
|---|---|---|
| `node scripts/ejecutar-cables-suministrados.mjs` | exit 0, **8/8** | Upgrade poblado + repetición + seed; QA eliminada |
| `--sin-unido-extremo` | exit 1, **1 AssertionError** | `Missing expected rejection` al asignar unido sin el extremo fijo |
| `--sin-incluido-fk` | exit 1, **1 AssertionError** | `Missing expected rejection (es23514)` al marcar `incluido` sin fila |
| `--sin-unicidad` | exit 1, **2 AssertionError** | doble asignación aceptada; concurrencia `2 !== 1` |
| `--sin-tipo-libre` | exit 1, **1 AssertionError** | `Missing expected rejection (es23514)` libre con propietario |
| `npx tsc --noEmit` | exit 0 | Radio y árbol |
| eslint de ficheros tocados | exit 0 | |
| unit tests del radio (87) | 87/87 | suministros, cálculo, tabla, revisión, paquete, CSV, bloques, composiciones |

Causales: AssertionError real al retirar la guarda en copia aislada, no timeout.

Dominio medido en SQL:

- Kit EQ: 0 filas de cable, pendiente de `cableado`, compra del kit 1.
- Dos micros: compras 2, unidos 2 × 11 m; mutar el hecho L1 a 5 m no cambia el snapshot.
- Tirada manual 20 m + 11 m suministrados: aviso de insuficiente, `material` 0.
- Unido sin extremo, libre con dueño, `incluido` sin FK, dos conexiones al mismo latiguillo: 23514/23505.
- Retirar asignación: UNIQUE libre, fila física intacta, tirada `por_determinar`.
- Copia con unidos: rechazo L3D; origen sin cables copiable; plantilla no admite `incluido`.
- Kit anidado sigue prohibido; `retirado_del_diseno` y borrar pieza de kit siguen rechazados.

## Delta respecto B2c cerrado

B2c no se reescribe. L3C añade el bloque `CABLES SUMINISTRADOS L3C` al final de
`db/schema.sql` y la migración homónima. `proteger_composicion_kit` admite
unidad simple (cuerpo = artículo del kit + latiguillo `rol=cable`) y sigue
prohibiendo kits anidados. `comprobar_suministro_completo` exige el cable
incluido. `proteger_equipo_de_kit` cubre propietario de cable unido.

`faltaParaSala` conserva el lector RR de B2c. No se tocó
`operaciones_carga_kit`, `/carga`, reserva ni recepción.

## Límites (huecos explícitos)

- **Desktop 390/320, foco, overflow y reduced motion:** no ejecutados en esta
  ronda. Evidencia de columnas: test DOM del paquete (`Adicional` visible) y
  `tabla-cables.tsx` (columna Suministro + longitud suministrada). Recarga y
  copia rechazada se midieron en SQL/lectores, no en navegador.
- **`db/seed.sql` no se regeneró.** El upgrade (filas previas a L3C) backfill
  `adicional` heredado. Un `INSERT` posterior al bloque nace
  `por_determinar`. Regenerar seed es `Después` (L3D no abre remap).
- Clasificación de bloques: se actualizó `esquemaAnteriorA` en runners L3A/B2
  y en `bloques-schema.test.mjs` porque un bloque nuevo sin declarar detiene
  esas pruebas. No se cambió el protocolo B2c.

## Ficheros de otro dueño (declarados)

Actualización mínima de mapas `esquemaAnteriorA` / `DECLARACION`:

- `scripts/bloques-schema.test.mjs`
- `scripts/ejecutar-suministros.mjs`
- `scripts/ejecutar-atribuciones.mjs`
- `scripts/ejecutar-recepcion-kits.mjs`
- `scripts/ejecutar-reserva-kits.mjs`

`control-escritura.ts` no se tocó.

## Fuera de alcance (cumplido)

L3D alta UI / remap, L3E, L3F, snapshot L5, PDF L6, asistente L4, retirada
poscompra, Git, `.env`, Neon, Render, `db:reset`, `package.json`,
`estado-plan40.md`. QA propias borradas al terminar cada runner.

L3C no habilita retirada poscompra. Gate L3 del plan 40 exige L3D–L3F: este
corte no lo declara.

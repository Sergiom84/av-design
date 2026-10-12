# L2B · Entrega de continuación

08/09/2026. Ejecutor `01a080e4-d9a1-7500-ae26-d93eccbd139d`.
Revisor confirmado por presentación: `01a080e5-20d4-7191-b610-82ac1a263b11`.
**Solicita dictamen de L2B; no constituye aprobación ni cierre del plan.**

## Contrato y estado base

Mandan plan40, `l2b-contrato-integracion.md`, `l2b-tiradas-documentales.md`
y las precisiones de `traspaso-ejecucion-plan40.md`. L0/L1/L2A aprobados;
L3 tiene diseño aprobado, implementación pendiente. Check-in = prueba técnica
final; check-out = entrega y aceptación.

El anterior confirmó cierre de sus tres agentes y pruebas antes de escribir.
451/451 archivos coinciden con el manifiesto de traspaso. Rama
`codex/diagrama-salas`, HEAD `f38baa805a1868b7cad55bb97064386e9b5f8555`.
Se preservó el árbol material, incluidos archivos sin seguimiento; ningún
checkout, reset, stash, commit, push, merge o despliegue.

Base adicional, diffs separados e inventario:
`output/plan40-continuacion-20260908-01a080e4/` (en adelante **E/**).
`E/manifiesto-base.json`, `E/preservado/`, `E/estado.txt`, `E/trabajo.diff`,
`E/staged.diff`, `E/sin-seguimiento.txt`.
Entrega material: `E/artefacto/`, `E/manifiesto-entrega.json` y
`E/cambios-desde-traspaso.json`. El manifiesto, no HEAD, identifica el artefacto.
Las copias locales de configuración son privadas y no se publican.

## Archivos de esta continuación

- `scripts/verificar-fichas-tecnicas.mjs`: incluye dependencia documental en
  sombra y aplica migración documental al histórico antes del seed completo.
- `scripts/verificar-seed-puertos.mjs`: misma dependencia; prepara el cable
  histórico antes de migrar L2B y aplica después el seed íntegro. No crea legacy
  nuevo bajo esquema actual ni rebaja guardas.
- `scripts/verificar-tiradas-documentales.mjs`: plantilla inexistente y rechazo
  de nombre duplicado; doble resolución concurrente con lock observado; seed
  tras borrar resolución conserva pendiente y no crea cable.
- `src/components/sala/convertir-asignacion-toma.tsx` y su test: permite
  seleccionar explícitamente un cable equivalente ya ocupado, conserva sus
  campos exactos y bloquea otra alta tras ACK. No ofrece cables de otra sala,
  equipo o roseta. Contenedor relativo evita desbordamiento del texto accesible.
- `scripts/verificar-conversion-toma.mjs`: base y mutantes en copias propias,
  salida UUID reusable, junction retirado en finally, timeout no acredita fallo.
- Este informe y actualización del índice de estado.

No se modificaron SQL de aplicación, migraciones, CSV ni fórmulas en esta
continuación. Las migraciones L2B ya implementadas forman parte del artefacto
completo y de las comprobaciones ejecutadas, no se excluyen de la revisión.

## Criterios y evidencia ejecutada

Todos los comandos desde la raíz, 08/09/2026. Logs nuevos; los anteriores no
se sobrescriben. Un exit1 causal es esperado y se distingue de un gate fallido.

| Comando | Observado | Log en E/ |
|---|---|---|
| `npm.cmd test` | 751/751, cero omitidos, exit0 | `generales-final.log` |
| `npm.cmd run build` | exit0 tras corrección visual | `build-final.log` |
| `npx.cmd tsc --noEmit --incremental false` | exit0 | `tipos-final.log` |
| `npx.cmd eslint src scripts` | exit0 | `lint-final.log` |
| `node scripts/ejecutar-servidor-rosetas.mjs` | 14/14, exit0 | `servidor-base.log` |
| mismo, `--sin-manual-formulario` | 1 fallo de aserción, exit1 | `servidor-causal-manual.log` |
| mismo, `--sin-catalogo-formulario` | 1 fallo de aserción, exit1 | `servidor-causal-catalogo.log` |
| `node scripts/ejecutar-compras-integrales.mjs` | 20/20, exit0 | `compras-base.log` |
| `node scripts/verificar-fichas-tecnicas.mjs` | 12/12, exit0 | `fichas-base-r2.log` |
| `node scripts/verificar-seed-puertos.mjs` | 14/14, exit0 | `puertos-base.log` |
| `node scripts/verificar-rosetas-conexiones.mjs` | 14/14, exit0 | `rosetas-base.log` |
| `node scripts/verificar-tiradas-documentales.mjs` | 8/8, exit0 | `documentales-final.log` |
| `node scripts/verificar-etiquetas-cable.mjs` | 11/11, exit0 | `etiquetas-base.log` |
| `node scripts/verificar-base-plan40.mjs` | siete verificadores exit0 | `regresion-bd.log` |
| `node scripts/generar-seed.mjs` | SHA256 idéntico antes/después | `seed-reproducible.log` |
| `node scripts/verificar-conversion-toma.mjs` | base5/5; sinACK2 fallos; sinEnlace1 | `ui-causal-director.log` |

Crudos de los siete verificadores:
`output/qa_plan40_base_8311960655fd465badcad9688a9c8f5b/`.
Causal UI reproducida por director:
`output/qa_conversion_toma_c5a5ff0d-307f-4829-908b-58c541ac3e72/`.
SinACK termina en 3307ms y sinEnlace en 3831ms; sin timeout ni cancelados.
Las causales SQL/dominio anteriores permanecen donde indica el traspaso;
no se presentan como reejecutadas en esta continuación.

Las cuatro tiradas CSV siguen siendo documentación pendiente. Notas como
«RJ45 de 10m» no acreditan longitud manual; CAJA no acredita roseta. No se
deducen bocas ni se aplican plantillas pendientes. Correspondencia histórica
explícita, UUID conservado y ausencia de copia parcial se ejercitan en los
verificadores de servidor/rosetas/documentales.

## Navegador y persistencia

Playwright CLI, usuario sintético `qa.proyectista`, base propia
`qa_plan40_ui_0848b8dc1a68472c9520c123d7fa3dca`, servidor loopback3128.
Se prepararon dos salas y cables sintéticos por SQL para probar específicamente
el enlace; **no acredita altas por UI ni L7**. Preparación y comprobación exactas:
`E/preparar-ui.mjs`, `E/ui-fixture.json`.

1. Login real, escritorio1280×900, Equipamiento. Abrir conversión y pulsar
   «Enlazar conexión existente». Aparece conexión registrada, persiste al
   recargar; Cableado muestra RED-1000. `ui-escritorio.log`,
   `ui-escritorio-antes.png`, `ui-escritorio-cable.png`.
2. Segunda sala, 390 y320, reduced motion. Desplazamiento dentro de tabla,
   botón enfocado mediante teclado, outline visible, Enter confirma y recarga
   conserva vínculo. `ui-movil-r4.log`, `ui-390-foco.png`, `ui-320-foco.png`.
3. Consulta SQL independiente: un cable por sala; UUID/brida/todos sus campos
   conservados, manual7.25 y ambas asignaciones enlazadas.
   `ui-persistencia-r2.log`. Tras recarga móvil, scrollWidth305/clientWidth305
   para viewport320: `ui-medidas-final.log`. Capturas examinadas.

Fallos intermedios conservados: fichas11/12 por migración documental ausente
(`fichas-base.log`); primer ensayo móvil tuvo panel cerrado y timeout; otro
comparó erróneamente viewport con ancho útil sin scrollbar. El fallo real
320 produjo scrollWidth376 (`ui-movil-r3.log`); después de contener el elemento
absoluto accesible, el mismo ensayo pasó (`ui-movil-r4.log`). Comprobación SQL
inicial comparaba Date con string JSON; se normaliza serialización conservando
todos los campos, no se elimina la comparación (`ui-persistencia.log`).

## Aislamiento, reversión y revisión

BD siempre UUID propias en127.0.0.1:5433, en serie. Wrappers imprimen creación
y eliminación. QA navegador cerrada y base eliminada; navegador propio cerrado.
El wrapper se inició sin stdin interactivo: se terminó su hijo Next identificado
51212/48424 y su finally eliminó la base. Servidor habitual3100 preservado.
Configuración generada por Next se comparó con copias previas y restauró
solamente tsconfig/next-env propios del ensayo. No se tocaron las tres bases
protegidas enumeradas en el traspaso. `E/recursos-final.json` documenta el cierre.

Reversión local: comparar archivos concretos contra E/preservado y el manifiesto
base; retirar únicamente cambios de esta continuación. No restaurar HEAD ni
el árbol completo, no limpiar output. No hay cambios que revertir en producción.

Rondas: L0/L1/L2A conservaron aprobaciones anteriores; Plano/documentales/UI
tienen revisiones parciales previas identificadas en el traspaso. Esta entrega
no reinicia su contador. Causal UI pendiente se completa aquí. La reproducción
del director no es dictamen independiente. Máximo dos rondas del contrato;
excepciones acotadas de integridad/migración deben identificarse expresamente.

Solicitado: dictamen global de implementación L2B sobre contrato, artefacto y
evidencia. No aprobación de L3 ni publicación. L3–L8 continúan pendientes.

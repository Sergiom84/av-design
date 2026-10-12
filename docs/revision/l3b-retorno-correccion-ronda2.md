# L3B B1 · Corrección P2, ronda 2

08/09/2026. Contrato B1 sin ampliación; corrige exclusivamente el P2 del
dictamen `output/revisor-plan40-01a080e5/l3b-persistencia/dictamen.md`.
Base revisada: manifiesto480, CAMBIOS REQUERIDOS. Nueva entrega y delta:
`output/plan40-l3b-retorno-ronda2-20260908/manifiesto-entrega.json` y `delta.json`.
Pendiente de dictamen; no se reinicia el contador de rondas ni se avanza B2.

## Resultado y artefacto

Una devolución canónica de dos unidades puede atribuir una a A y otra a B,
cada una contra su salida original. La salida pertenece a la pareja
movimiento/suministro; el tipo sigue siendo propiedad del movimiento canónico.

- `src/lib/cobertura-suministros.ts`: conserva tipo global y salida por
  atribución. Mantiene duplicados, salida del mismo suministro y cota de retornos.
- `src/lib/cobertura-suministros.test.ts`: devolución conjunta, orden inverso,
  duplicado, retorno cruzado y tipo contradictorio entre atribuciones.
- `scripts/verificar-atribuciones.mts`: atribución conjunta mediante API real,
  saldo SQL confirmado, lector0/0 y conservación íntegra de canónicos.

No se modifican SQL, migración, registros canónicos, API, lector transaccional,
guardas L3A, interfaz ni flujo operativo. No se divide el movimiento histórico.

## Evidencia ejecutada

E = `output/plan40-l3b-retorno-ronda2-20260908/`.

1. Reproductor original del revisor, sin editar, ejecutado antes del arreglo:
   exit1 por la aserción del lector; SQL confirmado0/0. `reproductor-antes.log`.
2. El mismo reproductor después: exit0, SQL y lector0/0, canónicos idénticos.
   `reproductor-despues.log`.
3. `node --import tsx --test src/lib/cobertura-suministros.test.ts`:17/17,
   `focal.log`; `node scripts/ejecutar-atribuciones.mjs`:24/24, `sql.log`.
4. `node output/plan40-l3b-retorno-ronda2-20260908/causal.mjs`: copia aislada
   con módulo anterior exacto (`cobertura-antes.ts`), pruebas nuevas intactas.
   Pura16/17 y SQL23/24: **un fallo medido en cada suite**, cero timeout,
   omitidos/cancelados/TODO. `causal.log`. Copia y base propias eliminadas.
5. `npm.cmd test`:772/772, `generales.log`. `npm.cmd run build`,
   `npm.cmd run typecheck`, `npx.cmd eslint src scripts`:exit0,
   `build.log`, `tipos.log`, `lint.log`.

Las regresiones adicionales de B1 mantienen la procedencia y límites de su
primera entrega; no se presentan como nuevas ejecuciones de esta corrección.
No hay UI nueva ni se acredita el recorrido operativo de B2.

## Traspaso y límites

Solo bases UUID locales desechables del reproductor y runner, cerradas en
finally. No se tocó base compartida, producción ni archivos del revisor.
No hay agentes o pruebas del ejecutor en marcha al entregar ni escrituras
concurrentes durante la revisión. Sin commit/push/merge/despliegue.

Reversión técnica local de la corrección: cotejar delta contra manifiesto480;
el módulo previo exacto se conserva en E para reproducción causal, no para
restaurar el árbol. Reintroducirlo reproduce el defecto y no es un gate válido.
Las bases QA se eliminan exclusivamente por su UUID propio.

Se solicita dictamen de ronda2 al revisor `01a080e5-20d4-7191-b610-82ac1a263b11`.
B1 no se autoaprueba; B2, L3B global y plan40 siguen pendientes.

# L3B · Entrega del subcorte puro de cobertura

08/09/2026. Pendiente de dictamen independiente.

## Lote y contrato

`l3b-proyeccion-contrato.md`, subordinado a `l3-contrato-ejecucion.md` y la
precisión final de `l3-diseno-previo.md`. Este artefacto no completa B1 ni L3B.

Base: L3A aprobado por `01a080e5-20d4-7191-b610-82ac1a263b11`, manifiesto470
en `output/plan40-l3a-correccion-lectura-20260908/manifiesto-entrega.json`.
Entrega: `output/plan40-l3b-proyeccion-20260908/manifiesto-entrega.json` y
`delta.json`; hashes del contenido local, sin commit.

## Artefacto

- `src/lib/cobertura-suministros.ts`: proyección pura y tipos de entrada/salida.
- `src/lib/cobertura-suministros.test.ts`: matriz de balances y rechazos.
- Contrato y esta entrega; notas de estado con aprobación anterior y unidad
  presente. No hay migraciones ni modificaciones de código anterior.

`proyectarCoberturaSuministros` devuelve un mapa por suministro y avisos de
movimientos sin atribuir. No consulta stock ni conecta consumidores operativos.
El padre canónico y su capacidad no están en esta entrada; su integridad
persistida sigue pendiente. Un reparto A/B de movimiento común presupone que
la futura capa de persistencia ha comprobado cantidad total suficiente.

## Aceptación y evidencia

Directorio E: `output/plan40-l3b-proyeccion-20260908/`.

| Esperado | Observado | Evidencia |
|---|---|---|
| Recibir A no sirve A ni B | Recibido separado de cobertura física | `director-focal-final.log` |
| Reserva activa A cubre solo A; servida deja de reservar | Balances unitarios separados | `director-focal-final.log` |
| Salida A, devolución A y baja conservan A0/B0 | Baja no descuenta dos veces | `director-focal-final.log` |
| Devolución exige su salida y no puede excederla | Cruce y exceso rechazados | `director-focal-final.log` |
| Histórico sin atribuir no cubre por parecido | Aviso cuantitativo separado | `director-focal-final.log` |
| Orden de entradas no decide el saldo | Retorno y segunda salida funcionan en orden inverso | `director-focal-final.log` |
| Entrada inconsistente no se trunca silenciosamente | Rechazos explícitos | `director-focal-final.log` |

Comandos del director ejecutados el 08/09/2026:

- `node --import tsx --test src/lib/cobertura-suministros.test.ts`.
- `npm.cmd test`: 770/770, cero omitidos/cancelados/TODO; `generales-final.log`.
- `npm.cmd run build`: exit0; `build.log`.
- `npm.cmd run typecheck`: exit0; `tipos-final.log`.
- `npx.cmd eslint src scripts`: exit0; `lint.log`.

Prueba causal: runner conservado `E/causal.mjs`, reproducido por el director
con `node output/plan40-l3b-proyeccion-20260908/causal.mjs`: base15/15;
mutante por artículo11/15, cuatro fallos de aserción, cero timeout ni
cancelados/omitidos. `director-causal.log`. Copia temporal propia eliminada.
El último cambio fue solo un test de entradas congeladas: se repitieron
focal15/15, generales770/770, tipos y lint focal0 (`lint-final.log`).
Build y lint amplio0 corresponden al mismo módulo y los14 tests previos.

## Límites, reversión y decisión

No hay recorrido UI nuevo: no se ha conectado ni cambiado ninguna pantalla.
Los gates visuales integrados de L3 continúan pendientes. No se ha usado una
base de datos en esta unidad, ni se han modificado existencias o infraestructura.
Las guardas L3A siguen intactas; no hay nueva ruta parcial habilitada.

Reversión eventual: retirar únicamente los dos módulos nuevos de este corte,
tras comprobar manifiesto y dependencias; no restaurar árbol ni HEAD ni borrar
archivos ajenos. Los documentos y evidencias se conservan como procedencia.

Se solicita dictamen sobre este subcorte puro y su contrato, no aprobación de
persistencia, L3B global ni plan40. Ejecutor no se autoaprueba. No hay autorización
de commit, push, merge, despliegue o producción. La siguiente unidad es la
integridad persistida con atribución conservativa, carreras, inversas y rollback;
después se integran operaciones atómicas y lectores.

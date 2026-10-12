# L2B · Fuente heredada de tiradas sin bocas

08/09/2026. Precisión aprobada comunicada por director tras revisión
independiente: conservar las cuatro fuentes CSV como documentales, sin
convertirlas en conexiones físicas, metros ni material. No acreditar una boca
por categoría o señal. Integración de UI, resolución y bloqueo de copias aún
pendiente; esta entrega acredita solamente persistencia y siembra.

## Contrato implementado

`plantilla_tiradas_documentales` conserva ocho campos textuales originales:
tipología, aforo, categorías de ambos extremos, señal, ruta, orden y notas.
No normaliza categorías ni convierte vacíos en NULL. Añade una identidad UUID,
`fuente_clave` estable, FK a plantilla y `conexion_resuelta_id` opcional.

El CSV conserva todas sus celdas originales y añade únicamente `fuente_clave`
con cuatro identificadores explícitos (`tirada-001` a `tirada-004`). No se calcula
la identidad a partir de campos editables. La lectura exige cabecera exacta,
número de celdas exacto, claves válidas únicas y valores estructurales válidos;
un fallo ocurre antes de escribir `db/seed.sql`.

El generador ya no inserta las cuatro filas en `plantilla_conexiones`. Sin
documentación de bocas son fuentes pendientes, no cables. La siembra conserva
UUID y resolución; modificar la fuente de una fila resuelta rechaza la
transacción con su clave y exige revisión explícita. Retirar una clave del CSV
tampoco borra historia: se rechaza y se identifica la clave retirada.

Una resolución es una FK única a una conexión completa de la misma plantilla.
No hay estado booleano tecleable. Las guardas diferidas permiten documentar una
histórica y enlazarla en la misma transacción, pero no confirmar un vínculo
hacia una legacy. Borrar la conexión devuelve la fuente a pendiente mediante
SET NULL. Ninguna migración empareja conexiones históricas por semejanza.

Una actualización documental bloquea su conexión para serializar cambios de
extremos, y las bocas también comprueban las resoluciones al confirmar. Se
mantienen las guardas de pareja y propiedad L2B. Las documentales no aparecen
en los lectores existentes de cable/material porque no pertenecen a esas tablas.

## Artefactos

- `db/migraciones/2026-09-tiradas-documentales.sql` y bloque idéntico en
  `db/schema.sql`, posterior a rosetas y anterior a etiquetas L2A.
- `scripts/sql-tiradas-documentales.mjs`, lectura estricta y SQL de sincronización.
- Integración en `scripts/generar-seed.mjs`; `db/seed.sql` regenerado con ese
  comando, sin edición manual.
- `data/plantillas-tiradas.csv`, columna nueva de identidad explícita.
- `scripts/verificar-tiradas-documentales.mjs`.

## Evidencia ejecutada

Crudos en `output/plan40-20260908-083450/`:

| Comando | Resultado | Crudo |
|---|---|---|
| `node scripts/generar-seed.mjs` | exit 0 | `l2b-documentales-generar.log` |
| `node scripts/verificar-tiradas-documentales.mjs` | 6/6, exit 0 | `l2b-documentales-base.log` |
| `--sin-preservacion` | 1 fallo / 5 pasan, exit 1 esperado | `l2b-documentales-causal-preservacion.log` |
| `--sin-vinculo` | 2 fallos / 4 pasan, exit 1 esperado | `l2b-documentales-causal-vinculo.log` |
| ESLint sobre generador, helper y ambos verificadores L2B | exit 0 | `l2b-documentales-lint.log` |

Los ensayos crean y eliminan solamente bases `qa_documentales_<UUID>` en
`127.0.0.1:5433`. Comprueban la fuente exacta, UUID al repetir, cero cables nuevos,
resolución conservada, rechazo de destino ajeno/legacy, unicidad, desvinculación
al borrar cable, cambio de fuente resuelta con rollback y retirada de clave.
La siembra **completa** actual se aplica dos veces, con cuatro documentales y
cero conexiones físicas generadas. También migran una conexión histórica y
comprueban que no queda enlazada automáticamente. Los mutantes alteran solo SQL
en memoria aplicado a fixtures propias, sin modificar el árbol.

## Integración restante acordada

Las tres copias deben rechazar el lote si hay fuente documental pendiente o
conexiones legacy sin detalle, e identificarlo. `anadirTiradaPlantilla` recibe
`documental_id` opcional y `conexion_existente_id` opcional explícito; nunca elige
una histórica por categoría/señal. Si se selecciona una histórica, la documenta
con dos bocas, mantiene su UUID y enlaza en la misma transacción. Si existe una
histórica potencialmente duplicada y no se ha elegido, exigir selección o
documentación antes de crear otra. Un extremo roseta de plantilla se transmite
como `roseta:<bocaUUID>`; el de equipo conserva `linea:puerto:ordinal`.

No se han ejecutado Git, producción, bases compartidas ni configuración global.

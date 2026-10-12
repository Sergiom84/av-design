# L1 · Contrato de implementación del catálogo

08/09/2026. Preparación mientras se revisa L0; no implementación aprobada.

## Unidad A: sincronización de puertos

Ámbito: bloque de generación de puertos de `scripts/generar-seed.mjs`, pruebas
del generador y verificador Postgres desechable. Regenerar `db/seed.sql` mediante
el generador. Sin renombrar puertos, reasignar ordinales ni modificar producción.

Construir una tabla temporal del CSV dentro de la transacción ya existente del
seed. Resolver artículos por la identidad normalizada actual. Bloquear las filas
de puertos afectadas en orden de UUID. Hacer UPSERT por artículo/nombre, conservando
el UUID existente y respetando `fuente = app`. Actualizar metadatos de filas CSV.

Antes de reducir cantidad o retirar una fila, enumerar referencias afectadas en
conexiones y plantillas, tanto columnas históricas como tablas de bocas. Rechazar
atómicamente con IDs, nombres y ordinales cuando haya uso incompatible. Una fila
retirada del CSV solo se elimina si no tiene ninguna referencia; no se transforma
silenciosamente en otro puerto. Resolver el conflicto requiere corregir el CSV o
editar explícitamente la conexión. El seed no elige una boca sustituta.

Prueba positiva: sembrar, crear conexión física y plantilla, guardar UUID/ordinal/
etiqueta, sembrar de nuevo y comparar. Probar actualización de nota, ampliación de
cantidad y preservación de puerto app. Negativas: reducción de ordinal ocupado,
retirada de puerto físico e histórico; rollback completo. Ejecutar sin el arreglo
en copia aislada para medir fallos. Las etiquetas se estabilizarán en L2; L1 no
acredita que borrar otro cable conserve el correlativo actual.

## Unidad B: procedencia y fichas consultables

Ámbito separado después de A: tabla relacionada con `articulos` para hechos
técnicos documentados, CSV editable por identidad de artículo, generador,
lector y componente de ficha. No segundo catálogo: cada hecho tiene FK al
artículo existente y clave de dato, estado, valor, URL oficial, documento,
apartado/página y fecha de consulta. Unicidad artículo/clave. Fuente csv/app para
preservar mantenimiento desde aplicación cuando se incorpore.

Valores estructurados para microfonía, alimentación/PoE, accesorios y restricciones;
las bocas permanecen en `puertos`, con procedencia por su identidad estable.
`sin_documentar`, `parcial` y `verificado` son estados explícitos. Se valida la
forma de cada hecho y no se interpreta la ausencia como falso o compatible.
Una fuente general de artículo no valida automáticamente cada puerto.

Empezar por los modelos exactos de `l1-investigacion.md`; completar la fuente de
conexión EQ y las variantes antes de declarar un montaje validado. Añadir el
micrófono exacto documentado al CSV de equipos sin inventar uso, precio o stock.
No atribuir el perfil de CS-QUADCAM2+ a QUADCAM ambiguo. La composición del kit
corresponde a L3; la ficha solo documenta sus componentes, sin instanciarlos aquí.

Ficha de artículo: bloque de información técnica reutilizando Tarjeta/Tabla,
fuente enlazada junto al dato, estado visible, datos desconocidos explícitos.
Sin cambios del sistema visual. Navegador escritorio, luego móvil 390/320.

## Aceptación

Cobertura calculada por comando versionado, con denominador explícito; matriz de
referencias y prioridad por uso. Fuentes mantenibles y consultables; cero datos
sensibles técnicos deducidos de nombres ambiguos. Actualización de seed preserva
puertos/cables vivos y falla atómicamente cuando necesita resolución humana.
Cada unidad se entrega con diff/manifiesto, crudos y revisión independiente.

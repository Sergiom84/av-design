# E2 · Fuentes de catálogo y precios revisables

Contrato local 13-10-2026. Base main f38baa8 con E1 íntegra sin commit.
Snapshot previo: output/e2-importacion/base-e1/, manifiesto y diff. No Git mutante,
producción, inventario real, nuevos servicios externos ni investigación Xtenav.

## Destinos y revisión

AVX-14 primero: CSV UTF-8 y XLSX (ExcelJS existente), un formato documentado por
destino, máximo 500 filas y 5 MiB. Identificación literal por referencia o
marca/modelo; categoría desambigua. Se recortan espacios y se compara sin
mayúsculas, nunca por similitud. La revisión muestra unidad, cantidad,
duplicados, candidatos, altas y rechazos. Una ambigüedad exige elegir un ID.
Confirmar revalida todo en servidor y solo aplica la selección explícita.
No ejecuta fórmulas; rechaza celdas de fórmula/enlaces activos/formatos no admitidos.

Catálogo crea o actualiza campos descriptivos de referencias elegidas y marca
fuente app: la siembra CSV no pisa esos datos. BOM de sala añade líneas en
sala_material_bom, acumuladas por necesidadDeSala con equipos y cable existentes.
No añade sala_equipos, posiciones ni conexiones. No puede escribir en obra cerrada.
Una importación BOM no inventa cálculos de cable.

## Ofertas y lotes

AVX-15 añade ofertas fuente app sin upsert de anteriores. Presupuesto, proveedor,
fecha ISO, EUR/USD, unidad de catálogo/compra, unidades por paquete, importe de
compra y final/orientativo son explícitos. Ausente no es cero. Cero de kit y
oferta no vinculante sin clasificación se rechazan con decisión pendiente.
Se conserva selección vigente final antes que orientativa, conversión USD y
vigencia parametrizadas. Nunca cambia pedidos_lineas.

Preview no escribe BD. Confirmación guarda archivo original y SHA-256,
usuario, destino, origen y reporte por fila en lote durable en Postgres.
Todo en una transacción: cualquier fallo lanza y revierte el lote.
Reversión también transaccional, verifica versiones/contenido y dependencias;
restaura únicamente cambios atribuibles que no tengan modificación posterior.
Conflictos se conservan y se explican; nunca borra trabajo ajeno por cascada.
Todas las entradas, consulta de lote y archivos exigen sesión actual, contraseña
cambiada y permisos del destino. APIs mutantes comprueban origen del request.

## Datos técnicos y favoritos

AVX-16 guarda dimensiones parciales con unidad mm/cm/m y RU opcional, origen,
URL HTTPS y fecha verificadas por persona para un modelo exacto. Desconocido queda
null. Imagen PNG/JPEG/WebP o ficha PDF con firma/formato y tamaño comprobados;
bytes y hash en Postgres (máximo 5 MiB por archivo), sin disco temporal durable
ni recursos de producción. Acceso protegido; no fetch de URL remota.
Dimensiones se congelan al crear instancias de equipo/plantilla: la modificación
de catálogo no modifica snapshots anteriores. Se conserva simbología y geometría
actuales; esos snapshots preparan uso futuro, no introducen ingeniería E5.
Búsqueda por atributos verificados, resultado con modelo y procedencia exactos.

AVX-18 se incorpora al final como favoritos personales reversibles si el núcleo
está cerrado; en otro caso se declara aplazado y no bloquea E2.

## Pruebas y entrega

Base nueva aislada av_design_e2_prueba en loopback:5545, usuario av_design_e2;
verificar URL y current_database/current_user antes de escribir. Fixture sintética
PRUEBA-IMPORT-01; nunca reset de BD habitual. Guardar estados y resultados crudos.
CSV/XLSX: duplicados, ambigüedad, variantes, acentos, no encontrados, cantidades,
unidades, fórmulas, cero kit, nulos, origen, monedas/fechas y límites. Preview
inmutable, selección, permisos, rollback por fallo, reversión con cambios
posteriores, seed protegido y pedidos/stock/diseño intactos. Dimensiones congeladas.
Escritorio completo antes de móvil; capturas, informes y fuentes sintéticas.
Reusar gates E1, npm test/build Webpack sin BD/types/lint. Revisor independiente
recibe artefacto, contrato y salida cruda; una revisión/corrección/gate.

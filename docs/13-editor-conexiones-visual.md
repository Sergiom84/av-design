# Diagrama visual · 7 de septiembre de 2026

## Uso

1. Abrir Diagrama en una sala vacía o creada desde plantilla.
2. Buscar un equipo: se añade una unidad al borrador con sus puertos de catálogo.
3. Pulsar una boca y luego la del otro equipo, o arrastrar entre ellas.
4. Arrastrar la cabecera para ordenar los bloques. Con foco en ella, usar las
   flechas; Mayús aumenta el paso. El inspector permite ajustar cable y ruta.
5. Guardar borrador. Recargar conserva equipos, bocas concretas y posiciones.

Una referencia sin puertos aparece como bloque y requiere completar el catálogo.
Las líneas de equipamiento con varias unidades deben desglosarse antes de
conectarlas. Los avisos de compatibilidad no bloquean; la ocupación física sí.
La longitud procede del cálculo existente y de las posiciones físicas de Plano.

## Persistencia y límites

- Altas de equipo, cables y posiciones visuales comparten la transacción y versión.
- El servidor resuelve identificadores temporales y relee el artículo activo.
- `esquema_x/y` son píxeles del esquema; nunca actualizan `x_m/y_m/z_m`.
- Descartar devuelve todo el borrador al último estado guardado. Quitar un equipo
  nuevo del borrador quita sus conexiones nuevas; no borra equipamiento existente.
- Conflicto o respuesta de red incierta exige recargar antes de repetir el guardado.
- Las plantillas conservan el montaje y las bocas con el flujo existente; el orden
  visual de bloques es propio de cada sala. Exportación queda para Después.
- La migración aditiva e idempotente es `db/migraciones/2026-09-posiciones-esquema.sql`.
  Ya está incluida en schema. Aplicada en Docker local, no en producción.

## Evidencia local

Pruebas de componentes y lógica: `npm test` 656/656; build y tipos.
`test:editor-conexiones` 24/24 verifica contra Postgres real el lote, ordinales,
pertenencia, catálogo, conflicto, obra cerrada y rollback posterior a escrituras.
`test:plantillas`: 39/39 sobre una base de prueba sembrada.

Recorrido Chromium con datos sintéticos en una base aislada: añadir cámara,
videoconferencia y pantalla desde catálogo; conectar por clic a HDMI IN 2 y por
arrastre a HDMI 1; mover con ratón y flechas; guardar y recargar; cotejar bocas
en SQL, Cableado y Equipamiento. Conflicto entre dos pestañas y respuesta abortada
sin commit, seguidos de recarga. Móvil 320/390 sin overflow de documento, teclado,
reduced motion y selección táctil con cancelación.

Capturas, scripts y evidencia de la sesión en `output/playwright/` (artefactos
locales, no incluidos en Git). Mutaciones focales: colapsar ordinal geométrico,
guardar posición como cero y retirar la guarda de catálogo actualizado hacen
fallar una comprobación cada una; restauraciones verificadas.

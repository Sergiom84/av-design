# L5 · Inventario previo, sin implementación

Inspección local del 08/09/2026 mientras se integra L1. No constituye gate ni
reproducción funcional. L0 acreditó las guardas existentes, no los requisitos
nuevos de revisión de diseño de L5.

## Reutilizar

- `ciclo-vida-seguimiento-db.ts:escribirSeguimiento` ya bloquea sala antes de
  escribir, comprueba obra cerrada y usuario activo, separa técnico del autor,
  valida fechas y exige persona aceptante. La auditoría guarda estado anterior.
- La prueba final admite borrador con observaciones y versión optimista;
  finalizar exige puntos conformes/no aplicables justificados y al menos uno
  conforme. La reapertura devuelve los puntos a pendiente conservando notas.
- Una entrega vigente impide reabrir prueba directamente: exige anular primero
  entrega con motivo. Anular instalación exige prueba reabierta; conserva en
  auditoría el checklist anterior que elimina de la tabla activa.
- `comprasDeSala` y `resumirComprasCiclo` ya diferencian compra y recepción
  trazada. No sustituirlos por otro módulo de seguimiento.

## Límites observados en código

- `PruebaFinal` y `prueba_final_sala` solo tienen versión del checklist: no
  revisión del diseño, huella ni snapshot. El lector `seguimientoDeSala` tampoco
  compara evidencia con medidas/equipos/conexiones actuales. Se necesita una
  prueba funcional de edición posterior que acredite el antes/después.
- `comprasDeSala` filtra `pedidos.sala_id`; los pedidos de proyecto sin esa
  asociación no aparecen aquí. El reparto real debe distinguirse del pedido
  común: incluir todas sus unidades en cada sala sería otro error.
- `diagrama_version` controla conflictos de guardado. No es por sí solo una
  copia histórica de equipos, bocas, cables o suministros retirados.

## Dependencia con L3 ya identificada en su diseño

Antes de permitir quitar del diseño componentes comprados se exige snapshot
inmutable completo, según la precisión final de `l3-diseno-previo.md`. Debe
conservar nombres/modelos, componentes de suministro, posiciones, puertos y
ordinales, etiquetas y recorridos de conexiones y fuentes técnicas pertinentes.
Guardar solo los UUID de filas que pueden desaparecer no preserva el montaje.
Este requisito se implementará como prerrequisito acotado, no se dará por cubierto
por la composición versionada del kit ni por el contador optimista del plano.

La estrategia de revisión debe resolver expresamente un cambio seguido de
deshacerlo: no acreditar de forma accidental el diseño nuevo por coincidencia
de una huella antigua. Probar también modificación por rutas de escritura
alternativas, no únicamente el botón Guardar del diagrama.

## Comprobaciones pendientes de ejecución en L5

1. Pedido común de dos salas, sin reparto y después con reparto parcial:
   ninguna sala acredita unidades ajenas.
2. Prueba/entrega, edición de diseño, recarga en segunda sesión: aceptación
   original conservada y nueva revisión sin acreditar.
3. Anulación de entrega y reapertura de prueba, con motivo y autor distintos:
   historial íntegro, estado actual coherente, notas conservadas.
4. Snapshot anterior a compra, cambio/eliminación posterior de componente:
   necesidades actuales distintas sin reescribir pedido ni perder el montaje
   comprado. Retirada de un componente físico no implica devolución completa.
5. Concurrencia contra entrega/compra/edición, obra cerrada, permisos técnicos,
   reintento de recepción y devolución parcial; validar cantidades y autores.

No se ejecutó BD ni se modificó código de L5 para preparar este inventario.

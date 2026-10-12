# L3B · B1 persistencia de atribuciones

08/09/2026. Continúa desde proyección pura aprobada, manifiesto474.

Resultado exacto: atribuir explícitamente cantidades comerciales existentes a
suministros concretos, conservar registros originales y leer sus balances en
una instantánea coherente. Destinatario: futura operativa de compra y almacén.
Éxito: padre no sobreasignado, demanda1 respetada, retorno enlazado a su salida,
repetición/rollback/carreras verificadas contra Postgres QA local UUID.
Alcance: tres tablas normalizadas, migración/schema equivalentes, operaciones
internas y lector, pruebas. Se mantiene el bloqueo operativo L3A.
Fuera de alcance: recepción/carga UI, retirada, cuarentena y producción.
Protegidos: árbol anterior completo, datos originales y base compartida.
Comprobaciones: instalación limpia, upgrade poblado, repetición, SQL directo,
inversas, concurrencia ambos órdenes, causal, regresión, build/tipos/lint.
Sin autorización de Git ni publicación. No acredita B2 ni L3B global.

## Invariantes

`suministro_pedido_asignaciones`, `reserva_suministros`,
`movimiento_suministros`: FK RESTRICT, UNIQUE padre/suministro, cantidad entera
positiva (demanda unitaria). Pedido conserva recibido atribuido entre0 y cantidad.
No se deduce destino ni procedencia por artículo. Legacy sin enlace sigue igual.

Artículo y sala coinciden con el suministro. Pedido de obra puede abastecer
salas de esa obra; pedido de sala exige esa sala. Sumas atribuidas/recibidas no
superan cantidades canónicas. Pedido atribuido por suministro no supera1.
Reserva activa más salidas menos devoluciones no supera demanda activa.
Devolución exige salida original atribuida al mismo suministro; retornos
acumulados limitados por esa salida. Baja no vuelve a descontar servido.
Cambios inversos se revalidan; no se borran vínculos para ocultar historia.

Las validaciones finales son diferidas. Un cerrojo transaccional de atribuciones
con revisión escrita serializa su validación incluso en REPEATABLE READ (que
debe recibir error de serialización antes que confirmar una instantánea obsoleta).
Se acepta serializar escrituras de atribuciones de kits en esta aplicación
interna; las lecturas siguen concurrentes. No es un bloqueo de todas las consultas.
La operación interna conserva orden salas/proyecto, padre, suministro.

En este corte se atribuyen registros canónicos creados antes del suministro:
no se abre una puerta para crear movimientos nuevos sin la integración B2.
Las guardas inversas se prueban con operaciones permitidas y rechazos reales;
no se desactivan los triggers L3A para simular cobertura B2 no implementada.
Los límites de stock disponible, custodia y reintento de recepción pertenecen
a las siguientes unidades. Máximo dos rondas de revisión del artefacto.

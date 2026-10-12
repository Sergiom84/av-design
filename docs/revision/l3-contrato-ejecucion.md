# L3 · Contrato de ejecución por unidades

Preparación de solo lectura, 08/09/2026. No acredita implementación ni gate.
Fuentes de contrato: plan 40, `l3-diseno-previo.md` completo (la precisión final
de ronda 3 prevalece) y `l5-inventario-previo.md`. Empezar implementación solo
después del gate L2B; esta preparación no ocupa BD ni generador.

## Resultado e invariantes ya decididos

Una referencia comercial de kit genera una necesidad de compra y tiene piezas
físicas independientes, cada una con artículo/puertos correctos y cantidad uno.
Dos kits son dos suministros; cámara/codec/control incluidos no generan otras
tres compras. Opcionales seleccionados por separado sí generan necesidad.

- Catálogo único, composiciones publicadas versionadas e inmutables y snapshot
  por instancia. Ninguna actualización CSV transforma un montaje anterior.
- Identidad desconocida conserva línea documental, sin inventar equipo ni boca.
  Incluido exige evidencia; nombre genérico de kit no confirma SKU ni contenido.
- Relaciones físicas normalizadas con FK compuestas y guardas inversas; JSON
  conserva identidad/procedencia congeladas, no reemplaza FK/ocupación.
- Cable incluido, adicional y por determinar son decisiones comerciales
  independientes de sus metros. Desconocido no es longitud cero ni suficiencia.
- Histórico comercial conserva comportamiento mediante backfill explícito
  adicional heredado; nuevo cable empieza por determinar.
- Recibir kit mueve artículo kit; jamás incrementa stock de piezas sueltas.
  Cobertura se atribuye al suministro concreto, no solo al artículo y sala.
- No despiece de stock, conversión por parecido ni edición de producción.
- Borrar una pieza de kit se rechaza con acceso a Gestionar kit. Retirada
  poscompra queda rechazada hasta disponer del snapshot íntegro L5.

## Estado real que condiciona el trabajo

Lectura actual: no aparecen tablas/módulos de composición o suministros ni
`revisiones_diseno_sala` en schema. L1 aporta hechos de suministro documentales;
no equivalen a relaciones comerciales instanciadas. L2B ya añade extremos
normalizados y lectores comunes; su QA/gate está en curso y manda su estado final.

| Consumidor real | Punto de integración |
|---|---|
| `src/lib/compras.ts:necesidadDeSala` | Suma todos los equipos por artículo. Debe recibir proyección comercial y excluir componentes incluidos por vínculo, sin ocultarlos físicamente |
| `src/lib/datos-almacen.ts:faltaParaSala` | Llama a cálculo/agregación y necesidad; sirve a reservas y pedidos. Hoy agrupa servido por artículo+sala y pedidos por `p.sala_id`: insuficiente para dos suministros iguales o pedido compartido |
| `src/lib/datos-almacen.ts:disponibilidadDeArticulos`, `listarAlmacen`, `existenciasPorUbicacion` | Hoy suman existencias sin condición reservable; separar disponibilidad física utilizable de cuarentena visible |
| `src/app/salas/[id]/datos-ficha.ts:fichaDeSala` | Calcula material también fuera de logística. Debe compartir proyección para no discrepar con documento/presupuesto |
| `src/lib/calculo-cable.ts:agruparMaterialCable` | Agregación comercial; filtrar solo adicionales, conservar cálculo y tabla de todos los cables |
| `src/lib/cable-schedule.ts`, `src/components/documentos/paquete-tecnico.tsx` | Mostrar decisión de suministro, longitud disponible y pendientes, conservando etiquetas/puertos de L2 |
| `src/lib/datos.ts`, `datos-plano.ts`, `lectura-extremos.ts`, `extremos-conexion.ts` | Extremos y geometría existentes; añadir contexto de suministro sin otro catálogo ni falsa geometría de caja comercial |
| `src/lib/operaciones-compras.ts:recibirCompra` | Ya tokeniza recepción y confirma movimiento/cantidad juntos. Ampliar aquí reparto recibido atribuido, no en una acción paralela posterior |
| `operaciones-compras.ts:bloquearObraCompra`, `bloquearPedidoCompra` | Orden salas, proyecto, pedido y líneas; conservarlo al añadir locks de suministro/asignación |
| `src/app/acciones-almacen.ts` | Reserva, compra sugerida, carga y cierre deben escribir atribuciones junto con registro canónico |
| `acciones-almacen.ts:confirmarCarga` | Hoy genera salida por artículo y consume reservas por ID; transportar asignación suministro y no perderla al agrupar líneas |
| `src/lib/carga.ts:movimientosDeSalida`, `movimientosDeCierre` | Mantener unidad comercial y retorno ligado a salida; traslados de cuarentena no son servicio a sala |
| `src/app/acciones.ts`, `acciones-diagrama.ts` | Altas, borrado y tres rutas de copia: permisos/cierre/versionado, Gestionar kit, remapeo de equipos/cables incluidos y conversión EQ explícita |
| `src/lib/ciclo-vida-seguimiento-db.ts`, `ciclo-vida-seguimiento.ts` | L5: el checklist actual y auditoría no preservan un diseño íntegro ni vigencia contra cambios posteriores |

La antigua UNIQUE plantilla/categoría aparece en CREATE inicial pero se elimina
en schema (~236). No inventar categorías para componentes ni reportarla como
bloqueo actual; cubrir migración desde esquema anterior en la regresión de copias.

## Primer lote implementable: L3A, núcleo comercial persistido

Radio único serial: modelo de composición/suministro, persistencia, proyección
pura y sus lectores/consumidores de necesidad. No repartir entre dos ejecutores
`compras.ts`, `calculo-cable.ts`, `datos-almacen.ts` y helpers nuevos: comparten
la decisión de contar una unidad. Se puede preparar QA/fuentes en solo lectura.

Contrato del lote: instanciar localmente composición documentada produce
componentes físicos vinculados y una sola necesidad comercial, también al leer
material de ficha y logística. Equipo independiente/histórico mantiene cantidades
anteriores. Composición nueva deja snapshots anteriores idénticos. No presentar
esta unidad como gate L3 de compra/recepción/carga todavía.

Artefactos previstos:

1. Migración y proyección equivalente en schema: `articulo_composiciones`,
   `articulo_composicion_lineas`, `sala_suministros`,
   `sala_componentes_suministro`; claves compuestas del diseño y guardas de
   identidad/cantidad/ordinal/sala/composición. Estado activo/cancelado/retirado
   existe con transición poscompra prohibida hasta L5, no un botón vacío.
2. Fuente CSV de composiciones y validación/generación incremental versionada.
   Publicada no se sobrescribe; referencia desconocida no inventa artículo.
   Nombres de nuevos ficheros son de implementación, no una segunda autoridad.
3. Módulo puro de proyección y operación transaccional de instanciación/lector.
   Equipo vinculado y suministro se confirman juntos; ningún estado confirmado
   con ambos contados. Dos kits crean componentes distintos cantidad uno.
4. Integración en necesidad y lecturas compartidas. Si antes del lote siguiente
   se pueden alcanzar reservas/compras desde UI, impedir operaciones de
   suministro que aún no tengan trazabilidad implementada; no conceder cobertura
   por fallback artículo+sala. Preferible mantener el alta de kit fuera del flujo
   UI hasta integrar L3B, con operación real comprobada en fixture local.
5. Guardas de borrado del componente desde todas las acciones existentes; no
   dejar un padre invisible activo ni permitir borrar vínculo y cobrar la pieza.

Aceptación ejecutable L3A: kit tres piezas→necesidad kit1, dos kits→kit2,
independiente adicional→1 extra; parcial conserva pendientes; instantánea
inmutable frente a versión de catálogo; rechazar FK de otra sala/composición,
artículo distinto, ordinal inválido, cantidad física2 y cambios inversos.
Rechazo de borrado no altera componentes/conexiones/etiquetas. Instalación limpia,
upgrade poblado, repetición y rollback tras insertar cada nivel. Mutante sin
exclusión comercial debe duplicar compra y fallar aserción cuantitativa.

## Secuencia dependiente hasta cerrar L3

| Unidad | Radio y resultado comprobable |
|---|---|
| L3B trazabilidad de compra/almacén | `suministro_pedido_asignaciones` con recibido atribuido; `reserva_suministros`, `movimiento_suministros`, devoluciones ligadas a salida. Integrar recepción/reserva/carga y proyección de faltantes. No inventar vínculos legacy |
| L3C cables suministrados | Tabla física de cable y snapshot; estado de conexión/FK/UNIQUE. Cable unido exige propietario+puerto+ordinal; guardas inversas e identidad exacta. Manual requerido nunca sustituye longitud suministrada |
| L3D copias y alta UI | Equivalentes en plantilla, tres rutas de copia y remapeos; no consultar versión vigente al copiar. Selector muestra kit y piezas; no bocas de caja comercial. Cancelación precompra explícita con conexiones seleccionadas y rollback |
| L3E incidencias y retorno | Custodia de pieza sin movimientos, ubicación reservable, devolución de kit entero ligada a salida, cuarentena y traslado compensado idempotente. Existencias globales conservadas |
| L3F EQ histórico y revisión integrada | Manifiesto por instancia inequívoca, comparación exacta de puertos, conversión sin apagar triggers. QA escritorio/recarga y cierre móvil/print; revisión independiente del conjunto |

Las letras son cortes de implementación, no nuevos requisitos de producto.
No dejar activa una ruta parcial de negocio entre cortes. El cambio de
`conexiones` a estado comercial nuevo exige que tabla, faltantes y paquete
expliquen pendientes en el mismo corte, para no hacer desaparecer material.

## Matriz mínima de L3B–L3F

- Pedido dos kits A/B, recepción1 atribuida A: stock1, A recibido1, B pendiente1,
  cobertura física ambos0. Reservar A→A1/B0; cargar A consume reserva, stock0,
  servidoA1. Recepción restante y B conservan separación; reintento no repite.
- Misma sala/artículo, salida atribuida A→A1/B0; devolución ligada A→A0/B0.
  Salida legacy sin atribución→ambos0 y aviso. Doble atribución excedida rechaza
  por SQL directo/concurrencia, con rollback de registro y enlaces.
- Cable incluido único no suma compra, desconocido/corto no acredita alcance;
  dos micros no intercambian cable unido. Segundo micro compra uno adicional,
  incluye su propio cable de L1; HDMI/Ethernet opcionales no se presuponen.
- Copia ambas direcciones conserva composición congelada y geometría/puertos,
  genera UUID/etiquetas nuevas y remapea cable unido sin pedido/recepción/autoría
  física heredados. Fallo a mitad revierte todo.
- Cancelar precompra libera solo sus reservas/asignaciones no compradas y exige
  seleccionar cables a retirar. Recepción/salida impide cancelación; poscompra
  sin snapshot L5 rechaza y conserva montaje exacto.
- Cámara sola devuelta registra custodia, cero movimientos; kit entero
  incompleto queda en cuarentena no reservable. Kit verificado se traslada con
  dos movimientos compensados, token único y sin cambiar servido ni stock global.
- EQ ambiguo no convierte; mapa exacto conserva equipo UUID, XYZ, esquema,
  conexión UUID/etiqueta/ordinal. Puerto app sin equivalencia bloquea. Fallo tras
  cambio de artículo restaura artículo, bocas y suministro completos.

## Dependencia L5 sin bloquear indebidamente L3

La precisión final aprobada permite cerrar L3 con **rechazo real de retirada
poscompra**. No obliga adelantar todo L5. No introducir snapshot incompleto para
habilitar esa operación: composición versionada y `diagrama_version` no bastan.

Primer corte de L5 antes de habilitar retirada: `revisiones_diseno_sala`
inmutable con sala/revisión/fecha/autor/hash y snapshot autocontenido de medidas,
mobiliario, equipos/composición, nombres/modelos, puertos/bocas, rosetas,
conexiones/rutas/puntos/etiquetas y asignaciones de cable incluido. La lectura
histórica no depende de catálogo o filas activas que puedan desaparecer.

Retirar comprados crea/verifica snapshot dentro de la misma transacción antes
de liberar ocupación y demanda; conserva pedidos/movimientos. Cambiar y deshacer
no reactiva por coincidencia de hash una aceptación anterior. En L5 probar
ediciones por todas las rutas, dos sesiones y lectura de paquete anterior.

## Evidencia y límites

Reusar suites de compras/almacén/carga, verificadores de compras integrales y
seguimiento y regresión L2 de extremos/etiquetas/copias. Los verificadores de
DB nuevos necesitan destino UUID local y limpieza exclusiva; leer --plan antes
de ejecutar, sin DATABASE_URL heredada ni reset compartido. Cada corrección
afirma únicamente fallos medidos al retirar guarda en copia aislada.

Al cerrar cada corte: contrato+artefacto+logs/hashes al revisor; máximo dos
rondas, excepción tercera solo integridad/migración según plan. Build/tipos/lint,
regresión y UI completa de L3 son condiciones de gate, no promesa de esta nota.
Ninguna prueba fue ejecutada para elaborar este contrato; no cambia aprobación
de L2B ni presupone autorización de commit/publicación.

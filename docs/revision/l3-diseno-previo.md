# L3 · Diseño previo de kits y suministro de cables

08/09/2026. Propuesta pendiente de revisión. Solo lectura de código y del informe
`docs/revision/l1-investigacion.md`; no se ha ejecutado código, BD ni migraciones.
Los datos de fabricantes se toman de ese informe, con sus fuentes y limitaciones;
este documento no aporta una nueva verificación documental.

## Contrato y punto de partida

Un kit comercial debe producir una necesidad de compra de kit, con componentes
físicos independientes que se conectan por sus propios puertos. Incluidos no
generan otra compra/reserva; opcionales elegidos sí. Composición congelada por
instancia, cables incluidos trazables y suficiencia calculada sin inventar metros.
Conservar conexiones, geometría, UUID y etiquetas estabilizadas por L2.

Hoy `sala_equipos` contiene artículo y cantidad, y las bocas exigen cantidad uno.
`necesidadDeSala()` (`src/lib/compras.ts`) suma cada equipo por artículo más todo
el cable que devuelve `agruparMaterialCable()`. Añadir codec/cámara/control como
equipos normales duplicaría la compra. `faltaParaSala()` en `datos-almacen.ts`
alimenta reserva automática, pedidos y carga: el filtro tiene que vivir antes de
ese punto, en una proyección compartida, no esconder filas en una pantalla.
`operaciones-compras.ts` registra compra/recepción por línea y movimientos;
`almacen.ts` deriva stock del artículo y `carga.ts` opera sobre esa unidad.
No hay que crear stock de cámara/codec automáticamente al recibir un kit.

## Modelo concreto

Mantener `articulos` como catálogo único: kit y modelos físicos referencian
artículos existentes/documentados. No dar puertos a una caja comercial nueva.
Los puertos de codec, cámara y control pertenecen a sus modelos respectivos.

| Tabla propuesta | Responsabilidad y claves |
|---|---|
| articulo_composiciones | id, articulo_kit_id FK, version, estado documental, fuente; UNIQUE(articulo_kit_id,version). Una versión publicada es inmutable. |
| articulo_composicion_lineas | id, composicion_id FK, articulo_componente_id FK nullable si falta identificar, rol técnico, cantidad positiva entera, suministro incluido/opcional/por_determinar y procedencia. No anidar kits en L3. |
| sala_suministros | id, sala_id FK, articulo_id FK comprable, composicion_id FK opcional, version_snapshot, snapshot JSONB, cantidad=1 para kit, creado_en. Representa una unidad comercial, nunca un bloque con bocas. |
| sala_componentes_suministro | equipo_id PK/FK sala_equipos, suministro_id FK, linea_composicion_id FK nullable, ordinal y snapshot de identidad/procedencia. UNIQUE(suministro_id,linea_composicion_id,ordinal). |
| sala_cables_suministrados | id, suministro_id FK, referencia/fuente congeladas, articulo_cable_id FK nullable, longitud_utilizable_m nullable positiva, conectores y requisitos documentados. Una fila por cable físico. |
| suministro_pedido_asignaciones | suministro_id FK, pedido_linea_id FK, cantidad positiva, UNIQUE del par. Vincula demanda a compras concretas sin deducirlas por parecido de artículo. |

Dos kits son dos suministros con sus componentes de cantidad uno. El agregado de
compra los presenta como dos unidades del mismo artículo. Una pieza incluida
pertenece a un solo suministro; la FK no permite adscribirla a otra sala.
Los snapshot guardan modelo/SKU/composición/procedencia a fecha de instancia;
las relaciones físicas y bocas siguen normalizadas, no dentro del JSON.
Cambiar la composición publicada crea otra versión; modificar instancias previas
requiere una operación explícita versionada y no está implícito en guardar catálogo.
Las nuevas versiones no borran filas de composición que tengan referencias.

Para componentes pendientes de identificar, conservar una línea del snapshot
sin crear equipo conectable ni puertos genéricos. El kit se puede documentar como
parcial, pero no supera la revisión técnica. La condición incluido exige fuente
de composición o contenido de pedido documentado. Un opcional no se instancia
hasta seleccionarlo; cuando se adquiere aparte crea suministro independiente.

`sala_equipos.articulo_id` del componente es su modelo físico. Su pertenencia en
`sala_componentes_suministro` hace que la proyección comercial lo sustituya por
el suministro padre. Equipos históricos sin pertenencia mantienen su necesidad
actual. Un micrófono independiente puede tener suministro propio para trazar su
cable unido, sin imponer esta migración a todo el inventario.

## Proyección de necesidades y precio

Una función pura común entrega tres colecciones: necesidades comprables,
componentes físicos y decisiones pendientes. Fórmula comercial:

`suministros + equipos sin suministro + cables adicionales confirmados`.

Cada suministro se cuenta una vez; componentes y cables incluidos aportan detalle
al montaje, cero unidades de compra adicionales. Los pendientes no se descartan:
aparecen en revisión/documento como necesidades por resolver, sin precio cero ni
cantidad inventada. Añadir suministro para un equipo que ya existe exige vincular
ese equipo en la misma transacción; no mantener ambas fuentes activas.

La proyección alimenta `necesidadDeSala`, `faltaParaSala`, reservas automáticas,
pedidos sugeridos, carga y presupuesto. Mantener cantidades y precios congelados
de pedidos previos; no distribuir el precio del kit entre piezas sin una base
contable. Coste de pieza incluida se muestra “Incluido en [kit]”, no 0 € como
supuesto precio de mercado. El kit conserva la marca final/orientativa existente.

Recepción de dos kits incrementa stock del artículo kit en dos, nunca en seis
componentes. Reserva/salida también usan kit. El checklist físico de caja puede
verificar componentes sin insertar movimientos. Recibir una caja incompleta no
se resuelve acreditando ficticiamente todas sus piezas: registrar incidencia y
mantener revisión pendiente. Despiece de kits para stock por componentes queda
fuera de L3; requiere una operación de transformación de inventario posterior.

Las asignaciones de pedido se validan con locks en orden ya usado por compras:
salas, proyecto, pedido, líneas y suministro. Artículo y destino coinciden;
asignado no supera cantidad de línea ni unidad demandada. Permite pedido de obra
que abastece varias salas sin atribuir la misma unidad de kit dos veces.
Reservas históricas sin enlace siguen siendo válidas por artículo; no inventar
pedido de origen para stock antiguo. Mostrar origen desconocido cuando proceda.

## Cables: tres estados independientes del cálculo físico

Añadir a conexión estado de suministro `incluido | adicional | por_determinar`
y FK nullable a `sala_cables_suministrados`. Incluido exige esa FK, misma sala y
UNIQUE(cable_suministrado_id): un latiguillo no puede satisfacer dos conexiones.
Los otros estados no llevan esa FK. Cables nuevos arrancan por determinar;
históricos mantienen comportamiento comercial anterior mediante backfill
`adicional` marcado como decisión heredada, sin declarar una fuente documental.

El cálculo de metros de instalación sigue ejecutándose para los tres estados.
`agruparMaterialCable` recibe la decisión comercial y agrega solo adicionales;
la tabla técnica conserva todos. Incluido con longitud desconocida permanece
“Longitud suministrada pendiente”; longitud conocida inferior a recorrido más
holguras/margen avisa insuficiencia y nunca acredita que llega. La longitud
manual requerida no sustituye la longitud suministrada comprobada.

Cable propietario/atado conserva conectores, alimentación y restricciones en su
snapshot. No se ofrece un cable genérico de la misma señal como sustitución
automática. Resolver insuficiencia exige artículo/adaptador compatible documentado
o cambiar diseño; seleccionar adicional genera su necesidad explícita. Retirar
la asignación de incluido libera esa unidad, sin borrar el historial comercial.

Según L1, el Table Microphone Pro propuesto trae cable unido de 11 m; ese cable
pertenece al suministro del micrófono, no al kit EQ. Un segundo micrófono añade
una compra de micro y otra unidad de su cable incluido, sin compra doble de RJ45.
HDMI/Ethernet opcionales del kit no se marcan incluidos por defecto. El SKU exacto
y el contenido real del pedido mandan sobre un nombre genérico del inventario.

## Tratamiento explícito del EQ histórico

No ejecutar conversión general por nombre. Preparar manifiesto revisable por
instancia: UUID equipo antiguo, artículo exacto ROOM KIT EQ, evidencia de SKU o
confirmación local, artículo Codec EQ destino, conexiones/puertos/ordinales y
mapa esperado antes/después. WEBEX ROOM EQ QUADCAM, variantes o filas cantidad>1
quedan pendientes de identificación. No añadir cámara/control a históricos con
contenido de caja desconocido; usar composición parcial hasta confirmación.

Para una instancia inequívoca, conservar el UUID del equipo antiguo como codec
físico; crear suministro comercial con el artículo kit y vincular el equipo.
Cambiar su artículo a Codec EQ, conservando nombre referencial, XYZ, giro,
posicion_confirmada y esquema. Conservar UUID/etiqueta de cada cable y ordinal.
Los puertos sí requieren mapa explícito de UUID kit→UUID codec, no reutilizar un
puerto que sigue perteneciendo al artículo kit.

Mapa candidato por los diez grupos observados en CSV, sujeto a igualdad exacta
de nombre, total, señal, sentido y conector antes de aplicar:
HDMI outputs; HDMI inputs; Network (Ethernet PoE); Touch panel;
Network (Ethernet); USB 3.0 type C; USB 3.0 type A;
Maintenance (micro USB); Microphone inputs; Audio line output.
Una discrepancia, puerto app sin equivalencia o ordinal fuera de total bloquea
esa instancia completa. No inferir igualdad por posición en el CSV.

Transacción: bloquear sala/equipo/conexiones/puertos; comprobar manifiesto;
guardar snapshot de cambios; retirar temporalmente parejas de bocas afectadas;
cambiar artículo del equipo; actualizar puertos legacy y reinsertar parejas con
mapa; comprobar mapa UUID→etiqueta/ordinal y confirmar. Nunca desactivar triggers:
los constraints diferidos deben permitir el reemplazo atómico y rechazar estados
finales incompletos. Un fallo restaura también suministro y artículo original.
No mover reservas/pedidos/movimientos previos: ya apuntan al artículo comercial.

## Plantillas y límites de implementación

Crear equivalentes de suministro/componentes/cables en plantilla, con snapshot
propio y FK a `plantilla_articulos`. En ambas direcciones copiar suministro y
snapshot, generar IDs físicos nuevos, remapear bocas y asignación de cable
incluido; no copiar asignaciones a pedidos, recepción ni confirmaciones físicas.
La copia no consulta la composición vigente para “actualizar” silenciosamente.
Si el usuario pide la versión nueva, es otra operación explícita.

Radio de archivos previsto: `tipos.ts`, nuevo módulo puro de composición y su
lector/operaciones, `compras.ts`, `calculo-cable.ts` (agregación comercial, con
regresión de fórmula), `cable-schedule.ts`, `datos.ts`, `datos-plano.ts`,
`datos-almacen.ts`, `acciones.ts`, `acciones-diagrama.ts`, `acciones-almacen.ts`,
`operaciones-compras.ts`, editor/selector de equipos y cables, plantilla y paquete
técnico. CSV de composición con fuente estable y generador; no editar seed a mano.
Revisar constraint vigente de categoría de plantilla antes de insertar varios
componentes de una categoría: no fabricar categorías para sortear unicidad.

Tablas existentes afectadas: conexiones, sala_equipos, plantilla_articulos,
plantilla_conexiones y sus bocas; artículos/puertos solo por fuente documentada.
Pedidos, reservas, movimientos y precios conservan datos/semántica; nuevas FK de
trazabilidad no reconstruyen sus históricos. Ninguna escritura de producción.

Orden secuencial: L0 aprobado → perfiles/IDs L1 estables → extremos y etiquetas
L2 aprobados → migración composiciones/suministros → proyección de necesidades →
cables incluidos → copias → conversión EQ explícita. No paralelizar migraciones,
helpers comerciales ni acciones de copia entre ejecutores.

## Evidencia exigida

Probar kit de tres componentes = una compra/reserva/salida; dos kits = dos;
segundo micrófono = una necesidad adicional; cable incluido no suma compra y no
puede asignarse dos veces. Probar longitud desconocida/corta, cable propietario,
precio orientativo y pendiente comercial visibles. Versión de catálogo nueva no
cambia snapshot comprado ni plantilla previa.

Postgres: instalación limpia/upgrade/repetición, FK ajenas, copia rollback,
ocupación concurrente de cable incluido, doble asignación de línea de pedido,
guards de obra cerrada/permisos, mapa EQ exacto y rechazo de referencia ambigua.
Ensayar fallo posterior al cambio de artículo y comprobar reversión completa.
Comparar necesidades y datos históricos antes/después; guardar UUID/etiquetas y
ordinales en evidencia. Mutaciones eliminando exclusión de incluido y unicidad
de asignación deben hacer fallar pruebas específicas, no la carga del módulo.

Recorrido escritorio y recarga: kit → componentes → conexiones → material →
reserva/compra sintéticas → guía; cierre móvil e impresión. Gate L3 solo tras
revisión independiente y evidencia ejecutada; este diseño no lo declara cerrado.

## Corrección de diseño · ronda 2

Estas reglas concretan las relaciones y transiciones anteriores. Prevalecen sobre
las descripciones abreviadas de las tablas. No se han implementado todavía.

### Integridad en ambos sentidos

`sala_suministros` añade estado activo/cancelado y UNIQUE(id,sala_id).
`sala_equipos` expone UNIQUE(id,sala_id). El vínculo componente incluye sala_id
y usa dos FK compuestas a esas claves: no basta compartir dos UUID válidos.
La composición expone UNIQUE(id,articulo_kit_id,version); el suministro referencia
esa terna, y cada línea expone UNIQUE(id,composicion_id). El vínculo conserva
composicion_id y usa FK compuesta a la línea. Un trigger diferido valida que el
suministro refiere la misma composición, que el artículo físico coincide con
articulo_componente_id, que cantidad de equipo es 1 y que ordinal está entre 1
y cantidad de la línea. Solo las líneas incluidas pueden quedar dentro de su kit.

Prohibir actualizar versión/composición/modelo/cantidad de una composición
instanciada; crear versión nueva. Triggers inversos en equipo y suministro
rechazan cambios de sala, artículo, cantidad o composición que invaliden vínculos.
No se permite borrar directamente el vínculo ni el padre con componentes vivos.
La operación explícita usa estado final comprobado por constraints diferidos,
sin desactivar triggers. Se validan igualmente plantillas y sus copias.

### Pedido compartido: asignado no es reservado ni servido

Añadir a cada asignación cantidad_recibida_atribuida, inicialmente 0. La recepción
de una línea bloquea todas sus asignaciones en orden creado_en/id y reparte solo
el incremento recibido a las pendientes, sin exceder ninguna cantidad asignada.
El sobrante queda como recepción sin destino atribuido. Token de recepción,
movimiento de entrada, cantidad de línea y reparto se confirman juntos. Un
reintento no repite ninguno. Este reparto acredita procedencia comercial, no
disponibilidad física ni salida a sala.

Para suministro de una unidad, demanda activa=1; cancelado=0.
Cobertura física es salida neta a esa sala más reserva activa para ese suministro,
limitada a la demanda, sin sumar dos veces la reserva consumida por la salida.
La reserva debe tener FK al suministro y compartir sala/artículo; al cargarla se
consume su cantidad y nace movimiento de salida trazado, dentro de la transacción.
Stock sin reservar se muestra como disponible para reservar, nunca como cobertura
simultánea de todas las salas. No se crean reservas durante recepción.

Pendiente de recibir por suministro = suma(asignado - recibido_atribuido).
No es un segundo stock ni se suma a existencias. Material recibido sin reserva
se muestra como "Recibido; pendiente de reservar". Una recepción atribuida
permite reservar primero sus unidades disponibles; si ya no están disponibles,
se muestra discrepancia de almacén y exige resolverla, sin acreditar instalación
ni crear automáticamente otro pedido. Una propuesta de compra no vuelve a
incluir unidades con asignación comprada vigente o incidencia de recepción abierta.

Caso obligatorio: línea de dos kits, A y B asignados uno cada uno. Recepción 1/2
atribuye una unidad a A según orden estable: A recibido1/pendiente0, B recibido0/
pendiente1, almacén1, cobertura física de ambos0. Reserva A: almacén1/reservado1/
disponible0; A cobertura1, B0. Carga A: almacén0/reservado0/servidoA1, coberturaA1.
Recepción restante atribuye1 a B y entra1 en almacén. Reservar/cargar B consume
esa unidad. Reintentar cualquiera de las recepciones conserva todos los valores.
Las asignaciones se crean/redistribuyen con los mismos locks; no se mueve una
porción ya recibida sin operación explícita auditada y comprobación de reservas.

### Cable unido a una pieza

`sala_cables_suministrados` incorpora tipo libre/unido, propietario_equipo_id,
puerto_fijo_id y ordinal_fijo. Unido exige los tres campos y FK compuesta de
propietario/sala; libre exige los tres nulos. Se valida que propietario pertenezca
al suministro, puerto al artículo y ordinal a su capacidad. La conexión que usa
un cable unido debe contener exactamente ese extremo, además de cumplir unicidad
del cable y sala. Cambiar extremos, artículo, propietario o vínculo se valida
también en sentido inverso. Si el extremo fijo aún no está documentado no se
asigna el cable a conexión: se conserva la referencia de suministro pendiente.
Copiar genera otro cable y remapea propietario/puerto/ordinal; dos micrófonos no
pueden intercambiar los cables unidos aunque estén en la misma sala.

### Retirar piezas y cancelar suministro

Las acciones existentes de borrar equipo consultan pertenencia al suministro
dentro del lock de sala. Si pertenece a kit, rechazan el borrado individual con
acción concreta "Gestionar kit". No se elimina un vínculo para convertir una
pieza incluida en equipo comprable. Un componente ausente o averiado es incidencia
de esa pieza, no un cambio de composición ni una baja automática del kit.

Antes de comprar, cancelar el suministro es una operación explícita versionada:
bloquea sala, pedido si lo hay, suministro, componentes, conexiones y reservas;
exige ausencia de recepción/salida, libera solo sus reservas y asignaciones no
compradas, conserva el snapshot cancelado y el registro de cancelación. Rechaza
si hay conexiones hasta que se seleccionen explícitamente las conexiones a
retirar en el mismo lote. No hay borrado en cascada silencioso. La demanda pasa
a cero por estado del suministro, incluidos todos sus componentes. Retirar el
último componente no deja suministro activo invisible.

Después de compra/recepción/salida, no se cancela para borrar demanda histórica:
una revisión de diseño marca suministro como retirado_del_diseño, mantiene compra,
composición y movimientos, y registra destino pendiente (reutilizar/devolver).
La demanda del diseño nuevo es cero, pero el material físico sigue trazado.
No aparece devolución hasta que una persona registra el retorno real. Las piezas
históricas no se borran; sus conexiones se conservan en la revisión anterior.
El estado incluye retirado_del_diseño además de activo/cancelado.

### Incidencias por pieza y devolución de kit

Una incidencia identifica componente, suministro, autor, motivo y estado. No
genera movimiento. Una cámara rota no produce devolución o baja de kit completo,
ni entrada de cámara suelta. El checklist de retorno del kit compara todos los
componentes/cables requeridos del snapshot y exige revisión explícita completa.
Mientras falte una pieza o haya avería, el kit retornado queda en ubicación de
cuarentena no disponible para reservas, con incidencia abierta. La entrada real
de kit a cuarentena no acredita kit utilizable; la proyección de disponibilidad
excluye esa ubicación por estado, sin modificar existencias contables.
Solo la verificación completa y resolución de incidencias permite traslado
registrado a ubicación disponible. Dar de baja kit completo requiere acción
explícita para toda la unidad comercial; el despiece sigue fuera de alcance.

Pruebas negativas añadidas: vínculo cruzado sala/composición/modelo/ordinal,
cambio inverso, cantidad física distinta de1, intercambio de cables unidos,
copias mal remapeadas, borrado de último componente, cancelación con recepción,
cancelación sin resolver conexiones, kit incompleto reservado desde cuarentena,
y avería parcial que intente mover stock de una unidad comercial completa.
Verificar rollback después de cada escritura intermedia de cancelación y reparto.

## Precisión final de integridad · ronda 3 acotada

Corrección de los tres hallazgos de movimientos/migración de la segunda ronda.

**Cobertura por suministro, incluso dentro de una misma sala.** La expresión
"salida neta a esa sala" anterior se sustituye por salida neta **atribuida a ese
suministro**. Añadir `reserva_suministros(reserva_id,suministro_id,cantidad)` y
`movimiento_suministros(movimiento_id,suministro_id,cantidad)`, FK con RESTRICT y
UNIQUE de cada par. Cantidad positiva; triggers diferidos con bloqueo de reserva/
movimiento/suministros ordenados comprueban que artículo y sala coinciden y que
la suma de atribuciones no supera cantidad del registro canónico. Un kit exige
cantidades enteras. En reserva activa la suma de cobertura reservada y servida
no supera demanda1. Cambios inversos de artículo/sala/cantidad o estado vuelven
a validar estas cotas. No se borra una atribución para esconder una salida.

Servido(S)=salidas atribuidas(S) menos devoluciones atribuidas(S), con devolución
vinculada a la salida original mediante FK y suma de retornos limitada a su
cantidad. Una baja posterior no es otra devolución. Cobertura(S)=reserva activa
atribuida(S)+servido(S), limitada por la demanda activa. Las atribuciones se
escriben en la misma transacción que reserva, consumo de reserva y movimientos.
El agotamiento de reserva por salida conserva su rastro en estado servida y deja
de sumar reserva activa. Nunca se asigna por artículo+sala sin suministro.

Los movimientos/reservas legacy sin atribución siguen en stock y en sus informes
históricos, pero no acreditan automáticamente ninguno de dos kits nuevos. La UI
permite una atribución explícita conservativa tras comprobar cantidad disponible
para atribuir; conserva el movimiento original. Caso obligatorio: misma sala y
artículo, kits A/B, salida1 atribuida A => A1/B0; devoluciónA1 => A0/B0. Una salida
legacy1 sin atribuir => A0/B0 y aviso de material pendiente de identificar.
Asignar esa misma unidad a A y B debe fallar atómicamente por exceso del padre.

**Retirada poscompra: prerrequisito real.** `diagrama_version` no es historial.
La operación retirado_del_diseño descrita antes queda inhabilitada en L3 mediante
rechazo de servidor mientras no exista el snapshot íntegro de revisión de L5.
No se implementa una falsa conservación ni se borran conexiones compradas.
El mensaje identifica que hace falta una revisión de diseño registrada.
L5 deberá implementar primero `revisiones_diseno_sala` inmutable: sala, revisión,
fecha, autor, hash y snapshot de medidas, mobiliario, equipos/composición, puertos
y bocas, conexiones, rutas/puntos, etiquetas y asignaciones de cable suministrado.
La transacción de retirada crea/verifica ese snapshot antes de liberar ocupación
en el modelo activo y cambiar demanda. Las filas históricas del snapshot no
participan en la ocupación activa, pero el paquete de la revisión anterior las
resuelve desde el snapshot, no desde el catálogo vigente. Solo tras probar esa
capacidad se habilita retirar poscompra. L3 prueba el rechazo y conservación
exacta del montaje comprado; L5 prueba retiro y lectura histórica sin referencias
rotas. No se usa borrado en cascada como sustituto de revisionado.

**Custodia parcial y ubicación reservable.** Si solo retorna una cámara y el
codec sigue en la sala, registrar custodia de la pieza en la incidencia (componente,
ubicación física, fecha y autor); NO entrada/devolución de1kit ni en cuarentena.
Tampoco entrada comercial de cámara suelta. La unidad comercial conserva su estado
servido e incidencia incompleta. Solo cuando retorna el kit entero se registra
devolución comercial1 vinculada a su salida y a su suministro, en cuarentena.

Añadir `ubicaciones.reservable boolean not null default true`; migrar ubicaciones
existentes a true conserva semántica y crear cuarentena explícita con false.
Existencias sigue sumando todos los movimientos. Disponible reservable suma solo
ubicaciones reservables y resta reservas activas: mostrar por separado existencia
en cuarentena, sin ocultarla. Reserva/carga valida la condición en servidor y BD;
cambiar reservable a false con reservas activas exige resolverlas antes. Recepción
o devolución a cuarentena no autoriza reserva por el mero número de existencias.

El traslado de kit completo verificado utiliza operación trazada con dos
movimientos compensados (salida de cuarentena y entrada de ubicación reservable),
misma cantidad/artículo/suministro e identificador de traslado único, en una
transacción. Esos movimientos de traslado no llevan salida/devolución a sala ni
se agregan a Servido(S). No aumenta stock global. Solo se permite si checklist de
composición completo e incidencias resueltas. Pruebas: cámara sola no genera
movimiento; kit incompleto no se reserva; kit completo trasladado conserva stock
global y cambia exactamente disponibilidad; reintento no repite el traslado.

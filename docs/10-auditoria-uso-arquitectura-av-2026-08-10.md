# Auditoría de uso — Arquitectura AV

Fecha: 10 de agosto de 2026. Alcance: recorrido manual, en local, sin cambiar datos ni código.

## Veredicto

La aplicación ya tiene un núcleo operativo sólido para **diseñar una sala, obtener su material y cableado, contrastarlo con almacén y dejar trazado el cierre**. No es una maqueta. El recorrido completo funciona conceptualmente:

`proyecto → plantilla o sala en blanco → medidas/equipos/conexiones → metros y lista de material → reserva/pedido → carga → instalación → entrega`.

El riesgo principal no es de cálculo: es de **operación humana**. Para los jefes de arquitectura, el flujo está repartido entre demasiadas secciones y no deja una decisión formal de «diseño aprobado / ejecutar internamente / empresa externa». Para los técnicos, aún falta un expediente de obra compacto: responsable real, planificación, factura/adjuntos y evidencia de finalización.

## Lo que ya resuelve bien

- Una sala puede nacer desde plantilla o en blanco, con dimensiones, mesa, ruta de cable y datos de ubicación. La plantilla copia también equipos y conexiones.
- El croquis deriva de las medidas y posiciones, y las tiradas devuelven metros. Es la decisión técnica correcta: no depende de un dibujo manual.
- La ficha de sala muestra un semáforo útil. En la sala revisada detectó con precisión material sin stock, equipo sin referencia, puertos sin definir, cable sin asignar, falta de reserva y falta de carga.
- Logística diferencia correctamente necesario, existencias, reservado para otras obras, reservado en esta sala y disponible. Esto evita prometer dos veces el mismo equipo.
- La compra se agrupa por proveedor y separa precio orientativo de oferta real. Es una protección importante: un precio de estimación no se confunde con una autorización de compra.
- Se conserva una visita de check-in previa, carga de furgoneta, instalación y entrega. La entrega con bloqueos exige nota; no maquilla una excepción.
- La tabla de cables está disponible como entregable de obra y exporta CSV. También están el croquis, el esquema y la lista de material.

## Hallazgos prioritarios

### Ahora — antes de depender de ella para una obra completa

1. **Introducir una única pantalla de “Preparar / ejecutar sala”.**
   Hoy el responsable debe saber que diseño, cableado, logística, carga, check-in y documentos son pestañas/pantallas distintas. El semáforo existe, pero no conduce al siguiente paso ni identifica al dueño. Crear una vista operativa con: estado, bloqueo, siguiente acción, responsable, fecha prevista y enlace directo a corregir cada bloqueo.

2. **Separar “diseño terminado” de “aprobado para ejecutar”.**
   “No montable” es correcto como control técnico, pero no hay hito de revisión/aprobación de arquitectura o AV. Añadir la decisión explícita: preparado por, revisado por, aprobado para ejecutar, fecha y observaciones. No debe ser un simple estado editable: debe quedar como registro.

3. **Modelar la ejecución, no solo el hito de instalación.**
   El modelo actual guarda una única persona y fecha para `instalación`; no cubre equipo de técnicos, fecha/hora planificada, inicio real, finalización real, parte de trabajo ni incidencias. Para una sala sencilla puede bastar; para una obra real no permite saber quién interviene ni cuánto queda.

4. **Registrar modalidad interna o externa y empresa responsable.**
   Es una decisión citada en los datos de negocio pero no aparece en el flujo. Si es externa, hacen falta empresa, persona de contacto, pedido/contrato, técnico interno responsable y aceptación final interna. No mezclar el proveedor de un artículo con la empresa instaladora.

5. **Crear expediente documental por proyecto/sala.**
   La pestaña Documentos solo enlaza entregables; el paquete PDF/Excel/ZIP está marcado como pendiente. Faltan adjuntos de factura/albarán, presupuesto, foto de preexistencia, foto final, planos y acta de entrega. La factura debe asociarse al pedido o recepción, no a un campo libre de la sala; las fotos y el acta, a la sala o hito correspondiente.

6. **Cerrar el contrato del catálogo.**
   La ficha ya incluye puertos, precio, proveedor, plazo y stock mínimo, pero no medidas ni peso. Añadirlos como campos estructurados opcionales (ancho, alto, fondo, peso y, si interesa, alimentación/consumo) para filtrar, comprobar muebles/racks y preparar transporte. El stock no es un campo del artículo: debe seguir derivándose por almacén y ubicación, como ahora.

### Después — mejora clara de usabilidad y control

1. **Asistente de alta en dos niveles.** Primero “qué sala y dónde”; después “usar plantilla o diseñar”. El alta actual reúne origen, serie, identificación y once campos físicos antes de crear. Es completo, pero pesado para un primer uso y el bloque “crear 3/10/144 salas” distrae en una obra normal. Mantener la creación masiva como acción avanzada al elegir una plantilla repetida.

2. **Tareas accionables, no solo avisos.** “Sin cable asignado” y “sin puerto” explican el problema, pero deberían ofrecer “asignar cable” / “definir puertos” en la misma fila o llevar directamente al elemento afectado.

3. **Vista de jefe de obra por proyecto.** Un cuadro único: salas por fase, bloqueos, compras pendientes, recepciones, cargas, responsables y fechas. La portada hoy informa de contadores globales, pero no prioriza una obra concreta.

4. **Planificación real.** Fecha objetivo de instalación y entrega, ventana de trabajo, duración prevista, dependencia de recepción/check-in y asignación de varios técnicos. No convertirlo en un calendario complejo hasta que el equipo lo necesite.

5. **Paquete de obra imprimible.** Generar un PDF por sala y un ZIP por proyecto: portada/estado, croquis, tabla de cables, BOM, ubicaciones de recogida, checklist, contactos y anexos. El CSV es útil, pero no basta para llevar una instalación a campo.

### Experimental — no lo haría todavía

- Coste automático completo por sala, amortización o PVP: primero cerrar precios finales, recepciones y facturas.
- Optimización automática de rutas de técnico/furgoneta: aporta poco sin planificación fiable.
- Editor gráfico libre tipo CAD: el croquis derivado ya es más consistente para el objetivo actual.

## Cosas que sobran o conviene esconder

- Los botones “Poner 3 / 10 / 144 salas” deben aparecer solo tras elegir una plantilla repetible; en una nueva sala normal hacen parecer que la herramienta es para importar inventario, no para montar una obra.
- No haría visible a técnicos el catálogo administrativo completo, parámetros, proveedores ni precios salvo que su rol lo requiera. Su superficie debería ser: sala asignada, documentación, material, checklist, incidencias y cierre.
- “Documentos” no debe ser una página de enlaces cuando llegue la fase de operación; será el expediente. Mientras el paquete exportable siga pendiente, el título puede crear una expectativa que no cumple.

## Flujo recomendado para cada rol

| Rol | Secuencia mínima | Resultado |
| --- | --- | --- |
| Arquitectura AV | Crear proyecto/sala → plantilla o diseño → revisar semáforo → aprobar ejecución | Diseño congelado y lista de acciones |
| Compras/almacén | Reservar disponible → pedido → adjuntar factura/albarán → recibir y ubicar | Material trazable y preparado |
| Técnico/empresa | Check-in → cargar → instalar → fotos/parte → solicitar validación | Montaje evidenciado |
| Responsable AV | Revisar excepciones → validar funcionamiento → registrar entrega | Sala entregada con expediente |

## Evidencia del recorrido local

- Portada: 903 equipos, 28 referencias de cable, 16 plantillas y contadores independientes de almacén, reservas, pedidos y cargas.
- Alta: permite sala en blanco o plantilla; avisa correctamente que sin largo, ancho y alto no calcula cable.
- Sala `TP8 planta 3 01`: 4 equipos, 4 tiradas y 20,8 m calculados; semáforo bloquea por tres referencias sin stock y avisa las carencias de catálogo, puertos, cables, reservas y carga.
- Logística de esa sala: muestra disponibilidad, reserva, carencias, propuesta de pedido por proveedor y una carga que se habilita solo tras reservar.
- Catálogo: ficha de equipo con puertos y precios, pero sin dimensiones ni peso; el esquema actual confirma que esos campos no existen en `articulos`.
- Check-in: visita previa por puntos e incidencias, útil para comprobar la sala antes de montar.

## Decisión práctica

No rediseñaría la app ni reharía el cálculo. Priorizaría una iteración pequeña de **expediente operativo de sala**: aprobación, modalidad interna/externa, asignación/fechas/parte, adjuntos ligados a pedido o sala y una vista “siguiente acción”. Con eso, la aplicación pasaría de ser una buena herramienta de diseño y material a una herramienta completa de ejecución controlada.

## Recorrido de ejecución verificado después de la limpieza

En escritorio se creó la obra temporal `Prueba de auditoría`, una sala sin plantilla,
dos equipos, una tirada de red de 4,3 m, una reserva, una recepción, una carga y
su cierre. También se registró una visita de check-in, instalación, entrega, inicio y
cierre de proyecto. Cada cambio reapareció al recargar su pantalla correspondiente.

- **Almacén y carga:** entrada manual, reserva completa, marcar/desmarcar carga,
  confirmar salida y repartir como instalado funcionaron. Al cerrar, las existencias
  dejan el almacén y la carga queda cerrada, que es el comportamiento correcto.
- **Check-in:** los tres resultados (conforme, incidencia y no aplica) se guardan.
  Una incidencia puede guardarse sin nota ni medida: conviene exigir una nota para
  que sea accionable.
- **Pedidos con precio orientativo:** se reprodujo que la interfaz permitía llevarlo
  a `Pedido` e incluso recibirlo, contradiciendo el propio aviso. Se corrigió la
  interfaz y se añadió protección de servidor: hasta que haya oferta final los
  botones quedan deshabilitados y una petición directa no cambia el estado.
- **Plantillas:** después de eliminarlas, el alta de sala en blanco funciona y el
  texto de inicio ya no envía a una plantilla inexistente. Crear una plantilla desde
  una sala funciona, pero `/plantillas` sigue sin CTA para crearla desde cero.
- **Catálogo:** navegación marca → sección → referencia y alta de puerto funcionan;
  los campos obligatorios se validan de forma nativa. El selector de artículos del
  almacén requiere elegir la sugerencia y escribir una cantidad; el valor de ejemplo
  no se debe confundir con una cantidad registrada.
- **Documentos:** la página enlaza entregables existentes, pero PDF/Excel/ZIP y los
  adjuntos operativos (factura, albarán, fotos) siguen sin implementar.

## Móvil, validado al final

Se revisaron las pestañas de Equipamiento y Logística a 320 px y Documentos a 390 px.
Los datos y las tablas quedan dentro de sus propios contenedores con desplazamiento
horizontal; no apareció desbordamiento del cuerpo. Queda una incidencia de uso: al
abrir directamente `Documentos` a 390 px, la pestaña activa puede quedar fuera de la
zona visible del carril horizontal. Hay que desplazarla a la vista o cambiar el patrón
de pestañas antes de dar por cerrado móvil.

## Segunda pasada de controles

Se hizo una segunda obra temporal desde cero para no dar por bueno solo el flujo
heredado: alta de proyecto, adopción de una sala legado, alta de una sala medida,
equipos desde catálogo y escritos a mano, sumar/restar unidades, quitar un equipo,
una conexión de red calculada y exportación CSV. Se abrió además una visita de
check-in nueva y se verificó el guardado de parámetros sin alterar sus valores.

La sala temporal, proyecto, conexión, visita y cualquier movimiento de prueba se
eliminaron al acabar. La base local vuelve a tener cero plantillas y cero unidades
históricas instaladas.

## Tercera pasada: acciones administrativas

Se probaron con una referencia temporal: alta de artículo, guardar la ficha y retirada
del catálogo; la retirada borra y redirige inmediatamente, sin una pantalla de
confirmación. Es un riesgo `Ahora`: un catálogo con referencias usadas no debe tener
una destrucción de un clic. Se probaron además entrada, salida, devolución y ajuste de
inventario, y la creación de una ubicación adicional. Cada movimiento produjo el
efecto y el histórico esperado; se retiraron los cuatro movimientos y la ubicación
temporal al finalizar.

En móvil (390 px) el esquema de conexiones y la tabla de cables se mantienen dentro
de sus contenedores horizontales. La pestaña activa sigue pudiendo no verse completa
en el carril, por lo que la incidencia de navegación móvil permanece abierta.

El check-in se abrió también sobre una visita temporal y se verificaron sus tres
respuestas posibles y la persistencia punto a punto. El cierre no se concede mientras
haya puntos sin mirar; ese bloqueo es correcto. La visita temporal se borró después.

# Plan de ejecución · Editor del diagrama de una sala

Estado del plan: preparado el 10-08-2026 para ejecutarse en otra conversación.

Rama ya creada: `codex/diagrama-salas`.

## 1. Encargo

Añadir una sexta pestaña, **Diagrama**, a la ficha de cada sala. Su finalidad es
editar visualmente el plano en planta de la sala —medidas, mesa, equipamiento y
tomas— y hacer que el resultado aparezca después en el croquis de Resumen y en
los entregables. El editor no debe crear una imagen independiente ni una segunda
fuente de verdad.

La sala puede proceder de una plantilla o haberse creado desde cero. Los dos
caminos deben acabar en el mismo editor y guardar en el mismo modelo.

## 2. Diagnóstico confirmado del estado actual

### 2.1 El croquis no es una imagen guardada

El croquis actual se genera como SVG en el servidor:

- `src/app/salas/[id]/page.tsx` carga sala, equipos, conexiones, tomas y metros.
- `src/components/croquis/croquis-sala.tsx` llama a `construirEscena()`.
- `src/lib/croquis.ts` convierte los datos en paredes, mesa, sillas, equipos,
  tiradas, cotas y anotaciones.
- `src/components/croquis/plano-sala.tsx` pinta la escena como SVG.

La sala de la captura usa datos sembrados desde los CSV de plantillas y montaje;
la imagen en sí no está ni en código ni en base de datos.

### 2.2 Qué sí está fijado en código

- El tamaño gráfico de cada clase de equipo se deduce de `extremo` mediante
  `TAMANO_SIMBOLO`.
- Si un equipo tiene `x_m = 0`, `y_m = 0` y `z_m = 0`, se considera sin colocar.
- La posición automática de pantalla, proyector, rack, caja de conexiones y
  otros extremos sigue reglas de `posicionPorDefecto()`.
- Las sillas se derivan del aforo y de la mesa; no son objetos guardados.

Eso explica el aviso de la captura: los cuatro equipos no tienen una posición
confirmada y el croquis los coloca de forma estimada.

### 2.3 Datos que ya existen

- Sala rectangular: `salas.largo_m`, `ancho_m`, `alto_m`.
- Mesa: dimensiones, altura y centro en `salas.mesa_*`.
- Equipos: `sala_equipos.x_m`, `y_m`, `z_m` y `extremo`.
- Tomas de red: coordenadas opcionales en `tomas_red`.
- Plantillas: medidas de sala y coordenadas de los equipos estándar.
- Conexiones: unen equipos y sus coordenadas alimentan el cálculo de cable.

### 2.4 Brechas que la implementación debe cerrar

1. `(0,0,0)` significa a la vez “sin colocar” y una esquina válida.
2. `mesa_x_m` y `mesa_y_m` se leen, pero el formulario/acción actual no los
   guarda; la mesa solo puede quedar centrada de forma implícita.
3. Las plantillas no guardan el centro de la mesa.
4. “Guardar sala como plantilla” no conserva todavía mesa, posiciones,
   extremos ni conexiones con fidelidad completa.
5. Un equipo con `cantidad > 1` se representa con un único símbolo y una única
   posición.
6. No existen rotación ni tamaño gráfico específico por equipo.
7. No existen puertas, ventanas, columnas ni mobiliario libre en el modelo.
8. Las acciones actuales no validan de forma completa coordenadas negativas,
   valores no finitos o posiciones fuera de la sala.
9. No hay control de concurrencia para dos editores abiertos a la vez.
10. Mover un equipo cambia los metros calculados y, por extensión, el material.
    El editor debe comunicarlo; no es un cambio meramente estético.

## 3. Decisión de producto recomendada

Construir primero un **editor de planta rectangular sobre SVG**, no un CAD.
Reutilizar la proyección y la escena actuales, añadir interacción en cliente y
guardar datos métricos normalizados en las tablas de dominio.

No usar React Flow: está orientado a grafos y ya existe otro diagrama —el esquema
de conexiones de Cableado— con necesidades diferentes. Tampoco guardar el
lienzo como JSON, PNG o SVG en la base de datos. Un SVG interactivo propio
mantiene el croquis imprimible, reduce dependencias y permite una alternativa
accesible mediante lista e inspector numérico.

La pestaña visible será **Diagrama** porque ese es el término pedido. En código,
usar nombres como `plano-editor`, `escena-plano` o `editor-plano-sala`; reservar
`src/components/diagrama/` y `src/lib/diagrama.ts` para el esquema de conexiones
que ya existe.

## 4. Alcance

### Ahora · primera entrega útil

- Nueva ruta `/salas/[id]/diagrama` y pestaña `Diagrama`.
- Sala rectangular a escala.
- Edición de largo, ancho y alto.
- Mesa: dimensiones, altura, posición y rotación.
- Equipos existentes: seleccionar, arrastrar y editar X/Y/Z.
- Tomas de red: colocar y editar.
- Sillas derivadas del aforo; se ven, pero no se colocan una a una.
- Rejilla, ajuste a rejilla, zoom, encajar, panorámica y coordenadas en metros.
- Inspector numérico como alternativa completa al arrastre.
- Deshacer/rehacer local, guardar y descartar.
- Estado “cambios sin guardar / guardando / guardado / conflicto”.
- Resumen conserva el croquis de lectura y refleja exactamente lo guardado.
- Plantilla → sala conserva posiciones y mesa.
- Sala → plantilla conserva montaje y conexiones con fidelidad.
- Proyecto cerrado: lectura sí, edición no, con guarda real de servidor.
- Escritorio completo y, como gate final, uso táctil/móvil sin overflow de página.

### Después

- Puertas, ventanas, columnas y mobiliario no AV mediante tablas separadas
  `elementos_sala` y `elementos_plantilla`.
- Alineación, distribución, duplicado, bloqueo de objetos y capas.
- Tamaño físico por artículo y override por sala.
- Editor visual propio para plantillas.
- Historial de versiones y restauración.
- Exportación SVG/PDF específica del plano.
- Instancias físicas separadas para líneas de equipo con `cantidad > 1`.

### Experimental

- Salas no rectangulares, paredes libres, curvas o varios recintos.
- Enrutado manual de cable y obstáculos que alteren el cálculo.
- Importación/exportación DXF.
- Vista 3D.
- Edición colaborativa en tiempo real.

Estas funciones no entran en la primera entrega porque obligan a rediseñar
`calculo-cable.ts`, el perímetro de sala y el modelo de conexiones.

## 5. Contrato de experiencia de usuario

### 5.1 Entrada y navegación

- Orden de pestañas: `Resumen · Diagrama · Equipamiento · Cableado · Logística y
  ciclo de vida · Documentos`.
- En Resumen, el título de la tarjeta sigue siendo `Croquis` y gana una acción
  `Editar diagrama` que enlaza a la nueva ruta.
- La URL directa, recarga, Atrás/Adelante y `aria-current` deben funcionar.
- La barra de pestañas mantiene su scroll interno y sus indicadores de desborde.

### 5.2 Pantalla de escritorio

La página se compone de tres zonas:

1. **Barra de herramientas superior**
   - Seleccionar.
   - Mover vista.
   - Zoom menos, porcentaje, zoom más y encajar sala.
   - Rejilla visible y ajuste a rejilla.
   - Deshacer y rehacer.
   - Descartar y Guardar cambios.
   - Estado de guardado en texto, sin depender solo del color.

2. **Lienzo central**
   - SVG con sala a escala y fondo de rejilla.
   - Selección clara con contorno y tiradores.
   - Arrastre mediante Pointer Events, compatible con ratón, lápiz y táctil.
   - Las coordenadas se expresan en metros; los píxeles son solo proyección.
   - El lienzo puede hacer zoom/pan internamente y nunca ensancha la página.
   - Equipos sin posición confirmada aparecen discontinuos hasta que el usuario
     los coloca o pulsa `Confirmar posición estimada`.

3. **Inspector lateral**
   - Sin selección: medidas de sala y mesa.
   - Con equipo: nombre, X, Y, Z, extremo y toma asociada.
   - Con toma: código, ubicación, X, Y, Z y notas.
   - Campos con etiqueta visible, unidad y mensajes de validación próximos.
   - Cambiar un número actualiza el lienzo sin esperar al servidor.

La lista de objetos de la sala debe estar disponible junto al inspector. Sirve
para encontrar elementos solapados y es la vía accesible para seleccionar sin
usar coordenadas visuales.

### 5.3 Primera apertura

- Si faltan medidas, no mostrar un lienzo engañoso: abrir el bloque `Define la
  sala` con largo, ancho y alto.
- Si hay medidas pero equipos estimados, mostrarlos en el plano y ofrecer una
  acción única `Confirmar posiciones estimadas` más la edición individual.
- Si la sala viene de plantilla y todo está confirmado, abrir directamente el
  plano encajado.
- No añadir un tutorial largo. La interfaz debe explicarse con nombres de
  herramientas, estado visible y un único texto contextual cuando haya datos
  incompletos.

### 5.4 Teclado y accesibilidad

- Tab recorre herramientas, lista de objetos e inspector en orden lógico.
- Enter/Espacio selecciona objetos desde la lista.
- Flechas mueven el objeto seleccionado un paso de rejilla; con modificador,
  paso fino. El incremento exacto debe estar anunciado en la ayuda accesible.
- Escape cancela el arrastre o revierte la edición activa.
- Suprimir pide confirmación solo para objetos que realmente puedan borrarse;
  no debe borrar equipos del catálogo por accidente desde el editor de plano.
- Cada objeto del SVG tiene equivalente en la lista/inspector. No afirmar que el
  SVG arrastrable por sí solo es accesible.
- Foco visible, contraste con los tokens existentes y objetivos táctiles de al
  menos 44 × 44 px.
- `prefers-reduced-motion` elimina desplazamientos animados; el editor no debe
  depender de animación para comunicar un cambio.

### 5.5 Móvil

- El recorrido funcional se construye y valida primero en escritorio.
- En 390 y 320 px, el lienzo ocupa el ancho y el inspector se abre como panel
  inferior, no como columna comprimida.
- Herramientas secundarias pueden vivir en `Más`, con texto; no usar iconos
  ambiguos solos.
- Zoom con botones siempre disponible. El gesto de pinza es mejora adicional,
  no la única forma de hacer zoom.
- Debe poder seleccionarse un objeto, cambiar X/Y/Z y guardar solo con táctil.

## 6. Modelo de datos y migración

### 6.1 Cambios mínimos para la primera entrega

1. `salas`
   - Mantener dimensiones y `mesa_*` como fuente canónica.
   - Añadir `mesa_rotacion_grados numeric(6,2) not null default 0`.
   - Añadir `diagrama_version integer not null default 0` para control optimista.

2. `plantillas_sala`
   - Añadir `mesa_x_m`, `mesa_y_m` y `mesa_rotacion_grados`.

3. `sala_equipos`
   - Añadir `posicion_confirmada boolean not null default false`.
   - Añadir `rotacion_grados numeric(6,2) not null default 0` solo si la rotación
     de equipos entra finalmente en la primera entrega; de lo contrario, dejarla
     para Después y no enseñar un control falso.

4. `plantilla_articulos`
   - Añadir `posicion_confirmada boolean` o conservar `null` como “sin colocar”
     durante la copia, sin convertir prematuramente la ausencia en `(0,0,0)`.
   - Añadir rotación si se adopta para equipos.

### 6.2 Backfill

- Marcar `posicion_confirmada = true` cuando alguno de X/Y/Z sea distinto de
  cero; dejar el triple cero como no confirmado porque el histórico es ambiguo.
- No inventar coordenadas para datos existentes.
- Las posiciones estimadas actuales deben seguir produciendo el mismo croquis.
- Las tomas con coordenadas nulas permanecen sin colocar.
- La migración debe ser idempotente y aplicable tanto a Docker como a Neon,
  pero no se ejecutará en remoto sin autorización expresa.

### 6.3 Cantidad mayor que uno

En el MVP, una fila agregada se representa con un ancla y una marca `×N`. No se
debe fingir que hay N posiciones reales. Para posicionar unidades de forma
independiente, el usuario tendrá que separarlas en filas hasta que exista un
modelo de instancias físicas.

No introducir `instancias_equipo` en esta fase: las conexiones actuales apuntan
a la fila agregada y una migración automática podría asignar cables a la unidad
equivocada.

### 6.4 Elementos arquitectónicos

No añadirlos silenciosamente a la mesa o a los equipos. Cuando se apruebe la
fase Después, crear `elementos_sala` y `elementos_plantilla` solo para objetos
no AV, con al menos:

- `id`, `sala_id`/`plantilla_id`.
- `tipo`: puerta, ventana, columna, mueble, zona o anotación.
- `etiqueta`.
- `x_m`, `y_m`, `largo_m`, `ancho_m`.
- `rotacion_grados`.
- Altura opcional cuando aporte información de montaje.
- `creado_en`, `actualizado_en` y orden estable.

## 7. Guardado, validación y concurrencia

Crear una acción específica, por ejemplo `guardarDiagramaSala`, en vez de
reutilizar varios formularios independientes durante un único guardado.

La acción debe:

1. Recibir un DTO explícito, validado con Zod o validadores equivalentes.
2. Abrir una transacción.
3. Leer la sala y su proyecto desde la base de datos; no confiar en `sala_id`
   enviado por el navegador.
4. Bloquear/leer la versión actual y rechazar una `versionEsperada` obsoleta.
5. Rechazar la edición si el proyecto está cerrado.
6. Comprobar que cada equipo y toma pertenece a la sala real.
7. Rechazar IDs inventados, duplicados o cruzados con otra sala.
8. Validar números finitos, dimensiones positivas y coordenadas compatibles con
   el rectángulo. Si se decide permitir un símbolo parcialmente fuera, fijar un
   único margen documentado y probarlo.
9. Actualizar solo los campos del diagrama, todo o nada.
10. Incrementar `diagrama_version`.
11. Releer la escena confirmada antes de responder.
12. Revalidar `/salas/[id]` con alcance `layout`, además de las superficies que
    consuman metros o material.

El cliente mantiene un borrador local y no escribe en cada píxel de arrastre.
`Guardar cambios` envía una operación atómica. Al cerrar o navegar con cambios
sin guardar se muestra la advertencia estándar del navegador.

Si hay conflicto de versión, no sobrescribir: informar `La sala cambió en otra
pestaña` y ofrecer `Recargar` o `Conservar mi borrador para comparar`.

## 8. Arquitectura de código

### Ruta y carga

- Crear `src/app/salas/[id]/diagrama/page.tsx` como Server Component.
- Crear una consulta compacta `obtenerDatosPlanoSala(id)` que cargue solo sala,
  equipos, tomas y lo necesario para la escena/editor.
- Pasar al cliente un DTO serializable; no enviar el catálogo completo ni Maps.
- Mantener `dynamic = 'force-dynamic'` y el fallback `SinConfigurar`.

### Componentes

Crear una carpeta nueva, sin mezclarla con el esquema de conexiones:

```text
src/components/plano-editor/
  editor-plano-sala.tsx
  barra-herramientas.tsx
  lienzo-plano.tsx
  lista-objetos.tsx
  inspector-sala.tsx
  inspector-mesa.tsx
  inspector-equipo.tsx
  inspector-toma.tsx
  panel-movil.tsx
  estado-guardado.tsx
```

No convertir la página en un componente monolítico.

### Lógica pura

Crear `src/lib/plano-editor.ts` para:

- Conversión metros ↔ coordenadas de escena.
- Ajuste a rejilla.
- Clamp y detección de fuera de límites.
- Movimiento por teclado.
- Rotación normalizada si entra en alcance.
- Selección y actualizaciones inmutables del borrador.
- Cálculo de bounds.
- Comparación entre versión original y borrador.
- Construcción del patch que se envía al servidor.

Reutilizar de `croquis.ts` la proyección y las reglas de escena o extraer una
pieza compartida. No mantener dos fórmulas de proyección que puedan divergir.

### Render final

- Extender `EscenaCroquis` solo con datos de dominio, no con estado de UI.
- `PlanoSala` sigue siendo la vista SSR de lectura de Resumen/Documentos.
- `LienzoPlano` añade selección y controles, pero pinta la misma geometría.
- Una misma entrada confirmada debe producir posiciones equivalentes en editor,
  croquis de Resumen y recarga posterior.

## 9. Plan por piezas y gates

Cada pieza se implementa, se verifica y se comitea antes de empezar la
siguiente. Los ejecutores no hacen Git mientras otros subagentes estén
escribiendo; el agente arquitecto revisa el diff y comitea con el lote parado.

### Pieza 0 · Cerrar decisiones y contrato visual

Entregables:

- Confirmar rectángulo como única forma de sala del MVP.
- Confirmar elementos del MVP: sala, mesa, equipos, tomas y sillas derivadas.
- Confirmar que puertas/ventanas/columnas quedan para Después.
- Confirmar tratamiento de `cantidad > 1`.
- Boceto de escritorio y móvil siguiendo `design-system/MASTER.md`.
- Estados: vacío, parcial, completo, solo lectura, error y conflicto.

Gate: Sergio o el arquitecto acepta el contrato antes de tocar esquema.

### Pieza 1 · Caracterización y modelo

Entregables:

- Tests que fijan el comportamiento actual del croquis y del cálculo.
- Migración idempotente y tipos TypeScript.
- Backfill de posición confirmada.
- Persistencia real de centro de mesa.

Gate:

- Tests de croquis y cable siguen verdes.
- Una posición válida en el origen se distingue de una estimada.
- Migración aplicada y repetida en Postgres efímero sin error.

Commit sugerido: `feat(diagrama): prepara el modelo de posicion de sala`.

### Pieza 2 · Lógica pura del editor

Entregables:

- `src/lib/plano-editor.ts` y pruebas.
- Snap, bounds, teclado, patches y normalización.
- No React ni consultas en esta pieza.

Gate:

- Cobertura de bordes, negativos, no finitos, origen confirmado y objetos fuera.
- Mutaciones deliberadas hacen caer los tests correspondientes.

Commit sugerido: `feat(diagrama): añade geometria pura del editor`.

### Pieza 3 · Persistencia atómica y guardas

Entregables:

- Consulta compacta de datos.
- Acción transaccional con versión.
- Validación de pertenencia y proyecto cerrado.
- Revalidación de todas las superficies dependientes.

Gate Postgres real:

- Guardado completo.
- Fallo a mitad no deja cambios parciales.
- Versión obsoleta no sobrescribe.
- Equipo/toma de otra sala se rechaza.
- ID inventado se rechaza.
- Sala de proyecto cerrado no cambia.
- Sala legado sigue editable.
- Cada guarda tiene una mutación que haga caer su prueba.

Commit sugerido: `feat(diagrama): guarda el plano de forma atomica`.

### Pieza 4 · Ruta y editor de escritorio

Entregables:

- Sexta pestaña y ruta tipada.
- Barra, lienzo, lista, inspector y estado de guardado.
- Arrastre, teclado, zoom/pan, encajar, rejilla y deshacer/rehacer.
- Enlace `Editar diagrama` desde el croquis de Resumen.

Gate de navegador real en escritorio:

- Crear sala desde cero, medirla, colocar mesa/equipos/tomas y guardar.
- Crear desde plantilla, mover un equipo y guardar.
- Recargar conserva exactamente las posiciones.
- Resumen reproduce el resultado.
- Cambian los metros cuando cambia una posición relevante.
- Atrás/Adelante y URL directa funcionan.
- Sin errores de consola, hidratación o red.

Commit sugerido: `feat(diagrama): incorpora el editor visual de sala`.

### Pieza 5 · Paridad de plantillas

Entregables:

- Plantilla → sala copia mesa, posición confirmada, extremos, rotación aprobada
  y conexiones.
- Sala → plantilla conserva esos mismos datos.
- Test de ida y vuelta.

Gate: una sala guardada como plantilla y recreada produce la misma escena y las
mismas conexiones, salvo IDs y metadatos temporales.

Commit sugerido: `fix(plantillas): conserva el montaje del diagrama`.

### Pieza 6 · Móvil, accesibilidad y cierre

Entregables:

- Panel inferior móvil.
- Táctil y teclado completos.
- Estados de foco, zoom 200 % y reduced motion.
- Documentación del nuevo contrato y actualización del roadmap.

Gate final:

- Recorrido completo primero en 1440 × 900 y 1280 × 800.
- Cierre en 768 × 1024, 390 × 844 y 320 × 568.
- Cero overflow horizontal del documento; el lienzo gestiona su propio viewport.
- Navegable solo con teclado.
- Touch targets medidos.
- `prefers-reduced-motion` comprobado.
- Full suite, build y auditoría del diff.
- Recorrido adversarial y prueba de dos pestañas concurrentes.

Commit sugerido: `test(diagrama): cierra accesibilidad y regresion visual`.

## 10. Matriz mínima de pruebas

### Unitarias

- Sala sin medidas, parcial y completa.
- Mesa centrada implícita y desplazada explícita.
- Origen `(0,0,0)` confirmado frente a posición ausente.
- Snap con coordenadas positivas, cero y límites.
- Movimiento por teclado y paso fino.
- Objeto dentro, tocando borde, parcialmente fuera y totalmente fuera.
- Equipo estimado → confirmado.
- `cantidad > 1` mantiene un único ancla y marca `×N`.
- Escena estable y determinista.
- Anotaciones y cotas conservadas.
- Cable recalculado al cambiar coordenadas.

### Integración con Postgres

- Migración y backfill.
- Transacción completa y rollback.
- Conflicto de versión.
- IDs cruzados entre salas.
- Proyecto cerrado.
- Sala legado.
- Plantilla → sala y sala → plantilla.
- Relectura con instancias nuevas después de guardar.

### E2E

- Desde cero → diagrama → resumen → recarga.
- Desde plantilla → edición → resumen → guardar como plantilla → recrear.
- Guardar/descartar.
- Navegar con cambios sin guardar.
- Dos pestañas y conflicto.
- Solo lectura de obra cerrada.
- Teclado completo.
- Táctil móvil.
- Overflow, zoom 200 %, foco, reduced motion, consola y red.

## 11. Criterios de aceptación

La mejora está terminada solo si:

1. Existe la pestaña y la ruta directa `Diagrama`.
2. Una persona no técnica puede definir una sala rectangular y colocar sus
   elementos actuales sin escribir coordenadas obligatoriamente.
3. Toda acción de arrastre tiene alternativa numérica y de teclado.
4. Guardar y recargar conserva la escena.
5. El croquis de Resumen usa esos mismos datos y no una copia.
6. No se guarda PNG, SVG final ni JSON de canvas como fuente paralela.
7. Mover equipos actualiza los cálculos dependientes.
8. Posición estimada y confirmada se distinguen sin abusar del triple cero.
9. Proyecto cerrado está protegido también en servidor.
10. Dos pestañas no se sobrescriben silenciosamente.
11. Las plantillas conservan el montaje en ambos sentidos.
12. No hay overflow de página ni regresiones en las otras cinco pestañas.
13. Tests, build, Postgres real y E2E pasan con evidencia reproducible.
14. La auditoría del diff confirma que no se mezclaron cambios ajenos.

## 12. Coste, rentabilidad, riesgo y mantenimiento

### Recomendación principal

Primera entrega rectangular, sin elementos arquitectónicos libres y sin librería
pesada de diagramación.

- **Coste de desarrollo estimado:** 8–13 jornadas técnicas concentradas, según
  el pulido táctil y la paridad de plantillas. Con ejecución asistida por agentes,
  medir por gates cerrados, no por horas prometidas.
- **Coste recurrente:** 0 € en licencias y servicios adicionales.
- **Rentabilidad:** alta. Convierte coordenadas que hoy se escriben a mano en un
  flujo visual, elimina posiciones estimadas y reutiliza el resultado en croquis,
  cable y plantillas.
- **Riesgo:** medio. El arrastre es fácil de mostrar pero la atomicidad,
  concurrencia, coordenadas válidas y efecto sobre cable requieren disciplina.
- **Mantenimiento:** medio-bajo si SVG de lectura y editor comparten geometría;
  alto si se introduce un canvas JSON o un segundo motor de render.

Añadir paredes libres, DXF y cableado alrededor de obstáculos elevaría el alcance
a un pequeño CAD: varias semanas, más pruebas geométricas y mantenimiento alto.

## 13. Prohibiciones para la ejecución

- No guardar una captura ni un JSON opaco como fuente de verdad.
- No duplicar equipos, mesa o tomas en una tabla genérica de elementos.
- No modificar `calculo-cable.ts` para soportar polígonos o obstáculos en esta fase.
- No llamar al nuevo código interno `diagrama` sin apellido: ya existe el
  diagrama de conexiones.
- No aceptar IDs o `sala_id` del cliente sin derivar pertenencia en la BD.
- No validar seguridad solo ocultando controles.
- No introducir una librería de canvas antes de demostrar que el SVG existente
  no cubre el MVP.
- No desplegar, hacer push, merge ni tocar Neon sin autorización expresa.
- No comitear mientras subagentes estén escribiendo.
- No mezclar los cambios locales previos que ya estaban en el árbol.
- No declarar el cierre con build verde solamente.

## 14. Instrucción lista para la siguiente conversación

> Trabaja en `C:\Users\sergi\Desktop\Aplicaciones\AV_design`, rama
> `codex/diagrama-salas`. Lee `AGENTS.md`, `design-system/MASTER.md`,
> `docs/07-roadmap.md` y este plan completo antes de actuar. El árbol contiene
> cambios previos ajenos: identifícalos y no los mezcles. Ejecuta las piezas en
> orden, con dos subagentes como máximo y reparto por radio funcional. Los
> subagentes no hacen Git. Tras cada pieza, verifica personalmente los tests,
> las mutaciones y el diff, comitea solo lo que pasa y detente si una decisión
> de alcance cambia el modelo. No hagas push, merge, deploy ni migración remota.
> La fuente de verdad debe seguir siendo el dominio normalizado; el editor y el
> croquis consumen los mismos datos. Empieza por Pieza 0 y no avances al esquema
> hasta cerrar sus cuatro decisiones.

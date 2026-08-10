# Roadmap · qué queda y en qué orden

Estado a 7 de agosto de 2026. Este documento manda sobre `docs/05-continuar.md`,
que quedó viejo. El 7-8-2026 Sergio pidió dos cosas nuevas que reordenan el
plan: **acercar el aspecto al de XTEN-AV** (decisión registrada en
`design-system/MASTER.md`) y **trazabilidad de personas y fechas** en el ciclo
de una sala.

## Hecho

| | |
|---|---|
| Fase 1 | Catálogo, plantillas, salas con medidas, cálculo de cable, lista de material |
| Fase 2 | Almacén, reservas, compras, carga de obra, cierre con bajas |
| Fase 3 · datos | Puertos por artículo, conexiones puerto a puerto, tabla de cables |
| M6 | La plantilla trae el montaje: posiciones y tiradas tipo, sala nace montada |
| Acceso | Clave de departamento con huella SHA-256, cookie firmada, middleware |
| Jerarquía de obra | Proyecto → Localización → Sala, portada operativa, pedidos por obra (7-8-2026) |
| Ficha en pestañas | Resumen · Diagrama · Equipamiento · Cableado · Logística · Documentos, rutas anidadas (7-8-2026) |
| R4 · Editor del plano | Pestaña `Diagrama`: medidas, mesa, equipos y rosetas se colocan arrastrando o con números (10-8-2026) |
| R5 · Mobiliario y origen | Sillas y mesas como objetos propios, rotación de todo y elección `Desde cero` / `Plantilla` (10-8-2026) |
| Despliegue | Neon + Render, `av-design.onrender.com`, autodeploy desde `main` |

## Lo que queda, por módulos

Cada módulo es una pieza suelta: su lógica pura con pruebas, sus componentes en
su carpeta y su ruta. Se enchufan a la ficha de sala, no la reescriben. Tocar
uno no puede romper otro.

### R1 · Rediseño visual (aspecto XTEN-AV)

El sistema está decidido y documentado en `design-system/MASTER.md`: sidebar
vertical clara, tarjetas con sombra, acento azul `#3669d9`, Plus Jakarta Sans
para interfaz y JetBrains Mono para datos. Extraído del volcado `Inicio/`.

Se aplica por unidades cerradas, nunca big bang; una pantalla no migrada
conserva el aspecto viejo entero, sin mezclas dentro de la misma vista:

1. **R1a · Cimientos**: tokens nuevos en `src/app/globals.css`, carga de Plus
   Jakarta Sans, componente de sidebar + barra superior
   (`src/components/navegacion/`). Con esto toda la aplicación cambia de
   esqueleto aunque las pantallas sigan igual por dentro.
2. **R1b · Lista de salas y panel de inicio**. Hecho. Visto el dashboard real
   con sesión: su lista de proyectos no es rejilla de tarjetas sino tabla
   dentro de una tarjeta con buscador y contador, así que la lista de salas
   sigue ese patrón. Las primitivas compartidas (`Tarjeta`, `Aviso`, `Dato`)
   llevan ya la superficie nueva, con lo que el resto de pantallas la hereda.
3. **R1c · Ficha de sala**. Hecho. La ficha ya era composición de bloques
   sobre `Tarjeta`, así que heredó la superficie de R1b; lo que quedaba era el
   buscador de artículo (estilo viejo incrustado) y la decisión del rail:
   oscuro como XTEN-AV, con etiquetas en vez de solo iconos.
4. **R1d · Plantillas y catálogo.** Hecho. Plantillas heredó entero de las
   primitivas; el catálogo cambió su rejilla de marcas pegadas (`gap-px`) por
   tarjetas sueltas, y los contadores del almacén se adelantaron porque eran
   el mismo patrón.
5. **R1e · Almacén, compras y carga**. Hecho: el checkbox táctil de la lista
   de carga y los tonos del check-in eran los últimos restos.
6. **R1f · Parámetros y restos.** Hecho: la puerta de entrada gana tarjeta, el
   croquis usa los tokens nuevos y los alias papel/papel-hundido se
   eliminaron. **R1 completo.**

Cada paso se verificó en escritorio y móvil antes de pasar al siguiente.

### Mejoras adoptadas del análisis de la base de conocimiento de XTEN-AV (7-8-2026)

Del recorrido documental de su KB (subagente, ~200 artículos de X-DRAW más
proyectos y X-Pro). Lo confirmado: **XTEN-AV no calcula metros de cable** — su
"longitud" es una columna de texto que se teclea a mano — y su BOM y su dibujo
son dos estados que se desincronizan, con una familia entera de artículos de
soporte para arreglar el desajuste. Las dos ventajas de AV_design (metros
calculados, todo derivado de las mismas tablas) quedan validadas por su propia
documentación.

Criterios que entran en módulos ya planificados:

- **R2 (diagrama)**: vista "solo puertos conectados / todos" por query param —
  con matrices de 20+ puertos el esquema es ilegible sin ello—; color del
  punto de conexión por señal con la misma paleta que `PREFIJO_CABLE`, para
  que tabla y diagrama se lean igual; sufijo por tipo en los equipos del
  croquis (DISPLAY-1, DISPLAY-2) sin renumeración retroactiva, mismo criterio
  que los cables.
- **P1 (ciclo de vida)**: el estado del material de una obra
  (pedido/recibido/instalado/entregado) se deriva de movimientos y
  recepciones, nunca se teclea — en X-Pro es un campo manual y es su punto
  débil. El "inventario entregado de la sala" saldrá de esas tablas.
- **Editar puertos con conexiones vivas** (Ahora, pieza suelta): XTEN-AV
  destruye todas las conexiones del bloque al editar puertos; aquí se
  conservarán las que sobreviven y se avisará listando los cables que se
  pierden.

Para `Después`: nota libre por cable en `conexiones`; export XLS de la tabla
de cables; "guardar sala como plantilla" (el camino inverso ya existe a
medias) y "duplicar sala" para gemelas; `edificio`/`planta` en salas para
agrupar; ordenar el buscador de artículo por frecuencia de uso real.

Para `Experimental`: aprobación humana explícita, submittals compilados,
export DXF del croquis, fichaje de horas de campo.

### R2 · Diagrama de conexiones, solo lectura — HECHO (7-8-2026)

Implementado: `src/lib/diagrama.ts` (lógica pura, 16 pruebas) construye la
escena —bloques por columnas según el flujo de señal, puertos por lado,
líneas ortogonales con carriles— y `src/components/diagrama/` la pinta en SVG
desde el servidor, dentro de la ficha de sala. El bloque copia la anatomía de
XTEN-AV: categoría encima, serigrafía dentro, conector fuera del borde, marca
y modelo al pie. El identificador y el color de la línea salen de
`identificadoresDeCable()` y de la señal: mismas fuentes que la tabla de
cables. El conmutador "solo puertos con cable / todos" va por dirección
(`?puertos=todos`), y los repetidos se etiquetan `Pantalla 1`, `Pantalla 2`
sin renumeración. Queda para después: descargarlo como fichero (hoy se
imprime con la página) y afinar el enrutado cuando haya salas con muchos
cruces.

Lo planificado era:

El esquema de bloques que XTEN-AV llama xDraw, hecho con los datos que ya
existen: cada equipo un bloque con sus puertos serigrafiados, cada conexión una
línea con su identificador de cable (`HD-1000`) y sus metros. SVG generado en
el servidor, sin JavaScript, como el croquis.

- Lógica pura en `src/lib/diagrama.ts`: de equipos + puertos + conexiones sale
  una escena (bloques, filas de puertos, líneas con ruta ortogonal). Con
  pruebas, sin base de datos.
- Pintado en `src/components/diagrama/`.
- Se descarga como entregable junto a la tabla de cables y el croquis.

No se dibuja aparte: es presentación de datos existentes, misma regla que el
croquis.

### R4 · Editor del plano en planta — HECHO (10-8-2026)

La pestaña `Diagrama` de la ficha de sala. Plan completo en
`docs/11-plan-editor-diagrama-sala.md`.

Implementado: `src/lib/plano-editor.ts` (lógica pura, con pruebas) y
`src/components/plano-editor/` (barra, lienzo, lista de objetos, cuatro
inspectores, panel inferior móvil). El lienzo pinta la misma `GeometriaPlano`
que el croquis de Resumen y solo añade rejilla debajo y zonas de agarre
encima; el zoom y la panorámica mueven el `viewBox` del propio SVG. Se guarda
con `guardarDiagramaSala` (`src/app/acciones-diagrama.ts`), una transacción
con `diagrama_version` optimista y guardas de pertenencia y obra cerrada.

Decisiones que fija esta pieza y no conviene reabrir sin motivo:

- Sala rectangular. Paredes libres o varios recintos obligarían a rediseñar
  `calculo-cable.ts` y el perímetro de sala.
- Elementos del MVP: sala, mesa, equipos, rosetas y sillas derivadas del
  aforo. Puertas, ventanas y columnas quedan para después, en tablas
  separadas (`elementos_sala`), nunca metidas entre los equipos.
- Una línea con `cantidad > 1` es un ancla y una marca `×N`. Para colocar las
  unidades por separado hay que separarlas en líneas: las conexiones apuntan a
  la fila agregada y repartirlas automáticamente asignaría cables a la unidad
  equivocada.
- El ancla cae dentro del rectángulo; el símbolo puede sobresalir. Una
  pantalla va a ras de pared.
- No se guarda imagen, ni SVG final, ni JSON de lienzo.

Queda para después: tamaño físico por artículo, alineación y distribución,
editor visual propio para plantillas, historial de versiones y exportación del
plano a PDF.

### R5 · Mobiliario, altas y rotación — HECHO (10-8-2026)

Amplía R4 con lo que pedía `docs/12-diagrama-mobilario-equipamiento`. Una sala
se prepara desde cero o desde una plantilla, y dentro del editor se añade
mobiliario y equipamiento buscándolo, se arrastra al plano y se gira.

Lo que fija esta pieza:

- El mobiliario NO entra en `articulos`. Vive en `catalogo_mobiliario` con
  `data/mobiliario.csv` como fuente editable, y las instancias en
  `sala_mobiliario`. Meter una silla en el catálogo AV la haría aparecer entre
  los cables y los consumibles de cada obra.
- Una silla física es una fila. Ocho sillas son ocho instancias arrastrables y
  rotables: el `cantidad ×N` vale para cuatro micrófonos que cuelgan del mismo
  punto, no para sillas que están en ocho sitios distintos.
- `salas.sillas_modo` garantiza una sola fuente de sillas. Las derivadas del
  aforo se materializan con la MISMA `sillasAlrededor()` del croquis, no con
  una geometría paralela, y a partir de ahí manda la fila.
- Rotación en mesa, mobiliario y equipamiento, con un solo `ControlRotacion`.
  Sustituye la decisión de R4 de no rotar equipos.
- El origen del plano se pregunta una vez (`salas.diagrama_iniciado_en`).
  Aplicar una plantilla distinta sobre una sala con equipos se bloquea; no hay
  merge, porque equivocarse borra tiradas medidas.
- De un alta solo se cree el identificador: el servidor relee el artículo y
  exige activo y `tipo = 'equipo'`.

Queda para después: mobiliario con más referencias (atriles, armarios) cuando
el departamento las mida, y arrastre múltiple.

### R3 · Diagrama de conexiones editable

Encima de R2, y **distinto de R4**: R4 edita el plano en planta (dónde está
cada equipo); R3 editaría el esquema de conexiones (qué puerto va a qué
puerto). Arrastrar bloques, trazar una línea de puerto a puerto y que eso dé
de alta la conexión. Es la pieza con estado interactivo más pesado. No se
empieza hasta que R2 esté en uso: puede que con el esquema en lectura y el
alta por formulario baste.

Nota tras R4: el editor del plano se hizo con SVG propio y sin librería de
diagramación, y cubre el MVP de sobra. Antes de meter React Flow para R3 hay
que demostrar que el SVG existente no llega, no suponerlo.

### P1 · Personas y ciclo de vida de la sala — HECHO 7-8-2026

Ejecutado con una revisión: los hitos de obra (`inicio`, `cierre`) viven en
`hitos_proyecto` y los de sala (`instalacion`, `entrega`) en `hitos_sala`,
porque el mismo día entró la jerarquía Proyecto → Localización → Sala y el
inicio resultó ser un hecho del proyecto, no de cada sala. El detalle y las
diferencias con el plan original están en `docs/08-plan-p1-tecnicos.md`.
Lo que sigue es el texto original.

Quién hace cada cosa y cuándo. Sin contraseñas individuales: se elige el nombre
de una lista al registrar el hecho. La puerta sigue siendo la clave de
departamento; `rol_usuario` ya estaba previsto en el esquema.

Tabla `tecnicos` (nombre, roles) con los datos reales del departamento:

| Rol | Técnicos |
|---|---|
| Inicio de proyecto | Daniel, Elvin, Carlos, Diego |
| Recepción de equipamiento | Roberto, Nacho, Miguel, Marcos |
| Instalación | Miguel, Diego |

Un técnico puede tener varios roles (Miguel y Diego los tienen), así que roles
es una relación, no una columna.

Hitos que se registran, cada uno con técnico y fecha:

1. **Inicio del proyecto de sala**: quién la da de alta.
2. **Recepción**: la recepción de pedido ya existe; gana quién recibe.
3. **Instalación**: quién instala y cuándo se da por instalada.
4. **Entrega de la sala**: cierre formal, apoyado en la revisión derivada de
   `src/lib/revision.ts` (no se puede entregar lo que el semáforo dice que no
   está montable... salvo decisión consciente, que también se registra).

El check-in de visita previa (M4) se apoya en esta misma lista de técnicos.

### M1 · Geometría de la sala

La sala deja de ser tres números y pasa a tener mesa y posiciones.

- `salas` y `plantillas_sala`: `mesa_largo_m`, `mesa_ancho_m`, `mesa_alto_cm`,
  `mesa_x_m`, `mesa_y_m`.
- La altura de un equipo ya tenía sitio: `sala_equipos.z_m`. La TV a 74 cm del
  suelo es un dato de obra que hoy se pierde y a partir de aquí se guarda.
- Lógica pura en `src/lib/croquis.ts`: de sala + equipos + conexiones sale una
  escena de dibujo (paredes, mesa, sillas, equipos, cotas, tiradas). No toca la
  base de datos, y tiene pruebas.

### M2 · Croquis de sala

`src/components/croquis/` dibuja esa escena en SVG, en el servidor y sin
JavaScript. Es el plano de la Sala de Batería 006 hecho con datos: si la sala
mide 5,20 m, el dibujo mide 5,20 m.

Se descarga como entregable de obra junto a la tabla de cables.

### M3 · Revisión de montaje

Semáforo derivado: ¿está esta sala lista para montarse? Medidas, croquis,
equipamiento, conexiones con puerto, cable calculado, material reservado,
material que falta, carga preparada.

**Sin tablas nuevas.** Es lógica pura (`src/lib/revision.ts`) sobre datos que ya
existen. Un estado que se teclea a mano miente; uno que se deriva, no.

### M4 · Check-in de sala

Lo que sí es manual: ir a la sala antes de montar y confirmar lo que hay.
Medidas reales contra las de la plantilla, rosetas de red, equipos que ya
estaban, obra civil, corriente. Se marca desde el móvil, de pie en la sala.

Tablas `revisiones` y `revision_puntos`. Una revisión abierta genera sus puntos
desde una plantilla de puntos y se van marcando. Quién revisa sale de la tabla
`tecnicos` de P1.

### M5 · Plantilla de telepresencia para 8

La sala más repetida del inventario —144 de 390— es una sala de telepresencia
para 8 personas: videoconferencia más pantalla. La Sala de Batería 006 es esa
sala, medida:

| | |
|---|---|
| Sala | 4,70 × 2,50 m |
| Mesa | 2,40 × 1,21 m, a 73 cm del suelo |
| Aforo | 8 (3 + 3 + 1 + 1) |
| TV | Samsung QB65R-B, 145 × 83 cm, a 74 cm del suelo |
| Videoconferencia | Cisco Spark, panel y micro en mesa |
| Caja de conexiones | En mesa, a 2,40 m de la pared de la TV |
| Tirada de pared a caja | Recta, más unos 2 m de subidas |
| HDMI a mesa | Entre 7 y 10 m; sube uno solo |
| RJ45 del panel Cisco | 10 m, y da corriente al panel |

Estas medidas entran en la plantilla, así que crear las 144 salas es un alta en
serie con la geometría ya puesta.

### Pendiente de tu criterio: la fórmula infraestima

Ahora que la sala nace montada se puede comparar el cálculo con lo que el
departamento pide de verdad. En la Sala de Batería 006:

| Tirada | Calculado | Lo que pides |
|---|---|---|
| HDMI de la caja al Spark | 6,67 m | entre 7 y 10 m |
| RJ45 al panel Cisco | 6,57 m | 10 m |

El recorrido está bien: 1,67 de subida + 2,35 en horizontal + 1,85 de bajada =
5,87 m, más 0,80 de holgura. Lo que falta es el margen de realidad: rodeos,
registros, y lo que tú escribes como "+2 m aprox. de subidas".

**No se toca `calculo-cable.ts` sin tu palabra.** Es lógica congelada con
pruebas, y las holguras se editan en `/parametros` sin tocar código. Las
opciones son subir la holgura de la caja de conexiones, subir el margen general,
o dejarlo y aceptar que el número es un mínimo. Es criterio tuyo, no mío.

## Aplazado

**Los precios.** Hay un presupuesto de Cisco de marzo de 2024 sin cargar
(`QA152721337VJ`, en dólares, con la mayoría de líneas a 0,00 porque son
componentes incluidos en un kit). No se carga en esta iteración: no es lo que
frena las instalaciones. Cuando se retome, el criterio está en
`docs/05-precios.md` y hay dos cosas que decidir antes de tocar nada:

1. Si un presupuesto no vinculante en dólares entra como `final` o como
   `orientativo`.
2. Que las líneas a 0,00 son composición de kit, no precio, y meterlas como
   precio cero rompe la lista de material.

## Orden

1. **R1a**: cimientos del rediseño. Cambia el esqueleto de toda la aplicación.
2. **R1b y R1c**: salas y ficha de sala con el aspecto nuevo, que es donde se
   vive.
3. **R2**: diagrama de conexiones en lectura. Es el entregable que falta.
4. **P1**: técnicos, hitos y entrega de sala.
5. **M1 + M5 juntos**: la geometría no sirve de nada sin una plantilla que la
   traiga. Luego **M2** (croquis), que necesita M1.
6. **R1d–R1f**: resto de pantallas al aspecto nuevo.
7. **M3 y M4**, independientes entre sí.
8. **R3** solo si el esquema de conexiones en lectura se queda corto. R4, el
   editor del plano en planta, ya está hecho (10-8-2026).
9. Verificación de recorrido completo: crear una sala de telepresencia desde la
   plantilla, recibir material, cargarla, instalarla y entregarla.

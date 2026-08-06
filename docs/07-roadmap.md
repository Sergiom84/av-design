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
3. **R1c · Ficha de sala**: la pantalla más usada. Medidas, equipamiento,
   cable, tabla de cables, en tarjetas.
4. **R1d · Plantillas y catálogo.**
5. **R1e · Almacén, compras y carga**: incluye la vista móvil de carga, que se
   usa de pie.
6. **R1f · Parámetros y restos.**

Cada paso se verifica en escritorio y móvil antes de pasar al siguiente.

### R2 · Diagrama de conexiones, solo lectura

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

### R3 · Diagrama editable

Encima de R2: arrastrar bloques, trazar una línea de puerto a puerto y que eso
dé de alta la conexión. Requiere librería de diagramas en cliente (React Flow o
equivalente) y es la primera pieza con estado interactivo pesado. No se empieza
hasta que R2 esté en uso: puede que con el diagrama en lectura y el alta por
formulario baste.

### P1 · Personas y ciclo de vida de la sala

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
8. **R3** solo si el diagrama en lectura se queda corto.
9. Verificación de recorrido completo: crear una sala de telepresencia desde la
   plantilla, recibir material, cargarla, instalarla y entregarla.

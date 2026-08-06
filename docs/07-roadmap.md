# Roadmap · qué queda y en qué orden

Estado a 6 de agosto de 2026. Este documento manda sobre `docs/05-continuar.md`,
que quedó viejo: describía la Fase 1 como recién terminada y la Fase 2 como
pendiente, y las dos están hechas y en producción.

## Hecho

| | |
|---|---|
| Fase 1 | Catálogo, plantillas, salas con medidas, cálculo de cable, lista de material |
| Fase 2 | Almacén, reservas, compras, carga de obra, cierre con bajas |
| Fase 3 · datos | Puertos por artículo, conexiones puerto a puerto, tabla de cables |
| Despliegue | Neon + Render, `av-design.onrender.com`, autodeploy desde `main` |

## Lo que queda, por módulos

Cada módulo es una pieza suelta: su lógica pura con pruebas, sus componentes en
su carpeta y su ruta. Se enchufan a la ficha de sala, no la reescriben. Tocar
uno no puede romper otro.

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
desde una plantilla de puntos y se van marcando.

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

1. M1 y M5 juntos: la geometría no sirve de nada sin una plantilla que la traiga.
2. M2, que necesita M1.
3. M3 y M4, independientes entre sí.
4. Verificación: arrancar, crear una sala de telepresencia desde la plantilla y
   recorrerla entera.

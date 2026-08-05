# Datos reales del departamento — extracción y conclusiones

Fecha: 2026-08-05
Fuentes: `docs/INVENTARIO GENERAL DE SALAS 2026.xlsx` (20 hojas, 7.181 líneas, todas las sedes) y `docs/Salas_Sede.xlsx` (hoja "Ciudad Sede", 1.910 líneas).
Salidas generadas: `data/catalogo-equipos.csv` y `data/plantillas-salas.csv`.

---

## 1. Qué hay en el inventario

| | |
|---|---|
| Sedes / hojas | 20 (Ciudad Sede, Moraleja Campus, Tres Cantos BBVA y Alfatech, Tablas I-II-III, Recoletos, Al Factory, zonas Noroeste/Norte/Noreste/Este/Sur/Canarias, Oficinas, Volantes, Almacén) |
| Unidades con marca y modelo | 5.685 |
| Referencias distintas | 1.071 |
| Salas únicas solo en Ciudad Sede | 390 |

Campos por línea: código, edificio, nivel, sala, tamaño (aforo), tipología, tratamiento, nombre, equipo, info+, marca, modelo, nº serie, etiqueta, IP/máscara/gateway, MAC, toma de red, proveedor, firmware.

Es un inventario **muy bueno** de equipo instalado. Sirve directamente como base del catálogo y de las plantillas.

---

## 2. Tipologías de sala — vuestras plantillas reales

Ciudad Sede, 390 salas:

| Tipología | Salas | Aforo típico |
|---|---|---|
| SALA TP | 195 | 8 (144 salas), 4 (32) |
| ULTRALIGERA QR | 92 | 4 (55), 6 (22), 8 (15) |
| FIJA TP | 32 | 10 (22), 14 (8) |
| LIGERA | 26 | 3 |
| TOTEM | 24 | — |
| VIP | 13 | 16, 24, 48… (cada una distinta) |
| VIDEOWALL | 4 | — |

### Composición estándar (las 5 plantillas que cubren casi todo)

**SALA TP · aforo 8 — 144 salas.** La plantilla más repetida con diferencia.
- 1× Pantalla **Samsung QB65R-B** (65")
- 1× Videoconferencia **Cisco Spark Room Kit**
- 1× Panel táctil **Cisco Room Navigator**
- 1× Caja de conexiones **AMX / Bachmann TopFrame** (en el 92 % de los casos)
- 1× Micrófono **Cisco Table Microphone mini jack v1** (en el 70 %)

**SALA TP · aforo 4 — 32 salas.** Igual pero con **Samsung QB55R-B** (55").

**ULTRALIGERA QR · aforo 4 — 55 salas.** Solo 1× Pantalla **Samsung QB55R-B**.
Con aforo 6 u 8: pantalla **QB65R-B** + **RoomWizard II** de reserva de sala.

**FIJA TP · aforo 10 — 22 salas.** 2× Pantalla QB65R-B, 1× **Cisco Webex Room Bar Pro**, 1× Room Navigator, 1× micrófono, caja de conexiones.
Con aforo 14: 2 pantallas, 2 micrófonos, **Webex Room EQ QuadCam** y **Cisco Quad Camera**.

**LIGERA · aforo 3 — 15 salas.** 1× Pantalla **Samsung QM32R-B** + 1× Dock **Targus DOCK182** (+ webcam Jabra PanaCast en el 40 %).

**VIP y VIDEOWALL — a medida.** Ninguna se repite. Extron DTP HDMI 4K 230 TX/RX, Crestron HD-TXU/RXU, Bose FreeSpace DS100F, Bosch Concentrus/DCN-CCU2, Sony SRG-X400, Epson EB-L630U, Biamp TesiraFORTÉ, Shure SLXD… Estas no se plantillizan: se diseñan una a una.

El detalle completo (17 plantillas con cantidades medias y modelo dominante) está en `data/plantillas-salas.csv`.

---

## 3. Equipamiento de referencia que has pedido probar

| | Presente en el inventario |
|---|---|
| **Cisco** | 677 unidades solo en Ciudad Sede. Room Navigator (347), Spark Room Kit (285), Table Microphone v1/v2 (282), Touch 10 (58), Webex Room Bar Pro (71), Room EQ / Room EQ QuadCam, Quad Camera, Board Pro 55, CS-Desk-K9, Room Bar BYOD |
| **Samsung QB 55 / 65"** | QB65R-B (264), QB65R (205), QB55R (71), QB55R-B (59), y variantes QB55B/QB55C/QB65B/QB65C. Confirmado como vuestro estándar de pantalla |
| **Q-SYS / QSC** | Sí, pero solo en salas VIP: Core 8 Flex, Core 24F, Core 110f, etapas CX-Q 2K4. En Moraleja Campus, Tres Cantos Alfatech, Tablas III y Recoletos |
| **Bosch** | Concentrus (DCN-CONCS, 48 ud.), DCN-DISDCS-L, DCN-CCU2/CCUB, DCN-IDESK-L (pupitres de traducción), LBB4144/00, y DICENTIS DCNM-WD inalámbrico con cargadores DCNM-WCH05 |

**Duda:** no encuentro nada llamado "Quinta" en Bosch. Asumo que te refieres al sistema de congresos/debate Bosch (Concentrus + DCN/DICENTIS). Si es otra cosa, dímelo.

---

## 4. Reglas de cable que me has dado

**Rutas posibles:** falso techo · canaleta · suelo técnico.

**Holgura por extremo:**
- Extremo que va a **pantalla**: 20–50 cm
- Extremo que va a **proyector**: ~10 cm

**Reserva de canalización:** se dimensiona para que quepan **3 cables** — el previsto más un RJ45 y un HDMI de reserva. Habitualmente, no siempre.

Modelo de cálculo que implementaré:

```
longitud_cable = recorrido_por_la_ruta + holgura_origen + holgura_destino
```

con `recorrido_por_la_ruta` calculado por el camino físico real (horizontal por suelo/techo + subidas y bajadas), no en línea recta, y las holguras parametrizables por tipo de destino. La reserva de 3 cables se aplica al **dimensionado de canaleta/tubo**, no a la longitud.

**Falta por definir:** holgura en el extremo del rack o de la caja de conexiones, y si quieres además un margen porcentual de seguridad sobre el total (tipo +5 %) para cortes y errores.

---

## 5. Roles del departamento

| Rol | Qué hace | Qué necesita en la app |
|---|---|---|
| **TEI** | Revisa el diseño de la sala y propone la compra de material. Decide si la instalación la hace el departamento o se contrata a una empresa externa | Ver el diseño, generar la lista de material y la propuesta de compra, marcar la instalación como interna o externa |
| **AV** | Da el visto bueno a la instalación y propone mejoras | Aprobar/rechazar con comentarios, dejar propuestas de mejora sobre un diseño |
| **Diego** | Detalles, mejores propuestas, configuración de equipos y audio, y puede llegar a instalar | Acceso completo al diseño y al material, ficha de configuración por equipo (IP, MAC, firmware, toma de red), y vista de campo para instalar |

Esto encaja con un **flujo de aprobación**: Diseño → revisión TEI (con decisión interno/externo) → visto bueno AV → ejecución. Lo modelo así salvo que me digas otra cosa.

---

## 6. Los tres agujeros que confirma el inventario

1. **No hay ni un solo cable en el inventario.** Ni metros, ni tipos, ni conectores, ni canaleta, ni consumibles. Todo lo que se compra de cable hoy está fuera de cualquier registro. Es literalmente el origen del problema.

2. **"TAMAÑO" es el aforo en personas, no las medidas.** No hay largo, ancho, alto, ni altura de falso techo, ni distancia al rack en ningún sitio. **Sin esos datos no se puede calcular un metro de cable.** Es el dato que hay que empezar a capturar.

3. **La hoja "Almacén" no es un stock.** Son 104 unidades sueltas listadas por número de serie, con anotaciones libres ("ROTO", "POSIBLEMENTE NO PUEDA REPARARSE", "Shure ha indicado que se guarde 2 meses"), y una columna "RETIRADO DE" con la sala de origen. Es un registro de retiradas, no un inventario con cantidades, ubicación y disponibilidad.

Además, dato menor pero relevante: hay **240 categorías de equipo distintas** para 1.071 referencias, porque conviven variantes del mismo nombre ("TRANSMISOR VIDEO" y "TRANSMISOR VÍDEO", "ROOM NAVIGATOR" y "CISCO ROOM NAVIGATOR"). Al cargar el catálogo en la app hay que normalizarlo una vez; después el desplegable evita que vuelva a pasar.

---

## 7. Ficheros generados

- **`data/catalogo-equipos.csv`** — 1.071 referencias con categoría, marca, modelo, unidades instaladas y en cuántas sedes aparece. Ordenado por unidades. Es la semilla del catálogo de equipos.
- **`data/plantillas-salas.csv`** — 17 plantillas (tipología + aforo) con la cantidad media de cada categoría de equipo y el modelo dominante. Es la semilla de las plantillas de sala.

Ambos en `;` y UTF-8 con BOM, se abren directamente en Excel.

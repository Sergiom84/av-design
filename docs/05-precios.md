# Precios — primera carga y lo que falta

Fecha: 2026-08-05
Fuentes: diez presupuestos de proveedor y dos tandas de precios de referencia,
aportados por Sergio.
Salidas: `data/precios.csv`, `data/precios-orientativos.csv`, tabla `precios`,
`articulos.coste`.

---

## 1. Qué se ha cargado

| | |
|---|---|
| Presupuestos | 10 |
| Líneas de precio | 49 |
| Referencias con precio | 41 |
| Enlazadas con el catálogo que ya existía | 9 |
| Referencias nuevas creadas | 31 |

Todos los precios son **sin IVA** y son **coste de compra**, no PVP.

Los subtotales de los diez presupuestos cuadran línea a línea con la
transcripción, así que las cifras son fiables. Lo que no viene en los
documentos es **quién ofertó cada uno**: la columna `proveedor` de
`data/precios.csv` está vacía y hay que rellenarla.

## 2. Por qué hay una tabla de precios y no un solo coste

La misma referencia aparece a precios muy distintos:

| Referencia | Precios ofertados | Diferencia |
|---|---|---|
| Extron HDMI Ultra/9 (26-663-09) | 77,89 € · 78,82 € · 93,00 € | +19 % |
| Extron HDMI Ultra/12 (26-663-12) | 88,42 € · 89,41 € · 105,00 € | +19 % |
| Extron HDMI Ultra/15 (26-663-15) | 96,84 € · 98,82 € · 115,00 € | +19 % |
| Nanocable 10.15.1201 | 7,00 € · 9,53 € · 14,12 € | +102 % |

Según Sergio, la causa es que vienen de proveedores distintos o de facturas
antiguas. Guardar un único coste perdería justo la información que hace falta
para la lista de compra de la Fase 2, así que:

- Cada línea de cada presupuesto se guarda en la tabla **`precios`**, con su
  proveedor, su fecha, su referencia de fabricante y la cantidad ofertada.
- **`articulos.coste`** se queda con el precio más bajo **que siga vigente**.
- La vigencia no está en el código: es el parámetro `vigencia_precio_meses`
  (18 meses por defecto) y se edita en `/parametros`. Un presupuesto sin fecha
  cuenta siempre; uno fechado deja de contar al caducar.

Las bobinas se guardan por metro: la de Gotham GAC-2 de 100 m a 210,90 € entra
como 2,109 €/m, y la Cordial CMK 222 de 100 m a 83,63 € como 0,8363 €/m. Es lo
que necesita el cálculo de cable.

## 3. Ajustes hechos, para revisar a mano

El presupuesto escribe la referencia comercial completa y el catálogo tiene el
modelo como lo nombra el departamento. En estos casos el precio se ha colgado
de la referencia que ya existía y la del proveedor se ha guardado aparte, en
`articulos.referencia_fabricante`. **Ninguno se ha unificado por parecido.**

| Catálogo | Referencia del presupuesto | Qué cambia |
|---|---|---|
| NETGEAR GS305P | GS305P-200PES | Sufijo de embalaje europeo |
| SHURE SLXD4D | SLXD4DE H56 | Sufijo E y banda de frecuencia |
| SHURE SLXD2/SM58 | SLXD2/SM58 H56 | Banda de frecuencia |
| SHURE SLXD1 | SLXD1 H56 | Banda de frecuencia |
| SHURE WL185 | WL185MB/C-TQG | Referencia completa con conector |
| SHURE SBC203 | SBC203-E | Sufijo de enchufe europeo |

Si para el almacén la banda de frecuencia sí distingue producto (un H56 no
sirve donde va otro), hay que separarlos. Es una decisión de departamento.

Otras cosas que no me cuadran y he dejado marcadas en `data/precios.csv`:

- **Nanocable 10.15.8005 (5 m) a 15,53 € y 10.15.3807 (7 m) a 12,36 €.** El
  corto sale más caro que el largo. Probablemente sean series distintas.
- **Cordial CTM 1,5 FM-BK a 31,14 € y CTM 20 FM-BK a 25,10 €.** Mismo caso: el
  latiguillo de 1,5 m cuesta más que el de 20 m.
- **Cordial CTM 20 FM-BK.** El concepto dice 15 m pero la referencia CTM 20 son
  20 m. He puesto 20 m.
- **Kramer C-HM/HM-35.** El concepto dice 10 m; la referencia -35 son 35 ft,
  que son 10,7 m. He puesto 10,7 m.
- **Audibax.** El multicore 10116238 (104,00 €) y el cajetín de escenario
  12/4 de 15 m (158,81 €) pueden ser el mismo producto de dos proveedores. Los
  he dejado como dos referencias distintas por no inventar.
- El capítulo "unidad móvil territorio Este (Valencia)" es idéntico al de
  A Coruña, mismos precios. No se ha duplicado.
- Una línea de 26,00 € de portes no es material y no ha entrado en el catálogo.

## 3 bis. Precios finales y orientativos

Cada precio tiene un `origen`:

- **`final`** — oferta escrita de un proveedor. Fuente: `data/precios.csv`.
  49 líneas, en euros, sin IVA.
- **`orientativo`** — precio de referencia de mercado, buscado por internet
  mientras no hay oferta. Fuente: `data/precios-orientativos.csv`. 39 líneas
  en dólares: 11 de equipo y 28 de cable y consumibles.

`articulos.coste` se calcula así, y siempre en euros:

1. La **mejor oferta final vigente**. Si existe, manda.
2. Si no hay ninguna, la **mejor orientativa**, convertida a euros, y el
   artículo queda marcado con `coste_orientativo`.

Con eso el proyecto no se para: hoy hay 40 referencias con coste final y 39 con
coste orientativo, y las 30 de cable y consumibles genéricos ya tienen precio
menos dos. Pero nadie puede pedir material con un número orientativo sin verlo:
sale marcado en el catálogo, en la ficha y en el panel de inicio.

**El tipo de cambio no está cableado.** Es el parámetro `tipo_cambio_usd_eur`
(0,867 EUR por USD, agosto de 2026) y se edita en `/parametros`. La tabla de la
ficha convierte al vuelo, así que cambiarlo no obliga a volver a sembrar; el
coste del catálogo sí se recalcula con `npm run seed && npm run db:seed`.

Los orientativos vienen casi siempre como rango. Se carga **el extremo bajo** y
el rango completo queda en las notas, visible en la ficha. Algunos son
estimaciones de la propia fuente, no precios medidos: la canaleta de 40×25 y la
de 60×40, y el cable de altavoz de 2×1,5. Están marcados como tales.

Un precio orientativo nunca da de alta una referencia nueva en el catálogo. Si
no encuentra su artículo, `npm run seed` lo avisa y no lo carga.

**Se puede cambiar desde la aplicación.** La ficha de cada artículo tiene el
coste editable y una casilla "Orientativo" junto a él: marcada, el precio es una
referencia; sin marcar, es el precio real de compra.

Cada línea de `precios` lleva además una `fuente`. Las que vienen de los CSV
(`fuente = 'csv'`) las regenera entera la siembra, porque hay que poder
renombrar un presupuesto o quitar una línea sin dejar filas huérfanas. Las que
se escriban desde la aplicación (`fuente = 'app'`) no las toca nunca. Está
probado: una línea de app sobrevive a `npm run db:seed` y sigue contando para
el coste.

## 3 ter. El presupuesto de Cisco QA152721337VJ

Fecha del documento: 04-03-2024. Comercial: Moises Navarro, Cisco Systems.
Nueve páginas, 264 líneas, todo en dólares. Fuente editable:
`data/precios-cisco.csv`. Total del documento 296.226,12 USD, que cuadra con la
suma de los importes extendidos línea a línea, así que la transcripción es
completa.

### Entra como orientativo, y en dólares

Por tres motivos, y ninguno es discutible:

1. El propio documento dice que es una estimación para planificar y **no una
   oferta vinculante** de Cisco.
2. Está en **USD**, no en lo que paga el departamento.
3. Es de **marzo de 2024**.

Un precio orientativo presupuesta pero no permite pedir, que es exactamente lo
que corresponde aquí. La moneda se guarda como `USD` y la ficha del artículo la
convierte con el parámetro `tipo_cambio_usd_eur`.

**Efecto real sobre el coste del catálogo: ninguno, y es lo correcto.** Con
`vigencia_precio_meses` en 18, un presupuesto de marzo de 2024 ya está caducado,
así que estas diez líneas se ven en la ficha de cada artículo pero no fijan
`articulos.coste`. Lo único que sí han rellenado es la
`referencia_fabricante` de los artículos que no tenían ninguna: ahora nueve
artículos CISCO llevan escrito su part number.

### Dos trampas del documento

- **La columna que salta a la vista es "Extended Net Price", que es cantidad ×
  precio unitario.** Lo que se carga es el `Unit Net Price`. De las 47 líneas
  con precio solo una tiene cantidad distinta de 1: la 8.8, `CAB-ETH-1.5M-GR`,
  cantidad 2, unitario 11,68 y extendido 23,36. Cargar 23,36 habría metido un
  latiguillo al doble de su precio. Esa línea no se carga por otro motivo (no
  hay artículo), pero el criterio vale para cualquier ampliación.
- **La mayoría de las líneas están a 0,00 porque son composición de kit**, no
  precio: el cable, la fuente y el mando que vienen dentro de un Room Kit. De
  264 líneas solo 47 llevan importe. Un cero no es un precio y no entra.

### Lo que se ha casado

Diez líneas, 44.700,89 USD sumados. El catálogo no usa part numbers, así que
cada uno se ha casado a mano contra marca y modelo, y **solo donde no hay duda
posible**:

| Part number | Artículo del catálogo | USD |
|---|---|---|
| CS-KITPRO-K9 | CISCO ROOM KIT PRO | 11.641,33 |
| CS-BRD55P-K9 | CISCO WEBEX BOARD PRO 55 | 8.696,52 |
| CS-KITPLUS-K9 | CISCO ROOM KIT PLUS | 7.671,07 |
| CS-KIT-K9 | CISCO CS-KIT-K9 | 4.330,07 |
| CS-CAM-PTZ4K= | CISCO PTZ 4K | 3.465,15 |
| CTS-CAM-P60= | CISCO CTS-CAM-P60 | 3.465,15 |
| CS-KIT-MINI-K9 | CISCO MINI SPARK ROOM KIT | 2.179,92 |
| CS-DESK-K9 | CISCO CS-DESK-K9 | 1.816,05 |
| CS-DESKMINI-K9 | CISCO CS-DESKMINI-K9 | 1.220,62 |
| CS-MIC-TABLE-J | CISCO TABLE MICROPHONE MINI JACK (V1) | 215,01 |

Cuatro de ellos (`CS-KIT-K9`, `CS-DESK-K9`, `CS-DESKMINI-K9`, `CTS-CAM-P60`) el
inventario ya los tenía apuntados con el propio part number como modelo, así que
el casado es literal. `CS-MIC-TABLE-J` ya estaba colgado de la V1 en
`data/precios-orientativos.csv`: se respeta esa decisión, no se inventa otra.

### Lo que se ha dejado fuera a propósito

De los 42 part numbers con precio, 32 no se cargan. La mayoría porque el
producto no está en el catálogo del departamento (Room Panorama 85, Room 70
Panorama, Room Kit EQX, Desk Pro, Board Pro 75, Room Phone, Desk Camera) o
porque son accesorios y latiguillos que el catálogo no lista (soportes de pared,
tapa de cámara, lápiz, brackets, cable ethernet y HDMI de Cisco).

Estas ocho sí tienen candidato, pero **más de uno, y confundirlos sería peor que
dejarlas sin precio**:

| Part number | Descripción | Candidatos | Por qué no se casa |
|---|---|---|---|
| CS-BARPRO-K9 | Cisco Room Bar Pro, First Light · 5.123,97 | ROOM BAR PRO · WEBEX ROOM BAR PRO | Dos entradas del catálogo para el mismo nombre comercial |
| CS-BAR-T-K9 | Cisco Room Bar w/Navigator · 2.179,92 | ROOM BAR · WEBEX ROOM BAR · ROOM BAR BYOD | Tres candidatos, y el BYOD es otro producto |
| CS-KIT-EQ-K9 | Room Kit EQ, Quad Cam · 8.365,73 | ROOM KIT EQ · WEBEX ROOM EQ · WEBEX ROOM EQ QUADCAM · EQ | Cuatro formas de escribir lo que puede ser lo mismo o no |
| CS-KIT-EQ-4K-K9 | Room Kit EQ, PTZ4K Cam · 7.406,43 | ROOM KIT EQ | El del catálogo no dice qué cámara lleva, y la cámara es la diferencia |
| CS-T10-TS-K9= | Room Navigator, table stand · 584,01 | ROOM NAVIGATOR · WEBEX ROOM NAVIGATOR | Dos entradas, y además el de sobremesa y el de pared valen distinto |
| CS-BRD75P-K9 | Cisco Board Pro 75 · 14.518,46 | WEBEX BOARD PRO | El del catálogo no dice la pulgada |
| CS-MIC-ARRAY-T | Table Microphone Pro · 739,75 | TABLE MICROPHONE · CEILING MICROPHONE PRO | El "Pro" del catálogo es el de techo, no el de mesa |
| CS-MIC-TABLE-E | Table Microphone, euroblock · 215,01 | TABLE MICROPHONE | El catálogo no distingue euroblock de minijack salvo en las V1 y V2 |

Casi todas se resolverían con una sola decisión de departamento: **decidir si
ROOM BAR PRO y WEBEX ROOM BAR PRO son el mismo artículo, y lo mismo con ROOM
BAR, ROOM NAVIGATOR y las cuatro variantes de EQ.** Mientras el catálogo tenga
la misma cosa escrita de dos formas no se le puede colgar un precio a ninguna
de las dos sin equivocarse en la otra.

Dos observaciones más, para la misma revisión:

- **SPARK ROOM KIT PLUS** es probablemente ROOM KIT PLUS con la marca antigua.
  El precio se ha cargado solo en el segundo.
- **P60** (14 unidades) y **PRECISION 60** (3) son casi con seguridad la misma
  cámara que CTS-CAM-P60 (4), que es la que se ha quedado con el precio por
  llevar el part number escrito.

### Un detalle de transcripción, por si alguien vuelve al PDF

La extracción previa en CSV traía la referencia de la línea 1.0 escrita como
`CS-ROOM-PAΝΟ85-K9`, con una Ν y una Ο **griegas** en vez de las latinas. No es
visible a ojo y rompe cualquier búsqueda. Todas las referencias de
`data/precios-cisco.csv` se han sacado del PDF y son ASCII puro.

## 4. Lo que más conviene localizar ahora

Casi todo tiene ya un precio orientativo, así que el cálculo devuelve importes.
Lo que falta es **sustituirlos por oferta real de proveedor**, porque con un
orientativo no se puede pedir. Por orden de utilidad:

### Prioridad 1 — cable y consumibles a metros (30 referencias)

Es lo que la app aporta y lo que hoy no está en ningún registro. Hace falta
**precio por metro y precio de bobina**, con marca y referencia concretas. El
orientativo de mercado que hay cargado sirve para comparar si una oferta que
llegue está en precio.

| Categoría | Referencia |
|---|---|
| Cable de red | Cat6 U/UTP LSZH (bobina 305 m) |
| Cable de red | Cat6A F/UTP LSZH (bobina 305 m) — obligatorio para HDBaseT, Extron DTP y Dante |
| Cable de red | Latiguillo Cat6A F/UTP 0,5 / 1 / 2 / 3 / 5 / 10 m |
| Cable HDMI | HDMI 2.0 4K60 4:4:4 en 1 / 2 / 3 / 5 / 7,5 / 10 / 15 m |
| Cable HDMI | HDMI 2.1 48G en 1 / 2 / 3 / 5 m |
| Cable HDMI | HDMI fibra óptica activa en 10 / 15 / 20 / 30 / 50 m |
| Cable USB | USB-C 3.2 Gen2 100W en 1 / 2 / 3 m |
| Cable USB | USB-A a USB-B activo en 5 / 10 / 15 m |
| Cable de audio | Altavoz 2×2,5 mm² LSZH (bobina 100 m) |
| Cable de audio | Altavoz 2×1,5 mm² LSZH (bobina 100 m) |
| Cable de audio | Micrófono 2×0,22 apantallado — ya hay referencia: Cordial CMK 222, 0,84 €/m |
| Cable de audio | Latiguillo XLR 3 pines en 1 / 3 / 5 / 10 / 20 m |
| Cable de control | RS-232 apantallado (bobina 100 m) |
| Alimentación | Manguera 3×1,5 mm² LSZH (bobina 100 m) |
| Alimentación | Latiguillo Schuko-IEC C13 en 0,5 / 1 / 2 / 3 / 5 m |
| Canalización | Canaleta 25×16, 40×25 y 60×40 mm, con tapa, precio por metro |
| Canalización | Tubo corrugado libre de halógenos 20 y 25 mm, por metro |
| Conector | RJ45 Cat6 UTP y Cat6A FTP de campo |
| Conector | XLR macho y XLR hembra |
| Fijación | Brida de nylon 200 mm y grapa sujetacables |
| Fijación | Soporte VESA fijo 400×400 y VESA inclinable 600×400 |
| Mecanismo | Caja de superficie de 2 módulos |
| Mecanismo | Placa de pared HDMI + RJ45 empotrable |

### Prioridad 2 — el equipamiento de las 5 plantillas que cubren 268 salas

Sin esto no se puede valorar la lista de material de una sala tipo.

| Marca y modelo | Qué es | Unidades instaladas |
|---|---|---|
| CISCO ROOM NAVIGATOR | Panel táctil | 406 |
| SAMSUNG QB65R-B | Pantalla 65" | 266 |
| CISCO TABLE MICROPHONE MINI JACK (V1) | Micrófono de mesa | 227 |
| CISCO SPARK ROOM KIT | Videoconferencia | 285 |
| BACHMANN TOPFRAME | Caja de conexiones | 102 |
| SAMSUNG QB55R-B | Pantalla 55" | 60 |
| CISCO WEBEX ROOM BAR PRO | Videoconferencia | 71 |
| STEELCASE ROOMWIZARD II | Reserva de sala | 46 |
| SAMSUNG QM32R-B | Pantalla 32" | — |
| TARGUS DOCK182 | Dock | 22 |
| CISCO QUAD CAMERA | Cámara | 32 |

### Prioridad 3 — resto del catálogo por unidades instaladas

CISCO TOUCH 10 (100) · CRESTRON UC-SB1-CAM (90) · CRESTRON DM-NVX-E30 (87) ·
AVER VB342 (85) · GENELEC 4010AW (74) · CRESTRON DM-NVX-D30 (67) ·
EXTRON DTP HDMI 4K 230 RX (61) y TX (45) · SAMSUNG OM75D-W (58) ·
BOSCH CONCENTRUS (48) · LENOVO M920Q (108) · LOGITECH K400+ (36) ·
BOSE FREESPACE DS100F (32) · VOGELS T1844 (30).

Para cada referencia hace falta: **precio unitario sin IVA, proveedor, plazo de
entrega y fecha de la oferta**.

## 5. Cómo se cargan más precios

1. Se añaden filas a `data/precios.csv` (ofertas de proveedor), a
   `data/precios-orientativos.csv` (referencias de mercado) o a
   `data/precios-cisco.csv` (el presupuesto de Cisco). Todos tienen las mismas
   columnas y se declaran en `fuentesPrecio`, en `scripts/generar-seed.mjs`.
2. `npm run seed` regenera `db/seed.sql` e imprime el informe de qué se ha
   enlazado, qué es nuevo y qué queda por revisar.
3. `npm run db:seed` lo aplica.

`db/seed.sql` no se toca a mano.

# Flujo de creación de XTEN-AV — recorrido real creando diseños

Fecha: 2026-08-05
Fuente: navegación con la sesión de Sergio iniciada (cuenta Free, grupo SHL).
Continúa [01-analisis-xtenav.md](01-analisis-xtenav.md), que mapeó la navegación sin crear nada.
Aquí sí se ha creado: dos diseños completos, uno desde plantilla y otro desde cero, con
una conexión trazada a mano.

---

## 1. Qué se ha hecho y qué ha quedado creado en la cuenta

Todo lleva el prefijo `ZZ PRUEBA AVDESIGN` para que se localice y se borre.

| Objeto | Nombre exacto | Id / URL | Cómo se creó |
|---|---|---|---|
| Proyecto | `ZZ PRUEBA AVDESIGN` | P-103, `279595` | Formulario "Create Project" embebido en el modal de crear diseño |
| Diseño A | `ZZ PRUEBA AVDESIGN Sala TP aforo 8` | `/view-design/ELYqaQ7Zjqdnjk2` | Plantilla **Meeting Room** de la galería |
| Plano | `ZZ PRUEBA AVDESIGN Plano` | `floor_plan_id=118587` | "Create Floor Plan" dentro del diseño A (lienzo vacío, no se dibujó nada) |
| Diseño B | `ZZ PRUEBA AVDESIGN Desde cero` | `/view-design/qQK9b69LGQaEvYn` | Plantilla **Start from scratch** + 3 productos + 1 cable trazado a mano |

Para borrarlo: cada diseño tiene `Actions → Delete` en su página; el proyecto se borra desde
`/all-projects`. Nada más se ha tocado. El diseño A arrastra además un fichero
`MeetingRoom_FloorPlan.pdf` (08/12/2022) que **viene incluido en la plantilla**, no se subió.

Acciones que se rechazaron a propósito:

- **"Draw with AI"** en el diseño B: aparece el aviso *"Are you sure? Your current drawing
  will be regenerated. Please note, your existing drawing cannot be recovered."* Se canceló;
  habría destruido el cable trazado a mano, que es la prueba del punto 6.
- No se creó ninguna propuesta x.doc, ninguna plantilla propia, ninguna cuenta ni contacto,
  y no se descargó ningún fichero.

---

## 2. Flujo A — diseño desde plantilla, paso a paso

### A.1 `/design-templates`, pestaña **Gallery**

Rejilla de 4 columnas con miniatura del esquema real de cada plantilla. Filtros
`All | Audio Visual | Building Management System` y buscador "Search Templates ...".
Al pasar el ratón por encima de una tarjeta aparecen dos botones superpuestos:
**Preview** (arriba, gris) y **+ Use** (abajo, azul). La tarjeta *Start from scratch* es la
única sin miniatura y sin esos botones: es un cuadro con un "+" azul y se abre pulsando encima.

Plantillas de la galería, en el mismo orden que las muestra: Start from scratch, Access Control,
Auditorium/H.O.W, Classroom, DVR System, Fire System, Huddle Room, Meeting Room, NVR System,
Network Room, Paging System, Residential, Retail, Sound Masking, Sports Bar/Lounge, Teams Room,
Townhall, Videowall, Zoom Room.

Segunda pestaña **My Templates**, vacía en esta cuenta.

### A.2 Modal "DESIGN VIA X-DRAW"

Se abre al pulsar **+ Use**. Es un modal blanco, título en mayúsculas arriba a la izquierda,
aspa de cerrar arriba a la derecha, y el botón **Create Design** azul abajo a la derecha.
Dos columnas:

- Izquierda: `Name of Design *` (input ancho) y debajo `Choose a Project *` (selector) con el
  enlace **Create a New Project** a su derecha.
- Centro: `Location` (input, sin asterisco).
- Derecha: `Number of Designs` con `−  1  +` y `Start With Floor Plan` con un interruptor
  que arranca en **No** y pasa a **Yes**.

Cuando se entra por *Start from scratch* el modal muestra además `Type of Room`, que en el
resto de plantillas queda oculto porque lo impone la plantilla elegida.

### A.3 Crear el proyecto sin salir del modal

Al pulsar **Create a New Project** el enlace cambia a **Use Existing Project**, el selector de
proyecto se deshabilita y el modal crece con una sección **CREATE PROJECT** de cuatro campos
en dos filas: `Project Name *`, `Select Group *`, `Budget *` (con el prefijo fijo `USD`) y
`Stage Name *`. Un solo botón sigue siendo **Create Design**: crea proyecto y diseño de golpe.

### A.4 Qué pasa al pulsar Create Design

Con el interruptor de plano en **Yes**, redirige a `/upload-floor-plans/<id>`:

- Título **YOUR FLOOR PLANS**, texto *"Below is the list of all the floor plans you have uploaded."*
- Botones **Upload Floor Plan** y **Create Floor Plan** arriba a la derecha.
- Tabla `S.NO | FILE | UPLOADED ON | ACTIONS` con el PDF que trae la plantilla.
- Migas: `ZZ PRUEBA AVDESIGN / Zz Prueba Avdesign Sala Tp Aforo 8 / Upload Floor Plans`.

**Create Floor Plan** abre un mini-modal *"Specify name of floor plan"* con un único campo
`Floor Plan Name *` y los botones `Close` / `Create New`. Sin dimensiones, sin escala, sin nada.
Al confirmar abre el editor X-DRAW en una pestaña nueva con un lienzo vacío y la paleta
*Floorplans* en la izquierda. La escala se fija en el menú **Page Scale**: `Scale Unit`
(Points, Millimeters, Inches, Feet, Meters) y `Per point` para los ejes x e y, más los botones
`Scale by Area` y `Measure Distance`. Es la escala genérica de un editor de dibujo, no un dato
de sala: sirve para que el dibujo mida bien, no para que la aplicación sepa cuánto mide la sala.

Con el interruptor en **No** el flujo salta directo a la página del diseño.

### A.5 La página del diseño (`/view-design/<id>`)

Migas `PROYECTO / DISEÑO (Original Design) / Meeting Room`. Título grande con un botón
**Details** al lado, dos iconos de vista (rejilla / lista), y **Edit Design** azul.
A la derecha, panel **Actions**: `Save as X-DRAW Template`, `View Versions`, `Download ZIP`,
`Upload Attachments`, `Delete`. Arriba del todo, **+ Create Proposal**.

Bloque **Design Documents**: 12 tarjetas cuadradas de 4 en 4, cada una con icono, nombre y un
tick verde en la esquina si el documento tiene contenido. En el diseño A las 12 salen con tick:
Bill of Material, Line Schematics, Floor Plans, Automated Signal Flow Diagram, Automated Rack
Layout, Automated Cable Schedule, Automated Ceiling Speaker Layout, Scope of Work, Automated
Front Elevation Diagram, Plates & Panels, Submittals (Spec Sheets), Asset Management.
Debajo, bloque **Proposals** con una única tarjeta **Create New Proposal**.

**Details** despliega una ficha de seis datos en dos filas de tres:

| Design Name | No Of Rooms | Design Type |
| Created | Project | Destination |

Para el diseño A: `1` sala, tipo `Meeting Room`, creado por `Sergio Hernández Lara (Aug 05, 2026)`,
destino `ZZ PRUEBA Sede` (o sea, el campo `Location` del modal). **Edit Details** abre el modal
`EDIT DESIGN` con solo tres cosas: `Name of design`, `Destination` y `Number of Designs`. Nada más.

### A.6 Lo que trae la plantilla Meeting Room

BOM de 17 líneas y **$38.907,01** de total, agrupado en cuatro secciones VIDEO, AUDIO, CONTROL
y ACCESSORIES. Columnas: `S.NO · BRAND · MODEL · DESCRIPTION · QUANTITY · MSRP(USD) ·
UNIT PRICE(USD) · AMOUNT(USD)`. Botones `.XLS`, `.PDF`, `EDIT BOM`, `Save`; interruptores
`Round Off` y `Hide pricing in export`; selector `View All Products` y botón `Add Columns`.

Resumen del contenido: Crestron DMPS3-4K-350-C, 2× DM-RMC-4KZ-SCALER-C, UC-C100-T,
AM-3200-WF-I, IV-CAM-I12-B, 2× Samsung QB75R (VIDEO); 4× Crestron SAROS IC6T (AUDIO);
Crestron CEN-SWPOE-10 (CONTROL); USB-EXT-2 KIT, Shure MXA920W-S+USB-V, 2× Chief LTM1U,
2× C2G CG54171, Middle Atlantic CFR-14-20, West-Penn HDE006FB, **10× Belden 10GXS13 CAT6A**,
3× C2G CG54174 y **1× C2G 43083 cable de altavoz de 250 ft** (ACCESSORIES).

Ojo con esto, que matiza el análisis anterior: **el BOM de la plantilla sí incluye cable**,
pero como referencias de catálogo con cantidades fijas metidas a mano en la plantilla
(10 latiguillos, una bobina de 250 pies). No hay ningún cálculo detrás.

---

## 3. Flujo B — diseño desde cero, paso a paso

### B.1 El camino oficial (`/create-design`) está roto en esta cuenta

`/create-design` muestra una galería de fotos de sala con el título **"Select a Template to
make a Design"**: Zoom Rooms, Huddle Room, Classroom, Meeting Room, Townhall/Cafeteria,
Networked Rooms, Auditorium/H.O.W., Videowalls y más abajo Sports Bar, Retail, Residential…

Al pulsar una tarjeta se abre el modal **CREATE A DESIGN**, distinto del de la galería de
plantillas: `Name of design`, `Number of designs` (`− 1 +`) y, bajo el título **CHOOSE YOUR
METHOD**, tres tarjetas seleccionables separadas por la palabra "or":

| Método | Texto literal |
|---|---|
| **X-DRAW Editor** `New` (marcado por defecto) | "Search & add or create your own products and use X-DRAW tool to draw your own connections." |
| **Answer Questionnaire** | "Answer AVIXA standard based questions and select recommended products." |
| **Add your own BOM** `ver 2.0` `Beta` | "Search & configure your products and we will draw the connections automatically." |

**Este modal no funciona.** Se intentó cuatro veces, rellenando el nombre a mano y por API:
el botón pasa a `Creating...` y se queda ahí. Con el inspector de red abierto **no se dispara
ninguna petición HTTP** a `app.xtenav.com` (solo balizas de Facebook, Datadog y Mixpanel), y no
hay errores en consola. No es lentitud: el botón sencillamente no llama al servidor. En dos de
los intentos la pestaña dejó de responder. Nada llegó a crearse: no aparece en Recent Activities.

Anotado como fallo de la herramienta, no como muro de pago: la opción de pago (*Answer
Questionnaire*) se puede seleccionar sin que salte ningún aviso, y el fallo se da igual con
*X-DRAW Editor*, que es gratuita.

### B.2 El camino que sí funciona

`/design-templates` → tarjeta **Start from scratch** → mismo modal **DESIGN VIA X-DRAW** del
flujo A, esta vez con `Type of Room` visible. Se rellenó nombre, tipo `Meeting Room`, proyecto
existente `ZZ PRUEBA AVDESIGN`, plano en `No`. Redirige a `/standalone/<id>`.

### B.3 Pantalla "Search & Add Products" (`/standalone/<id>`)

Distribución: migas arriba, título **Search & Add Products** a la izquierda, y a la derecha
**View Design Docs**, el icono de XAVIA y un menú de tres puntos. El cuerpo ocupa dos tercios
y hay una columna derecha estrecha.

Columna central, de arriba abajo:
1. Barra con **⊕ Add Area** alineado a la derecha.
2. Casilla `Search Sense` a la izquierda y enlace **Upload BOM** a la derecha.
3. Buscador ancho, placeholder *"Search products in Combined Library to add to bom"*, con dos
   botones pegados a su derecha: **Combined library** (activo, azul) y **XTEN-AV Library** (desplegable).
4. Cabecera `Products` con **+ Add Custom Product** a la derecha.
5. Las líneas del BOM.

Columna derecha: tarjeta **PRODUCTS QUANTITY** con `Total Products` y `Total Amount`, botón
**DRAW WITH AI** (degradado azul-violeta) y debajo **Draw Manually**, que pasa a llamarse
**Edit Drawing** en cuanto existe un dibujo. Más abajo, publicidad de Panasonic.

**El desplegable de resultados** aparece bajo el buscador con una fila de filtros:
`XTEN-AV Library | My Library | ☑ Has Ports Info | ☑ No Ports Info`. Cada resultado muestra
`MARCA MODELO (Categoría)`, un icono de modelo 3D, un tick verde si tiene información de
puertos, el precio `MSRP` a la derecha y una línea de descripción.

Dato interesante para el catálogo propio: la herramienta distingue explícitamente productos
**con y sin información de puertos**, y lo deja filtrar. Sin puertos no se puede dibujar.

Se buscó `QB65R` y devolvió `SAMSUNG QB65R-B $1.575`, `QB65R-N $2.706`, `QB65R $1.385`,
`QB65H $2.769`. Con `MXA920`: `MXA920W $7.895,76`, `MXA920-S $0,00`, `MXA920-R $4.732`,
`MXA-920W $2.999`. El catálogo global de XTEN-AV tiene exactamente la misma suciedad que
teníamos nosotros: mismo producto escrito de varias formas y precios incoherentes, incluido
un cero.

**Cada línea del BOM** muestra: casilla de selección, miniatura o logotipo de marca, nombre y
`(Categoría)`, icono de información, icono 3D, descripción, enlace **Copy to my lib**,
control de cantidad `−  1  +`, precio con la etiqueta `(MSRP)` debajo y una aspa para eliminar.

**+ Add Custom Product** despliega dos opciones: `Single Product` y `Package Product`.

### B.4 Trazar la conexión

**Draw Manually** pregunta primero: *"Single Tabbed or Multi Tabbed — Do you want Single Tabbed
design or Multi Tabbed design?"* con botones `Single Tabbed` / `Multi Tabbed` / `Cancel`.
Se eligió Single Tabbed y abre el editor X-DRAW en pestaña nueva.

El editor **ya viene con el esquema montado solo**: coloca los bloques en tres carriles
etiquetados **Video Devices**, **Control Devices** y **Audio Devices**, y dibuja cada equipo
como una caja con el nombre del tipo arriba (`DISPLAY`, `POE INJECTOR`, `VIDEO CONVERTER`,
`DESKTOP`, `ADAPTOR`, `TOUCH PANEL`), sus entradas listadas en la mitad izquierda, sus salidas
en la derecha, y el conector de cada puerto escrito fuera de la caja (`HDMI`, `DVI-D`,
`3.5MM JACK`, `RJ45`, `TYPE-A`, `AC`, `IEC`). En azul debajo, marca y modelo.

Dos comportamientos que conviene copiar o al menos entender:

- El kit **Crestron UC-C100-T** se **explota** en el dibujo en sus seis componentes reales
  (PWE-4803RU, HD-CONV-USB-200, UC-ENGINE, ADPT-USB-ENET, TS-1070-B-S-TV…), cada uno con sus
  puertos y con la etiqueta `CRESTRON UC-C100-T` debajo indicando de qué kit sale. En el BOM,
  en cambio, sigue siendo **una sola línea**.
- El **Shure MXA920W** se dibuja como un cuadrado con una equis: no hay bloque de producto para
  él, así que no se puede conectar. Aparece en el BOM pero no en el esquema.

Para trazar el cable basta pasar el ratón por el borde de un puerto (aparece una flecha verde) y
arrastrar hasta el puerto destino. Se conectó `CRESTRON UC-ENGINE · HDMI OP1` →
`SAMSUNG QB65R · HDMI IP1`. Al soltar, la barra superior muestra
**"Unsaved changes. Click here to save."** y hay que pulsarlo para guardar.

Menús del editor: `File, Edit, View, Arrange, X-DRAW Settings, Page Scale, Multi Tab Connection,
Draw with AI (Beta)`. Barra de acciones: `Pull BOM Changes`, `Check connections with AI (Beta)`,
`View Design Docs`. Paletas de la izquierda: Scratchpad, Product Blocks, Product Images,
Avixa Symbols, X-DRAW Symbols, Rack Accessories, Floorplans. Panel derecho *Diagram* con
casillas `Hide Cable Ids`, `Hide Cables`, `Hide Unused Ports`, `Hide Unused Connectors`,
`Limit Drawing Area`, tamaño de papel y orientación.

### B.5 El resultado del flujo B

BOM: 3 líneas, `$12.780,27`. VIDEO → Samsung QB65R y Crestron UC-C100-T. AUDIO → Shure MXA920W.
Sin sección de accesorios, sin cable, sin mano de obra.

Cable Schedule: **una línea generada sola** a partir del trazo.

| Cable ID | Source Device | Destination Device | Source Port | Destination Port | Cable Type | Signal Type | Product Name | Cable Length |
|---|---|---|---|---|---|---|---|---|
| HD-1000 | CRESTRON UC-ENGINE (CRESTRON UC-C100-T) | SAMSUNG QB65R | HDMI OP1 | HDMI IP1 | HDMI | Video | Select Cable | *(vacío)* |

---

## 4. Formularios y campos, uno a uno

### 4.1 Modal "DESIGN VIA X-DRAW" (galería de plantillas)

| Etiqueta literal | Oblig. | Tipo | Por defecto | Opciones |
|---|---|---|---|---|
| Name of Design | Sí | Texto | vacío | — |
| Number of Designs | No | Número con `− +` | `1` | crea N salas iguales de golpe |
| Choose a Template | No | Radio | `XTEN-AV Templates` | XTEN-AV Templates / My Templates |
| *(selector de plantilla)* | No | Desplegable | la que se pulsó | Start From Scratch + las 18 de la galería |
| Type of Room | No | Desplegable | `Other` | Auditorium/H.O.W, Classroom, Huddle Room, Meeting Room, Networked Room, Residential, Retail, SportsBar/Lounge, TownHall/Cafeteria, VideoWalls, Zoom Room, Other |
| Choose a Project | Sí | Desplegable | vacío | los proyectos del grupo |
| Location | No | Texto | vacío | acaba guardándose como "Destination" |
| Start With Floor Plan | No | Interruptor | `No` | No / Yes |

### 4.2 Sección "CREATE PROJECT" del mismo modal

| Etiqueta literal | Oblig. | Tipo | Por defecto | Opciones |
|---|---|---|---|---|
| Project Name | Sí | Texto | vacío | — |
| Select Group | Sí | Desplegable | vacío | `SHL` |
| Budget | Sí | Texto con prefijo `USD` | vacío | — |
| Stage Name | Sí | Desplegable | vacío | Initial Briefing, Final Design, Concept Design, Decision Stage, Bidding, Project Won, Project Lost, Implementation stage, Closed |

### 4.3 Modal "CREATE A DESIGN" (`/create-design`, no operativo)

`Name of design` (texto), `Number of designs` (`− 1 +`, por defecto 1) y el método, con
X-DRAW Editor preseleccionado. No pide proyecto ni ubicación.

### 4.4 Modal "Specify name of floor plan"

Único campo `Floor Plan Name *`. Botones `Close` / `Create New`.

### 4.5 Modal "Add Product Details" (producto propio)

Pestaña **Basic Info**: `Brand Name *`, `Model Number *`, `Category *` ("Choose Category"),
`Product Type *` ("Choose Product Type"), `Description`. Debajo, **Add More Details** con dos
botones que despliegan secciones: `+ Add Price` y `+ Add Port`.

Pestaña **Additional Info**: `Part Number`, `Internal Code`, `Image Link` (+ *Upload Image*),
`Spec Link` (+ *Upload Specs*) y `Rack Unit`.

**Pricing Information**: `MSRP (USD)`, `Dealer Price (USD)`, `Sell Price (USD)`.

**Port Information**, tabla con `Port Name | Total Ports | Port Type | Signal Type * |
Connector Name | Action` y botón `+ Add Port`. `Port Type` = Input / Output / Control / Other.

Botones `Cancel` / `Add Product`.

**Lo que no hay en la ficha de producto: ni ancho, ni alto, ni fondo, ni peso, ni consumo.**
Solo unidades de rack. Un catálogo así no permite calcular ni el espacio del rack en centímetros
ni el consumo del SAI.

### 4.6 Cable Schedule — desplegables editables

`Cable Type`, 55 valores: HDMI, 2 Core Audio, ADAT, AES, AES67, AUDIO, AUX, AVB, BLU link, CATx,
CONTROL, Camera, CobraNet, Component Video, Control Cable, DANTE, DATA, DM, DMX, DVI, DisplayPort,
ESPLink, Ethernet/LAN, FIBER, GPIO, HDBaseT, I/O, IR, LAN, LINE IN, LINE OUT, MIC IN, MIC OUT,
MIDI, NexLink, Other, POTS, POWER, Proprietary, QLAN, RELAY, RF, RS232, RS422, RS485, SDI,
SPEAKER IN, SPEAKER OUT, STP Cat6, Speaker Cable, Twisted Pair, USB, VGA, VIDEO, VOIP.

`Signal Type`, 6 valores: Video, Audio, Both, Control, Network, Power.

`Product Name` ("Select Cable"): **se alimenta únicamente de los cables que ya están en el BOM
de ese diseño.** En el diseño B, sin cables en el BOM, el desplegable sale vacío.

---

## 5. Qué genera automáticamente

| Qué | Con qué datos |
|---|---|
| Id de proyecto | `P-103`, correlativo global |
| `Source` del proyecto | `XTEN-AV` |
| `Start Date` / `Procurement Date` | fecha de hoy y fecha de hoy + 1 mes (`08/05/26` y `09/05/26`) |
| `Owner` | el usuario que crea |
| Los 12 documentos del diseño | de golpe al crear; tick verde solo si tienen contenido |
| Esquema de líneas | disposición automática en carriles Video / Control / Audio, con puertos y conectores dibujados |
| Explosión de kits | un producto "Package" se despliega en sus componentes **en el dibujo**, no en el BOM |
| Accesorios implícitos | los componentes del kit (inyector PoE, adaptador, panel táctil…) aparecen en el esquema sin haberlos pedido |
| Cable Schedule | una fila por cada trazo del dibujo, con `Cable ID` tipado (`HD-1000`, `AD-…`, `DP-…`), origen, destino, puertos y conectores |
| `Cable Type` y `Signal Type` | deducidos del tipo de puerto (HDMI → HDMI / Video) |
| Título del diseño | se guarda tal cual, pero en migas y títulos de documentos se re-capitaliza (`Zz Prueba Avdesign Sala Tp Aforo 8`) |

---

## 6. Qué no pregunta nunca, y qué se rompe por eso

**Confirmado: en ningún punto del flujo se piden las medidas de la sala.** Ni al crear el
proyecto, ni al crear el diseño, ni en "Edit Details", ni al crear el plano. El único sitio donde
aparece una longitud es la escala del lienzo de dibujo, que es una propiedad del papel, no de la sala.

Y aquí está la prueba definitiva de por qué eso rompe el cálculo de cable. En el diseño B, con
el cable HDMI trazado a mano entre dos puertos reales:

```
CABLE TYPE: HDMI    SIGNAL TYPE: Video    PRODUCT NAME: Select Cable    CABLE LENGTH: (vacío)
```

En el diseño A, que viene de plantilla, `Cable Length` sí trae número. Comprobadas las 26 filas
una a una, solo aparecen **tres valores: 6 FT, 20 FT y 50 FT**, y la columna `Product Name`
está **sin asignar en todas** (el desplegable sigue en "Select Cable"). Es decir, hay longitud
sin que haya ningún cable elegido, así que no sale de la ficha del artículo. El reparto es:

| Longitud | En qué tiradas aparece |
|---|---|
| 6 FT | HDMI entre equipos del rack, USB entre componentes del kit, LAN interna del kit |
| 20 FT | DM del rack al receptor de detrás de la pantalla, enlace USB-EXT, encadenado de altavoz a altavoz |
| 50 FT | salidas a `CLIENT LAN`, línea de altavoces desde el DSP, DANTE del micrófono de techo |

Son **valores por defecto tabulados por tipo de tirada**, guardados dentro de la plantilla. Una
constante razonable —dentro del rack corto, a pantalla medio, a red y altavoces largo— pero una
constante al fin y al cabo: la misma plantilla en una sala de 3 metros y en una de 15 devuelve
exactamente los mismos pies.

La prueba está en el diseño B: hecho desde cero, sin plantilla, con un cable HDMI trazado a mano
entre dos puertos reales, `Cable Length` sale **vacío**. Sin plantilla que traiga la constante,
no hay ningún número, porque no hay nada que lo calcule.

O sea: XTEN-AV no mide. **Rellena con una constante de plantilla o deja el campo en blanco.** Si
la tirada real son 14 metros rodeando por canaleta, la herramienta seguirá diciendo 20 FT.

Otros huecos observados en este recorrido:

| Hueco | Consecuencia |
|---|---|
| No hay aforo ni número de puestos | la "SALA TP aforo 8" es solo un nombre; nada distingue una de 8 de una de 20 |
| El producto no guarda dimensiones ni consumo | no se puede comprobar si cabe en el rack ni dimensionar la alimentación |
| El plano no está unido al esquema | el dibujo del plano y el de conexiones son dos lienzos independientes; mover un equipo en el plano no cambia nada |
| No hay canalización, ruta ni altura de falso techo | no hay de dónde deducir un recorrido |
| No hay consumibles | conectores, canaleta, bridas y tornillería no tienen sitio |
| No hay mano de obra en el BOM | solo aparece en X-PRO, ya en fase de ejecución |
| El catálogo global está sucio | cuatro variantes del mismo micrófono, una con precio `$0,00` |
| El equipo sin información de puertos no se puede dibujar | el Shure MXA920W queda fuera del esquema y por tanto fuera del cable schedule |

---

## 7. Qué merece la pena copiar en AV_design, y qué no

Contrastado con lo que AV_design ya tiene hoy: catálogo por marca (839 referencias limpias),
plantillas de sala con medidas, salas, cálculo de cable con pruebas, tabla de `parametros` y
precios en CSV.

### Copiar — `Ahora`

1. **Puertos en el catálogo.** Es el único dato que AV_design no tiene y que hace falta para
   todo lo demás. El modelo de XTEN-AV es sencillo y vale tal cual: por artículo, una lista de
   `nombre de puerto`, `número de puertos`, `sentido` (entrada / salida / control / otro),
   `tipo de señal` y `nombre del conector`. Con eso ya se puede dibujar y ya se puede sacar una
   tabla de cables. Encaja en el CSV existente como una segunda tabla `puertos` referenciada
   por artículo.
2. **Marcar qué artículos tienen puertos y poder filtrar por ello.** Con 839 referencias, saber
   cuáles están listas para conectar evita descubrirlo cuando ya estás dibujando.
3. **`Ubicación` en la sala.** XTEN-AV lo llama `Location` / `Destination` y es un simple texto,
   pero es lo que permite decir "la P-103 es en la sede de Madrid". AV_design lo necesita para
   agrupar instalaciones.
4. **Duplicar N salas iguales en un paso** (`Number of Designs`). Con 144 salas del mismo tipo
   es la diferencia entre un clic y ciento cuarenta y cuatro.
5. **Estados del proyecto configurables** en vez de cableados. La lista de nueve etapas de
   XTEN-AV no nos sirve, pero el patrón sí: nuestra tabla `parametros` ya es el sitio natural.

### Copiar — `Después`

6. **Explosión de kits.** Un artículo "conjunto" que se despliega en sus componentes reales para
   dibujar, pero que se mantiene como una sola línea en la lista de material y en el precio.
   Nosotros compramos kits de videoconferencia igual que ellos.
7. **Tipado automático del cable a partir del puerto.** Si un HDMI OP1 va a un HDMI IP1, el tipo
   de cable y la señal se rellenan solos. Nosotros añadimos encima lo que ellos no tienen: los metros.
8. **Identificador de cable por tipo y correlativo** (`HD-1000`, `AD-1001`). Sirve para etiquetar
   físicamente en obra y para que el técnico y el plano hablen el mismo idioma.
9. **"Guardar como plantilla"** desde una sala terminada, y biblioteca propia frente a catálogo
   global ("Copy to my lib").
10. **El paquete de documentos con marca de "tiene contenido"**. Las tarjetas con tick verde son
    una forma honesta de decir qué falta por completar en un diseño.

### Copiar — `Experimental`

11. **Importar un BOM** para arrancar una sala desde un Excel existente. Útil solo durante una
    transición desde XTEN-AV; si no vamos a usarlo, no vale el trabajo.
12. **Comprobación automática del esquema** (su "Check connections with AI"): detectar salidas
    sin conectar, entradas duplicadas o señales incompatibles. La versión sin IA — reglas sobre
    el grafo — es perfectamente viable y probablemente más fiable.

### No copiar

- **El editor de dibujo genérico tipo draw.io.** Es un CAD entero. React Flow con nodos por
  puerto da el 90 % del valor con una fracción del trabajo, tal como ya dice la propuesta.
- **La longitud de cable como constante de plantilla.** Es precisamente el error de diseño que
  nos deja sin metros: 6, 20 o 50 pies según el tipo de tirada, iguales en cualquier sala. En
  AV_design la longitud es el resultado del cálculo sobre la geometría real, y el artículo es la
  consecuencia (qué bobina o qué latiguillo comprar), nunca al revés.
- **El flujo de dos modales distintos** (`/create-design` y `/design-templates`) que hacen casi
  lo mismo y uno de ellos ni siquiera funciona. Una sola entrada para crear una sala.
- **Cuentas, contactos, propuestas comerciales y aprobaciones.** Somos un departamento interno,
  no un integrador que vende.
- **Todo en dólares y con MSRP americano.** Nuestro CSV de precios ya está en euros.

### Lo que falta en AV_design para igualar el flujo

| Falta | Clasificación |
|---|---|
| Puertos y conectores por artículo del catálogo | `Ahora` |
| Ubicación y agrupación de instalaciones (proyecto → salas) | `Ahora` |
| Duplicar una sala N veces | `Ahora` |
| Aforo como campo de la sala (que ellos ni tienen) | `Ahora` |
| Lienzo de conexiones con React Flow y tabla de cables derivada | `Después` |
| Kits que se explotan en componentes | `Después` |
| Guardar una sala como plantilla propia | `Después` |
| Paquete de documentos exportable (PDF/XLS/ZIP) | `Después` |
| Validación automática del esquema por reglas | `Experimental` |
| Importar BOM desde XLS | `Experimental` |

---

## 8. Qué quedó bloqueado por el plan Free

Menos de lo que se suponía en el análisis anterior, y por motivos distintos:

- **Answer Questionnaire** (cuestionario AVIXA): se puede *seleccionar* sin que salte ningún
  aviso de pago. No se pudo comprobar si el muro aparece después, porque el botón `Create Design`
  de esa pantalla no funciona en absoluto (ver 3.1). Queda como **no verificado**.
- **Draw with AI**, **Check connections with AI** y **Ask XAVIA** están visibles y pulsables.
  No se ejecutaron: "Draw with AI" avisa de que regenera el dibujo de forma irreversible y se canceló.
- **x.doc / Create Proposal**: la galería de plantillas de propuesta se abre sin muro
  (`/xdoc/create/?design=<id>`, con "Drag and Drop your file here. Supported Files: .doc, .docx
  and PDF" y filtros All / Audio Visual / Business / RFP'S / BMS). No se creó ninguna propuesta.
- El DOM de la aplicación lleva precargado un modal **"Upgrade to Business Plan Now!"** que lista
  lo que sí está fuera del plan: `x.doc Proposal Tool`, `User Access Levels`, `Team Collaboration`,
  `Approval Workflow`, `Library Management by XTEN`, `API Integrations`. Cifras del modal:
  plan actual `$29.5`, renovación `$66 x 1`.
- Limitación conocida del plan Free según su propia tabla de precios: **exportación a PDF con
  marca de agua**. No se descargó ningún fichero para comprobarlo.

---

## 9. Recorrido en vivo del 7-8-2026 (sesión de Sergio, navegación real)

Recorrido completo con sesión iniciada: dashboard, All Projects, vista de
proyecto, constructor de BOM, editor X-DRAW, hub de documentos, Cable Schedule
y los dos asistentes de creación. Lo que corrige o añade sobre lo anterior:

### Jerarquía real

**Proyecto → Localizaciones → Diseños (salas) → Documentos.** El proyecto es la
obra; cada diseño es una sala; los diseños se agrupan por localización ("Add
Location", con "Unassigned" por defecto). Traducción a AV_design: la obra
agrupa salas de una sede, cosa que hoy no existe (la sala cuelga directa).

### Crear proyecto: asistente de 2 pasos

Descripción (nombre*, grupo*, cuenta, contacto, país, vertical, descripción) →
Especificaciones (presupuesto* en USD, etapa del embudo*, fecha de inicio,
fecha de aprovisionamiento*). La etapa alimenta el embudo del dashboard
(Bidding → Initial Briefing → Concept Design → Decision Stage → Final Design →
Project Won).

### Crear diseño: el modal que importa para las 144 salas

"Design via X-DRAW": nombre, **Number of Designs** (alta en serie de N salas
iguales de golpe), plantilla (pestañas XTEN-AV Templates / My Templates, con
"Start From Scratch" como opción), Type of Room, localización y toggle "Start
With Floor Plan". Un diseño se guarda como plantilla propia con "Save as
X-DRAW Template" desde su hub. **El alta en serie con plantilla es exactamente
el M5+alta en serie del roadmap.**

### Flujo dentro del diseño

1. **Search & Add Products**: se monta la BOM buscando en la biblioteca
   (Combined Library / XTEN-AV Library), con cantidades, precio MSRP, "Add
   Custom Product", "Upload BOM" y áreas. Totales en vivo (productos e
   importe).
2. **Edit Drawing** abre el editor (draw.io adaptado): paletas de Product
   Blocks/Images, símbolos AVIXA, accesorios de rack y floorplans; pestañas de
   página ("Line Schematics" + añadir); "Pull BOM Changes" sincroniza BOM →
   dibujo.
3. **View Design Docs**: hub del diseño con 12 documentos, verde el ya
   generado: BOM, Line Schematics, Signal Flow, Rack Layout, **Cable
   Schedule**, Ceiling Speaker Layout, Scope of Work, Floor Plans, Front
   Elevation, Plates & Panels, Submittals, Asset Management. Más propuestas.

### El bloque de equipo en el esquema (referencia para R2)

Rectángulo redondeado con borde de color; etiqueta de categoría encima
(DISPLAY, POE INJECTOR); entradas en columna izquierda y salidas en derecha
con el nombre serigrafiado (HDMI IP1, AUDIO OP1, LAN1, POWER1); el tipo de
conector fuera del borde (HDMI, DVI-D, 3.5MM JACK, RJ45, IEC, TYPE-A); marca y
modelo en azul al pie. La línea lleva el identificador del cable encima
(HD-1000 — la misma convención de prefijos que ya usa AV_design). Un kit se
despliega en sub-bloques (el Crestron UC-C100-T sale como POE INJECTOR + VIDEO
CONVERTER + DESKTOP/UC-ENGINE, cada uno etiquetado con su kit padre): así
resuelven lo que aquí son las líneas Cisco a 0,00 de composición de kit.
Opciones de vista: Hide Cable Ids / Hide Cables / Hide Unused Ports / Hide
Unused Connectors.

### Cable Schedule real

Columnas: S.NO, CABLE ID, SOURCE DEVICE (con kit padre entre paréntesis),
DESTINATION DEVICE, SOURCE PORT, SOURCE PORT CONNECTOR, DESTINATION PORT,
DESTINATION PORT CONNECTOR, DESTINATION LOCATION, CABLE TYPE (editable).
Columnas configurables ("Add Columns"), exportación .XLS/.PDF, buscador.
**Sin metros por ningún sitio**: la longitud de tirada sigue siendo el vacío
que AV_design llena.

### Detalles de interfaz confirmados en vivo

Rail lateral oscuro colapsado a iconos con flyout al pasar (PROJECTS → All /
My / Shared); barra superior blanca con buscador central; tarjetas blancas de
radio ~12 px con sombra suave; pestañas con subrayado azul; tablas con cebra
azulada y paginación "Showing X to Y of Z entries"; botón verde solo para
"Create Project" (el resto azules).

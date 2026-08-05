# Análisis de XTEN-AV (app.xtenav.com) — investigación de referencia

Fecha: 2026-08-05
Fuente: navegación real con sesión iniciada de Sergio (cuenta Free, grupo SHL, proyecto de ejemplo "SHL sample project").
Método: recorrido completo de la navegación, apertura de cada módulo y de cada documento generado del diseño de ejemplo.

> Nota: no se ha creado ni modificado nada en la cuenta. Se creó una página vacía por error en el editor de dibujo y se eliminó inmediatamente sin guardar. Un intento de abrir el flujo "Answer Questionnaire" quedó bloqueado por el muro de pago (no se ha contratado nada).

---

## 1. Qué es XTEN-AV

Plataforma SaaS para integradores AV. Tres productos dentro de una misma cuenta:

| Módulo | Para qué sirve |
|---|---|
| **X-DRAW** | Diseño técnico: BOM + esquema de conexiones (line schematics) y documentos derivados |
| **x.doc** | Propuestas comerciales / documentos para cliente |
| **X-PRO** | Ejecución: gestión de proyecto, tareas, horas, compras, recepción de material |

Modelo de precios: Free (con marca de agua, sin IA), Basic 139 $/mes, Business 149 $/mes, Enterprise anual. Varias funciones clave están detrás del muro de pago en la cuenta actual.

---

## 2. Mapa de navegación completo

```
Dashboard
Projects
├── All Projects            /all-projects
├── My Projects
└── Shared Projects
X-DRAW
├── Create Design           /create-design
└── Templates               /design-templates
X-DOC
├── X-DOC Dashboard
└── Templates
X-PRO
├── Install
│   ├── Projects            /xpro/projects        (kanban New/In Progress/Review/Completed)
│   ├── Purchase Order      /xpro/purchase-order  (kanban Draft/Ordered/Partially Received/Delivered)
│   └── Invoices            /xpro/invoices
└── Service                 /service_tool/service-projects
Administración
├── Approvals               /all-approvals
├── Reports                 /reports
├── Accounts                /all_accounts
├── Contacts                /all_contacts
└── Vendors                 /vendors
Cuenta
├── My Account · User and Group Management
├── Switch to Field User View   ← vista reducida para técnico de campo
└── Settings                /overall_settings
```

### Ajustes relevantes (`/overall_settings`)
- Organization Settings
- Group Settings → Currency, **Dealer Pricing**, Brand Preference
- X-DRAW Settings → **Cable & Signal Settings**, Device Block Settings, Title Block, Border, Paper size, Share
- x.doc Settings
- Integrations · Asset Management Settings · Download Zip Settings · SSO
- **X-PRO Settings → Install → X-PRO Permissions, X-PRO Stages, Inventory Stages, Labor Types, Task Templates**
- Pricing Integration · Data Management

Los *Labor Types* de la cuenta demo son solo tres: `Site visit`, `Service`, `others`.

---

## 3. Jerarquía de datos (la parte importante para copiar)

```
Proyecto  (P-101, cliente/Account, presupuesto, stage, owner, group, fechas, estado de aprobación)
└── Diseño / Sala  ("SHL Sample Meeting Room", tipo = Meeting Room)
    ├── BOM  (productos por Áreas)
    └── Documentos generados automáticamente:
        · Bill of Material
        · Line Schematics            (el dibujo, editor tipo draw.io)
        · Automated Signal Flow Diagram
        · Automated Rack Layout
        · Automated Cable Schedule
        · Automated Ceiling Speaker Layout
        · Scope of Work
        · Floor Plans
        · Automated Front Elevation Diagram
        · Plates & Panels
        · Submittals (spec sheets)
        · Asset Management
└── Propuestas (x.doc)
└── Locations
```

Un proyecto agrupa **varias salas**. Cada sala tiene su propio BOM y su propio paquete de documentos. Eso es exactamente lo que necesitáis: instalación = proyecto, sala = unidad de diseño.

---

## 4. Flujos observados, paso a paso

### 4.1 Crear un diseño desde cero (`/create-design`)
1. Se elige un **tipo de sala** de una galería con fotos: Zoom Rooms, Huddle Room, Classroom, Meeting Room, Townhall/Cafetería, Networked Rooms, Auditorium/H.O.W., Videowalls…
2. Modal "Create a Design": nombre del diseño y número de diseños a crear (permite crear N salas iguales de golpe).
3. Se elige **método**:
   - **X-DRAW Editor** — buscas y añades productos y dibujas tú las conexiones.
   - **Answer Questionnaire** — cuestionario basado en estándar AVIXA que recomienda productos. **Bloqueado en plan Free.**
   - **Add your own BOM (v2.0, beta)** — subes tu lista de material y la herramienta dibuja las conexiones automáticamente.

**Dato clave: en ningún momento se piden las medidas de la sala.** No hay ancho/largo/alto, ni distancia a rack, ni altura de falso techo.

### 4.2 Construir el BOM (`/standalone/<id>`)
Pantalla "Search & Add Products":
- Buscador sobre **Combined library** o **XTEN-AV Library** (catálogo global de fabricantes con fotos, categoría y MSRP).
- `+ Add Area` para dividir la sala en zonas.
- `+ Add Custom Product` para material que no está en catálogo.
- `Upload BOM` para importar una lista existente.
- Cada línea: producto, categoría, cantidad −/+, precio MSRP, y **"Copy to my lib"** (biblioteca propia).
- Panel derecho: Total Products, Total Amount, **Draw with AI**, **Edit Drawing**.

### 4.3 El editor de dibujo (X-DRAW)
Editor tipo draw.io / mxGraph. Menús: File, Edit, View, Arrange, X-DRAW Settings, Page Scale, Multi Tab Connection, Draw with AI.
- Paletas laterales: **Product Blocks, Product Images, Avixa Symbols, X-DRAW Symbols, Rack Accessories, Floorplans**.
- Pestañas de página abajo (Line Schematics + las que añadas).
- Opciones: Hide Cable Ids, Hide Cables, Hide Unused Ports, Hide Unused Connectors, Limit Drawing Area, tamaño de papel, orientación.
- `Pull BOM Changes` (sincroniza el dibujo con el BOM) y `Check connections with AI`.
- `X-DRAW Settings → Cable Settings`: Number All, Remove Cable Id, Apply/Remove Cable Style, Remove Cables, Pull Cable Settings.

Los bloques de producto se dibujan con **todos sus puertos de entrada y salida**, y los cables se trazan puerto a puerto. De ahí sale el cable schedule.

### 4.4 Bill of Material (`/view-bom/<id>`)
Tabla agrupada por categoría (VIDEO, AUDIO…): S.NO, Brand, Model, Description, Quantity, MSRP, Unit Price, Amount + TOTAL. Botones .XLS / .PDF / EDIT BOM / Save, "Round Off", "Hide pricing in export" y **Add Columns** (columnas libres definidas por el usuario).

**El BOM no incluye cable ni mano de obra.** Solo equipos.

### 4.5 Cable Schedule (`/view-cable/<id>`) — el punto crítico
Columnas: S.NO · Cable ID · Source Device · Destination Device · Source Port · Source Port Connector · Destination Port · Destination Port Connector · Destination Location · **Cable Type** (desplegable) · **Signal Type** (desplegable) · **Product Name** (desplegable "Select Cable") · **Cable Length**.

Se genera automáticamente a partir de las conexiones del dibujo: cada cable con su ID (AD-1000, DP-1000, HD-1000…), origen, destino y conectores. Exporta a .XLS/.PDF.

**Pero `Cable Length` está vacío y es un campo manual.** XTEN-AV sabe *qué* cables hacen falta, no *cuántos metros*. No hay geometría de sala de la que deducirlo.

### 4.6 X-PRO (ejecución)
Kanban de proyectos de instalación. Dentro de cada proyecto:
- **Dashboard**: total de tareas, % completado, recursos asignados, Projects Earnings desglosado en **Labor / Products / Total**, Purchase Orders, Completed Hours, calendario de eventos.
- **Tasks** · **Events** · **Time Tracking** (imputación de horas)
- **BOM Details**: Item, Category, Qty, **Cost Price** y **Selling Price** + sección **Labor** con precio total. Aquí sí aparece coste vs venta.
- **Inventory**: Make and Model · Qty · Vendor · Ordered On · Received On · Purchase Order · Status. Botones "Add Item" y "Create Purchase Order".
- Attachments · Activity
- Purchase Orders globales en kanban Draft → Ordered → Partially Received → Delivered.

**"Inventory" aquí no es un almacén.** Es el seguimiento de compra y recepción del material *de ese proyecto concreto*. No hay stock central, ni ubicaciones, ni "qué tengo ahora mismo en el almacén".

### 4.7 Plantillas (`/design-templates`)
Dos pestañas: **Gallery** (plantillas de XTEN-AV) y **My Templates** (las tuyas). Filtros: All / Audio Visual / Building Management System.
Plantillas disponibles: Start from scratch, Access Control, Auditorium/H.O.W, Classroom, DVR System, Fire System, Huddle Room, Meeting Room, NVR System, Network Room, Paging System, Residential, Retail, Sound Masking, Sports Bar/Lounge, Teams Room, Townhall, Videowall, Zoom Room.

Desde un diseño existente: **"Save as X-DRAW Template"** — así conviertes tus salas tipo en plantillas reutilizables.

**Son plantillas de esquema eléctrico/señal, no plantillas de sala con medidas.**

---

## 5. Qué hace bien (a copiar)

1. **Jerarquía Proyecto → Sala → BOM → documentos.** Simple y correcta.
2. **Un dibujo como fuente de verdad.** El esquema genera el cable schedule, el rack layout y el signal flow. No se mantienen listas a mano.
3. **Plantillas por tipo de sala** y "guardar diseño actual como plantilla".
4. **Biblioteca propia** ("Copy to my lib") además del catálogo global.
5. **Duplicar N salas iguales** en un paso.
6. **Kanban de compras con estado de recepción** (Draft → Ordered → Parcial → Entregado).
7. **Vista de usuario de campo** separada de la vista de oficina.
8. **Coste vs. venta** separados, y mano de obra como línea propia.
9. **Áreas dentro de una sala** para organizar el material.
10. Exportación .XLS/.PDF en cada tabla y ZIP con todo el paquete.

---

## 6. Qué NO resuelve — y es justo vuestro problema

| Vuestro dolor | XTEN-AV |
|---|---|
| "No hemos calculado cuánto cable nos hace falta" | Lista los cables necesarios pero **la longitud es un campo manual vacío**. No hay medidas de sala ni rutas de canalización. |
| "Nos falta material" | Solo sabe si el material *de ese proyecto* se ha pedido y recibido. **No hay stock de almacén.** |
| "No disponemos de un stock actualizado" | No existe. No hay entradas/salidas, ni reservas, ni "material asignado a obra", ni inventario de sobrantes. |
| Plantillas de salas con vuestras medidas | Las plantillas son esquemas de conexión. **No guardan dimensiones.** |
| Preparar la furgoneta / picking de obra | No existe lista de carga ni checklist de salida a obra. |
| Consumibles (latiguillos, canaleta, tornillería, conectores) | El BOM es de equipos. Los consumibles no tienen sitio. |

Además: el cuestionario de diseño asistido y la IA están de pago, y todo está en dólares/MSRP americano.

---

## 7. Conclusión de la investigación

XTEN-AV es una excelente referencia de **estructura y de documentos de salida**, pero está pensado para *vender e integrar* proyectos, no para *ejecutar instalaciones con un almacén propio*. Los tres problemas que planteas — cable, material y stock — son precisamente los tres huecos que deja.

La app propia no debe ser un clon del editor de esquemas (eso es meses de trabajo y XTEN-AV ya lo hace). Debe ser **la capa que XTEN-AV no tiene**: geometría de sala → metros de cable → lista de material → contraste con stock real → lo que hay que comprar → lo que hay que cargar en la furgoneta.

---

## 8. Capturas

El recorrido se documentó con capturas de todas las pantallas citadas (dashboard, all-projects, vista de proyecto, BOM, editor de dibujo, cable schedule, X-PRO dashboard/inventory/BOM details, purchase orders, galería de plantillas, create-design, settings). No quedaron guardadas como archivo en disco; si las quieres como imágenes en `docs/capturas/`, dilo y repito el recorrido guardándolas.

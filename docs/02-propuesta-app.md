# Propuesta — App de diseño e instalación AV del departamento

Estado: **borrador para discutir**. No se ha escrito código todavía.
Base: [01-analisis-xtenav.md](01-analisis-xtenav.md).

---

## 0. Decisiones ya tomadas por Sergio (2026-08-05)

| Decisión | Valor |
|---|---|
| Alcance | **Sustituir XTEN-AV por completo** |
| Despliegue | GitHub → **Render** (URL pública), base de datos **Supabase** |
| Usuarios | **Todo el departamento**, con roles (diseño, compras, almacén, campo) |

Consecuencia directa: la app tiene que cubrir *también* lo que XTEN-AV hace bien (BOM, esquema de conexiones, documentos para cliente), no solo los huecos. Es un proyecto grande. Por eso el plan de abajo está partido en fases que se pueden usar en producción cada una por su cuenta, empezando por lo que hoy os duele.

---

## 1. La idea en una frase

Una app interna donde defines una sala **con sus medidas reales**, le pones el equipamiento, dibujas las conexiones, y ella te devuelve el esquema, la lista de material, **cuántos metros de cada cable necesitas**, qué te falta contra tu stock, qué hay que comprar y qué hay que cargar en la furgoneta.

---

## 2. Módulos

### A. Catálogo de material
Un único catálogo con tres tipos de artículo:
- **Equipos** — pantalla, cámara, DSP, matriz, altavoz… con marca, modelo, categoría, dimensiones, consumo y **puertos** (esto último es imprescindible para poder dibujar conexiones).
- **Cable** — por tipo (HDMI, Cat6A, altavoz 2×2.5, XLR, alimentación…), unidad = metro, precio/m, formato de bobina.
- **Consumibles y accesorios** — conectores, latiguillos, canaleta, soportes, tornillería, bridas…

Campos: referencia interna, marca, modelo, categoría, unidad, coste, PVP, proveedor habitual, plazo, stock mínimo.

### B. Salas y plantillas de sala
Lo que XTEN-AV no tiene. Una sala guarda:
- **Geometría**: largo × ancho × alto, altura de falso techo, altura de mesa y de pantalla.
- **Puntos clave**: posición del rack, pantalla, mesa, tomas, canalización.
- **Tipo**: reuniones, aula, auditorio, huddle, videowall, control…
- **Plantillas con vuestras medidas reales**, reutilizables y duplicables.

### C. Cálculo de cable — el corazón
```
longitud = ruta física (no línea recta) + holgura origen + holgura destino + margen %
```
Ruta por el recorrido real (suelo → subida → falso techo → bajada), configurable por sala. Holguras y margen por tipo de cable, definidos una vez. Salida: **metros por tipo**, redondeados a bobina o latiguillo comercial, más conectores por tipo.

### D. Esquema de conexiones (lo que sustituye a X-DRAW)
Lienzo con bloques de equipo que muestran sus puertos, y cables que unen puerto con puerto. De ahí salen automáticamente:
- **Cable schedule** (ID de cable, origen/destino, puerto/conector, tipo de señal) — igual que XTEN-AV **pero con la longitud calculada, no vacía**.
- Diagrama de flujo de señal.
- Elevación de rack.

No se construye un editor CAD desde cero. Se monta sobre una librería de grafos ya hecha (React Flow o similar): nodos con *handles* por puerto, aristas tipadas por señal. Es la diferencia entre semanas y meses.

### E. Lista de material de la instalación
Equipos + cable calculado + consumibles derivados por reglas configurables (un HDMI de X m implica N conectores; un altavoz implica soporte…).

### F. Stock
Almacén real: qué hay, dónde y cuánto. Entradas, salidas, **material reservado para una obra**, devoluciones de sobrantes, aviso de stock mínimo.

### G. Compras y preparación de obra
- **Lo que falta** = material de la instalación − stock disponible → pedido por proveedor, con estados Borrador → Pedido → Recibido parcial → Recibido.
- **Lista de carga** de la furgoneta, marcable desde el móvil.
- **Cierre de obra**: qué sobró, qué se rompió, qué vuelve al almacén.

### H. Documentos para cliente
Presupuesto/propuesta y memoria de alcance a partir del material y la mano de obra, exportables a PDF. Coste y venta separados.

### I. Panel
Instalaciones activas y estado, material pendiente de recibir, alertas de stock, obras bloqueadas por falta de material.

---

## 3. Arquitectura propuesta

| Pieza | Elección | Por qué |
|---|---|---|
| Frontend + backend | **Next.js (App Router) + TypeScript** | Un solo despliegue en Render, server actions para la lógica, buen soporte de PDF y de tablas. |
| Base de datos | **Supabase (Postgres)** | Ya decidido. Relacional, que es exactamente lo que pide catálogo/stock/movimientos. |
| Autenticación y roles | **Supabase Auth + RLS** | Roles del departamento sin montar un sistema de usuarios propio. |
| Ficheros | **Supabase Storage** | Fotos de producto, fichas técnicas, planos, fotos de obra. |
| Esquema de conexiones | **React Flow** | Nodos con puertos y aristas tipadas. Evita construir un CAD. |
| Despliegue | **Render** desde GitHub | Ya decidido. |
| Tipografía | Cormorant Garamond + JetBrains Mono | Criterio por defecto para proyecto nuevo; se anota en `design-system/MASTER.md`. |

Riesgo a vigilar: Render en plan gratuito duerme el servicio y añade latencia en el primer acceso. Si la app la va a abrir un técnico en obra, conviene plan de pago desde el principio.

---

## 4. Fases

**Fase 1 — Ahora.** Catálogo · Salas con medidas · Cálculo de cable · Lista de material. Utilizable desde el primer día; ataca el dolor principal.

**Fase 2 — Después.** Stock, reservas, lista de compra por proveedor, lista de carga. Usuarios y roles.

**Fase 3 — Después.** Esquema de conexiones con React Flow, cable schedule automático, elevación de rack, plantillas propias de sala.

**Fase 4 — Después.** Documentos para cliente (propuesta, alcance, PDF), costes reales vs. previstos, histórico de instalaciones.

**Experimental.** Importar el .XLS de BOM de XTEN-AV durante la transición; croquis 2D de la sala; lectura de código de barras en almacén.

---

## 5. Lo que necesito de ti para arrancar la Fase 1

1. **Vuestro material**: un listado, aunque sea un Excel sucio, de equipos y cables habituales.
2. **Vuestras salas tipo**: cuáles repetís y con qué medidas.
3. **Cómo tiráis el cable**: falso techo, canaleta, suelo técnico… y qué holgura y margen usáis hoy a ojo.
4. **Una instalación reciente**: lo que se pidió y lo que realmente hizo falta. Con un caso real se valida el cálculo antes de construir sobre él.
5. **Roles reales del departamento**: quién diseña, quién compra, quién controla almacén, quién va a obra.

# Sistema visual · AV_design

Fuente de verdad del aspecto de la aplicación. Los tokens viven en
`src/app/globals.css`; aquí está la decisión y el porqué.

---

## Tipografía

Decisión para este proyecto: **Cormorant Garamond + JetBrains Mono**.

| Uso | Familia |
|---|---|
| Títulos y subtítulos | Cormorant Garamond (400/500/600) |
| Todo lo demás: texto, tablas, formularios, navegación | JetBrains Mono (400/500) |

Por qué mono para el cuerpo: la aplicación es casi toda tablas de datos, medidas
y metros. La cifra tabular alineada se lee mejor y evita el baile de columnas.

Tres tamaños semánticos, y el texto es el más pequeño a propósito:

| Clase | Uso | Tamaño |
|---|---|---|
| `.t-titulo` | Título de página | `clamp(1.75rem, 1.3rem + 1.6vw, 2.5rem)` |
| `.t-subtitulo` | Título de tarjeta y cifras destacadas | `clamp(1.1rem, 0.95rem + 0.6vw, 1.375rem)` |
| cuerpo | Texto, tablas, formularios | `0.8125rem` |

`.t-etiqueta` no es un cuarto tamaño: es el cuerpo en versalitas para rotular
campos y cabeceras de tabla.

No se usa Inter, Roboto, Arial, Helvetica ni `system-ui`. XTEN-AV, que sirvió de
referencia funcional, usa Inter sobre Bootstrap; aquí no se copia su aspecto.

---

## Color

Papel claro y tinta oscura, con un solo acento. Nada de gradientes ni de sombras
decorativas.

| Token | Valor | Uso |
|---|---|---|
| `--papel` | `#fbfaf8` | Fondo |
| `--papel-hundido` | `#f4f2ed` | Fila al pasar el ratón, avisos suaves |
| `--tinta` | `#1a1a18` | Texto |
| `--tinta-tenue` | `#6b6862` | Texto secundario, rótulos, unidades |
| `--linea` | `#e2ded6` | Separadores y bordes de tarjeta |
| `--linea-fuerte` | `#cdc7ba` | Bordes de control y cabecera de tabla |
| `--acento` | `#1f4d46` | Enlaces, sección activa, botón principal |
| `--acento-suave` | `#e8f0ed` | Fondo de estado activo |
| `--alerta` | `#8c3a2b` | Falta un dato imprescindible (medidas, cable sin asignar) |
| `--aviso` | `#8a6d1f` | Reservado para advertencias no bloqueantes |

El rojo `--alerta` está reservado para lo que impide calcular. Que falte un
precio no es una alerta: es información, y va en `--tinta-tenue`.

---

## Disposición

- Contenedor máximo `100rem`. La aplicación es de tablas anchas.
- Rejillas de una columna en móvil, dos en escritorio. El detalle de sala usa
  `22rem` fijos para el formulario de medidas y el resto para los resultados.
- Bordes de 1 px, radio 2 px. Sin sombras.
- Tablas con `border-collapse` y separador inferior por fila.

## Reglas que no se saltan

- Sin emojis en la interfaz, en los textos ni en los datos de ejemplo.
- Sin microcopy explicativo de relleno. La jerarquía, el nombre del campo y su
  unidad explican la pantalla.
- Toda cifra lleva su unidad (m, mm, €, ud).
- `prefers-reduced-motion` respetado globalmente.
- Foco visible en todo elemento interactivo (`outline` de 2 px en `--acento`).
- Todo control de formulario tiene etiqueta o `aria-label`.

## Vocabulario

La interfaz habla como el departamento: sala, tipología, aforo, caja de
conexiones, canaleta, falso techo, suelo técnico, tirada, holgura, bobina,
latiguillo. No se traduce del inglés ni se inventan términos.

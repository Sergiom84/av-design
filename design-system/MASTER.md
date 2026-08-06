# Sistema visual · AV_design

Fuente de verdad del aspecto de la aplicación. Los tokens viven en
`src/app/globals.css`; aquí está la decisión y el porqué.

**Decisión de 7 de agosto de 2026, pedida por Sergio:** la aplicación adopta el
lenguaje visual de XTEN-AV, extraído del volcado local `Inicio/`
(`app.xtenav.com/static/xavia/css/xavia_styleguide.css` y hojas hermanas).
Esto sustituye al sistema anterior papel/tinta con Cormorant Garamond, que
queda registrado al final como histórico. La migración va pantalla a pantalla
según `docs/07-roadmap.md`; una pantalla no migrada conserva el aspecto viejo
sin mezclarse con el nuevo dentro de la misma vista.

---

## Qué se copia de XTEN-AV y qué no

Se copia la **estructura**: sidebar vertical clara, barra superior, contenido
sobre fondo gris muy claro, tarjetas blancas con sombra suave, acento azul,
tablas densas. Es el aspecto que Sergio y TEI ya reconocen.

No se copia: Bootstrap (aquí es Tailwind 4), Font Awesome ni Feather como
fuente de iconos (SVG inline propios), los gradientes de su paleta antigua, ni
su mezcla de cuatro tipografías. Tampoco los emojis: aquí siguen prohibidos.

## Tipografía

Dos familias, y no las genéricas:

| Uso | Familia |
|---|---|
| Títulos, navegación, botones, texto de interfaz | Plus Jakarta Sans (400/500/600/700) |
| Cifras, tablas de datos, códigos de cable, medidas | JetBrains Mono (400/500) |

Plus Jakarta Sans es la familia del XTEN-AV moderno (su token
`--text-md-medium-font-family`), así que da el parecido buscado sin caer en
Inter/Roboto. JetBrains Mono se queda de la etapa anterior porque la
aplicación sigue siendo tablas de medidas y metros: la cifra tabular alineada
evita el baile de columnas. Regla práctica: si es un dato (metros, euros,
unidades, `HD-1000`), va en mono; si es interfaz, va en Jakarta.

Tres tamaños semánticos, el cuerpo el más pequeño:

| Clase | Uso | Tamaño |
|---|---|---|
| `.t-titulo` | Título de página | `clamp(1.5rem, 1.2rem + 1.2vw, 2rem)` · 700 |
| `.t-subtitulo` | Título de tarjeta y cifras destacadas | `clamp(1.05rem, 0.95rem + 0.4vw, 1.25rem)` · 600 |
| cuerpo | Texto, tablas, formularios | `0.875rem` |

`.t-etiqueta` no es un cuarto tamaño: cuerpo a `0.75rem`, peso 500, en
mayúsculas pequeñas con `letter-spacing`, para rotular campos y cabeceras.

## Color

Tokens extraídos del styleguide de XTEN-AV (`--csk-3669d9*`, `--gray-*`,
`--variable-collection-*`) y adaptados a nombres en español:

| Token | Valor | Origen XTEN-AV | Uso |
|---|---|---|---|
| `--fondo` | `#f6f8fb` | fondo de contenido | Fondo general de la aplicación |
| `--superficie` | `#ffffff` | tarjeta / sidebar | Tarjetas, sidebar, barra superior |
| `--superficie-hundida` | `#f1f7ff` | `secondary-hover` | Fila al pasar el ratón, estado hover |
| `--tinta` | `#23262f` | `--text-color` | Texto principal |
| `--tinta-tenue` | `#637381` | `secondary-text` | Texto secundario, rótulos, unidades |
| `--linea` | `#e0e0e0` | `text-field-border` | Separadores, bordes de control |
| `--linea-suave` | `#eef1f5` | derivado | Bordes internos de tarjeta, cebra de tabla |
| `--acento` | `#3669d9` | `--primary-color` | Botón principal, enlaces, sección activa |
| `--acento-fuerte` | `#204cac` | `csk-600` | Hover del botón principal |
| `--acento-suave` | `#eaeffb` | `csk-50` | Fondo de estado activo, badge informativo |
| `--exito` | `#298d74` | verde histórico XTEN-AV | Estado correcto, recepción completa |
| `--alerta` | `#b3261e` | `schemes-error` | Falta un dato imprescindible |
| `--alerta-suave` | `#f9dedc` | `error-container` | Fondo de aviso bloqueante |
| `--aviso` | `#8a6d1f` | propio | Advertencia no bloqueante (validación de conexiones) |

El rojo `--alerta` sigue reservado para lo que impide calcular o montar. Que
falte un precio no es alerta: es información, y va en `--tinta-tenue`.

## Sombra y relieve

XTEN-AV separa las tarjetas del fondo con sombra, no con borde. Se adopta su
token:

- `--sombra-tarjeta`: `0 2px 4px -2px rgba(23,23,23,.06), 0 4px 8px -2px rgba(23,23,23,.1)` (su `--shadow-md`).
- Radio de tarjeta y control: `8px`. Botones y badges: `6px`.
- Los bordes de 1 px quedan para controles de formulario y separadores de
  tabla, no para tarjetas.

## Disposición

- **Sidebar vertical fija** de `16rem` en escritorio, fondo `--superficie`,
  colapsable a iconos; en móvil, cajón sobre el contenido. Sección activa con
  `--acento-suave` de fondo y texto `--acento`.
- **Barra superior** de `3.5rem`: nombre de la sala o sección actual a la
  izquierda, acciones de la vista a la derecha.
- Contenido sobre `--fondo`, contenedor máximo `100rem`, relleno `1.5rem`.
- Tarjetas blancas con `--sombra-tarjeta`, sin borde, título `.t-subtitulo`.
- Tablas densas: cabecera `.t-etiqueta` sobre `--superficie`, separador
  inferior `--linea-suave` por fila, hover `--superficie-hundida`, cifras en
  mono alineadas a la derecha con su unidad.
- Rejillas de tarjetas: una columna en móvil, dos o tres en escritorio. La
  lista de salas y la de plantillas son rejillas de tarjeta tipo proyecto de
  XTEN-AV: nombre, tipología, aforo y estado de un vistazo.

## Iconos

SVG inline propios, trazo de 1,5 px, tamaño `1.25rem`, color del texto que
acompañan. Estilo Feather (el de XTEN-AV) pero incrustados, sin fuente de
iconos ni dependencia. Un icono nunca va solo: siempre con texto o
`aria-label`.

## Reglas que no se saltan

- Sin emojis en la interfaz, en los textos ni en los datos de ejemplo.
- Sin microcopy explicativo de relleno. La jerarquía, el nombre del campo y su
  unidad explican la pantalla.
- Toda cifra lleva su unidad (m, mm, €, ud).
- `prefers-reduced-motion` respetado globalmente; las transiciones son de
  opacidad y color, nunca de posición decorativa.
- Foco visible en todo elemento interactivo (`outline` de 2 px en `--acento`).
- Todo control de formulario tiene etiqueta o `aria-label`.
- Nada de gradientes decorativos ni sombras más allá de `--sombra-tarjeta`.

## Vocabulario

La interfaz habla como el departamento: sala, tipología, aforo, caja de
conexiones, canaleta, falso techo, suelo técnico, tirada, holgura, bobina,
latiguillo. No se traduce del inglés ni se inventan términos.

---

## Histórico · sistema papel/tinta (retirado el 7-8-2026)

El primer sistema fue Cormorant Garamond + JetBrains Mono sobre papel claro
(`#fbfaf8`) y tinta (`#1a1a18`) con acento verde `#1f4d46`, bordes de 1 px,
radio 2 px y sin sombras. Se retiró a petición de Sergio para acercar la
aplicación al aspecto de XTEN-AV, que es el que su departamento y TEI
reconocen. Mientras dure la migración, las pantallas no migradas conservan
estos valores.

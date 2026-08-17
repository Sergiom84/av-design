# Acuerdo · filtros de señal en el esquema de conexiones

Este fichero es el contrato de la unidad. Es autosuficiente: una sesión nueva
abierta en `AV_design` puede ejecutarlo sin más contexto que el repositorio.

Aprobado por Sergio el 14-08-2026.

```
Repositorio  C:\Users\sergi\Desktop\Aplicaciones\AV_design
Rama         codex/diagrama-salas
base_sha     89cf22483a3391de92caecb1addb34fbd9ba7d16
Plan origen  .dueto/2026-08-14-filtros-senal-esquema/plan.json
Encargo      .dueto/2026-08-14-filtros-senal-esquema/encargo.md
```

Antes de tocar nada: leer `AGENTS.md`, `design-system/MASTER.md` y
`src/lib/diagrama.ts` completo. El plan fue redactado por Codex en solo lectura
sobre este mismo commit; sus citas se verificaron una a una y son correctas.

## Qué se construye

Un filtro exclusivo de señal sobre el esquema de conexiones que **ya existe** en
la pestaña Cableado. No se crea un diagrama nuevo.

- Vive en la URL: `?senal=video|audio|red`. Misma convención que el conmutador
  `?puertos=todos` que ya usa `EsquemaSala`: enlazable, con botón atrás, sin
  JavaScript.
- Lógica pura y de servidor. No se introduce estado ni manejadores de cliente.
- Sin dependencias nuevas. Sin migración. Sin tocar el esquema ni los datos.

| Filtro | Valores de `senal` |
|---|---|
| Vídeo | `hdmi` |
| Audio | `audio_linea`, `audio_altavoz`, `microfono` |
| Red | `red` |

`usb`, `control`, `alimentacion` y `otro` **no** aparecen en ninguna vista
filtrada; siguen estando en la vista completa.

Motivo de excluir `otro`, verificado en `data/puertos.csv`: marca a la vez DVI,
DisplayPort y DTP. No es una familia funcional, es un cajón de sastre.

## Unidades

Van **en serie**: las dos tocan `construirDiagrama`, así que no se paralelizan.

### U1 · contrato puro del filtro

Ficheros: `src/lib/diagrama.ts`, `src/lib/diagrama.test.ts`

- Tipo `FiltroSenalDiagrama = 'video' | 'audio' | 'red'` y su mapa exacto de señales.
- Normalizador con lista blanca para el valor que llega por URL: cualquier cosa
  que no sea una de las tres cadenas devuelve la vista completa. Nunca se pasa a SQL.
- `construirDiagrama` acepta el filtro como opcional.
- **Los identificadores de cable se calculan sobre todas las conexiones y solo
  después se filtra la escena.** Si se filtrara antes, el cable "3" pasaría a
  llamarse "1" en la vista de vídeo, y esa etiqueta está escrita físicamente en
  una brida en la sala. Este punto es el corazón de la unidad.
- Líneas, omitidas, puertos usados y columnas se derivan de las conexiones
  visibles. Los bloques de todos los equipos se conservan: es un filtro de
  señal, no un filtro de inventario.
- Un puerto usado por una conexión visible sigue siendo el anclaje de la línea
  aunque su señal catalogada discrepe de la de la conexión. Esas discrepancias
  ya existen y producen avisos, no bloqueos (`src/lib/cable-schedule.ts`).
- No se muta la entrada.

Verificación: `node --import tsx --test src/lib/diagrama.test.ts` y `npm run typecheck`.

### U2 · integración en Cableado

Ficheros: `src/app/salas/[id]/cableado/page.tsx`,
`src/components/diagrama/esquema-sala.tsx`,
`src/components/diagrama/esquema-sala.test.tsx` (nuevo)

- Leer `searchParams.senal` y pasarlo al esquema. **Solo al esquema**: la tabla
  de cables, los cálculos, el material y el formulario de conexiones siguen
  recibiendo las conexiones completas.
- Cuatro acciones: Vídeo, Audio, Red y una neutral "Todas las señales".
- Un único helper local compone la URL. Los enlaces de señal conservan
  `puertos`, y el conmutador de puertos conserva `senal`. Orden canónico:
  `senal` y luego `puertos`.
- Navegación con nombre accesible, `aria-current` en la opción activa, clase
  táctil existente. Sin microcopy innecesaria (`design-system/MASTER.md`).

Verificación: `node --import tsx --test src/components/diagrama/esquema-sala.test.tsx`,
`npm test`, `npx eslint src scripts`, `npm run build`.

## Criterios de aceptación

Del 1 al 8 y el 10 y 11 vienen del plan de Codex. El 9 y el 12 son correcciones
introducidas en la revisión.

1. Sin `senal`, o con valor vacío, desconocido o repetido, el esquema conserva la
   vista completa actual y contiene también `otro`.
   → `node --import tsx --test src/lib/diagrama.test.ts`
2. Vídeo produce únicamente líneas `hdmi`; Audio únicamente `audio_linea`,
   `audio_altavoz` y `microfono`; Red únicamente `red`.
   → mismo comando
3. `usb`, `control`, `alimentacion` y `otro` no aparecen en ninguna vista filtrada.
   → mismo comando
4. Los identificadores visibles coinciden con los calculados sobre la colección
   completa, las conexiones ocultas no cuentan como omitidas y no se mutan los
   datos de entrada.
   → mismo comando
5. Un puerto usado por una conexión visible sigue siendo el anclaje de la línea
   aunque su señal catalogada no coincida.
   → mismo comando
6. Las cuatro combinaciones de `senal` presente/ausente por `puertos=todos`
   presente/ausente conservan ambos parámetros al navegar, en orden canónico.
   → `node --import tsx --test src/components/diagrama/esquema-sala.test.tsx`
7. Los tres filtros y la acción de vista completa están dentro de una navegación
   con nombre accesible; la activa lleva `aria-current`; todos usan la clase táctil.
   → mismo comando y `npm test`
8. Una sala sin conexiones y un filtro sin coincidencias muestran mensajes de
   vacío distintos, y los controles de filtro siguen disponibles.
   → mismo comando

9. **(corregido)** La integración sigue siendo de servidor: `esquema-sala.tsx` no
   contiene `'use client'`, `useState`, `useEffect` ni manejadores `on*`.

   El plan proponía comprobarlo con un `powershell -Command "if (rg ...)"`. Se
   descarta: ese comando no está en ningún script de `package.json`, así que no
   lo ejecutaría nadie. Un criterio que nadie corre no protege nada.

   Va como test dentro de `esquema-sala.test.tsx`, que sí corre con `npm test`.
   **El test debe fallar si el fichero no existe**: lee la ruta, afirma que la ha
   leído y luego afirma la ausencia. Una guarda que no demuestra haber mirado
   algo pasa en verde el día que alguien renombra el fichero.
   → `npm test`

10. No se modifica el esquema, las migraciones, los datos fuente ni las dependencias.
    → `git diff --quiet 89cf22483a3391de92caecb1addb34fbd9ba7d16 -- db data package.json package-lock.json`

    Aviso: incluye `package-lock.json`. Si salta, mirar la causa antes de asumir
    que el cambio ha roto algo; un `npm install` ajeno también lo mueve.

11. `npm run typecheck`, `npm test`, `npx eslint src scripts` y `npm run build`
    terminan con código 0 y sin pruebas omitidas.

12. **(añadido)** Cuando un filtro no tiene coincidencias, el vacío indica cuántas
    conexiones quedan fuera y con qué señales.

    Motivo: `conexiones.senal` tiene `default 'otro'` en `db/schema.sql`. Toda
    conexión creada sin elegir señal cae ahí y queda fuera de los tres filtros.
    En el seed no se nota —las cuatro tiradas de plantilla son `hdmi` y `red`—
    pero en las salas metidas a mano puede ser mucho, y un filtro vacío se lee
    como "faltan cables" en vez de como "estos cables no están clasificados".
    → `node --import tsx --test src/components/diagrama/esquema-sala.test.tsx`

## Fuera de alcance

No se implementa nada de esto, aunque esté pedido para más adelante:

- Constructor de conexiones dispositivo → puerto → destino.
- Separar las pestañas Plano y Diagrama.
- Vista de acotación frontal.
- La sala compleja de unos 60 bloques.
- Filtros combinables o multiselección: este ciclo define una sola vista activa.
- Reclasificar `otro`, DVI, DisplayPort o DTP en CSV, TypeScript o Postgres.
- Filtrar la tabla de cables, los cálculos, el material o el formulario.
- Tocar el SVG, la paleta, la tipografía o el layout general.
- Exportación o descarga del esquema.

Lo que aparezca por el camino y sea buena idea se anota en el informe final. No
se implementa.

## Reglas del ciclo

- **La evidencia determinista gana.** Si una revisión dice que algo falla y el
  test, el compilador o el typechecker dicen que está bien, gana la herramienta,
  y se contesta con la salida del comando. Al revés igual: ningún visto bueno
  cierra nada mientras un test falle.
- Nunca se afirma que un test pasa sin haberlo ejecutado y visto pasar.
- Un test que afirma más de lo que comprueba es peor que no tenerlo.
- Commit por unidad: U1 y U2 por separado, más `.dueto/` con el ciclo.
- No se despliega. No se hace `git push` sin pedirlo.

## Cierre

Con U1 y U2 verdes, auditoría independiente con Codex en solo lectura:

```bash
codex exec \
  --sandbox read-only \
  --cd "C:/Users/sergi/Desktop/Aplicaciones/AV_design" \
  -m gpt-5.6-terra \
  -c model_reasoning_effort=medium \
  --output-schema "C:/Users/sergi/.claude/skills/dueto/schemas/auditoria.schema.json" \
  -o ".dueto/2026-08-14-filtros-senal-esquema/auditoria-1.json" \
  "$(cat "$HOME/.claude/skills/dueto/prompts/auditor.md")

base_sha: 89cf22483a3391de92caecb1addb34fbd9ba7d16
Diff a revisar: git diff 89cf22483a3391de92caecb1addb34fbd9ba7d16..HEAD
Criterios de aceptación: los de .dueto/2026-08-14-filtros-senal-esquema/acuerdo.md
Resultado de las comprobaciones: <pegar la salida real de los comandos>"
```

`terra` + medium por la regla de enrutado: el diff toca cinco ficheros, no hay
esquema de datos, ni autenticación, ni concurrencia. Lánzalo en segundo plano.

Se corrige solo lo que traiga fichero, línea y escenario de fallo concreto. Un
hallazgo sin evidencia se descarta **por escrito**, citando el comando que lo
desmiente. Máximo dos vueltas; a la tercera se para y se informa.

Anotar en `.dueto/2026-08-14-filtros-senal-esquema/coste.md` cada llamada:
modelo, esfuerzo, duración y la línea `tokens used` que imprime `codex exec` al
terminar. No detener el proceso antes de que la imprima.

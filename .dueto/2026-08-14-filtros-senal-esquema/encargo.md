# Encargo · filtros de señal en el esquema de conexiones

Fecha: 2026-08-14
Rama: `codex/diagrama-salas`
base_sha: `89cf22483a3391de92caecb1addb34fbd9ba7d16`

## Lo que pide Sergio, literal

> La pestaña diagramas, la cual muestra tres filtros para que enseñen la
> planimetría con el video, el audio y la red.

## Decisiones ya cerradas

Estas no las decide el arquitecto; vienen dadas:

| Filtro | Valores de `senal` |
|---|---|
| Vídeo | `hdmi` |
| Audio | `audio_linea`, `audio_altavoz`, `microfono` |
| Red | `red` |

- `usb` queda fuera de los filtros por ahora.
- `control` y `alimentacion` quedan fuera de los filtros.
- Qué pasa con `otro` es parte de lo que debe resolver el plan, no está decidido.

## Alcance de esta unidad

Solo los filtros sobre el esquema de conexiones que **ya existe** en la pestaña
Cableado (`src/components/diagrama/esquema-sala.tsx`, `src/lib/diagrama.ts`).

Fuera de alcance en este ciclo, aunque estén pedidos para más adelante:

- El constructor de conexiones (selector dispositivo → puerto → destino).
- Separar las pestañas Plano y Diagrama.
- La vista de acotación frontal.
- La sala compleja de ~60 bloques.

## Contexto del proyecto

- Instrucciones: `AGENTS.md` (el `CLAUDE.md` solo lo incluye), `README.md`,
  `design-system/MASTER.md`.
- Roadmap: `docs/07-roadmap.md`. Este encargo es un paso previo a R3.
- Convención ya establecida en el esquema: el conmutador
  "solo puertos con cable / todos" viaja en la URL (`?puertos=todos`), no en
  estado de cliente, para que se pueda enlazar y funcione sin JavaScript.

## Comandos de verificación

```
npm run typecheck
npm test
npx eslint src scripts
npm run build
```

Nota: `npm run lint` recorre además directorios de build y devuelve ruido
preexistente; para este ciclo vale `npx eslint src scripts`.

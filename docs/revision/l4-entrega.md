# L4 · Entrega

Fecha: 2026-09-09. Ejecutor L4. Corrección ronda 2. No es una autoaprobación del gate.

## Corrección ronda 2

P0/P1 del revisor, reproducidos y cerrados:

1. `perfilEquipo` ya no trata WEBEX ROOM BAR PRO como integrado. Solo el canónico `ROOM BAR PRO` puede serlo por nombre, y `captacionDeVoz` lo deja en `parcial`. WEBEX sin hechos es `desconocido`.
2. `DatosEquipo` no pinta `perfil.nota` ni `perfil.fuente` si la captación es desconocida o `sin_documentar`. WEBEX no muestra «Micrófono integrado» ni el PDF de Cisco.
3. El ensayo que exigía WEBEX integrado por nombre se sustituyó: WEBEX sin hechos = desconocida.
4. Equipamiento calcula metros con `articulosPorIds` solo de los `articulo_cable_id` de esa sala. `comercial` deja de ser siempre null. 10 m vs 40 m sale en `AvisosTecnicos`.
5. Si `/hechos` falla se enseña el error y se fuerza un hecho `sin_documentar` de sesión: no se reconstruye la captación por nombre.
6. El semáforo degrada el punto `cable` ante `cable_comercial_insuficiente` / `cable_insuficiente`. Material, reservas y carga no se tocan.

## Qué cambió y por qué (ronda 1, conservado)

Ayudar a completar un montaje sin convertir hipótesis en certezas.

- Tres filas de `data/fichas-tecnicas.csv` documentan ROOM BAR PRO (captación integrada verificada y límite de 4 m) y dejan WEBEX ROOM BAR PRO como `sin_documentar`. No se unifican alias. El CSV del proyecto exige `concepto` y `puerto_fuente` además de las columnas de la propuesta: se añadieron `Captación de voz` / `Alcance de la captación integrada` y celdas vacías de puerto. `npm run seed` las volcó a `db/seed.sql`.
- `captacionDeVoz` manda sobre `perfilEquipo`. Un hecho `sin_documentar` gana al nombre. Un reconocimiento por modelo es `parcial`. Quad Camera, MICRO BEAMTRACKING, receptores y controles de microfonía no cuentan como captación de voz.
- `revisarSeleccion` emite `AvisoSeleccion` con clave, causa, elemento (`equipo_id`) y acción. `avisosEquipamiento()` sigue siendo fachada de strings.
- `revision-tecnica.ts` cubre bocas por equipo/puerto/ordinal, cable necesario vs comercial/suministro, fichas, conexiones y posición. Histórico sin ordinal: pendiente, no ocupación comprobada. `ajustarALongitudComercial(40,[1,2,3,5,10])=10` no acredita 40 m.
- `revision.ts` no añade un segundo semáforo: degrada catálogo, equipamiento, conexiones o cable cuando llegan avisos L4 de ficha ausente, posición sin confirmar, cero conexiones o cable corto. Material, reservas y carga no se tocan.
- UI: `AvisosSeleccion` / `AvisosTecnicos` pintan causa, elemento (enlace `#equipo-{id}`) y acción, con `aria-live="polite"` y tokens existentes.
- La pestaña de equipamiento pasa conexiones, hechos acotados por IDs y metros con un mapa solo de los cables de esas tiradas (`articulosPorIds`). El candidato carga hechos por `/api/catalogo/[id]/hechos`; no se deduce CISCO del prefijo de la etiqueta.
- Formularios: rechazo de guardado (`ErrorConcurrencia`) conserva selección y nombre; un fetch de puertos fallido no es ese rechazo.

## Comandos ejecutados

```
node --import tsx --test src/lib/asistente-equipamiento.test.ts src/lib/revision-tecnica.test.ts src/lib/revision.test.ts src/components/asistente-equipamiento/alta-equipo.test.tsx src/components/sala/equipamiento.test.tsx
```

Ronda 2: `tests 67`, `pass 67`, `fail 0`, código de salida 0. Incluye los ensayos que fallarían si WEBEX pintara integrado o si 10 m vs 40 m no avisara.

```
npm run seed
```

Salida: `seed.sql generado`, código de salida 0. Incluye las tres filas de Room Bar Pro.

```
npx tsc --noEmit
```

Código de salida 1. Fallos ajenos al radio L4 (`scripts/verificar-carga-kits.mts`, `src/components/almacen/reservas-suministro.test.tsx`). Ningún error en los ficheros de esta unidad.

No se ejecutó `npm test` completo, `db:reset` ni Docker QA. Navegador no ejecutado.

## Seis ensayos

| Ensayo | Dato verificable |
|---|---|
| Kit/Codec EQ sin micro | Fila CSV `CISCO;CODEC EQ;microfonia;…;verificado;{"captacion":"externa"}`. `captacionDeVoz` sale `externa` / `verificado`. Aviso `captacion_ausente` con `equipo_id` y acción. Quad Camera y MICRO BEAMTRACKING no lo apagan. |
| Barra integrada | Filas CSV ROOM BAR PRO `captacion-voz` integrada verificada y `alcance-captacion-integrada` con «4 m». No hay `captacion_ausente`. Hay `captacion_restringida` con el límite. |
| WEBEX / ficha desconocida | Fila CSV WEBEX ROOM BAR PRO `sin_documentar` / `null`. Captación `desconocida`; no hereda integrado. Un modelo no reconocido también es desconocida, no ausencia. |
| Videoconferencia duplicada | Un aviso `videoconferencia_duplicada`, `elemento.equipo_id` del ya puesto, acción «Revisar el equipo ya seleccionado», enlace `#equipo-{id}`. El botón Añadir no se deshabilita. |
| Puerto agotado | Dos bocas HDMI del mismo equipo, ordinales 1 y 2 ocupados → `bocas_agotadas` verificado (`2 de 2`). Conexión histórica sin ordinal → `bocas_sin_ordinal` pendiente, no agotado. |
| Cable insuficiente | `ajustarALongitudComercial(40,[1,2,3,5,10])===10`. Comercial 10 m vs 40 m → `cable_comercial_insuficiente`. Suministro 11 m vs 40 m → `cable_insuficiente`. Sin longitud documentada → pendiente, no suficiencia. |

## Ficheros tocados

- `data/fichas-tecnicas.csv`
- `db/seed.sql` (solo vía `npm run seed`)
- `src/lib/asistente-equipamiento.ts`, `src/lib/asistente-equipamiento.test.ts`
- `src/lib/revision-tecnica.ts`, `src/lib/revision-tecnica.test.ts` (nuevo)
- `src/lib/revision.ts`, `src/lib/revision.test.ts`
- `src/lib/datos-ficha-tecnica.ts`, `src/lib/datos.ts` (`articulosPorIds`, lectura acotada)
- `src/components/asistente-equipamiento/asistencia.tsx`, `alta-equipo.tsx`, `alta-equipo.test.tsx`
- `src/components/sala/equipamiento.tsx`, `equipamiento.test.tsx`
- `src/app/salas/[id]/equipamiento/page.tsx`
- `src/app/salas/[id]/datos-ficha.ts`
- `src/app/api/catalogo/[id]/hechos/route.ts` (nuevo; ver huecos)
- `docs/revision/l4-entrega.md`

No se editaron `ficha-tecnica.ts`, `sql-datos-tecnicos.mts` ni `generar-seed.mjs`: el esquema y el generador ya aceptaban estas filas.

## Huecos / cambios en ficheros ajenos

No editados. Quedan fuera del radio:

1. `src/lib/tipos.ts` y `buscarArticulos`: el buscador sigue sin devolver marca y modelo por separado. El candidato usa la etiqueta como modelo y carga hechos por id.
2. `src/app/acciones.ts` (`anadirEquipo`): el SELECT del catálogo sigue sin exigir activo/`tipo='equipo'`.
3. `src/app/api/catalogo/[id]/hechos/route.ts` no estaba en la lista de dueño original. Sigue siendo el contrato acotado del candidato.
4. P2 no cerrados: elemento en avisos como `referencias_repetidas`; ampliar ArticuloElegible; flash breve de perfil mientras cargan los hechos (solo el fallo queda bloqueado).

## Límites

- Navegador real no ejecutado; no hay QA propio de L4 en localhost.
- No se autoaprueba L4. Esta entrega es artefacto + evidencia de pruebas de dominio y componente.
- `npx tsc --noEmit` no está verde en el árbol por fallos B2c ajenos.
- Seed regenerado en ronda 1; esta ronda no lo volvió a generar.
- No se aplicó a ninguna base compartida ni a producción.

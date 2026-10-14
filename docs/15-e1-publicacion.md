# E1 · Preparación del commit y push, 14-10-2026

Sergio autoriza commit y push de la entrega E1 después de su revisión local.
La publicación se prepara en `feat/e1-documentos`, desde `origin/main`
actualizado `adacf0eaf4f07390bd15c335ec394aceeff9a4b0`. La diferencia de esa
base respecto a la implementación original es únicamente `.mcp.json`.

Worktree: `/Users/sergio/Desktop/Aplicaciones/Xtenav/.worktrees/av-design-e1-publicacion-20261014`.
La rama propia evita el despliegue automático de Render asociado a `main`.
No se hace merge a main, despliegue ni migración de producción.

## Alcance publicado

PDF técnico, BOM/cables XLSX/CSV y ZIP de sala/obra, incluida la corrección
revisada de recuperación tardía del paquete. Fuentes de producto tomadas de
la entrega final E1 y del inventario inicial de sus archivos; se conservan las
fórmulas existentes y todos los permisos/snapshots de la entrega revisada.

El lector `datos-material-bom.ts`, la entrada opcional de `necesidadDeSala` y
su prueba son dependencias mínimas de compatibilidad: Documentos incluye las
partidas adicionales si existe su tabla y funciona sin ella. No introduce la
importación, no crea filas ni modifica las pantallas operativas de E2. No se
publican los módulos, endpoints, pantallas, schema ni migraciones de E2.

Los cambios locales concurrentes de AV_design siguen en su checkout principal.
Los informes 10, 11 y 14 conservan el estado y las evidencias de sus iteraciones;
las referencias a "sin commit" y los fallos E2 de aquel snapshot son históricos.
Este documento registra la selección exacta preparada ahora para publicar.

## Verificación de la selección exacta

Artefactos locales de esta rama en `output/e1-publicacion/` y
`output/e1-documentos/`, ignorados en Git:

| Comando/gate | Resultado |
|---|---|
| `npm test` | 695/695, 146 suites, sin fallos ni omitidas |
| `DATABASE_URL= npm run build` | Exit 0, Turbopack, sin BD |
| `npm run typecheck` | Exit 0 |
| ESLint de todas las fuentes/scripts/tests de E1 afectados | Exit 0 |
| Gate Postgres y archivos reales | Exit 0, 38 tablas sin mutación; totales, tipos, CSV/ZIP/manifiesto/hashes y fallo parcial |
| Playwright Documentos sobre la rama exacta | 3/3, escritorio y permisos antes de móvil; ocultar equipamiento no cambia la exportación |
| `git diff --check` | Exit 0 |

Fixture exclusiva E1: base `av_design_e1_prueba`, usuario `av_design_e1`,
loopback:5545. App de validación de publicación en `localhost:3104`.
No se consulta una BD real. Las pruebas temporales de permiso/concurrencia
restauran la fixture; las exportaciones no escriben diseño, reservas o stock.

Los generadores PDF/XLSX/CSV/ZIP de producto son idénticos a los de la última
revalidación de E1, cuyo render completo, apertura nativa Excel y revisión
independiente se conservan en el worktree anterior. La selección limpia
elimina los módulos E2 que causaban los fallos globales del snapshot mixto;
no se ocultan ni omiten sus tests: simplemente no pertenecen a esta entrega.

## Qué sigue

E2 ya dispone de una entrega local separada en el checkout original:
`docs/14-e2-entrega-local.md`. Importaciones BOM/catálogo y tarifas, datos
tecnicos y favoritos personales. Una repetición actual de `npm test` sobre
ese checkout pasa 734/734; el estado local no equivale a publicación ni a
migraciones en producción. Sus fuentes y evidencias se conservan aparte.

El siguiente bloque de implementación de la investigación es E3:
AVX-06 revisiones/diff, AVX-07 ordenación del diagrama, AVX-08 anotaciones y
leyenda, AVX-13 duplicación/alternativas sin copiar hechos de obra. Después
quedan E4 entrega técnica/activos/revisión, E5 pilotos de ingeniería, E6
planificación/campo, E7 presupuestos/propuestas y E8 IA con fuentes y revisión.
Los pilotos opcionales no se implementan en un solo lote.

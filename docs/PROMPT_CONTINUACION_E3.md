# Continuar AV_design después de E1 y E2

Quiero continuar AV_design con **E3 — Revisiones, reutilización y editor de
diagramas**, en modo arquitecto-ejecutor con subagentes. E1 y E2 están
implementadas, verificadas y revisadas localmente. No repitas investigación
Xtenav ni rehagas lo que ya funciona. Continúa hasta una entrega local concreta,
verificada y revisada; no te quedes en un plan.

Proyecto: `/Users/sergio/Desktop/Aplicaciones/AV_design`.
Investigación: `/Users/sergio/Desktop/Aplicaciones/Xtenav`.
Base de continuación: rama **`codex/e1-e2-local`**, publicada en
`https://github.com/Sergiom84/av-design/tree/codex/e1-e2-local`.
No uses el `main` antiguo como si contuviera estas entregas.

## Lectura inicial

1. AGENTS.md y CLAUDE.md completos; guías pertinentes de la versión instalada
   de Next en node_modules/next/dist/docs/ antes de escribir código.
2. docs/10-e1-especificacion.md y docs/11-e1-entrega-local.md.
3. docs/12-e2-especificacion.md y docs/14-e2-entrega-local.md.
4. docs/07-roadmap.md, design-system/MASTER.md y este prompt.
5. Xtenav/INFORME.md, research/comparison-backlog.md y .json: conservar las ocho
   entregas como contexto y leer íntegros E3, AVX-06, AVX-07, AVX-08 y AVX-13.
6. research/av-design-baseline.md y .json: son anteriores a E1, contrastarlos
   con el código actual, sin repetir scraping, navegación ni extracción.
7. /Users/sergio/.agents/skills/subagentes/SKILL.md.

No cargar Evidence REA completo salvo una pregunta concreta imprescindible;
no modificar la cuenta Xtenav, sus muestras o sus datos de prueba.

## Comprobar Git y conservar trabajo

Ejecuta git status --short --branch, git rev-parse HEAD, git log -3 y
git diff --stat. Comprueba la rama remota y su SHA antes de tomarla como base.
E1/E2 se publican juntas en un commit de la rama codex/e1-e2-local, basado en
adacf0e (main remoto que sólo añadió .mcp.json sobre f38baa8). No asumir un SHA:
resolverlo con Git y contrastarlo con la rama publicada.

El push de esta rama **no mueve main ni autoriza un despliegue**. Main tiene
Render con autodespliegue; no fusionar ni publicar allí durante E3. Los informes
E1/E2 documentan el estado histórico previo a su commit; no confundir esas
fechas con el Git actual ni con producción.

Conservar cualquier cambio posterior a E1/E2. No reset, restore, clean ni
checkout que borre trabajo. Si otro trabajo ocupa el checkout, usar una rama/
worktree aislados con la base correcta y snapshot de cambios locales cuando
proceda. Nunca crear un worktree de HEAD antiguo y dar E1/E2 por recuperadas.

## Lo entregado y su aceptación

E1: PDF vectorial con escala/cajetín/paginado, BOM/cables XLSX/CSV, ZIP con
manifiesto y lectura consistente de una revisión, propiedad/permisos,
retención temporal 30 min. Máximo20 salas,50MiB y200páginas/PDF. Conserva las
regresiones de recarga parcial, nombres largos y colisión de nombres ZIP.

E2: CSV/XLSX revisables de catálogo, BOM adicional y ofertas, matching literal,
selección explícita, lotes durables/original/hash e inversa atribuible. BOM no
crea equipos/posiciones/conexiones. Precio vigente y EUR/USD parametrizados;
app/CSV protegidos. Técnica parcial con procedencia, bytes Postgres, dimensión
congelada/ausencia en equipo/plantilla, búsqueda verificada. Favoritos personales
reversibles y explicados, sin alterar obra.

Estado local verificado 14-10-2026: **734 pruebas/151 suites**, cero fallos u
omitidas, build Webpack sin BD, tipos/lint, **4/4 E2E**, escritorio antes de móvil.
E1 conservada: 16PDF/86páginas/25contactos inspeccionados y XLSX reabiertos;
288 artefactos históricos idénticos. E2 revisión independiente detectó P2 en
imágenes corruptas y dos brechas de gates; una corrección conjunta cerró los
tres: decoder real acotado y rechazo sin sustituir imagen válida, siembra
sintética conflictiva app/CSV y reversión con dependencias/ABA/coste posterior.
No producción verificada ni migraciones de producción aplicadas.

## Evidencia y bases locales

Evidencia ignorada en Git: output/e1-documentos/ y output/e2-importacion/.
No viaja con un clon o worktree; conservarla y recuperar primero los informes
versionados si no está disponible. En este Mac están el informe independiente,
artefacto final/manifiesto y cierre en output/e2-importacion/revision/;
comandos completos en output/e2-importacion/gates/README.md y tanda-final/.

BD de prueba E2: av_design_e2_prueba, usuario av_design_e2, loopback5546,
contenedor av_design_e2_prueba_20261014_db. App de prueba localhost3103,
caché .next-e2-reanudacion. El contenedor original av_design_e2_prueba_db está
detenido y comparte volumen con el nuevo: **no arrancar ambos**. 5545/3102
estaban ocupados por trabajo ajeno; no asumirlos libres ni tocar ese trabajo.
No depender de servidores/contendedores aún vivos: comprobar destinos y puertos.

Las migraciones E2 importacion/tecnico/favoritos están versionadas e incluidas
en db/schema.sql, aplicadas sólo en prueba. El rollback estructural rechaza
datos E2/snapshots/favoritos existentes; inversa de lote no borra historial.
No aplicar estas migraciones ni backfills a producción durante E3. No ejecutar
seed/reset habituales por comodidad. CSV de data/ y db/seed.sql reales intactos.
Sharp0.35.3, ExcelJS, PDFKit y fflate ya están declarados; justificar cualquier
nueva dependencia. Mantener el framework y sus avisos previos fuera del alcance.

## Alcance E3

Implementar AVX-06, AVX-07, AVX-08 y AVX-13 con sus criterios exactos del backlog:

- Separar diseño versionado de hechos operativos. Diseñar historial/snapshot,
  restauración y diff sin retroceder stock, reservas, compras, cargas, hitos o
  activos. Las entregas deben identificar una revisión consistente.
- Alinear/distribuir/ordenar sobre el editor existente; mantener separados
  plano físico y diagrama lógico. No sustituir medidas por posiciones visuales.
- Anotaciones/símbolos/leyenda coherentes, con permisos y presencia comprobada
  en los entregables E1. No añadir una representación paralela que se desincronice.
- Duplicar/comparar alternativas de sala sin copiar hechos operativos ni pisar
  plantillas. Preservar geometría, puertos/cables, IDs y ausencias según contrato.

Recupera el código actual y redacta una especificación breve antes de construir:
qué se versiona, qué no, concurrencia/revisión, duplicación, diff/restauración,
permisos, entregables afectados, migraciones, errores y gates. No abrir E4–E8.
No improvisar reglas de negocio que el backlog deje pendientes: preguntar sólo
una decisión imprescindible y continuar el trabajo independiente.

## Método y autorización

Arquitecto descompone unidades con propiedad de archivos sin solaparse.
Ejecutores implementan y aportan evidencia cruda. Revisor independiente recibe
únicamente artefacto, contrato y comandos/salidas, sin razonamiento del autor.
Una implementación, una revisión, una corrección y gate determinista; no bucles
ilimitados. No preguntar a mitad si debes continuar.

Autoriza cambios locales y dependencias necesarias, migraciones versionadas y
escrituras sólo en una **nueva BD de prueba aislada e identificada**, con fixture
sintética PRUEBA-REV-01 (o la que concrete la spec). Verificar host/puerto/usuario
y current_database antes de cualquier escritura. Nunca resetear la base habitual,
modificar inventario real, ofertas reales ni los hechos de una obra para probar.

No commit, push, merge a main, despliegue, publicación, migraciones de producción,
cambios de credenciales reales ni datos enviados a clientes/servicios externos.

## Gates y entrega

Fixtures sintéticas reproducibles: historial/diff/restauración coherentes,
concurrencia y rollback, duplicación sin hechos operativos, matriz grande legible,
antecedentes y anotaciones incluidas en PDF. Verificar guardas en servidor,
permisos retirados en la petición siguiente, propiedad y obras cerradas/legado.

Reusar checks E1/E2 afectados, incluidos siembraapp/CSV, imágenes corruptas,
reversión con dependencias/ABA, JSONnull de dimensiones y stock contado una vez.
No aceptar sólo builds o una afirmación del autor: recorrer navegador escritorio
completo, móvil al cierre, generar/renderizar/inspeccionar exportaciones afectadas.

npm test, build Webpack sin BD, typecheck/lint/checks pertinentes y gitdiff limpio.
Guardar snapshots antes/después, comandos, capturas, fuentes sintéticas, archivos
exportados y resultados crudos sin sobrescribir las evidencias E1/E2.

Entrega final: cambios por archivo y por qué, criterio AVX cumplido/pendiente,
validaciones verificadas por arquitecto, revisión y corrección, migraciones de
prueba/rollback, límites, ruta/rama/SHA/estado Git. Separar local, push y producción.

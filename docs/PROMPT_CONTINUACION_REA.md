> **Publicación autorizada ·16-10-2026.** Sergio autorizó después del cierre local el commit, push de `codex/rea-integracion` y las migraciones necesarias de BD. Neon ya tiene las14 migraciones,104tablas y1357filas previas conservadas. Estado, mejoras y pasos de despliegue en [30-rea-publicacion.md](30-rea-publicacion.md). Render sigue en `main`/`adacf0e`; autoDeploy está activado. Esta autorización sustituye para esta entrega la prohibición Git/BD de los registros anteriores; no incluye merge a main ni despliegue.

> **Cierre vigente ·16-10-2026 · July285.** REA10 y la integración están **aceptadas localmente dentro de sus contratos y límites documentados**. La ronda adicional de serialización está aplicada y verificada: catálogo/ofertas guardan, recargan, generan preview y confirman con200; recuperación503 y rebase explícito; cuatro destinos completos en escritorio antes de móvil390. Suite1112/1112; Webpack sinBD, tipos, lint66 y diff-check con exit0. Revisión independiente sin hallazgos. Cierre y evidencias en `docs/29-rea-entrega-local.md` y `output/rea-integracion/rea10/serializacion-ronda-adicional-20261016/raiz/aceptacion-root.json`. No hay unidad REA pendiente en este programa local: **no reaplicar el parche ni relanzar07B/08/09 o prompts históricosE2/E3**. Sin commit, push, merge, despliegue ni producción. Las entradas inferiores conservan su fecha como historia y no reabren trabajo.

> **Relevo anterior (histórico) ·16-10-2026.** REA07B/08/09 cerradas localmente. REA10: los seis hallazgos originales están corregidos; el gate completo de interfaz sigue rojo por PATCH400 de catálogo/ofertas (revisión BIGINT enviada como texto). Sergio autorizó una ronda adicional y pidió una instrucción aparte para liberar contexto. **Parche SIN APLICAR; continuación únicamente por `docs/CONTINUACION_REA_RONDA_ADICIONAL.md`.** Suite1106/1106, build sinBD, tipos/lint y regresiónE2 verdes no equivalen a aceptar ese flujo. No repetir unidades cerradas ni prompts históricos; sin Git/producción. Los bloques inferiores son historia.

> Actualización 16-10-2026 11:26 UTC: REA07B/08/09 aceptadas localmente. Primera revisión independiente de REA10 terminada: seis hallazgos consolidados y única corrección conjunta en curso. B01/B03/B04 y testigo durable B02 tienen pruebas de autor verdes; UI y gate selectivo original pendientes. El puente09–10 pasa19controles SQL y cinco pasos Chrome. Suite1087/1087 corresponde al candidato anterior a esta corrección; falta corte final. Sin aceptación global ni cambios Git/producción. Detalle en `docs/29-rea-entrega-local.md`; los estados inferiores se conservan como historia.

> Actualización 16-10-2026 10:42 UTC: REA07B y REA09 aceptadas localmente tras sus gates selectivos independientes de la única corrección conjunta de cada unidad. Evidencia: `output/rea-integracion/revision/rea07b/correccion-20261016/` y `revision/rea09/correccion-20261016/`; aceptaciones de raíz en las carpetas de corrección. REA08 sigue aceptada. REA10 e integración09-10 y gate global continúan activos. Los estados anteriores de revisión pendientes se conservan como historia.

> **Reanudada por Sergio ·16-10-2026, July282.**08 cerrada localmente;07B única
> corrección de paginación congelada pendiente de gate;09 única corrección en gate
> selectivo;10 runtime en construcción, sin adaptador09 integrado ni revisión10.
> Leer el relevo16oct y la entrada vigente de ESTADO_ACTUAL/17 antes de otra
> continuación. La ejecución actual tiene un único coordinador, sin aceptación
> global ni permiso para Git mutante o producción.

# Continuar AV_design · integración REA

Punto de entrada vigente desde el 15-10-2026. Programa **en ejecución**; este
prompt no acredita su finalización.

Continúa autónomamente la integración de las mejoras útiles detectadas por
ClonerSoft/REA en AV_design, en modo arquitecto-ejecutor con subagentes, hasta
una entrega local implementada, verificada y revisada de forma independiente.
Reconciliar E1 y clasificar candidatos son partes del trabajo; el objetivo
incluye implementar las mejoras útiles que falten. Conserva E2 y E3.

## Recuperar el estado real

1. Trabaja únicamente en `/Users/sergio/Desktop/Aplicaciones/AV_design`.
   Sigue su [AGENTS.md](../AGENTS.md) y recupera el contrato activo en
   [17-integracion-rea.md](17-integracion-rea.md).
2. Consulta [18-rea-cobertura.md](18-rea-cobertura.md) y su
   [registro JSON](18-rea-cobertura.json): candidatos, utilidad, estado real,
   dependencias y criterios de aceptación. Contrasta la unidad activa con sus
   fuentes y evidencias; una fila clasificada no demuestra implementación.
3. Comprueba `git status --short --branch`, `git rev-parse HEAD`, `git log -3`
   y `git diff --stat`, además de los archivos nuevos pertinentes. La rama de
   integración es `codex/rea-integracion`, iniciada desde
   `7ba796077ff39e799b9b7eb87109b648c3df5c2d`. No supongas que ese SHA o una
   copia auxiliar contienen todos los cambios posteriores del checkout.
4. Recupera July con proyecto `av-design` y sesión
   `av-design-rea-integracion-2026-10-15`. Contrasta lo recuperado con los
   documentos y Git actuales. Si July no está disponible, continúa con las
   fuentes locales y deja registrado qué actualización de memoria queda por
   sincronizar; no dependas de otro chat ni de un servidor anterior.

Lee después sólo los contratos, guías y archivos necesarios para la unidad
activa. Antes de escribir código Next, consulta la guía pertinente de la versión
instalada en `node_modules/next/dist/docs/`. Si falta el registro de cobertura,
recupéralo desde el snapshot o las evidencias locales antes de dar candidatos
por descartados; continúa mientras tanto las unidades con contrato suficiente.

## Una implementación, varias fuentes conservadas

E1/E2 están en la base indicada; E3 se entregó como cambios locales descritos en
[15-e3-especificacion.md](15-e3-especificacion.md) y
[16-e3-entrega-local.md](16-e3-entrega-local.md). Los prompts E2/E3 y sus
exclusiones de alcance son históricos. La autorización actual cubre todas las
mejoras REA útiles: no rehagas E1/E2/E3 ni descartes un candidato sólo porque
antes figuraba como opcional o pertenecía a E4–E8.

La rama auxiliar `feat/e1-documentos` (`d38d9a3`) aporta correcciones para
comparar y portar individualmente. No sustituye la aplicación actual ni permite
sobrescribir las ampliaciones E2/E3. El snapshot previo está en
`output/rea-integracion/base/`; conserva también los cambios posteriores. No
uses `reset`, `restore`, `clean` o cambios de checkout que descarten trabajo.

`/Users/sergio/Desktop/Aplicaciones/Xtenav` conserva investigación y worktrees
auxiliares. Su baseline es anterior a E1: úsala como antecedente, no como estado
actual. No implementes allí otra copia, no reinicies extracción ni navegación
XTEN-AV salvo una pregunta concreta imprescindible sin evidencia. No copies
sesiones, endpoints privados, scripts ni supuestos comerciales del producto.

## Ejecutar por unidades verificables

El arquitecto contrasta contrato/código/evidencia, descompone por dependencias y
asigna archivos sin edición simultánea. Cada diferencia E1 se registra como
portada, ya cubierta u obsoleta con motivo. Cada candidato REA se cierra mediante
una mejora implementada y verificada, una capacidad existente verificada o una
exclusión concreta por no aportar mejora. No basta una lista de ideas ni la
presencia de un archivo.

Continúa con las unidades útiles pendientes de cobertura, preservando dominio,
permisos, IDs de cable, ausencias, geometría, diseño frente a hechos operativos,
datos fuente y entregables E1/E2/E3. Define antes los criterios de la unidad,
concurrencia, datos, errores y pruebas pertinentes. Los cambios en archivos
compartidos se integran secuencialmente. El revisor independiente recibe
artefacto, contrato y evidencia cruda; tras la corrección conjunta se ejecuta el
gate determinista. No declares aceptación si quedan fallos sin resolver.

## Datos y límites de autorización

Toda escritura de prueba usa una **nueva base sintética local**, con URL,
host/puerto, usuario y `current_database()` verificados antes de escribir. No
uses `.env.local` como destino, las bases históricas E1/E2/E3, el inventario
habitual ni `db:reset`. Comprueba puertos y procesos; si un servicio anterior no
está disponible, prepara uno aislado sin tocar servicios ajenos.

Guarda la evidencia nueva en `output/rea-integracion/`, con unidades/tandas
identificadas, sin sobrescribir las pruebas históricas. No hagas commit, push,
merge a main, despliegue, migraciones ni escrituras de producción, ni cambios de
credenciales reales. No envíes datos a terceros.

## Verificar y mantener la continuidad

Ejecuta las pruebas pertinentes y las regresiones E1/E2/E3 afectadas, build
Webpack sin BD, tipos/lint y `git diff --check`. Las pruebas de Postgres van a
la nueva base sintética. El recorrido funcional visual empieza en escritorio y
cubre el flujo completo; móvil va al final. Si cambian PDF/XLSX/CSV/ZIP, genera
los archivos reales, reabre e inspecciona texto, cantidades y renders afectados.

Actualiza el estado de cada unidad y su evidencia en el contrato/cobertura; al
cambiar de contexto guarda en July y en los documentos locales lo implementado,
comprobado, pendiente, riesgos y siguiente unidad concreta. No atribuyas a la
ejecución actual pruebas históricas ni una actualización de memoria no realizada.

Continúa las unidades autorizadas sin pedir de nuevo permiso para avanzar.
Una duda local no impide trabajar en unidades independientes. El cierre global
exige cobertura completa justificada, mejoras útiles verificadas, revisión
independiente y evidencia reproducible; hasta entonces el programa sigue **en
ejecución**. La entrega distingue estado local, Git y producción, e indica
rama/HEAD, cambios, migraciones sintéticas, validación y limitaciones.

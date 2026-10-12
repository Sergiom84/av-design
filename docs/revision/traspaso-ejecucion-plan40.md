# Traspaso de ejecución del plan 40

**Corte: 08/09/2026. Parada solicitada por Sergio para continuar en otra conversación.**
No iniciar otro lote en esta conversación. No hacer operaciones Git ni producción.
Los tres subagentes han finalizado y confirmado que no escribirán más. No queda
ninguna prueba propia activa. El cierre es un checkpoint preservado, **no un gate
verde de L2B**. Hay correcciones locales aún sin ejecutar, enumeradas abajo.

## Objetivo completo y autoridad

Implementar `docs/40-plan-implementacion-y-revision.md`: diseño de salas desde cero
o plantilla, catálogo técnico documentado, conexiones físicas y metros fiables,
kits sin doble compra, selección asistida, compras/almacén/seguimiento coherentes,
entregable técnico y recorrido completo con dos usuarios. Preparar publicación;
ejecutarla solo con autorización posterior explícita.

Directorio a continuar: `C:/Users/sergi/Desktop/Aplicaciones/AV_design`.
Continuar **sobre este árbol local**, que ya tenía numerosos cambios antes de la
ejecución. No crear un checkout limpio ni restaurar desde HEAD. Último estado Git
conocido antes del cierre: rama `codex/diagrama-salas`, HEAD
`f38baa805a1868b7cad55bb97064386e9b5f8555`. No se volvió a consultar Git para este
traspaso y no se hicieron commit, stash, checkout, push ni despliegue.

Leer este documento, plan 40, AGENTS.md y `docs/revision/estado-plan40.md`.
Skill solicitada: `C:/Users/sergi/.agents/skills/subagentes/SKILL.md`.
Director arquitecto; dos ejecutores como máximo, reparto por radio funcional.
Un solo dueño de BD/generador; pruebas SQL siempre seriales y en bases UUID propias.
Revisor recibe artefacto + contrato + evidencia, sin razonamiento del autor.
Máximo dos rondas; tercera solo por seguridad/integridad/migración según contrato.

## Estado real y aprobaciones

| Lote | Implementación y aprobación | Pendiente |
|---|---|---|
| L0 | **Aprobado**, base preservada y reproducida | Mantener preservación y regresión |
| L1 | **Aprobado**: L1A puertos CSV; L1B hechos técnicos/fuentes/ficha | No equivale a documentar todo el inventario físico ni al asistente L4 |
| L2A | **Aprobado**: bridas persistentes, correlativo atómico, lectores y UI | Preservar etiquetas y compatibilidad al cerrar L2B |
| L2B | Implementación local de rosetas/extremos, lectores, SQL, servidor, copias y UI; revisiones parciales | **NO aprobado**. Fallos de verificadores y gate final pendientes |
| L3 | **Diseño aprobado**, manda precisión final de `l3-diseno-previo.md` | Sin implementación aprobada; `l3-contrato-ejecucion.md` es preparación documental solamente |
| L4 | Asistente/perfiles previos existentes | Integración hechos L1/kits L3 y seis casos de aceptación |
| L5 | Compras/almacén/seguimiento previos existentes | Reparto/cobertura, devoluciones, snapshot íntegro y vigencia de aceptación |
| L6 | Documentos actuales existentes | Esquema completo imprimible y examen de todas las páginas pequeña/densa |
| L7 | QA parcial por lotes | Los 16 pasos UI con proyectista y técnico distinto, escritorio antes de móvil |
| L8 | Evidencias locales | Candidato, restauración/migración local, runbook y autorización separada de publicación |

**L3–L8 siguen pendientes. No empezar L3 antes de cerrar y revisar L2B.**

Tarea revisora: **«Mejora el flujo de diseño»**, ID
`01a07f5b-56ed-7bb3-8295-766f2d4d5057`. La comprobación directa de cierre devuelve
estado `idle`, último turno `01a080d8-783d-7681-999b-7491f771b281` completado sin
error. Que haya terminado esa conversación no significa que haya terminado el
plan ni que L2B esté aprobado. Ejecución de origen:
`01a07fb9-0d29-7462-a2e2-111c3569b7ae`.

## Decisión del revisor sobre las cuatro tiradas CSV

Las cuatro filas sin bocas de `data/plantillas-tiradas.csv` se conservan como
**documentación pendiente de plantilla**, separadas de conexiones físicas.
No crear nuevas conexiones `legacy`, no inventar extremos, no elegir la primera
boca ni deducir puertos por categoría/señal. **La plantilla no puede aplicarse
mientras tenga tiradas sin resolver**; el rechazo revierte la copia entera.

Implementado localmente mediante `plantilla_tiradas_documentales`, con los ocho
campos originales como texto exacto, incluso vacíos. El CSV solo añade claves
estables `tirada-001`…`tirada-004`. `conexion_resuelta_id` enlaza explícitamente
una conexión completa de la misma plantilla. Estado derivado del vínculo y de
sus extremos; no booleano manual. Una conexión histórica se completa conservando
su UUID, nunca duplicándola. Si cambia la fuente de una documental ya resuelta,
la siembra rechaza y pide revisión en vez de sobrescribirla.

Contrato y decisiones en `l2b-tiradas-documentales.md`. Hay evidencia 6/6 y
causales de esta unidad; **no aprueba el conjunto L2B**.

## Arquitectura L2B que no debe perderse

- `Conexion.detalle` obligatorio: `legacy` o `completo` con dos extremos tipados.
  Equipo = equipo/puerto/ordinal exactos; roseta = UUID de `toma_red_bocas`.
  Compatibilidad `origen_id/destino_id` nullable, sin `String(null)` ni ordinal 1
  por defecto. Nuevas conexiones completas se insertan con dos bocas en la TX.
- Capacidad desconocida = null y cero bocas; documentada N = ordinales exactos
  1…N. UUID por ordinal estable; no borrar/cambiar boca ocupada. Propiedad y
  ocupación se comprueban en aplicación y SQL, también cambios inversos.
- XYZ físicos separados de `esquema_x/y`. Cero físico es válido; null no se
  sustituye por cero. Datos históricos parcialmente conocidos se conservan;
  copiarlos a plantilla/sala se rechaza entero hasta completarlos.
- `holgura_roseta` nullable, sin valor sembrado inventado. Se elige en Parámetros.
  Identidad se valida antes del cálculo; longitud manual positiva conserva su
  precedencia aun sin XYZ/medidas/holgura. Puntos de paso conservados.
- Lectores comunes `lectura-extremos.ts` y resolución `extremos-conexion.ts`.
  Ficha, almacén, tabla, esquema y documentos comparten contexto. Las filas sin
  cálculo quedan visibles con causa concreta; no inventar ausencia de medidas.
- `guardarBocasToma`, conversión documental y editor usan permiso, cierre,
  versión optimista y transacción. Conversión repetida con la misma selección
  devuelve el mismo cable incluso con versión anterior; selección distinta
  rechaza. `toma_red_conexion_id` conserva vínculo documental explícito.
- Las tres copias comparten `copiar-conexiones.ts`; remapean UUID de placas,
  bocas/equipos/conexiones y conservan manual/puntos. Código de edificio copiado
  queda como referencia con `codigo_confirmado=false`.
- Bridas L2A inmutables. Respuestas al cliente con objetos planos: no devolver
  diccionarios `Object.create(null)` directamente porque Next no los serializa.
- Bloques SQL nuevos antes de `-- BEGIN ETIQUETAS CABLE GENERADAS`: el generador
  de etiquetas regenera desde ese marcador al final. Generador y schema un dueño.

## Cambios locales que deben preservarse y manifiesto

Preservar **todo el árbol**, incluidos cambios anteriores ajenos a este lote.
Base inicial: `output/plan40-20260908-083450/preservado/`, `manifiesto.json`,
`estado.txt`, diffs y evidencias de esa carpeta. No sustituirlos ni reescribir
logs antiguos para presentar la última versión como verificada.

Snapshot de traspaso: `output/traspaso-plan40-20260908/arbol/`.
Manifiesto SHA-256, tamaño y ruta de cada archivo:
`output/traspaso-plan40-20260908/manifiesto-archivos.json`.
Verificación de copia/estabilidad: `verificacion-manifiesto.json` en esa carpeta.
Se incluye código, scripts, datos, documentos y configuración local; el snapshot
es privado y no debe publicarse. Excluye `.git`, dependencias, `.next*`, `Inicio`,
`output`, `.playwright-cli` y cachés TypeScript. Esos originales permanecen donde
están; **output y .playwright-cli contienen evidencia necesaria**.
El manifiesto es del árbol material actual, no un diff contra Git.

Radios principales locales (la lista completa manda en el manifiesto):

- SQL/generación: `db/schema.sql`, migraciones L1/L2, `db/seed.sql` regenerado,
  `data/plantillas-tiradas.csv`, `scripts/generar-seed.mjs`,
  `scripts/sql-tiradas-documentales.mjs`, verificadores de rosetas/documentales.
- Dominio/lectores: `src/lib/tipos.ts`, `extremos-conexion.ts`,
  `lectura-extremos.ts`, `calculo-cable.ts`, `cable-schedule.ts`, `datos.ts`,
  `datos-plano.ts`, `datos-almacen.ts`, ficha de sala y sus pruebas.
- Servidor/copias: `src/app/acciones.ts`, `acciones-diagrama.ts`,
  `src/lib/escritura-conexiones.ts`, `copiar-conexiones.ts` y verificadores.
- Plano/editor/tabla/documentos/plantillas y pruebas; conversión en
  `src/components/sala/convertir-asignacion-toma.tsx`; bocas en
  `src/components/plano-editor/bocas-roseta.tsx`.
- Últimas correcciones del director: parámetro tipo de cambio admite precisión
  decimal existente; columnas de puertos/rosetas conservan ancho; contenedor
  compartido de tablas con foco; prueba dinámica de conversión e inyección de
  acción con valor real predeterminado. No rediseño de fuentes o colores.
- Fixtures antiguas adaptadas a extremos atómicos; esquema L0 preservado en
  `scripts/fixtures/schema-plan40-l0.sql`, SHA-256
  `74b945eb844ffaaa44a742181d9563119a6aac3f113dc903c69ce03fb73511ed`.

## Trabajo exacto pendiente de L2B

1. **Servidor, corrección sin reejecutar.** `acciones.ts` ya rechaza manual
   inválido y artículo que no sea cable activo en Cableado alta/edición. Dos
   pruebas nuevas usaron el mismo equipo en origen y destino, chocando con un
   check anterior; fixture corregida a dos equipos distintos. Último resultado
   real sigue siendo **12/14**, no 14/14. Ejecutar verificador de servidor y las
   dos causales nuevas `--sin-manual-formulario`, `--sin-catalogo-formulario`.
2. **Compras, corrección sin reejecutar.** Falló antes de pruebas por
   `UNSAFE_TRANSACTION` al aplicar schema con BEGIN y pool max8. Se cambió
   `scripts/verificar-compras-integrales.mts` a conexión reservada al instalar.
   Repetir wrapper local; no afirmar que compras pasa todavía.
3. **Fichas, error de preparación sin corregir.** Copia sombra de
   `scripts/verificar-fichas-tecnicas.mjs` omite `sql-tiradas-documentales.mjs`,
   importado por generador. Resultado **0/12**. Corregir copia de dependencia;
   comprobar cierre en finally incluso si prepara mal, sin relajar aserciones.
   Revisar el mismo patrón en `verificar-seed-puertos.mjs`, aún sin ejecutar en
   esta integración. Mantener fixtures históricas auténticas, sin nuevas legacy.
4. **Causal UI no acreditada.** Base conversión dinámica 3/3, reproducida por
   revisor. Mutante sin ACK agotó 60 s tras dos tests correctos, sin aserción de
   fallo. Diagnosticar el arnés en copia aislada y medir fallo; timeout no cuenta
   como detección del bug. No hay proceso de ese ensayo vivo.
5. **Regresión final por ejecutar tras los últimos cambios.** Último general
   747/748: barrido no entendía llaves del retorno inline de dos acciones. Ambas
   ya comprobaban permiso primero; tipos extraídos sin tocar el test. Barrido
   focal 3/3 posterior según ejecutor, falta repetir general completo. Build,
   tipos y lint de fuentes verdes son anteriores a los últimos cambios del
   servidor y al test dinámico, así que no son gate del snapshot final.
6. Completar reproducción del director de servidor/cambios nuevos, conservar
   causales SQL/dominio, asegurar fuente/schema/seed reproducibles, generar
   manifiesto de revisión y enviar paquete completo al revisor. Revisiones
   parciales de Plano/documentales/UI no reemplazan dictamen global L2B.
7. Cobertura UI adicional que no debe darse por hecha: enlace explícito de una
   asignación documental cuando ya existe un cable equivalente creado desde
   Diagrama. Servidor tiene reutilización idempotente; falta verificar si el
   selector de bocas ocupadas permite alcanzarla. Es una pregunta de cobertura,
   **no un fallo confirmado**. No resolver creando otro cable.

No hay decisión de Sergio bloqueando estos pasos. Los bloqueos son de verificación
local, y la parada actual es voluntaria para traspaso. No iniciar L3 para esquivarlos.

## Evidencia ejecutada y comandos

Rutas abreviadas bajo `output/plan40-20260908-083450/`, salvo indicación.
Usar `npm.cmd`/`npx.cmd` en PowerShell; `.ps1` del perfil perdía argumentos.

| Comando / radio | Resultado realmente observado | Evidencia |
|---|---|---|
| L0 general + BD | 696 generales y 344 BD; aprobado | `docs/revision/l0.md` |
| L1 / L2A aprobados | L1 final 707 generales; L2A 715, SQL11, siete verificadores y QA | `l1.md`, `l1a.md`, `l2a.md` en docs/revision |
| Dominio L2B focal | Director 168/168 | `root-l2b-dominio.log` |
| Editor L2B focal | Director 50/50 | `root-l2b-editor.log` |
| `node scripts/verificar-rosetas-conexiones.mjs` | Director 14/14 | `root-l2b-sql.log` |
| `node scripts/verificar-tiradas-documentales.mjs` | Director 6/6 | `root-l2b-documentales.log` |
| Lectores/Plano, consumidores | 142/142, 167/167 | `l2b-plano-lectores.log`, `l2b-consumidores-intermedio.log` |
| Presentación pendiente focal | 49/49; causales tabla1/resumen2/inspector1 | `l2b-presentacion-pendiente.log`; `output/l2b-presentacion-causal-00f810ed75484985acadd0d1025d45c5/` |
| `node scripts/verificar-base-plan40.mjs` | Siete exit0; DB eliminada | `l2b-regresion-integral.log`; `output/qa_plan40_base_1ca12b1bbe6f47cfa867127fcdbb8ef9/` |
| `node scripts/verificar-etiquetas-cable.mjs` | 11/11 tras adaptación | `l2b-regresion-etiquetas.log` |
| `node scripts/ejecutar-servidor-rosetas.mjs` | Primero11/11; luego12/12 informado; último12/14 fallido | `l2b-servidor-base.log` contiene último12/14, no el12/12 anterior |
| Servidor causales anteriores | Versión1/manualcopias3/pendientes1 fallos medidos | `l2b-servidor-causal-version.log`, `...-manual.log`, `...-pendientes.log` |
| `node scripts/verificar-fichas-tecnicas.mjs` | 0/12 por dependencia sombra ausente | `l2b-regresion-fichas.log` |
| `node scripts/ejecutar-compras-integrales.mjs` | Exit1 antes de tests; corrección sin repetir | `l2b-regresion-compras.log` |
| `npm.cmd test` | Última suite 747/748, cero omisiones; no repetida tras arreglo | `l2b-generales-cierre.log` |
| `npm.cmd run build`, `npm.cmd run typecheck` | Exit0, antes de últimos cambios | `l2b-build-cierre.log`, `l2b-tipos-cierre.log` |
| `npx.cmd eslint src scripts` | Exit0, antes de últimos cambios | `l2b-lint-fuentes.log` vacío = salida limpia |
| `npm.cmd run lint` sin alcance | Exit1: 428 errores/8760 avisos al incluir volcado externo Inicio y otros | `l2b-lint-cierre.log`; no añadir supresiones para ocultarlo. Alcance reproducible L0: src/scripts |
| `node --import tsx --test src/components/sala/convertir-asignacion-toma.test.tsx` | Director3/3 y revisor3/3 | `l2b-conversion-dinamica.log`, `revisor-conversion-r2-base.log` |
| Mutante sin ACK, copia independiente | Timeout60s, causal NO acreditada | `revisor-conversion-r2-causal.log` |

Revisiones parciales: Plano aprobó correcciones de Z desconocida y conservación
del borrador rechazado; `l2b-plano-dictamen.md` y
`output/revisor-l2b-r2-9f2a0afc1db744ceb9bd3a987c85019a/`.
Documentales UI: `output/revisor-l2b-documental-r2-651d19c2b023431381039e3d8b7fed0e/`.
Conversión/UI acotada: sin hallazgo bloqueante en lectura/15 tests previos,
pero causal dinámica final pendiente como se indica; no convertirlo en aprobación global.

Recorrido real del director: `docs/revision/l2b-navegador.md`. Login sintético →
alta sala/roseta/Codec → documentar bocas → conversión → CSV → mover esquema →
segunda conexión por ordinal2 → plantilla → nueva sala → rechazo retirar boca
ocupada → quitar XYZ → pendientes. Desktop antes de390/320, foco y reduced motion.
CSV real `l2b-ui-cables.csv`: una RED-1000,6,75m; consulta independiente
`l2b-ui-persistencia.log`: identidad nueva, referencia no confirmada, bridas y XYZ.
Capturas inspeccionadas `l2b-*.png`; snapshots/consola en `.playwright-cli/`.
Esto no acredita el recorrido L7 ni el PDF completo L6.

## Procesos y bases al cierre

- Los tres subagentes `l2b_bd`, `l2b_dominio`, `l2b_mapa_servidor` finalizaron.
  Ninguno tiene permiso para continuar escribiendo tras este traspaso.
- QA navegador puerto3128, sesión29515: terminado; base
  `qa_plan40_ui_0fd7dd9bac2b4d4da2bc7d58ba1c8f69` eliminada y comprobada ausente.
  QA anterior L2A `qa_plan40_ui_70c72d4672614eeca9fe1ffea68d0ecb` también eliminada.
- Build65528, lint68591/67156 y Playwright15471 terminaron. El último fue timeout
  esperando un panel móvil plegado; se abrió por UI después. No prueba activa.
- BD de regresión `qa_plan40_base_1ca12b1bbe6f47cfa867127fcdbb8ef9`, servidor
  `qa_servidor_rosetas_631c6e04e48545408f5b84008b23e0b6`, compras
  `qa_compras_3b36a476aef94af3adab24afbcc705e7` y fixtures de etiquetas eliminadas.
  Las doce bases enumeradas por el último verificador de fichas fueron eliminadas.
- Persisten **sin sesiones**, propiedad no acreditada y no se borraron:
  `qa_fichas_tecnicas_6c3dd2f6b969496c8493b22f7b7722b9`,
  `av_seguimiento_test_9eb6933b9f2a46769e2efabf1d64fac1`,
  `av_seguimiento_test_f8bfdb4806b0490a98f162a4a2c1fc1c`.
  No limpiarlas por prefijo. No usar `db:reset` sobre `av_design` compartida.
- Sigue el servidor de desarrollo preexistente **3100** (PID30816, hijo46924,
  trabajador33772), distinto del QA3128. No es una prueba del lote; se preservó.
  Docker y servicios MCP/otros proyectos también se preservaron.
- Inventario de procesos/BD al cierre en
  `output/traspaso-plan40-20260908/estado-recursos.json` y `bases-qa.txt`.

## Próxima acción concreta en la nueva conversación

**Verificar el manifiesto y retomar solamente L2B:** leer los tres logs fallidos,
corregir la dependencia ausente de la sombra de fichas (y comprobar seed-puertos),
y ejecutar primero `node scripts/ejecutar-servidor-rosetas.mjs` contra su UUID
local para comprobar los 14 casos ya preparados. Después seguir la lista exacta
de pendientes en orden serial, con un único dueño de BD. No repetir investigación
ni reconstruir desde Git. No iniciar L3 ni declarar L2B aprobado hasta gate y
dictamen independiente completos. Sergio podrá iniciar esa continuación desde
este documento; esta conversación queda detenida aquí.

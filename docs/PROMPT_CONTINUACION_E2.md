# Continuar AV_design con E2

Quiero continuar las mejoras de AV_design basadas en la investigación de
Xtenav ya terminada. E1 está implementada y verificada localmente. Usa
subagentes en modo arquitecto-ejecutor y continúa hasta entregar **E2 — Fuentes
de catálogo y precios revisables**, implementada, comprobada y revisada
localmente. No te quedes en un plan.

## Proyecto y fuentes

Proyecto: `/Users/sergio/Desktop/Aplicaciones/AV_design`.
Investigación: `/Users/sergio/Desktop/Aplicaciones/Xtenav`.

Lee al inicio, en este orden:

1. `AV_design/AGENTS.md` y `CLAUDE.md` completos.
2. `AV_design/docs/10-e1-especificacion.md` y `docs/11-e1-entrega-local.md`.
3. `Xtenav/INFORME.md`.
4. `Xtenav/research/comparison-backlog.md` y `.json`: E2 y los contratos
   AVX-14, AVX-15, AVX-16 y AVX-18. Conserva las ocho entregas como contexto.
5. `Xtenav/research/av-design-baseline.md` y `.json`, contrastados con el
   código actual. Esa baseline es anterior a E1.
6. Los apartados pertinentes de `AV_design/docs/07-roadmap.md`,
   `docs/04-limpieza-catalogo.md` y `docs/05-precios.md`.
7. `/Users/sergio/.agents/skills/subagentes/SKILL.md`.

No repitas investigación, navegación, scraping ni extracción de Xtenav.
Sus evidencias y contratos están guardados. No cargues Evidence REA completo
salvo una pregunta imprescindible y concreta. No modifiques la cuenta Xtenav.

## Estado que debes comprobar y conservar

Último estado comprobado el 13-10-2026:

- Checkout `main`, HEAD `f38baa805a1868b7cad55bb97064386e9b5f8555`.
- `origin/main` local estaba un commit por delante, que sólo añade `.mcp.json`.
  No hubo fetch; comprueba el estado actual y no lo confundas con el remoto.
- **E1 son cambios locales sin commit**, incluidos archivos nuevos sin
  seguimiento. No existe en HEAD ni se recupera creando un worktree desde HEAD.
- 681 pruebas en 144 suites, cero fallos y cero omitidas. Build con Webpack,
  tipos y lint de los cambios aprobados. E2E 3/3, escritorio antes de móvil.
- PDF renderizados/inspeccionados, XLSX abiertos en Microsoft Excel y ZIP
  comprobados; lectura consistente y 38 tablas sin cambios tras exportar.
- Revisión independiente encontró tres P2: recarga del paquete parcial,
  cajetín con nombres largos y colisión de nombres. Corregidos y cubiertos
  por regresiones. Evidencia en `AV_design/output/e1-documentos/`.
- No hubo commit, push, despliegue, migración ni conexión a producción.

Ejecuta primero `git status --short --branch`, `git rev-parse HEAD`,
`git diff --stat` e inventario de archivos nuevos. Atribuye los cambios de E1
con su informe y conserva cualquier trabajo posterior. **No ejecutes reset,
restore, clean ni checkout que elimine los cambios locales.** Si necesitas
otro worktree, traslada también todos los archivos modificados y nuevos de E1
a un snapshot local revisable; comprueba su paridad antes de trabajar allí y
no vacíes el checkout original. Elige la base desde el estado real.

Las evidencias `output/`, la investigación Xtenav y los archivos ignorados no
viajan automáticamente con Git ni con un worktree. No dependas de servidores
o contenedores que quizá se hayan detenido; verifica sus destinos y puertos.

## Alcance de E2

Implementa AVX-14, AVX-15 y AVX-16 en ese orden. AVX-18 es el incremento
opcional e independiente de favoritos del backlog: incorpóralo después del
núcleo si puedes resolver su modelo con el contrato y el código; en otro caso
declara expresamente su estado y la decisión pendiente. No abras E3–E8 ni
intentes implementar las 33 propuestas juntas.

### AVX-14 — Importación BOM/catálogo con revisión

- CSV/XLSX deterministas primero. Vista previa de filas, unidades, cantidades,
  coincidencias, ambigüedades y referencias no encontradas antes de escribir.
- Confirmar sólo las filas elegidas. Una referencia ambigua requiere elección;
  no fusionar variantes por parecido ni usar matching opaco.
- Conservar procedencia, archivo/hash e informe de altas, cambios y rechazos.
  Un fallo revierte el lote entero. Define una reversión de lote verificable
  que preserve modificaciones posteriores y trabajo ajeno.
- Distingue explícitamente qué se importa: catálogo frente a BOM de una sala.
  No conviertas una lista importada en equipos colocados o conectados sin
  una decisión explícita. Reutiliza catálogo y BOM actuales.
- PDF/OCR/IA quedan fuera de este incremento; no se añaden para aparentar
  una importación universal.

### AVX-15 — Importación revisable de ofertas y tarifas

- Revisar proveedor, fecha, moneda, unidad de compra, unidades por paquete y
  origen final/orientativo antes de guardar.
- Los ceros de componentes incluidos en kits no son automáticamente una
  oferta de producto gratis: mantener la decisión pendiente y explicarla.
- Conservar ofertas anteriores y filas `fuente = 'app'`. Detectar referencias
  no encontradas y cambios del coste elegido, sin sobrescribir por parecido.
- Reutilizar parámetros de cambio/vigencia y la selección de precio vigente
  existente. No modificar retroactivamente precios congelados de pedidos.
- Consulta las decisiones aplazadas de precios en el roadmap. No cargues el
  presupuesto Cisco real ni resuelvas composición de kits/ofertas no vinculantes
  inventando un criterio. Si falta una decisión imprescindible, pregunta sólo
  esa decisión y continúa con el trabajo independiente.

### AVX-16 — Datos técnicos por modelo exacto

- Dimensiones con unidad, RU cuando corresponda e imagen/ficha con origen,
  URL y fecha. Los datos desconocidos siguen ausentes; no deducirlos.
- Cambiar dimensiones de catálogo no deforma planos o documentos entregados:
  congelar la dimensión relevante en la instancia donde se utiliza. Diseña
  esta protección sin añadir el historial completo de AVX-06.
- Buscar por atributos verificados y mostrar el modelo/archivo exacto.
  Comprobar permisos, formatos y límites de tamaño.
- Elegir almacenamiento compatible con Render y sus reinicios; no presentar
  un archivo temporal local como almacenamiento duradero. Preparar la solución
  local sin crear recursos de producción ni depender de credenciales nuevas.
- Añadir metadatos técnicos no autoriza sustituir de paso los símbolos,
  rediseñar el plano ni introducir cálculos de ingeniería.

### AVX-18 — Favoritos opcionales

Si se implementa, decide y documenta el alcance personal o departamental.
Favorecer una referencia o guardar un filtro debe poder deshacerse; muestra
por qué aparece y conserva acceso a referencias instaladas o desactivadas
usadas en salas. No sustituye modelos, precios ni puertos de una obra.
No implementes aprendizaje automático ni un ranking sin explicación.

## Bases que no debes romper

- CSV de `data/` como fuente editable; normalización conservadora existente.
  No editar `db/seed.sql` a mano ni permitir que seed borre escrituras de app.
- Variantes de producto, precios ausentes frente a cero y final/orientativo.
- Proyecto → Localización → Sala; salas legado válidas.
- Plano físico frente a diagrama lógico; medido frente a estimado; cable IDs,
  cálculo, BOM, reservas, existencias derivadas y precios congelados.
- Buscador remoto único y catálogo fuera del navegador; permisos y guardas
  también en preview, confirmación, reversión y acceso a archivos.
- Snapshot coherente de E1, misma revisión al volver a descargar y stock
  contado una vez en la selección de obra. Conserva las tres regresiones.

E1 tiene retención temporal de 30 minutos, máximo 20 salas, 50 MiB y 200
páginas por PDF. Su snapshot no es un historial permanente de diseño.
Hay 12 avisos de dependencias anteriores documentados; no hagas una
actualización global de framework para esta entrega. Turbopack falló en el
entorno al abrir un puerto interno; Webpack compiló correctamente.

Antes de escribir Next.js, lee las guías pertinentes de la versión instalada
en `node_modules/next/dist/docs/`. Sigue el sistema visual del proyecto.
Usa las skills de hojas de cálculo/PDF cuando correspondan, reutiliza ExcelJS
de E1 si encaja y justifica cualquier dependencia nueva.

## Método y autorización

Recupera contexto, localiza las funciones actuales y redacta una especificación
breve de E2: destinos de importación, claves, preview, confirmación, lotes y
reversión, permisos, procedencia, datos técnicos, errores y pruebas.

Descompón en unidades independientes con archivos de propiedad clara; evita
escrituras paralelas sobre el mismo archivo. Espera a los ejecutores y revisa
sus resultados. Revisor independiente con artefacto, contrato y evidencia
cruda, sin razonamiento ni conclusión del autor. Una implementación, una
revisión, una corrección y gate determinista; sin bucles ilimitados.

Puedes modificar código local, instalar dependencias necesarias, preparar
migraciones versionadas y aplicarlas sólo a una BD local de prueba aislada
e identificada. Verifica host, puerto, usuario y `current_database()` antes
de cualquier escritura. Nunca resetees la BD habitual por comodidad.

**No hagas commit, push, merge, despliegue, publicación, cambios en producción,
cambios de credenciales reales ni borrado de datos reales.** No envíes datos a
clientes ni servicios externos. No implementes nada en producción.

No preguntes a mitad de tarea si debes continuar. Resuelve decisiones rutinarias
con el contrato y el código; pregunta únicamente por una decisión de negocio
imprescindible que no pueda inferirse, mientras avanzas lo independiente.

## Gates de aceptación y entrega

- Fixture nueva y aislada `PRUEBA-IMPORT-01`; no usar inventario o ofertas
  reales para hacer pruebas que escriben. Guarda estado antes/después.
- CSV y XLSX: duplicados, referencias ambiguas y variantes, fila no encontrada,
  acentos, unidades incompatibles, cantidades inválidas, fórmulas/celdas
  peligrosas, cero de kit, precio ausente/orientativo, monedas y fechas.
- Preview no escribe. Confirmación afecta sólo filas seleccionadas y respeta
  permisos. Fallo a mitad revierte el lote. Reversión conserva trabajo posterior.
- Catálogo antiguo, ofertas app, pedidos congelados, stock, diseño y E1
  preservados. Cambiar dimensiones no deforma una instancia medida existente.
- Flujo real de escritorio: subir → revisar → elegir → confirmar → consultar
  resultado → probar fallo/reversión. Móvil sólo al cierre.
- `npm test`, build, tipos y checks pertinentes. Reutiliza las fixtures de E1
  con sus guardas y ejecuta los checks de exportación afectados. No asumas
  que el entorno de E1 sigue disponible; sus comandos están en el informe.
- Guardar comandos reproducibles, capturas, informes de importación, archivos
  sintéticos y resultados crudos. No sobreescribir evidencia histórica de E1.
- Informe final: archivos cambiados y por qué; criterios de cada AVX cumplidos
  o pendientes; validaciones; migraciones locales y su rollback; límites;
  ruta de trabajo y estado Git. Separar implementación local de producción.

Empieza ahora por verificar y conservar el árbol actual de E1, y continúa
con E2 dentro de este contrato.

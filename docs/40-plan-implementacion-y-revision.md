# Plan de implementación y revisión de AV_design

Fecha de preparación: 08/09/2026.
Repositorio: `C:\Users\sergi\Desktop\Aplicaciones\AV_design`.
Destinatario: agente ejecutor en una conversación nueva.
Revisor: Codex en la conversación donde Sergio solicitó este plan.

## 1. Resultado y alcance

Completar y consolidar una aplicación que permita a una persona diseñar una sala,
preparar materiales y compras, y entregar el proyecto a otra persona que pueda
instalarla con instrucciones suficientes, registrar las pruebas y entregar la sala.

No se empieza desde cero. Ya hay implementación local y un ensayo funcional.
Primero se verifica esa base; después se cubren sus límites conocidos. Este plan
es una especificación de trabajo pendiente, no una afirmación de que todo lo
descrito existe o está aprobado para producción.

**Contrato de tarea**

| Campo | Acuerdo |
|---|---|
| Resultado exacto | Flujo coherente de proyecto → sala → diseño → material → compra → recepción → instalación → check-in → check-out, con documentación técnica derivada del proyecto |
| Destinatarios | Proyectista, responsable de compra/almacén, técnico instalador y persona que acepta la sala |
| Éxito medible | Matriz de aceptación de este plan cumplida con pruebas ejecutadas y recorrido de navegador con dos usuarios distintos |
| Alcance de ejecución | Código, documentación, investigación técnica, migraciones probadas en bases locales desechables y QA con datos sintéticos |
| Fuera de alcance | Pedidos reales, mensajes a proveedores, compras de servicios, importación masiva del inventario real, cambios de infraestructura no necesarios y rediseño global |
| Sistemas protegidos | Producción, cuentas reales, datos previos, cambios ajenos, identificadores físicos de cables/puertos, archivos originales de inventario y secretos |
| Comprobaciones obligatorias | Tipos, build, lint pertinente, pruebas de dominio y Postgres, regresión de permisos/concurrencia, escritorio y móvil, impresión |
| Autorización separada | Commit si no existe autorización vigente; push, merge, despliegue, migraciones de producción y cualquier operación externa irreversible |

**Vocabulario cerrado por Sergio:**

- Visita previa: inspección de la sala antes de montar.
- Instalación: trabajo de montaje y registro de su terminación.
- Check-in: prueba técnica final posterior a la instalación.
- Check-out: entrega y aceptación de la sala; debe constar quién acepta y quién registra.

## 2. Qué debe leer primero el ejecutor

1. `AGENTS.md` y las instrucciones de directorio aplicables.
2. `design-system/MASTER.md`: conservar los tokens y componentes actuales.
3. `docs/39-auditoria-integral.md`: estado de la última auditoría y limitaciones.
4. `docs/38-asistente-equipamiento.md`: alcance y fuentes del asistente y Cisco EQ.
5. `docs/07-roadmap.md`: contexto del proyecto. Contiene apartados históricos
   desactualizados, como la antigua clave compartida y los nombres Plano/Diagrama;
   no reintroducirlos. Contrastar cada afirmación con código y contrato actuales.
6. `package.json`, `db/schema.sql`, migraciones relevantes y documentación local
   de Next en `node_modules/next/dist/docs/` antes de escribir código Next.

No usar `docs/05-continuar.md` como fuente de prioridades.

## 3. Punto de partida que debe conservarse

Lectura del repositorio al preparar el plan:

- Rama: `codex/diagrama-salas`.
- HEAD: `f38baa805a1868b7cad55bb97064386e9b5f8555`.
- Árbol con muchos cambios locales, incluidos archivos nuevos sin seguimiento.
  Un checkout desde HEAD o un worktree limpio **no incluye esta implementación**.
- Stack: Next.js, TypeScript, React, Postgres con `postgres.js`.
- QA anterior en `localhost:3112`; comprobar si sigue activo antes de reutilizarlo.
  No dar por disponibles procesos, sesiones, puertos o credenciales antiguas.
- Producción no fue desplegada en esta iteración.

Ya existen: salas y plantillas con geometría/mobiliario, editor de plano,
diagrama con bocas concretas, cálculo de cable, almacén/reservas/carga, usuarios y
roles, compra/recepción trazadas, planificación, prueba final, aceptación,
historial y paquete técnico imprimible. Verificar y corregir, no duplicar módulos.

Migraciones locales nuevas que deben incluirse al consolidar:

- `db/migraciones/2026-09-trazabilidad-compras.sql`.
- `db/migraciones/2026-09-seguimiento-instalacion.sql`.

La última ejecución informó 696 pruebas generales correctas, build/tipos/lint
correctos y pruebas Postgres específicas. Estos resultados son evidencia anterior,
no el visto bueno de la nueva ejecución. Los logs están bajo `output/playwright/`.

### Protección del árbol

Antes de cualquier edición, guardar en una carpeta de evidencia nueva:

- Rama, HEAD, estado, diff de trabajo y diff staged por separado.
- Inventario de archivos sin seguimiento y copia de esos archivos de proyecto.
- Lista de procesos y servicios que se vayan a reutilizar; no copiar secretos a logs.
- Manifiesto con hash de los archivos que se preservan.

Ya estaban modificados antes de la auditoría anterior: `AGENTS.md`,
`src/app/acciones-diagrama.ts`, `src/components/diagrama/lienzo-conexiones.tsx`,
su test y `src/lib/lienzo-conexiones.ts`. Algunos recibieron además cambios de la
auditoría. No se puede atribuir un archivo entero a una única tarea.

No hacer reset, stash, limpieza general ni restauraciones desde HEAD para
"ordenar" la base. No copiar `.env` o credenciales a documentación. Si se aísla el
trabajo, transferir explícitamente los cambios locales y los archivos nuevos,
comprobar los hashes y verificar que la copia arranca con la misma funcionalidad.

## 4. Organización de la ejecución y de mi revisión

El ejecutor implementa y produce evidencia. El revisor evalúa entregables contra
el contrato, reproduce las comprobaciones relevantes y emite aprobado o cambios
requeridos. El informe del ejecutor no sustituye una ejecución del revisor.

Como parte de la base fue escrita por este Codex, la revisión de esos cambios
debe incluir una revisión independiente con contexto limpio: artefacto, contrato
y evidencia, sin la explicación ni las conclusiones del autor.

Máximo dos ejecutores simultáneos. Solo paralelizar radios de función que no
compartan helpers, tablas ni contratos. Autenticación, migraciones, borrado y
transacciones se trabajan en serie. Los subagentes no hacen operaciones Git.

Cada lote sigue este orden:

1. Contrato concreto y lista de archivos/tablas que prevé tocar.
2. Implementación completa de la unidad y pruebas pertinentes.
3. Entrega al revisor de artefacto + contrato + evidencia.
4. Revisión independiente: máximo dos rondas; una tercera solo para seguridad,
   autenticación, migraciones o borrado.
5. Corrección y repetición de las pruebas afectadas.
6. Checkpoint aprobado; avanzar a la unidad dependiente.

No se exige intervención de Sergio para decisiones rutinarias. Si hay herramientas
para comunicar conversaciones, el ejecutor puede solicitar revisión a la tarea
`01a07f5b-56ed-7bb3-8295-766f2d4d5057`, comprobando que es esta conversación.
La ejecución no debe atribuir una aprobación al revisor sin recibirla.
Si no puede comunicarse, entrega un bloque de revisión copiable con rutas y
comandos. Puede continuar trabajo independiente; una dependencia no se considera
aprobada por el transcurso del tiempo.

## 5. Entregas Ahora, en orden

### L0. Consolidar y reproducir la base

**Objetivo:** que otra conversación pueda ejecutar lo que ya funciona.

Trabajo:

- Inventariar el árbol y verificar que los archivos nuevos están disponibles.
- Ejecutar los gates base y clasificar cualquier fallo como previo o introducido,
  con reproducción, sin eliminar ni debilitar aserciones.
- Revisar las dos migraciones: instalación limpia, actualización desde esquema
  anterior, segunda aplicación y preservación de datos/relaciones/historial.
- Convertir los verificadores necesarios que hoy dependen de `output/` en comandos
  reproducibles del proyecto. En particular, el wrapper de pruebas de plano está
  en `output/verificar-plano-equipo-local.mjs`; no debe ser una dependencia oculta
  de la entrega. Integrarlo en `scripts/` si sigue siendo necesario.
- Detectar referencias a rutas temporales, imports de copias QA y cambios de
  configuración generados por Next. Separar artefactos de código entregable.
- No borrar los temporales cuya limpieza anterior fue rechazada por revisión
  automática; no intentar la misma eliminación por otra vía.

**Gate L0:** base reproducible, migraciones locales verificadas, diferencias
preservadas y cero fallos sin explicar. No iniciar extensiones sobre una base roja.

### L1. Contrato técnico y cobertura del catálogo

**Objetivo:** conocer qué está documentado y qué permanece desconocido.

Código inicial a inspeccionar: `data/catalogo-equipos.csv`, `data/puertos.csv`,
`scripts/generar-seed.mjs`, `src/lib/tipos.ts`, `src/lib/asistente-equipamiento.ts`,
`src/components/asistente-equipamiento/` y `src/components/puertos/`.

Trabajo:

- Recalcular cobertura real; el dato anterior es 24/871 referencias con puertos
  CSV. Distinguir "algún puerto" de "ficha completa" y de "perfil validado".
- Crear una matriz por referencia con modelo exacto, variante, fabricante,
  categoría, procedencia, URL oficial, documento/página, fecha de consulta,
  puertos, conectores, sentido, señal, cantidades, alimentación/PoE, micrófonos
  integrados o externos, accesorios incluidos y restricciones conocidas.
- No crear otro catálogo paralelo. Reutilizar artículos/puertos y añadir mediante
  migración solo campos o relaciones que el modelo actual no represente.
- Estados de información explícitos: verificado, parcial y sin documentar.
  Ausencia de datos nunca significa compatible ni "no necesita micrófono".
- Guardar fuentes de forma que puedan mantenerse en los CSV y consultarse desde
  la ficha. Prohibido editar `db/seed.sql` manualmente.
- Empezar por el montaje de referencia: Codec EQ, Room Kit EQ, cámara y control
  exactos del kit, micrófono elegido, pantalla y cables/adaptadores necesarios.
- Después priorizar referencias por uso registrado. Publicar lista ordenada;
  no prometer completar las restantes sin fuentes fiables.
- Comprobar que regenerar/sincronizar puertos preserva identificadores utilizados
  por conexiones existentes. No borrar y recrear ciegamente los puertos CSV.
  Un cambio de cantidad que invalide un ordinal debe listar conexiones afectadas
  y tener una resolución explícita; nunca reasignar al primer puerto libre.

**Gate L1:** montaje de referencia documentado de extremo a extremo, fuentes
oficiales por dato sensible, informe de cobertura reproducible y prueba de que
una actualización de catálogo no cambia bocas o identificadores de cables vivos.

### L2. Rosetas como extremos de conexiones reales

**Objetivo:** representar y calcular el cable entre una boca concreta del equipo
y una toma concreta del edificio. Hoy la asignación de roseta es documental.

Antes de editar, entregar al revisor un diseño técnico breve con modelo, migración,
invariantes y compatibilidad histórica. Inspeccionar `Conexion`, `TomaRed`,
`bocas-puerto.ts`, `calculo-cable.ts`, `editor-conexiones.ts`, `cable-schedule.ts`,
acciones del diagrama, lectores de datos, plano y copia de plantillas.

Diseño recomendado:

- Mantener `conexiones` como identidad canónica del cable y preservar sus IDs.
- Extremos tipados: boca de equipo o boca de roseta, sin equipos ficticios de red
  ni UUID polimórfico sin claves foráneas. Cada lado tiene exactamente un tipo.
- Si una placa tiene varias bocas, representarlas de forma explícita. Una toma
  antigua sin capacidad documentada no se convierte automáticamente en dos bocas.
- Validar existencia, sala propietaria y ocupación en servidor y base de datos.
- No convertir asignaciones históricas `toma_red_id` automáticamente en cables:
  falta saber la boca del equipo, el cable y el recorrido.
- Mantenerlas como pendientes de completar y permitir convertirlas mediante una
  selección explícita que evite duplicar la misma conexión.
- Posición desconocida sigue desconocida. No usar `(0,0,0)` como sustituto.
- Calcular metros con la geometría y holguras configuradas, reutilizando el motor;
  los puntos de paso y la longitud manual conservan su precedencia definida.
- Dar a Plano, Diagrama, tabla de cables, lista de material y guía la misma lectura.
- En plantillas, copiar geometría de las tomas con IDs nuevos y conexiones
  remapeadas; una etiqueta del edificio debe quedar pendiente de confirmar en la
  sala de destino, no presentarse como comprobación física.

Pruebas: equipo→equipo histórico sin cambios, equipo→roseta, coordenada cero
válida, coordenadas desconocidas, toma ajena, boca ocupada, dos escrituras
concurrentes, copia a plantilla, rollback y estabilidad de identificadores.

**Gate L2:** el técnico lee "LAN [boca] → toma [código/boca]", el cable aparece
una sola vez en diagrama/material y su longitud responde a la posición física;
mover el bloque del esquema no cambia los metros.

### L3. Kits y cables incluidos, sin doble compra

**Objetivo:** que un kit comercial pueda explicar sus componentes físicos sin
sumar dos veces los equipos o accesorios en la lista de compra.

Diseño previo y revisión antes de migrar:

- Separar referencia comprable de componentes físicos instalables.
- Cada componente con conexiones tiene identidad física estable y puertos del
  modelo correcto. Cámara, control y codec no comparten una bolsa indiferenciada
  de conectores.
- La composición instanciada es un snapshot versionado. Modificar mañana la
  ficha del kit no altera montajes que ya fueron comprados o entregados.
- Un componente incluido no genera compra/reserva adicional. Un componente extra
  adquirido por separado sí. Mantener trazabilidad hasta el artículo comprado.
- Diferenciar cable suministrado, cable adicional y cable pendiente de determinar.
  Un cable incluido de longitud desconocida no acredita que llegue al destino.
- No sustituir latiguillos propietarios por cable genérico solo porque la señal
  se llame "micrófono". Registrar conectores y requisitos verificados.
- Tratar las conexiones existentes del Room Kit EQ con un mapeo explícito y
  comprobado a su Codec EQ; no mover conexiones de referencias ambiguas.
- Copiar composición y conexiones correctamente en sala ↔ plantilla.

**Gate L3:** un kit produce una compra del kit, contiene sus componentes físicos,
genera conexiones instalables y no duplica accesorios incluidos. Un segundo
micrófono o cable opcional sí aumenta necesidades cuando corresponde.

### L4. Selección asistida y revisión técnica comprensibles

**Objetivo:** ayudar a completar un montaje sin convertir hipótesis en certezas.

- Mantener búsqueda remota y selección acumulada de equipos ya existentes.
- Añadir, quitar y cambiar cantidad debe actualizar los avisos inmediatamente.
- Un solo aviso útil para videoconferencia duplicada, con acceso al equipo ya
  seleccionado. Permitir múltiples sistemas cuando sea intencional.
- Distinguir micrófono ausente, captación integrada documentada y perfil desconocido.
- Comprobar capacidades verificadas: puertos ocupados, entrada/salida, conectores,
  PoE cuando proceda, cable incluido suficiente y adaptador explícito.
- Separar error estructural de aviso técnico. IDs ajenos, ordinales inválidos o
  escrituras inconsistentes se rechazan; incompatibilidades potenciales se avisan
  según el contrato del proyecto, conservando alternativas con adaptadores.
- No mostrar "Todo listo" cuando falten fichas, conexiones o posición confirmada.
- Cada aviso identifica causa, elemento afectado y acción disponible para resolverlo.
- Evitar descargar el catálogo entero o repetir cientos de formularios en una página.

**Gate L4:** ensayos de kit sin micro, barra integrada, ficha desconocida,
videoconferencia duplicada, puerto agotado y cable insuficiente. Cada resultado
se deriva de datos verificables y las notas del usuario se conservan ante errores.

### L5. Coherencia de compras, almacén y seguimiento

**Objetivo:** cerrar huecos del flujo existente, sin sustituirlo por otro roadmap.

Inspeccionar `operaciones-compras.ts`, `datos-almacen.ts`, `compras.ts`,
`ciclo-vida-compras.ts`, `ciclo-vida-seguimiento-db.ts` y los componentes de ciclo.

- Verificar el resumen por sala y por proyecto, incluyendo pedidos que abastecen
  varias salas. Un pedido sin reparto no acredita cobertura de todas ellas.
- Mantener compra parcial, recepción parcial, proveedor opcional, ETA, almacén y
  autor real; doble clic/reintento no duplica movimientos.
- Material servido no vuelve a contarse como faltante. Probar devolución parcial,
  reserva ajena y disponibilidad negativa sin trasladar déficits entre salas.
- Separar falta física, material pendiente de pedir y material ya pedido.
- Un cambio de diseño tras comprar muestra la diferencia de necesidades; no
  reescribe pedidos ni convierte material sobrante en devolución ficticia.
- Conservar fechas, técnico asignado, situación y autor de cada transición.
- Mantener separación de técnico que realiza, usuario que registra y persona que acepta.
- Definir y probar reapertura/anulación: no dejar un check-out aparentemente
  vigente cuando su prueba final fue anulada. Mantener historial, no borrar rastros.
- Si el diseño cambia después de la prueba o entrega, mostrar que la evidencia
  corresponde a una revisión anterior. Conservar la aceptación original y exigir
  revisión explícita para acreditar el nuevo diseño.
- No bloquear montaje solo porque falta registro de compra si se usa material
  existente; la revisión debe mirar cobertura real y explicar las excepciones.
- Los formularios conservan entradas en rechazos del servidor y conflictos de versión.

**Gate L5:** dos sesiones concurrentes, técnico sin permiso de compra, proyecto
cerrado, pedido compartido, recepción repetida, devolución, cambio de diseño y
anulación de hitos dejan cantidades y estados coherentes y auditables.

### L6. Entregable técnico completo

**Objetivo:** que el instalador pueda montar siguiendo el paquete y la app.

Reutilizar `src/components/documentos/`, `guia-montaje.tsx`, croquis,
acotaciones y tabla de cables. No crear una fuente de geometría paralela.

Contenido obligatorio:

- Proyecto, localización, sala, fecha de emisión y revisión del diseño.
- Planta con cotas, alturas/elevaciones, equipos y tomas identificables.
- Esquema de conexiones imprimible con puertos y ordinales físicos; el paquete
  actual enlaza al diagrama online, pero no incluye ese esquema gráfico en el PDF.
- Tabla con ID estable, origen, destino, bocas, señal, recorrido, longitud
  calculada/manual, longitud comercial y cable incluido o adicional.
- Instrucciones de conexión, composición del kit, alimentación y red documentadas.
- Material previsto, recibido/servido, faltantes y observaciones relevantes.
- Posiciones estimadas, datos desconocidos y comprobaciones pendientes visibles.

Pruebas con sala pequeña y sala densa: varias pantallas, kit, micrófonos, tomas y
etiquetas largas. Partir páginas legiblemente, repetir cabeceras y no reducir
todo hasta hacerlo ilegible. Examinar todas las páginas renderizadas.

**Gate L6:** coincidencia entre app, PDF y tabla de cables. El técnico distingue
una salida del codec hacia una entrada de pantalla. Las rosetas y los componentes
del kit no quedan como instrucciones ambiguas. No hay clipping ni páginas vacías.

### L7. Recorrido de aceptación con dos usuarios

Ejecutar en escritorio, desde el inicio de sesión y sin saltarse la UI mediante
inserciones directas para acreditar pasos. Las fixtures de infraestructura pueden
prepararse por scripts locales; las acciones de negocio del recorrido se hacen
en la aplicación.

| Paso | Acción y resultado exigidos |
|---|---|
| 1 | Proyectista crea proyecto/localización y sala desde cero, sin repetir sede/planta |
| 2 | Introduce medidas, coloca mobiliario, rota, elimina y deshace; guarda y recarga |
| 3 | Selecciona kit, micrófono y pantalla; provoca avisos y comprueba su resolución |
| 4 | Conecta bocas concretas y red a roseta; recarga y verifica identidades |
| 5 | Guarda plantilla y crea otra sala; confirma copia sin referencias a la sala original |
| 6 | Comprueba material, reserva stock existente y crea pedido solo por lo pendiente |
| 7 | Registra compra parcial/total, proveedor opcional, ETA y almacén |
| 8 | Recibe parcialmente y después el resto; repite un envío para verificar idempotencia |
| 9 | Crea técnico desde Usuarios después de completar la compra y le asigna el trabajo |
| 10 | Cierra sesión, entra como técnico, cambia contraseña provisional y abre el proyecto |
| 11 | Técnico accede al paquete, reserva/carga lo necesario y confirma salida a obra |
| 12 | Registra situación: material en sala y un faltante simulado, después lo resuelve |
| 13 | Finaliza instalación e intenta check-in con incidencia; no puede acreditarlo aún |
| 14 | Resuelve incidencia, completa prueba y registra check-out con aceptación identificada |
| 15 | Proyectista vuelve a entrar y ve el mismo estado y todos los responsables |
| 16 | Edita una revisión posterior de ensayo y comprueba que no hereda una aceptación vigente sin revisión |

Después: móvil 390 y 320 px, foco/teclado, zoom razonable, controles táctiles,
tablas con desplazamiento propio y página sin overflow. Comprobar reduced motion
si se introduce movimiento. Crear páginas frescas tras cambios de desarrollo;
una pestaña con código antiguo no sirve como prueba final.

**Gate L7:** matriz completa con captura o resultado verificable por paso,
identificadores QA, usuario actuante, resultado esperado y observado. Cualquier
paso no ejecutado se marca pendiente, nunca aprobado por lectura de código.

### L8. Preparar publicación; ejecutarla solo con autorización

- Congelar los cambios aprobados y comprobar autor/committer de Sergio antes de
  cualquier commit autorizado. No hacer staging global ni incluir trabajo ajeno.
- Identificar remoto, rama y SHA reales. No asumir valores por este documento.
- Preparar orden de migraciones, seed incremental seguro, copia de seguridad,
  ensayo de restauración, compatibilidad con la versión anterior y rollback.
- Probar actualización sobre una copia local representativa y segunda aplicación.
- No publicar usuarios QA, precios simbólicos, notas de ensayo ni secretos.
- Entregar al revisor el diff final, comandos ejecutados, matriz y runbook concreto.
- Solicitar autorización final para push/merge/despliegue/migración del destino
  identificado. Este plan no la concede.
- Tras autorización: comprobar deploy real, SHA, salud, acceso y rutas críticas.
  Migraciones y build verdes por sí solos no demuestran publicación correcta.

**Gate L8:** antes de autorización, candidato publicable revisado. Después de
autorización, producción verificada o rollback documentado y ejecutado si procede.

## 6. Comandos y estrategia de pruebas

Comandos existentes que debe verificar el ejecutor en `package.json`:

```powershell
npm test
npm run build
npx tsc --noEmit --incremental false
npx eslint src scripts
npm run test:diagrama
npm run test:plantillas
npm run test:guardas-sala
npm run test:bocas
npm run test:rutas-cable
npm run test:editor-conexiones
npm run test:concurrencia
```

Antes de cualquier script Postgres, leer su destino y procedimiento de limpieza.
Usar base local desechable identificada, nunca heredar sin comprobar DATABASE_URL.
No ejecutar `db:reset` sobre la base compartida para facilitar las pruebas.

Verificadores nuevos existentes: `scripts/verificar-compras-integrales.mts`,
`scripts/verificar-plano-equipo.mts` y
`src/lib/ciclo-vida-seguimiento-verificar.mjs`. L0 debe dejarlos invocables sin
depender de secretos, archivos ignorados o preparación manual no documentada.

Pruebas por lote según riesgo; regresión completa al cerrar el candidato. Si un
arreglo afirma resolver un bug, ejecutar la prueba contra la versión sin arreglo
en copia aislada y registrar cuántas aserciones fallan realmente. No revertir el
árbol compartido ni inventar resultados de mutación. No escribir pruebas que
solo comparen la implementación consigo misma.

## 7. Paquete obligatorio para el revisor

Crear `docs/revision/<lote>.md` con:

```text
Lote y contrato:
Estado base y estado entregado (SHA o manifiesto de hashes si no hay commit):
Archivos y migraciones incluidos:
Criterios de aceptación: esperado / observado / evidencia:
Comandos ejecutados, fecha, salida y ubicación de logs:
Prueba causal del arreglo y fallos medidos sin él:
Recorrido UI: usuario, ruta, acción, resultado, captura:
Datos o infraestructura modificados y cómo se aislaron:
Limitaciones y puntos no comprobados:
Procedimiento de reversión:
Decisión solicitada al revisor:
```

El revisor recibe artefacto + contrato + evidencia, sin una defensa del autor.
Cada hallazgo debe indicar gravedad, reproducción, resultado esperado y ubicación.
Un desacuerdo técnico se resuelve con una prueba o criterio de aceptación, no por
votación entre modelos. Cero errores críticos/altos sin resolver para aprobar.

## 8. Después y Experimental

**Después:** ampliar por lotes la documentación del catálogo restante,
compatibilidad de otras familias, necesidades de organizaciones distintas,
exportaciones adicionales y optimizaciones basadas en uso medido. El estado
desconocido seguirá siendo válido para una referencia sin documentación pública.

**Experimental:** propuestas automáticas de montaje o rutas, lectura asistida de
fichas con IA y sugerencias de alternativas. Solo propuestas revisables; nunca
inventar puertos, aceptar instalaciones ni emitir compras automáticamente.

No introducir servicios de pago para completar el flujo base. No hay un coste
total o plazo fiable hasta L0 y el inventario L1; el ejecutor entregará entonces
una estimación por lote con supuestos. Prioridad económica: evitar compras
duplicadas y viajes por material faltante. Medir ahorro en incidencias y tiempo
de preparación, sin prometer rentabilidad con importes QA.

## 9. Prompt para abrir la conversación de ejecución

```text
Trabaja en C:\Users\sergi\Desktop\Aplicaciones\AV_design.
Tu rol es ejecutor. Codex, en la conversación donde se preparó este plan,
será el revisor. No te apruebes a ti mismo.

Lee AGENTS.md y docs/40-plan-implementacion-y-revision.md completos.
Lee después docs/39-auditoria-integral.md y docs/38-asistente-equipamiento.md.
El árbol contiene implementación local sin commit y cambios anteriores:
presérvalos; empezar desde HEAD perdería trabajo que debe conservarse.

Ejecuta el plan desde L0 por entregas completas, empezando por reproducir y
consolidar lo que ya existe. No reconstruyas módulos implementados.
Check-in significa prueba técnica final; check-out, entrega y aceptación.

Avanza de forma autónoma en código, investigación y QA local. Máximo dos
subagentes y solo con radios de función independientes; migraciones,
autenticación y transacciones, en serie. No cambies el sistema visual global.
Usa fuentes oficiales para equipos y no confundas ausencia de datos con
compatibilidad. Conserva las bocas físicas y los IDs de cables existentes.

Entrega cada lote al revisor con artefacto, contrato y evidencia ejecutada,
siguiendo la sección 7. Si tienes herramientas de conversaciones, solicita
revisión a 01a07f5b-56ed-7bb3-8295-766f2d4d5057; si no, deja el bloque copiable.
No declares aprobada una entrega hasta recibir la revisión.

Prueba el flujo real primero en escritorio, después en móvil, con proyectista
y técnico sintéticos distintos. No modifiques mi cuenta real, no emitas
pedidos reales ni envíes mensajes externos. No ejecutes commit/push/merge,
despliegue ni migraciones de producción sin autorización aplicable.

Empieza ahora por inventariar y preservar el estado, ejecutar la base y
entregar L0. Continúa las unidades independientes mientras se revisa.
```

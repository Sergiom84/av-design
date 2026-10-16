> **Cierre vigente ·16-10-2026 · July285.** REA10 y la integración están **aceptadas localmente dentro de sus contratos y límites documentados**. La ronda adicional de serialización está aplicada y verificada: catálogo/ofertas guardan, recargan, generan preview y confirman con200; recuperación503 y rebase explícito; cuatro destinos completos en escritorio antes de móvil390. Suite1112/1112; Webpack sinBD, tipos, lint66 y diff-check con exit0. Revisión independiente sin hallazgos. Cierre y evidencias en `docs/29-rea-entrega-local.md` y `output/rea-integracion/rea10/serializacion-ronda-adicional-20261016/raiz/aceptacion-root.json`. No hay unidad REA pendiente en este programa local: **no reaplicar el parche ni relanzar07B/08/09 o prompts históricosE2/E3**. Sin commit, push, merge, despliegue ni producción. Las entradas inferiores conservan su fecha como historia y no reabren trabajo.

> **Relevo anterior (histórico) ·16-10-2026.** REA07B/08/09 cerradas localmente. REA10: los seis hallazgos originales están corregidos; el gate completo de interfaz sigue rojo por PATCH400 de catálogo/ofertas (revisión BIGINT enviada como texto). Sergio autorizó una ronda adicional y pidió una instrucción aparte para liberar contexto. **Parche SIN APLICAR; continuación únicamente por `docs/CONTINUACION_REA_RONDA_ADICIONAL.md`.** Suite1106/1106, build sinBD, tipos/lint y regresiónE2 verdes no equivalen a aceptar ese flujo. No repetir unidades cerradas ni prompts históricos; sin Git/producción. Los bloques inferiores son historia.

> **Reanudación16-10-2026 · July282.** REA07B,08 y09 aceptadas localmente tras sus gates selectivos independientes. REA10 e integración09-10 en ejecución; sin aceptación global. Se conservan límites de voz local, proveedores y scheduler. La matriz conserva la clasificación inicial; la tabla de ejecución describe la entrega actual.

# Cobertura REA y contratos de mejora para AV_design

15-10-2026. Estado por lectura del checkout principal al comenzar esta integración: rama codex/rea-integracion, HEAD 7ba796077ff39e799b9b7eb87109b648c3df5c2d, con E3 local y trabajo sin commit. La tabla es un censo y una especificación: no declara implementados sus contratos nuevos ni comprobada producción.

Hay 7 candidatos ya cubiertos, 9 parciales, 17 mejoras a construir y 1 copia literal sin valor justificado (ST34, el paywall de addons). Los parciales y las mejoras siguen dentro del alcance autorizado. Su tamaño, especialización o antigua etiqueta de opcional no son motivos para descartarlos.

La investigación Xtenav conserva su utilidad como evidencia histórica. La implementación vive únicamente en AV_design. Primero se reconcilia la variante E1 con E2/E3; no se vuelve a ejecutar el prompt histórico de E1 ni se reconstruye E3. El cierre de ejecución se registra en [17-integracion-rea.md](/Users/sergio/Desktop/Aplicaciones/AV_design/docs/17-integracion-rea.md); esta matriz fija el alcance al corte inicial.

## Procedencia y límites

Se leyeron íntegros el ledger Markdown/JSON y el backlog Markdown/JSON, y se comprobó la correspondencia de los 34 IDs/títulos ST, 33 propuestas y 99 criterios. El [JSON de esta matriz](/Users/sergio/Desktop/Aplicaciones/AV_design/docs/18-rea-cobertura.json) conserva hashes, fuentes originales, líneas, evidencias locales, mapeo original, relaciones adicionales y contratos.

| Fuente | Líneas | SHA-256 |
|---|---:|---|
| [static-feature-ledger.md](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/static-feature-ledger.md) | 40 | a7a63c863de673a1690b4652c016c565f4b7504ee472d405580da1c2423dc052 |
| [static-feature-ledger.json](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/static-feature-ledger.json) | 413 | 52f9b89d886beb82db25c7d355b50bd24b43bab4e4520ecc04d25275193bded7 |
| [comparison-backlog.md](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/comparison-backlog.md) | 901 | 39d41cd9d8450efe7fe24a95298e1a495422230f22576c08cde7fc07092229c5 |
| [comparison-backlog.json](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/comparison-backlog.json) | 5470 | a94b2d43104389615ee475e021ebd01e00b7c1b17fc8938ceb7d2f8c62e3c94e |

REA analizó siete assets públicos. Los 34 ST son candidatos de producto interpretados por lectura estática, no 34 pruebas de interfaz ni 34 funciones backend confirmadas. Se conserva Evidence ID ev_9cf7eca2cb20340cb21a369ab52e72ff67682a1124587965f5e17fd8bcc07a74. Esta unidad no repite navegación, extracción ni llamadas a XTEN-AV.

Los endpoints, CSRF, sesión, almacenamiento y proveedores internos de ese SaaS son pistas de implementación, no funciones para copiar. En AV_design se usan sesión/permisos y modelos propios. Los grupos de cuenta y planes se adaptan al ámbito de obra/sede o audiencia autorizada; no crean nuevos niveles obligatorios. ST34 no justifica vender addons al departamento.

## Estado de ejecución ·16-10-2026

La matriz que sigue conserva la clasificación inicial. El avance comprobado por
unidad queda separado en `ejecucion_unidades` del JSON y en el contrato17:

| Unidad | Estado de ejecución | Evidencia o siguiente condición |
|---|---|---|
| REA00–03 | Cerradas localmente según revisiones previas conservadas | R1: inspección documental;01: barrera MVCC y revisiónB;02: correcciónACL;03: polling-final. No acredita producción. |
| REA04 | Cerrada localmente | Reauditoría seis hallazgos,27focales17SQL5carreras6Chrome28paridades; aceptación raíz en su freeze. |
| REA05 | Tiempos y costes cerrados localmente | Revisiones/gates de corrección y aceptaciones raíz conservados; falta gate conjunto actual y ST33general. |
| REA06 | Cerrada localmente | Reauditoría integridad-final sin hallazgos; corte estable1001/WebpacksinBD0 excluye05WIP. |
| REA07 | A/B/C cerradas localmente | Gate selectivo07B de ambosP2 verde:51propuestas+51cortes completos,11puras,104tablasidénticas. `revision/rea07b/correccion-20261016/`; aceptación raíz en su corrección. |
| REA08 | Cerrada localmente | CincoP2 cerrados,63hashes actuales contrastados; privacidad/enlaces y móvil verificados. `revision/rea08/correccion-20261016/dictamen.json`, aceptación raíz junto al freeze. Gate conjunto pendiente. |
| REA09 | Cerrada localmente tras única corrección | Gate independiente F01/F02 verde:15SQL,5Chrome escritorio→móvil,4modelo,29propias. Datos retirados bloquean antes del contenido; fichaE2 exacta con procedencia. Incidente8rawantiguos documentado. Vozreal no disponible; delta09-10 se verifica en10. |
| REA10 | Cerrada localmente tras ronda adicional autorizada | Serialización numérica aplicada; prueba6/6, cuatro destinos HTTP/Chrome completos, catálogo/ofertas PATCH/preview/confirmar200,503/rebase/recarga y móvil390. Suite1112/1112,buildsinBD/tipos/lint66/diff0; revisión independiente sin hallazgos. Cierre en29 y `serializacion-ronda-adicional-20261016/raiz/aceptacion-root.json`. |

## Matriz exhaustiva

Ya cubierto significa que existe el valor de producto señalado; no que toda AVX relacionada esté cerrada. Parcial identifica la parte real y la ampliación exacta. Mejora a construir mantiene un contrato pendiente. Las evidencias locales prueban lectura de código, no ejecución actual, despliegue o estado de una BD.

| ID | Candidato | Estado | AVX del backlog original | Unidad / orden |
|---|---|---|---|---|
| [ST01](#st01) | Plano vinculado a proyecto | Ya cubierto | Base del producto; sin AVX directo | BASE / 0 |
| [ST02](#st02) | Dimensiones de sala con unidad | Parcial; ampliar | Base del producto; sin AVX directo | REA-01 / 1 |
| [ST03](#st03) | Jerarquía ubicación y sububicación | Ya cubierto | Base del producto; sin AVX directo | BASE / 0 |
| [ST04](#st04) | Plantillas propias y de biblioteca | Ya cubierto | AVX-13 | BASE / 0 |
| [ST05](#st05) | Tipos de sala AV | Ya cubierto | Base del producto; sin AVX directo | BASE / 0 |
| [ST06](#st06) | Vista previa de plantilla | Parcial; ampliar | AVX-13 | REA-01 / 1 |
| [ST07](#st07) | Asistente conversa sobre diseño y BOM | Mejora a construir | AVX-31 | REA-09 / 9 |
| [ST08](#st08) | Preferencia de marca para IA | Parcial; ampliar | AVX-18, AVX-31 | REA-02 / 2 |
| [ST09](#st09) | Importar BOM desde archivo | Ya cubierto | AVX-14, AVX-32 | BASE / 0 |
| [ST10](#st10) | Separar coincidencias y productos sin encontrar | Ya cubierto | AVX-14, AVX-32 | BASE / 0 |
| [ST11](#st11) | Sustitución de productos con cantidad | Parcial; ampliar | AVX-14, AVX-32 | REA-01 / 1 |
| [ST12](#st12) | Confirmación humana de áreas detectadas | Mejora a construir | AVX-14, AVX-32 | REA-10 / 10 |
| [ST13](#st13) | Selección múltiple en tabla de productos | Parcial; ampliar | AVX-14 | REA-01 / 1 |
| [ST14](#st14) | Subir documentación de licitación | Mejora a construir | AVX-32 | REA-10 / 10 |
| [ST15](#st15) | Cargar tarifas por grupo | Ya cubierto | AVX-15 | BASE / 0 |
| [ST16](#st16) | Historial persistido del asistente | Mejora a construir | AVX-31 | REA-09 / 9 |
| [ST17](#st17) | Dictado en el asistente | Mejora a construir | AVX-31 | REA-09 / 9 |
| [ST18](#st18) | Generación de informes por módulo | Parcial; ampliar | AVX-31 | REA-03 / 3 |
| [ST19](#st19) | Programar informes con fechas y formato | Mejora a construir | AVX-33 | REA-03 / 3 |
| [ST20](#st20) | Destinatarios y grupos del informe | Mejora a construir | AVX-33 | REA-03 / 3 |
| [ST21](#st21) | Presupuesto desde BOM o diseño | Mejora a construir | AVX-24 | REA-06 / 6 |
| [ST22](#st22) | Plantillas de propuesta/SOW reutilizables | Mejora a construir | AVX-24 | REA-06 / 6 |
| [ST23](#st23) | Cuenta/contacto/grupo obligatorios | Mejora a construir | AVX-24, AVX-28 | REA-06 / 6 |
| [ST24](#st24) | Contrato/acuerdo de servicio | Mejora a construir | AVX-23 | REA-08 / 8 |
| [ST25](#st25) | Convertir origen en proyecto X-PRO | Parcial; ampliar | AVX-21 | REA-04 / 4 |
| [ST26](#st26) | Convertir a proyecto de servicio | Mejora a construir | AVX-23 | REA-08 / 8 |
| [ST27](#st27) | Generar tareas desde áreas y productos | Mejora a construir | AVX-21 | REA-04 / 4 |
| [ST28](#st28) | Grupos y recursos asignados | Parcial; ampliar | AVX-21 | REA-04 / 4 |
| [ST29](#st29) | Embudo de presupuestos por estado | Mejora a construir | AVX-28, AVX-33 | REA-07 / 7 |
| [ST30](#st30) | Embudo monetario de proyectos/propuestas | Mejora a construir | AVX-28, AVX-33 | REA-07 / 7 |
| [ST31](#st31) | Dashboard configurable | Parcial; ampliar | AVX-33 | REA-02 / 2 |
| [ST32](#st32) | Carga de trabajo y vencimientos | Mejora a construir | AVX-21, AVX-33 | REA-04 / 4 |
| [ST33](#st33) | Beneficio y ratio de aceptación | Mejora a construir | AVX-22, AVX-33 | REA-07 / 7 |
| [ST34](#st34) | Acceso por addon | No mejora justificada | Base del producto; sin AVX directo | BASE / 0 |

## Orden de construcción y contratos ejecutables

El orden respeta dependencias. REA-03 (informes) y REA-06 (propuestas internas) no dependen de IA; REA-04 usa la obra y los técnicos existentes. REA-07 necesita horas/valoración para no inventar beneficio. REA-08 requiere activo entregado real. REA-09 permite consulta local con fuentes sin fingir generación; REA-10 reutiliza E2 para confirmar material y no promete OCR si no está configurado.

### REA-00 · Reconciliar la variante E1 conservando E2/E3

**Candidatos:** Prerequisito de reconciliación E1. **Depende de:** Bases existentes.

Comparar las correcciones E1 de d38d9a3 y worktrees con el checkout principal; integrar selectivamente, sin copiar el snapshot E2 antiguo ni reimplementar E3.

**Modelo y frontera:** Se conserva el modelo vigente de snapshot/documentos/revisión. No nace otro exportador.

**Gate comprobable:**

- Regresión de GET antiguo frente a paquete nuevo, error interno sin SQL, integridad/caducidad de paquetes y nombres/rótulos PDF cubiertos.
- Exportaciones conservan revisión/anotaciones E3 y partidas E2; mismos hechos operativos antes/después.
- Conservar worktrees y evidencia histórica hasta cerrar reconciliación; no commit/push/despliegue.

### REA-01 · Medidas, previsualización y selección revisable

**Candidatos:** ST02, ST06, ST11, ST13. **Depende de:** REA-00.

Ampliar entradas existentes: conversión visible de medidas, preview de plantilla, selección masiva segura y alternativa BOM trazada.

**Modelo y frontera:** Sólo se añaden metadatos de sustitución si hacen falta; metros, plantilla y lote siguen siendo canónicos. La vista de plantilla nunca crea sala.

**Gate comprobable:**

- Aplicar los criterios de sus cuatro ST en fixtures mixtas y prueba de servidor; snapshot de BD sin mutaciones al previsualizar.
- Escritorio completo antes de móvil; selección por teclado accesible, cantidades/unidades preservadas y cancelación reversible.

### REA-02 · Preferencias personales y panel operativo

**Candidatos:** ST08, ST31. **Depende de:** REA-00.

Guardar marcas/filtros y visibilidad/orden de tarjetas por usuario real, con valores por defecto y explicación del resultado.

**Modelo y frontera:** Preferencias por usuario separadas de catálogo, diseño y permisos; sólo se guardan claves permitidas.

**Gate comprobable:**

- Dos usuarios aislados, retirada inmediata de permiso, restablecer valores por defecto y no consultar/devolver secciones ocultas.
- Tarjetas actuales concuerdan con detalle; futuras horas/tareas/finanzas se habilitan al existir su fuente, sin contadores inventados.

### REA-03 · Informes reproducibles y programación interna

**Candidatos:** ST18, ST19, ST20. **Depende de:** REA-00, REA-02.

Registro de definiciones de informe, selección de ámbito/período/formato, programación y ejecuciones internas con audiencia autorizada.

**Modelo y frontera:** Definición inmutable por ejecución, ámbito/snapshot, usuario, zona horaria, ocurrencia única, estado/errores y referencias a archivos. El runner manual sirve de gate; scheduler desplegado queda explícito.

**Gate comprobable:**

- Rango/zonahoraria/DST, ocurrencia idempotente, último correcto y fallos; descarga consistente y autorización de cada dato/receptor.
- Funciona sin IA ni correo. Un adaptador externo sin configurar muestra pendiente de configuración y no simula envío; enviar a terceros requiere instrucción explícita.

### REA-04 · Plan de montaje, tareas y agenda

**Candidatos:** ST25, ST27, ST28, ST32. **Depende de:** REA-00, REA-02.

Añadir plan al proyecto existente; tareas borrador desde tipología/material confirmado, responsables técnicos, fechas y agenda con conflictos.

**Modelo y frontera:** Planes/tareas/asignaciones con IDs nuevos, origen de revisión, estado de planificación, técnico y rango temporal. No añade otro proyecto ni reutiliza hitos como tareas.

**Gate comprobable:**

- Generación idempotente/diff, tarea de duración desconocida, vencimientos y solapamientos, técnico inactivo y permisos.
- Completar tareas no registra hechos físicos; repetir, editar o anular plan conserva stock, hitos, pedidos, recepción y carga.

### REA-05 · Horas y coste real trazables

**Candidatos:** ST33. **Depende de:** REA-04.

Registrar tiempos por tarea/sala/autor y correcciones; comparar coste previsto/real desde movimientos y tarifas congeladas.

**Modelo y frontera:** Registros de tiempo con minutos reales, tarifa opcional y fecha de vigencia congelada; corrección con antecedente/autor, sin sobrescritura muda.

**Gate comprobable:**

- Tiempo positivo, sin solapamientos inadvertidos, suma exacta, correcciones auditadas, coste laboral sólo para permiso autorizado.
- Tarifa ausente es coste desconocido, no cero. Material realmente usado proviene de hechos existentes y no se suma dos veces.

### REA-06 · Propuesta interna versionada y alcance reutilizable

**Candidatos:** ST21, ST22, ST23. **Depende de:** REA-00.

Documento estructurado por revisión de diseño/BOM, plantillas de alcance, destinatario opcional y valoración explícita cuando se aportan datos.

**Modelo y frontera:** Propuesta y revisiones inmutables, referencia a diseño/BOM, secciones/variables, destinatario snapshot y líneas de valoración. No segundo BOM vivo, CRM obligatorio ni importes heredados.

**Gate comprobable:**

- Actualización explícita y marca de desactualizada; copiar plantilla no copia impuestos/totales/cliente/aceptación.
- Coste 100 con recargo 20% = 120 y margen 20% = 125; moneda, impuestos configurados y redondeo visibles, sin precios desconocidos como cero.
- Vista previa/PDF y permisos; editar documento no altera diseño ni hechos de obra.

### REA-07 · Eventos de propuesta y métricas económicas fiables

**Candidatos:** ST29, ST30, ST33. **Depende de:** REA-05, REA-06.

Registrar decisión/estado de propuesta por revisión y calcular embudo, importes y ratios desde eventos y costes trazables.

**Modelo y frontera:** Eventos con actor/fecha/revisión; estados derivados. Aceptación interna no firma contractual; sin evento verificable no hay visto/enviado/cobrado.

**Gate comprobable:**

- No duplicar revisiones, denominadores cero sin datos, monedas separadas/tipo congelado, beneficio parcial y acceso restringido.
- Una aceptación no cambia hitos físicos/stock y una revisión nueva no hereda aceptación; envío/cobro real sólo con transporte/proveedor y autorización específica.

### REA-08 · Activos, incidencias y cobertura de servicio

**Candidatos:** ST24, ST26. **Depende de:** REA-04.

Crear el mínimo registro de activos entregados requerido para incidencias, visitas y cobertura/acuerdos internos sin duplicar instalación.

**Modelo y frontera:** Activo individual y serial opcional con historial; incidencia sobre sala/activo/revisión entregada; visitas, evidencia y acuerdo con vigencia/fuente.

**Gate comprobable:**

- Activo previsto frente a instalado, serial desconocido/duplicado, traslado/sustitución trazables y stock exclusivamente por movimientos existentes.
- Cobertura/prioridad/SLA definidos, fechas válidas y cierre con prueba; no genera contrato vinculante, pago, recepción o nuevo hito automáticamente.

### REA-09 · Consulta contextual con fuentes, historial y dictado

**Candidatos:** ST07, ST08, ST16, ST17, ST18. **Depende de:** REA-00, REA-02, REA-03.

Consultar datos autorizados de catálogo/diseño/BOM/documentos con fuentes y revisión; persistir historial e incorporar dictado editable en español.

**Modelo y frontera:** Conversación separada de revisiones, mensajes/fuentes y contexto de permisos; adaptador de consulta local y adaptador generativo sólo si está configurado.

**Gate comprobable:**

- Set de preguntas con respuestas esperadas/fuentes/abstenciones; usuario sin acceso no recibe datos por contexto o historial.
- Consulta determinista útil sin proveedor y sin llamarla IA generativa; al configurar modelo se miden calidad/coste/latencia y se limita el ámbito enviado.
- Borradores siempre preview/diff y confirmación; voz con permiso explícito, soporte detectado y teclado completo.

### REA-10 · Requisitos y licitación con revisión humana

**Candidatos:** ST12, ST14. **Depende de:** REA-00, REA-09.

Incorporar documento fuente y extracción por página/fragmento de áreas/requisitos; confirmar antes de crear jerarquía o material mediante E2.

**Modelo y frontera:** Documento hash/bytes/procedencia/autor; requisitos con ancla textual/página y certeza de extracción; plan de aplicación revisable e idempotente.

**Gate comprobable:**

- PDF con texto/escaneado/dañado y archivo límite; nunca inventar medidas/cantidades ni confundir parser con OCR/modelo.
- Validar áreas ambiguas, referencias variantes y selección; fallo intermedio revierte lote y no toca hechos operativos.
- Si hace falta OCR/modelo externo, el adaptador y su configuración son una dependencia de esa extracción; conservar revisión manual/estructurada funcional.

## Contrato por candidato

### ST01 · Plano vinculado a proyecto

**Estado al corte:** Ya cubierto. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xdraw_modal.js:463](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xdraw_modal.js:463), líneas 463–536. Enviar design_name, project_id y design_ids a la creación; comprobar vinculación real en UI. Runtime no verificado.

**Comprobado en AV_design:** Proyecto → Localización → Sala, plano propio de sala, adopción de legado y creación contextual ya existen.

**Decisión y valor:** Conservar el vínculo actual; otro design_id, proyecto paralelo o vínculo obligatorio para legado duplicaría el modelo.

**AVX:** Sin correspondencia AVX directa en el backlog original.

**Dependencias:** Jerarquía actual; guardas de salas/proyectos.

**Criterios comprobables:**

- Crear sala desde la obra conserva su localizacion_id y la sede de la obra; el plano leído corresponde a esa sala.
- Una sala legado sin obra sigue abriéndose y puede adoptarse sin perder equipos, rutas o historial.

**Evidencia local:**

- [src/components/sala/alta.tsx:74](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/sala/alta.tsx:74): Localización por defecto según proyecto; no repregunta la sede.
- [src/lib/datos-proyectos.ts:123](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-proyectos.ts:123): Lectura de obra y jerarquía.
- [src/app/acciones.ts:215](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/acciones.ts:215): Alta de sala.

### ST02 · Dimensiones de sala con unidad

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-01. **Orden:** 1.

**Evidencia de referencia:** [xdraw_modal.js:503](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xdraw_modal.js:503), líneas 503–513. Introducir largo, ancho y alto en Feet/Meters antes de diseñar. Runtime no verificado.

**Comprobado en AV_design:** Largo, ancho y alto se introducen explícitamente en metros; la BD usa numeric(6,2). No se localizó conversión de entrada desde pies.

**Decisión y valor:** Añadir conversión explícita pies→metros donde se reciben medidas evita conversiones manuales. Mantener metros como única unidad persistida y de cálculo.

**AVX:** Sin correspondencia AVX directa en el backlog original.

**Dependencias:** Formulario de sala/plantilla existente; validadores de medidas; no cambiar formula de calculo-cable.ts.

**Criterios comprobables:**

- 10 pies convierten a 3,048 m y muestran antes de confirmar la precisión persistida de 3,05 m; no se cambia la unidad de datos existentes.
- Cambiar selector sin guardar no altera medidas, coordenadas ni metraje. Vacío permanece vacío; negativos, infinito y unidades desconocidas se rechazan.
- Guardar y reabrir reproduce el valor normalizado en metros sin volver a convertirlo.

**Evidencia local:**

- [src/components/sala/medidas.tsx:88](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/sala/medidas.tsx:88): Campos Largo/Ancho/Alto (m).
- [db/schema.sql:145](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:145): Precisión actual de medidas de sala.

### ST03 · Jerarquía ubicación y sububicación

**Estado al corte:** Ya cubierto. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xdraw_modal.js:180](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xdraw_modal.js:180), líneas 180–296. Asignar cada diseño a una ubicación o sububicación del proyecto. Runtime no verificado.

**Comprobado en AV_design:** La jerarquía ya representa sede de obra y localización de edificio/planta; no hay que añadir otro nivel.

**Decisión y valor:** Conservar exactamente los dos niveles del contrato. Copiar location/sub-location del SaaS introduciría preguntas duplicadas.

**AVX:** Sin correspondencia AVX directa en el backlog original.

**Dependencias:** Contrato AGENTS de jerarquía.

**Criterios comprobables:**

- La localización se elige una vez; guardar no reintroduce edificio ni nivel en salas.
- Agrupar la portada incluye localizaciones vacías y salas legado con LEFT JOIN.

**Evidencia local:**

- [src/lib/proyecto.ts:68](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/proyecto.ts:68): Agrupación por localización.
- [src/lib/datos-proyectos.ts:123](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-proyectos.ts:123): Jerarquía normalizada.
- [db/schema.sql:880](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:880): Tabla localizaciones.

### ST04 · Plantillas propias y de biblioteca

**Estado al corte:** Ya cubierto. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xdraw_modal.js:54](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xdraw_modal.js:54), líneas 54–99. Elegir plantilla guardada o partir de scratch. Runtime no verificado.

**Comprobado en AV_design:** La sala puede nacer en blanco, desde plantilla y guardar su montaje como plantilla; E3 añade alternativa independiente.

**Decisión y valor:** Reutilizar el catálogo propio ya cargado. Una biblioteca externa sólo aporta si se valida su contenido y procedencia; el asset no justifica importarla.

**AVX:** AVX-13.

**Dependencias:** Plantillas existentes; E3 AVX-13 conservada.

**Criterios comprobables:**

- Aplicar plantilla copia medidas/mobiliario/equipos/giros/tiradas una vez y rechaza sala con equipos o rosetas.
- Guardar sala como plantilla y recrearla conserva coordenadas nulas y rotaciones; no copia hechos operativos.

**Evidencia local:**

- [src/components/sala/alta.tsx:46](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/sala/alta.tsx:46): Medidas heredadas de plantilla.
- [src/components/plano-editor/origen-diagrama.tsx:97](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/plano-editor/origen-diagrama.tsx:97): Aplicación explícita.
- [src/app/acciones.ts:651](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/acciones.ts:651): Guardar sala como plantilla.

### ST05 · Tipos de sala AV

**Estado al corte:** Ya cubierto. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xdraw_modal.js:19](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xdraw_modal.js:19), líneas 19–32. Listado legacy xdraw_templates_old conserva escenarios AV de reunión, classroom, auditorium, residential, retail, videowall, Zoom y otros; confirmar taxonomía actual devuelta por servidor. Runtime no verificado.

**Comprobado en AV_design:** Tipología es vocabulario editable y existen 17 plantillas obtenidas del inventario real.

**Decisión y valor:** Conservar tipologías del departamento. El array legacy de XTEN-AV no es una taxonomía actual probada ni mejora los nombres reales.

**AVX:** Sin correspondencia AVX directa en el backlog original.

**Dependencias:** CSV e inventario real del proyecto.

**Criterios comprobables:**

- Una tipología propia se puede crear/editar y se conserva en sala y plantilla.
- Una variante real y su aforo no se fusionan por parecerse a un nombre legacy de XTEN-AV.

**Evidencia local:**

- [src/components/sala/medidas.tsx:75](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/sala/medidas.tsx:75): Tipología editable.
- [src/lib/tipos.ts:139](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/tipos.ts:139): Tipología de plantilla.
- [src/app/plantillas/page.tsx:35](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/plantillas/page.tsx:35): Plantillas derivadas del inventario.

### ST06 · Vista previa de plantilla

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-01. **Orden:** 1.

**Evidencia de referencia:** [xdraw_modal.js:303](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xdraw_modal.js:303), líneas 303–333. Control de preview en el selector de plantilla. Runtime no verificado.

**Comprobado en AV_design:** El selector ya muestra tipología, medidas y recuentos de muebles/equipamiento/tiradas antes de aplicar. No se localizó vista gráfica previa.

**Decisión y valor:** Añadir croquis y relación de referencias sin crear una sala permite comprobar distribución y cableado antes de aplicar; se amplía la previsualización existente.

**AVX:** AVX-13.

**Dependencias:** Lectores normalizados de plantilla; GeometriaPlano/croquis; permisos actuales.

**Criterios comprobables:**

- Elegir plantilla abre vista de sólo lectura desde los mismos datos y geometría del plano; nombres largos y ausencias quedan visibles.
- Abrir/cerrar la vista no escribe sala, plantilla, stock ni versión. Dimensiones ausentes no se representan como un plano medido.
- Aplicar conserva las mismas guardas de sala vacía, catálogo activo, mobiliario y concurrencia; el preview no introduce un camino de escritura.

**Evidencia local:**

- [src/components/plano-editor/origen-diagrama.tsx:178](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/plano-editor/origen-diagrama.tsx:178): Previsualización textual ya existente.
- [src/lib/datos.ts:177](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos.ts:177): PlantillaElegible contiene recuentos, no escena gráfica.
- [src/components/plantilla/ficha.tsx:59](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/plantilla/ficha.tsx:59): Creación desde plantilla.

### ST07 · Asistente conversa sobre diseño y BOM

**Estado al corte:** Mejora a construir. **Unidad:** REA-09. **Orden:** 9.

**Evidencia de referencia:** [xavia_main.js:928](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:928), líneas 928–993. API de chat intercambia consulta, historial, productos, cantidades y datos de diseño. Runtime no verificado.

**Comprobado en AV_design:** No se localizó asistente contextual en src, rutas, tablas o dependencias. Catálogo, diseño, revisión y BOM son fuentes deterministas disponibles.

**Decisión y valor:** Añadir consulta técnica con fuentes y borradores revisables sobre el diseño actual. La primera utilidad puede ser búsqueda/resumen determinista; generación libre requiere proveedor configurado.

**AVX:** AVX-31.

**Dependencias:** E2 AVX-16; E3 AVX-06; REA-02 para preferencias; adaptador de modelo explícito para generación.

**Criterios comprobables:**

- Una consulta sobre equipos/cable muestra sala y revisión, referencias exactas y enlaces a las fuentes; si falta dato responde desconocido.
- Sin proveedor disponible, la consulta a datos locales sigue funcionando y no se presenta como generación IA; nunca inventa modelos, precios o metros.
- Un borrador generado muestra diff y necesita confirmación mediante las guardas/transacciones existentes; consultar no escribe diseño ni stock.

**Evidencia local:**

- [src/lib/documentos/datos.ts:18](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/datos.ts:18): Snapshot coherente reutilizable como fuente.
- [src/lib/revisiones-diseno-repositorio.ts:38](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/revisiones-diseno-repositorio.ts:38): Diseño y revisión.
- [src/lib/catalogo-tecnico-repositorio.ts:66](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/catalogo-tecnico-repositorio.ts:66): Fichas verificables.

### ST08 · Preferencia de marca para IA

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-02. **Orden:** 2.

**Evidencia de referencia:** [xavia_main.js:977](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:977), líneas 977–987. La respuesta del chat contempla brand_preference; aún falta ver cómo condiciona la selección. Runtime no verificado.

**Comprobado en AV_design:** Existen favoritos personales y búsqueda por marca, pero no preferencias persistidas de marca ni selección IA condicionada explicable.

**Decisión y valor:** Guardar filtros/preferencias personales de marca y explicar el motivo del resultado. El asistente debe reutilizarlos, sin sustituir equipos automáticamente.

**AVX:** AVX-18, AVX-31.

**Dependencias:** Favoritos E2; identidad de usuario real; REA-09 sólo para la extensión IA.

**Criterios comprobables:**

- Guardar/quitar marca preferida afecta sólo al usuario actual y restaura los resultados al deshacer.
- Buscar muestra por qué aparece un artículo: filtro, favorito o uso; variantes y referencias instaladas siguen consultables.
- Preferir una marca no cambia equipo, precio, puerto, stock ni revisión de la sala; el contexto del asistente registra qué preferencia se aplicó.

**Evidencia local:**

- [src/lib/catalogo-favoritos.ts:16](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/catalogo-favoritos.ts:16): Motivos explícitos de favoritos.
- [src/lib/catalogo-favoritos-repositorio.ts:33](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/catalogo-favoritos-repositorio.ts:33): Preferencia por usuario existente.
- [src/app/catalogo/[marca]/page.tsx:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/catalogo/[marca]/page.tsx:1): Filtro actual por marca.

### ST09 · Importar BOM desde archivo

**Estado al corte:** Ya cubierto. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xavia_main.js:1820](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:1820), líneas 1820–1875. Leer archivo en endpoint upload_bom_file_xavia y recibir matching de catálogo. Runtime no verificado.

**Comprobado en AV_design:** E2 importa BOM desde CSV/XLSX con preview, archivo original/hash, selección humana, transacción y reversión. No coloca equipos ni crea conexiones.

**Decisión y valor:** La importación de archivo del candidato ya se resuelve determinísticamente. Importación desde PDF/licitación se trata aparte en ST14; no rehacer E2 con IA.

**AVX:** AVX-14, AVX-32.

**Dependencias:** E2 AVX-14 existente; regresiones de E1/E3.

**Criterios comprobables:**

- CSV/XLSX válido presenta filas antes de escribir; confirmar sólo añade partidas elegidas de la sala autorizada.
- Se conservan archivo/hash, números/unidades y reversión; un fallo intermedio revierte el lote completo.
- Un cambio de catálogo/preview obliga a revisar; no cambia posiciones, conexiones, precios o hechos de obra ajenos al destino.

**Evidencia local:**

- [src/lib/importacion/servicio.ts:21](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/servicio.ts:21): Previsualización.
- [src/lib/importacion/servicio.ts:77](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/servicio.ts:77): Confirmación transaccional.
- [src/components/importacion/importador.tsx:96](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/importacion/importador.tsx:96): CSV/XLSX y alcance explicado.

### ST10 · Separar coincidencias y productos sin encontrar

**Estado al corte:** Ya cubierto. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xavia_main.js:1857](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:1857), líneas 1857–1875. La respuesta contempla matched_products y unmatched_products. Runtime no verificado.

**Comprobado en AV_design:** E2 distingue alta, coincidencia, ambigua, no_encontrada y rechazada por fila y muestra sus recuentos.

**Decisión y valor:** Conservar matching literal y revisión humana; matched/unmatched del SaaS no añade un algoritmo demostrado.

**AVX:** AVX-14, AVX-32.

**Dependencias:** E2 revisión de filas.

**Criterios comprobables:**

- Una referencia exacta tiene candidato; modelo ambiguo exige elección y desconocido queda no_encontrada.
- QB65R y QB65R-B permanecen distintas; una fila rechazada nunca se confirma mediante selección global o asistente.

**Evidencia local:**

- [src/lib/importacion/modelo.ts:19](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/modelo.ts:19): Estados exactos del preview.
- [src/lib/importacion/revision.ts:11](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/revision.ts:11): Coincidencias exactas.
- [src/components/importacion/importador.tsx:118](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/importacion/importador.tsx:118): Recuento mostrado.

### ST11 · Sustitución de productos con cantidad

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-01. **Orden:** 1.

**Evidencia de referencia:** [xavia_main.js:1973](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:1973), líneas 1973–2073. Seleccionar alternativo conserva nombre original, alternativa, cantidad, tipo e índice de fila. Runtime no verificado.

**Comprobado en AV_design:** E2 permite resolver una fila no encontrada con buscador y mantiene la cantidad original; para una fila con coincidencia sólo permite sus candidatos exactos. El informe no tiene motivo específico de sustitución.

**Decisión y valor:** Completar la sustitución explícita en BOM con origen, referencia elegida y motivo verificables; mantener aparte la resolución literal de ofertas para no atribuir el precio de un modelo a otro.

**AVX:** AVX-14, AVX-32.

**Dependencias:** E2 selección/hash/reversión; buscador de catálogo único; contrato específico de motivo si se sustituye coincidencia.

**Criterios comprobables:**

- Resolver/sustituir una fila de BOM conserva archivo, fila, nombre/referencia originales, artículo destino, unidad, cantidad y motivo; la UI compara original/alternativo antes de confirmar.
- Sustituir por artículo inactivo, unidad incompatible o catálogo cambiado se rechaza en servidor; cancelar no escribe.
- No se aplica sustitución automática a tarifas/catálogo, ni a equipos/conexiones ya dibujados. Reversión de lote conserva las dependencias posteriores.

**Evidencia local:**

- [src/components/importacion/importador.tsx:128](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/importacion/importador.tsx:128): Resolución de no encontrados.
- [src/lib/importacion/servicio.ts:109](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/servicio.ts:109): Unidad/activo/revisión y candidatos exactos.
- [src/lib/importacion/servicio.ts:149](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/servicio.ts:149): Cantidad de la fuente al añadir BOM.

### ST12 · Confirmación humana de áreas detectadas

**Estado al corte:** Mejora a construir. **Unidad:** REA-10. **Orden:** 10.

**Evidencia de referencia:** [xavia_main.js:719](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:719), líneas 719–784. Checkboxes para áreas cuando confidence está por debajo del umbral; paso de revisión previo a crear. Runtime no verificado.

**Comprobado en AV_design:** E2 exige elegir referencias, pero no extrae áreas/salas de documentos ni conserva confirmación de cada área inferida.

**Decisión y valor:** Preparar requisitos detectados de licitación con página/fragmento, certeza y aprobación humana, antes de vincularlos a localizaciones o crear salas.

**AVX:** AVX-14, AVX-32.

**Dependencias:** REA-10 ST14; E2 preview; E3 revisiones; E1 entrega; parser/proveedor de extracción según formato.

**Criterios comprobables:**

- En fixture con dos salas y un área ambigua se muestran las tres hipótesis y su fragmento; ninguna nace sin elección explícita.
- El umbral/confianza no sustituye la revisión de nombres, localización, medidas, referencias y cantidades; desconocido permanece desconocido.
- Confirmación repetida es idempotente; conflictos y fallo intermedio revierten el lote sin tocar hechos operativos.

**Evidencia local:**

- [src/lib/importacion/modelo.ts:7](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/modelo.ts:7): El modelo actual recibe salaId, no áreas inferidas.
- [src/lib/datos-proyectos.ts:223](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-proyectos.ts:223): Jerarquía donde vincular áreas confirmadas.

### ST13 · Selección múltiple en tabla de productos

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-01. **Orden:** 1.

**Evidencia de referencia:** [xavia_main.js:2075](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:2075), líneas 2075–2140. Checkbox por fila y selección global. Runtime no verificado.

**Comprobado en AV_design:** Se pueden elegir varias filas una a una y confirmar su conjunto; no hay checkbox global o acción de seleccionar coincidencias válidas.

**Decisión y valor:** Añadir selección global acotada a filas elegibles y limpieza de selección evita repetir la misma acción cientos de veces sin adivinar ambigüedades.

**AVX:** AVX-14.

**Dependencias:** E2 preview y selección existente; evitar relajar validadores de servidor.

**Criterios comprobables:**

- Seleccionar coincidencias válidas sólo marca una coincidencia activa sin errores; omite ambiguas, desconocidas, rechazadas y duplicados en conflicto indicando el motivo.
- Desmarcar todas deja cero filas; cambios de archivo/destino/preview invalidan la selección antigua.
- Fixture mixta de 500 filas confirma exactamente los identificadores visibles/elegidos; el servidor mantiene las validaciones aunque se manipule el formulario.

**Evidencia local:**

- [src/components/importacion/importador.tsx:72](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/importacion/importador.tsx:72): Selección individual actual.
- [src/components/importacion/importador.tsx:122](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/importacion/importador.tsx:122): Tabla sin selección global.
- [src/lib/importacion/servicio.ts:82](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/servicio.ts:82): Validación de selección y duplicados.

### ST14 · Subir documentación de licitación

**Estado al corte:** Mejora a construir. **Unidad:** REA-10. **Orden:** 10.

**Evidencia de referencia:** [xavia_main.js:1767](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:1767), líneas 1767–1818. Cargar bid document, crear proyecto y conservar referencia de documento; lectura automática del servidor no verificada. Runtime no verificado.

**Comprobado en AV_design:** El importador actual sólo admite CSV/XLSX y filas de catálogo/BOM/precios; no se localizó entidad de documento de licitación ni requisitos extraídos.

**Decisión y valor:** Conservar documento fuente y extraer requisitos revisables enlazados al proyecto. Reutilizar E2 para material confirmado y ST12 para áreas; evitar un importador paralelo.

**AVX:** AVX-32.

**Dependencias:** E2 parser/preview/lotes; E3 revisiones; ST12; límites de archivos; extracción OCR/modelo sólo si está configurada y probada.

**Criterios comprobables:**

- Un PDF con texto o documento admitido conserva bytes/hash, autor, procedencia y página/fragmento de cada requisito; un escaneo sin texto se identifica y solicita extracción compatible.
- El preview lista referencias/cantidades/áreas detectadas con revisión humana; no infiere medidas físicas, stock o importes ausentes.
- Aplicar requiere permisos vigentes, diff y confirmación; descargar fuente se limita al ámbito autorizado y fallo de extracción no crea obra incompleta.

**Evidencia local:**

- [src/lib/importacion/modelo.ts:33](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/modelo.ts:33): Formatos actuales csv/xlsx.
- [src/components/importacion/importador.tsx:96](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/importacion/importador.tsx:96): Entrada actual de archivos.
- [src/lib/catalogo-tecnico.ts:7](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/catalogo-tecnico.ts:7): Límite de archivos técnicos existente, no sustituye modelo de licitación.

### ST15 · Cargar tarifas por grupo

**Estado al corte:** Ya cubierto. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xavia_main.js:1653](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:1653), líneas 1653–1762. Seleccionar grupo al importar fichero de precios y mostrar seguimiento de procesamiento. Runtime no verificado.

**Comprobado en AV_design:** E2 importa ofertas/tarifas con proveedor, presupuesto, fecha, moneda, unidad de compra, cantidad, procedencia y lote/usuario. No existe agrupación multiempresa del SaaS.

**Decisión y valor:** El valor es carga trazable/revisable ya cubierta. Usar proveedor/origen/obra cuando aplique; copiar un grupo obligatorio no añade valor al departamento.

**AVX:** AVX-15.

**Dependencias:** E2 AVX-15; criterios de kits existentes; permisos catálogo.

**Criterios comprobables:**

- Cargar tarifa normaliza unidad de compra y moneda con parámetros; conserva todas las ofertas previas y la marca orientativa/final.
- Cero de kit no se transforma en precio gratuito y modificar tarifa no reescribe precios congelados de pedidos.
- Lote conserva propietario/archivo/hash y estado consultable; la falta de grupo SaaS no impide una importación válida.

**Evidencia local:**

- [src/lib/importacion/revision.ts:47](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/revision.ts:47): Proveedor/fecha/moneda/unidad/kit.
- [src/lib/importacion/servicio.ts:160](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/servicio.ts:160): Oferta nueva y procedencia.
- [src/lib/importacion/modelo.ts:47](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/modelo.ts:47): Lote trazable.

### ST16 · Historial persistido del asistente

**Estado al corte:** Mejora a construir. **Unidad:** REA-09. **Orden:** 9.

**Evidencia de referencia:** [xavia_main.js:995](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:995), líneas 995–1030. Código solicita guardar/transmitir chat al diseño; permanencia tras recarga necesita prueba. Runtime no verificado.

**Comprobado en AV_design:** No se localizó historial de consultas de asistente; revisiones_diseno es historial de diseño y no debe reutilizarse como chat.

**Decisión y valor:** Guardar conversaciones ligadas a usuario/proyecto/sala/revisión y sus fuentes permite retomar una consulta sin mezclarla con revisiones inmutables.

**AVX:** AVX-31.

**Dependencias:** REA-09 ST07; identidad y permisos; nuevo almacenamiento separado del historial de diseño.

**Criterios comprobables:**

- Tras recargar se muestran pregunta/respuesta/fuentes y revisión usada, con aislamiento entre dos usuarios y ámbitos no autorizados.
- Una revisión nueva marca el contexto anterior como histórico; el historial nunca se aplica automáticamente al diseño.
- Retención es visible/configurable; borrar conversación autorizada no elimina fuentes, revisión o hechos de la obra.

**Evidencia local:**

- [db/schema.sql:1995](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:1995): revisiones_diseno tiene otra finalidad.
- [src/lib/revisiones-diseno-repositorio.ts:95](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/revisiones-diseno-repositorio.ts:95): Historial de diseño existente.

### ST17 · Dictado en el asistente

**Estado al corte:** Mejora a construir. **Unidad:** REA-09. **Orden:** 9.

**Evidencia de referencia:** [xavia_main.js:2325](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:2325), líneas 2325–2405. webkitSpeechRecognition con transcripción parcial; código exige soporte de browser y fija en-US. Runtime no verificado.

**Comprobado en AV_design:** No se localizó captura de voz/dictado en la interfaz. El script de referencia fija en-US y depende de soporte del navegador.

**Decisión y valor:** Dictado en español como entrada editable mejora el uso de campo; conservar teclado como entrada completa y no enviar ni aplicar la transcripción por sí sola.

**AVX:** AVX-31.

**Dependencias:** REA-09 interfaz de consulta; API del navegador detectada; decisión de procesamiento de voz si no es local.

**Criterios comprobables:**

- Con soporte, elegir Español (España) permite iniciar/parar y editar transcripción final antes de consultar; resultados parciales no duplican texto.
- Permiso de micrófono denegado, cancelación y navegador sin soporte muestran estado comprensible y dejan escribir con teclado.
- No inicia escucha al montar ni envía voz/texto sin acción; si el motor procesa en proveedor remoto se informa antes de activarlo.

**Evidencia local:**

- [src/components/catalogo/combobox-remoto.tsx:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/components/catalogo/combobox-remoto.tsx:1): Entrada actual por teclado.
- [src/lib/usuarios.ts:54](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/usuarios.ts:54): Permisos existentes que conserva el asistente.

### ST18 · Generación de informes por módulo

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-03. **Orden:** 3.

**Evidencia de referencia:** [xavia_main.js:526](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:526), líneas 526–611. Chat permite escoger informes X-DRAW, X-DOC, X-PRO según intent. Runtime no verificado.

**Comprobado en AV_design:** E1 ya genera PDF/XLSX/CSV/ZIP de sala/obra; no hay informes operativos por rango, módulos o intención de consulta.

**Decisión y valor:** Añadir registro de informes deterministas por ámbito y período; el asistente sólo elige una definición existente y muestra su selección antes de generar.

**AVX:** AVX-31. Relación adicional razonada: AVX-33, AVX-01, AVX-02.

**Dependencias:** E1 reconciliada; lectores de operación; permiso de cada dato; ST19 sólo para programación.

**Criterios comprobables:**

- Informe de material/carga/estado indica definición, período, zona horaria, ámbito y revisión; cifra y enlace al detalle coinciden.
- Elegir un informe no requiere proveedor de IA y conserva la autorización de cada sección consultada y de la descarga.
- Un mismo snapshot y selección genera resultados coherentes en pantalla/exportación; campos desconocidos quedan ausentes, nunca cero financiero válido.

**Evidencia local:**

- [src/lib/documentos/modelo.ts:36](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/modelo.ts:36): Entregables existentes por tipo.
- [src/lib/documentos/modelo.ts:26](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/modelo.ts:26): Snapshot de exportación actual.
- [src/lib/datos-almacen.ts:522](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-almacen.ts:522): Contadores de operación existentes.

### ST19 · Programar informes con fechas y formato

**Estado al corte:** Mejora a construir. **Unidad:** REA-03. **Orden:** 3.

**Evidencia de referencia:** [reporting.js:372](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/reporting.js:372), líneas 372–446. Nombre, rango temporal, fecha inicio/fin y formato de exportación en payload. Runtime no verificado.

**Comprobado en AV_design:** Los paquetes E1 son generación puntual con retención temporal; no se localizó programación persistida de informes por fechas/formato.

**Decisión y valor:** Guardar definición, calendario y ejecuciones internas con rango explícito permite preparar periódicamente informes reproducibles. Descargar en la aplicación es útil aunque no exista correo.

**AVX:** AVX-33.

**Dependencias:** REA-03 definiciones ST18; almacenamiento de ejecuciones y runner local/manual determinista antes de scheduler desplegado.

**Criterios comprobables:**

- Una programación guarda ámbito, formato admitido, período, Europe/Madrid, inicio/fin y próxima ejecución; fin anterior al inicio se rechaza.
- Dos intentos para la misma ocurrencia no duplican ejecuciones; se registran éxito/fallo y snapshot, y reintentar no pierde el último correcto.
- Ejecutar vuelve a comprobar usuario activo y permisos; retirada de permiso impide generar/descargar. Probar cambio de horario de verano y fechas vacías sin 1970.

**Evidencia local:**

- [src/lib/documentos/modelo.ts:61](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/modelo.ts:61): Manifiesto temporal, sin calendario.
- [src/lib/documentos/paquete.ts:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/paquete.ts:1): Motor de paquete puntual reutilizable.

### ST20 · Destinatarios y grupos del informe

**Estado al corte:** Mejora a construir. **Unidad:** REA-03. **Orden:** 3.

**Evidencia de referencia:** [reporting.js:389](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/reporting.js:389), líneas 389–460. Programación contempla destinatarios y grupos; no se envió ningún informe. Runtime no verificado.

**Comprobado en AV_design:** No se localizó destinatario/grupo de informes ni envío en el código; los paquetes actuales pertenecen al usuario generador.

**Decisión y valor:** Definir audiencia interna y ámbito por proyecto/sede, con comprobación de permisos por receptor. No trasladar grupos SaaS ni añadir envío automático sin destinatario y transporte configurados.

**AVX:** AVX-33.

**Dependencias:** REA-03 ST18/19; identidad/permisos; transporte sólo para entrega externa autorizada.

**Criterios comprobables:**

- Guardar audiencia sólo permite usuarios activos autorizados para el mismo ámbito y datos; revocar acceso impide la siguiente descarga.
- Vista previa muestra receptores, ámbito, período y contenido antes de una distribución; un grupo no amplía permisos de sus miembros.
- Sin transporte configurado, el informe queda disponible en aplicación con estado entrega no configurada; no declara envío. Un envío real exige instrucción explícita del usuario, destino y prevención de duplicados.

**Evidencia local:**

- [src/lib/documentos/modelo.ts:61](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/modelo.ts:61): Paquete actual, sin audiencia.
- [src/lib/usuarios.ts:181](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/usuarios.ts:181): Permisos por sección.
- [src/lib/sesion-servidor.ts:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/sesion-servidor.ts:1): Identidad y permisos vigentes en servidor.

### ST21 · Presupuesto desde BOM o diseño

**Estado al corte:** Mejora a construir. **Unidad:** REA-06. **Orden:** 6.

**Evidencia de referencia:** [xavia_new_proposal.js:230](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_new_proposal.js:230), líneas 230–236. Creación de proposal contempla id diseño/BOM y proyecto asociado. Runtime no verificado.

**Comprobado en AV_design:** E1 exporta BOM y costes de compra; no se localizó propuesta con alcance/condiciones y revisión de BOM congelada.

**Decisión y valor:** Crear propuesta interna o comercial como documento de una revisión del diseño evita rehacer material y alcance en otro editor. Empezar por borrador interno válido sin CRM obligatorio.

**AVX:** AVX-24.

**Dependencias:** E1 reconciliada; E3 revisiones; REA-06 plantillas; AVX-25 mínimo sólo para totales de venta.

**Criterios comprobables:**

- Borrador desde revisión de una o varias salas conserva IDs/hash y BOM única; no escribe equipos, stock ni precios del catálogo.
- Editar alcance/condiciones no cambia diseño; una edición posterior del diseño marca la propuesta como desactualizada hasta refresco explícito.
- Vista previa/exportación distinguen costes parciales, orientativos y sin precio; el documento no declara oferta cerrada si faltan datos.

**Evidencia local:**

- [src/lib/documentos/modelo.ts:26](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/modelo.ts:26): BOM y snapshot reutilizables.
- [src/lib/revisiones-diseno-repositorio.ts:106](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/revisiones-diseno-repositorio.ts:106): Revisión inmutable seleccionable.
- [src/lib/compras.ts:129](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/compras.ts:129): Costes de compra, no propuesta de venta.

### ST22 · Plantillas de propuesta/SOW reutilizables

**Estado al corte:** Mejora a construir. **Unidad:** REA-06. **Orden:** 6.

**Evidencia de referencia:** [xavia_new_proposal.js:336](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_new_proposal.js:336), líneas 336–403. Flags de crear, editar, copiar y SOW; servicio devuelve template y miniatura. Runtime no verificado.

**Comprobado en AV_design:** Hay plantillas de montaje y exportador técnico, pero no plantilla documental de propuesta/alcance de trabajo.

**Decisión y valor:** Añadir secciones estructuradas y variables validadas para propuesta/SOW evita copiar textos e importes heredados de otra obra.

**AVX:** AVX-24.

**Dependencias:** REA-06 ST21; E1 PDF; separación plantilla de montaje/documento.

**Criterios comprobables:**

- Copiar plantilla copia estructura/textos y crea IDs de documento nuevos; no hereda cliente, totales, impuestos, aceptación ni pagos de otra propuesta.
- Las variables muestran fuente y los valores ausentes; no ejecutan HTML/scripts ni modifican BOM.
- Previsualización y PDF conservan secciones, destinatario, versión y texto editado sin construir otro editor de plano.

**Evidencia local:**

- [src/lib/tipos.ts:139](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/tipos.ts:139): Plantilla de sala actual, dominio distinto.
- [src/lib/documentos/pdf.ts:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/documentos/pdf.ts:1): Render técnico existente como infraestructura de salida.

### ST23 · Cuenta/contacto/grupo obligatorios

**Estado al corte:** Mejora a construir. **Unidad:** REA-06. **Orden:** 6.

**Evidencia de referencia:** [xavia_new_proposal.js:244](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_new_proposal.js:244), líneas 244–262. Validación previa de cliente, contacto, grupo y nombre propuesta. Runtime no verificado.

**Comprobado en AV_design:** Obra no exige cuenta/contacto/grupo de cliente; proveedores son entidades de compra. No se localizó destinatario de propuesta.

**Decisión y valor:** Añadir destinatario/contacto opcional con procedencia para documentación interna, y exigir lo necesario sólo al preparar un envío concreto. Grupos y CRM obligatorios del SaaS no son un requisito local.

**AVX:** AVX-24, AVX-28.

**Dependencias:** REA-06 ST21; modelo mínimo de destinatario; AVX-28 sólo si existe sistema externo a conectar.

**Criterios comprobables:**

- Propuesta interna puede crearse sin CRM ni contacto inventado; si se añade destinatario se conserva quién lo introdujo y dónde se usa.
- Cambiar contacto de la obra no altera una revisión de propuesta ya emitida; se crea una nueva revisión explícita.
- No se duplica el catálogo de proveedores como clientes ni se sincroniza sistema externo sin conector configurado; exportaciones respetan permisos.

**Evidencia local:**

- [db/schema.sql:861](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:861): Proyecto actual.
- [db/schema.sql:52](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:52): Proveedor de compra, no cuenta de venta.
- [src/lib/datos-proyectos.ts:123](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-proyectos.ts:123): Portada de obra actual.

### ST24 · Contrato/acuerdo de servicio

**Estado al corte:** Mejora a construir. **Unidad:** REA-08. **Orden:** 8.

**Evidencia de referencia:** [xavia_new_proposal.js:207](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_new_proposal.js:207), líneas 207–208. Creación contempla vínculo service_contract_id, etapa y acceso. Runtime no verificado.

**Comprobado en AV_design:** Existen hitos de entrega y bajas de material, pero no contrato/acuerdo de mantenimiento ni activos individuales de servicio.

**Decisión y valor:** Registrar cobertura/acuerdo interno y condiciones de atención ligado a sala entregada permite saber qué se atiende y con qué plazo; no crea contrato vinculante ni facturación por inferencia.

**AVX:** AVX-23.

**Dependencias:** REA-08 ST26; registro mínimo AVX-05; REA-04 técnicos/tareas; condiciones aportadas explícitamente.

**Criterios comprobables:**

- Acuerdo referencia sala/activo y revisión entregada, vigencia, cobertura y fuente; fechas y datos desconocidos no se completan automáticamente.
- Incidencia muestra si cae dentro de cobertura y cómo se calcula el plazo; modificar acuerdo conserva el historial de condiciones aplicado a visitas anteriores.
- Guardar acuerdo no acepta una propuesta, registra pago, mueve stock ni cambia el hito de entrega.

**Evidencia local:**

- [src/app/acciones-ciclo.ts:49](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/acciones-ciclo.ts:49): Entrega física existente.
- [src/lib/datos-almacen.ts:227](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-almacen.ts:227): Bajas de almacén, no acuerdo de servicio.
- [db/schema.sql:949](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:949): Hitos de sala.

### ST25 · Convertir origen en proyecto X-PRO

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-04. **Orden:** 4.

**Evidencia de referencia:** [xavia_xpro_modal.js:459](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_xpro_modal.js:459), líneas 459–484. Orígenes Proposal/Project/Scratch; la respuesta del proyecto contempla prioridad y etapa. Runtime no verificado.

**Comprobado en AV_design:** La obra ya agrupa sala/diseño y hitos; no hay que crear otro proyecto X-PRO. Falta convertir un diseño seleccionado en un plan de tareas.

**Decisión y valor:** Añadir planificación al proyecto existente con un origen/revisión trazable; evitar copiar obra, prioridad derivada o estados físicos.

**AVX:** AVX-21.

**Dependencias:** REA-04 ST27; E3 revisión; jerarquía actual.

**Criterios comprobables:**

- Preparar plan desde obra/sala/revisión añade únicamente tareas borrador vinculadas a esa misma jerarquía.
- Repetir la preparación detecta el plan existente y muestra diferencias; no duplica salas ni movimientos/hitos.
- Un origen desactualizado requiere revisar el plan; activar planificación no marca obra iniciada o cerrada.

**Evidencia local:**

- [src/lib/datos-proyectos.ts:123](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-proyectos.ts:123): Obra existente.
- [src/lib/proyecto.ts:51](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/proyecto.ts:51): Estado de sala derivado.
- [src/lib/ciclo-vida.ts:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/ciclo-vida.ts:1): Hitos registrados.

### ST26 · Convertir a proyecto de servicio

**Estado al corte:** Mejora a construir. **Unidad:** REA-08. **Orden:** 8.

**Evidencia de referencia:** [xavia_xpro_modal.js:392](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_xpro_modal.js:392), líneas 392–450. Rama service project diferenciada y cuenta/contacto vinculados. Runtime no verificado.

**Comprobado en AV_design:** No se localizó proyecto/ticket de servicio. Una sala entregada permanece en la obra original y conserva sus hechos de montaje.

**Decisión y valor:** Abrir servicio/incidencia sobre instalación entregada y activo permite seguimiento de avería sin duplicar la instalación.

**AVX:** AVX-23.

**Dependencias:** AVX-05 activos; REA-04 planificación; ST24 para cobertura si existe.

**Criterios comprobables:**

- Ticket contiene sala/activo/revisión entregada, síntoma, prioridad explícita, técnico y visitas con pruebas realizadas.
- Sustitución registra vínculo activo antiguo/nuevo y propone movimientos usando las acciones de almacén existentes; nunca sobrescribe existencias.
- Cerrar ticket conserva historial y no revoca entrega, borra revisión ni cierra la obra de instalación.

**Evidencia local:**

- [src/lib/datos-almacen.ts:227](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-almacen.ts:227): Bajas existentes aprovechables.
- [src/lib/tipos.ts:619](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/tipos.ts:619): Tipos de movimiento canónicos.
- [src/app/acciones-ciclo.ts:49](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/acciones-ciclo.ts:49): Entrega de sala existente.

### ST27 · Generar tareas desde áreas y productos

**Estado al corte:** Mejora a construir. **Unidad:** REA-04. **Orden:** 4.

**Evidencia de referencia:** [xavia_xpro_modal.js:565](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_xpro_modal.js:565), líneas 565–600. Tras importación de productos, pasa area_mapping a generación de tareas. Runtime no verificado.

**Comprobado en AV_design:** No se localizaron tareas persistidas; las plantillas describen montaje y la revisión de sala deriva preparación, no trabajo asignado.

**Decisión y valor:** Generar borrador de tareas desde tipología/área/equipos confirmados reduce preparación repetida conservando la separación entre plan y hechos.

**AVX:** AVX-21.

**Dependencias:** REA-04 modelo de tarea/plan; plantillas; E3 revisión; catálogo de tareas editable.

**Criterios comprobables:**

- Plantilla de montaje propone tareas con origen equipo/sala/revisión y duración desconocida cuando no se ha definido.
- Confirmar sólo tareas elegidas y repetir no duplica tareas del mismo origen; cambios de BOM producen diff.
- Marcar una tarea lista no registra recepción, salida, instalación ni entrega.

**Evidencia local:**

- [src/lib/revision.ts:85](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/revision.ts:85): Preparación de montaje derivada, no tareas.
- [src/lib/proyecto.ts:108](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/proyecto.ts:108): Pasos de proyecto derivados.
- [src/lib/tipos.ts:139](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/tipos.ts:139): Plantilla actual de montaje.

### ST28 · Grupos y recursos asignados

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-04. **Orden:** 4.

**Evidencia de referencia:** [xavia_xpro_modal.js:467](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_xpro_modal.js:467), líneas 467–479. Payload de creación contempla grupo, recursos y fechas de inicio/fin. Runtime no verificado.

**Comprobado en AV_design:** Hay técnicos, roles y autoría de hitos; no se localizó asignación planificada por recurso/fecha ni comprobación de solapamientos.

**Decisión y valor:** Asignar técnicos existentes al plan de montaje y mostrar conflictos de agenda evita repetir la plantilla de personal en otro sistema.

**AVX:** AVX-21.

**Dependencias:** REA-04 ST25/27; tablas tecnicos/roles; fechas explícitas.

**Criterios comprobables:**

- Asignación usa tecnico_id existente y permisos actuales; técnico inactivo o fecha fin anterior a inicio se rechaza.
- Agenda muestra solapamientos para el mismo técnico y zona horaria, permitiendo corregirlos antes de confirmar.
- Un grupo operativo no amplía permisos; planificar no firma hitos por el técnico ni cambia disponibilidad de material.

**Evidencia local:**

- [db/schema.sql:920](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:920): Técnicos existentes.
- [db/schema.sql:929](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:929): Roles de técnico.
- [src/lib/ciclo-vida.ts:84](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/ciclo-vida.ts:84): Validación de técnico/rol.

### ST29 · Embudo de presupuestos por estado

**Estado al corte:** Mejora a construir. **Unidad:** REA-07. **Orden:** 7.

**Evidencia de referencia:** [dashboard-chart.js:19](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/dashboard-chart.js:19), líneas 19–159. Draft/Sent/Viewed/Accepted/Declined, valores reales en tooltip y navegación por estado. Runtime no verificado.

**Comprobado en AV_design:** No se localizó propuesta ni eventos comerciales enviados/vistos/aceptados; los estados de obra/sala derivan de hitos físicos.

**Decisión y valor:** Mostrar estado de propuestas desde eventos propios y versión concreta ayuda a seguir autorizaciones internas sin contaminar estados físicos.

**AVX:** AVX-28, AVX-33. Relación adicional razonada: AVX-24, AVX-27.

**Dependencias:** REA-06 propuestas; eventos de aceptación por revisión; AVX-27 sólo envío real si se autoriza/configura.

**Criterios comprobables:**

- Borrador, emitida, aceptada y rechazada salen de eventos con autor/fecha/revisión; visto sólo se muestra si existe evento verificable.
- Contadores enlazan a exactamente las propuestas y período que los forman; denominador cero produce sin datos.
- Aceptación de propuesta no registra instalación/entrega, pago o salida de material; una nueva revisión no hereda aceptación.

**Evidencia local:**

- [src/lib/proyecto.ts:51](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/proyecto.ts:51): Estados actuales de sala, distintos del embudo.
- [src/lib/ciclo-vida.ts:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/ciclo-vida.ts:1): Hitos físicos.
- [src/app/page.tsx:28](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/page.tsx:28): Panel actual sin propuestas.

### ST30 · Embudo monetario de proyectos/propuestas

**Estado al corte:** Mejora a construir. **Unidad:** REA-07. **Orden:** 7.

**Evidencia de referencia:** [dashboard-chart.js:401](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/dashboard-chart.js:401), líneas 401–442. Importes por etapa con símbolo de moneda y filtro de grupo. Runtime no verificado.

**Comprobado en AV_design:** Existen costes de compra estimados/ausentes/orientativos, no importes ofertados por etapa comercial ni conversión monetaria congelada por propuesta.

**Decisión y valor:** Añadir agregado monetario por etapa únicamente desde propuestas valoradas y revisión explícita; no derivar venta o ingreso de la BOM de compra.

**AVX:** AVX-28, AVX-33. Relación adicional razonada: AVX-25.

**Dependencias:** REA-06; AVX-25 valoración decimal/moneda; REA-07 eventos; permisos de costes.

**Criterios comprobables:**

- Cada etapa suma sólo propuestas de su conjunto/versión/período; varias revisiones de una propuesta no duplican importe.
- Separar monedas o convertir con tipo/fecha congelados; costes ausentes y precio orientativo quedan identificados.
- Cada importe enlaza al detalle; cobrado/ingreso sólo se muestran con hechos de pago definidos, no con aceptación.

**Evidencia local:**

- [src/lib/compras.ts:129](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/compras.ts:129): Valoración actual de compra.
- [src/lib/importacion/coste.ts:1](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion/coste.ts:1): Selección de costes, no venta.
- [src/app/page.tsx:44](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/page.tsx:44): Panel actual de contadores.

### ST31 · Dashboard configurable

**Estado al corte:** Parcial; ampliar. **Unidad:** REA-02. **Orden:** 2.

**Evidencia de referencia:** [dashboard-chart.js:476](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/dashboard-chart.js:476), líneas 476–570. Añadir y quitar widgets mediante guardado por usuario. Runtime no verificado.

**Comprobado en AV_design:** Panel muestra contadores fijos y pendientes con enlaces; no se localizó selección/orden de tarjetas persistida por usuario.

**Decisión y valor:** Permitir elegir/ordenar tarjetas operativas existentes aporta valor inmediato; añadir métricas nuevas sólo con dato fuente y detalle concordante.

**AVX:** AVX-33.

**Dependencias:** Identidad y permisos; lectores existentes; ST32 sólo para carga de trabajo futura.

**Criterios comprobables:**

- Dos usuarios guardan distinto orden/visibilidad y lo recuperan; quitar preferencia restaura el panel por defecto.
- Un usuario sin permiso de almacén/costes no recibe sus consultas/cifras aunque manipule preferencias; una tarjeta autorizada enlaza al detalle correspondiente.
- Métrica temporal indica período y fecha de corte. Una cifra sin dato disponible se muestra no disponible y no cero.

**Evidencia local:**

- [src/app/page.tsx:19](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/page.tsx:19): Lectores actuales del panel.
- [src/app/page.tsx:28](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/page.tsx:28): Tarjetas fijas.
- [src/lib/usuarios.ts:54](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/usuarios.ts:54): Permisos por sección.

### ST32 · Carga de trabajo y vencimientos

**Estado al corte:** Mejora a construir. **Unidad:** REA-04. **Orden:** 4.

**Evidencia de referencia:** [dashboard-chart.js:476](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/dashboard-chart.js:476), líneas 476–476. IDs de widget incluyen horas, eventos, tareas de hoy y de esta semana; UI completa pendiente. Runtime no verificado.

**Comprobado en AV_design:** Se cuentan cargas de material abiertas, pero eso no es carga horaria de técnicos. No se localizaron tareas con vencimiento ni agenda.

**Decisión y valor:** Añadir vistas Hoy/Semana/Vencidas y carga asignada desde tareas/fechas reales. Distinguir ocupación planificada, tiempo real y carga de furgoneta.

**AVX:** AVX-21, AVX-33.

**Dependencias:** REA-04 ST27/28; REA-02 panel; REA-05 para horas reales.

**Criterios comprobables:**

- Fixture con tareas hoy, semana, vencida y sin fecha las sitúa en grupos correctos en Europe/Madrid; sin fecha nunca es 1970.
- Carga por técnico suma intervalos definidos sin contar dos veces tareas compartidas; duración desconocida se declara.
- Cada tarjeta enlaza al mismo filtro/ámbito y la preferencia del panel sólo cambia presentación.

**Evidencia local:**

- [src/lib/datos-almacen.ts:522](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-almacen.ts:522): Cargas existentes son material.
- [src/app/page.tsx:50](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/page.tsx:50): Carga abierta de almacén.
- [db/schema.sql:920](/Users/sergio/Desktop/Aplicaciones/AV_design/db/schema.sql:920): Personas del departamento.

### ST33 · Beneficio y ratio de aceptación

**Estado al corte:** Mejora a construir. **Unidad:** REA-07. **Orden:** 7.

**Evidencia de referencia:** [dashboard-chart.js:1051](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/dashboard-chart.js:1051), líneas 1051–1099. Métricas financieras/comerciales con periodo y comparación porcentual. Runtime no verificado.

**Comprobado en AV_design:** No se localizaron horas reales por tarea ni venta aceptada. Coste de material y compras no permite calcular beneficio real o aceptación comercial.

**Decisión y valor:** Medir horas/costes y aceptación con fuentes separadas hace útil el indicador; mantener sin datos hasta disponer de costes y propuestas completos.

**AVX:** AVX-22, AVX-33. Relación adicional razonada: AVX-25, AVX-27.

**Dependencias:** REA-05 horas/costes; REA-06 propuestas y AVX-25 valoración; REA-07 eventos y REA-02 panel.

**Criterios comprobables:**

- Aceptación define numerador/denominador/fecha y cuenta propuestas únicas del mismo período; 0/0 da sin datos y no 0%.
- Beneficio distingue previsto/real y requiere importe de venta aceptado y costes completos; partidas sin precio u horas desconocidas dejan resultado parcial.
- Material, horas, tarifas y moneda remiten a registro/revisión congelada; comparar períodos no convierte ausencia en cero y respeta permisos laborales/financieros.

**Evidencia local:**

- [src/lib/compras.ts:129](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/compras.ts:129): Coste conocido/parcial actual.
- [src/lib/datos-almacen.ts:210](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/datos-almacen.ts:210): Movimientos como fuente material.
- [src/app/page.tsx:28](/Users/sergio/Desktop/Aplicaciones/AV_design/src/app/page.tsx:28): Panel actual sin ratios financieros.

### ST34 · Acceso por addon

**Estado al corte:** No mejora justificada. **Unidad:** BASE. **Orden:** 0.

**Evidencia de referencia:** [xavia_main.js:637](/Users/sergio/Desktop/Aplicaciones/Xtenav/research/clonersoft/assets/xavia_main.js:637), líneas 637–681. Control de acceso a X-PRO y flujo de upgrade anunciado; autorización backend no probada. Runtime no verificado.

**Comprobado en AV_design:** AV_design ya tiene roles, permisos por persona/sección y guardas de servidor; no existe venta de addons a usuarios internos.

**Decisión y valor:** No incorporar paywall, upgrade, planes ni dependencia de addon de XTEN-AV: no mejora diseñar salas/material/stock. Conservar la autorización local es el equivalente útil ya cubierto.

**AVX:** Sin correspondencia AVX directa en el backlog original.

**Dependencias:** Permisos existentes; barrido de guardas.

**Criterios comprobables:**

- Una sección oculta/ver/editar se aplica en servidor; manipular el botón o un supuesto addon no permite escribir.
- La disponibilidad de una función depende del permiso real y datos requeridos, no de llamadas, cuotas o endpoints de XTEN-AV.

**Evidencia local:**

- [src/lib/usuarios.ts:54](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/usuarios.ts:54): Secciones y política de acceso.
- [src/lib/usuarios.ts:181](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/usuarios.ts:181): Comprobación de permiso.
- [src/lib/importacion-http.ts:19](/Users/sergio/Desktop/Aplicaciones/AV_design/src/lib/importacion-http.ts:19): Guarda de servidor actual.

## Qué no demuestra esta matriz

No equivale a completar las 33 AVX. No tienen ST directo en el ledger: AVX-01, AVX-02, AVX-03, AVX-04, AVX-05, AVX-06, AVX-07, AVX-08, AVX-09, AVX-10, AVX-11, AVX-12, AVX-16, AVX-17, AVX-19, AVX-20, AVX-25, AVX-26, AVX-27, AVX-29, AVX-30. Algunas son bases E1/E3 que hay que conservar y otras son dependencias concretas, como activos AVX-05 para servicio. Rack, CAD, placas, multisala y acústica tienen otras fuentes del backlog; no se atribuyen a los siete JS de REA.

Una dependencia externa no permite simular un resultado: informe sin transporte queda disponible dentro de la app, consulta sin modelo usa fuentes locales, documento escaneado sin extracción queda identificado. Envío a terceros, firma y cobro requieren la configuración y la instrucción correspondiente; estos estados nunca se infieren de botones o nombres de endpoint.

## Siguiente unidad implementable

REA00–04 y06 tienen cierre local conservado. Tiempos05 operativo está aceptado;
costes05 y07A/C están en gate independiente tras su única corrección.08 termina
gates de autor.09 puede ejecutarse con contrato27 y base propia al asignar slot;
07B espera05financiero verificado y10 usa09/puentes compartidos preparados.
No relanzar unidades cerradas ni tratar DDL/parser aislados como runtime aceptado.

## Verificación de esta unidad documental

- 34 IDs únicos ST01–ST34 en orden, con candidato y evidencia original completos.
- 33 propuestas y 99 criterios de aceptación contrastados entre Markdown y JSON de origen.
- 34 filas con estado, AVX original, unidad, dependencia, criterio y evidencia local; todas las rutas locales citadas existen.
- Sólo se escribieron docs/18-rea-cobertura.md y docs/18-rea-cobertura.json. No se ejecutaron pruebas de aplicación, BD, red ni mutaciones Git.
- La comprobación de capacidades ausentes se limita al checkout inspeccionado y búsquedas en src, package.json y db/schema.sql; no es una afirmación sobre producción o todas las ramas.

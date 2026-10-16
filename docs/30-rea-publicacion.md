# Integración REA · entrega para publicación · 16-10-2026

La implementación del alcance REA está terminada y aceptada localmente. Esta entrega consolida E3 y las mejoras REA conservando E1/E2. La autorización posterior de Sergio abarca commit, push y las migraciones necesarias de BD. La rama de entrega es `codex/rea-integracion`; el SHA definitivo y su verificación remota se registran en July y en `output/rea-integracion/publicacion-20261016/raiz/` después del commit. Este documento conserva el estado del corte y no sustituye esos comprobantes.

## Mejoras incorporadas

| Grupo | Comportamiento entregado |
|---|---|
| Preparación de salas y material | Medidas con conversión visible, preview de plantilla, selección múltiple y sustituciones de referencias de la BOM con motivo y trazabilidad. |
| Preferencias y panel | Marcas/filtros personales y tarjetas configurables por usuario, respetando permisos. |
| Informes | Ámbito, período, formatos y destinatarios internos; ejecuciones descargables y definición de programaciones con runner local. |
| Planificación y agenda | Tareas manuales o propuestas desde salas/material, responsables, fechas, vencimientos y conflictos de ocupación. |
| Tiempos y costes | Partes de trabajo, correcciones auditadas, tarifas congeladas y comparación prevista/registrada con cobertura explícita. |
| Propuestas | Alcance reutilizable, revisiones inmutables, valoración opcional y PDF durable, con actualización explícita de la fuente. |
| Seguimiento y resultados | Emisión, aceptación/rechazo por revisión, embudo y comparación de importes/costes con moneda, período y denominador declarados. |
| Activos y servicio | Unidades previstas/instaladas, traslados y sustituciones con historia, incidencias, visitas y acuerdos internos. |
| Consulta local | Preguntas por teclado sobre fuentes autorizadas, respuestas deterministas con citas e historial; enlace a informes y fragmentos revisados. |
| Documentación y requisitos | Documento fuente, extracción local de texto o transcripción declarada, revisión de áreas/candidatos, preview y confirmación de salas/material/catálogo/ofertas/técnico/puertos sin duplicados. |

El paquete conserva también E3: historial de diseño, diff/restauración, organización del esquema, anotaciones/leyenda y duplicación/comparación de alternativas. No se inventan stock, mediciones ni hechos operativos al copiar o restaurar un diseño.

## Validación del paquete publicable

- Suite completa en copia limpia: **1112/1112**, 186 suites, sin fallos, omisiones ni conexión a BD.
- Build Webpack sin BD y tipos explícitos: exit0 en copia sin `.env*` ni `output/`.
- Se corrigió la única dependencia de un import ignorado: la fixture sintética del puente REA10→E2 pasa a `scripts/rea10-puente-e2-fixture.mts`; sólo cambian tres rutas y el import consumidor. Contrato de la fixture y revisión independiente de 560 archivos TS/JS: cero módulos ausentes.
- `.next-rea-global-types/`, secretos, inventarios, dumps, capturas y evidencia local quedan fuera del commit. Los manifiestos y dictámenes se conservan en las rutas locales indicadas.
- El ciclo funcional REA10 aceptado y sus pruebas HTTP/Chrome, escritorio antes de móvil390, están en [29-rea-entrega-local.md](29-rea-entrega-local.md).

## Neon migrada

Destino comprobado: proyecto `divine-fog-47634199` (AV Design Frankfurt), endpoint `ep-aged-dust-as1vzpsx.c-4.eu-central-1.aws.neon.tech`, base `neondb`, rol `neondb_owner`, Postgres18.6. Se aplicaron **14 migraciones E2/E3/REA**, desde 38 hasta 104 tablas, en una única transacción con locks y timeouts.

La comparación dentro de esa transacción confirma **1357 filas previas con todos sus campos anteriores idénticos**, 24 identificadores de cable conservados y ninguna definición previa de función, restricción, índice, trigger, enum o vista perdida. Se verificaron las columnas nuevas, 40 índices explícitos, constraints validadas, triggers habilitados en sesiones normales y secuencias/correlativos.

Los 870 artículos previos reciben `fuente='app'` como protección conservadora del legado cuyo origen CSV no está demostrado. La migración no afirma quién los creó ni los reclasifica a CSV. No se ejecutaron seed, CSV, reseteos, normalización de catálogo, materialización de sillas, altas de administrador ni fixtures en producción.

Ensayo previo: sólo DDL de Neon y nueve filas sintéticas en nueva BD loopback5570. Aplicación, repetición y SQL legado compatibles; fallo antes de COMMIT revierte la transacción completa. Una revisión independiente cerró la guarda de drift de metadatos y estados de triggers antes de ejecutar en Neon. Evidencia real: `output/rea-integracion/publicacion-20261016/raiz/neon-migracion-aplicada.json`.

La revisión automática rechazó un dump completo de datos al Mac por no estar autorizada expresamente esa copia. No se intentó eludir la restricción: se guardaron únicamente DDL/metadatos y huellas, sin filas de negocio. Se acreditó la retención de historial de Neon de21600segundos y el instante/LSN anterior a la migración. No hay copia completa local de los datos.

## Qué queda para que los usuarios utilicen la integración

1. Integrar la rama en `main` y realizar el despliegue cuando se autorice. Render sirve todavía `adacf0e`, del12-10-2026. El servicio real es `av-design-audiovisuales.onrender.com`, rama `main`; **autoDeploy=yes**, comprobado por API el16-10. La ficha July anterior que decía autoDeploy=no estaba desactualizada. Un push a esta rama de entrega no cambia el commit servido.
2. Verificar el arranque y el flujo completo en Render tras ese despliegue: sesión/permisos, datos existentes, documentos/PDF y extracción aislada con dependencias Linux. Node24 y la configuración de sesión ya están presentes; el build limpio local no equivale a esta aceptación del destino.
3. Activar sólo si se desean las capacidades externas: proveedor OCR/generativo, scheduler y transporte de informes. Están sin configurar/desplegar; la extracción local, revisión manual, consulta determinista y runner local sí están entregados.

El dictado español real no está disponible en Chrome155; teclado sí verificado. Las métricas financieras mantienen cobertura y ausencias explícitas: no certifican ST33general/beneficio total real, cobros ni firma contractual fuera de sus contratos. Precios Cisco y la decisión sobre la fórmula de cable son pendientes anteriores separados de REA, no se modifican en esta entrega.

Se conservan los demás límites de29: reversión de sala+BOM con referencias de auditoría, ocho raws y un puntero antiguos de09 sin recuperación, y aceptación funcional sobre fixtures sintéticas. Ninguna de estas notas reabre unidades REA cerradas.

# Auditoría integral de diseño, compras e instalación

Fecha: 8 de septiembre de 2026. Resultado implementado y comprobado en local.

## Contrato

Crear un proyecto, diseñar salas desde cero y desde plantilla, elegir equipos con
avisos útiles, registrar compra y recepción, entregar documentación al instalador
y continuar hasta la aceptación. Check-in significa **prueba técnica final**;
check-out significa **entrega y aceptación**. Las antiguas revisiones antes del
montaje conservan sus datos y se llaman **Visitas previas**.

Se conserva el sistema visual existente. Producción, cuentas reales y compras
reales no se han modificado. Los registros QA son simulaciones locales, no una
certificación de instalación física ni un presupuesto utilizable.

## Ahora: implementado

| Parte | Resultado |
|---|---|
| Diseño | Se conserva creación desde cero, plantilla con medidas, muebles, giros y conexiones. Una sala creada con plantilla entra directamente al editor. |
| Edición | Se corrigió la conservación de extremo y roseta en equipos existentes. El inspector cambia de objeto sin arrastrar el texto de la selección anterior. Añadir y editar es visible en el panel móvil. |
| Equipamiento | Búsqueda remota, selección acumulada en sala, cantidades y avisos de videoconferencia repetida, micrófono ausente o información desconocida. Los avisos no acreditan compatibilidad completa. |
| Cisco EQ | Codec EQ y el codec incluido en Room Kit EQ tienen 21 bocas documentadas: 3 HDMI IN, 3 HDMI OUT, 5 RJ45, 6 USB, 3 entradas de micrófono y 1 salida de línea. Cámara/control del kit se distinguen en las notas. Fuentes en el documento 38. |
| Compra | Checklist por línea, fecha y usuario autenticado; empresa opcional; fecha estimada y almacén de entrega. Ofertas orientativas requieren conversión a oferta final. |
| Recepción | Cantidades parciales o completas, almacén, fecha y receptor. Repetir el mismo envío no duplica entradas. No se reciben líneas sin comprar. |
| Material servido | El material que salió hacia la sala cuenta como disponible para esa obra; no vuelve a aparecer automáticamente como compra pendiente. Se conservan existencias, reservas y devoluciones. |
| Instalación | Fecha prevista, técnico y situación del material; instalación terminada; checklist técnico; entrega con persona que acepta. Historial con autor y cambios registrados. |
| Validación | Incidencias y puntos que no aplican exigen justificación. La prueba final exige completar los puntos y resolver incidencias. Un rechazo conserva las notas escritas. |
| Permisos | El técnico accede a las tareas de instalación; proyectos y compras respetan su permiso de lectura también en controles visibles. El servidor conserva las guardas. |
| Documentación | Paquete imprimible con planta, acotaciones, tabla de cables, instrucciones de conexión y materiales. Se corrigió el corte de cotas y la distribución impresa. |

## Recorrido real ejecutado

Navegador de escritorio primero; móvil al final, a 390 y 320 píxeles.

1. Inicio de sesión con administrador sintético `qa_arquitecto_0809`.
2. Creación de `QA integral · Sala de reuniones`, localización y sala de 6 × 4 × 3 m.
3. Añadir mobiliario, girar, quitar, deshacer y guardar. Añadir tres equipos,
   situarlos y conectar puertos concretos en el diagrama.
4. Conexiones de ensayo HD-1000 y MIC-1000; selección comercial HDMI de 5 m.
5. Pedido de cinco líneas identificado como compra simulada. Compra completa,
   recepción parcial inicial y recepción del resto en Almacén general.
6. Creación del usuario `qa_instalador_0809` desde Usuarios, con rol técnico.
   Acceso con contraseña provisional y cambio obligatorio de contraseña.
7. Con ese técnico: reservas, lista de carga, salida del almacén, planificación,
   instalación y prueba final. Se ensayó una incidencia antes de resolverla.
8. Check-out de QA Reuniones 01, con aceptación de
   `Responsable QA de sala (simulación)` y rastro de QA Instalador.
9. Creación de una plantilla desde esa sala y de QA Reuniones 02 desde la plantilla.
   Verificación de muebles, medidas y conexiones heredados. Roseta QA-RJ-01 y
   cambios aislados de extremo y toma guardados correctamente.
10. En QA02, rechazo de checklist sin justificación: conserva el texto, permite
    corregirlo y persiste tras navegar. Queda como ensayo auxiliar con incidencia
    pendiente. El proyecto permanece en curso; QA01 figura entregada.
11. Inspección de catálogo/ficha EQ, almacén, movimientos, visitas previas,
    parámetros, compras, documentación y navegación del proyecto. No se pulsaron
    acciones destructivas sobre datos preexistentes.

El fallo aparente final de extremo se reprodujo en una pestaña que mantenía un
bundle anterior del servidor de desarrollo. En una página recién cargada se
verificaron detección, envío y persistencia del arreglo.

## Evidencia ejecutada

| Comprobación | Resultado |
|---|---|
| `npm test` | 696/696, sin omitidas ni fallos |
| `npm run build` | Correcto |
| `npx tsc --noEmit --incremental false` | Correcto |
| `npx eslint src scripts` | Sin errores ni advertencias |
| Compras contra Postgres, `scripts/verificar-compras-integrales.mts` | 20/20 |
| Seguimiento contra Postgres | 13/13; cinco mutaciones detectadas |
| Sala/plantilla contra Postgres | 39/39 |
| Guardas de sala contra Postgres | 38/38 |
| Extremo y roseta contra Postgres | 11/11; incluye toma ajena, versión antigua y rollback |
| Editor DOM | Cambios aislados activan Guardar y llegan al patch; las dos pruebas nuevas fallan con el código anterior |
| Impresión | PDF A4 horizontal de ocho páginas, todas renderizadas e inspeccionadas |
| Móvil | Resumen, documentos y panel del plano sin desbordamiento de página en 390/320 px |

Logs finales en `output/playwright/final-*.log`. Evidencia visual, PDF y logs de
integración en `output/playwright/auditoria-integral-2026-09-08/`.
El PDF es `paquete-tecnico-qa.pdf`. Las capturas `paquete-final-1.png` a
`paquete-final-8.png` corresponden a sus ocho páginas finales.

## Después: límites que siguen abiertos

- La cobertura de puertos CSV es 24 de 871 referencias normalizadas (2,8 %).
  Ampliar las 847 restantes exige documentación por modelo. La app distingue
  ausencia de información; no inventa conectores ni equivalencias entre variantes.
- La roseta identifica dónde se enchufa el equipo y aparece en las instrucciones;
  todavía no es un extremo de tirada con cálculo de metros propio.
- Completar los componentes internos de los kits, alimentación, latiguillos
  suministrados, adaptadores y compatibilidad eléctrica/acústica. El ensayo de
  micrófono no demuestra que un cable genérico sustituya al latiguillo Cisco.
- La revisión de compatibilidad actual comprueba señal y sentido; no certifica
  que el montaje físico sea viable. El paquete QA01 conserva esas advertencias.
- Preparar publicación y aplicar las migraciones en producción con verificación
  específica. Esta entrega no incluye commit, push ni despliegue.

No se han añadido servicios de pago ni dependencias de producción. El coste de
mantenimiento principal será mantener las fichas técnicas y validar los cambios
del catálogo. Los importes simbólicos del pedido QA no representan costes reales.

## Operación local y publicación pendiente

Servidor QA: `http://localhost:3112`. Proyecto de ensayo:
`/proyectos/77e91827-2502-4c18-be49-06a727aaa690`.
La cuenta proporcionada por Sergio no se ha restablecido ni modificado.

Migraciones añadidas y aplicadas únicamente a Postgres local:

- `db/migraciones/2026-09-trazabilidad-compras.sql`.
- `db/migraciones/2026-09-seguimiento-instalacion.sql`.

Se regeneró el seed; la sincronización QA se limitó a los modelos EQ para no
reescribir puertos relacionados con conexiones existentes. Los cambios que ya
estaban en el árbol de trabajo se conservaron.

La revisión automática de aprobación rechazó una limpieza de temporales durante
las pruebas. Esos restos no se han eliminado por otra vía: permanecen dos bases
temporales `av_seguimiento_test_9eb6933b9f2a46769e2efabf1d64fac1` y
`av_seguimiento_test_f8bfdb4806b0490a98f162a4a2c1fc1c`, además de temporales locales
de esa ejecución. No afectan a los registros del proyecto QA.

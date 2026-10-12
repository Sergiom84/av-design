# L2A · Etiquetas persistentes, integración

08/09/2026. En validación; no acredita cierre ni publicación.

Contrato: `l2a-contrato.md`. Persistencia y fuente única de prefijos:
`l2a-persistencia.md`; lectores, borradores y pruebas históricas:
`l2a-lectura.md`. No incorpora todavía rosetas ni cambia el cálculo físico.

El guardado devuelve `etiquetas` por UUID confirmado dentro de su transacción.
El editor sustituye el provisional sin esperar una recarga; una respuesta
incompleta conserva el borrador y exige comprobar el estado antes de repetir.

Integración adicional del director:

- El verificador de puertos exige una etiqueta definitiva persistida y compara
  la lectura con ella. Dos estados provisionales iguales no pueden pasar el test.
- La prueba de bocas exige rechazo del cambio de sala y conservación de sala,
  etiqueta y pareja completa. Sustituye deliberadamente el contrato anterior,
  que permitía mover el padre y descartar sus bocas.
- La ida y vuelta real por acciones de plantillas consume antes una etiqueta en
  origen: la conexión original es HD-1001 y la recreada debe tener UUID nuevo y
  HD-1000. Así no se confunde copiar una brida con asignarla en otra sala.
- La variante causal de lectura vive en scripts, sin depender de output:
  `node scripts/verificar-mutaciones-etiquetas-lectura.mjs --sin-arreglo`.

Evidencia ejecutada bajo `output/plan40-20260908-083450/`:

| Archivo | Resultado |
|---|---|
| l2a-generales.log | 715/715, sin omisiones |
| l2a-build.log, l2a-tipos.log, l2a-lint.log | Salida 0 |
| root-l2a-postgres.log | 11/11, reproducción del director |
| root-l2a-lectura-base.log | Base en copia propia, salida 0 |
| root-l2a-lectura-causal.log | Cinco fallos de aceptación al reintroducir numeración dinámica, salida 1 |
| l2a-regresion-base.log | Siete verificadores terminan con salida 0; base propia eliminada |

Crudos de regresión conjunta en
`output/qa_plan40_base_e64e77896648431daf30ce04a36a47b8/`: plano 157,
plantillas 40, guardas de sala 38, bocas 20, rutas 12, editor 25 y concurrencia 55.
Todas las comprobaciones pasan. No se usó la base compartida.

Las migraciones se prueban solamente en bases desechables. Las etiquetas
anteriores a borrados ya ocurridos no se pueden reconstruir: la migración
preserva el mapa visible actual. La aplicación actual requiere aplicar esta
migración antes de leer conexiones; L8 debe coordinar ese orden en el destino.

## Recorrido funcional y corrección de integración

Base exclusiva `qa_plan40_ui_70c72d4672614eeca9fe1ffea68d0ecb`, ya eliminada al
cerrar su servidor. Login sintético → Salas → Nueva sala en blanco, medidas 6 × 4
× 3 → Diagrama → buscador Codec EQ y Samsung QB65R → conexiones HDMI físicas
outputs 1/2 a HDMI IN 1/2. Las dos altas mostraron provisional antes de guardar.

Se asignaron HD-1000 y HD-1001. Al borrar la primera y recargar, la restante
conservó UUID `2b5f2f1a-fa8b-4460-81a2-8d2fb87c3cbe`, HD-1001 y boca de origen
ordinal 2 / destino HDMI IN 2. La tabla de Cableado y el CSV descargado desde
su botón conservan ese mismo dato (`output/playwright/l2a-cables.csv`).

La primera pasada detectó error real de serialización de Next: no admite mapas
con prototipo nulo en la respuesta de una acción. El commit de datos ya había
ocurrido, pero la respuesta podía fallar. Se mantienen los diccionarios internos
protegidos y se devuelven objetos planos por copia. La prueba del editor exige
el prototipo plano de todos los mapas, además de la etiqueta confirmada.

Con código corregido y página recargada, otra alta recibió HD-1002 sin reciclar
HD-1000. Guardar quedó deshabilitado y no hubo error de confirmación. Se borró
HD-1002 y se recargó nuevamente: HD-1001 siguió intacto. Los registros anteriores
conservan el fallo inicial; no se usan como aprobación del guardado final.

Evidencia final de navegador en `output/playwright/`:
`l2a-confirmacion-corregida.txt`, `l2a-final-desktop.txt`,
`l2a-etiqueta-desktop-final.png`, `l2a-etiqueta-390.png`, `l2a-etiqueta-320.png`.
Anchos del documento 1280, 390 y 320, iguales al viewport; foco de 2 px al tabular
a Origen y boca. Los selectores mantienen su ancho y recortan texto largo de forma
nativa; el lienzo tiene desplazamiento propio. No se introdujo movimiento nuevo.

Build final: `l2a-build-final.log`, salida 0. Lint final y del nuevo verificador,
salida 0. Regresión del editor tras corrección: 26/26 en
`output/qa_plan40_base_25de2fdb24354223a6933906705b6531/editor-conexiones.log`;
su wrapper confirma eliminación de la base en `l2a-editor-confirmacion.log`.
Se añadió `--solo=<verificador>` validado al wrapper para repetir únicamente
el radio afectado; sin opciones sigue ejecutando los siete verificadores.

La reproducción del fallo de respuesta está en
`scripts/verificar-mutaciones-respuesta-editor.mjs`: copia propia, guardas y
aceptación completas, base UUID y limpieza propia; no modifica el árbol compartido.
Resultado medido: 25/26 correctas, único fallo en mapas de respuesta planos;
`l2a-causal-respuesta.log`, salida 1 esperada, base propia eliminada.

Pendiente: dictamen independiente de L2A. Rosetas y L2 completo siguen abiertos.

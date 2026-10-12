# L2B: recorrido real del director

08/09/2026. Playwright CLI, navegador de escritorio 1280×900 antes de móvil.
Base propia `qa_plan40_ui_0fd7dd9bac2b4d4da2bc7d58ba1c8f69`, creada por
`scripts/iniciar-qa-plan40.mjs`. Usuario sintético `qa.proyectista`.
Servidor local 3128; cerrado y base eliminada al acabar. Producción y base
compartida no intervenidas. Configuración temporal de Next restaurada desde
copias previas verificando que las únicas diferencias eran las del servidor QA.

## Comprobaciones ejecutadas

1. Alta real de sala `QA L2B rosetas`, 6×4×3, sin plantilla. Alta de roseta
   `QA-R1` con XYZ 0/0/0 y capacidad desconocida. Alta de Codec EQ mediante
   búsqueda de catálogo y asignación documental a QA-R1.
2. En Plano, documentación explícita de dos bocas DATA-1/2, señal Red,
   conector RJ45. Vaciar temporalmente capacidad y volver a 2 conserva los
   campos. Guardar y navegar a otra pestaña conserva ambas bocas.
3. Conversión desde Equipamiento: selección explícita de Network (Ethernet),
   DATA-1 y CAT6 U/UTP. El formulario pasa a enlace «conexión registrada».
   Cableado muestra una fila RED-1000. Sin holgura configurada no inventa metros.
4. Configurar holgura 0,40 m desde Parámetros. RED-1000 pasa a 6,75 m:
   recorrido 6,00 + holguras 0,35 y 0,40. CSV descargado contiene exactamente
   una fila con esos valores y los extremos físicos.
5. Mover QA-R1 con flechas en Diagrama, guardar y recargar: conserva RED-1000
   y 6,75 m. Consulta independiente confirma XYZ original 0/0/0 y coordenadas
   de esquema persistidas por separado.
6. Unir en lienzo Network (Ethernet PoE) **2** a DATA-2, elegir cable y guardar.
   Crear plantilla desde la sala y nueva sala desde esa plantilla mediante UI.
   La nueva sala muestra RED-1000/1001 con los puertos y ordinales exactos.
7. La roseta copiada conserva «Referencia de origen: QA-R1», dos bocas,
   y casilla de código comprobado **sin marcar**. Consulta de persistencia
   confirma cuatro UUID distintos de bocas entre las dos salas.
8. Reducir capacidad de la copia a 1 se rechaza con «No se puede retirar o
   cambiar una boca ocupada». Recargar confirma capacidad 2 y ambas conexiones.
9. Vaciar explícitamente Z en Plano retira la posición completa; guardar.
   Cableado conserva las dos filas y muestra la causa «Falta la posición completa
   de QA-R1 (destino)». La consulta confirma XYZ todos nulos, sin convertirlos a 0.
10. Cierre móvil: 390 px y 320 px, reduced motion. Anchura de documento igual
    a viewport. Inspector de bocas accesible desde el panel plegable. Tabla con
    scroll local y foco visible; flechas desplazan el contenedor (scrollLeft 80).

## Defectos encontrados y corregidos durante el recorrido

- Los consumidores confundían cálculo pendiente por holgura con falta de medidas
  o de conexiones. Ahora muestran el diagnóstico concreto y conservan las filas.
- El tipo de cambio sembrado 0,867 era inválido para el step 0,01 del formulario
  de parámetros, impidiendo guardar cualquier campo. Solo ese parámetro admite
  precisión libre; tras corregir, cero campos inválidos y holgura guardada en UI.
- Puertos y rosetas de la tabla se fragmentaban en móvil. Se conserva su ancho
  de lectura dentro del scroll existente. El contenedor compartido admite foco.

## Evidencia

Directorio `output/plan40-20260908-083450/`:

- `l2b-ui-cables.csv`: descarga real RED-1000, 6,75 m.
- `l2b-ui-persistencia.log` y `comprobar-fixture-l2b.mjs`: aserciones independientes
  sobre identidades, capacidad, bridas, referencia y coordenadas. Ejecución correcta.
- Capturas examinadas: `l2b-diagrama-desktop.png`, `l2b-roseta-desktop.png`,
  `l2b-pendiente-390.png`, `l2b-bocas-320.png`, `l2b-cables-foco-320.png`.
- Snapshots y consola en `.playwright-cli/`, recorrido 10:17–10:40 UTC.

No sustituye L7 ni el examen de todas las páginas PDF de L6. Las tres rutas de
copia, concurrencia y longitudes manuales sin medidas se validan además en los
verificadores de servidor; el gate integral y la revisión L2B siguen pendientes.

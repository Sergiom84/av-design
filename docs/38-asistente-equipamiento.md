# Asistente de selección de equipamiento

Fecha: 8 de septiembre de 2026.

## Contrato y uso

La selección es el equipamiento guardado de la sala. El usuario busca una referencia,
pulsa **Añadir equipo**, ajusta unidades o quita una fila. No hay un segundo carrito
persistido ni un guardado en lote. Se conservan las acciones existentes, el alta sin
referencia, el cambio de nombre, extremo, posición y toma y la lectura de obra cerrada.
Las coordenadas de alta permanecen vacías y dentro de un apartado opcional. Editar
las coordenadas existentes conserva su semántica de posición confirmada, incluido cero.

El buscador sigue consultando `/api/catalogo?tipo=equipo`; no se descarga el catálogo
completo. El candidato muestra avisos antes del envío. Tras añadir, se limpia la
referencia seleccionada. Los avisos no deshabilitan el envío.

## Criterio de los avisos

- Un solo aviso de videoconferencia existente o varias unidades. Las referencias
  repetidas por identificador se avisan únicamente para equipos que no sean videoconferencia.
- Categorías explícitas, normalizadas solo en mayúsculas, acentos y espacios.
  Un receptor o controlador de microfonía no se considera un micrófono.
- Captación integrada, externa o desconocida por perfiles documentados y modelo exacto.
  Una barra integrada no cubre automáticamente otro codec de la sala.
- Un micrófono seleccionado evita el aviso de ausencia, pero no acredita conexión,
  compatibilidad, licencia, cobertura acústica ni que todas las unidades estén cubiertas.
- Sin categoría no se adivina por el nombre libre del equipo. Sin perfil de microfonía,
  el resultado es desconocido, incluso si la categoría dice videoconferencia.

## Puertos y Cisco EQ

Los conteos proceden de `obtenerSala().puertos`, ya disponible. Se filtra por artículo
y se suma `Puerto.total` por sentido y señal, por unidad de equipo. No es un recuento
de filas, unidades instaladas ni bocas libres. La dirección bidireccional se conserva
sin duplicarla como entrada y salida. La ausencia de datos se muestra como tal y se
ofrece `/articulo/[id]` para consultar la ficha.

Al seleccionar se consulta la API existente `/api/catalogo/[id]/puertos`, con
AbortController, estado de carga, error diferenciado y reintento sin enviar el alta.
No hace falta añadir primero el equipo ni ampliar el contrato remoto.

Fuente primaria: [Cisco Room Kit EQ Data Sheet](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/spark-room-kit-series/room-kit-eq-ds.html),
actualizada el 30-04-2026, apartados componentes, entradas/salidas, interfaces y seguimiento.
El kit incluye Codec EQ, cámara y control; el array de Quad Camera se documenta para
seguimiento del hablante. No equivale a captación de voz de la reunión.

La interfaz ofrece una referencia técnica del **Codec EQ** separada del recuento real
del artículo. No asigna conectores ni serigrafías por inferencia.

| Nombre del inventario | Tratamiento |
|---|---|
| ROOM KIT EQ / CISCO ROOM KIT EQ | El bloque representa los puertos del Codec EQ incluido; cámara/control aparte |
| EQ / WEBEX ROOM EQ / WEBEX ROOM EQ QUADCAM | Identidad ambigua; microfonía desconocida |
| CODEC EQ / CS-CODEC-EQ-K9 | Perfil específico de codec, si existe en el catálogo editable |
| Otras variantes, incluido EQX | Sin equivalencia automática |

Para cubrir el modelo solicitado se añade `VIDEOCONFERENCIA;CISCO;CODEC EQ;;`
a `data/catalogo-equipos.csv`, fuente que ya lee `scripts/generar-seed.mjs`.
No se inventa un CSV extra ni se atribuyen unidades instaladas o sedes al nuevo
artículo. Los campos vacíos producen `unidades_instaladas = null` en la generación.

`data/puertos.csv` declara diez grupos con 21 bocas para CODEC EQ y los mismos
diez grupos para ROOM KIT EQ, representando únicamente su codec incluido:
6 HDMI (3 entradas y 3 salidas), 5 red, 6 USB (incluido servicio), 3 entradas de
micrófono y 1 salida de línea. No se incluyen alimentación ni antenas en esta
primera cobertura. Fuente: [Cisco Codec EQ Installation Guide, página 5](https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/room-kit/installation-guide/codec-eq-installation-guide-en-fr-es-pt-it-de.pdf),
D15548.01, 2025. La nomenclatura es la leyenda inglesa de los grupos del dibujo
oficial: el panel usa iconos y numeración. `total` mantiene los ordinales de cada
grupo. La salida de línea deja conector vacío y las entradas analógicas usan
solo la familia mini jack confirmada por la ficha técnica. RJ45 se confirma en
el apartado Network interfaces de la ficha EQ. Los cuatro puertos PoE se separan
en tres de periféricos y uno de panel, sin duplicar bocas.

La tabla de composición de la ficha oficial (CS-KIT-EQ-K9) confirma el Codec EQ
incluido. Como decisión de implementación, el bloque del kit expone las bocas de
ese componente sin crear un segundo equipo ni una segunda línea de material.
Nota visible: «Puertos del Codec EQ incluido; cámara/control se documentan aparte».
En el CSV se separan las frases con punto, porque su lector usa el punto y coma
como separador de columnas. No se inventa serigrafía: se conservan las leyendas
oficiales de los grupos y sus ordinales, idénticos a los del codec independiente.
No se extiende esta asignación a EQ, WEBEX ROOM EQ, WEBEX ROOM EQ QUADCAM ni EQX.

El generador produce diez inserciones para ROOM KIT EQ y diez para CODEC EQ.
Se ha regenerado `db/seed.sql`. En la base local de QA se sincronizaron únicamente
estas referencias y puertos, conservando el resto del catálogo y las conexiones.
CODEC EQ permanece disponible para un codec adquirido por separado.

Para el caso integrado se consulta [Cisco Room Bar Pro Data Sheet](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/webex-room-series/room-bar-pro-ds.html):
Room Bar Pro incorpora micrófonos de voz. Los nombres exactos `ROOM BAR PRO` y
`WEBEX ROOM BAR PRO` usan ese perfil y conservan el aviso de revisar cobertura.

## Verificación y límites

La validación integrada, el recorrido real con arquitecto e instalador y los
resultados finales están en `docs/39-auditoria-integral.md`.

Se reutilizan los tokens visuales existentes y apartados `details` nativos.
No se añaden animaciones. El buscador distingue carga, error y ausencia de datos.

La cobertura de puertos sigue siendo parcial: 24 de las 871 referencias
normalizadas tienen puertos CSV (2,8 %). Las 847 restantes requieren documentación;
no se presentan como compatibles por carecer de datos.

**Después:** ampliar perfiles y puertos con fuentes oficiales, empezando por los
equipos de uso frecuente. El asistente no acredita compatibilidad eléctrica,
licencias, adaptadores, acústica ni un montaje físico completo.

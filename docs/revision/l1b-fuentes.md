# L1B · fuente editable de hechos técnicos

08/09/2026. Estado: entregado para revisión; sin siembra ni escritura de BD.

## Artefacto y contrato

Nuevo `data/fichas-tecnicas.csv`: 38 hechos para CODEC EQ, ROOM KIT EQ,
QUAD CAMERA, ROOM NAVIGATOR, TABLE MICROPHONE PRO y SAMSUNG QB65R. Conserva una
fuente oficial junto a cada valor conocido y una clave estable por artículo.
No se han cambiado otros CSV, generador, modelo ni componentes.

Columnas: `marca;modelo;clave;tipo;estado;valor_json;fuente_url;documento;apartado;consultado_en;puerto_nombre`.
JSON sin punto y coma ni saltos internos, compatible con el lector delimitado
del proyecto. Consulta fechada 2026-09-08. `fuente = csv` la aporta la integración.

Resultados de validación local con `esquemaDatoTecnico`: **38/38 hechos válidos**,
38 claves únicas, 19 verificados, 18 parciales y 1 sin documentar. Siete nombres
de puerto coinciden exactamente con puerto existente del mismo modelo y marca.
No se ha resuelto ni escrito ningún UUID de puerto.

## Alcance de los hechos

- CODEC EQ: captación externa, alimentación, presupuesto PoE compartido,
  grupos HDMI/USB/analógicos y conexión de la cámara.
- ROOM KIT EQ: composición de CS-KIT-EQ-K9, parcial hasta confirmar SKU físico;
  adaptador de cámara y cable de panel opcional. HDMI suministrado desconocido.
- QUAD CAMERA: cambio comercial documentado a QUADCAM2, captación para
  seguimiento, alimentación dedicada, HDMI y control RJ45, retorno ARC.
- ROOM NAVIGATOR: variante de mesa, PoE con potencia desconocida, NETWORK
  parcial y puerto de servicio. No se atribuye instalación de pared.
- TABLE MICROPHONE PRO: cable unido de 11 m, montaje, PoE 5 W, conector digital
  y compatibilidad EQ. No se etiqueta como captación integrada de un codec.
- QB65R: alimentación y dos HDMI documentados. Los nombres individuales de
  entrada se dejan sin atribución; no se extiende la ficha a QB65R-B.

La presencia de hechos verificados **no significa ficha completa**. Los puertos
USB quedan parciales porque el texto de la guía no expresa todas las propiedades
de dirección. NETWORK del Navigator y el grupo HDMI de Samsung son parciales
por correspondencia de rótulo/serigrafía. Los conectores analógicos desconocidos
permanecen nulos. No se validan automáticamente los demás puertos del CSV existente.

## Fuentes y límites

URLs, documento y apartado están en cada fila del CSV; las evidencias consultadas
son las enumeradas en `docs/revision/l1-investigacion.md`. La guía de cámaras
D15296.23 p.16 fundamenta OUT1→IN1 y ARC. La equivalencia comercial de QUADCAM2
se apoya en EOL15049, no en semejanza del nombre. Se conserva como parcial el
ordinal Ethernet dentro del grupo del catálogo, cuya imagen no se pudo revisar.

El hecho `longitud-utilizable` del micrófono es criterio práctico explícito,
marcado parcial: la fuente acredita 11 m y el criterio exige contrastarlos con
geometría/holguras, no declara una longitud de sala inexistente.

TABLE MICROPHONE PRO aún no figura en catálogo de equipos. Su fuente se entrega
para el alta coordinada posterior; no se elimina ni se enlaza a mini-jack V1/V2.
Los hechos de tipo puerto sin `puerto_nombre` son descriptivos hasta integración.
Que exista una fuente no autoriza a crear/renumerar bocas ni conexiones existentes.

## Comprobación ejecutada y reproducción

Se leyó el CSV con Node y `--import tsx`, se convirtió `valor_json` mediante
`JSON.parse`, se añadieron `fuente: csv` y nulos para procedencia vacía, y se pasó
cada fila por `esquemaDatoTecnico.parse`. Además se comprobó número de columnas,
clave única y correspondencia exacta de cada `puerto_nombre` con `data/puertos.csv`.
Salida 0:

```json
{"hechos":38,"clavesUnicas":38,"estados":{"verificado":19,"parcial":18,"sin_documentar":1},"enlacesPuertosExistentes":7}
```

No hubo pruebas BD, integración UI ni seed. Reversión: retirar únicamente este
nuevo CSV antes de integrarlo; no revertir otros datos ni archivos compartidos.
Decisión solicitada: revisar hechos/fuentes y aprobar o indicar correcciones
antes de habilitar la carga del CSV.

## Propuesta coordinada posterior: entrada física Samsung

No incorporada al CSV mientras otro agente verifica seed/integración.
El manual oficial descargado desde la página Samsung de QB65R muestra en su
página 7, columna explícita que contiene QB65R, **HDMI IN 1 (ARC)** y
**HDMI IN 2**. Se extrajo y renderizó el PDF inglés y se inspeccionó la página,
no solo la tabla de texto. Evidencia y URL de procedencia en la ampliación de
`l1-investigacion.md`.

Propuesta de fila, a integrar después con el responsable de los datos:

```text
marca: SAMSUNG
modelo: QB65R
clave: entrada-hdmi-1-serigrafia
tipo: restriccion
estado: verificado
valor_json: {"texto":"La entrada física está rotulada HDMI IN 1 (ARC)."}
fuente_url: https://downloadcenter.samsung.com/content/UM/202209/20220906131556618/LFDQMREN-11_BY-MODEL_QBR_QBR-B_QBR-N_QMR_QMR-A_QMR-B_QER_QMR-T_WW_L42_220617.0.zip
documento: Samsung Smart Signage User Manual By Model, revisión 11, inglés 220705.0
apartado: Página 7 - Ports, columna QB43R a QB85R-B que incluye QB65R
consultado_en: 2026-09-08
puerto_nombre: HDMI IN 1
```

La fuente acredita el rótulo físico; la correspondencia al nombre existente y
preservación de identificador son decisión de integración explícita, representada
por `puerto_nombre` y este contrato, no atribuida al fabricante en el valor.
No cambiar globalmente los rótulos de las otras variantes con esta fila.

PDF local SHA256:
`75c676d18c8255acfebb8310c09d9e6ebf2ff830204775f0ae3f3175be853838`.
Imagen revisada: `output/plan40-20260908-083450/samsung-qb65r-p7.png`.

Antes de la segunda inspección, Ethernet de cámara en Codec EQ seguía pendiente
de trazado de conexión y convención ordinal. El cierre está al final. El helper
enumera 1..total, no acredita orden físico. El panel p.5 fue
inspeccionado posteriormente en `output/playwright/codec-eq-p5-zoom.png`: primeros
tres RJ45 `PoE++`, cuarto panel y quinto red. El icono de cámara aparece en HDMI
IN 1. No atribuir ese icono al RJ45 del codec ni reasignar conexiones existentes.

**Corrección de fila pendiente de integración coordinada:** `CODEC EQ`, clave
`control-camara`, conserva tipo restricción/estado parcial, pero sustituir valor por:

```json
{"texto":"El diagrama de conexión lleva el RJ45 de Quad Camera al primer RJ45 PoE++ del Codec EQ, a la izquierda mirando la trasera y junto al interruptor. Los RJ45 periféricos del codec no muestran un icono de cámara."}
```

No se editó el CSV durante la ejecución de seed/revisión. La frase anterior sobre
conectores con símbolo de cámara procede del texto D15296.23 p16, pero contradice
el panel dibujado del Codec EQ; el estado parcial no justificaba repetir esa
atribución como instrucción física. La integración debe corregirla antes de entregar.

La posición se cerró después con inspección independiente de
`output/playwright/camaras-p16.png`, página 16 de D15296.23: trazado al primer
RJ45 junto al interruptor. Mantener fuente de guía cámara y apartado
`Página 16 - diagrama de conexión RJ45, contrastado con Codec EQ p.5`.
El hecho puede pasar a verificado respecto de esa posición observada, conservando
clave `control-camara`; la decisión de carga corresponde al agente integrador.

**Correspondencia nueva QA, fuera del hecho fabricante:** ordinal 1 del grupo
`Network (Ethernet PoE)` = primera boca izquierda mirando la trasera; ordinal 2 =
segunda y ordinal 3 = tercera. Cámara en 1, micrófono en 2 por diseño. No cambiar
identificadores ni ordinales de conexiones preexistentes. En históricos esa
correspondencia exige inspección propia, no queda verificada por el dibujo del
nuevo montaje. El CSV no se editó durante la verificación del agente B.

## Propuestas de bocas conectables para integración coordinada

No escritas en `data/puertos.csv` mientras la entrega del agente B está en curso.
Formato existente, con nombres de grupo tomados de leyenda oficial o conector
descrito por fabricante. No se documentan los otros conectores de cámara ni se
crean existencias. TABLE MICROPHONE PRO pertenece a MICRÓFONO, no videoconferencia.

```csv
marca;modelo;categoria;nombre;total;sentido;senal;conector;orden;notas
CISCO;QUAD CAMERA;CÁMARA;HDMI output;2;salida;hdmi;HDMI;1;Leyenda oficial grupo HDMI output. Cámara física CS-QUADCAM2+ del montaje nuevo. El panel numera 2 a la izquierda y 1 a la derecha mirando los conectores. Usar boca 1 con ARC hacia HDMI IN 1 del Codec EQ. Fuente panel y conexión: https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/camera/precisionhd/user_guide/cisco-conferencing-camera-guide.pdf pagina 16. Dos salidas confirmadas en https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/room-kit/installation-guide/room-kit-pro-installation-guide-en-fr-es-pt-it-de.pdf pagina 34. Confirmar identidad física de unidades históricas
CISCO;QUAD CAMERA;CÁMARA;Camera control;1;bidireccional;red;RJ45;2;Leyenda oficial de control Ethernet. En el montaje nuevo conecta al primer RJ45 PoE++ del Codec EQ mirando su trasera de izquierda a derecha. La cámara usa fuente de alimentación propia. Fuente: https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/camera/precisionhd/user_guide/cisco-conferencing-camera-guide.pdf pagina 16. Confirmar identidad física de unidades históricas
CISCO;TABLE MICROPHONE PRO;MICRÓFONO;RJ45 Ethernet;1;bidireccional;red;RJ45;1;Denominación del conector según fabricante. Representa el extremo RJ45 del cable unido de 11 m y no una toma hembra libre en el micrófono. Audio sobre IP y alimentación PoE 5 W. Conectar directamente a boca PoE compatible. No sumar otro cable de 11 m como compra adicional. Fuente: https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/collaboration-peripherals/table-microphone-pro-ds.html apartados Connector y Power consumption
```

**Autorización técnica del perfil:** EOL15049 establece equivalencia funcional
CS-QUADCAM+ → CS-QUADCAM2+; guía y dibujo de conexión corresponden a Quad Camera.
Para la nueva QA se selecciona expresamente el SKU CS-QUADCAM2+ contenido en el
kit CS-KIT-EQ-K9, de modo que esos tres extremos de cámara pueden representarse
con los puertos propuestos. Usar la referencia genérica del catálogo QUAD CAMERA
no certifica que cada una de las 32 unidades históricas tenga ese SKU. La
asociación catalográfica puede ofrecer el perfil para diseño y mantener identidad
parcial, pero un perfil verificado por instancia exige confirmación de modelo
físico. No extender a QUADCAM, EQ genérico u otras etiquetas sin equivalencia
documentada. El aviso debe sobrevivir a mostrar el puerto en el selector.

Las filas de puertos propuestas representan catálogo, no tres conexiones
instaladas ni tres cables adicionales. Para el micrófono la longitud incluida
continúa en su hecho de suministro, evitando duplicarla al calcular compra.
La integración posterior debe decidir expresamente cómo representa el cable
unido en conexiones/material antes de acreditar el gate de ausencia de doble compra.

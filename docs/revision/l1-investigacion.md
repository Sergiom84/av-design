# L1 · investigación del montaje y cobertura

Consulta: 08/09/2026. Investigación y script de inventario de solo lectura: no
se han cambiado CSV, semillas, código de dominio ni base de datos. No acredita
el gate L1 completo.

## Cobertura observada

`data/catalogo-equipos.csv` contiene 1.072 filas de datos. Agrupando por marca
normalizada y `claveModelo` del proyecto, excluyendo modelo vacío y N/A igual
que el generador, resultan **810 referencias de equipo**. De ellas **24 tienen
alguna fila de puertos (2,96 %)**; las otras 786 no tienen puertos en este CSV.
`data/puertos.csv` contiene 144 filas. El seed entregado también declara 144
puertos de 24 artículos. Estos conteos no son fichas completas ni perfiles validados.

La ampliación reproducible confirma el denominador de docs/38 y docs/39:
**810 equipos + 30 referencias de cable/consumible + 31 altas desde precios
finales = 871 referencias totales**. Son 24/871 (2,76 %) del catálogo completo
y 24/810 (2,96 %) de los equipos originales normalizados. Los precios
orientativos no crean referencias, conforme al generador. Las referencias
añadidas por aplicación y filas reales de Postgres quedan fuera del recuento.
Unidades son uso histórico del CSV, no stock.

El comando entregable incorpora ambos universos y emite una matriz de las 871
referencias, con modelo, categoría, marca, uso, presencia de puertos, ficha
parcial/sin documentar, procedencia por fila y URLs ya existentes. `perfil_validado`
es siempre falso: el inventario no acredita perfiles ni fichas completas.

```powershell
node scripts/informe-cobertura-catalogo.mjs --json
node scripts/informe-cobertura-catalogo.mjs --csv
```

Ambos formatos se escriben por stdout; cualquier archivo de salida lo decide
quien ejecuta. El script importa `normalizacion.mjs` y reproduce orden y reglas
del generador: agrupación por clave, categoría de mayor uso/desempate por modelo,
precedencia posterior de cables, altas de precios finales y rechazo de puertos
huérfanos, duplicados o con sentido/señal inválidos. Cada fuente lleva SHA256 en
JSON. No importa ni ejecuta el generador, por sus efectos de escritura.

Receta inicial de contraste para el universo de equipos solamente, sin escrituras:

```powershell
@'
import {readFileSync} from 'node:fs';
import {normalizarMarca,claveModelo} from './scripts/normalizacion.mjs';
const leer=p=>{const [h,...l]=readFileSync(p,'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);return l.map(x=>Object.fromEntries(h.split(';').map((k,i)=>[k,x.split(';')[i]?.trim()??''])))};
const clave=r=>`${normalizarMarca(r.marca)??''}|${claveModelo(r.marca,r.modelo)}`;
const filas=leer('data/catalogo-equipos.csv');
const grupos=new Map();
for(const r of filas.filter(r=>r.modelo&&r.modelo!=='N/A')){const k=clave(r);const g=grupos.get(k)??[];g.push(r);grupos.set(k,g)}
const puertos=leer('data/puertos.csv');const conPuertos=new Set(puertos.map(clave));
console.log({filas:filas.length,referencias:grupos.size,conPuertos:[...grupos.keys()].filter(k=>conPuertos.has(k)).length,filasPuertos:puertos.length});
console.table([...grupos].map(([referencia,g])=>({referencia,unidades:g.reduce((s,r)=>s+Number(r.unidades_instaladas||0),0),puertos:puertos.filter(p=>clave(p)===referencia).length})).sort((a,b)=>b.unidades-a.unidades));
'@ | node --input-type=module
```

La receta reutiliza normalización existente. Es inventario, no una validación de
conectores, de cada fila ni del emparejamiento final del seed.

## Matriz del montaje de referencia

Los modelos comprables explícitos siguientes definen una referencia técnica para
ensayo; no reclasifican automáticamente los nombres ambiguos del inventario.
`Verificado` califica cada dato citado. Ninguna fila se declara ficha completa.
Fuentes oficiales consultadas hoy; se conserva documento y sección junto al dato.

| Referencia exacta | Datos verificados y procedencia | Estado local y pendientes |
|---|---|---|
| Cisco Room Kit EQ First Light, CS-KIT-EQ-K9 | Una unidad de CS-CODEC-EQ-K9+, CS-QUADCAM2+ y CS-T10-TS-L+. La caja estándar incluye soporte de cámara, adaptador y cable eléctrico regional. [Ficha EQ, tabla 3](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/spark-room-kit-series/room-kit-eq-ds.html) | ROOM KIT EQ suma 14 unidades históricas; 10 grupos/21 bocas actualmente representan solo codec. SKU de las unidades físicas: desconocido. No mapear WEBEX ROOM EQ QUADCAM (14) automáticamente. |
| Cisco Codec EQ, CS-CODEC-EQ-K9 | Tres HDMI OUT, tres HDMI IN, USB-C, cuatro USB-A, micro-USB de servicio, tres entradas micrófono y salida de línea. Red: tres puertos PoE periféricos, uno PoE de panel y uno LAN. [Guía D15548.01, 2025, pp. 5 y 13](https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/room-kit/installation-guide/codec-eq-installation-guide-en-fr-es-pt-it-de.pdf) | CODEC EQ existe con uso histórico vacío; 10 grupos/21 bocas. Cuatro PoE++ comparten 90 W, no 90 W simultáneos por puerto. La ficha no cierra aún todos los conectores analógicos. |
| Cisco Quad Camera First Light, CS-QUADCAM2+ | Dos HDMI de salida, Ethernet de control, entrada de línea, salida subwoofer, USB-A, micro-USB; entrada 12 Vcc/5,83 A. [Guía Room Kit Pro, pp. 34–35, panel Quad Camera](https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/room-kit/installation-guide/room-kit-pro-installation-guide-en-fr-es-pt-it-de.pdf) | QUAD CAMERA suma 32 unidades y no tiene puertos CSV; QUADCAM (3) sigue distinto. Validar SKU físico antes de transferir perfil. No alimentar cámara por PoE por analogía con otras cámaras. |
| Cisco Room Navigator de mesa, CS-T10-TS-L+ | Ethernet RJ45 de red/emparejamiento y alimentación PoE 802.3af clase 0; micro-USB de servicio. [Ficha Navigator mesa, Interfaces y Power](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/webex-room-series/datasheet-c78-744227.html) | ROOM NAVIGATOR suma 406 unidades; 2 grupos/2 bocas. WEBEX ROOM NAVIGATOR (1) sigue separado. No atribuir montaje de pared al SKU de mesa. |
| Cisco Table Microphone Pro, CS-MIC-ARRAY-T | Audio IP, cable unido de 11 m con RJ45, PoE 5 W; micro-USB de servicio. Incluye kit de montaje. Compatibilidad EQ explícita; hasta ocho unidades mediante topología adecuada, no ocho puertos directos. [Ficha Table Microphone Pro, tabla 2](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/collaboration-peripherals/table-microphone-pro-ds.html) | No existe referencia exacta en catálogo editable actual. Propuesta: una unidad para ensayo, sin acreditar cobertura acústica. V1/V2 mini-jack del inventario no son esta referencia. |
| Samsung QB65R, variante comercial regional por confirmar | Dos HDMI 2.0 de entrada; DVI-D, dos USB, audio mini-jack; salida audio, control RJ45/RS232C; 3840×2160; alimentación 100–240 V CA. [Samsung soporte QB65R, Specification](https://www.samsung.com/us/business/support/owners/product/qbr-series-digital-signage-qb65r/) | Referencia existente, 207 unidades históricas, 11 grupos/11 bocas. Elegida para ensayo documental por fuente exacta disponible; no implica stock. QB65R-B (266) permanece distinta: no transferirle ficha de QB65R sin fuente de variante. |

Los micrófonos de Quad Camera están destinados a seguimiento de hablante; no
acreditan captación de la reunión. El micro externo es una opción separada del
kit. [Ficha EQ, Features y Optional components](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/spark-room-kit-series/room-kit-eq-ds.html)

## Cables y montaje propuesto

| Tramo | Cantidad de ensayo | Incluido / longitud / límite |
|---|---:|---|
| Codec HDMI OUT → Samsung HDMI IN | 1 | HDMI adicional o pendiente de confirmar en pedido; longitud depende de geometría. No precisa conversión de interfaz HDMI; funcionamiento y resolución se verifican físicamente. |
| Quad Camera HDMI OUT 1 → codec HDMI IN 1 | 1 | HDMI con retorno ARC para altavoces de cámara; ordinal confirmado por guía D15296.23, p. 16. Longitud e inclusión pendientes del diseño/pedido. |
| Quad Camera Ethernet de control → primer RJ45 PoE++ del codec, mirando trasera de izquierda a derecha | 1 | Trazado de guía p16 inspeccionado. Para QA nuevo: ordinal 1 = primera boca izquierda, como convención explícita, sin validar históricos. |
| Navigator NETWORK → codec puerto panel | 1 | Ethernet/PoE; longitud e inclusión del cable pendientes del pedido. |
| Table Microphone Pro → codec periféricos PoE | 1 | Cable unido RJ45 de 11 m incluido con el micrófono. Que llegue exige recorrido + holgura ≤ longitud utilizable; no sumar compra de un segundo cable sin necesidad. |
| Codec LAN → toma concreta del edificio | 1 | Cable y boca de edificio por confirmar; no inferir capacidad ni continuidad de la roseta. |
| Red eléctrica → codec, cámara y pantalla | 3 alimentaciones | Cámara necesita adaptador dedicado; conectores/región, tomas disponibles y longitudes por comprobar. |

La ficha EQ vigente coloca HDMI de 1,5/3 m y Ethernet de 1,5/3/5/4/8/12 m en
opciones con precio, no en la lista estándar. Por tanto, no se debe inferir que
todo kit trae esos cables. [Ficha EQ, tabla 3, Optional Box Components](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/spark-room-kit-series/room-kit-eq-ds.html)

Las conexiones propuestas son diseño pendiente de ensayo: faltan longitud de
cada recorrido y contenido de pedido. HDMI y posición Ethernet de cámara quedan
documentados; su correspondencia ordinal se define explícitamente para la nueva
QA, sin acreditar unidades históricas.

### Ampliación de fuentes de conexión EQ

**Aplicabilidad de cámara:** Cisco EOL15049 declara que CS-QUADCAM+ pasa a
CS-QUADCAM2+ exclusivamente como cambio de referencia comercial, sin modificación
funcional; lo mismo para los repuestos con sufijo `=`. Esto fundamenta aplicar la
guía de Quad Camera al componente CS-QUADCAM2+ del ensayo. No identifica por sí
solo las filas QUADCAM o WEBEX ROOM EQ QUADCAM del inventario.
[Aviso oficial, 29/05/2023, tabla 2 y Overview](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/telepresence-mx-series/quadcam-eol.html).

**Conexión exacta:** la guía D15296.23 de marzo de 2026, página 16,
`Connect Quad Camera to Codec EQ`, prescribe salida HDMI 1 de cámara hacia
entrada HDMI 1 del codec. El mismo cable transporta vídeo hacia el codec y audio
ARC hacia los altavoces. El control usa Ethernet RJ45 y la alimentación emplea
adaptador propio. La frase de esa guía que atribuye símbolo de cámara a los
conectores Ethernet contradice el dibujo de características del Codec EQ,
inspeccionado posteriormente: no se usa como rótulo físico del RJ45 del codec. No
se añade un cable analógico para los altavoces en este montaje.
[Guía oficial de cámaras, p. 16](https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/camera/precisionhd/user_guide/cisco-conferencing-camera-guide.pdf).

Se obtuvo el texto de esa sección mediante búsqueda dirigida del documento
oficial. Abrir el PDF completo excedió el límite de la herramienta (12,8 MB);
la descarga directa de la guía corta recibió `Access Denied` del CDN. Después
se inspeccionó la captura del panel del Codec EQ obtenida por el director en
navegador; se detalla la discrepancia abajo. No se infiere un ordinal Ethernet.

**Cable del panel y potencia:** la guía específica Room Kit EQ indica como
opcional el Ethernet de Navigator (página PDF 3, numeración impresa 2–3).
En página PDF 13, numeración impresa 22–23, exige adaptador suministrado de
70 W para Quad Camera y fija **90 W máximos combinados** en los cuatro primeros
Ethernet PoE++. Esto evita contabilizar cuatro presupuestos independientes.
[Guía Room Kit EQ, componentes y conexión](https://www.cisco.com/c/dam/en/us/td/docs/telepresence/endpoint/room-kit/installation-guide/room-kit-eq-installation-guide-en-fr-es-pt-it-de.pdf).

El Table Microphone Pro mantiene el dato de su propia ficha: RJ45 unido de
11 m y 5 W PoE; no es el micrófono mini-jack. El presupuesto sintético debe
reservar esos 5 W y la carga real documentada del panel/periféricos dentro de
90 W. No se inventa clase PoE del micrófono ni potencia medida del Navigator.
Con la cámara alimentada externamente no se asignan sus 70 W al presupuesto PoE.
[Ficha Microphone Pro, Connector y Power consumption](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/collaboration-peripherals/table-microphone-pro-ds.html).

## Prioridad posterior por uso

| Orden | Referencia normalizada | Unidades históricas | Grupos de puerto CSV |
|---:|---|---:|---:|
| 1 | CISCO ROOM NAVIGATOR | 406 | 2 |
| 2 | CISCO SPARK ROOM KIT | 285 | 9 |
| 3 | SAMSUNG QB65R-B | 266 | 11 |
| 4 | CISCO TABLE MICROPHONE MINI JACK (V1) | 227 | 1 |
| 5 | SAMSUNG QB65R | 207 | 11 |
| 6 | LENOVO M920Q | 108 | 0 |
| 7 | BACHMANN TOPFRAME | 102 | 1 |
| 8 | CISCO TOUCH 10 | 100 | 1 |
| 9 | CRESTRON UC-SB1-CAM | 90 | 4 |
| 10 | CRESTRON DM-NVX-E30 | 87 | 7 |
| 11 | AVER VB342 | 85 | 6 |
| 12 | SAMSUNG QB65H | 77 | 0 |
| 13 | GENELEC 4010AW | 74 | 0 |
| 14 | SAMSUNG QB55R | 73 | 11 |
| 15 | CISCO WEBEX ROOM BAR PRO | 71 | 11 |

Primero terminar montaje de referencia; después esta lista. Un grupo informado
no asegura ficha completa: TOPFRAME, por ejemplo, puede depender de módulos y
debe documentarse por configuración. No se inventan URLs para las 786 referencias
sin puertos ni se promete cubrirlas sin documentación fiable.

## Preservación de puertos: mecanismo que debe probarse

El generador actual emite `delete from puertos where fuente = 'csv'` antes de
insertar de nuevo (`scripts/generar-seed.mjs`, bloque Puertos). Las FK históricas
de `conexiones` hacia puertos usan `on delete set null`; las relaciones de
`conexion_bocas` añaden restricciones que pueden rechazar el borrado.

Son dos casos distintos pendientes de prueba: un cable con bocas puede hacer
fallar la siembra completa; una conexión histórica con puerto y sin boca puede
perder referencia de puerto al borrar. No se afirma que se hayan observado aquí:
no se ejecutó seed ni BD durante esta investigación. El gate L1 exige probar ambos
y reemplazar la regeneración destructiva por sincronización estable con resolución
explícita de ordinales invalidados. Ninguna fuente web acredita ese gate técnico.

## Estado entregado

Inventario y fuentes de referencia disponibles. Pendiente: persistencia de
procedencia/estado en modelo existente, matriz consultable por artículo, alta
documentada del micro elegido, guía completa de conexión EQ, protección probada de
identificadores y revisión independiente. L1 continúa abierto.

## Evidencia del script de inventario

### Ampliación: cobertura de hechos técnicos

`scripts/informe-cobertura-catalogo.mjs` produce formato versión 2 y también lee
`data/fichas-tecnicas.csv`. Valida cada hecho reutilizando `esquemaDatoTecnico`
mediante el cargador TypeScript local ya instalado. JSON distingue por referencia:
`algun_puerto`, `algun_hecho_documentado`, `hechos_verificados`, `hechos_parciales`,
`hechos_sin_documentar` y la lista íntegra de hechos con procedencia. CSV incluye
esos contadores, URLs y estados. Ningún recuento acredita perfil completo.

Los hechos sin artículo permanecen en `hechos_sin_articulo`, sin inventar un
artículo nuevo. Al exportar CSV se avisa por stderr de esos pendientes. Un dato
inválido produce diagnóstico y salida 1; no desaparece silenciosamente del JSON.
Una referencia con hechos pero sin puertos puede tener ficha parcial: no significa
que tenga bocas conectables. Un hecho sin documentar no suma a los documentados.

Ejecutado antes del alta coordinada de TABLE MICROPHONE PRO: 38 hechos, 32 vinculados
a cinco referencias, seis pendientes de artículo, cero inválidos. Se conservan
871 artículos, 24 con puertos y cero fichas completas acreditadas. Estos números
son el corte de ejecución: el alta posterior del micrófono debe aumentar a 872
artículos y vincular sus seis hechos, sin alterar el algoritmo ni forzar totales.
Artefacto: `output/plan40-20260908-083450/l1-cobertura-hechos.json`.

Pruebas ejecutadas por subprocesos Node: igualdad entre total de hechos y suma
vinculados/huérfanos; cámara con hechos sin puertos permanece parcial; hechos
desconocidos del kit no cuentan como documentados; fuente Cisco preservada;
ningún perfil declarado completo; CSV tiene tantas filas como referencias y
contadores nuevos. Todas pasan, salida 0. ESLint pertinente también salida 0.

### Contrato del montaje sintético extremo a extremo

| Tramo previsto | Extremos documentados o elegidos para ensayo | Pendiente explícito |
|---|---|---|
| Vídeo y altavoces de cámara | CS-QUADCAM2+ HDMI OUT 1 → CS-CODEC-EQ-K9+ HDMI IN 1, con ARC | Longitud del recorrido y suministro del cable |
| Control de cámara | CS-QUADCAM2+ RJ45 de control → primer RJ45 PoE++ del Codec EQ, junto al interruptor mirando trasera | Posición física confirmada p16. QA: ordinal 1 corresponde explícitamente a primera izquierda. No buscar símbolo de cámara en ese RJ45 |
| Pantalla | Codec EQ HDMI OUT 1, elección del diseño → Samsung QB65R HDMI IN 1 (ARC) | Longitud del cable y SKU de unidad histórica. Serigrafía cerrada por manual oficial p.7 inspeccionado |
| Panel de mesa | CS-T10-TS-L+ NETWORK → Codec EQ puerto de panel táctil | Confirmar identidad del panel real y longitud del Ethernet opcional |
| Captación de voz | CS-MIC-ARRAY-T cable unido RJ45 de 11 m → segundo RJ45 PoE++ del Codec EQ, elección del ensayo | QA: ordinal 2 = segunda boca de izquierda a derecha. Verificar recorrido + holgura; no inferir esa asignación para históricos |
| Red de edificio | Codec EQ LAN → roseta concreta de sala | Código, boca, capacidad y continuidad documentados, no derivados de una etiqueta genérica |
| Alimentación | Codec EQ y QB65R a red CA, cámara mediante PSU-12VDC-70W-GR+ | Tomas físicas, región y alcance de cables eléctricos |

No hay dos compras del codec ni cámara/control incluidos dentro del SKU de kit.
El micrófono es adicional al kit y aporta su propio cable unido. La inclusión
de HDMI o Ethernet de los demás tramos sigue pendiente del pedido concreto.
El esquema documental permite preparar el ensayo; no acredita montaje terminado
mientras queden bocas físicas y medidas pendientes.

### Cierre documental de la pantalla y límite de Ethernet del codec

Se descargó el ZIP enlazado como manual por modelo desde la página oficial
[Samsung QB65R LH65QBREBGCXEN, Support](https://www.samsung.com/ch/business/smart-signage/uhd-4k-signage/professional-display-qbr-series-lh65qbrebgcxen/).
Su PDF inglés `LFDQMREN-11_BY-MODEL_..._EU_ENG_220705.0.pdf`, página **7**, se
extrajo con pypdf y renderizó con Poppler. **Se inspeccionó el dibujo**: la columna
que incluye QB65R muestra `HDMI IN 1 (ARC)` y `HDMI IN 2`. La tabla confirma que
son entradas de fuentes HDMI. No se tomó la columna QM, que tiene otros puertos.

Artefactos locales: `output/plan40-20260908-083450/samsung-qb65r-manuales.zip`,
`samsung-qb65r-english.pdf` y `samsung-qb65r-p7.png` dentro de esa misma carpeta.
Fuente descargada: [manuales oficiales Samsung por modelo, revisión 11](https://downloadcenter.samsung.com/content/UM/202209/20220906131556618/LFDQMREN-11_BY-MODEL_QBR_QBR-B_QBR-N_QMR_QMR-A_QMR-B_QER_QMR-T_WW_L42_220617.0.zip).

Correspondencia propuesta sin renumerar: el puerto CSV de QB65R llamado
`HDMI IN 1`, total 1, corresponde a la entrada rotulada `HDMI IN 1 (ARC)`.
Su ordinal interno sigue siendo 1 porque esa fila representa una sola boca.
No se cambia ahora su nombre, UUID, fuente ni conexiones. La anotación ARC puede
documentarse junto a esa boca conservando la identidad existente. Este hallazgo
no da por revisados los restantes puertos ni otras variantes.

En la primera pasada no se había cerrado el ordinal Ethernet del cable de control.
El cierre visual posterior figura al final de este apartado. El catálogo agrupa tres bocas en
`Network (Ethernet PoE)` y no declara una convención física para numerarlas.
`bocas-puerto.ts` enumera ordinales 1..total, pero esa enumeración no prueba que
el ordinal 1 corresponda a un conector específico del montaje. La descarga Cisco recibió
denegación de CDN y el host alternativo oficial localizado devolvió certificado
con nombre distinto. No se relajó TLS ni se inventó un ordinal.

Contrato de preservación histórica: obtener diagrama legible del panel EQ y
establecer explícitamente la correspondencia de cada una de las tres posiciones
con los ordinales ya utilizados. Antes de aplicar cualquier cambio se deben
inventariar referencias a `puertos.id` y `conexion_bocas.ordinal`, separando
conexiones históricas sin bocas. Un nombre descriptivo no debe cambiar
el UUID ni trasladar una conexión al primer puerto libre. Esta investigación no
consultó BD y no puede afirmar qué conexiones vivas existen actualmente.

**Corrección tras inspección visual del panel:** se abrió la captura
`output/playwright/codec-eq-p5-zoom.png`, obtenida por el director con el PDF
oficial de Codec EQ a página 5 y zoom 200 %. Los tres primeros RJ45 llevan
`PoE++`, el cuarto símbolo de panel y el quinto símbolo de red. El símbolo de
cámara está junto a HDMI IN 1, no en los tres RJ45 periféricos. La frase inglesa
de D15296.23 p16 sobre los símbolos de los conectores contradice esta imagen.
Se retira de las instrucciones la atribución del símbolo a RJ45 del codec.
La conexión Ethernet sigue documentada, pero su extremo concreto exige seguir
el trazado de la guía de montaje, no trasladar el icono HDMI al grupo RJ45.

**Cierre del trazado tras segunda imagen:** se inspeccionó independientemente
`output/playwright/camaras-p16.png`, página 16 de la guía D15296.23. El cable RJ45
de Quad Camera llega al **primer RJ45 del Codec EQ**, a la izquierda mirando la
trasera, junto al interruptor. Esta posición física queda acreditada por el
dibujo aunque la frase sobre el icono sea discrepante.

Convención explícita para la nueva sala QA: dentro del grupo `Network (Ethernet
PoE)` numerar sus tres bocas de izquierda a derecha mirando la trasera. Cámara
en ordinal 1; micrófono en ordinal 2 por elección del diseño y ordinal 3 libre.
El panel continúa en su puerto independiente. Es una decisión de correspondencia
del nuevo montaje, no una reinterpretación de ordinales históricos. Estos últimos
conservan UUID/ordinal hasta inspección documentada propia. La propuesta de fila
corregida para carga coordinada está en `l1b-fuentes.md`.

### Evidencia inicial, previa a la ampliación

Ejecutado `node scripts/informe-cobertura-catalogo.mjs --json` con salida 0;
artefacto de comprobación en `output/plan40-20260908-083450/l1-cobertura.json`.
Resultado: 871 referencias únicas, 24 con puertos, 144 grupos aceptados y cero
descartados; 31 altas de precios finales. ESLint del script termina con salida 0.

Comprobaciones por subprocesos Node ejecutadas con aserciones: JSON válido y
denominadores 810/871; claves únicas; ninguna ficha completa ni perfil acreditado;
CSV con cabecera y 871 filas (872 líneas); mismo JSON ejecutando desde `docs/`;
opción `--aplicar` rechazada. Los SHA256 de los seis CSV consultados y `db/seed.sql`
son idénticos antes y después. Todas las aserciones pasaron con salida 0. No se
abrió ninguna conexión de base de datos. La prueba verifica el contrato del informe;
no sustituye el ensayo de sincronización de puertos pendiente en L1.

### Actualización del informe tras corrección L1B

El informe incorpora `concepto` al validar cada hecho con Zod. JSON conserva
concepto, valor completo (incluida `longitud_aplica`), estado y metadatos
`puerto_nombre`/`puerto_fuente`. El CSV agregado por referencia añade
`conceptos_hechos`, con clave, concepto y estado de cada hecho. No resuelve UUID
de puertos ni acredita un perfil completo: sigue siendo una lectura de los CSV.

Tras la confirmación del integrador de que el CSV estaba terminado, se ejecutaron
ambos modos mediante subprocesos Node con aserciones dinámicas contra todas las
filas del CSV actual: correspondencia por procedencia, concepto, estado, valor y
metadatos de puerto preservados, cero hechos inválidos y conceptos presentes en
el CSV exportado. Resultado observado: 872 referencias y 40 hechos; las pruebas
no fijan esos totales como constante. SHA256 del CSV técnico idéntico antes y
después. ESLint del script y comprobación de ambos modos terminaron con salida 0.
No se ejecutaron generador, SQL ni conexión de BD en esta actualización.

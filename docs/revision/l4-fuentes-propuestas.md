# L4 · Propuesta documental Room Bar Pro

Consulta: 2026-09-08. Solo propuesta: no modifica CSV, generador ni BD. Alcance limitado a captación de voz integrada y su límite de uso, sin acreditar perfil completo.

## Evidencia oficial y alcance

La [Cisco Room Bar Pro Data Sheet](https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/webex-room-series/room-bar-pro-ds.html), tabla de especificaciones, apartado **Microphone and loudspeaker system**, describe una matriz interna de 16 elementos para captación de voz y seguimiento. Recomienda añadir micrófonos cuando los participantes estén a más de cuatro metros y advierte de la influencia acústica y del ruido. Captación integrada no significa cobertura suficiente en cualquier sala.

La sección **Ordering information** identifica Room Bar Pro y sus variantes comerciales. Esto documenta el producto ROOM BAR PRO; no acredita qué SKU se compró históricamente. La ficha abierta no identifica expresamente el rótulo de inventario WEBEX ROOM BAR PRO como alias comercial: su correspondencia exacta queda pendiente. No trasladar otras características entre variantes ni convertir el reconocimiento estático actual en evidencia del fabricante.

El catálogo contiene ambos modelos por separado y también CISCO ROOM BAR PRO. Este último queda fuera del encargo. No se encontró una regla literal de alias para las dos referencias solicitadas en `scripts/normalizacion.mjs` mediante búsqueda de sus nombres completos. No se propone unificarlas.

## Filas exactas propuestas

La primera fila sirve para el ensayo sintético de barra identificada ROOM BAR PRO. La tercera conserva explícitamente desconocido en la referencia histórica WEBEX ROOM BAR PRO hasta verificar identidad mediante SKU/etiqueta del aparato o fuente oficial de equivalencia. No se añade una fila parcial con captación integrada: podría acabar usándose como certeza pese a la identidad pendiente.

```csv
marca;modelo;clave;tipo;estado;valor_json;fuente_url;documento;apartado;consultado_en;puerto_nombre
CISCO;ROOM BAR PRO;captacion-voz;microfonia;verificado;{"captacion":"integrada"};https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/webex-room-series/room-bar-pro-ds.html;Cisco Room Bar Pro Data Sheet;Product specifications - Microphone and loudspeaker system;2026-09-08;
CISCO;ROOM BAR PRO;alcance-captacion-integrada;restriccion;verificado;{"texto":"La matriz interna está optimizada para participantes sentados hasta 4 m. Cisco recomienda micrófonos externos a mayor distancia. La acústica y el ruido condicionan la captación."};https://www.cisco.com/c/en/us/products/collateral/collaboration-endpoints/webex-room-series/room-bar-pro-ds.html;Cisco Room Bar Pro Data Sheet;Product specifications - Microphone and loudspeaker system;2026-09-08;
CISCO;WEBEX ROOM BAR PRO;captacion-voz;microfonia;sin_documentar;null;;;;;
```

No asignar `puerto_nombre` a microfonía interna: esta capacidad no equivale a una boca externa. No añadir accesorios, puertos ni alimentación en esta unidad.

## Comprobación y aceptación pendiente

Fuente abierta y texto de especificaciones contrastado mediante herramienta web. Las tres filas propuestas se validaron contra `esquemaDatoTecnico` actual, con `fuente='csv'`, convirtiendo celdas de procedencia vacías en null: 3/3 válidas, cada una con 11 columnas. La validación estructural no certifica identidad de inventario.

Antes de integrar, el arquitecto debe decidir si el ensayo usa la referencia canónica identificada o completa la evidencia del alias. El ensayo de captación debe leer el hecho verificado y mantener pendiente la cobertura real; no aprobar por una comparación de nombre en `perfilEquipo`. Gate L4 no ejecutado en esta preparación.

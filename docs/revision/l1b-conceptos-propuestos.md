# L1B · Conceptos y aplicación de longitud propuestos

Fecha: 2026-09-08. Propuesta sobre las 40 filas actuales de `data/fichas-tecnicas.csv`. No modifica el artefacto en revisión, código, CSV ni BD.

`concepto` es una etiqueta editorial explícita del hecho, independiente de su valor y estado. Se conserva también cuando `valor=null`, para poder presentar «Cable HDMI suministrado · Sin documentar · Dato desconocido». No deriva del nombre del tipo ni de una expresión regular en la interfaz.

`longitud_aplica` se propone únicamente dentro del valor no nulo de tipo `suministro`. `true` significa que el hecho describe un cable: si `longitud_m=null`, su longitud es desconocida. `false` significa que describe un equipo, adaptador de alimentación o kit de montaje: no se muestra una longitud desconocida. No significa longitud cero ni acredita medidas del objeto. Para tipos distintos y suministro nulo la columna queda vacía; no se fabrica un valor para alojar la bandera.

## Mapeo completo

```csv
marca;modelo;clave;concepto;longitud_aplica
CISCO;CODEC EQ;microfonia;Captación de voz;
CISCO;CODEC EQ;alimentacion;Alimentación eléctrica;
CISCO;CODEC EQ;poe-presupuesto;Presupuesto PoE compartido;
CISCO;CODEC EQ;puerto-hdmi-salidas;Salidas HDMI;
CISCO;CODEC EQ;puerto-hdmi-entradas;Entradas HDMI;
CISCO;CODEC EQ;puerto-usb-c;Puerto USB-C;
CISCO;CODEC EQ;puerto-usb-a;Puertos USB-A;
CISCO;CODEC EQ;puerto-microfonos;Entradas de micrófono;
CISCO;CODEC EQ;puerto-linea;Salida de audio de línea;
CISCO;CODEC EQ;camara-principal;Conexión HDMI de la cámara principal;
CISCO;CODEC EQ;control-camara;Conexión Ethernet de control de cámara;
CISCO;ROOM KIT EQ;alcance-sku;Referencia del kit documentado;
CISCO;ROOM KIT EQ;incluye-codec;Codec incluido;false
CISCO;ROOM KIT EQ;incluye-camara;Cámara incluida;false
CISCO;ROOM KIT EQ;incluye-panel;Panel de control incluido;false
CISCO;ROOM KIT EQ;microfonia;Captación de voz;
CISCO;ROOM KIT EQ;adaptador-camara;Adaptador de alimentación de la cámara;false
CISCO;ROOM KIT EQ;ethernet-panel-opcional;Cable Ethernet opcional del panel;true
CISCO;ROOM KIT EQ;hdmi-suministrado;Cable HDMI suministrado;
CISCO;QUAD CAMERA;cambio-referencia;Sustitución de referencia comercial;
CISCO;QUAD CAMERA;captacion-seguimiento;Función de los micrófonos de seguimiento;
CISCO;QUAD CAMERA;alimentacion;Alimentación eléctrica de la cámara;
CISCO;QUAD CAMERA;puerto-hdmi;Salidas HDMI de la cámara;
CISCO;QUAD CAMERA;puerto-control;Puerto de control de cámara;
CISCO;QUAD CAMERA;conexion-hdmi;Conexión HDMI y retorno de audio;
CISCO;ROOM NAVIGATOR;variante;Variante de panel documentada;
CISCO;ROOM NAVIGATOR;poe;Alimentación PoE del panel;
CISCO;ROOM NAVIGATOR;puerto-network;Puerto de red del panel;
CISCO;ROOM NAVIGATOR;servicio;Puerto de servicio y conexión de red;
CISCO;TABLE MICROPHONE PRO;poe;Alimentación PoE del micrófono;
CISCO;TABLE MICROPHONE PRO;cable-unido;Cable Ethernet unido al micrófono;true
CISCO;TABLE MICROPHONE PRO;kit-montaje;Kit de montaje del micrófono;false
CISCO;TABLE MICROPHONE PRO;conector-red;Conector RJ45 del cable unido;
CISCO;TABLE MICROPHONE PRO;compatibilidad-eq;Compatibilidad con Room Kit EQ;
CISCO;TABLE MICROPHONE PRO;longitud-utilizable;Comprobación del alcance del cable;
SAMSUNG;QB65R;alimentacion;Alimentación eléctrica de la pantalla;
SAMSUNG;QB65R;entradas-hdmi;Entradas HDMI de la pantalla;
SAMSUNG;QB65R;variante;Modelo de pantalla documentado;
SAMSUNG;QB65R;entrada-hdmi-1-serigrafia;Serigrafía de la entrada HDMI 1;
CISCO;QUAD CAMERA;identidad-instancia;Identificación de la cámara instalada;
```

## Casos que resuelve

- `hdmi-suministrado`: concepto «Cable HDMI suministrado», estado sin documentar y valor nulo permanecen. La etiqueta identifica el asunto consultado, no afirma que se haya incluido un cable.
- `incluye-codec`, `incluye-camara`, `incluye-panel`: referencias de equipos, con `longitud_aplica=false`. Conservan cantidades, inclusión, estado parcial y procedencia actuales.
- `adaptador-camara`: describe la fuente PSU-12VDC-70W-GR+, no un cable ni un adaptador de señal. `longitud_aplica=false`.
- `ethernet-panel-opcional`: describe un cable de longitud desconocida, por tanto `true` con `longitud_m=null`. No añadir metros ni cambiar `incluido=false`.
- `cable-unido`: describe el cable Ethernet unido de 11 m, por tanto `true`. No trasladar esta longitud al tamaño del micrófono.
- `kit-montaje`: describe accesorios de fijación, por tanto `false`. No inferir que incluya otros cables.

## Comprobación ejecutada

Se cotejó este bloque contra las filas actuales mediante lectura local: 40 claves compuestas únicas, correspondencia exacta de marca/modelo/clave y concepto no vacío en las 40. Siete suministros con valor no nulo llevan bandera: dos `true` y cinco `false`; las otras 33 filas la dejan vacía. `hdmi-suministrado` conserva valor nulo y bandera ausente. No se cambiaron valores técnicos ni fuentes. La aplicación de esta propuesta queda a cargo de la corrección coordinada tras el dictamen.

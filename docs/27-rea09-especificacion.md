# REA-09 · Consulta local con fuentes, historial propio y dictado

Estado: **contrato aprobado por el coordinador, sin runtime de consulta ni
migración en bases previas**. La migración se aplicó sólo en la nueva base
sintética5562 (85tablas); la extracción técnica mínima está integrada y verificada
por raíz; el producto09 todavía requiere asignación, BD y revisión independiente.
15-10-2026; ST07/ST16/ST17, extensión de ST08 y enlace ST18 de cobertura18.
Depende de E1/E3 reconciliados, REA-02 y REA-03; conserva el contrato17.
Destino único: AV_design, `codex/rea-integracion`, base `7ba7960` y WIP previo.

## Resultado y límites

Una persona consulta por teclado datos técnicos autorizados de una sala, una
selección explícita de salas de una obra o referencias de catálogo. Recibe
respuesta determinista, ausencias, fecha de observación y fuentes enlazadas.
Puede volver a su historial y preparar un informe existente de REA-03.
La interfaz lo llama **Consulta local**; no se presenta como IA generativa.

No transmite consultas, voz, fuentes ni historial a terceros. El adaptador
generativo externo existe sólo como interfaz sin configurar/no invocable:
`no_configurado`, sin SDK, credenciales, red ni fallback. Habilitarlo requeriría
otro contrato y autorización expresa; configurar una variable no lo activa.
No crea borradores de diseño, sustituye equipos ni escribe diseño, catálogo,
stock, reservas, compras, hitos, propuestas o revisiones. No ejecuta acciones,
SQL, enlaces o instrucciones escritos en una pregunta/documento/respuesta.
Fuera del mínimo: OCR, embeddings, búsqueda web, subida de documentos, servicio
remoto de voz, memoria compartida entre personas y REA-10.

## Evidencia del checkout y reutilización

| Fuente comprobada | Decisión de integración |
|---|---|
| `documentos/datos.ts::cargarSnapshotEnLectura` carga catálogo, parámetros, reservas, disponibilidad y revisión E3; `construirBom` calcula faltantes y valoración. | No llamarlos para una pregunta técnica y eliminar campos después. Su uso completo exige **todas** las secciones E1/03 antes del primer SQL. No cambiar su API. |
| `revisiones-diseno-repositorio.ts::leerDiseno/referenciaRevisionDiseno` cargan contexto de catálogo/parámetros y jerarquía. | No usarlos con sólo salas:ver. Proyectar campos concretos y metadatos E3 sin cargar snapshots completos/contexto. |
| `necesidadExportada`, `necesidadDeSala`, `agruparMaterialCable`, `calcularConexion` y `construirTablaCables` fijan el cálculo actual. | Reusar lógica pura con entrada técnica mínima tipada; raíz extrae el núcleo compartido si requiere cambiar una firma. No inventar otra fórmula ni falsear un `SnapshotExportacion` con casts o ceros. |
| REA-03 tiene registro, ACL de origen/receptor, snapshots, preview y runner. | Usar definiciones/proyecciones autorizadas o enlazar su flujo; no crear generador, scheduler ni descarga paralelos. |
| REA-02 persiste marcas/filtros por persona con versión. | Reusar sus validadores y semántica literal; no conceden acceso ni cambian referencias instaladas. |
| E1 conserva paquetes temporales; REA-03/06 conservan documentos propios. | Referenciar sus IDs/hash/fechas y ACL actuales; no copiar PDF/bytea a consultas. |
| `package.json` no declara motor de voz local. | No prometer dictado operativo por detectar un constructor de reconocimiento. Verificar soporte local real en implementación. |

Se leyó la guía instalada Next16 `01-app/01-getting-started/15-route-handlers.md`:
cada handler autoriza por sí mismo, sin confiar en layout ni caché compartida.

Raíz integró `src/lib/necesidad-tecnica.ts`, reexportado desde E1, y estrechó las
firmas técnicas de los motores sin alterar su JavaScript ejecutable. El catálogo
sin precio puede pasar campos reales `id/marca/modelo/unidad/bobina_m`, y formato
comercial/señal sólo donde se usan. Un coste no consultado queda ausente, sin
inventar un Articulo completo.89pruebas de cable/tabla/compras/E1/lectura y el
gate principalE2 real pasan; evidencia `rea09/preparacion/` y gates de reanudación.
Esto habilita lectores técnicos, no acredita todavía respuestas/ACL/historial09.

## Ámbito, intenciones cerradas y proyecciones

Ámbito inmutable por conversación: `{tipo:'sala',id}`, `{tipo:'obra',id,salaIds}`
con 1..20 UUID distintos elegidos explícitamente, o `{tipo:'catalogo'}`.
No seleccionar toda una sede/obra implícitamente. Cambiar ámbito crea otra
conversación; no arrastra textos anteriores al nuevo contexto. Sala legado es
válida. Sala sin proyectos:ver no consulta jerarquía ni muestra nombres de obra.
En obra se exige proyectos:ver + salas:ver y pertenencia actual de cada sala,
mediante left joins; traslado/eliminación rechaza el conjunto con 409.

Clasificador puro versionado `local-1`: frases/alias españoles documentados y
botones de ejemplo producen un intent y argumentos validados. No interpreta
texto como SQL ni usa parecido para resolver modelo, cable o sala. Ambigüedad
produce aclaración con selección autorizada; nunca escoge la primera coincidencia.
Un intent desconocido no consulta tablas privadas para buscar qué responder;
sólo identidad/metadatos propios necesarios y respuesta de capacidades.

| Intent / ejemplos | Fuente, permiso mínimo y resultado permitido |
|---|---|
| `medidas`: «¿Qué medidas tiene esta sala?» | salas:ver; sala seleccionada, largo/ancho/alto/mesa, unidad y posición confirmada cuando exista. Proyección propia de `salas`, sin catálogo/jerarquía/hitos. |
| `equipos`: «¿Qué equipos hay?» | salas:ver; filas `sala_equipos` del ámbito: identidad, nombre registrado, cantidad, posición y confirmación. Modelo/puerto del catálogo sólo con catálogo:ver; no inferirlos del nombre. |
| `conexiones`: «¿Qué conecta HD-1000?» | salas:ver + catalogo:ver; conexiones/equipos/puertos usados, ID de brida literal, señal, extremos/etiquetas y avisos canónicos. Longitud manual etiquetada; sin cálculo implícito de metros. |
| `cables` / `necesidad`: «¿Cuántos metros calcula?» / «¿Qué material necesita?» | salas:ver + catalogo:ver + parametros:ver, además de proyectos:ver en obra; proyección técnica de medidas/equipos/conexiones/puertos/BOM E2 y parámetros necesarios. Reusa cálculo/necesidad E1; necesidad por artículo **y unidad**, detalles y avisos. Sin stock, faltantes, proveedores ni dinero. |
| `catalogo`: «Buscar pantallas de mis marcas» / ficha elegida | catalogo:ver; artículos activos y ficha técnica exacta, columnas explícitas sin costes. Filtros literales REA-02 antes de LIMIT20; campos técnicos con procedencia y fecha verificada. |
| `documentos`: «¿Qué documentos de esta selección puedo abrir?» | ACL actual completa del origen E1/03/06, propietario/receptor vigente y ámbito coincidente; sólo metadatos/enlaces autorizados, sin leer binarios. «¿Qué dice este documento?» sólo para texto estructurado técnico disponible y seleccionado explícitamente, según frontera siguiente. |
| `informe`: «Preparar informe de estado actual» | Permisos completos de clave/ámbito del registro03; devuelve preparación visible/enlace al flujo03, sin crear/encolar nada. Período/formato ambiguos se preguntan. |

Las preguntas financieras, costes/tarifas/salarios, beneficio, compatibilidad
garantizada, sustitución equivalente, recomendación de montaje o un pasado no
registrado producen abstención explícita. No se lee REA-05, tarifas, costes
laborales, contraseñas ni datos administrativos. No basta compras:ver para ello.
Preguntas de carga/stock se remiten a su pantalla o al informe03 autorizado;
no se inventa otro lector operativo. Intent mezcla soportado y privado: pedir
separación, sin consulta parcial oculta. Cero explícito, null, sin filas, error,
sin permiso y dato no calculable son estados distintos; no sumar ud con m.
Categoría desconocida/null se muestra «Sin categoría», nunca se infiere modelo.

## Fuente, captura e integridad

Captura por petición dentro de MVCC `repeatable read read only`, conexión
inyectada y `transaction_timestamp()` como observadoEn. Primero identidad real
activa/no provisional y permisos actuales; luego resolver ámbito, fuente y
columnas. Todas las consultas llevan filtros de ámbito antes de leer y valores
parametrizados; no `select *`, JSON completo ni catálogos al navegador.

Respuesta estructurada: `versionModelo:1`, `motor:'local-1'`, intent, ámbito,
observadoEn, hechos con unidad/ausencia/advertencia y citas por hecho. Cada cita
identifica tipo/id, ancla de fila o campo, revisión E3 id/número/hash cuando
exista, diseno_version, hash canónico de la proyección, fecha y enlace interno
del servidor. Un borrador se etiqueta como borrador; no se inventa un hash E3
completo a partir de una proyección. Sin revisión guardada, revisiónId=null.
Para catálogo sin versión global, hash de campos leídos + observadoEn;
verificado_en de la ficha no equivale a fecha de actualización del artículo.

Documentos: E1 aporta manifiesto propio vigente/hash de archivo; su caducidad
de 30 minutos se conserva y no se convierte en fuente durable nueva. REA-03
exige toda su ACL (también propietario/grupos/receptor/caducidad) antes de leer
snapshot; proyectar en SQL sólo claves técnicas permitidas, sin leer dinero.
REA-06 exige cabecera y revisión actualmente autorizadas: sólo texto técnico
estructurado sin valoración; si cabecera/revisión está valorada queda fuera
de este adaptador, sin intentar una redacción silenciosa del PDF. Origen BOM
conserva además sus requisitos de fuente. No usar lectores completos03/06 que
carguen contenido monetario. PDF/imagen sin texto estructurado: «No dispongo de
texto consultable; puedes abrir el original autorizado», sin OCR supuesto.
Texto fuente es dato literal, escapado; nunca instrucciones para el sistema.

`RegistroFuentesConsulta` sólo despacha tipos cerrados E1/03/06 y técnicos
anteriores, con funciones autorizarMetadatos/proyectar/comprobarVigencia.
REA-10 podrá añadir un tipo con sus propias ACL y anclas de página/fragmento;
no obliga ahora a implementar ni duplicar bytes, extracción o documentos.

No hay token de preview para una lectura nueva: se consulta lo actual y se
congela la respuesta observada con SHA-256 canónico, no datos del navegador.
Antes de persistir/publicar se releen identidad/ACL y vigencia en una lectura
nueva; cambios de ámbito/fuente desde captura dan 409. Sin versión del origen,
comparar hash de la proyección autorizada; si no puede comprobarse, 503 seguro.
No enviar un stream parcial de hechos antes de esa comprobación final.

Preferencias: sólo se leen con catálogo:ver y cuando el intent las usa.
Guardar versión/hash/filtros aplicados como procedencia. «Sin marcas» consulta
el conjunto filtrado; retiradas/sin resultados se explican. Preferencia no filtra
los equipos ya registrados de sala ni prueba disponibilidad o compatibilidad.

## Historial y concurrencia

Historial durable propio, separado de revisiones_diseno; propietario=autor
obtenido de sesión. Ni admin tiene lectura global por esta API. No compartir,
exportar ni usar historial de otra conversación como contexto automático.
Cada turno conserva pregunta final editable, respuesta estructurada, fuentes,
captura/hash/versiones y requisitos derivados **por servidor** del intent/fuentes.
No se guarda audio, parciales de voz ni el mapa de permisos de la persona.

Listado carga sólo metadatos propios, nunca títulos/resúmenes/preguntas. Antes
de leer `consultas_contenidos`, autoriza con identidad actual el ámbito y **todas**
las fuentes declaradas del turno, también las que afectaron al texto de pregunta.
Metadatos ACL contienen IDs/tipos/versión/requisitos, sin nombres ni fragmentos.
Una pregunta de seguimiento declara explícitamente turnos usados y hereda la
unión de sus fuentes/requisitos; sin acceso a todos no se carga ese contexto.
El mínimo v1 responde cada pregunta independientemente, sin resolver «lo anterior».

Fuente retirada/eliminada, redactada, revocada, documento caducado o permiso
retirado: bloquear **todo** ese turno (pregunta/respuesta/citas), con placeholder
genérico; no reconstruir una respuesta filtrando texto después de cargarlo.
Cambiar una fuente aún accesible marca la respuesta «Histórica, observada en…»
y conserva los valores anteriores; no la presenta como actual ni la reaplica.
Sólo nueva consulta captura lo nuevo. No consultar datos privados para explicar
qué cambió si ya no se tiene permiso. Sin metadatos ACL válidos, denegar.

Guardar un turno lleva `version` de conversación y UUID `clavePeticion`.
Bloqueo de cabecera + CAS: una pestaña gana, la otra 409 con pregunta intacta.
Misma clave y hash de entrada/ámbito devuelve el mismo turno tras ACL actual;
otra carga con esa clave da 409. Reintento no recaptura ni duplica numeración.
Turno/contenido/avance de versión se insertan juntos; ningún estado medio.
Fallos internos no se guardan como respuestas correctas. Borrar sólo requiere
identidad propietaria y CAS, sin leer contenido bloqueado ni borrar originales.

Retención visible: elegir 7/30/90 días, defecto30 desde creación. Cambiarla usa
CAS y calcula desde creación (no desde la última pregunta), nunca revive lo
purgado. API bloquea vencidas antes del contenido; limpieza por lotes elimina
sólo conversaciones vencidas y sus filas propias. Borrar manualmente hace lo
mismo. Cuotas técnicas: 20 conversaciones vigentes/persona, 100 turnos/cada una,
2000 caracteres/pregunta, 1000 hechos/256KiB UTF-8 por turno, 10MiB/persona;
transacción/bloqueo de propietario comprueba cuota tras purga. Sin truncado
silencioso: 413/429 pide reducir ámbito. Orden estable número/ID, página20.

## Persistencia aditiva propuesta; no ejecutada

Raíz integrará schema/migración/rollback; este documento no los modifica.
JSON estricto versionado en servidor valida ámbito, intenciones, fuentes,
requisitos y respuesta, además de estos límites y claves relacionales.

```sql
create table consultas_conversaciones (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  ambito jsonb not null check (jsonb_typeof(ambito)='object'),
  version integer not null default 0 check (version>=0),
  retencion_dias integer not null default 30 check (retencion_dias in (7,30,90)),
  creado_en timestamptz not null default now(),
  caduca_en timestamptz not null,
  unique(id,propietario_id),
  check(caduca_en=creado_en+retencion_dias*interval '1 day')
);
create table consultas_turnos (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null, propietario_id uuid not null,
  numero integer not null check(numero between 1 and 100),
  clave_peticion uuid not null, entrada_sha256 text not null,
  version_modelo integer not null default 1 check(version_modelo=1),
  intent text not null, motor text not null check(motor='local-1'),
  acl_fuentes jsonb not null check(jsonb_typeof(acl_fuentes)='object'),
  observado_en timestamptz not null, captura_sha256 text not null,
  creado_en timestamptz not null default now(),
  foreign key(conversacion_id,propietario_id)
    references consultas_conversaciones(id,propietario_id) on delete cascade,
  unique(conversacion_id,numero), unique(propietario_id,clave_peticion),
  check(entrada_sha256~'^[a-f0-9]{64}$' and captura_sha256~'^[a-f0-9]{64}$')
);
create table consultas_contenidos (
  turno_id uuid primary key references consultas_turnos(id) on delete cascade,
  pregunta text not null check(char_length(pregunta) between 1 and 2000),
  respuesta jsonb not null check(jsonb_typeof(respuesta)='object'),
  check(octet_length(pregunta)+octet_length(respuesta::text)<=262144)
);
create index consultas_propias on consultas_conversaciones(propietario_id,creado_en,id);
create index consultas_caducadas on consultas_conversaciones(caduca_en,id);
```

Añadir trigger append-only en turnos/contenidos (rechaza UPDATE, permite DELETE
de purga propia); cabecera sólo permite CAS/retención, nunca cambiar propietario,
ámbito o creación. Índice/constraint garantiza autoría sin confiar en el cliente.
Sin FK a fuentes que elimine consultas o permita recuperar sus bytes al borrarlas.

## Archivos futuros, API y flujo

Ejecutor09: `src/lib/consultas/{modelo,intenciones,autorizacion,fuentes,lectores,
repositorio,http}.ts`, pruebas propias, `src/components/consultas/` (incluido
adaptador de dictado), `src/app/cuenta/consultas/`, `src/app/api/consultas/`,
`scripts/rea09-fixture.mts`, `scripts/verificar-rea09.mts` y E2E/config rea09.
Raíz integra enlaces en cuenta/sala/obra, extracción pura compartida si procede,
schema/migración y puente03; no editar archivos de otros ejecutores sin acuerdo.

API Node privada/no-store: GET conversaciones/turnos paginados y contenido
autorizado; POST conversación con ámbito/retención; POST `[id]/turnos` con
pregunta/version/clavePeticion y selección explícita de fuente; PATCH retención
con version; DELETE propia con version. JSON estricto, cuerpo máximo16KiB
contado mientras se lee, UUID/cursor/enum validados antes de SQL. Mutaciones y
POST consulta exigen mismo origen; identidad siempre dentro de frontera segura.
400 entrada inválida; 401 sin identidad; 403 permiso/provisional/ficticio/origen;
404 ajena/inexistente; 409 CAS/fuente/clave cambiada; 413 límite; 429 cuota;
503 BD/migración/fuente no disponible/integridad. No 200 vacío ante fallos,
SQL/stack/URLs/credenciales en errores o preguntas/respuestas en logs.

Escritorio primero: elegir ámbito → ver capacidades → escribir/editar →
Consultar → comprobar hechos/ausencias y abrir fuente → recargar historial →
preparar informe03. Informe muestra definición, ámbito, período/zona, formatos
y audiencia propia; abre preview03, conserva su token10min y confirmación
existente para crear/ejecutar. Pedir informe nunca encola desde la consulta.

Dictado es entrada opcional es-ES: antes de habilitarlo demostrar API/motor y
paquete español instalados, ejecución on-device y ausencia de tráfico remoto
con documentación primaria vigente y prueba del navegador real. Detectar un
constructor/prefijo no demuestra eso. Si falta soporte/paquete o no puede probarse
modo local, estado «Dictado local no disponible» y teclado completo. No instalar
ni descargar paquetes silenciosamente. Sin alternativa remota ni activación
automática. Pulsar Iniciar explica procesamiento local y solicita permiso de
micro; Parar/Cancelar desmonta captura y libera recursos. Parciales separados;
final editable sin duplicados ni autoenvío; denegación/error conserva borrador.

Estado cliente ligado a identidad/ámbito/requestId: abortar al salir/cambiar,
ignorar respuestas tardías y conservar edición posterior a un envío. Un RSC
restringido elimina inmediatamente datos/citas/contexto ya no autorizados y
no los reintroduce desde caché, respuesta vieja o diálogo. Teclado/foco/estados
accesibles y MASTER; móvil sólo después del recorrido completo de escritorio.

## Gates Dado / Cuando / Entonces y pendientes

Fixture sintética nueva elegida por raíz; A/B reales, sala6×4×3, mesa2×1,
equipo X cantidad2, puerto `HDMI IN 1`, cable HD-1000 manual5m, BOM adicional
3ud, categoría/null y una sala legado sin medidas. E3 guardada y borrador
posterior, documentos E1/03/06 vigentes/caducados/revocados y marcas literales.

| Dado / Cuando | Entonces verificable y fuente esperada |
|---|---|
| Sala de fixture; «¿Qué medidas tiene?» | 6×4×3m y mesa2×1m, observadoEn y citas a campos/versión; spy: cero SQL de catálogo/compras/almacén/parámetros/05. |
| «¿Qué equipos hay?» / «¿Qué conecta HD-1000?» | X cantidad2; extremos y `HDMI IN 1` literales con citas a filas; 5m se llama longitud manual, no calculada ni compatible garantizada. |
| «¿Qué material necesita?» con permisos técnicos | Oráculo E1 de misma entrada: cantidades/unidades/detalles/avisos idénticos, incluida BOM3ud; no SQL de precios/stock/05 ni placeholders monetarios en HTML/RSC. |
| Legado sin medidas / categoría null / cero explícito | Sin dato/no calculable/Sin categoría/cero separados; ninguna obra, cantidad, medida o compatibilidad inventada. |
| A prefiere marca M; consulta catálogo y equipos | Catálogo filtra/explica M con versión02; equipos de otra marca siguen visibles. B conserva resultados propios; filtros antes de LIMIT20. |
| Pregunta desconocida, financiera o «sustituye X» | Abstención/capacidades; spy no lee fuentes privadas ni escribe operación/diseño. Texto malicioso queda escapado, sin URL remota ejecutada. |
| A consulta y recarga; B prueba sus IDs | A conserva pregunta/respuesta/citas/captura; B recibe404 antes de contenido. FK/ACL rechazan autor/propietario falsificados. |
| Permiso retirado/fuente redactada o revocada entre lecturas | Placeholder/403 antes de SELECT contenido, también pregunta/listado/RSC; no bytes/textos anteriores en respuesta tardía. |
| Fuente accesible cambia/revisión nueva | Historial marcado histórico, valores/citas originales; consulta nueva captura actual. Caducidad E1/03 bloquea turno sin copiar bytes. |
| Dos POST mismo CAS / reintento UUID | Un ganador y409; misma clave/carga devuelve mismo turno tras ACL, carga distinta409. Retención/purga/borrado no toca originales. |
| Petición de informe y preview03 cambiado | Sólo selección/enlace hasta confirmar03; token viejo409 y ningún runner duplicado. ACL de descarga03 sigue vigente. |
| Sin motor local/permiso denegado; con motor demostrado | Teclado funciona; no petición remota. En rama soportada iniciar/parar/es-ES/final editable sin duplicar ni consultar automáticamente. |
| Error BD, cuerpo excesivo, respuesta vieja o cambio de usuario | 503/413 seguro, borrador recuperable; ningún dato de identidad anterior reaparece. |

Pendientes antes de construir: raíz asigna nueva BD/artefactos `output/rea-integracion/rea09/`,
revisa proyecciones/ACL y extracción técnica compartida; ejecutor verifica API
de voz instalada y documentación primaria sin prometer compatibilidad. Entregar
oráculo de preguntas/SQL spies, gates Postgres/carreras/retención, desktop→móvil,
regresiones afectadas y build sin BD; revisión independiente antes de declarar
ST07/08/16/17/18 cubiertos. Este contrato por sí solo no acredita implementación.

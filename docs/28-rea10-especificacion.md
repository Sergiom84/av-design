# REA-10 · Documentos, requisitos y áreas revisados antes de aplicar

Estado: **contrato aprobado por raíz; parser local, SQL y puente E2 verificados aisladamente,
sin runtime de documentos/planes/UI ni aceptación ST12/ST14**.
15-10-2026; candidatos ST12/ST14 de cobertura18; contratos17, E2 (12/14) y09 (27).
Destino: AV_design, `codex/rea-integracion`, base `7ba7960` y WIP conservado.
No acredita una integración implementada ni una nueva aceptación de E2.

## Mejora útil y frontera comprobada

E2 ya importa CSV/XLSX a catálogo/BOM/ofertas con matching literal, selección,
hash, lote durable y reversión atribuible. Ya conserva imágenes/fichas PDF,
dimensiones parciales verificadas y snapshots técnicos de equipo/plantilla.
REA-01 amplió selección/alternativas. **No se reimplementan esas capacidades**.

Falta conservar documentación de una obra como fuente de requisitos, localizar
su página/fragmento, revisar áreas ambiguas y transformar una selección aprobada
en localizaciones/salas/material sin crear hechos durante la extracción.
También falta enlazar un fragmento técnico con la decisión humana que informa
una ficha, puerto o fila importada. Ese enlace aporta trazabilidad, no scraping.

Mínimo10: registrar fuente → extraer texto local o transcribir de forma declarada
→ revisar candidatos → elegir destino/diff → confirmar → ver IDs/lotes creados.
La obra debe existir: no se crea proyecto/sede durante una subida ni se duplica
la jerarquía. Documento puede conservarse sin aplicar nada. Una extracción
fallida nunca crea obra, localización, sala, artículo, oferta o necesidad.

«Conectores propios» son adaptadores **locales** de fuentes ya autorizadas y,
en el dominio AV, candidatos de puertos/conectores físicos del catálogo.
No significa integrar cuentas/proveedores externos. Sin HTTP saliente, fetch de
URL, credenciales, conectores SaaS, OCR remoto, LLM, embeddings ni autogeneración.
El adaptador OCR/modelo queda `no_configurado` y no invocable; conservar
transcripción manual/entrada estructurada funcional. No ejecutar instrucciones
del documento, adjuntos, enlaces, scripts, formularios ni texto con apariencia SQL.

## Lo que existe y lo que se debe extraer para reutilizarlo

| Evidencia actual | Contrato del puente10 |
|---|---|
| `importacion/parser.ts` admite sólo CSV/XLSX, 5MiB/500 filas; protege OOXML/fórmulas/macros/enlaces. | El PDF no entra en ese parser. Las filas aprobadas se serializan como CSV UTF-8 derivado y pasan por los mismos validadores E2. Original PDF se conserva una sola vez. |
| `importacion/servicio.ts::confirmarImportacion/revertirLote` abren `sql.begin`; registran antes/después y revisiones. | Raíz extrae núcleos internos que reciban transacción existente, conservando wrappers/API. No anidar begin ni hacer commits independientes para cada sala. |
| `articulosParaRevision` lee coste incluso para BOM/catálogo. | Puente técnico usa proyección sin dinero, compartiendo matching/validación. No leer costes para eliminarlos luego; precios sólo en destino oferta autorizado. |
| `crearSala/crearLocalizacion` son acciones con revalidación/redirección, no servicios transaccionales puros. | Extraer validación/alta mínima con conexión inyectada; conservar bloqueo de obra/cierre, sede heredada y guardas. No llamar acciones desde el coordinador de importación. |
| E2 técnico verifica marca/modelo/URL HTTPS/fecha y congela dimensiones; puertos tienen nombre literal/fuente app y UNIQUE(articulo_id,nombre). | Reusar escritores/validadores mediante puente revisable, sin otro catálogo de fichas/puertos. No derivar compatibilidad de un conector. |
| `importacion_cambios` sólo admite artículos/precios/BOM/proveedores; técnico/puertos no tienen revisión E2. | No ampliar esa tabla de forma improvisada. Reversión E2 se reutiliza para sus lotes; altas nuevas de jerarquía tienen auditoría mínima propia y conservan cualquier dependencia posterior. |
| `RegistroFuentesConsulta` de27 es contrato, no código entregado. | Registrar fuente10 cuando ambos existan; no declarar consulta09 operativa por escribir un adaptador. |

## Fuentes y procedencia exacta

Un documento10 pertenece a una obra existente y tiene autor real, nombre seguro,
fecha de incorporación de servidor, procedencia declarada, tipo y SHA-256.
Documento nuevo admite PDF y TXT UTF-8; no DOCX, ZIP genérico, correo ni URL
como entrada. CSV/XLSX sigue en E2, sin cambiar su contrato para llamarlo licitación.
URL opcional es metadato HTTPS sin credenciales, nunca se visita automáticamente.
Fecha de la fuente puede ser desconocida; no confundirla con incorporación.

Adaptadores cerrados:

1. `archivo_obra`: bytes nuevos PDF/TXT en Postgres, autor/obra/hash propios.
2. `ficha_e2`: referencia a archivo técnico existente por artículoId/archivoId/
   hash/fecha verificada; permiso catálogo vigente y modelo exacto. No otro bytea.
3. `lote_e2`: referencia a original de lote **propio**, con destino y ACL actuales;
   sirve como fuente registrada y enlace a su revisión, no para reimportarlo solo.

Una referencia no conserva derechos si el origen cambia/se retira. Releer ACL,
hash y existencia antes de extracción, consulta, preview, confirmación y descarga.
Cambio de bytes bajo el mismo ID invalida el plan; otra versión es otra fuente.
No deduplicar entre personas/obras mediante una API que revele hashes ajenos.
Mismo archivo en la misma obra puede reutilizarse explícitamente, nunca aplicarse
dos veces por reconocer su hash. Referencias técnicas/E2 no copian sus originales.

Extracto inmutable por intento correcto: parser/nombre/versión, formatoModelo1,
hash original, hash de texto, fecha y páginas/fragmentos. Página empieza en1;
TXT usa línea y desplazamiento, nunca una página inventada. Ancla = documentoId,
extraccionId, página/línea, inicio/fin UTF-16 dentro del texto conservado y hash
del fragmento exacto. Se conserva texto original de extracción; correcciones
humanas viven en valor propuesto separado, con autor/fecha/motivo.

## Parseo local aislado y extracción honesta

PDF: firma/estructura no bastan para extraer texto. E2 valida ficha PDF pero no
tiene parser de lectura declarado en package.json. Decisión técnica propuesta:
parser local de texto como dependencia directa verificada por raíz (candidato
`pdfjs-dist`, sin versión/API supuesta). Antes de implementar se leen su versión
instalada/documentación primaria y guías Next locales; no usar un paquete
transitivo interno de Next ni asumir Poppler disponible en Render.

Proceso hijo/worker con interfaz de bytes, sin rutas/URLs del documento, sin
network/font fetch y con terminación verificable; ningún parseo pesado en el
hilo del handler. No rendering/OCR ni carga de recursos externos. Runtime y
despliegue deben demostrar ese aislamiento; un timeout de Promise no mata un
parser bloqueado. Sin parser local disponible, estado `extractor_no_disponible`,
fuente consultable autorizada y revisión manual, sin fingir extracción PDF.

Límites centralizados: original1..5MiB; cuerpo multipart5MiB+64KiB contado al
leer; máximo100 páginas, 1MiB UTF-8 de texto total, 20.000 caracteres/página,
500 candidatos, 2.000 caracteres/fragmento, 15s/256MiB por parseo y un parseo
simultáneo por persona. Rechazar cifrado/contraseña, dañado, adjuntos/acciones
activas no desactivables y recursos fuera de límites; no guardar resultado parcial
como completo. TXT requiere UTF-8 estricto sin NUL; extensión/MIME/firma coherentes.
Archivo original se conserva íntegro o se rechaza, nunca se reescribe para validar.

PDF con texto devuelve fragmentos; escaneado sin texto devuelve `sin_texto`.
No afirma «OCR completado», modelo exacto ni porcentaje de certeza. PDF mixto
marca páginas sin texto y no dice que ha revisado todo. Fallo conocido/timeout
se distingue de fuente sin requisitos. Temporal aleatorio con modo privado si
el parser lo necesita; nunca almacenamiento durable en disco y limpieza en
success/error/kill/reinicio. Logs sólo IDs/códigos/tamaño, sin texto o bytes.

Detección determinista v1: encabezados/campos explícitos del formato documentado
(`Sala:`, `Localización:`, `Modelo:`, `Cantidad:`, `Unidad:`) y selección manual
de fragmentos. Prosa libre sólo genera hipótesis, nunca un plan aceptado.
Certeza describe método: `literal_estructurado`, `hipotesis` o `transcripcion_manual`;
no es probabilidad calibrada. Todos los métodos requieren revisión humana.
Escaneo permite transcribir citando página verificada; el texto queda marcado
manual/no cotejado automáticamente. No crear anclas que prometan texto del parser.

## Revisión por campo y destinos

Cada candidato tiene ID estable de extracción, clase, fragmento y valor original,
propuesta editada, ausencia/ambigüedad, decisión `pendiente|excluir|confirmar`,
autor y versión CAS. Selección inicialmente vacía, sin aceptar todos por confianza.
«Seleccionar válidos» sólo actúa sobre candidatos ya revisados por persona.
Fragmento confirma procedencia, no que el requisito sea una medición de obra.

Áreas: elegir crear sala o vincular sala existente de la obra; localización por
ID existente o nombre nuevo confirmado. «Sala» y «Área» no se unen por parecido.
La sede la pone la obra, localización edificio/planta y sala nombre/código;
no añadir edificio/nivel a salas. Homónimos/duplicados exigen decisión explícita.
No adoptar/mover una sala legado ni cambiar nombre/medidas existentes desde10.
Sala nueva nace sin plantilla/equipos/conexiones; datos ausentes quedan según
representación canónica actual y se muestran «sin medir», no una medida cero.
Medida literal debe tener ejes/unidad revisados y se etiqueta «según documento»;
no se deduce escala, aforo, mesa, cable o dimensión a partir de una imagen.

Material: elegir sala y referencia exacta activa/unidad/cantidad por fila.
Matching y alternativas son E2/REA01, nunca fuzzy ni sustitución automática.
BOM es **adicional**: preview advierte/exige revisar lo que ya aporta el diseño;
no crear equipos, puertos, conexiones, stock, reserva, pedido ni cable calculado.
Cantidad ausente/null no es1 ni0. Unidad ausente se pregunta; ud enteras y m
con precisión E2. Dos candidatos del mismo artículo/sala no se suman a escondidas:
consolidación explícita revisada conserva las dos anclas o se elige una línea.

Catálogo/ofertas: preparar archivo derivado y selección para destino E2 separado;
sin alta implícita para resolver una BOM. Precios no salen de texto ambiguo:
proveedor/presupuesto/fecha/moneda/unidad/paquete/clasificación deben revisarse.
Se conservan cero/kit/no vinculante pendientes de E2, sin resolverlos aquí.
Precio, salario o tarifa laboral no se confunden; REA-05 queda fuera.

Dimensiones/puertos: fragmento de un **modelo exacto**, incluida variante, abre
el formulario existente con prefill revisable, sin enviar/guardar al abrir.
Dimensiones parciales/unidad/RU usan validadores E2; si falta URL HTTPS real/
fecha/modelo exigidos por E2, no se inventan: queda requisito pendiente.
Puertos conservan `HDMI IN 1`, sentido/señal elegidos y conector literal;
`total` entero positivo explícito, sin convertir una foto en número de bocas.
No crear señal/tipo enum nuevos desde un texto, ni traducir serigrafía.
Mínimo10 no modifica ni elimina puertos existentes/usados; candidato duplicado
abre el existente para revisión manual, no lo pisa. La edición técnica sigue
siendo una acción de catálogo explícita, distinta del plan áreas/BOM.

Puente de procedencia de esos formularios: al guardar, escritor existente y
referencia de candidato/campos/hash resultante se confirman en la misma
transacción con ACL de fuente actual. Requiere base/hash del registro previo
y revisión monotónica en técnico/puertos (trigger común incluso en escritura
manual) para detectar ABA; raíz integra esa pequeña ampliación transversal.
No nueva tabla de dimensiones/puertos ni copiarlos a las salas ya existentes.
Deshacer ficha/puerto es revisión manual actual, no «revertir E2» ficticio;
retirar un documento tampoco deshace una edición de catálogo ya confirmada.

## ACL antes de contenido y antes de SQL de destino

Identidad real/activa/no provisional en cada petición; usuario/autor viene de
sesión, nunca de JSON. No modificar roles para cerrar gates. Hoy no existe ACL
por pertenencia a obra: usar secciones actuales y descriptor de ámbito exacto,
con punto único para una futura ACL, sin inventar un equipo de proyecto.

Documento nuevo de licitación puede contener importes: su contenido íntegro,
texto/fragmentos requieren proyectos:ver + salas:ver + compras:ver. Subir/editar/
retirar exige además proyectos:editar. Es un mínimo conservador explícito;
no conceder contenido por una etiqueta «técnico» elegida por el cliente ni
redactar dinero con una expresión regular. Ficha E2 conserva catalogo:ver y
su modelo; lote E2 exige propietario y todos permisos actuales de su destino.
Para registrar referencias en obra se añaden proyectos:ver + salas:ver.

Aplicar áreas/localizaciones: proyectos:editar + salas:editar. BOM añade
catalogo:ver; catálogo/técnico/puertos, catalogo:editar. Ofertas exige además
compras:editar + parametros:ver; lectores amplios se autorizan por todas las
fuentes que realmente leen. Ninguna pregunta técnica consulta costes por
comodidad. Preview y confirmación verifican permisos del conjunto completo
antes de su primer SQL; una fila no autorizada rechaza el plan entero.

Cabeceras/ACL/tipo de fuente separados de bytes/textos/planes. Listar comprueba
ACL antes de nombres/fragmentos; fuente ajena404, permiso retirado403 genérico.
Descarga autoriza primero y comprueba hash/longitud antes de bytea; MIME seguro,
attachment/no-store/nosniff. No URL pública, ruta libre ni SVG/HTML embebido.
Retirada de permiso durante parseo/preview impide persistir/publicar contenido.

## Plan, confirmación y reversión

Plan `versionModelo:1` con fuente/extracción/hash inmutables, versión CAS y
**un destino por plan**: `areas_bom`, `catalogo`, `ofertas` o edición técnica
individual. Cambiar destino exige otro preview; no prometer una confirmación
global de categorías que luego haga varios commits independientes.
Preview no escribe negocio y muestra altas/vínculos/omisiones/conflictos,
valores anteriores/propuestos, necesidad adicional, anclas y permisos requeridos.
Token firmado de10min ligado a autor/obra/plan/version/fuentes/decisiones,
hash canónico y revisiones de entidades/artículos/parámetros consultados.

Confirmación lleva token + version + UUID clavePeticion; servidor no acepta
filas/datos E2 arbitrarios como si fueran extracción propia. Recalcula diff,
relee ACL/fuentes, obra abierta, pertenencia de salas y revisiones bajo bloqueo.
Conflicto409 conserva revisión local. Orden de locks coordinado con las acciones
físicas: salas existentes por UUID → proyectos por UUID → documento/plan →
artículos → filas hijas. Nunca tomar una sala existente después de bloquear obra.
Se descubre el conjunto antes, se bloquea en ese orden y se relee tras esperar;
si cambió, rollback y reintento acotado desde el principio, sin ampliar cerrojos
poseyendo la obra. Las salas nuevas sólo se insertan bajo el bloqueo de su obra;
el cierre vigente vuelve a comprobarse dentro de la misma transacción.
Raíz conserva wrappers públicos E2 y extrae núcleo con conexión inyectada para
crear jerarquía mínima y todos los lotes BOM del plan en **una transacción**.
Cualquier fallo lanza; no devolver error resuelto dentro de begin.

Cada CSV derivado tiene hash/nombre propios, mapa fila→candidato/anclas y
origen documento/hash/extracción/plan. E2 conserva ese CSV como su fuente;
el PDF original no se duplica en cada lote. Registro de aplicación guarda IDs
de salas/localizaciones nuevas, vínculos a lotes y decisiones/resultados.
Misma clave/hash devuelve la misma aplicación tras ACL actual; carga distinta409.
Dos confirmaciones de la misma versión producen una aplicación, sin duplicar
salas/material; respuesta tardía no cambia la selección de otro documento.
Plan aplicado queda congelado, no se vuelve a editar/aplicar con otra versión.
Bajo lock de documento se comprueba candidato+destino ya aplicado en cualquier
plan: no volver a añadir esa necesidad. Para otra demanda se crea un candidato
manual nuevo con motivo explícito, nunca se desbloquea el anterior por reintento.

Revertir aplicación usa primero reversión E2 de sus lotes con sus comprobaciones
de revisión/ABA/dependencias/compromisos. Conserva modificaciones posteriores y
registra resultado parcial. Sólo retira salas/localizaciones **creadas** por ese
plan, todavía idénticas y sin dependencias; nunca vínculos a entidades previas.
No borrar por cascada diseño, revisiones, propuestas, reservas, movimientos,
pedidos/carga/horas/servicio. Cierre de obra o dependencia bloquea lo afectado,
sin reabrirla. Auditoría/source/hash e informe sobreviven a la reversión.

## Retirar, borrar y enlazar con09

Retirar fuente corta inmediatamente nuevas lecturas/descargas/planes y consultas09;
fuentes ya usadas se muestran retiradas mediante IDs/hash, sin recuperar texto.
No borra los hechos confirmados de negocio ni significa revertir sus lotes.
Purgar un archivo propio10 elimina bytea, texto extraído, fragmentos y borradores
que lo copien; conserva tombstone mínimo (autor/ámbito/hash/fecha/estado/IDs de
aplicación), sin snippets/títulos privados. Eliminar referencia E2 no elimina ni
revoca el origen E2; cambiar/retirar ese origen sí bloquea la referencia10.
PDF no se duplica para eludir esa retirada. Operación CAS con motivo y diff de
contenido que se retirará; sin borrado físico silencioso por caducidad de preview.

Registro09 añade `documento_requisitos` con autorizarMetadatos/proyectar/
comprobarVigencia. Sólo hechos/fragmentos seleccionados y autorizados, citas
página/línea/hash/método y versión; nunca el documento entero por defecto.
ACL actual de10 y del origen referenciado antes de cargar texto/historial09.
Retirada/purga bloquea turno completo09; fuente cambiada pero accesible lo marca
histórico. No reconstruir el texto a partir de un plan antiguo o RSC tardío.
Datos confirmados de sala/BOM mantienen su ACL de dominio y su procedencia;
no se presentan como acceso al documento retirado. E2 conserva sus lotes reales.

## Persistencia aditiva aprobada; integración de raíz

DDL canónica en `db/migraciones/2026-10-rea10-requisitos.sql`, incluida literal en
`db/schema.sql`; rollback homónimo sólo admite base/usuario sintéticos5563 y
ninguna historia10. Aplicada únicamente a nueva5563:98→104tablas. Ninguna base
anterior migrada. No equivale a runtime/ACL/aplicación de negocio verificados.

- `requisitos_documentos`: identidad/autor/obra/tipo/referencia/hash inmutables,
  CAS y retirada/purga; tombstone no borrable ni reactivación implícita.
- `requisitos_contenidos`: metadata privada y bytes sólo en archivo propio;
  referencias sin bytea, SHA exacto,5MiB; contenido se retira sólo en purga.
- `requisitos_extracciones`: modelo/método/parser/version/fuenteSHA/textoSHA/
  resultado inmutable; purga sólo vacía resultado, conserva hashes/procedencia.
- `requisitos_planes`: identidad/autor/extracción/destino fijos, CAS y decisiones
  acotadas; aplicado no se reedita. Purga retira todas sus decisiones copiadas.
- `requisitos_aplicaciones`: un plan/una clave por autor, versión/hash/resultado
  inmutables. Resultado contiene IDs/hashes/decisiones de negocio, **ningún
  fragmento o texto privado de documento**; no usarlo para reconstruir fuente.
- `requisitos_reversiones`: cada intento durable inmutable, número/antecedente/
  clave/hash e informe propio. Se añade esta sexta tabla en lugar de sobrescribir
  una columna reversion: conserva también la primera reversión parcial.

Triggers diferidos verifican que plan aplicado y aplicación sean atómicos y que
una purga retire bytes/metadata/resultado/decisiones en la misma transacción.
CHECKs de forma/tamaño/hash no sustituyen Zod estricto del runtime.

Cuatro tablas existentes añaden `revision_fuente` monotónica desde secuencia
común: `articulos_tecnicos`, `articulos_archivos_tecnicos`, `puertos`,
`localizaciones`. Trigger común en INSERT/UPDATE cubre escritura manual y ABA
incluso borrado/reinserción. Ningún cambio de medidas/puertos se aplica a salas
o plantillas por esto. Los gaps de secuencia tras rollback son esperados.
`salas.diseno_version` y `articulos.revision` existentes cubren sus otros cambios;
no inventar contador de permisos. Mapear campo→candidato/revisión/hash en
aplicación; writer y vínculo se confirman dentro de su misma transacción.

Gate propio `output/rea-integracion/rea10/preparacion/esquema.mts` pasa:
98→104→rollback98 idénticas→reaplicación idempotente, historial/CAS/purga parcial
rechazada/purga completa/tombstone y ABA de fuente. Todas las filas adversarias
están en transacción revertida; sólo5usuarios QA añadidos antes del baseline.
La comparación de negocio normaliza sólo las4columnas nuevas de revisión;
no oculta otros cambios. El runtime sigue pendiente del ejecutor y su revisión.

## Propiedad, API y verificación

Ejecutor10: `src/lib/requisitos/{modelo,fuentes,extraccion,revision,planes,
repositorio,http}.ts`, proceso parser propio, `src/components/requisitos/`,
`src/app/proyectos/[id]/requisitos/`, `src/app/api/requisitos/`, tests/fixture/
gates/e2e rea10. Raíz integra SQL/migración/rollback, enlace09, escritores
compartidos E2/técnicos/jerarquía y enlaces de cuenta/obra; acordar antes de editar.
GET metadatos/detalle/archivo por UUID; POST registrar/extraer/preview/confirmar;
PATCH decisiones/retirar y POST revertir, todos con autorización propia.
JSON32KiB salvo upload acotado; no Content-Length como única guarda.
Errores400 entrada,401 sesión,403 permiso/origen,404 ajeno,409 CAS/fuente/cierre,
413 límites,422 PDF/formato sin extracción soportada,429 cuota,503 runtime/BD/
integridad. Escaneo `sin_texto` es estado explícito, no excepción ni éxito OCR.
Cuotas iniciales por obra100 documentos/100MiB de bytes, por persona20 planes
abiertos; bloqueo de cuota/obra evita carreras. Sin truncar ni purgar vigentes.

13 gates falsables en **nueva BD sintética** y artefactos `output/rea-integracion/rea10/`:

1. Dado PDF textual con `Sala: Alfa`, `Sala: Beta` y «área común por definir»,
   extraer muestra2 literales +1 hipótesis con página/fragmento exactos; cero
   filas nuevas en proyectos/localizaciones/salas/BOM hasta confirmación.
2. Dado PDF escaneado, mixto, cifrado y corrupto, observar respectivamente
   sin_texto, páginas sin texto señaladas, rechazo y rechazo; manual queda
   etiquetado, nunca OCR. Parser ausente muestra estado honesto/teclado útil.
3. Dado5MiB exactos y +1byte,100/101páginas, TXT inválido, recurso activo y
   parser bloqueado, comprobar admisión/rechazo por cada límite y kill real;
   sin red, archivos temporales restantes ni promesas ejecutándose después.
4. Dada fuente nueva y fichaE2 referenciada, guardar/descargar conserva SHA y
   bytes originales; referencia no crea copia. ID/hash alterado devuelve409/503.
5. Dadas Alfa/Beta homónimas y localización ambigua, elegir IDs/crear sólo
   Alfa rechaza implícitos; sede heredada, ninguna sala adopta/mueve legado.
6. Dadas medidas «1200 mm» de equipo y ausencia de alto/cantidad/unidad, sólo
   dimensión revisada parcial; nunca sala1200m, alto0 o cantidad1. E2 bloquea
   técnica sin URL/fecha reales; snapshots previos permanecen idénticos.
7. Dadas QB65R y QB65R-B y BOM3ud, matching no los une; elegir una referencia
   y cantidad3 crea sólo BOM adicional3ud mediante E2, sin equipo/conexión/stock.
8. Dado `HDMI IN 1`, total2, sentido/señal elegidos, preview no escribe; guardar
   explícito crea fuenteapp y procedencia. Duplicado abre existente; ningún
   puerto usado se renombra/borra ni se afirma compatibilidad automáticamente.
9. Dadas ofertas sin moneda/fecha, cero/kit/no vinculante y una válida10EUR,
   sólo selección E2 válida crea oferta nueva; anteriores/pedidos intactos;
   sin compras/parametros, spy demuestra cero SQL monetario y respuesta403.
10. Dados A/B, permiso retirado durante parseo/preview y origen HTTP ajeno,
    B no lee lote privado de A; no bytea/texto/fragmento antes de ACL ni RSC
    tardío; retirada corta publicación y origen ajeno403 sin escrituras.
11. Dados token viejo, dos CAS simultáneos y UUID repetido, resultado409/un
    ganador/misma aplicación; otra carga misma clave409. Fuente cambiada o
    obra cerrada después de preview no crea ni una sala/línea parcial.
12. Dado fallo tras crear Alfa y primera BOM, transacción revierte todas las
    altas/lotes de ese plan; reversión posterior con edición ABA, reserva y
    sala usada conserva dependencias y explica parcial sin tocar otra obra.
13. Dada fuente retirada/purgada ya consultada09, detalle/descarga/historial09
    no recuperan texto por extracción/plan/caché; tombstone conserva hashes
    y hechos E2 siguen registrados. Escritorio completa todo el flujo antes
    de móvil, con edición local conservada en errores/tardanzas.

## Decisiones técnicas y pendientes sin consulta al usuario

Raíz puede elegir parser local directo/versionado y aprobar extracción mínima
compartida, cuotas y aislamiento runtime; no necesita proveedor externo.
Tradeoff: obra existente evita altas incompletas; texto local+revisión no promete
entender prosa/planos; compras:ver sobre documento de licitación evita una
redacción financiera insegura; puente técnico individual evita otro importador
universal. Si no puede demostrar parser o transacción compartida, registrar
dependencia pendiente y conservar registro/manual, sin declarar ST12/ST14 cerrados.
Antes de construir: asignar fixture/puertos propios, acordar ownership de los
extractos compartidos y revisar este contrato. Cierre exige13 gates, regresiones
E2/E1/E3 pertinentes, tipos/lint/build sin BD, documentos reabiertos y revisión
independiente; clasificación o pruebas del parser aislado no equivalen a entrega.


## Preparación comprobada de raíz · continuación 15-10-2026

- Parser directo `pdfjs-dist@6.4.299`, Node local24.14.1 compatible con engines
  >=22.13.0 o >=24. Metadata/versiones en
  `output/rea-integracion/rea10/preparacion/parser-dependencia.json`; ningún
  paquete previo cambió de versión. Docs primarias de Mozilla inspeccionadas.
- `src/lib/requisitos/parser.ts` y `parser-worker.mjs`: proceso por PDF, bytes por
  IPC, sin secretos/env heredado, permiso de lectura sólo a worker/módulos, sin
  escritura/child/worker adicionales, eval desactivado y adaptadores de red/
  fuentes deshabilitados. V8 heap128MiB y monitor RSS256MiB cada50ms (no es una
  reserva de memoria ni un límite de RSS instantáneo del sistema operativo).
  Deadline15s mata SIGKILL y espera close. Límites100páginas/20kcaracteres por
  página/1MiBtexto/5MiBfuente; sin temporales de documento. TXT UTF8 fatal/NUL.
- Seis pruebas propias pasan en proceso real: textual, vacío/mixto, cifrado/
  adjunto/JavaScript/corrupto,101páginas/texto excesivo, kill real por timeout y
  validación de bytes/UTF8. Tipos/lint del ámbito0. Esto **no** demuestra todavía
  cuota global/persona, caída/reinicio del servidor, todos los límites exactos,
  aislamiento de red observado ni distribución en build/Render; los gate13
  de runtime y la revisión independiente los deben cerrar.
- `confirmarImportacionEnTransaccion` y `revertirLoteEnTransaccion` extraídos
  conservando wrappers públicos E2. Lectores técnicos de catálogo/BOM ya no
  seleccionan coste. `jerarquia-transaccional.ts` ofrece alta mínima explícita
  bajo lock de obra abierta, sede heredada y ausencia canónica sin medir. Su
  integración con acciones manuales está pendiente antes del runtime10.
- Gate real5553 `scripts/verificar-rea10-puente-e2.mts`: segunda BOM fallida
  revierte primera BOM, los dos lotes y localización/sala nuevas en una sola
  transacción; reversión E2 también comparte tx.47tablas idénticas antes/después,
 5consultas técnicas sin dinero.29puras y regresiones10+7 pasan, sin debilitar
  aserciones ni tocar evidencia anterior. Carpetas `rea10/puente-e2` y
  `reanudacion-20261015/regresiones-e2-puente10`.
- Nueva base sintética5563 `av_design_rea10_prueba`, usuario`av_design_rea10`,
  guard` scripts/rea10-fixture.mts`. Sólo schema previo98tablas/fixture sintética;
  DDL10 posteriormente aplicada sólo en esa base:104tablas finales. Ninguna
  base anterior migrada. Sin UI/servicio10 ni
  integración09. Columnas de revisión ya preparadas; faltan escritores/procedencia y adaptación09.

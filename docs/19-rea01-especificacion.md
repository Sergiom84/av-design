# REA-01 · Especificación ejecutable

15-10-2026. Alcance autorizado: ST02, ST06, ST11 y ST13 de
[18-rea-cobertura.md](/Users/sergio/Desktop/Aplicaciones/AV_design/docs/18-rea-cobertura.md).
Este documento define la implementación siguiente; no declara sus criterios
ejecutados. Se conserva E1 reconciliada, E2 y E3 completas en el checkout único
AV_design, rama `codex/rea-integracion`, con los cambios locales existentes.
No se modifica la fórmula de cable, no se introduce otra BOM, otro dibujo ni
otro sistema de importación. No se necesita IA ni una dependencia nueva.

## Resultado que debe recibir el técnico

- Puede introducir largo, ancho y alto en metros o pies en las superficies
  existentes de sala y plantilla, ve la conversión y la precisión que se
  guardará y recupera siempre los metros normalizados.
- Antes de aplicar una plantilla ve su croquis, distribución y referencias,
  incluidas ausencias y posiciones estimadas, sin crear una sala temporal.
- Puede seleccionar de una vez las coincidencias inequívocas de un archivo y
  desmarcarlas; los casos que exigen juicio permanecen para revisión individual.
- Puede sustituir explícitamente una referencia de una BOM, incluso cuando el
  archivo ya tenía una coincidencia exacta. Conserva original, alternativa,
  cantidad, unidad, tipo, motivo, autor y evidencia de lo confirmado.

El preview es lectura. La confirmación sigue siendo una acción explícita con
permisos y concurrencia comprobados en servidor. Ninguna de estas operaciones
marca recepción, instalación, entrega o carga ni mueve existencias.

## Base comprobada y piezas que se reutilizan

| Evidencia actual | Consecuencia para la implementación |
|---|---|
| `src/components/sala/medidas.tsx`, `sala/alta.tsx`, `plantilla/medidas.tsx` e `inspector-sala.tsx` reciben dimensiones en m. `salas` y `plantillas_sala` usan `numeric(6,2)`. | Un normalizador puro y un control compartido de dimensiones; almacenamiento y cálculo siguen en metros. |
| `construirEscena(EntradaCroquis)` está en `src/lib/croquis.ts`; `PlanoSala` ya pinta `GeometriaPlano`. El editor usa esa misma escena. | La plantilla se adapta a `EntradaCroquis`; se reutilizan escena y pintor, sin SVG alternativo. |
| `PlantillaElegible` sólo trae medidas y recuentos. `listarPlantillas()` no carga toda la geometría, muebles, puertas, rutas y giros para un preview fiel. | Crear lectura detallada de una sola plantilla; no ampliar las veinte sugerencias con el grafo completo ni mandar el catálogo al navegador. |
| `GET /api/plantillas` sólo comprueba sesión; no comprueba cambio obligatorio de clave ni permiso de sección. Los Route Handlers no heredan layouts. | Corregir la guarda del listado y aplicarla al detalle nuevo. |
| `/salas/nueva` lee `listarPlantillas()` sin consultar permiso de plantillas; `aplicarPlantillaAlDiagrama` sólo exige edición de salas. | Cerrar también las vías de lectura y aplicación fuera del layout de plantillas; esconder un botón no resuelve el permiso. |
| E2 tiene `SeleccionFila`, preview/hash, lotes, archivo/hash, informe JSONB, transacción y reversión. | Ampliar esos contratos. La trazabilidad cabe en `filas` e `informe` existentes; no hacen falta otra tabla ni otro lote. |
| `BuscadorArticulo` devuelve `id`, etiqueta, categoría y unidad; no devuelve tipo, revisión o prueba de que el artículo siga activo. | La revisión del servidor relee la alternativa y devuelve metadatos canónicos; no se amplía el catálogo global para confiar en el cliente. |
| `confirmarImportacion` bloquea sala antes de artículos y valida candidatos exactos; hoy permite resolución sin revisión obligatoria cuando no hay candidatos. | La alternativa pasa por revisión final obligatoria con activo/tipo/unidad/revisión y hash de decisiones. |
| E3 versiona `sala_material_bom` mediante los triggers de diseño y protege revisiones/restauraciones. | Insertar o revertir una partida continúa por las tablas actuales; no saltarse triggers ni reescribir snapshots. |

Antes de escribir código se leen las guías instaladas de Next.js. Para esta
especificación se consultaron `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
y `node_modules/next/dist/docs/01-app/02-guides/forms.md`: handlers sin acceso
heredado del layout, params asíncronos, validación y autorización dentro de las
Server Actions. No se aplica un patrón de otra versión de Next.js.

## Partición y propiedad de archivos

Dos ejecutores pueden trabajar en paralelo después de recibir esta
especificación. No se comparten escrituras de archivo.

| Propietario | Archivos o ámbito exclusivo |
|---|---|
| A · dimensiones y plantilla | Nuevos `src/lib/longitudes.ts`, `src/lib/plantilla-preview.ts`, `src/lib/datos-plantillas.ts`, `src/lib/plantillas-http.ts`; controles en `src/components/medidas/` y `src/components/plantilla/`; modificación de `sala/alta.tsx`, `sala/medidas.tsx`, `plano-editor/inspector-sala.tsx`, `plano-editor/origen-diagrama.tsx`, `plantilla/medidas.tsx`, `plantilla/ficha.tsx`, `/salas/nueva/page.tsx`, `/api/plantillas/route.ts` y nuevo `/api/plantillas/[id]/route.ts`. |
| A · compartidos reservados | **`src/lib/datos.ts`, `src/app/acciones.ts` y `src/app/acciones-diagrama.ts` pertenecen a A durante REA-01.** Limitar el cambio a dimensiones, lectura/uso de plantillas y sus guardas/hash; preservar los cambios E3 existentes. A no toca E1. Si otro ejecutor necesita esos archivos, entrega una propuesta al arquitecto y espera integración secuencial. |
| B · revisión de BOM | Nuevos `src/lib/importacion/seleccion.ts` y componentes auxiliares bajo `src/components/importacion/`; modificación de `importacion/{modelo,revision,servicio,index}.ts`, `src/lib/importacion-http.ts`, `/api/importacion/route.ts`, `/api/importacion/confirmar/route.ts`, `src/components/importacion/importador.tsx`. B no toca `datos.ts`, `acciones*.ts`, `tipos.ts`, buscador global ni archivos de A. |
| A · pruebas propias | `longitudes.test.ts`, `plantilla-preview.test.ts`, pruebas de controles/preview/permiso de plantillas; scripts y E2E nuevos con sufijo `rea01-a`. Ajustes de fixtures antiguas de medidas/plantillas que necesite el cambio de su contrato, avisando al arquitecto. |
| B · pruebas propias | `importacion/seleccion.test.ts`, ampliaciones de `src/lib/importacion.test.ts` y pruebas de `importador`; scripts y E2E nuevos con sufijo `rea01-b`. Ajusta sus consumidores E2 del servicio y las pruebas de importación que cambien por el hash final. |
| Arquitecto · integración | Configuración compartida de gates, scripts globales, `package.json`, `db/schema.sql`, migraciones si una necesidad demostrada obliga a ellas, y documentación 17/18/19. Ningún ejecutor cambia esos archivos en paralelo. No se prevén cambios de schema o paquetes para el diseño descrito. |

`datos-plantillas.ts` contiene la consulta detallada nueva. A sólo toca
`datos.ts` si necesita completar un campo ya perteneciente a su lector actual;
no crea dos lecturas detalladas competidoras. B obtiene tipo/revisión desde
la revisión de E2, no desde `ArticuloElegible`. Los tipos específicos nuevos
se declaran en los módulos propietarios y no requieren editar `tipos.ts`.

## A · Dimensiones m/ft

### Modelo y normalización

Una entrada de longitud tiene texto y unidad explícita `m | ft`. El
normalizador puro produce ausencia o `{ metrosExactos, metrosPersistidos }`.
La equivalencia es `1 ft = 0,3048 m`; la precisión de estas dimensiones sigue
siendo el centímetro de `numeric(6,2)`. No se cambia la columna a pies ni se
guarda una preferencia de unidad como dato físico de la sala.

- `10 ft` presenta `3,048 m` y «Se guardará 3,05 m» antes de confirmar.
- Vacío se conserva como ausencia en el control. Al persistir se respeta el
  contrato actual: plantilla nula; dimensiones principales de sala sin medir
  usan su representación canónica actual y se vuelven a mostrar vacías, no
  como una medida positiva. No se cambia la semántica de `0` ni se inventa
  una coordenada confirmada.
- Admitir coma o punto decimal sin separadores de miles ambiguos; rechazar
  unidades desconocidas, negativos, no finitos y desbordamientos antes de SQL.
  Un valor positivo que se redondea a cero requiere corregir la entrada: no
  se degrada silenciosamente a «sin medir».
- El normalizador recibe el límite de la superficie actual. No amplía ni
  reduce por accidente los límites de `PatchPlano` o de las columnas SQL.
  El editor mantiene sus validadores de medidas; se prueba el borde de cada
  contrato en metros y su equivalente en pies.

La conversión de ida/vuelta del texto generado debe conservar también el máximo
SQL `9999.99 m`, sin tolerancias que acepten un desbordamiento real. Una entrada
visible inválida bloquea el guardado completo y sus atajos CtrlS/CmdS; no permite
guardar el último valor válido oculto detrás del texto inválido.

Cambiar el recinto no recoloca elementos medidos. El servidor valida el estado
final completo: filas persistidas superpuestas con altas, modificaciones y bajas
del patch. Se comprueba cada categoría aislada —equipo, mueble, roseta, mesa,
puerta y recorrido— para que el rechazo de una no oculte la omisión de otra.

Para los formularios de alta, Resumen y plantilla, fijar un único contrato de
entrada para las tres dimensiones: `unidad_dimensiones` y campos de texto
`entrada_largo`, `entrada_ancho`, `entrada_alto`. La acción transforma esas
entradas a `largo_m`, `ancho_m`, `alto_m` con el mismo normalizador y valida
antes de escribir. El navegador no manda un valor convertido que el servidor
tenga que creer sin comprobar su unidad. No se admite que un campo `_m`
contenga pies. Actualizar juntos los formularios y sus consumidores de prueba.

El inspector de Plano usa el mismo control y normalizador, pero su callback
publica metros canónicos al borrador y el `PatchPlano` sigue llevando metros
con su versión esperada. No se añade otra unidad al patch ni otra fórmula.
Las cotas, el resumen y la exportación continúan mostrando metros canónicos.

El alcance comprende las tres dimensiones de recinto en las **cuatro
superficies**: alta de sala, medidas de Resumen, medidas de plantilla e
inspector de Plano. Mesa, coordenadas, alturas auxiliares y rutas conservan
sus unidades actuales claramente rotuladas; el selector de recinto no las
reinterpreta. El control debe permitir reutilizar la conversión en esos campos
sin cambiar sus datos, pero no es un selector global que convierta todo el
formulario inadvertidamente.

### Estado del control y guardado

El texto en edición y la unidad son estado de presentación. Cambiar m/ft no
invoca `alCambiar`, no modifica el borrador canónico, no ensucia la sala ni
vuelve a redondear un valor ya normalizado. Si hay texto incompleto o inválido,
se muestra el error y no se guarda. El control conserva la entrada mientras
se escribe con coma y no utiliza una conversión redondeada de ida y vuelta
como fuente de verdad. La previsualización deja claro el valor que se enviará.

`guardarSala` conserva la transacción, el cierre de obra y el aumento de
versión en la misma escritura. El formulario de medidas transporta la versión
leída; una edición concurrente se comprueba **dentro del bloqueo de sala** y
devuelve conflicto visible conservando la entrada para comparar, no éxito
aparente. El inspector conserva la concurrencia existente de `guardarDiagramaSala`.
La operación no puede dejar equipos, puertas o puntos de paso medidos fuera
del recinto reducido: reutilizar las validaciones actuales de estado final,
no limitarse a comprobar los tres números nuevos.

`guardarMedidasPlantilla` normaliza en servidor y valida el identificador y
la geometría resultante. Para evitar sobrescribir la plantilla vista con una
edición posterior, el formulario transporta una huella de sus medidas/mesa
leídas y la compara bajo bloqueo antes de actualizar. No es necesario añadir
un sistema de versiones completo de plantillas. Los errores/conflictos se
muestran en el formulario; no se devuelve silenciosamente sin guardar.

## A · Vista previa gráfica de plantilla

### Lectura y proyección

`GET /api/plantillas` conserva sugerencias acotadas a veinte. El detalle nuevo
`GET /api/plantillas/[id]` recibe un UUID y devuelve sólo la plantilla elegida:
medidas/mesa/aforo, referencias y cantidades, estado de referencias, posiciones
y giros, muebles y roles, puertas, tiradas y puntos necesarios para dibujarlas,
avisos y `huellaPlantilla`. No devuelve costes, ofertas, datos de almacén,
usuarios ni referencias ajenas a la plantilla.

La lectura se realiza con `conLecturaConsistente` de sólo lectura. No llamar a
`crearSala`, no persistir un borrador, no asignar UUID físicos ni guardar
SVG/PNG/escena de lienzo en la base. El JSON es un DTO transitorio que se vuelve
a obtener desde los datos normalizados.

`plantilla-preview.ts` adapta ese DTO a `EntradaCroquis`. Las identidades
efímeras son deterministas y están acotadas al preview; no se presentan como
salas reales ni se admiten por las acciones de alta/edición. Usar
`construirEscena` y `PlanoSala`/`GeometriaPlano`, que ya comparten editor y
Resumen. No copiar las funciones que colocan equipos, sillas, símbolos,
rotaciones o cotas.

La proyección reproduce lo que se aplicaría:

- Por defecto sólo líneas que realmente se heredan. Las opcionales aparecen
  aparte identificadas como opcionales; no se cuentan en el montaje aplicado.
- Medidas y posiciones nulas siguen siendo ausencias. El dibujo estima donde
  ya lo hace el croquis y lo marca discontinuo; una coordenada confirmada a
  cero sigue confirmada. Sin largo/ancho no se pinta una planta a escala
  inventada; se ve la lista y el aviso.
- Mesa principal única y modos de sillas conforme a los roles existentes:
  tener sólo mesa auxiliar no apaga las sillas del aforo. Muebles, puertas y
  giros usan los mismos datos que la copia real.
- Referencia ausente/inactiva o de tipo incompatible aparece con aviso. El
  preview puede ayudar a detectar el problema, pero no convierte esa plantilla
  en aplicable ni borra silenciosamente la línea problemática.
- Se muestran tiradas y recorrido guardado cuando existan. No se inventan
  puertos, medidas de cable ni coordenadas para completar el dibujo. Si se
  muestran metros, salen del cálculo existente con sus datos y ausencias.

Integrar el mismo bloque de preview en la elección inicial de Plano,
el alta de sala y la ficha de plantilla abierta por `?abierta=<id>`. Se carga
el detalle al elegir/abrir una plantilla, no para las diecisiete a la vez.
Cambiar elección aborta/descarta la respuesta anterior; una respuesta tardía
no puede sustituir la plantilla seleccionada ni su huella.

### Permisos y errores

Política única para listado y detalle: sesión vigente, sin cambio obligatorio
de contraseña y `plantillas:ver`. La edición de salas no revoca una excepción
que haya ocultado plantillas. No cambiar roles por defecto para resolverlo.

| Petición | Resultado exigido |
|---|---|
| Sin sesión o usuario desactivado | 401; no ejecutar consulta de plantillas. |
| Cambio obligatorio de clave o `plantillas:oculto` | 403 en API; no revelar siquiera listado/recuentos. |
| UUID inválido | 400; plantilla inexistente válida: 404. |
| BD no configurada/indisponible | 503 comprensible; no convertir fallo en `[]` o «sin plantillas». |
| Lectura autorizada | JSON acotado, `Cache-Control: no-store`, sin costes y con datos de una lectura consistente. |

`/salas/nueva` consulta permisos antes de leer/serializar plantillas: si están
ocultas permite sala en blanco sin entregar sus datos ni obedecer
`?plantilla=<id>`. `OrigenDiagrama` no ofrece aplicar/preview si no se permite
leer plantillas. Las acciones `crearSala` cuando trae plantilla y
`aplicarPlantillaAlDiagrama` exigen `plantillas:ver` además de `salas:editar`;
sin plantilla el alta conserva sólo sus permisos actuales. Las guardas viven
en servidor, no sólo en el componente.

### Concurrencia de preview → aplicación

`huellaPlantilla` identifica las entradas efectivas del preview: medidas/mesa,
aforo, líneas/identidades/cantidades/posiciones/giros/opcionalidad, muebles y
roles, puertas, conexiones y puntos, y revisiones/estado de las referencias
relevantes. Ordenar por claves estables y serializar canónicamente; no usar
una fecha de render ni un nombre como versión.

La aplicación y el alta desde plantilla reciben la huella vista, releen y
comparan antes de insertar. Si cambió lo que se iba a copiar, devuelven
conflicto y obligan a revisar el preview nuevo. No copiar del DTO del cliente.
La transacción de copia mantiene un único snapshot de origen; usar lectura
consistente en la transacción que copia y los bloqueos necesarios de las
referencias, sin cargar un snapshot viejo en una lectura y nuevos muebles en
otra. Las referencias se comprueban activas y del tipo apropiado bajo el
orden de bloqueos ya establecido. Un conflicto de serialización se presenta
como conflicto, no como copia parcial ni reintento invisible con otra plantilla.

Se conserva el cerrojo de sala, versión esperada, obra cerrada, origen ya
decidido, sala vacía —incluidas rosetas y puertas—, mesa principal única,
validación de coordenadas/recorridos contra las medidas finales y rollback
por excepción tras escribir. Ver un preview no constituye permiso de aplicar.

La implementación acordada usa READ COMMITTED para ver un cierre confirmado
después de esperar la sala. El DTO completo de plantilla sale de una sola
sentencia SQL, se bloquean referencias y todas las escrituras copian ese DTO;
antes del commit se recomprueba la huella. La lectura HTTP del preview conserva
su transacción de sólo lectura. El croquis previo recibe además el contexto
efectivo de destino: un aforo existente de 4, 0 o ausencia se conserva al aplicar,
sin sustituirlo por el de la plantilla ni dibujar dos fuentes de sillas.

El cierre de obra mantiene el orden salas→proyecto. Después de esperar el
proyecto debe comprobar que el conjunto de salas sigue siendo el bloqueado;
si una alta o adopción lo cambió, se deshace la transacción completa y se vuelve
a empezar. Máximo tres intentos; agotarlos produce error visible y conserva
técnico, fecha y nota, sin cierre parcial. No se adquieren nuevas salas después
del proyecto: la duplicación E3 ya usa sala→proyecto. La adopción participa con
sala→proyectos de origen/destino ordenados y verifica de nuevo ambos cierres.
Esta ampliación de propiedad autoriza sólo las acciones/feedback necesarios
para esa garantía; no es un refactor del CRUD general ni del historial E3.

El middleware devuelve JSON 401/no-store a toda API sin cookie válida y un
503 genérico/no-store si producción carece de secreto. Las páginas conservan
su redirección. Cada handler sigue comprobando usuario/permisos actuales.

## B · Selección masiva sin adivinar decisiones

`importacion/seleccion.ts` contiene funciones puras de elegibilidad y conjunto
de selección. Reutilizan el preview actual, sin buscar en el catálogo desde
el navegador ni escribir en cada checkbox.

Una fila es elegible para la acción «Seleccionar coincidencias válidas» cuando
no tiene errores, tiene exactamente un candidato activo, tipo/unidad
compatibles y revisión conocida, y no forma parte de un conflicto de identidad
con otra fila o con una elección manual actual. Las altas nuevas, ambiguas,
no encontradas, rechazadas y sustituciones quedan para decisión individual.
Si varias filas apuntan a la misma referencia, se omiten **todas las
conflictivas**: no se elige la primera silenciosamente. En precios se respeta
la clave de oferta existente `articuloId + presupuesto`.

La acción es aditiva respecto a decisiones manuales compatibles y no sustituye
una alternativa ya elegida. Muestra cuántas añadió y cuántas omitió por motivo.
«Desmarcar todas» elimina también decisiones y motivos locales asociados a
esa selección; no revierte un lote ya confirmado. El usuario puede marcar o
quitar una sola fila mediante controles etiquetados y teclado.

Todo cambio de archivo, procedencia, destino, sala o preview invalida el
conjunto anterior y su hash. Cambiar artículo, motivo o tipo invalida la
revisión final de selección hasta volver a revisarla. Una respuesta de preview
antigua no reactiva selecciones ni hashes de otra entrada.

## B · Alternativa de BOM y revisión final

### Decisión normalizada

Ampliar `SeleccionFila` sin sustituir el flujo de E2. Omitir sigue siendo no
incluir la fila; las elecciones normales conservan su representación de alta
o artículo. Para una sustitución se añade un objeto explícito `alternativa`
con `motivo`, origen de tipo y referencia original si existe. El tipo concreto
queda fijado antes de implementar con este contrato:

```ts
type AlternativaBom = {
  motivo: string;                 // trim, 1..500 caracteres; sin HTML ejecutable
  articuloOriginalId: string | null;
  tipoOrigen: 'equipo' | 'cable' | 'consumible';
  fuenteTipo: 'catalogo' | 'archivo' | 'confirmado_por_usuario';
};
// SeleccionFila mantiene fila/articuloId/revisionArticulo y añade alternativa?.
// Cantidad, unidad, nombres, referencia original y precio NO son entrada fiable
// de SeleccionFila: se releen del archivo/preview y del catálogo del servidor.
```

Reglas para origen y destino:

1. Con coincidencia original única, el servidor fija `articuloOriginalId` y
   `tipoOrigen` desde esa referencia. Se permite elegir otra referencia, con
   motivo obligatorio; ya no se rechaza únicamente por no pertenecer a la lista
   de coincidencias exactas si hay una alternativa BOM válida y revisada.
2. Con coincidencias ambiguas, el usuario identifica primero cuál representa
   el original de la sustitución. El servidor exige que pertenezca a los
   candidatos originales; no acepta un origen arbitrario.
3. Sin coincidencia, conserva nombre/referencia del archivo. Si el archivo
   aporta tipo válido, se usa ese dato; si no lo aporta, el usuario confirma
   explícitamente equipo/cable/consumible y el informe distingue que fue una
   confirmación humana. No inferir tipo por marca o parecido del nombre.
4. El destino se relee en servidor: debe existir, seguir activo, tener el tipo
   original/confirmado y la misma unidad de la fila. Revisión del destino
   obligatoria, incluida la resolución de una fila sin coincidencia. Un cable
   medido en m no se cambia por ud ni un equipo por consumible aunque coincida
   la unidad. Un destino modificado y vuelto a dejar igual también cambia su
   revisión y requiere revisar de nuevo.
5. Cantidad y unidad proceden del archivo original validado y no se editan como
   efecto lateral de sustituir. Mantener unidades enteras para ud, precisión
   admitida para m y límites existentes. Una fila estructuralmente rechazada
   no se convierte en válida por elegir una alternativa.
6. `alternativa` sólo se admite con destino BOM. En catálogo/precios se rechaza
   el objeto, no se ignora: el precio de una referencia no se atribuye a otra.
   Elegir el mismo artículo no se presenta como sustitución.

La UI ofrece «Usar alternativa» tanto para una coincidencia existente como
para no encontradas, reutiliza `BuscadorArticulo` y muestra original frente a
destino, tipo, cantidad/unidad y motivo antes de confirmar. Elegir en el
buscador sólo aporta el identificador; no produce una decisión revisada ni
concede confianza a su texto. Cancelar o quitar la fila no escribe.

### Dos lecturas del mismo flujo, un único commit

Se reutiliza `POST /api/importacion` para revisar archivo y, después, selección.
No se crea un endpoint de inserción de alternativas que evite la transacción.

1. **Revisar archivo:** contrato E2 actual; devuelve filas, candidatos, errores
   y hash del contexto de origen. No escribe.
2. El técnico elige filas, alternativas, tipos necesarios y motivos. Acciona
   **Revisar selección**. El mismo POST recibe archivo/destino/procedencia/sala
   y la selección candidata. El servidor normaliza las decisiones, relee las
   referencias elegidas y devuelve la selección revisada con nombres/tipos/
   unidades/revisiones canónicos y comparación original/destino. No escribe.
3. Para BOM, el `previewHash` de esta revisión final incluye el contexto base
   **y las decisiones normalizadas**, ordenadas por fila. Se calcula sobre:
   bytes/hash y datos validados de la fuente, destino/sala/procedencia,
   originales/candidatos/revisiones, IDs de destino y sus revisiones/activo/
   tipo/unidad, cantidad/unidad de la fuente, tipo confirmado y su procedencia,
   motivo normalizado y conjunto exacto de filas. Modificar el motivo no puede
   conservar un hash válido. El hash no demuestra autorización: las guardas
   y la revisión del servidor siguen siendo obligatorias.
4. **Confirmar** sólo se habilita para esa selección final sin cambios.
   `/api/importacion/confirmar` vuelve a comprobar sesión/clave/permisos/Origin,
   cuerpo y esquema estricto; recomputa la revisión final dentro de la
   transacción bajo los locks existentes. Compara el hash recibido y las
   revisiones. Un cambio devuelve 409 sin lote ni partidas parciales.
5. Sólo entonces inserta el mismo `importacion_lotes`, las mismas partidas
   `sala_material_bom` y los mismos `importacion_cambios`. La creación del lote,
   informe y partidas es un único commit; rechazo tras escritura lanza excepción.

Para catálogo y precios se conserva el contrato determinista actual sin
sustituciones. La revisión final de BOM es una ampliación del servicio E2
vigente; no se implementa detección de schema ausente, tabla opcional o
fallback para versiones sin E2/E3. Actualizar los consumidores y gates BOM al
contrato final; no mantener una vía antigua que confirme alternativas sin
motivo, revisión o hash. Las pruebas directas del servicio tienen que pasar
también por su validación, no sólo por la ruta HTTP.

### Persistencia e invariantes

Ampliar los DTO `CandidatoImportacion`/revisión seleccionada para contener el
tipo leído en servidor. `InformeFilaImportacion` incorpora trazabilidad
estructurada de una alternativa: fila y datos originales, originalId si hay,
destinoId y etiqueta de catálogo vista, revisión del destino, tipo y fuente,
cantidad/unidad de origen, motivo, identidad del autor del lote y hash de la
revisión final. Los nombres se releen; el autor sale de sesión.

Guardar esa información en `importacion_lotes.filas` e `informe` JSONB. El
archivo y su SHA-256 siguen siendo los originales, no una versión con la
referencia sustituida. El informe diferencia resolución de una fila sin
coincidencia y sustitución de una coincidencia original. No escribir esos
metadatos como si fueran un nuevo artículo ni actualizar el modelo original.

Se mantiene el orden de bloqueos sala → artículos en orden estable → datos
del lote. No releer los artículos fuera del lock después de decidir; no confiar
en `revisionArticulo` enviada por el cliente sin comparación. Revalidar sala
existente/obra abierta y los mismos permisos E2: `salas:editar` y `catalogo:ver`
para BOM; `catalogo:editar` para catálogo/precios. Leer/revertir/descargar un
lote conserva propietario y permisos vigentes; otros usuarios reciben 404/403
según el contrato existente, nunca los datos.

La reversión usa los cambios y revisiones existentes: quita sólo la partida
creada si no tiene edición o hechos posteriores que la comprometan, conserva
archivo/informe y explica cada conflicto. No borra reservas, pedidos, cargas,
movimientos, hitos de instalación/entrega ni revisiones E3. Los metadatos de
alternativa no se pierden después de revertir. No se necesita una migración
para ampliar JSONB; si una necesidad posterior demuestra lo contrario, B
entrega la propuesta al arquitecto antes de tocar schema.

## Escenarios Dado / Cuando / Entonces

Los casos son acceptance tests del resultado, no sólo tests de helpers.

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| A01 | Sala/plantilla con campos vacíos | Introduzco 10 ft en largo | Veo 3,048 m y 3,05 m a guardar; guardar/reabrir muestra 3,05 m, con ancho/alto vacíos todavía sin medir. |
| A02 | Dimensiones medidas y editor limpio | Alterno m→ft→m sin editar | Metros, XYZ, metraje, versión y estado de cambios son idénticos; no se ejecuta guardado. |
| A03 | Texto con coma, vacío o incompleto | Escribo, cambio foco o intento guardar | Coma válida se conserva; vacío conserva ausencia; incompleto/negativo/infinito/unidad desconocida/desbordamiento no se guarda. |
| A04 | Dimensiones ya editadas en otra pestaña | Guardo el formulario anterior | Conflicto visible, ningún sobrescrito y entrada conservada; igual con el inspector y con plantilla alterada. |
| A05 | Sala con equipo, puerta o recorrido medido cerca del borde | Reduzco el recinto en pies | La validación usa metros finales; se rechaza si deja fuera un dato confirmado y no se corrige su posición automáticamente. |
| A06 | Plantilla con mesa girada, silla manual y equipo estimado | Abro preview desde alta/Plano/ficha | Es la misma escena/geometría del croquis; giro/nulos/sillas/estimados correctos y lista de referencias legible. |
| A07 | Plantilla sin medidas o con línea opcional/inactiva | Abro preview | Avisos explícitos; sin escala inventada, sin heredar la opcional en el montaje efectivo ni convertir la inactiva en aplicable. |
| A08 | Dos selecciones de plantilla y red con respuestas invertidas | La segunda responde antes | Sólo el último ID y su huella quedan visibles/aplicables. |
| A09 | Usuario sin plantillas o obligado a cambiar clave | Llamo listado/detalle o abro alta con ID a mano | 403 sin datos; sala en blanco continúa según su permiso. Llamar aplicación directamente tampoco evita la guarda. |
| A10 | Preview válido y sala vacía | Otra sesión cambia plantilla, ocupa sala, cierra obra o aumenta versión | Aplicar rechaza el conflicto/ocupación/cierre sin escrituras parciales. Si no cambia nada, la escena aplicada coincide con el preview salvo IDs/contexto. |
| B01 | Archivo de 500 filas: 400 coincidencias válidas únicas, 20 ambiguas, 20 no encontradas, 20 rechazadas y 40 filas en 20 pares duplicados | Selecciono coincidencias válidas | Se seleccionan exactamente 400; las otras 100 tienen motivo de omisión y no se elige una fila arbitraria de cada par. |
| B02 | Selección masiva y una alternativa manual | Uso seleccionar coincidencias o desmarcar todas | No pisa la alternativa al añadir; al limpiar quedan cero elecciones y no hay llamada de escritura. |
| B03 | Fila con coincidencia exacta y 3 ud | Elijo otra referencia del mismo tipo/unidad y motivo | La revisión muestra ambos modelos y 3 ud; el commit crea esa partida y trazabilidad completa, no cambia el artículo original. |
| B04 | Fila no encontrada sin tipo y 12,75 m | Elijo alternativa y confirmo tipo explícitamente | El informe conserva fuente, 12,75 m y tipo confirmado por usuario; no se infiere por parecido. |
| B05 | Alternativa inactiva, de otro tipo o de unidad distinta | Reviso o llamo confirmar a mano | Rechazo de servidor sin lote/partidas; un artículo con la misma unidad pero distinto tipo también se rechaza. |
| B06 | Revisión final válida | Altero motivo/ID/fila/tipo/cantidad suministrada o una revisión de catálogo | Rechazo estricto o 409; nunca se escribe una decisión distinta de la revisada. Cantidad no se acepta desde la selección. |
| B07 | Destino cambiado y vuelto a sus valores previos | Confirmo con la revisión antigua | 409 por revisión ABA; no basta que la etiqueta y unidad vuelvan a coincidir. |
| B08 | Coincidencias ambiguas | Intento sustituir sin identificar original | Pide resolver original/tipo; no toma el primer candidato ni cruza referencias del catálogo. |
| B09 | Precio/catálogo o fila estructuralmente rechazada | Adjunto objeto alternativa a la petición | Rechazo; no se sobrepasa la prohibición de sustituir ofertas ni se hace válida una fila corrupta. |
| B10 | Confirmación con varias alternativas | Se inyecta fallo después de la primera inserción | Rollback total y fotografía de BD idéntica, sin lote parcial. |
| B11 | Lote de alternativa ya confirmado | Creo reserva/pedido/carga/movimiento posterior y revierto | Conserva la necesidad comprometida y explica conflicto; no borra hechos. Sin dependencias, revierte sólo su partida y conserva evidencia. |
| B12 | Preview o hash final de otro archivo/sala/procedencia/selección | Cambio contexto, cancelo o llega respuesta vieja | Selección/hash quedan invalidados, no se puede confirmar lo antiguo; cancelar no escribe. |
| B13 | Sesión válida con permisos retirados o lote ajeno | Confirmo/revierto/descargo por API | Guarda actual de servidor impide la operación y no revela la fuente ni el informe ajeno. |

## Pruebas y evidencia requerida

### Lógica pura y componentes

A prueba normalización, coma/vacío, unidades no admitidas, precisión/límites,
ausencia, no deriva por alternar unidad y valores exactos frente a persistidos.
La proyección de plantilla prueba paridad con una sala creada a partir de la
misma fixture, comparando geometría sin IDs: mesa/giro/sillas, nulos,
opcionales, puertas, rutas y referencias. No basta con buscar un texto en el
SVG; debe comparar las entradas/escena del pintor compartido.

B prueba elegibilidad y selección con las 500 filas, duplicados, elecciones
manuales y claves de oferta; normalización/hash de decisiones, tipo/unidad,
motivo y revisiones. El componente se monta para comprobar selección masiva,
desmarcar, revisión final, invalidación y respuestas fuera de orden. Las
pruebas negativas invocan el servicio o ruta real además de helpers.

### Postgres sintético y API

El arquitecto crea una **nueva BD local REA-01** y registra URL saneada,
`current_database()`, usuario, host/puerto e identidad de fixture antes de
escribir. A y B usan espacios de IDs/nombres separados y la misma versión
actual completa de schema E2/E3. No reutilizar bases históricas ni `.env.local`.
No se ejecutan resets/seed del inventario real.

Gates A: guardar dimensiones, concurrencia de sala/plantilla, preview sin
escritura, huella y copia consistente, catálogo/roles/sala ocupada/cierre,
paridad preview→sala y permisos de APIs/página/acciones. Fotografiar tablas
antes/después de cada operación que deba ser sólo lectura o rechazada.

Gates B: selección/hash final y cantidades reales, revisiones obligatorias,
activo/tipo/unidad, ABA, origen/motivo/contexto alterados, fallo intermedio,
obras cerradas, propiedad y permisos; reversión limpia y con hechos posteriores.
Comparar tablas operativas y E3 antes/después para probar que no se alteraron.

### Navegador y entregables

Recorrer primero escritorio: plantilla abierta → preview → alta con m/ft →
Resumen/Plano → guardar/reabrir; después Equipamiento → importación BOM →
selección masiva → sustitución de coincidencia exacta y no encontrada → revisión
final → confirmación → informe/reversión. Probar teclado, foco, errores,
cancelación y dos pestañas. Móvil se valida al final del recorrido completo.

Exportar la sala sintética resultante con E1: PDF de plano con la medida
normalizada y XLSX de material con las cantidades sustituidas. Reabrir archivos,
renderizar e inspeccionar; reconciliar contra el snapshot. Las anotaciones,
leyenda e identidad de revisión/cables de E3 siguen presentes. No basta un
download exitoso ni el contador de pruebas.

Artefactos nuevos exclusivamente en
`output/rea-integracion/rea01/{a,b,integracion}/`: comandos, logs completos,
identidad de BD, fotografías, respuestas API saneadas, capturas/trazas,
descargas/hashes y resolución de revisión. No sobrescribir artefactos E1/E2/E3
ni fuentes de Xtenav. No modificar en esta fase los worktrees auxiliares.

## Gate de integración y cierre de REA-01

1. A y B entregan fuentes y evidencias de sus escenarios, con pendientes
   explícitos. El arquitecto integra los archivos compartidos de forma secuencial.
2. Ejecutar pruebas focalizadas y `npm test`; build Webpack sin `DATABASE_URL`,
   tipos y lint de fuentes afectadas, más los gates Postgres/navegador de esta
   unidad. Mantener regresión E1/E2/E3 y sus artefactos históricos.
3. Revisor independiente recibe esta especificación, fuentes y evidencia cruda,
   sin razonamiento/conclusiones del ejecutor. Una corrección acotada y gate
   determinista cierran sus hallazgos; integridad/seguridad no se dan por buenas
   por agotar una ronda.
4. Sólo con ST02/ST06/ST11/ST13 implementados y verificados se registra el
   cierre en documentación 17/18 y continuidad. Una selección clasificada,
   preview aislado o test estrecho no cierra REA-01 ni la integración REA global.

No hacer commit, push, merge a main, despliegue ni escrituras en producción.
No se añade compatibilidad con schemas sin E2/E3 ni un proveedor simulado para
resolver una dependencia: esta unidad funciona con datos y herramientas locales
ya disponibles.

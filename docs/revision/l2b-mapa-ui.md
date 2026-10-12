# L2B · Mapa de superficies y contrato de integración UI

08/09/2026. Preparación por lectura de código y del diseño L2 aprobado. No se
ha implementado, ejecutado navegador, probado BD ni usado el generador en esta
unidad. Las observaciones siguientes son estáticas, no gates aprobados.

## Resultado

Elegir una boca física de equipo y una boca documentada de roseta, guardar una
sola conexión y leer la misma identidad, longitud y ocupación en Plano,
Diagrama, tabla, CSV y guía. Mantener los componentes y tokens existentes.
`docs/revision/l2-diseno-previo.md` y L2 del plan40 mandan sobre este mapa.

## Radio compartido que debe congelarse antes de repartir edición

| Superficie actual | Cambio necesario |
|---|---|
| `src/lib/tipos.ts`: `Conexion`, `BocaPuerto`, `TomaRed` | Unión discriminada de extremos completos; legado separado; capacidad nullable y bocas documentadas de toma. No usar IDs de toma dentro de equipo_id. |
| `src/lib/bocas-puerto.ts` y nuevo resolutor común de extremos | Clave tipada de ocupación, identidad física, nombre, conector, ordinal, posición y estado de documentación. No convertir roseta en `Puerto` o `EquipoEnSala` ficticio. |
| `src/lib/editor-conexiones.ts` | Sustituir codificación/decodificación exclusivamente equipo-puerto-ordinal, `conexionCompleta`, firma y `camposGuardables` por extremos tipados. Comparar IDs físicos; etiquetas son presentación. |
| `src/lib/lienzo-conexiones.ts` | Bloque discriminado equipo/roseta, bocas por FK, ocupación de ambos tipos y resolución de anclajes. Ningún helper gráfico debe completar un ordinal ausente. |
| `src/lib/cable-schedule.ts` | Un único resolutor para nombres/bocas/conectores; una fila por conexión; separar asignación documental de extremo real. Consumir la etiqueta persistida L2A. |

Estos helpers son colisión real aunque los componentes se repartan en carpetas
distintas. El propietario de contrato/dominio debe entregar sus tipos antes de
que editen los ejecutores de servidor y UI.

## Lectura: dos caminos que hoy divergen

`src/lib/datos.ts` lee `c.*` y une las dos filas de `conexion_bocas`, recuperando
los ordinales. `src/lib/datos-plano.ts` selecciona columnas concretas de
`conexiones` y no une `conexion_bocas`: hoy no transporta las bocas detalladas.
Ambos leen tomas por separado y deben recuperar capacidad, bocas y confirmación
del código heredado. Reutilizar la consulta/mapeo de extremos; no mantener dos
normalizadores que puedan discrepar.

`src/app/salas/[id]/datos-ficha.ts` calcula y construye tabla/material desde la
lectura completa. `/diagrama/page.tsx` pasa equipos, puertos y conexiones al
editor pero todavía no tomas. `/plano/page.tsx` usa el lector ligero. Pasar el
mismo contrato de toma/boca por ambos caminos y comprobar igualdad después de
guardar y recargar. No enviar catálogo completo adicional al navegador.

## Editor de conexiones

`src/components/diagrama/use-editor-conexiones.ts` conserva base y borrador,
versionado optimista, altas de equipo, posiciones del esquema y estados de
conflicto. Su tipo local `Boca` y `nuevaConexion` solo admiten equipo. Hoy el
botón exige dos equipos; debe permitir un equipo y una roseta con boca real.

El borrador debe mantener extremos tipados en altas, modificaciones y selección.
Una roseta sin capacidad aparece como «Capacidad sin documentar» y ofrece
documentarla; no genera opciones 1/2, ni selecciona el primer puerto libre.
Las bocas ocupadas deben estar identificadas con su cable, accesibles para
seleccionar la conexión, y no disponibles para crear otra. Incluir ocupación de
todo el borrador, descontando únicamente la conexión que se edita.

El inspector `src/components/diagrama/editor-conexiones.tsx` puede reutilizar
«Origen y boca» / «Destino y boca» con grupos equipos y tomas. Selección explícita
de boca, cable y ruta al completar asignación; «Por defecto de la sala» es una
opción explícita de ruta, no inventar un recorrido. Resolver las etiquetas de
conexión mediante el helper común. Los avisos técnicos siguen siendo avisos;
capacidad/ID/ocupación inválidos son errores estructurales.

Al guardar, el resultado actual remapea `equipos_ids`, `ids` de conexiones y
`etiquetas`. Si la documentación/alta de placa se incluye en el mismo borrador,
el contrato debe devolver mapas independientes de placa y boca además de equipo
y conexión, y remapearlos antes de consolidar base/selección/posiciones. Si la
documentación se guarda primero en Equipamiento, no debe fingirse un temporal
de placa en el editor. Es una decisión rutinaria de integración; lo obligatorio
es evitar medias escrituras y referencias temporales persistidas.

Preservar la conducta existente: respuesta inválida conserva borrador y detalle;
conflicto conserva cambios y bloquea nuevos envíos hasta recargar; respuesta
perdida no repite altas a ciegas. No actualizar base/version/etiquetas antes de
confirmar todos los mapas. Descartar cancela cambios locales expresamente.

## Lienzo y esquema

`src/components/diagrama/lienzo-conexiones.tsx` tiene interacción de clic, arrastre,
Escape, selección de boca ocupada, flechas para mover bloque y zoom. Reutilizar
ese comportamiento para un bloque de infraestructura cuya identidad sea la
placa y cuyas filas sean bocas documentadas; el bloque no es catálogo AV.

Hallazgo estático: tanto el dibujo SVG de cables como
`conexionesSinDibujar()` completan ordinal ausente con `?? 1`. En cambio
`ocupacionDeBocas()` reserva todos los ordinales de un puerto histórico sin
detalle. L2 debe conservar el estado legado explícito, contarlo como pendiente
y permitir completarlo, sin dibujar una boca concreta inventada.

`src/lib/diagrama.ts`, `src/components/diagrama/esquema-sala.tsx` y
`dibujo-esquema.tsx` constituyen otro esquema de lectura; ampliar sus nodos y
anclajes con el mismo tipo, sin perder conexiones mediante filtros de equipo.
El orden visual de una placa nunca cambia ordinales físicos.

Las posiciones de bloque son píxeles y necesitan identidad tipada. El contrato
actual `posiciones: { equipo_id, x, y }[]` no acepta placas. Si se permite mover
bloques de roseta, persistir su layout por separado de XYZ con el mismo control
de versión y guardado atómico. No reutilizar `tomas_red.x_m/y_m` como layout.
La rejilla visual por defecto es válida mientras no exista posición de esquema.

## Documentación de rosetas y Plano

`src/components/sala/tomas-red.tsx` es la superficie existente de alta/edición
de código, ubicación, XYZ y notas; reutilizarla para capacidad y detalle de
bocas. Sustituir el pie que dice que la toma no es extremo de tirada. Capacidad
vacía significa desconocida; introducir N exige confirmar sus N bocas,
conector/señal documentados y etiquetas opcionales. Mostrar ocupación antes de
reducir/quitar, sin confundir aviso visual con guarda de servidor.

Los formularios actuales llaman acciones directamente con `defaultValue`.
Incorporar respuesta con estado y conservación de entradas para errores de
capacidad, uso concurrente y obra cerrada. Las notas no deben perderse tras un
rechazo. Reutilizar `Aviso`, `Campo`, `Boton`, `Tarjeta`, `ContenedorTabla`.

`src/components/plano-editor/inspector-toma.tsx` sigue editando ubicación física.
Debe enseñar posición incompleta/desconocida y acceso a documentar bocas sin
crear un segundo catálogo. `inspector-equipo.tsx` y las otras selecciones de
`toma_red_id` conservan la asignación documental; mostrar «Pendiente de conexión»
o la conexión enlazada, nunca presentarla como cable ya calculado.

Hallazgo estático relevante en `src/lib/plano-editor.ts`: `moverToma()` completa
Z con `t.z_m ?? 0`; `editarToma()` borra XYZ al faltar X/Y y completa Z=0 cuando
X/Y existen. El contrato L2 exige retirar esas inferencias para posición
desconocida, conservar ejes históricos parciales al cargar y pedir confirmación
explícita del triple al guardar una posición nueva. Arrastrar XY no documenta
una altura desconocida. `(0,0,0)` explícito sigue siendo válido.

`borradorDesde`, `entradaCroquisDe`, patches y comparadores deben transportar
todos los campos requeridos sin convertir NULL a cero. No alterar coordenadas
por documentar capacidad. `rutas-cable.ts` ya identifica por conexion_id y sus
puntos son independientes del tipo de extremo; conservarlos.
`panel-rutas-cable.tsx` forma etiquetas consultando solo nombres de equipos:
usar el resolutor compartido para que la toma sea reconocible.

`src/lib/croquis.ts` construye tiradas buscando ambos extremos en equipos
dibujados: una roseta hoy se omitiría. Resolver anclajes físicos de ambos tipos,
marcando extremos no situados, sin sustituir un equipo ni calcular otra fórmula.
Un punto intermedio no completa un extremo desconocido. La placa puede aparecer
en planta con XY conocidos y aviso de Z pendiente; eso no acredita longitud 3D.

## Formulario anterior, tabla, CSV y guía

`src/components/sala/formulario-conexion.tsx` mantiene estado de equipo/puerto/
ordinal; `conexiones.tsx` y `selector-boca-conexion.tsx` permiten editar conexiones
existentes. Adaptar los tres al contrato tipado mientras sigan siendo rutas
accesibles: no cerrar el flujo antiguo dejando un formulario que borre el lado
roseta al cambiar cable/ruta. El formulario actual no recibe ocupación; debe
recibir conexiones/bocas ya resueltas y conservar notas y longitud manual en
rechazos. Mantener UUID de conexión al completar una histórica.

`construirTablaCables()` debe producir «equipo / LAN [ordinal]» y «toma [código] /
[boca]» desde los extremos; añadir aviso cuando código heredado esté pendiente
de confirmar o longitud no pueda calcularse por posición/holgura. El CSV consume
las mismas filas: conservar escapado, decimales y número de líneas; revisar
cabeceras `equipo_origen/equipo_destino` para expresar extremos sin ocultar tomas.
`tabla-cables.tsx` y `exportar-csv.tsx` no deben resolver de nuevo identidades.

`src/components/sala/guia-montaje.tsx` vuelve a consultar ordinales de equipo y
lista todas las asignaciones documentales aparte. Consumir ordinal/etiqueta de
extremo resuelto, y mostrar solo pendientes como documentación por completar.
La asignación completada remite al cable canónico, sin segunda instrucción de
instalación ni segunda línea material. No afirmar «puerto sin definir» para una
boca de roseta válida. La lista de material suma conexiones, nunca placas.

## Pruebas que deciden el cierre de esta superficie

1. Histórico sin ordinal permanece pendiente en selector y lienzo; nunca boca 1.
2. Placa desconocida no ofrece bocas; documentar dos ofrece exactamente dos;
   ocupado identifica cable y no admite otro cable ni reducción.
3. Equipo temporal + boca de placa persistida guardan y recargan sin ID temporal;
   rechazo y respuesta perdida conservan borrador y notas sin duplicar altas.
4. Completar asignación dos veces devuelve la misma conexión; borrar el cable
   vuelve a pendiente; una sola fila en tabla, CSV, material y guía.
5. Ambas lecturas conservan extremos/ordinales; edición de ruta no cambia bocas;
   mover bloque solo modifica layout y mover posición física actualiza metros.
6. Posición cero explícita válida; parcial/desconocida sigue pendiente; manual
   conserva precedencia; ausencia de holgura de roseta muestra criterio pendiente.
7. Recorrido escritorio con recarga y conflicto entre pestañas; luego 390/320,
   teclado, foco, Escape, tablas con scroll propio e impresión existente.

No hay una decisión material nueva que escalar a Sergio en este mapa. La holgura
inicial no documentada se mantiene pendiente conforme al diseño; no sembrar un
valor estimado. La persistencia del layout de placa y el contrato de temporales
deben acordarse entre propietarios de servidor y UI antes de editar helpers.

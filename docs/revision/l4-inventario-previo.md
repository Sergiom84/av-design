# L4 · Inventario previo del asistente

Fecha: 2026-09-08. Preparación de solo lectura del código, con ejecución de pruebas existentes. No acredita el gate L4; no se modificaron código, pruebas, CSV ni base de datos. El árbol compartido sigue recibiendo la integración L1 de otro agente: este documento describe los archivos inspeccionados en este corte.

## Comportamiento que ya existe

`src/lib/asistente-equipamiento.ts` contiene `seleccionDeSala`, `funcionEquipo`, `perfilEquipo`, `avisosEquipamiento` y `resumenPuertos`. La clasificación usa categorías exactas normalizadas, sin adivinar la función por el nombre visible. Receptores y controles de microfonía no cuentan como micrófonos. La selección combina equipos existentes con el candidato y respeta las cantidades de los existentes. No hay necesidad de sustituir este asistente por otro.

`perfilEquipo` reconoce modelos Cisco concretos mediante condiciones escritas en código y enlaces oficiales. Room Bar Pro se considera integrado; Codec EQ y Room Kit EQ requieren captación externa. EQ y variantes ambiguas quedan desconocidas. Es conocimiento estático: todavía no consulta `DatoTecnico`, sus estados ni las fuentes por hecho de L1.

`AvisosSeleccion`, en `src/components/asistente-equipamiento/asistencia.tsx`, representa cadenas en una lista con `aria-live="polite"`. `DatosEquipo` resume bocas registradas por unidad, sentido y señal, enlaza la ficha del artículo y muestra detalles estáticos del Codec EQ. Aclara que el total no acredita disponibilidad. No recibe conexiones ni hechos técnicos.

`AltaEquipo`, en `alta-equipo.tsx`, mantiene el candidato local, carga sus puertos bajo demanda con cancelación, diferencia error de ausencia y permite reintento. Usa el buscador remoto existente. Añadir envía el identificador y limpia la selección tras resolver la acción. La referencia del candidato deduce CISCO del prefijo de la etiqueta: ampliar hechos requiere recibir la identidad del artículo desde el servidor, no ampliar esa deducción textual.

`Equipamiento`, en `src/components/sala/equipamiento.tsx`, conserva las filas actuales, controles de cantidad, baja y edición de nombre/posición/toma. En proyecto cerrado muestra lectura. Los cambios de cantidad y baja son formularios de servidor: actualizan el asistente al llegar los nuevos datos revalidados, sin estado optimista compartido para esas operaciones. La selección de candidato sí cambia inmediatamente.

## Los seis ensayos del gate

| Ensayo | Evidencia actual | Hueco que debe cerrar L4 |
|---|---|---|
| Kit sin micro | `avisosEquipamiento` avisa para ROOM KIT EQ; las pruebas lo ejecutan. Un micro de categoría admitida elimina el aviso de ausencia y deja compatibilidad pendiente. | Derivar captación y suministro de hechos L1 y composición L3. Un micro existente en cualquier punto de la lista no demuestra que atienda ese codec: asociar al montaje/conexión concreta. No contar micros de seguimiento como captación de voz. |
| Barra integrada | ROOM BAR PRO y WEBEX ROOM BAR PRO no exigen micro externo; no resuelven la captación de otro codec. | Migrar ese perfil estático a evidencia documentada por hecho; ficha ausente o parcial no debe heredar un integrado verificado solo por nombre. |
| Ficha desconocida | Modelo no reconocido muestra captación desconocida. Equipo sin categoría produce aviso distinto. Error al cargar puertos tiene mensaje/reintento propios. | Incorporar estados verificado/parcial/sin_documentar y fuente junto al dato. Desconocido no equivale a ausencia física ni incompatibilidad. |
| Videoconferencia duplicada | Candidato sobre videoconferencia existente produce un solo aviso de duplicidad; la rama evita los mensajes de referencias repetidas/varias unidades. No bloquea añadir. | El aviso es texto sin ID de instancia ni enlace al equipo afectado. Aportar causa, equipo y acción; conservar la posibilidad de montaje intencional con varios sistemas. |
| Puerto agotado | El asistente solo suma capacidades del catálogo. `lienzo-conexiones.ts` ya contiene ocupación de bocas y `bocas-puerto.ts` expande ordinales. | Reutilizar ocupación física por equipo/puerto/ordinal, no restar conexiones del total agregado. El asistente no recibe ese contexto. Separar bocas históricas sin ordinal y ocupación comprobada. |
| Cable insuficiente | La tabla de cables ya transporta longitud calculada y comercial. El asistente no recibe ninguna longitud ni suministro. | Comparar recorrido calculado/manual con suministro incluido documentado de L1/L3, unidades y adaptadores explícitos. Ausencia de longitud comercial/documentación produce pendiente, no suficiencia. |

## Lectores y radios de integración

1. `obtenerSala`, en `src/lib/datos.ts`, ya carga equipos, conexiones con `conexion_bocas`, posiciones, puertos solo de referencias presentes y `catalogoEquipos`. La página `src/app/salas/[id]/equipamiento/page.tsx` descarta las conexiones al pasar props. Es el punto de entrada del contexto físico existente; evitar otra lectura del catálogo entero.
2. `datosTecnicosDeArticulo`, en `src/lib/datos-ficha-tecnica.ts`, ya lee y valida hechos de un artículo con `esquemaDatoTecnico`; devuelve vacío si falta la tabla. Para los equipos presentes convendrá lectura acotada por IDs, sin un viaje independiente por cada tarjeta. La ruta `/api/catalogo/[id]/puertos` solo entrega puertos; los hechos del candidato necesitan un contrato acotado y con las mismas guardas. La búsqueda `/api/catalogo` y `buscarArticulos` ya limitan resultados; conservarlo.
3. `CatalogoAsistente` y `SeleccionAsistente` solo incluyen identidad/categoría/cantidad. La selección carece del ID de instancia de sala, hechos, bocas, conexiones y vínculo con kit. Extender el contrato explícitamente para poder enlazar al equipo afectado y distinguir compra de kit frente a componentes físicos L3. No interpretar ROOM KIT EQ como codec + cámara + control mediante tres altas adicionales no relacionadas.
4. `avisosDeConexion`, en `src/lib/cable-schedule.ts`, ya compara señal, sentido y señal del cable. Es el radio que debe compartirse con la revisión, evitando repetir reglas. No compara conectores, PoE, consumo compartido ni adaptador declarado. `bocasDePuerto`, `claveBoca` y `ordinalValido` ya proporcionan la identidad física; conservarla.
5. `revisarMontaje`, en `src/lib/revision.ts`, ya deriva medidas, catálogo, conexiones, presencia de puertos, metros y compatibilidad de la tabla. Cero conexiones es bloqueo. Sin embargo, no recibe hechos, kit, presupuesto PoE ni disponibilidad de cable incluido; tampoco revisa `posicion_confirmada`. `puntoPuertos` solo comprueba IDs presentes, no ordinal físico. `resumirMontaje` puede devolver listo con esas dimensiones sin evaluar. Completar esta entrada y sus puntos, no crear un segundo semáforo desconectado.
6. Los avisos actuales son `string[]`. Para causa/elemento/acción hace falta un resultado estructurado con clave estable, estado, identificador afectado y destino/acción; su presentación puede seguir reutilizando la lista y tokens existentes. El enlace actual a ficha es por artículo, no al equipo instalado que origina un aviso de duplicidad.

## Errores y conservación de entradas

El editor de conexiones ya declara resultados estructurados `conflicto`, `ajeno`, `invalido`, `cerrado`, `no_existe` en `editor-conexiones.ts`. La nueva revisión técnica debe convivir con ese contrato: avisar de compatibilidad no autoriza IDs ajenos ni ordinales inválidos. Esta lectura no ejecutó ni aprobó las guardas transaccionales.

`AltaEquipo` recibe una acción `Promise<void>`, la espera y limpia tras resolver. No tiene resultado de rechazo recuperable ni prueba de conservación ante conflicto. Los formularios de edición existentes usan valores por defecto y acciones directas. No se verificó en navegador qué conserva React ante una excepción de servidor; debe ensayarse expresamente, incluyendo notas del flujo afectado. El alta de equipamiento no ofrece campo de notas: no confundir conservar la selección tras un fallo de fetch con conservar notas después de un rechazo de guardado.

Observación de alcance: `anadirEquipo` en `acciones.ts` relee nombre si no llega, pero el SELECT inspeccionado no exige activo/tipo equipo y permite nombre recibido. No se ha probado un envío adversarial ni se afirma que exista el mismo hueco en el editor de diagrama. Revisar la entrada concreta al completar el requisito estructural L4, sin dar por suficientes las restricciones del buscador.

## Evidencia ejecutada y límites

Comando ejecutado sin BD:

```powershell
node --import tsx --test src/lib/asistente-equipamiento.test.ts src/components/asistente-equipamiento/alta-equipo.test.tsx
```

Resultado: 17 pruebas, 17 pasan, 0 fallos, 0 omitidas. Son 14 pruebas de lógica/datos y 3 de componentes DOM. Cubren clasificación, perfiles estáticos, duplicidad, resumen, selección remota simulada, reintento de puertos y limpieza tras alta simulada. No cubren PoE, longitud de suministro, adaptador, ocupación dentro del asistente, notas ante rechazo, integración L3 ni un recorrido en navegador contra servidor real. El nombre de una prueba que dice «bocas documentadas» verifica filas y enlaces CSV, no constituye una verificación independiente del manual.

No hubo arreglo, mutación de implementación ni prueba de reversión: es una preparación, no una entrega L4 aprobada. La siguiente unidad debe tomar los contratos L1/L3 definitivos, cerrar esos seis ensayos con datos verificables y ejecutar después revisión independiente.

## Lectura adicional del director: longitud comercial insuficiente

`ajustarALongitudComercial(40, [1,2,3,5,10])` devuelve 10 por contrato de una
prueba existente (`calculo-cable.test.ts`, longitudes comerciales). La tabla
transfiere ese número y hoy solo añade avisos de señal/sentido. L4 debe comparar
explícitamente longitud necesaria y disponible: no acreditar 10 m para un
recorrido de 40 m ni convertirlo sin advertencia en compra suficiente. No cambiar
la fórmula ni esa expectativa histórica de paso durante L2; el comportamiento
completo debe decidirse y comprobarse con el caso de cable insuficiente de L4.

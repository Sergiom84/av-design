# L2A · Etiquetas persistidas antes de incorporar rosetas

08/09/2026. Contrato acotado para revisión. Solo lectura de código en esta unidad;
no se han modificado scripts, esquema, CSV ni ejecutado PostgreSQL.

## Resultado y límites

Conservar la etiqueta visible de cada cable al migrar y hacerla inmutable ante
borrado de otros cables, nueva inserción, cambio de señal, actualización o recarga.
Las altas nuevas reciben correlativos atómicos sin reciclar números borrados.
No incorpora rosetas, kits, nuevos extremos ni modifica metros o bocas.

La identidad canónica sigue siendo `conexiones.id`. La unicidad de etiqueta es
por sala, como hoy; dos salas pueden tener HD-1000 sin representar el mismo cable.
Una copia crea nuevos UUID y asignación independiente, aunque el texto coincida
si ambas salas comienzan una serie vacía.

## Defecto y mapa de integración observados

`identificadoresDeCable` (`src/lib/cable-schedule.ts`) reconstruye los números de
las conexiones presentes, por señal y orden creado_en/id. Borrar una fila anterior
renumera las siguientes; cambiar señal puede cambiar dos series. Los tests
actuales cubren añadir al final, desempate e inexistencia de fecha, no esos casos.

| Radio | Archivos/caminos inspeccionados |
|---|---|
| Fuente de prefijos/inicio | `src/lib/tipos.ts`: PREFIJO_CABLE y PRIMER_CORRELATIVO_CABLE |
| Tabla/exportación | `cable-schedule.ts`, consumidores de FilaCable y tabla/CSV |
| Diagramas | `diagrama.ts`, `components/diagrama/lienzo-conexiones.tsx`, `editor-conexiones.tsx` |
| Lectura de sala | `datos.ts`: select c.* pero mapeo manual de Conexion |
| Lectura de plano | `datos-plano.ts`: SELECT explícito omite hoy creado_en y cualquier etiqueta |
| Altas normales | `acciones.ts`: crear sala desde plantilla e insertar conexión manual |
| Edición normal | `acciones.ts`: actualizar detalles/señal y borrar conexión |
| Editor de diagrama | `acciones-diagrama.ts`: borrar lote, actualizar conexiones, insertar altas y aplicar plantilla |
| Copias | `acciones.ts` sala→plantilla y creación desde plantilla; `acciones-diagrama.ts` aplicación a sala vacía |
| Regresión reutilizable | `cable-schedule.test.ts`, `diagrama.test.ts`, tests editor/lienzo, scripts Postgres de bocas/conexiones/plantillas y `verificar-seed-puertos.mjs` |

Antes de implementar, barrer todos los INSERT/UPDATE de `conexiones` del árbol,
incluidos fixtures, y verificar que el barrido encuentra archivos. No limitar la
garantía a esta lista: el trigger cubre también nuevas rutas de escritura.

## Modelo mínimo

Añadir a `conexiones`:

- `etiqueta_cable text NOT NULL`, con UNIQUE(sala_id,etiqueta_cable).
- `serie_cable senal NOT NULL`: señal que dio nombre al cable al crearlo.
- `correlativo_cable bigint NOT NULL`, positivo, para la asignación persistida.

Crear `series_cable_sala(sala_id FK, senal, siguiente bigint)` con PK sala/señal.
El contador no se deriva de las conexiones restantes y nunca se decrementa al
borrar. Una eliminación de sala puede borrar sus contadores mediante FK porque
esa identidad de sala deja de existir; no se reutiliza un UUID de sala eliminado.

Crear una proyección SQL de configuración de series (`senal`, `prefijo`,
`primer_correlativo`) generada desde las constantes TypeScript. El trigger de
alta lee esta proyección: no contiene otra tabla manual de CASE por señal.

En INSERT, el trigger asigna serie a partir de la señal inicial, incrementa o crea
atómicamente el contador con UPSERT y devuelve el número reservado. El mismo
commit confirma conexión, bocas y contador. Un rollback permite reutilizar el
número que nunca llegó a confirmarse; un cable confirmado y después borrado deja
su hueco permanente. El frontend no elige etiqueta/serie/número.

En UPDATE, rechazar cambios de etiqueta, serie o correlativo. La señal técnica
puede cambiar conservando la brida; sus avisos se recalculan sin renumerar.
Cambiar de sala una conexión también requiere una operación explícita futura:
no se permite usar el cambio de propietario para eludir esta garantía de ámbito.

## Fuente única y backfill exacto

Propuesta de artefactos: un generador de migración/fragmento de esquema importa
`PREFIJO_CABLE` y `PRIMER_CORRELATIVO_CABLE` mediante el cargador CJS ya probado.
Emite SQL versionado marcado como generado, con configuración y algoritmo de
backfill. Un test regenera y compara bytes; cambiar una constante obliga a una
decisión de migración visible. El seed ordinario no reinicia contadores ni
reescribe configuración histórica de etiquetas.

No calcular el backfill con un ROW_NUMBER ingenuo por timestamp completo:
`datos.ts` convierte el timestamp PostgreSQL a Date y luego a ISO, perdiendo
microsegundos. Dos altas dentro del mismo milisegundo se ordenan por UUID en el
algoritmo visible, aunque SQL pudiera ordenarlas de otro modo. El SQL generado
debe reproducir **truncado al milisegundo y desempate UUID** para esas filas.
Fijar orden textual C para UUID canónico, que coincide con la comparación ASCII.

Antes de aplicar, el verificador calcula el mapa UUID→etiqueta mediante la función
histórica real y el mismo mapeo de fecha del lector. Debe incluir timestamps con
microsegundos en orden contrario al UUID para que una diferencia no pase oculta.
La función histórica se conserva como rutina explícita de migración con pruebas;
deja de ser el camino habitual de la interfaz tras L2A.

Operación de migración, una transacción:

1. Bloquear las escrituras de conexiones y tomar la instantánea por sala.
2. Comprobar fechas finitas y representables por el mapeo existente. Si aparece
   un histórico fuera de ese contrato, abortar con IDs; no asignar otra etiqueta
   por suposición. La columna DB actual es NOT NULL, aunque fixtures de dominio
   antiguos permitan fechas nulas.
3. Asignar solamente filas aún sin etiqueta, usando exactamente el mapa histórico.
   En una primera aplicación no debe existir una mezcla no explicada de series.
4. Inicializar cada contador tras el máximo asignado; en segunda aplicación
   conservar contadores mayores, incluidos huecos de cables borrados.
5. Activar NOT NULL/unicidad/trigger inmutable y comprobar el mapa antes/después.
   Un fallo revierte el lote completo. No cambiar ID, creado_en, señal, bocas,
   geometría ni puntos de paso durante el backfill.

La instalación limpia recibe configuración y triggers sin necesitar datos previos.
La actualización y segunda aplicación deben dar el mismo esquema observable.
Los identificadores impresos antes de un borrado ocurrido *antes* de esta
migración no son recuperables desde la BD: se conservan las etiquetas visibles de
la instantánea actual, sin afirmar recuperación de ese historial inexistente.

## Contrato de lectura y borradores

Añadir etiqueta persistida al tipo y a ambos lectores. Tabla, plano, diagrama,
inspector y CSV leen esa misma propiedad. Una conexión persistida sin etiqueta
es error de migración/lectura, no motivo para volver a numerar silenciosamente.

El borrador nuevo muestra un identificador provisional claramente distinto de una
brida definitiva, por ejemplo “Pendiente de guardar”. No calcula HD-1004 en el
navegador: otra pestaña podría reservarlo antes. Tras guardar se recarga la lectura
confirmada o la acción devuelve la etiqueta asignada junto al mapa de UUID.

Los fixtures puramente históricos que verifican el algoritmo anterior deben
invocar su rutina de backfill explícita. Los fixtures de interfaz persistida
deben llevar etiqueta; no debilitar tests añadiendo un fallback silencioso.

Las plantillas no arrastran etiquetas de una sala. Sus INSERT a conexiones omiten
los tres campos para que el trigger asigne en destino. No se renumeran conexiones
ya existentes al aplicar una plantilla; las guardas actuales de sala vacía siguen.

## Pruebas y cierre de unidad

Dominio: persistida gana a orden/señal; borrador sin falsa etiqueta definitiva;
regresión de tabla, diagrama y exportación. Histórico: algoritmo congelado conserva
sus pruebas previas y añade fecha truncada/microsegundos y mezclas de señales.

Postgres desechable: instalación limpia, upgrade poblado y repetición; borrado de
primero/intermedio/último; cambio de señal; alta posterior sin reutilizar huecos;
dos INSERT concurrentes con unicidad; rollback posterior a reservar contador;
UPDATE directo de etiqueta rechazado; configuración única; copia de plantilla a
dos salas; preservación de cables legacy sin bocas y de parejas completas.

Prueba causal en copia: sustituir lectura por numeración dinámica debe fallar al
borrar/cambiar señal; quitar asignación atómica debe caer en concurrencia; reiniciar
contador en segunda migración debe fallar tras borrar el último cable. No contar
un fallo de infraestructura como detección.

Gate L2A: mapa UUID→etiqueta preservado y todas esas comprobaciones ejecutadas,
tipos/build/lint pertinentes y recorrido escritorio crear→guardar→borrar otro→
recargar→exportar. Móvil al cierre. Entregar diff, evidencia y revisión independiente
antes de sumar rosetas. L2A aprobado no equivale a L2 completo.

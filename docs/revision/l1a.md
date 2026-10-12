# L1A · Sincronización segura de puertos

08/09/2026. Aprobado por la tarea revisora en ronda 2, exclusivamente L1A.
No declara el gate L1 completo ni autoriza producción.

El revisor reprodujo base 14/14, variante sin validación CSV con dos fallos y
variante SQL anterior con once fallos; comprobó el manifiesto, lint y regeneración
aislada idéntica byte a byte. Crudos `revisor-l1a-*-ronda2.log` en la carpeta de
evidencia. Mi reproducción adicional: `revision-seed-puertos-ronda2.log`, 14/14.

## Contrato y cambios

La siembra conserva identidad de puerto CSV y fuente app, actualiza metadatos y
rechaza cambios incompatibles con bocas/conexiones existentes. No cambia esquema,
migraciones, dominio, pantallas, package.json ni bases compartidas.

- `scripts/generar-seed.mjs`: validación completa del CSV de puertos antes de
  escribir el archivo. Artículo no encontrado, campos obligatorios ausentes,
  duplicados y total/orden inválidos abortan, no se convierten en retiradas.
- `scripts/sql-sincronizar-puertos.mjs`: SQL generado para staging temporal,
  resolución exacta de artículos, locks, diagnóstico y UPSERT por artículo/nombre.
- `db/seed.sql`: regenerado exclusivamente por el generador.
- `scripts/verificar-seed-puertos.mjs`: verificador serial reproducible y variante
  causal `--sin-arreglo`, con copias de scripts/CSV y bases locales propias.

La transacción existente del seed incluye staging, comprobaciones y cambios.
La resolución SQL exige exactamente un artículo por fila; la unicidad actual
del catálogo impide duplicar su identidad, y la guarda también protege frente a
un destino inexistente. Se bloquea el catálogo de puertos para serializar sus
escrituras y sus filas por UUID para coordinar FK/bocas concurrentes.

Un puerto CSV existente se actualiza sin cambiar UUID. Un choque con fuente app
no actualiza nada, incluidos nota/capacidad. Solo se retira una fila CSV ausente
si no tiene referencias. Reducción de capacidad rechaza ordinales que quedarían
fuera y usos legacy cuyo ordinal es desconocido; no adivina una boca libre.

El diagnóstico enumera nombre/UUID del puerto, UUID de conexión de sala o
plantilla, nombre del propietario, lado, ordinal y nuevo total/retirada.
Consulta columnas legacy de `conexiones` y ambas tablas de bocas. El esquema
actual de `plantilla_conexiones` no tiene columnas legacy de puerto: sus
referencias de puerto están en `plantilla_conexion_bocas`; no se inventa una
referencia histórica de puerto para plantillas que solo conocen equipos.

## Reproducción y evidencia

```powershell
node scripts/verificar-seed-puertos.mjs --plan
node scripts/verificar-seed-puertos.mjs
node scripts/verificar-seed-puertos.mjs --sin-arreglo
node scripts/verificar-seed-puertos.mjs --sin-validacion-csv
npx eslint scripts/generar-seed.mjs scripts/sql-sincronizar-puertos.mjs scripts/verificar-seed-puertos.mjs
```

La variante sin arreglo **debe salir con error**: ejecuta las mismas pruebas
contra la estrategia anterior de borrar/reinsertar. Solo muta el helper en su
copia temporal y conserva generación/carga de fixtures. No revierte el checkout.
No usa output como entrada, `.env` ni `DATABASE_URL`. Requiere el Postgres de
Docker local `127.0.0.1:5433`; crea/elimina únicamente bases propias
`qa_seed_puertos_<UUID>`. Una terminación abrupta puede dejar su fixture; no
incluye limpieza por descubrimiento ni limpieza de restos ajenos.

Evidencia cruda bajo `output/plan40-20260908-083450/`:

| Archivo | Resultado |
|---|---|
| puertos-antes.log | Reproducción previa: resembrar dejó ambos puertos legacy en NULL; con bocas físicas falló 23503 en conexion_bocas_puerto_id_fkey. Fixture propio eliminado. |
| seed-puertos-base-ronda2.log | 14 pruebas, 14 correctas, 0 fallos. |
| seed-puertos-sin-arreglo-ronda2.log | 14 pruebas, 11 fallos y 3 correctas; salida 1 esperada. |
| seed-puertos-sin-validacion-ronda2.log | 14 pruebas, 2 fallos de validación CSV y 12 correctas; salida 1 esperada. |
| seed-puertos-eslint-ronda2.log | ESLint de los tres scripts, salida 0. |
| generar-seed-l1a-ronda2.log | Regeneración local: 144 puertos de 24 artículos. |

Las 14 pruebas incluyen UUID/puertos legacy, sala y plantilla con bocas, etiquetas
leídas por `identificadoresDeCable` real, nota/ampliación, precedencia app,
retirada y reducción incompatibles con diagnóstico, rollback de todas las tablas
públicas descubiertas, retirada sin uso, generación fallida sin sobrescribir
seed previo y resolución SQL fallida con rollback de una escritura anterior.

La prueba concurrente abre dos conexiones PostgreSQL: una mantiene la nueva
pareja física con ordinal 3 sin confirmar, otra ejecuta el seed que intenta
reducir a 2. Se observa `pg_stat_activity.wait_event_type = Lock`, se confirma el
alta y el seed rechaza la reducción enumerando la conexión; el total queda en 3.
La espera se verifica por estado real, con límite, no por asumir que un sleep
ha producido concurrencia.

La variante causal SQL rompe once pruebas específicas: identidad legacy, parejas
físicas, actualización estable, cuatro casos de retirada/reducción, retirada
selectiva, identidad en bordes int32, vaciado explícito y concurrencia. Tres
pruebas de resolución/carga/cabecera permanecen verdes.
Los fallos de FK bajo el comportamiento anterior son el defecto funcional que
se reproduce, no un fallo al crear la infraestructura o cargar los tests.

## Corrección para ronda 2

La primera revisión encontró dos entradas que podían sobrescribir seed antes de
fallar o retirar filas indebidamente: cabecera incorrecta sin datos y enteros
fuera de int32. La corrección valida las diez columnas de cabecera antes de leer
filas, rechaza columnas vacías/duplicadas o requeridas ausentes, y exige enteros
seguros dentro de PostgreSQL int32. Total empieza en 1; orden conserva su contrato
actual nullable y rango completo −2147483648…2147483647.

Pruebas ejecutadas: seis cabeceras inválidas y catorce valores inválidos de
total/orden, con comparación byte a byte del seed anterior tras cada rechazo.
Cuatro combinaciones válidas comprueban límites en PostgreSQL, incluidos orden
negativo, cero y NULL. Cabecera válida sin filas es un vaciado explícito: se
genera, pero sus retiradas siguen sometidas a referencias y precedencia app.
No se cambió el algoritmo SQL. Archivo CSV ausente conserva el comportamiento
previo de no sincronizar puertos; archivo presente vacío se rechaza.

La variante `--sin-validacion-csv` retira únicamente estas dos guardas en la
copia: fallan exactamente las pruebas de cabecera y de enteros al comprobar el
código de salida del generador, antes de aplicar el SQL inválido. Las otras doce
pruebas pasan. Los logs de primera ronda se conservan como evidencia histórica.

## Límites

Solo se acredita esta sincronización local. L1B (fichas/fuentes), L2 (extremos y
estabilidad de etiquetas ante borrar otros cables) y L3 siguen separados. Aquí
se comprueba que resembrar no cambia la etiqueta; no se afirma que el algoritmo
actual sobreviva a borrar otra conexión. La sincronización debe ejecutarse como
parte de la transacción del seed generado, no extrayendo sentencias sueltas.

# L1B · Persistencia de fichas técnicas

08/09/2026. Entrega para revisión independiente. Cubre persistencia y generación;
no acredita el recorrido visual ni la documentación completa del montaje EQ.

## Modelo y contrato implementado

`articulo_datos_tecnicos` referencia `articulos`: id UUID, unicidad artículo/clave,
seis tipos, tres estados, valor JSONB, procedencia documental, fecha de consulta,
puerto opcional y fuente CSV/app. No introduce otro catálogo.

El estado sin_documentar exige **SQL NULL**, no JSON null ni un falso booleano.
Parcial/verificado exigen valor, URL HTTPS sin credenciales, documento, apartado y
fecha finita. La función SQL `valor_dato_tecnico_valido` valida claves exactas,
campos y tipos del JSON de microfonía, alimentación, PoE, suministro, puerto y
restricción. Rechaza claves extra, enteros fraccionarios, valores negativos donde
no corresponden y null en campos obligatorios. Sigue el contrato Zod existente;
no se modificó esa biblioteca ni sus presentadores. Para procedencia se aplica
un contrato explícitamente más estrecho: nombre DNS ASCII (sin IP literal/IPv6),
puerto numérico 0…65535 opcional; SQL y generador rechazan autoridades malformadas.
La validación Zod existente se conserva además en el generador.

La FK compuesta `(puerto_id,articulo_id)` referencia `(puertos.id,articulo_id)`:
no basta que exista el puerto, debe pertenecer al mismo artículo. El índice
único auxiliar no modifica UUID ni otras relaciones de puertos. Artículos y
puertos documentados no se borran en cascada.

Archivos de persistencia:

- `db/migraciones/2026-09-fichas-tecnicas.sql`, idempotente y transaccional.
- `db/schema.sql`, mismo bloque para instalación limpia.
- `scripts/generar-seed.mjs`, integra el helper ya existente
  `scripts/sql-datos-tecnicos.mts` con `tsx/cjs/api`; sigue funcionando mediante
  `node scripts/generar-seed.mjs` en Windows.
- `data/catalogo-equipos.csv`: TABLE MICROPHONE PRO en la categoría existente
  MICRÓFONO, con uso y sedes vacíos. No se añade stock ni precio.
- `db/seed.sql`, regenerado por el generador, con 40 hechos documentados.

Con autorización coordinada se integraron las propuestas de `l1b-fuentes.md`:
posición RJ45 de control de cámara corregida/verificada, rótulo Samsung HDMI IN 1
(ARC), tres filas de puertos (dos HDMI y un RJ45 de Quad Camera, extremo RJ45 del
cable unido del micrófono), enlaces de sus tres hechos a puertos y restricción
parcial de identidad de cámara histórica. No se movieron ordinales/UUID de Codec
ni se atribuyó un SKU confirmado a unidades antiguas.

La cabecera de fichas debe tener sus trece columnas requeridas, sin duplicados ni
nombres vacíos, incluso cuando no hay filas. Un archivo presente vacío/malformado
no se interpreta como retirada. Una cabecera válida sin filas sí permite declarar
esa decisión. La validación Zod y de resolución se realiza antes de escribir seed;
la resolución SQL vuelve a comprobar artículo y puerto dentro de la transacción.

## Conservación y política de retirada

El UPSERT conserva id y respeta fuente app, incluido un choque con la misma
clave CSV. Retirar una fila del CSV conserva su registro, lo marca sin_documentar
y pone valor SQL NULL; conserva fuente documental, puerto e identidad.

Esa referencia de puerto sigue protegida aunque la fuente se haya retirado. El
sincronizador de puertos añade las fichas documentales afectadas al diagnóstico
de retirada: id, clave, artículo y puerto. Rechaza y revierte todo el seed en vez
de borrar procedencia o desprender la FK. Resolver esa referencia exige una
decisión explícita posterior; esta entrega no implementa un botón que borre o
reasigne hechos históricos. Cambiar notas/capacidad del puerto no actualiza un
hecho documental por inferencia: su fuente concreta mantiene su significado.

Este ajuste vive en `scripts/sql-sincronizar-puertos.mjs`. El seed actualizado
requiere aplicar primero la migración B; sin ella no se debe ejecutar la nueva
sincronización. No se ha aplicado nada a una base compartida o de producción.

## Verificación reproducible

```powershell
node scripts/verificar-fichas-tecnicas.mjs --plan
node scripts/verificar-fichas-tecnicas.mjs
node scripts/verificar-fichas-tecnicas.mjs --sin-guardas
node scripts/verificar-seed-puertos.mjs
```

El verificador B usa exclusivamente bases propias
`qa_fichas_tecnicas_<UUID>` en `127.0.0.1:5433`. No lee `.env` ni DATABASE_URL.
Copia scripts, CSV y las dos dependencias puras de ficha; conecta node_modules
mediante una junction que retira antes de borrar su carpeta temporal comprobada.
No descubre bases para eliminarlas ni limpia restos de otras ejecuciones.

La actualización se prueba desde el esquema del commit
`f38baa805a1868b7cad55bb97064386e9b5f8555`, con artículo, sala, equipos, puerto app
y conexión histórica con referencias. La migración se aplica dos veces antes del
seed, y otra vez sobre datos documentados. Se compara la identidad/contenido de
hechos y la conexión histórica tras todo el recorrido.

El verificador A también incluye ahora helper TS/runtime en su copia, y pone el
CSV de hechos de su fixture con cabecera válida sin filas para aislar la ocupación
de bocas. B prueba la integración real de los 40 hechos y las FK documentales;
no se confunde una fuente documental pendiente con la prueba A de cable físico.

Evidencia en `output/plan40-20260908-083450/`:

| Archivo | Resultado |
|---|---|
| fichas-base.log | 8 pruebas, 8 correctas: limpia, upgrade, repetición, fuente app, retirada, tipos, procedencia, FK, rollback e integración de retirada de puerto. |
| fichas-sin-guardas.log | Mismos 8 tests: 2 fallos y 6 correctas. |
| fichas-eslint.log | Lint de generador y verificadores, salida 0. |
| generar-seed-l1b.log | Regeneración local con artículo adicional y hechos documentados. |
| seed-puertos-integracion-b.log | Regresión A sobre infraestructura B. |

La variante causal elimina solo CHECK de JSON tipado y FK compuesta en SQL en
memoria. Fallan exactamente sus dos pruebas por ausencia del rechazo esperado;
no falla la carga, la creación de fixtures ni la generación. Todas las bases
propias de las ejecuciones terminadas se eliminan.

## Pendiente fuera de esta unidad

Validación de lector/página, escritorio y móvil por el integrador. La matriz
documental sigue teniendo los límites declarados en L1 investigación; almacenar
un dato parcial no lo convierte en verificado. No se han alterado lector,
componente ni tipos del dominio de ficha. El CSV de hechos se amplió únicamente
con las propuestas autorizadas y documentadas arriba. Sin autorización de
despliegue ni aprobación implícita de L1 completo.

## Corrección de ronda 2 (sustituye el contrato anterior donde difiere)

La fila CSV exige exactamente tantas celdas como su cabecera; una celda vacía
explícita sigue siendo válida. Una línea truncada ya no puede convertirse en un
puerto nulo. `concepto` es obligatorio y da nombre al hecho incluso sin valor;
las 40 filas adoptan las etiquetas de `l1b-conceptos-propuestos.md` sin cambiar
su estado documental. Los siete suministros con valor llevan `longitud_aplica`:
dos cables `true` y cinco equipos/accesorios `false`. Un legado sin esta decisión
usa `null`, nunca una inferencia por nombre. `false` exige longitud nula.

`puerto_fuente` es metadato de resolución de la entrada CSV: `csv` exige encontrar
el puerto en el CSV normalizado antes de escribir `seed.sql`; `app` permite una
referencia exclusivamente local que se resuelve dentro de la transacción y exige
`puertos.fuente='app'`. Un puerto CSV sobrescrito legítimamente desde la aplicación
sigue siendo resoluble por una entrada `csv`. Nombre y fuente se informan juntos,
o ambos quedan vacíos. Una referencia `app` inexistente no se puede validar sin
BD: el generador la declara explícitamente y SQL rechaza el lote sin escritura
parcial. Las fechas del año cero se rechazan también antes de escribir el seed.

La migración actualiza una tabla de ronda 1 sin perder id, fuente app, puerto,
valor previo o procedencia. Usa la referencia ya guardada para el concepto de un
suministro y la clave existente para los demás; añade `longitud_aplica=null`
cuando faltaba. El fixture histórico está congelado en
`scripts/fixtures/fichas-tecnicas-ronda1.sql`. Se aplicó dos veces la migración y
se compararon todas las columnas contra los valores previos más esos dos cambios
de metadatos esperados. El esquema limpio y la migración contienen el mismo bloque.

Evidencia ejecutada, todas las bases temporales propias eliminadas:

| Archivo bajo output/plan40-20260908-083450 | Resultado |
|---|---|
| fichas-base-ronda2.log | 12/12; añade truncamiento/exceso, puerto CSV, app explícito y upgrade B histórico. |
| fichas-csv-causal-ronda2.log | `--sin-validacion-csv`: 4 fallos, 8 correctas; elimina las tres correcciones de entrada solo en una copia temporal. |
| fichas-sql-causal-ronda2.log | `--sin-guardas`: 2 fallos, 10 correctas; elimina CHECK JSON y FK compuesta solo en SQL en memoria. |
| fichas-eslint-ronda2.log | Lint de los cinco scripts de persistencia, salida 0. |
| generar-seed-l1b-ronda2.log | Seed regenerado desde los CSV corregidos, salida 0. |
| seed-puertos-integracion-ronda2.log | Regresión L1A: 14/14, salida 0. |

La retirada de puerto con ficha vigente se rechaza ahora antes de generar y
conserva el seed byte a byte. Si la ficha ya fue retirada del CSV, la referencia
histórica permanece y el rechazo SQL conserva el diagnóstico con UUID/clave y
revierte el estado completo de todas las tablas públicas. La prueba de puerto
`app` compara igualmente toda la BD antes/después de un rechazo. Ninguna guarda
se retiró del código entregable para conseguir estos resultados; los mutantes
se limitan a carpetas temporales propias.

Reproducción adicional: `node scripts/verificar-fichas-tecnicas.mjs --sin-validacion-csv`.
Los modos causales deben terminar con código 1; la ejecución normal debe terminar
con código 0. La validación visual y el gate conjunto siguen siendo del integrador.

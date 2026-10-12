# L0 · Migraciones locales reproducibles

Fecha: 08/09/2026. Entrega para revisión, sin aprobación atribuida.

## Contrato y artefacto

`scripts/verificar-migraciones-plan40.mjs` verifica en Postgres real las migraciones
`2026-09-trazabilidad-compras.sql` y `2026-09-seguimiento-instalacion.sql`.
No modifica esas migraciones ni el esquema del proyecto.

Ejecutar desde el repositorio:

```powershell
node scripts/verificar-migraciones-plan40.mjs --plan
node scripts/verificar-migraciones-plan40.mjs --mutaciones
```

Requiere dependencias instaladas, Git con el commit
`f38baa805a1868b7cad55bb97064386e9b5f8555` disponible y el Postgres de desarrollo
en `127.0.0.1:5433`, con permiso para crear bases. La referencia se fija para que
el ensayo no cambie silenciosamente después del siguiente commit.
No carga `.env` ni utiliza `DATABASE_URL`.

Solo crea bases `qa_plan40_migracion_<UUID>` y elimina los nombres que la misma
ejecución creó con éxito. No descubre bases para limpiarlas ni usa borrado forzado.
Si se interrumpe el proceso de forma abrupta puede quedar su fixture: no incorpora
limpieza global. Las credenciales locales de Docker permanecen en el script, igual
que en los verificadores locales existentes; no se imprimen en la evidencia.

## Evidencia ejecutada

Log crudo vigente de corrección para ronda 2:
`output/plan40-20260908-083450/migraciones-ronda2.log`.
El log `migraciones.log` conserva la primera ejecución, cuya cobertura de las
columnas de destino de pedido fue rechazada en revisión por incompleta.

- Instalación desde `db/schema.sql` actual; ambas migraciones aplicadas dos veces.
- Actualización desde el esquema del commit anterior, cargando pedidos en sus
  cuatro estados, líneas con precio y recepción parcial, movimiento histórico,
  sala, usuario, técnico, visita previa e instalación histórica.
- Comparación de todas las columnas previas de diez tablas; el backfill se
  comprueba aparte con fechas esperadas explícitas. Borradores permanecen sin
  fecha de compra y los pedidos sin fecha usan la fecha de creación.
- No inventa autor de compra, enlace de recepción, plan, prueba final ni auditoría
  para los históricos.
- Tras migrar, inserta un plan, prueba, auditoría y recepción vinculada; las claves
  foráneas impiden borrar la línea/recepción referenciada y el índice único impide
  duplicar recepción y línea.
- Segunda aplicación: comparación completa del contenido de todas las tablas
  públicas descubiertas en la base, incluida la auditoría nueva.
- En instalación limpia y actualización, aserciones explícitas de existencia,
  tipo y nulabilidad de `pedidos.entrega_prevista` (date) y
  `pedidos.ubicacion_prevista_id` (uuid), más FK a `ubicaciones.id` con NO ACTION.
  Se guarda y relee un pedido con fecha y ubicación sintéticas reales, se exige
  rechazo `23503` de una ubicación inexistente y se comprueba que ese rechazo y
  la segunda aplicación conserven ambos valores.
- Mutación exclusivamente en memoria: al quitar el `UPDATE` de backfill, cae una
  aserción concreta sobre las fechas históricas (`ERR_ASSERTION`). No se confunde
  un error de carga o SQL con una mutación detectada.
- Segunda mutación exclusivamente en memoria: quitar los dos ALTER de destino
  del pedido debe fallar por `ERR_ASSERTION` en el contrato de columnas antes de
  ejecutar una escritura que las use. Un error SQL o de infraestructura no sirve
  como evidencia de mutación detectada.
- Base: **34 comprobaciones correctas** en los dos escenarios completos.
  Mutaciones: **dos fallos de aserción esperados detectados**, con 13 y 1
  comprobaciones correctas previas respectivamente. Esas 14 comprobaciones de
  ejecución parcial no se suman al total de la base. Los cuatro fixtures de esta
  ejecución quedaron eliminados.
- `npx eslint scripts/verificar-migraciones-plan40.mjs`: salida 0.

El log incluye las huellas SHA256 del esquema anterior, actual y las migraciones.
La evidencia cubre estos datos sintéticos y la preservación/idempotencia local;
no valida una migración de producción ni sustituye la revisión independiente.

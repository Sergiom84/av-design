# L2B · Acciones, conversión y copias

08/09/2026. Integración servidor local; pendiente de QA visual del director,
regresión completa adaptada y revisión independiente. No cierra L2B por sí sola.

## Comportamiento

El editor recibe `origen` y `destino` como extremos tipados: equipo con puerto y
ordinal, o roseta con UUID de boca. `posiciones_rosetas` guarda solo coordenadas
del esquema. El servidor valida catálogo, propietario, capacidad, ocupación y
versión; comparte bloqueo y transacción con los equipos nuevos y las bajas.
Las parejas sustituidas se retiran juntas antes de insertar el resultado, para
permitir intercambios de bocas sin una colisión intermedia. Cambiar señal/ruta
conserva identidad, brida, longitud manual y puntos.

`guardarBocasToma` admite capacidad NULL o 1..1000 y exactamente esas bocas con
señal y conector. Conserva UUID por ordinal, código de referencia y XYZ; la
confirmación de código es explícita. Rechaza versión antigua, propietario ajeno,
obra cerrada y retirada de una boca ocupada sin escrituras parciales. Devuelve
resultado estructurado para que la UI conserve los campos ante un error.

`convertirAsignacionToma` exige la roseta previamente asignada al equipo y las
dos bocas elegidas, junto con cable, señal, ruta y manual. Puede enlazar una
conexión física equivalente ya existente. Si el vínculo ya existe y todos los
datos son idénticos, devuelve ese ID y la versión vigente incluso cuando el
segundo envío trae la versión anterior. Una diferencia no sobrescribe cable ni
recorrido. Borrar el cable deja la asignación pendiente.

Los formularios de Cableado aceptan `toma_boca_origen_id` y
`toma_boca_destino_id`; los equipos se leen de la conexión existente al editar.
Cada escritura normal guarda las dos bocas en una transacción. Se sustituyó la
invalidación implícita antigua por escritura explícita de la pareja completa.

Un helper único implementa sala→plantilla y las dos entradas plantilla→sala.
Exige documentales resueltas, conexiones completas y rosetas con tres ejes o
ninguno. Rechaza la copia íntegra si falta un extremo, incluso si pertenecía a
una línea opcional excluida. Remapea equipos, placas y bocas, conserva longitud
manual, puntos, rutas, esquema y XYZ; los códigos quedan como referencia y sin
confirmar. Verifica límites del destino y revierte lo insertado si algo queda
fuera. Los cables reciben etiquetas del destino por L2A.

`anadirTiradaPlantilla` acepta `documental_id` y `conexion_existente_id`
explícitos. Una histórica elegida se documenta manteniendo su UUID y se enlaza
en la misma transacción. Nunca se elige por parecido; si quedan históricas y
no se elige una, crear otra se rechaza. La misma operación acepta extremos
`roseta:<UUID>` o `linea:puerto:ordinal`.

El plano valida contra las posiciones guardadas: una histórica parcial
inalterada se conserva; editar sus coordenadas exige tres ejes o ninguno. Los
errores diferidos SQL revierten todo antes de devolver el rechazo.

## Artefactos

- `src/app/acciones.ts` y `src/app/acciones-diagrama.ts`.
- `src/lib/escritura-conexiones.ts`: contrato Zod, bloqueo y escritura de pareja.
- `src/lib/copiar-conexiones.ts`: guardas y copia bidireccional compartida.
- `scripts/ejecutar-servidor-rosetas.mjs` y
  `scripts/verificar-servidor-rosetas.mts`.
- `scripts/verificar-editor-conexiones.mts`, fixture adaptada al contrato tipado.

`guardarParametros` y lectores/UI pertenecen al director; no se atribuyen a esta
unidad. El resto de verificadores antiguos se está adaptando a la prohibición
de crear conexiones vacías y requiere ejecutar de nuevo su regresión.

## Evidencia ejecutada

Crudos: `output/plan40-20260908-083450/`.

| Gate | Resultado | Archivo |
|---|---|---|
| `node scripts/ejecutar-servidor-rosetas.mjs` | 11/11, exit 0 | `l2b-servidor-base.log` |
| `--sin-version-capacidad` | 1 fallo / 10 pasan, exit 1 esperado | `l2b-servidor-causal-version.log` |
| `--sin-manual-copia` | 3 fallos / 8 pasan, exit 1 esperado | `l2b-servidor-causal-manual.log` |
| `--sin-pendientes` | 1 fallo / 10 pasan, exit 1 esperado | `l2b-servidor-causal-pendientes.log` |
| `verificar-base-plan40.mjs --solo=editor-conexiones` | 26/26, exit 0 | `l2b-editor-base.log` y carpeta de base indicada en ese log |
| `tsc --noEmit --incremental false` | exit 0 en fuente integrada | `l2b-servidor-tipos.log` |
| ESLint de las acciones, helpers y verificadores de esta unidad | exit 0 | `l2b-servidor-lint.log` |

El wrapper servidor crea y elimina solo `qa_servidor_rosetas_<UUID>` en
`127.0.0.1:5433`; los mutantes copian el código a una carpeta temporal propia y
alteran allí una guarda o la transmisión de manual. El árbol compartido no se
revierte ni se manipulan bases ajenas. Se ejecutan las acciones reales con
PostgreSQL; solo se sustituyen en memoria las APIs de navegación/revalidación
que requieren una petición Next.

Las once pruebas comprueban capacidad e identidad, editor y XYZ, conversión
idempotente, ataque con boca ajena y rollback de altas, las tres copias,
documentales pendientes, rollback posterior a copiar infraestructura, resolución
explícita, borrado y obra cerrada. No acreditan todavía un navegador ni permisos
con una sesión de usuario real; corresponden al QA y al gate integral siguientes.

# L2B · Mapa previo de cálculo

08/09/2026. Solo lectura, mientras L2A está en revisión. No implementa ni
aprueba el cálculo de rosetas.

`calcularConexion` exige hoy dos equipos antes de comprobar longitud manual.
Recorridos, polilínea, holguras y formatos están en `calculo-cable.ts`. El núcleo
ya acepta `Punto` en `calcularRecorrido` y `longitudPolilinea`: se puede reutilizar
sin fabricar un equipo para una roseta. La entrada superior necesita extremos
resueltos con identidad, nombre, posición y criterio de holgura.

Invariantes para implementación:

- Identidad desconocida sigue siendo error; longitud manual no legitima una
  referencia ajena o inexistente. Una identidad válida con posición desconocida
  sí admite longitud manual válida, que tiene precedencia sobre ruta y puntos.
- Para rosetas, comprobar tres ejes finitos explícitos. `(0,0,0)` es medida;
  cualquier eje nulo mantiene posición desconocida y sus datos parciales.
- No sustituir extremos desconocidos por los puntos intermedios ni por cero.
  Sin manual, faltar posición o criterio de holgura produce cálculo pendiente
  con causa concreta. La salida nula por sí sola no explica qué hay que completar.
- Conservar la regresión equipo/equipo y su marca de posición estimada. El
  lector actual construye `posicion` de equipo con valores cero si falta un eje;
  no extender esa convención a rosetas ni cambiar ahora la fórmula histórica.
- No modificar la selección comercial en este lote: cuando se superan todos
  los tamaños disponibles, devuelve el mayor. Su insuficiencia debe hacerse
  explícita en L4, según el inventario previo del asistente.

Radios que deben pasar el contexto de tomas al cálculo: `datos-ficha.ts`,
`datos-almacen.ts` y `components/diagrama/editor-conexiones.tsx`; la tabla y el
croquis consumen después los mismos resultados. Conexión pendiente sigue visible
en tabla/revisión, aunque no se pueda sumar todavía a metros calculados.

`obtenerParametros` solo recorre las holguras que tienen defecto; no leería una
clave nueva ausente de ese objeto. `parametros.valor` es NOT NULL y
`guardarParametros` solo actualiza filas existentes. Por tanto, añadir un input
sin cambiar lectura/guardado no configuraría realmente la holgura de roseta.
Representación propuesta: ausencia de la fila `holgura_roseta` = criterio
desconocido; presentar input vacío y crear/actualizar esa clave únicamente con
un valor explícito válido. No sembrar cero ni ensanchar la columna a nullable.
Si el flujo admite vaciarla, debe eliminar solo esa clave, conservando las demás.

Pruebas necesarias: igualdad exacta equipo/equipo, posición cero, cada eje nulo,
parcial conservado, manual con posición desconocida, puntos con extremo ausente,
holgura ausente frente a cero explícito, margen, rutas y separación XYZ/esquema.
Pruebas de integración deben verificar que los consumidores no omiten la
conexión pendiente ni cuentan otra vez la asignación documental de toma.

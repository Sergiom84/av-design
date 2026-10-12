# L2B · Lectores, plano y documentación

Integración local en curso, 08/09/2026; no es aprobación del lote.

Ambos lectores de sala construyen el detalle de extremos con un helper común.
Una roseta conserva UUID de boca y equipo nulo. Un detalle completo incompleto
se rechaza en lectura; el legado se identifica explícitamente. Las bocas de
cada placa se consultan por sala. La ficha, tabla y necesidad de almacén pasan
los mapas de rosetas y puertos al mismo cálculo puro.

El borrador del plano conserva coordenadas históricas parciales. Moverlo no
inventa Z; se pueden rellenar X, Y y Z sucesivamente. Vaciar expresamente un
eje retira la posición completa. Las bocas y su documentación se conservan al
construir la escena del plano. El inspector ofrece documentar capacidad,
señal/conector por boca y comprobar el código, con versión de sala. Exige
guardar/descartar primero los cambios geométricos. La acción de servidor
está en integración por su responsable; falta comprobar este formulario en UI.

Holgura de roseta ausente sigue siendo null. Parámetros permite escribir la
primera decisión o retirar exclusivamente esa clave para volver a desconocida.
No cambia el resto de holguras ni se siembra un valor supuesto.

Plantillas: lectura de conexiones con left joins para conservar extremos de
roseta; listado de tiradas documentales pendientes, selección explícita de
documental/conexión histórica/bocas en el formulario. Acción y copia siguen
pendientes de integración. No se declara cerrado el circuito por tener UI.

Evidencia ejecutada por el director:

- Dominio delegado reproducido: 168/168 (`root-l2b-dominio.log`).
- Plano/lectores: 142/142 (`l2b-plano-lectores.log`).
- Documentos, rutas, plano y revisión: 167/167 (`l2b-consumidores-intermedio.log`).
- `verificar-mutaciones-plano-rosetas.mjs`: dos casos en copia aislada; base
  dos correctos, inventar altura causa dos fallos y borrar ejes al escribir
  causa uno. Crudos `l2b-causal-plano-*.log`. El primer intento del medidor
  esperaba un fallo de altura; la ejecución acreditó dos y se corrigió el
  recuento del medidor, sin tocar aserciones de los casos.
- ESLint focalizado: salida 0. Comprobación global inicial de tipos detecta
  consumidores pendientes de adaptar; no acredita compilación global.

Los logs están en `output/plan40-20260908-083450/`. Revisión independiente
asignada con contrato, artefactos y evidencia, máximo dos rondas.

# L3A · corrección de lectura concurrente, ronda 2

Contrato: P2 del dictamen independiente
`output/revisor-plan40-01a080e5/l3a/dictamen.md`, junto al contrato L3A original.
La respuesta debe representar una revisión coherente de equipos, suministros
y vínculos, también cuando un alta confirma entre consultas del lector.
No omitir piezas, inventar datos ni considerar suficiente una TX READ COMMITTED.

Artefacto y evidencia: `output/plan40-l3a-correccion-lectura-20260908/` (E).
Manifiesto E/manifiesto-entrega.json y delta E/cambios-desde-l3a.json frente
al manifiesto467 de primera entrega. El artefacto anterior se preserva.

## Cambios

- `obtenerSala` ejecuta su lectura completa en una transacción READ ONLY con
  aislamiento REPEATABLE READ. Sala, equipos, mobiliario, conexiones, rosetas,
  catálogo, puertos, suministros y vínculos usan esa misma transacción.
  `puertosDeArticulos` recibe la consulta de esa instantánea; el lector de
  suministros recibe la transacción y no abre una conexión aparte.
- `fichaConAlmacen` lee una vez el montaje y lo pasa a ficha y faltantes. Estos
  lectores aceptan la sala ya leída y comprueban su identificador. La logística
  no vuelve a leer el montaje ni mezcla otra revisión en la misma respuesta.
  Stock, visitas y cargas conservan sus lecturas operativas existentes.
- No se modifican tablas, migraciones, fórmulas, datos CSV ni interfaz.

## Evidencia ejecutada

1. Reproductor original del revisor sin modificar, ANTES de corregir: exit1,
   respuesta equipos0/kit1/vínculos3. Log `reproductor-original-antes.log`.
2. `scripts/verificar-lectura-kit.mts` deriva de ese reproductor. La única
   adaptación de instrumentación es envolver también la consulta de la nueva
   transacción: el proxy anterior solo interceptaba la conexión exterior y no
   alcanzaría la pausa. Se siguen devolviendo las filas reales, sin alterarlas.
   Se amplía a sala, ficha y logística y a pausas tras equipos, suministros o
   vínculos. Se endurece la aceptación: respuesta anterior0/0/0/necesidad0;
   lectura nueva3/1/3/necesidad1, con BD ya confirmada3/1/3 antes de reanudar.
3. Al ampliar a `fichaConAlmacen`, antes de reutilizar la sala se reprodujo una
   segunda incoherencia: ficha sin necesidad, faltantes con kit1. Log
   `logistica-antes-reuso.log`; corregida en el mismo radio del hallazgo.
4. `node scripts/ejecutar-lectura-kit.mjs`: 9/9 casos, fixtures UUID locales
   seriales y eliminadas. `lectura-base.log`.
5. Copia aislada `--read-committed`: 6 fallos de aserción, cero timeout de
   proceso. `lectura-causal.log`. Copia `--sin-reuso`: 3 fallos de aserción por
   discrepancia ficha/logística. `logistica-causal.log`. No se modificó el árbol
   real para estas variantes; sus junctions y copias propias se retiraron.
6. Suministros16/16; generales755/755; build, tipos y eslint src/scripts exit0.
   Logs en E. Se corrigieron tipos del nuevo ensayo para compilarlo bajo las
   reglas existentes, sin supresiones ni cambios de configuración.

La evidencia visual y las demás regresiones de la primera entrega mantienen
su atribución al ejecutor; no se presenta un nuevo recorrido visual porque
esta corrección no modifica componentes ni estilos. El revisor conserva su
reproducción propia de desktop y del problema original.

## Traspaso

No hay agentes ni pruebas del ejecutor en curso al enviar esta corrección.
Solo bases propias locales desechables; nada en base compartida o producción.
Sin commit, push, merge ni despliegue. Se devuelve exclusividad al revisor
`01a080e5-20d4-7191-b610-82ac1a263b11` para el dictamen de ronda2.
No se reinicia el contador de rondas. L3A aún no se declara aprobado; L3B y
plan40 continúan pendientes según sus gates.

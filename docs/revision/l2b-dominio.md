# L2B · Dominio puro y cálculo

08/09/2026. Entrega de dominio, sin acreditar todavía integración SQL, interfaz ni copias.

`Conexion.detalle` distingue legado de pareja completa. Cada extremo completo contiene
una boca física de equipo o el UUID de una boca de roseta. `TomaRed` incorpora
capacidad documentada nullable, bocas, confirmación/referencia del código y coordenadas
del esquema independientes de XYZ. Los lectores deben construir el detalle explícito.

`extremos-conexion.ts` resuelve identidad, nombre, conector, boca, señal, posición y
holgura. La posición de roseta exige los tres ejes finitos: cero es conocido, cualquier
eje nulo permanece desconocido. No se inventan equipos ni ordinales. La holgura de
roseta por defecto es null. Manual positiva finita manda después de validar identidad,
aunque posición o holgura sean desconocidas. Sin manual, esas ausencias impiden cálculo
y `diagnosticarCalculoConexion` devuelve causas concretas. El sexto argumento del
cálculo contiene los mapas de tomas y puertos; los consumidores de conexiones completas
deben aportarlos.

La tabla mantiene una fila por conexión, muestra boca de roseta y recibe
`avisosCalculo`. El lienzo conserva bloques de roseta separados de equipos y claves
`roseta:<UUID boca>`; una conexión legacy se cuenta como no dibujable. El diagrama
impreso agrega `EscenaDiagrama.rosetas` y `EntradaDiagrama.tomas`. El renderer debe
pintar esas rosetas. El croquis puede anclar una tirada a XYZ completos de la toma.

Evidencia ejecutada:

- 168/168 pruebas en extremos, cálculo, tabla, diagrama y croquis. Crudo:
  `output/plan40-20260908-083450/l2b-dominio-base.log`.
- ESLint de los once archivos de implementación/pruebas modificados: salida 0.
- Comprobación de tipos focalizada: sin diagnósticos en archivos de este radio;
  el conjunto requiere adaptar consumidores y fixtures ajenos por el contrato nuevo.
- Causales en copias aisladas, mismas 12 pruebas de extremos: base 12/12;
  convertir coordenadas ausentes en cero provoca 3 fallos; holgura null a cero,
  2 fallos; eliminar pertenencia de roseta a sala, 1 fallo; omitir rosetas del
  esquema, 1 fallo. Todos los mutantes salen 1 por aserciones de aceptación.
  Copias y crudos: `output/l2b-causal-85d3248214b64dbfa1142abbfa162996/`.

Dos fixtures del diagrama que afirmaban ancla física omitiendo ordinal se han
completado con ordinal 1 explícito. Sus aserciones no cambian. Los fixtures históricos
restantes declaran estado legacy. No se ha cambiado la selección comercial ni la
fórmula histórica de rutas/holguras de equipos. Sin operaciones de BD o Git.

# L2B · Editor de conexiones y presentación

El payload de cada alta/cambio contiene `origen` y `destino` discriminados. Ya no
manda seis campos de bocas de equipo. Una selección incompleta se conserva solamente
en el borrador y no se transmite. Cambiar extremos/cable conserva longitud manual y
puntos porque esos campos no pertenecen a este payload.

El lienzo presenta equipos y rosetas como clases distintas de bloque visual. Comparte
clic, arrastre de boca, desplazamiento por cabecera y flechas. La ocupación conserva
la boca de roseta exacta; la conexión legacy sigue visible en el selector de pendientes.
El inspector ofrece las bocas documentadas de cada toma, identifica placa/boca y
expone las causas de cálculo pendiente. Las posiciones del esquema se envían en
`posiciones_rosetas` y se descartan/consolidan con el resto del borrador. El mapa de
IDs temporales también se aplica al extremo de equipo dentro del detalle completo;
el ID de boca de roseta no se cambia.

La página recibe tomas del lector común. El renderer del esquema imprimible dibuja
`EscenaDiagrama.rosetas`; el integrador debe pasar tomas en las otras rutas impresas.
El código de toma sin confirmar se señala en el lienzo. No hay alta de placas aquí:
la capacidad y las bocas se documentan en Plano.

Evidencia ejecutada, 08/09/2026:

- Protocolo y todos los DOM de `components/diagrama`: 38/38. Crudo
  `output/plan40-20260908-083450/l2b-editor-base.log`.
- ESLint del protocolo, pruebas, componentes y página: salida 0.
- Causales en copias propias: 18/18 base del hook/lienzo; omitir posiciones de
  rosetas provoca un fallo, omitir remapeo del extremo temporal uno y omitir tarjetas
  de roseta uno. Salidas 1 por aserciones de aceptación. Copias y crudos en
  `output/l2b-editor-causal-531ab402704a495fb4f5d2c4834ab85e/`.
- Los fixtures del protocolo se adaptan a la pareja discriminada, con las mismas
  aserciones de ordinales. El fixture del inspector histórico incorpora etiquetas
  persistidas reales para el escenario que afirma cubrir.

La ejecución DOM no sustituye el recorrido de navegador. SQL, concurrencia, copias y
guardado de bocas de Plano corresponden al lote de integración. Sin BD, Git o producción.

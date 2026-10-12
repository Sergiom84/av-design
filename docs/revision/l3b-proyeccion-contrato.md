# L3B · Primera unidad: proyección de cobertura

08/09/2026. Ejecutor `01a080e4-d9a1-7500-ae26-d93eccbd139d`.
Base aprobada: L3A, manifiesto470 y dictamen independiente de ronda2.

Resultado exacto: una función pura calcula pedido, recibido, reserva activa,
servido y cobertura física para cada suministro concreto de demanda uno.
Destinatario y motivo: lectores y operaciones de L3B necesitan una regla común
que no asigne una salida a dos kits iguales ni confunda recepción con servicio.
Éxito medible: matriz A/B, devolución ligada a salida, reserva consumida, baja
y movimiento histórico sin atribuir; pruebas negativas y causal ejecutadas.
Alcance autorizado: módulo puro, sus pruebas y evidencia reproducible.
Fuera de alcance de este corte: tablas, migraciones, atribución persistida,
acciones, lectores operativos, interfaz y apertura de operaciones de kits.
Ficheros protegidos: todo el árbol anterior; no restaurar desde HEAD.
Comprobaciones obligatorias: tests focales, causal en copia, suite general,
build, tipos y lint src/scripts. Verificar delta del manifiesto aprobado.
Acciones que requieren autorización: Git/publicación/producción, no realizadas.

## Contrato de cálculo

- La clave es suministro_id, nunca artículo+sala. Dos suministros del mismo
  artículo conservan balances independientes.
- Pedido y recibido se presentan separados. Recibir no reserva ni sirve.
- Reservado suma solo atribuciones de reservas activas. Liberada y servida
  conservan su historia pero dejan de sumar cobertura reservada.
- Servido suma salidas atribuidas y resta devoluciones atribuidas vinculadas
  a su salida original, del mismo suministro. Una baja no vuelve a restar.
- Cobertura física = reservado + servido. Pendiente = demanda1 menos cobertura.
  Pendiente de recibir = pedido menos recibido. Son magnitudes diferentes.
- Cantidades de kit enteras, positivas; recibido admite cero. Exceso, identidad
  ausente o referencia cruzada se rechazan; no se ocultan mediante clamp.
- Históricos sin atribución producen aviso separado con identidad y cantidad.
  No dan cobertura por coincidencia de artículo.

Esta función valida su entrada, pero no acredita límites entre registros
canónicos ni concurrencia: esas garantías requieren la persistencia de B1.
Tampoco acredita permisos, recepción idempotente, stock utilizable o custodia.
Las guardas L3A continúan sin cambios. El llamador futuro debe leer una
instantánea coherente y suministros activos; no se conecta aquí un lector parcial.

## Secuencia conservada

La separación B1/B2 anunciada se conserva: B1 persistencia y lectura; B2
integración de compra/reserva/carga. Se entrega primero este subcorte puro de
B1 para revisar la regla antes de persistirla. No equivale a B1 ni L3B completo,
no sustituye ningún requisito de `l3-contrato-ejecucion.md` y no reinicia las
rondas de una corrección del mismo artefacto. Máximo dos rondas de revisión.

Después: integridad persistida y atribución conservativa explícita en bases QA
UUID locales, con límites del padre, guardas inversas, carreras y rollback.
Solo después se integran operaciones atómicas y lectores reales. L3E conserva
custodia parcial y retorno completo; L5 sigue siendo prerrequisito de retirada
poscompra. Plan40 permanece abierto.

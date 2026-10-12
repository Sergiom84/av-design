# L2B · Contrato de integración

08/09/2026. Concreta el diseño aprobado en `l2-diseno-previo.md`, después de
aprobar L2A. No acredita todavía implementación.

- Se conserva `Conexion` con columnas de compatibilidad de equipo nullable.
  El detalle se representa por estado discriminado legacy/completo; cada extremo
  completo es equipo con puerto/ordinal o roseta con UUID de boca. No UUID
  polimórficos ni equipos ficticios. Los lectores construyen ese detalle una vez.
- `tomas_red` conserva su código original. Añade `codigo_referencia` y
  `codigo_confirmado`; la copia lleva el código fuente como referencia y queda
  sin confirmar. No se transfieren autorías/verificaciones. No se certifican
  retroactivamente códigos físicos por el mero backfill.
- Capacidad desconocida = NULL y ninguna boca. Al documentar N se requieren
  N bocas con ordinales 1..N, señal y conector expresamente indicados. Mantener
  identificadores ocupados al ampliar; reducir o retirar una ocupada se rechaza.
- La posición de bloque de roseta puede almacenarse en `esquema_x/esquema_y`
  nullable en pareja, independiente de XYZ. El guardado comparte transacción y
  versión con el diagrama, igual que los bloques de equipo.
- Nueva conexión siempre completa. Legacy se reconoce solo al migrar las que
  ya existían. Copiar una sala/plantilla con tiradas sin bocas rechaza el lote y
  lista cuáles requieren documentar; no omite tiradas ni inventa sus ordinales.
- La copia conserva longitud manual y puntos de paso en las tres rutas. Añadir
  longitud manual a plantilla si el modelo actual no la representa. Las
  etiquetas de cable siguen perteneciendo a cada sala, según L2A.
- Holgura de roseta configurable, sin valor sembrado: fila ausente significa
  criterio pendiente, no cero. El formulario y acción deben poder guardar la
  primera decisión explícita. No cambiar las demás holguras ni fórmula histórica.
- Altas/ediciones nuevas de XYZ exigen tres ejes o ninguno. Un histórico parcial
  se conserva si no se modifica su posición; para modificarla se completa
  explícitamente. Ni mover ni editar completa por defecto la altura con cero.
- Copiar también es dar de alta: si una roseta histórica contiene XYZ parciales,
  la copia se rechaza íntegra e identifica las rosetas que necesitan completar
  coordenadas. No existe bypass SQL para copiar parciales ni se convierten en
  posiciones vacías o en ceros. Decisión de integración del director, 08/09/2026.

SQL/guardas/copias se integran en serie con responsable único de BD; el dominio
puro puede desarrollarse en paralelo contra los contratos acordados. Ninguna
revisión de código sustituye los ensayos de migración, concurrencia y navegador.

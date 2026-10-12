# L2A · Lectura y borrador de etiquetas

08/09/2026. Unidad de lectura/dominio; no ejecuta PostgreSQL, migraciones ni seed.

`identificadoresDeCable` presenta `Conexion.etiqueta_cable`; una alta aún sin
confirmar muestra `Pendiente de guardar`. `datos.ts` y `datos-plano.ts` exigen una
etiqueta no vacía al mapear cada fila persistida, con error explícito de migración
si falta. La rutina anterior permanece intacta y exportada como
`identificadoresHistoricosDeCable`, exclusivamente para backfill y sus pruebas.

El guardado del editor recibe `etiquetas: Record<string,string>` por UUID
confirmado. Tras remapear los temporales, incorpora las etiquetas a borrador y
base para que descartar también las conserve. Una respuesta sin etiqueta no
consolida ni permite repetir una posible alta confirmada: conserva el borrador y
requiere recargar. El servidor implementa ese mapa en la misma transacción
(unidad del integrador).

Los fixtures de tabla, diagrama y componentes incorporan etiquetas persistidas.
Las cinco pruebas históricas originales siguen comprobando el algoritmo anterior;
se añade el caso de microsegundos opuestos al orden UUID tras el mapeo Date del
lector. Las pruebas nuevas cubren huecos, cambio de señal y orden, provisional,
error de lectura, tabla/CSV, confirmación del hook y respuesta incompleta.

## Evidencia ejecutada

- 89/89 en `cable-schedule.test.ts`, `diagrama.test.ts`,
  `esquema-sala.test.tsx`, `use-editor-conexiones.test.tsx` y
  `editor-conexiones.test.tsx`.
- `npx.cmd tsc --noEmit --incremental false`: salida 0.
- ESLint de los once archivos de esta unidad: salida 0.
- Causal en copia temporal aislada: sustituir únicamente la lectura persistida
  por la numeración histórica produce **5 fallos y 35 aprobados**, salida 1.
  Fallan borrado, señal/orden, provisional, tabla/CSV y confirmación del editor.
  La copia se elimina tras retirar su enlace de node_modules; el árbol compartido
  no se revierte.

Comandos y registros reproducibles en `output/plan40-20260908-083450/`:
`l2a-lectura-base.log`, `l2a-lectura-causal.log`, `causal-lectura-l2a.mjs`.
El integrador incorporó el verificador a `scripts/verificar-mutaciones-etiquetas-lectura.mjs`:
sin opciones ejecuta la base; `--sin-arreglo` espera salida 1. `--plan` describe
su aislamiento. El archivo original bajo output queda solo como evidencia.

No se alteran cálculo físico, coordenadas, bocas ni ordenamientos de rutas. Esta
unidad no acredita todavía la migración real, concurrencia PostgreSQL ni recorrido
de navegador: pertenecen al gate integrado L2A.

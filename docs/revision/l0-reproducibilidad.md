# L0 · reproducibilidad de verificadores

Fecha: 08/09/2026. Estado: entregado para revisión, sin aprobación del lote.

## Contrato y artefacto

Invocar plano, compras y seguimiento desde archivos entregables del proyecto,
sin depender de wrappers ignorados bajo `output/`. Conservar dominio, datos
previos y temporales existentes. El director conserva el árbol inicial en
`output/plan40-20260908-083450`.

Archivos de esta unidad:

- `scripts/verificar-plano-equipo-local.mjs`: copia funcional del wrapper previo;
  el original de `output/` sigue presente. Crea una base nueva `qa_plano_<UUID>`
  en localhost:5433, aplica esquema, ejecuta y elimina únicamente esa base.
- `scripts/ejecutar-compras-integrales.mjs`: entrada con plan y opción de mutaciones;
  elimina del entorno heredado los selectores internos de fixture/mutación.
- `src/lib/ciclo-vida-seguimiento-verificar.mjs`: añade plan sin escrituras y
  resuelve raíz desde el archivo. Conserva supervisor y pruebas originales.
- `package.json`: comandos de ejecución, planes y `test:base:plan40` (el script
  de base lo aporta el director, fuera de esta unidad).

No se modificaron `scripts/verificar-plano-equipo.mts`, el dominio ni migraciones.

## Comandos reproducibles

Requisito para las ejecuciones: Docker local del proyecto disponible en 5433 con
el rol de desarrollo publicado en `docker-compose.yml`. No se usa `.env.local`
ni el destino heredado de `DATABASE_URL`. Nunca ejecutar `db:reset` para estos ensayos.

Planes sin conexión ni escritura:

```powershell
node scripts/verificar-plano-equipo-local.mjs --plan
node scripts/ejecutar-compras-integrales.mjs --plan
node src/lib/ciclo-vida-seguimiento-verificar.mjs --plan
```

Ejecuciones con bases desechables, en serie:

```powershell
npm run test:plano-equipo
npm run test:compras-integrales
npm run test:mutaciones:compras
npm run test:seguimiento
```

También existen los aliases `test:plano-equipo:plan`,
`test:compras-integrales:plan` y `test:seguimiento:plan`, que incorporan `--plan`
en package.json. No requieren pasar argumentos a través de un wrapper de shell.

## Evidencia ejecutada

- Los tres planes por `node` directo terminaron con salida 0; solo muestran el
  destino y procedimiento. ESLint sobre los tres archivos JS/MJS: salida 0.
  Log: `output/plan40-20260908-083450/l0-reproducibilidad.log`.
- Plano: 11/11, limpieza de `qa_plano_693365a3-ddc6-4034-a707-48f44045f52a`
  comprobada por el supervisor.
- Compras: 20/20, mensaje `FIXTURE ELIMINADO
  qa_compras_fb5a254784e74aefb9346bfcdec6af9d`.
- Supervisor de mutaciones de compras completó; la captura parcial disponible
  acredita base 20/20, sin-idempotencia 4 fallos y sin-sesion-real 1 fallo.
  No se transcriben contadores intermedios truncados como evidencia comprobada.
- Seguimiento: base 13/13; fallos causales de las cinco mutaciones, en orden:
  2, 1, 2, 1, 1. Logs completos en `output/seguimiento-1788849423889/`.
  La huella del dominio compartido se mantuvo:
  `db843ddc90d30c4d226bc88418eedb0025a8bf1b50d05c63322c1e84fd36614c`.
- La sesión de shell de la ejecución conjunta terminó con salida 0; no quedan
  supervisores propios ejecutándose. La limpieza observada corresponde a cada
  fixture; no constituye revisión global del servidor Postgres.

### Incidente de coordinación

El subagente tenía instrucción de preparar comandos sin ejecutar BD. Se invocó
`npm run <script> -- --plan` esperando un ensayo sin conexión, pero el perfil
PowerShell define `npm` como función que delega a `npm.cmd` y la ejecución perdió
`--plan`: npm mostró el comando sin esa opción y ejecutó los ensayos. La cadena
incluía plano, compras, mutaciones de compras y seguimiento. Se avisó al director
al observarlo y se dejó finalizar la limpieza de los supervisores. No se lanzaron
más pruebas BD tras detectar el incidente. Los planes posteriores se ejecutaron
directamente con Node. Los aliases de plan evitan depender de ese reenvío.

## Referencias temporales y configuración

El barrido de `src`, `scripts`, package.json, tsconfig y next-env no detectó imports
de copias bajo output. `scripts/ejecutar-e2e-diagrama.mjs` lee su propio resultado
en output: es evidencia generada por su ejecución, no código fuente oculto.
`tsconfig.json` conserva exclusión de output e includes de tipos `.next` y
`.next-e2e-diagrama`; `next-env.d.ts` apunta a tipos generados normales de `.next`.
No se cambió configuración generada por Next ni se borraron temporales previos.

## Límites, reversión y decisión solicitada

Esta unidad no acredita UI, build completo, migraciones limpias/repetidas ni los
gates restantes de L0; los coordina el director. La prueba causal es la ejecutada
por supervisores ya existentes, no una afirmación de causalidad del nuevo wrapper.
La ejecución BD accidental no sustituye la revisión independiente.

Reversión de esta unidad: retirar únicamente los nuevos wrappers/aliases y el
bloque inicial añadido a seguimiento usando el manifiesto preservado; no restaurar
archivos completos desde HEAD ni tocar modificaciones anteriores. El wrapper original
se conserva. Solicitud al revisor: reproducir planes y comandos pertinentes en
serie, contrastar limpieza y emitir cambios requeridos o aprobación explícita.

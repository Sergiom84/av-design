> **Cierre vigente ·16-10-2026 · July285.** REA10 y la integración están **aceptadas localmente dentro de sus contratos y límites documentados**. La ronda adicional de serialización está aplicada y verificada: catálogo/ofertas guardan, recargan, generan preview y confirman con200; recuperación503 y rebase explícito; cuatro destinos completos en escritorio antes de móvil390. Suite1112/1112; Webpack sinBD, tipos, lint66 y diff-check con exit0. Revisión independiente sin hallazgos. Cierre y evidencias en `docs/29-rea-entrega-local.md` y `output/rea-integracion/rea10/serializacion-ronda-adicional-20261016/raiz/aceptacion-root.json`. No hay unidad REA pendiente en este programa local: **no reaplicar el parche ni relanzar07B/08/09 o prompts históricosE2/E3**. Sin commit, push, merge, despliegue ni producción. Las entradas inferiores conservan su fecha como historia y no reabren trabajo.

> **Relevo anterior (histórico) ·16-10-2026.** REA07B/08/09 cerradas localmente. REA10: los seis hallazgos originales están corregidos; el gate completo de interfaz sigue rojo por PATCH400 de catálogo/ofertas (revisión BIGINT enviada como texto). Sergio autorizó una ronda adicional y pidió una instrucción aparte para liberar contexto. **Parche SIN APLICAR; continuación únicamente por `docs/CONTINUACION_REA_RONDA_ADICIONAL.md`.** Suite1106/1106, build sinBD, tipos/lint y regresiónE2 verdes no equivalen a aceptar ese flujo. No repetir unidades cerradas ni prompts históricos; sin Git/producción. Los bloques inferiores son historia.

> Actualización 16-10-2026 11:26 UTC: REA07B/08/09 aceptadas localmente. Primera revisión independiente de REA10 terminada: seis hallazgos consolidados y única corrección conjunta en curso. B01/B03/B04 y testigo durable B02 tienen pruebas de autor verdes; UI y gate selectivo original pendientes. El puente09–10 pasa19controles SQL y cinco pasos Chrome. Suite1087/1087 corresponde al candidato anterior a esta corrección; falta corte final. Sin aceptación global ni cambios Git/producción. Detalle en `docs/29-rea-entrega-local.md`; los estados inferiores se conservan como historia.

# Relevo REA para el 16-10-2026

> **Reanudación expresa de Sergio ·16-10-2026, sesión July282.** Se han leído
> los cuatro documentos en orden, recuperado385/277 y comprobado el coordinador
> anterior `idle/completed`, Git/HEAD y ausencia de procesos QA. Snapshot inicial
> en `output/rea-integracion/reanudacion-20261016/inicio/`. Un único coordinador:
> `finish_servicio08` termina la misma corrección abierta; `finish_consultas09`
> termina su lote de autor; `review_resultados07b` hace la primera revisión.
> Docker recuperado, sólo contenedores sintéticos5561/5562/5563/5564 arrancados
> conservando volúmenes. El resto del documento conserva el corte de pausa:
> sus fallos siguen abiertos hasta nuevos freezes y gates independientes.
> No hay aceptación global; siguen vigentes todos los límites locales y de Git.

**Pausa expresa de Sergio el 15-10-2026, aproximadamente20:52UTC. No continuar
automáticamente esta noche.** Este documento manda sobre estados anteriores.
La integración completa todavía no está aceptada.

## Arranque en la conversación nueva

1. Trabajar sólo en `/Users/sergio/Desktop/Aplicaciones/AV_design`.
2. Leer íntegramente este relevo, `CONTINUACION_REA_ESTADO_ACTUAL.md`,
   `PROMPT_CONTINUACION_REA.md` y `17-integracion-rea.md`; después el contrato de
   cada unidad que se retome:25/07,26/08,27/09,28/10. La cobertura18 no sustituye
   una implementación ni una aceptación.
3. Recuperar July, proyecto `av-design`: sesión anterior
   `av-design-rea-integracion-2026-10-15`(277), memoria385; pendientes233global,
   241/07,242/08,243/09,244/10.239/05 está completado sólo localmente. La sesión
   se cierra por esta pausa; abrir la del nuevo día sin duplicar385.
4. Verificar `git status --short --branch`, HEAD y procesos antes de editar.
   Rama esperada `codex/rea-integracion`; HEAD
   `7ba796077ff39e799b9b7eb87109b648c3df5c2d`. Los cambios extensos y archivos
   nuevos son trabajo intencional. No reset/restore/clean/checkout que los pierda.
5. Aplicar `/Users/sergio/.agents/skills/subagentes/SKILL.md`: un coordinador,
   autores con contexto propio y responsabilidades sin solapamiento, revisión
   independiente con ARTEFACTO/CONTRATO/EVIDENCIA. No relanzar E2/E3 ni trabajo
   cerrado. Comprobar primero que no haya otro coordinador reanudado.

Chat anterior: `01a14075-9d2b-7a63-bcda-018f65636ad6`. Sus tres agentes quedaron
**interrumpidos**: `implement_servicio08`, `implement_consultas09`,
`implement_resultados07b`. No se deben suponer terminados ni activos. Si no es
posible recuperar sus contextos desde el chat nuevo, transferir el estado
concreto siguiente, manteniendo las rondas ya consumidas.

## Qué queda cerrado localmente

- REA00/01/02/03: cierres previos conservados.03 no tiene scheduler desplegado
  ni transporte externo configurado.
- REA04: revisión final `output/rea-integracion/revision/rea04/correccion/`;
  aceptación raíz en `rea04/correccion-reanudacion/aceptacion-root.json`.
- REA05 tiempos: `revision/rea05-tiempos/inicial/DICTAMEN.md` y
  `rea05/tiempos-integracion-root/aceptacion-root.json`.
- REA05 costes: revisión inicial y gate de su única corrección completados.
  `revision/rea05-costes/correccion/DICTAMEN.md`: cuatroP2 subsanados,
  57fuentes propias/110totales; raíz contrastó60evidencias. Aceptación en
  `rea05/costes-correccion/aceptacion-root.json`. No reescribir cortes antiguos.
- REA06: `revision/rea06/integridad-final/informe.json` y
  `rea06/correccion-integridad-root/aceptacion-root.json`.
- REA07A/C: revisión inicial y gate de su única corrección completados en
  `revision/rea07/correccion/DICTAMEN.md`; tres hallazgos cerrados. Es el corte
  anterior a los enlaces/capacidad07B integrados después por raíz.

Los gates globales1001/1001+Webpack y1029/1029 pertenecen a cortes anteriores.
**No acreditan el checkout actual**, que añade07B/08/09 y compartidos posteriores.
No hay aceptación global deST33, producción, proveedor ni despliegue.

## REA08: finalizar la única corrección ya abierta

Autor `implement_servicio08`; base5561/app3119. Propiedad:
`src/lib/servicio-instalaciones/`, componentes/API/páginas servicio y gates08.
Contrato `docs/26-rea08-especificacion.md`.

Revisión inicial independiente: `output/rea-integracion/revision/rea08/inicial/dictamen.json`
(SHA62d18b47ee86d661214eccca63d5dd2a16eb888c9806b4c2219e3791d280c339).
CincoP2: ordinal fuera de la revisiónE3, aviso de fuente cambiada, replay tras
TTL, precarga completa de acuerdos/SLA y pérdida del borrador ante403.
**La única corrección conjunta ya se pidió y está en curso. No abrir otra ronda.**

Código corregido parcial ya está en el checkout. Los originales21fuentes están
en `output/rea-integracion/rea08/correccion/originales/`. Evidencia actual:
`output/rea-integracion/rea08/correccion/20261015T204605Z/`.

- Adversarios SQL R08-01/02/03 verdes: ordinal y relectura en confirmación/
  sustitución; nombre/artículo/extremo/x modificados detectados; replay exacto
  después11min, otro payload409, operación nueva caducada409, ACL actual403.
 450consultas,0financieras/0snapshotE3completo;90tablas físicas preservadas.
- Regresiones del autor11SQL/6fuentes/10carreras/7transiciones/12puras verdes.
- **Último Chrome no verde:** `chrome-segundo-corte.log` y `chrome-resultados.json`
  registran5pasados/1fallido/2noejecutados. Falla05a: acuerdo debía precargar
  `ambito=activos`, el formulario conservaba `sala`. No clasificarlo como simple
  interrupción ni afirmar8/8. Hay captura/traza exactas junto al log.
- Tipos del primer corte sin diagnósticos; lint tenía un warning deuseMemo.
  No existe freeze final corregido ni aceptación independiente de la corrección.

Siguiente: terminar este lote, verificarlo, congelar propios+dependencias y
devolver al revisor original(o sucesor descontaminado) para el **gate selectivo
de esos cinco**, sin nueva auditoría global. Respetar el tope de la skill.

Suplemento raíz de cabecera/enlaces08 en `rea08/integracion-root/`: el revisor
aceptó focalmente HTML/RSC sólo-salas sin obra/localización y enlace desde
Documentos, manteniendo las ocho pestañas. Datos.ts ya no usa SELECT* en la
cabecera y sólo consulta jerarquía cuando hay proyectos:ver.

## REA09: acabar implementación y primera revisión

Autor `implement_consultas09`; base5562/app3120. Propiedad `src/lib/consultas/`,
componentes/API/cuenta-consultas, pruebas y gates09. Contrato27.
Salida `output/rea-integracion/rea09/consultas-runtime/`.

Hay18checksSQL, límites100turnos/256KiB/10MiB/20conversaciones, documentosE1/03/06,
retención/purga y barrera realACL verdes. Ver `resultado-{postgres,limites,documentos,barrera}.json`.
La barrera observó esperaadvisory enpg_stat_activity, retiró salas y obtuvo403
con0turnos.93tablas ajenas preservadas. Son gates del autor, no aceptación.

**Falta cerrar Chrome:** `navegador-red3.log` llega a consulta/salas/fuentes,
historial, preselección real03 y obra explícita; después timeout buscando
`Pregunta`. Conservar el rojo y diagnosticar producto/conductor, sin asumir
ninguno. No se ha terminado el recorrido escritorio→móvil ni revisión independiente.

**Último tsc global falla** sólo en
`src/components/consultas/dictado-local.test.tsx:13,15`: propiedadeslang,
processLocally,inicios,paradas,abortos,onresult sobre `never`.
Log `reanudacion-20261015/gates/tipos-rutas-estandar-limpias.log`.
No corregirlo esta noche ni atribuir tipos0 actuales. Hay también warnings de
lint09 en su log. Snapshot anterior `freeze-1792097224489/manifest.json` no es
freeze final; regenerar desde las fuentes actuales tras cerrar los pendientes.

Dictado español local no está instalado enChrome155: teclado completo y estado
no disponible. No descargar, instalar, activar micro ni usar alternativa remota.
No afirmar aceptación del dictado real sólo por pruebas con dobles.

Puente raíz03: `src/lib/informes/consultas-tecnicas.ts`, autorización de lectura
inyectable y `seleccion-inicial.ts`;4puras y SQL real03 en nueva5563 pasan,
sin leer snapshot completo/dinero/bytes en el adaptador y con bloqueo previo al
texto al revocar propietario/receptor/grupo/permiso/caducidad. Evidencia
`rea09/preparacion/puente03-1792096809516/` y gate
`rea09-puente03-sql-retencion-inmutable`. El adversario caducado nace así;
no cambiar retenciones de capturas03 existentes, cuyo trigger lo prohíbe.

Entradas raíz: cuenta, Documentos de sala y obra. URLs
`/cuenta/consultas?tipo=sala&id=<uuid>` y `?tipo=obra&id=<uuid>`; obra obliga a
elegir1..20salas antes de crear, sin crear conversación/pregunta automáticamente.
Informe03: `/cuenta/informes?clave=estado_actual&tipo=sala&id=<uuid>`; obra añade
`salaIds=id1,id2`. Sólo precarga borrador. Fuente03: `?ejecucion=<uuid>`.
Suplemento para revisión09: `rea09/integracion-root/suplemento-fuentes.json`.

## REA07B: primera revisión pendiente, fuentes congeladas

Autor `implement_resultados07b`; base5564/app3121. Contrato25 y23;
23fuentes propias congeladas en
`output/rea-integracion/rea07b/resultados-runtime/fuentes-1792097408080.json`.
Raíz verificó23/23idénticas al pausar.87dependencias en ese manifiesto han
recibido suplementos raíz explícitos posteriores; revisarlas contra lo actual.

Autor verificó16SQL+5carreras/TTL+2conciliaciones,9puras+oráculo3000,Chrome3/3
producción local y build sinBD. Reinicio: GET entero mismoSHA
`c0bfe9...33a5`,2sesiones deBD y sin53300. Logs en resultados-runtime/;
no hay aceptación independiente ni entrega formal final recogida.

Caso abierto comunicado antes de la pausa: opciones consulta51propuestas y
rechaza413 si la obra supera50, incluso deeplink con propuestaId explícito.
Verificar contra la paginación/acceso exigidos por contrato25 y tratar cualquier
hallazgo en el lote de la primera revisión. No arreglar el freeze a escondidas.

Lector05 exclusivo: `src/lib/costes/adaptador-propuestas.ts::leerCorteParaPropuesta`.
Nunca SQL financiero alternativo ni escrituras05/06. El comparable sólo es base
aprobada menos registros del alcance/cobertura/fiscalidad explícitos; no beneficio.

Raíz integró después: enlaces obra/detalle07A a la revisión exacta, legado sin
adopción, capacidad sólo financiera y tarjeta personalizable02 «Consultar» sin
agregado ni consulta monetaria. Actualizar suplemento
`rea07/integracion-root/resultados/suplemento-fuentes.json` al congelar revisión,
porque los enlaces09/tsconfig se añadieron después. Incluir esos compartidos en
la revisión independiente, con HTTP/HTML/RSC y navegación real.

## Compartidos posteriores que no deben perderse

- **Pool de producción corregido** en `src/lib/db.ts`: antes cada acceso al
  Proxy creaba otro pool enproducción y agotó30conexiones. Ahora se memoriza
  siempre englobal.__sql, manteniendo creación perezosa/sinBD al importar.
  Repro fábrica40→1 y7pruebas pool/ALS/E1 verdes; evidencia
  `reanudacion-20261015/gates/db-pool-produccion-{rojo,verde}` y
  `pool-produccion/db.ts.antes`.07B producción real confirma2sesiones.
  Las pruebas anteriores deJS idéntico dedb.ts son históricas, previas a este fix.
- `tsconfig.json` ya no incluye veinte directorios de tiposNext antiguos:
  provocaban falsas rutas inválidas por alias duplicados. Se guardó el anterior
  en `reanudacion-20261015/tipos-generados-actuales/`. Se regeneraron tipos
  **estándar** con Next typegen, sinBD ni.env.3100 estaba libre. El error de
  `/propuestas/seguimiento` desapareció; el tsc actual falla en el test09 citado.
  Existe `.next-rea-global-types/` generado y sin seguimiento; conservar, no
  confundir con producto. No añadir casts para esconder enlaces rotos.
- Los contratos de fuentes/cálculo y CSV siguen; `calculo-cable.ts` sólo cambia
  tipos, no fórmula. No tocar `db/seed.sql` ni CSV reales para probar.

## REA10: preparado, runtime todavía no iniciado

Contrato28 aprobado. Nueva5563(104tablas), seis tablas10, cuatro columnas
monotónicasrevision_fuente y rollback estricto. DDL ya aditivo en schema raíz;
otras bases no se migran por asumir ese archivo.

ParserPDF/TXT local con pdfjs-dist6.4.299 fijado, subproceso acotado,
5MiB/100páginas/20kcaracteres porpágina/1MiBtexto/15s,128MiBheap y vigilanciaRSS.
7puras y prueba canario local deURI inerte0peticiones pasan. La vigilanciaRSS
por intervalos no es un límiteinstantáneo delSO. Faltan handler real/cuotas
porpersona/globalsem/bloqueos/reinicio y verificación de assets enbuild real.
`next.config.ts` incluye trazado para `/api/requisitos` y rutas profundas.

Puentes preparados por raíz: E2 confirmar/revertir en transacción externa,
`jerarquia-transaccional.ts`, escritor técnico y alta de puerto sin sobrescribir.
59puras y E2main10+post7, atomicidad47tablas y escritores104tablas verdes.
Evidencias `rea10/{preparacion,puente-e2,escritores}/` y gates reanudacion/.

Falta asignar ejecutor10: documentos/fuentes, extracción/candidatos, planes
áreas+BOM/aplicación/reversión, UI y adaptador09. Raíz debe integrar prefill
revisable en formularios técnicos/puertos existentes y procedencia atómica,
base/hash+revisiónmonotónica para ABA. No duplicar E2 ni convertir requisitos en
mediciones físicas.5563 conserva nuevos informes sintéticos del gate03 raíz;
fotografiar baseline actual, no resetearlos.

## Bases y procesos

Todas son sintéticas,127.0.0.1,Postgres interno5432. Guardas exactas en
`scripts/reaXX-fixture.mts`; contraseña local por convención `<usuario>_local`.

| Puerto | Base / usuario | Tablas | Uso al parar |
|---|---|---:|---|
|5557|av_design_rea05_prueba / av_design_rea05|82|Tiempos05 cerrado;conservar|
|5559|av_design_rea05_costes_prueba / av_design_rea05_costes|82|Costes05 cerrado;conservar|
|5560|av_design_rea07_prueba / av_design_rea07|87|07A/C cerrado;conservar|
|5561|av_design_rea08_prueba / av_design_rea08|98|Única corrección08 interrumpida|
|5562|av_design_rea09_prueba / av_design_rea09|96|Autor09 interrumpido|
|5563|av_design_rea10_prueba / av_design_rea10|104|Preparación10+informesQA03 raíz|
|5564|av_design_rea07b_prueba / av_design_rea07b|104|07B congelado, espera revisión|

Puertos3119/3120/3121 **libres comprobados**, procesos propios3997/4013/4459/4475
detenidos tras comprobarPID/cwd. No detener otros servidores ni Docker entero.
Contenedores y volúmenes conservados, ninguna base reseteada.
`output/rea-integracion/pausa-20261015/procesos.json` contiene evidencia.

QA siempre copia de fuentes en `/private/tmp`, sin.env*, node_modules enlazado,
URLs/secreto sintéticos explícitos y preload heredado por todos los workers:
`NODE_OPTIONS=--require=/Users/sergio/Desktop/Aplicaciones/AV_design/output/rea-integracion/rea05/tiempos-runtime/sin-env.cjs`.
Next conWebpack: Turbopack rechazó el symlink externo; conservar el rojo.
No corregir producto dentro deQA; editar checkout y regenerar snapshot.

## Cierre pendiente y evidencia de pausa

Después de las revisiones/correcciones: freeze conjunto actual, pruebas completas,
Webpack sinBD con preload, tipos/lint/diff, regresionesE1/E2/E3 pertinentes y
comprobación visual escritorio completo→móvil. No volver a ampliar checks sin
cambio/fallo/incertidumbre que lo justifique. Mantener explícito lo pendiente.

Snapshot de pausa: `output/rea-integracion/pausa-20261015/`: fuentes+SHA, Gitstatus,
diff, HEAD, procesos y preservación.438fuentes iniciales presentes y642artefactos
históricos idénticos comprobados al parar. Los archivos nuevos del checkout y
output son parte del relevo aunque no estén enGit.

**Sin commit, push, merge, despliegue ni cambios de producción. Xtenav conserva
investigación; toda implementación vive en AV_design.**

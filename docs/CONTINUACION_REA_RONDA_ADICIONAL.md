> **Cierre vigente ·16-10-2026 · July285.** REA10 y la integración están **aceptadas localmente dentro de sus contratos y límites documentados**. La ronda adicional de serialización está aplicada y verificada: catálogo/ofertas guardan, recargan, generan preview y confirman con200; recuperación503 y rebase explícito; cuatro destinos completos en escritorio antes de móvil390. Suite1112/1112; Webpack sinBD, tipos, lint66 y diff-check con exit0. Revisión independiente sin hallazgos. Cierre y evidencias en `docs/29-rea-entrega-local.md` y `output/rea-integracion/rea10/serializacion-ronda-adicional-20261016/raiz/aceptacion-root.json`. No hay unidad REA pendiente en este programa local: **no reaplicar el parche ni relanzar07B/08/09 o prompts históricosE2/E3**. Sin commit, push, merge, despliegue ni producción. Las entradas inferiores conservan su fecha como historia y no reabren trabajo.

# Continuación acotada REA10 · serialización de revisión

## Autorización vigente y objetivo

Sergio autorizó expresamente una ronda adicional para corregir el bloqueo de
catálogo/ofertas y verificarlo, con esta respuesta literal el 16-10-2026:

> si, pero dámelo en una instrucción aparte para liberar tu contexto.

Esta ronda está autorizada para otro chat. **No volver a pedir permiso para
aplicar y verificar esta corrección acotada.** El parche sigue SIN APLICAR.
La integración local completa sigue sin aceptación hasta resolver este bloqueo.

Único checkout: `/Users/sergio/Desktop/Aplicaciones/AV_design`. Rama
`codex/rea-integracion`, HEAD `7ba796077ff39e799b9b7eb87109b648c3df5c2d`.
Sin commit, push, merge, despliegue ni producción. Xtenav sólo investigación.
Conservar todo el WIP y las evidencias. Sólo bases sintéticas aisladas.

## Estado que no hay que repetir

- REA00–06 y 07A/C conservan sus cierres anteriores. No relanzar prompts E2/E3.
- REA07B, REA08 y REA09 cerradas localmente con revisión independiente y aceptación raíz.
- REA10: primera revisión, única corrección conjunta y gate selectivo consumidos.
  B01–B04 y U01/U02 originales corregidos; el gate de interfaz detectó además
  el bloqueo HTTP descrito abajo al comprobar el ciclo completo de catálogo/ofertas.
- La ronda adicional autorizada es exclusivamente este bloqueo y su comprobación.
  No abrir otra auditoría ni volver a implementar unidades cerradas.
- Se usó skill `subagentes`: coordinador único, ejecutores con contexto propio y
  revisor independiente con artefacto/contrato/evidencia. Mantener ese reparto.

## Bloqueo y parche concreto

GET `/api/requisitos/base-tecnica?destino=articulo&articuloId=...` devuelve
`articulo.revision` como string porque Postgres BIGINT se representa así.
`EditorAvanzado` conserva ese valor en `revisionArticulo`, cuyo schema exige
number. El PATCH real del plan responde 400 en catálogo y ofertas.

El borrador local sí conserva selección, propuesta, motivo, campos revisados y
base tras 503 y al reabrir; técnico 1210 y puerto guardan 200 y recargan. No confundir
esa conservación local con la persistencia fallida de catálogo/ofertas.

Archivo a corregir: `src/app/api/requisitos/base-tecnica/route.ts`, rama
`destino=articulo`. Propuesta: normalizar `revision:Number(articulo.revision)`
al construir la respuesta, conforme al contrato numérico existente de E2.
Inspeccionar el valor real y conservar los rechazos del schema; no normalizar
artificialmente el payload sólo en el conductor de pruebas.

Parche listo, sin aplicar:
`output/rea-integracion/rea10/bloqueo-serializacion-20261016/propuesta-no-aplicada.patch`.
Detalle y hashes en `PROPUESTA.md` y `manifest.json` de la misma carpeta.
SHA actual del archivo de producto: **698323d2c715ed5ed98eb0e134b1c22879620167d9c97b0204fe4805b7aa774f**.

Antes de escribir código Next, leer los documentos relevantes instalados en
`node_modules/next/dist/docs/`, como exige AGENTS.md. Mantener target ES2017.

## Criterios de esta ronda autorizada

1. Registrar red reproducible del tipo de revisión recibido y PATCH400 en NUEVA
   salida; los raws existentes ya lo documentan y no se sobrescriben.
2. Aplicar la corrección mínima al contrato de respuesta y añadir una prueba
   significativa del tipo recibido/enviado. Los tests en `src/lib/` deben entrar
   en el glob de `npm test`; no dejarlos en una subcarpeta que éste no recorre.
3. Comprobar HTTP y navegador reales: catálogo/ofertas guardan 200, recargan y
   conservan selección, propuesta, motivo, campos revisados y revisión. Probar
   la recuperación tras 503 y el cambio de base con rebase explícito. Completar
   preview y confirmación humana del destino con filas sintéticas trazables.
   Ejecutar el driver entero con fixture nueva, sin `REA10_SELECTIVO_CONTINUAR`: el
   modo CONTINUAR anterior sólo acabó superficies independientes del gate rojo.
4. Revisión independiente focal del bloqueo, sin otra auditoría de producto.
   No darle el razonamiento o conclusión del autor, sólo artefacto, contrato,
   comandos/exits y raws. Escritorio completo antes de móvil de 390 px.
5. Congelar fuentes; ejecutar suite, build Webpack sin BD, tipos/lint afectados
   y diff-check. Verificar hashes y filas ajenas de la base sintética.
6. Actualizar docs17/18/29, entradas de continuación y July385/pendientes244/233.
   Marcar cerrada REA10/integración local únicamente con gate final verde.
   Si sigue fallando tras esta ronda adicional, explicar el caso concreto.

## Evidencias ya verificadas

Todas las rutas siguientes son relativas al checkout.

- REA07B: `output/rea-integracion/revision/rea07b/correccion-20261016/dictamen.json`;
 aceptación `rea07b/correccion-20261016/aceptacion-root.json`.
- REA08: `output/rea-integracion/revision/rea08/correccion-20261016/dictamen.json`;
 aceptación `rea08/correccion/20261016T084354Z/aceptacion-root.json`.
- REA09: `output/rea-integracion/revision/rea09/correccion-20261016/dictamen.md`;
 aceptación `rea09/correccion/20261016T090932Z/final2/aceptacion-root.json`.
- REA10 backend selectivo: `output/rea-integracion/revision/rea10/correccion-backend-20261016/`.
 `dictamen.json`, `comandos.json`: 8 comandos con exit 0, `manifest.json`: 38 artefactos;104 tablas y 1114 filas
 previas intactas. B01 duplicados y legado; B02 ABA vacío/no vacío y locks;
 B03 diez barreras ACL final; B04 motivo/autor/fecha purgable sin copia privada.
 Aceptación raíz focal en `rea10/correccion-20261016/aceptacion-backend-root.json`.
- REA10 UI selectivo: `output/rea-integracion/revision/rea10/correccion-ui-20261016/`.
 `DICTAMEN.md` SHA-256 fe099b3adfb6ca1ae1d692757d1ead0d5509e8423af61fc4c43fa77946292156;
 `manifest-evidencias.json`: 70 artefactos contrastados por raíz.
 Consultar `bloqueo-http400.json` y `resultado-selectivo.json`; gate global de ese
 conductor exit 1 por los dos PATCH 400 reales. No maquillar ese resultado.
 U02 mide 44×44 px mínimo en técnico, 44×51.70 px en puerto y 44×310 px en salas09; overflow 0 y teclado.
- Puente09–10: `output/rea-integracion/rea10/integracion-consultas-20261016/`: 19 controles SQL
 y Chrome04 de 5 pasos; selección explícita fragmentos 1..20 y salas 1..20, cita verificable,
 retirada elimina contenido. La fixture Chrome04 fue retirada intencionadamente;
 no reactivarla ni usarla como si estuviera activa.

## Corte final antes del parche

`output/rea-integracion/reanudacion-20261016/final-coordinador/candidato-03/freeze/manifest.json`:
861 entradas, hash **779f560a7f5c4d5bc57a410bfeec77a30025b24fbff1202deeb18dd0bbca3c77**.
QA `/private/tmp/rea10-qa-1792151505376`; build genera next-env/tsconfig sólo en QA,
bytes conservados en `generados-build/`, no copiar esos generados al producto.

Suite 1106/1106, 186 suites, 0 fallos; build Webpack sin BD exit 0; tipos exit 0; lint 65 archivos exit 0;
diff-check exit 0. Esto no prueba el flujo catálogo/ofertas que falla en Chrome/HTTP.
Raw suite en `final-coordinador/pruebas-candidato-03.{log,json}`; resto en
`final-coordinador/candidato-03/{build-01.log,types-01.log,lint-final.json,assets-parser.json,trazabilidad-build.json}`.

Candidato02→03: sólo regex de un conductor, DOTALL/s→`[\s\S]` para ES2017;
`delta-instrumental.json`. El rojo TS1501 se conserva. Primer intento de suite
sin acceso al monitor de procesos falló en 5 pruebas PDF; se repitió con acceso local
aprobado y pasó las 1106 pruebas. No modificar el parser para saltarse el monitor.

E2 tras B02: `output/rea-integracion/reanudacion-20261016/regresion-e2-cierre/20261016T112452Z/INFORME.md`:10/10, 104 tablas, 12 fotos, 48 dependencias estables y 63 artefactos.
No relanzar el prompt histórico E2; sólo repetir las regresiones afectadas si
los cambios futuros lo justifican.

## Arranque seguro del sucesor

Recuperar July proyecto `av-design`, memoria 385 y sesión 282
`av-design-rea-integracion-2026-10-16`; la 277 anterior ya se recuperó. Abrir una
nueva sesión para esta ronda. Los lifecycle_note antiguos de pausa no mandan
sobre esta autorización nueva y los detalles actualizados.

Verificar Git, agentes y procesos antes de editar. El coordinador saliente
cierra su sesión con relevo; no debe quedar otro autor escribiendo producto.
Los QA 3123/3124 se detuvieron por PID/CWD verificados; consultar cierre del 3126
en la evidencia del revisor UI: 3126 ya detenido con PID/CWD verificados y sin
listener. No matar procesos por puerto sin identificar.

Docker local conserva bases sintéticas de este trabajo en 5561–5566 y 5568;
no resetear ni borrar volúmenes. Para pruebas nuevas puede crearse otra base
sintética, por ejemplo 5569 si está libre: contenedor `av_design_rea10_serializacion_20261016_db`,
volumen `av_design_rea10_serializacion_20261016_datos`, base
`av_design_rea10_serializacion_prueba`, usuario `av_design_rea10_serializacion`,
password sintético `av_design_rea10_serializacion_local`, bind127.0.0.1.
Cargar schema completo actual y fixtures sintéticas; nunca db/seed.sql ni CSV reales.
Identificar base/usuario/puerto real antes de escribir.

No ejecutar conductores antiguos con salida fija. Copiar/adaptar sóloimports,
destino QA y salida a NUEVA carpeta fechada; declarar hashes y deltas. Usar
wx/openx para artefactos. La copia QA no contiene `.env*`, enlaza node_modules
y requiere el preload en todos los procesos Next:
`output/rea-integracion/rea05/tiempos-runtime/sin-env.cjs`.
Fontmock local validado:
`output/rea-integracion/rea10/runtime-20261016/qa-01/fonts-mock.cjs`, con
`fonts-procedencia.json` y WOFF2 por SHA. `next build --webpack`,
`NEXT_DIST_DIR` propio y `DATABASE_URL`/`SESION_SECRETO` vacíos.
Para Chrome usar `localhost`, no mezclar alias127conelOrigin canónico.

## Conservación y límites que deben seguir explícitos

857 fuentes iniciales siguen presentes; contraste mecánico819 iguales y 38 cambiadas,
0 ausentes en su corte. Copias congeladas y raws sellados07B/08/09/10/E2 íntegros:
`output/rea-integracion/reanudacion-20261016/contraste-integridad-final/20261016T115300Z/`.
La cabecera documental26 cambió intencionadamente después de aceptar REA08; no
cambió su código propio. No atribuir esa cabecera al delta10.

Incidente09: un conductor sobrescribió 8 artefactos auxiliares anteriores y un puntero;
no se encontró copia recuperable. Conservado sin inventar bytes en
`output/rea-integracion/rea09/consultas-runtime/20261016T0851Z/incidente-evidencia.json`.
No afirmar conservación histórica total.

Voz real esES no disponible en Chrome155; teclado completo verificado. OCR y
proveedor generativo sin configurar; scheduler/transporte externos no desplegados.
Revertir un alta sala+BOM conserva sala si el lote E2 la referencia mediante
FK de auditoría: comportamiento conservador admitido por contrato, no borrar
historia para forzar la baja. Sin validación de producción ni inventario real.

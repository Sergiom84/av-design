# E2 · Punto de continuidad antes del apagado

Actualización 14-10-2026: E2 se retomó y terminó localmente, con los fallos y
gates pendientes corregidos. El estado vigente y la reproducción están en
[14-e2-entrega-local.md](14-e2-entrega-local.md). Lo que sigue conserva el
punto histórico del 13-10; sus puertos 5545/3102 no son los actuales (5546/3103).

13-10-2026. Sergio pidió detenerse para apagar el equipo y continuar mañana.
Trabajo **incompleto y sin revisión independiente final**. No anunciar E2 entregada.

## Base conservada

Checkout /Users/sergio/Desktop/Aplicaciones/AV_design, rama main.
HEAD f38baa805a1868b7cad55bb97064386e9b5f8555; origin/main es sólo la ref local
(un commit por delante), sin fetch. E1 sigue sin commit y no se ha eliminado.
Snapshot de sus 32 archivos iniciales en output/e2-importacion/base-e1/,
base-e1-manifiesto.json y base-e1.diff. Los 288 artefactos históricos de
output/e1-documentos/ siguen intactos; comprobación en
output/e2-importacion/e1-preservacion-checkpoint.json.
Cambios deliberados en fuentes E1: documentos/modelo.ts añade materialBom opcional,
datos.ts lo lee dentro del mismo snapshot, tablas.ts lo suma al cálculo común.
No commit, push, despliegue, credenciales reales ni cambios en producción.

## Implementación parcial disponible

Leer íntegros docs/PROMPT_CONTINUACION_E2.md, docs/12-e2-especificacion.md,
AGENTS.md y documentos E1 como contrato; investigación Xtenav ya guardada, no repetirla.

- AVX-14/15: src/lib/importacion/{modelo,parser,revision,servicio,index}.ts;
  CSV/XLSX, matching literal, preview/hash, selección explícita, lotes/archivo
  originales en Postgres, transacción, reversión con versiones y dependencias;
  catálogo fuente app y protección de seed en scripts/generar-seed.mjs.
- UI/API: src/components/importacion/, src/app/api/importacion/,
  src/app/catalogo/importar/. Catálogo enlaza importación. Preview hash obligatorio
  al confirmar; propietario y permisos actuales en cada API; comprobación Origin.
- BOM: tabla sala_material_bom y src/lib/datos-material-bom.ts;
  cuarto argumento opcional de necesidadDeSala (compras.ts), integrado en
  datos-almacen.ts, Documentos E1 y pestaña Equipamiento. No crea posiciones/conexiones.
- AVX-16: src/lib/catalogo-tecnico*.ts, componentes y API catalogo-tecnico;
  ficha /articulo/[id] y BuscadorTecnico en /catalogo. Dimensiones parciales,
  procedencia, bytes bytea durables; triggers snapshot equipo/plantilla y
  hook en acciones.ts sala→plantilla. Validadores formatos/tamaños y permisos.
- Migraciones: db/migraciones/2026-10-e2-importacion.sql y ...-tecnico.sql.
  Aplicadas sólo a BD sintética E2. **Todavía no incorporadas a db/schema.sql**.
  Reaplicar versión actual de migración importación antes del próximo gate:
  el ejecutor añadió proveedores/revisión/default fuente app después de la primera aplicación.
- AVX-18 favoritos: todavía sin implementar. Personal/departamental pendiente
  de documentar; opcional tras cerrar el núcleo.

## Entorno aislado conservado

Contenedor av_design_e2_prueba_db, detenido, datos persistidos en su contenedor.
Host 127.0.0.1, puerto 5545, base av_design_e2_prueba, usuario av_design_e2,
contraseña sintética av_design_e2_local. Nunca sustituirlo por BD habitual.
Los scripts guardan URL + current_database/current_user/servidor antes de writes.
Fixture PRUEBA-IMPORT-01, sala e2000000-0000-4000-8000-000000000010.
Fixture E1 sintética también en esta BD; no se tocó el contenedor E1 de puerto5544.

Rearranque (verificar identidad antes de escribir):

```sh
docker start av_design_e2_prueba_db
IMPORTACION_DATABASE_URL=postgres://av_design_e2:av_design_e2_local@127.0.0.1:5545/av_design_e2_prueba \
  node --import tsx scripts/importacion-fixture.mts --migraciones
DATABASE_URL=postgres://av_design_e2:av_design_e2_local@127.0.0.1:5545/av_design_e2_prueba \
SESION_SECRETO=e2-local-prueba-importacion-secreto-2026 \
AV_IMPORTACION_PRUEBA=1 AV_DOCUMENTOS_PRUEBA=1 NEXT_DIST_DIR=.next-e2-importacion \
  npm run dev -- --webpack --hostname localhost --port 3102
```

Antes de usar esos comandos, comprobar flags/variable actuales de los scripts:
se interrumpió a los ejecutores mientras terminaban pruebas y podrían variar.
Servidor E2 detenido. El servidor E1 de 3101 era previo y no se detuvo.

## Verificaciones hechas y pendientes

- npm run typecheck: exit0 en output/e2-importacion/typecheck-integracion.log.
- Test material-bom: exit0 en material-bom-test.log.
- Gate E1 sobre BD E2: exit0, 43 tablas sin cambios, exportaciones/nulos/stock
  único/cable IDs/ZIP/hash/error parcial. Evidencia propia en
  output/e2-importacion/gates/e1-preservacion/, sin sobreescribir evidencia E1.
  Se omitió gate mutante de concurrencia al clonar porque revision impide
  restauración byte-idempotente; lectura/exportación sí ejecutada.
- npm test inicial: **695 pruebas, 694 pasan, 1 fallo**. Fallo JPEG de un píxel
  en src/lib/catalogo-tecnico.test.ts (Segmento JPEG inválido).
- ESLint integración: **1 error** react-hooks/set-state-in-effect en
  src/components/importacion/importador.tsx:35 (cargarLotes desde useEffect).
- Gate core: **falla al leer XLSX válido generado por Artifact Tool**.
  ExcelJS no acepta prefijos namespace x:workbook/x:worksheet de ese archivo;
  parser debe soportar OOXML válido o usar normalización acotada y conservar
  bytes/hash del archivo original. Crudo gates/gate-core.log; fixtures en gates/fuentes/.
  El ejecutor tenía este repro y aún no consta corrección verificada.
- Faltan cerrar pruebas unitarias de importación (no hay test nuevo bajo su
  carpeta aún), gate de transacciones/reversión/precios, E2E escritorio completo,
  permisos/API/fallos reales y móvil al cierre, render de PDFs afectados,
  build Webpack sin BD y lint/tipos final.
- Faltan integrar migraciones en schema, rollback reproducible/documentado,
  decisiones/límites finales, revisor independiente con artefacto/contrato/
  evidencia cruda y una corrección/gate determinista. No hay revisión independiente E2 todavía.

## Reanudación arquitecto-ejecutor

Los tres subagentes se interrumpieron al pedir el usuario la pausa:
mapa_importacion (núcleo), datos_tecnicos (AVX-16), gates_e2 (fixture/checks).
Retomar los existentes si el runtime conserva sus IDs, o delegar las mismas
propiedades sin escrituras solapadas. Root integra UI/API/BOM/schema/documentación.
No aceptar reportes de autor sin ejecutar evidencia. Revisor limpio sin contexto
ni conclusiones de autores. Respetar una implementación/revisión/corrección/gate.

Inventario de este punto: output/e2-importacion/checkpoint-apagado-hashes.json.
No reset, restore, clean ni checkout que pierda E1/E2. No migrar producción.

# REA-06 · Propuesta interna y alcance reutilizable

15-10-2026. **Contrato listo para ejecución posterior; no implementación ni
aceptación.** Cubre ST21/ST22/ST23 de `18-rea-cobertura.md` bajo el contrato 17.
Único checkout AV_design, rama `codex/rea-integracion`; sin commit, push,
despliegue, comunicación externa o producción. SQL sólo propuesto aquí.

El mínimo útil es una propuesta interna vinculada a sala u obra existente, con
alcance/condiciones/destinatario opcional, fuente revisada y PDF durable de cada
revisión. Puede tener valoración opcional. No crea un ERP, CRM, cliente, otra
jerarquía, BOM vivo, tareas, pedido, factura ni evento comercial. REA-07 añadirá
eventos/embudo/aceptación; una revisión nueva nunca hereda una aceptación.

Puede construirse sin REA-04/05 cuando raíz entregue el núcleo exacto compartido.
Sus contratos no se presentan como capacidades verificadas. No consulta tarifas,
tiempos, costes laborales ni beneficio real de 05/07 automáticamente.

## Base comprobada y elecciones

| Fuente del checkout | Contrato |
|---|---|
| E3 `revisiones_diseno`: id/sala/hash/diseno_version/snapshot inmutables. Su lector genérico hace SELECT completo y carga contexto de parámetros. | Fuente de diseño seleccionable, con lector propio por proyección SQL permitida. No usar el lector completo para una propuesta técnica sin todos sus permisos. |
| E1 `SnapshotExportacion`, `necesidadExportada`, `construirBom`: necesidad única con BOM adicional E2 y cable existente. | Reusar cantidades/necesidad, sin otra fórmula ni edición paralela. No usar «a comprar» como toda la necesidad del diseño. |
| `cargarSnapshotEnLectura` E1 consulta catálogo, parámetros, stock/reservas y precios de compra incluso si luego se omiten columnas. | Sólo usarlo con permisos de **todas** sus fuentes. Una propuesta técnica sin compras usa la ruta de diseño proyectada, nunca llama a E1 para ocultar precios después. |
| REA-03 conserva snapshots/archivos en BD; E1 `paquete.ts` usa tmp con caducidad. | Una BOM confirmada puede copiar un snapshot autorizado de REA-03 o capturarse en servidor. Guardar la proyección necesaria dentro de la propuesta; no depender de tmp/URL caducada. |
| `articulos.coste` numeric(12,4), `coste_orientativo`; no hay actualizado_en general de artículo. E2 tiene revisión de ofertas. | Precio de catálogo sólo previsto, con valor exacto/fuente/hash/fecha congelados y confirmados. No inventar versión de artículo ni presentarlo como coste histórico. |
| PDFKit, SHA-256/pgcrypto y Postgres bytea ya disponibles. | PDF nuevo de documento textual/tablas, sin captura HTML ni otro editor de plano; persistencia durable en BD. Sin paquetes nuevos. |
| `src/lib/importes.ts`, contrato 23 y revisión independiente. | Reusar exactitud, escalas y HALF_UP. No usar `importacion/coste.ts` E2 ni Number para dinero. |

## Permisos centrales y superficie sin dinero

Identidad real/activa/no provisional en cada petición y antes de publicar una
revisión. Resolver permisos actuales en servidor. Cookie, selección, snapshot,
destinatario o grupo no conceden acceso futuro. No modificar roles/secciones.

| Contenido/operación | Requisitos actuales |
|---|---|
| Propuesta de sala | salas:ver; edición técnica, salas:editar. Una sala legado es válida y no se adopta. |
| Propuesta de obra/selección de sus salas | proyectos:ver + salas:ver; edición técnica, proyectos:editar + salas:ver. Todas las salas seleccionadas deben seguir perteneciendo a esa obra. |
| Leer una propuesta cuya revisión actual o revisión solicitada contiene valoración | Lo anterior + compras:ver. Sin ese permiso no se devuelve esa propuesta/listado/detalle/PDF ni se carga su valoración. No crear una redacción técnica silenciosa del PDF valorado. |
| Crear/editar/retirar valoración o una revisión que la conserve | Edición técnica del ámbito + compras:editar. También se comprueba lectura de todas las fuentes monetarias usadas. |
| Consultar/importar precio de catálogo/oferta | compras:ver + catalogo:ver; confirmar su uso en valoración exige compras:editar. Lectura explícita de las columnas/fuentes necesarias. |
| Leer detalles de catálogo en fuente técnica | catalogo:ver cuando se consulten esos campos; nombres ya registrados del diseño pueden proyectarse como datos de sala sin cargar catálogo completo. |
| Coste laboral/beneficio real | Permanecen fuera de REA-06 y bajo admin + usuarios:editar en 05/07. compras:ver no los autoriza. |

Una propuesta sin valoración no tiene filas monetarias guardadas ni envía
placeholders de precio al navegador. Lectores/repositorios técnicos y de
valoración son funciones distintas. No `select *`, RSC/HTML con dinero oculto,
prefetch de precios, conteos monetarios ni precio en un error para quien carece
de compras. Si una propuesta pasa a valorada, su cabecera marca esa condición
atómicamente y el siguiente acceso sin compras queda denegado, también a una
revisión anterior a través de esa propuesta. No basta quitar botones.

Si una revisión posterior retira valoración mediante edición autorizada, las
revisiones históricas que sí la tenían conservan compras:ver como requisito.
Filtrar también el historial por esa condición antes de cargar snapshots; una
cabecera actual sin dinero no abre sus PDF valorados antiguos.

Leer plantillas documentales requiere salas:ver. Editarlas exige salas:editar,
o proyectos:editar junto con salas:ver; no consulta precios ni catálogo AV.

La lista filtra en SQL por contexto/condición de valoración **antes** de leer
snapshots. Una fuente que incorpore metadatos privados de catálogo exige de nuevo
su permiso al consultar ese detalle. Las secciones guardadas por servidor
describen datos utilizados, no un mapa de permisos cacheado. Sin parámetro
autorizado no se consulta la tabla de parámetros para comprobar frescura.

## Fuente confirmada, revisión e idempotencia

Ámbito exacto e inmutable: sala, o obra con lista de salas explícita (máximo 20).
No sede, proveedor usado como cliente ni obra duplicada. Cambiar ámbito exige
crear otra propuesta. Cada propuesta tiene título y revisiones numeradas;
cada guardado efectivo crea otra revisión inmutable, no UPDATE del documento.

Fuentes admitidas:

1. **Diseño:** revisión E3 guardada elegida por cada sala, con id/hash/número/
   diseno_version. Lector SQL proyecta identidad, campos técnicos y filas
   necesarias; no lee precios, stock o contexto completo. Incluye equipamiento,
   conexiones y partidas explícitas que existan, sin calcular otra BOM. Si no
   tiene una necesidad completa calculada, la llama «Equipos/conexiones de la
   revisión»; metros/cantidades ausentes permanecen ausentes.
2. **BOM confirmada:** captura E1 consistente revisada mediante preview/hash, o
   snapshot material correcto de REA-03 con ACL actual de su fuente. Se copia
   necesidad, unidades, detalles/orígenes, advertencias y referencias de diseño;
   precios sólo si se pide valoración y se autorizan/confirman por separado.
   No acepta JSON/BOM arbitraria del navegador ni un archivo temporal E1 como
   referencia durable. Una captura actual con diseño borrador se etiqueta así,
   nunca como revisión E3 guardada. Si el origen 03 ya caducó o no está autorizado,
   no se importa; una copia propia confirmada anterior sigue siendo durable.

Se conserva `fuente_snapshot` mínimo y SHA-256 canónico, además de IDs/hashes E3
o snapshot 03, selección completa y fecha de lectura. No se guardan existencias,
reservas o precios innecesarios en el bloque técnico. Un adaptador puede usar
tipos/funciones puras E1; cualquier extracción compartida de consolidación o
lector la integra raíz sin cambiar la fórmula ni firmas públicas E1.

Material de origen es snapshot, no editor de catálogo. Sus IDs/unidades/cantidades
no se reescriben desde el documento. Alcance puede incluir/excluir líneas de esa
selección explícitamente, con aviso de selección parcial; no elimina material
de sala. Se permiten conceptos documentales manuales (por ejemplo servicio)
identificados como tales, sin crear artículos/equipos ni afirmar horas reales.

Preview muestra ámbito/fuentes/revisión, secciones, variables, destinatario,
líneas incluidas/ausentes y valoración si corresponde. Es lectura, token/hash
de 10 min, versiones actuales y modelo 1. Confirmación recalcula/valida en servidor.
Cambio de fuente, plantilla, permiso o versión desde preview produce 409 antes
de publicar. Una fuente histórica seleccionada exige aceptación explícita.

El estado de frescura se deriva al consultar: `actual`, `desactualizada` o
`no_comprobable`, con qué se comparó y cuándo. Cambiar diseno_version de sala,
selección de obra o filas BOM de origen marca desactualización. Si no puede
comprobar el resto de fuentes sin un permiso, no consulta datos ocultos ni dice
«actual» sin evidencia. La revisión/PDF antiguos conservan sus cifras/textos.
Cambios de precio vigente no reprician el documento: comparación de precio es
una consulta autorizada separada y sólo produce aviso.

«Actualizar fuente» prepara diff explícito entre snapshot anterior y captura
nueva; conserva textos editados/destinatario hasta elección y no publica al abrir.
Líneas nuevas empiezan sin valoración. Emparejar sólo por identidad estable de
origen/artículo/unidad, nunca por parecido; precio/regla/impuesto anterior sólo
se mantiene mediante elección revisada. No copiar importes de una línea retirada
a otra. Aceptación/envío/pago no son campos heredables de ninguna revisión.

Guardar lleva version de cabecera, revisionBaseId/hash y UUID `clavePeticion`.
Misma clave/hash devuelve la misma revisión después de ACL actual; otra carga
con esa clave, 409. Dos pestañas con la misma base: una revisión gana y la otra
conserva su edición con 409. Se escribe revisión/valoración/PDF/operación y avanza
cabecera en una transacción. Un guardado sin cambio devuelve revisión actual,
sin duplicar numeración. El orden histórico es número, no llegada de respuestas.

## Plantillas SOW y destinatario opcional

Plantilla documental distinta de `plantillas_sala`: nombre, secciones ordenadas
con título/texto plano, versión optimista y activo. Editable por quien pueda
editar propuestas en algún ámbito, sin abrir catálogo AV. Guardar/cambiar una
plantilla no modifica propuestas existentes. Al elegirla se revisa y copia
snapshot/id/versión/hash y se crean nuevos IDs de sección del documento.

Variables permitidas: `propuesta.titulo`, `proyecto.nombre`, `proyecto.codigo`,
`sala.nombre`, `sala.codigo`, `salas.listado`, `destinatario.nombre` y
`revision.fecha`. Sintaxis única `{{clave}}`, sin expresiones, HTML, Markdown
ejecutable, JS, rutas de objeto libres o llamadas. Clave desconocida se rechaza;
valor ausente se muestra `[Sin dato: clave]` con su fuente, no vacío inventado.
Resolución queda congelada por revisión, no cambia al renombrar obra/contacto.

Plantilla sólo contiene estructura/textos/tokens permitidos. No admite precio,
impuesto, total, moneda, destinatario/contacto/grupo estructurado, aceptación,
pago ni vínculo de obra anterior. «Guardar alcance como plantilla» exige
seleccionar/revisar secciones, copia sólo ese esquema textual y nunca el
snapshot completo de la propuesta. Referencias literales escritas dentro de un
texto son visibles en ese preview; no se promete un borrado semántico automático.
Crear propuesta desde plantilla vuelve a pedir ámbito/fuente/destinatario y
deja valoración ausente. No se implementa un clon total que arrastre datos.

Destinatario opcional, inline por revisión: entidad/nombre/contacto/grupo como
texto literal y procedencia manual (autor/fecha del servidor). Puede ser null
en una propuesta interna válida. Grupo es etiqueta de destinatario, no audiencia
de informes, lista de correo, ACL ni nivel de jerarquía. No hay CRM/directorio
de clientes, FK a proveedores, sincronización, validación de entrega ni envío.
Modificarlo crea otra revisión; el PDF anterior conserva su destinatario.

## Valoración opcional, exacta y claramente prevista

Por línea: clave técnica/manual, cantidad/unidad o ausencia, moneda EUR/USD,
coste unitario **previsto** opcional con fuente/calidad, y una de estas reglas:
precio directo opcional, recargo sobre coste o margen sobre precio de venta.
Importes son sin impuestos; no interpretar un precio bruto como neto. No hay
descuentos/retenciones, divisa implícita o conversión automática en este mínimo.

Catálogo/oferta sólo rellena un previsto tras selección visible y confirmación:
artículo/oferta ID cuando exista, valor textual exacto, moneda, estado
final/orientativo del origen, fecha y hash de los campos consultados. «Final» de
una oferta E1 no significa propuesta aceptada/coste real. Manual también conserva
quién/fecha/motivo. No importa tarifas/costes salariales de 05 ni beneficio de 07.

Núcleo compartido entregado por raíz `src/lib/importes.ts`:

```ts
export declare function parsearDecimal(texto: string, escala: number): bigint;
export declare function formatearDecimal(valor: bigint, escala: number): string;
export declare function dividirRedondeando(numerador: bigint, denominador: bigint): bigint;
export declare function importeMaterialMinor(precioU4: bigint, cantidadU2: bigint): bigint;
export declare function importeLaboralMinor(tarifaU4: bigint, minutos: bigint): bigint;
export declare function sumarImportesConocidos(importes: readonly (bigint | null)[]): bigint | null;
export declare function precioVentaU4(costeU4: bigint, regla: 'recargo' | 'margen', porcentajeU4: bigint): bigint;
export declare function importePorcentajeMinor(baseMinor: bigint, porcentajeU4: bigint): bigint;
```

Precios y porcentajes escala 4, cantidad escala 2, unidad monetaria menor escala 2;
20% es `20.0000`/`200000n`, no 0,20. BigInt y cadenas canónicas, sin Number,
parseFloat, exponentes ni EPSILON. Magnitud escalada máxima 30 dígitos e
intermedios 60 según helper; límites de negocio de propuesta aparte. HALF_UP
simétrico `mitad_fuera_cero_v1` declarado en snapshot/PDF.

Coste 100 + recargo 20% da 120; coste 100 con margen 20% da 125. Recargo permitido
0..1000%; margen 0..<100%, sin negativos. Regla basada en coste ausente produce
precio desconocido, no cero. Precio directo conocido puede existir sin coste:
total de propuesta conocido y subtotal de coste previsto desconocido son estados
distintos. Cero explícito es válido y conserva fuente. No se llama beneficio
real a la diferencia ni a la regla matemática de margen.

Por cada línea se configura impuesto explícitamente: `sin_configurar`,
`no_aplica` con motivo o porcentaje 0..100 con fuente/etiqueta. No valor por defecto
21%, norma fiscal inventada ni impuesto copiado de plantilla. Sin configurar:
base puede conocerse, impuesto/total bruto quedan desconocidos. No_aplica o 0%
son decisiones escritas, no equivalentes a campo vacío.

Orden fijo: precio unitario U4 por regla → baseMinor desde cantidadU2 con
`importeMaterialMinor` → impuesto por línea desde baseMinor con
`importePorcentajeMinor` → totalMinor base+impuesto. Se redondea por línea y se
suman enteros menores por moneda, no se recalcula impuesto sobre el agregado.
Conservar inputs/reglas/importes y precisión para reproducir UI/PDF. No un total
EUR+USD ni tipo de cambio supuesto.

Estados por medida (base/impuesto/total/coste previsto): `sin_datos`, `parcial`,
`completo`, con subtotal conocido y número de líneas ausentes/orientativas. Suma
vacía null. No usar «oferta cerrada» al faltar datos; incluso completa sigue
siendo propuesta interna sin eventos comerciales. Una parcial puede guardarse
y tener PDF correcto, identificado como parcial; es distinto de PDF fallido.

## PDF real, publicación atómica y conservación

Vista previa HTML y PDF usan el mismo modelo validado/snapshot, sin consultas
de fuente o precio dentro del pintor. PDFKit existente, A4 vertical, tablas
paginadas/cabeceras repetidas, texto completo envuelto y fuente mínima 9 pt.
Sin HTML remoto, fuentes/recursos por URL, screenshots ni otro dibujo de sala.
Incluye «Propuesta interna», ámbito/selección, revisión/fecha Madrid/autor,
fuente/estado de frescura verificado, SHA de revisión, secciones/ausencias,
destinatario y valoración sólo cuando existe. Importe/coste previsto orientativo
y política de impuestos/redondeo legibles; pies y filas no tapan texto.

Se preparan modelo/bytes acotados antes de la transacción final. No `after()`,
promesas sueltas ni scheduler: POST espera el render. Se conserva edición cliente
y último PDF correcto si falla. Antes del commit se vuelven a comprobar identidad,
ACL, versiones, fuentes revisadas y cuota; una revocación durante render impide
publicar. La transacción corta inserta revisión/valoración/bytea/operación y
avanza CAS. No mantener locks de sala durante el render ni publicar una revisión
sin PDF. Dos peticiones idénticas pueden renderizar, pero sólo publican una vez.

SHA técnico y de fuente separan cambios de texto/origen. SHA de revisión cubre
envoltura canónica de técnico+valoración opcional+versiones+autor/fecha/ID, sin su
propio hash ni hash PDF; después se pinta ese hash y se calcula SHA de bytes.
Esto evita circularidad. Cada revisión y su PDF son inmutables. Reabrir después
de reiniciar o borrar tmp E1 lee los mismos bytes, sin regenerarlos.

Persistir PDF bytea con longitud/SHA, nombre de servidor por UUID y MIME fijo.
Descarga por UUID de revisión/archivo tras ACL actual y comprobación de longitud/
hash, no ruta/nombre libre. `private,no-store`, attachment, nosniff,
X-AV-Revision y X-AV-SHA256. Corrupción 503, sin bytes parciales con 200. Sin URL pública,
correo o estado de envío. Archivar conserva revisiones; no caducidad automática
de PDF en este contrato. La conservación consume cuota explícita, no espacio
ilimitado ni dependencia de archivos temporales.

## SQL aditivo propuesto: raíz integra, no ejecutar aquí

```sql
create table if not exists propuestas (
  id uuid primary key default gen_random_uuid(),
  ambito text not null check (ambito in ('sala','obra')),
  sala_id uuid references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  actual_revision_id uuid,
  contiene_valoracion boolean not null default false,
  archivada_en timestamptz,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check ((ambito='sala' and sala_id is not null and proyecto_id is null) or
    (ambito='obra' and proyecto_id is not null and sala_id is null)),
  check ((version=0) = (actual_revision_id is null))
);
create table if not exists propuesta_plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 160),
  version integer not null default 0 check (version >= 0),
  secciones jsonb not null check (jsonb_typeof(secciones)='array'),
  activo boolean not null default true,
  autor_id uuid not null references usuarios(id) on delete restrict,
  actualizado_en timestamptz not null default now()
);
create table if not exists propuesta_revisiones (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null references propuestas(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid references propuesta_revisiones(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo=1),
  generador text not null default 'rea06-1' check (generador='rea06-1'),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  tecnico jsonb not null check (jsonb_typeof(tecnico)='object'),
  fuente jsonb not null check (jsonb_typeof(fuente)='object'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  tecnico_sha256 text not null check (tecnico_sha256 ~ '^[0-9a-f]{64}$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  contiene_valoracion boolean not null,
  pdf_id uuid not null,
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  unique(propuesta_id,numero), unique(propuesta_id,id), unique(id,pdf_id)
);
create table if not exists propuesta_valoraciones (
  revision_id uuid primary key references propuesta_revisiones(id) on delete restrict,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  totales jsonb not null check (jsonb_typeof(totales)='object'),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$')
);
create table if not exists propuesta_archivos (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null unique references propuesta_revisiones(id) on delete restrict,
  nombre text not null check (nombre ~ '^propuesta-[0-9a-f-]+[.]pdf$'),
  mime text not null default 'application/pdf' check (mime='application/pdf'),
  contenido bytea not null check (octet_length(contenido) between 1 and 20971520),
  bytes integer generated always as (octet_length(contenido)) stored,
  paginas integer not null check (paginas between 1 and 100),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  check (encode(digest(contenido,'sha256'),'hex')=sha256),
  unique(revision_id,id)
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='propuesta_actual_fk'
    and conrelid='propuestas'::regclass) then
    alter table propuestas add constraint propuesta_actual_fk
      foreign key(id,actual_revision_id) references propuesta_revisiones(propuesta_id,id)
      deferrable initially deferred;
  end if;
  if not exists(select 1 from pg_constraint where conname='propuesta_pdf_fk'
    and conrelid='propuesta_revisiones'::regclass) then
    alter table propuesta_revisiones add constraint propuesta_pdf_fk
      foreign key(id,pdf_id) references propuesta_archivos(revision_id,id)
      deferrable initially deferred;
  end if;
end $$;
create table if not exists propuesta_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  propuesta_id uuid not null references propuestas(id) on delete restrict,
  revision_id uuid not null references propuesta_revisiones(id) on delete restrict,
  tipo text not null check (tipo in ('revision','archivar','reactivar')),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);
create index if not exists propuestas_contexto_sala_idx on propuestas(sala_id,id);
create index if not exists propuestas_contexto_obra_idx on propuestas(proyecto_id,id);
create index if not exists propuesta_revisiones_historia_idx
  on propuesta_revisiones(propuesta_id,numero desc);

create or replace function propuesta_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'Una revision y su PDF no se sobrescriben';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['propuesta_revisiones','propuesta_valoraciones',
    'propuesta_archivos','propuesta_operaciones'] loop
    execute format('drop trigger if exists propuesta_inmutable on %I',tabla);
    execute format('create trigger propuesta_inmutable before update or delete on %I '
      'for each row execute function propuesta_inmutable()',tabla);
  end loop;
end $$;
create or replace function propuesta_identidad() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.ambito,new.sala_id,new.proyecto_id,new.creado_por,new.creado_en)
     is distinct from
     row(old.id,old.ambito,old.sala_id,old.proyecto_id,old.creado_por,old.creado_en) then
    raise exception 'Una propuesta no cambia de ambito';
  end if;
  return new;
end $$;
drop trigger if exists propuesta_identidad on propuestas;
create trigger propuesta_identidad before update on propuestas
  for each row execute function propuesta_identidad();
```

Insertar revisión/PDF con IDs preasignados en la misma transacción permite FK
deferida sin publicar incompleto. El servicio comprueba número/antecedente de la
misma propuesta, valoración presente exactamente cuando indica la bandera,
archivo/revisión coincidentes, hashes, límites/CAS y que toda selección de sala
pertenece al ámbito. Esas relaciones no se prueban sólo con una FK de UUID.

## Propiedad, API, concurrencia y límites

Ejecutor 06 posee nuevos `src/lib/propuestas/{modelo,autorizacion,fuentes,plantillas,
variables,valoracion,pdf,repositorio,servicio,http}.ts`, pruebas raíz
`src/lib/propuestas-*.test.ts`, `src/components/propuestas/{lista,editor,fuente,
plantillas,destinatario,valoracion,vista-previa,historial}.tsx`, árbol
`src/app/api/propuestas/`, páginas `src/app/salas/[id]/propuestas/page.tsx` y
`src/app/proyectos/[id]/propuestas/page.tsx`, scripts/gates nuevos con sufijo 06.
Evidencia sólo `output/rea-integracion/rea06/`. No toca archivos ajenos.

Raíz posee schema/migración `2026-10-rea06-propuestas.sql` y rollback en su carpeta,
enlaces de sala/proyecto/panel, `src/lib/importes.ts`, extractos E1/fechas comunes,
mensajes de borrado referenciado y continuidad 17/18/24. Sin cambios de CSV/seed,
paquetes, permisos/roles, acciones físicas, E2/E3 o REA-04/05 por el ejecutor.

| API | Operación |
|---|---|
| `/api/propuestas` | GET lista por ámbito/ACL; POST nueva con preview/clave y primera revisión+PDF. |
| `/api/propuestas/preparar` | POST modelo/vista previa/hash de fuente, textos y valoración autorizada, sin escrituras. |
| `/api/propuestas/[id]` | GET actual; POST nueva revisión con CAS/clave; PATCH archivo/reactivación con versión/motivo. |
| `/api/propuestas/[id]/actualizar-fuente` | POST sólo preview/diff; publicación posterior usa confirmación ordinaria explícita. |
| `/api/propuestas/[id]/revisiones` y `/revisiones/[revisionId]` | GET historial/revisión después de ACL actual de propuesta y contenido. |
| `/api/propuestas/[id]/revisiones/[revisionId]/pdf` | GET bytes de esa revisión tras ACL/integridad; sin nombres libres. |
| `/api/propuestas/plantillas` y `/plantillas/[id]` | GET/POST/PATCH esquema sólo textual con CAS; copiar no importa destinatario/dinero. |
| `/api/propuestas/precios` | GET búsqueda/precio puntual sólo compras+catálogo; máximo 20, no catálogo al navegador. |

Handlers Node, params asíncronos y guardas propias; las guías Next locales ya
leídas de Route Handlers/after siguen aplicando. Mutaciones mismo origen,
Cache-Control no-store, JSON estricto y cuerpo incremental acotado. Sesión/SQL
dentro de frontera de errores. API financiera directa sin permiso 403 antes de
leer precios/valoración. Recurso ajeno/inexistente 404; entrada 400, conflicto 409,
límite 413, fuente/modelo/impuesto inválido 422, infraestructura/render 503 seguro.
No 200 vacío por caída de BD, errores con SQL o documento sin PDF correcto.

Confirmación después de render toma locks en orden acordado: salas seleccionadas
por UUID → proyecto si procede → propuesta. Ninguna FK de sala por primera vez
poseyendo proyecto. Revalidar cierre/jerarquía/fuentes y ACL; documentos de ámbito
cerrado son consulta, sin reapertura desde aquí. Cambió conjunto/versión, rollback
y 409, nunca incorporar sala nueva sin revisar. Raíz coordina el gate final de
cierre/A/E3; el ejecutor 06 no modifica esas acciones ni impone su aislamiento.

La UI conserva cambios/selección en error, permite comparar 409 y no deja que una
respuesta/preview tardío sustituya una edición posterior. Revisión/valoración/
frescura/destinatario/ausencias visibles antes de guardar. Lista y PDF reabierto
apuntan a revisión exacta. Teclado/foco/etiquetas accesibles y sistema visual
vigente; flujo completo en escritorio antes de cierre móvil.

Límites: cuerpo 128 KiB, 20 salas, 2000 líneas, 30 secciones de 10000 caracteres cada una,
100 revisiones por propuesta,4 MiB de snapshot completo,20 MiB/100 páginas PDF.
Listado/historia 50 y búsquedas 20. Cuota propuestas: 200 MiB por propuesta/1 GiB
global, comprobada con advisory lock transaccional antes de publicar; el subtotal
de cuota no expone datos de otras propuestas. Si no cabe, conservar lo anterior
y rechazar, sin truncar texto/importes ni borrar una revisión vigente. No expiración
automática ni borrado desde UI; limpieza futura exige política explícita.

## Aceptación Dado / Cuando / Entonces

1. Dadas sala legado y obra con varias salas, cuando prepara propuesta, entonces
   conserva el ámbito/IDs originales y no crea/adopta proyecto/sala ni otro BOM.
2. Dado técnico sin compras, cuando crea/consulta fuente de diseño y manipula
   API/RSC, entonces no hay consulta/precio/importe/valoración ni lectura E1 completa.
   Propuesta valorada deniega acceso; retirada de permiso también bloquea PDF.
3. Dadas fuente E3 y BOM confirmada autorizadas, cuando guarda, entonces conserva
   IDs/hashes/cantidades/avisos y distingue diseño parcial de necesidad completa.
   No leer stock/precios/parámetros ocultos para eliminar sus columnas después.
4. Dado cambio de diseño/BOM o ámbito desde preview, cuando confirma, entonces 409
   sin publicación. Al abrir antigua revisión aparece desactualizada/no comprobable
   con causa y PDF previo intacto; refresco explícito muestra diff y requiere elección.
5. Dadas dos pestañas/misma clave repetida, cuando publican, entonces sólo una
   revisión por payload; versión vieja 409 conserva formulario y hash incompatible 409.
6. Dada plantilla con variables y otra propuesta valorada, cuando guarda/copia
   alcance, entonces sólo estructura/textos/tokens; nuevos IDs, sin destinatario,
   dinero/impuestos/aceptación. Variable ausente visible y desconocida rechazada.
7. Dado destinatario nulo o contacto/grupo manual, cuando publica y cambia contacto,
   entonces ambas propuestas son válidas internas, revisión anterior no cambia y
   no crea CRM/proveedor, permiso ni envío.
8. Dado coste 100, cuando usa 20% de recargo/margen, entonces precio 120/125 con helper
   exacto. Margen 100%, negativo/precisión excesiva fallan; coste ausente no es 0.
9. Dados precio directo sin coste, precio/cantidad ausentes y cero explícito,
   cuando valora, entonces separa estados de venta/coste; subtotal parcial/null,
   cero conocido, nunca supuesto coste real o beneficio.
10. Dadas dos líneas de base 0,01 con impuesto 50% por línea, cuando calcula, entonces
    impuesto total 0,02 con HALF_UP, no 0,01 del agregado. Impuesto vacío desconocido,
    0%/no aplica explícitos y EUR/USD separados sin tipo de cambio.
11. Dado precio de catálogo orientativo/final y luego cambiado, cuando confirma,
    entonces snapshot previo conserva previsto/fuente exacta. No histórico real,
    tarifa laboral ni revalorización automática por nueva oferta.
12. Dado fallo/cancelación del PDF, cambio de ACL durante render o cuota excedida,
    cuando publica, entonces no hay revisión/valoración/archivo parcial; último
    correcto sigue reabrible y reintento no duplica publicación.
13. Dado reinicio y borrado tmp E1, cuando descarga PDF por revisión, entonces
    mismos bytes/SHA. Otro id/nombre/traversal, permiso retirado o corrupción no
    filtran bytes; corrupción 503 y siempre controles actuales.
14. Dados textos/nombres largos, tildes, variables ausentes y tablas multipágina,
    cuando abre/renderiza PDF real, entonces no corta/solapa ni reduce a ilegible;
    contiene fuentes/revisión/monedas/impuestos/redondeo iguales al preview.
15. Dadas fotos de hechos/CSV antes, cuando crea/actualiza/valora/archiva propuesta,
    entonces diseño E3, BOM/sala, stock, pedidos/carga/hitos, precios y tiempos no
    cambian. Ningún estado enviado/aceptado/pagado aparece ni se hereda a revisión.
16. Dado escritorio con usuarios de edición/lectura/sin compras, cuando recorre
    fuente, SOW, destinatario, valoración, conflicto y PDF reabierto, entonces ACL
    y respuestas tardías conservan estado correcto. Sólo después validar móvil,
    teclado/foco/errores y ausencia de dinero en HTML/RSC no autorizado.

Raíz entrega nueva BD sintética 06 y límites/identidad verificados; no usar
`.env.local`, inventario, producción o bases previas. Guardar logs crudos,
spies SQL/ACL, hashes operativos antes/después, PDF real reabierto/renderizado,
capturas escritorio/móvil y pruebas de dos conexiones en `output/rea-integracion/rea06/`.
Pruebas puras, integración SQL/E2E, tipos/lint/build sin BD y regresiones de
fronteras compartidas. Revisión independiente y cierre basado en esos hechos,
no en el informe del autor. ST21/22/23 siguen pendientes hasta implementación/gates.

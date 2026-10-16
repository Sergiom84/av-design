# REA-02 · Preferencias personales y panel autorizado

Estado: especificación lista para implementar. Contrato padre: `17-integracion-rea.md`.
Candidatos ST08 y ST31 de `18-rea-cobertura.md`. Esta unidad no declara
operativo un asistente generativo; sus preferencias estarán disponibles para
la consulta contextual de REA-09 y ya tendrán un uso real en el catálogo.

## Resultado observable

Una persona guarda marcas y filtros de consulta propios sin alterar ninguna
referencia ni el diseño de una sala. Puede consultar referencias activas de
esas marcas, ver por qué aparecen y volver al catálogo completo. Personaliza
el orden y la visibilidad de las tarjetas existentes del Panel. Sus cambios
se conservan al volver a entrar y no afectan a otra persona.

El Panel actual consulta catálogo, plantillas, salas, almacén, compras y carga
de una vez. Esta unidad sustituye esa lectura de la portada por consultas
condicionales según permiso efectivo **y** tarjetas visibles. Un usuario sin
acceso a compras no recibe ni provoca consultas de pedidos desde el Panel.
Guardar preferencias no concede permisos sobre ningún dato.

## Propiedad y límites

Un ejecutor implementa esta unidad completa. Son suyos los módulos nuevos
`preferencias-usuario.ts`, `preferencias-usuario-repositorio.ts`,
`preferencias-usuario-http.ts`, `panel-repositorio.ts`, los componentes
`preferencias/` y `panel/`, `/api/preferencias/`,
`/api/catalogo-preferido/`, la portada `src/app/page.tsx`,
`src/app/cuenta/page.tsx` y la integración en `src/app/catalogo/page.tsx`.
Puede crear pruebas `src/lib/*.test.ts` y `src/components/*/*.test.tsx`,
scripts/E2E con sufijo `rea02`. No toca los archivos de A/B de REA-01,
`datos.ts`, `acciones*.ts`, el buscador global, E1, `tipos.ts` ni paquetes.

El arquitecto integra el SQL propuesto en `db/schema.sql` y la migración
`2026-10-rea02-preferencias.sql`. No modificar catálogos CSV, siembra,
existencias, precios, permisos, roles ni fuentes históricas de evidencia.
No introducir una segunda página de inicio ni otro selector de artículos:
los resultados preferidos enlazan a la ficha de referencia existente.

## Modelo de preferencias

Tabla propuesta `preferencias_usuario`:

- `usuario_id uuid primary key references usuarios(id) on delete cascade`.
- `version integer not null default 0 check (version >= 0)`.
- `panel jsonb not null default '{}'`, con check de objeto JSON.
- `catalogo jsonb not null default '{}'`, con check de objeto JSON.
- `actualizado_en timestamptz not null default now()`.

El repositorio usa tipos/validadores propios y listas blancas estrictas. El
cliente nunca escoge `usuario_id`. No hay fila compartida por rol ni fila
para el administrador ficticio de desarrollo. La lectura sin fila produce
valores predeterminados sin insertar nada. El modo ficticio muestra esos
valores y una explicación para iniciar sesión si quiere persistir cambios.

`panel` contiene `orden: ClaveTarjeta[]` y `ocultas: ClaveTarjeta[]`, sin
duplicados. Las claves son sólo las tarjetas existentes con una fuente real:
equipos, cables, consumibles, plantillas, salas, referencias de almacén,
reservas activas, pedidos en curso y cargas abiertas. Las claves omitidas en
el orden se añaden en el orden canónico. Una lista vacía de ocultas significa
mostrar todas las permitidas. Se puede ocultar todas sin perder el control
de personalización ni el botón Restablecer.

`catalogo` contiene hasta diez marcas literales distintas, `q` de hasta
200 caracteres y `tipo` opcional (`equipo | cable | consumible`). La marca
se recorta en extremos, sin unir variantes por parecido. Su longitud está
acotada a 100 caracteres. No se aceptan claves extra, HTML, expresiones SQL,
tipos desconocidos ni listas excesivas. Se informa de las marcas retiradas o
sin referencias activas; no se reemplazan por otra marca.

Cada cambio de grupo exige la `version` leída, bajo una transacción y bloqueo
de su fila. La primera escritura crea una fila de forma segura ante dos
altas simultáneas. Una versión antigua devuelve conflicto 409 y conserva la
edición local; el usuario puede recargar y comparar. No sobrescribir la
preferencia nueva de otra pestaña. Se cambia sólo el grupo solicitado; una
edición de Panel no borra las marcas. Restablecer también es una operación
explícita por grupo, con control de versión.

## Autorización y HTTP

Todos los repositorios reciben el usuario actual del servidor. Exigen un
usuario real, contraseña ya cambiada y permiso de lectura de la sección del
grupo: `panel:ver` o `catalogo:ver`. Personalizar la presentación propia no
requiere permiso para modificar catálogo/almacén ni genera ese permiso.
No se alteran los roles para conseguir que pase una comprobación.

`GET /api/preferencias?grupo=panel|catalogo` devuelve sólo el grupo pedido,
la versión y opciones autorizadas. Las tarjetas de secciones ocultas no
figuran en la respuesta ni en el HTML de su configuración. La preferencia
guardada nunca sustituye al permiso efectivo de la petición actual.

`PUT /api/preferencias` recibe JSON estricto `{ grupo, version, valor }`;
`DELETE` recibe `{ grupo, version }` para restablecer. No acepta un ID de
usuario ni un grupo implícito. Exigir origen propio en mutaciones usando
la convención existente `mismoOrigen`; limitar cuerpo a 8 KiB antes del
parseo y validar formato. Mantener `Cache-Control: no-store` en respuestas.

Estados: 401 sin sesión/usuario inactivo; 403 provisional, ficticio, permiso
retirado u origen ajeno; 400 entrada inválida; 409 versión antigua; 413
cuerpo excesivo; 503 BD no configurada/no disponible o error interno. Incluir
la sesión dentro de la frontera de errores para no filtrar fallos SQL. No
responder 200 con una lista vacía cuando falla el servidor.

## Consulta preferida real

`GET /api/catalogo-preferido` lee sólo preferencias del usuario autenticado
con `catalogo:ver`, aplica `q`, tipo y marcas de su configuración y devuelve
como máximo veinte referencias activas, orden estable y motivos literales.
La consulta debe aplicar filtros antes de `limit`, no descargar el catálogo
al cliente ni filtrar veinte resultados de una búsqueda anterior.

Si no eligió marcas, la interfaz lo explica y permite consultar el conjunto
completo con sus filtros; no simula recomendaciones personales ni oculta
arbitrariamente marcas. Un tipo vacío significa todos. Las ausencias y
errores son distintos. Se indican los filtros activos, el límite de veinte,
la coincidencia de marca y el carácter personal. El resultado sólo incluye
identidad, descripción, tipo/unidad/categoría y motivo; ningún precio ni
dato operativo. Elegir una preferencia no sustituye automáticamente equipos,
acepta una fila de importación ni aplica una plantilla.

La edición de las marcas/filtros está en Mi cuenta para usuarios habilitados
y en una tarjeta de la portada de Catálogo. La tarjeta de resultados puede
usar la configuración ya guardada y ofrecer enlace para cambiarla. Evitar
dos formularios que compitan por el mismo estado en una página. No mostrar
datos de catálogo en `/cuenta` mientras la clave sea provisional.

## Panel y tarjetas

La portada sigue `exigirSeccion('panel','ver')` y `SinConfigurar` sin BD.
Obtiene sólo métricas permitidas mediante el nuevo repositorio. No llama a
`contarPanel()`/`contarAlmacen()` porque combinan secciones. Las consultas se
pueden agrupar **dentro de una misma sección**, nunca incluir una sección
oculta en una subconsulta aparentemente inocua. Tampoco consultar una
sección sólo para elaborar el mensaje «Todo completo» o la guía de trabajo.

Conservar significados actuales de métricas y enlaces. Las ausencias de
medidas se derivan de medidas canónicas; las reservas siguen siendo activas,
los pedidos en curso son pedido/recibido parcial, las cargas abiertas no
cerradas y el bajo mínimo usa existencias menos reservas. Los avisos se
muestran sólo para una sección autorizada y visible. Cero es un resultado;
no autorizado, error y sin datos no se convierten en cero.

La personalización permite mostrar/ocultar y mover arriba/abajo con botones
etiquetados y teclado; no exige arrastrar. Guardar aplica la versión del
servidor, mantiene mensaje de éxito/error/conflicto accesible y recarga los
datos autorizados de la portada. La retirada de un permiso entre cargar y
guardar se comprueba de nuevo en el servidor. El usuario no recibe conteos,
avisos ni enlaces de secciones retiradas al recargar.

Las tarjetas futuras de agenda, horas y propuestas se registrarán al existir
su fuente en REA-04/05/07. Esta unidad no añade tarjetas con valores falsos.

## Aceptación y evidencia

1. Preferencias de dos usuarios reales aisladas; estado inicial sin filas,
   guardar/reabrir, edición sólo del grupo y restablecimiento comprobados.
2. Dos versiones concurrentes: un ganador, 409 para la antigua y sin pérdida
   silenciosa. Alta simultánea segura. Cuerpos inválidos/excesivos, claves,
   identidad falsificada, origen ajeno y usuario ficticio/provisional rechazados.
3. Dos marcas y referencias de variantes: filtros literales, tipo y búsqueda
   aplicados antes del límite veinte; sin marcas, retiradas y sin resultados
   comunicados con exactitud. Ninguna sustitución ni cambio de catálogo.
4. Panel con catálogo/plantillas/compras/carga ocultos: spy de consultas
   confirma que no se consultan sus tablas y la respuesta/HTML no contiene
   sus métricas/avisos. Repetir retirando un permiso con la cookie aún válida.
5. Métricas contrastadas con sus tablas/detalles en una lectura coherente.
   Ocultar/ordenar todas las tarjetas y restablecer funciona por teclado.
6. Recorrido de escritorio completo con cambio de usuario y persistencia;
   móvil como última validación. Errores de red, respuesta tardía y conflicto
   conservan lo editado y permiten recuperación.
7. Pruebas apropiadas, tipos/lint/build sin BD, nueva BD sintética REA-02,
   revisión independiente y fotos de hechos protegidos antes/después.

Guardar evidencia en `output/rea-integracion/rea02/`. El arquitecto provee el
destino nuevo antes de ejecutar escrituras; no usar `.env.local`, bases
históricas ni destinos de REA-01 mientras sus ejecutores los verifican.

## Garantías precisadas por revisión independiente

El editor del Panel mantiene identidad por usuario, sin desmontarse al cambiar
la versión del RSC. Un refresh posterior al 200 de Guardar/Restablecer conserva
la edición iniciada después, el anuncio accesible y la versión CAS confirmada;
no adopta automáticamente los valores de una respuesta tardía.

Los permisos actuales filtran tanto el formulario como una comparación que ya
estuviera abierta. Retirar una sección elimina sus opciones de ambas superficies
y del siguiente payload, sin borrar la edición que sigue autorizada. Usar la
versión del servidor es una elección explícita. La nueva prueba monta la página
real y comprueba render, adopción y payload tras recibir el RSC restringido.
Los resultados y el estado de aceptación se registran en `17-integracion-rea.md`;
este contrato no certifica por sí mismo el cierre.

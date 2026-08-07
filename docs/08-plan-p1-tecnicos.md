# Plan P1 · Técnicos y ciclo de vida de la sala

Plan de implementación autocontenido para ejecutar en una sesión limpia.
Escrito el 7-8-2026. El ejecutor debe leer antes `AGENTS.md` (contrato del
proyecto) y `docs/07-roadmap.md` (dónde encaja P1); este documento manda sobre
cualquier suposición y, si contradice al código real, gana el código y se
reporta la discrepancia.

## 1. Contexto en tres párrafos

AV_design es la aplicación interna del departamento de Audiovisuales: diseña
salas, calcula metros de cable y saca la lista de material contra un almacén.
Next.js 16 (App Router) + TypeScript + Tailwind 4 + Postgres con `postgres.js`
(`src/lib/db.ts`). Desarrollo contra Docker (`npm run db:reset`), producción
en Neon desplegada por Render desde `main` (autodeploy: **cada push a main
publica**). Se entra con clave de departamento, sin usuarios individuales.

Hoy la aplicación registra el *qué* (equipos, conexiones, metros, reservas,
pedidos, cargas) pero no el *quién* ni el *cuándo* del ciclo de una sala. P1
añade exactamente eso: qué técnico dio de alta el proyecto de sala, quién
recibió el material, quién la instaló y cuándo se entregó. Sin contraseñas:
se elige el nombre de una lista al registrar el hecho. La puerta sigue siendo
la clave única de departamento.

Criterio rector, confirmado contra la documentación de XTEN-AV (su X-Pro lo
hace mal y es su punto débil): **el estado del material se deriva, el hito
humano se registra**. Nada de un campo "estado de la sala" que se edita a
mano. Lo que dice si una sala está lista para montar ya existe y no se toca:
`src/lib/revision.ts`.

## 2. Datos reales del departamento

| Rol | Técnicos |
|---|---|
| `inicio` (inicio de proyecto) | Daniel, Elvin, Carlos, Diego |
| `recepcion` (recepción de equipamiento) | Roberto, Nacho, Miguel, Marcos |
| `instalacion` | Miguel, Diego |

Miguel y Diego tienen dos roles: **roles es una relación, no una columna**.

## 3. Reglas del proyecto que este trabajo NO puede romper

1. El dominio se escribe en español: tablas, columnas, tipos, funciones.
2. `src/lib/calculo-cable.ts` no se toca. Tampoco la numeración de cables.
3. La lógica nueva con decisiones (p. ej. qué hito falta, qué técnico puede
   firmar qué) va en `src/lib/` como funciones puras con pruebas
   (`node --test`, fichero `*.test.ts` junto al código, estilo de
   `src/lib/revision.test.ts`).
4. Las tablas alimentadas por CSV llevan columna `fuente` (`csv` se regenera
   con `npm run seed`, `app` no se pisa nunca). Los técnicos entran por CSV.
5. Nunca editar `db/seed.sql` a mano: se regenera desde `data/*.csv` con
   `scripts/` (mirar cómo lo hacen `data/puertos.csv` y `npm run seed`).
6. Cada bloque de interfaz en su carpeta: `src/components/<bloque>/`.
7. Sin emojis. Sin microcopy de relleno. Los tokens visuales de
   `design-system/MASTER.md` y las primitivas de `src/components/ui.tsx`
   (`Tarjeta`, `Aviso`, `Dato`, `Boton`, `Campo`): no inventar estilos.
8. El catálogo no viaja al navegador; para elegir técnico basta un `<select>`
   (son ocho personas, no novecientas referencias).
9. La app no revienta sin `DATABASE_URL`: toda página nueva pasa por
   `hayConfiguracion()` → `SinConfigurar` (ver cualquier `page.tsx`).
10. Commits: uno por unidad coherente y verificada, mensaje en español con el
    porqué. **Cada push a `main` despliega en producción.** Tras tres commits
    seguidos, parar y revisar el estado completo antes de otro.

## 4. Esquema de datos

Añadir a `db/schema.sql` (y ver §7 para producción):

```sql
-- P1 · Técnicos y ciclo de vida -----------------------------------------

create table tecnicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  fuente text not null default 'csv' check (fuente in ('csv', 'app'))
);

create table tecnico_roles (
  tecnico_id uuid not null references tecnicos(id) on delete cascade,
  rol text not null check (rol in ('inicio', 'recepcion', 'instalacion')),
  primary key (tecnico_id, rol)
);

-- Un hecho del ciclo de vida de la sala: quién y cuándo. No es un estado
-- editable: es un registro que se añade, como los movimientos de almacén.
create table hitos_sala (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas(id) on delete cascade,
  tipo text not null check (tipo in ('inicio', 'instalacion', 'entrega')),
  tecnico_id uuid references tecnicos(id),
  fecha date not null default current_date,
  notas text,
  creado_en timestamptz not null default now(),
  -- Un hito de cada tipo por sala: la sala se entrega una vez. Si se
  -- entregó mal, se borra el hito y se registra de nuevo, y eso se ve.
  unique (sala_id, tipo)
);
```

La **recepción no es un hito de sala**: ya existe el flujo de recepción de
pedidos (`src/components/compras/`, acciones en `src/app/compras/`) que
genera movimientos de `entrada`, y `movimientos.quien` ya es una columna. Lo
que cambia: donde hoy `quien` es texto libre o va vacío, la interfaz de
recepción ofrece el `<select>` de técnicos con rol `recepcion` y guarda el
nombre. **No** añadir FK de `movimientos` a `tecnicos` en esta iteración: el
histórico tiene textos libres y la migración no debe romperlo.

Decisiones ya tomadas (no reabrir):

- `hitos_sala.tecnico_id` es nullable: un hito histórico puede registrarse
  aunque el técnico ya no esté en la lista.
- `fecha` es `date`, no timestamp: el departamento registra "se instaló el
  día X", no la hora.
- No hay hito `recepcion` en `hitos_sala` porque la recepción es por pedido
  (una sala recibe material en varios pedidos y fechas).

## 5. Datos de siembra

Crear `data/tecnicos.csv`:

```csv
nombre;roles
Daniel;inicio
Elvin;inicio
Carlos;inicio
Diego;inicio,instalacion
Roberto;recepcion
Nacho;recepcion
Miguel;recepcion,instalacion
Marcos;recepcion
```

Ampliar el generador de siembra (`scripts/`, el que produce `db/seed.sql` —
localizarlo con `npm run seed` y leerlo antes de tocar) para que:
- inserte `tecnicos` y `tecnico_roles` desde ese CSV con `fuente = 'csv'`,
  regenerables en cada siembra (mismo patrón que `puertos`);
- no toque filas con `fuente = 'app'`.

## 6. Lógica pura y componentes

### 6.1 `src/lib/ciclo-vida.ts` (+ `ciclo-vida.test.ts`)

Funciones puras, sin base de datos:

- `tecnicosDeRol(tecnicos, roles, rol)`: los activos con ese rol, ordenados
  por nombre. Es la fuente de cada `<select>`.
- `resumenCicloVida({ hitos, pedidos, movimientos })`: devuelve la línea de
  tiempo de la sala: hito de inicio, recepciones (derivadas de los
  movimientos de entrada con sala o de pedidos recibidos de esa sala, con
  fecha y quién), instalación y entrega, más `pendiente: string[]` con lo que
  falta y en qué orden.
- `avisosDeEntrega(puntosMontaje, hitos)`: la entrega **avisa, no bloquea**
  (regla de la casa): si `revisarMontaje()` da bloqueos y se quiere registrar
  la entrega igualmente, el aviso lo dice y el hito lleva las notas
  obligatorias. Firmar una entrega con bloqueos exige nota.

Pruebas al estilo del proyecto: casos con nombres del departamento, aserciones
de orden y de textos completos, sin mocks.

### 6.2 Datos: `src/lib/datos-ciclo.ts`

Consultas con `postgres.js` siguiendo el patrón de `src/lib/datos-almacen.ts`:
listar técnicos con roles, hitos de una sala, insertar/borrar hito. Server
actions en `src/app/salas/acciones-ciclo.ts` (o junto a las acciones de sala
existentes, mirar cómo están repartidas) con `revalidatePath`.

### 6.3 Interfaz

- **`src/components/ciclo-vida/`**: tarjeta "Ciclo de vida" en la ficha de
  sala (`src/app/salas/[id]/page.tsx`), colocada entre `EstadoMontaje` y el
  esquema de conexiones. Línea de tiempo con los cuatro pasos (inicio →
  recepciones → instalación → entrega): los hechos con técnico y fecha, lo
  pendiente en `--tinta-tenue`, el formulario de registrar hito con
  `<select>` de técnicos del rol, fecha (por defecto hoy) y notas. Borrar un
  hito pide confirmación nativa (`confirm` no: usar un formulario con botón
  `Boton variante="peligro"` y texto claro, como `borrarSala`).
- **Alta de sala** (`src/components/sala/alta.tsx`): añadir `<select>`
  "Quién inicia el proyecto" (rol `inicio`, opcional) que crea el hito
  `inicio` al crear la sala.
- **Recepción de pedido** (`src/components/compras/detalle-pedido.tsx` o
  donde viva el formulario de recibir): sustituir el campo libre de quién por
  el `<select>` de rol `recepcion` (con opción "— otro —" que deja texto
  libre, para no perder flexibilidad).
- **Carga** (`src/components/carga/`): donde ya exista `quien`, ofrecer la
  lista completa de técnicos activos, mismo patrón.
- El panel (`src/app/page.tsx`) no se toca en P1.

## 7. Producción (Neon)

`npm run db:reset` solo vale en local. Para Neon, dejar preparado
`db/migraciones/2026-08-p1-tecnicos.sql` con **solo** los `CREATE TABLE`
nuevos y los `INSERT` de técnicos (idempotente: `create table if not exists`
+ `on conflict do nothing`), y **no ejecutarlo contra producción sin el
visto bueno de Sergio**. El acceso a Neon está documentado en July
(`July_unificada/context/access/av-design.md`); si el ejecutor no tiene
acceso, lo deja escrito y lo reporta como paso manual pendiente.

Orden de despliegue obligatorio: primero la migración en Neon, después el
push del código. Al revés, la ficha de sala consultaría tablas que no existen.
(El código debe degradar con elegancia si las tablas no están: capturar el
error de la consulta de técnicos y enseñar la tarjeta con un aviso, no romper
la ficha entera. Probarlo bajando las tablas en local.)

## 8. Orden de trabajo y criterios de aceptación

Unidades, cada una con su commit tras verificar:

1. **Esquema + siembra.** `db/schema.sql`, `data/tecnicos.csv`, generador de
   siembra, migración idempotente de §7. Aceptación: `npm run db:reset`
   levanta todo; `select nombre, rol from tecnicos join tecnico_roles...`
   devuelve los 8 técnicos con 10 filas de rol; volver a sembrar no duplica.
2. **Lógica pura.** `ciclo-vida.ts` + pruebas. Aceptación: `npm test` verde
   con las pruebas nuevas incluidas; `resumenCicloVida` ordena bien y
   `avisosDeEntrega` exige nota con bloqueos.
3. **Ciclo de vida en la ficha de sala.** Componente + datos + acciones.
   Aceptación: en local se registra inicio, instalación y entrega con
   técnico y fecha; la entrega con bloqueos avisa y exige nota; borrar hito
   funciona; la ficha no revienta sin las tablas (aviso, no error).
4. **Recepción y alta con técnico.** Selects en compras, alta de sala y
   carga. Aceptación: recibir un pedido guarda el nombre en
   `movimientos.quien`; crear sala con técnico crea el hito `inicio`.
5. **Verificación final.** `npm test`, `npm run build`, recorrido manual en
   local (crear sala → registrar ciclo completo), captura de la ficha en
   escritorio y móvil. Revisar diff completo y `git status` antes del último
   commit. No desplegar la migración a Neon sin confirmación de Sergio.

## 9. Fuera de alcance de P1 (no hacer aunque tiente)

- Usuarios con contraseña, sesiones por persona, permisos. (`rol_usuario`
  del esquema queda como está.)
- Estado editable de sala. Todo lo derivable se deriva.
- Tocar `calculo-cable.ts`, la numeración de cables o `revision.ts` (solo se
  consume su resultado).
- El export "inventario entregado de la sala" (documentado como `Después` en
  el roadmap).
- Fichaje de horas, tareas, aprobaciones (descartado en el análisis de la KB
  de XTEN-AV, ver roadmap).
- Precios: siguen aplazados por decisión de Sergio.

## 10. Al terminar

Actualizar `docs/07-roadmap.md` (P1 → hecho, con lo que quedara fuera),
añadir la regla nueva a `AGENTS.md` si la hay (una línea: los hitos se
registran, el estado se deriva), y reportar: qué se hizo, qué se verificó y
cómo, qué queda manual (migración Neon), y cualquier discrepancia encontrada
entre este plan y el código real.

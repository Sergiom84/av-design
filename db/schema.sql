-- =====================================================================
-- AV_design · esquema Fase 1
-- Catálogo · Plantillas de sala · Salas con medidas · Cálculo de cable
--
-- Postgres puro: funciona igual en el contenedor local y, más adelante,
-- en Supabase. Lo específico de Supabase (perfiles, auth, RLS) está
-- aparte en db/politicas-supabase.sql y se aplica solo al migrar.
--
--   npm run db:migrate
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos del dominio
-- ---------------------------------------------------------------------
do $$ begin
  create type tipo_articulo as enum ('equipo', 'cable', 'consumible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unidad_medida as enum ('ud', 'm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type senal as enum (
    'hdmi','red','usb','audio_linea','audio_altavoz',
    'microfono','alimentacion','control','otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ruta_cable as enum ('falso_techo', 'canaleta', 'suelo_tecnico', 'directo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type extremo_cable as enum (
    'pantalla','proyector','rack','caja_conexiones','mesa','techo','pared'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type rol_usuario as enum ('admin', 'tei', 'av', 'tecnico', 'lectura');
exception when duplicate_object then null; end $$;

comment on type rol_usuario is
  'TEI revisa el diseño y propone compra. AV da el visto bueno. Técnico configura e instala.';

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table if not exists proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  contacto  text,
  email     text,
  telefono  text,
  notas     text
);

create table if not exists articulos (
  id                        uuid primary key default gen_random_uuid(),
  referencia                text unique,
  tipo                      tipo_articulo not null,
  categoria                 text not null,
  marca                     text,
  modelo                    text not null,
  descripcion               text,
  unidad                    unidad_medida not null default 'ud',
  coste                     numeric(12,4),
  pvp                       numeric(12,4),
  proveedor_id              uuid references proveedores on delete set null,
  plazo_dias                integer,
  stock_minimo              numeric(12,2),
  -- solo para tipo = 'cable'
  senal                     senal,
  conector_a                text,
  conector_b                text,
  longitudes_comerciales_m  numeric(6,2)[],
  bobina_m                  numeric(8,2),
  diametro_mm               numeric(6,2),
  -- trazabilidad con el inventario de partida
  unidades_instaladas       integer,
  activo                    boolean not null default true,
  creado_en                 timestamptz not null default now()
);

-- La marca puede venir vacía, así que la clave única va sobre una expresión.
create unique index if not exists articulos_unico_idx
  on articulos (coalesce(marca, ''), modelo, categoria);
create index if not exists articulos_tipo_idx      on articulos (tipo);
create index if not exists articulos_categoria_idx on articulos (categoria);

-- ---------------------------------------------------------------------
-- Sedes, plantillas y salas
-- ---------------------------------------------------------------------
create table if not exists sedes (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,
  ciudad  text,
  notas   text
);

create table if not exists plantillas_sala (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null unique,
  tipologia           text not null,
  aforo               integer,
  n_salas_reales      integer,
  largo_m             numeric(6,2),
  ancho_m             numeric(6,2),
  alto_m              numeric(6,2),
  alto_falso_techo_m  numeric(6,2),
  ruta_por_defecto    ruta_cable not null default 'falso_techo',
  notas               text,
  creado_en           timestamptz not null default now()
);

comment on column plantillas_sala.n_salas_reales is
  'Cuántas salas del inventario responden a esta plantilla. Sirve para priorizar.';

create table if not exists plantilla_articulos (
  id            uuid primary key default gen_random_uuid(),
  plantilla_id  uuid not null references plantillas_sala on delete cascade,
  articulo_id   uuid references articulos on delete set null,
  categoria     text not null,
  modelo_texto  text,
  cantidad      numeric(6,2) not null default 1,
  opcional      boolean not null default false,
  unique (plantilla_id, categoria)
);

-- La geografía de la sala tiene dos niveles y solo dos: la sede (la
-- instalación) y la localización (el edificio y la planta dentro de ella,
-- más abajo en este fichero). `edificio` y `nivel` vivieron aquí antes de la
-- jerarquía y los retira db/migraciones/2026-08-retirar-edificio-nivel.sql.
create table if not exists salas (
  id                      uuid primary key default gen_random_uuid(),
  sede_id                 uuid references sedes on delete set null,
  codigo                  text,
  nombre                  text not null,
  tipologia               text,
  aforo                   integer,
  plantilla_id            uuid references plantillas_sala on delete set null,
  largo_m                 numeric(6,2) not null default 0,
  ancho_m                 numeric(6,2) not null default 0,
  alto_m                  numeric(6,2) not null default 0,
  alto_falso_techo_m      numeric(6,2),
  alto_canaleta_m         numeric(6,2) default 0.30,
  alto_suelo_tecnico_m    numeric(6,2) default 0,
  ruta_por_defecto        ruta_cable not null default 'falso_techo',
  notas                   text,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now()
);

create index if not exists salas_sede_idx      on salas (sede_id);
create index if not exists salas_tipologia_idx on salas (tipologia);

create table if not exists sala_equipos (
  id           uuid primary key default gen_random_uuid(),
  sala_id      uuid not null references salas on delete cascade,
  articulo_id  uuid references articulos on delete set null,
  nombre       text not null,
  cantidad     integer not null default 1,
  extremo      extremo_cable not null default 'pared',
  x_m          numeric(6,2) not null default 0,
  y_m          numeric(6,2) not null default 0,
  z_m          numeric(6,2) not null default 0
);

create index if not exists sala_equipos_sala_idx on sala_equipos (sala_id);

create table if not exists conexiones (
  id                 uuid primary key default gen_random_uuid(),
  sala_id            uuid not null references salas on delete cascade,
  origen_id          uuid not null references sala_equipos on delete cascade,
  destino_id         uuid not null references sala_equipos on delete cascade,
  articulo_cable_id  uuid references articulos on delete set null,
  senal              senal not null default 'otro',
  ruta               ruta_cable,
  longitud_manual_m  numeric(8,2),
  notas              text,
  check (origen_id <> destino_id)
);

create index if not exists conexiones_sala_idx on conexiones (sala_id);

create table if not exists conexion_puntos_paso (
  id          uuid primary key default gen_random_uuid(),
  conexion_id uuid not null references conexiones on delete cascade,
  orden       integer not null check (orden >= 0),
  x_m         numeric(8,3) not null,
  y_m         numeric(8,3) not null,
  z_m         numeric(8,3) not null,
  unique (conexion_id, orden)
);

create index if not exists conexion_puntos_paso_conexion_idx
  on conexion_puntos_paso (conexion_id, orden);

-- ---------------------------------------------------------------------
-- Parámetros de cálculo
-- ---------------------------------------------------------------------
create table if not exists parametros (
  clave        text primary key,
  valor        numeric(10,4) not null,
  unidad       text,
  descripcion  text
);

-- ---------------------------------------------------------------------
-- Trigger de actualización
-- ---------------------------------------------------------------------
create or replace function tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

drop trigger if exists salas_actualizado on salas;
create trigger salas_actualizado before update on salas
  for each row execute function tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Ampliaciones posteriores (idempotentes)
-- ---------------------------------------------------------------------

-- Ficha de catálogo: lo que Sergio quiere poder rellenar por artículo.
alter table articulos add column if not exists caracteristicas text;
alter table articulos add column if not exists observaciones  text;

-- Una plantilla puede llevar dos artículos de la misma categoría
-- (por ejemplo dos pantallas distintas), así que la clave única sobra.
alter table plantilla_articulos drop constraint if exists plantilla_articulos_plantilla_id_categoria_key;
create index if not exists plantilla_articulos_plantilla_idx
  on plantilla_articulos (plantilla_id);

-- Referencia del fabricante tal y como la escribe el proveedor en su oferta.
alter table articulos add column if not exists referencia_fabricante text;

-- Precios ofertados. Un mismo artículo tiene precios distintos según de quién
-- venga la oferta: el HDMI Ultra/9 de Extron aparece a 77,89 €, a 78,82 € y a
-- 93,00 € en tres presupuestos. Guardarlos todos es lo que permite comparar
-- proveedores en la Fase 2; articulos.coste se queda con el mejor conocido.
create table if not exists precios (
  id                   uuid primary key default gen_random_uuid(),
  articulo_id          uuid not null references articulos on delete cascade,
  proveedor_id         uuid references proveedores on delete set null,
  presupuesto          text not null,
  fecha                date,
  referencia           text,
  -- € por unidad del catálogo (m o ud), sin IVA
  precio               numeric(12,4) not null,
  -- lo que figura en la oferta, por unidad de compra (una bobina, una caja)
  precio_compra        numeric(12,4),
  unidades_por_compra  numeric(10,2) not null default 1,
  cantidad             numeric(12,2),
  notas                text,
  creado_en            timestamptz not null default now(),
  unique (presupuesto, articulo_id)
);

create index if not exists precios_articulo_idx  on precios (articulo_id);
create index if not exists precios_proveedor_idx on precios (proveedor_id);

comment on table precios is
  'Precios ofertados sin IVA. Un artículo puede tener varios, uno por presupuesto.';

-- Un precio de lista sacado de una web americana no es lo que os cuesta a
-- vosotros. Se guarda igual porque sirve para dimensionar un presupuesto
-- mientras no hay oferta real, pero no cuenta para el coste del catálogo.
alter table precios add column if not exists origen text not null default 'final';
alter table precios add column if not exists moneda text not null default 'EUR';

-- El primer nombre fue 'presupuesto'. El departamento lo llama 'final'. La
-- restricción se quita antes de renombrar, o el propio update la incumple.
alter table precios drop constraint if exists precios_origen_valido;
alter table precios alter column origen set default 'final';
update precios set origen = 'final' where origen = 'presupuesto';
alter table precios add constraint precios_origen_valido
  check (origen in ('final', 'orientativo'));

comment on column precios.origen is
  'final = oferta real de un proveedor. orientativo = precio de referencia mientras no hay oferta.';

-- Quién manda sobre cada línea. La siembra regenera entera su parte, porque los
-- CSV son la fuente y hay que poder renombrar un presupuesto o quitar una línea
-- sin dejar filas huérfanas. Lo que se escriba desde la aplicación lleva
-- fuente = 'app' y la siembra no lo toca nunca.
alter table precios add column if not exists fuente text not null default 'app';

alter table precios drop constraint if exists precios_fuente_valida;
alter table precios add constraint precios_fuente_valida
  check (fuente in ('csv', 'app'));

comment on column precios.fuente is
  'csv = viene de data/precios*.csv y la siembra lo regenera. app = escrito desde la aplicación, intocable.';

-- Un coste puede ser orientativo: sirve para no dejar el proyecto parado, pero
-- no se puede pedir material con él. La ficha del artículo lo marca.
alter table articulos add column if not exists coste_orientativo boolean not null default false;

comment on column articulos.coste_orientativo is
  'Marcado = el coste es una referencia, no una oferta cerrada.';

-- ---------------------------------------------------------------------
-- Puertos del catálogo
--
-- Un puerto es un conector físico del equipo: el Room Navigator tiene un
-- LAN PoE, una matriz tiene HDMI IN 1..4 y HDMI OUT 1..2. Sin esto no se
-- puede decir de qué salida a qué entrada va un cable, y sin eso no hay
-- esquema de conexiones ni tabla de cables. Es el cimiento de la Fase 3.
-- ---------------------------------------------------------------------
do $$ begin
  create type sentido_puerto as enum ('entrada', 'salida', 'bidireccional', 'control');
exception when duplicate_object then null; end $$;

comment on type sentido_puerto is
  'Por dónde entra o sale la señal. bidireccional para USB-C o Dante; control para RS-232 e IR.';

create table if not exists puertos (
  id           uuid primary key default gen_random_uuid(),
  articulo_id  uuid not null references articulos on delete cascade,
  nombre       text not null,
  total        integer not null default 1,
  sentido      sentido_puerto not null,
  senal        senal not null,
  conector     text,
  orden        integer,
  notas        text,
  creado_en    timestamptz not null default now(),
  unique (articulo_id, nombre)
);

create index if not exists puertos_articulo_idx on puertos (articulo_id);

comment on table puertos is
  'Conectores físicos de cada artículo del catálogo. Un cable siempre sale de un puerto y entra en otro.';

comment on column puertos.nombre is
  'El literal que serigrafía el fabricante: HDMI IN 1, LAN PoE, MIC IN 1. No se traduce ni se normaliza: en la instalación se lee lo que pone en el equipo.';

comment on column puertos.total is
  'Cuántos puertos iguales hay. Cuatro entradas idénticas sin numerar se guardan en una fila con total = 4, no en cuatro filas.';

comment on column puertos.conector is
  'El conector físico: RJ45, HDMI A, USB-C, Euroblock 5, Jack 3.5, XLR M. Determina qué latiguillo se compra.';

comment on column puertos.orden is
  'Para listarlos como los pinta el fabricante en la trasera del equipo, que es como los busca el técnico.';

-- Mismo criterio que en `precios`: los CSV mandan sobre lo suyo y la siembra
-- regenera entera esa parte, para que quitar una fila del CSV no deje puertos
-- huérfanos. Lo que se dé de alta desde la aplicación lleva fuente = 'app' y
-- la siembra no lo toca nunca.
alter table puertos add column if not exists fuente text not null default 'app';

alter table puertos drop constraint if exists puertos_fuente_valida;
alter table puertos add constraint puertos_fuente_valida
  check (fuente in ('csv', 'app'));

comment on column puertos.fuente is
  'csv = viene de data/puertos.csv y la siembra lo regenera. app = escrito desde la aplicación, intocable.';

-- ---------------------------------------------------------------------
-- Tomas de red de la sala
--
-- Es la roseta del edificio: el número escrito en la placa del suelo, de
-- la pared o de la mesa. "Este Room Navigator pincha en la toma 12". No es
-- un puerto del equipo (eso vive en `puertos`, y es del catálogo): es un
-- dato de esta sala concreta, y el inventario de partida ya lo recoge.
--
-- Decisión deliberada: en esta iteración la toma NO es extremo de tirada.
-- Es dónde pincha un equipo, y se muestra como columna informativa de la
-- tabla de cables. Convertirla en extremo obligaría a cambiar la fórmula de
-- src/lib/calculo-cable.ts, que es lógica probada y está congelada.
-- ---------------------------------------------------------------------
create table if not exists tomas_red (
  id         uuid primary key default gen_random_uuid(),
  sala_id    uuid not null references salas on delete cascade,
  codigo     text not null,
  ubicacion  text,
  x_m        numeric(6,2),
  y_m        numeric(6,2),
  z_m        numeric(6,2),
  notas      text,
  creado_en  timestamptz not null default now(),
  unique (sala_id, codigo)
);

create index if not exists tomas_red_sala_idx on tomas_red (sala_id);

comment on table tomas_red is
  'Rosetas de red de una sala. El código es lo que pone en la placa, no un identificador interno.';

comment on column tomas_red.ubicacion is
  'Suelo, pared, mesa, techo o rack. Texto y no enum a propósito: nada en el código se bifurca por este valor, es descriptivo, y cada edificio añade sitios nuevos (columna, tarima, poste). La lista canónica que ofrece la interfaz vive en UBICACIONES_TOMA (src/lib/tipos.ts) y ampliarla es una línea, no una migración.';

comment on column tomas_red.x_m is
  'Posición de la roseta en la sala, si se conoce. Hoy es documental: la tirada se calcula entre equipos.';

-- Dónde pincha cada equipo. Opcional y `set null`: quitar una roseta del
-- plano no puede borrar el equipo que colgaba de ella.
alter table sala_equipos add column if not exists toma_red_id uuid
  references tomas_red on delete set null;

create index if not exists sala_equipos_toma_idx on sala_equipos (toma_red_id);

-- ---------------------------------------------------------------------
-- Conexiones puerto a puerto
--
-- Esto es lo que convierte "la pantalla va al Room Bar" en "la salida
-- HDMI OUT 1 del Room Bar va a la entrada HDMI IN 2 de la pantalla", que
-- es lo que hace falta para etiquetar en obra y para la tabla de cables.
--
-- Opcionales porque ya hay conexiones dadas de alta sin puerto y no se
-- pueden romper; `set null` porque corregir el catálogo de puertos de un
-- artículo no puede borrar la tirada de una sala.
-- ---------------------------------------------------------------------
alter table conexiones add column if not exists puerto_origen_id uuid
  references puertos on delete set null;
alter table conexiones add column if not exists puerto_destino_id uuid
  references puertos on delete set null;

-- El identificador de cable (HD-1000, RED-1001) tiene que ser estable entre
-- recargas: una tirada ya etiquetada en obra no puede cambiar de número
-- porque se dé de alta otra. Se numera por orden de creación, así que hace
-- falta guardarlo. Las filas que ya existen comparten el `now()` de la
-- migración y desempatan por id, que también es estable.
alter table conexiones add column if not exists creado_en timestamptz not null default now();

create index if not exists conexiones_orden_idx on conexiones (sala_id, creado_en, id);

comment on column conexiones.puerto_origen_id is
  'Puerto de salida concreto del equipo de origen. Nulo mientras no se haya detallado.';
comment on column conexiones.creado_en is
  'Orden de alta. Es lo que fija el correlativo del identificador de cable y lo que lo hace estable.';

-- =====================================================================
-- Fase 2 · Almacén, reservas, compras y carga
--
-- El hueco que rellena (docs/01, apartado 6): XTEN-AV solo sabe si el
-- material *de un proyecto* se ha pedido y recibido. No hay almacén, ni
-- reservas, ni sobrantes, ni lista de carga.
--
-- La hoja "Almacén" del inventario de partida tampoco es un stock: son
-- 104 unidades sueltas por número de serie con anotaciones libres
-- ("ROTO", "POSIBLEMENTE NO PUEDA REPARARSE"). Es un registro de
-- retiradas. Por eso el almacén de verdad arranca vacío y las bajas
-- tienen sitio propio desde el primer día.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ubicaciones dentro del almacén
--
-- Un mismo artículo está en varios sitios: estantería, armario, la
-- furgoneta. Nombre único y texto libre, no un enum: cada nave añade
-- sitios y eso no puede ser una migración.
-- ---------------------------------------------------------------------
create table if not exists ubicaciones (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null unique,
  descripcion   text,
  -- Una furgoneta con material fijo también es una ubicación. Se marca
  -- para no ofrecerla por defecto al sacar material a obra: cargar la
  -- furgoneta es sacar del almacén, no mover entre estantes.
  es_furgoneta  boolean not null default false,
  activa        boolean not null default true,
  creado_en     timestamptz not null default now()
);

comment on table ubicaciones is
  'Sitios del almacén: estante, armario, furgoneta. Un artículo puede estar en varios.';

-- Dos ubicaciones de arranque, para que el almacén sea usable sin pasar
-- antes por una pantalla de mantenimiento. No son datos de ejemplo.
insert into ubicaciones (nombre, descripcion, es_furgoneta)
values ('Almacén general', 'Ubicación por defecto del material en nave', false)
on conflict (nombre) do nothing;

insert into ubicaciones (nombre, descripcion, es_furgoneta)
values ('Furgoneta', 'Material fijo que vive en la furgoneta', true)
on conflict (nombre) do update set descripcion = excluded.descripcion;

-- ---------------------------------------------------------------------
-- Movimientos: la verdad del stock
--
-- La existencia actual NO se guarda: se deriva de los movimientos. Un
-- stock que se puede sobrescribir sin rastro vuelve a ser un Excel, que
-- es justo el problema del que se viene.
--
-- El signo lo pone el tipo, no quien teclea: entrada y devolución suman,
-- salida y baja restan. El ajuste de inventario es el único que admite
-- cantidad negativa, porque un recuento corrige en los dos sentidos. La
-- tabla de signos vive en SIGNO_MOVIMIENTO (src/lib/almacen.ts) y la
-- vista `existencias` la repite.
-- ---------------------------------------------------------------------
do $$ begin
  create type tipo_movimiento as enum (
    'entrada', 'salida', 'devolucion', 'baja', 'ajuste'
  );
exception when duplicate_object then null; end $$;

comment on type tipo_movimiento is
  'entrada = compra o reposicion. salida = va a obra. devolucion = sobrante que vuelve. baja = roto o retirado. ajuste = correccion de recuento, el unico que admite negativo.';

create table if not exists movimientos (
  id            uuid primary key default gen_random_uuid(),
  articulo_id   uuid not null references articulos on delete cascade,
  ubicacion_id  uuid references ubicaciones on delete set null,
  tipo          tipo_movimiento not null,
  cantidad      numeric(12,2) not null,
  -- Para qué obra. Nulo en una entrada de compra para almacén.
  sala_id       uuid references salas on delete set null,
  motivo        text,
  -- Quién lo hizo. Texto mientras no haya usuarios: el nombre tecleado
  -- vale más que un stock anónimo.
  quien         text,
  fecha         timestamptz not null default now(),
  creado_en     timestamptz not null default now(),
  check (cantidad <> 0),
  check (tipo = 'ajuste' or cantidad > 0)
);

create index if not exists movimientos_articulo_idx  on movimientos (articulo_id);
create index if not exists movimientos_ubicacion_idx on movimientos (ubicacion_id);
create index if not exists movimientos_sala_idx      on movimientos (sala_id);
create index if not exists movimientos_fecha_idx     on movimientos (fecha desc);
create index if not exists movimientos_tipo_idx      on movimientos (tipo);

comment on table movimientos is
  'Entradas, salidas, devoluciones, bajas y ajustes. La existencia se deriva de aqui y no se edita a mano.';

-- Existencias por artículo y ubicación. Es una suma, no un criterio: el
-- criterio (qué signo tiene cada tipo) está en SIGNO_MOVIMIENTO y esta
-- vista lo repite. Si se toca uno hay que tocar el otro, y la prueba
-- `signo de cada tipo` de src/lib/almacen.test.ts obliga a que el cambio
-- sea deliberado.
create or replace view existencias as
select
  m.articulo_id,
  m.ubicacion_id,
  sum(
    case m.tipo
      when 'entrada'    then  m.cantidad
      when 'devolucion' then  m.cantidad
      when 'salida'     then -m.cantidad
      when 'baja'       then -m.cantidad
      when 'ajuste'     then  m.cantidad
    end
  ) as cantidad
from movimientos m
group by m.articulo_id, m.ubicacion_id;

comment on view existencias is
  'Existencias derivadas de los movimientos, por articulo y ubicacion. Nunca se escribe.';

-- ---------------------------------------------------------------------
-- Reservas de material para una obra
--
-- Reservado no es salido: el material sigue en el estante, pero está
-- comprometido. Disponible = existencias − reservado. Pedir dos veces lo
-- mismo porque estaba reservado y no se veía es exactamente el fallo que
-- la aplicación viene a evitar.
-- ---------------------------------------------------------------------
create table if not exists reservas (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid not null references salas on delete cascade,
  articulo_id    uuid not null references articulos on delete cascade,
  cantidad       numeric(12,2) not null check (cantidad > 0),
  -- activa = compromete stock. liberada = se soltó sin usarse.
  -- servida = ya salió a obra y el movimiento de salida está hecho.
  estado         text not null default 'activa',
  notas          text,
  quien          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table reservas drop constraint if exists reservas_estado_valido;
alter table reservas add constraint reservas_estado_valido
  check (estado in ('activa', 'liberada', 'servida'));

create index if not exists reservas_sala_idx     on reservas (sala_id);
create index if not exists reservas_articulo_idx on reservas (articulo_id, estado);

comment on table reservas is
  'Material comprometido para una sala. Sigue en almacen hasta que se convierte en salida.';

drop trigger if exists reservas_actualizado on reservas;
create trigger reservas_actualizado before update on reservas
  for each row execute function tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Pedidos a proveedor
--
-- Lo que falta se agrupa por proveedor, porque un pedido se manda a un
-- proveedor y no a un catálogo. Al recibir se genera la entrada en
-- almacén: si hay que teclearlo dos veces, no se hará.
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_pedido as enum (
    'borrador', 'pedido', 'recibido_parcial', 'recibido'
  );
exception when duplicate_object then null; end $$;

create table if not exists pedidos (
  id             uuid primary key default gen_random_uuid(),
  proveedor_id   uuid references proveedores on delete set null,
  -- Para qué obra se pide. Nulo si es reposición de almacén.
  sala_id        uuid references salas on delete set null,
  referencia     text,
  estado         estado_pedido not null default 'borrador',
  fecha          date,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists pedidos_proveedor_idx on pedidos (proveedor_id);
create index if not exists pedidos_sala_idx      on pedidos (sala_id);
create index if not exists pedidos_estado_idx    on pedidos (estado);

drop trigger if exists pedidos_actualizado on pedidos;
create trigger pedidos_actualizado before update on pedidos
  for each row execute function tocar_actualizado_en();

create table if not exists pedido_lineas (
  id                 uuid primary key default gen_random_uuid(),
  pedido_id          uuid not null references pedidos on delete cascade,
  articulo_id        uuid not null references articulos on delete cascade,
  cantidad           numeric(12,2) not null check (cantidad > 0),
  cantidad_recibida  numeric(12,2) not null default 0,
  -- Precio congelado al generar la línea: el catálogo cambia y un pedido
  -- de hace tres meses tiene que seguir contando lo que costó.
  precio_unitario    numeric(12,4),
  -- Se puede presupuestar con un precio orientativo. No se puede pedir.
  precio_orientativo boolean not null default false,
  notas              text
);

create index if not exists pedido_lineas_pedido_idx on pedido_lineas (pedido_id);

comment on column pedido_lineas.precio_orientativo is
  'El precio no es una oferta cerrada. Sirve para dimensionar el pedido, no para mandarlo.';

-- ---------------------------------------------------------------------
-- Lista de carga y cierre de obra
--
-- Se usa de pie en un almacén, con el móvil en una mano. Por eso la
-- línea es marcable y poco más.
--
-- Al cerrar la obra, lo que sobra entra como devolución. Lo roto entra
-- como devolución y sale acto seguido como baja: neto cero en stock, y
-- el material averiado queda registrado, que es lo único que el
-- departamento tenía apuntado a mano hasta ahora.
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_carga as enum ('preparacion', 'cargada', 'cerrada');
exception when duplicate_object then null; end $$;

create table if not exists cargas (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid not null references salas on delete cascade,
  nombre         text not null,
  estado         estado_carga not null default 'preparacion',
  quien          text,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cerrado_en     timestamptz
);

create index if not exists cargas_sala_idx   on cargas (sala_id);
create index if not exists cargas_estado_idx on cargas (estado);

drop trigger if exists cargas_actualizado on cargas;
create trigger cargas_actualizado before update on cargas
  for each row execute function tocar_actualizado_en();

create table if not exists carga_lineas (
  id           uuid primary key default gen_random_uuid(),
  carga_id     uuid not null references cargas on delete cascade,
  articulo_id  uuid not null references articulos on delete cascade,
  reserva_id   uuid references reservas on delete set null,
  cantidad     numeric(12,2) not null check (cantidad > 0),
  cargado      boolean not null default false,
  -- Cierre de obra. Entre los tres no pueden pasar de lo cargado.
  instalado    numeric(12,2) not null default 0,
  devuelto     numeric(12,2) not null default 0,
  roto         numeric(12,2) not null default 0,
  notas        text
);

create index if not exists carga_lineas_carga_idx on carga_lineas (carga_id);

comment on table carga_lineas is
  'Que material sale a obra. Se marca desde el movil, de pie en el almacen.';

-- =====================================================================
-- Fase 3 · Geometría de la sala
--
-- Hasta aquí una sala eran tres números: largo, ancho y alto. Con eso se
-- calculan los metros de cable, pero no se dibuja nada. El croquis que el
-- departamento hace a mano lleva además la mesa, su altura y a qué altura
-- va colgada la pantalla, y esos datos hoy se pierden.
--
-- No hace falta una tabla nueva: la mesa es de la sala y la altura del
-- equipo ya tenía columna (`sala_equipos.z_m`). Lo que faltaba era la mesa.
-- ---------------------------------------------------------------------
alter table salas add column if not exists mesa_largo_m numeric(6,2);
alter table salas add column if not exists mesa_ancho_m numeric(6,2);
alter table salas add column if not exists mesa_alto_cm numeric(6,1);
alter table salas add column if not exists mesa_x_m     numeric(6,2);
alter table salas add column if not exists mesa_y_m     numeric(6,2);

comment on column salas.mesa_x_m is
  'Centro de la mesa medido desde la esquina inferior izquierda de la sala. Nulo = centrada, que es el caso normal.';
comment on column salas.mesa_alto_cm is
  'Altura de la mesa desde el suelo, en centimetros. Es como se mide en obra: 73 cm, no 0,73 m.';

alter table plantillas_sala add column if not exists mesa_largo_m numeric(6,2);
alter table plantillas_sala add column if not exists mesa_ancho_m numeric(6,2);
alter table plantillas_sala add column if not exists mesa_alto_cm numeric(6,1);

comment on column sala_equipos.z_m is
  'Altura del equipo sobre el suelo. La pantalla a 0,74 m es dato de obra: sale en el croquis y se comprueba en el montaje.';

-- =====================================================================
-- Fase 3 · Check-in de sala
--
-- Antes de montar hay que ir a la sala y confirmar lo que hay: que las
-- medidas de la plantilla son las de verdad, que la roseta existe y da
-- red, que hay corriente donde va el rack, que la pared aguanta la
-- pantalla. Eso no se deriva de nada: se ve con los ojos y se marca.
--
-- Es lo contrario de la revisión de montaje, que se calcula sola a partir
-- de lo que ya hay en la base de datos y por eso no tiene tablas.
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_punto as enum ('pendiente', 'conforme', 'incidencia', 'no_aplica');
exception when duplicate_object then null; end $$;

comment on type estado_punto is
  'pendiente = sin mirar. conforme = comprobado y correcto. incidencia = comprobado y mal. no_aplica = esta sala no lo lleva.';

create table if not exists revisiones (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid not null references salas on delete cascade,
  nombre         text not null,
  -- Abierta se puede marcar. Cerrada es una foto de aquel dia y no se toca.
  cerrada        boolean not null default false,
  quien          text,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cerrado_en     timestamptz
);

create index if not exists revisiones_sala_idx on revisiones (sala_id, creado_en desc);

comment on table revisiones is
  'Visita de check-in a una sala. Se rellena de pie en la sala, con el movil.';

drop trigger if exists revisiones_actualizado on revisiones;
create trigger revisiones_actualizado before update on revisiones
  for each row execute function tocar_actualizado_en();

create table if not exists revision_puntos (
  id            uuid primary key default gen_random_uuid(),
  revision_id   uuid not null references revisiones on delete cascade,
  -- Clave estable del punto (`medidas`, `roseta`, `corriente`...). Permite
  -- comparar la misma visita entre dos salas sin depender del texto.
  clave         text not null,
  bloque        text not null,
  titulo        text not null,
  estado        estado_punto not null default 'pendiente',
  -- Lo medido, cuando el punto pide un numero: el largo real de la sala.
  valor         text,
  notas         text,
  orden         integer not null default 0,
  unique (revision_id, clave)
);

create index if not exists revision_puntos_revision_idx on revision_puntos (revision_id, orden);

comment on column revision_puntos.valor is
  'Lo que se midio, si el punto pide una medida. Texto: "4,68" o "no llega el cable".';

-- =====================================================================
-- Fase 3 · La plantilla trae el montaje, no solo la lista de material
--
-- Hasta aqui una plantilla decia QUE equipos lleva la sala. La sala nacia
-- con los cuatro equipos amontonados en la esquina y sin una sola tirada,
-- asi que el croquis salia deducido y la tabla de cables, vacia. Con 144
-- salas iguales eso es colocar equipos 144 veces a mano.
--
-- La plantilla pasa a traer tambien donde va cada equipo y que conecta
-- con que. Es el mismo dato de siempre, pero una vez en lugar de 144.
-- ---------------------------------------------------------------------
alter table plantilla_articulos add column if not exists extremo extremo_cable;
alter table plantilla_articulos add column if not exists x_m numeric(6,2);
alter table plantilla_articulos add column if not exists y_m numeric(6,2);
alter table plantilla_articulos add column if not exists z_m numeric(6,2);

comment on column plantilla_articulos.extremo is
  'Donde acaba el cable en este equipo, y por tanto que holgura se deja. Nulo = se deduce de la categoria al crear la sala, como se hacia antes.';
comment on column plantilla_articulos.x_m is
  'Posicion estandar del equipo en la sala. Nula = la sala la deduce y el croquis la dibuja discontinua.';

-- Las tiradas tipo de la plantilla. Apuntan a las lineas de equipamiento,
-- no a articulos: una plantilla puede llevar dos pantallas del mismo
-- modelo y la tirada va a una de las dos.
create table if not exists plantilla_conexiones (
  id                 uuid primary key default gen_random_uuid(),
  plantilla_id       uuid not null references plantillas_sala on delete cascade,
  origen_linea_id    uuid not null references plantilla_articulos on delete cascade,
  destino_linea_id   uuid not null references plantilla_articulos on delete cascade,
  articulo_cable_id  uuid references articulos on delete set null,
  senal              senal not null default 'otro',
  ruta               ruta_cable,
  notas              text,
  orden              integer not null default 0,
  creado_en          timestamptz not null default now(),
  check (origen_linea_id <> destino_linea_id)
);

create index if not exists plantilla_conexiones_plantilla_idx
  on plantilla_conexiones (plantilla_id, orden, creado_en);

create table if not exists plantilla_conexion_puntos_paso (
  id                    uuid primary key default gen_random_uuid(),
  plantilla_conexion_id uuid not null references plantilla_conexiones on delete cascade,
  orden                 integer not null check (orden >= 0),
  x_m                   numeric(8,3) not null,
  y_m                   numeric(8,3) not null,
  z_m                   numeric(8,3) not null,
  unique (plantilla_conexion_id, orden)
);

create index if not exists plantilla_conexion_puntos_paso_conexion_idx
  on plantilla_conexion_puntos_paso (plantilla_conexion_id, orden);

comment on table plantilla_conexiones is
  'Tiradas tipo de una plantilla. La sala nueva las copia a `conexiones` con sus propios equipos.';

-- =====================================================================
-- Jerarquia de obra · Proyecto -> Localizaciones -> Salas
--
-- Hasta aqui las salas colgaban directas de la aplicacion. La obra real
-- agrupa salas: un proyecto (la obra) tiene localizaciones (edificio,
-- planta, campus) y cada localizacion tiene salas. Es la jerarquia de
-- XTEN-AV (docs/06, L496) que faltaba.
--
-- Una sala sin proyecto es un estado valido, no una deuda: todo lo
-- creado antes de esta ampliacion se queda con localizacion_id nulo y
-- se puede adoptar desde la portada del proyecto cuando toque.
-- ---------------------------------------------------------------------
create table if not exists proyectos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  codigo         text,
  sede_id        uuid references sedes on delete set null,
  notas          text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists proyectos_sede_idx on proyectos (sede_id);

drop trigger if exists proyectos_actualizado on proyectos;
create trigger proyectos_actualizado before update on proyectos
  for each row execute function tocar_actualizado_en();

comment on table proyectos is
  'La obra. Agrupa localizaciones y salas; sin estado editable: el estado se deriva de sus hitos.';

create table if not exists localizaciones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos on delete cascade,
  nombre       text not null,
  notas        text,
  creado_en    timestamptz not null default now(),
  unique (proyecto_id, nombre)
);

create index if not exists localizaciones_proyecto_idx on localizaciones (proyecto_id);

comment on table localizaciones is
  'Agrupacion de salas dentro de un proyecto: edificio, planta, campus. Cada proyecto nace con una "Sin asignar".';

alter table salas add column if not exists localizacion_id uuid
  references localizaciones on delete set null;

create index if not exists salas_localizacion_idx on salas (localizacion_id);

comment on column salas.localizacion_id is
  'Nula = sala sin proyecto (todo lo anterior a la jerarquia de obra). Estado valido, no error. Borrar el proyecto deja la sala viva y sin proyecto.';

alter table pedidos add column if not exists proyecto_id uuid
  references proyectos on delete set null;

create index if not exists pedidos_proyecto_idx on pedidos (proyecto_id);

comment on column pedidos.proyecto_id is
  'Para que obra se pide. Un pedido puede abastecer varias salas del proyecto; el reparto entre salas lo hacen las reservas. sala_id se conserva para el pedido que nace del que-falta de una sala.';

-- =====================================================================
-- P1 · Tecnicos e hitos: quien hizo que, y cuando
--
-- El estado del material se deriva de movimientos y recepciones; el hecho
-- humano se registra. Un hito no es un estado editable: es un registro que
-- se anade, como los movimientos del almacen. Los hitos de la obra (inicio,
-- cierre) cuelgan del proyecto; los de la sala (instalacion, entrega), de
-- la sala. La recepcion no es hito de ninguno de los dos: es por pedido, y
-- ya vive en la recepcion de compras con `movimientos.quien`.
-- ---------------------------------------------------------------------
create table if not exists tecnicos (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  activo    boolean not null default true,
  -- `csv` lo regenera la siembra; `app` se escribio aqui y no se toca.
  fuente    text not null default 'csv' check (fuente in ('csv', 'app')),
  creado_en timestamptz not null default now()
);

create table if not exists tecnico_roles (
  tecnico_id uuid not null references tecnicos on delete cascade,
  rol        text not null check (rol in ('inicio', 'recepcion', 'instalacion')),
  primary key (tecnico_id, rol)
);

comment on table tecnicos is
  'La lista de personas del departamento. Sin contrasenas: se elige el nombre al registrar el hecho; la puerta es la clave de departamento.';

create table if not exists hitos_proyecto (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos on delete cascade,
  tipo        text not null check (tipo in ('inicio', 'cierre')),
  tecnico_id  uuid references tecnicos on delete set null,
  fecha       date not null default current_date,
  notas       text,
  creado_en   timestamptz not null default now(),
  unique (proyecto_id, tipo)
);

create table if not exists hitos_sala (
  id         uuid primary key default gen_random_uuid(),
  sala_id    uuid not null references salas on delete cascade,
  tipo       text not null check (tipo in ('instalacion', 'entrega')),
  tecnico_id uuid references tecnicos on delete set null,
  fecha      date not null default current_date,
  notas      text,
  creado_en  timestamptz not null default now(),
  unique (sala_id, tipo)
);

comment on table hitos_proyecto is
  'Inicio y cierre de la obra. Un hito de cada tipo por proyecto; si se registro mal, se borra y se registra de nuevo.';
comment on table hitos_sala is
  'Instalacion y entrega de la sala concreta. La entrega con bloqueos del semaforo avisa y exige nota, no bloquea.';
comment on column hitos_sala.tecnico_id is
  'Nulo = hito historico de alguien que ya no esta en la lista. El hecho no se pierde porque se vaya la persona.';


-- ---------------------------------------------------------------------
-- El triple cero significaba dos cosas a la vez
--
-- Hasta aquí, un equipo en (0,0,0) era "sin colocar" para el croquis. Es
-- también una esquina válida de la sala: el rack va justo ahí. Con el
-- editor visual la ambigüedad deja de ser teórica, porque el técnico
-- puede arrastrar un equipo a la esquina y esperar que se quede.
--
-- `posicion_confirmada` separa las dos cosas: false = nadie la ha
-- puesto y el croquis la deduce con trazo discontinuo; true = alguien la
-- midió o la colocó, y se dibuja como una medida aunque valga cero.
--
-- El relleno se hace UNA sola vez, dentro del `if not exists`: repetir la
-- migración no puede volver a marcar como confirmada una posición que el
-- usuario haya desmarcado después. El histórico es ambiguo y no se
-- inventa nada: se confirma solo lo que tiene alguna coordenada distinta
-- de cero, y el triple cero se queda sin confirmar.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'sala_equipos' and column_name = 'posicion_confirmada'
  ) then
    alter table sala_equipos
      add column posicion_confirmada boolean not null default false;

    update sala_equipos
       set posicion_confirmada = true
     where x_m <> 0 or y_m <> 0 or z_m <> 0;
  end if;
end $$;

comment on column sala_equipos.posicion_confirmada is
  'true = alguien colocó o midió el equipo, aunque sea en (0,0,0). false = el croquis la deduce del extremo y la dibuja discontinua.';

-- En la plantilla la ausencia ya se escribe con null, así que aquí la
-- columna es de tres estados: null = sin colocar (no se convierte a
-- (0,0,0) al copiar), true/false = lo que decidió el editor.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'plantilla_articulos' and column_name = 'posicion_confirmada'
  ) then
    alter table plantilla_articulos add column posicion_confirmada boolean;

    update plantilla_articulos
       set posicion_confirmada = true
     where coalesce(x_m, 0) <> 0
        or coalesce(y_m, 0) <> 0
        or coalesce(z_m, 0) <> 0;
  end if;
end $$;

comment on column plantilla_articulos.posicion_confirmada is
  'Nulo = sin colocar; la sala nueva no hereda coordenadas y el croquis las deduce. No se convierte la ausencia en (0,0,0).';

-- ---------------------------------------------------------------------
-- La mesa gira
--
-- Una mesa en U o una mesa de junta puesta en travesía no está alineada
-- con las paredes. El centro ya se guardaba (`mesa_x_m`, `mesa_y_m`) pero
-- ninguna acción lo escribía: el editor es el primero que lo hace.
-- ---------------------------------------------------------------------
alter table salas
  add column if not exists mesa_rotacion_grados numeric(6,2) not null default 0;

comment on column salas.mesa_rotacion_grados is
  'Giro de la mesa sobre su centro, en grados en sentido antihorario. 0 = alineada con las paredes.';

-- ---------------------------------------------------------------------
-- Control optimista del diagrama
--
-- Dos pestañas abiertas sobre la misma sala no se pueden pisar en
-- silencio: el guardado manda la versión que leyó y el servidor rechaza
-- la obsoleta. No es un `updated_at`: se incrementa solo cuando cambia el
-- plano, así que editar el nombre de la sala no invalida un borrador.
-- ---------------------------------------------------------------------
alter table salas
  add column if not exists diagrama_version integer not null default 0;

comment on column salas.diagrama_version is
  'Sube uno en cada guardado del plano. El editor manda la que leyó y una versión obsoleta se rechaza en vez de sobrescribir.';

-- ---------------------------------------------------------------------
-- La plantilla también guarda dónde va la mesa
--
-- Sin esto, una sala creada desde plantilla nacía con la mesa centrada
-- por implícito y perdía la colocación real de la tipología.
-- ---------------------------------------------------------------------
alter table plantillas_sala add column if not exists mesa_x_m              numeric(6,2);
alter table plantillas_sala add column if not exists mesa_y_m              numeric(6,2);
alter table plantillas_sala add column if not exists mesa_rotacion_grados  numeric(6,2);

comment on column plantillas_sala.mesa_x_m is
  'Centro de la mesa en la sala tipo. Nulo = centrada, que es el caso de casi todas.';

-- ---------------------------------------------------------------------
-- El mobiliario NO es catálogo AV
--
-- `articulos` alimenta stock, reservas, pedidos, precios, puertos y
-- conexiones. Una silla no se pide a un proveedor de AV, no tiene puertos y
-- no entra en una tirada: meterla ahí la haría aparecer entre los cables y
-- los consumibles de cada obra. Vive en su propio catálogo, con su propia
-- fuente editable (data/mobiliario.csv) y la misma convención `fuente` que
-- `precios`, `puertos` y `tecnicos`: 'csv' se regenera en cada siembra,
-- 'app' no se toca nunca.
-- ---------------------------------------------------------------------
create table if not exists catalogo_mobiliario (
  id              uuid primary key default gen_random_uuid(),
  clave           text not null unique,
  nombre          text not null,
  categoria       text not null,
  -- Lo que teclea el técnico y no es el nombre: «asiento», «butaca».
  palabras_clave  text,
  -- Cómo se dibuja en planta. La silla es el círculo de siempre.
  forma           text not null default 'rectangulo'
                    check (forma in ('rectangulo', 'circulo')),
  -- Nulas a propósito: no se inventan las medidas del mobiliario del
  -- departamento. Sin ellas la instancia nace «Sin medir» y el inspector
  -- pide largo y ancho antes de darla por colocada.
  largo_m_defecto numeric(6,2),
  ancho_m_defecto numeric(6,2),
  alto_m_defecto  numeric(6,2),
  activo          boolean not null default true,
  orden           integer not null default 100,
  fuente          text not null default 'csv' check (fuente in ('csv', 'app')),
  creado_en       timestamptz not null default now()
);

comment on table catalogo_mobiliario is
  'Sillas, mesas y demás mobiliario de sala. Deliberadamente fuera de articulos: no se pide, no tiene puertos y no entra en ninguna tirada.';
comment on column catalogo_mobiliario.largo_m_defecto is
  'Nulo = sin medida por defecto. La instancia nace Sin medir y no se da por colocada hasta que alguien la mide.';

create index if not exists catalogo_mobiliario_activo_idx
  on catalogo_mobiliario (activo, orden);

-- ---------------------------------------------------------------------
-- Una silla física es una fila
--
-- Ocho sillas son ocho instancias arrastrables y rotables, no una línea
-- con cantidad 8: cada una está en un sitio distinto y mirando a un lado
-- distinto. El `cantidad ×N` de `sala_equipos` tiene sentido para cuatro
-- micrófonos de techo que cuelgan del mismo punto del plano; para una
-- silla no lo tiene.
--
-- Las medidas se copian del catálogo al crear la instancia y se quedan:
-- son un snapshot. Corregir mañana la silla del catálogo no puede deformar
-- el plano de las salas que ya se dibujaron.
-- ---------------------------------------------------------------------
create table if not exists sala_mobiliario (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid not null references salas on delete cascade,
  mobiliario_id  uuid references catalogo_mobiliario on delete set null,
  nombre         text not null,
  forma          text not null default 'rectangulo'
                   check (forma in ('rectangulo', 'circulo')),
  largo_m        numeric(6,2),
  ancho_m        numeric(6,2),
  alto_m         numeric(6,2),
  -- Nulas mientras nadie lo coloque, igual que en `plantilla_articulos`:
  -- la ausencia se propaga como ausencia y no se convierte en (0,0,0).
  x_m            numeric(6,2),
  y_m            numeric(6,2),
  z_m            numeric(6,2),
  rotacion_grados numeric(6,2) not null default 0,
  posicion_confirmada boolean not null default false,
  -- De qué línea de plantilla vino, para distinguir lo heredado de lo que
  -- alguien añadió a mano y no volver a copiarlo.
  origen_plantilla_mobiliario_id uuid,
  orden          integer not null default 100,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists sala_mobiliario_sala_idx on sala_mobiliario (sala_id);
create unique index if not exists sala_mobiliario_origen_idx
  on sala_mobiliario (sala_id, origen_plantilla_mobiliario_id)
  where origen_plantilla_mobiliario_id is not null;

comment on table sala_mobiliario is
  'Una fila por mueble físico. Ocho sillas son ocho filas: cada una tiene su sitio y su giro.';

-- ---------------------------------------------------------------------
-- La plantilla trae el mobiliario, no solo el equipamiento
--
-- Colocar una silla una vez o colocarla 144 veces es la diferencia. Guarda
-- también la ausencia de posición: una plantilla sin colocar no inventa
-- (0,0,0) en la sala nueva.
-- ---------------------------------------------------------------------
create table if not exists plantilla_mobiliario (
  id             uuid primary key default gen_random_uuid(),
  plantilla_id   uuid not null references plantillas_sala on delete cascade,
  mobiliario_id  uuid references catalogo_mobiliario on delete set null,
  nombre         text not null,
  forma          text not null default 'rectangulo'
                   check (forma in ('rectangulo', 'circulo')),
  largo_m        numeric(6,2),
  ancho_m        numeric(6,2),
  alto_m         numeric(6,2),
  x_m            numeric(6,2),
  y_m            numeric(6,2),
  z_m            numeric(6,2),
  rotacion_grados numeric(6,2) not null default 0,
  posicion_confirmada boolean,
  orden          integer not null default 100,
  creado_en      timestamptz not null default now()
);

create index if not exists plantilla_mobiliario_plantilla_idx
  on plantilla_mobiliario (plantilla_id);

-- ---------------------------------------------------------------------
-- El equipamiento también gira
--
-- Sustituye la decisión anterior de no rotar equipos: una pantalla en una
-- esquina a 45°, un rack de costado y una barra de vídeo bajo la mesa
-- necesitan orientación, y sin ella el plano de obra es aproximado justo
-- donde se taladra.
-- ---------------------------------------------------------------------
alter table sala_equipos
  add column if not exists rotacion_grados numeric(6,2) not null default 0;
alter table plantilla_articulos
  add column if not exists rotacion_grados numeric(6,2) not null default 0;

comment on column sala_equipos.rotacion_grados is
  'Giro del símbolo sobre su ancla, en grados antihorarios y normalizado a [0,360). Rotar no cambia x/y/z.';

-- De qué línea de plantilla salió el equipo. Distingue lo heredado de lo
-- añadido a mano y es lo que impide copiar dos veces la misma plantilla.
alter table sala_equipos
  add column if not exists origen_plantilla_linea_id uuid;

create unique index if not exists sala_equipos_origen_idx
  on sala_equipos (sala_id, origen_plantilla_linea_id)
  where origen_plantilla_linea_id is not null;

-- ---------------------------------------------------------------------
-- De dónde sale el plano
--
-- Al entrar en Diagrama hay que saber si la sala se prepara desde cero o
-- desde una plantilla. Se pregunta UNA vez: `diagrama_iniciado_en` es la
-- marca de que ya se decidió, y a partir de ahí la pestaña abre el editor
-- directamente.
--
-- El origen puede quedarse nulo con el diagrama ya iniciado: es el caso de
-- las salas históricas de las que no se puede demostrar la procedencia. No
-- se inventa.
-- ---------------------------------------------------------------------
alter table salas add column if not exists diagrama_iniciado_en timestamptz;
alter table salas add column if not exists diagrama_origen text;
alter table salas add column if not exists diagrama_plantilla_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'salas_diagrama_origen_check'
  ) then
    alter table salas add constraint salas_diagrama_origen_check
      check (diagrama_origen is null or diagrama_origen in ('desde_cero', 'plantilla'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'salas_diagrama_plantilla_fk'
  ) then
    alter table salas add constraint salas_diagrama_plantilla_fk
      foreign key (diagrama_plantilla_id) references plantillas_sala on delete set null;
  end if;
end $$;

comment on column salas.diagrama_origen is
  'Nulo con el diagrama ya iniciado = sala histórica cuya procedencia no puede demostrarse. No se inventa.';

-- ---------------------------------------------------------------------
-- Las sillas: una sola fuente activa
--
-- Hoy las sillas se DERIVAN del aforo y se dibujan alrededor de la mesa.
-- Con `sala_mobiliario` pasan a poder ser filas reales, y las dos fuentes
-- a la vez dibujarían cada silla dos veces.
--
-- `sillas_modo` es la guarda: 'derivadas' = el croquis las reparte desde
-- el aforo y no hay filas de silla; 'manuales' = mandan las filas y el
-- aforo vuelve a ser solo la capacidad de la sala.
--
-- El paso de un modo a otro NO se hace aquí, y no por olvido. La
-- colocación de las sillas derivadas la calcula `repartirSillasEnLaSala()`
-- en `src/lib/croquis.ts`: elige por qué lados de la mesa se sienta la
-- gente y recorta cada lado contra las paredes con la mesa girada
-- cualquier ángulo. Es lógica pura con pruebas, y repetirla en plpgsql
-- sería una segunda geometría que se separaría de la primera al primer
-- retoque.
--
-- Así que el backfill existe, pero fuera de SQL y IMPORTANDO esa misma
-- geometría: `scripts/migrar-sillas.mts`, que se lanza a mano después de
-- aplicar este esquema.
--
--   npm run migrar:sillas              → informa de qué haría
--   npm run migrar:sillas -- --aplicar → lo escribe
--
-- Es un paso manual del despliegue, igual que `npm run catalogo:normalizar`:
-- no se engancha al arranque de la aplicación ni a `npm run db:reset`. Va
-- sala a sala y en una transacción por sala; la que no tiene mesa, aforo o
-- sitio para todas sus sillas se queda en `derivadas` y se sigue dibujando
-- como hoy, que es el fallback previsto para los datos históricos. Que el
-- croquis de antes y el de después sean el mismo lo demuestra
-- `npm run test:backfill-sillas`.
--
-- El editor hace lo mismo, sala a sala, cuando alguien añade una silla a
-- mano a una sala que todavía está en `derivadas`.
-- ---------------------------------------------------------------------
alter table salas add column if not exists sillas_modo text not null default 'derivadas';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'salas_sillas_modo_check'
  ) then
    alter table salas add constraint salas_sillas_modo_check
      check (sillas_modo in ('derivadas', 'manuales'));
  end if;
end $$;

comment on column salas.sillas_modo is
  'derivadas = las reparte el croquis desde el aforo; manuales = mandan las filas de sala_mobiliario. Nunca las dos a la vez.';

-- ---------------------------------------------------------------------
-- Backfill del origen
--
-- Una sala con medidas, equipos, conexiones, tomas o mesa ya está
-- empezada: preguntarle «¿desde cero o desde plantilla?» a las 390 salas
-- reales sería interrumpir trabajo hecho. Se marcan como iniciadas.
--
-- La procedencia solo se conserva cuando puede demostrarse: `plantilla_id`
-- es de dónde nació la sala. Sin él, el diagrama queda iniciado y sin
-- origen, que es la verdad.
--
-- Idempotente por el `where diagrama_iniciado_en is null`: repetir la
-- migración no vuelve a marcar nada ni pisa una decisión posterior.
-- ---------------------------------------------------------------------
update salas s
   set diagrama_iniciado_en = coalesce(s.creado_en, now()),
       diagrama_origen = case when s.plantilla_id is not null then 'plantilla' end,
       diagrama_plantilla_id = s.plantilla_id
 where s.diagrama_iniciado_en is null
   and (
     s.largo_m > 0 or s.ancho_m > 0 or s.alto_m > 0
     or s.mesa_largo_m is not null or s.mesa_ancho_m is not null
     or s.plantilla_id is not null
     or exists (select 1 from sala_equipos e where e.sala_id = s.id)
     or exists (select 1 from tomas_red t where t.sala_id = s.id)
     or exists (select 1 from conexiones c where c.sala_id = s.id)
   );


-- ---------------------------------------------------------------------
-- Qué es cada mueble, y no solo cómo se llama
--
-- El catálogo sabía dibujar un mueble —forma y medidas— pero no qué papel
-- juega en la sala, y de esa ausencia salieron tres fallos distintos:
--
-- - Una mesa auxiliar heredada de una plantilla apagaba las sillas del
--   aforo, porque la única pregunta que se sabía hacer era «¿hay alguna
--   fila de mobiliario?». Una sala con mesa auxiliar y sin sillas se
--   quedaba con cero sillas.
-- - Añadir una silla a mano NO las apagaba, así que se dibujaban las ocho
--   del aforo más la nueva.
-- - `Mesa principal` se podía añadir como mueble genérico teniendo la sala
--   su mesa canónica en `salas.mesa_*`: dos mesas principales editables.
--
-- `rol` contesta la pregunta una vez y en el sitio donde se corrige con
-- Excel (data/mobiliario.csv). Nulo es la respuesta normal: un armario no
-- es ni asiento ni la mesa de la sala.
-- ---------------------------------------------------------------------
alter table catalogo_mobiliario add column if not exists rol text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catalogo_mobiliario_rol_check'
  ) then
    alter table catalogo_mobiliario add constraint catalogo_mobiliario_rol_check
      check (rol is null or rol in ('asiento', 'mesa_principal'));
  end if;
end $$;

comment on column catalogo_mobiliario.rol is
  'asiento = su presencia en la sala apaga las sillas derivadas del aforo; mesa_principal = es la mesa canónica de salas.mesa_*, no se instancia como fila; nulo = mueble corriente.';

-- ---------------------------------------------------------------------
-- Backfill: la columna nueva nace con el rol puesto
--
-- Añadir la columna y esperar a que alguien ejecute `npm run seed` no es una
-- migración: es una instrucción que hay que acordarse de seguir. Entre la
-- migración y la siembra, la silla tiene `rol = null`, y con el rol nulo deja
-- de ser asiento: el aforo vuelve a repartir sillas junto a las filas reales
-- y el croquis dibuja cada una dos veces. La base de producción no se
-- resetea; se le aplica esto encima de lo que ya tiene.
--
-- Se reparte por CLAVE, que es el identificador estable del catálogo, y no
-- por nombre ni por categoría: «Silla» se puede renombrar y «Asientos» se
-- puede reorganizar, pero `silla` es la referencia. Un mueble que no sea una
-- de las dos claves canónicas no se toca: no se le inventa papel ni se
-- transforma. `is distinct from` deja la sentencia idempotente y no reescribe
-- una fila que ya está bien.
-- ---------------------------------------------------------------------
update catalogo_mobiliario set rol = 'asiento'
 where clave = 'silla' and rol is distinct from 'asiento';

update catalogo_mobiliario set rol = 'mesa_principal'
 where clave = 'mesa-principal' and rol is distinct from 'mesa_principal';

-- ---------------------------------------------------------------------
-- Y se comprueba, porque un backfill que no reparte nada es peor que no
-- tenerlo: deja la base con el fallo y la migración con el «aplicado».
--
-- La comprobación se salta cuando el catálogo está vacío, que es el caso de
-- aplicar db/schema.sql sobre una base recién creada: ahí todavía no hay nada
-- que repartir y la siembra viene después. Con catálogo sembrado sí se exige,
-- y una clave canónica que falte o quede con el rol equivocado aborta la
-- migración entera con el motivo escrito.
-- ---------------------------------------------------------------------
do $$
declare
  faltan text;
begin
  if not exists (select 1 from catalogo_mobiliario) then
    raise notice 'catalogo_mobiliario vacío: el reparto de roles lo hará la siembra';
    return;
  end if;

  select string_agg(esperado.clave || ' → ' || esperado.rol, ', ')
    into faltan
    from (values ('silla', 'asiento'), ('mesa-principal', 'mesa_principal')) as esperado(clave, rol)
   where not exists (
     select 1 from catalogo_mobiliario c
      where c.clave = esperado.clave and c.rol = esperado.rol
   );

  if faltan is not null then
    raise exception
      'El reparto de roles de mobiliario no ha quedado completo: falta %. Revisa data/mobiliario.csv y catalogo_mobiliario.',
      faltan;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Quién escribió cada mueble
--
-- Misma convención que `precios` y `puertos`: una columna `fuente` que
-- distingue lo que escribe una persona desde la aplicación de lo que
-- escribe un proceso, para poder deshacer lo segundo sin llevarse por
-- delante lo primero.
--
-- Aquí el proceso es el backfill de sillas (`scripts/migrar-sillas.mts`),
-- que en una base real materializa varios miles de filas de golpe. Sin
-- esta columna, deshacerlo era mirar `creado_en` y confiar en que nadie
-- hubiera colocado una silla a mano en esa misma ventana: un rollback que
-- puede borrar trabajo medido no es un rollback.
--
-- El defecto es `app` a propósito: ni una sola inserción de la aplicación
-- cambia por esto —ni el editor, ni la copia desde plantilla— y las filas
-- que ya existen se quedan donde tienen que estar. El backfill es el único
-- que escribe el otro valor.
-- ---------------------------------------------------------------------
alter table sala_mobiliario add column if not exists fuente text not null default 'app';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sala_mobiliario_fuente_check'
  ) then
    alter table sala_mobiliario add constraint sala_mobiliario_fuente_check
      check (fuente in ('app', 'backfill'));
  end if;
end $$;

comment on column sala_mobiliario.fuente is
  'app = lo colocó una persona desde la aplicación, no se toca nunca; backfill = lo materializó scripts/migrar-sillas.mts desde el aforo, y es lo único que el rollback documentado borra.';

create index if not exists sala_mobiliario_fuente_idx
  on sala_mobiliario (sala_id, fuente);


-- ---------------------------------------------------------------------
-- Usuarios: quien entra y que ve
--
-- Hasta aqui la puerta era una clave de departamento: valia para que no
-- entrara quien pasara por la direccion, pero no distinguia a nadie. Con
-- personas reales aparecen dos preguntas que antes no existian: quien es
-- cada uno y que secciones puede ver o tocar.
--
-- `tecnicos` NO sirve para esto y no se fusiona con esto. `tecnicos` es la
-- lista de quien puede aparecer en un hito de obra, se siembra desde
-- data/tecnicos.csv y contiene gente que no entra en la aplicacion.
-- `usuarios` es quien tiene llave. Se enlazan por `tecnico_id` cuando son
-- la misma persona, y ese enlace es opcional en los dos sentidos.
-- ---------------------------------------------------------------------

-- `av` (el visto bueno de Audiovisuales que venia del flujo de XTEN-AV) ya no
-- lo usa nadie y la aplicacion lo rechaza. Se queda en el tipo porque quitar
-- un valor de un enum obliga a recrear el tipo entero, con todas las columnas
-- que lo referencian: riesgo real a cambio de nada.
alter type rol_usuario add value if not exists 'tecnico_avanzado';

create table if not exists usuarios (
  id          uuid primary key default gen_random_uuid(),
  -- El codigo de empleado (xe05206). En minusculas: quien lo teclea en el
  -- movil recibe la primera letra en mayuscula del corrector, y sin
  -- normalizar se crean dos personas que son la misma.
  usuario     text not null unique check (usuario = lower(usuario)),
  nombre      text not null,
  rol         rol_usuario not null default 'lectura',
  -- PBKDF2-HMAC-SHA256 con sal e iteraciones dentro del propio valor
  -- (`pbkdf2-sha256$600000$<sal>$<huella>`). La contrasena en claro no se
  -- guarda en ningun sitio. Ver src/lib/contrasena.ts.
  clave_hash  text not null,
  -- El alta la hace el administrador con una contrasena provisional que
  -- entrega en mano. Hasta que la persona la cambia, no llega a ninguna
  -- pantalla con datos.
  debe_cambiar_clave boolean not null default true,
  activo      boolean not null default true,
  -- La misma persona en la lista de tecnicos, cuando la hay.
  tecnico_id  uuid references tecnicos on delete set null,
  creado_en   timestamptz not null default now(),
  clave_cambiada_en timestamptz,
  ultimo_acceso_en  timestamptz
);

comment on table usuarios is
  'Quien tiene llave de la aplicacion. Distinto de `tecnicos`, que es quien puede firmar un hito de obra.';
comment on column usuarios.debe_cambiar_clave is
  'La contrasena la puso el administrador, no su dueno. Mientras sea cierto, la aplicacion solo deja llegar a /cuenta.';

create index if not exists usuarios_activo_idx on usuarios (activo, usuario);

-- Excepciones de permiso por persona. Lo que NO esta aqui lo decide el rol
-- (src/lib/usuarios.ts, PERMISOS_POR_ROL). Se guarda solo la diferencia: asi
-- cambiar el criterio de un rol alcanza a todo el mundo menos a quien tenga
-- una excepcion escrita a proposito.
create table if not exists usuario_permisos (
  usuario_id uuid not null references usuarios on delete cascade,
  seccion    text not null,
  acceso     text not null check (acceso in ('oculto', 'ver', 'editar')),
  primary key (usuario_id, seccion)
);

comment on table usuario_permisos is
  'Solo las excepciones al permiso del rol. Sin fila, manda el rol.';

-- =====================================================================
-- Fascículo 3 · Puertas del plano (2026-08)
-- El delta revisable está en db/migraciones/2026-08-puertas-plano.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Las puertas del plano
--
-- Una puerta es arquitectura de la sala, no catálogo AV: no se pide a un
-- proveedor, no tiene puertos y no entra en ninguna tirada. Vive en su
-- propia tabla y una sala puede tener varias.
--
-- Una tabla única para sala y plantilla, con propietario exclusivo: la
-- misma fila que describe la puerta de una sala describe la de una
-- plantilla, y la copia plantilla→sala copia filas, no traduce entre dos
-- modelos que divergirían.
--
-- La puerta vive EN una pared: `pared` dice cuál y `posicion_m` cuánto hay
-- del origen de esa pared al arranque del hueco. No tiene x/y libres a
-- propósito: una puerta en mitad de la sala no existe.
--
-- La anchura y la altura nacen NULAS y se presentan como «Sin medir».
-- No hay valor por defecto ni en esta tabla, ni en `parametros`, ni en el
-- dominio: inventar la anchura de una puerta es dar por medido lo que
-- nadie ha medido, y esto acaba en un plano de obra. Se miden las dos
-- juntas o ninguna: una anchura sin altura es una medida a medias y no se
-- guarda.
-- ---------------------------------------------------------------------
create table if not exists puertas (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid references salas on delete cascade,
  plantilla_id   uuid references plantillas_sala on delete cascade,
  pared          text not null check (pared in ('norte', 'sur', 'este', 'oeste')),
  posicion_m     numeric(6,2) not null check (posicion_m >= 0),
  anchura_m      numeric(6,2) check (anchura_m > 0),
  altura_m       numeric(6,2) check (altura_m > 0),
  orden          integer not null default 100,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- O de una sala o de una plantilla, nunca de las dos ni de ninguna.
  constraint puertas_propietario_check
    check ((sala_id is null) <> (plantilla_id is null)),
  -- Medida entera o sin medir: las dos dimensiones van juntas.
  constraint puertas_medida_entera_check
    check ((anchura_m is null) = (altura_m is null))
);

create index if not exists puertas_sala_idx on puertas (sala_id)
  where sala_id is not null;
create index if not exists puertas_plantilla_idx on puertas (plantilla_id)
  where plantilla_id is not null;

comment on table puertas is
  'Puertas del plano, de una sala o de una plantilla (propietario exclusivo). Anchura y altura nulas = «Sin medir»; no existe medida por defecto en ningún sitio.';
comment on column puertas.pared is
  'sur = y 0 (a lo largo de x), norte = y ancho, oeste = x 0 (a lo largo de y), este = x largo. El mismo sistema de ejes que el croquis.';
comment on column puertas.posicion_m is
  'Metros desde el origen de la pared al arranque del hueco. El origen es la esquina de menor coordenada de esa pared.';

-- =====================================================================
-- Fascículo 4 · bocas físicas de puerto
-- Mismo bloque que db/migraciones/2026-08-bocas-puerto.sql.
-- =====================================================================
-- Fascículo 4 · bocas físicas de puerto. Aditiva, idempotente y sin backfill.
do $$ begin
  create type lado_conexion as enum ('origen', 'destino');
exception when duplicate_object then null; end $$;

alter table puertos drop constraint if exists puertos_total_positivo;
alter table puertos add constraint puertos_total_positivo check (total >= 1);

create table if not exists conexion_bocas (
  conexion_id uuid not null references conexiones(id) on delete cascade,
  lado lado_conexion not null,
  equipo_id uuid not null references sala_equipos(id) on delete cascade,
  puerto_id uuid not null references puertos(id) on delete restrict,
  ordinal integer not null check (ordinal >= 1),
  primary key (conexion_id, lado),
  constraint conexion_bocas_boca_unica unique (equipo_id, puerto_id, ordinal)
);

create table if not exists plantilla_conexion_bocas (
  plantilla_conexion_id uuid not null references plantilla_conexiones(id) on delete cascade,
  lado lado_conexion not null,
  linea_id uuid not null references plantilla_articulos(id) on delete cascade,
  puerto_id uuid not null references puertos(id) on delete restrict,
  ordinal integer not null check (ordinal >= 1),
  primary key (plantilla_conexion_id, lado),
  constraint plantilla_conexion_bocas_boca_unica unique (linea_id, puerto_id, ordinal)
);

create or replace function validar_conexion_boca()
returns trigger language plpgsql as $$
declare
  c conexiones%rowtype;
  e sala_equipos%rowtype;
  p puertos%rowtype;
  extremo_esperado uuid;
begin
  select * into c from conexiones where id = new.conexion_id;
  if not found then raise exception 'conexion inexistente' using errcode = '23503'; end if;
  select * into e from sala_equipos where id = new.equipo_id;
  if not found then raise exception 'equipo inexistente' using errcode = '23503'; end if;
  -- Serializa el alta de la boca contra cambios inversos de total o artículo.
  select * into p from puertos where id = new.puerto_id for update;
  if not found then raise exception 'puerto inexistente' using errcode = '23503'; end if;
  extremo_esperado := case new.lado when 'origen' then c.origen_id else c.destino_id end;
  if new.equipo_id <> extremo_esperado or e.sala_id <> c.sala_id then
    raise exception 'equipo ajeno al extremo o sala' using errcode = '23514';
  end if;
  if e.cantidad <> 1 then raise exception 'una boca exige una instancia fisica' using errcode = '23514'; end if;
  if e.articulo_id is null or p.articulo_id <> e.articulo_id then
    raise exception 'puerto ajeno al articulo del equipo' using errcode = '23514';
  end if;
  if new.ordinal > p.total then raise exception 'ordinal fuera del total del puerto' using errcode = '23514'; end if;
  return new;
end $$;

drop trigger if exists conexion_bocas_validar on conexion_bocas;
create trigger conexion_bocas_validar before insert or update on conexion_bocas
for each row execute function validar_conexion_boca();

create or replace function validar_plantilla_conexion_boca()
returns trigger language plpgsql as $$
declare
  c plantilla_conexiones%rowtype;
  l plantilla_articulos%rowtype;
  p puertos%rowtype;
  extremo_esperado uuid;
begin
  select * into c from plantilla_conexiones where id = new.plantilla_conexion_id;
  if not found then raise exception 'tirada inexistente' using errcode = '23503'; end if;
  select * into l from plantilla_articulos where id = new.linea_id;
  if not found then raise exception 'linea inexistente' using errcode = '23503'; end if;
  select * into p from puertos where id = new.puerto_id for update;
  if not found then raise exception 'puerto inexistente' using errcode = '23503'; end if;
  extremo_esperado := case new.lado when 'origen' then c.origen_linea_id else c.destino_linea_id end;
  if new.linea_id <> extremo_esperado or l.plantilla_id <> c.plantilla_id then
    raise exception 'linea ajena al extremo o plantilla' using errcode = '23514';
  end if;
  if l.cantidad <> 1 then raise exception 'una boca exige una instancia fisica' using errcode = '23514'; end if;
  if l.articulo_id is null or p.articulo_id <> l.articulo_id then
    raise exception 'puerto ajeno al articulo de la linea' using errcode = '23514';
  end if;
  if new.ordinal > p.total then raise exception 'ordinal fuera del total del puerto' using errcode = '23514'; end if;
  return new;
end $$;

drop trigger if exists plantilla_conexion_bocas_validar on plantilla_conexion_bocas;
create trigger plantilla_conexion_bocas_validar before insert or update on plantilla_conexion_bocas
for each row execute function validar_plantilla_conexion_boca();

create or replace function exigir_pareja_conexion_bocas()
returns trigger language plpgsql as $$
declare
  objetivo uuid := coalesce(new.conexion_id, old.conexion_id);
  filas integer;
  lados integer;
begin
  if not exists (select 1 from conexiones where id = objetivo) then return null; end if;
  select count(*), count(distinct lado) into filas, lados from conexion_bocas where conexion_id = objetivo;
  if filas not in (0, 2) or (filas = 2 and lados <> 2) then
    raise exception 'el detalle fisico exige origen y destino completos' using errcode = '23514';
  end if;
  return null;
end $$;

drop trigger if exists conexion_bocas_pareja on conexion_bocas;
create constraint trigger conexion_bocas_pareja
after insert or update or delete on conexion_bocas deferrable initially deferred
for each row execute function exigir_pareja_conexion_bocas();

create or replace function exigir_pareja_plantilla_conexion_bocas()
returns trigger language plpgsql as $$
declare
  objetivo uuid := coalesce(new.plantilla_conexion_id, old.plantilla_conexion_id);
  filas integer;
  lados integer;
begin
  if not exists (select 1 from plantilla_conexiones where id = objetivo) then return null; end if;
  select count(*), count(distinct lado) into filas, lados from plantilla_conexion_bocas where plantilla_conexion_id = objetivo;
  if filas not in (0, 2) or (filas = 2 and lados <> 2) then
    raise exception 'el detalle fisico exige origen y destino completos' using errcode = '23514';
  end if;
  return null;
end $$;

drop trigger if exists plantilla_conexion_bocas_pareja on plantilla_conexion_bocas;
create constraint trigger plantilla_conexion_bocas_pareja
after insert or update or delete on plantilla_conexion_bocas deferrable initially deferred
for each row execute function exigir_pareja_plantilla_conexion_bocas();

create or replace function proteger_puerto_con_bocas()
returns trigger language plpgsql as $$
begin
  if new.total <> old.total or new.articulo_id <> old.articulo_id then
    if exists (select 1 from conexion_bocas where puerto_id = old.id and (ordinal > new.total or new.articulo_id <> old.articulo_id))
       or exists (select 1 from plantilla_conexion_bocas where puerto_id = old.id and (ordinal > new.total or new.articulo_id <> old.articulo_id)) then
      raise exception 'el puerto tiene bocas fisicas incompatibles con el cambio' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists puertos_proteger_bocas on puertos;
create trigger puertos_proteger_bocas before update of total, articulo_id on puertos
for each row execute function proteger_puerto_con_bocas();

create or replace function proteger_equipo_con_bocas()
returns trigger language plpgsql as $$
begin
  if (new.articulo_id is distinct from old.articulo_id or new.cantidad <> old.cantidad)
     and exists (select 1 from conexion_bocas where equipo_id = old.id) then
    raise exception 'el equipo tiene bocas fisicas detalladas' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists sala_equipos_proteger_bocas on sala_equipos;
create trigger sala_equipos_proteger_bocas before update of articulo_id, cantidad on sala_equipos
for each row execute function proteger_equipo_con_bocas();

create or replace function proteger_linea_con_bocas()
returns trigger language plpgsql as $$
begin
  if (new.articulo_id is distinct from old.articulo_id or new.cantidad <> old.cantidad)
     and exists (select 1 from plantilla_conexion_bocas where linea_id = old.id) then
    raise exception 'la linea tiene bocas fisicas detalladas' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists plantilla_articulos_proteger_bocas on plantilla_articulos;
create trigger plantilla_articulos_proteger_bocas before update of articulo_id, cantidad on plantilla_articulos
for each row execute function proteger_linea_con_bocas();

create or replace function invalidar_bocas_legacy_conexion()
returns trigger language plpgsql as $$
begin
  if new.puerto_origen_id is distinct from old.puerto_origen_id
     or new.puerto_destino_id is distinct from old.puerto_destino_id
     or new.origen_id is distinct from old.origen_id
     or new.destino_id is distinct from old.destino_id
     or new.sala_id is distinct from old.sala_id then
    delete from conexion_bocas where conexion_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists conexiones_invalidar_bocas_legacy on conexiones;
create trigger conexiones_invalidar_bocas_legacy after update of puerto_origen_id, puerto_destino_id, origen_id, destino_id, sala_id on conexiones
for each row execute function invalidar_bocas_legacy_conexion();

create or replace function invalidar_bocas_legacy_plantilla()
returns trigger language plpgsql as $$
begin
  if new.origen_linea_id is distinct from old.origen_linea_id
     or new.destino_linea_id is distinct from old.destino_linea_id
     or new.plantilla_id is distinct from old.plantilla_id then
    delete from plantilla_conexion_bocas where plantilla_conexion_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists plantilla_conexiones_invalidar_bocas_legacy on plantilla_conexiones;
create trigger plantilla_conexiones_invalidar_bocas_legacy
after update of origen_linea_id, destino_linea_id, plantilla_id on plantilla_conexiones
for each row execute function invalidar_bocas_legacy_plantilla();

-- Coordenadas del esquema lógico en píxeles; nunca afectan las medidas físicas.
alter table sala_equipos add column if not exists esquema_x double precision;
alter table sala_equipos add column if not exists esquema_y double precision;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sala_equipos_esquema_posicion') then
    alter table sala_equipos add constraint sala_equipos_esquema_posicion check (
      (esquema_x is null and esquema_y is null) or
      (esquema_x is not null and esquema_y is not null and
       esquema_x between 0 and 100000 and esquema_y between 0 and 100000)
    );
  end if;
end $$;

-- Septiembre 2026: compra y seguimiento de instalación.
-- Compras por línea y destino previsto. No modifica existencias.
alter table pedidos add column if not exists entrega_prevista date;
alter table pedidos add column if not exists ubicacion_prevista_id uuid references ubicaciones(id);
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'pedido_lineas' and column_name = 'comprado_en') then
    alter table pedido_lineas add column comprado_en date;
    update pedido_lineas l set comprado_en = coalesce(p.fecha, p.creado_en::date)
    from pedidos p where p.id = l.pedido_id and p.estado <> 'borrador';
  end if;
end $$;
alter table pedido_lineas add column if not exists comprado_por text;
-- Los pedidos históricos ya enviados conservan su significado, sin inventar autoría.
alter table movimientos add column if not exists pedido_linea_id uuid references pedido_lineas(id) on delete restrict;
create index if not exists movimientos_pedido_linea_idx on movimientos(pedido_linea_id);

-- Cada envío del formulario tiene identidad; sus efectos y el token se confirman juntos.
-- No atribuye tokens a movimientos históricos.
create table if not exists recepciones_compra (
  id uuid primary key,
  pedido_id uuid not null references pedidos(id) on delete restrict,
  solicitud jsonb not null,
  registrado_en timestamptz not null default clock_timestamp()
);
alter table movimientos add column if not exists recepcion_compra_id uuid references recepciones_compra(id) on delete restrict;
create unique index if not exists movimientos_recepcion_linea_idx on movimientos(recepcion_compra_id, pedido_linea_id);


-- Integración manual. No convierte visitas previas ni completa históricos.
create table if not exists seguimiento_instalacion_sala (
  sala_id uuid primary key references salas on delete cascade,
  fecha_prevista date,
  instalador_id uuid references tecnicos,
  nota text not null default '' check (length(nota) <= 2000),
  version integer not null check (version > 0)
);
create table if not exists prueba_final_sala (
  sala_id uuid primary key references salas on delete cascade,
  puntos jsonb not null check (jsonb_typeof(puntos) = 'array' and jsonb_array_length(puntos) = 6),
  version integer not null check (version > 0),
  fecha date,
  tecnico_id uuid references tecnicos,
  check ((fecha is null) = (tecnico_id is null))
);
create table if not exists auditoria_instalacion_sala (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas on delete cascade,
  autor_id uuid not null references usuarios,
  autor text not null,
  operacion text not null check (operacion in ('plan', 'checklist', 'prueba_final', 'reabrir_prueba', 'instalacion', 'entrega', 'borrar_instalacion', 'borrar_entrega')),
  registrado_en timestamptz not null default clock_timestamp(),
  datos jsonb not null
);
create index if not exists auditoria_instalacion_sala_historial on auditoria_instalacion_sala (sala_id, registrado_en);
comment on table auditoria_instalacion_sala is 'Registro acumulativo: autor de sesión, técnico y snapshots. No se edita ni borra desde seguimiento.';
begin;
-- Datos técnicos del artículo existente; no constituye otro catálogo.
create or replace function valor_dato_tecnico_valido(tipo text, valor jsonb)
returns boolean language plpgsql immutable as $$
declare claves text[]; esperadas text[]; campo text;
begin
  if valor is null then return true; end if;
  if jsonb_typeof(valor) <> 'object' then return false; end if;
  esperadas := case tipo
    when 'microfonia' then array['captacion']
    when 'alimentacion' then array['descripcion']
    when 'poe' then array['compartido','estandar','rol','vatios']
    when 'suministro' then array['cantidad','incluido','longitud_aplica','longitud_m','referencia']
    when 'puerto' then array['conector','nombre','senal','sentido','total']
    when 'restriccion' then array['texto'] else null end;
  select array_agg(k order by k) into claves from jsonb_object_keys(valor) k;
  if esperadas is null or claves is distinct from esperadas then return false; end if;
  for campo in select unnest(case tipo
    when 'microfonia' then array['captacion'] when 'alimentacion' then array['descripcion']
    when 'poe' then array['rol'] when 'suministro' then array['referencia']
    when 'puerto' then array['nombre','sentido','senal'] when 'restriccion' then array['texto'] end)
  loop
    if jsonb_typeof(valor->campo)<>'string' or not ((valor->>campo) ~ '[^[:space:]]') then return false; end if;
  end loop;
  case tipo
    when 'microfonia' then return valor->>'captacion' in ('integrada','externa','desconocida');
    when 'alimentacion','restriccion' then return true;
    when 'poe' then
      if valor->>'rol' not in ('pd','pse') or jsonb_typeof(valor->'compartido')<>'boolean'
        or jsonb_typeof(valor->'estandar') not in ('string','null')
        or jsonb_typeof(valor->'vatios') not in ('number','null') then return false; end if;
      if jsonb_typeof(valor->'estandar')='string' and not ((valor->>'estandar') ~ '[^[:space:]]') then return false; end if;
      return valor->'vatios'='null'::jsonb or (valor->>'vatios')::numeric between 0 and 1.7976931348623157e308;
    when 'suministro' then
      if jsonb_typeof(valor->'cantidad')<>'number' or jsonb_typeof(valor->'incluido') not in ('boolean','null')
        or jsonb_typeof(valor->'longitud_aplica') not in ('boolean','null')
        or jsonb_typeof(valor->'longitud_m') not in ('number','null') then return false; end if;
      if valor->'longitud_aplica'='false'::jsonb and valor->'longitud_m'<>'null'::jsonb then return false; end if;
      if (valor->>'cantidad')::numeric<1 or (valor->>'cantidad')::numeric>9007199254740991
        or trunc((valor->>'cantidad')::numeric)<>(valor->>'cantidad')::numeric then return false; end if;
      return valor->'longitud_m'='null'::jsonb or ((valor->>'longitud_m')::numeric>0 and (valor->>'longitud_m')::numeric<=1.7976931348623157e308);
    when 'puerto' then
      if jsonb_typeof(valor->'total')<>'number' or jsonb_typeof(valor->'conector') not in ('string','null') then return false; end if;
      if jsonb_typeof(valor->'conector')='string' and not ((valor->>'conector') ~ '[^[:space:]]') then return false; end if;
      return (valor->>'total')::numeric between 1 and 9007199254740991
        and trunc((valor->>'total')::numeric)=(valor->>'total')::numeric
        and valor->>'sentido' in ('entrada','salida','bidireccional','control')
        and valor->>'senal' in ('hdmi','red','usb','audio_linea','audio_altavoz','microfono','alimentacion','control','otro');
    else return false;
  end case;
end $$;
-- Contrato de fuente más estrecho que una URL general: HTTPS con nombre DNS
-- ASCII (sin IP literal/IPv6), sin credenciales y puerto numérico 0..65535.
create or replace function fuente_dato_tecnico_valida(url text)
returns boolean language plpgsql immutable as $$
declare puerto text;
begin
  if url is null then return true; end if;
  if url !~* '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z]([a-z0-9-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then return false; end if;
  puerto := substring(lower(url) from '^https://[^/:?#]+:([0-9]+)');
  return puerto is null or puerto::integer<=65535;
end $$;
create unique index if not exists puertos_id_articulo_unico on puertos(id,articulo_id);
create table if not exists articulo_datos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references articulos(id) on delete restrict,
  clave text not null check(clave ~ '[^[:space:]]'),
  concepto text,
  tipo text not null check(tipo in ('microfonia','alimentacion','poe','suministro','puerto','restriccion')),
  estado text not null check(estado in ('verificado','parcial','sin_documentar')),
  valor jsonb,
  fuente_url text check(fuente_dato_tecnico_valida(fuente_url)),
  documento text check(documento is null or documento ~ '[^[:space:]]'),
  apartado text check(apartado is null or apartado ~ '[^[:space:]]'),
  consultado_en date check(consultado_en is null or (isfinite(consultado_en) and consultado_en between date '0001-01-01' and date '9999-12-31')),
  puerto_id uuid,
  fuente text not null check(fuente in ('csv','app')),
  unique(articulo_id,clave),
  foreign key(puerto_id,articulo_id) references puertos(id,articulo_id) on delete restrict,
  constraint dato_tecnico_estado_valor check((estado='sin_documentar' and valor is null) or
    (estado<>'sin_documentar' and valor is not null and fuente_url is not null and documento is not null and apartado is not null and consultado_en is not null)),
  constraint dato_tecnico_valor_tipado check(valor_dato_tecnico_valido(tipo,valor))
);
-- Upgrade desde ronda 1: conserva datos y procedencia, sin inferir si aplica longitud.
alter table articulo_datos_tecnicos add column if not exists concepto text;
update articulo_datos_tecnicos set
  concepto=coalesce(concepto,case when tipo='suministro' then nullif(btrim(valor->>'referencia'),'') end,clave),
  valor=case when tipo='suministro' and valor is not null and not (valor ? 'longitud_aplica')
    then valor || '{"longitud_aplica":null}'::jsonb else valor end
where concepto is null or (tipo='suministro' and valor is not null and not (valor ? 'longitud_aplica'));
alter table articulo_datos_tecnicos alter column concepto set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='articulo_datos_tecnicos'::regclass and conname='dato_tecnico_concepto') then
    alter table articulo_datos_tecnicos add constraint dato_tecnico_concepto check(concepto ~ '[^[:space:]]');
  end if;
end $$;
comment on table articulo_datos_tecnicos is 'Hechos documentados por artículo. Desconocido es SQL NULL; CSV no pisa fuente app.';
commit;



-- BEGIN ROSETAS CONEXIONES L2B
-- L2B: bocas documentadas de infraestructura. Sin backfill de capacidad ni cables.
begin;
lock table conexiones, plantilla_conexiones, conexion_bocas, plantilla_conexion_bocas,
  sala_equipos, plantilla_articulos, tomas_red in access exclusive mode;
create table if not exists plantilla_tomas_red (
 id uuid primary key default gen_random_uuid(),
 plantilla_id uuid not null references plantillas_sala on delete cascade,
 codigo text not null, ubicacion text, x_m numeric(6,2), y_m numeric(6,2), z_m numeric(6,2),
 notas text, creado_en timestamptz not null default now(), unique(plantilla_id,codigo)
);
alter table plantilla_conexiones add column if not exists longitud_manual_m numeric(8,2);
drop trigger if exists conexiones_invalidar_bocas_legacy on conexiones;
drop trigger if exists plantilla_conexiones_invalidar_bocas_legacy on plantilla_conexiones;

alter table tomas_red add column if not exists capacidad_documentada integer check(capacidad_documentada>0);
alter table tomas_red add column if not exists codigo_referencia text;
alter table tomas_red add column if not exists codigo_confirmado boolean not null default false;
alter table tomas_red add column if not exists esquema_x double precision;
alter table tomas_red add column if not exists esquema_y double precision;
alter table tomas_red drop constraint if exists tomas_red_esquema_posicion;
alter table tomas_red add constraint tomas_red_esquema_posicion check(
 (esquema_x is null and esquema_y is null) or (esquema_x is not null and esquema_y is not null
 and esquema_x between 0 and 100000 and esquema_y between 0 and 100000));
create table if not exists toma_red_bocas (
 id uuid primary key default gen_random_uuid(), toma_red_id uuid not null references tomas_red(id) on delete cascade,
 ordinal integer not null check(ordinal>0), etiqueta text,
 conector text not null check(conector ~ '[^[:space:]]'), senal senal not null,
 unique(toma_red_id,ordinal)
);
alter table conexion_bocas alter column equipo_id drop not null;
alter table conexion_bocas alter column puerto_id drop not null;
alter table conexion_bocas alter column ordinal drop not null;
alter table conexion_bocas add column if not exists toma_boca_id uuid references toma_red_bocas(id) on delete restrict;
create unique index if not exists conexion_bocas_toma_unica on conexion_bocas(toma_boca_id);
alter table conexion_bocas drop constraint if exists conexion_bocas_tipo_extremo;
alter table conexion_bocas add constraint conexion_bocas_tipo_extremo check(
 (equipo_id is not null and puerto_id is not null and ordinal is not null and toma_boca_id is null)
 or (equipo_id is null and puerto_id is null and ordinal is null and toma_boca_id is not null));
alter table conexiones alter column origen_id drop not null;
alter table conexiones alter column destino_id drop not null;
-- Clasifica solamente al incorporar la columna: repetir nunca degrada completos.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='conexiones' and column_name='detalle_extremos') then
  alter table conexiones add column detalle_extremos text;
  update conexiones c set detalle_extremos=case when exists(select 1 from conexion_bocas b where b.conexion_id=c.id) then 'completo' else 'legacy' end;
 end if;
end $$;
alter table conexiones alter column detalle_extremos set default 'completo';
alter table conexiones alter column detalle_extremos set not null;
alter table conexiones drop constraint if exists conexiones_detalle_extremos;
alter table conexiones add constraint conexiones_detalle_extremos check(detalle_extremos in ('legacy','completo'));
create or replace function guardar_estado_conexiones() returns trigger language plpgsql as $$
begin
 if (tg_op='INSERT' and new.detalle_extremos<>'completo')
 or (tg_op='UPDATE' and old.detalle_extremos='completo' and new.detalle_extremos<>'completo') then
  raise exception 'No se pueden crear ni degradar tiradas legacy' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.sala_id is distinct from old.sala_id) then
  raise exception 'Identidad y propietario de tirada inmutables' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists conexiones_estado_extremos on conexiones;
create trigger conexiones_estado_extremos before insert or update on conexiones for each row execute function guardar_estado_conexiones();

create or replace function validar_conexion_boca() returns trigger language plpgsql as $$
declare c conexiones%rowtype; e sala_equipos%rowtype; p puertos%rowtype; t tomas_red%rowtype; b toma_red_bocas%rowtype;
begin
 if tg_op='UPDATE' and (new.conexion_id is distinct from old.conexion_id or new.lado is distinct from old.lado) then
  raise exception 'Identidad del extremo inmutable; sustituya la pareja en transaccion' using errcode='23514';
 end if;
 select * into c from conexiones where id=new.conexion_id for update;
 if not found then raise exception 'Tirada inexistente' using errcode='23503'; end if;
 if new.toma_boca_id is not null then
  select * into b from toma_red_bocas where id=new.toma_boca_id;
  if not found then raise exception 'Boca de roseta inexistente' using errcode='23503'; end if;
  select * into t from tomas_red where id=b.toma_red_id for update;
  select * into b from toma_red_bocas where id=new.toma_boca_id for update;
  if not found or t.sala_id<>c.sala_id or t.capacidad_documentada is null or b.ordinal>t.capacidad_documentada then
   raise exception 'Boca de roseta ajena o sin capacidad documentada' using errcode='23514';
  end if;
 else
  select * into e from sala_equipos where id=new.equipo_id for update;
  if not found then raise exception 'Equipo inexistente' using errcode='23503'; end if;
  select * into p from puertos where id=new.puerto_id for update;
  if not found then raise exception 'Puerto inexistente' using errcode='23503'; end if;
  if e.sala_id<>c.sala_id or e.cantidad<>1 or e.articulo_id is null or e.articulo_id<>p.articulo_id or new.ordinal>p.total then
   raise exception 'Boca de equipo ajena o fuera del total fisico' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create or replace function comprobar_pareja_conexiones(objetivo uuid) returns void language plpgsql as $$
declare c conexiones%rowtype; filas integer;
begin
 select * into c from conexiones where id=objetivo;
 if not found then return; end if;
 select count(*) into filas from conexion_bocas where conexion_id=objetivo;
 if (c.detalle_extremos='completo' and filas<>2) or (c.detalle_extremos='legacy' and filas<>0) then
  raise exception 'El detalle fisico exige origen y destino completos' using errcode='23514';
 end if;
 if exists(select 1 from conexion_bocas b where b.conexion_id=objetivo and (
  b.equipo_id is distinct from case b.lado when 'origen' then c.origen_id else c.destino_id end
  or b.puerto_id is distinct from case b.lado when 'origen' then c.puerto_origen_id else c.puerto_destino_id end
 )) then raise exception 'Columnas compatibles no coinciden con las bocas' using errcode='23514'; end if;
end $$;
create or replace function exigir_pareja_conexion_bocas() returns trigger language plpgsql as $$
begin
 perform comprobar_pareja_conexiones(coalesce(new.conexion_id,old.conexion_id)); return null;
end $$;
create or replace function exigir_pareja_fila_conexiones() returns trigger language plpgsql as $$
begin perform comprobar_pareja_conexiones(new.id); return null; end $$;
drop trigger if exists conexiones_pareja on conexiones;
create constraint trigger conexiones_pareja after insert or update on conexiones deferrable initially deferred
 for each row execute function exigir_pareja_fila_conexiones();

create or replace function comprobar_capacidad_tomas_red(objetivo uuid) returns void language plpgsql as $$
declare capacidad integer; total integer; menor integer; mayor integer;
begin
 select capacidad_documentada into capacidad from tomas_red where id=objetivo for update;
 if not found then return; end if;
 select count(*),min(ordinal),max(ordinal) into total,menor,mayor from toma_red_bocas where toma_red_id=objetivo;
 if (capacidad is null and total<>0) or (capacidad is not null and (total<>capacidad or menor<>1 or mayor<>capacidad)) then
  raise exception 'Capacidad documentada exige exactamente bocas 1..N' using errcode='23514';
 end if;
end $$;
create or replace function exigir_capacidad_tomas_red() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_tomas_red(new.id); return null; end $$;
create or replace function exigir_capacidad_toma_red_bocas() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_tomas_red(coalesce(new.toma_red_id,old.toma_red_id)); return null; end $$;
drop trigger if exists tomas_red_capacidad on tomas_red;
create constraint trigger tomas_red_capacidad after insert or update on tomas_red deferrable initially deferred
 for each row execute function exigir_capacidad_tomas_red();
drop trigger if exists toma_red_bocas_capacidad on toma_red_bocas;
create constraint trigger toma_red_bocas_capacidad after insert or update or delete on toma_red_bocas deferrable initially deferred
 for each row execute function exigir_capacidad_toma_red_bocas();
create or replace function proteger_toma_red_bocas() returns trigger language plpgsql as $$
begin
 perform 1 from tomas_red where id=coalesce(new.toma_red_id,old.toma_red_id) for update;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.toma_red_id is distinct from old.toma_red_id or new.ordinal is distinct from old.ordinal) then
  raise exception 'Identidad y ordinal fisico de boca inmutables' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.conector is distinct from old.conector or new.senal is distinct from old.senal)
 and exists(select 1 from conexion_bocas where toma_boca_id=old.id) then
  raise exception 'La boca ocupada no puede cambiar su conector o senal' using errcode='23514';
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists toma_red_bocas_proteger on toma_red_bocas;
create trigger toma_red_bocas_proteger before insert or update or delete on toma_red_bocas for each row execute function proteger_toma_red_bocas();
create or replace function proteger_tomas_red() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.sala_id is distinct from old.sala_id) then
  raise exception 'Identidad y propietario de roseta inmutables' using errcode='23514';
 end if;
 if tg_op='INSERT' or new.x_m is distinct from old.x_m or new.y_m is distinct from old.y_m or new.z_m is distinct from old.z_m then
  if (new.x_m is null)::int+(new.y_m is null)::int+(new.z_m is null)::int not in (0,3) then
   raise exception 'Posicion de roseta exige tres ejes o ninguno' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists tomas_red_proteger on tomas_red;
create trigger tomas_red_proteger before insert or update on tomas_red for each row execute function proteger_tomas_red();
create or replace function proteger_equipo_con_bocas() returns trigger language plpgsql as $$
begin
 if (new.articulo_id is distinct from old.articulo_id or new.cantidad<>old.cantidad or new.sala_id is distinct from old.sala_id)
 and exists(select 1 from conexion_bocas where equipo_id=old.id) then
  raise exception 'El equipo tiene bocas fisicas detalladas' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists sala_equipos_proteger_bocas on sala_equipos;
create trigger sala_equipos_proteger_bocas before update of articulo_id,cantidad,sala_id on sala_equipos
 for each row execute function proteger_equipo_con_bocas();
-- Preflight del estado migrado; no corrige ni elimina extremos incompletos.
do $$ declare fila record; begin
 for fila in select id from conexiones loop perform comprobar_pareja_conexiones(fila.id); end loop;
 for fila in select id from tomas_red loop perform comprobar_capacidad_tomas_red(fila.id); end loop;
end $$;

alter table plantilla_tomas_red add column if not exists capacidad_documentada integer check(capacidad_documentada>0);
alter table plantilla_tomas_red add column if not exists codigo_referencia text;
alter table plantilla_tomas_red add column if not exists codigo_confirmado boolean not null default false;
alter table plantilla_tomas_red add column if not exists esquema_x double precision;
alter table plantilla_tomas_red add column if not exists esquema_y double precision;
alter table plantilla_tomas_red drop constraint if exists plantilla_tomas_red_esquema_posicion;
alter table plantilla_tomas_red add constraint plantilla_tomas_red_esquema_posicion check(
 (esquema_x is null and esquema_y is null) or (esquema_x is not null and esquema_y is not null
 and esquema_x between 0 and 100000 and esquema_y between 0 and 100000));
create table if not exists plantilla_toma_red_bocas (
 id uuid primary key default gen_random_uuid(), plantilla_toma_red_id uuid not null references plantilla_tomas_red(id) on delete cascade,
 ordinal integer not null check(ordinal>0), etiqueta text,
 conector text not null check(conector ~ '[^[:space:]]'), senal senal not null,
 unique(plantilla_toma_red_id,ordinal)
);
alter table plantilla_conexion_bocas alter column linea_id drop not null;
alter table plantilla_conexion_bocas alter column puerto_id drop not null;
alter table plantilla_conexion_bocas alter column ordinal drop not null;
alter table plantilla_conexion_bocas add column if not exists toma_boca_id uuid references plantilla_toma_red_bocas(id) on delete restrict;
create unique index if not exists plantilla_conexion_bocas_toma_unica on plantilla_conexion_bocas(toma_boca_id);
alter table plantilla_conexion_bocas drop constraint if exists plantilla_conexion_bocas_tipo_extremo;
alter table plantilla_conexion_bocas add constraint plantilla_conexion_bocas_tipo_extremo check(
 (linea_id is not null and puerto_id is not null and ordinal is not null and toma_boca_id is null)
 or (linea_id is null and puerto_id is null and ordinal is null and toma_boca_id is not null));
alter table plantilla_conexiones alter column origen_linea_id drop not null;
alter table plantilla_conexiones alter column destino_linea_id drop not null;
-- Clasifica solamente al incorporar la columna: repetir nunca degrada completos.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='plantilla_conexiones' and column_name='detalle_extremos') then
  alter table plantilla_conexiones add column detalle_extremos text;
  update plantilla_conexiones c set detalle_extremos=case when exists(select 1 from plantilla_conexion_bocas b where b.plantilla_conexion_id=c.id) then 'completo' else 'legacy' end;
 end if;
end $$;
alter table plantilla_conexiones alter column detalle_extremos set default 'completo';
alter table plantilla_conexiones alter column detalle_extremos set not null;
alter table plantilla_conexiones drop constraint if exists plantilla_conexiones_detalle_extremos;
alter table plantilla_conexiones add constraint plantilla_conexiones_detalle_extremos check(detalle_extremos in ('legacy','completo'));
create or replace function guardar_estado_plantilla_conexiones() returns trigger language plpgsql as $$
begin
 if (tg_op='INSERT' and new.detalle_extremos<>'completo')
 or (tg_op='UPDATE' and old.detalle_extremos='completo' and new.detalle_extremos<>'completo') then
  raise exception 'No se pueden crear ni degradar tiradas legacy' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.plantilla_id is distinct from old.plantilla_id) then
  raise exception 'Identidad y propietario de tirada inmutables' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists plantilla_conexiones_estado_extremos on plantilla_conexiones;
create trigger plantilla_conexiones_estado_extremos before insert or update on plantilla_conexiones for each row execute function guardar_estado_plantilla_conexiones();

create or replace function validar_plantilla_conexion_boca() returns trigger language plpgsql as $$
declare c plantilla_conexiones%rowtype; e plantilla_articulos%rowtype; p puertos%rowtype; t plantilla_tomas_red%rowtype; b plantilla_toma_red_bocas%rowtype;
begin
 if tg_op='UPDATE' and (new.plantilla_conexion_id is distinct from old.plantilla_conexion_id or new.lado is distinct from old.lado) then
  raise exception 'Identidad del extremo inmutable; sustituya la pareja en transaccion' using errcode='23514';
 end if;
 select * into c from plantilla_conexiones where id=new.plantilla_conexion_id for update;
 if not found then raise exception 'Tirada inexistente' using errcode='23503'; end if;
 if new.toma_boca_id is not null then
  select * into b from plantilla_toma_red_bocas where id=new.toma_boca_id;
  if not found then raise exception 'Boca de roseta inexistente' using errcode='23503'; end if;
  select * into t from plantilla_tomas_red where id=b.plantilla_toma_red_id for update;
  select * into b from plantilla_toma_red_bocas where id=new.toma_boca_id for update;
  if not found or t.plantilla_id<>c.plantilla_id or t.capacidad_documentada is null or b.ordinal>t.capacidad_documentada then
   raise exception 'Boca de roseta ajena o sin capacidad documentada' using errcode='23514';
  end if;
 else
  select * into e from plantilla_articulos where id=new.linea_id for update;
  if not found then raise exception 'Equipo inexistente' using errcode='23503'; end if;
  select * into p from puertos where id=new.puerto_id for update;
  if not found then raise exception 'Puerto inexistente' using errcode='23503'; end if;
  if e.plantilla_id<>c.plantilla_id or e.cantidad<>1 or e.articulo_id is null or e.articulo_id<>p.articulo_id or new.ordinal>p.total then
   raise exception 'Boca de equipo ajena o fuera del total fisico' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create or replace function comprobar_pareja_plantilla_conexiones(objetivo uuid) returns void language plpgsql as $$
declare c plantilla_conexiones%rowtype; filas integer;
begin
 select * into c from plantilla_conexiones where id=objetivo;
 if not found then return; end if;
 select count(*) into filas from plantilla_conexion_bocas where plantilla_conexion_id=objetivo;
 if (c.detalle_extremos='completo' and filas<>2) or (c.detalle_extremos='legacy' and filas<>0) then
  raise exception 'El detalle fisico exige origen y destino completos' using errcode='23514';
 end if;
 if exists(select 1 from plantilla_conexion_bocas b where b.plantilla_conexion_id=objetivo and (
  b.linea_id is distinct from case b.lado when 'origen' then c.origen_linea_id else c.destino_linea_id end
  
 )) then raise exception 'Columnas compatibles no coinciden con las bocas' using errcode='23514'; end if;
end $$;
create or replace function exigir_pareja_plantilla_conexion_bocas() returns trigger language plpgsql as $$
begin
 perform comprobar_pareja_plantilla_conexiones(coalesce(new.plantilla_conexion_id,old.plantilla_conexion_id)); return null;
end $$;
create or replace function exigir_pareja_fila_plantilla_conexiones() returns trigger language plpgsql as $$
begin perform comprobar_pareja_plantilla_conexiones(new.id); return null; end $$;
drop trigger if exists plantilla_conexiones_pareja on plantilla_conexiones;
create constraint trigger plantilla_conexiones_pareja after insert or update on plantilla_conexiones deferrable initially deferred
 for each row execute function exigir_pareja_fila_plantilla_conexiones();

create or replace function comprobar_capacidad_plantilla_tomas_red(objetivo uuid) returns void language plpgsql as $$
declare capacidad integer; total integer; menor integer; mayor integer;
begin
 select capacidad_documentada into capacidad from plantilla_tomas_red where id=objetivo for update;
 if not found then return; end if;
 select count(*),min(ordinal),max(ordinal) into total,menor,mayor from plantilla_toma_red_bocas where plantilla_toma_red_id=objetivo;
 if (capacidad is null and total<>0) or (capacidad is not null and (total<>capacidad or menor<>1 or mayor<>capacidad)) then
  raise exception 'Capacidad documentada exige exactamente bocas 1..N' using errcode='23514';
 end if;
end $$;
create or replace function exigir_capacidad_plantilla_tomas_red() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_plantilla_tomas_red(new.id); return null; end $$;
create or replace function exigir_capacidad_plantilla_toma_red_bocas() returns trigger language plpgsql as $$
begin perform comprobar_capacidad_plantilla_tomas_red(coalesce(new.plantilla_toma_red_id,old.plantilla_toma_red_id)); return null; end $$;
drop trigger if exists plantilla_tomas_red_capacidad on plantilla_tomas_red;
create constraint trigger plantilla_tomas_red_capacidad after insert or update on plantilla_tomas_red deferrable initially deferred
 for each row execute function exigir_capacidad_plantilla_tomas_red();
drop trigger if exists plantilla_toma_red_bocas_capacidad on plantilla_toma_red_bocas;
create constraint trigger plantilla_toma_red_bocas_capacidad after insert or update or delete on plantilla_toma_red_bocas deferrable initially deferred
 for each row execute function exigir_capacidad_plantilla_toma_red_bocas();
create or replace function proteger_plantilla_toma_red_bocas() returns trigger language plpgsql as $$
begin
 perform 1 from plantilla_tomas_red where id=coalesce(new.plantilla_toma_red_id,old.plantilla_toma_red_id) for update;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.plantilla_toma_red_id is distinct from old.plantilla_toma_red_id or new.ordinal is distinct from old.ordinal) then
  raise exception 'Identidad y ordinal fisico de boca inmutables' using errcode='23514';
 end if;
 if tg_op='UPDATE' and (new.conector is distinct from old.conector or new.senal is distinct from old.senal)
 and exists(select 1 from plantilla_conexion_bocas where toma_boca_id=old.id) then
  raise exception 'La boca ocupada no puede cambiar su conector o senal' using errcode='23514';
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists plantilla_toma_red_bocas_proteger on plantilla_toma_red_bocas;
create trigger plantilla_toma_red_bocas_proteger before insert or update or delete on plantilla_toma_red_bocas for each row execute function proteger_plantilla_toma_red_bocas();
create or replace function proteger_plantilla_tomas_red() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.plantilla_id is distinct from old.plantilla_id) then
  raise exception 'Identidad y propietario de roseta inmutables' using errcode='23514';
 end if;
 if tg_op='INSERT' or new.x_m is distinct from old.x_m or new.y_m is distinct from old.y_m or new.z_m is distinct from old.z_m then
  if (new.x_m is null)::int+(new.y_m is null)::int+(new.z_m is null)::int not in (0,3) then
   raise exception 'Posicion de roseta exige tres ejes o ninguno' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists plantilla_tomas_red_proteger on plantilla_tomas_red;
create trigger plantilla_tomas_red_proteger before insert or update on plantilla_tomas_red for each row execute function proteger_plantilla_tomas_red();
create or replace function proteger_linea_con_bocas() returns trigger language plpgsql as $$
begin
 if (new.articulo_id is distinct from old.articulo_id or new.cantidad<>old.cantidad or new.plantilla_id is distinct from old.plantilla_id)
 and exists(select 1 from plantilla_conexion_bocas where linea_id=old.id) then
  raise exception 'El equipo tiene bocas fisicas detalladas' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists plantilla_articulos_proteger_bocas on plantilla_articulos;
create trigger plantilla_articulos_proteger_bocas before update of articulo_id,cantidad,plantilla_id on plantilla_articulos
 for each row execute function proteger_linea_con_bocas();
-- Preflight del estado migrado; no corrige ni elimina extremos incompletos.
do $$ declare fila record; begin
 for fila in select id from plantilla_conexiones loop perform comprobar_pareja_plantilla_conexiones(fila.id); end loop;
 for fila in select id from plantilla_tomas_red loop perform comprobar_capacidad_plantilla_tomas_red(fila.id); end loop;
end $$;

alter table sala_equipos add column if not exists toma_red_conexion_id uuid references conexiones(id) on delete set null;
-- Serializa la asignacion documental contra sustituciones concurrentes de extremos.
create or replace function bloquear_asignacion_toma() returns trigger language plpgsql as $$
begin
 perform 1 from conexiones where id=new.toma_red_conexion_id
   or (tg_op='UPDATE' and id=old.toma_red_conexion_id) order by id for update;
 return new;
end $$;
drop trigger if exists sala_equipos_bloquear_asignacion_toma on sala_equipos;
create trigger sala_equipos_bloquear_asignacion_toma before insert or update on sala_equipos
 for each row execute function bloquear_asignacion_toma();
create or replace function comprobar_asignaciones_toma() returns trigger language plpgsql as $$
begin
 if exists(select 1 from sala_equipos e where e.toma_red_conexion_id is not null and not exists(
  select 1 from conexiones c join conexion_bocas equipo on equipo.conexion_id=c.id and equipo.equipo_id=e.id
  join conexion_bocas toma on toma.conexion_id=c.id and toma.lado<>equipo.lado
  join toma_red_bocas b on b.id=toma.toma_boca_id
  where c.id=e.toma_red_conexion_id and c.sala_id=e.sala_id and b.toma_red_id=e.toma_red_id
 )) then raise exception 'El enlace documental no corresponde al equipo y roseta de la tirada' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists sala_equipos_asignacion_toma on sala_equipos;
create constraint trigger sala_equipos_asignacion_toma after insert or update on sala_equipos
 deferrable initially deferred for each row execute function comprobar_asignaciones_toma();
drop trigger if exists conexion_bocas_asignacion_toma on conexion_bocas;
create constraint trigger conexion_bocas_asignacion_toma after insert or update or delete on conexion_bocas
 deferrable initially deferred for each row execute function comprobar_asignaciones_toma();
comment on table toma_red_bocas is 'Bocas de infraestructura documentadas; no son articulos ni equipos AV.';
comment on column tomas_red.capacidad_documentada is 'NULL significa desconocida y ninguna boca. N requiere exactamente ordinales 1..N.';
comment on column tomas_red.codigo_confirmado is 'Confirmacion fisica explicita. Ni backfill ni copias confirman codigos.';
commit;
-- END ROSETAS CONEXIONES L2B

-- BEGIN TIRADAS DOCUMENTALES L2B
-- L2B: fuente heredada sin bocas documentadas. No constituye un cable físico.
begin;
create table if not exists plantilla_tiradas_documentales (
 id uuid primary key default gen_random_uuid(),
 fuente_clave text not null unique check(fuente_clave ~ '^[a-z0-9][a-z0-9_-]*$'),
 plantilla_id uuid not null references plantillas_sala(id) on delete cascade,
 tipologia text not null, aforo text not null,
 origen_categoria text not null, destino_categoria text not null,
 senal text not null, ruta text not null, orden text not null, notas text not null,
 conexion_resuelta_id uuid unique references plantilla_conexiones(id) on delete set null,
 creado_en timestamptz not null default now()
);
create or replace function proteger_tirada_documental() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.fuente_clave is distinct from old.fuente_clave) then
  raise exception 'La identidad de la tirada documental es inmutable' using errcode='23514';
 end if;
 if tg_op='UPDATE' and old.conexion_resuelta_id is not null and (
  new.plantilla_id is distinct from old.plantilla_id or new.tipologia is distinct from old.tipologia
  or new.aforo is distinct from old.aforo or new.origen_categoria is distinct from old.origen_categoria
  or new.destino_categoria is distinct from old.destino_categoria or new.senal is distinct from old.senal
  or new.ruta is distinct from old.ruta or new.orden is distinct from old.orden or new.notas is distinct from old.notas
 ) then raise exception 'Fuente documental resuelta cambiada: requiere revision explicita (%)',old.fuente_clave using errcode='23514'; end if;
 perform 1 from plantilla_conexiones where id=new.conexion_resuelta_id
  or (tg_op='UPDATE' and id=old.conexion_resuelta_id) order by id for update;
 return new;
end $$;
drop trigger if exists plantilla_tiradas_documentales_proteger on plantilla_tiradas_documentales;
create trigger plantilla_tiradas_documentales_proteger before insert or update on plantilla_tiradas_documentales
 for each row execute function proteger_tirada_documental();
create or replace function comprobar_resoluciones_documentales() returns trigger language plpgsql as $$
begin
 if exists(select 1 from plantilla_tiradas_documentales d where d.conexion_resuelta_id is not null and not exists(
  select 1 from plantilla_conexiones c where c.id=d.conexion_resuelta_id and c.plantilla_id=d.plantilla_id
  and c.detalle_extremos='completo'
  and (select count(*) from plantilla_conexion_bocas b where b.plantilla_conexion_id=c.id)=2
 )) then raise exception 'La tirada documental exige una conexion completa de su misma plantilla' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists plantilla_tiradas_documentales_resolucion on plantilla_tiradas_documentales;
create constraint trigger plantilla_tiradas_documentales_resolucion after insert or update on plantilla_tiradas_documentales
 deferrable initially deferred for each row execute function comprobar_resoluciones_documentales();
drop trigger if exists plantilla_conexion_bocas_documentales on plantilla_conexion_bocas;
create constraint trigger plantilla_conexion_bocas_documentales after insert or update or delete on plantilla_conexion_bocas
 deferrable initially deferred for each row execute function comprobar_resoluciones_documentales();
drop trigger if exists plantilla_conexiones_documentales on plantilla_conexiones;
create constraint trigger plantilla_conexiones_documentales after insert or update on plantilla_conexiones
 deferrable initially deferred for each row execute function comprobar_resoluciones_documentales();
comment on table plantilla_tiradas_documentales is
 'Fuente CSV literal sin bocas acreditadas. No se calcula ni suma como cable. Resuelta solo mediante vinculo explicito a una conexion fisica completa.';
commit;
-- END TIRADAS DOCUMENTALES L2B

-- BEGIN SUMINISTROS KIT L3A
-- L3A: composición publicada e instancia comercial; no despiece de almacén.
create table if not exists articulo_composiciones (
 id uuid primary key default gen_random_uuid(),
 articulo_kit_id uuid not null references articulos(id) on delete restrict,
 sku text not null check(length(trim(sku))>0),
 version integer not null check(version>0),
 estado_documental text not null check(estado_documental in ('documentada','parcial')),
 fuente text not null check(length(trim(fuente))>0),
 publicada boolean not null default false,
 unique(articulo_kit_id,version), unique(id,articulo_kit_id)
);
create table if not exists articulo_composicion_lineas (
 id uuid primary key default gen_random_uuid(),
 composicion_id uuid not null references articulo_composiciones(id) on delete restrict,
 clave text not null check(length(trim(clave))>0),
 articulo_componente_id uuid references articulos(id) on delete restrict,
 identidad text not null check(length(trim(identidad))>0),
 rol text not null check(length(trim(rol))>0),
 cantidad integer not null check(cantidad>0),
 inclusion text not null check(inclusion in ('incluido','opcional','por_determinar')),
 fuente text not null check(length(trim(fuente))>0),
 unique(composicion_id,clave), unique(id,composicion_id)
);
create table if not exists sala_suministros (
 id uuid primary key default gen_random_uuid(),
 sala_id uuid not null references salas(id) on delete restrict,
 articulo_id uuid not null,
 composicion_id uuid not null,
 snapshot jsonb not null,
 cantidad integer not null default 1 check(cantidad=1),
 estado text not null default 'activo' check(estado in ('activo','cancelado','retirado_del_diseno')),
 creado_en timestamptz not null default now(),
 foreign key(composicion_id,articulo_id) references articulo_composiciones(id,articulo_kit_id) on delete restrict,
 unique(id,sala_id,composicion_id)
);
create unique index if not exists sala_equipos_identidad_sala on sala_equipos(id,sala_id);
create table if not exists sala_componentes_suministro (
 equipo_id uuid primary key,
 suministro_id uuid not null,
 sala_id uuid not null,
 composicion_id uuid not null,
 linea_id uuid not null,
 ordinal integer not null check(ordinal>0),
 snapshot jsonb not null,
 foreign key(equipo_id,sala_id) references sala_equipos(id,sala_id) on delete restrict,
 foreign key(suministro_id,sala_id,composicion_id) references sala_suministros(id,sala_id,composicion_id) on delete restrict,
 foreign key(linea_id,composicion_id) references articulo_composicion_lineas(id,composicion_id) on delete restrict,
 unique(suministro_id,linea_id,ordinal)
);

create or replace function snapshot_composicion(uuid) returns jsonb language sql stable as $$
 select jsonb_build_object('sku',c.sku,'version',c.version,'estado_documental',c.estado_documental,
  'fuente',c.fuente,'lineas',coalesce((select jsonb_agg(to_jsonb(l) order by l.clave)
   from articulo_composicion_lineas l where l.composicion_id=c.id),'[]'::jsonb))
 from articulo_composiciones c where c.id=$1
$$;

create or replace function proteger_composicion_kit() returns trigger language plpgsql as $$
declare c articulo_composiciones;
begin
 -- Publicación y cambios inversos de catálogo comparten un único cerrojo.
 -- Evita ciclos de kits y lecturas de tipo obsoletas entre dos transacciones.
 perform pg_advisory_xact_lock(hashtextextended('av_design:composiciones',0));
 if tg_table_name='articulo_composiciones' then
  if tg_op<>'INSERT' and old.publicada then
   if tg_op='DELETE' or new is distinct from old then
    raise exception 'Composicion publicada inmutable: cree otra version' using errcode='23514';
   end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if exists(select 1 from articulo_composicion_lineas where articulo_componente_id=new.articulo_kit_id) then
   raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
  if not exists(select 1 from articulos where id=new.articulo_kit_id and tipo='equipo' and unidad='ud') then
   raise exception 'El kit exige un articulo de equipo por unidad' using errcode='23514'; end if;
  if new.publicada and not exists(select 1 from articulo_composicion_lineas where composicion_id=new.id) then
   raise exception 'Una composicion publicada exige lineas' using errcode='23514'; end if;
  if new.publicada and new.estado_documental='documentada' and exists(select 1 from articulo_composicion_lineas
   where composicion_id=new.id and (inclusion='por_determinar' or (inclusion='incluido' and articulo_componente_id is null))) then
   raise exception 'La composicion contiene pendientes: debe ser parcial' using errcode='23514'; end if;
  return new;
 end if;
 select * into c from articulo_composiciones where id=case when tg_op='DELETE' then old.composicion_id else new.composicion_id end for update;
 if c.publicada or (tg_op='UPDATE' and exists(select 1 from articulo_composiciones where id=old.composicion_id and publicada)) then
  raise exception 'Las lineas publicadas son inmutables' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.articulo_componente_id=c.articulo_kit_id or exists(select 1 from articulo_composiciones where articulo_kit_id=new.articulo_componente_id) then
  raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
 if new.articulo_componente_id is not null and not exists(select 1 from articulos where id=new.articulo_componente_id and tipo='equipo' and unidad='ud') then
  raise exception 'Un componente fisico exige articulo de equipo por unidad' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists articulo_composiciones_proteger on articulo_composiciones;
create trigger articulo_composiciones_proteger before insert or update or delete on articulo_composiciones for each row execute function proteger_composicion_kit();
drop trigger if exists articulo_composicion_lineas_proteger on articulo_composicion_lineas;
create trigger articulo_composicion_lineas_proteger before insert or update or delete on articulo_composicion_lineas for each row execute function proteger_composicion_kit();

create or replace function proteger_suministro_kit() returns trigger language plpgsql as $$
declare l articulo_composicion_lineas; e sala_equipos;
begin
 if tg_table_name='sala_suministros' then
  if tg_op<>'INSERT' then
   if tg_op='DELETE' or new is distinct from old then
    raise exception 'Gestionar kit: retirada requiere revision de diseno registrada; cancelacion pendiente de gestion integral' using errcode='23514'; end if;
   return new;
  end if;
  perform 1 from salas where id=new.sala_id for update;
  perform 1 from articulo_composiciones where id=new.composicion_id and publicada for share;
  if not found or new.estado<>'activo' then raise exception 'El suministro exige composicion publicada y estado activo' using errcode='23514'; end if;
  new.snapshot=snapshot_composicion(new.composicion_id);
  return new;
 end if;
 if tg_op<>'INSERT' then
  if tg_op='DELETE' or new is distinct from old then
   raise exception 'Gestionar kit: no se puede desvincular una pieza incluida' using errcode='23514'; end if;
  return new;
 end if;
 perform 1 from sala_suministros where id=new.suministro_id for update;
 select * into l from articulo_composicion_lineas where id=new.linea_id;
 select * into e from sala_equipos where id=new.equipo_id for update;
 if l.inclusion is distinct from 'incluido' or l.articulo_componente_id is null or e.articulo_id is distinct from l.articulo_componente_id
  or e.cantidad is distinct from 1 or new.ordinal>l.cantidad then
  raise exception 'Componente incompatible: articulo, inclusion, ordinal o cantidad' using errcode='23514'; end if;
 new.snapshot=to_jsonb(l);
 return new;
end $$;
drop trigger if exists sala_suministros_proteger on sala_suministros;
create trigger sala_suministros_proteger before insert or update or delete on sala_suministros for each row execute function proteger_suministro_kit();
drop trigger if exists sala_componentes_suministro_proteger on sala_componentes_suministro;
create trigger sala_componentes_suministro_proteger before insert or update or delete on sala_componentes_suministro for each row execute function proteger_suministro_kit();

create or replace function comprobar_suministro_completo() returns trigger language plpgsql as $$
declare sid uuid;
begin
 if tg_table_name='sala_suministros' then sid=new.id; else sid=new.suministro_id; end if;
 if exists(select 1 from sala_suministros s join articulo_composicion_lineas l on l.composicion_id=s.composicion_id
  where s.id=sid and l.inclusion='incluido' and l.articulo_componente_id is not null
  and (select count(*) from sala_componentes_suministro p where p.suministro_id=s.id and p.linea_id=l.id)<>l.cantidad) then
  raise exception 'Suministro incompleto: equipo y vinculo deben confirmarse juntos' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists sala_suministros_completo on sala_suministros;
create constraint trigger sala_suministros_completo after insert on sala_suministros deferrable initially deferred for each row execute function comprobar_suministro_completo();
drop trigger if exists sala_componentes_suministro_completo on sala_componentes_suministro;
create constraint trigger sala_componentes_suministro_completo after insert on sala_componentes_suministro deferrable initially deferred for each row execute function comprobar_suministro_completo();

create or replace function proteger_equipo_de_kit() returns trigger language plpgsql as $$
begin
 if exists(select 1 from sala_componentes_suministro where equipo_id=old.id) then
  if tg_op='DELETE' or new.id is distinct from old.id or new.sala_id is distinct from old.sala_id
   or new.articulo_id is distinct from old.articulo_id or new.cantidad is distinct from old.cantidad then
   raise exception 'Gestionar kit: no se puede borrar ni cambiar la identidad o cantidad de una pieza incluida' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists sala_equipos_kit on sala_equipos;
create trigger sala_equipos_kit before update or delete on sala_equipos for each row execute function proteger_equipo_de_kit();

create or replace function proteger_articulo_de_kit() returns trigger language plpgsql as $$
begin
 if new.tipo is distinct from old.tipo or new.unidad is distinct from old.unidad then
  perform pg_advisory_xact_lock(hashtextextended('av_design:composiciones',0));
 end if;
 if (new.tipo<>'equipo' or new.unidad<>'ud') and
  (exists(select 1 from articulo_composiciones where articulo_kit_id=old.id)
   or exists(select 1 from articulo_composicion_lineas where articulo_componente_id=old.id)) then
  raise exception 'La composicion requiere equipos por unidad' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists articulos_kit on articulos;
create trigger articulos_kit before update on articulos for each row execute function proteger_articulo_de_kit();

-- Puerta temporal explícita L3A. Se retira con atribuciones reales L3B.
-- En sala/proyecto bloquea también destinos históricos: no asigna por parecido.
create or replace function exigir_logistica_sin_kits(sala uuid, proyecto uuid default null) returns void language plpgsql as $$
begin
 perform s.id from salas s left join localizaciones l on l.id=s.localizacion_id
  where s.id=sala or l.proyecto_id=proyecto order by s.id for update of s;
 if exists(select 1 from sala_suministros k join salas s on s.id=k.sala_id
  left join localizaciones l on l.id=s.localizacion_id where s.id=sala or l.proyecto_id=proyecto) then
  raise exception 'Kits pendientes de atribucion comercial: reserva, compra o carga no disponible' using errcode='23514'; end if;
end $$;
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid;
begin
 -- Comprueba destino anterior y nuevo para que cambiarlo no esquive la guarda.
 for fila in select value from jsonb_array_elements(case when tg_op='UPDATE' then jsonb_build_array(to_jsonb(old),to_jsonb(new)) else jsonb_build_array(to_jsonb(new)) end) loop
  sid=null; pid=null;
  if tg_table_name in ('movimientos','reservas','cargas','pedidos') then
   sid=(fila->>'sala_id')::uuid;
   if tg_table_name='pedidos' then pid=(fila->>'proyecto_id')::uuid; end if;
  elsif tg_table_name='carga_lineas' then
   select sala_id into sid from cargas where id=(fila->>'carga_id')::uuid;
  elsif tg_table_name='pedido_lineas' then
   select sala_id,proyecto_id into sid,pid from pedidos where id=(fila->>'pedido_id')::uuid;
  end if;
  perform exigir_logistica_sin_kits(sid,pid);
 end loop;
 return new;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['movimientos','reservas','cargas','pedidos','carga_lineas','pedido_lineas'] loop
  execute format('drop trigger if exists logistica_kit on %I',tabla);
  execute format('create trigger logistica_kit before insert or update on %I for each row execute function proteger_logistica_kit()',tabla);
 end loop;
end $$;
-- END SUMINISTROS KIT L3A

-- BEGIN ATRIBUCIONES SUMINISTRO L3B
create table if not exists control_atribuciones_kit (
 unico boolean primary key default true check(unico),
 revision bigint not null default 0
);
insert into control_atribuciones_kit(unico) values(true) on conflict do nothing;

create table if not exists suministro_pedido_asignaciones (
 pedido_linea_id uuid not null references pedido_lineas(id) on delete restrict,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 cantidad numeric not null check(cantidad=1),
 cantidad_recibida_atribuida numeric not null default 0 check(cantidad_recibida_atribuida in(0,1)),
 creado_en timestamptz not null default now(),
 primary key(pedido_linea_id,suministro_id)
);
create index if not exists suministro_pedido_suministro_idx on suministro_pedido_asignaciones(suministro_id);
create table if not exists reserva_suministros (
 reserva_id uuid not null references reservas(id) on delete restrict,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 cantidad numeric not null check(cantidad=1),
 creado_en timestamptz not null default now(),
 primary key(reserva_id,suministro_id)
);
create index if not exists reserva_suministros_suministro_idx on reserva_suministros(suministro_id);
create table if not exists movimiento_suministros (
 movimiento_id uuid not null references movimientos(id) on delete restrict,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 cantidad numeric not null check(cantidad=1),
 salida_movimiento_id uuid,
 creado_en timestamptz not null default now(),
 primary key(movimiento_id,suministro_id),
 foreign key(salida_movimiento_id,suministro_id) references movimiento_suministros(movimiento_id,suministro_id) on delete restrict deferrable initially deferred
);
create index if not exists movimiento_suministros_suministro_idx on movimiento_suministros(suministro_id);
create index if not exists movimiento_suministros_salida_idx on movimiento_suministros(salida_movimiento_id,suministro_id);

-- La escritura de revision evita write skew también con instantáneas RR.
-- Solo serializa escrituras de atribuciones/canónicos que ya tienen vínculos.
create or replace function bloquear_atribuciones_kit() returns void language plpgsql as $$
begin
 update control_atribuciones_kit set revision=revision+1 where unico;
 if not found then raise exception 'Falta control de atribuciones' using errcode='23514'; end if;
end $$;

create or replace function proteger_atribuciones_kit() returns trigger language plpgsql as $$
begin
 if tg_op='INSERT' then
  if tg_table_name='suministro_pedido_asignaciones' then
   perform 1 from pedido_lineas where id=new.pedido_linea_id for update;
  elsif tg_table_name='reserva_suministros' then
   perform 1 from reservas where id=new.reserva_id for update;
  else
   perform 1 from movimientos where id=new.movimiento_id for update;
  end if;
  perform 1 from sala_suministros where id=new.suministro_id for update;
 end if;
 perform bloquear_atribuciones_kit();
 if tg_op='DELETE' then
  raise exception 'La atribucion conserva historial; no se borra' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
  -- Solo aumenta el recibido del mismo pedido. Cancelación integral espera L3D.
  if tg_table_name<>'suministro_pedido_asignaciones'
   or (to_jsonb(new)-'cantidad_recibida_atribuida') is distinct from (to_jsonb(old)-'cantidad_recibida_atribuida')
   or (to_jsonb(new)->>'cantidad_recibida_atribuida')::int < (to_jsonb(old)->>'cantidad_recibida_atribuida')::int then
   raise exception 'No se reasigna ni reduce una atribucion historica' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create or replace function comprobar_atribuciones_de_suministro(sid uuid) returns void language plpgsql as $$
declare s sala_suministros; pedidos_total numeric; reservado numeric; servido numeric;
begin
 select * into s from sala_suministros where id=sid;
 if not found then raise exception 'Suministro inexistente' using errcode='23503'; end if;
 if exists(select 1 from suministro_pedido_asignaciones a join pedido_lineas l on l.id=a.pedido_linea_id
   join pedidos p on p.id=l.pedido_id left join salas sala on sala.id=s.sala_id
   left join localizaciones loc on loc.id=sala.localizacion_id
   where a.suministro_id=sid and (l.articulo_id<>s.articulo_id
    or (p.sala_id is not null and p.sala_id<>s.sala_id)
    or (p.proyecto_id is not null and p.proyecto_id is distinct from loc.proyecto_id)
    or (p.sala_id is null and (p.proyecto_id is null or p.proyecto_id is distinct from loc.proyecto_id)))) then
  raise exception 'Pedido incompatible con articulo o destino del suministro' using errcode='23514'; end if;
 if exists(select 1 from pedido_lineas l where l.id in
   (select pedido_linea_id from suministro_pedido_asignaciones where suministro_id=sid)
   and ((select sum(cantidad) from suministro_pedido_asignaciones where pedido_linea_id=l.id)>l.cantidad
    or (select sum(cantidad_recibida_atribuida) from suministro_pedido_asignaciones where pedido_linea_id=l.id)>l.cantidad_recibida)) then
  raise exception 'Atribucion supera cantidad o recepcion de la linea de pedido' using errcode='23514'; end if;
 select coalesce(sum(cantidad),0) into pedidos_total from suministro_pedido_asignaciones where suministro_id=sid;
 if pedidos_total>1 then raise exception 'Pedido atribuido supera demanda' using errcode='23514'; end if;

 if exists(select 1 from reserva_suministros a join reservas r on r.id=a.reserva_id where a.suministro_id=sid
   and (r.articulo_id<>s.articulo_id or r.sala_id<>s.sala_id)) then
  raise exception 'Reserva incompatible con articulo o sala' using errcode='23514'; end if;
 if exists(select 1 from reservas r where r.id in(select reserva_id from reserva_suministros where suministro_id=sid)
   and (select sum(cantidad) from reserva_suministros where reserva_id=r.id)>r.cantidad) then
  raise exception 'Atribucion supera cantidad de reserva' using errcode='23514'; end if;

 if exists(select 1 from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=sid
   and (m.articulo_id<>s.articulo_id or m.sala_id is distinct from s.sala_id
    or m.tipo not in('entrada','salida','devolucion','baja')
    or (m.tipo='devolucion' and a.salida_movimiento_id is null)
    or (m.tipo in('entrada','salida') and a.salida_movimiento_id is not null))) then
  raise exception 'Movimiento incompatible con articulo, sala o retorno' using errcode='23514'; end if;
 if exists(select 1 from movimientos m where m.id in(select movimiento_id from movimiento_suministros where suministro_id=sid)
   and (select sum(cantidad) from movimiento_suministros where movimiento_id=m.id)>m.cantidad) then
  raise exception 'Atribucion supera cantidad del movimiento' using errcode='23514'; end if;
 if exists(select 1 from movimiento_suministros a left join movimiento_suministros origen
    on origen.movimiento_id=a.salida_movimiento_id and origen.suministro_id=a.suministro_id
   left join movimientos m on m.id=origen.movimiento_id where a.suministro_id=sid
   and a.salida_movimiento_id is not null and (origen.movimiento_id is null or m.tipo<>'salida')) then
  raise exception 'Retorno exige salida atribuida del mismo suministro' using errcode='23514'; end if;
 if exists(select 1 from movimiento_suministros origen where origen.suministro_id=sid and
   (select coalesce(sum(a.cantidad),0) from movimiento_suministros a join movimientos m on m.id=a.movimiento_id
    where a.salida_movimiento_id=origen.movimiento_id and a.suministro_id=sid and m.tipo='devolucion')>origen.cantidad) then
  raise exception 'Devoluciones superan salida atribuida' using errcode='23514'; end if;
 select coalesce(sum(a.cantidad),0) into reservado from reserva_suministros a join reservas r on r.id=a.reserva_id
  where a.suministro_id=sid and r.estado='activa';
 select coalesce(sum(case m.tipo when 'salida' then a.cantidad when 'devolucion' then -a.cantidad else 0 end),0)
  into servido from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=sid;
 if servido<0 or reservado+servido>(case when s.estado='activo' then 1 else 0 end) then
  raise exception 'Cobertura atribuida supera demanda activa' using errcode='23514'; end if;
end $$;

create or replace function validar_atribucion_kit() returns trigger language plpgsql as $$
begin
 perform comprobar_atribuciones_de_suministro(new.suministro_id);
 return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['suministro_pedido_asignaciones','reserva_suministros','movimiento_suministros'] loop
  execute format('drop trigger if exists atribucion_proteger on %I',tabla);
  execute format('create trigger atribucion_proteger before insert or update or delete on %I for each row execute function proteger_atribuciones_kit()',tabla);
  execute format('drop trigger if exists atribucion_validar on %I',tabla);
  execute format('create constraint trigger atribucion_validar after insert or update on %I deferrable initially deferred for each row execute function validar_atribucion_kit()',tabla);
 end loop;
end $$;

-- Inversas: identificar suministros afectados también por traslado de jerarquía.
create or replace function suministros_afectados_por_atribucion(tabla text, fila jsonb) returns setof uuid language sql stable as $$
 select suministro_id from suministro_pedido_asignaciones where tabla='pedido_lineas' and pedido_linea_id=(fila->>'id')::uuid
 union select a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas l on l.id=a.pedido_linea_id where tabla='pedidos' and l.pedido_id=(fila->>'id')::uuid
 union select suministro_id from reserva_suministros where tabla='reservas' and reserva_id=(fila->>'id')::uuid
 union select suministro_id from movimiento_suministros where tabla='movimientos' and movimiento_id=(fila->>'id')::uuid
 union select id from sala_suministros where tabla='salas' and sala_id=(fila->>'id')::uuid
 union select s.id from sala_suministros s join salas sa on sa.id=s.sala_id where tabla='localizaciones' and sa.localizacion_id=(fila->>'id')::uuid
 union select id from sala_suministros where tabla='sala_suministros' and id=(fila->>'id')::uuid
$$;
create or replace function proteger_inversa_atribucion_kit() returns trigger language plpgsql as $$
begin
 if exists(select 1 from suministros_afectados_por_atribucion(tg_table_name,to_jsonb(old))) then
  perform bloquear_atribuciones_kit();
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create or replace function validar_inversa_atribucion_kit() returns trigger language plpgsql as $$
declare sid uuid;
begin
 for sid in select * from suministros_afectados_por_atribucion(tg_table_name,to_jsonb(new)) order by 1 loop
  perform comprobar_atribuciones_de_suministro(sid);
 end loop;
 return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['pedido_lineas','pedidos','reservas','movimientos','salas','localizaciones','sala_suministros'] loop
  execute format('drop trigger if exists atribucion_inversa_proteger on %I',tabla);
  execute format('create trigger atribucion_inversa_proteger before update or delete on %I for each row execute function proteger_inversa_atribucion_kit()',tabla);
  execute format('drop trigger if exists atribucion_inversa_validar on %I',tabla);
  execute format('create constraint trigger atribucion_inversa_validar after update on %I deferrable initially deferred for each row execute function validar_inversa_atribucion_kit()',tabla);
 end loop;
end $$;
-- END ATRIBUCIONES SUMINISTRO L3B

-- BEGIN RECEPCION KITS B2A
alter table recepciones_compra add column if not exists protocolo text not null default 'legacy' check(protocolo in('legacy','kit_v1'));
alter table recepciones_compra add column if not exists transaccion xid8;
alter table recepciones_compra add column if not exists lineas_esperadas jsonb;
alter table recepciones_compra add column if not exists receptor_nombre text;
create table if not exists recepcion_lineas (
 recepcion_id uuid not null references recepciones_compra(id) on delete restrict,
 pedido_linea_id uuid not null references pedido_lineas(id) on delete restrict,
 cantidad numeric not null check(cantidad>0), recibido_previo numeric,
 articulo_id uuid references articulos(id) on delete restrict,
 sala_id uuid references salas(id) on delete restrict,
 ubicacion_id uuid references ubicaciones(id) on delete restrict,
 movimiento_id uuid unique, transaccion xid8,
 orden bigint generated always as identity,
 reparto_esperado jsonb,
 primary key(recepcion_id,pedido_linea_id)
);
create table if not exists recepcion_repartos (
 recepcion_id uuid not null, pedido_linea_id uuid not null,
 suministro_id uuid not null references sala_suministros(id) on delete restrict,
 recibido_previo numeric not null, cantidad numeric not null check(cantidad=1),
 primary key(recepcion_id,pedido_linea_id,suministro_id),
 foreign key(recepcion_id,pedido_linea_id) references recepcion_lineas on delete restrict,
 foreign key(pedido_linea_id,suministro_id) references suministro_pedido_asignaciones on delete restrict
);

create or replace function pedido_tiene_kits(pid uuid) returns boolean language sql stable as $$
 select exists(select 1 from pedidos p join salas s on s.id=p.sala_id or exists(
   select 1 from localizaciones l where l.id=s.localizacion_id and l.proyecto_id=p.proyecto_id)
   join sala_suministros k on k.sala_id=s.id where p.id=pid)
$$;
create or replace function estado_recepcion_pedido(pid uuid) returns estado_pedido language sql stable as $$
 select case when not exists(select 1 from pedido_lineas where pedido_id=pid and cantidad_recibida<cantidad)
  then 'recibido'::estado_pedido when exists(select 1 from pedido_lineas where pedido_id=pid and cantidad_recibida>0)
  then 'recibido_parcial'::estado_pedido else p.estado end from pedidos p where id=pid
$$;

create or replace function preparar_token_recepcion() returns trigger language plpgsql as $$
declare p pedidos; actual pedidos; l pedido_lineas; q numeric; esperadas jsonb='[]'; ids_proyectos uuid[]; sid uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Token de recepcion inmutable' using errcode='23514'; end if;
 select * into p from pedidos where id=new.pedido_id;
 if not found then raise exception 'Pedido inexistente' using errcode='23503'; end if;
 select array_agg(distinct x) into ids_proyectos from (
  select p.proyecto_id x union select loc.proyecto_id from salas s join localizaciones loc on loc.id=s.localizacion_id where s.id=p.sala_id
 ) t where x is not null;
 perform s.id from salas s left join localizaciones loc on loc.id=s.localizacion_id
  where s.id=p.sala_id or loc.proyecto_id=any(coalesce(ids_proyectos,'{}')) order by s.id for update of s;
 perform id from proyectos where id=any(coalesce(ids_proyectos,'{}')) order by id for update;
 perform id from pedidos where id=p.id for update;
 select * into actual from pedidos where id=p.id;
 if actual.sala_id is distinct from p.sala_id or actual.proyecto_id is distinct from p.proyecto_id then
  raise exception 'El pedido ha cambiado de destino; recarga' using errcode='23514'; end if;
 p=actual;
 if exists(select 1 from hitos_proyecto where proyecto_id=any(coalesce(ids_proyectos,'{}')) and tipo='cierre') then
  raise exception 'El proyecto esta cerrado' using errcode='23514'; end if;
 new.protocolo=case when pedido_tiene_kits(p.id) then 'kit_v1' else 'legacy' end;
 new.transaccion=pg_current_xact_id(); new.lineas_esperadas=null;new.receptor_nombre=null;
 if new.protocolo='legacy' then return new; end if;
 if new.solicitud->>'pedidoId' is distinct from p.id::text or jsonb_typeof(new.solicitud)<>'object'
  or nullif(new.solicitud->>'autorId','') is null then raise exception 'Solicitud de recepcion incompatible' using errcode='23514'; end if;
 select nombre into new.receptor_nombre from usuarios where id=(new.solicitud->>'autorId')::uuid and activo;
 if new.receptor_nombre is null then raise exception 'La recepcion requiere usuario activo' using errcode='23514'; end if;
 if not exists(select 1 from ubicaciones where id=(new.solicitud->>'ubicacionId')::uuid) then
  raise exception 'Elige un almacen de recepcion' using errcode='23514'; end if;
 perform id from pedido_lineas where pedido_id=p.id order by id for update;
 if new.solicitud->>'lineaId' is not null and not exists(select 1 from pedido_lineas where pedido_id=p.id and id=(new.solicitud->>'lineaId')::uuid) then
  raise exception 'La linea no pertenece al pedido' using errcode='23514'; end if;
 for l in select * from pedido_lineas where pedido_id=p.id and
  (case when new.solicitud->>'lineaId' is null then cantidad_recibida<cantidad else id=(new.solicitud->>'lineaId')::uuid end) order by id loop
  q=case when new.solicitud->>'lineaId' is null then l.cantidad-l.cantidad_recibida else (new.solicitud->>'cantidad')::numeric end;
  if q is null or q<=0 or q>l.cantidad-l.cantidad_recibida or q::text in('NaN','Infinity','-Infinity') then
   raise exception 'La recepcion supera lo pendiente' using errcode='23514'; end if;
  if l.comprado_en is null or l.precio_orientativo then raise exception 'Primero registra la compra con oferta final' using errcode='23514'; end if;
  if exists(select 1 from articulo_composiciones where articulo_kit_id=l.articulo_id) then
   if q<>trunc(q) or not exists(select 1 from suministro_pedido_asignaciones where pedido_linea_id=l.id) then
    raise exception 'Kit exige unidades enteras y atribucion explicita previa' using errcode='23514'; end if;
  end if;
  esperadas=esperadas||jsonb_build_array(jsonb_build_object('linea',l.id,'cantidad',q,'previo',l.cantidad_recibida));
 end loop;
 for sid in select distinct a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas pl on pl.id=a.pedido_linea_id where pl.pedido_id=p.id order by 1 loop
  perform id from sala_suministros where id=sid for update;
 end loop;
 perform a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas pl on pl.id=a.pedido_linea_id where pl.pedido_id=p.id order by a.suministro_id for update of a;
 perform bloquear_atribuciones_kit();
 for sid in select distinct a.suministro_id from suministro_pedido_asignaciones a join pedido_lineas pl on pl.id=a.pedido_linea_id where pl.pedido_id=p.id loop
  perform comprobar_atribuciones_de_suministro(sid);
 end loop;
 new.lineas_esperadas=esperadas; return new;
end $$;
drop trigger if exists recepcion_token_preparar on recepciones_compra;
create trigger recepcion_token_preparar before insert or update or delete on recepciones_compra for each row execute function preparar_token_recepcion();

create or replace function preparar_linea_recepcion() returns trigger language plpgsql as $$
declare t recepciones_compra; l pedido_lineas; p pedidos; e jsonb; a record; restante numeric; incremento numeric; reparto jsonb='[]';
begin
 if tg_op<>'INSERT' then raise exception 'Detalle de recepcion inmutable' using errcode='23514'; end if;
 select * into t from recepciones_compra where id=new.recepcion_id;
 if t.protocolo is distinct from 'kit_v1' or t.transaccion is distinct from pg_current_xact_id() then raise exception 'Detalle exige token de esta transaccion' using errcode='23514'; end if;
 select value into e from jsonb_array_elements(t.lineas_esperadas) where value->>'linea'=new.pedido_linea_id::text;
 if e is null or new.cantidad is distinct from (e->>'cantidad')::numeric then raise exception 'Detalle no solicitado' using errcode='23514'; end if;
 select * into l from pedido_lineas where id=new.pedido_linea_id for update;
 select * into p from pedidos where id=t.pedido_id;
 if l.pedido_id<>p.id or l.cantidad_recibida is distinct from (e->>'previo')::numeric or l.comprado_en is null or l.precio_orientativo
  or new.cantidad>l.cantidad-l.cantidad_recibida then raise exception 'Baseline o compra incompatible' using errcode='23514'; end if;
 if new.recibido_previo is not null or new.transaccion is not null or new.movimiento_id is not null or new.reparto_esperado is not null
  or new.articulo_id is not null or new.sala_id is not null or new.ubicacion_id is not null then
  raise exception 'Datos de recepcion impuestos por servidor' using errcode='23514'; end if;
 new.recibido_previo=l.cantidad_recibida; new.transaccion=pg_current_xact_id();new.articulo_id=l.articulo_id;
 new.sala_id=p.sala_id;new.ubicacion_id=(t.solicitud->>'ubicacionId')::uuid;new.movimiento_id=gen_random_uuid();
 restante=new.cantidad;
 for a in select * from suministro_pedido_asignaciones where pedido_linea_id=l.id order by creado_en,suministro_id for update loop
  incremento=least(restante,a.cantidad-a.cantidad_recibida_atribuida);
  if incremento>0 then
   if incremento<>1 then raise exception 'Recepcion de kit debe completar una unidad' using errcode='23514'; end if;
   reparto=reparto||jsonb_build_array(jsonb_build_object('suministro',a.suministro_id,'previo',a.cantidad_recibida_atribuida,'cantidad',incremento));
   restante=restante-incremento;
  end if;
 end loop;
 new.reparto_esperado=reparto;return new;
end $$;
drop trigger if exists recepcion_linea_preparar on recepcion_lineas;
create trigger recepcion_linea_preparar before insert or update or delete on recepcion_lineas for each row execute function preparar_linea_recepcion();

create or replace function proteger_reparto_recepcion() returns trigger language plpgsql as $$
begin
 if tg_op<>'INSERT' then raise exception 'Reparto de recepcion inmutable' using errcode='23514'; end if;
 if not exists(select 1 from recepcion_lineas d,jsonb_array_elements(d.reparto_esperado) e where d.recepcion_id=new.recepcion_id
  and d.pedido_linea_id=new.pedido_linea_id and d.transaccion=pg_current_xact_id() and e->>'suministro'=new.suministro_id::text
  and (e->>'previo')::numeric=new.recibido_previo and (e->>'cantidad')::numeric=new.cantidad) then
  raise exception 'Reparto no calculado por recepcion actual' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists recepcion_reparto_proteger on recepcion_repartos;
create trigger recepcion_reparto_proteger before insert or update or delete on recepcion_repartos for each row execute function proteger_reparto_recepcion();

create or replace function materializar_linea_recepcion() returns trigger language plpgsql as $$
declare e jsonb; pid uuid; actor text;
begin
 select pedido_id,receptor_nombre into pid,actor from recepciones_compra where id=new.recepcion_id;
 update pedido_lineas set cantidad_recibida=new.recibido_previo+new.cantidad where id=new.pedido_linea_id;
 insert into movimientos(id,articulo_id,ubicacion_id,tipo,cantidad,sala_id,motivo,quien,pedido_linea_id,recepcion_compra_id)
 values(new.movimiento_id,new.articulo_id,new.ubicacion_id,'entrada',new.cantidad,new.sala_id,'Recepcion de pedido',actor,new.pedido_linea_id,new.recepcion_id);
 for e in select value from jsonb_array_elements(new.reparto_esperado) loop
  insert into recepcion_repartos values(new.recepcion_id,new.pedido_linea_id,(e->>'suministro')::uuid,(e->>'previo')::numeric,(e->>'cantidad')::numeric);
  update suministro_pedido_asignaciones set cantidad_recibida_atribuida=(e->>'previo')::numeric+(e->>'cantidad')::numeric
   where pedido_linea_id=new.pedido_linea_id and suministro_id=(e->>'suministro')::uuid;
 end loop;
 update pedidos set estado=estado_recepcion_pedido(pid) where id=pid;
 return null;
end $$;
drop trigger if exists recepcion_linea_materializar on recepcion_lineas;
create trigger recepcion_linea_materializar after insert on recepcion_lineas for each row execute function materializar_linea_recepcion();

-- La linea resuelve el destino aunque una entrada compartida no tenga sala ni token.
create or replace function exigir_movimiento_pedido_sin_kits(linea uuid) returns void language plpgsql as $$
declare p pedidos; actual pedidos; pedido_actual uuid;
begin
 select pe.* into p from pedidos pe join pedido_lineas l on l.pedido_id=pe.id where l.id=linea;
 if not found then raise exception 'Linea de pedido inexistente' using errcode='23503'; end if;
 -- Mismo orden que recepcion: salas, proyecto, pedido y linea. Releer tras esperar.
 perform s.id from salas s left join localizaciones loc on loc.id=s.localizacion_id
  where s.id=p.sala_id or loc.proyecto_id=p.proyecto_id order by s.id for update of s;
 perform id from proyectos where id=p.proyecto_id for update;
 perform id from pedidos where id=p.id for update;
 select pedido_id into pedido_actual from pedido_lineas where id=linea for update;
 select * into actual from pedidos where id=p.id;
 if pedido_actual is distinct from p.id or actual.sala_id is distinct from p.sala_id
  or actual.proyecto_id is distinct from p.proyecto_id then
  raise exception 'El pedido ha cambiado de destino; recarga' using errcode='23514'; end if;
 if pedido_tiene_kits(actual.id) then
  raise exception 'Entrada sin detalle exacto de esta transaccion' using errcode='23514'; end if;
end $$;

-- Extiende L3A solo con hechos actuales de recepcion y transiciones exactas.
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid; admitida boolean=false;
begin
 if tg_table_name='pedido_lineas' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-'cantidad_recibida')=(to_jsonb(old)-'cantidad_recibida') and exists(
   select 1 from recepcion_lineas d where d.pedido_linea_id=new.id and d.transaccion=pg_current_xact_id()
   and old.cantidad_recibida=d.recibido_previo and new.cantidad_recibida=d.recibido_previo+d.cantidad);
 elsif tg_table_name='movimientos' and tg_op='INSERT' then
  admitida=exists(select 1 from recepcion_lineas d join recepciones_compra t on t.id=d.recepcion_id
   where d.movimiento_id=new.id and d.transaccion=pg_current_xact_id() and new.tipo='entrada' and new.articulo_id=d.articulo_id
   and new.cantidad=d.cantidad and new.sala_id is not distinct from d.sala_id and new.ubicacion_id=d.ubicacion_id
   and new.pedido_linea_id=d.pedido_linea_id and new.recepcion_compra_id=d.recepcion_id and new.quien=t.receptor_nombre);
 elsif tg_table_name='pedidos' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])
   and new.estado=estado_recepcion_pedido(new.id) and exists(select 1 from recepciones_compra t
    join recepcion_lineas d on d.recepcion_id=t.id where t.pedido_id=new.id and d.transaccion=pg_current_xact_id());
 end if;
 if admitida then return new; end if;
 for fila in select value from jsonb_array_elements(case when tg_op='UPDATE' then jsonb_build_array(to_jsonb(old),to_jsonb(new)) else jsonb_build_array(to_jsonb(new)) end) loop
  sid=null;pid=null;
  if tg_table_name='movimientos' and fila->>'pedido_linea_id' is not null then
   perform exigir_movimiento_pedido_sin_kits((fila->>'pedido_linea_id')::uuid);
  end if;
  if tg_table_name in('movimientos','reservas','cargas','pedidos') then sid=(fila->>'sala_id')::uuid;
   if tg_table_name='pedidos' then pid=(fila->>'proyecto_id')::uuid; end if;
  elsif tg_table_name='carga_lineas' then select sala_id into sid from cargas where id=(fila->>'carga_id')::uuid;
  elsif tg_table_name='pedido_lineas' then select sala_id,proyecto_id into sid,pid from pedidos where id=(fila->>'pedido_id')::uuid;
  end if;
  perform exigir_logistica_sin_kits(sid,pid);
 end loop;
 return new;
end $$;

create or replace function proteger_efecto_recepcion() returns trigger language plpgsql as $$
declare d recepcion_lineas;
begin
 if tg_table_name='movimientos' then
  if tg_op<>'INSERT' and old.recepcion_compra_id is not null then raise exception 'Movimiento de recepcion inmutable' using errcode='23514'; end if;
  if tg_op='INSERT' and exists(select 1 from recepciones_compra where id=new.recepcion_compra_id and protocolo='kit_v1') then
   if not exists(select 1 from recepcion_lineas l join recepciones_compra t on t.id=l.recepcion_id
    where l.movimiento_id=new.id and l.transaccion=pg_current_xact_id() and l.recepcion_id=new.recepcion_compra_id
    and l.pedido_linea_id=new.pedido_linea_id and l.articulo_id=new.articulo_id and l.ubicacion_id=new.ubicacion_id
    and l.sala_id is not distinct from new.sala_id and new.tipo='entrada' and l.cantidad=new.cantidad and new.quien=t.receptor_nombre) then
    raise exception 'Entrada sin detalle exacto de esta transaccion' using errcode='23514'; end if;
  end if;
 elsif tg_table_name='suministro_pedido_asignaciones' and tg_op='UPDATE' then
  if exists(select 1 from recepcion_lineas where pedido_linea_id=new.pedido_linea_id and transaccion=pg_current_xact_id())
   and new.cantidad_recibida_atribuida is distinct from old.cantidad_recibida_atribuida then
   if not exists(select 1 from recepcion_repartos r join recepcion_lineas l using(recepcion_id,pedido_linea_id)
    where r.pedido_linea_id=new.pedido_linea_id and r.suministro_id=new.suministro_id and l.transaccion=pg_current_xact_id()
    and r.recibido_previo=old.cantidad_recibida_atribuida and r.recibido_previo+r.cantidad=new.cantidad_recibida_atribuida) then
    raise exception 'Incremento atribuido sin reparto actual' using errcode='23514'; end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists recepcion_efecto_proteger on movimientos;
create trigger recepcion_efecto_proteger before insert or update or delete on movimientos for each row execute function proteger_efecto_recepcion();
drop trigger if exists recepcion_efecto_proteger on suministro_pedido_asignaciones;
create trigger recepcion_efecto_proteger before update on suministro_pedido_asignaciones for each row execute function proteger_efecto_recepcion();

create or replace function comprobar_recepcion_actual(rid uuid) returns void language plpgsql as $$
declare t recepciones_compra; e jsonb; d recepcion_lineas; x record;
begin
 select * into t from recepciones_compra where id=rid;
 if t.protocolo<>'kit_v1' then return; end if;
 if t.transaccion is distinct from pg_current_xact_id() then raise exception 'Recepcion ajena a esta transaccion' using errcode='23514'; end if;
 if (select count(*) from recepcion_lineas where recepcion_id=rid)<>jsonb_array_length(t.lineas_esperadas) then
  raise exception 'Recepcion incompleta desde token' using errcode='23514'; end if;
 for e in select value from jsonb_array_elements(t.lineas_esperadas) loop
  select * into d from recepcion_lineas where recepcion_id=rid and pedido_linea_id=(e->>'linea')::uuid;
  if not found or d.cantidad<>(e->>'cantidad')::numeric or d.recibido_previo<>(e->>'previo')::numeric then
   raise exception 'Detalle esperado ausente o alterado' using errcode='23514'; end if;
  if not exists(select 1 from movimientos m where m.id=d.movimiento_id and m.recepcion_compra_id=rid and m.pedido_linea_id=d.pedido_linea_id
   and m.tipo='entrada' and m.articulo_id=d.articulo_id and m.cantidad=d.cantidad and m.ubicacion_id=d.ubicacion_id
   and m.sala_id is not distinct from d.sala_id and m.quien=t.receptor_nombre) then
   raise exception 'Movimiento de recepcion ausente o alterado' using errcode='23514'; end if;
  if (select count(*) from recepcion_repartos where recepcion_id=rid and pedido_linea_id=d.pedido_linea_id)<>jsonb_array_length(d.reparto_esperado) then
   raise exception 'Reparto de recepcion incompleto' using errcode='23514'; end if;
 end loop;
 for x in select pedido_linea_id,(array_agg(recibido_previo order by orden))[1] previo,sum(cantidad) incremento
  from recepcion_lineas where transaccion=pg_current_xact_id() group by pedido_linea_id loop
  if not exists(select 1 from pedido_lineas where id=x.pedido_linea_id and cantidad_recibida=x.previo+x.incremento) then
   raise exception 'Saldo final de recepcion no coincide con todos los incrementos' using errcode='23514'; end if;
 end loop;
 for x in select r.pedido_linea_id,r.suministro_id,(array_agg(r.recibido_previo order by det.orden))[1] previo,sum(r.cantidad) incremento
  from recepcion_repartos r join recepcion_lineas det using(recepcion_id,pedido_linea_id)
  where det.transaccion=pg_current_xact_id() group by r.pedido_linea_id,r.suministro_id loop
  if not exists(select 1 from suministro_pedido_asignaciones where pedido_linea_id=x.pedido_linea_id and suministro_id=x.suministro_id
   and cantidad_recibida_atribuida=x.previo+x.incremento) then raise exception 'Saldo de reparto no coincide' using errcode='23514'; end if;
 end loop;
 if jsonb_array_length(t.lineas_esperadas)>0 and (select estado from pedidos where id=t.pedido_id)<>estado_recepcion_pedido(t.pedido_id) then
  raise exception 'Estado final de pedido incoherente' using errcode='23514'; end if;
end $$;
create or replace function validar_recepcion_actual() returns trigger language plpgsql as $$
declare rid uuid;
begin
 if tg_table_name='recepciones_compra' then perform comprobar_recepcion_actual(new.id);
 elsif tg_table_name in('recepcion_lineas','recepcion_repartos') then perform comprobar_recepcion_actual(new.recepcion_id);
 else
  for rid in select id from recepciones_compra where transaccion=pg_current_xact_id() and protocolo='kit_v1' loop
   perform comprobar_recepcion_actual(rid);
  end loop;
 end if;return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['recepciones_compra','recepcion_lineas','recepcion_repartos','pedido_lineas','movimientos','suministro_pedido_asignaciones','pedidos'] loop
  execute format('drop trigger if exists recepcion_completa on %I',tabla);
  execute format('create constraint trigger recepcion_completa after insert or update on %I deferrable initially deferred for each row execute function validar_recepcion_actual()',tabla);
 end loop;
end $$;
-- END RECEPCION KITS B2A

-- BEGIN RESERVA KITS B2B
create or replace function tomar_control_escritura_kit() returns void language plpgsql as $$
begin
 if not pg_try_advisory_xact_lock(21440,2) then raise exception 'Control de escritura ocupado' using errcode='40001'; end if;
 update control_atribuciones_kit set revision=revision+1 where unico;
 if not found then raise exception 'Falta control de atribuciones' using errcode='23514'; end if;
end $$;
create or replace function bloquear_atribuciones_kit() returns void language plpgsql as $$
begin perform tomar_control_escritura_kit(); end $$;
create or replace function entrar_escritura_kit() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_level='STATEMENT' then return null; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create table if not exists articulos_stock_kit (
 articulo_id uuid primary key references articulos(id) on delete restrict,
 registrado_en timestamptz not null default now()
);
create table if not exists baselines_stock_kit (
 transaccion xid8 not null, articulo_id uuid not null,
 disponible numeric not null, primary key(transaccion,articulo_id)
);
create or replace function disponible_stock_kit(aid uuid) returns numeric language sql stable as $$
 select coalesce((select sum(cantidad) from existencias where articulo_id=aid),0)
  -coalesce((select sum(cantidad) from reservas where articulo_id=aid and estado='activa'),0)
$$;
create or replace function imponer_baseline_stock() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'Baseline inmutable' using errcode='23514'; end if;
 new.transaccion=pg_current_xact_id();new.disponible=disponible_stock_kit(new.articulo_id);return new;
end $$;
drop trigger if exists baseline_impuesto on baselines_stock_kit;
create trigger baseline_impuesto before insert or update or delete on baselines_stock_kit for each row execute function imponer_baseline_stock();
create or replace function capturar_baseline_stock(aid uuid) returns void language plpgsql as $$
begin
 if aid is not null then
  insert into baselines_stock_kit(transaccion,articulo_id,disponible) values(pg_current_xact_id(),aid,0) on conflict do nothing;
 end if;
end $$;
create or replace function proteger_perimetro_stock() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'El perimetro de kits es permanente' using errcode='23514'; end if;
 if not exists(select 1 from articulo_composiciones where articulo_kit_id=new.articulo_id)
  and not exists(select 1 from sala_suministros where articulo_id=new.articulo_id) then
  raise exception 'Perimetro sin fuente canonica' using errcode='23514'; end if;
 perform capturar_baseline_stock(new.articulo_id);return new;
end $$;
drop trigger if exists perimetro_proteger on articulos_stock_kit;
create trigger perimetro_proteger before insert or update or delete on articulos_stock_kit for each row execute function proteger_perimetro_stock();
create or replace function registrar_perimetro_stock() returns trigger language plpgsql as $$
declare aid uuid;
begin
 aid=case when tg_table_name='articulo_composiciones' then (to_jsonb(new)->>'articulo_kit_id')::uuid else (to_jsonb(new)->>'articulo_id')::uuid end;
 insert into articulos_stock_kit(articulo_id) values(aid) on conflict do nothing;return null;
end $$;
drop trigger if exists composicion_perimetro on articulo_composiciones;
create trigger composicion_perimetro after insert or update on articulo_composiciones for each row execute function registrar_perimetro_stock();
drop trigger if exists suministro_perimetro on sala_suministros;
create trigger suministro_perimetro after insert or update on sala_suministros for each row execute function registrar_perimetro_stock();
insert into articulos_stock_kit(articulo_id)
 select articulo_kit_id from articulo_composiciones union select articulo_id from sala_suministros on conflict do nothing;

create or replace function preparar_saldo_stock() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then perform capturar_baseline_stock(old.articulo_id); end if;
 if tg_op<>'DELETE' then perform capturar_baseline_stock(new.articulo_id); end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
create or replace function validar_deficit_stock() returns trigger language plpgsql as $$
declare b record;
begin
 for b in select bs.* from baselines_stock_kit bs join articulos_stock_kit p using(articulo_id) where transaccion=pg_current_xact_id() loop
  if greatest(0,-disponible_stock_kit(b.articulo_id))>greatest(0,-b.disponible) then
   raise exception 'La operacion agrava el deficit de stock del articulo %',b.articulo_id using errcode='23514'; end if;
 end loop;return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['movimientos','reservas'] loop
  execute format('drop trigger if exists aa_stock_baseline on %I',tabla);
  execute format('create trigger aa_stock_baseline before insert or update or delete on %I for each row execute function preparar_saldo_stock()',tabla);
 end loop;
 foreach tabla in array array['movimientos','reservas','articulos_stock_kit','baselines_stock_kit'] loop
  execute format('drop trigger if exists stock_deficit_validar on %I',tabla);
  execute format('create constraint trigger stock_deficit_validar after insert or update or delete on %I deferrable initially deferred for each row execute function validar_deficit_stock()',tabla);
 end loop;
end $$;

create table if not exists operaciones_reserva_kit (
 id uuid primary key, operacion text not null check(operacion in('reservar','liberar')),
 solicitud jsonb not null, suministro_id uuid references sala_suministros(id) on delete restrict,
 reserva_id uuid not null, transaccion xid8, articulo_id uuid references articulos(id) on delete restrict,
 sala_id uuid references salas(id) on delete restrict, usuario_id uuid references usuarios(id) on delete restrict,
 autor_nombre text, estado_previo text, disponible_previo numeric,
 orden bigint generated always as identity,
 creado_en timestamptz not null default now()
);
create or replace function preparar_operacion_reserva() returns trigger language plpgsql as $$
declare s sala_suministros; r reservas; pid uuid; servido numeric;
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'Operacion de reserva inmutable' using errcode='23514'; end if;
 if new.transaccion is not null or new.articulo_id is not null or new.sala_id is not null or new.usuario_id is not null
  or new.autor_nombre is not null or new.estado_previo is not null or new.disponible_previo is not null then
  raise exception 'Baseline de reserva impuesto por servidor' using errcode='23514'; end if;
 new.usuario_id=(new.solicitud->>'autorId')::uuid;
 select nombre into new.autor_nombre from usuarios where id=new.usuario_id and activo;
 if new.autor_nombre is null then raise exception 'Reserva requiere usuario activo' using errcode='23514'; end if;
 if new.operacion='reservar' then
  new.suministro_id=(new.solicitud->>'suministroId')::uuid;new.reserva_id=gen_random_uuid();new.estado_previo=null;
 else
  new.reserva_id=(new.solicitud->>'reservaId')::uuid;
  select * into r from reservas where id=new.reserva_id;
  select suministro_id into new.suministro_id from operaciones_reserva_kit where reserva_id=r.id and operacion='reservar';
  if not found then raise exception 'Solo se libera una reserva gestionada unitaria' using errcode='23514'; end if;
  new.estado_previo=r.estado;
 end if;
 select * into s from sala_suministros where id=new.suministro_id;
 if not found or s.estado<>'activo' then raise exception 'Suministro activo requerido' using errcode='23514'; end if;
 perform id from salas where id=s.sala_id for update;
 select l.proyecto_id into pid from salas sa left join localizaciones l on l.id=sa.localizacion_id where sa.id=s.sala_id;
 perform id from proyectos where id=pid for update;
 if exists(select 1 from hitos_proyecto where proyecto_id=pid and tipo='cierre') then raise exception 'Proyecto cerrado' using errcode='23514'; end if;
 perform id from sala_suministros where id=s.id for update;
 new.articulo_id=s.articulo_id;new.sala_id=s.sala_id;new.transaccion=pg_current_xact_id();
 perform capturar_baseline_stock(s.articulo_id);new.disponible_previo=disponible_stock_kit(s.articulo_id);
 if new.operacion='reservar' then
  perform comprobar_atribuciones_de_suministro(s.id);
  select coalesce(sum(case m.tipo when 'salida' then a.cantidad when 'devolucion' then -a.cantidad else 0 end),0) into servido
   from movimiento_suministros a join movimientos m on m.id=a.movimiento_id where a.suministro_id=s.id;
  if servido>0 or exists(select 1 from reserva_suministros a join reservas rr on rr.id=a.reserva_id where a.suministro_id=s.id and rr.estado='activa') then
   raise exception 'El suministro ya esta cubierto' using errcode='23514'; end if;
  if new.disponible_previo<1 then raise exception 'No hay una unidad disponible' using errcode='23514'; end if;
 else
  select * into r from reservas where id=new.reserva_id for update;
  if r.estado<>'activa' or r.cantidad<>1 or r.articulo_id<>s.articulo_id or r.sala_id<>s.sala_id
   or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
   or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=s.id and cantidad=1) then
   raise exception 'La reserva gestionada no esta activa o no es unitaria' using errcode='23514'; end if;
 end if;
 return new;
end $$;
drop trigger if exists operacion_reserva_preparar on operaciones_reserva_kit;
create trigger operacion_reserva_preparar before insert or update or delete on operaciones_reserva_kit for each row execute function preparar_operacion_reserva();
create or replace function materializar_operacion_reserva() returns trigger language plpgsql as $$
begin
 if new.operacion='reservar' then
  insert into reservas(id,sala_id,articulo_id,cantidad,estado,quien) values(new.reserva_id,new.sala_id,new.articulo_id,1,'activa',new.autor_nombre);
  insert into reserva_suministros(reserva_id,suministro_id,cantidad) values(new.reserva_id,new.suministro_id,1);
  if disponible_stock_kit(new.articulo_id)<>new.disponible_previo-1 or disponible_stock_kit(new.articulo_id)<0 then
   raise exception 'Saldo posterior a reserva incompatible' using errcode='23514'; end if;
 else
  update reservas set estado='liberada' where id=new.reserva_id;
  if disponible_stock_kit(new.articulo_id)<>new.disponible_previo+1 then raise exception 'Saldo posterior a liberacion incompatible' using errcode='23514'; end if;
 end if;return null;
end $$;
drop trigger if exists operacion_reserva_materializar on operaciones_reserva_kit;
create trigger operacion_reserva_materializar after insert on operaciones_reserva_kit for each row execute function materializar_operacion_reserva();
create or replace function proteger_reserva_gestionada() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op='INSERT' then return new; end if;
 if exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='reservar') then
  if tg_op='DELETE' then raise exception 'Reserva gestionada conserva historial' using errcode='23514'; end if;
  if old.estado<>'activa' or new.estado<>'liberada'
   or (to_jsonb(new)-array['estado','actualizado_en']) is distinct from (to_jsonb(old)-array['estado','actualizado_en'])
   or not exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='liberar'
    and transaccion=pg_current_xact_id() and estado_previo=old.estado) then
   raise exception 'Transicion de reserva sin hecho actual exacto' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists reserva_gestionada_proteger on reservas;
create trigger reserva_gestionada_proteger before insert or update or delete on reservas for each row execute function proteger_reserva_gestionada();
create or replace function validar_operacion_reserva() returns trigger language plpgsql as $$
declare o operaciones_reserva_kit; r reservas; ultimo text;
begin
 for o in select * from operaciones_reserva_kit where transaccion=pg_current_xact_id() loop
  select * into r from reservas where id=o.reserva_id;
  select case operacion when 'reservar' then 'activa' else 'liberada' end into ultimo from operaciones_reserva_kit where reserva_id=o.reserva_id order by orden desc limit 1;
  if r.id is null or r.cantidad<>1 or r.articulo_id<>o.articulo_id or r.sala_id<>o.sala_id or r.estado<>ultimo
   or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
   or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=o.suministro_id and cantidad=1) then
   raise exception 'Operacion de reserva incompleta' using errcode='23514'; end if;
 end loop;return null;
end $$;
do $$ declare tabla text; begin
 foreach tabla in array array['operaciones_reserva_kit','reservas','reserva_suministros'] loop
  execute format('drop trigger if exists reserva_operacion_completa on %I',tabla);
  execute format('create constraint trigger reserva_operacion_completa after insert or update on %I deferrable initially deferred for each row execute function validar_operacion_reserva()',tabla);
 end loop;
 -- SQL directo toma control antes de filas/FK; fila respalda cascadas.
 foreach tabla in array array['articulos','articulo_composiciones','articulo_composicion_lineas','sala_suministros','sala_componentes_suministro',
  'salas','localizaciones','proyectos','hitos_proyecto','pedidos','pedido_lineas','recepciones_compra','recepcion_lineas','recepcion_repartos',
  'movimientos','reservas','cargas','carga_lineas','suministro_pedido_asignaciones','reserva_suministros','movimiento_suministros','operaciones_reserva_kit','articulos_stock_kit'] loop
  execute format('drop trigger if exists aa_control_statement on %I',tabla);
  execute format('create trigger aa_control_statement before insert or update or delete on %I for each statement execute function entrar_escritura_kit()',tabla);
  execute format('drop trigger if exists aa_control_fila on %I',tabla);
  execute format('create trigger aa_control_fila before insert or update or delete on %I for each row execute function entrar_escritura_kit()',tabla);
 end loop;
end $$;
-- Retira únicamente los triggers añadidos al equipo en el ensayo local previo.
-- La lista contractual controla los vínculos; no amplía el mutex a sala_equipos.
drop trigger if exists aa_control_statement on sala_equipos;
drop trigger if exists aa_control_fila on sala_equipos;
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid; admitida boolean=false;
begin
 if tg_table_name='reservas' then
 if exists(select 1 from operaciones_reserva_kit o where o.reserva_id=new.id and o.transaccion=pg_current_xact_id()
  and o.articulo_id=new.articulo_id and o.sala_id=new.sala_id and new.cantidad=1 and (
   (tg_op='INSERT' and o.operacion='reservar' and new.estado='activa' and new.quien=o.autor_nombre)
   or (tg_op='UPDATE' and o.operacion='liberar' and old.estado=o.estado_previo and old.estado='activa' and new.estado='liberada'
    and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])))) then return new; end if;
 end if;
 if tg_table_name='pedido_lineas' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-'cantidad_recibida')=(to_jsonb(old)-'cantidad_recibida') and exists(
   select 1 from recepcion_lineas d where d.pedido_linea_id=new.id and d.transaccion=pg_current_xact_id()
   and old.cantidad_recibida=d.recibido_previo and new.cantidad_recibida=d.recibido_previo+d.cantidad);
 elsif tg_table_name='movimientos' and tg_op='INSERT' then
  admitida=exists(select 1 from recepcion_lineas d join recepciones_compra t on t.id=d.recepcion_id
   where d.movimiento_id=new.id and d.transaccion=pg_current_xact_id() and new.tipo='entrada' and new.articulo_id=d.articulo_id
   and new.cantidad=d.cantidad and new.sala_id is not distinct from d.sala_id and new.ubicacion_id=d.ubicacion_id
   and new.pedido_linea_id=d.pedido_linea_id and new.recepcion_compra_id=d.recepcion_id and new.quien=t.receptor_nombre);
 elsif tg_table_name='pedidos' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])
   and new.estado=estado_recepcion_pedido(new.id) and exists(select 1 from recepciones_compra t
    join recepcion_lineas d on d.recepcion_id=t.id where t.pedido_id=new.id and d.transaccion=pg_current_xact_id());
 end if;
 if admitida then return new; end if;
 for fila in select value from jsonb_array_elements(case when tg_op='UPDATE' then jsonb_build_array(to_jsonb(old),to_jsonb(new)) else jsonb_build_array(to_jsonb(new)) end) loop
  sid=null;pid=null;
  if tg_table_name='movimientos' and fila->>'pedido_linea_id' is not null then
   perform exigir_movimiento_pedido_sin_kits((fila->>'pedido_linea_id')::uuid);
  end if;
  if tg_table_name in('movimientos','reservas','cargas','pedidos') then sid=(fila->>'sala_id')::uuid;
   if tg_table_name='pedidos' then pid=(fila->>'proyecto_id')::uuid; end if;
  elsif tg_table_name='carga_lineas' then select sala_id into sid from cargas where id=(fila->>'carga_id')::uuid;
  elsif tg_table_name='pedido_lineas' then select sala_id,proyecto_id into sid,pid from pedidos where id=(fila->>'pedido_id')::uuid;
  end if;
  perform exigir_logistica_sin_kits(sid,pid);
 end loop;
 return new;
end $$;
-- END RESERVA KITS B2B

-- BEGIN CARGA KITS B2C
-- Preparar una carga desde una reserva gestionada, marcar su unidad y
-- confirmar la salida desde una ubicación elegida expresamente. Cantidad 1.
-- Preparar no mueve stock ni sirve la reserva; marcar es "listo para cargar",
-- no salida; solo confirmar escribe el movimiento comercial y su atribución.
create table if not exists operaciones_carga_kit (
 id uuid primary key,
 operacion text not null check(operacion in('preparar','marcar','servir')),
 solicitud jsonb not null,
 transaccion xid8,
 reserva_id uuid references reservas(id) on delete restrict,
 suministro_id uuid references sala_suministros(id) on delete restrict,
 -- carga/línea/movimiento nacen en la misma TX: la FK restrictiva se aplaza al commit.
 carga_id uuid references cargas(id) on delete restrict deferrable initially deferred,
 linea_id uuid references carga_lineas(id) on delete restrict deferrable initially deferred,
 sala_id uuid references salas(id) on delete restrict,
 articulo_id uuid references articulos(id) on delete restrict,
 usuario_id uuid references usuarios(id) on delete restrict,
 autor_nombre text,
 cantidad numeric check(cantidad=1),
 marcado boolean, marcado_previo boolean,
 -- La procedencia histórica de la salida es restrictiva: no depende del SET NULL
 -- que movimientos.ubicacion_id aplica al borrar la ubicación.
 ubicacion_id uuid references ubicaciones(id) on delete restrict,
 movimiento_id uuid references movimientos(id) on delete restrict deferrable initially deferred,
 existencia_previa numeric, disponible_previo numeric,
 reutilizada boolean not null default false,
 orden bigint generated always as identity,
 creado_en timestamptz not null default now()
);
do $$ begin
 alter table operaciones_carga_kit drop constraint if exists operaciones_carga_kit_carga_id_fkey;
 alter table operaciones_carga_kit add constraint operaciones_carga_kit_carga_id_fkey foreign key(carga_id) references cargas(id) on delete restrict deferrable initially deferred;
 alter table operaciones_carga_kit drop constraint if exists operaciones_carga_kit_linea_id_fkey;
 alter table operaciones_carga_kit add constraint operaciones_carga_kit_linea_id_fkey foreign key(linea_id) references carga_lineas(id) on delete restrict deferrable initially deferred;
 alter table operaciones_carga_kit drop constraint if exists operaciones_carga_kit_movimiento_id_fkey;
 alter table operaciones_carga_kit add constraint operaciones_carga_kit_movimiento_id_fkey foreign key(movimiento_id) references movimientos(id) on delete restrict deferrable initially deferred;
end $$;
create unique index if not exists carga_kit_preparacion_reserva on operaciones_carga_kit(reserva_id) where operacion='preparar' and not reutilizada;
create unique index if not exists carga_kit_preparacion_carga on operaciones_carga_kit(carga_id) where operacion='preparar' and not reutilizada;
create unique index if not exists carga_kit_preparacion_linea on operaciones_carga_kit(linea_id) where operacion='preparar' and not reutilizada;
create unique index if not exists carga_kit_salida_reserva on operaciones_carga_kit(reserva_id) where operacion='servir';
create unique index if not exists carga_kit_salida_linea on operaciones_carga_kit(linea_id) where operacion='servir';
create unique index if not exists carga_kit_salida_carga on operaciones_carga_kit(carga_id) where operacion='servir';
create index if not exists carga_kit_linea_idx on operaciones_carga_kit(linea_id);
create index if not exists carga_kit_movimiento_idx on operaciones_carga_kit(movimiento_id);

create or replace function preparar_operacion_carga() returns trigger language plpgsql as $$
declare r reservas; s sala_suministros; c cargas; l carga_lineas; pid uuid; previa operaciones_carga_kit;
begin
 perform tomar_control_escritura_kit();
 if tg_op<>'INSERT' then raise exception 'Operacion de carga inmutable' using errcode='23514'; end if;
 if new.transaccion is not null or new.reserva_id is not null or new.suministro_id is not null
  or new.carga_id is not null or new.linea_id is not null or new.sala_id is not null
  or new.articulo_id is not null or new.usuario_id is not null or new.autor_nombre is not null
  or new.cantidad is not null or new.marcado is not null or new.marcado_previo is not null
  or new.ubicacion_id is not null or new.movimiento_id is not null
  or new.existencia_previa is not null or new.disponible_previo is not null or new.reutilizada then
  raise exception 'Baseline de carga impuesto por servidor' using errcode='23514'; end if;
 if jsonb_typeof(new.solicitud)<>'object' then raise exception 'Solicitud de carga incompatible' using errcode='23514'; end if;
 new.usuario_id=(new.solicitud->>'autorId')::uuid;
 select nombre into new.autor_nombre from usuarios where id=new.usuario_id and activo;
 if new.autor_nombre is null then raise exception 'La carga requiere usuario activo' using errcode='23514'; end if;
 new.transaccion=pg_current_xact_id(); new.cantidad=1;

 if new.operacion='preparar' then
  new.reserva_id=(new.solicitud->>'reservaId')::uuid;
 elsif new.operacion='marcar' then
  new.linea_id=(new.solicitud->>'lineaId')::uuid;
  if jsonb_typeof(new.solicitud->'valor')<>'boolean' then
   raise exception 'Marcar exige un valor explicito' using errcode='23514'; end if;
  new.marcado=(new.solicitud->>'valor')::boolean;
  select * into previa from operaciones_carga_kit where operacion='preparar' and not reutilizada and linea_id=new.linea_id;
  if not found then raise exception 'Solo se marca una linea de carga gestionada' using errcode='23514'; end if;
  new.reserva_id=previa.reserva_id; new.carga_id=previa.carga_id;
 else
  new.carga_id=(new.solicitud->>'cargaId')::uuid;
  new.ubicacion_id=(new.solicitud->>'ubicacionId')::uuid;
  select * into previa from operaciones_carga_kit where operacion='preparar' and not reutilizada and carga_id=new.carga_id;
  if not found then raise exception 'Solo se confirma una carga gestionada' using errcode='23514'; end if;
  new.reserva_id=previa.reserva_id; new.linea_id=previa.linea_id;
 end if;

 -- Identidad gestionada: se elige la reserva, nunca se infiere el suministro.
 select suministro_id into new.suministro_id from operaciones_reserva_kit where reserva_id=new.reserva_id and operacion='reservar';
 if not found then raise exception 'Solo se carga una reserva gestionada unitaria' using errcode='23514'; end if;
 select * into s from sala_suministros where id=new.suministro_id;
 if not found or s.estado<>'activo' then raise exception 'Suministro activo requerido' using errcode='23514'; end if;
 -- Mismo orden de locks que B2a/B2b: salas, proyecto, suministro, reserva.
 perform id from salas where id=s.sala_id for update;
 select loc.proyecto_id into pid from salas sa left join localizaciones loc on loc.id=sa.localizacion_id where sa.id=s.sala_id;
 perform id from proyectos where id=pid for update;
 if exists(select 1 from hitos_proyecto where proyecto_id=pid and tipo='cierre') then
  raise exception 'Proyecto cerrado' using errcode='23514'; end if;
 perform id from sala_suministros where id=s.id for update;
 new.sala_id=s.sala_id; new.articulo_id=s.articulo_id;
 select * into r from reservas where id=new.reserva_id for update;
 if r.estado<>'activa' or r.cantidad<>1 or r.articulo_id<>s.articulo_id or r.sala_id<>s.sala_id
  or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
  or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=s.id and cantidad=1) then
  raise exception 'La reserva gestionada no esta activa o no es unitaria' using errcode='23514'; end if;

 if new.operacion='preparar' then
  -- Máximo una preparación gestionada por reserva: otro token devuelve la suya.
  select * into previa from operaciones_carga_kit where operacion='preparar' and not reutilizada and reserva_id=new.reserva_id;
  if found then new.reutilizada=true; new.carga_id=previa.carga_id; new.linea_id=previa.linea_id;
  else new.carga_id=gen_random_uuid(); new.linea_id=gen_random_uuid(); end if;
  return new;
 end if;

 select * into c from cargas where id=new.carga_id for update;
 if c.estado<>'preparacion' then raise exception 'La carga ya no esta en preparacion' using errcode='23514'; end if;
 if c.sala_id<>new.sala_id then raise exception 'La carga no pertenece a la sala del suministro' using errcode='23514'; end if;
 select * into l from carga_lineas where id=new.linea_id for update;
 if l.carga_id<>new.carga_id or l.articulo_id<>new.articulo_id or l.reserva_id is distinct from new.reserva_id or l.cantidad<>1 then
  raise exception 'La linea de carga no coincide con la reserva gestionada' using errcode='23514'; end if;
 if exists(select 1 from operaciones_carga_kit where operacion='servir' and linea_id=new.linea_id) then
  raise exception 'La carga ya salio del almacen' using errcode='23514'; end if;

 if new.operacion='marcar' then new.marcado_previo=l.cargado; return new; end if;

 if not l.cargado then raise exception 'Marca la linea antes de confirmar la salida' using errcode='23514'; end if;
 -- «Ajena» es inexistente o distinta de la solicitud: no hay propiedad de
 -- almacén por sala. Cualquier ubicación existente con saldo local vale.
 if new.ubicacion_id is null then raise exception 'Elige la ubicacion de la que sale el material' using errcode='23514'; end if;
 perform id from ubicaciones where id=new.ubicacion_id for key share;
 if not found then raise exception 'Elige la ubicacion de la que sale el material' using errcode='23514'; end if;
 perform capturar_baseline_stock(s.articulo_id);
 new.disponible_previo=disponible_stock_kit(s.articulo_id);
 new.existencia_previa=coalesce((select cantidad from existencias where articulo_id=s.articulo_id and ubicacion_id=new.ubicacion_id),0);
 if new.existencia_previa<1 then raise exception 'No hay una unidad en esa ubicacion' using errcode='23514'; end if;
 new.movimiento_id=gen_random_uuid();
 return new;
end $$;
drop trigger if exists operacion_carga_preparar on operaciones_carga_kit;
create trigger operacion_carga_preparar before insert or update or delete on operaciones_carga_kit for each row execute function preparar_operacion_carga();

create or replace function materializar_operacion_carga() returns trigger language plpgsql as $$
declare nombre text;
begin
 if new.operacion='preparar' then
  if new.reutilizada then return null; end if;
  select 'Carga · '||sa.nombre into nombre from salas sa where sa.id=new.sala_id;
  insert into cargas(id,sala_id,nombre,estado,quien) values(new.carga_id,new.sala_id,nombre,'preparacion',new.autor_nombre);
  insert into carga_lineas(id,carga_id,articulo_id,reserva_id,cantidad,cargado)
   values(new.linea_id,new.carga_id,new.articulo_id,new.reserva_id,1,false);
 elsif new.operacion='marcar' then
  if new.marcado is distinct from new.marcado_previo then
   update carga_lineas set cargado=new.marcado where id=new.linea_id; end if;
 else
  update reservas set estado='servida' where id=new.reserva_id;
  insert into movimientos(id,articulo_id,ubicacion_id,tipo,cantidad,sala_id,motivo,quien)
   values(new.movimiento_id,new.articulo_id,new.ubicacion_id,'salida',1,new.sala_id,'Carga de kit a obra',new.autor_nombre);
  insert into movimiento_suministros(movimiento_id,suministro_id,cantidad) values(new.movimiento_id,new.suministro_id,1);
  update cargas set estado='cargada' where id=new.carga_id;
  if coalesce((select cantidad from existencias where articulo_id=new.articulo_id and ubicacion_id=new.ubicacion_id),0)
    <>new.existencia_previa-1 or disponible_stock_kit(new.articulo_id)<>new.disponible_previo then
   raise exception 'Saldo posterior a la salida incompatible' using errcode='23514'; end if;
 end if;return null;
end $$;
drop trigger if exists operacion_carga_materializar on operaciones_carga_kit;
create trigger operacion_carga_materializar after insert on operaciones_carga_kit for each row execute function materializar_operacion_carga();

create or replace function comprobar_operacion_carga(o operaciones_carga_kit) returns void language plpgsql as $$
declare c cargas; l carga_lineas; r reservas; base operaciones_carga_kit; salida operaciones_carga_kit; ultimo boolean;
begin
 select * into c from cargas where id=o.carga_id;
 select * into l from carga_lineas where id=o.linea_id;
 select * into r from reservas where id=o.reserva_id;
 if c.id is null or l.id is null or r.id is null then raise exception 'Operacion de carga incompleta' using errcode='23514'; end if;
 select * into base from operaciones_carga_kit where operacion='preparar' and not reutilizada and carga_id=o.carga_id;
 if base.id is null or base.linea_id<>o.linea_id or base.reserva_id<>o.reserva_id or base.suministro_id<>o.suministro_id
  or base.sala_id<>o.sala_id or base.articulo_id<>o.articulo_id or o.cantidad<>1
  or (select count(*) from operaciones_carga_kit where operacion='preparar' and not reutilizada and reserva_id=o.reserva_id)<>1
  or c.sala_id<>o.sala_id or c.quien is distinct from base.autor_nombre
  or l.carga_id<>o.carga_id or l.articulo_id<>o.articulo_id or l.reserva_id is distinct from o.reserva_id or l.cantidad<>1
  or (select count(*) from carga_lineas where carga_id=c.id)<>1
  or r.cantidad<>1 or r.articulo_id<>o.articulo_id or r.sala_id<>o.sala_id
  or (select count(*) from reserva_suministros where reserva_id=r.id and suministro_id=o.suministro_id and cantidad=1)<>1 then
  raise exception 'Operacion de carga incompleta' using errcode='23514'; end if;
 -- El marcado final responde a la última transición válida, no a una intermedia.
 select marcado into ultimo from operaciones_carga_kit where operacion='marcar' and linea_id=o.linea_id order by orden desc limit 1;
 if l.cargado<>coalesce(ultimo,false) then
  raise exception 'Marcado final incoherente con el ultimo hecho' using errcode='23514'; end if;
 select * into salida from operaciones_carga_kit where operacion='servir' and carga_id=o.carga_id;
 if salida.id is null then
  if c.estado<>'preparacion' or r.estado<>'activa' then
   raise exception 'Estado de carga sin salida confirmada' using errcode='23514'; end if;
  return;
 end if;
 if c.estado<>'cargada' or r.estado<>'servida' or not l.cargado
  or (select count(*) from operaciones_carga_kit where operacion='servir' and reserva_id=o.reserva_id)<>1
  or salida.movimiento_id is null or salida.ubicacion_id is null
  or not exists(select 1 from movimientos m where m.id=salida.movimiento_id and m.tipo='salida' and m.cantidad=1
    and m.articulo_id=salida.articulo_id and m.ubicacion_id=salida.ubicacion_id and m.sala_id=salida.sala_id
    and m.quien=salida.autor_nombre and m.pedido_linea_id is null and m.recepcion_compra_id is null)
  or not exists(select 1 from movimiento_suministros a where a.movimiento_id=salida.movimiento_id
    and a.suministro_id=salida.suministro_id and a.cantidad=1 and a.salida_movimiento_id is null) then
  raise exception 'Salida de carga incompleta' using errcode='23514'; end if;
end $$;
create or replace function validar_operacion_carga() returns trigger language plpgsql as $$
declare o operaciones_carga_kit;
begin
 for o in select * from operaciones_carga_kit where transaccion=pg_current_xact_id() order by orden loop
  perform comprobar_operacion_carga(o);
 end loop;return null;
end $$;

-- Inversas: cabecera y línea gestionadas no cambian ni desaparecen dejando
-- un hecho falso. Cargas históricas sin enlace conservan su comportamiento.
create or replace function proteger_carga_gestionada() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op='INSERT' then return new; end if;
 if tg_table_name='cargas' then
  if exists(select 1 from operaciones_carga_kit where carga_id=old.id) then
   if tg_op='DELETE' then raise exception 'Carga gestionada conserva historial' using errcode='23514'; end if;
   if not exists(select 1 from operaciones_carga_kit o where o.carga_id=old.id and o.operacion='servir'
     and o.transaccion=pg_current_xact_id() and old.estado='preparacion' and new.estado='cargada'
     and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])) then
    raise exception 'Transicion de carga sin hecho actual exacto' using errcode='23514'; end if;
  end if;
 else
  if exists(select 1 from operaciones_carga_kit where linea_id=old.id) then
   if tg_op='DELETE' then raise exception 'Linea de carga gestionada conserva historial' using errcode='23514'; end if;
   if not exists(select 1 from operaciones_carga_kit o where o.linea_id=old.id and o.operacion='marcar'
     and o.transaccion=pg_current_xact_id() and o.marcado_previo=old.cargado and o.marcado=new.cargado
     and (to_jsonb(new)-'cargado')=(to_jsonb(old)-'cargado')) then
    raise exception 'Marcado de carga sin hecho actual exacto' using errcode='23514'; end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists carga_gestionada_proteger on cargas;
create trigger carga_gestionada_proteger before insert or update or delete on cargas for each row execute function proteger_carga_gestionada();
drop trigger if exists carga_gestionada_proteger on carga_lineas;
create trigger carga_gestionada_proteger before insert or update or delete on carga_lineas for each row execute function proteger_carga_gestionada();

create or replace function proteger_efecto_carga() returns trigger language plpgsql as $$
begin
 if tg_table_name='movimientos' then
  if tg_op<>'INSERT' and exists(select 1 from operaciones_carga_kit where movimiento_id=old.id) then
   raise exception 'Movimiento de carga gestionada inmutable' using errcode='23514'; end if;
 else
  if tg_op<>'INSERT' and exists(select 1 from operaciones_carga_kit where movimiento_id=old.movimiento_id) then
   raise exception 'Atribucion de carga gestionada inmutable' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
drop trigger if exists carga_efecto_proteger on movimientos;
create trigger carga_efecto_proteger before update or delete on movimientos for each row execute function proteger_efecto_carga();
drop trigger if exists carga_efecto_proteger on movimiento_suministros;
create trigger carga_efecto_proteger before update or delete on movimiento_suministros for each row execute function proteger_efecto_carga();

-- La reserva gestionada admite ahora dos salidas exactas: liberada por B2b y
-- servida por el hecho B2c de esta misma transacción. Nada más.
create or replace function proteger_reserva_gestionada() returns trigger language plpgsql as $$
begin
 perform tomar_control_escritura_kit();
 if tg_op='INSERT' then return new; end if;
 if exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='reservar') then
  if tg_op='DELETE' then raise exception 'Reserva gestionada conserva historial' using errcode='23514'; end if;
  if old.estado<>'activa'
   or (to_jsonb(new)-array['estado','actualizado_en']) is distinct from (to_jsonb(old)-array['estado','actualizado_en'])
   or not((new.estado='liberada' and exists(select 1 from operaciones_reserva_kit where reserva_id=old.id and operacion='liberar'
      and transaccion=pg_current_xact_id() and estado_previo=old.estado))
    or (new.estado='servida' and exists(select 1 from operaciones_carga_kit where reserva_id=old.id and operacion='servir'
      and transaccion=pg_current_xact_id()))) then
   raise exception 'Transicion de reserva sin hecho actual exacto' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;

-- El estado esperado de una reserva gestionada servida es 'servida', también
-- cuando reservar y servir ocurren en la misma transacción.
create or replace function validar_operacion_reserva() returns trigger language plpgsql as $$
declare o operaciones_reserva_kit; r reservas; ultimo text;
begin
 for o in select * from operaciones_reserva_kit where transaccion=pg_current_xact_id() loop
  select * into r from reservas where id=o.reserva_id;
  if exists(select 1 from operaciones_carga_kit c where c.reserva_id=o.reserva_id and c.operacion='servir') then ultimo='servida';
  else select case operacion when 'reservar' then 'activa' else 'liberada' end into ultimo
   from operaciones_reserva_kit where reserva_id=o.reserva_id order by orden desc limit 1; end if;
  if r.id is null or r.cantidad<>1 or r.articulo_id<>o.articulo_id or r.sala_id<>o.sala_id or r.estado<>ultimo
   or (select count(*) from reserva_suministros where reserva_id=r.id)<>1
   or not exists(select 1 from reserva_suministros where reserva_id=r.id and suministro_id=o.suministro_id and cantidad=1) then
   raise exception 'Operacion de reserva incompleta' using errcode='23514'; end if;
 end loop;return null;
end $$;

do $$ declare tabla text; begin
 foreach tabla in array array['operaciones_carga_kit','cargas','carga_lineas','reservas','movimientos','movimiento_suministros'] loop
  execute format('drop trigger if exists carga_operacion_completa on %I',tabla);
  execute format('create constraint trigger carga_operacion_completa after insert or update on %I deferrable initially deferred for each row execute function validar_operacion_carga()',tabla);
 end loop;
 foreach tabla in array array['operaciones_carga_kit'] loop
  execute format('drop trigger if exists aa_control_statement on %I',tabla);
  execute format('create trigger aa_control_statement before insert or update or delete on %I for each statement execute function entrar_escritura_kit()',tabla);
  execute format('drop trigger if exists aa_control_fila on %I',tabla);
  execute format('create trigger aa_control_fila before insert or update or delete on %I for each row execute function entrar_escritura_kit()',tabla);
 end loop;
end $$;

-- Extiende B2a/B2b con los efectos exactos de la carga gestionada. Ninguna
-- carga histórica sin enlace ni formulario genérico de kits se desbloquea.
create or replace function proteger_logistica_kit() returns trigger language plpgsql as $$
declare fila jsonb; sid uuid; pid uuid; admitida boolean=false;
begin
 if tg_table_name='reservas' then
  if exists(select 1 from operaciones_reserva_kit o where o.reserva_id=new.id and o.transaccion=pg_current_xact_id()
   and o.articulo_id=new.articulo_id and o.sala_id=new.sala_id and new.cantidad=1 and (
    (tg_op='INSERT' and o.operacion='reservar' and new.estado='activa' and new.quien=o.autor_nombre)
    or (tg_op='UPDATE' and o.operacion='liberar' and old.estado=o.estado_previo and old.estado='activa' and new.estado='liberada'
     and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])))) then return new; end if;
  if tg_op='UPDATE' then
   if exists(select 1 from operaciones_carga_kit o where o.reserva_id=new.id and o.operacion='servir'
    and o.transaccion=pg_current_xact_id() and o.articulo_id=new.articulo_id and o.sala_id=new.sala_id
    and new.cantidad=1 and old.estado='activa' and new.estado='servida'
    and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])) then return new; end if;
  end if;
 elsif tg_table_name='cargas' then
  if tg_op='INSERT' then
   if exists(select 1 from operaciones_carga_kit o where o.carga_id=new.id and o.operacion='preparar' and not o.reutilizada
    and o.transaccion=pg_current_xact_id() and o.sala_id=new.sala_id and new.estado='preparacion'
    and new.quien=o.autor_nombre) then return new; end if;
  else
   if exists(select 1 from operaciones_carga_kit o where o.carga_id=new.id and o.operacion='servir'
    and o.transaccion=pg_current_xact_id() and old.estado='preparacion' and new.estado='cargada'
    and (to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])) then return new; end if;
  end if;
 elsif tg_table_name='carga_lineas' then
  if tg_op='INSERT' then
   if exists(select 1 from operaciones_carga_kit o where o.linea_id=new.id and o.operacion='preparar' and not o.reutilizada
    and o.transaccion=pg_current_xact_id() and o.carga_id=new.carga_id and o.articulo_id=new.articulo_id
    and o.reserva_id=new.reserva_id and new.cantidad=1 and new.cargado=false) then return new; end if;
  else
   if exists(select 1 from operaciones_carga_kit o where o.linea_id=new.id and o.operacion='marcar'
    and o.transaccion=pg_current_xact_id() and o.marcado_previo=old.cargado and o.marcado=new.cargado
    and (to_jsonb(new)-'cargado')=(to_jsonb(old)-'cargado')) then return new; end if;
  end if;
 end if;
 if tg_table_name='pedido_lineas' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-'cantidad_recibida')=(to_jsonb(old)-'cantidad_recibida') and exists(
   select 1 from recepcion_lineas d where d.pedido_linea_id=new.id and d.transaccion=pg_current_xact_id()
   and old.cantidad_recibida=d.recibido_previo and new.cantidad_recibida=d.recibido_previo+d.cantidad);
 elsif tg_table_name='movimientos' and tg_op='INSERT' then
  admitida=exists(select 1 from recepcion_lineas d join recepciones_compra t on t.id=d.recepcion_id
   where d.movimiento_id=new.id and d.transaccion=pg_current_xact_id() and new.tipo='entrada' and new.articulo_id=d.articulo_id
   and new.cantidad=d.cantidad and new.sala_id is not distinct from d.sala_id and new.ubicacion_id=d.ubicacion_id
   and new.pedido_linea_id=d.pedido_linea_id and new.recepcion_compra_id=d.recepcion_id and new.quien=t.receptor_nombre)
   or exists(select 1 from operaciones_carga_kit o where o.movimiento_id=new.id and o.operacion='servir'
    and o.transaccion=pg_current_xact_id() and new.tipo='salida' and new.articulo_id=o.articulo_id and new.cantidad=1
    and new.sala_id=o.sala_id and new.ubicacion_id=o.ubicacion_id and new.quien=o.autor_nombre
    and new.pedido_linea_id is null and new.recepcion_compra_id is null);
 elsif tg_table_name='pedidos' and tg_op='UPDATE' then
  admitida=(to_jsonb(new)-array['estado','actualizado_en'])=(to_jsonb(old)-array['estado','actualizado_en'])
   and new.estado=estado_recepcion_pedido(new.id) and exists(select 1 from recepciones_compra t
    join recepcion_lineas d on d.recepcion_id=t.id where t.pedido_id=new.id and d.transaccion=pg_current_xact_id());
 end if;
 if admitida then return new; end if;
 for fila in select value from jsonb_array_elements(case when tg_op='UPDATE' then jsonb_build_array(to_jsonb(old),to_jsonb(new)) else jsonb_build_array(to_jsonb(new)) end) loop
  sid=null;pid=null;
  if tg_table_name='movimientos' and fila->>'pedido_linea_id' is not null then
   perform exigir_movimiento_pedido_sin_kits((fila->>'pedido_linea_id')::uuid);
  end if;
  if tg_table_name in('movimientos','reservas','cargas','pedidos') then sid=(fila->>'sala_id')::uuid;
   if tg_table_name='pedidos' then pid=(fila->>'proyecto_id')::uuid; end if;
  elsif tg_table_name='carga_lineas' then select sala_id into sid from cargas where id=(fila->>'carga_id')::uuid;
  elsif tg_table_name='pedido_lineas' then select sala_id,proyecto_id into sid,pid from pedidos where id=(fila->>'pedido_id')::uuid;
  end if;
  perform exigir_logistica_sin_kits(sid,pid);
 end loop;
 return new;
end $$;
-- END CARGA KITS B2C



-- BEGIN ETIQUETAS CABLE GENERADAS
-- Generado por scripts/generar-etiquetas-cable.mjs desde src/lib/tipos.ts.
begin;
lock table conexiones in access exclusive mode;
create table if not exists configuracion_series_cable (
  senal senal primary key, prefijo text not null unique,
  primer_correlativo bigint not null check (primer_correlativo > 0)
);
insert into configuracion_series_cable values
('hdmi', 'HD', 1000),
('red', 'RED', 1000),
('usb', 'USB', 1000),
('audio_linea', 'AUD', 1000),
('audio_altavoz', 'ALT', 1000),
('microfono', 'MIC', 1000),
('alimentacion', 'PWR', 1000),
('control', 'RS', 1000),
('otro', 'CBL', 1000)
on conflict (senal) do nothing;
-- Una constante cambiada requiere una migración explícita, no sobrescribir historia.
do $$ begin
  if exists (select senal::text,prefijo,primer_correlativo from configuracion_series_cable
    except select * from (values ('hdmi', 'HD', 1000),
('red', 'RED', 1000),
('usb', 'USB', 1000),
('audio_linea', 'AUD', 1000),
('audio_altavoz', 'ALT', 1000),
('microfono', 'MIC', 1000),
('alimentacion', 'PWR', 1000),
('control', 'RS', 1000),
('otro', 'CBL', 1000)) v(senal,prefijo,primer_correlativo))
    or exists (select * from (values ('hdmi', 'HD', 1000),
('red', 'RED', 1000),
('usb', 'USB', 1000),
('audio_linea', 'AUD', 1000),
('audio_altavoz', 'ALT', 1000),
('microfono', 'MIC', 1000),
('alimentacion', 'PWR', 1000),
('control', 'RS', 1000),
('otro', 'CBL', 1000)) v(senal,prefijo,primer_correlativo)
    except select senal::text,prefijo,primer_correlativo from configuracion_series_cable) then
    raise exception 'Configuración de series divergente: requiere migración explícita';
  end if;
end $$;
create table if not exists series_cable_sala (
  sala_id uuid not null references salas on delete cascade,
  senal senal not null references configuracion_series_cable,
  siguiente bigint not null check (siguiente > 0), primary key(sala_id,senal)
);
alter table conexiones add column if not exists etiqueta_cable text;
alter table conexiones add column if not exists serie_cable senal;
alter table conexiones add column if not exists correlativo_cable bigint;
do $$ declare ids text; begin
  select string_agg(id::text, ', ') into ids from conexiones
    where not isfinite(creado_en) or creado_en < timestamptz '0001-01-01 00:00:00+00'
      or creado_en >= timestamptz '10000-01-01 00:00:00+00';
  if ids is not null then raise exception 'Fechas fuera del contrato histórico: %', ids; end if;
  if exists(select 1 from conexiones where (etiqueta_cable is null)::int + (serie_cable is null)::int + (correlativo_cable is null)::int not in (0,3))
    or (exists(select 1 from conexiones where etiqueta_cable is null) and exists(select 1 from conexiones where etiqueta_cable is not null))
  then raise exception 'Etiquetas históricas mezcladas: requiere reconciliación explícita'; end if;
  if exists(select 1 from conexiones c left join configuracion_series_cable p on p.senal=c.serie_cable
    where c.etiqueta_cable is not null and (p.senal is null or c.correlativo_cable < p.primer_correlativo
      or c.etiqueta_cable <> p.prefijo || '-' || c.correlativo_cable))
  then raise exception 'Etiqueta persistida incoherente: requiere reconciliación explícita'; end if;
end $$;
with numeradas as (
  select c.id, c.senal, p.prefijo,
    p.primer_correlativo - 1 + row_number() over(partition by c.sala_id,c.senal order by date_trunc('milliseconds',c.creado_en), c.id::text collate "C") numero
  from conexiones c join configuracion_series_cable p on p.senal=c.senal
  where c.etiqueta_cable is null
)
update conexiones c set etiqueta_cable=n.prefijo || '-' || n.numero, serie_cable=n.senal, correlativo_cable=n.numero
from numeradas n where n.id=c.id;
insert into series_cable_sala(sala_id,senal,siguiente)
select sala_id,serie_cable,max(correlativo_cable)+1 from conexiones group by sala_id,serie_cable
on conflict(sala_id,senal) do update set siguiente=greatest(series_cable_sala.siguiente,excluded.siguiente);
alter table conexiones alter column etiqueta_cable set not null;
alter table conexiones alter column serie_cable set not null;
alter table conexiones alter column correlativo_cable set not null;
create unique index if not exists conexiones_etiqueta_unica on conexiones(sala_id,etiqueta_cable);
create unique index if not exists conexiones_serie_numero_unico on conexiones(sala_id,serie_cable,correlativo_cable);
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='conexiones'::regclass and conname='conexiones_correlativo_positivo') then
  alter table conexiones add constraint conexiones_correlativo_positivo check(correlativo_cable > 0);
 end if;
end $$;
create or replace function asignar_etiqueta_cable() returns trigger language plpgsql as $$
declare pref text; primero bigint; numero bigint;
begin
 if tg_op='UPDATE' then
  if new.etiqueta_cable is distinct from old.etiqueta_cable or new.serie_cable is distinct from old.serie_cable
    or new.correlativo_cable is distinct from old.correlativo_cable or new.sala_id is distinct from old.sala_id
    or new.id is distinct from old.id then
   raise exception 'La identidad y sala de un cable son inmutables' using errcode='23514';
  end if;
  return new;
 end if;
 if new.etiqueta_cable is not null or new.serie_cable is not null or new.correlativo_cable is not null then
  raise exception 'La etiqueta del cable la asigna el servidor' using errcode='23514';
 end if;
 select prefijo,primer_correlativo into strict pref,primero from configuracion_series_cable where senal=new.senal;
 insert into series_cable_sala(sala_id,senal,siguiente) values(new.sala_id,new.senal,primero+1)
 on conflict(sala_id,senal) do update set siguiente=series_cable_sala.siguiente+1
 returning siguiente-1 into numero;
 new.serie_cable=new.senal; new.correlativo_cable=numero; new.etiqueta_cable=pref || '-' || numero;
 return new;
end $$;
drop trigger if exists conexiones_asignar_etiqueta on conexiones;
create trigger conexiones_asignar_etiqueta before insert or update on conexiones for each row execute function asignar_etiqueta_cable();
commit;
-- END ETIQUETAS CABLE GENERADAS

begin;
-- BEGIN REVISION DISENO L5
alter table prueba_final_sala add column if not exists revision_diseno integer;
alter table prueba_final_sala drop constraint if exists prueba_final_revision_valida;
alter table prueba_final_sala add constraint prueba_final_revision_valida
  check (revision_diseno is null or (revision_diseno >= 0 and fecha is not null));
alter table hitos_sala add column if not exists revision_diseno integer;
alter table hitos_sala drop constraint if exists hitos_sala_revision_valida;
alter table hitos_sala add constraint hitos_sala_revision_valida
  check (revision_diseno is null or revision_diseno >= 0);
comment on column prueba_final_sala.revision_diseno is
  'salas.diagrama_version al finalizar la prueba. Nulo = revision desconocida, nunca vigente.';
comment on column hitos_sala.revision_diseno is
  'salas.diagrama_version al registrar el hito. Nulo = revision desconocida, nunca vigente.';
-- END REVISION DISENO L5
commit;

-- BEGIN CABLES SUMINISTRADOS L3C
-- Una fila por latiguillo físico. No sustituye conexiones ni longitud_manual_m.
create unique index if not exists sala_suministros_id_sala on sala_suministros(id,sala_id);
create unique index if not exists conexiones_id_sala on conexiones(id,sala_id);

create table if not exists sala_cables_suministrados (
 id uuid primary key default gen_random_uuid(),
 suministro_id uuid not null,
 sala_id uuid not null,
 linea_id uuid references articulo_composicion_lineas(id) on delete restrict,
 ordinal integer not null check(ordinal>=1),
 tipo text not null check(tipo in ('libre','unido')),
 propietario_equipo_id uuid,
 puerto_fijo_id uuid,
 ordinal_fijo integer,
 articulo_cable_id uuid references articulos(id) on delete restrict,
 longitud_utilizable_m numeric,
 snapshot jsonb not null,
 creado_en timestamptz not null default now(),
 unique(id,sala_id),
 foreign key(suministro_id,sala_id) references sala_suministros(id,sala_id) on delete restrict,
 foreign key(propietario_equipo_id,sala_id) references sala_equipos(id,sala_id) on delete restrict,
 constraint cable_longitud_positiva check((longitud_utilizable_m is null) or (longitud_utilizable_m>0)),
 constraint cable_tipo_extremos check((tipo='unido' and propietario_equipo_id is not null and puerto_fijo_id is not null and ordinal_fijo is not null)
    or (tipo='libre' and propietario_equipo_id is null and puerto_fijo_id is null and ordinal_fijo is null))
);
create unique index if not exists sala_cables_suministrados_linea_ordinal
 on sala_cables_suministrados(suministro_id,linea_id,ordinal) where linea_id is not null;

alter table conexiones add column if not exists estado_suministro text;
alter table conexiones add column if not exists cable_suministrado_id uuid;
alter table conexiones add column if not exists decision_heredada boolean;
alter table plantilla_conexiones add column if not exists estado_suministro text;
alter table plantilla_conexiones add column if not exists decision_heredada boolean;

update conexiones set estado_suministro='adicional', decision_heredada=true, cable_suministrado_id=null
 where estado_suministro is null;
update plantilla_conexiones set estado_suministro='adicional', decision_heredada=true
 where estado_suministro is null;
-- El UPDATE dispara triggers de etiqueta; ALTER NOT NULL exige transacción nueva.
commit;
begin;

create or replace function normalizar_estado_suministro_conexion() returns trigger language plpgsql as $$
begin
 if tg_op='INSERT' then
  if new.estado_suministro is null then new.estado_suministro='por_determinar'; end if;
  if new.decision_heredada is null then new.decision_heredada=false; end if;
 end if;
 if tg_table_name='conexiones' and tg_op='DELETE' then
  if old.estado_suministro='incluido' or old.cable_suministrado_id is not null then
   raise exception 'Desasigna el cable incluido antes de borrar la conexion' using errcode='23514';
  end if;
  return old;
 end if;
 if new.decision_heredada and new.estado_suministro is distinct from 'adicional' then
  raise exception 'decision_heredada solo aplica a adicional' using errcode='23514';
 end if;
 if tg_table_name='plantilla_conexiones' and new.estado_suministro not in ('adicional','por_determinar') then
  raise exception 'La plantilla no admite cable incluido' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists conexiones_normalizar_estado_suministro on conexiones;
create trigger conexiones_normalizar_estado_suministro before insert or update or delete on conexiones
 for each row execute function normalizar_estado_suministro_conexion();
drop trigger if exists plantilla_conexiones_normalizar_estado_suministro on plantilla_conexiones;
create trigger plantilla_conexiones_normalizar_estado_suministro before insert or update on plantilla_conexiones
 for each row execute function normalizar_estado_suministro_conexion();

alter table conexiones alter column estado_suministro set not null;
alter table conexiones alter column decision_heredada set not null;
alter table plantilla_conexiones alter column estado_suministro set not null;
alter table plantilla_conexiones alter column decision_heredada set not null;

alter table conexiones drop constraint if exists conexiones_estado_suministro_fk;
alter table conexiones add constraint conexiones_estado_suministro_fk check(
 (estado_suministro='incluido' and cable_suministrado_id is not null)
 or (estado_suministro in ('adicional','por_determinar') and cable_suministrado_id is null));
alter table conexiones drop constraint if exists conexiones_decision_heredada;
alter table conexiones add constraint conexiones_decision_heredada check(not decision_heredada or estado_suministro='adicional');
alter table plantilla_conexiones drop constraint if exists plantilla_conexiones_estado_suministro;
alter table plantilla_conexiones add constraint plantilla_conexiones_estado_suministro check(estado_suministro in ('adicional','por_determinar'));
alter table plantilla_conexiones drop constraint if exists plantilla_conexiones_decision_heredada;
alter table plantilla_conexiones add constraint plantilla_conexiones_decision_heredada check(not decision_heredada or estado_suministro='adicional');

create unique index if not exists conexiones_cable_suministrado_unico on conexiones(cable_suministrado_id) where cable_suministrado_id is not null;
do $$ begin
 alter table conexiones drop constraint if exists conexiones_cable_sala_fk;
 alter table conexiones add constraint conexiones_cable_sala_fk
  foreign key(cable_suministrado_id,sala_id) references sala_cables_suministrados(id,sala_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create or replace function proteger_cable_suministrado() returns trigger language plpgsql as $$
declare s sala_suministros; e sala_equipos; p puertos; l articulo_composicion_lineas;
begin
 if tg_op='DELETE' then
  raise exception 'No se borra un cable suministrado' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
  raise exception 'El cable suministrado es inmutable' using errcode='23514';
 end if;
 perform 1 from salas where id=new.sala_id for update;
 select * into s from sala_suministros where id=new.suministro_id for update;
 if not found or s.sala_id is distinct from new.sala_id then
  raise exception 'El cable exige suministro de la misma sala' using errcode='23514';
 end if;
 if new.linea_id is not null then
  select * into l from articulo_composicion_lineas where id=new.linea_id;
  if not found or l.composicion_id is distinct from s.composicion_id or l.inclusion is distinct from 'incluido' then
   raise exception 'La linea de cable no pertenece a la composicion congelada' using errcode='23514';
  end if;
 end if;
 if new.tipo='unido' then
  if new.propietario_equipo_id is null or new.puerto_fijo_id is null or new.ordinal_fijo is null then
   raise exception 'Unido exige propietario, puerto y ordinal' using errcode='23514'; end if;
  select * into e from sala_equipos where id=new.propietario_equipo_id for update;
  if not found or e.sala_id is distinct from new.sala_id then
   raise exception 'El propietario del cable unido es ajeno a la sala' using errcode='23514';
  end if;
  if not exists(select 1 from sala_componentes_suministro c
   where c.equipo_id=new.propietario_equipo_id and c.suministro_id=new.suministro_id and c.sala_id=new.sala_id) then
   raise exception 'El propietario del cable unido no pertenece a este suministro' using errcode='23514';
  end if;
  select * into p from puertos where id=new.puerto_fijo_id for update;
  if not found or p.articulo_id is distinct from e.articulo_id then
   raise exception 'El puerto fijo es ajeno al articulo del propietario' using errcode='23514';
  end if;
  if new.ordinal_fijo<1 or new.ordinal_fijo>p.total then
   raise exception 'El ordinal fijo esta fuera de la capacidad del puerto' using errcode='23514';
  end if;
 elsif new.propietario_equipo_id is not null or new.puerto_fijo_id is not null or new.ordinal_fijo is not null then
  raise exception 'Un cable libre exige extremos nulos' using errcode='23514';
 end if;
 if jsonb_typeof(new.snapshot) is distinct from 'object' then
  raise exception 'El snapshot del cable es obligatorio' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists sala_cables_suministrados_proteger on sala_cables_suministrados;
create trigger sala_cables_suministrados_proteger before insert or update or delete on sala_cables_suministrados
 for each row execute function proteger_cable_suministrado();

create or replace function comprobar_cable_unido_en_conexion() returns trigger language plpgsql as $$
declare cid uuid; c conexiones; k sala_cables_suministrados;
begin
 if tg_table_name='conexiones' then
  if tg_op='DELETE' then return null; end if;
  cid=new.id; c=new;
 else
  cid=coalesce(new.conexion_id,old.conexion_id);
  select * into c from conexiones where id=cid;
  if not found then return null; end if;
 end if;
 if c.estado_suministro is distinct from 'incluido' or c.cable_suministrado_id is null then return null; end if;
 perform 1 from conexiones where id=c.id for update;
 select * into k from sala_cables_suministrados where id=c.cable_suministrado_id for update;
 if not found or k.sala_id is distinct from c.sala_id then
  raise exception 'incluido exige cable suministrado' using errcode='23514';
 end if;
 if k.tipo='unido' and not exists(
  select 1 from conexion_bocas b
   where b.conexion_id=c.id
     and b.equipo_id=k.propietario_equipo_id
     and b.puerto_id=k.puerto_fijo_id
     and b.ordinal=k.ordinal_fijo) then
  raise exception 'el cable unido exige el extremo fijo en la conexion' using errcode='23514';
 end if;
 return null;
end $$;
drop trigger if exists conexiones_cable_unido on conexiones;
create constraint trigger conexiones_cable_unido after insert or update on conexiones
 deferrable initially deferred for each row execute function comprobar_cable_unido_en_conexion();
drop trigger if exists conexion_bocas_cable_unido on conexion_bocas;
create constraint trigger conexion_bocas_cable_unido after insert or update or delete on conexion_bocas
 deferrable initially deferred for each row execute function comprobar_cable_unido_en_conexion();

create or replace function proteger_composicion_kit() returns trigger language plpgsql as $$
declare c articulo_composiciones;
begin
 perform pg_advisory_xact_lock(hashtextextended('av_design:composiciones',0));
 if tg_table_name='articulo_composiciones' then
  if tg_op<>'INSERT' and old.publicada then
   if tg_op='DELETE' or new is distinct from old then
    raise exception 'Composicion publicada inmutable: cree otra version' using errcode='23514';
   end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if exists(select 1 from articulo_composicion_lineas l
   join articulo_composiciones c2 on c2.id=l.composicion_id
   where l.articulo_componente_id=new.articulo_kit_id and c2.articulo_kit_id is distinct from new.articulo_kit_id) then
   raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
  if not exists(select 1 from articulos where id=new.articulo_kit_id and tipo='equipo' and unidad='ud') then
   raise exception 'El kit exige un articulo de equipo por unidad' using errcode='23514'; end if;
  if new.publicada and not exists(select 1 from articulo_composicion_lineas where composicion_id=new.id) then
   raise exception 'Una composicion publicada exige lineas' using errcode='23514'; end if;
  if new.publicada and new.estado_documental='documentada' and exists(select 1 from articulo_composicion_lineas
   where composicion_id=new.id and (inclusion='por_determinar'
    or (inclusion='incluido' and articulo_componente_id is null and rol is distinct from 'cable'))) then
   raise exception 'La composicion contiene pendientes: debe ser parcial' using errcode='23514'; end if;
  return new;
 end if;
 select * into c from articulo_composiciones where id=case when tg_op='DELETE' then old.composicion_id else new.composicion_id end for update;
 if c.publicada or (tg_op='UPDATE' and exists(select 1 from articulo_composiciones where id=old.composicion_id and publicada)) then
  raise exception 'Las lineas publicadas son inmutables' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.articulo_componente_id is not null and new.articulo_componente_id is distinct from c.articulo_kit_id
  and exists(select 1 from articulo_composiciones k where k.articulo_kit_id=new.articulo_componente_id) then
  raise exception 'No se admiten kits anidados' using errcode='23514'; end if;
 if new.articulo_componente_id=c.articulo_kit_id then
  if new.cantidad is distinct from 1 or new.inclusion is distinct from 'incluido' then
   raise exception 'La unidad simple exige cuerpo cantidad 1 incluido' using errcode='23514'; end if;
  if exists(select 1 from articulo_composicion_lineas l
   where l.composicion_id=c.id and l.id is distinct from new.id and l.articulo_componente_id is not null
     and l.articulo_componente_id is distinct from c.articulo_kit_id) then
   raise exception 'La unidad simple no mezcla el cuerpo con otras piezas de equipo' using errcode='23514'; end if;
 elsif new.articulo_componente_id is not null and exists(select 1 from articulo_composicion_lineas l
  where l.composicion_id=c.id and l.articulo_componente_id=c.articulo_kit_id) then
  raise exception 'La unidad simple no mezcla el cuerpo con otras piezas de equipo' using errcode='23514';
 end if;
 if new.articulo_componente_id is not null and not exists(select 1 from articulos where id=new.articulo_componente_id and tipo='equipo' and unidad='ud') then
  raise exception 'Un componente fisico exige articulo de equipo por unidad' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists articulo_composiciones_proteger on articulo_composiciones;
create trigger articulo_composiciones_proteger before insert or update or delete on articulo_composiciones for each row execute function proteger_composicion_kit();
drop trigger if exists articulo_composicion_lineas_proteger on articulo_composicion_lineas;
create trigger articulo_composicion_lineas_proteger before insert or update or delete on articulo_composicion_lineas for each row execute function proteger_composicion_kit();

create or replace function comprobar_suministro_completo() returns trigger language plpgsql as $$
declare sid uuid;
begin
 if tg_table_name='sala_suministros' then sid=new.id;
 elsif tg_table_name='sala_componentes_suministro' then sid=new.suministro_id;
 else sid=coalesce(new.suministro_id,old.suministro_id); end if;
 if exists(select 1 from sala_suministros s join articulo_composicion_lineas l on l.composicion_id=s.composicion_id
  where s.id=sid and l.inclusion='incluido' and l.articulo_componente_id is not null
  and (select count(*) from sala_componentes_suministro p where p.suministro_id=s.id and p.linea_id=l.id)<>l.cantidad) then
  raise exception 'Suministro incompleto: equipo y vinculo deben confirmarse juntos' using errcode='23514'; end if;
 if exists(select 1 from sala_suministros s join articulo_composicion_lineas l on l.composicion_id=s.composicion_id
  where s.id=sid and l.inclusion='incluido' and l.rol='cable'
  and (select count(*) from sala_cables_suministrados k where k.suministro_id=s.id and k.linea_id=l.id)<>l.cantidad) then
  raise exception 'Suministro incompleto: el cable incluido debe nacer con el suministro' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists sala_suministros_completo on sala_suministros;
create constraint trigger sala_suministros_completo after insert on sala_suministros deferrable initially deferred for each row execute function comprobar_suministro_completo();
drop trigger if exists sala_componentes_suministro_completo on sala_componentes_suministro;
create constraint trigger sala_componentes_suministro_completo after insert on sala_componentes_suministro deferrable initially deferred for each row execute function comprobar_suministro_completo();
drop trigger if exists sala_cables_suministrados_completo on sala_cables_suministrados;
create constraint trigger sala_cables_suministrados_completo after insert on sala_cables_suministrados deferrable initially deferred for each row execute function comprobar_suministro_completo();

create or replace function proteger_equipo_de_kit() returns trigger language plpgsql as $$
begin
 if exists(select 1 from sala_componentes_suministro where equipo_id=old.id) then
  if tg_op='DELETE' or new.id is distinct from old.id or new.sala_id is distinct from old.sala_id
   or new.articulo_id is distinct from old.articulo_id or new.cantidad is distinct from old.cantidad then
   raise exception 'Gestionar kit: no se puede borrar ni cambiar la identidad o cantidad de una pieza incluida' using errcode='23514'; end if;
 end if;
 if exists(select 1 from sala_cables_suministrados where propietario_equipo_id=old.id) then
  if tg_op='DELETE' or new.id is distinct from old.id or new.sala_id is distinct from old.sala_id
   or new.articulo_id is distinct from old.articulo_id or new.cantidad is distinct from old.cantidad then
   raise exception 'No se puede cambiar la identidad de una pieza con cable unido' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists sala_equipos_kit on sala_equipos;
create trigger sala_equipos_kit before update or delete on sala_equipos for each row execute function proteger_equipo_de_kit();

create or replace function proteger_puerto_de_cable_unido() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from sala_cables_suministrados where puerto_fijo_id=old.id) then
   raise exception 'El puerto de un cable unido es inmutable' using errcode='23514'; end if;
  return old;
 end if;
 if (new.id is distinct from old.id or new.articulo_id is distinct from old.articulo_id)
  and exists(select 1 from sala_cables_suministrados where puerto_fijo_id=old.id) then
  raise exception 'El puerto de un cable unido es inmutable' using errcode='23514';
 end if;
 if new.total is distinct from old.total and exists(
  select 1 from sala_cables_suministrados k where k.puerto_fijo_id=old.id and k.ordinal_fijo>new.total) then
  raise exception 'El ordinal fijo del cable unido supera la capacidad del puerto' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists puertos_cable_unido on puertos;
create trigger puertos_cable_unido before update or delete on puertos for each row execute function proteger_puerto_de_cable_unido();

comment on table sala_cables_suministrados is
 'Latiguillo fisico de un suministro. longitud_utilizable_m no se sustituye por longitud_manual_m.';
comment on column conexiones.estado_suministro is
 'incluido exige FK al latiguillo; adicional y por_determinar no la llevan. Nuevo INSERT: por_determinar.';
comment on column conexiones.longitud_manual_m is
 'Longitud de instalacion exigida. Nunca sustituye longitud_utilizable_m del cable suministrado.';
-- END CABLES SUMINISTRADOS L3C


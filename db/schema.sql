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

create table if not exists salas (
  id                      uuid primary key default gen_random_uuid(),
  sede_id                 uuid references sedes on delete set null,
  edificio                text,
  nivel                   text,
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

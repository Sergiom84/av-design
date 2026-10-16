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

-- E2 · Fuentes de catálogo y precios revisables (2026-10)
-- E2 local: fuentes revisables, sin aplicar automáticamente a producción.
-- Rollback de la migración: conservar primero archivo/reportes; retirar triggers,
-- tablas importacion_cambios/sala_material_bom/importacion_lotes y columnas
-- revision/fuente añadidas únicamente si no se han empezado a usar.
alter table articulos add column if not exists fuente text not null default 'csv';
alter table articulos alter column fuente set default 'app';
alter table articulos drop constraint if exists articulos_fuente_valida;
alter table articulos add constraint articulos_fuente_valida check (fuente in ('csv', 'app'));
alter table articulos add column if not exists revision bigint not null default 0;
alter table precios add column if not exists revision bigint not null default 0;
alter table proveedores add column if not exists revision bigint not null default 0;

create table if not exists importacion_lotes (
  id uuid primary key default gen_random_uuid(),
  destino text not null check (destino in ('catalogo', 'bom', 'precios')),
  sala_id uuid references salas on delete restrict,
  usuario_id uuid not null,
  origen text not null,
  archivo_nombre text not null,
  archivo_sha256 text not null check (archivo_sha256 ~ '^[a-f0-9]{64}$'),
  archivo bytea not null check (octet_length(archivo) <= 5242880),
  estado text not null default 'confirmado' check (estado in ('confirmado', 'revertido', 'reversion_parcial')),
  filas jsonb not null,
  informe jsonb not null,
  reversion jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  revertido_en timestamptz,
  check ((destino = 'bom') = (sala_id is not null))
);
create index if not exists importacion_lotes_usuario_idx on importacion_lotes (usuario_id, creado_en desc);

alter table precios add column if not exists unidad_compra text;
alter table precios add column if not exists lote_id uuid references importacion_lotes on delete restrict;

create table if not exists sala_material_bom (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas on delete cascade,
  articulo_id uuid not null references articulos on delete restrict,
  cantidad numeric(12,2) not null check (cantidad > 0),
  unidad unidad_medida not null,
  nota text,
  lote_id uuid references importacion_lotes on delete restrict,
  revision bigint not null default 0
);
create index if not exists sala_material_bom_sala_idx on sala_material_bom (sala_id);
comment on table sala_material_bom is 'Partidas adicionales a la necesidad derivada: sin equipo colocado, conexión ni cálculo inventado.';

create table if not exists importacion_cambios (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references importacion_lotes on delete restrict,
  orden integer not null,
  tabla text not null check (tabla in ('articulos', 'precios', 'sala_material_bom', 'proveedores')),
  fila_id uuid not null,
  antes jsonb,
  despues jsonb not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'revertido', 'conservado')),
  motivo text,
  unique (lote_id, orden)
);
-- También actualiza el checkpoint local anterior a registrar proveedores.
alter table importacion_cambios drop constraint if exists importacion_cambios_tabla_check;
alter table importacion_cambios add constraint importacion_cambios_tabla_check
  check (tabla in ('articulos', 'precios', 'sala_material_bom', 'proveedores'));

-- Contenido idéntico tras dos ediciones (ABA) sigue siendo trabajo posterior.
-- No depende de que quien escribe recuerde aumentar la revisión.
create or replace function e2_aumentar_revision() returns trigger language plpgsql as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;
drop trigger if exists e2_revision_articulos on articulos;
create trigger e2_revision_articulos before update on articulos for each row execute function e2_aumentar_revision();
drop trigger if exists e2_revision_precios on precios;
create trigger e2_revision_precios before update on precios for each row execute function e2_aumentar_revision();
drop trigger if exists e2_revision_bom on sala_material_bom;
create trigger e2_revision_bom before update on sala_material_bom for each row execute function e2_aumentar_revision();
drop trigger if exists e2_revision_proveedores on proveedores;
create trigger e2_revision_proveedores before update on proveedores for each row execute function e2_aumentar_revision();

-- AVX-16: bytes durables y dimensiones verificadas, sin alterar la geometría.
begin;
create table if not exists articulos_tecnicos (
  articulo_id uuid primary key references articulos(id),
  marca text,
  modelo text not null,
  ancho numeric,
  alto numeric,
  fondo numeric,
  unidad text check (unidad in ('mm', 'cm', 'm')),
  ru numeric,
  origen text not null,
  url text not null check (url ~ '^https://'),
  fecha date not null,
  verificado_por uuid references usuarios(id),
  verificado_en timestamptz not null default now(),
  check (ancho is null or ancho > 0),
  check (alto is null or alto > 0),
  check (fondo is null or fondo > 0),
  check (ru is null or ru > 0),
  check (unidad is not null or (ancho is null and alto is null and fondo is null))
);
create table if not exists articulos_archivos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  articulo_id uuid not null references articulos(id),
  tipo text not null check (tipo in ('imagen', 'ficha')),
  nombre text not null,
  mime text not null,
  tamano_bytes integer not null check (tamano_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bytea not null check (octet_length(bytes) between 1 and 5242880),
  marca text,
  modelo text not null,
  origen text not null,
  url text not null check (url ~ '^https://'),
  fecha date not null,
  verificado_por uuid references usuarios(id),
  verificado_en timestamptz not null default now(),
  unique (articulo_id, tipo),
  check (octet_length(bytes) = tamano_bytes),
  check ((tipo = 'imagen' and mime in ('image/png', 'image/jpeg', 'image/webp'))
      or (tipo = 'ficha' and mime = 'application/pdf'))
);
alter table sala_equipos add column if not exists dimensiones_tecnicas jsonb;
alter table plantilla_articulos add column if not exists dimensiones_tecnicas jsonb;
comment on column sala_equipos.dimensiones_tecnicas is
  'Dimensiones verificadas congeladas al alta. Ausente sigue ausente; no sustituye geometría del plano.';
comment on column plantilla_articulos.dimensiones_tecnicas is
  'Dimensiones congeladas; sala -> plantilla -> sala conserva el snapshot, incluso ausencia.';

create or replace function congelar_dimensiones_tecnicas() returns trigger language plpgsql as $$
declare datos jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.articulo_id is not distinct from old.articulo_id then return new; end if;
    -- Sustituir la referencia sustituye su snapshot; editar el catálogo no.
    new.dimensiones_tecnicas := null;
  elsif new.dimensiones_tecnicas is not null then
    -- JSON null es ausencia explícita al copiar una instancia legado.
    return new;
  elsif tg_table_name = 'sala_equipos' then
    if new.origen_plantilla_linea_id is not null then
      select dimensiones_tecnicas into datos from plantilla_articulos
        where id = new.origen_plantilla_linea_id and articulo_id is not distinct from new.articulo_id;
      new.dimensiones_tecnicas := datos;
      return new;
    end if;
  end if;
  select jsonb_build_object('marca', t.marca, 'modelo', t.modelo,
    'ancho', t.ancho, 'alto', t.alto, 'fondo', t.fondo, 'unidad', t.unidad, 'ru', t.ru,
    'origen', t.origen, 'url', t.url, 'fecha', t.fecha)
    into datos from articulos_tecnicos t join articulos a on a.id = t.articulo_id
    where t.articulo_id = new.articulo_id and t.modelo = a.modelo
      and t.marca is not distinct from a.marca
      and (t.ancho is not null or t.alto is not null or t.fondo is not null or t.ru is not null);
  new.dimensiones_tecnicas := datos;
  return new;
end;
$$;
drop trigger if exists sala_equipos_congelar_dimensiones on sala_equipos;
create trigger sala_equipos_congelar_dimensiones before insert or update of articulo_id on sala_equipos
  for each row execute function congelar_dimensiones_tecnicas();
drop trigger if exists plantilla_articulos_congelar_dimensiones on plantilla_articulos;
create trigger plantilla_articulos_congelar_dimensiones before insert or update of articulo_id on plantilla_articulos
  for each row execute function congelar_dimensiones_tecnicas();
commit;
-- Rollback manual, sólo sobre la BD de prueba identificada: drop triggers, función,
-- tablas articulos_archivos_tecnicos/articulos_tecnicos y ambas columnas snapshot.
-- La entrega conserva los datos técnicos al revertir lotes de importación ajenos.

-- AVX-18 opcional: preferencias personales, sin ranking ni sustituciones.
begin;
create table if not exists usuarios_articulos_favoritos (
  usuario_id uuid not null references usuarios(id),
  articulo_id uuid not null references articulos(id),
  creado_en timestamptz not null default now(),
  primary key (usuario_id, articulo_id)
);
comment on table usuarios_articulos_favoritos is
  'Favoritos personales reversibles. No modifica catálogo, equipos, precios o puertos de una obra.';
commit;
-- Rollback manual en destino previamente identificado: drop table usuarios_articulos_favoritos;


-- E3 · Revisiones, alternativas y anotaciones
-- E3: historial durable y frontera diseño/operación. Sin siembra de negocio.
alter table salas add column if not exists diseno_version bigint not null default 0;
alter table salas add column if not exists origen_sala_id uuid references salas on delete restrict;
alter table salas add column if not exists origen_revision_id uuid;
alter table salas add column if not exists medidas_heredadas boolean not null default false;
alter table salas add column if not exists mapa_ids_origen jsonb not null default '{}'::jsonb;

create table if not exists revisiones_diseno (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas on delete restrict,
  numero integer not null check(numero > 0),
  nombre text not null check(length(nombre) between 1 and 160),
  autor_id uuid not null references usuarios on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  hash text not null check(hash ~ '^[a-f0-9]{64}$'),
  diseno_version bigint not null,
  antecedente_id uuid references revisiones_diseno on delete restrict,
  restaurada_de_id uuid references revisiones_diseno on delete restrict,
  snapshot jsonb not null check(octet_length(snapshot::text) <= 5242880),
  unique(sala_id, numero)
);
create index if not exists revisiones_diseno_sala_idx on revisiones_diseno(sala_id, numero desc);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='salas_origen_revision_fk' and conrelid='salas'::regclass) then
    alter table salas add constraint salas_origen_revision_fk foreign key(origen_revision_id) references revisiones_diseno on delete restrict;
  end if;
end $$;
create or replace function e3_revision_inmutable() returns trigger language plpgsql as $$
begin raise exception 'Una revisión de diseño es inmutable' using errcode='23514'; end $$;
drop trigger if exists e3_revision_inmutable on revisiones_diseno;
create trigger e3_revision_inmutable before update or delete on revisiones_diseno for each row execute function e3_revision_inmutable();

-- El contador no retrocede al borrar un cable. El identificador es por sala.
alter table conexiones add column if not exists identificador_cable text;
create table if not exists correlativos_cable (
  sala_id uuid not null references salas on delete cascade,
  senal senal not null,
  siguiente integer not null check(siguiente >= 1000),
  primary key(sala_id, senal)
);
with orden as (
  select id, senal, row_number() over(partition by sala_id, senal order by creado_en, id)+999 n from conexiones
), etiquetas as (
  select id, case senal when 'hdmi' then 'HD' when 'red' then 'RED' when 'usb' then 'USB'
    when 'audio_linea' then 'AUD' when 'audio_altavoz' then 'ALT' when 'microfono' then 'MIC'
    when 'alimentacion' then 'PWR' when 'control' then 'RS' else 'CBL' end || '-' || n::text etiqueta from orden
)
update conexiones c set identificador_cable=e.etiqueta from etiquetas e where c.id=e.id and c.identificador_cable is null;
insert into correlativos_cable(sala_id,senal,siguiente)
select sala_id,senal,coalesce(max(substring(identificador_cable from '-([0-9]+)$')::integer),999)+1
from conexiones group by sala_id,senal
on conflict(sala_id,senal) do update set siguiente=greatest(correlativos_cable.siguiente,excluded.siguiente);
create unique index if not exists conexiones_identificador_idx on conexiones(sala_id,identificador_cable);
create or replace function e3_identificador_cable() returns trigger language plpgsql as $$
declare n integer; prefijo text;
begin
  if tg_op='UPDATE' then
    if new.identificador_cable is distinct from old.identificador_cable then
      raise exception 'El identificador de cable es inmutable' using errcode='23514';
    end if;
    return new;
  end if;
  if new.identificador_cable is not null then
    if new.identificador_cable !~ '^[A-Z]+-[0-9]+$' then raise exception 'Identificador de cable inválido'; end if;
    n := substring(new.identificador_cable from '-([0-9]+)$')::integer;
    insert into correlativos_cable(sala_id,senal,siguiente) values(new.sala_id,new.senal,n+1)
      on conflict(sala_id,senal) do update set siguiente=greatest(correlativos_cable.siguiente,excluded.siguiente);
    return new;
  end if;
  insert into correlativos_cable(sala_id,senal,siguiente) values(new.sala_id,new.senal,1001)
    on conflict(sala_id,senal) do update set siguiente=correlativos_cable.siguiente+1 returning siguiente-1 into n;
  prefijo := case new.senal when 'hdmi' then 'HD' when 'red' then 'RED' when 'usb' then 'USB'
    when 'audio_linea' then 'AUD' when 'audio_altavoz' then 'ALT' when 'microfono' then 'MIC'
    when 'alimentacion' then 'PWR' when 'control' then 'RS' else 'CBL' end;
  new.identificador_cable := prefijo || '-' || n::text;
  return new;
end $$;
drop trigger if exists e3_identificador_cable on conexiones;
create trigger e3_identificador_cable before insert or update on conexiones for each row execute function e3_identificador_cable();

-- Versión independiente de la del editor: también cubre BOM/notas/cantidad y ABA.
create or replace function e3_version_sala() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new)-array['diseno_version','diagrama_version','actualizado_en','origen_sala_id','origen_revision_id','medidas_heredadas','mapa_ids_origen'])
     is distinct from (to_jsonb(old)-array['diseno_version','diagrama_version','actualizado_en','origen_sala_id','origen_revision_id','medidas_heredadas','mapa_ids_origen']) then
    new.diseno_version := old.diseno_version+1;
  end if;
  return new;
end $$;
drop trigger if exists e3_version_sala on salas;
create trigger e3_version_sala before update on salas for each row execute function e3_version_sala();
create or replace function e3_version_hija() returns trigger language plpgsql as $$
declare anterior uuid; posterior uuid; fila jsonb;
begin
  if tg_op <> 'INSERT' then
    fila:=to_jsonb(old);
    if tg_table_name in ('conexion_bocas','conexion_puntos_paso') then select sala_id into anterior from conexiones where id=(fila->>'conexion_id')::uuid;
    else anterior:=(fila->>'sala_id')::uuid; end if;
  end if;
  if tg_op <> 'DELETE' then
    fila:=to_jsonb(new);
    if tg_table_name in ('conexion_bocas','conexion_puntos_paso') then select sala_id into posterior from conexiones where id=(fila->>'conexion_id')::uuid;
    else posterior:=(fila->>'sala_id')::uuid; end if;
  end if;
  update salas set diseno_version=diseno_version+1 where id in (anterior,posterior);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
do $$ declare tabla text;
begin
  foreach tabla in array array['sala_equipos','sala_mobiliario','puertas','tomas_red','conexiones','conexion_bocas','conexion_puntos_paso','sala_material_bom'] loop
    execute format('drop trigger if exists e3_version_hija on %I',tabla);
    execute format('create trigger e3_version_hija after insert or update or delete on %I for each row execute function e3_version_hija()',tabla);
  end loop;
end $$;

-- E3: notas de presentación normalizadas; nunca geometría física paralela.
create table if not exists anotaciones_sala (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas(id),
  texto varchar(1000) not null check (length(trim(texto)) > 0),
  ancla_tipo text not null check (ancla_tipo in ('sala','equipo','conexion','visual')),
  ancla_id uuid,
  x double precision,
  y double precision,
  creado_en timestamptz not null default now(),
  constraint anotacion_ancla_valida check (
    (ancla_tipo = 'sala' and ancla_id is null and x is null and y is null) or
    (ancla_tipo in ('equipo','conexion') and ancla_id is not null and x is null and y is null) or
    (ancla_tipo = 'visual' and ancla_id is null and x between 0 and 100000 and y between 0 and 100000 and x is not null and y is not null)
  )
);
create index if not exists anotaciones_sala_sala on anotaciones_sala(sala_id);
create or replace function comprobar_ancla_anotacion() returns trigger language plpgsql as $$
begin
  if new.ancla_tipo = 'equipo' then
    perform id from sala_equipos where id = new.ancla_id and sala_id = new.sala_id for key share;
    if not found then raise check_violation using message = 'El equipo de la anotación no pertenece a esta sala.'; end if;
  elsif new.ancla_tipo = 'conexion' then
    perform id from conexiones where id = new.ancla_id and sala_id = new.sala_id for key share;
    if not found then raise check_violation using message = 'La conexión de la anotación no pertenece a esta sala.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists anotacion_pertenencia on anotaciones_sala;
create trigger anotacion_pertenencia before insert or update on anotaciones_sala for each row execute function comprobar_ancla_anotacion();

create or replace function proteger_ancla_anotada() returns trigger language plpgsql as $$
declare tipo text;
begin
  tipo := case tg_table_name when 'sala_equipos' then 'equipo' else 'conexion' end;
  if (tg_op = 'DELETE' or old.sala_id <> new.sala_id) and exists (select 1 from anotaciones_sala where sala_id = old.sala_id and ancla_tipo = tipo and ancla_id = old.id) then
    raise check_violation using message = 'Decide conservar o retirar las anotaciones desde Diagrama antes de quitar su ancla.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists equipo_anotado on sala_equipos;
create trigger equipo_anotado before delete or update of sala_id on sala_equipos for each row execute function proteger_ancla_anotada();
drop trigger if exists conexion_anotada on conexiones;
create trigger conexion_anotada before delete or update of sala_id on conexiones for each row execute function proteger_ancla_anotada();

create or replace function versionar_anotacion_diseno() returns trigger language plpgsql as $$
begin
  update salas set diseno_version = diseno_version + 1 where id = case when tg_op = 'DELETE' then old.sala_id else new.sala_id end;
  if tg_op = 'UPDATE' and old.sala_id <> new.sala_id then
    update salas set diseno_version = diseno_version + 1 where id = old.sala_id;
  end if;
  return null;
end $$;
drop trigger if exists anotacion_version_diseno on anotaciones_sala;
create trigger anotacion_version_diseno after insert or update or delete on anotaciones_sala for each row execute function versionar_anotacion_diseno();

-- REA-02: presentación personal. No modifica catálogo, diseños ni permisos.
create table if not exists preferencias_usuario (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  version integer not null default 0 check (version >= 0),
  panel jsonb not null default '{}'::jsonb
    check (jsonb_typeof(panel) = 'object' and octet_length(panel::text) <= 16384),
  catalogo jsonb not null default '{}'::jsonb
    check (jsonb_typeof(catalogo) = 'object' and octet_length(catalogo::text) <= 16384),
  actualizado_en timestamptz not null default now()
);

comment on table preferencias_usuario is
  'Marcas/filtros y orden/visibilidad de tarjetas propios. Nunca conceden permisos ni sustituyen catálogo o diseño.';

-- REA-03: informes internos durables.
create table if not exists informes_definiciones (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  version integer not null default 0 check (version >= 0),
  configuracion jsonb not null check (jsonb_typeof(configuracion) = 'object'),
  archivada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists informes_def_propietario_idx
  on informes_definiciones(propietario_id, creado_en desc, id);

create table if not exists informes_grupos (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  ambito jsonb not null check (jsonb_typeof(ambito) = 'object'),
  version integer not null default 0 check (version >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists informes_grupo_miembros (
  grupo_id uuid not null references informes_grupos(id) on delete restrict,
  usuario_id uuid not null references usuarios(id) on delete restrict,
  primary key(grupo_id, usuario_id)
);

create table if not exists informes_programaciones (
  id uuid primary key default gen_random_uuid(),
  definicion_id uuid not null references informes_definiciones(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  calendario jsonb not null check (jsonb_typeof(calendario) = 'object'),
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  activa boolean not null default true,
  proxima_utc timestamptz,
  ultima_omision jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists informes_prog_vencida_idx
  on informes_programaciones(proxima_utc, id) where activa;

create table if not exists informes_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  definicion_id uuid not null references informes_definiciones(id) on delete restrict,
  propietario_id uuid not null references usuarios(id) on delete restrict,
  programacion_id uuid references informes_programaciones(id) on delete restrict,
  clave_peticion uuid,
  ocurrencia_utc timestamptz not null,
  definicion_snapshot jsonb not null check (jsonb_typeof(definicion_snapshot) = 'object'),
  definicion_sha256 text not null check (definicion_sha256 ~ '^[0-9a-f]{64}$'),
  periodo_resuelto jsonb not null check (jsonb_typeof(periodo_resuelto) = 'object'),
  snapshot jsonb check (jsonb_typeof(snapshot) = 'object'),
  snapshot_sha256 text check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  observado_en timestamptz,
  snapshot_expurgado_en timestamptz,
  estado text not null default 'pendiente' check
    (estado in ('pendiente','en_curso','correcta','fallida','bloqueada','cancelada','caducada')),
  reintentar_desde timestamptz,
  intento_actual integer not null default 0 check (intento_actual between 0 and 3),
  lease_token uuid,
  lease_hasta timestamptz,
  error_codigo text,
  error_mensaje text,
  manifiesto jsonb check (jsonb_typeof(manifiesto) = 'object'),
  entrega_externa text not null default 'no_configurada' check (entrega_externa = 'no_configurada'),
  revocada_en timestamptz,
  terminado_en timestamptz,
  caduca_en timestamptz,
  creado_en timestamptz not null default now(),
  check ((programacion_id is null) = (clave_peticion is not null)),
  check (snapshot is null or snapshot_sha256 is not null),
  check ((snapshot_sha256 is null) = (observado_en is null)),
  check (snapshot_expurgado_en is null or
    (estado = 'caducada' and snapshot is null and snapshot_sha256 is not null)),
  check ((lease_token is null) = (lease_hasta is null)),
  check (estado <> 'correcta' or
    (snapshot is not null and manifiesto is not null and terminado_en is not null and caduca_en is not null)),
  unique(programacion_id, ocurrencia_utc)
);
create unique index if not exists informes_ejec_manual_unica_idx
  on informes_ejecuciones(propietario_id, clave_peticion) where clave_peticion is not null;
create index if not exists informes_ejec_cola_idx
  on informes_ejecuciones(estado, reintentar_desde, creado_en, id);
create index if not exists informes_ejec_ultimo_correcto_idx
  on informes_ejecuciones(definicion_id, ocurrencia_utc desc, id desc) where estado = 'correcta';

create table if not exists informes_receptores (
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  usuario_id uuid not null references usuarios(id) on delete restrict,
  -- Origen directo/propietario/grupos y versiones: conjunto congelado, sin permisos cacheados.
  origenes jsonb not null check (jsonb_typeof(origenes) = 'array'),
  excluido_codigo text,
  revocado_en timestamptz,
  primary key(ejecucion_id, usuario_id)
);
create index if not exists informes_rec_usuario_idx on informes_receptores(usuario_id, ejecucion_id);

create table if not exists informes_intentos (
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  numero integer not null check (numero between 1 and 3),
  token uuid not null unique,
  estado text not null check (estado in ('en_curso','correcta','fallida','interrumpida','bloqueada')),
  iniciado_en timestamptz not null default now(),
  latido_en timestamptz not null default now(),
  terminado_en timestamptz,
  error_codigo text,
  error_mensaje text,
  primary key(ejecucion_id, numero)
);
create unique index if not exists informes_intento_vivo_idx
  on informes_intentos(ejecucion_id) where estado = 'en_curso';

create table if not exists informes_archivos (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references informes_ejecuciones(id) on delete restrict,
  formato text not null check (formato in ('pdf','xlsx','csv')),
  nombre text not null check (nombre ~ '^informe-[0-9a-f-]+[.](pdf|xlsx|csv)$'),
  mime text not null,
  contenido bytea not null check (octet_length(contenido) between 1 and 26214400),
  bytes integer generated always as (octet_length(contenido)) stored,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  creado_en timestamptz not null default now(),
  unique(ejecucion_id, formato),
  check (encode(digest(contenido, 'sha256'), 'hex') = sha256)
);

create table if not exists informes_runner_latidos (
  id uuid primary key,
  modo text not null check (modo in ('manual','continuo')),
  version text not null,
  iniciado_en timestamptz not null default now(),
  latido_en timestamptz not null default now(),
  detenido_en timestamptz
);

-- Rechazar la reescritura de identidad/definición y de una captura ya persistida.
create or replace function guardar_inmutabilidad_informe() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.definicion_id,new.propietario_id,new.programacion_id,
         new.clave_peticion,new.ocurrencia_utc,new.definicion_snapshot,
         new.definicion_sha256,new.periodo_resuelto,new.creado_en)
     is distinct from
     row(old.id,old.definicion_id,old.propietario_id,old.programacion_id,
         old.clave_peticion,old.ocurrencia_utc,old.definicion_snapshot,
         old.definicion_sha256,old.periodo_resuelto,old.creado_en) then
    raise exception 'La definicion de una ejecucion es inmutable';
  end if;
  if old.snapshot_sha256 is not null then
    if new.caduca_en is distinct from old.caduca_en then
      raise exception 'La retencion de una captura no se prolonga';
    end if;
    if row(new.snapshot_sha256,new.observado_en)
       is distinct from row(old.snapshot_sha256,old.observado_en) then
      raise exception 'La identidad de una captura es inmutable';
    end if;
    if new.snapshot is distinct from old.snapshot or
       new.snapshot_expurgado_en is distinct from old.snapshot_expurgado_en then
      -- Excepcion unica: expurgar contenido vencido, conservando identidad y auditoria.
      if not (old.snapshot is not null and new.snapshot is null and
        old.snapshot_expurgado_en is null and new.snapshot_expurgado_en is not null and
        new.estado = 'caducada' and old.caduca_en is not null and
        old.caduca_en <= now()) then
        raise exception 'La captura de una ejecucion es inmutable';
      end if;
    end if;
  end if;
  if old.manifiesto is not null and
     row(new.manifiesto,new.terminado_en) is distinct from
     row(old.manifiesto,old.terminado_en) then
    raise exception 'Un resultado correcto no se sobrescribe';
  end if;
  return new;
end $$;
drop trigger if exists informes_ejec_inmutable on informes_ejecuciones;
create trigger informes_ejec_inmutable before update on informes_ejecuciones
  for each row execute function guardar_inmutabilidad_informe();

create or replace function impedir_actualizar_archivo_informe() returns trigger
language plpgsql as $$ begin
  raise exception 'Un archivo de informe no se sobrescribe';
end $$;
drop trigger if exists informes_arch_inmutable on informes_archivos;
create trigger informes_arch_inmutable before update on informes_archivos
  for each row execute function impedir_actualizar_archivo_informe();

-- REA-04: planes y agenda.
create table if not exists catalogo_tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (length(descripcion) <= 2000),
  duracion_estimada_min integer check (duracion_estimada_min between 1 and 43200),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists reglas_plan (
  id uuid primary key default gen_random_uuid(),
  trabajo_id uuid not null references catalogo_tareas(id) on delete restrict,
  selector jsonb not null check (jsonb_typeof(selector) = 'object'),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists planes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null unique references proyectos(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  notas text not null default '' check (length(notas) <= 2000),
  archivado_en timestamptz,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists plan_fuentes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo = 1),
  generador text not null default 'rea04-1' check (generador = 'rea04-1'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  -- Proyecciones separadas: no seleccionar la privada sin catálogo autorizado.
  publico jsonb not null check (jsonb_typeof(publico) = 'object'),
  catalogo jsonb not null default '{}' check (jsonb_typeof(catalogo) = 'object'),
  revisiones_e3 jsonb not null default '[]' check (jsonb_typeof(revisiones_e3) = 'array'),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  unique(plan_id, sha256)
);
create table if not exists plan_operaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in
    ('crear_plan','editar_plan','confirmar_fuente','crear_tarea','editar_tarea',
     'estado_tarea','asignar','restaurar_tarea','grupo','archivar_plan','reactivar_plan')),
  version_antes integer not null check (version_antes >= 0),
  version_despues integer not null check (version_despues >= version_antes),
  fuente_id uuid references plan_fuentes(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  motivo text check (length(motivo) between 1 and 2000),
  resumen jsonb not null check (jsonb_typeof(resumen) = 'object'),
  creado_en timestamptz not null default now(),
  unique(plan_id, clave_peticion)
);
create table if not exists plan_tareas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  trabajo_id uuid references catalogo_tareas(id) on delete restrict,
  regla_id uuid references reglas_plan(id) on delete restrict,
  clave_origen text check (clave_origen ~ '^[0-9a-f]{64}$'),
  fuente_id uuid references plan_fuentes(id) on delete restrict,
  origen_publico jsonb not null default '{}' check (jsonb_typeof(origen_publico) = 'object'),
  origen_catalogo jsonb not null default '{}' check (jsonb_typeof(origen_catalogo) = 'object'),
  base_generada jsonb check (jsonb_typeof(base_generada) = 'object'),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (length(descripcion) <= 2000),
  notas text not null default '' check (length(notas) <= 2000),
  duracion_estimada_min integer check (duracion_estimada_min between 1 and 43200),
  estado text not null default 'borrador' check
    (estado in ('borrador','pendiente','en_curso','hecha','anulada')),
  vence_fecha date,
  inicio_utc timestamptz,
  fin_utc timestamptz,
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  version integer not null default 0 check (version >= 0),
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check ((inicio_utc is null) = (fin_utc is null)),
  check (fin_utc is null or
    (fin_utc > inicio_utc and fin_utc - inicio_utc <= interval '7 days')),
  check ((clave_origen is null and regla_id is null and fuente_id is null) or
    (clave_origen is not null and regla_id is not null and fuente_id is not null and sala_id is not null)),
  unique(plan_id, clave_origen)
);
create index if not exists plan_tareas_obra_estado_idx on plan_tareas(plan_id, estado, id);
create index if not exists plan_tareas_vencimiento_idx on plan_tareas(vence_fecha, id);
create index if not exists plan_tareas_intervalo_idx on plan_tareas(inicio_utc, fin_utc);

create table if not exists plan_grupos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  activo boolean not null default true,
  version integer not null default 0 check (version >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists plan_grupo_miembros (
  grupo_id uuid not null references plan_grupos(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  primary key(grupo_id, tecnico_id)
);
create table if not exists plan_asignaciones (
  tarea_id uuid not null references plan_tareas(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  activo boolean not null default true,
  origen_grupos jsonb not null default '[]' check (jsonb_typeof(origen_grupos) = 'array'),
  asignado_por uuid not null references usuarios(id) on delete restrict,
  actualizado_en timestamptz not null default now(),
  primary key(tarea_id, tecnico_id)
);
create index if not exists plan_asignaciones_tecnico_idx
  on plan_asignaciones(tecnico_id, tarea_id) where activo;

create table if not exists plan_eventos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  operacion_id uuid not null references plan_operaciones(id) on delete restrict,
  version_plan integer not null check (version_plan >= 0),
  orden integer not null check (orden >= 0),
  tipo text not null,
  autor_id uuid not null references usuarios(id) on delete restrict,
  antecedente_id uuid references plan_eventos(id) on delete restrict,
  motivo text check (length(motivo) between 1 and 2000),
  antes jsonb,
  despues jsonb,
  -- Detalle privado de procedencia nunca se devuelve por una lectura operativa.
  catalogo jsonb not null default '{}' check (jsonb_typeof(catalogo) = 'object'),
  creado_en timestamptz not null default now(),
  unique(plan_id, version_plan, orden)
);
create index if not exists plan_eventos_tarea_idx
  on plan_eventos(tarea_id, creado_en desc, id);

create or replace function plan_registro_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El historial y la fuente de un plan son inmutables';
end $$;
drop trigger if exists plan_fuente_inmutable on plan_fuentes;
create trigger plan_fuente_inmutable before update or delete on plan_fuentes
  for each row execute function plan_registro_inmutable();
drop trigger if exists plan_operacion_inmutable on plan_operaciones;
create trigger plan_operacion_inmutable before update or delete on plan_operaciones
  for each row execute function plan_registro_inmutable();
drop trigger if exists plan_evento_inmutable on plan_eventos;
create trigger plan_evento_inmutable before update or delete on plan_eventos
  for each row execute function plan_registro_inmutable();

create or replace function plan_identidad_tarea_inmutable() returns trigger
language plpgsql as $$ begin
  if row(new.id,new.plan_id,new.sala_id,new.regla_id,new.clave_origen,
         new.creado_por,new.creado_en) is distinct from
     row(old.id,old.plan_id,old.sala_id,old.regla_id,old.clave_origen,
         old.creado_por,old.creado_en) then
    raise exception 'La identidad y el ambito de una tarea no se trasladan';
  end if;
  return new;
end $$;
drop trigger if exists plan_tarea_identidad on plan_tareas;
create trigger plan_tarea_identidad before update on plan_tareas
  for each row execute function plan_identidad_tarea_inmutable();


-- REA-06: propuestas internas y PDF inmutables.
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

-- REA-05: tiempos y costes imputados.
create table if not exists tiempo_registros (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references plan_tareas(id) on delete restrict,
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  titular_usuario_id uuid references usuarios(id) on delete restrict,
  relacionado_id uuid references tiempo_registros(id) on delete restrict,
  numero_actual integer not null default 1 check (numero_actual > 0),
  actual_id uuid not null,
  creado_en timestamptz not null default now()
);
create table if not exists tiempo_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references tiempo_versiones(id) on delete restrict,
  accion text not null check (accion in ('registro','correccion','anulacion')),
  inicio_utc timestamptz not null,
  fin_utc timestamptz not null,
  minutos integer not null check (minutos between 1 and 1440),
  zona text not null default 'Europe/Madrid' check (zona = 'Europe/Madrid'),
  entrada_local jsonb not null check (jsonb_typeof(entrada_local) = 'object'),
  notas text not null default '' check (length(notas) <= 2000),
  motivo text check (length(motivo) between 1 and 2000),
  autor_usuario_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  check (fin_utc > inicio_utc and
    extract(epoch from (fin_utc-inicio_utc)) = minutos::numeric * 60),
  check (date_trunc('minute',inicio_utc) = inicio_utc and date_trunc('minute',fin_utc) = fin_utc),
  check ((numero = 1 and antecedente_id is null and accion = 'registro') or
    (numero > 1 and antecedente_id is not null and accion <> 'registro' and motivo is not null)),
  unique(registro_id, numero), unique(registro_id, id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tiempo_actual_fk'
    and conrelid='tiempo_registros'::regclass) then
    alter table tiempo_registros add constraint tiempo_actual_fk
      foreign key(id,actual_id) references tiempo_versiones(registro_id,id)
      deferrable initially deferred;
  end if;
end $$;
create index if not exists tiempo_tecnico_idx on tiempo_registros(tecnico_id, id);
create index if not exists tiempo_tarea_idx on tiempo_registros(tarea_id, id);
create index if not exists tiempo_titular_idx on tiempo_registros(titular_usuario_id, id);
create index if not exists tiempo_intervalo_idx on tiempo_versiones(inicio_utc, fin_utc);

create table if not exists tiempo_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  version_id uuid not null references tiempo_versiones(id) on delete restrict,
  tipo text not null check (tipo in ('registro','correccion','anulacion','restauracion')),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);

create table if not exists coste_tarifa_versiones (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_tarifa_versiones(id) on delete restrict,
  tecnico_id uuid not null references tecnicos(id) on delete restrict,
  accion text not null check (accion in ('definir','corregir','anular')),
  desde date not null, hasta_exclusivo date,
  precio_hora numeric(12,4) not null check (precio_hora >= 0),
  moneda text not null check (moneda in ('EUR','USD')),
  calidad text not null check (calidad in ('estimada','validada')),
  fuente text not null check (length(btrim(fuente)) between 1 and 1000),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check (hasta_exclusivo is null or hasta_exclusivo > desde),
  check ((numero=1 and antecedente_id is null and accion='definir') or
    (numero>1 and antecedente_id is not null and accion<>'definir')),
  unique(serie_id,numero)
);
create index if not exists coste_tarifa_tecnico_idx on coste_tarifa_versiones(tecnico_id,desde);

create table if not exists coste_labor_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references tiempo_registros(id) on delete restrict,
  tiempo_version_id uuid not null references tiempo_versiones(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_labor_versiones(id) on delete restrict,
  accion text not null check (accion in ('valorar','revalorar','anular')),
  tramos jsonb not null check (jsonb_typeof(tramos) = 'array'),
  totales jsonb not null check (jsonb_typeof(totales) = 'object'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(registro_id,numero)
);

create table if not exists coste_material_apuntes (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references movimientos(id) on delete restrict,
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  sala_id uuid references salas(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  creado_en timestamptz not null default now()
);
create index if not exists coste_material_mov_idx on coste_material_apuntes(movimiento_id,id);
create index if not exists coste_material_obra_idx on coste_material_apuntes(proyecto_id,id);
create table if not exists coste_material_versiones (
  id uuid primary key default gen_random_uuid(),
  apunte_id uuid not null references coste_material_apuntes(id) on delete restrict,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_material_versiones(id) on delete restrict,
  accion text not null check (accion in ('imputar','corregir','anular')),
  cantidad numeric(12,2) not null check (cantidad > 0),
  unidad text not null check (unidad in ('ud','m')),
  tipo_hecho text not null check (tipo_hecho in ('salida','devolucion','baja')),
  signo integer not null check (signo in (-1,1)),
  movimiento_snapshot jsonb not null check (jsonb_typeof(movimiento_snapshot) = 'object'),
  movimiento_sha256 text not null check (movimiento_sha256 ~ '^[0-9a-f]{64}$'),
  precio_unitario numeric(12,4) check (precio_unitario >= 0),
  moneda text check (moneda in ('EUR','USD')),
  calidad text not null check (calidad in ('sin_valorar','estimado','documentado')),
  importe_minor numeric(30,0),
  origen_salida_version_id uuid references coste_material_versiones(id) on delete restrict,
  origen_devolucion_version_id uuid references coste_material_versiones(id) on delete restrict,
  linaje text not null check (linaje in ('salida','devolucion','reingreso_baja','baja_directa','pendiente')),
  evidencia jsonb not null check (jsonb_typeof(evidencia) = 'object'),
  redondeo text not null default 'mitad_fuera_cero_v1' check (redondeo='mitad_fuera_cero_v1'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check ((precio_unitario is null) = (moneda is null)),
  check (tipo_hecho <> 'devolucion' or signo=-1),
  check (tipo_hecho='devolucion' or signo=1),
  check (calidad <> 'documentado' or
    (precio_unitario is not null and importe_minor is not null and linaje <> 'pendiente')),
  unique(apunte_id,numero)
);

create table if not exists coste_cortes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  serie_id uuid not null, numero integer not null check (numero > 0),
  antecedente_id uuid unique references coste_cortes(id) on delete restrict,
  tipo text not null check (tipo in ('previsto','real','comparacion')),
  version_modelo integer not null default 1 check (version_modelo=1),
  alcance jsonb not null check (jsonb_typeof(alcance) = 'object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('sin_datos','parcial','completo')),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(serie_id,numero)
);
create table if not exists coste_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in ('tarifa','laboral','material','corte')),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);

create or replace function rea05_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El registro historico REA05 no se sobrescribe';
end $$;
-- Integrar el mismo trigger antes de UPDATE/DELETE en:
-- tiempo_versiones, tiempo_operaciones, coste_tarifa_versiones,
-- coste_labor_versiones, coste_material_versiones, coste_cortes, coste_operaciones.
do $$ declare nombre text; begin
  foreach nombre in array array['tiempo_versiones','tiempo_operaciones',
    'coste_tarifa_versiones','coste_labor_versiones','coste_material_versiones',
    'coste_cortes','coste_operaciones','coste_material_apuntes'] loop
    execute format('drop trigger if exists rea05_inmutable on %I',nombre);
    execute format('create trigger rea05_inmutable before update or delete on %I '
      'for each row execute function rea05_inmutable()',nombre);
  end loop;
end $$;

create or replace function rea05_identidad_tiempo() returns trigger
language plpgsql as $$ declare n integer; begin
  if tg_op='DELETE' then
    raise exception 'La cabecera de tiempo con historia no se borra';
  end if;
  if (to_jsonb(new)-array['numero_actual','actual_id']) is distinct from
     (to_jsonb(old)-array['numero_actual','actual_id']) then
    raise exception 'La identidad del tiempo no se traslada';
  end if;
  select numero into n from tiempo_versiones
    where registro_id=new.id and id=new.actual_id;
  if n is null or n<>new.numero_actual or new.numero_actual<>old.numero_actual+1 then
    raise exception 'El tiempo avanza una version por correccion';
  end if;
  return new;
end $$;
drop trigger if exists tiempo_identidad on tiempo_registros;
create trigger tiempo_identidad before update or delete on tiempo_registros
  for each row execute function rea05_identidad_tiempo();


-- INTEGRACION REA07 ADITIVA 2026-10-15
-- REA07: seguimiento interno, sin transporte ni hechos físicos.
create table if not exists propuesta_seguimientos (
  revision_id uuid primary key references propuesta_revisiones(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  ultimo_evento_id uuid,
  check ((version=0) = (ultimo_evento_id is null))
);
create table if not exists propuesta_eventos (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null,
  revision_id uuid not null,
  revision_sha256 text not null check (revision_sha256 ~ '^[0-9a-f]{64}$'),
  numero integer not null check (numero > 0),
  antecedente_id uuid unique,
  tipo text not null check (tipo in ('emitir','aceptar','rechazar','revocar_decision')),
  decision_revocada_id uuid,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  referencia text not null check (length(btrim(referencia)) between 1 and 1000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null check (length(btrim(autor_nombre)) between 1 and 200),
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  unique(revision_id,numero), unique(revision_id,id),
  foreign key(revision_id,antecedente_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  foreign key(revision_id,decision_revocada_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  check ((numero=1) = (antecedente_id is null)),
  check ((tipo='revocar_decision') = (decision_revocada_id is not null))
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='propuesta_seguimiento_actual_fk'
    and conrelid='propuesta_seguimientos'::regclass) then
    alter table propuesta_seguimientos add constraint propuesta_seguimiento_actual_fk
      foreign key(revision_id,ultimo_evento_id)
      references propuesta_eventos(revision_id,id) deferrable initially deferred;
  end if;
end $$;
create index if not exists propuesta_eventos_historia_idx
  on propuesta_eventos(propuesta_id,revision_id,numero);
create index if not exists propuesta_eventos_fecha_idx
  on propuesta_eventos(creado_en,id);

create table if not exists propuesta_resultado_cortes (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid not null,
  numero integer not null check (numero > 0),
  antecedente_id uuid unique references propuesta_resultado_cortes(id) on delete restrict,
  propuesta_id uuid not null,
  revision_id uuid not null,
  aceptacion_id uuid not null,
  coste_corte_id uuid not null references coste_cortes(id) on delete restrict,
  version_modelo integer not null default 1 check (version_modelo=1),
  alcance jsonb not null check (jsonb_typeof(alcance)='object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  estado text not null check (estado in ('sin_datos','parcial','comparable_registrado')),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  foreign key(revision_id,aceptacion_id)
    references propuesta_eventos(revision_id,id) on delete restrict,
  check ((numero=1) = (antecedente_id is null)),
  unique(serie_id,numero)
);
create table if not exists propuesta_seguimiento_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  propuesta_id uuid not null,
  revision_id uuid not null,
  tipo text not null check (tipo in ('evento','resultado')),
  evento_id uuid references propuesta_eventos(id) on delete restrict,
  resultado_id uuid references propuesta_resultado_cortes(id) on delete restrict,
  creado_en timestamptz not null default now(),
  foreign key(propuesta_id,revision_id)
    references propuesta_revisiones(propuesta_id,id) on delete restrict,
  check ((tipo='evento' and evento_id is not null and resultado_id is null) or
    (tipo='resultado' and resultado_id is not null and evento_id is null)),
  unique(autor_id,clave_peticion)
);
create index if not exists propuesta_resultados_historia_idx
  on propuesta_resultado_cortes(propuesta_id,revision_id,creado_en,id);

create or replace function rea07_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El historial REA07 no se sobrescribe';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['propuesta_eventos','propuesta_resultado_cortes',
    'propuesta_seguimiento_operaciones'] loop
    execute format('drop trigger if exists rea07_inmutable on %I',tabla);
    execute format('create trigger rea07_inmutable before update or delete on %I '
      'for each row execute function rea07_inmutable()',tabla);
  end loop;
end $$;

create or replace function rea07_identidad_seguimiento() returns trigger
language plpgsql as $$ declare n integer; begin
  if tg_op='DELETE' then
    raise exception 'El seguimiento con historia no se borra';
  end if;
  if new.revision_id is distinct from old.revision_id or new.version<>old.version+1 then
    raise exception 'El seguimiento avanza una version sin cambiar su revision';
  end if;
  select numero into n from propuesta_eventos
    where revision_id=new.revision_id and id=new.ultimo_evento_id;
  if n is null or n<>new.version then
    raise exception 'El ultimo evento debe pertenecer a esta revision y version';
  end if;
  return new;
end $$;
drop trigger if exists propuesta_seguimiento_identidad on propuesta_seguimientos;
create trigger propuesta_seguimiento_identidad before update or delete on propuesta_seguimientos
  for each row execute function rea07_identidad_seguimiento();


-- Proyección física mínima para ACL técnica, sin leer valoraciones al consultar07.
create table if not exists propuesta_revision_visibilidad (
 revision_id uuid primary key references propuesta_revisiones(id) on delete restrict,
 requiere_catalogo boolean not null
);
create or replace function rea07_visibilidad_propuesta() returns trigger
language plpgsql as $$ begin
 if jsonb_typeof(new.snapshot->'lineas') is distinct from 'array' then
  raise exception 'La valoración necesita líneas válidas para derivar su acceso';
 end if;
 insert into propuesta_revision_visibilidad(revision_id,requiere_catalogo)
 values(new.revision_id,exists(select 1 from jsonb_array_elements(new.snapshot->'lineas') l
   where l->'origenCoste'->>'tipo'='catalogo'));
 return new;
end $$;
drop trigger if exists propuesta_visibilidad_nueva on propuesta_valoraciones;
create trigger propuesta_visibilidad_nueva after insert on propuesta_valoraciones
 for each row execute function rea07_visibilidad_propuesta();
insert into propuesta_revision_visibilidad(revision_id,requiere_catalogo)
 select v.revision_id,exists(select 1 from jsonb_array_elements(v.snapshot->'lineas') l
   where l->'origenCoste'->>'tipo'='catalogo')
 from propuesta_valoraciones v on conflict(revision_id) do nothing;
drop trigger if exists rea07_inmutable on propuesta_revision_visibilidad;
create trigger rea07_inmutable before update or delete on propuesta_revision_visibilidad
 for each row execute function rea07_inmutable();


-- INTEGRACION REA09 ADITIVA 2026-10-15
-- REA09: historial propio y fuentes; SQL aditivo, sin datos de negocio.
create table if not exists consultas_conversaciones (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references usuarios(id) on delete restrict,
  ambito jsonb not null check (jsonb_typeof(ambito)='object'),
  version integer not null default 0 check (version>=0),
  retencion_dias integer not null default 30 check (retencion_dias in (7,30,90)),
  creado_en timestamptz not null default now(),
  caduca_en timestamptz not null,
  unique(id,propietario_id),
  check(caduca_en=creado_en+retencion_dias*interval '1 day')
);
create table if not exists consultas_turnos (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null, propietario_id uuid not null,
  numero integer not null check(numero between 1 and 100),
  clave_peticion uuid not null, entrada_sha256 text not null,
  version_modelo integer not null default 1 check(version_modelo=1),
  intent text not null, motor text not null check(motor='local-1'),
  acl_fuentes jsonb not null check(jsonb_typeof(acl_fuentes)='object'),
  observado_en timestamptz not null, captura_sha256 text not null,
  creado_en timestamptz not null default now(),
  foreign key(conversacion_id,propietario_id)
    references consultas_conversaciones(id,propietario_id) on delete cascade,
  unique(conversacion_id,numero), unique(propietario_id,clave_peticion),
  check(entrada_sha256~'^[a-f0-9]{64}$' and captura_sha256~'^[a-f0-9]{64}$')
);
create table if not exists consultas_contenidos (
  turno_id uuid primary key references consultas_turnos(id) on delete cascade,
  pregunta text not null check(char_length(pregunta) between 1 and 2000),
  respuesta jsonb not null check(jsonb_typeof(respuesta)='object'),
  check(octet_length(pregunta)+octet_length(respuesta::text)<=262144)
);
create index if not exists consultas_propias on consultas_conversaciones(propietario_id,creado_en,id);
create index if not exists consultas_caducadas on consultas_conversaciones(caduca_en,id);

create or replace function rea09_turno_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'El turno de consulta observado no se sobrescribe';
end $$;
drop trigger if exists consulta_turno_inmutable on consultas_turnos;
create trigger consulta_turno_inmutable before update on consultas_turnos
  for each row execute function rea09_turno_inmutable();
drop trigger if exists consulta_contenido_inmutable on consultas_contenidos;
create trigger consulta_contenido_inmutable before update on consultas_contenidos
  for each row execute function rea09_turno_inmutable();

create or replace function rea09_identidad_conversacion() returns trigger
language plpgsql as $$ begin
  if (to_jsonb(new)-array['version','retencion_dias','caduca_en']) is distinct from
     (to_jsonb(old)-array['version','retencion_dias','caduca_en']) then
    raise exception 'La conversación conserva propietario, ámbito y creación';
  end if;
  if new.version<>old.version+1 then
    raise exception 'La conversación avanza una versión por operación';
  end if;
  return new;
end $$;
drop trigger if exists consulta_identidad on consultas_conversaciones;
create trigger consulta_identidad before update on consultas_conversaciones
  for each row execute function rea09_identidad_conversacion();

-- INTEGRACION REA08 ADITIVA 2026-10-15
-- REA08: activos y servicio; sin hechos físicos ni condiciones implícitas.
create table if not exists servicio_registros (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('activo','acuerdo','incidencia','visita')),
  sala_id uuid not null references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  numero_actual integer not null default 1 check (numero_actual>0),
  actual_id uuid not null,
  creado_por uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(), unique(id,tipo)
);
create table if not exists servicio_versiones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references servicio_registros(id) on delete restrict,
  numero integer not null check (numero>0),
  antecedente_id uuid unique,
  accion text not null check (length(btrim(accion)) between 1 and 80),
  version_modelo integer not null default 1 check (version_modelo=1),
  sala_id uuid not null references salas(id) on delete restrict,
  proyecto_id uuid references proyectos(id) on delete restrict,
  revision_diseno_id uuid references revisiones_diseno(id) on delete restrict,
  hito_entrega_id uuid, -- informativo: deliberadamente SIN FK a hitos_sala
  entrega_snapshot jsonb check (jsonb_typeof(entrega_snapshot)='object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  autor_id uuid not null references usuarios(id) on delete restrict,
  autor_nombre text not null,
  creado_en timestamptz not null default now(),
  check ((numero=1) = (antecedente_id is null)),
  check ((hito_entrega_id is null) = (entrega_snapshot is null)),
  unique(registro_id,numero), unique(registro_id,id),
  foreign key(registro_id,antecedente_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='servicio_actual_fk'
    and conrelid='servicio_registros'::regclass) then
    alter table servicio_registros add constraint servicio_actual_fk
      foreign key(id,actual_id) references servicio_versiones(registro_id,id)
      deferrable initially deferred;
  end if;
end $$;
create table if not exists servicio_activos (
  id uuid primary key,
  tipo text not null default 'activo' check (tipo='activo'),
  sala_origen_id uuid not null references salas(id) on delete restrict,
  origen_tipo text not null check (origen_tipo in ('equipo','manual','sustitucion')),
  equipo_origen_id uuid, -- identidad de fuente, SIN FK al diseño mutable
  ordinal integer check (ordinal between 1 and 10000),
  clave_origen text not null unique,
  fuente jsonb not null check (jsonb_typeof(fuente)='object'),
  fuente_sha256 text not null check (fuente_sha256 ~ '^[0-9a-f]{64}$'),
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict,
  check ((origen_tipo='equipo' and equipo_origen_id is not null and ordinal is not null)
    or (origen_tipo<>'equipo' and equipo_origen_id is null and ordinal is null))
);
create unique index if not exists servicio_activo_unidad_origen_idx
  on servicio_activos(sala_origen_id,equipo_origen_id,ordinal)
  where origen_tipo='equipo';
create table if not exists servicio_acuerdos (
  id uuid primary key,
  tipo text not null default 'acuerdo' check (tipo='acuerdo'),
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict
);
create table if not exists servicio_incidencias (
  id uuid primary key,
  tipo text not null default 'incidencia' check (tipo='incidencia'),
  activo_id uuid not null references servicio_activos(id) on delete restrict,
  activo_version_id uuid not null,
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict,
  foreign key(activo_id,activo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
create table if not exists servicio_visitas (
  id uuid primary key,
  tipo text not null default 'visita' check (tipo='visita'),
  incidencia_id uuid not null references servicio_incidencias(id) on delete restrict,
  tarea_id uuid references plan_tareas(id) on delete restrict,
  foreign key(id,tipo) references servicio_registros(id,tipo) on delete restrict
);
create table if not exists servicio_sustituciones (
  id uuid primary key default gen_random_uuid(),
  antiguo_id uuid not null references servicio_activos(id) on delete restrict,
  antiguo_version_id uuid not null,
  nuevo_id uuid not null references servicio_activos(id) on delete restrict,
  nuevo_version_id uuid not null,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  evidencia jsonb not null check (jsonb_typeof(evidencia)='object'),
  autor_id uuid not null references usuarios(id) on delete restrict,
  creado_en timestamptz not null default now(),
  check (antiguo_id<>nuevo_id), unique(antiguo_id,antiguo_version_id),
  foreign key(antiguo_id,antiguo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict,
  foreign key(nuevo_id,nuevo_version_id)
    references servicio_versiones(registro_id,id) on delete restrict
);
create table if not exists servicio_operaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null,
  hash_peticion text not null check (hash_peticion ~ '^[0-9a-f]{64}$'),
  tipo text not null check (tipo in ('materializar','activo','acuerdo','incidencia','visita','sustituir')),
  resultado jsonb not null check (jsonb_typeof(resultado)='object'),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);
create index if not exists servicio_contexto_idx
  on servicio_registros(sala_id,tipo,id);
create index if not exists servicio_obra_idx
  on servicio_registros(proyecto_id,tipo,id);
create index if not exists servicio_historia_idx
  on servicio_versiones(registro_id,numero desc);
create or replace function servicio_inmutable() returns trigger
language plpgsql as $$ begin
  raise exception 'La historia de servicio no se sobrescribe';
end $$;
do $$ declare tabla text; begin
  foreach tabla in array array['servicio_versiones','servicio_activos',
    'servicio_acuerdos','servicio_incidencias','servicio_visitas',
    'servicio_sustituciones','servicio_operaciones'] loop
    execute format('drop trigger if exists servicio_inmutable on %I',tabla);
    execute format('create trigger servicio_inmutable before update or delete on %I '
      'for each row execute function servicio_inmutable()',tabla);
  end loop;
end $$;

create or replace function servicio_identidad_registro() returns trigger
language plpgsql as $$ declare v record; begin
  if tg_op='DELETE' then
    raise exception 'El registro de servicio con historia no se borra';
  end if;
  if (to_jsonb(new)-array['numero_actual','actual_id','sala_id','proyecto_id']) is distinct from
     (to_jsonb(old)-array['numero_actual','actual_id','sala_id','proyecto_id']) or
     new.numero_actual<>old.numero_actual+1 then
    raise exception 'La identidad de servicio se conserva y avanza una version';
  end if;
  select numero,sala_id,proyecto_id,accion into v from servicio_versiones
    where registro_id=new.id and id=new.actual_id;
  if not found then
    raise exception 'La version de servicio debe pertenecer al registro';
  end if;
  if v.numero<>new.numero_actual or row(v.sala_id,v.proyecto_id) is distinct from
     row(new.sala_id,new.proyecto_id) then
    raise exception 'El contexto de servicio debe coincidir con su version';
  end if;
  if row(new.sala_id,new.proyecto_id) is distinct from row(old.sala_id,old.proyecto_id) and
     (old.tipo<>'activo' or v.accion not in ('trasladar','reconciliar_contexto')) then
    raise exception 'Solo un traslado o conciliacion de activo cambia su contexto';
  end if;
  return new;
end $$;
drop trigger if exists servicio_identidad on servicio_registros;
create trigger servicio_identidad before update or delete on servicio_registros
  for each row execute function servicio_identidad_registro();

-- INTEGRACION REA10 ADITIVA 2026-10-15
-- REA10 aditivo. Fuentes privadas separadas; ningún hecho AV nace al extraer.
create sequence if not exists revision_fuentes_requisitos;
alter table articulos_tecnicos add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
alter table articulos_archivos_tecnicos add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
alter table puertos add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
alter table localizaciones add column if not exists revision_fuente bigint not null default nextval('revision_fuentes_requisitos');
create or replace function rea10_revision_fuente() returns trigger language plpgsql as $$
begin
  new.revision_fuente := nextval('revision_fuentes_requisitos');
  return new;
end $$;
do $$ declare tabla text;
begin
  foreach tabla in array array['articulos_tecnicos','articulos_archivos_tecnicos','puertos','localizaciones'] loop
    execute format('drop trigger if exists rea10_revision_fuente on %I',tabla);
    execute format('create trigger rea10_revision_fuente before insert or update on %I for each row execute function rea10_revision_fuente()',tabla);
  end loop;
end $$;

-- La revisión del artículo también representa el conjunto, incluido el vacío.
-- Así alta -> baja de su último puerto no recupera un checkpoint anterior.
-- Usa el contador E2 existente; no hay una segunda colección de puertos.
create or replace function rea10_revision_articulo_por_puerto() returns trigger language plpgsql as $$
declare anterior uuid; siguiente uuid; articulo uuid;
begin
  if tg_op <> 'INSERT' then anterior := old.articulo_id; end if;
  if tg_op <> 'DELETE' then siguiente := new.articulo_id; end if;
  for articulo in select a.id from articulos a where a.id in (anterior,siguiente) order by a.id for update loop
    -- e2_revision_articulos incrementa siempre, también sin cambiar el modelo.
    update articulos set revision=revision where id=articulo;
  end loop;
  return null;
end $$;
drop trigger if exists rea10_revision_conjunto_puertos on puertos;
create trigger rea10_revision_conjunto_puertos after insert or update or delete on puertos
  for each row execute function rea10_revision_articulo_por_puerto();

create table if not exists requisitos_documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version integer not null default 0 check(version>=0),
  tipo text not null check(tipo in ('archivo_obra','ficha_e2','lote_e2')),
  origen_ref jsonb check(origen_ref is null or (jsonb_typeof(origen_ref)='object' and octet_length(origen_ref::text)<=4096)),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
  estado text not null default 'activo' check(estado in ('activo','retirado','purgado')),
  creado_en timestamptz not null default now(), retirado_en timestamptz, purgado_en timestamptz,
  check((tipo='archivo_obra')=(origen_ref is null)),
  check((estado='activo')=(retirado_en is null)),
  check((estado='purgado')=(purgado_en is not null))
);
create index if not exists requisitos_documentos_obra on requisitos_documentos(proyecto_id,creado_en desc,id);
create index if not exists requisitos_documentos_autor on requisitos_documentos(autor_id,estado);
create table if not exists requisitos_contenidos (
  documento_id uuid primary key references requisitos_documentos(id) on delete restrict,
  metadatos jsonb check(metadatos is null or (jsonb_typeof(metadatos)='object' and octet_length(metadatos::text)<=16384)),
  bytes bytea check(bytes is null or octet_length(bytes) between 1 and 5242880)
);
create table if not exists requisitos_extracciones (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references requisitos_documentos(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version_modelo integer not null default 1 check(version_modelo=1),
  metodo text not null check(metodo in ('pdf_local','txt_utf8','transcripcion_manual','referencia_e2')),
  parser text not null check(length(parser) between 1 and 80),
  parser_version text not null check(length(parser_version) between 1 and 80),
  fuente_sha256 text not null check(fuente_sha256~'^[a-f0-9]{64}$'),
  texto_sha256 text not null check(texto_sha256~'^[a-f0-9]{64}$'),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
  resultado jsonb check(resultado is null or (jsonb_typeof(resultado)='object' and octet_length(resultado::text)<=6291456)),
  creado_en timestamptz not null default now()
);
create index if not exists requisitos_extracciones_fuente on requisitos_extracciones(documento_id,creado_en,id);
create table if not exists requisitos_planes (
  id uuid primary key default gen_random_uuid(),
  extraccion_id uuid not null references requisitos_extracciones(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version integer not null default 0 check(version>=0),
  destino text not null check(destino in ('areas_bom','catalogo','ofertas','tecnico','puerto')),
  estado text not null default 'borrador' check(estado in ('borrador','aplicado','purgado')),
  decisiones jsonb check(decisiones is null or (jsonb_typeof(decisiones)='object' and octet_length(decisiones::text)<=262144)),
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create index if not exists requisitos_planes_autor on requisitos_planes(autor_id,estado,actualizado_en,id);
create table if not exists requisitos_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references requisitos_planes(id) on delete restrict,
  autor_id uuid not null references usuarios(id) on delete restrict,
  version_plan integer not null check(version_plan>=0), clave_peticion uuid not null,
  entrada_sha256 text not null check(entrada_sha256~'^[a-f0-9]{64}$'),
  -- Sólo IDs, hashes y decisiones de negocio; nunca fragmentos copiados de fuente.
  resultado jsonb not null check(jsonb_typeof(resultado)='object' and octet_length(resultado::text)<=262144),
  creado_en timestamptz not null default now(), unique(autor_id,clave_peticion)
);
create table if not exists requisitos_reversiones (
  id uuid primary key default gen_random_uuid(),
  aplicacion_id uuid not null references requisitos_aplicaciones(id) on delete restrict,
  numero integer not null check(numero>=1), antecedente_id uuid unique,
  autor_id uuid not null references usuarios(id) on delete restrict,
  clave_peticion uuid not null, entrada_sha256 text not null check(entrada_sha256~'^[a-f0-9]{64}$'),
  resultado jsonb not null check(jsonb_typeof(resultado)='object' and octet_length(resultado::text)<=262144),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'), creado_en timestamptz not null default now(),
  unique(aplicacion_id,numero), unique(aplicacion_id,id), unique(autor_id,clave_peticion),
  foreign key(aplicacion_id,antecedente_id) references requisitos_reversiones(aplicacion_id,id) on delete restrict,
  check((numero=1)=(antecedente_id is null))
);

-- Auditoría mínima de retirada/purga. Las filas previas conservan null: no se inventan motivos.
alter table requisitos_documentos add column if not exists retirada jsonb
  check(retirada is null or (jsonb_typeof(retirada)='object' and octet_length(retirada::text)<=12288));
alter table requisitos_documentos add column if not exists purga jsonb
  check(purga is null or (jsonb_typeof(purga)='object' and octet_length(purga::text)<=12288));

create or replace function rea10_validar_auditoria(auditoria jsonb, fecha_registro timestamptz)
returns void language plpgsql as $$
declare clave text;
begin
  if auditoria is null or jsonb_typeof(auditoria)<>'object' or
     auditoria-array['motivo','autorId','fecha','diff']<>'{}'::jsonb or
     jsonb_typeof(auditoria->'motivo') is distinct from 'string' or
     length(btrim(auditoria->>'motivo')) not between 1 and 2000 or
     jsonb_typeof(auditoria->'autorId') is distinct from 'string' or
     (auditoria->>'autorId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
     jsonb_typeof(auditoria->'fecha') is distinct from 'string' or
     jsonb_typeof(auditoria->'diff') is distinct from 'object' or
     (auditoria->'diff')-array['bytes','extracciones','planes']<>'{}'::jsonb then
    raise exception 'La auditoría conserva sólo motivo, autor, fecha y cantidades retiradas';
  end if;
  foreach clave in array array['bytes','extracciones','planes'] loop
    if jsonb_typeof(auditoria->'diff'->clave) is distinct from 'number' or
       (auditoria->'diff'->>clave) !~ '^(0|[1-9][0-9]*)$' then
      raise exception 'El diff de retirada conserva cantidades enteras no negativas';
    end if;
  end loop;
  if fecha_registro is null or (auditoria->>'fecha')::timestamptz<>fecha_registro then
    raise exception 'La auditoría conserva la fecha exacta de su operación';
  end if;
end $$;

create or replace function rea10_identidad_documento() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'La fuente conserva tombstone e historia'; end if;
  if (to_jsonb(new)-array['version','estado','retirado_en','purgado_en','retirada','purga']) is distinct from
     (to_jsonb(old)-array['version','estado','retirado_en','purgado_en','retirada','purga']) then
    raise exception 'La identidad y procedencia de la fuente son inmutables';
  end if;
  if new.version<>old.version+1 then raise exception 'La fuente avanza una versión por operación'; end if;
  if old.estado='purgado' or (old.estado='retirado' and new.estado='activo') then
    raise exception 'La fuente retirada no se reactiva implícitamente';
  end if;
  if old.retirado_en is not null and new.retirado_en is distinct from old.retirado_en then
    raise exception 'La retirada original se conserva';
  end if;
  if old.retirada is not null and new.retirada is distinct from old.retirada then
    raise exception 'La auditoría de retirada no se sobrescribe';
  end if;
  if new.retirada is distinct from old.retirada and
     (old.estado<>'activo' or new.estado not in ('retirado','purgado')) then
    raise exception 'La auditoría de retirada se registra con la transición';
  end if;
  if old.estado='activo' and new.estado in ('retirado','purgado') then
    perform rea10_validar_auditoria(new.retirada,new.retirado_en);
  end if;
  if new.purga is distinct from old.purga and
     (old.estado='purgado' or new.estado<>'purgado') then
    raise exception 'La auditoría de purga se registra con la transición';
  end if;
  if new.estado='purgado' then
    perform rea10_validar_auditoria(new.purga,new.purgado_en);
  end if;
  return new;
end $$;

drop trigger if exists rea10_documento_identidad on requisitos_documentos;
create trigger rea10_documento_identidad before update or delete on requisitos_documentos
  for each row execute function rea10_identidad_documento();

create or replace function rea10_contenido_fuente() returns trigger language plpgsql as $$
declare documento requisitos_documentos; identificador uuid;
begin
  identificador:=case when tg_op='DELETE' then old.documento_id else new.documento_id end;
  select * into documento from requisitos_documentos where id=identificador;
  if tg_op='DELETE' then
    if documento.estado<>'purgado' then raise exception 'La fuente activa o retirada conserva su contenido'; end if;
    return old;
  end if;
  if tg_op='UPDATE' and (documento.estado<>'purgado' or new.bytes is not null or new.metadatos is not null or
      new.documento_id<>old.documento_id) then raise exception 'Sólo la purga explícita retira contenido'; end if;
  if documento.estado='purgado' then
    if new.bytes is not null or new.metadatos is not null then raise exception 'Una fuente purgada no recupera contenido'; end if;
  elsif new.metadatos is null or ((documento.tipo='archivo_obra')<>(new.bytes is not null)) then
    raise exception 'Archivo y referencia conservan una sola fuente';
  end if;
  if new.bytes is not null and encode(public.digest(new.bytes,'sha256'),'hex')<>documento.sha256 then
    raise exception 'Los bytes no coinciden con la fuente';
  end if;
  return new;
end $$;
drop trigger if exists rea10_contenido on requisitos_contenidos;
create trigger rea10_contenido before insert or update or delete on requisitos_contenidos
  for each row execute function rea10_contenido_fuente();

create or replace function rea10_extraccion_inmutable() returns trigger language plpgsql as $$
declare estado_fuente text;
begin
  if tg_op='DELETE' then raise exception 'La extracción conserva hashes y procedencia'; end if;
  select estado into estado_fuente from requisitos_documentos where id=old.documento_id;
  if estado_fuente<>'purgado' or new.resultado is not null or
     (to_jsonb(new)-'resultado') is distinct from (to_jsonb(old)-'resultado') then
    raise exception 'La extracción es inmutable salvo retirada de contenido por purga';
  end if;
  return new;
end $$;
drop trigger if exists rea10_extraccion_historia on requisitos_extracciones;
create trigger rea10_extraccion_historia before update or delete on requisitos_extracciones
  for each row execute function rea10_extraccion_inmutable();

create or replace function rea10_plan_cas() returns trigger language plpgsql as $$
declare estado_fuente text;
begin
  if tg_op='DELETE' then raise exception 'El plan conserva decisiones e historia'; end if;
  if (to_jsonb(new)-array['version','estado','decisiones','actualizado_en']) is distinct from
     (to_jsonb(old)-array['version','estado','decisiones','actualizado_en']) or new.version<>old.version+1 then
    raise exception 'El plan conserva identidad y avanza una versión';
  end if;
  select d.estado into estado_fuente from requisitos_documentos d join requisitos_extracciones e on e.documento_id=d.id
    where e.id=old.extraccion_id;
  if new.estado='purgado' then
    if estado_fuente<>'purgado' or new.decisiones is not null then raise exception 'La purga del plan requiere fuente purgada'; end if;
  elsif old.estado<>'borrador' or estado_fuente<>'activo' or new.decisiones is null then
    raise exception 'El plan aplicado o de fuente retirada no se vuelve a editar';
  end if;
  return new;
end $$;
drop trigger if exists rea10_plan_version on requisitos_planes;
create trigger rea10_plan_version before update or delete on requisitos_planes
  for each row execute function rea10_plan_cas();

create or replace function rea10_historia_inmutable() returns trigger language plpgsql as $$
begin raise exception 'La aplicación y cada intento de reversión conservan su historia'; end $$;
drop trigger if exists rea10_aplicacion_historia on requisitos_aplicaciones;
create trigger rea10_aplicacion_historia before update or delete on requisitos_aplicaciones
  for each row execute function rea10_historia_inmutable();
drop trigger if exists rea10_reversion_historia on requisitos_reversiones;
create trigger rea10_reversion_historia before update or delete on requisitos_reversiones
  for each row execute function rea10_historia_inmutable();

create or replace function rea10_alta_extraccion() returns trigger language plpgsql as $$
declare fuente requisitos_documentos;
begin
  select * into fuente from requisitos_documentos where id=new.documento_id;
  if fuente.estado<>'activo' or new.fuente_sha256<>fuente.sha256 or new.resultado is null then
    raise exception 'La extracción requiere fuente activa, hash exacto y resultado completo';
  end if;
  return new;
end $$;
drop trigger if exists rea10_extraccion_fuente on requisitos_extracciones;
create trigger rea10_extraccion_fuente before insert on requisitos_extracciones
  for each row execute function rea10_alta_extraccion();

create or replace function rea10_consistencia_plan() returns trigger language plpgsql as $$
declare plan_actual requisitos_planes; plan_id_actual uuid; cantidad integer;
begin
  if tg_table_name='requisitos_planes' then plan_id_actual:=new.id;
  else plan_id_actual:=new.plan_id; end if;
  select * into plan_actual from requisitos_planes where id=plan_id_actual;
  select count(*)::int into cantidad from requisitos_aplicaciones where plan_id=plan_id_actual;
  if (plan_actual.estado='aplicado' and cantidad<>1) or
     (plan_actual.estado='borrador' and cantidad<>0) then
    raise exception 'El plan y su única aplicación se confirman en la misma transacción';
  end if;
  if tg_table_name='requisitos_aplicaciones' then
    if plan_actual.estado<>'aplicado' or plan_actual.autor_id<>new.autor_id or plan_actual.version<=new.version_plan then
      raise exception 'La aplicación conserva autor y versión confirmada del plan';
    end if;
  end if;
  return null;
end $$;
drop trigger if exists rea10_plan_consistente on requisitos_planes;
create constraint trigger rea10_plan_consistente after insert or update on requisitos_planes
  deferrable initially deferred for each row execute function rea10_consistencia_plan();
drop trigger if exists rea10_aplicacion_consistente on requisitos_aplicaciones;
create constraint trigger rea10_aplicacion_consistente after insert on requisitos_aplicaciones
  deferrable initially deferred for each row execute function rea10_consistencia_plan();

create or replace function rea10_purga_completa() returns trigger language plpgsql as $$
begin
  if new.estado='purgado' and (
    exists(select 1 from requisitos_contenidos c where c.documento_id=new.id and (c.bytes is not null or c.metadatos is not null)) or
    exists(select 1 from requisitos_extracciones e where e.documento_id=new.id and e.resultado is not null) or
    exists(select 1 from requisitos_planes p join requisitos_extracciones e on e.id=p.extraccion_id
      where e.documento_id=new.id and (p.decisiones is not null or p.estado<>'purgado'))
  ) then raise exception 'La purga retira todas las copias de contenido en la misma transacción'; end if;
  return null;
end $$;
drop trigger if exists rea10_purga_atomica on requisitos_documentos;
create constraint trigger rea10_purga_atomica after update on requisitos_documentos
  deferrable initially deferred for each row execute function rea10_purga_completa();

-- =====================================================================
-- Migración 2026-08 · Editor del diagrama de sala
--
-- Es el mismo bloque que vive al final de db/schema.sql: schema.sql sigue
-- siendo la fuente completa y este fichero es el delta revisable de esta
-- fase. Idempotente: se puede aplicar dos veces sin efecto.
--
-- Aplicar con:
--   node scripts/db.mjs db/migraciones/2026-08-diagrama-sala.sql
--
-- NO aplicada en Neon: requiere autorización expresa antes de tocar
-- producción, y va SIEMPRE antes del push que despliega el código que la
-- consume.
-- =====================================================================

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

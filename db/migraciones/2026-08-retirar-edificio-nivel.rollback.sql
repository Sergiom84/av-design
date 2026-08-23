-- Deshace 2026-08-retirar-edificio-nivel.sql.
--
-- Devuelve las dos columnas, vacías. Lo que hubiera escrito en ellas no
-- vuelve: `drop column` no se deshace. Sirve para que el código anterior
-- compile y arranque contra la base, no para recuperar datos.

begin;

alter table salas add column if not exists edificio text;
alter table salas add column if not exists nivel text;

commit;

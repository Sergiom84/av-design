-- Retira `salas.edificio` y `salas.nivel`.
--
-- Eran de antes de la jerarquía Proyecto → Localización → Sala. Desde que la
-- obra agrupa por localización ("Edificio B · Planta 3"), la sala pedía la
-- planta dos veces con dos nombres distintos, y quien la daba de alta no
-- sabía cuál de las dos mandaba.
--
-- Se hace ahora porque la aplicación está en desarrollo y sus salas son de
-- prueba: nunca habrá menos datos que perder. Contra una base con inventario
-- real esto NO se aplica sin volcar antes las dos columnas a localizaciones.
--
-- La importación futura del inventario (docs/03-datos-reales.md: cada línea
-- trae edificio y nivel) mapea ese texto a una localización de su obra, que
-- es donde vive ahora la geografía fina.
--
-- Rollback: 2026-08-retirar-edificio-nivel.rollback.sql devuelve las columnas
-- vacías. El contenido no vuelve: un `drop column` no se deshace.

begin;

alter table salas drop column if exists edificio;
alter table salas drop column if exists nivel;

commit;

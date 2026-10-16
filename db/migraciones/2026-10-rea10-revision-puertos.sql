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

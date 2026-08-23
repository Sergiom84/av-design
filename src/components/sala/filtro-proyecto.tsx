import { Boton } from '@/components/ui';
import type { ProyectoResumen } from '@/lib/datos-proyectos';

/**
 * Filtrar las salas por obra. Antes el filtro solo llegaba por la
 * redirección del alta (`/salas?proyecto=`) y la única acción visible era
 * quitarlo: una vez quitado no había forma de volver a ponerlo.
 *
 * Es un formulario GET, no un `onChange` con JavaScript: el filtro acaba en
 * la dirección, se puede enlazar y se vuelve con el botón del navegador,
 * igual que `?abierta=` en plantillas. "Todas las obras" es el valor vacío,
 * así que quitar el filtro es una opción más del desplegable y no un enlace
 * aparte que desaparece.
 */
export function FiltroDeProyecto({
  proyectos,
  elegido,
}: {
  proyectos: ProyectoResumen[];
  elegido?: string;
}) {
  if (proyectos.length === 0) return null;

  return (
    <form method="get" action="/salas" className="flex items-center gap-2">
      <label className="sr-only" htmlFor="filtro-proyecto">
        Obra
      </label>
      <select
        id="filtro-proyecto"
        name="proyecto"
        defaultValue={elegido ?? ''}
        className="max-w-56"
      >
        <option value="">Todas las obras</option>
        {proyectos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
            {p.codigo ? ` · ${p.codigo}` : ''}
          </option>
        ))}
      </select>
      <Boton variante="secundario">Filtrar</Boton>
    </form>
  );
}

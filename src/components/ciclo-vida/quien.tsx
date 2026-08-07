import { listarTecnicosConRoles } from '@/lib/datos-ciclo';
import { tecnicosDeRol, type RolTecnico } from '@/lib/ciclo-vida';

/**
 * El campo "Quién" con la lista de técnicos del departamento. Texto libre con
 * sugerencias, como la sede: el nombre de la lista es lo normal, pero un
 * sustituto de agosto también recibe pedidos. Con rol, sugiere solo a los de
 * ese rol; sin rol, a todos los activos.
 */
export async function QuienTecnico({
  rol,
  nombre = 'quien',
  ancho = 'w-32',
  valorInicial,
}: {
  rol?: RolTecnico;
  nombre?: string;
  ancho?: string;
  valorInicial?: string | null;
}) {
  const { tecnicos, roles } = await listarTecnicosConRoles();
  const sugeridos = rol
    ? tecnicosDeRol(tecnicos, roles, rol)
    : tecnicos.filter((t) => t.activo);
  const idLista = `tecnicos-${rol ?? 'todos'}`;

  return (
    <>
      <input
        name={nombre}
        list={idLista}
        className={ancho}
        defaultValue={valorInicial ?? ''}
      />
      <datalist id={idLista}>
        {sugeridos.map((t) => (
          <option key={t.id} value={t.nombre} />
        ))}
      </datalist>
    </>
  );
}

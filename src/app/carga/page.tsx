import { hayConfiguracion } from '@/lib/db';
import { listarCargas } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace, Tarjeta } from '@/components/ui';
import { ListaCargas } from '@/components/carga/lista-cargas';

export const dynamic = 'force-dynamic';

export default async function Cargas() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const cargas = await listarCargas();
  const abiertas = cargas.filter((c) => c.estado !== 'cerrada');
  const cerradas = cargas.filter((c) => c.estado === 'cerrada');

  return (
    <>
      <Cabecera
        titulo="Carga"
        descripcion="Qué material sale a cada obra. La lista se marca desde el móvil, de pie en el almacén."
        acciones={<Enlace href="/salas">Ver salas</Enlace>}
      />

      <div className="space-y-6">
        <ListaCargas cargas={abiertas} titulo="Cargas abiertas" />
        {cerradas.length > 0 && (
          <ListaCargas cargas={cerradas} titulo="Obras cerradas" />
        )}

        {cargas.length === 0 && (
          <Tarjeta titulo="Cómo se prepara una carga">
            <ol className="list-decimal ml-5 space-y-2">
              <li>
                En la <Enlace href="/salas">sala</Enlace>, reservas el material que va a
                esa obra.
              </li>
              <li>Preparas la carga: la lista sale de esas reservas.</li>
              <li>En el almacén marcas línea a línea lo que metes en la furgoneta.</li>
              <li>Al confirmar, lo marcado sale del stock y las reservas quedan servidas.</li>
              <li>Al volver, cierras la obra: qué se instaló, qué sobra y qué se rompió.</li>
            </ol>
          </Tarjeta>
        )}
      </div>
    </>
  );
}

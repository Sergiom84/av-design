import { hayConfiguracion } from '@/lib/db';
import { listarSalas } from '@/lib/datos';
import { listarRevisiones } from '@/lib/datos-checkin';
import { SinConfigurar } from '@/components/sin-configurar';
import { Cabecera, Enlace, Tarjeta } from '@/components/ui';
import { AltaDeVisita } from '@/components/checkin/alta-visita';
import { ListaVisitas } from '@/components/checkin/lista-visitas';

export const dynamic = 'force-dynamic';

/**
 * El check-in de sala: la visita física antes de montar.
 *
 * Es lo contrario de la revisión de montaje, que se calcula sola con lo que ya
 * hay en la base de datos. Que la roseta dé enlace o que la pared aguante el
 * soporte no se deriva de nada: se va a la sala y se mira.
 */
export default async function CheckIn() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const [revisiones, salas] = await Promise.all([listarRevisiones(), listarSalas()]);
  const abiertas = revisiones.filter((r) => !r.cerrada);
  const cerradas = revisiones.filter((r) => r.cerrada);

  return (
    <>
      <Cabecera
        titulo="Check-in"
        descripcion="La visita a la sala antes de montar. Se marca punto por punto desde el móvil, de pie en la sala."
        acciones={<Enlace href="/salas">Ver salas</Enlace>}
      />

      <div className="max-w-4xl space-y-6">
        <AltaDeVisita salas={salas} />

        <ListaVisitas
          revisiones={abiertas}
          titulo="Visitas abiertas"
          vacio="Ninguna visita abierta. Se abre una eligiendo la sala, arriba."
        />

        {cerradas.length > 0 && (
          <ListaVisitas revisiones={cerradas} titulo="Visitas cerradas" />
        )}

        {revisiones.length === 0 && (
          <Tarjeta titulo="Qué se comprueba en la sala">
            <ol className="list-decimal ml-5 space-y-2">
              <li>Se mide la sala de verdad y se compara con lo que dice la plantilla.</li>
              <li>La mesa: medidas y dónde queda la caja de conexiones.</li>
              <li>La pared de la pantalla: si aguanta el soporte y si hay corriente.</li>
              <li>La roseta de red: su código y si da enlace.</li>
              <li>El acceso: furgoneta, llave y horario de trabajo.</li>
            </ol>
          </Tarjeta>
        )}
      </div>
    </>
  );
}

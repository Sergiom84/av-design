import { hayConfiguracion } from '@/lib/db';
import { listarPlantillas, puertosDeArticulos, tiradasDePlantillas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera } from '@/components/ui';
import { FichaDePlantilla } from '@/components/plantilla/ficha';
import { PrioridadDePlantillas } from '@/components/plantilla/prioridad';

export const dynamic = 'force-dynamic';

/**
 * Las medidas de las diecisiete plantillas se editan de una sentada, sin abrir
 * nada. El equipamiento se despliega solo en la que dice `?abierta=`: son cien
 * filas con su formulario, y todas a la vez pesaban más que el resto junto.
 * Va por dirección y no por acordeón de cliente para que se pueda enlazar,
 * volver con el botón del navegador y funcionar sin JavaScript.
 */
export default async function Plantillas({ searchParams }: PageProps<'/plantillas'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { abierta } = await searchParams;
  const idAbierta = typeof abierta === 'string' ? abierta : null;
  // Las tiradas de las diecisiete en una consulta, no una por plantilla.
  const [plantillas, tiradas] = await Promise.all([
    listarPlantillas(),
    tiradasDePlantillas(),
  ]);
  const puertos = await puertosDeArticulos(
    plantillas.flatMap((p) => p.lineas.map((l) => l.articulo_id).filter((id): id is string => Boolean(id))),
  );
  const sinMedidas = plantillas.filter((p) => p.largo_m == null).length;

  return (
    <>
      <Cabecera
        titulo="Plantillas de sala"
        descripcion="Deducidas de vuestro inventario. Rellena las medidas una sola vez y ajusta el equipamiento: cada sala nueva lo hereda y solo corriges lo que cambie."
      />

      {sinMedidas > 0 && (
        <div className="mb-6">
          <Aviso>
            {sinMedidas} de {plantillas.length} plantillas siguen sin medidas. Empieza por
            las de arriba: son las que más salas representan.
          </Aviso>
        </div>
      )}

      <div className="space-y-6">
        <PrioridadDePlantillas plantillas={plantillas} />

        {plantillas.map((p, i) => (
          <FichaDePlantilla
            key={p.id}
            plantilla={p}
            lineas={p.lineas}
            tiradas={tiradas.filter((t) => t.plantilla_id === p.id)}
            puertos={puertos}
            orden={i + 1}
            abierta={p.id === idAbierta}
          />
        ))}
      </div>
    </>
  );
}

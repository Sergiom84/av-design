import Link from 'next/link';
import { Tarjeta } from '@/components/ui';
import type { LineaPlantilla, PlantillaSala, TiradaPlantilla } from '@/lib/tipos';
import { EquipamientoDePlantilla } from './equipamiento';
import { MedidasDePlantilla } from './medidas';
import { TiradasDePlantilla } from './tiradas';

/**
 * Una plantilla: su equipamiento estándar a la izquierda y sus medidas a la
 * derecha. El ancla `#p-<id>` es lo que permite venir aquí desde la tabla de
 * prioridad y desde "guardar como plantilla".
 *
 * El equipamiento solo se despliega en la plantilla abierta, la que dice
 * `?abierta=` en la dirección. Las diecisiete tablas editables a la vez eran
 * cien filas con su formulario cada una, y pesaban más que todo lo demás
 * junto. Las medidas, en cambio, se editan siempre sin abrir nada: es lo que
 * se rellena de una sentada con las mediciones en la mano.
 */
export function FichaDePlantilla({
  plantilla,
  lineas,
  tiradas,
  orden,
  abierta,
}: {
  plantilla: PlantillaSala & { lineas: LineaPlantilla[] };
  lineas: LineaPlantilla[];
  tiradas: TiradaPlantilla[];
  orden: number;
  abierta: boolean;
}) {
  const p = plantilla;
  const heredadas = lineas.filter((l) => !l.opcional).length;
  const ancla = `#p-${p.id}`;

  return (
    <div id={`p-${p.id}`} className="scroll-mt-4">
      <Tarjeta
        titulo={`${orden}. ${p.nombre}`}
        pie={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {p.n_salas_reales
                ? `${p.n_salas_reales} salas del inventario responden a esta plantilla`
                : 'Sin salas del inventario asociadas'}
            </span>
            <span>
              {heredadas} equipos se heredan
              {lineas.length > heredadas ? `, ${lineas.length - heredadas} no` : ''}
            </span>
            <span>
              {tiradas.length === 0
                ? 'sin tiradas tipo'
                : `${tiradas.length} tiradas tipo`}
            </span>
            <Link
              href={`/salas/nueva?plantilla=${p.id}`}
              className="enlace"
            >
              Crear sala con esta plantilla
            </Link>
          </span>
        }
      >
        <div className="grid xl:grid-cols-[1fr_15rem] gap-8 items-start">
          <div>
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <span className="t-etiqueta">Equipamiento estándar</span>
              <Link
                href={abierta ? `/plantillas${ancla}` : `/plantillas?abierta=${p.id}${ancla}`}
                className="enlace"
              >
                {abierta ? 'Cerrar' : 'Editar equipamiento'}
              </Link>
            </div>

            {abierta ? (
              <>
                <EquipamientoDePlantilla plantillaId={p.id} lineas={lineas} orden={orden} />
                <div className="mt-8">
                  <div className="t-etiqueta mb-2">Tiradas tipo</div>
                  <TiradasDePlantilla
                    plantillaId={p.id}
                    lineas={lineas}
                    tiradas={tiradas}
                  />
                </div>
              </>
            ) : lineas.length === 0 ? (
              <p className="text-tinta-tenue">Sin equipamiento definido.</p>
            ) : (
              // Un solo párrafo, no una lista: se ve qué lleva la plantilla sin
              // abrirla y sin pagar el marcado de cien filas.
              <p className="text-tinta-tenue">
                {lineas
                  .map((l) => `${l.cantidad} × ${l.modelo_texto ?? l.categoria}`)
                  .join(' · ')}
              </p>
            )}
          </div>
          <MedidasDePlantilla plantilla={p} />
        </div>
      </Tarjeta>
    </div>
  );
}

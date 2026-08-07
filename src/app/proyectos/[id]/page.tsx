import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Boton, Cabecera, Dato, Enlace, Tarjeta, Vacio } from '@/components/ui';
import { borrarProyecto } from '@/app/acciones-proyectos';
import { listarSalasSinProyecto, obtenerProyecto } from '@/lib/datos-proyectos';
import {
  hitosDeProyecto,
  listarTecnicosConRoles,
  tablasDeCicloListas,
} from '@/lib/datos-ciclo';
import { estadoDeProyecto, ETIQUETA_ESTADO_PROYECTO } from '@/lib/ciclo-vida';
import { agruparSalasPorLocalizacion, resumenDeProyecto } from '@/lib/proyecto';
import { HitosDeProyecto } from '@/components/proyecto/hitos';
import { LocalizacionesDelProyecto } from '@/components/proyecto/localizaciones';
import { AdopcionDeSalas } from '@/components/proyecto/adopcion';

export const dynamic = 'force-dynamic';

const ETIQUETA_ESTADO_PEDIDO: Record<string, string> = {
  borrador: 'Borrador',
  pedido: 'Pedido',
  recibido_parcial: 'Recibido parcial',
  recibido: 'Recibido',
};

/**
 * La portada operativa de la obra: sus localizaciones con sus salas, el
 * estado agregado, los pedidos que la abastecen y sus hitos. Todo derivado;
 * lo único que se registra a mano aquí son los hitos.
 */
export default async function PortadaProyecto({
  params,
  searchParams,
}: PageProps<'/proyectos/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const { borrar } = await searchParams;
  const proyecto = await obtenerProyecto(id);
  if (!proyecto) notFound();

  const [hitos, { tecnicos, roles }, salasSueltas, cicloListo] = await Promise.all([
    hitosDeProyecto(proyecto.id),
    listarTecnicosConRoles(),
    listarSalasSinProyecto(),
    tablasDeCicloListas(),
  ]);

  const resumen = resumenDeProyecto({ salas: proyecto.salas, pedidos: proyecto.pedidos });
  const grupos = agruparSalasPorLocalizacion(proyecto.localizaciones, proyecto.salas);
  const estado = estadoDeProyecto(hitos);

  return (
    <>
      <Cabecera
        titulo={proyecto.nombre}
        descripcion={[
          proyecto.codigo,
          proyecto.sede,
          ETIQUETA_ESTADO_PROYECTO[estado],
          proyecto.notas,
        ]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          <>
            {estado !== 'cerrado' && (
              <Enlace href={`/salas/nueva?proyecto=${proyecto.id}`}>Nueva sala</Enlace>
            )}
            {estado !== 'cerrado' && (
              <form action={borrarProyecto}>
                <input type="hidden" name="id" value={proyecto.id} />
                <Boton variante="peligro">Borrar proyecto</Boton>
              </form>
            )}
          </>
        }
      />

      {!cicloListo && (
        <div className="mb-6">
          <Aviso tono="alerta">
            Faltan las tablas de técnicos e hitos: el despliegue llegó antes que su
            migración (db/migraciones/2026-08-jerarquia-p1.sql). Los hitos y estados
            de esta portada salen vacíos hasta aplicarla.
          </Aviso>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="tarjeta p-4">
          <Dato etiqueta="Salas" valor={resumen.salas} />
        </div>
        <div className="tarjeta p-4">
          <Dato etiqueta="Sin medidas" valor={resumen.sin_medidas} />
        </div>
        <div className="tarjeta p-4">
          <Dato etiqueta="En diseño" valor={resumen.en_diseno} />
        </div>
        <div className="tarjeta p-4">
          <Dato etiqueta="Instaladas" valor={resumen.instaladas} />
        </div>
        <div className="tarjeta p-4">
          <Dato etiqueta="Entregadas" valor={resumen.entregadas} />
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_24rem] gap-6 items-start [&>*]:min-w-0">
        <div className="space-y-6 min-w-0">
          <LocalizacionesDelProyecto
            proyectoId={proyecto.id}
            grupos={grupos}
            cerrado={estado === 'cerrado'}
          />
          {estado !== 'cerrado' && (
            <AdopcionDeSalas
              localizaciones={proyecto.localizaciones}
              salasSueltas={salasSueltas}
            />
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <HitosDeProyecto
            proyectoId={proyecto.id}
            hitos={hitos}
            tecnicos={tecnicos}
            roles={roles}
            salasSinEntregar={resumen.salas - resumen.entregadas}
            confirmarBorrado={typeof borrar === 'string' ? borrar : undefined}
          />

          <Tarjeta
            titulo="Pedidos del proyecto"
            pie={
              resumen.pedidos_en_curso > 0
                ? `${resumen.pedidos_en_curso} en curso.`
                : undefined
            }
          >
            {proyecto.pedidos.length === 0 ? (
              <Vacio>
                Sin pedidos. Se crean desde el qué falta de cada sala y heredan la obra.
              </Vacio>
            ) : (
              <table className="datos">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {proyecto.pedidos.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Enlace href={`/compras/${p.id}`}>
                          {p.referencia ?? p.proveedor ?? 'Pedido'}
                        </Enlace>
                      </td>
                      <td>{ETIQUETA_ESTADO_PEDIDO[p.estado] ?? p.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { CroquisSala } from '@/components/croquis/croquis-sala';
import { EstadoMontaje } from '@/components/revision/estado-montaje';
import { Medidas } from '@/components/sala/medidas';
import { BorrarSala } from '@/components/sala/borrar';
import { CicloDeVidaSala } from '@/components/ciclo-vida/tarjeta-sala';
import { avisosDeEntrega, proyectoCerrado } from '@/lib/ciclo-vida';
import { cicloDeSala, listarTecnicosConRoles } from '@/lib/datos-ciclo';
import { resumirMontaje, type Semaforo } from '@/lib/revision';
import { ETIQUETA_ESTADO_SALA, TONO_ESTADO_SALA, estadoDeSalaEnPortada } from '@/lib/proyecto';
import { Dato, Estado, Tarjeta, type TonoEstado } from '@/components/ui';
import { fichaConAlmacen } from './datos-ficha';

export const dynamic = 'force-dynamic';

const ETIQUETA_SEMAFORO_RESUMEN: Record<Semaforo, string> = {
  listo: 'Montable',
  aviso: 'Montable con avisos',
  bloqueo: 'No montable',
  no_aplica: 'Sin datos',
};

const TONO_SEMAFORO_RESUMEN: Record<Semaforo, TonoEstado> = {
  listo: 'listo',
  aviso: 'aviso',
  bloqueo: 'bloqueo',
  no_aplica: 'neutro',
};

/**
 * Resumen: primero si la sala se puede montar y qué falta, después el
 * detalle. Arriba el semáforo y la etapa; debajo croquis y revisión de
 * montaje en paralelo cuando hay ancho; medidas en lectura compacta; ciclo de
 * vida; y borrar sala al final, aparte del trabajo diario.
 */
export default async function ResumenSala({
  params,
  searchParams,
}: PageProps<'/salas/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const { borrar, editar } = await searchParams;
  const ficha = await fichaConAlmacen(id);
  if (!ficha) notFound();

  const { sala, equipos, conexiones, tomas, resultados, puntosMontaje } = ficha;

  const [ciclo, { tecnicos, roles }] = await Promise.all([
    cicloDeSala(sala.id, sala.proyecto_id ?? null),
    listarTecnicosConRoles(),
  ]);

  const cerrado = proyectoCerrado(ciclo.hitosProyecto);
  const montaje = resumirMontaje(puntosMontaje);
  const etapa = estadoDeSalaEnPortada({
    id: sala.id,
    nombre: sala.nombre,
    codigo: sala.codigo,
    localizacion_id: sala.localizacion_id ?? null,
    largo_m: sala.largo_m,
    ancho_m: sala.ancho_m,
    alto_m: sala.alto_m,
    n_conexiones: conexiones.length,
    instalada: ciclo.hitosSala.some((h) => h.tipo === 'instalacion'),
    entregada: ciclo.hitosSala.some((h) => h.tipo === 'entrega'),
  });

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Estado tono={TONO_SEMAFORO_RESUMEN[montaje.estado]}>
              {ETIQUETA_SEMAFORO_RESUMEN[montaje.estado]}
            </Estado>
            <Estado tono={TONO_ESTADO_SALA[etapa]}>{ETIQUETA_ESTADO_SALA[etapa]}</Estado>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Dato etiqueta="Tipología" valor={sala.tipologia || '—'} />
            <Dato etiqueta="Aforo" valor={sala.aforo ?? '—'} />
            <Dato
              etiqueta="Medidas"
              valor={
                sala.largo_m && sala.ancho_m && sala.alto_m
                  ? `${sala.largo_m} × ${sala.ancho_m} × ${sala.alto_m}`
                  : 'sin medir'
              }
              sufijo="m"
            />
            <Dato etiqueta="Equipos" valor={equipos.length} />
          </div>
        </div>
      </Tarjeta>

      <div className="grid xl:grid-cols-2 gap-6 items-start [&>*]:min-w-0">
        <CroquisSala
          sala={sala}
          equipos={equipos}
          conexiones={conexiones}
          tomas={tomas}
          metrosPorConexion={
            new Map(resultados.map((r) => [r.conexion_id, r.longitud_m]))
          }
        />
        <EstadoMontaje puntos={puntosMontaje} />
      </div>

      <Medidas sala={sala} editar={editar === 'medidas'} />

      <CicloDeVidaSala
        salaId={sala.id}
        hitosProyecto={ciclo.hitosProyecto}
        hitosSala={ciclo.hitosSala}
        recepciones={ciclo.recepciones}
        tecnicos={tecnicos}
        roles={roles}
        avisosEntrega={avisosDeEntrega(puntosMontaje)}
        confirmarBorrado={typeof borrar === 'string' && borrar !== 'sala' ? borrar : undefined}
      />

      {!cerrado && <BorrarSala salaId={sala.id} confirmar={borrar === 'sala'} />}
    </div>
  );
}

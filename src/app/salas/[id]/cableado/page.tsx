import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { EsquemaSala } from '@/components/diagrama/esquema-sala';
import { TablaCables } from '@/components/cable-schedule/tabla-cables';
import { ResultadoDelCable } from '@/components/sala/resultado-cable';
import { Conexiones } from '@/components/sala/conexiones';
import { fichaDeSala } from '../datos-ficha';

export const dynamic = 'force-dynamic';

/**
 * El cableado entero: esquema de conexiones, tabla de cables (el entregable),
 * metros calculados y el alta de conexiones. El esquema y la tabla usan los
 * mismos identificadores: las dos vistas salen de `identificadoresDeCable()`.
 */
export default async function CableadoSala({
  params,
  searchParams,
}: PageProps<'/salas/[id]/cableado'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const { puertos: vistaPuertos } = await searchParams;
  const ficha = await fichaDeSala(id);
  if (!ficha) notFound();

  const {
    sala,
    equipos,
    conexiones,
    puertos,
    articulos,
    porId,
    sinMedidas,
    resultados,
    filasCable,
  } = ficha;

  return (
    <div className="space-y-6 [&>*]:min-w-0">
      <EsquemaSala
        salaId={sala.id}
        todosLosPuertos={vistaPuertos === 'todos'}
        entrada={{
          equipos,
          conexiones,
          puertosPorArticulo: puertos.reduce((mapa, p) => {
            const lista = mapa.get(p.articulo_id) ?? [];
            lista.push(p);
            mapa.set(p.articulo_id, lista);
            return mapa;
          }, new Map<string, (typeof puertos)[number][]>()),
          descripcionArticulo: new Map(
            equipos.map((e) => {
              const a = porId.get(e.articulo_id);
              return [e.articulo_id, `${a?.marca ?? ''} ${a?.modelo ?? ''}`.trim()];
            }),
          ),
          categoriaArticulo: new Map(
            equipos.map((e) => [e.articulo_id, porId.get(e.articulo_id)?.categoria ?? '']),
          ),
        }}
      />
      <TablaCables filas={filasCable} nombreSala={sala.nombre} />
      <ResultadoDelCable resultados={resultados} sinMedidas={sinMedidas} />
      <Conexiones
        sala={sala}
        conexiones={conexiones}
        equipos={equipos}
        puertos={puertos}
        articulos={articulos}
      />
    </div>
  );
}

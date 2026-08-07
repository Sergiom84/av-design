import Link from 'next/link';
import { construirDiagrama, type EntradaDiagrama } from '@/lib/diagrama';
import { Tarjeta, Vacio } from '@/components/ui';
import { DibujoEsquema } from './dibujo-esquema';

/**
 * El esquema de conexiones dentro de la ficha de sala: el dibujo de bloques
 * que en XTEN-AV es el line schematic de xDraw, aquí derivado de las
 * conexiones que ya existen. No sabe consultar nada: recibe los datos
 * cargados, construye la escena con `construirDiagrama()` y la pinta.
 *
 * El conmutador "solo puertos con cable / todos" va en la dirección
 * (`?puertos=todos`), no en estado de cliente: se puede enlazar y volver con
 * el botón del navegador, como el resto de la aplicación.
 */
export function EsquemaSala({
  salaId,
  entrada,
  todosLosPuertos,
}: {
  salaId: string;
  entrada: Omit<EntradaDiagrama, 'soloConectados'>;
  todosLosPuertos: boolean;
}) {
  const escena = construirDiagrama({ ...entrada, soloConectados: !todosLosPuertos });
  const sinConexiones = entrada.conexiones.length === 0;

  return (
    <Tarjeta
      titulo="Esquema de conexiones"
      pie={
        sinConexiones
          ? undefined
          : [
              `${escena.lineas.length} cables dibujados`,
              escena.omitidas > 0
                ? `${escena.omitidas} conexiones sin dibujar por faltarles un extremo`
                : null,
              'Identificadores y colores, los de la tabla de cables.',
            ]
              .filter(Boolean)
              .join(' · ')
      }
    >
      {sinConexiones ? (
        <Vacio>
          Sin conexiones. El esquema se dibuja solo cuando se da de alta qué
          conecta con qué.
        </Vacio>
      ) : (
        <>
          <div className="mb-3 text-tinta-tenue">
            {todosLosPuertos ? (
              <>
                Se enseñan todos los puertos del catálogo.{' '}
                <Link href={`/salas/${salaId}`} className="enlace">
                  Ver solo los conectados
                </Link>
              </>
            ) : (
              <>
                Solo puertos con cable.{' '}
                <Link href={`/salas/${salaId}?puertos=todos`} className="enlace">
                  Ver todos los puertos
                </Link>
              </>
            )}
          </div>
          <DibujoEsquema escena={escena} />
        </>
      )}
    </Tarjeta>
  );
}

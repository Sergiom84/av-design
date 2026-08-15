import { Tarjeta, Vacio } from '@/components/ui';

/**
 * Lo que enseña `Diagrama` mientras el editor de conexiones no existe.
 *
 * Esta pestaña se llamaba así y era el plano en planta; ahora ese editor vive
 * en `Plano` y el nombre queda reservado para lo que un técnico entiende por
 * diagrama: qué puerto sale a qué puerto. Un enlace guardado al antiguo
 * `/salas/[id]/diagrama` llega aquí, así que aquí se dice adónde se ha
 * movido, con el enlace hecho. No se redirige en silencio: la pestaña existe
 * y tiene su propio destino, y una redirección la dejaría inalcanzable.
 *
 * Hasta entonces el esquema de conexiones sigue siendo el de `Cableado`, que
 * es de donde se integrará. No se dibuja aquí una segunda copia de lectura:
 * dos esquemas que se pueden desincronizar son peores que uno.
 */
export function EstadoDiagrama({ salaId }: { salaId: string }) {
  return (
    <Tarjeta titulo="Diagrama de conexiones">
      <Vacio accion={{ texto: 'Ir a Plano', href: `/salas/${salaId}/plano` }}>
        El editor de conexiones puerto a puerto todavía no está aquí. El plano en
        planta, que hasta ahora ocupaba esta pestaña, se ha movido a Plano.
      </Vacio>
      <p className="text-tinta-tenue">
        Mientras tanto, el esquema de conexiones y la tabla de cables siguen en{' '}
        <a className="enlace" href={`/salas/${salaId}/cableado`}>
          Cableado
        </a>
        .
      </p>
    </Tarjeta>
  );
}

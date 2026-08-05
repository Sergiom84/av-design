import { Cabecera, Tarjeta } from './ui';

/**
 * Pantalla que se muestra mientras no haya base de datos conectada.
 * Evita que la app reviente al arrancar sin DATABASE_URL.
 */
export function SinConfigurar() {
  return (
    <>
      <Cabecera
        titulo="Falta conectar la base de datos"
        descripcion="La aplicación está montada pero no encuentra DATABASE_URL."
      />
      <div className="grid gap-6 max-w-3xl">
        <Tarjeta titulo="Puesta en marcha en local">
          <ol className="list-decimal ml-5 space-y-2">
            <li>
              Levantar Postgres: <code>npm run db:up</code>
            </li>
            <li>
              Crear las tablas: <code>npm run db:migrate</code>
            </li>
            <li>
              Cargar catálogo y plantillas: <code>npm run db:seed</code>
            </li>
            <li>
              Copiar <code>.env.example</code> a <code>.env.local</code>.
            </li>
            <li>
              Reiniciar con <code>npm run dev</code>.
            </li>
          </ol>
          <p className="mt-4 text-tinta-tenue">
            Los tres primeros pasos van juntos en <code>npm run db:reset</code>.
          </p>
        </Tarjeta>
        <Tarjeta titulo="Mientras tanto">
          <p>
            El cálculo de cable no depende de la base de datos: está en{' '}
            <code>src/lib/calculo-cable.ts</code> y se verifica con{' '}
            <code>npm test</code>.
          </p>
        </Tarjeta>
      </div>
    </>
  );
}

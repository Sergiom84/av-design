import { Cabecera, Tarjeta } from './ui';

/**
 * Pantalla que se muestra mientras no exista el proyecto de Supabase.
 * Evita que la app reviente al arrancar sin credenciales.
 */
export function SinConfigurar() {
  return (
    <>
      <Cabecera
        titulo="Falta conectar la base de datos"
        descripcion="La aplicación está montada pero todavía no apunta a ningún proyecto de Supabase."
      />
      <div className="grid gap-6 max-w-3xl">
        <Tarjeta titulo="Qué hay que hacer">
          <ol className="list-decimal ml-5 space-y-2">
            <li>Crear un proyecto en Supabase para AV_design.</li>
            <li>
              Ejecutar <code>supabase/schema.sql</code> en el SQL Editor del proyecto.
            </li>
            <li>
              Ejecutar <code>supabase/seed.sql</code> para cargar el catálogo y las
              plantillas que salen del inventario.
            </li>
            <li>
              Copiar <code>.env.example</code> a <code>.env.local</code> y rellenar{' '}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </li>
            <li>
              Reiniciar el servidor con <code>npm run dev</code>.
            </li>
          </ol>
        </Tarjeta>
        <Tarjeta titulo="Mientras tanto">
          <p>
            El cálculo de cable no depende de la base de datos: está en{' '}
            <code>src/lib/calculo-cable.ts</code> y se puede verificar con{' '}
            <code>npm test</code>.
          </p>
        </Tarjeta>
      </div>
    </>
  );
}

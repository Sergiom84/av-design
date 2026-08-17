import { hayConfiguracion } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Boton, Campo } from '@/components/ui';
import { entrar } from '../acciones-sesion';

export const dynamic = 'force-dynamic';

/**
 * La puerta. Usuario y contraseña: hasta ahora era una clave para todo el
 * departamento, y con eso no se sabía quién tocó qué ni se podía dar a cada uno
 * lo suyo.
 *
 * Sin navegación y sin nada más: desde aquí no se llega a ningún dato.
 */
export default async function Entrar({ searchParams }: PageProps<'/entrar'>) {
  const { destino, error } = await searchParams;

  // Sin base de datos no hay usuarios contra los que comprobar nada. Se dice
  // lo que pasa en vez de enseñar un formulario que siempre va a fallar.
  if (!hayConfiguracion()) return <SinConfigurar />;

  const mensaje =
    error === 'espera'
      ? 'Demasiados intentos seguidos. Prueba dentro de unos minutos.'
      : 'El usuario o la contraseña no son correctos.';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm tarjeta p-6">
        <h1 className="t-titulo mb-1">
          AV<span className="text-tinta-tenue">_design</span>
        </h1>
        <p className="text-tinta-tenue mb-6">Departamento de Audiovisuales</p>

        {error && (
          <div className="mb-4">
            <Aviso tono="alerta">{mensaje}</Aviso>
          </div>
        )}

        <form action={entrar} className="space-y-4">
          <input
            type="hidden"
            name="destino"
            value={typeof destino === 'string' ? destino : '/'}
          />
          <Campo etiqueta="Usuario">
            <input
              name="usuario"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              required
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Contraseña">
            <input
              name="clave"
              type="password"
              autoComplete="current-password"
              required
              className="w-full"
            />
          </Campo>
          <Boton>Entrar</Boton>
        </form>

        <p className="text-tinta-tenue mt-6 text-[0.6875rem]">
          El alta la da el administrador del departamento.
        </p>
      </div>
    </div>
  );
}

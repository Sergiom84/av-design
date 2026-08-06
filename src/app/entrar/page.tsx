import { Aviso, Boton, Campo } from '@/components/ui';
import { entrar } from '../acciones-sesion';

export const dynamic = 'force-dynamic';

/**
 * La puerta. Una clave para todo el departamento: lo que hace falta hoy es que
 * no entre quien pase por la dirección, no saber quién tocó qué.
 *
 * Sin navegación y sin nada más: desde aquí no se llega a ningún dato.
 */
export default async function Entrar({ searchParams }: PageProps<'/entrar'>) {
  const { destino, error } = await searchParams;

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="t-titulo mb-1">
          AV<span className="text-tinta-tenue">_design</span>
        </h1>
        <p className="text-tinta-tenue mb-6">Departamento de Audiovisuales</p>

        {error && (
          <div className="mb-4">
            <Aviso tono="alerta">La clave no es correcta.</Aviso>
          </div>
        )}

        <form action={entrar} className="space-y-4">
          <input
            type="hidden"
            name="destino"
            value={typeof destino === 'string' ? destino : '/'}
          />
          <Campo etiqueta="Clave del departamento">
            <input
              name="clave"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              className="w-full"
            />
          </Campo>
          <Boton>Entrar</Boton>
        </form>
      </div>
    </div>
  );
}

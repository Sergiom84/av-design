import { hayConfiguracion } from '@/lib/db';
import { listarParametros } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Boton, Cabecera, ContenedorTabla, Tarjeta } from '@/components/ui';
import { guardarParametros } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function Parametros() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const parametros = await listarParametros();

  return (
    <>
      <Cabecera
        titulo="Parámetros de cálculo"
        descripcion="El criterio del departamento, en un solo sitio. Cambiarlo aquí recalcula todas las salas."
      />

      <div className="max-w-3xl">
        <Tarjeta pie="La holgura de pantalla la habéis fijado entre 20 y 50 cm; el valor por defecto es el punto medio. La de proyector, unos 10 cm.">
          <form action={guardarParametros}>
            <ContenedorTabla etiqueta="Parámetros">
            <table className="datos">
              <thead>
                <tr>
                  <th>Parámetro</th>
                  <th className="num">Valor</th>
                  <th>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {parametros.map((p) => (
                  <tr key={p.clave}>
                    <td>
                      <span className="block">{p.clave}</span>
                      <span className="block text-tinta-tenue text-[0.6875rem]">
                        {p.descripcion ?? ''}
                      </span>
                    </td>
                    <td className="num">
                      <input
                        name={p.clave}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={p.valor}
                        className="w-28 num"
                        aria-label={p.clave}
                      />
                    </td>
                    <td className="text-tinta-tenue">{p.unidad ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </ContenedorTabla>
            <div className="mt-4">
              <Boton>Guardar parámetros</Boton>
            </div>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}

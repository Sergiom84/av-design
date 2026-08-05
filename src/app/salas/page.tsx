import Link from 'next/link';
import { hayConfiguracion } from '@/lib/supabase/servidor';
import { listarPlantillas, listarSalas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Boton, Cabecera, Campo, Tarjeta, Vacio } from '@/components/ui';
import { crearSala } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function Salas() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const [salas, plantillas] = await Promise.all([listarSalas(), listarPlantillas()]);

  return (
    <>
      <Cabecera
        titulo="Salas"
        descripcion="Cada sala guarda sus medidas reales, su equipamiento y sus conexiones. De ahí salen los metros de cable."
      />

      <div className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
        <Tarjeta>
          {salas.length === 0 ? (
            <Vacio>
              Todavía no hay ninguna sala. Crea la primera desde una plantilla.
            </Vacio>
          ) : (
            <table className="datos">
              <thead>
                <tr>
                  <th>Sala</th>
                  <th>Edificio</th>
                  <th>Tipología</th>
                  <th className="num">Aforo</th>
                  <th className="num">Medidas (m)</th>
                </tr>
              </thead>
              <tbody>
                {salas.map((s) => {
                  const sinMedidas = !s.largo_m || !s.ancho_m;
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link
                          href={`/salas/${s.id}`}
                          className="text-acento underline underline-offset-2"
                        >
                          {s.nombre}
                        </Link>
                        {s.codigo && (
                          <span className="text-tinta-tenue"> · {s.codigo}</span>
                        )}
                      </td>
                      <td>
                        {s.edificio ?? '—'}
                        {s.nivel && (
                          <span className="text-tinta-tenue"> · {s.nivel}</span>
                        )}
                      </td>
                      <td>{s.tipologia ?? '—'}</td>
                      <td className="num">{s.aforo ?? '—'}</td>
                      <td className="num">
                        {sinMedidas ? (
                          <span className="text-alerta">sin medidas</span>
                        ) : (
                          `${s.largo_m} × ${s.ancho_m} × ${s.alto_m}`
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Tarjeta>

        <Tarjeta titulo="Nueva sala">
          <form action={crearSala} className="space-y-3">
            <Campo etiqueta="Nombre">
              <input name="nombre" required className="w-full" placeholder="África 001" />
            </Campo>
            <Campo etiqueta="Plantilla" ayuda="Hereda medidas y equipamiento estándar.">
              <select name="plantilla_id" className="w-full" defaultValue="">
                <option value="">Sin plantilla</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.largo_m == null ? ' (sin medidas)' : ''}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Edificio">
                <input name="edificio" className="w-full" />
              </Campo>
              <Campo etiqueta="Nivel">
                <input name="nivel" className="w-full" />
              </Campo>
            </div>
            <Campo etiqueta="Código">
              <input name="codigo" className="w-full" />
            </Campo>
            <Boton>Crear sala</Boton>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}

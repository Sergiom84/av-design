import { hayConfiguracion } from '@/lib/db';
import { listarCategorias, listarMarcas } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Boton, Cabecera, Campo, Enlace, Tarjeta } from '@/components/ui';
import { crearArticulo } from '../../acciones';

export const dynamic = 'force-dynamic';

export default async function NuevoArticulo() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const [marcas, categorias] = await Promise.all([listarMarcas(), listarCategorias()]);

  return (
    <>
      <div className="text-tinta-tenue mb-2">
        <Enlace href="/catalogo">Catálogo</Enlace> / Nueva referencia
      </div>
      <Cabecera
        titulo="Nueva referencia"
        descripcion="Lo mínimo para darla de alta. El precio, las características y las observaciones se rellenan después en su ficha."
      />

      <form action={crearArticulo} className="max-w-3xl space-y-6">
        <Tarjeta>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo etiqueta="Tipo">
              <select name="tipo" defaultValue="equipo" className="w-full">
                <option value="equipo">Equipo</option>
                <option value="cable">Cable</option>
                <option value="consumible">Consumible</option>
              </select>
            </Campo>
            <Campo etiqueta="Unidad">
              <select name="unidad" defaultValue="ud" className="w-full">
                <option value="ud">Unidad</option>
                <option value="m">Metro</option>
              </select>
            </Campo>
            <Campo etiqueta="Marca" ayuda="Vacío para material genérico.">
              <input name="marca" list="marcas" className="w-full" />
              <datalist id="marcas">
                {marcas.map((m) => (
                  <option key={m.marca} value={m.marca} />
                ))}
              </datalist>
            </Campo>
            <Campo etiqueta="Modelo">
              <input name="modelo" required className="w-full" />
            </Campo>
            <Campo etiqueta="Sección" ayuda="Agrupa la referencia dentro de su marca.">
              <input name="categoria" list="categorias" required className="w-full" />
              <datalist id="categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>
            <Campo etiqueta="Proveedor">
              <input name="proveedor" className="w-full" />
            </Campo>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <Campo etiqueta="Coste (€)">
              <input name="coste" type="number" step="any" min="0" className="w-full num" />
            </Campo>
            <Campo etiqueta="PVP (€)">
              <input name="pvp" type="number" step="any" min="0" className="w-full num" />
            </Campo>
          </div>

          <div className="mt-3">
            <Campo etiqueta="Descripción">
              <input name="descripcion" className="w-full" />
            </Campo>
          </div>
        </Tarjeta>

        <Boton>Crear referencia</Boton>
      </form>
    </>
  );
}

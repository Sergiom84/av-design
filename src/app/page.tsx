import { hayConfiguracion } from '@/lib/db';
import { contarPanel } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera, Dato, Enlace, Tarjeta } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Panel() {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const c = await contarPanel();

  return (
    <>
      <Cabecera
        titulo="Panel"
        descripcion="Diseño de salas, cálculo de metros de cable y lista de material para las instalaciones del departamento."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-px bg-linea border border-linea mb-8">
        {(
          [
            ['Equipos en catálogo', c.equipos],
            ['Referencias de cable', c.cables],
            ['Consumibles', c.consumibles],
            ['Plantillas de sala', c.plantillas],
            ['Salas', c.salas],
          ] as const
        ).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="bg-papel p-4">
            <Dato etiqueta={etiqueta} valor={valor} />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Pendiente de completar">
          <div className="space-y-3">
            {c.plantillasSinMedidas > 0 && (
              <Aviso>
                <strong>{c.plantillasSinMedidas}</strong> plantillas sin medidas. Sin
                largo, ancho y alto no se puede calcular un metro de cable.{' '}
                <Enlace href="/plantillas">Rellenar medidas</Enlace>
              </Aviso>
            )}
            {c.salasSinMedidas > 0 && (
              <Aviso>
                <strong>{c.salasSinMedidas}</strong> salas sin medidas.{' '}
                <Enlace href="/salas">Ver salas</Enlace>
              </Aviso>
            )}
            {c.cableSinPrecio > 0 && (
              <Aviso tono="neutro">
                <strong>{c.cableSinPrecio}</strong> referencias de cable sin precio de
                coste. El cálculo de metros funciona igual; lo que no sale es el importe.{' '}
                <Enlace href="/catalogo">Ver catálogo</Enlace>
              </Aviso>
            )}
            {c.plantillasSinMedidas === 0 &&
              c.salasSinMedidas === 0 &&
              c.cableSinPrecio === 0 && (
                <p className="text-tinta-tenue">Todo completo.</p>
              )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Cómo se trabaja">
          <ol className="list-decimal ml-5 space-y-2">
            <li>
              Rellenas una vez las medidas de cada{' '}
              <Enlace href="/plantillas">plantilla</Enlace> (SALA TP aforo 8, ULTRALIGERA
              QR aforo 4…).
            </li>
            <li>
              Creas una <Enlace href="/salas">sala</Enlace> desde la plantilla. Hereda
              medidas y equipamiento; solo corriges lo que cambie.
            </li>
            <li>Colocas los equipos en la sala y defines qué conecta con qué.</li>
            <li>
              La app calcula los metros de cada tirada por su ruta real y devuelve la lista
              de material a comprar.
            </li>
          </ol>
        </Tarjeta>
      </div>
    </>
  );
}

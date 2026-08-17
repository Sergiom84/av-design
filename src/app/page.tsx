import { hayConfiguracion } from '@/lib/db';
import { contarPanel } from '@/lib/datos';
import { contarAlmacen } from '@/lib/datos-almacen';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera, Dato, Enlace, Tarjeta } from '@/components/ui';
import { exigirSeccion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

export default async function Panel() {
  /*
    El panel es la unica seccion sin carpeta propia: su layout es el de la
    aplicacion entera, del que tambien cuelga /entrar. Por eso la guarda va
    aqui, en la pagina, y no en un layout.
  */
  await exigirSeccion('panel', 'ver');
  if (!hayConfiguracion()) return <SinConfigurar />;

  const [c, alm] = await Promise.all([contarPanel(), contarAlmacen()]);

  return (
    <>
      <Cabecera
        titulo="Panel"
        descripcion="Diseño de salas, cálculo de metros de cable y lista de material para las instalaciones del departamento."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {(
          [
            ['Equipos en catálogo', c.equipos],
            ['Referencias de cable', c.cables],
            ['Consumibles', c.consumibles],
            ['Plantillas de sala', c.plantillas],
            ['Salas', c.salas],
          ] as const
        ).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="tarjeta p-4">
            <Dato etiqueta={etiqueta} valor={valor} />
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(
          [
            ['Referencias en almacén', alm.referenciasEnAlmacen, '/almacen'],
            ['Reservas activas', alm.reservasActivas, '/almacen'],
            ['Pedidos en curso', alm.pedidosEnCurso, '/compras'],
            ['Cargas abiertas', alm.cargasAbiertas, '/carga'],
          ] as const
        ).map(([etiqueta, valor, href]) => (
          <div key={etiqueta} className="tarjeta p-4">
            <Dato etiqueta={etiqueta} valor={<Enlace href={href}>{valor}</Enlace>} />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Pendiente de completar">
          <div className="space-y-3">
            {alm.bajoMinimo > 0 && (
              <Aviso tono="alerta">
                <strong>{alm.bajoMinimo}</strong> referencias por debajo del stock
                mínimo. El mínimo se mide contra el disponible, no contra lo que hay en
                el estante. <Enlace href="/almacen">Ver almacén</Enlace>
              </Aviso>
            )}
            {alm.pedidosBorrador > 0 && (
              <Aviso>
                <strong>{alm.pedidosBorrador}</strong> pedidos en borrador sin mandar.{' '}
                <Enlace href="/compras">Ver compras</Enlace>
              </Aviso>
            )}
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
            {c.costeOrientativo > 0 && (
              <Aviso tono="neutro">
                <strong>{c.costeOrientativo}</strong> referencias con coste
                orientativo. Sirven para dimensionar, pero no para pedir: hace falta
                oferta de proveedor.{' '}
                <Enlace href="/catalogo">Ver catálogo</Enlace>
              </Aviso>
            )}
            {c.plantillasSinMedidas === 0 &&
              c.salasSinMedidas === 0 &&
              c.cableSinPrecio === 0 &&
              c.costeOrientativo === 0 &&
              alm.bajoMinimo === 0 &&
              alm.pedidosBorrador === 0 && (
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
            <li>
              Contra el <Enlace href="/almacen">almacén</Enlace> sale qué falta de verdad.
              Lo que hay se reserva; lo que no, se pide por proveedor en{' '}
              <Enlace href="/compras">compras</Enlace>.
            </li>
            <li>
              La <Enlace href="/carga">lista de carga</Enlace> se marca en el almacén
              desde el móvil. Al volver se cierra la obra: qué se instaló, qué sobra y
              qué se rompió.
            </li>
          </ol>
        </Tarjeta>
      </div>
    </>
  );
}

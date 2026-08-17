import { Aviso, Boton, Cabecera, ListaClaveValor, Tarjeta } from '@/components/ui';
import { CampoContrasena } from '@/components/usuarios/campo-contrasena';
import { LARGO_MINIMO } from '@/lib/contrasena';
import { exigirUsuario } from '@/lib/sesion-servidor';
import { ETIQUETA_ROL } from '@/lib/usuarios';
import { cambiarMiClave } from '../acciones-sesion';

export const dynamic = 'force-dynamic';

/**
 * La cuenta propia. Aquí solo se cambia la contraseña.
 *
 * Es la única pantalla a la que se llega con la contraseña provisional todavía
 * puesta: `exigirSeccion` manda aquí a quien no la haya cambiado. Por eso no
 * lleva ningún dato de obra ni ningún enlace a otra sección.
 */
export default async function Cuenta({ searchParams }: PageProps<'/cuenta'>) {
  const { error, hecho } = await searchParams;
  const yo = await exigirUsuario();

  const mensaje =
    error === 'actual'
      ? 'La contraseña actual no es correcta.'
      : error === 'repetida'
        ? 'Las dos contraseñas nuevas no coinciden.'
        : error === 'desarrollo'
          ? 'Estás en el modo abierto de desarrollo: no hay contraseña que cambiar.'
          : typeof error === 'string'
            ? error
            : null;

  return (
    <>
      <Cabecera titulo="Mi cuenta" descripcion={yo.nombre} />

      {yo.debeCambiarClave && (
        <div className="mb-6">
          <Aviso tono="aviso">
            La contraseña que tienes la puso el administrador. Cambiala para entrar en
            el resto de la aplicación.
          </Aviso>
        </div>
      )}

      {mensaje && (
        <div className="mb-6">
          <Aviso tono="alerta">{mensaje}</Aviso>
        </div>
      )}

      {hecho && (
        <div className="mb-6">
          <Aviso tono="neutro">Contraseña cambiada.</Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Quién eres">
          <ListaClaveValor
            items={[
              { clave: 'Usuario', valor: yo.usuario },
              { clave: 'Nombre', valor: yo.nombre },
              { clave: 'Rol', valor: ETIQUETA_ROL[yo.rol] },
            ]}
          />
        </Tarjeta>

        <Tarjeta titulo="Cambiar la contraseña">
          <form action={cambiarMiClave} className="space-y-4">
            <CampoContrasena
              name="actual"
              etiqueta="Contraseña actual"
              ayuda="Se pide aunque ya hayas entrado: un ordenador desbloqueado un minuto basta para que otro se quede con la cuenta."
              autoComplete="current-password"
              required
            />
            <CampoContrasena
              name="nueva"
              etiqueta="Contraseña nueva"
              ayuda={`Mínimo ${LARGO_MINIMO} caracteres.`}
              autoComplete="new-password"
              minLength={LARGO_MINIMO}
              required
            />
            <CampoContrasena
              name="repetida"
              etiqueta="Repite la contraseña nueva"
              autoComplete="new-password"
              minLength={LARGO_MINIMO}
              required
            />
            <Boton>Cambiar</Boton>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}

import { hayConfiguracion, sql } from '@/lib/db';
import { SinConfigurar } from '@/components/sin-configurar';
import {
  Aviso,
  Boton,
  Cabecera,
  Campo,
  ContenedorTabla,
  Enlace,
  Estado,
  Tarjeta,
  Vacio,
} from '@/components/ui';
import { ClaveProvisional } from '@/components/usuarios/clave-provisional';
import { sesionActual } from '@/lib/sesion-servidor';
import { DESCRIPCION_ROL, ETIQUETA_ROL, ROLES, esRol } from '@/lib/usuarios';
import { crearUsuario } from '../acciones-usuarios';

export const dynamic = 'force-dynamic';

interface FilaLista {
  id: string;
  usuario: string;
  nombre: string;
  rol: string;
  activo: boolean;
  debe_cambiar_clave: boolean;
  tecnico: string | null;
  ultimo_acceso_en: Date | null;
}

function fecha(valor: Date | null): string {
  return valor ? valor.toLocaleDateString('es-ES') : '—';
}

export default async function Usuarios({ searchParams }: PageProps<'/usuarios'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { error, alta } = await searchParams;
  const yo = await sesionActual();

  const usuarios = await sql<FilaLista[]>`
    select u.id,
           u.usuario,
           u.nombre,
           u.rol::text as rol,
           u.activo,
           u.debe_cambiar_clave,
           t.nombre as tecnico,
           u.ultimo_acceso_en
      from usuarios u
      left join tecnicos t on t.id = u.tecnico_id
     order by u.activo desc, u.usuario
  `;

  const tecnicos = await sql<{ id: string; nombre: string }[]>`
    select id, nombre from tecnicos where activo order by nombre
  `;

  return (
    <>
      <Cabecera
        titulo="Usuarios"
        descripcion="Quién tiene llave de la aplicación y qué puede ver cada uno."
      />

      {typeof error === 'string' && (
        <div className="mb-6">
          <Aviso tono="alerta">{error}</Aviso>
        </div>
      )}

      {typeof alta === 'string' && (
        <div className="mb-6">
          <Aviso tono="neutro">
            {alta} dado de alta. Entrégale la contraseña provisional: al entrar la
            aplicación le obliga a cambiarla.
          </Aviso>
        </div>
      )}

      {yo?.ficticio && (
        <div className="mb-6">
          <Aviso tono="aviso">
            Estás en el modo abierto de desarrollo (sin <code>SESION_SECRETO</code>). Se
            puede dar de alta, pero aquí no hay sesión de nadie.
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] items-start">
        <Tarjeta titulo="Altas">
          {usuarios.length === 0 ? (
            <Vacio>
              Todavía no hay ningún usuario. El primer administrador se crea con{' '}
              <code>npm run usuarios:admin</code>.
            </Vacio>
          ) : (
            <ContenedorTabla etiqueta="Usuarios">
              <table className="datos">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Técnico</th>
                    <th>Último acceso</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td className="font-mono">
                        <Enlace href={`/usuarios/${u.id}`}>{u.usuario}</Enlace>
                      </td>
                      <td>{u.nombre}</td>
                      <td>{esRol(u.rol) ? ETIQUETA_ROL[u.rol] : u.rol}</td>
                      <td className="text-tinta-tenue">{u.tecnico ?? '—'}</td>
                      <td className="text-tinta-tenue">{fecha(u.ultimo_acceso_en)}</td>
                      <td>
                        {!u.activo ? (
                          <Estado tono="bloqueo">De baja</Estado>
                        ) : u.debe_cambiar_clave ? (
                          <Estado tono="aviso">Sin estrenar</Estado>
                        ) : (
                          <Estado tono="listo">Activo</Estado>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ContenedorTabla>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Dar de alta"
          variante="operativa"
          pie="La contraseña se entrega en mano. No se manda ningún correo y nadie puede volver a leerla: si se pierde, se pone otra."
        >
          <form action={crearUsuario} className="space-y-4">
            <Campo etiqueta="Usuario" ayuda="El código de empleado, por ejemplo xe05206.">
              <input
                name="usuario"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                className="w-full font-mono"
              />
            </Campo>

            <Campo etiqueta="Nombre">
              <input name="nombre" type="text" required className="w-full" />
            </Campo>

            <Campo etiqueta="Rol">
              <select name="rol" defaultValue="tecnico" className="w-full">
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {ETIQUETA_ROL[rol]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              etiqueta="Técnico enlazado"
              ayuda="Opcional. Ata esta llave a la persona que firma hitos de obra."
            >
              <select name="tecnico_id" defaultValue="" className="w-full">
                <option value="">Sin enlazar</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <ClaveProvisional />

            <Boton>Dar de alta</Boton>
          </form>
        </Tarjeta>
      </div>

      <div className="mt-6 max-w-3xl">
        <Tarjeta titulo="Qué trae cada rol">
          <dl className="grid gap-2">
            {ROLES.map((rol) => (
              <div key={rol} className="grid grid-cols-[10rem_1fr] gap-3">
                <dt className="t-etiqueta">{ETIQUETA_ROL[rol]}</dt>
                <dd className="text-tinta-tenue">{DESCRIPCION_ROL[rol]}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}

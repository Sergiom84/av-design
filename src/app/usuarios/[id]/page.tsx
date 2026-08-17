import { notFound } from 'next/navigation';

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
  GrupoAcciones,
  ListaClaveValor,
  Tarjeta,
} from '@/components/ui';
import { ClaveProvisional } from '@/components/usuarios/clave-provisional';
import { sesionActual } from '@/lib/sesion-servidor';
import {
  ACCESOS,
  DESCRIPCION_ROL,
  ETIQUETA_ROL,
  PERMISOS_POR_ROL,
  ROLES,
  SECCIONES,
  esAcceso,
  esRol,
  esSeccion,
  resolverPermisos,
  type Acceso,
  type Seccion,
} from '@/lib/usuarios';
import {
  cambiarActivoUsuario,
  cambiarRolUsuario,
  guardarFichaUsuario,
  guardarPermisosUsuario,
  restablecerClaveUsuario,
} from '../../acciones-usuarios';

export const dynamic = 'force-dynamic';

const ETIQUETA_ACCESO: Record<Acceso, string> = {
  oculto: 'No la ve',
  ver: 'Solo ver',
  editar: 'Ver y editar',
};

interface FilaFicha {
  id: string;
  usuario: string;
  nombre: string;
  rol: string;
  activo: boolean;
  debe_cambiar_clave: boolean;
  tecnico_id: string | null;
  creado_en: Date;
  clave_cambiada_en: Date | null;
  ultimo_acceso_en: Date | null;
}

function fecha(valor: Date | null): string {
  return valor ? valor.toLocaleString('es-ES') : '—';
}

export default async function FichaUsuario({ params, searchParams }: PageProps<'/usuarios/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const { hecho, restablecida, error } = await searchParams;
  const yo = await sesionActual();

  const filas = await sql<FilaFicha[]>`
    select id, usuario, nombre, rol::text as rol, activo, debe_cambiar_clave,
           tecnico_id, creado_en, clave_cambiada_en, ultimo_acceso_en
      from usuarios
     where id = ${id}
  `;
  const usuario = filas[0];
  if (!usuario) notFound();

  const tecnicos = await sql<{ id: string; nombre: string }[]>`
    select id, nombre from tecnicos where activo order by nombre
  `;

  const excepciones = await sql<{ seccion: string; acceso: string }[]>`
    select seccion, acceso from usuario_permisos where usuario_id = ${id}
  `;

  const ajustes: Partial<Record<Seccion, Acceso>> = {};
  for (const { seccion, acceso } of excepciones) {
    if (esSeccion(seccion) && esAcceso(acceso)) ajustes[seccion] = acceso;
  }

  const rol = esRol(usuario.rol) ? usuario.rol : 'lectura';
  const permisos = resolverPermisos(rol, ajustes);
  const porRol = PERMISOS_POR_ROL[rol];
  const esYo = yo?.id === usuario.id;

  return (
    <>
      <Cabecera
        titulo={usuario.nombre}
        descripcion={`${usuario.usuario} · ${ETIQUETA_ROL[rol]}`}
        acciones={<Enlace href="/usuarios">Volver a usuarios</Enlace>}
      />

      {typeof error === 'string' && (
        <div className="mb-6">
          <Aviso tono="alerta">{error}</Aviso>
        </div>
      )}
      {hecho && (
        <div className="mb-6">
          <Aviso tono="neutro">Guardado.</Aviso>
        </div>
      )}
      {restablecida && (
        <div className="mb-6">
          <Aviso tono="neutro">
            Contraseña provisional puesta. Entrégasela: al entrar tendrá que cambiarla.
          </Aviso>
        </div>
      )}
      {!usuario.activo && (
        <div className="mb-6">
          <Aviso tono="alerta">Está de baja: no puede entrar.</Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Tarjeta titulo="Ficha">
          <form action={guardarFichaUsuario} className="space-y-4">
            <input type="hidden" name="id" value={usuario.id} />
            <Campo etiqueta="Nombre">
              <input
                name="nombre"
                type="text"
                defaultValue={usuario.nombre}
                required
                className="w-full"
              />
            </Campo>
            <Campo
              etiqueta="Técnico enlazado"
              ayuda="La misma persona en la lista que firma hitos de obra."
            >
              <select
                name="tecnico_id"
                defaultValue={usuario.tecnico_id ?? ''}
                className="w-full"
              >
                <option value="">Sin enlazar</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Boton>Guardar ficha</Boton>
          </form>

          <div className="mt-6 pt-6 border-t border-linea-suave">
            <ListaClaveValor
              items={[
                { clave: 'Usuario', valor: <span className="font-mono">{usuario.usuario}</span> },
                { clave: 'Alta', valor: fecha(usuario.creado_en) },
                { clave: 'Último acceso', valor: fecha(usuario.ultimo_acceso_en) },
                {
                  clave: 'Contraseña',
                  valor: usuario.debe_cambiar_clave ? (
                    <Estado tono="aviso">Provisional, sin estrenar</Estado>
                  ) : (
                    `Cambiada el ${fecha(usuario.clave_cambiada_en)}`
                  ),
                },
              ]}
            />
          </div>
        </Tarjeta>

        <div className="grid gap-6">
          <Tarjeta titulo="Rol" pie={DESCRIPCION_ROL[rol]}>
            <form action={cambiarRolUsuario} className="space-y-4">
              <input type="hidden" name="id" value={usuario.id} />
              <Campo
                etiqueta="Rol"
                ayuda="El rol pone los permisos de fábrica. Las excepciones se ajustan abajo."
              >
                <select name="rol" defaultValue={rol} className="w-full">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ETIQUETA_ROL[r]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Boton>Cambiar rol</Boton>
            </form>
          </Tarjeta>

          <Tarjeta
            titulo="Contraseña provisional"
            variante="operativa"
            pie="Nadie puede leer la contraseña actual, ni tú. Lo que se hace aquí es sustituirla."
          >
            <form action={restablecerClaveUsuario} className="space-y-4">
              <input type="hidden" name="id" value={usuario.id} />
              <ClaveProvisional etiqueta="Contraseña nueva" />
              <Boton>Poner contraseña provisional</Boton>
            </form>
          </Tarjeta>

          <Tarjeta titulo="Acceso" variante={usuario.activo ? 'peligrosa' : 'estandar'}>
            <form action={cambiarActivoUsuario}>
              <input type="hidden" name="id" value={usuario.id} />
              <input type="hidden" name="activo" value={usuario.activo ? 'no' : 'si'} />
              <GrupoAcciones
                peligro={
                  usuario.activo ? (
                    <Boton variante="peligro" disabled={esYo}>
                      Dar de baja
                    </Boton>
                  ) : undefined
                }
              >
                {!usuario.activo && <Boton>Volver a dar de alta</Boton>}
              </GrupoAcciones>
            </form>
            <p className="text-tinta-tenue mt-3 text-[0.6875rem]">
              {esYo
                ? 'No puedes darte de baja a ti mismo.'
                : 'La fila no se borra: se apaga. Así no se pierde el rastro de quién entró y cuándo.'}
            </p>
          </Tarjeta>
        </div>
      </div>

      <div className="mt-6">
        <Tarjeta
          titulo="Qué ve y qué toca"
          pie={
            rol === 'admin'
              ? 'Un administrador lo ve todo y no admite excepciones: guardar «admin sin acceso a usuarios» dejaría la aplicación sin nadie que pueda repartir permisos.'
              : 'Lo que no se toca lo decide el rol. Solo se guarda la diferencia, así que cambiar mañana el criterio del rol alcanza a esta persona salvo en lo ajustado a mano.'
          }
        >
          {rol === 'admin' ? (
            <p className="text-tinta-tenue">
              Todas las secciones en «ver y editar», incluida la de usuarios.
            </p>
          ) : (
            <form action={guardarPermisosUsuario}>
              <input type="hidden" name="id" value={usuario.id} />
              <ContenedorTabla etiqueta="Permisos por sección">
                <table className="datos">
                  <thead>
                    <tr>
                      <th>Sección</th>
                      <th>Por el rol</th>
                      {ACCESOS.map((a) => (
                        <th key={a}>{ETIQUETA_ACCESO[a]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SECCIONES.map(({ id: seccion, etiqueta }) => {
                      const ajustada = ajustes[seccion] !== undefined;
                      return (
                        <tr key={seccion}>
                          <td>
                            {etiqueta}
                            {ajustada && (
                              <span className="ml-2">
                                <Estado tono="informacion">Ajustado</Estado>
                              </span>
                            )}
                          </td>
                          <td className="text-tinta-tenue">
                            {ETIQUETA_ACCESO[porRol[seccion]]}
                          </td>
                          {ACCESOS.map((acceso) => (
                            <td key={acceso}>
                              <input
                                type="radio"
                                name={`acceso_${seccion}`}
                                value={acceso}
                                defaultChecked={permisos[seccion] === acceso}
                                aria-label={`${etiqueta}: ${ETIQUETA_ACCESO[acceso]}`}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ContenedorTabla>
              <div className="mt-4">
                <Boton>Guardar permisos</Boton>
              </div>
            </form>
          )}
        </Tarjeta>
      </div>
    </>
  );
}

/**
 * P1 · El ciclo de vida de la obra y de la sala: quién hizo qué, y cuándo.
 *
 * Lógica pura: entran los hitos y las recepciones ya cargados, salen la línea
 * de tiempo y los avisos. No consulta nada, no escribe nada.
 *
 * El criterio rector, del roadmap: **el estado del material se deriva, el
 * hito humano se registra**. Aquí no hay ningún estado editable; el estado
 * del proyecto sale de sus hitos, y la entrega con bloqueos avisa y exige
 * nota, no bloquea (regla de la casa: la validación avisa, el técnico puede
 * tener un adaptador por medio).
 */

export type RolTecnico = 'inicio' | 'recepcion' | 'instalacion';

export const ETIQUETA_ROL: Record<RolTecnico, string> = {
  inicio: 'Inicio de proyecto',
  recepcion: 'Recepción de equipamiento',
  instalacion: 'Instalación',
};

export interface Tecnico {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface TecnicoRol {
  tecnico_id: string;
  rol: RolTecnico;
}

export type TipoHitoProyecto = 'inicio' | 'cierre';
export type TipoHitoSala = 'instalacion' | 'entrega';

export interface HitoProyecto {
  id: string;
  proyecto_id: string;
  tipo: TipoHitoProyecto;
  tecnico_id: string | null;
  /** Nombre resuelto por la consulta. Nulo = ya no está en la lista. */
  tecnico?: string | null;
  /** aaaa-mm-dd. Es `date`, no timestamp: en obra se apunta el día. */
  fecha: string;
  notas: string | null;
}

export interface HitoSala {
  id: string;
  sala_id: string;
  tipo: TipoHitoSala;
  tecnico_id: string | null;
  tecnico?: string | null;
  fecha: string;
  notas: string | null;
}

/** Una recepción de pedido que abastece a la sala. Derivada, nunca tecleada. */
export interface Recepcion {
  pedido_id: string;
  referencia: string | null;
  fecha: string;
  quien: string | null;
}

/** Los técnicos activos con un rol, para el `<select>` de ese hecho. */
export function tecnicosDeRol(
  tecnicos: Tecnico[],
  roles: TecnicoRol[],
  rol: RolTecnico,
): Tecnico[] {
  const con = new Set(roles.filter((r) => r.rol === rol).map((r) => r.tecnico_id));
  return tecnicos
    .filter((t) => t.activo && con.has(t.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export type EstadoProyecto = 'sin_iniciar' | 'en_curso' | 'cerrado';

export const ETIQUETA_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  sin_iniciar: 'Sin iniciar',
  en_curso: 'En curso',
  cerrado: 'Cerrado',
};

/** El estado no se teclea: sale de los hitos registrados. */
export function estadoDeProyecto(hitos: HitoProyecto[]): EstadoProyecto {
  if (hitos.some((h) => h.tipo === 'cierre')) return 'cerrado';
  if (hitos.some((h) => h.tipo === 'inicio')) return 'en_curso';
  return 'sin_iniciar';
}

export interface PasoCiclo {
  clave: 'inicio' | 'recepciones' | 'instalacion' | 'entrega';
  titulo: string;
  hecho: boolean;
  /** Quién y cuándo, o por qué está pendiente. Sin dato no se puede actuar. */
  detalle: string;
}

export interface ResumenCicloVida {
  pasos: PasoCiclo[];
  /** Lo que falta por registrar, en orden. */
  pendiente: string[];
}

const conQuien = (tecnico: string | null | undefined, fecha: string): string =>
  tecnico ? `${tecnico} · ${fecha}` : fecha;

/**
 * La línea de tiempo de una sala: el inicio lo hereda de su proyecto, las
 * recepciones se derivan de los pedidos recibidos, y la instalación y la
 * entrega son sus propios hitos.
 */
export function resumenCicloVida(entrada: {
  hitosProyecto: HitoProyecto[];
  hitosSala: HitoSala[];
  recepciones: Recepcion[];
}): ResumenCicloVida {
  const inicio = entrada.hitosProyecto.find((h) => h.tipo === 'inicio') ?? null;
  const instalacion = entrada.hitosSala.find((h) => h.tipo === 'instalacion') ?? null;
  const entrega = entrada.hitosSala.find((h) => h.tipo === 'entrega') ?? null;
  const recepciones = entrada.recepciones;

  const pasos: PasoCiclo[] = [
    {
      clave: 'inicio',
      titulo: 'Inicio del proyecto',
      hecho: inicio != null,
      detalle: inicio
        ? conQuien(inicio.tecnico, inicio.fecha)
        : 'Sin registrar: es un hito de la obra, no de la sala.',
    },
    {
      clave: 'recepciones',
      titulo: 'Recepción de material',
      hecho: recepciones.length > 0,
      detalle:
        recepciones.length > 0
          ? recepciones
              .map((r) => conQuien(r.quien, r.fecha) + (r.referencia ? ` (${r.referencia})` : ''))
              .join(' · ')
          : 'Ningún pedido recibido para esta sala.',
    },
    {
      clave: 'instalacion',
      titulo: 'Instalación',
      hecho: instalacion != null,
      detalle: instalacion
        ? conQuien(instalacion.tecnico, instalacion.fecha)
        : 'Sin registrar.',
    },
    {
      clave: 'entrega',
      titulo: 'Entrega de la sala',
      hecho: entrega != null,
      detalle: entrega
        ? conQuien(entrega.tecnico, entrega.fecha) + (entrega.notas ? ` — ${entrega.notas}` : '')
        : 'Sin registrar. La entrega es el cierre formal de la sala.',
    },
  ];

  return {
    pasos,
    pendiente: pasos.filter((p) => !p.hecho).map((p) => p.titulo),
  };
}

export interface AvisosDeEntrega {
  /** Los bloqueos y avisos del semáforo, en frases. */
  avisos: string[];
  /** Con bloqueos, la entrega exige nota: se firma una decisión consciente. */
  exigeNota: boolean;
}

/**
 * La entrega contra el semáforo de `revision.ts`: avisa, no bloquea. Si el
 * semáforo dice que la sala no está montable, entregarla es una decisión
 * consciente y se registra con nota obligatoria.
 */
export function avisosDeEntrega(
  puntos: Array<{ estado: 'listo' | 'aviso' | 'bloqueo' | 'no_aplica'; titulo: string; detalle: string }>,
): AvisosDeEntrega {
  const bloqueos = puntos.filter((p) => p.estado === 'bloqueo');
  const avisos = puntos.filter((p) => p.estado === 'aviso');
  return {
    avisos: [...bloqueos, ...avisos].map((p) => `${p.titulo}: ${p.detalle}`),
    exigeNota: bloqueos.length > 0,
  };
}

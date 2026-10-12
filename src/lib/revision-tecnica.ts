/**
 * Revisión técnica del montaje (L4).
 *
 * Lógica pura, como `calculo-cable.ts`, `cable-schedule.ts` y `revision.ts`:
 * entra el diseño ya leído, salen avisos con causa, elemento y acción. No
 * consulta nada, no escribe nada y no crea ninguna tabla.
 *
 * Tres criterios la gobiernan:
 *
 * 1. **La ausencia de datos no es compatibilidad.** Sin ficha, sin longitud o
 *    sin conector documentado el resultado es `pendiente`, nunca «listo». Un
 *    hueco que se pinta en verde es peor que un hueco que se pinta.
 * 2. **Un error estructural no es un aviso técnico.** Un identificador ajeno,
 *    un ordinal fuera de rango o dos cables en la misma boca son datos
 *    imposibles: se rechazan. Una incompatibilidad de señal, sentido o
 *    conector es una decisión del técnico —puede tener un adaptador— y solo
 *    se avisa, conservando la alternativa.
 * 3. **Cada aviso lleva a algún sitio.** Causa, elemento afectado y acción
 *    disponible. Un aviso sin destino obliga a buscar a mano lo que la
 *    aplicación ya sabe.
 */

import { bocasDePuerto, claveBoca, ordinalValido } from './bocas-puerto';
import { avisosDeConexion } from './cable-schedule';
import { captacionDeVoz, esMicrofonoDeVoz, funcionEquipo, type CatalogoAsistente, type ProcedenciaDato } from './asistente-equipamiento';
import type { DatoTecnico } from './ficha-tecnica';
import { ETIQUETA_SENAL, type Conexion, type EquipoEnSala, type Puerto } from './tipos';
import { estadoComercialCable, type CableSuministrado } from './suministros';

export type NivelTecnico = 'error' | 'aviso' | 'pendiente';

export interface ElementoAfectado {
  tipo: 'equipo' | 'conexion' | 'boca' | 'articulo' | 'sala';
  id: string;
  nombre: string;
}

export interface AvisoTecnico {
  /** Estable: se compara entre revisiones y se prueba sin depender del texto. */
  clave: string;
  nivel: NivelTecnico;
  /** Por qué sale este aviso, con el número o el nombre concreto. */
  causa: string;
  elemento: ElementoAfectado;
  accion: { texto: string; destino: string | null };
  /** De dónde sale el dato que sostiene el aviso. */
  procedencia: ProcedenciaDato;
}

export interface MetrosDeConexion {
  /** Metros que hay que tirar: recorrido más holguras y margen, o la manual. */
  necesarios: number | null;
  /** Longitud comercial elegida para pedir ese cable. */
  comercial: number | null;
}

export interface EntradaRevisionTecnica {
  salaId: string;
  equipos: EquipoEnSala[];
  conexiones: Conexion[];
  /** Puertos de los artículos presentes, tal y como los da `obtenerSala()`. */
  puertos: Puerto[];
  catalogo: CatalogoAsistente;
  /** Hechos documentados por artículo. Un artículo ausente es «sin ficha». */
  hechos: Map<string, DatoTecnico[]>;
  /** Metros por conexión, ya calculados. Ausente = todavía sin calcular. */
  metros: Map<string, MetrosDeConexion>;
  /** Latiguillos físicos de la sala. La inclusión se lee de aquí, no de L1. */
  cables?: CableSuministrado[];
}

interface ExtremoLeido {
  lado: 'origen' | 'destino';
  equipo_id: string | null;
  puerto_id: string | null;
  ordinal: number | null;
  /** La roseta es de L2: aquí solo se reconoce para no tratarla como equipo. */
  roseta: boolean;
}

/** Los dos extremos de una conexión, con bocas detalladas o en forma histórica. */
export function extremosDeConexion(conexion: Conexion): ExtremoLeido[] {
  return (['origen', 'destino'] as const).map((lado) => {
    if (conexion.detalle.estado === 'completo') {
      const extremo = conexion.detalle[lado];
      if (extremo.tipo === 'roseta') {
        return { lado, equipo_id: null, puerto_id: null, ordinal: null, roseta: true };
      }
      return { lado, equipo_id: extremo.equipo_id, puerto_id: extremo.puerto_id, ordinal: extremo.ordinal, roseta: false };
    }
    return {
      lado,
      equipo_id: conexion[`${lado}_id`],
      puerto_id: conexion[`puerto_${lado}_id`] ?? null,
      ordinal: conexion[`puerto_${lado}_ordinal`] ?? null,
      roseta: false,
    };
  });
}

const ruta = (salaId: string, pestana: string) => `/salas/${salaId}/${pestana}`;

// ------------------------------------------------------------------ estructura

/**
 * Lo que no puede ser: identificadores ajenos, ordinales imposibles y dos
 * cables en la misma boca. Se rechaza, no se avisa.
 */
export function erroresEstructurales(entrada: EntradaRevisionTecnica): AvisoTecnico[] {
  const { salaId, equipos, conexiones, puertos } = entrada;
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const puertosPorId = new Map(puertos.map((p) => [p.id, p]));
  const errores: AvisoTecnico[] = [];
  const ocupante = new Map<string, string>();

  for (const c of conexiones) {
    const etiqueta = c.etiqueta_cable ?? c.id;
    for (const extremo of extremosDeConexion(c)) {
      if (extremo.roseta || extremo.equipo_id === null) continue;
      const equipo = equiposPorId.get(extremo.equipo_id);
      if (!equipo) {
        errores.push({
          clave: `estructura_equipo_ajeno:${c.id}:${extremo.lado}`,
          nivel: 'error',
          causa: `El ${extremo.lado} de ${etiqueta} apunta a un equipo que no está en esta sala.`,
          elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
          accion: { texto: 'Rehacer la conexión en el diagrama', destino: ruta(salaId, 'diagrama') },
          procedencia: 'verificado',
        });
        continue;
      }
      if (!extremo.puerto_id) continue;
      const puerto = puertosPorId.get(extremo.puerto_id);
      if (!puerto || puerto.articulo_id !== equipo.articulo_id) {
        errores.push({
          clave: `estructura_puerto_ajeno:${c.id}:${extremo.lado}`,
          nivel: 'error',
          causa: `El ${extremo.lado} de ${etiqueta} usa un puerto que no pertenece a ${equipo.nombre}.`,
          elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
          accion: { texto: 'Elegir una boca del propio equipo', destino: ruta(salaId, 'diagrama') },
          procedencia: 'verificado',
        });
        continue;
      }
      if (extremo.ordinal !== null && !ordinalValido(extremo.ordinal, puerto.total)) {
        errores.push({
          clave: `estructura_ordinal:${c.id}:${extremo.lado}`,
          nivel: 'error',
          causa: `${etiqueta} pide la boca ${extremo.ordinal} de ${puerto.nombre}, que solo tiene ${puerto.total}.`,
          elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
          accion: { texto: 'Corregir la boca en el diagrama', destino: ruta(salaId, 'diagrama') },
          procedencia: 'verificado',
        });
        continue;
      }
      if (extremo.ordinal === null) continue;
      const clave = claveBoca({ equipo_id: equipo.id, puerto_id: puerto.id, ordinal: extremo.ordinal });
      const previa = ocupante.get(clave);
      if (previa && previa !== c.id) {
        errores.push({
          clave: `estructura_boca_repetida:${clave}`,
          nivel: 'error',
          causa: `${puerto.nombre} ${extremo.ordinal} de ${equipo.nombre} aparece en dos conexiones a la vez.`,
          elemento: { tipo: 'boca', id: clave, nombre: `${equipo.nombre} · ${puerto.nombre} ${extremo.ordinal}` },
          accion: { texto: 'Liberar una de las dos conexiones', destino: ruta(salaId, 'diagrama') },
          procedencia: 'verificado',
        });
        continue;
      }
      ocupante.set(clave, c.id);
    }
  }
  return errores;
}

// ----------------------------------------------------------------- capacidades

/**
 * Bocas agotadas por equipo y puerto.
 *
 * Se cuenta la ocupación física boca a boca, no restando conexiones de un
 * total agregado. Una conexión histórica sin ordinal ocupa toda la fila hasta
 * que se detalle: cuenta, pero baja la procedencia a `parcial`, porque no se
 * ha comprobado en qué boca concreta está.
 */
export function avisosDeBocas(entrada: EntradaRevisionTecnica): AvisoTecnico[] {
  const { salaId, equipos, conexiones, puertos } = entrada;
  const ocupadas = new Set<string>();
  const sinOrdinal = new Map<string, { equipo: EquipoEnSala; puerto: Puerto }>();
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const puertosPorId = new Map(puertos.map((p) => [p.id, p]));

  for (const c of conexiones) {
    for (const extremo of extremosDeConexion(c)) {
      if (extremo.roseta || !extremo.equipo_id || !extremo.puerto_id) continue;
      const equipo = equiposPorId.get(extremo.equipo_id);
      const puerto = puertosPorId.get(extremo.puerto_id);
      if (!equipo || !puerto || puerto.articulo_id !== equipo.articulo_id) continue;
      if (extremo.ordinal === null) {
        sinOrdinal.set(`${equipo.id}:${puerto.id}`, { equipo, puerto });
        continue;
      }
      if (!ordinalValido(extremo.ordinal, puerto.total)) continue;
      ocupadas.add(claveBoca({ equipo_id: equipo.id, puerto_id: puerto.id, ordinal: extremo.ordinal }));
    }
  }

  const avisos: AvisoTecnico[] = [];
  for (const { equipo, puerto } of sinOrdinal.values()) {
    avisos.push({
      clave: `bocas_sin_ordinal:${equipo.id}:${puerto.id}`,
      nivel: 'pendiente',
      causa: `${equipo.nombre}: ${puerto.nombre} tiene una conexión histórica sin boca concreta. No se ha comprobado la ocupación.`,
      elemento: { tipo: 'equipo', id: equipo.id, nombre: equipo.nombre },
      accion: { texto: 'Detallar la boca de la conexión histórica', destino: ruta(salaId, 'diagrama') },
      procedencia: 'parcial',
    });
  }

  for (const equipo of equipos) {
    for (const puerto of puertos.filter((p) => p.articulo_id === equipo.articulo_id)) {
      const bocas = bocasDePuerto(puerto, equipo.id);
      if (bocas.length === 0) continue;
      const usadas = bocas.filter((b) => ocupadas.has(claveBoca(b)));
      if (usadas.length < bocas.length) continue;
      avisos.push({
        clave: `bocas_agotadas:${equipo.id}:${puerto.id}`,
        nivel: 'aviso',
        causa: `${equipo.nombre}: ${puerto.nombre} no tiene bocas libres (${usadas.length} de ${bocas.length} ocupadas).`,
        elemento: { tipo: 'equipo', id: equipo.id, nombre: equipo.nombre },
        accion: { texto: 'Liberar una boca o añadir otro equipo', destino: ruta(salaId, 'diagrama') },
        procedencia: 'verificado',
      });
    }
  }
  return avisos;
}

/** Señal, sentido, conector y PoE. Todo avisa; nada bloquea. */
export function avisosDeCompatibilidad(entrada: EntradaRevisionTecnica): AvisoTecnico[] {
  const { salaId, equipos, conexiones, puertos, hechos } = entrada;
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));
  const puertosPorId = new Map(puertos.map((p) => [p.id, p]));
  const avisos: AvisoTecnico[] = [];

  for (const c of conexiones) {
    const etiqueta = c.etiqueta_cable ?? c.id;
    const [origen, destino] = extremosDeConexion(c);
    const pOrigen = origen.puerto_id ? puertosPorId.get(origen.puerto_id) : undefined;
    const pDestino = destino.puerto_id ? puertosPorId.get(destino.puerto_id) : undefined;

    for (const texto of avisosDeConexion(c, pOrigen, pDestino, undefined)) {
      avisos.push({
        clave: `compatibilidad:${c.id}:${texto.slice(0, 24)}`,
        nivel: 'aviso',
        causa: `${etiqueta}: ${texto}`,
        elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
        accion: { texto: 'Revisar las bocas o declarar el adaptador', destino: ruta(salaId, 'diagrama') },
        procedencia: 'verificado',
      });
    }

    if (pOrigen && pDestino) {
      if (pOrigen.conector && pDestino.conector && pOrigen.conector !== pDestino.conector) {
        avisos.push({
          clave: `conector:${c.id}`,
          nivel: 'aviso',
          causa: `${etiqueta}: conectores distintos, ${pOrigen.conector} en origen y ${pDestino.conector} en destino. Hace falta un adaptador declarado.`,
          elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
          accion: { texto: 'Declarar el adaptador o cambiar de boca', destino: ruta(salaId, 'diagrama') },
          procedencia: 'verificado',
        });
      } else if (!pOrigen.conector || !pDestino.conector) {
        avisos.push({
          clave: `conector_pendiente:${c.id}`,
          nivel: 'pendiente',
          causa: `${etiqueta}: falta el conector documentado en ${!pOrigen.conector ? pOrigen.nombre : pDestino.nombre}. Sin él no se puede afirmar que los extremos casen.`,
          elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
          accion: { texto: 'Documentar el conector en la ficha del artículo', destino: null },
          procedencia: 'sin_documentar',
        });
      }
    }

    // PoE: solo se mira cuando alguien lo ha documentado. Un equipo sin ficha
    // no se declara alimentado ni desalimentado; se declara sin comprobar.
    if (c.senal === 'red' && origen.equipo_id && destino.equipo_id) {
      const roles = [origen, destino].map((extremo) => {
        const equipo = equiposPorId.get(extremo.equipo_id!);
        const ficha = equipo ? hechos.get(equipo.articulo_id) ?? [] : [];
        const poe = ficha.find((h) => h.tipo === 'poe' && h.valor !== null && h.estado !== 'sin_documentar');
        return { equipo, rol: poe?.valor ? (poe.valor as { rol: 'pd' | 'pse' }).rol : null, estado: poe?.estado ?? null };
      });
      const consumidor = roles.find((r) => r.rol === 'pd');
      if (consumidor?.equipo) {
        const alimenta = roles.find((r) => r.rol === 'pse');
        if (!alimenta) {
          const otro = roles.find((r) => r !== consumidor);
          avisos.push({
            clave: `poe:${c.id}`,
            nivel: otro?.rol === 'pd' ? 'aviso' : 'pendiente',
            causa: otro?.rol === 'pd'
              ? `${etiqueta}: los dos extremos reciben PoE. Ninguno alimenta al otro.`
              : `${etiqueta}: ${consumidor.equipo.nombre} se alimenta por PoE y el otro extremo no tiene alimentación PoE documentada.`,
            elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
            accion: { texto: 'Documentar el PoE del otro extremo o prever inyector', destino: null },
            procedencia: otro?.rol === 'pd' ? 'verificado' : 'sin_documentar',
          });
        }
      }
    }
  }
  return avisos;
}

/**
 * Cable incluido y longitud comercial contra el recorrido calculado.
 *
 * Un latiguillo incluido de longitud desconocida no acredita que llegue, y una
 * longitud comercial menor que el recorrido tampoco: `ajustarALongitudComercial`
 * devuelve la mayor disponible cuando ninguna cubre la tirada, así que ese
 * número no puede pasar por suficiente sin decirlo.
 */
export function avisosDeCable(entrada: EntradaRevisionTecnica): AvisoTecnico[] {
  const { salaId, conexiones, metros, cables } = entrada;
  const fisicos = new Map((cables ?? []).map((k) => [k.id, k]));
  const avisos: AvisoTecnico[] = [];

  for (const c of conexiones) {
    const etiqueta = c.etiqueta_cable ?? c.id;
    const m = metros.get(c.id);
    if (!m || m.necesarios === null) continue;
    const necesarios = m.necesarios;
    const estado = estadoComercialCable(c.estado_suministro);
    const fisico = c.cable_suministrado_id ? fisicos.get(c.cable_suministrado_id) : undefined;

    if (estado === 'por_determinar') {
      avisos.push({
        clave: `cable_suministro_pendiente:${c.id}`,
        nivel: 'pendiente',
        causa: `${etiqueta}: el suministro del cable está por determinar para los ${redondear(necesarios)} m calculados. No suma compra y no acredita que llegue.`,
        elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
        accion: { texto: 'Asignar un latiguillo incluido o marcar cable adicional', destino: ruta(salaId, 'cableado') },
        procedencia: 'sin_documentar',
      });
    } else if (estado === 'incluido') {
      const utilizable = fisico?.longitud_utilizable_m ?? null;
      if (utilizable == null) {
        avisos.push({
          clave: `cable_longitud_pendiente:${c.id}`,
          nivel: 'pendiente',
          causa: `${etiqueta}: el cable suministrado no tiene longitud documentada y la tirada pide ${redondear(necesarios)} m.`,
          elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
          accion: { texto: 'Documentar la longitud del cable incluido', destino: null },
          procedencia: 'sin_documentar',
        });
      } else if (utilizable + 1e-9 < necesarios) {
        avisos.push({
          clave: `cable_insuficiente:${c.id}`,
          nivel: 'aviso',
          causa: `${etiqueta}: el cable incluido mide ${redondear(utilizable)} m y la tirada necesita ${redondear(necesarios)} m.`,
          elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
          accion: { texto: 'Añadir cable adicional o acortar el recorrido', destino: ruta(salaId, 'cableado') },
          procedencia: 'verificado',
        });
      }
    }

    if (m.comercial !== null && m.comercial + 1e-9 < necesarios) {
      avisos.push({
        clave: `cable_comercial_insuficiente:${c.id}`,
        nivel: 'aviso',
        causa: `${etiqueta}: la longitud comercial disponible es de ${redondear(m.comercial)} m y no cubre los ${redondear(necesarios)} m calculados.`,
        elemento: { tipo: 'conexion', id: c.id, nombre: etiqueta },
        accion: { texto: 'Elegir otro cable o repartir la tirada', destino: ruta(salaId, 'cableado') },
        procedencia: 'verificado',
      });
    }
  }
  return avisos;
}

// -------------------------------------------------------------- documentación

/**
 * Lo que impide decir «Todo listo»: fichas sin documentar, sala sin conexiones
 * y equipos sin posición confirmada. No bloquean el trabajo; impiden acreditarlo.
 */
export function avisosDeDocumentacion(entrada: EntradaRevisionTecnica): AvisoTecnico[] {
  const { salaId, equipos, conexiones, hechos, catalogo } = entrada;
  const avisos: AvisoTecnico[] = [];

  const articulos = [...new Set(equipos.map((e) => e.articulo_id))];
  for (const articuloId of articulos) {
    const ficha = (hechos.get(articuloId) ?? []).filter((h) => h.estado !== 'sin_documentar' && h.valor !== null);
    if (ficha.length > 0) continue;
    const equipo = equipos.find((e) => e.articulo_id === articuloId)!;
    const referencia = catalogo.get(articuloId);
    avisos.push({
      clave: `ficha_sin_documentar:${articuloId}`,
      nivel: 'pendiente',
      causa: `${referencia ? [referencia.marca, referencia.modelo].filter(Boolean).join(' ') : equipo.nombre}: sin ficha técnica documentada. Sin datos no se puede afirmar compatibilidad.`,
      elemento: { tipo: 'articulo', id: articuloId, nombre: equipo.nombre },
      accion: { texto: 'Consultar y documentar la ficha del artículo', destino: `/articulo/${articuloId}` },
      procedencia: 'sin_documentar',
    });
  }

  if (equipos.length > 0 && conexiones.length === 0) {
    avisos.push({
      clave: 'sin_conexiones',
      nivel: 'pendiente',
      causa: 'La sala tiene equipos y ninguna conexión: no hay montaje que acreditar.',
      elemento: { tipo: 'sala', id: salaId, nombre: 'Sala' },
      accion: { texto: 'Unir las bocas en el diagrama', destino: ruta(salaId, 'diagrama') },
      procedencia: 'verificado',
    });
  }

  const sinColocar = equipos.filter((e) => !e.posicion_confirmada);
  if (sinColocar.length > 0) {
    avisos.push({
      clave: 'posicion_sin_confirmar',
      nivel: 'pendiente',
      causa: `${sinColocar.length} de ${equipos.length} ${equipos.length === 1 ? 'equipo' : 'equipos'} sin posición confirmada: ${sinColocar.map((e) => e.nombre).join(', ')}. Los metros salen de una estimación.`,
      elemento: { tipo: 'equipo', id: sinColocar[0].id, nombre: sinColocar[0].nombre },
      accion: { texto: 'Colocar los equipos en el plano', destino: ruta(salaId, 'plano') },
      procedencia: 'parcial',
    });
  }

  return avisos;
}

/** Captación de voz de los equipos ya instalados, no del candidato. */
export function avisosDeCaptacion(entrada: EntradaRevisionTecnica): AvisoTecnico[] {
  const { salaId, equipos, catalogo, hechos } = entrada;
  const referencias = equipos.map((e) => ({ equipo: e, referencia: catalogo.get(e.articulo_id) }));
  const videos = referencias.filter((r) => funcionEquipo(r.referencia) === 'videoconferencia');
  const hayMicro = referencias.some((r) => esMicrofonoDeVoz(r.referencia));
  const avisos: AvisoTecnico[] = [];

  if (videos.length > 1) {
    avisos.push({
      clave: 'videoconferencia_duplicada',
      nivel: 'aviso',
      causa: `La sala tiene ${videos.length} sistemas de videoconferencia: ${videos.map((v) => v.equipo.nombre).join(', ')}. Puede ser deliberado.`,
      elemento: { tipo: 'equipo', id: videos[0].equipo.id, nombre: videos[0].equipo.nombre },
      accion: { texto: 'Revisar el equipo ya instalado', destino: `${ruta(salaId, 'equipamiento')}#equipo-${videos[0].equipo.id}` },
      procedencia: 'verificado',
    });
  }

  for (const { equipo, referencia } of videos) {
    const captacion = captacionDeVoz(referencia, hechos.get(equipo.articulo_id) ?? []);
    if (captacion.captacion === 'desconocida') {
      avisos.push({
        clave: `captacion_desconocida:${equipo.id}`,
        nivel: 'pendiente',
        causa: `${equipo.nombre}: captación de voz sin documentar. Que no conste no significa que la lleve integrada ni que no necesite micrófono.`,
        elemento: { tipo: 'equipo', id: equipo.id, nombre: equipo.nombre },
        accion: { texto: 'Documentar la captación en la ficha del artículo', destino: `/articulo/${equipo.articulo_id}` },
        procedencia: 'sin_documentar',
      });
      continue;
    }
    if (captacion.captacion === 'externa' && !hayMicro) {
      avisos.push({
        clave: `captacion_ausente:${equipo.id}`,
        nivel: 'aviso',
        causa: `${equipo.nombre}: requiere captación de voz externa y la sala no tiene ningún micrófono.`,
        elemento: { tipo: 'equipo', id: equipo.id, nombre: equipo.nombre },
        accion: { texto: 'Añadir un micrófono al equipamiento', destino: ruta(salaId, 'equipamiento') },
        procedencia: captacion.procedencia,
      });
      continue;
    }
    if (captacion.captacion === 'integrada' && captacion.restricciones.length > 0) {
      avisos.push({
        clave: `captacion_restringida:${equipo.id}`,
        nivel: 'aviso',
        causa: `${equipo.nombre}: captación integrada documentada con límites. ${captacion.restricciones.join(' ')}`,
        elemento: { tipo: 'equipo', id: equipo.id, nombre: equipo.nombre },
        accion: { texto: 'Comprobar la cobertura en esta sala', destino: `/articulo/${equipo.articulo_id}` },
        procedencia: captacion.procedencia,
      });
    }
  }
  return avisos;
}

// --------------------------------------------------------------------- resumen

export function revisarTecnicamente(entrada: EntradaRevisionTecnica): AvisoTecnico[] {
  return [
    ...erroresEstructurales(entrada),
    ...avisosDeCaptacion(entrada),
    ...avisosDeBocas(entrada),
    ...avisosDeCompatibilidad(entrada),
    ...avisosDeCable(entrada),
    ...avisosDeDocumentacion(entrada),
  ];
}

export interface ResumenTecnico {
  estado: 'error' | 'aviso' | 'pendiente' | 'listo';
  errores: number;
  avisos: number;
  pendientes: number;
}

export const ETIQUETA_NIVEL_TECNICO: Record<NivelTecnico, string> = {
  error: 'Error',
  aviso: 'Aviso',
  pendiente: 'Pendiente',
};

/**
 * «Todo listo» solo cuando no queda nada: ni error, ni aviso, ni pendiente.
 *
 * Un pendiente no es un aviso menor que se pueda ignorar para llegar al verde:
 * es exactamente lo que todavía no se ha comprobado, y enseñar verde sobre
 * datos que faltan es la manera de que alguien salga a obra confiado.
 */
export function resumirRevisionTecnica(avisos: AvisoTecnico[]): ResumenTecnico {
  const cuenta = (nivel: NivelTecnico) => avisos.filter((a) => a.nivel === nivel).length;
  const errores = cuenta('error');
  const avisosTecnicos = cuenta('aviso');
  const pendientes = cuenta('pendiente');
  return {
    estado: errores > 0 ? 'error' : avisosTecnicos > 0 ? 'aviso' : pendientes > 0 ? 'pendiente' : 'listo',
    errores,
    avisos: avisosTecnicos,
    pendientes,
  };
}

/** Para la tabla de cables y la lectura corta: la señal en palabras. */
export function describirSenal(senal: Conexion['senal']): string {
  return ETIQUETA_SENAL[senal];
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

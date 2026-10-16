import 'server-only';
import type postgres from 'postgres';
import { limitesDeEntrada } from './plantilla-preview';
import type { MedidasSala } from './plano-editor';
import type { Sala, EquipoEnSala, MuebleEnSala, PuertaEnSala, TomaRed, Conexion } from './tipos';

/** Sólo la geometría ya persistida; se consulta dentro del cerrojo de sala. */
export async function problemasAlMedirSala(tx: postgres.TransactionSql<Record<string, unknown>>, id: string, medidas: MedidasSala, mesa: { mesa_x_m: number | null; mesa_y_m: number | null }) {
  const equipos = await tx<Array<{ id: string; x_m: string; y_m: string; z_m: string; posicion_confirmada: boolean }>>`select id,x_m,y_m,z_m,posicion_confirmada from sala_equipos where sala_id=${id}`;
  const muebles = await tx<Array<Record<string, unknown>>>`select id,x_m,y_m,z_m,posicion_confirmada from sala_mobiliario where sala_id=${id}`;
  const tomas = await tx<Array<Record<string, unknown>>>`select id,x_m,y_m,z_m from tomas_red where sala_id=${id}`;
  const puertas = await tx<Array<Record<string, unknown>>>`select id,pared,posicion_m,anchura_m,altura_m from puertas where sala_id=${id}`;
  const puntos = await tx<Array<Record<string, unknown>>>`select p.* from conexion_puntos_paso p join conexiones c on c.id=p.conexion_id where c.sala_id=${id}`;
  const n = (v: unknown) => v == null ? null : Number(v);
  return limitesDeEntrada({ sala: { ...medidas, ...mesa } as Sala,
    equipos: equipos.map(e => ({ id: e.id, posicion: { x_m: Number(e.x_m), y_m: Number(e.y_m), z_m: Number(e.z_m) }, posicion_confirmada: e.posicion_confirmada })) as EquipoEnSala[],
    muebles: muebles.map(m => ({ id: String(m.id), x_m: n(m.x_m), y_m: n(m.y_m), z_m: n(m.z_m), posicion_confirmada: m.posicion_confirmada === true })) as MuebleEnSala[],
    tomas: tomas.map(t => ({ id: String(t.id), x_m: n(t.x_m), y_m: n(t.y_m), z_m: n(t.z_m) })) as TomaRed[],
    puertas: puertas.map(p => ({ id: String(p.id), pared: p.pared, posicion_m: Number(p.posicion_m), anchura_m: n(p.anchura_m), altura_m: n(p.altura_m) })) as PuertaEnSala[],
    conexiones: [{ id: 'guardado', puntos_paso: puntos.map(p => ({ x_m: Number(p.x_m), y_m: Number(p.y_m), z_m: Number(p.z_m) })) }] as Conexion[],
  });
}

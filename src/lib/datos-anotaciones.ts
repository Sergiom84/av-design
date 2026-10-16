import 'server-only';
import { sql } from './db';
import type { AnotacionDiseno } from './anotaciones-diseno';

export async function obtenerAnotacionesSala(salaId: string): Promise<AnotacionDiseno[]> {
  const notas = await sql<AnotacionDiseno[]>`select id, texto, ancla_tipo, ancla_id, x, y from anotaciones_sala where sala_id = ${salaId} order by creado_en, id`;
  return notas.map(a => ({ ...a, x: a.x === null ? null : Number(a.x), y: a.y === null ? null : Number(a.y) }));
}

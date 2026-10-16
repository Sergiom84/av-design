import { ErrorSeguimiento } from './modelo';
import { exigirFinanzas, type Conexion, type Identidad } from './autorizacion';
import type { Cabecera, MetaRevision } from './repositorio';

/** Sólo capacidad y jerarquía mínima; no importa lectores financieros05/07B. */
export async function enlaceResultados(c: Conexion, u: Identidad,
  p: Pick<Cabecera, 'id'>, r: Pick<MetaRevision, 'id' | 'ambito_fuente'>) {
  try { exigirFinanzas(u); }
  catch (e) { if (e instanceof ErrorSeguimiento && e.status === 403) return null; throw e; }
  let proyectoId: string | null = r.ambito_fuente.tipo === 'obra' ? r.ambito_fuente.id : null;
  if (r.ambito_fuente.tipo === 'sala') {
    const [sala] = await c`select l.proyecto_id from salas s
      left join localizaciones l on l.id=s.localizacion_id where s.id=${r.ambito_fuente.id}`;
    proyectoId = sala?.proyecto_id ?? null;
  }
  if (!proyectoId) return { disponible: false, href: null,
    mensaje: 'La sala no tiene obra. Su propuesta se conserva, pero no dispone de un corte de costes de obra comparable.' };
  return { disponible: true,
    href: `/proyectos/${proyectoId}/resultados?propuesta=${p.id}&revision=${r.id}`,
    mensaje: 'Elige un corte real y revisa alcance, cobertura, período y tratamiento fiscal antes de guardar la comparación.' };
}

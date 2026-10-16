import { z } from 'zod';
import { ejecutarHttpConsulta } from '@/lib/consultas/http';
import { ErrorConsulta, validar } from '@/lib/consultas/modelo';
import { exigirConsulta, identidadConsulta } from '@/lib/consultas/autorizacion';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({ tipo: z.enum(['sala', 'obra', 'catalogo']).default('sala'), id: z.uuid().optional(), q: z.string().trim().max(100).default(''), pagina: z.coerce.number().int().min(0).max(100000).default(0) }).strict();
export async function GET(req: Request) { return ejecutarHttpConsulta(req, false, async (r, yo) => { const o = validar(schema, Object.fromEntries(new URL(req.url).searchParams)); return r.lectura(async (sql) => { const u = await identidadConsulta(sql, yo); if (o.tipo === 'catalogo') {
    exigirConsulta(u, ['catalogo']);
    return { opciones: [], siguiente: null };
} exigirConsulta(u, o.tipo === 'obra' ? ['proyectos', 'salas'] : ['salas']); const patron = `%${o.q.replace(/[\\%_]/g, '\\$&')}%`; let rows; if (o.tipo === 'obra' && !o.id)
    rows = await sql `select id,nombre,codigo from proyectos where concat_ws(' ',nombre,codigo) ilike ${patron} order by nombre,id limit 21 offset ${o.pagina * 20}`;
else if (o.tipo === 'obra' && o.id) {
    if (!(await sql `select id from proyectos where id=${o.id}`).length)
        throw new ErrorConsulta('AMBITO', 'Obra no disponible.', 404);
    rows = await sql `select s.id,s.nombre,s.codigo from salas s left join localizaciones l on l.id=s.localizacion_id where l.proyecto_id=${o.id} and concat_ws(' ',s.nombre,s.codigo) ilike ${patron} order by s.nombre,s.id limit 21 offset ${o.pagina * 20}`;
}
else
    rows = await sql `select id,nombre,codigo from salas where concat_ws(' ',nombre,codigo) ilike ${patron} order by nombre,id limit 21 offset ${o.pagina * 20}`; return { opciones: rows.slice(0, 20), siguiente: rows.length > 20 ? o.pagina + 1 : null }; }); }); }

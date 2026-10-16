import { ejecutarHttpConsulta, leerJsonConsulta, turnosConsultaSchema } from '@/lib/consultas/http';
import { uuidConsulta, preguntarConsultaSchema, validar } from '@/lib/consultas/modelo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = {
    params: Promise<{
        id: string;
    }>;
};
export async function GET(req: Request, ctx: Contexto) { return ejecutarHttpConsulta(req, false, async (r, yo) => { const id = validar(uuidConsulta, (await ctx.params).id), q = validar(turnosConsultaSchema, Object.fromEntries(new URL(req.url).searchParams)); return r.listarTurnos(yo, id, q.desde); }); }
export async function POST(req: Request, ctx: Contexto) { return ejecutarHttpConsulta(req, true, async (r, yo) => r.preguntar(yo, validar(uuidConsulta, (await ctx.params).id), await leerJsonConsulta(req, preguntarConsultaSchema))); }

import { ejecutarHttpConsulta } from '@/lib/consultas/http';
import { uuidConsulta, validar } from '@/lib/consultas/modelo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, ctx: {
    params: Promise<{
        id: string;
        turnoId: string;
    }>;
}) { return ejecutarHttpConsulta(req, false, async (r, yo) => { const p = await ctx.params; return r.obtenerTurno(yo, validar(uuidConsulta, p.id), validar(uuidConsulta, p.turnoId)); }); }

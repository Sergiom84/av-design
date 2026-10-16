import { ejecutarHttpConsulta, leerJsonConsulta } from '@/lib/consultas/http';
import { uuidConsulta, retenerConsultaSchema, borrarConsultaSchema, validar } from '@/lib/consultas/modelo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = {
    params: Promise<{
        id: string;
    }>;
};
export async function PATCH(req: Request, ctx: Contexto) { return ejecutarHttpConsulta(req, true, async (r, yo) => { const id = validar(uuidConsulta, (await ctx.params).id), e = await leerJsonConsulta(req, retenerConsultaSchema); return r.retener(yo, id, e.version, e.retencionDias); }); }
export async function DELETE(req: Request, ctx: Contexto) { return ejecutarHttpConsulta(req, true, async (r, yo) => { const id = validar(uuidConsulta, (await ctx.params).id), e = await leerJsonConsulta(req, borrarConsultaSchema); return r.borrar(yo, id, e.version); }); }

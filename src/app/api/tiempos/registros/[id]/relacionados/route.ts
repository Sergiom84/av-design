import { atenderTiempo } from '@/lib/tiempos/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return atenderTiempo(req, 'relacionados', await ctx.params); }

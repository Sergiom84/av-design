import { atenderTiempo } from '@/lib/tiempos/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return atenderTiempo(req, 'anular', await ctx.params); }

import { atenderInforme } from '@/lib/informes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: {
    params: Promise<Record<string, string>>;
}) {
    return atenderInforme(request, 'ejecutar', await context.params);
}

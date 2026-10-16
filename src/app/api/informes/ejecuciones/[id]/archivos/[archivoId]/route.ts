import { atenderInforme } from '@/lib/informes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: {
    params: Promise<Record<string, string>>;
}) {
    return atenderInforme(request, 'archivo', await context.params);
}

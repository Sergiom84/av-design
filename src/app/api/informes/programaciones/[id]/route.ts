import { atenderInforme } from '@/lib/informes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PATCH(request: Request, context: {
    params: Promise<Record<string, string>>;
}) {
    return atenderInforme(request, 'programacion', await context.params);
}

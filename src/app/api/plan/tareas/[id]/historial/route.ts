import { atenderPlan } from '@/lib/planificacion/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    return atenderPlan(request, 'historial', await context.params);
}
export async function POST(request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    return atenderPlan(request, 'historial', await context.params);
}

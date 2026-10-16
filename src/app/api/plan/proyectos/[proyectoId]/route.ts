import { atenderPlan } from '@/lib/planificacion/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: {
    params: Promise<{
        proyectoId: string;
    }>;
}) {
    return atenderPlan(request, 'proyecto', await context.params);
}
export async function POST(request: Request, context: {
    params: Promise<{
        proyectoId: string;
    }>;
}) {
    return atenderPlan(request, 'proyecto', await context.params);
}
export async function PATCH(request: Request, context: {
    params: Promise<{
        proyectoId: string;
    }>;
}) {
    return atenderPlan(request, 'proyecto', await context.params);
}

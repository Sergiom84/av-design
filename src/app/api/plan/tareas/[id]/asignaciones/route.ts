import { atenderPlan } from '@/lib/planificacion/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    return atenderPlan(request, 'asignaciones', await context.params);
}

import { atenderPlan } from '@/lib/planificacion/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: {
    params: Promise<{
        proyectoId: string;
    }>;
}) {
    return atenderPlan(request, 'preparar', await context.params);
}

import { atenderPlan } from '@/lib/planificacion/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
    return atenderPlan(request, 'reglas');
}
export async function POST(request: Request) {
    return atenderPlan(request, 'reglas');
}

import { atenderPropuesta } from '@/lib/propuestas/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, contexto: {
    params: Promise<{
        id: string;
    }>;
}) { return atenderPropuesta(request, 'detalle', await contexto.params); }
export async function POST(request: Request, contexto: {
    params: Promise<{
        id: string;
    }>;
}) { return atenderPropuesta(request, 'detalle', await contexto.params); }
export async function PATCH(request: Request, contexto: {
    params: Promise<{
        id: string;
    }>;
}) { return atenderPropuesta(request, 'detalle', await contexto.params); }
